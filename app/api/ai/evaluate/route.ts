import { NextResponse } from "next/server";
import {
  aiSuggestedFindingToFinding,
  aiSuggestedFindingsSchema,
  buildSpecializedAIPrompt,
  normalizeAISuggestedFinding,
  validateAISuggestedFinding,
  type AISuggestedFinding,
  type AssessmentAIContext,
  type CorrelationCandidate
} from "@/lib/ai-analysis";

type EvaluationArea = "topology" | "configuration" | "security" | "lifecycle" | "operations" | "logs";
type AIContextBatch = {
  context: AssessmentAIContext;
  correlationCandidates: CorrelationCandidate[];
  batchIndex: number;
  batchCount: number;
};

const maxAiContextChars = 42000;
const topologyRelationBatchSize = 55;

const areaLabels: Record<EvaluationArea, string> = {
  topology: "Analisis topologico",
  configuration: "Analisis de configuraciones",
  security: "Seguridad y hardening",
  lifecycle: "Vigencia tecnologica",
  operations: "Operaciones y mantenibilidad",
  logs: "Logs y eventos"
};

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-openai-api-key")?.trim() || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY no esta configurada. Agrega la llave en Ajustes o define la variable en .env.local." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const area = body?.area as EvaluationArea | undefined;
  const context = body?.context as AssessmentAIContext | undefined;
  const correlationCandidates = Array.isArray(body?.correlationCandidates) ? (body.correlationCandidates as CorrelationCandidate[]) : [];
  if (!area || !areaLabels[area] || !context) {
    return NextResponse.json({ error: "Solicitud invalida: se requiere area y context." }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const promptType = promptTypeForArea(area);
  const compactContext = compactContextForArea(context, area, correlationCandidates);
  const compactCandidates = compactCorrelationCandidates(correlationCandidates, area, compactContext);
  const batches = createAIContextBatches(compactContext, compactCandidates, area);
  const allSuggestedFindings: AISuggestedFinding[] = [];
  const allRejectedFindings: Array<{ id: string; title: string; errors: string[] }> = [];

  try {
    for (const batch of batches) {
      const data = await callOpenAIForBatch({ apiKey, model, promptType, area, batch });
      const text = extractResponseText(data);
      const parsed = JSON.parse(text || "{\"suggestedFindings\":[]}") as { suggestedFindings?: Partial<AISuggestedFinding>[] };
      const normalizedFindings = (parsed.suggestedFindings ?? []).map((finding) => normalizeAISuggestedFinding(finding, context.assessmentId));
      const validationResults = normalizedFindings.map((finding) => ({
        finding,
        validation: validateAISuggestedFinding(finding, batch.context, batch.correlationCandidates)
      }));

      allSuggestedFindings.push(...validationResults.filter((item) => item.validation.valid).map((item) => item.finding));
      allRejectedFindings.push(
        ...validationResults
          .filter((item) => !item.validation.valid)
          .map((item) => ({
            id: item.finding.id,
            title: item.finding.title,
            errors: item.validation.errors
          }))
      );
    }
  } catch (error) {
    const status = error instanceof AIProviderError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error llamando OpenAI Responses API." },
      { status }
    );
  }

  const suggestedFindings = dedupeAISuggestedFindings(allSuggestedFindings);

  return NextResponse.json({
    suggestedFindings,
    findings: suggestedFindings.map((finding) => aiSuggestedFindingToFinding(finding, compactContext)),
    rejectedFindings: allRejectedFindings,
    model,
    batchCount: batches.length,
    compactedContext: true,
    contextStats: {
      originalChars: safeJsonLength({ context, correlationCandidates }),
      compactedChars: safeJsonLength({ context: compactContext, correlationCandidates: compactCandidates })
    }
  });
}

