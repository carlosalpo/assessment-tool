import { aiScopeDisplayOrder, flagForStage, type AIScopeOrStageDisplayId } from "./ai-scope-ui.ts";

export type PipelineStageId = "map" | "reduce" | "synthesize";

export type PipelineViewStage = {
  stage: PipelineStageId;
  label: string;
  status: string;
  completed: number;
  total: number;
  active: boolean;
};

export type PipelineScopeStatus = {
  id: string;
  status: string;
};

export type PipelineStepStatus = {
  scopeId: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type PipelineJobStatus = {
  status: string;
  currentPhase: string | null;
  steps: PipelineStepStatus[];
};

export type PipelineAnalysisStatus = {
  scopes: PipelineScopeStatus[];
  jobs?: PipelineJobStatus[];
};

const mapScopeIds = aiScopeDisplayOrder.filter((scope) => !flagForStage(scope.id)).map((scope) => scope.id);
const synthesisScopeIds: AIScopeOrStageDisplayId[] = ["roadmap", "executive_summary"];
const completedStatuses = new Set(["completed", "complete", "skipped", "skipped_existing_result"]);
const failedStatuses = new Set(["failed", "blocked", "error", "timeout"]);

export function buildPipelineView(aiAnalysisStatus?: PipelineAnalysisStatus, latestJob?: PipelineJobStatus | null): PipelineViewStage[] {
  const activeStage = activePipelineStage(latestJob);
  const mapStatuses = mapScopeIds.map((scopeId) => statusForPipelineScope(scopeId, aiAnalysisStatus, latestJob));
  const mapCompleted = mapStatuses.filter(isCompletedStatus).length;
  const reduceStatus = statusForPipelineScope("cross_scope_correlation", aiAnalysisStatus, latestJob);
  const synthesisStatuses = synthesisScopeIds.map((scopeId) => statusForPipelineScope(scopeId, aiAnalysisStatus, latestJob));
  const synthesisCompleted = synthesisStatuses.filter(isCompletedStatus).length;

  return [
    {
      stage: "map",
      label: "Map",
      status: aggregateStageStatus(mapStatuses, activeStage === "map", mapCompleted, mapScopeIds.length),
      completed: mapCompleted,
      total: mapScopeIds.length,
      active: activeStage === "map"
    },
    {
      stage: "reduce",
      label: "Reduce",
      status: aggregateStageStatus([reduceStatus], activeStage === "reduce", isCompletedStatus(reduceStatus) ? 1 : 0, 1),
      completed: isCompletedStatus(reduceStatus) ? 1 : 0,
      total: 1,
      active: activeStage === "reduce"
    },
    {
      stage: "synthesize",
      label: "Synthesize",
      status: aggregateStageStatus(synthesisStatuses, activeStage === "synthesize", synthesisCompleted, synthesisScopeIds.length),
      completed: synthesisCompleted,
      total: synthesisScopeIds.length,
      active: activeStage === "synthesize"
    }
  ];
}

function activePipelineStage(latestJob?: PipelineJobStatus | null): PipelineStageId | null {
  if (!latestJob?.currentPhase || !isActiveJobStatus(latestJob.status)) return null;
  const scopeId = latestJob.currentPhase.split(":")[0] as AIScopeOrStageDisplayId | undefined;
  if (scopeId === "cross_scope_correlation") return "reduce";
  if (scopeId === "roadmap" || scopeId === "executive_summary") return "synthesize";
  return scopeId ? "map" : null;
}

function statusForPipelineScope(scopeId: AIScopeOrStageDisplayId, aiAnalysisStatus?: PipelineAnalysisStatus, latestJob?: PipelineJobStatus | null) {
  if (latestJob?.currentPhase?.startsWith(`${scopeId}:`) && isActiveJobStatus(latestJob.status)) return "running";
  const scopeStatus = aiAnalysisStatus?.scopes.find((scope) => scope.id === scopeId);
  if (scopeStatus?.status) return scopeStatus.status;
  const latestStep = (aiAnalysisStatus?.jobs ?? [])
    .flatMap((job) => job.steps)
    .filter((step) => step.scopeId === scopeId)
    .sort((left, right) => String(right.completedAt ?? right.startedAt ?? "").localeCompare(String(left.completedAt ?? left.startedAt ?? "")))[0];
  return latestStep?.status ?? "pending";
}

function aggregateStageStatus(statuses: string[], active: boolean, completed: number, total: number) {
  if (active) return "running";
  if (total > 0 && completed === total) return "completed";
  if (statuses.some((status) => failedStatuses.has(status))) return "failed";
  if (statuses.some((status) => status === "cancelled")) return "cancelled";
  if (statuses.some((status) => status === "running")) return "running";
  if (statuses.some((status) => status === "queued")) return "queued";
  if (completed > 0) return "partially_completed";
  return "pending";
}

function isCompletedStatus(status: string) {
  return completedStatuses.has(status);
}

function isActiveJobStatus(status: string) {
  return status === "queued" || status === "running";
}
