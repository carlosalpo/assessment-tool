import assert from "node:assert/strict";
import test from "node:test";
import {
  aiScopeDisplayOrder,
  crossScopeCorrelationDisplay,
  flagForStage,
  scopeProgressFromStatus,
  type AIScopeDisplayGroup,
  type AIScopeOrStageDisplayId
} from "./ai-scope-ui.ts";

const expectedScopeOrder = [
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

const expectedGroups = new Set<AIScopeDisplayGroup>(["Fundamentos", "Riesgo", "Dominios", "Operación", "Síntesis"]);
const expectedGroupByScope: Record<string, AIScopeDisplayGroup> = {
  topology: "Fundamentos",
  configuration: "Fundamentos",
  security: "Riesgo",
  lifecycle: "Riesgo",
  operations: "Operación",
  evidence: "Fundamentos",
  inventory: "Fundamentos",
  routing: "Dominios",
  wan: "Dominios",
  datacenter: "Dominios",
  campus: "Dominios",
  perimeter: "Dominios",
  performance: "Riesgo",
  high_availability: "Riesgo",
  roadmap: "Síntesis",
  executive_summary: "Síntesis"
};

test("aiScopeDisplayOrder covers the 16 backend full-evaluation scopes in display order", () => {
  assert.deepEqual(aiScopeDisplayOrder.map((scope) => scope.id), expectedScopeOrder);
  assert.equal(new Set(aiScopeDisplayOrder.map((scope) => scope.id)).size, 16);
  for (const scope of aiScopeDisplayOrder) {
    assert.ok(scope.label.length > 0);
    assert.ok(expectedGroups.has(scope.group));
    assert.equal(scope.group, expectedGroupByScope[scope.id]);
  }
});

test("flagForStage marks only reduce and synthesis stages", () => {
  const stageIds: AIScopeOrStageDisplayId[] = [...expectedScopeOrder, crossScopeCorrelationDisplay.id] as AIScopeOrStageDisplayId[];
  for (const scopeId of stageIds) {
    const flag = flagForStage(scopeId);
    if (scopeId === "cross_scope_correlation") {
      assert.equal(flag, "AI_REDUCE_STAGE");
    } else if (scopeId === "roadmap" || scopeId === "executive_summary") {
      assert.equal(flag, "AI_SYNTHESIS_STAGE");
    } else {
      assert.equal(flag, null);
    }
  }
});

test("scopeProgressFromStatus returns 0 for pending scopes without activity", () => {
  assert.equal(scopeProgressFromStatus("security", { scopes: [{ id: "security", status: "pending" }], jobs: [] }), 0);
});

test("scopeProgressFromStatus is proportional to completed scope phases", () => {
  const steps = [
    { scopeId: "security", phaseName: "context_preparation", status: "completed" },
    { scopeId: "security", phaseName: "evidence_extraction", status: "completed" },
    { scopeId: "security", phaseName: "normalization", status: "pending" },
    { scopeId: "security", phaseName: "scope_analysis", status: "pending" }
  ];

  assert.equal(scopeProgressFromStatus("security", { jobs: [{ steps }] }), 50);
});

test("scopeProgressFromStatus returns 100 for completed and skipped scopes", () => {
  assert.equal(scopeProgressFromStatus("topology", { scopes: [{ id: "topology", status: "completed" }] }), 100);
  assert.equal(scopeProgressFromStatus("topology", { scopes: [{ id: "topology", status: "skipped_existing_result" }] }), 100);
});

test("scopeProgressFromStatus reflects the active current phase", () => {
  const steps = [
    { scopeId: "operations", phaseName: "context_preparation", status: "completed" },
    { scopeId: "operations", phaseName: "evidence_extraction", status: "running", progress: 40 },
    { scopeId: "operations", phaseName: "normalization", status: "pending" },
    { scopeId: "operations", phaseName: "scope_analysis", status: "pending" }
  ];

  const progress = scopeProgressFromStatus(
    "operations",
    { scopes: [{ id: "operations", status: "running" }], jobs: [{ steps }] },
    { status: "running", currentPhase: "operations:evidence_extraction", steps }
  );

  assert.equal(progress, 35);
});