async function callOpenAIForBatch({
  apiKey,
  model,
  promptType,
  area,
  batch
}: {
  apiKey: string;
  model: string;
  promptType: ReturnType<typeof promptTypeForArea>;
  area: EvaluationArea;
  batch: AIContextBatch;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "Eres un arquitecto senior de infraestructura Cisco.",
                "Debes analizar assessments tecnicos de Enterprise Networking, Datacenter Networking y seguridad/perimetro.",
                "Tu salida no es un hallazgo final: es una sugerencia AI que debe revisar un arquitecto.",
                "No uses la ausencia de evidencia como buen resultado.",
                "No infieras saturacion o degradacion sin metricas, estado operativo o correlaciones provistas.",
                "Para lifecycle, solo confirma EoX si existen fechas Cisco o evidencia explicita en el contexto.",
                "Este endpoint no genera resumen ejecutivo, roadmap ni documento final.",
                buildSpecializedAIPrompt(promptType)
              ].join("\n")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task: `Ejecuta ${areaLabels[area]} para este assessment.`,
                assessmentId: batch.context.assessmentId,
                expectedOutput: "AISuggestedFinding[]",
                batching: {
                  batchIndex: batch.batchIndex,
                  batchCount: batch.batchCount,
                  instruction: batch.batchCount > 1
                    ? "Analiza solo el subconjunto incluido en este batch. No asumas que contiene toda la red."
                    : "El contexto fue compactado para caber en la ventana del modelo."
                },
                context: batch.context,
                correlationCandidates: batch.correlationCandidates
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "assessment_ai_suggested_findings",
          strict: true,
          schema: aiSuggestedFindingsSchema()
        }
      }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AIProviderError(data?.error?.message || "Error llamando OpenAI Responses API.", response.status);
  }

  return data;
}

function promptTypeForArea(_area: EvaluationArea) {
  return "technical_correlation" as const;
}

function extractResponseText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

function compactContextForArea(context: AssessmentAIContext, area: EvaluationArea, correlationCandidates: CorrelationCandidate[]): AssessmentAIContext {
  const candidateDevices = new Set(correlationCandidates.flatMap((candidate) => candidate.involvedDevices.map(normalizeKey)));
  const candidateInterfaces = new Set(correlationCandidates.flatMap((candidate) => candidate.involvedInterfaces.map(normalizeKey)));
  const candidateMetrics = new Set(correlationCandidates.flatMap((candidate) => candidate.involvedMetrics));
  const candidateConfigFacts = new Set(correlationCandidates.flatMap((candidate) => candidate.involvedConfigFacts));
  const candidateStateFacts = new Set(correlationCandidates.flatMap((candidate) => candidate.involvedStateFacts));
  const candidateEvidence = new Set(correlationCandidates.flatMap((candidate) => candidate.evidenceRefs));
  const topologyDeviceNames = new Set(context.topologyRelationships.flatMap((relation) => [relation.sourceDevice, relation.targetDevice]).map(normalizeKey));

  const devices = compactDevices(
    context.devices.filter((device) => {
      if (area === "topology") return topologyDeviceNames.has(normalizeKey(device.hostname)) || candidateDevices.has(normalizeKey(device.hostname));
      if (candidateDevices.size > 0) return candidateDevices.has(normalizeKey(device.hostname));
      return device.criticality === "critical" || device.criticality === "high";
    }),
    area === "topology" ? 160 : 80
  );
  const includedDeviceNames = new Set(devices.map((device) => normalizeKey(device.hostname)));

  const topologyRelationships = area === "topology"
    ? context.topologyRelationships.filter((relation) => includedDeviceNames.has(normalizeKey(relation.sourceDevice)) || includedDeviceNames.has(normalizeKey(relation.targetDevice)))
    : context.topologyRelationships.filter((relation) => (
        candidateDevices.has(normalizeKey(relation.sourceDevice)) ||
        candidateDevices.has(normalizeKey(relation.targetDevice)) ||
        candidateInterfaces.has(normalizeKey(`${relation.sourceDevice}:${relation.sourceInterface}`)) ||
        candidateInterfaces.has(normalizeKey(`${relation.targetDevice}:${relation.targetInterface}`))
      )).slice(0, 80);

  const configurationFacts = context.configurationFacts
    .filter((fact) => isConfigFactRelevantForArea(fact, area, candidateConfigFacts, candidateDevices))
    .slice(0, area === "configuration" || area === "security" ? 100 : 45)
    .map(compactConfigurationFact);
  const operationalStateFacts = context.operationalStateFacts
    .filter((fact) => isStateFactRelevantForArea(fact, area, candidateStateFacts, candidateDevices))
    .slice(0, area === "operations" || area === "logs" ? 100 : 45)
    .map(compactOperationalStateFact);
  const performanceMetrics = context.performanceMetrics
    .filter((metric) => candidateMetrics.has(metric.id) || (area === "topology" && candidateDevices.has(normalizeKey(metric.deviceId))))
    .slice(0, 50)
    .map(compactPerformanceMetric);
  const deterministicFindings = context.deterministicFindings
    .filter((finding) => isFindingRelevantForArea(finding, area, candidateDevices))
    .slice(0, 70)
    .map((finding) => ({
      ...finding,
      affectedAssets: finding.affectedAssets.slice(0, 12),
      evidenceRefs: finding.evidenceRefs.slice(0, 4)
    }));

  const referencedEvidence = collectReferencedEvidence({
    devices,
    topologyRelationships,
    configurationFacts,
    operationalStateFacts,
    performanceMetrics,
    deterministicFindings,
    correlationCandidates
  });
  for (const evidenceRef of candidateEvidence) referencedEvidence.add(evidenceRef);

  return {
    ...context,
    devices,
    topologyRelationships,
    configurationFacts,
    operationalStateFacts,
    performanceMetrics,
    deterministicFindings,
    evidenceReferences: context.evidenceReferences
      .filter((ref) => referencedEvidence.has(ref.id))
      .slice(0, 180)
      .map(compactEvidenceReference),
    missingEvidence: context.missingEvidence.slice(0, 12).map((item) => ({
      ...item,
      missingForDevices: item.missingForDevices.slice(0, 20)
    })),
    analysisLimitations: context.analysisLimitations.slice(0, 8),
    lifecycleSummary: {
      ...context.lifecycleSummary,
      riskyDevices: context.lifecycleSummary.riskyDevices.slice(0, 40)
    },
    operationalAssessmentSummary: context.operationalAssessmentSummary
      ? {
          ...context.operationalAssessmentSummary,
          keyGaps: context.operationalAssessmentSummary.keyGaps.slice(0, 8)
        }
      : undefined
  };
}

