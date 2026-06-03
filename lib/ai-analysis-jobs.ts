import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AIAnalysisJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "partially_completed";
export type AIAnalysisStepStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
export type AIAnalysisMode = "scope" | "full";
export type AIAnalysisScopeId =
  | "inventory"
  | "configuration"
  | "lifecycle"
  | "topology"
  | "routing"
  | "performance"
  | "security"
  | "high_availability"
  | "datacenter"
  | "campus"
  | "wan"
  | "perimeter"
  | "operations"
  | "evidence"
  | "roadmap"
  | "executive_summary";

type AIAnalysisPhaseName =
  | "context_preparation"
  | "evidence_extraction"
  | "normalization"
  | "scope_analysis"
  | "validation"
  | "scope_synthesis";

export type AIAnalysisJobSnapshot = {
  id: string;
  assessmentId: string;
  mode: AIAnalysisMode;
  scopeId: AIAnalysisScopeId | null;
  status: AIAnalysisJobStatus;
  progress: number;
  currentPhase: string | null;
  requestedBy: string | null;
  forceReevaluate: boolean;
  cancelRequested: boolean;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  steps: AIAnalysisStepSnapshot[];
};

export type AIAnalysisStepSnapshot = {
  id: string;
  scopeId: AIAnalysisScopeId;
  phaseName: AIAnalysisPhaseName | "reuse_existing_result";
  status: AIAnalysisStepStatus;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  inputHash: string | null;
  outputArtifactId: string | null;
};

export type CreateAIAnalysisJobInput = {
  assessmentId: string;
  mode: AIAnalysisMode;
  scopeId?: AIAnalysisScopeId | null;
  forceReevaluate?: boolean;
  requestedBy?: string;
};

const engineVersion = "ai-analysis-engine-v1";
const promptVersion = "assessment-ai-prompts-v1";
const maxChunkChars = 14000;

export const aiAnalysisScopes: Array<{ id: AIAnalysisScopeId; label: string; description: string }> = [
  { id: "inventory", label: "Inventario", description: "Inventario, identidad, modelos, seriales y roles." },
  { id: "configuration", label: "Configuracion", description: "Configuraciones, consistencia operativa y mejores practicas." },
  { id: "topology", label: "Topologia", description: "Relaciones CDP/LLDP, segmentos y resiliencia fisica/logica." },
  { id: "lifecycle", label: "Lifecycle", description: "Vigencia tecnologica de hardware y software." },
  { id: "routing", label: "Routing", description: "OSPF, BGP, rutas, VRF y consistencia de control plane." },
  { id: "wan", label: "WAN", description: "Conectividad WAN, borde, rutas y dependencias." },
  { id: "datacenter", label: "Datacenter", description: "Nexus, vPC, EVPN/VXLAN, modulos y ambiente." },
  { id: "campus", label: "Campus", description: "Acceso, distribucion, VLANs, STP y switching." },
  { id: "perimeter", label: "Perimetro", description: "Firewalls, NAT, VPN, ACLs y sesiones." },
  { id: "security", label: "Seguridad", description: "Hardening, exposiciones, administracion y controles." },
  { id: "performance", label: "Performance", description: "Capacidad, errores, drops, CPU, memoria y tendencias." },
  { id: "high_availability", label: "Alta disponibilidad", description: "Redundancia, failover, port-channels y puntos unicos." },
  { id: "operations", label: "Operacion", description: "Monitoreo, logging, NTP, soporte y procesos operativos." },
  { id: "evidence", label: "Evidencia", description: "Cobertura, brechas de levantamiento y trazabilidad." },
  { id: "roadmap", label: "Roadmap", description: "Remediaciones, dependencias y plan por prioridad." },
  { id: "executive_summary", label: "Resumen ejecutivo final", description: "Sintesis transversal del assessment completo." }
];

export const fullAssessmentScopeOrder: AIAnalysisScopeId[] = [
  "inventory",
  "configuration",
  "topology",
  "lifecycle",
  "routing",
  "wan",
  "datacenter",
  "campus",
  "perimeter",
  "security",
  "performance",
  "high_availability",
  "operations",
  "evidence",
  "roadmap",
  "executive_summary"
];

