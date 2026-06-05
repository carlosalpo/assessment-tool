import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import {
  createAiInteractionLogSafely,
  extractOpenAIUsage,
  getAiDebugSetting
} from "./ai-debug.ts";
import {
  buildAIScopePacket,
  buildAssessmentKnowledgeGraph,
  buildScopeBrief,
  createAIAnalysisAudit,
  fullEvidenceCatalogForPacket,
  getPromptVersion,
  isEvidenceTieringEnabled,
  isDomainPartitionEnabled,
  isScopeBriefEnabled,
  planScopePartitions,
  type ScopePartition,
  validateScopeAnalysisResult
} from "./ai-scope-strategy.ts";
import {
  patternForScope,
  reduceResultSchema,
  scopeAnalysisResultSchemaForPattern,
  synthesisResultSchema,
  usesPatternQuery
} from "./ai-scope-schemas.ts";
import { mapLegacyRemediation } from "./types.ts";

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

type RunAIAnalysisJobOptions = {
  apiKey?: string;
};

export type ReduceDigestFinding = {
  scope: string;
  finding_id: string;
  title: string;
  severity: string;
  finding_type: string;
  related_devices: string[];
};

export type ReduceDigest = {
  digestVersion: string;
  findings: ReduceDigestFinding[];
  catalog: Record<string, string[]>;
};

export type SynthesisTarget = "roadmap" | "executive_summary";

export type SynthesisDigest = {
  digestVersion: string;
  findings: ReduceDigestFinding[];
  catalog: Record<string, string[]>;
};

const engineVersion = "ai-analysis-engine-v5";
const remediationCategoryEnum = ["professional_services", "new_technology", "platform_upgrade", "operational_change", "pending_validation"];
const maxChunkChars = 14000;
const defaultOpenAIAnalysisModel = "gpt-5.2";
const crossScopeCorrelationScopeId = "cross_scope_correlation";
const reduceFindingsPerScopeLimit = 8;
const synthesisFindingsPerScopeLimit = 12;

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
  "topology",
  "configuration",
  "security",
  "lifecycle",
  "operations",
  "evidence",
  "inventory",
  "routing",
  "wan",
  "datacenter",
  "campus",
  "perimeter",
  "performance",
  "high_availability",
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
  await prisma.aiAnalysisJob.updateMany({
    where: { id: jobId, status: { in: ["queued", "running"] } },
    data: {
      cancelRequested: true,
      errorMessage: "Cancelacion solicitada por el usuario.",
      updatedAt: new Date()
    }
  });
  return getAIAnalysisJob(jobId);
}

