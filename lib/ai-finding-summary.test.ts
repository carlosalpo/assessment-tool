import assert from "node:assert/strict";
import test from "node:test";
import { filterFindingsByArea, summarizeAreaFindings } from "./ai-finding-summary.ts";
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

test("filterFindingsByArea filters by mapped assessment area category", () => {
  const findings = [
    finding({ id: "topology", category: "resiliency" }),
    finding({ id: "security", category: "security" }),
    finding({ id: "operations", category: "operations" }),
    finding({ id: "configuration", category: "configuration" })
  ];

  assert.deepEqual(filterFindingsByArea(findings, "topology").map((item) => item.id), ["topology"]);
  assert.deepEqual(filterFindingsByArea(findings, "logs").map((item) => item.id), ["operations"]);
  assert.deepEqual(filterFindingsByArea(findings, "lifecycle").map((item) => item.id), []);
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
    remediationType: "pending-validation",
    serviceOffer: "Assessment",
    architectNotes: "",
    aiMetadata: {
      findingType: "validation_required"
    },
    ...patch
  };
}