const scopePhases: AIAnalysisPhaseName[] = [
  "context_preparation",
  "evidence_extraction",
  "normalization",
  "scope_analysis",
  "validation",
  "scope_synthesis"
];

export async function createAIAnalysisJob(input: CreateAIAnalysisJobInput) {
  if (input.mode === "scope" && !input.scopeId) {
    throw new Error("scopeId es requerido para un job por ambito.");
  }

  const existing = await prisma.aiAnalysisJob.findFirst({
    where: {
      assessmentId: input.assessmentId,
      mode: input.mode,
      scopeId: input.mode === "scope" ? input.scopeId : null,
      status: { in: ["queued", "running"] }
    },
    include: { steps: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
  if (existing && !input.forceReevaluate) return jobToSnapshot(existing);

  const snapshot = await prisma.assessmentSnapshot.findUnique({ where: { id: input.assessmentId } });
  if (!snapshot) throw new Error("Assessment no encontrado en persistencia. Sincroniza el dashboard antes de ejecutar AI.");

  const scopes = scopesForJob(input.mode, input.scopeId ?? null, snapshot.data);
  const job = await prisma.aiAnalysisJob.create({
    data: {
      assessmentId: input.assessmentId,
      mode: input.mode,
      scopeId: input.mode === "scope" ? input.scopeId : null,
      status: "queued",
      progress: 0,
      requestedBy: input.requestedBy,
      forceReevaluate: Boolean(input.forceReevaluate),
      steps: {
        create: scopes.flatMap((scopeId) =>
          scopePhases.map((phaseName) => ({
            scopeId,
            phaseName,
            status: "pending",
            progress: 0
          }))
        )
      }
    },
    include: { steps: { orderBy: { createdAt: "asc" } } }
  });

  return jobToSnapshot(job);
}

export async function getAIAnalysisJob(jobId: string) {
  const job = await prisma.aiAnalysisJob.findUnique({
    where: { id: jobId },
    include: { steps: { orderBy: { createdAt: "asc" } } }
  });
  return job ? jobToSnapshot(job) : null;
}

export async function cancelAIAnalysisJob(jobId: string) {
  await prisma.aiAnalysisJob.update({
    where: { id: jobId },
    data: {
      cancelRequested: true,
      errorMessage: "Cancelacion solicitada por el usuario.",
      updatedAt: new Date()
    }
  });
  return getAIAnalysisJob(jobId);
}

export async function retryAIAnalysisJob(jobId: string) {
  const job = await prisma.aiAnalysisJob.findUnique({ where: { id: jobId }, include: { steps: true } });
  if (!job) throw new Error("Job no encontrado.");
  await prisma.$transaction([
    prisma.aiAnalysisJob.update({
      where: { id: jobId },
      data: {
        status: "queued",
        progress: 0,
        currentPhase: null,
        cancelRequested: false,
        errorMessage: null,
        startedAt: null,
        completedAt: null
      }
    }),
    prisma.aiAnalysisJobStep.updateMany({
      where: { jobId, status: { in: ["failed", "cancelled"] } },
      data: {
        status: "pending",
        progress: 0,
        startedAt: null,
        completedAt: null,
        errorMessage: null
      }
    })
  ]);
  runAIAnalysisJob(jobId).catch(() => undefined);
  return getAIAnalysisJob(jobId);
}

export async function getAssessmentAIAnalysisStatus(assessmentId: string) {
  const [jobs, results] = await Promise.all([
    prisma.aiAnalysisJob.findMany({
      where: { assessmentId },
      include: { steps: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
      take: 12
    }),
    prisma.aiScopeResult.findMany({ where: { assessmentId }, orderBy: { updatedAt: "desc" } })
  ]);

  return {
    assessmentId,
    jobs: jobs.map(jobToSnapshot),
    scopes: aiAnalysisScopes.map((scope) => {
      const result = results.find((item) => item.scopeId === scope.id);
      const latestStep = jobs.flatMap((job) => job.steps).find((step) => step.scopeId === scope.id);
      return {
        ...scope,
        status: result?.status ?? latestStep?.status ?? "pending",
        inputHash: result?.inputHash ?? latestStep?.inputHash ?? null,
        updatedAt: result?.updatedAt?.toISOString() ?? latestStep?.updatedAt?.toISOString() ?? null,
        stale: false
      };
    })
  };
}

export async function getAssessmentAIAnalysisResults(assessmentId: string) {
  const results = await prisma.aiScopeResult.findMany({ where: { assessmentId }, orderBy: { updatedAt: "desc" } });
  return {
    assessmentId,
    results: results.map((result) => ({
      id: result.id,
      scopeId: result.scopeId,
      status: result.status,
      inputHash: result.inputHash,
      promptVersion: result.promptVersion,
      engineVersion: result.engineVersion,
      result: result.resultJson,
      executiveSummary: result.executiveSummary,
      findings: result.findingsJson,
      recommendations: result.recommendationsJson,
      updatedAt: result.updatedAt.toISOString()
    }))
  };
}

export async function resetAssessmentAIAnalysis(assessmentId: string, scopeId?: AIAnalysisScopeId | null) {
  if (scopeId) {
    await prisma.$transaction([
      prisma.aiScopeResult.deleteMany({ where: { assessmentId, scopeId } }),
      prisma.aiAnalysisJob.deleteMany({ where: { assessmentId, scopeId } })
    ]);
  } else {
    await prisma.$transaction([
      prisma.aiScopeResult.deleteMany({ where: { assessmentId } }),
      prisma.aiAnalysisJob.deleteMany({ where: { assessmentId } })
    ]);
  }

  return getAssessmentAIAnalysisStatus(assessmentId);
}

export async function runAIAnalysisJob(jobId: string) {
  const acquired = await prisma.aiAnalysisJob.updateMany({
    where: { id: jobId, status: "queued" },
    data: { status: "running", startedAt: new Date(), progress: 1, errorMessage: null }
  });
  if (acquired.count === 0) {
    const current = await prisma.aiAnalysisJob.findUnique({ where: { id: jobId } });
    if (!current || current.status !== "running") return;
  }

  const job = await prisma.aiAnalysisJob.findUnique({ where: { id: jobId }, include: { steps: { orderBy: { createdAt: "asc" } } } });
  if (!job) return;
  const snapshot = await prisma.assessmentSnapshot.findUnique({ where: { id: job.assessmentId } });
  if (!snapshot) {
    await failJob(jobId, "Assessment no encontrado en persistencia.");
    return;
  }

  const record = snapshot.data as any;
  const scopes = scopesForJob(job.mode as AIAnalysisMode, job.scopeId as AIAnalysisScopeId | null, record);
  let failedScopes = 0;
  let completedScopes = 0;
  let skippedScopes = 0;

  for (const scopeId of scopes) {
    const cancelled = await cancelIfRequested(jobId);
    if (cancelled) return;

    const inputHash = hashScopeInput(record, scopeId);
    const existingResult = await prisma.aiScopeResult.findUnique({
      where: { assessmentId_scopeId: { assessmentId: job.assessmentId, scopeId } }
    });
    if (!job.forceReevaluate && existingResult?.status === "completed" && existingResult.inputHash === inputHash) {
      await skipScopeSteps(jobId, scopeId, inputHash, "skipped_existing_result");
      skippedScopes += 1;
      await updateJobProgress(jobId);
      continue;
    }

    try {
      const artifacts: Array<{ phase: AIAnalysisPhaseName; artifactId: string; content: any }> = [];
      for (const phase of scopePhases) {
        const step = await prisma.aiAnalysisJobStep.findFirst({ where: { jobId, scopeId, phaseName: phase } });
        if (!step || step.status === "completed") continue;
        if (await cancelIfRequested(jobId)) return;

        await prisma.aiAnalysisJobStep.update({
          where: { id: step.id },
          data: { status: "running", startedAt: new Date(), progress: 20, inputHash, errorMessage: null }
        });
        await prisma.aiAnalysisJob.update({
          where: { id: jobId },
          data: { currentPhase: `${scopeId}:${phase}` }
        });

        const content = await runPhase({ record, scopeId, phase, previousArtifacts: artifacts.map((artifact) => artifact.content) });
        const artifact = await prisma.aiAnalysisArtifact.create({
          data: {
            assessmentId: job.assessmentId,
            jobId,
            scopeId,
            artifactType: phase,
            sourceReference: `${scopeId}:${phase}`,
            contentJson: content as Prisma.InputJsonValue,
            tokenCountEstimate: estimateTokens(content)
          }
        });
        await prisma.aiAnalysisJobStep.update({
          where: { id: step.id },
          data: { status: "completed", progress: 100, completedAt: new Date(), outputArtifactId: artifact.id }
        });
        await prisma.aiAnalysisUsage.create({
          data: {
            jobId,
            scopeId,
            phaseName: phase,
            model: phase === "scope_analysis" ? process.env.OPENAI_MODEL || "backend-orchestration" : "backend-orchestration",
            inputTokens: estimateTokens({ scopeId, phase, record }),
            outputTokens: estimateTokens(content),
            totalTokens: estimateTokens({ scopeId, phase, record }) + estimateTokens(content)
          }
        });
        artifacts.push({ phase, artifactId: artifact.id, content });
        await updateJobProgress(jobId);
      }

      const finalArtifact = artifacts.find((artifact) => artifact.phase === "scope_synthesis")?.content ?? {};
      await prisma.aiScopeResult.upsert({
        where: { assessmentId_scopeId: { assessmentId: job.assessmentId, scopeId } },
        create: {
          assessmentId: job.assessmentId,
          scopeId,
          status: "completed",
          inputHash,
          promptVersion,
          engineVersion,
          resultJson: finalArtifact as Prisma.InputJsonValue,
          executiveSummary: finalArtifact.executiveSummary ?? null,
          findingsJson: (finalArtifact.findings ?? []) as Prisma.InputJsonValue,
          recommendationsJson: (finalArtifact.recommendations ?? []) as Prisma.InputJsonValue
        },
        update: {
          status: "completed",
          inputHash,
          promptVersion,
          engineVersion,
          resultJson: finalArtifact as Prisma.InputJsonValue,
          executiveSummary: finalArtifact.executiveSummary ?? null,
          findingsJson: (finalArtifact.findings ?? []) as Prisma.InputJsonValue,
          recommendationsJson: (finalArtifact.recommendations ?? []) as Prisma.InputJsonValue
        }
      });
      completedScopes += 1;
    } catch (error) {
      failedScopes += 1;
      const message = error instanceof Error ? error.message : "Error desconocido ejecutando ambito.";
      await prisma.aiAnalysisJobStep.updateMany({
        where: { jobId, scopeId, status: { in: ["pending", "running"] } },
        data: { status: "failed", errorMessage: message, completedAt: new Date() }
      });
      if (job.mode === "scope") {
        await failJob(jobId, message);
        return;
      }
    }
  }

  const finalStatus: AIAnalysisJobStatus = failedScopes > 0 ? "partially_completed" : "completed";
  await prisma.aiAnalysisJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      progress: 100,
      currentPhase: null,
      completedAt: new Date(),
      errorMessage: failedScopes > 0 ? `${failedScopes} ambitos fallaron; ${completedScopes} completados; ${skippedScopes} reutilizados.` : null
    }
  });
}

async function runPhase(input: {
  record: any;
  scopeId: AIAnalysisScopeId;
  phase: AIAnalysisPhaseName;
  previousArtifacts: any[];
}) {
  const scope = aiAnalysisScopes.find((item) => item.id === input.scopeId);
  const baseContext = buildScopeContext(input.record, input.scopeId);

  if (input.phase === "context_preparation") {
    return {
      phase: input.phase,
      scopeId: input.scopeId,
      scopeLabel: scope?.label ?? input.scopeId,
      sourceCounts: baseContext.sourceCounts,
      tokenBudget: maxChunkChars,
      promptVersion,
      engineVersion
    };
  }

  if (input.phase === "evidence_extraction") {
    const chunks = chunkScopeEvidence(baseContext.evidenceText, input.scopeId);
    return {
      phase: input.phase,
      chunks,
      extractedFacts: chunks.map((chunk, index) => ({
        id: `${input.scopeId}_fact_${index + 1}`,
        source: chunk.sourceReference,
        summary: chunk.text.slice(0, 700),
        tokenEstimate: estimateTokens(chunk.text)
      }))
    };
  }

  if (input.phase === "normalization") {
    return {
      phase: input.phase,
      normalizedDevices: baseContext.devices.map((device: any) => ({
        hostname: device.hostname,
        model: device.model,
        role: device.role,
        segment: device.topologyLayer ?? device.site ?? "auto"
      })),
      contradictions: detectBasicContradictions(input.record),
      relatedEvidenceCount: baseContext.sourceCounts.evidenceFiles
    };
  }

  if (input.phase === "scope_analysis") {
    return callOpenAIForScopeAnalysis(input.scopeId, baseContext, input.previousArtifacts);
  }

  if (input.phase === "validation") {
    const analysis = input.previousArtifacts.find((artifact) => artifact.phase === "scope_analysis") ?? {};
    const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
    return {
      phase: input.phase,
      validatedFindings: findings.filter((finding: any) => Array.isArray(finding.evidence) && finding.evidence.length > 0),
      rejectedFindings: findings.filter((finding: any) => !Array.isArray(finding.evidence) || finding.evidence.length === 0).map((finding: any) => ({
        title: finding.title ?? "Hallazgo sin titulo",
        reason: "Sin evidencia trazable."
      })),
      rule: "Todo hallazgo debe tener evidencia."
    };
  }

  const validation = input.previousArtifacts.find((artifact) => artifact.phase === "validation") ?? {};
  const findings = validation.validatedFindings ?? [];
  return {
    phase: input.phase,
    scopeId: input.scopeId,
    executiveSummary: findings.length > 0
      ? `${scope?.label ?? input.scopeId}: ${findings.length} hallazgos soportados por evidencia listos para revision del arquitecto.`
      : `${scope?.label ?? input.scopeId}: sin hallazgos AI soportados por evidencia con la informacion disponible.`,
    findings,
    recommendations: findings.flatMap((finding: any) => finding.remediation_steps ?? finding.recommendation ? [finding.recommendation].filter(Boolean) : []),
    dashboard: {
      findingCount: findings.length,
      evidenceFiles: baseContext.sourceCounts.evidenceFiles,
      deviceCount: baseContext.sourceCounts.devices
    }
  };
}

async function callOpenAIForScopeAnalysis(scopeId: AIAnalysisScopeId, context: any, previousArtifacts: any[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      phase: "scope_analysis",
      scopeId,
      provider: "offline",
      findings: [{
        finding_id: `${scopeId}_insufficient_evidence_review`,
        scope: scopeId,
        title: "Revision AI pendiente por falta de OPENAI_API_KEY en backend",
        severity: "informational",
        confidence: "low",
        evidence: [{
          source_type: "document",
          source_name: "backend",
          hostname: null,
          command: null,
          excerpt: "El motor persistente ejecuto el pipeline, pero no llamo OpenAI porque la llave no esta configurada en backend."
        }],
        technical_rationale: "La orquestacion esta disponible; la fase de analisis AI requiere OPENAI_API_KEY del lado servidor.",
        business_impact: "No se generan conclusiones AI finales hasta configurar credenciales backend.",
        recommendation: "Configurar OPENAI_API_KEY en .env.local y reintentar o forzar reevaluacion del ambito.",
        remediation_steps: ["Configurar OPENAI_API_KEY", "Reintentar el job", "Validar los hallazgos generados"],
        related_devices: [],
        related_sites: [],
        dependencies: []
      }]
    };
  }

  const relevantChunks = chunkScopeEvidence(context.evidenceText, scopeId).slice(0, 4);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [{
            type: "input_text",
            text: [
              "Eres un arquitecto senior Cisco ejecutando una fase incremental de assessment.",
              "No inventes equipos, rutas, conexiones ni vulnerabilidades.",
              "Todo hallazgo debe tener evidencia explicita.",
              "Si la evidencia es insuficiente, marca insufficient_evidence en vez de inferir.",
              `Prompt version: ${promptVersion}. Engine version: ${engineVersion}.`
            ].join("\n")
          }]
        },
        {
          role: "user",
          content: [{
            type: "input_text",
            text: JSON.stringify({
              task: `Analiza el ambito ${scopeId} usando solo estos chunks y artifacts previos.`,
              context: {
                client: context.client,
                assessment: context.assessment,
                sourceCounts: context.sourceCounts,
                chunks: relevantChunks
              },
              previousArtifacts
            })
          }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "scope_analysis_result",
          strict: true,
          schema: scopeAnalysisResultSchema()
        }
      }
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "Error llamando OpenAI Responses API.");
  }
  return JSON.parse(extractResponseText(payload) || "{\"findings\":[],\"recommendations\":[]}");
}

function scopeAnalysisResultSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["phase", "scopeId", "findings", "recommendations", "limitations"],
    properties: {
      phase: { type: "string" },
      scopeId: { type: "string" },
      findings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["finding_id", "scope", "title", "severity", "confidence", "evidence", "technical_rationale", "business_impact", "recommendation", "remediation_steps", "related_devices", "related_sites", "dependencies"],
          properties: {
            finding_id: { type: "string" },
            scope: { type: "string" },
            title: { type: "string" },
            severity: { type: "string", enum: ["critical", "high", "medium", "low", "informational"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            evidence: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["source_type", "source_name", "hostname", "command", "excerpt"],
                properties: {
                  source_type: { type: "string", enum: ["inventory", "cli", "performance", "interview", "document"] },
                  source_name: { type: "string" },
                  hostname: { type: ["string", "null"] },
                  command: { type: ["string", "null"] },
                  excerpt: { type: "string" }
                }
              }
            },
            technical_rationale: { type: "string" },
            business_impact: { type: "string" },
            recommendation: { type: "string" },
            remediation_steps: { type: "array", items: { type: "string" } },
            related_devices: { type: "array", items: { type: "string" } },
            related_sites: { type: "array", items: { type: "string" } },
            dependencies: { type: "array", items: { type: "string" } }
          }
        }
      },
      recommendations: { type: "array", items: { type: "string" } },
      limitations: { type: "array", items: { type: "string" } }
    }
  };
}