export async function retryAIAnalysisJob(jobId: string, options?: RunAIAnalysisJobOptions) {
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
  runAIAnalysisJob(jobId, options).catch(() => undefined);
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

export async function runAIAnalysisJob(jobId: string, options?: RunAIAnalysisJobOptions) {
  const apiKey = options?.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
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
  const debugCapture = process.env.AI_DEBUG_DISABLE === "1" ? false : (await getAiDebugSetting(job.assessmentId).catch(() => ({ captureEnabled: false }))).captureEnabled;
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
    if (
      !job.forceReevaluate &&
      existingResult?.status === "completed" &&
      existingResult.inputHash === inputHash &&
      !isOpenAICredentialPlaceholderResult(existingResult.findingsJson)
    ) {
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

        const content = await runPhase({ jobId, assessmentId: job.assessmentId, record, scopeId, phase, previousArtifacts: artifacts.map((artifact) => artifact.content), apiKey, debugCapture });
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
            model: phase === "scope_analysis" ? openAIAnalysisModel() : "backend-orchestration",
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
          promptVersion: getPromptVersion(),
          engineVersion,
          resultJson: finalArtifact as Prisma.InputJsonValue,
          executiveSummary: finalArtifact.executiveSummary ?? null,
          findingsJson: (finalArtifact.findings ?? []) as Prisma.InputJsonValue,
          recommendationsJson: (finalArtifact.recommendations ?? []) as Prisma.InputJsonValue
        },
        update: {
          status: "completed",
          inputHash,
          promptVersion: getPromptVersion(),
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

  if (isReduceStageEnabled() && job.mode === "full") {
    try {
      await runReduceStage({
        jobId,
        assessmentId: job.assessmentId,
        apiKey,
        forceReevaluate: job.forceReevaluate,
        debugCapture
      });
    } catch (error) {
      console.warn("Reduce AI stage failed without failing the job.", error);
    }
  }

  if (isSynthesisStageEnabled() && job.mode === "full") {
    try {
      await runSynthesisStage({
        jobId,
        assessmentId: job.assessmentId,
        apiKey,
        forceReevaluate: job.forceReevaluate,
        debugCapture
      });
    } catch (error) {
      console.warn("Synthesis AI stage failed without failing the job.", error);
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
  jobId: string;
  assessmentId: string;
  record: any;
  scopeId: AIAnalysisScopeId;
  phase: AIAnalysisPhaseName;
  previousArtifacts: any[];
  apiKey: string;
  debugCapture: boolean;
}) {
  const scope = aiAnalysisScopes.find((item) => item.id === input.scopeId);
  const baseContext = buildScopeContext(input.record, input.scopeId);
  const priorScopeResults = await loadPriorScopeResults(input.record?.id, input.scopeId);
  const explicitMaxInputTokens = process.env.OPENAI_MAX_INPUT_TOKENS?.trim()
    ? Number(process.env.OPENAI_MAX_INPUT_TOKENS)
    : undefined;
  const scopePacket = buildAIScopePacket({
    record: input.record,
    scopeId: input.scopeId,
    priorScopeResults,
    maxInputTokens: explicitMaxInputTokens
  });
  const model = openAIAnalysisModel();

  if (input.phase === "context_preparation") {
    const graph = buildAssessmentKnowledgeGraph(input.record);
    return {
      phase: input.phase,
      scopeId: input.scopeId,
      scopeLabel: scope?.label ?? input.scopeId,
      sourceCounts: baseContext.sourceCounts,
      strategy: scopePacket.strategy,
      knowledgeGraph: {
        assessmentId: graph.assessmentId,
        sourceCounts: graph.sourceCounts,
        nodeCounts: {
          devices: graph.nodes.devices.length,
          interfaces: graph.nodes.interfaces.length,
          relationships: graph.nodes.relationships.length,
          configFacts: graph.nodes.configFacts.length,
          stateFacts: graph.nodes.stateFacts.length,
          performanceMetrics: graph.nodes.performanceMetrics.length,
          evidenceRefs: graph.nodes.evidenceRefs.length,
          deterministicFindings: graph.nodes.deterministicFindings.length,
          correlations: graph.nodes.correlations.length,
          edges: graph.edges.length
        }
      },
      deterministicCandidateCount: baseContext.deterministicFindings.length,
      tokenBudget: scopePacket.budget.maxInputTokens,
      packetBudget: scopePacket.budget,
      promptVersion: getPromptVersion(),
      engineVersion
    };
  }

  if (input.phase === "evidence_extraction") {
    return {
      phase: input.phase,
      packetVersion: scopePacket.packetVersion,
      evidenceRefs: scopePacket.evidencePack.map((ref) => ref.id),
      evidencePack: scopePacket.evidencePack,
      extractedFacts: scopePacket.evidencePack.map((ref, index) => ({
        id: `${input.scopeId}_fact_${index + 1}`,
        source: ref.id,
        sourceFile: ref.sourceFile,
        command: ref.command,
        hostname: ref.deviceId,
        summary: ref.excerpt.slice(0, 700),
        tokenEstimate: estimateTokens(ref.excerpt)
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
      deterministicFindings: baseContext.deterministicFindings,
      relatedEvidenceCount: baseContext.sourceCounts.evidenceFiles,
      aiScopePacketSummary: {
        scopeId: scopePacket.scopeId,
        strategy: scopePacket.strategy.label,
        devices: scopePacket.graphSlice.devices.length,
        relationships: scopePacket.graphSlice.relationships.length,
        configFacts: scopePacket.graphSlice.configFacts.length,
        stateFacts: scopePacket.graphSlice.stateFacts.length,
        performanceMetrics: scopePacket.graphSlice.performanceMetrics.length,
        correlations: scopePacket.memory.openCorrelationCandidates.length,
        evidenceRefs: scopePacket.evidencePack.length,
        priorScopeSummaries: scopePacket.memory.priorScopeSummaries.length,
        budget: scopePacket.budget
      }
    };
  }

  if (input.phase === "scope_analysis") {
    if (isSynthesisStageEnabled() && patternForScope(input.scopeId) === "synthesis") {
      return synthesisScopePlaceholder(input.scopeId);
    }

    const partitions = planScopePartitions(input.record, input.scopeId, scopePacket);
    if (partitions.length <= 1) {
      return callOpenAIForScopeAnalysis(input.scopeId, scopePacket, input.previousArtifacts, input.apiKey, model, {
        jobId: input.jobId,
        assessmentId: input.assessmentId,
        debugCapture: input.debugCapture
      });
    }

    const partitionResults = [];
    for (const partition of [...partitions].sort((left, right) => left.id.localeCompare(right.id))) {
      const partitionPacket = buildAIScopePacket({
        record: input.record,
        scopeId: input.scopeId,
        priorScopeResults,
        maxInputTokens: explicitMaxInputTokens,
        partitionDevices: partition.deviceHostnames
      });
      const partitionResult = await callOpenAIForScopeAnalysis(input.scopeId, partitionPacket, input.previousArtifacts, input.apiKey, model, {
        jobId: input.jobId,
        assessmentId: input.assessmentId,
        debugCapture: input.debugCapture
      });
      partitionResults.push({
        ...partitionResult,
        partitionId: partition.id,
        partitionDevices: partition.deviceHostnames
      });
    }

    return mergeScopePartitionResults(input.scopeId, partitionResults, partitions);
  }

  if (input.phase === "validation") {
    const analysis = input.previousArtifacts.find((artifact) => artifact.phase === "scope_analysis") ?? {};
    const findings = Array.isArray(analysis.findings) ? analysis.findings : [];
    const evidenceValidation = filterFindingsForValidationPhase(findings);
    return {
      phase: input.phase,
      validatedFindings: evidenceValidation.validatedFindings,
      rejectedFindings: [
        ...(Array.isArray(analysis.rejectedFindings) ? analysis.rejectedFindings : []),
        ...evidenceValidation.rejectedFindings
      ],
      rule: "Todo hallazgo debe tener evidencia trazable y referencias permitidas por la estrategia del ambito."
    };
  }

  const validation = input.previousArtifacts.find((artifact) => artifact.phase === "validation") ?? {};
  const findings = validation.validatedFindings ?? [];
  const scopeLabel = scope?.label ?? input.scopeId;
  return {
    phase: input.phase,
    scopeId: input.scopeId,
    ...(isScopeBriefEnabled() ? { scopeBrief: buildScopeBrief(findings, input.scopeId, scopeLabel) } : {}),
    executiveSummary: findings.length > 0
      ? `${scopeLabel}: ${findings.length} hallazgos soportados por evidencia listos para revision del arquitecto.`
      : `${scopeLabel}: sin hallazgos AI soportados por evidencia con la informacion disponible.`,
    findings,
    recommendations: findings.flatMap((finding: any) => finding.remediation_steps ?? finding.recommendation ? [finding.recommendation].filter(Boolean) : []),
    dashboard: {
      findingCount: findings.length,
      evidenceFiles: baseContext.sourceCounts.evidenceFiles,
      deviceCount: baseContext.sourceCounts.devices
    }
  };
}

async function runReduceStage(input: {
  jobId: string;
  assessmentId: string;
  apiKey: string;
  forceReevaluate: boolean;
  debugCapture: boolean;
}) {
  const scopeResults = await prisma.aiScopeResult.findMany({
    where: {
      assessmentId: input.assessmentId,
      status: "completed"
    },
    orderBy: { scopeId: "asc" }
  });
  const digest = buildReduceDigest(scopeResults);
  const sourceScopes = new Set(digest.findings.map((finding) => finding.scope));
  if (sourceScopes.size < 2) return;

  const inputHash = hashReduceDigest(digest);
  const existingResult = await prisma.aiScopeResult.findUnique({
    where: { assessmentId_scopeId: { assessmentId: input.assessmentId, scopeId: crossScopeCorrelationScopeId } }
  });
  if (
    !input.forceReevaluate &&
    existingResult?.status === "completed" &&
    existingResult.inputHash === inputHash
  ) {
    return;
  }
  if (!input.apiKey) throw new Error("OpenAI API key no esta configurada para la etapa Reduce.");

  await prisma.aiAnalysisJob.update({
    where: { id: input.jobId },
    data: { currentPhase: `${crossScopeCorrelationScopeId}:reduce` }
  });

  const model = openAIReduceModel();
  const requestBody = {
    model,
    input: [
      {
        role: "system",
        content: [{
          type: "input_text",
          text: buildReduceSystemPrompt()
        }]
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify({
            task: "Correlaciona hallazgos validados de scopes distintos y produce solo hallazgos compuestos cross-dominio.",
            requiredBehavior: [
              "Cada hallazgo compuesto debe citar source_finding_ids existentes en el digest.",
              "Cada hallazgo compuesto debe combinar al menos 2 scopes distintos.",
              "No inventes equipos ni finding_id; si no hay correlacion transversal suficiente, devuelve findings vacio."
            ],
            reduceDigest: digest
          })
        }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "reduce_result",
        strict: true,
        schema: reduceResultSchema()
      }
    }
  };
  const startedAt = Date.now();
  let capturedFailure = false;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    const payload = await response.json().catch(() => null);
    const latencyMs = Date.now() - startedAt;
    const usage = extractOpenAIUsage(payload);
    if (!response.ok) {
      await captureReduceInteraction(input, {
        model,
        inputHash,
        requestBody,
        payload,
        httpStatus: response.status,
        status: "error",
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens
      });
      capturedFailure = true;
      throw new Error(payload?.error?.message ?? "Error llamando OpenAI Responses API en Reduce.");
    }

    const parsed = JSON.parse(extractResponseText(payload) || "{\"phase\":\"reduce\",\"findings\":[],\"recommendations\":[],\"limitations\":[]}");
    const validation = validateReduceResult(parsed, digest);
    await captureReduceInteraction(input, {
      model,
      inputHash,
      requestBody,
      payload,
      httpStatus: response.status,
      status: "ok",
      latencyMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      rejectedFindings: validation.rejected
    });

    const resultJson = {
      ...parsed,
      phase: "reduce",
      scopeId: crossScopeCorrelationScopeId,
      findings: validation.validFindings,
      rejectedFindings: validation.rejected,
      digestSummary: {
        sourceScopes: Array.from(sourceScopes).sort(),
        sourceFindingCount: digest.findings.length
      }
    };
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    await prisma.aiAnalysisArtifact.create({
      data: {
        assessmentId: input.assessmentId,
        jobId: input.jobId,
        scopeId: crossScopeCorrelationScopeId,
        artifactType: "reduce",
        sourceReference: `${crossScopeCorrelationScopeId}:reduce`,
        contentJson: resultJson as Prisma.InputJsonValue,
        tokenCountEstimate: estimateTokens(resultJson)
      }
    });
    await prisma.aiAnalysisUsage.create({
      data: {
        jobId: input.jobId,
        scopeId: crossScopeCorrelationScopeId,
        phaseName: "reduce",
        model,
        inputTokens: usage.inputTokens ?? estimateTokens(digest),
        outputTokens: usage.outputTokens ?? estimateTokens(resultJson),
        totalTokens: (usage.inputTokens ?? estimateTokens(digest)) + (usage.outputTokens ?? estimateTokens(resultJson))
      }
    });
    await prisma.aiScopeResult.upsert({
      where: { assessmentId_scopeId: { assessmentId: input.assessmentId, scopeId: crossScopeCorrelationScopeId } },
      create: {
        assessmentId: input.assessmentId,
        scopeId: crossScopeCorrelationScopeId,
        status: "completed",
        inputHash,
        promptVersion: getPromptVersion(),
        engineVersion,
        resultJson: resultJson as Prisma.InputJsonValue,
        executiveSummary: validation.validFindings.length > 0
          ? `Reduce transversal: ${validation.validFindings.length} hallazgos compuestos cross-dominio.`
          : "Reduce transversal: sin hallazgos compuestos soportados por multiples scopes.",
        findingsJson: validation.validFindings as Prisma.InputJsonValue,
        recommendationsJson: recommendations as Prisma.InputJsonValue
      },
      update: {
        status: "completed",
        inputHash,
        promptVersion: getPromptVersion(),
        engineVersion,
        resultJson: resultJson as Prisma.InputJsonValue,
        executiveSummary: validation.validFindings.length > 0
          ? `Reduce transversal: ${validation.validFindings.length} hallazgos compuestos cross-dominio.`
          : "Reduce transversal: sin hallazgos compuestos soportados por multiples scopes.",
        findingsJson: validation.validFindings as Prisma.InputJsonValue,
        recommendationsJson: recommendations as Prisma.InputJsonValue
      }
    });
  } catch (error) {
    if (!capturedFailure) {
      await captureReduceInteraction(input, {
        model,
        inputHash,
        requestBody,
        payload: { error: error instanceof Error ? error.message : "OpenAI no respondio durante Reduce." },
        httpStatus: null,
        status: "error",
        latencyMs: Date.now() - startedAt
      });
    }
    throw error;
  }
}

async function runSynthesisStage(input: {
  jobId: string;
  assessmentId: string;
  apiKey: string;
  forceReevaluate: boolean;
  debugCapture: boolean;
}) {
  let generatedRoadmap: any = null;
  generatedRoadmap = await runSynthesisTarget("roadmap", input, generatedRoadmap);
  await runSynthesisTarget("executive_summary", input, generatedRoadmap);
}

async function runSynthesisTarget(
  target: SynthesisTarget,
  input: {
    jobId: string;
    assessmentId: string;
    apiKey: string;
    forceReevaluate: boolean;
    debugCapture: boolean;
  },
  generatedRoadmap: any
) {
  const scopeResults = await prisma.aiScopeResult.findMany({
    where: {
      assessmentId: input.assessmentId,
      status: "completed"
    },
    orderBy: { scopeId: "asc" }
  });
  const digest = buildSynthesisDigest(scopeResults);
  if (digest.findings.length === 0) return null;

  const inputHash = hashSynthesisDigest(digest, target);
  const existingResult = await prisma.aiScopeResult.findUnique({
    where: { assessmentId_scopeId: { assessmentId: input.assessmentId, scopeId: target } }
  });
  if (
    !input.forceReevaluate &&
    existingResult?.status === "completed" &&
    existingResult.inputHash === inputHash
  ) {
    return existingResult.resultJson;
  }
  if (!input.apiKey) throw new Error("OpenAI API key no esta configurada para la etapa Synthesize.");

  await prisma.aiAnalysisJob.update({
    where: { id: input.jobId },
    data: { currentPhase: `${target}:synthesis` }
  });

  const model = openAISynthesisModel();
  const requestBody = {
    model,
    input: [
      {
        role: "system",
        content: [{
          type: "input_text",
          text: buildSynthesisSystemPrompt(target)
        }]
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify({
            task: target === "roadmap"
              ? "Genera un roadmap priorizado usando solo hallazgos del synthesisDigest."
              : "Genera un resumen ejecutivo usando solo hallazgos del synthesisDigest y el roadmap generado si existe.",
            requiredBehavior: [
              "Cada item o riesgo debe citar source_finding_ids existentes en el digest.",
              "Prioriza hallazgos compuestos cross-scope cuando existan.",
              "No inventes equipos, scopes ni finding_id."
            ],
            synthesisDigest: digest,
            generatedRoadmap: target === "executive_summary" ? compactGeneratedRoadmap(generatedRoadmap) : null
          })
        }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: `synthesis_${target}`,
        strict: true,
        schema: synthesisResultSchema(target)
      }
    }
  };
  const startedAt = Date.now();
  let capturedFailure = false;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    const payload = await response.json().catch(() => null);
    const latencyMs = Date.now() - startedAt;
    const usage = extractOpenAIUsage(payload);
    if (!response.ok) {
      await captureSynthesisInteraction(input, {
        target,
        model,
        inputHash,
        requestBody,
        payload,
        httpStatus: response.status,
        status: "error",
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens
      });
      capturedFailure = true;
      throw new Error(payload?.error?.message ?? "Error llamando OpenAI Responses API en Synthesize.");
    }

    const parsed = JSON.parse(extractResponseText(payload) || synthesisEmptyResponse(target));
    const validation = validateSynthesisResult(parsed, digest, target);
    const parsedEntryCount = target === "roadmap"
      ? (Array.isArray(parsed.items) ? parsed.items.length : 0)
      : (Array.isArray(parsed.top_risks) ? parsed.top_risks.length : 0);
    await captureSynthesisInteraction(input, {
      target,
      model,
      inputHash,
      requestBody,
      payload,
      httpStatus: response.status,
      status: "ok",
      latencyMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      rejectedItems: validation.rejected
    });
    if (parsedEntryCount > 0 && validation.valid.length === 0 && validation.rejected.length > 0) {
      capturedFailure = true;
      throw new Error(`Synthesize ${target} produjo solo elementos invalidos; se conserva el fallback existente.`);
    }

    const resultJson = buildSynthesisResultJson(parsed, validation.valid, validation.rejected, digest, target);
    const recommendations = target === "roadmap"
      ? validation.valid.map((item: any) => item.recommendation).filter(Boolean)
      : [];
    const executiveSummary = target === "executive_summary"
      ? String(parsed.summary ?? "")
      : validation.valid.length > 0
        ? `Roadmap AI: ${validation.valid.length} iniciativas priorizadas.`
        : "Roadmap AI: sin iniciativas nuevas soportadas por hallazgos validados.";

    await prisma.aiAnalysisArtifact.create({
      data: {
        assessmentId: input.assessmentId,
        jobId: input.jobId,
        scopeId: target,
        artifactType: "synthesis",
        sourceReference: `${target}:synthesis`,
        contentJson: resultJson as Prisma.InputJsonValue,
        tokenCountEstimate: estimateTokens(resultJson)
      }
    });
    await prisma.aiAnalysisUsage.create({
      data: {
        jobId: input.jobId,
        scopeId: target,
        phaseName: "synthesis",
        model,
        inputTokens: usage.inputTokens ?? estimateTokens(digest),
        outputTokens: usage.outputTokens ?? estimateTokens(resultJson),
        totalTokens: (usage.inputTokens ?? estimateTokens(digest)) + (usage.outputTokens ?? estimateTokens(resultJson))
      }
    });
    await prisma.aiScopeResult.upsert({
      where: { assessmentId_scopeId: { assessmentId: input.assessmentId, scopeId: target } },
      create: {
        assessmentId: input.assessmentId,
        scopeId: target,
        status: "completed",
        inputHash,
        promptVersion: getPromptVersion(),
        engineVersion,
        resultJson: resultJson as Prisma.InputJsonValue,
        executiveSummary,
        findingsJson: validation.valid as Prisma.InputJsonValue,
        recommendationsJson: recommendations as Prisma.InputJsonValue
      },
      update: {
        status: "completed",
        inputHash,
        promptVersion: getPromptVersion(),
        engineVersion,
        resultJson: resultJson as Prisma.InputJsonValue,
        executiveSummary,
        findingsJson: validation.valid as Prisma.InputJsonValue,
        recommendationsJson: recommendations as Prisma.InputJsonValue
      }
    });
    return resultJson;
  } catch (error) {
    if (!capturedFailure) {
      await captureSynthesisInteraction(input, {
        target,
        model,
        inputHash,
        requestBody,
        payload: { error: error instanceof Error ? error.message : "OpenAI no respondio durante Synthesize." },
        httpStatus: null,
        status: "error",
        latencyMs: Date.now() - startedAt
      });
    }
    throw error;
  }
}

async function callOpenAIForScopeAnalysis(
  scopeId: AIAnalysisScopeId,
  scopePacket: ReturnType<typeof buildAIScopePacket>,
  previousArtifacts: any[],
  apiKey: string,
  model: string,
  debug?: { jobId: string; assessmentId: string; debugCapture: boolean }
) {
  if (!apiKey) {
    throw new Error("OpenAI API key no esta configurada para el motor persistente.");
  }

  const deterministicFindings = scopePacket.memory.acceptedOrDeterministicFindings ?? [];
  const deterministicScopeFindings = deterministicFindingsToScopeAnalysisFindings(deterministicFindings, scopePacket);
  const promptVersion = getPromptVersion();
  const audit = createAIAnalysisAudit({ packet: scopePacket, model, promptVersion, engineVersion });
  const resultSchema = usesPatternQuery(scopeId) ? scopeAnalysisResultSchemaForPattern(patternForScope(scopeId)) : scopeAnalysisResultSchema();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.OPENAI_TIMEOUT_MS ?? 90000));
  const requestBody = {
    model,
    input: [
      {
        role: "system",
        content: [{
          type: "input_text",
          text: buildScopeSystemPrompt(scopeId)
        }]
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify({
            task: `Analiza el ambito ${scopeId} usando solo este AIScopePacket y la memoria incremental incluida.`,
            requiredBehavior: [
              "Devuelve hallazgos si hay riesgos o inconsistencias explicitamente soportadas por evidencia.",
              "Usa memory.acceptedOrDeterministicFindings y memory.openCorrelationCandidates como candidatos con evidencia.",
              "Puedes conservar, ajustar severidad o descartar candidatos solo si la evidencia contradice el candidato.",
              "No devuelvas findings vacio cuando la memoria tenga candidatos validos soportados por evidencia.",
              "Incluye evidence_refs, related_fact_ids, related_metric_ids y related_correlation_ids usando solo IDs existentes en el packet.",
              "Incluye remediation_category con una de las 4 categorias accionables; usa pending_validation solo si no aplica remediacion o falta validacion del arquitecto."
            ],
            aiScopePacket: scopePacket,
            previousArtifacts: compactPreviousArtifacts(previousArtifacts),
            audit
          })
        }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "scope_analysis_result",
        strict: true,
        schema: resultSchema
      }
    }
  };
  const startedAt = Date.now();
  let capturedFailure = false;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    const payload = await response.json().catch(() => null);
    const latencyMs = Date.now() - startedAt;
    const usage = extractOpenAIUsage(payload);
    if (!response.ok) {
      const message = payload?.error?.message ?? "Error llamando OpenAI Responses API.";
      await captureOpenAIInteraction(debug, {
        scopeId,
        model,
        audit,
        scopePacket,
        requestBody,
        payload,
        httpStatus: response.status,
        status: "error",
        latencyMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens
      });
      capturedFailure = true;
      if (response.status === 401 || response.status === 403 || deterministicScopeFindings.length === 0) throw new Error(message);
      return deterministicScopeAnalysisFallback(scopeId, deterministicScopeFindings, message);
    }
    const parsed = JSON.parse(extractResponseText(payload) || "{\"findings\":[],\"recommendations\":[]}");
    const validation = validateScopeAnalysisResult(parsed, scopePacket);
    await captureOpenAIInteraction(debug, {
      scopeId,
      model,
      audit,
      scopePacket,
      requestBody,
      payload,
      httpStatus: response.status,
      status: "ok",
      latencyMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      rejectedFindings: validation.rejectedFindings
    });
    const mergedFindings = mergeScopeFindings(validation.validFindings, deterministicScopeFindings);
    return {
      ...parsed,
      phase: "scope_analysis",
      scopeId,
      pattern: usesPatternQuery(scopeId) ? patternForScope(scopeId) : "generic",
      audit,
      packetSummary: summarizeScopePacket(scopePacket),
      findings: mergedFindings,
      rejectedFindings: validation.rejectedFindings,
      recommendations: Array.from(new Set([...(Array.isArray(parsed.recommendations) ? parsed.recommendations : []), ...deterministicScopeFindings.map((finding: any) => finding.recommendation).filter(Boolean)]))
    };
  } catch (error) {
    if (!capturedFailure) {
      await captureOpenAIInteraction(debug, {
        scopeId,
        model,
        audit,
        scopePacket,
        requestBody,
        payload: {
          error: error instanceof Error ? error.message : "OpenAI no respondio durante scope_analysis."
        },
        httpStatus: null,
        status: error instanceof Error && error.name === "AbortError" ? "timeout" : "error",
        latencyMs: Date.now() - startedAt
      });
    }
    if (deterministicScopeFindings.length === 0) throw error;
    const message = error instanceof Error ? error.message : "OpenAI no respondio durante scope_analysis.";
    return deterministicScopeAnalysisFallback(scopeId, deterministicScopeFindings, message);
  } finally {
    clearTimeout(timeout);
  }
}