function createAIContextBatches(context: AssessmentAIContext, correlationCandidates: CorrelationCandidate[], area: EvaluationArea): AIContextBatch[] {
  const compactSize = safeJsonLength({ context, correlationCandidates });
  if (compactSize <= maxAiContextChars) {
    return [{ context, correlationCandidates, batchIndex: 1, batchCount: 1 }];
  }

  if (area === "topology" && context.topologyRelationships.length > topologyRelationBatchSize) {
    const relationshipChunks = chunkArray(context.topologyRelationships, topologyRelationBatchSize);
    return relationshipChunks.map((relationships, index) => {
      const deviceNames = new Set(relationships.flatMap((relation) => [relation.sourceDevice, relation.targetDevice]).map(normalizeKey));
      const batchCandidates = correlationCandidates.filter((candidate) => (
        candidate.involvedDevices.some((device) => deviceNames.has(normalizeKey(device))) ||
        candidate.evidenceRefs.some((ref) => relationships.some((relation) => relation.evidenceSource === ref))
      )).slice(0, 30);
      const batchContext = withReferencedEvidence({
        ...context,
        devices: context.devices.filter((device) => deviceNames.has(normalizeKey(device.hostname))),
        topologyRelationships: relationships,
        configurationFacts: context.configurationFacts.filter((fact) => deviceNames.has(normalizeKey(fact.deviceId))).slice(0, 30),
        operationalStateFacts: context.operationalStateFacts.filter((fact) => deviceNames.has(normalizeKey(fact.deviceId))).slice(0, 30),
        performanceMetrics: context.performanceMetrics.filter((metric) => deviceNames.has(normalizeKey(metric.deviceId))).slice(0, 30),
        deterministicFindings: context.deterministicFindings.filter((finding) => finding.affectedAssets.some((asset) => deviceNames.has(normalizeKey(asset)))).slice(0, 30)
      }, batchCandidates);

      return {
        context: batchContext,
        correlationCandidates: batchCandidates,
        batchIndex: index + 1,
        batchCount: relationshipChunks.length
      };
    });
  }

  const aggressiveContext = withReferencedEvidence({
    ...context,
    devices: context.devices.slice(0, 60),
    topologyRelationships: context.topologyRelationships.slice(0, 70),
    configurationFacts: context.configurationFacts.slice(0, 35),
    operationalStateFacts: context.operationalStateFacts.slice(0, 35),
    performanceMetrics: context.performanceMetrics.slice(0, 35),
    deterministicFindings: context.deterministicFindings.slice(0, 35),
    missingEvidence: context.missingEvidence.slice(0, 6),
    analysisLimitations: context.analysisLimitations.slice(0, 6)
  }, correlationCandidates.slice(0, 35));

  return [{
    context: aggressiveContext,
    correlationCandidates: correlationCandidates.slice(0, 35),
    batchIndex: 1,
    batchCount: 1
  }];
}

