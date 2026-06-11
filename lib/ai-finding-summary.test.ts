import assert from "node:assert/strict";
import test from "node:test";
import { filterFindingsByArea, findingAmbito, summarizeAreaFindings } from "./ai-finding-summary.ts";
import type { Finding } from "./types.ts";

test("summarizeAreaFindings returns zero counts for empty input", () => {
  const summary = summarizeAreaFindings([]);
  assert.equal(summary.total, 0);
  assert.deepEqual(summary.bySeverity, {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  });
  assert.deepEqual(summary.byFindingType, {});
  assert.equal(summary.pendingValidation, 0);
});

test("summarizeAreaFindings counts severity, finding type and pending validation", () => {
  const findings = [
    finding({ id: "critical-confirmed", risk: "critical", status: "ai_suggested", aiMetadata: { findingType: "confirmed_finding" } }),
    finding({ id: "high-probable", risk: "high", status: "accepted", aiMetadata: { findingType: "probable_issue" } }),
    finding({ id: "medium-no-type", risk: "medium", status: "edited", aiMetadata: {} }),
    finding({ id: "low-manual", risk: "low", status: "validated", aiMetadata: undefined }),
    finding({ id: "info-discarded", risk: "info", status: "discarded", aiMetadata: { findingType: "visibility_gap" } }),
    finding({ id: "high-draft", risk: "high", status: "ai-draft", aiMetadata: { findingType: "probable_issue" } })
  ];

  const summary = summarizeAreaFindings(findings);

  assert.equal(summary.total, 6);
  assert.deepEqual(summary.bySeverity, {
    critical: 1,
    high: 2,
    medium: 1,
    low: 1,
    info: 1
  });
  assert.deepEqual(summary.byFindingType, {
    confirmed_finding: 1,
    probable_issue: 2,
    sin_tipo: 2,
    visibility_gap: 1
  });
  assert.equal(summary.pendingValidation, 3);
});

test("findingAmbito prefers explicit scope over coarse category", () => {
  assert.equal(findingAmbito(finding({ id: "performance", scope: "performance", category: "operations" })), "performance");
  assert.equal(findingAmbito(finding({ id: "routing", scope: "routing", category: "operations" })), "topology");
  assert.equal(findingAmbito(finding({ id: "inventory", scope: "inventory", category: "operations" })), "lifecycle");
  assert.equal(findingAmbito(finding({ id: "evidence", scope: "evidence", category: "operations" })), "logs");
  assert.equal(findingAmbito(finding({ id: "reduce", scope: "cross_scope_correlation", category: "operations" })), "operations");
});

test("findingAmbito falls back to category when scope is missing", () => {
  assert.equal(findingAmbito(finding({ id: "performance-service", category: "operations", serviceOffer: "Performance Analysis" })), "performance");
  assert.equal(findingAmbito(finding({ id: "performance-domain", category: "operations", aiMetadata: { domain: "performance" } })), "performance");
  assert.equal(findingAmbito(finding({ id: "topology", category: "resiliency" })), "topology");
  assert.equal(findingAmbito(finding({ id: "security", category: "security" })), "security");
  assert.equal(findingAmbito(finding({ id: "configuration", category: "configuration" })), "configuration");
  assert.equal(findingAmbito(finding({ id: "lifecycle", category: "lifecycle" })), "lifecycle");
  assert.equal(findingAmbito(finding({ id: "inventory", category: "inventory" })), "lifecycle");
  assert.equal(findingAmbito(finding({ id: "operations", category: "operations" })), "operations");
});

test("filterFindingsByArea filters by canonical ambito", () => {
  const findings = [
    finding({ id: "configuration", scope: "configuration", category: "operations" }),
    finding({ id: "security", scope: "security", category: "operations" }),
    finding({ id: "logs", scope: "evidence", category: "operations" }),
    finding({ id: "lifecycle", scope: "lifecycle", category: "operations" }),
    finding({ id: "inventory", scope: "inventory", category: "operations" }),
    finding({ id: "topology", scope: "routing", category: "operations" }),
    finding({ id: "operations", scope: "operations", category: "operations" }),
    finding({ id: "performance", scope: "performance", category: "operations" }),
    finding({ id: "legacy-performance", category: "operations", serviceOffer: "Performance Analysis" }),
    finding({ id: "legacy-topology", category: "resiliency" })
  ];

  assert.deepEqual(filterFindingsByArea(findings, "configuration").map((item) => item.id), ["configuration"]);
  assert.deepEqual(filterFindingsByArea(findings, "security").map((item) => item.id), ["security"]);
  assert.deepEqual(filterFindingsByArea(findings, "logs").map((item) => item.id), ["logs"]);
  assert.deepEqual(filterFindingsByArea(findings, "lifecycle").map((item) => item.id), ["lifecycle", "inventory"]);
  assert.deepEqual(filterFindingsByArea(findings, "topology").map((item) => item.id), ["topology", "legacy-topology"]);
  assert.deepEqual(filterFindingsByArea(findings, "operations").map((item) => item.id), ["operations"]);
  assert.deepEqual(filterFindingsByArea(findings, "performance").map((item) => item.id), ["performance", "legacy-performance"]);
  assert.deepEqual(filterFindingsByArea(findings, null).map((item) => item.id), findings.map((item) => item.id));
});

function finding(patch: Partial<Finding> = {}): Finding {
  return {
    id: "finding",
    title: "Hallazgo",
    category: "operations",
    risk: "medium",
    confidence: 0.8,
    status: "ai_suggested",
    affectedAssets: ["core-01"],
    evidence: ["show command"],
    recommendation: "Validar",
    remediationCategory: "pending_validation",
    serviceOffer: "Assessment",
    architectNotes: "",
    aiMetadata: {
      findingType: "validation_required"
    },
    ...patch
  };
}