async function captureOpenAIInteraction(
  debug: { jobId: string; assessmentId: string; debugCapture: boolean } | undefined,
  input: {
    scopeId: AIAnalysisScopeId;
    model: string;
    audit: ReturnType<typeof createAIAnalysisAudit>;
    scopePacket: ReturnType<typeof buildAIScopePacket>;
    requestBody: unknown;
    payload: unknown;
    httpStatus: number | null;
    status: "ok" | "error" | "timeout";
    latencyMs: number;
    inputTokens?: number | null;
    outputTokens?: number | null;
    rejectedFindings?: unknown;
  }
) {
  if (!debug?.debugCapture) return;
  await createAiInteractionLogSafely({
    jobId: debug.jobId,
    assessmentId: debug.assessmentId,
    scopeId: input.scopeId,
    phaseName: "scope_analysis",
    model: input.model,
    promptVersion: getPromptVersion(),
    engineVersion,
    httpStatus: input.httpStatus,
    status: input.status,
    latencyMs: input.latencyMs,
    inputTokensEst: input.audit.inputTokenEstimate,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    budgetTrimmed: input.scopePacket.budget.trimmed,
    excludedEvidenceRefs: input.scopePacket.budget.excludedEvidenceRefs,
    requestJson: input.requestBody,
    responseJson: input.payload,
    rejectedFindings: input.rejectedFindings
  });
}

