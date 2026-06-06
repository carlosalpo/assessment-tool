import assert from "node:assert/strict";
import test from "node:test";
import { hashScopeInput } from "./ai-analysis-jobs.ts";
import {
  consolidateGapFindings,
  dataGapSubject,
  normalizeGapFindings
} from "./gap-consolidation.ts";

test("dataGapSubject classifies known data-gap subjects and ignores real findings", () => {
  assert.equal(dataGapSubject(finding({
    title: "Baja cobertura de vecinos CDP/LLDP",
    technical_rationale: "La recoleccion no tiene neighbor coverage suficiente."
  })), "neighbor_coverage");
  assert.equal(dataGapSubject(finding({
    title: "Faltan performance metrics historicas",
    technical_rationale: "Sin metricas de rendimiento ni historical performance data."
  })), "performance_metrics");
  assert.equal(dataGapSubject(finding({
    title: "Visibilidad faltante de monitoreo",
    technical_rationale: "Hay una brecha de monitoring para confirmar estado operacional."
  })), "monitoring_gap");
  assert.equal(dataGapSubject(finding({
    title: "Vecino autoreferenciado detectado",
    technical_rationale: "El parsing produjo un self-neighbor."
  })), "parsing_artifact");
  assert.equal(dataGapSubject(finding({
    title: "BGP instability between WAN peers",
    technical_rationale: "The BGP session flaps repeatedly with explicit evidence."
  })), null);
});

test("dataGapSubject avoids BankCo false positives for real findings", () => {
  assert.equal(dataGapSubject(finding({
    title: "Exposicion de estado de configuracion para servicios administrativos",
    technical_rationale: "El estado expone servicios administrativos y requiere control de seguridad."
  })), null);
  assert.equal(dataGapSubject(finding({
    title: "Inestabilidad en Los Vecinos de Enrutamiento",
    technical_rationale: "Los vecinos de routing presentan inestabilidad operacional observada."
  })), null);
});

test("dataGapSubject still detects genuine data collection gaps", () => {
  assert.equal(dataGapSubject(finding({
    title: "Critical Devices without Performance Metrics",
    technical_rationale: "Historical performance data was not collected for critical devices."
  })), "performance_metrics");
  assert.equal(dataGapSubject(finding({
    title: "Insufficient Neighbor Coverage",
    technical_rationale: "The collection has insufficient neighbor coverage for topology validation."
  })), "neighbor_coverage");
  assert.equal(dataGapSubject(finding({
    title: "Lack of LLDP Visibility for Neighbor Devices",
    technical_rationale: "LLDP neighbor data is missing from the evidence set."
  })), "neighbor_coverage");
});

test("dataGapSubject is deterministic for the same title and rationale", () => {
  const input = finding({
    title: "Critical Devices without Performance Metrics",
    technical_rationale: "Historical performance data was not collected for critical devices."
  });
  const results = Array.from({ length: 5 }, () => dataGapSubject(input));
  assert.deepEqual(results, ["performance_metrics", "performance_metrics", "performance_metrics", "performance_metrics", "performance_metrics"]);
});

test("normalizeGapFindings retags data gaps and leaves real and composite findings unchanged", () => {
  const gap = finding({
    finding_id: "gap_raw",
    title: "Equipo sin metricas de performance",
    finding_type: "probable_issue",
    severity: "high"
  });
  const real = finding({
    finding_id: "real_bgp",
    title: "BGP instability",
    technical_rationale: "BGP session resets repeatedly.",
    finding_type: "probable_issue",
    severity: "high"
  });
  const composite = finding({
    finding_id: "cross_1",
    scope: "cross_scope_correlation",
    title: "Cobertura de vecinos correlacionada",
    finding_type: "probable_issue",
    severity: "high"
  });

  const normalized = normalizeGapFindings([gap, real, composite]);
  assert.equal(normalized[0].finding_type, "visibility_gap");
  assert.equal(normalized[0].severity, "low");
  assert.equal(normalized[1], real);
  assert.equal(normalized[2], composite);
});

