import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLifecycleFindings,
  inferLifecycleEvaluation,
  type LifecycleEoxRecord,
  type LifecycleInputDevice
} from "./lifecycle-analysis.ts";
import { applyLifecycleNarration } from "./ai-analysis-jobs.ts";

const baseDevice = (patch: Partial<LifecycleInputDevice> = {}): LifecycleInputDevice => ({
  id: "dev_core01",
  hostname: "core-01",
  model: "C9500-48Y4C",
  softwareVersion: "17.9.4",
  role: "core",
  criticality: "critical",
  evidenceRefs: ["core-01.log"],
  inventoryItems: [],
  ...patch
});

const eox = (patch: Partial<LifecycleEoxRecord> = {}): LifecycleEoxRecord => ({
  productId: "C9500-48Y4C",
  endOfSaleDate: "2021-01-31",
  lastDateOfSupport: "2024-01-31",
  bulletinNumber: "EOL0001",
  bulletinUrl: "https://www.cisco.com/example/eol0001",
  ...patch
});

test("inferLifecycleEvaluation detects software EoX and exposes software source", () => {
  const evaluation = inferLifecycleEvaluation(baseDevice({ softwareVersion: "17.3.1" }), {
    "17.3.1": eox({ productId: "17.3.1", lastDateOfSupport: "2025-01-31" })
  });

  assert.equal(evaluation.status, "end_of_support");
  assert.equal(evaluation.source, "software");
  assert.equal(evaluation.software.status, "end_of_support");
});

test("inferLifecycleEvaluation detects hardware EoX and lets the worst HW/SW status win", () => {
  const hardwareOnly = inferLifecycleEvaluation(baseDevice(), {
    "C9500-48Y4C": eox()
  });
  assert.equal(hardwareOnly.status, "end_of_support");
  assert.equal(hardwareOnly.source, "hardware");

  const softwareWorse = inferLifecycleEvaluation(baseDevice({ softwareVersion: "15.2(4)E" }), {
    "C9500-48Y4C": eox({ endOfSaleDate: "2021-01-31", lastDateOfSupport: undefined })
  });
  assert.equal(softwareWorse.status, "obsolete");
  assert.equal(softwareWorse.source, "software");
});

test("buildLifecycleFindings produces deterministic severity and remediation categories", () => {
  const findings = buildLifecycleFindings({
    devices: [
      baseDevice({ hostname: "core-01", model: "C9500-48Y4C", softwareVersion: "17.9.4" }),
      baseDevice({ hostname: "dist-01", model: "C9300-48P", softwareVersion: "17.12.1" }),
      baseDevice({ hostname: "legacy-01", model: "C2960X", softwareVersion: "15.2(7)E" })
    ]
  }, {
    "C9500-48Y4C": eox({ lastDateOfSupport: "2025-01-31" }),
    "C9300-48P": eox({ endOfSaleDate: "2021-01-31", lastDateOfSupport: "2030-01-31" })
  });

  assert.deepEqual(findings.map((finding) => finding.device), ["core-01", "dist-01", "legacy-01"]);
  assert.equal(findings[0].severity, "critical");
  assert.equal(findings[0].remediationCategory, "platform_upgrade");
  assert.match(findings[0].technical_rationale, /criticidad critical \(rol core\)/);
  assert.equal(findings[1].severity, "high");
  assert.equal(findings[2].severity, "critical");
  assert.equal(findings[2].source, "software");
  assert.equal(findings[2].remediationCategory, "new_technology");

  const repeated = buildLifecycleFindings({ devices: findings.map((finding) => baseDevice({ hostname: finding.device })) }, {});
  assert.deepEqual(repeated, []);
});

test("buildLifecycleFindings skips devices without EoX or obsolete software signal", () => {
  const findings = buildLifecycleFindings({ devices: [baseDevice({ model: "C9300-48P", softwareVersion: "17.12.1" })] }, {});
  assert.deepEqual(findings, []);
});

test("buildLifecycleFindings escalates severity by device criticality without degrading base risk", () => {
  const findings = buildLifecycleFindings({
    devices: [
      baseDevice({ hostname: "access-low", criticality: "low", role: "access", model: "C9300-48P" }),
      baseDevice({ hostname: "access-high", criticality: "high", role: "access", model: "C9300-48P" }),
      baseDevice({ hostname: "core-critical", criticality: "critical", role: "core", model: "C9300-48P" }),
      baseDevice({ hostname: "dist-medium", criticality: "medium", role: "distribution", model: "C9500-48Y4C" }),
      baseDevice({ hostname: "dc-critical", criticality: "critical", role: "datacenter", model: "C9500-48Y4C" })
    ]
  }, {
    "C9300-48P": eox({ productId: "C9300-48P", endOfSaleDate: "2021-01-31", lastDateOfSupport: "2030-01-31" }),
    "C9500-48Y4C": eox({ productId: "C9500-48Y4C", lastDateOfSupport: "2025-01-31" })
  });

  const severityByDevice = Object.fromEntries(findings.map((finding) => [finding.device, finding.severity]));
  assert.equal(severityByDevice["access-low"], "medium");
  assert.equal(severityByDevice["access-high"], "high");
  assert.equal(severityByDevice["core-critical"], "high");
  assert.equal(severityByDevice["dist-medium"], "high");
  assert.equal(severityByDevice["dc-critical"], "critical");
});

test("applyLifecycleNarration only updates narrative fields", () => {
  const [finding] = buildLifecycleFindings({ devices: [baseDevice({ softwareVersion: "15.1(2)SY8" })] }, {});
  const [narrated] = applyLifecycleNarration([finding], [{
    finding_id: finding.id,
    severity: "low",
    status: "active",
    technical_rationale: "Texto tecnico editado.",
    business_impact: "Impacto editado.",
    recommendation: "Recomendacion editada."
  }]);

  assert.equal(narrated.status, finding.status);
  assert.equal(narrated.severity, finding.severity);
  assert.equal(narrated.remediationCategory, finding.remediationCategory);
  assert.equal(narrated.technical_rationale, "Texto tecnico editado.");
  assert.equal(narrated.business_impact, "Impacto editado.");
  assert.equal(narrated.recommendation, "Recomendacion editada.");
});