function compactCorrelationCandidates(candidates: CorrelationCandidate[], area: EvaluationArea, context: AssessmentAIContext) {
  const relevantTypes = relevantCorrelationTypesForArea(area);
  const deviceNames = new Set(context.devices.map((device) => normalizeKey(device.hostname)));
  const evidenceIds = new Set(context.evidenceReferences.map((ref) => ref.id));
  return candidates
    .filter((candidate) => (
      relevantTypes.has(candidate.correlationType) ||
      candidate.involvedDevices.some((device) => deviceNames.has(normalizeKey(device))) ||
      candidate.evidenceRefs.some((ref) => evidenceIds.has(ref))
    ))
    .slice(0, area === "topology" ? 90 : 45)
    .map((candidate) => ({
      ...candidate,
      involvedDevices: candidate.involvedDevices.slice(0, 12),
      involvedInterfaces: candidate.involvedInterfaces.slice(0, 12),
      involvedFindings: candidate.involvedFindings.slice(0, 8),
      involvedMetrics: candidate.involvedMetrics.slice(0, 8),
      involvedConfigFacts: candidate.involvedConfigFacts.slice(0, 8),
      involvedStateFacts: candidate.involvedStateFacts.slice(0, 8),
      evidenceRefs: candidate.evidenceRefs.slice(0, 8),
      description: truncate(candidate.description, 420)
    }));
}

function withReferencedEvidence(context: AssessmentAIContext, correlationCandidates: CorrelationCandidate[]) {
  const referencedEvidence = collectReferencedEvidence({
    devices: context.devices,
    topologyRelationships: context.topologyRelationships,
    configurationFacts: context.configurationFacts,
    operationalStateFacts: context.operationalStateFacts,
    performanceMetrics: context.performanceMetrics,
    deterministicFindings: context.deterministicFindings,
    correlationCandidates
  });

  return {
    ...context,
    evidenceReferences: context.evidenceReferences.filter((ref) => referencedEvidence.has(ref.id)).slice(0, 120).map(compactEvidenceReference)
  };
}

function collectReferencedEvidence(input: Pick<AssessmentAIContext, "devices" | "topologyRelationships" | "configurationFacts" | "operationalStateFacts" | "performanceMetrics" | "deterministicFindings"> & { correlationCandidates: CorrelationCandidate[] }) {
  const ids = new Set<string>();
  input.devices.forEach((device) => device.evidenceRefs.forEach((ref) => ids.add(ref)));
  input.topologyRelationships.forEach((relation) => ids.add(relation.evidenceSource));
  input.configurationFacts.forEach((fact) => ids.add(fact.evidenceRef));
  input.operationalStateFacts.forEach((fact) => ids.add(fact.evidenceRef));
  input.performanceMetrics.forEach((metric) => ids.add(metric.evidenceRef));
  input.deterministicFindings.forEach((finding) => finding.evidenceRefs.forEach((ref) => ids.add(ref)));
  input.correlationCandidates.forEach((candidate) => candidate.evidenceRefs.forEach((ref) => ids.add(ref)));
  return ids;
}