test("consolidateGapFindings collapses repeated data gaps by subject and keeps real findings", () => {
  const gaps = ["core-01", "core-02", "dist-01", "dist-02", "edge-01"].map((device) => finding({
    finding_id: `neighbor_${device}`,
    title: `${device} sin cobertura de vecinos`,
    technical_rationale: "Falta cobertura de vecinos CDP/LLDP en la recoleccion.",
    evidence_refs: [`ev_${device}`],
    related_devices: [device]
  }));
  const real = finding({
    finding_id: "real_ospf",
    title: "OSPF timer mismatch",
    technical_rationale: "OSPF timers differ between neighbors.",
    related_devices: ["core-01"]
  });

  const consolidated = consolidateGapFindings(normalizeGapFindings([...gaps, real]));
  assert.deepEqual(consolidated.map((item) => item.finding_id), ["real_ospf", "gap_topology_neighbor_coverage"]);
  assert.equal(consolidated[1].finding_type, "visibility_gap");
  assert.equal(consolidated[1].severity, "low");
  assert.equal(consolidated[1].remediation_category, "operational_change");
  assert.deepEqual(consolidated[1].related_devices, ["core-01", "core-02", "dist-01", "dist-02", "edge-01"]);
  assert.deepEqual(consolidated[1].evidence_refs, ["ev_core-01", "ev_core-02", "ev_dist-01", "ev_dist-02", "ev_edge-01"]);
});

test("consolidateGapFindings is stable for reordered gap findings", () => {
  const gaps = ["dist-02", "core-01", "edge-01"].map((device) => finding({
    finding_id: `perf_${device}`,
    title: `${device} sin metricas de rendimiento`,
    technical_rationale: "Sin metricas de rendimiento historicas.",
    evidence_refs: [`ev_${device}`],
    related_devices: [device]
  }));

  const first = consolidateGapFindings(normalizeGapFindings(gaps));
  const second = consolidateGapFindings(normalizeGapFindings([...gaps].reverse()));
  assert.deepEqual(first, second);
});

test("cross-scope composite findings are not consolidated or retagged", () => {
  const composite = finding({
    finding_id: "cross_gap",
    scope: "cross_scope_correlation",
    title: "Multiples equipos sin cobertura de vecinos",
    technical_rationale: "Cobertura de vecinos insuficiente correlacionada.",
    finding_type: "probable_issue",
    severity: "high",
    related_devices: ["core-01", "core-02"]
  });

  assert.deepEqual(consolidateGapFindings(normalizeGapFindings([composite])), [composite]);
});

test("configuration input hash includes gap consolidation only when enabled", () => {
  const previous = process.env.AI_GAP_CONSOLIDATION;
  try {
    process.env.AI_GAP_CONSOLIDATION = "";
    const offA = hashScopeInput(record(), "configuration");
    process.env.AI_GAP_CONSOLIDATION = "1";
    const on = hashScopeInput(record(), "configuration");
    process.env.AI_GAP_CONSOLIDATION = "";
    const offB = hashScopeInput(record(), "configuration");

    assert.equal(offA, offB);
    assert.notEqual(offA, on);
  } finally {
    process.env.AI_GAP_CONSOLIDATION = previous;
  }
});

function finding(overrides: Record<string, unknown>) {
  return {
    finding_id: "finding",
    scope: "topology",
    title: "Finding",
    finding_type: "probable_issue",
    severity: "medium",
    confidence: "medium",
    evidence_refs: [],
    related_fact_ids: [],
    related_metric_ids: [],
    related_correlation_ids: [],
    evidence: [],
    technical_rationale: "Rationale.",
    business_impact: "Impact.",
    recommendation: "Recommendation.",
    remediation_category: "pending_validation",
    remediation_steps: [],
    validation_questions: [],
    related_devices: [],
    related_sites: [],
    dependencies: [],
    ...overrides
  };
}

function record() {
  return {
    id: "assess_gap",
    client: { name: "Cliente" },
    assessment: { name: "Assessment" },
    scope: {},
    targetInventory: [{
      id: "device_core_01",
      hostname: "core-01",
      priority: "high",
      included: true
    }],
    evidenceFiles: [{
      id: "ev_cfg_core_01",
      name: "core-01-running-config.txt",
      type: "txt",
      deviceName: "core-01",
      command: "show running-config",
      content: "hostname core-01\n"
    }],
    parsed: { findings: [] }
  };
}