async function captureReduceInteraction(
  debug: { jobId: string; assessmentId: string; debugCapture: boolean },
  input: {
    model: string;
    inputHash: string;
    requestBody: unknown;
    payload: unknown;
    httpStatus: number | null;
    status: "ok" | "error" | "timeout";
    latencyMs: number;
    inputTokens?: number | null;
    outputTokens?: number | null;
    rejectedFindings?: unknown;
  }
) {
  if (!debug.debugCapture) return;
  await createAiInteractionLogSafely({
    jobId: debug.jobId,
    assessmentId: debug.assessmentId,
    scopeId: crossScopeCorrelationScopeId,
    phaseName: "reduce",
    model: input.model,
    promptVersion: getPromptVersion(),
    engineVersion,
    httpStatus: input.httpStatus,
    status: input.status,
    latencyMs: input.latencyMs,
    inputTokensEst: estimateTokens({ inputHash: input.inputHash, requestBody: input.requestBody }),
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    budgetTrimmed: false,
    excludedEvidenceRefs: 0,
    requestJson: input.requestBody,
    responseJson: input.payload,
    rejectedFindings: input.rejectedFindings
  });
}

async function captureSynthesisInteraction(
  debug: { jobId: string; assessmentId: string; debugCapture: boolean },
  input: {
    target: SynthesisTarget;
    model: string;
    inputHash: string;
    requestBody: unknown;
    payload: unknown;
    httpStatus: number | null;
    status: "ok" | "error" | "timeout";
    latencyMs: number;
    inputTokens?: number | null;
    outputTokens?: number | null;
    rejectedItems?: unknown;
  }
) {
  if (!debug.debugCapture) return;
  await createAiInteractionLogSafely({
    jobId: debug.jobId,
    assessmentId: debug.assessmentId,
    scopeId: input.target,
    phaseName: "synthesis",
    model: input.model,
    promptVersion: getPromptVersion(),
    engineVersion,
    httpStatus: input.httpStatus,
    status: input.status,
    latencyMs: input.latencyMs,
    inputTokensEst: estimateTokens({ inputHash: input.inputHash, requestBody: input.requestBody }),
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    budgetTrimmed: false,
    excludedEvidenceRefs: 0,
    requestJson: input.requestBody,
    responseJson: input.payload,
    rejectedFindings: input.rejectedItems
  });
}

function deterministicScopeAnalysisFallback(scopeId: AIAnalysisScopeId, findings: any[], reason: string) {
  return {
    phase: "scope_analysis",
    scopeId,
    pattern: usesPatternQuery(scopeId) ? patternForScope(scopeId) : "generic",
    provider: "deterministic-fallback",
    findings,
    recommendations: Array.from(new Set(findings.map((finding: any) => finding.recommendation).filter(Boolean))),
    limitations: [`OpenAI no completo la fase scope_analysis; se usaron candidatos determinísticos con evidencia. Detalle: ${reason}`]
  };
}

function synthesisScopePlaceholder(scopeId: AIAnalysisScopeId) {
  return {
    phase: "scope_analysis",
    scopeId,
    pattern: "synthesis",
    provider: "synthesis-stage-placeholder",
    findings: [],
    recommendations: [],
    limitations: ["La sintesis IA real se ejecuta en la etapa Synthesize post-Reduce; este scope conserva el fallback deterministico."]
  };
}

export function filterFindingsForValidationPhase(findings: any[]) {
  const validatedFindings: any[] = [];
  const rejectedFindings: Array<{ finding_id: string; title: string; reason: string }> = [];
  for (const finding of Array.isArray(findings) ? findings : []) {
    if (hasEvidenceOrAllowedGapType(finding)) {
      validatedFindings.push(finding);
    } else {
      rejectedFindings.push({
        finding_id: String(finding?.finding_id ?? "unknown"),
        title: String(finding?.title ?? "Hallazgo sin titulo"),
        reason: "Sin evidencia trazable."
      });
    }
  }
  return { validatedFindings, rejectedFindings };
}

function hasEvidenceOrAllowedGapType(finding: any) {
  if (Array.isArray(finding?.evidence) && finding.evidence.length > 0) return true;
  return finding?.finding_type === "visibility_gap" || finding?.finding_type === "validation_required";
}

