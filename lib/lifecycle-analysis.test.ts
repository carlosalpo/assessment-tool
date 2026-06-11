import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLifecycleFindings,
  inferLifecycleEvaluation,
  type LifecycleEoxRecord,
  type LifecycleInputDevice
} from "./lifecycle-analysis.ts";
import { applyLifecycleNarration, lifecycleFindingsToScopeAnalysisFindings } from "./ai-analysis-jobs.ts";
import { isVacuousRemediation } from "./remediation-quality.ts";

const baseDevice = (patch: Partial<LifecycleInputDevice> = {}): LifecycleInputDevice => ({
  id: "dev_core01",
  hostname: "core-01",
  model: "C9500-48Y4C",
  softwareVersion: "17.9.4",
  role: "core",
  site: "Campus-HQ",
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
  assert.equal(findings[0].productId, "C9500-48Y4C");
  assert.equal(findings[0].model, "C9500-48Y4C");
  assert.equal(findings[0].site, "Campus-HQ");
  assert.equal(findings[0].deviceId, "dev_core01");
  assert.equal(findings[0].bulletinUrl, "https://www.cisco.com/example/eol0001");
  assert.match(findings[0].technical_rationale, /PID C9500-48Y4C/);
  assert.match(findings[0].technical_rationale, /End of Sale: 2021-01-31/);
  assert.match(findings[0].technical_rationale, /ultima fecha de soporte: 2025-01-31/);
  assert.match(findings[0].technical_rationale, /Campus-HQ/);
  assert.match(findings[0].recommendation, /PID C9500-48Y4C/);
  assert.doesNotMatch(findings[0].recommendation, /validar$/i);
  assert.ok(findings.every((finding) => !isVacuousRemediation(finding.recommendation)));
  assert.equal(findings[1].severity, "high");
  assert.equal(findings[2].severity, "critical");
  assert.equal(findings[2].source, "software");
  assert.equal(findings[2].remediationCategory, "new_technology");
  assert.match(findings[2].technical_rationale, /version de software 15\.2\(7\)E/);
  assert.match(findings[2].recommendation, /15\.2\(7\)E/);

  const repeated = buildLifecycleFindings({ devices: findings.map((finding) => baseDevice({ hostname: finding.device })) }, {});
  assert.deepEqual(repeated, []);
});

test("buildLifecycleFindings creates asset-aware hardware and software narratives", () => {
  const [hardwareFinding] = buildLifecycleFindings({ devices: [baseDevice()] }, {
    "C9500-48Y4C": eox()
  });
  assert.equal(hardwareFinding.productId, "C9500-48Y4C");
  assert.equal(hardwareFinding.bulletinNumber, "EOL0001");
  assert.match(hardwareFinding.technical_rationale, /C9500-48Y4C \(PID C9500-48Y4C\)/);
  assert.match(hardwareFinding.technical_rationale, /equipo core-01 \(id dev_core01\)/);
  assert.match(hardwareFinding.technical_rationale, /Ref\. Cisco: https:\/\/www\.cisco\.com\/example\/eol0001/);
  assert.ok(hardwareFinding.evidenceRefs.some((item) => item.includes("Lifecycle evidence") && item.includes("Last Date of Support 2024-01-31")));

  const [softwareFinding] = buildLifecycleFindings({ devices: [baseDevice({ softwareVersion: "17.3.1" })] }, {
    "17.3.1": eox({ productId: "17.3.1", endOfSaleDate: "2022-04-01", lastDateOfSupport: "2025-04-30" })
  });
  assert.equal(softwareFinding.source, "software");
  assert.equal(softwareFinding.softwareVersion, "17.3.1");
  assert.match(softwareFinding.technical_rationale, /version de software 17\.3\.1/);
  assert.match(softwareFinding.technical_rationale, /End of Sale: 2022-04-01/);
  assert.match(softwareFinding.technical_rationale, /ultima fecha de soporte: 2025-04-30/);
  assert.match(softwareFinding.recommendation, /version 17\.3\.1/);
  assert.doesNotMatch(softwareFinding.recommendation, /validar/i);
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
    productId: "MUTATED-PID",
    model: "MUTATED-MODEL",
    softwareVersion: "20.1",
    site: "Mutated-Site",
    deviceId: "mutated-device",
    bulletinUrl: "https://mutated.example",
    bulletinNumber: "MUTATED",
    technical_rationale: "Texto tecnico editado.",
    business_impact: "Impacto editado.",
    recommendation: "Recomendacion editada."
  }]);

  assert.equal(narrated.status, finding.status);
  assert.equal(narrated.severity, finding.severity);
  assert.equal(narrated.remediationCategory, finding.remediationCategory);
  assert.deepEqual(narrated.dates, finding.dates);
  assert.equal(narrated.productId, finding.productId);
  assert.equal(narrated.model, finding.model);
  assert.equal(narrated.softwareVersion, finding.softwareVersion);
  assert.equal(narrated.site, finding.site);
  assert.equal(narrated.deviceId, finding.deviceId);
  assert.equal(narrated.bulletinUrl, finding.bulletinUrl);
  assert.equal(narrated.bulletinNumber, finding.bulletinNumber);
  assert.match(narrated.technical_rationale, /^Texto tecnico editado\./);
  assert.match(narrated.technical_rationale, /Evidencia lifecycle:/);
  assert.match(narrated.technical_rationale, /version 15\.1\(2\)SY8/);
  assert.equal(narrated.business_impact, "Impacto editado.");
  assert.equal(narrated.recommendation, "Recomendacion editada.");
});

test("lifecycleFindingsToScopeAnalysisFindings emits enriched fields when enabled", () => {
  const [finding] = buildLifecycleFindings({ devices: [baseDevice()] }, {
    "C9500-48Y4C": eox()
  });

  withEnv({ AI_ENRICHED_FINDINGS: "1" }, () => {
    const [scopeFinding] = lifecycleFindingsToScopeAnalysisFindings([finding], { evidencePack: [] } as any) as any[];
    assert.equal(typeof scopeFinding.probable_cause, "string");
    assert.equal(typeof scopeFinding.technical_impact, "string");
    assert.equal(scopeFinding.probability_of_failure, "likely");
    assert.equal(scopeFinding.impact_if_fails, "severe");
    assert.deepEqual(scopeFinding.related_sites, ["Campus-HQ"]);
    assert.match(scopeFinding.evidence[0].excerpt, /PID C9500-48Y4C/);
    assert.match(scopeFinding.evidence[0].excerpt, /Last Date of Support 2024-01-31/);
  });
});

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