function compactDevices(devices: AssessmentAIContext["devices"], limit: number) {
  return devices.slice(0, limit).map((device) => ({
    ...device,
    evidenceRefs: device.evidenceRefs.slice(0, 3)
  }));
}

function compactConfigurationFact(fact: AssessmentAIContext["configurationFacts"][number]) {
  return {
    ...fact,
    description: truncate(fact.description, 280),
    normalizedValue: truncate(fact.normalizedValue, 180)
  };
}

function compactOperationalStateFact(fact: AssessmentAIContext["operationalStateFacts"][number]) {
  return {
    ...fact,
    observedState: truncate(fact.observedState, 240)
  };
}

function compactPerformanceMetric(metric: AssessmentAIContext["performanceMetrics"][number]) {
  return {
    ...metric,
    timeWindow: truncate(metric.timeWindow, 80)
  };
}

function compactEvidenceReference(ref: AssessmentAIContext["evidenceReferences"][number]) {
  return {
    ...ref,
    excerpt: truncate(ref.excerpt, 260)
  };
}

function relevantCorrelationTypesForArea(area: EvaluationArea) {
  const types: Record<EvaluationArea, Set<CorrelationCandidate["correlationType"]>> = {
    topology: new Set(["topology_resiliency_gap", "performance_topology_hotspot", "protocol_instability", "evidence_conflict"]),
    configuration: new Set(["config_state_mismatch", "config_performance_mismatch", "evidence_conflict"]),
    security: new Set(["security_config_exposure", "config_state_mismatch"]),
    lifecycle: new Set(["lifecycle_risk_amplifier"]),
    operations: new Set(["operational_visibility_gap", "protocol_instability", "evidence_conflict"]),
    logs: new Set(["protocol_instability", "operational_visibility_gap", "evidence_conflict"])
  };
  return types[area];
}

function isConfigFactRelevantForArea(
  fact: AssessmentAIContext["configurationFacts"][number],
  area: EvaluationArea,
  candidateConfigFacts: Set<string>,
  candidateDevices: Set<string>
) {
  if (candidateConfigFacts.has(fact.id) || candidateDevices.has(normalizeKey(fact.deviceId))) return true;
  if (area === "topology") return fact.category === "resiliency" || fact.category === "switching" || fact.category === "routing";
  if (area === "security") return fact.category === "security" || fact.category === "management";
  if (area === "configuration") return true;
  if (area === "operations" || area === "logs") return fact.category === "management" || fact.category === "resiliency";
  return false;
}

function isStateFactRelevantForArea(
  fact: AssessmentAIContext["operationalStateFacts"][number],
  area: EvaluationArea,
  candidateStateFacts: Set<string>,
  candidateDevices: Set<string>
) {
  if (candidateStateFacts.has(fact.id) || candidateDevices.has(normalizeKey(fact.deviceId))) return true;
  if (area === "topology") return fact.category === "switching" || fact.category === "routing" || fact.category === "interface";
  if (area === "operations" || area === "logs") return true;
  return ["high", "critical"].includes(fact.severityHint);
}

function isFindingRelevantForArea(finding: AssessmentAIContext["deterministicFindings"][number], area: EvaluationArea, candidateDevices: Set<string>) {
  if (finding.affectedAssets.some((asset) => candidateDevices.has(normalizeKey(asset)))) return true;
  if (area === "topology") return finding.category === "resiliency";
  if (area === "security") return finding.category === "security";
  if (area === "lifecycle") return finding.category === "lifecycle";
  if (area === "operations" || area === "logs") return finding.category === "operations";
  if (area === "configuration") return finding.category === "configuration";
  return false;
}

function dedupeAISuggestedFindings(findings: AISuggestedFinding[]) {
  const byKey = new Map<string, AISuggestedFinding>();
  for (const finding of findings) {
    const key = `${normalizeKey(finding.title)}:${finding.relatedDevices.map(normalizeKey).sort().join(",")}`;
    const existing = byKey.get(key);
    if (!existing || finding.confidence > existing.confidence) byKey.set(key, finding);
  }
  return Array.from(byKey.values());
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function safeJsonLength(value: unknown) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function truncate(value: string, maxLength: number) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

class AIProviderError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
  }
}
