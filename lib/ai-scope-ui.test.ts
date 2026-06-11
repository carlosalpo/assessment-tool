import assert from "node:assert/strict";
import test from "node:test";
import {
  activeAmbitoMemberScopes,
  aiScopeDisplayOrder,
  ambitoCoverageLedger,
  ambitoMemberScopes,
  ambitoOrder,
  crossScopeCorrelationDisplay,
  flagForStage,
  isCoverageComplete,
  scopeToAmbito,
  scopeProgressFromStatus,
  type AIScopeDisplayGroup,
  type AIScopeOrStageDisplayId
} from "./ai-scope-ui.ts";
import { fullAssessmentScopeOrder } from "./ai-analysis-jobs.ts";

const expectedScopeOrder = [
  "configuration",
  "security",
  "evidence",
  "lifecycle",
  "inventory",
  "topology",
  "routing",
  "wan",
  "datacenter",
  "campus",
  "perimeter",
  "high_availability",
  "operations",
  "performance",
  "roadmap",
  "executive_summary"
];

const expectedFindingScopeOrder = expectedScopeOrder.filter((scope) => scope !== "roadmap" && scope !== "executive_summary");
const expectedAmbitoOrder = ["configuration", "security", "logs", "lifecycle", "topology", "operations", "performance"];
const expectedGroups = new Set<AIScopeDisplayGroup>(["Configuraciones", "Seguridad", "Logs y Eventos", "Vigencia tecnológica", "Topología", "Operaciones", "Performance", "Síntesis"]);
const expectedGroupByScope: Record<string, AIScopeDisplayGroup> = {
  configuration: "Configuraciones",
  security: "Seguridad",
  evidence: "Logs y Eventos",
  lifecycle: "Vigencia tecnológica",
  inventory: "Vigencia tecnológica",
  topology: "Topología",
  routing: "Topología",
  wan: "Topología",
  datacenter: "Topología",
  campus: "Topología",
  perimeter: "Topología",
  high_availability: "Topología",
  operations: "Operaciones",
  performance: "Performance",
  roadmap: "Síntesis",
  executive_summary: "Síntesis"
};

test("ambitoOrder defines the canonical seven ambitos", () => {
  assert.deepEqual(ambitoOrder, expectedAmbitoOrder);
});

test("ambitoMemberScopes covers every finding scope exactly once", () => {
  const scopes = Object.values(ambitoMemberScopes).flat();
  assert.deepEqual(scopes.sort(), [...expectedFindingScopeOrder].sort());
  assert.equal(new Set(scopes).size, 14);
});

test("activeAmbitoMemberScopes folds topology members only when topology playbook is enabled", () => {
  assert.deepEqual(activeAmbitoMemberScopes("topology", { topologyPlaybookEnabled: true }), ["topology"]);
  assert.deepEqual(activeAmbitoMemberScopes("topology", { topologyPlaybookEnabled: false }), ambitoMemberScopes.topology);
  assert.deepEqual(activeAmbitoMemberScopes("topology"), ambitoMemberScopes.topology);
  assert.deepEqual(activeAmbitoMemberScopes("lifecycle", { topologyPlaybookEnabled: true }), ambitoMemberScopes.lifecycle);
});

test("scopeToAmbito returns the inverse ambito mapping and excludes synthesis", () => {
  assert.equal(scopeToAmbito("routing"), "topology");
  assert.equal(scopeToAmbito("inventory"), "lifecycle");
  assert.equal(scopeToAmbito("evidence"), "logs");
  assert.equal(scopeToAmbito("performance"), "performance");
  assert.equal(scopeToAmbito("cross_scope_correlation"), null);
  assert.equal(scopeToAmbito("roadmap"), null);
  assert.equal(scopeToAmbito("executive_summary"), null);
});

test("ambitoCoverageLedger collects and merges ledgers from member scopes", () => {
  const ledger = ambitoCoverageLedger("configuration", [
    {
      id: "configuration",
      coverageLedger: [
        { deviceHostname: "core-01", applicable: 4, withFinding: 1, gap: 1, clean: 2, notEvaluated: 0 },
        { deviceHostname: "edge-01", applicable: 3, withFinding: 0, gap: 1, clean: 1, notEvaluated: 1 }
      ]
    },
    {
      id: "configuration",
      coverageLedger: [
        { deviceHostname: "core-01", applicable: 2, withFinding: 0, gap: 0, clean: 1, notEvaluated: 1 }
      ]
    },
    {
      id: "security",
      coverageLedger: [
        { deviceHostname: "core-01", applicable: 9, withFinding: 9, gap: 0, clean: 0, notEvaluated: 0 }
      ]
    }
  ]);

  assert.deepEqual(ledger.sort((left, right) => left.deviceHostname.localeCompare(right.deviceHostname)), [
    { deviceHostname: "core-01", applicable: 6, withFinding: 1, gap: 1, clean: 3, notEvaluated: 1 },
    { deviceHostname: "edge-01", applicable: 3, withFinding: 0, gap: 1, clean: 1, notEvaluated: 1 }
  ]);
  assert.deepEqual(ambitoCoverageLedger("topology", [{ id: "configuration", coverageLedger: ledger }]), []);
});

test("isCoverageComplete requires at least one entry and zero not evaluated criteria", () => {
  assert.equal(isCoverageComplete([]), false);
  assert.equal(isCoverageComplete([
    { deviceHostname: "core-01", applicable: 4, withFinding: 1, gap: 1, clean: 2, notEvaluated: 0 },
    { deviceHostname: "edge-01", applicable: 3, withFinding: 0, gap: 0, clean: 3, notEvaluated: 0 }
  ]), true);
  assert.equal(isCoverageComplete([
    { deviceHostname: "core-01", applicable: 4, withFinding: 1, gap: 1, clean: 1, notEvaluated: 1 }
  ]), false);
});

test("aiScopeDisplayOrder covers finding scopes and optional synthesis stages in display order", () => {
  assert.deepEqual(aiScopeDisplayOrder.map((scope) => scope.id), expectedScopeOrder);
  assert.equal(new Set(aiScopeDisplayOrder.map((scope) => scope.id)).size, 16);
  for (const scope of aiScopeDisplayOrder) {
    assert.ok(scope.label.length > 0);
    assert.ok(expectedGroups.has(scope.group));
    assert.equal(scope.group, expectedGroupByScope[scope.id]);
  }
});

test("aiScopeDisplayOrder stays synchronized with fullAssessmentScopeOrder for finding scopes", () => {
  assert.deepEqual(expectedFindingScopeOrder, fullAssessmentScopeOrder);
  assert.deepEqual(
    aiScopeDisplayOrder.filter((scope) => !flagForStage(scope.id)).map((scope) => scope.id),
    fullAssessmentScopeOrder
  );
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

test("scopeProgressFromStatus lets active job progress override stale completed result", () => {
  const steps = [
    { scopeId: "configuration", phaseName: "context_preparation", status: "completed" },
    { scopeId: "configuration", phaseName: "evidence_extraction", status: "completed" },
    { scopeId: "configuration", phaseName: "normalization", status: "completed" },
    { scopeId: "configuration", phaseName: "scope_analysis", status: "running", progress: 55 },
    { scopeId: "configuration", phaseName: "validation", status: "pending" },
    { scopeId: "configuration", phaseName: "scope_synthesis", status: "pending" }
  ];

  const progress = scopeProgressFromStatus(
    "configuration",
    { scopes: [{ id: "configuration", status: "completed" }], jobs: [{ steps }] },
    { status: "running", currentPhase: "configuration:scope_analysis", steps }
  );

  assert.equal(progress, 59);
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
