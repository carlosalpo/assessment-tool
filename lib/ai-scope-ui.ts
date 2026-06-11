export type AIScopeDisplayId =
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

export type AITransversalStageId = "cross_scope_correlation";
export type AIScopeOrStageDisplayId = AIScopeDisplayId | AITransversalStageId;
export type AmbitoId = "configuration" | "security" | "logs" | "lifecycle" | "topology" | "operations" | "performance";
export type AIScopeDisplayGroup = "Configuraciones" | "Seguridad" | "Logs y Eventos" | "Vigencia tecnológica" | "Topología" | "Operaciones" | "Performance" | "Síntesis";
export type AIStageFlag = "AI_REDUCE_STAGE" | "AI_SYNTHESIS_STAGE";
export type CoverageLedgerEntry = {
  deviceHostname: string;
  applicable: number;
  withFinding: number;
  gap: number;
  clean: number;
  notEvaluated: number;
};

export type AIScopeDisplayMetadata = {
  id: AIScopeOrStageDisplayId;
  label: string;
  group: AIScopeDisplayGroup;
};

export type AIScopePhaseDisplay = {
  id: "context_preparation" | "evidence_extraction" | "normalization" | "scope_analysis" | "validation" | "scope_synthesis";
  label: string;
};

type ScopeProgressStep = {
  scopeId: string;
  phaseName?: string;
  status: string;
  progress?: number | null;
  inputHash?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

type ScopeProgressStatus = {
  scopes?: Array<{
    id: string;
    status: string;
  }>;
  jobs?: Array<{
    steps: ScopeProgressStep[];
  }>;
};

type ScopeProgressJob = {
  status?: string;
  currentPhase?: string | null;
  progress?: number | null;
  steps: ScopeProgressStep[];
};

export const ambitoOrder: AmbitoId[] = ["configuration", "security", "logs", "lifecycle", "topology", "operations", "performance"];

export const ambitoMeta: Record<AmbitoId, { label: string; description: string }> = {
  configuration: { label: "Configuraciones", description: "Consistencia de configuración, estándares y desviaciones operativas." },
  security: { label: "Seguridad", description: "Hardening, exposición administrativa y controles de seguridad." },
  logs: { label: "Logs y Eventos", description: "Eventos, recurrencias, evidencia de logs y brechas de trazabilidad." },
  lifecycle: { label: "Vigencia tecnológica", description: "Inventario, modelos, versiones y riesgos de ciclo de vida." },
  topology: { label: "Topología", description: "Relaciones, routing, dominios de red y resiliencia." },
  operations: { label: "Operaciones", description: "Monitoreo, procesos, soporte, mantenibilidad y operación diaria." },
  performance: { label: "Performance", description: "Capacidad, errores, drops, CPU, memoria y tendencias." }
};

export const ambitoMemberScopes: Record<AmbitoId, AIScopeDisplayId[]> = {
  configuration: ["configuration"],
  security: ["security"],
  logs: ["evidence"],
  lifecycle: ["lifecycle", "inventory"],
  topology: ["topology", "routing", "wan", "datacenter", "campus", "perimeter", "high_availability"],
  operations: ["operations"],
  performance: ["performance"]
};

export function activeAmbitoMemberScopes(ambito: AmbitoId, opts?: { topologyPlaybookEnabled?: boolean }): AIScopeDisplayId[] {
  if (ambito === "topology" && opts?.topologyPlaybookEnabled === true) return ["topology"];
  return ambitoMemberScopes[ambito];
}

const scopeAmbitoMap = Object.fromEntries(
  Object.entries(ambitoMemberScopes).flatMap(([ambito, scopes]) => scopes.map((scope) => [scope, ambito]))
) as Record<string, AmbitoId>;

export function scopeToAmbito(scopeId: string | undefined | null): AmbitoId | null {
  if (!scopeId) return null;
  return scopeAmbitoMap[scopeId] ?? null;
}

export function ambitoCoverageLedger(
  ambito: AmbitoId,
  scopes: Array<{ id: string; coverageLedger?: CoverageLedgerEntry[] | null }>
): CoverageLedgerEntry[] {
  const memberScopes = new Set<string>(ambitoMemberScopes[ambito]);
  const byDevice = new Map<string, CoverageLedgerEntry>();

  for (const scope of scopes) {
    if (!memberScopes.has(scope.id) || !Array.isArray(scope.coverageLedger)) continue;
    for (const entry of scope.coverageLedger) {
      const deviceHostname = String(entry.deviceHostname ?? "").trim();
      if (!deviceHostname) continue;
      const existing = byDevice.get(deviceHostname) ?? {
        deviceHostname,
        applicable: 0,
        withFinding: 0,
        gap: 0,
        clean: 0,
        notEvaluated: 0
      };
      byDevice.set(deviceHostname, {
        deviceHostname,
        applicable: existing.applicable + safeLedgerNumber(entry.applicable),
        withFinding: existing.withFinding + safeLedgerNumber(entry.withFinding),
        gap: existing.gap + safeLedgerNumber(entry.gap),
        clean: existing.clean + safeLedgerNumber(entry.clean),
        notEvaluated: existing.notEvaluated + safeLedgerNumber(entry.notEvaluated)
      });
    }
  }

  return Array.from(byDevice.values());
}

export function isCoverageComplete(ledger: CoverageLedgerEntry[]): boolean {
  return ledger.length > 0 && ledger.every((entry) => entry.notEvaluated === 0);
}

// Display-only order for finding scopes plus optional synthesis stages.
// Keep finding scopes in sync with lib/ai-analysis-jobs.ts fullAssessmentScopeOrder;
// do not import server/prisma code into the client bundle.
export const aiScopeDisplayOrder: AIScopeDisplayMetadata[] = [
  { id: "configuration", label: "Configuración", group: "Configuraciones" },
  { id: "security", label: "Seguridad", group: "Seguridad" },
  { id: "evidence", label: "Evidencia", group: "Logs y Eventos" },
  { id: "lifecycle", label: "Lifecycle", group: "Vigencia tecnológica" },
  { id: "inventory", label: "Inventario", group: "Vigencia tecnológica" },
  { id: "topology", label: "Topología", group: "Topología" },
  { id: "routing", label: "Routing", group: "Topología" },
  { id: "wan", label: "WAN", group: "Topología" },
  { id: "datacenter", label: "Datacenter", group: "Topología" },
  { id: "campus", label: "Campus", group: "Topología" },
  { id: "perimeter", label: "Perímetro", group: "Topología" },
  { id: "high_availability", label: "Alta disponibilidad", group: "Topología" },
  { id: "operations", label: "Operación", group: "Operaciones" },
  { id: "performance", label: "Performance", group: "Performance" },
  { id: "roadmap", label: "Roadmap", group: "Síntesis" },
  { id: "executive_summary", label: "Resumen ejecutivo", group: "Síntesis" }
];

export const crossScopeCorrelationDisplay: AIScopeDisplayMetadata = {
  id: "cross_scope_correlation",
  label: "Correlación transversal",
  group: "Síntesis"
};

export const aiScopePhaseDisplay: AIScopePhaseDisplay[] = [
  { id: "context_preparation", label: "Contexto" },
  { id: "evidence_extraction", label: "Evidencia" },
  { id: "normalization", label: "Normalización" },
  { id: "scope_analysis", label: "Análisis" },
  { id: "validation", label: "Validación" },
  { id: "scope_synthesis", label: "Síntesis" }
];

export function flagForStage(scopeId: AIScopeOrStageDisplayId): AIStageFlag | null {
  if (scopeId === "cross_scope_correlation") return "AI_REDUCE_STAGE";
  if (scopeId === "roadmap" || scopeId === "executive_summary") return "AI_SYNTHESIS_STAGE";
  return null;
}

export function scopeProgressFromStatus(
  scopeId: string,
  aiAnalysisStatus?: ScopeProgressStatus,
  latestJob?: ScopeProgressJob | null
): number {
  const stepsByPhase = new Map<string, ScopeProgressStep>();
  for (const step of [
    ...(aiAnalysisStatus?.jobs ?? []).flatMap((job) => job.steps),
    ...(latestJob?.steps ?? [])
  ]) {
    if (step.scopeId !== scopeId) continue;
    stepsByPhase.set(step.phaseName ?? `${stepsByPhase.size}`, step);
  }

  const steps = Array.from(stepsByPhase.values());
  const currentPhase = latestJob?.currentPhase;
  const currentScopeIsActive = Boolean(currentPhase?.startsWith(`${scopeId}:`) && isActiveJobStatus(latestJob?.status));

  const scopeStatus = aiAnalysisStatus?.scopes?.find((scope) => scope.id === scopeId)?.status;
  if (!currentScopeIsActive && isCompletedScopeStatus(scopeStatus)) return 100;
  if (steps.length === 0) return currentScopeIsActive ? 1 : 0;

  const completedSteps = steps.filter((step) => isCompletedScopeStatus(step.status)).length;
  const runningStep = steps.find((step) => step.status === "running" || currentPhase === `${step.scopeId}:${step.phaseName}`);
  const runningStepProgress = typeof runningStep?.progress === "number" ? clampProgress(runningStep.progress) : 0;
  const rawProgress = ((completedSteps + runningStepProgress / 100) / Math.max(steps.length, 1)) * 100;
  const progress = Math.round(rawProgress);
  if (currentScopeIsActive && progress === 0) return 1;
  if (progress >= 100 && !isCompletedScopeStatus(scopeStatus)) return 99;
  return clampProgress(progress);
}

function isCompletedScopeStatus(status: string | undefined) {
  return status === "completed" || status === "complete" || status === "skipped" || status === "skipped_existing_result";
}

function isActiveJobStatus(status: string | undefined) {
  return status === "queued" || status === "running";
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function safeLedgerNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}