function buildScopeContext(record: any, scopeId: AIAnalysisScopeId) {
  const devices = Array.isArray(record?.targetInventory) ? record.targetInventory.filter((device: any) => device.included !== false) : [];
  const evidenceFiles = Array.isArray(record?.evidenceFiles) ? record.evidenceFiles : [];
  const parsed = record?.parsed ?? {};
  const performance = record?.performance ?? {};
  const relevantEvidence = evidenceFiles.filter((file: any) => evidenceFileMatchesScope(file, scopeId));
  const evidenceText = stableStringify({
    client: record?.client,
    assessment: record?.assessment,
    scope: record?.scope,
    inventory: devices,
    parsed: compactParsedForScope(parsed, scopeId),
    performance: scopeId === "performance" ? performance : undefined,
    operationalAssessment: scopeId === "operations" ? record?.operationalAssessment : undefined,
    lifecycleEoxRecords: scopeId === "lifecycle" ? record?.lifecycleEoxRecords : undefined,
    evidenceFiles: relevantEvidence.map((file: any) => ({
      name: file.name,
      type: file.type,
      deviceName: file.deviceName,
      command: file.command,
      content: truncateText(file.content ?? "", 18000)
    }))
  });

  return {
    client: record?.client,
    assessment: record?.assessment,
    scopeId,
    devices,
    evidenceFiles: relevantEvidence,
    evidenceText,
    sourceCounts: {
      devices: devices.length,
      evidenceFiles: relevantEvidence.length,
      parsedDevices: Array.isArray(parsed.devices) ? parsed.devices.length : 0,
      relations: Array.isArray(parsed.relations) ? parsed.relations.length : 0,
      findings: Array.isArray(parsed.findings) ? parsed.findings.length : 0,
      performanceMetrics: Array.isArray(performance.metrics) ? performance.metrics.length : 0
    }
  };
}