export function deterministicFindingsToScopeAnalysisFindings(findings: any[], packet: ReturnType<typeof buildAIScopePacket>) {
  const evidenceById = new Map(fullEvidenceCatalogForPacket(packet).map((ref) => [ref.id, ref]));
  const fullFactIds = new Set([...(packet.fullConfigFactIds ?? []), ...(packet.fullStateFactIds ?? [])]);
  const fullMetricIds = new Set(packet.fullMetricIds ?? []);
  const fullCorrelationIds = new Set(packet.fullCorrelationIds ?? []);
  return findings
    .filter((finding) => finding?.id || finding?.finding_id)
    .map((finding) => {
      if (finding.finding_id && Array.isArray(finding.evidence)) return finding;
      const evidenceRefs = Array.isArray(finding.evidenceRefs) ? finding.evidenceRefs.filter((ref: string) => evidenceById.has(ref)).slice(0, 8) : [];
      const evidenceDerivedFactIds = evidenceRefs.flatMap((refId: string) => {
        const ref = evidenceById.get(refId);
        return [ref?.configFactId, ref?.stateFactId].filter(Boolean) as string[];
      });
      const evidenceDerivedMetricIds = evidenceRefs.flatMap((refId: string) => {
        const metricId = evidenceById.get(refId)?.metricId;
        return metricId ? [metricId] : [];
      });
      const relatedFactIds = uniqueStrings([
        ...normalizeStringArray(finding.related_fact_ids),
        ...normalizeStringArray(finding.relatedFactIds),
        ...evidenceDerivedFactIds
      ]).filter((id) => fullFactIds.has(id)).slice(0, 12);
      const relatedMetricIds = uniqueStrings([
        ...normalizeStringArray(finding.related_metric_ids),
        ...normalizeStringArray(finding.relatedMetricIds),
        ...evidenceDerivedMetricIds
      ]).filter((id) => fullMetricIds.has(id)).slice(0, 12);
      const relatedCorrelationIds = uniqueStrings([
        ...normalizeStringArray(finding.related_correlation_ids),
        ...normalizeStringArray(finding.relatedCorrelationIds)
      ]).filter((id) => fullCorrelationIds.has(id)).slice(0, 12);
      return {
        finding_id: String(finding.id ?? "deterministic_finding"),
        scope: packet.scopeId,
        title: String(finding.title ?? "Hallazgo deterministico"),
        finding_type: evidenceRefs.length > 0 ? "probable_issue" : "validation_required",
        severity: normalizeScopeSeverity(finding.severity),
        confidence: normalizeScopeConfidence(finding.confidence),
        evidence_refs: evidenceRefs,
        related_fact_ids: relatedFactIds,
        related_metric_ids: relatedMetricIds,
        related_correlation_ids: relatedCorrelationIds,
        evidence: evidenceRefs.map((refId: string) => {
          const ref = evidenceById.get(refId);
          return {
            source_type: ref?.metricId ? "performance" : ref?.sourceFile ? "cli" : "document",
            source_name: ref?.sourceFile ?? refId,
            hostname: ref?.deviceId ?? null,
            command: ref?.command ?? null,
            excerpt: ref?.excerpt ?? refId
          };
        }),
        technical_rationale: String(finding.title ?? "Hallazgo generado por reglas deterministicas con evidencia del assessment."),
        business_impact: "Debe ser revisado por el arquitecto para confirmar impacto, alcance y prioridad.",
        recommendation: "Validar evidencia relacionada y definir accion de remediacion o levantamiento adicional.",
        remediation_category: mapLegacyRemediation(String(finding.remediationCategory ?? finding.remediation_category ?? "")),
        remediation_steps: ["Revisar evidencia trazable", "Confirmar alcance con el arquitecto", "Documentar decision final"],
        validation_questions: ["Confirmar si la evidencia representa el estado actual de produccion."],
        related_devices: Array.isArray(finding.affectedAssets) ? finding.affectedAssets : [],
        related_sites: [],
        dependencies: ["Evidencia del assessment"]
      };
    });
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeScopeSeverity(value: unknown) {
  const severity = String(value ?? "medium");
  return severity === "info" ? "informational" : ["critical", "high", "medium", "low", "informational"].includes(severity) ? severity : "medium";
}

function normalizeScopeConfidence(value: unknown) {
  const confidence = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(confidence)) {
    if (confidence >= 80) return "high";
    if (confidence >= 55) return "medium";
    return "low";
  }
  const text = String(value ?? "medium");
  return ["high", "medium", "low"].includes(text) ? text : "medium";
}

async function loadPriorScopeResults(assessmentId: string | undefined, scopeId: AIAnalysisScopeId) {
  if (!assessmentId) return [];
  const strategyOrder = new Set(fullAssessmentScopeOrder.slice(0, Math.max(0, fullAssessmentScopeOrder.indexOf(scopeId))));
  return prisma.aiScopeResult.findMany({
    where: {
      assessmentId,
      status: "completed",
      scopeId: { in: Array.from(strategyOrder) }
    },
    orderBy: { updatedAt: "asc" }
  });
}

function openAIAnalysisModel() {
  return process.env.OPENAI_ANALYSIS_MODEL || process.env.OPENAI_MODEL || defaultOpenAIAnalysisModel;
}

export function isReduceStageEnabled() {
  return process.env.AI_REDUCE_STAGE === "1";
}

function openAIReduceModel() {
  return process.env.OPENAI_REDUCE_MODEL || openAIAnalysisModel();
}

export function isSynthesisStageEnabled() {
  return process.env.AI_SYNTHESIS_STAGE === "1";
}

function openAISynthesisModel() {
  return process.env.OPENAI_SYNTHESIS_MODEL || openAIReduceModel();
}

function compactPreviousArtifacts(previousArtifacts: any[]) {
  return previousArtifacts.map((artifact) => ({
    phase: artifact.phase,
    scopeId: artifact.scopeId,
    executiveSummary: artifact.executiveSummary,
    sourceCounts: artifact.sourceCounts,
    deterministicCandidateCount: artifact.deterministicCandidateCount,
    packetBudget: artifact.packetBudget,
    aiScopePacketSummary: artifact.aiScopePacketSummary,
    rejectedFindings: Array.isArray(artifact.rejectedFindings) ? artifact.rejectedFindings.slice(0, 12) : undefined,
    findings: Array.isArray(artifact.findings)
      ? artifact.findings.slice(0, 12).map((finding: any) => ({
          finding_id: finding.finding_id,
          title: finding.title,
          severity: finding.severity,
          confidence: finding.confidence,
          evidence_refs: finding.evidence_refs,
          related_fact_ids: finding.related_fact_ids,
          related_metric_ids: finding.related_metric_ids,
          related_correlation_ids: finding.related_correlation_ids
        }))
      : undefined
  }));
}

function summarizeScopePacket(packet: ReturnType<typeof buildAIScopePacket>) {
  return {
    packetVersion: packet.packetVersion,
    scopeId: packet.scopeId,
    strategy: packet.strategy.label,
    analysisGoal: packet.strategy.analysisGoal,
    priorScopeSummaries: packet.memory.priorScopeSummaries.length,
    deterministicFindings: packet.memory.acceptedOrDeterministicFindings.length,
    correlations: packet.memory.openCorrelationCandidates.length,
    devices: packet.graphSlice.devices.length,
    relationships: packet.graphSlice.relationships.length,
    configFacts: packet.graphSlice.configFacts.length,
    stateFacts: packet.graphSlice.stateFacts.length,
    performanceMetrics: packet.graphSlice.performanceMetrics.length,
    evidenceRefs: packet.evidencePack.length,
    budget: packet.budget
  };
}

export function buildScopeSystemPrompt(scopeId: AIAnalysisScopeId) {
  const promptVersion = getPromptVersion();
  const lines = [
    "Eres un arquitecto senior Cisco ejecutando una fase incremental de assessment.",
    "No inventes equipos, rutas, conexiones ni vulnerabilidades.",
    "Usa solo el AIScopePacket provisto. No uses conocimiento externo para completar datos faltantes.",
    "Todo hallazgo debe tener evidence_refs existentes en AIScopePacket.fullEvidenceRefIds o debe clasificarse como visibility_gap/validation_required.",
    "Todo hallazgo debe incluir remediation_category. Usa professional_services, new_technology, platform_upgrade u operational_change para hallazgos accionables; pending_validation solo para gaps, validaciones o casos que el arquitecto debe categorizar.",
    "Respeta la estrategia, tipos de hallazgo y reglas de validacion especificas del ambito.",
    "Si la evidencia es insuficiente, usa validation_required o visibility_gap en vez de inferir.",
    `Prompt version: ${promptVersion}. Engine version: ${engineVersion}.`
  ];
  if (usesPatternQuery(scopeId) && patternForScope(scopeId) === "entity") {
    lines.splice(lines.length - 1, 0, "Razona por equipo/grupo contra el estandar/control esperado. Para cada hallazgo completa `entity_target` (equipo o grupo), `expected_state`, `observed_state` y `standard_or_control`. No infieras estado sin fact/evidencia; usa visibility_gap/validation_required si falta.");
  }
  if (usesPatternQuery(scopeId) && patternForScope(scopeId) === "graph") {
    lines.splice(lines.length - 1, 0, "Razona de forma relacional sobre el grafo de topologia (vecinos CDP/LLDP, port-channel, vPC/stack/HA). Para cada hallazgo completa `affected_relationships` (pares 'devA:intf <-> devB:intf'), `topology_basis` y `coverage_note`. No afirmes SPOF ni single-homed sin evidencia topologica relacionada; si falta CDP/LLDP usa visibility_gap.");
  }
  if (usesPatternQuery(scopeId) && patternForScope(scopeId) === "aggregation") {
    lines.splice(lines.length - 1, 0, "Razona por agregacion temporal/recurrencia o por ausencia (gap). Para cada hallazgo completa `aggregation_basis` (ventana/recurrencia o ausencia detectada), `occurrence_count` (entero), `time_window` y `correlated_entity`. No marques 'recurrente' con una sola evidencia: requiere >=2 evidencias o una ventana temporal; si es evento aislado usa probable_issue/validation_required, y si falta monitoreo/documentacion usa visibility_gap.");
  }
  return lines.join("\n");
}

