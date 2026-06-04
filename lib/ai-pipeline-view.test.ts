import assert from "node:assert/strict";
import test from "node:test";
import { buildPipelineView, type PipelineAnalysisStatus, type PipelineJobStatus } from "./ai-pipeline-view.ts";
import { aiScopeDisplayOrder, flagForStage } from "./ai-scope-ui.ts";

const mapScopeIds = aiScopeDisplayOrder.filter((scope) => !flagForStage(scope.id)).map((scope) => scope.id);

test("buildPipelineView counts completed map scopes", () => {
  const completedScopes = new Set(mapScopeIds.slice(0, 5));
  const view = buildPipelineView({
    scopes: mapScopeIds.map((id) => ({ id, status: completedScopes.has(id) ? "completed" : "pending" }))
  });
  const map = view.find((stage) => stage.stage === "map");

  assert.equal(map?.completed, 5);
  assert.equal(map?.total, mapScopeIds.length);
  assert.equal(map?.status, "partially_completed");
});

test("buildPipelineView marks reduce completed from cross-scope result status", () => {
  const view = buildPipelineView({
    scopes: [{ id: "cross_scope_correlation", status: "completed" }]
  });
  const reduce = view.find((stage) => stage.stage === "reduce");

  assert.equal(reduce?.completed, 1);
  assert.equal(reduce?.total, 1);
  assert.equal(reduce?.status, "completed");
});

test("buildPipelineView completes synthesize only when roadmap and executive summary are completed", () => {
  const partial = buildPipelineView({
    scopes: [
      { id: "roadmap", status: "completed" },
      { id: "executive_summary", status: "pending" }
    ]
  });
  const completed = buildPipelineView({
    scopes: [
      { id: "roadmap", status: "completed" },
      { id: "executive_summary", status: "completed" }
    ]
  });

  assert.equal(partial.find((stage) => stage.stage === "synthesize")?.status, "partially_completed");
  assert.equal(completed.find((stage) => stage.stage === "synthesize")?.status, "completed");
});

test("buildPipelineView derives active stage from latest job currentPhase", () => {
  assert.equal(activeStage(job("security:scope_analysis")), "map");
  assert.equal(activeStage(job("cross_scope_correlation:reduce")), "reduce");
  assert.equal(activeStage(job("executive_summary:synthesis")), "synthesize");
});

function activeStage(latestJob: PipelineJobStatus) {
  return buildPipelineView(emptyStatus(), latestJob).find((stage) => stage.active)?.stage;
}

function emptyStatus(): PipelineAnalysisStatus {
  return { scopes: [] };
}

function job(currentPhase: string): PipelineJobStatus {
  return {
    status: "running",
    currentPhase,
    steps: []
  };
}