function compactParsedForScope(parsed: any, scopeId: AIAnalysisScopeId) {
  if (scopeId === "topology") return { devices: parsed.devices, relations: parsed.relations };
  if (scopeId === "inventory" || scopeId === "lifecycle") return { devices: parsed.devices, findings: parsed.findings };
  if (scopeId === "routing" || scopeId === "wan") return { devices: parsed.devices, relations: parsed.relations, findings: parsed.findings };
  return {
    devices: parsed.devices,
    interfaces: parsed.interfaces,
    relations: parsed.relations,
    findings: parsed.findings
  };
}

function evidenceFileMatchesScope(file: any, scopeId: AIAnalysisScopeId) {
  const haystack = `${file?.name ?? ""}\n${file?.content ?? ""}`.toLowerCase();
  const keywords: Record<AIAnalysisScopeId, RegExp> = {
    inventory: /show version|show inventory|serial|model|hostname/,
    configuration: /show running-config|show startup-config|interface|router|line vty|snmp|aaa|logging/,
    lifecycle: /show version|show inventory|serial|pid|eox|lifecycle/,
    topology: /cdp neighbors|lldp neighbors|interface status|port-channel|vpc|spanning-tree/,
    routing: /show ip route|show ip protocols|ospf|bgp|vrf/,
    performance: /begin_performance|cpu|memory|drop|error|utilization|interface|queue|latency/,
    security: /access-list|aaa|ssh|snmp|crypto|nat|vpn|logging|asp drop/,
    high_availability: /redundancy|failover|vpc|hsrp|vrrp|port-channel|etherchannel/,
    datacenter: /nexus|vpc|nve|evpn|module|environment|feature|vrf/,
    campus: /vlan|spanning-tree|switchport|etherchannel|interface status/,
    wan: /bgp|ospf|route|wan|mpls|internet|interface/,
    perimeter: /failover|access-list|nat|vpn-sessiondb|crypto|conn count|asp drop/,
    operations: /logging|ntp|clock|license|environment|show tech|monitor/,
    evidence: /.*/,
    roadmap: /.*/,
    executive_summary: /.*/
  };
  return keywords[scopeId].test(haystack);
}