function buildReduceSystemPrompt() {
  return [
    "Eres un arquitecto senior Cisco ejecutando la etapa Reduce transversal de un assessment.",
    "Usa solo el reduceDigest provisto; no inventes finding_id, scopes, equipos ni evidencia.",
    "Produce hallazgos compuestos solo cuando fuentes reales de al menos 2 scopes distintos soporten una correlacion cross-dominio.",
    "Cada finding debe completar source_finding_ids con IDs existentes y composite_rationale con la correlacion transversal.",
    "Si la correlacion no esta soportada, devuelve findings vacio y explica la limitacion."
  ].join("\n");
}

function buildSynthesisSystemPrompt(target: SynthesisTarget) {
  const targetLabel = target === "roadmap" ? "roadmap priorizado" : "resumen ejecutivo";
  return [
    `Eres un arquitecto senior Cisco generando el ${targetLabel} final de un assessment.`,
    "Usa solo el synthesisDigest provisto y, si aplica, el roadmap generado; no inventes findings, scopes ni equipos.",
    "Cada item o riesgo debe citar source_finding_ids existentes en el digest.",
    "Da prioridad a hallazgos compuestos cross-scope cuando existan, y declara limitaciones si la evidencia no alcanza.",
    "No agregues campos fuera del schema solicitado."
  ].join("\n");
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
          required: [
            "finding_id",
            "scope",
            "title",
            "finding_type",
            "severity",
            "confidence",
            "evidence_refs",
            "related_fact_ids",
            "related_metric_ids",
            "related_correlation_ids",
            "evidence",
            "technical_rationale",
            "business_impact",
            "recommendation",
            "remediation_category",
            "remediation_steps",
            "validation_questions",
            "related_devices",
            "related_sites",
            "dependencies"
          ],
          properties: {
            finding_id: { type: "string" },
            scope: { type: "string" },
            title: { type: "string" },
            finding_type: { type: "string", enum: ["confirmed_finding", "probable_issue", "correlation_suspicion", "visibility_gap", "validation_required"] },
            severity: { type: "string", enum: ["critical", "high", "medium", "low", "informational"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            evidence_refs: { type: "array", items: { type: "string" } },
            related_fact_ids: { type: "array", items: { type: "string" } },
            related_metric_ids: { type: "array", items: { type: "string" } },
            related_correlation_ids: { type: "array", items: { type: "string" } },
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
            remediation_category: { type: "string", enum: remediationCategoryEnum },
            remediation_steps: { type: "array", items: { type: "string" } },
            validation_questions: { type: "array", items: { type: "string" } },
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
  const deterministicFindings = buildDeterministicScopeFindings(record, scopeId);
  const evidenceText = stableStringify({
    client: record?.client,
    assessment: record?.assessment,
    scope: record?.scope,
    inventory: devices,
    deterministicFindings,
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
    deterministicFindings,
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

function buildDeterministicScopeFindings(record: any, scopeId: AIAnalysisScopeId) {
  if (scopeId !== "topology") return [];
  return buildDeterministicTopologyFindings(record).slice(0, 6);
}

function buildDeterministicTopologyFindings(record: any) {
  const parsed = record?.parsed ?? {};
  const relations = Array.isArray(parsed.relations) ? parsed.relations : [];
  const targetInventory = Array.isArray(record?.targetInventory) ? record.targetInventory.filter((device: any) => device.included !== false) : [];
  const findings: any[] = [];
  type LowCoverageDevice = { device: any; count: number };

  const selfRelations = relations.filter((relation: any) => {
    const local = normalizeTopologyName(relation.localHostname);
    const remote = normalizeTopologyName(relation.remoteHostname);
    return local && remote && local === remote;
  });
  if (selfRelations.length > 0) {
    const samples = selfRelations.slice(0, 4);
    findings.push({
      finding_id: "topology_self_neighbor_relations",
      scope: "topology",
      title: "Relaciones CDP/LLDP autoreferenciadas requieren validacion topologica",
      severity: selfRelations.length > 2 ? "medium" : "low",
      confidence: "medium",
      evidence: samples.map((relation: any) => topologyRelationEvidence(relation, "La relacion muestra el mismo hostname como origen y destino.")),
      technical_rationale: `${selfRelations.length} relaciones descubiertas tienen el mismo equipo como origen y destino. Esto puede indicar salida mezclada, parsing incorrecto, vecinos mal identificados o una inconsistencia de documentacion topologica que impide confiar plenamente en dependencias y redundancia.`,
      business_impact: "Una topologia con relaciones ambiguas reduce la confianza del assessment para identificar puntos unicos de falla, dependencias criticas y rutas de remediacion.",
      recommendation: "Validar los bloques CDP/LLDP por hostname, corregir evidencias mezcladas y confirmar pares fisicos/logicos antes de cerrar el mapa topologico.",
      remediation_category: "operational_change",
      remediation_steps: ["Separar evidencia por dispositivo origen", "Reejecutar show cdp/lldp neighbors detail por equipo", "Validar pares origen/destino en el diagrama topologico"],
      related_devices: Array.from(new Set(samples.flatMap((relation: any) => [relation.localHostname, relation.remoteHostname]).filter(Boolean))),
      related_sites: [],
      dependencies: ["CDP/LLDP por dispositivo", "Diagrama fisico/logico vigente"]
    });
  }

  const relationCounts = relationCountByHostname(relations);
  const criticalSingleHomed = targetInventory
    .filter((device: any) => isHighPriorityTopologyDevice(device))
    .map((device: any) => ({ device, count: relationCounts.get(normalizeTopologyName(device.hostname)) ?? 0 }))
    .filter((item: LowCoverageDevice) => item.count <= 1)
    .slice(0, 8);
  if (criticalSingleHomed.length > 0) {
    findings.push({
      finding_id: "topology_critical_devices_low_neighbor_coverage",
      scope: "topology",
      title: "Equipos criticos con baja cobertura de vecinos topologicos",
      severity: criticalSingleHomed.some((item: LowCoverageDevice) => item.count === 0) ? "high" : "medium",
      confidence: relations.length > 0 ? "medium" : "low",
      evidence: criticalSingleHomed.slice(0, 5).map(({ device, count }: LowCoverageDevice) => ({
        source_type: "inventory",
        source_name: "Inventario objetivo y relaciones CDP/LLDP",
        hostname: device.hostname ?? null,
        command: "show cdp neighbors detail / show lldp neighbors detail",
        excerpt: `${device.hostname}: prioridad ${device.priority ?? "sin prioridad"}, rol ${device.role ?? "sin rol"}, relaciones detectadas ${count}.`
      })),
      technical_rationale: "Dispositivos marcados como criticos o de alta prioridad tienen cero o una relacion topologica detectada. Para equipos core, datacenter, WAN edge, firewalls o controladores, esto puede ocultar puntos unicos de falla o evidencia incompleta de redundancia.",
      business_impact: "La baja cobertura de vecinos en equipos criticos limita la capacidad de demostrar resiliencia y puede ocultar dependencias operativas de alto impacto.",
      recommendation: "Completar evidencia CDP/LLDP, port-channel/vPC y redundancia para los equipos criticos antes de aceptar la topologia como validada.",
      remediation_category: "pending_validation",
      remediation_steps: ["Recolectar vecinos CDP/LLDP desde cada equipo critico", "Validar port-channel/vPC/stack/SSO cuando aplique", "Actualizar inventario objetivo con pares redundantes esperados"],
      related_devices: criticalSingleHomed.map((item: LowCoverageDevice) => String(item.device.hostname ?? "")).filter(Boolean),
      related_sites: Array.from(new Set(criticalSingleHomed.map((item: LowCoverageDevice) => String(item.device.site ?? "")).filter(Boolean))),
      dependencies: ["Inventario objetivo", "CDP/LLDP", "Evidencia de redundancia"]
    });
  }

  if (relations.length === 0 && targetInventory.length > 1) {
    findings.push({
      finding_id: "topology_missing_neighbor_evidence",
      scope: "topology",
      title: "No hay evidencia CDP/LLDP suficiente para validar dependencias topologicas",
      severity: "medium",
      confidence: "high",
      evidence: [{
        source_type: "inventory",
        source_name: "Inventario objetivo",
        hostname: null,
        command: "show cdp neighbors detail / show lldp neighbors detail",
        excerpt: `${targetInventory.length} equipos incluidos en alcance, pero 0 relaciones topologicas parseadas.`
      }],
      technical_rationale: "Sin relaciones CDP/LLDP parseadas no es posible soportar con evidencia la redundancia fisica/logica ni dependencias entre capas.",
      business_impact: "El assessment no puede concluir puntos unicos de falla o resiliencia sin evidencia topologica verificable.",
      recommendation: "Recolectar y cargar evidencia CDP/LLDP por dispositivo antes de cerrar la evaluacion topologica.",
      remediation_category: "pending_validation",
      remediation_steps: ["Recolectar show cdp neighbors detail", "Recolectar show lldp neighbors detail", "Reprocesar evidencia"],
      related_devices: targetInventory.slice(0, 8).map((device: any) => String(device.hostname ?? "")).filter(Boolean),
      related_sites: Array.from(new Set(targetInventory.map((device: any) => String(device.site ?? "")).filter(Boolean))).slice(0, 8),
      dependencies: ["Evidencia CDP/LLDP"]
    });
  }

  return findings;
}

function mergeScopeFindings(aiFindings: any[], deterministicFindings: any[]) {
  const byId = new Map<string, any>();
  for (const finding of deterministicFindings) {
    if (finding?.finding_id) byId.set(String(finding.finding_id), finding);
  }
  for (const finding of aiFindings) {
    if (!finding?.finding_id) continue;
    byId.set(String(finding.finding_id), finding);
  }
  return Array.from(byId.values());
}

export function buildReduceDigest(scopeResults: any[]): ReduceDigest {
  const digestFindings: ReduceDigestFinding[] = [];
  const catalog: Record<string, string[]> = {};
  const mapResults = [...(Array.isArray(scopeResults) ? scopeResults : [])]
    .filter((result: any) => shouldIncludeInReduceDigest(result))
    .sort((left: any, right: any) => String(left.scopeId).localeCompare(String(right.scopeId)));

  for (const result of mapResults) {
    const scope = String(result.scopeId);
    const findings = (Array.isArray(result.findingsJson) ? result.findingsJson : [])
      .filter((finding: any) => finding?.finding_id)
      .sort((left: any, right: any) =>
        severityScore(right?.severity) - severityScore(left?.severity) ||
        confidenceScore(right?.confidence) - confidenceScore(left?.confidence) ||
        String(left?.finding_id).localeCompare(String(right?.finding_id))
      )
      .slice(0, reduceFindingsPerScopeLimit)
      .map((finding: any) => ({
        scope,
        finding_id: String(finding.finding_id),
        title: String(finding.title ?? ""),
        severity: String(finding.severity ?? "medium"),
        finding_type: String(finding.finding_type ?? "probable_issue"),
        related_devices: normalizeStringList(finding.related_devices)
      }));
    catalog[scope] = findings.map((finding: ReduceDigestFinding) => finding.finding_id);
    digestFindings.push(...findings);
  }

  return {
    digestVersion: "ai-reduce-digest-v1",
    findings: digestFindings,
    catalog
  };
}

export function validateReduceResult(parsed: any, digest: ReduceDigest) {
  const sourceByKey = new Map(digest.findings.map((finding) => [`${finding.scope}:${finding.finding_id}`, finding]));
  const validFindings: any[] = [];
  const rejected: Array<{ finding_id: string; title: string; reason: string }> = [];

  for (const finding of Array.isArray(parsed?.findings) ? parsed.findings : []) {
    const reasons: string[] = [];
    const sources = Array.isArray(finding?.source_finding_ids) ? finding.source_finding_ids : [];
    const sourceKeys = sources.map((source: any) => `${String(source?.scope ?? "")}:${String(source?.finding_id ?? "")}`);
    const missingSources = sourceKeys.filter((key: string) => !sourceByKey.has(key));
    const sourceScopes = new Set(sources.map((source: any) => String(source?.scope ?? "")).filter(Boolean));

    if (sources.length < 2 || sourceScopes.size < 2) {
      reasons.push("Hallazgo compuesto requiere source_finding_ids de al menos 2 scopes distintos.");
    }
    if (missingSources.length > 0) {
      reasons.push(`source_finding_ids inexistentes: ${missingSources.join(", ")}.`);
    }

    const citedDevices = new Set(
      sourceKeys.flatMap((key: string) => sourceByKey.get(key)?.related_devices ?? []).map(normalizeSignatureText)
    );
    const unknownDevices = normalizeStringList(finding?.related_devices)
      .filter((device) => !citedDevices.has(normalizeSignatureText(device)));
    if (unknownDevices.length > 0) {
      reasons.push(`related_devices no existen en las fuentes citadas: ${unknownDevices.join(", ")}.`);
    }

    if (reasons.length > 0) {
      rejected.push({
        finding_id: String(finding?.finding_id ?? "unknown"),
        title: String(finding?.title ?? "Hallazgo compuesto sin titulo"),
        reason: reasons.join(" ")
      });
    } else {
      validFindings.push(finding);
    }
  }

  return { validFindings, rejected };
}

export function buildSynthesisDigest(scopeResults: any[]): SynthesisDigest {
  const digestFindings: ReduceDigestFinding[] = [];
  const catalog: Record<string, string[]> = {};
  const sourceResults = [...(Array.isArray(scopeResults) ? scopeResults : [])]
    .filter((result: any) => shouldIncludeInSynthesisDigest(result))
    .sort((left: any, right: any) => String(left.scopeId).localeCompare(String(right.scopeId)));

  for (const result of sourceResults) {
    const scope = String(result.scopeId);
    const findings = (Array.isArray(result.findingsJson) ? result.findingsJson : [])
      .filter((finding: any) => finding?.finding_id)
      .sort((left: any, right: any) =>
        severityScore(right?.severity) - severityScore(left?.severity) ||
        confidenceScore(right?.confidence) - confidenceScore(left?.confidence) ||
        String(left?.finding_id).localeCompare(String(right?.finding_id))
      )
      .slice(0, synthesisFindingsPerScopeLimit)
      .map((finding: any) => ({
        scope,
        finding_id: String(finding.finding_id),
        title: String(finding.title ?? ""),
        severity: String(finding.severity ?? "medium"),
        finding_type: String(finding.finding_type ?? "probable_issue"),
        related_devices: normalizeStringList(finding.related_devices)
      }));
    catalog[scope] = findings.map((finding: ReduceDigestFinding) => finding.finding_id);
    digestFindings.push(...findings);
  }

  return {
    digestVersion: "ai-synthesis-digest-v1",
    findings: digestFindings,
    catalog
  };
}

export function validateSynthesisResult(parsed: any, digest: SynthesisDigest, target: SynthesisTarget) {
  const sourceByKey = new Set(digest.findings.map((finding) => `${finding.scope}:${finding.finding_id}`));
  const entries = target === "roadmap"
    ? (Array.isArray(parsed?.items) ? parsed.items : [])
    : (Array.isArray(parsed?.top_risks) ? parsed.top_risks : []);
  const valid: any[] = [];
  const rejected: Array<{ id: string; title: string; reason: string }> = [];

  for (const entry of entries) {
    const sources = Array.isArray(entry?.source_finding_ids) ? entry.source_finding_ids : [];
    const sourceKeys = sources.map((source: any) => `${String(source?.scope ?? "")}:${String(source?.finding_id ?? "")}`);
    const missingSources = sourceKeys.filter((key: string) => !sourceByKey.has(key));
    const reasons: string[] = [];
    if (sources.length === 0) reasons.push("Debe citar al menos un source_finding_id existente.");
    if (missingSources.length > 0) reasons.push(`source_finding_ids inexistentes: ${missingSources.join(", ")}.`);

    if (reasons.length > 0) {
      rejected.push({
        id: String(entry?.item_id ?? entry?.title ?? "unknown"),
        title: String(entry?.title ?? "Elemento de sintesis sin titulo"),
        reason: reasons.join(" ")
      });
    } else {
      valid.push(entry);
    }
  }

  return { valid, rejected };
}

function shouldIncludeInReduceDigest(result: any) {
  const scopeId = String(result?.scopeId ?? "");
  return result?.status === "completed" &&
    scopeId !== crossScopeCorrelationScopeId &&
    scopeId !== "roadmap" &&
    scopeId !== "executive_summary" &&
    Array.isArray(result?.findingsJson) &&
    result.findingsJson.length > 0;
}

function shouldIncludeInSynthesisDigest(result: any) {
  const scopeId = String(result?.scopeId ?? "");
  return result?.status === "completed" &&
    scopeId !== "roadmap" &&
    scopeId !== "executive_summary" &&
    Array.isArray(result?.findingsJson) &&
    result.findingsJson.length > 0;
}

function synthesisEmptyResponse(target: SynthesisTarget) {
  if (target === "roadmap") return "{\"phase\":\"synthesis\",\"items\":[],\"limitations\":[]}";
  return "{\"phase\":\"synthesis\",\"summary\":\"\",\"posture\":\"Sin sintesis generada.\",\"top_risks\":[]}";
}

function buildSynthesisResultJson(parsed: any, valid: any[], rejected: any[], digest: SynthesisDigest, target: SynthesisTarget) {
  if (target === "roadmap") {
    return {
      ...parsed,
      phase: "synthesis",
      scopeId: target,
      items: valid,
      rejectedItems: rejected,
      digestSummary: synthesisDigestSummary(digest)
    };
  }
  return {
    ...parsed,
    phase: "synthesis",
    scopeId: target,
    top_risks: valid,
    rejectedTopRisks: rejected,
    digestSummary: synthesisDigestSummary(digest)
  };
}

function synthesisDigestSummary(digest: SynthesisDigest) {
  return {
    sourceScopes: Object.keys(digest.catalog).sort(),
    sourceFindingCount: digest.findings.length
  };
}

function compactGeneratedRoadmap(roadmap: any) {
  return {
    items: Array.isArray(roadmap?.items)
      ? roadmap.items.slice(0, 12).map((item: any) => ({
          item_id: item.item_id,
          title: item.title,
          priority: item.priority,
          severity: item.severity,
          source_finding_ids: item.source_finding_ids
        }))
      : [],
    limitations: Array.isArray(roadmap?.limitations) ? roadmap.limitations.slice(0, 8) : []
  };
}

export function mergeScopePartitionResults(scopeId: AIAnalysisScopeId, results: any[], partitions: ScopePartition[]) {
  const sortedPartitions = [...partitions].sort((left, right) => left.id.localeCompare(right.id));
  const partitionIds = sortedPartitions.map((partition) => partition.id);
  const sortedResults = [...results].sort((left, right) =>
    String(left?.partitionId ?? "").localeCompare(String(right?.partitionId ?? ""))
  );
  const bySignature = new Map<string, any>();

  for (const result of sortedResults) {
    for (const finding of Array.isArray(result?.findings) ? result.findings : []) {
      const signature = partitionFindingSignature(scopeId, finding);
      const current = bySignature.get(signature);
      if (!current || comparePartitionFindings(finding, current) > 0) bySignature.set(signature, finding);
    }
  }

  const findings = Array.from(bySignature.values()).sort((left, right) =>
    partitionFindingSignature(scopeId, left).localeCompare(partitionFindingSignature(scopeId, right))
  );
  const recommendations = uniqueStringValues(sortedResults.flatMap((result) => Array.isArray(result?.recommendations) ? result.recommendations : []));
  const limitations = [
    ...uniqueStringValues(sortedResults.flatMap((result) => Array.isArray(result?.limitations) ? result.limitations : [])),
    `merged from ${sortedPartitions.length} partitions`
  ];
  const rejectedFindings = sortedResults.flatMap((result) => Array.isArray(result?.rejectedFindings) ? result.rejectedFindings : []);

  return {
    phase: "scope_analysis",
    scopeId,
    pattern: sortedResults.find((result) => result?.pattern)?.pattern ?? (usesPatternQuery(scopeId) ? patternForScope(scopeId) : "generic"),
    findings,
    recommendations,
    limitations,
    rejectedFindings,
    partitions: sortedPartitions.length,
    partitionIds,
    partitionPlan: sortedPartitions.map((partition) => ({
      id: partition.id,
      deviceHostnames: partition.deviceHostnames
    })),
    partitionResults: sortedResults.map((result) => ({
      partitionId: result?.partitionId,
      findingCount: Array.isArray(result?.findings) ? result.findings.length : 0,
      recommendationCount: Array.isArray(result?.recommendations) ? result.recommendations.length : 0,
      rejectedFindingCount: Array.isArray(result?.rejectedFindings) ? result.rejectedFindings.length : 0,
      audit: result?.audit,
      packetSummary: result?.packetSummary
    }))
  };
}

function partitionFindingSignature(scopeId: AIAnalysisScopeId, finding: any) {
  const scope = normalizeSignatureText(finding?.scope ?? scopeId);
  const title = normalizeSignatureText(finding?.title ?? finding?.finding_id ?? "");
  const devices = normalizeStringList(finding?.related_devices).map(normalizeSignatureText).sort().join(",");
  return `${scope}|${title}|${devices}`;
}

function comparePartitionFindings(left: any, right: any) {
  const severityDelta = severityScore(left?.severity) - severityScore(right?.severity);
  if (severityDelta !== 0) return severityDelta;
  const confidenceDelta = confidenceScore(left?.confidence) - confidenceScore(right?.confidence);
  if (confidenceDelta !== 0) return confidenceDelta;
  return String(right?.finding_id ?? "").localeCompare(String(left?.finding_id ?? ""));
}

function severityScore(value: unknown) {
  const rank: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1, info: 1 };
  return rank[String(value ?? "").toLowerCase()] ?? 0;
}

function confidenceScore(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  return rank[String(value ?? "").toLowerCase()] ?? 0;
}

function normalizeSignatureText(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function uniqueStringValues(values: unknown[]) {
  return Array.from(new Set(values.map(String).map((item) => item.trim()).filter(Boolean)));
}

function topologyRelationEvidence(relation: any, prefix: string) {
  return {
    source_type: "cli",
    source_name: relation.evidence?.[0] ? "CDP/LLDP neighbors detail" : "Relacion topologica parseada",
    hostname: relation.localHostname ?? null,
    command: relation.protocol === "lldp" ? "show lldp neighbors detail" : "show cdp neighbors detail",
    excerpt: `${prefix} ${relation.localHostname ?? "origen desconocido"} ${relation.localInterface ?? ""} -> ${relation.remoteHostname ?? "destino desconocido"} ${relation.remoteInterface ?? ""}. ${String(relation.evidence?.[0] ?? "").slice(0, 450)}`
  };
}

function relationCountByHostname(relations: any[]) {
  const counts = new Map<string, number>();
  for (const relation of relations) {
    const local = normalizeTopologyName(relation.localHostname);
    const remote = normalizeTopologyName(relation.remoteHostname);
    if (local) counts.set(local, (counts.get(local) ?? 0) + 1);
    if (remote) counts.set(remote, (counts.get(remote) ?? 0) + 1);
  }
  return counts;
}

function isHighPriorityTopologyDevice(device: any) {
  const value = `${device?.priority ?? ""} ${device?.role ?? ""} ${device?.deviceType ?? ""}`.toLowerCase();
  return /critical|high|core|distribution|datacenter|spine|leaf|wan|edge|firewall|controller/.test(value);
}

function normalizeTopologyName(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
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

export function hashScopeInput(record: any, scopeId: AIAnalysisScopeId) {
  const context = buildScopeContext(record, scopeId);
  return createHash("sha256")
    .update(stableStringify({
      scopeId,
      promptVersion: getPromptVersion(),
      ...(usesPatternQuery(scopeId) ? { patternQuery: true } : {}),
      ...(isEvidenceTieringEnabled() ? { evidenceTiering: true } : {}),
      ...(isDomainPartitionEnabled() ? { domainPartition: true } : {}),
      engineVersion,
      client: context.client,
      assessment: context.assessment,
      sourceCounts: context.sourceCounts,
      evidenceText: context.evidenceText
    }))
    .digest("hex");
}

function hashReduceDigest(digest: ReduceDigest) {
  return createHash("sha256")
    .update(stableStringify({
      promptVersion: getPromptVersion(),
      engineVersion,
      digest
    }))
    .digest("hex");
}

function hashSynthesisDigest(digest: SynthesisDigest, target: SynthesisTarget) {
  return createHash("sha256")
    .update(stableStringify({
      target,
      promptVersion: getPromptVersion(),
      engineVersion,
      digest
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

function isOpenAICredentialPlaceholderResult(findingsJson: Prisma.JsonValue) {
  const findings = Array.isArray(findingsJson) ? findingsJson : [];
  return findings.some((finding) => {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) return false;
    const value = finding as Record<string, any>;
    const title = String(value.title ?? "");
    const evidence = Array.isArray(value.evidence) ? value.evidence : [];
    return title.includes("OPENAI_API_KEY") || evidence.some((item: any) => String(item?.excerpt ?? "").includes("no llamo OpenAI"));
  });
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