function chunkScopeEvidence(text: string, scopeId: AIAnalysisScopeId) {
  const delimiterPattern = /(#####\s+BEGIN_(?:DEVICE|PERFORMANCE)[\s\S]*?#####|#####\s+END_(?:DEVICE|PERFORMANCE)[\s\S]*?#####)/g;
  const logicalBlocks = text
    .split(delimiterPattern)
    .flatMap((part) => part.split(/\n(?=(?:show\s|interface\s|router\s|hostname\s|! Perfil|{))/i))
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: Array<{ id: string; scopeId: AIAnalysisScopeId; sourceReference: string; charCount: number; tokenEstimate: number; text: string }> = [];
  let current = "";
  for (const block of logicalBlocks) {
    if (current.length + block.length > maxChunkChars && current.trim()) {
      chunks.push(chunkFromText(scopeId, chunks.length + 1, current));
      current = "";
    }
    if (block.length > maxChunkChars) {
      for (let index = 0; index < block.length; index += maxChunkChars) {
        chunks.push(chunkFromText(scopeId, chunks.length + 1, block.slice(index, index + maxChunkChars)));
      }
    } else {
      current = `${current}\n${block}`;
    }
  }
  if (current.trim()) chunks.push(chunkFromText(scopeId, chunks.length + 1, current));
  return chunks.slice(0, 24);
}

function chunkFromText(scopeId: AIAnalysisScopeId, index: number, text: string) {
  return {
    id: `${scopeId}_chunk_${index}`,
    scopeId,
    sourceReference: `${scopeId}:chunk:${index}`,
    charCount: text.length,
    tokenEstimate: estimateTokens(text),
    text
  };
}

function hashScopeInput(record: any, scopeId: AIAnalysisScopeId) {
  const context = buildScopeContext(record, scopeId);
  return createHash("sha256")
    .update(stableStringify({
      scopeId,
      promptVersion,
      engineVersion,
      client: context.client,
      assessment: context.assessment,
      sourceCounts: context.sourceCounts,
      evidenceText: context.evidenceText
    }))
    .digest("hex");
}

function scopesForJob(mode: AIAnalysisMode, scopeId: AIAnalysisScopeId | null, record: any) {
  if (mode === "scope") return [scopeId ?? "evidence"];
  const performanceEnabled = Boolean(record?.scope?.performanceAnalysis?.enabled);
  return fullAssessmentScopeOrder.filter((id) => id !== "performance" || performanceEnabled);
}

async function updateJobProgress(jobId: string) {
  const steps = await prisma.aiAnalysisJobStep.findMany({ where: { jobId } });
  const completed = steps.filter((step) => step.status === "completed" || step.status === "skipped").length;
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  await prisma.aiAnalysisJob.update({ where: { id: jobId }, data: { progress } });
}

async function skipScopeSteps(jobId: string, scopeId: AIAnalysisScopeId, inputHash: string, reason: string) {
  await prisma.aiAnalysisJobStep.updateMany({
    where: { jobId, scopeId },
    data: {
      status: "skipped",
      progress: 100,
      inputHash,
      errorMessage: reason,
      completedAt: new Date()
    }
  });
}

async function cancelIfRequested(jobId: string) {
  const job = await prisma.aiAnalysisJob.findUnique({ where: { id: jobId } });
  if (!job?.cancelRequested) return false;
  await prisma.$transaction([
    prisma.aiAnalysisJobStep.updateMany({
      where: { jobId, status: { in: ["pending", "running"] } },
      data: { status: "cancelled", completedAt: new Date(), errorMessage: "Cancelado por el usuario." }
    }),
    prisma.aiAnalysisJob.update({
      where: { id: jobId },
      data: { status: "cancelled", completedAt: new Date(), currentPhase: null, errorMessage: "Cancelado por el usuario." }
    })
  ]);
  return true;
}

async function failJob(jobId: string, message: string) {
  await prisma.aiAnalysisJob.update({
    where: { id: jobId },
    data: { status: "failed", completedAt: new Date(), errorMessage: message, currentPhase: null }
  });
}

function jobToSnapshot(job: any): AIAnalysisJobSnapshot {
  return {
    id: job.id,
    assessmentId: job.assessmentId,
    mode: job.mode,
    scopeId: job.scopeId,
    status: job.status,
    progress: job.progress,
    currentPhase: job.currentPhase,
    requestedBy: job.requestedBy,
    forceReevaluate: job.forceReevaluate,
    cancelRequested: job.cancelRequested,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    updatedAt: job.updatedAt.toISOString(),
    steps: (job.steps ?? []).map((step: any) => ({
      id: step.id,
      scopeId: step.scopeId,
      phaseName: step.phaseName,
      status: step.status,
      progress: step.progress,
      startedAt: step.startedAt?.toISOString() ?? null,
      completedAt: step.completedAt?.toISOString() ?? null,
      errorMessage: step.errorMessage,
      inputHash: step.inputHash,
      outputArtifactId: step.outputArtifactId
    }))
  };
}

function detectBasicContradictions(record: any) {
  const inventorySerials = new Set((record?.targetInventory ?? []).map((device: any) => String(device.serial ?? "").trim()).filter(Boolean));
  const parsedSerials = new Set((record?.parsed?.devices ?? []).map((device: any) => String(device.serial ?? "").trim()).filter(Boolean));
  const missingInParsed = Array.from(inventorySerials).filter((serial) => !parsedSerials.has(serial)).slice(0, 20);
  return missingInParsed.map((serial) => ({
    type: "inventory_without_parsed_evidence",
    serial,
    description: "El serial existe en inventario objetivo pero no aparece en evidencia parseada."
  }));
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

function estimateTokens(value: unknown) {
  return Math.ceil(stableStringify(value).length / 4);
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n[truncated:${value.length - maxLength}]` : value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: any): any {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce<Record<string, any>>((acc, key) => {
      acc[key] = sortValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}
