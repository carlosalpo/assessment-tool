import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPerformanceAIContext,
  buildPerformanceAssessment,
  buildPerformanceCharts,
  classifyPerformanceEvidence,
  createDefaultPerformanceScope,
  generatePerformanceFindings,
  metricRecommendation,
  performanceFindingsToGenericFindings,
  processPerformanceEvidence,
  type PerformanceFinding,
  type PerformanceEvidenceFile
} from "./performance-analysis.ts";
import { isVacuousRemediation } from "./remediation-quality.ts";

function evidence(content: string): PerformanceEvidenceFile {
  const classification = classifyPerformanceEvidence("core-01-show-interfaces.log", content);
  return {
    id: "perf_ev_test",
    assessmentId: "assess_test",
    fileName: "core-01-show-interfaces.log",
    ...classification,
    uploadedBy: "test",
    uploadedAt: "2026-06-01T00:00:00.000Z",
    processingStatus: "pending",
    parsedMetricCount: 0,
    confidenceScore: 0,
    content
  };
}

test("classifyPerformanceEvidence detects CLI snapshot source", () => {
  const result = classifyPerformanceEvidence("core-01.log", "hostname core-01\nshow interfaces\nshow processes cpu sorted");

  assert.equal(result.sourceType, "cli_snapshot");
  assert.equal(result.timeWindow, "instant");
  assert.equal(result.deviceName, "core-01");
});

test("processPerformanceEvidence extracts metrics and keeps evidence traceability", () => {
  const input = evidence([
    "hostname core-01",
    "CPU utilization for five seconds: 91%",
    "Gi1/0/1 input errors 22 output errors 0 crc 4 drops 11 util 88%"
  ].join("\n"));

  const processed = processPerformanceEvidence("assess_test", [input], "snapshot");

  assert.equal(processed.files[0].processingStatus, "processed");
  assert.equal(processed.files[0].parsedMetricCount, processed.metrics.length);
  assert.ok(processed.metrics.some((metric) => metric.metricType === "cpu" && metric.value === 91));
  assert.ok(processed.metrics.some((metric) => metric.metricType === "crc_errors" && metric.evidenceFileId === input.id));
  assert.equal(processed.summary.detectedDevices, 1);
});

test("processPerformanceEvidence separates multiple devices in one CLI file", () => {
  const input = evidence([
    "hostname core-01",
    "CPU utilization for five seconds: 91%",
    "Gi1/0/1 input errors 22 output errors 0 crc 4 drops 11 util 88%",
    "hostname branch-01",
    "CPU utilization for five seconds: 63%",
    "Gi0/0 input errors 3 output errors 1 crc 0 drops 2 util 42%"
  ].join("\n"));

  const processed = processPerformanceEvidence("assess_test", [input], "snapshot");
  const deviceIds = new Set(processed.metrics.map((metric) => metric.deviceId));

  assert.equal(processed.summary.detectedDevices, 2);
  assert.equal(processed.files[0].deviceName, "2 dispositivos");
  assert.ok(deviceIds.has("core-01"));
  assert.ok(deviceIds.has("branch-01"));
  assert.ok(processed.metrics.some((metric) => metric.deviceId === "core-01" && metric.metricType === "cpu" && metric.value === 91));
  assert.ok(processed.metrics.some((metric) => metric.deviceId === "branch-01" && metric.metricType === "cpu" && metric.value === 63));
});

test("generatePerformanceFindings creates findings only from critical metrics with evidence", () => {
  const input = evidence("hostname core-01\nGi1/0/1 input errors 22 crc 4 drops 11 util 88%");
  const processed = processPerformanceEvidence("assess_test", [input], "snapshot");
  const findings = generatePerformanceFindings("assess_test", processed.metrics, processed.summary, "snapshot");

  assert.ok(findings.length > 0);
  assert.ok(findings.every((finding) => finding.evidence.length > 0));
  assert.ok(findings.every((finding) => finding.confidence > 0));
  assert.ok(findings.every((finding) => !isVacuousRemediation(finding.recommendation)));
});

test("metricRecommendation returns actionable root-cause actions for key metrics", () => {
  const crc = metricRecommendation("crc_errors");
  assert.doesNotMatch(crc, /^\s*validar\b/i);
  assert.match(crc, /transceiver|SFP/i);
  assert.match(crc, /conectores|patch|duplex|RMA/i);

  const utilization = metricRecommendation("utilization");
  assert.doesNotMatch(utilization, /^\s*validar\b/i);
  assert.match(utilization, /top talkers|aplicaciones/i);
  assert.match(utilization, /upgrade|agregacion|port-channel/i);

  const cpu = metricRecommendation("cpu");
  assert.doesNotMatch(cpu, /^\s*validar\b/i);
  assert.match(cpu, /show processes cpu sorted/i);
  assert.match(cpu, /CoPP|control-plane/i);

  const drops = metricRecommendation("queue_drops");
  assert.doesNotMatch(drops, /^\s*validar\b/i);
  assert.match(drops, /QoS|marcado|colas/i);
  assert.match(drops, /sobre-suscripcion|utilizacion/i);
});

test("generatePerformanceFindings uses category-specific root cause impact and companion metrics", () => {
  const input = evidence("hostname core-01\nGi1/0/1 input errors 22 crc 4 drops 11 util 88%");
  const processed = processPerformanceEvidence("assess_test", [input], "snapshot");
  const findings = generatePerformanceFindings("assess_test", processed.metrics, processed.summary, "snapshot");

  const errorFinding = findings.find((finding) => finding.performanceCategory === "errors");
  assert.ok(errorFinding);
  assert.match(errorFinding.probableCause, /capa fisica|transceiver|duplex/i);
  assert.match(errorFinding.impact, /perdida de paquetes|retransmisiones/i);
  assert.ok(errorFinding.evidence.some((item) => /Metricas companeras/.test(item)));
  assert.match(errorFinding.probableCause, /utilizacion del enlace/i);

  const saturationFinding = findings.find((finding) => finding.performanceCategory === "saturation");
  assert.ok(saturationFinding);
  assert.match(saturationFinding.probableCause, /capacidad insuficiente|patron de trafico/i);
  assert.match(saturationFinding.impact, /latencia|throughput|horas pico/i);
});

test("buildPerformanceAssessment flags missing historical evidence for hybrid mode", () => {
  const input = evidence("hostname core-01\nshow interfaces\nGi1/0/1 util 92%");
  const processed = processPerformanceEvidence("assess_test", [input], "hybrid");
  const assessment = buildPerformanceAssessment("assess_test", "hybrid", processed.files, processed.metrics);

  assert.equal(assessment.analysisMode, "hybrid");
  assert.ok(assessment.visibilityGaps.some((gap) => gap.toLowerCase().includes("historico")));
  assert.ok(assessment.limitations.length > 0);
});

test("buildPerformanceAIContext exposes only supplied evidence and metrics", () => {
  const input = evidence("hostname core-01\nGi1/0/1 util 92%");
  const processed = processPerformanceEvidence("assess_test", [input], "snapshot");
  const assessment = buildPerformanceAssessment("assess_test", "snapshot", processed.files, processed.metrics);
  const findings = generatePerformanceFindings("assess_test", processed.metrics, processed.summary, "snapshot");
  const charts = buildPerformanceCharts("assess_test", processed.metrics);
  const context = buildPerformanceAIContext({
    assessmentId: "assess_test",
    scope: { ...createDefaultPerformanceScope(), enabled: true },
    evidenceFiles: processed.files,
    metrics: processed.metrics,
    assessment,
    findings,
    charts
  });

  assert.match(context.instruction, /No inventes datos/);
  assert.equal(context.evidence.length, 1);
  assert.equal(context.criticalMetrics.length, processed.metrics.filter((metric) => metric.value >= 80).length);
});

test("performanceFindingsToGenericFindings drops findings without evidence", () => {
  const incompleteFinding: PerformanceFinding = {
    id: "PF-NOEVIDENCE",
    assessmentId: "assess_test",
    title: "AI finding without evidence",
    domain: "operations",
    affectedDeviceIds: [],
    affectedInterfaceIds: [],
    severity: "medium",
    performanceCategory: "visibility_gap",
    metricRefs: [],
    evidence: [],
    impact: "No debe publicarse.",
    probableCause: "Sin evidencia.",
    recommendation: "Validar evidencia antes de publicar.",
    remediationCategory: "pending_validation",
    confidence: 0.7,
    aiGenerated: true,
    status: "ai_suggested",
    relatedRiskDimensions: ["performance_capacity"]
  };

  assert.deepEqual(performanceFindingsToGenericFindings([incompleteFinding]), []);
  const [genericFinding] = performanceFindingsToGenericFindings([{ ...incompleteFinding, id: "PF-WITH-EVIDENCE", evidence: ["show interface"], confidence: 0.7 }]);
  assert.equal(genericFinding.scope, "performance");
  assert.equal(genericFinding.category, "operations");
});

test("performanceFindingsToGenericFindings emits enriched fields when enabled", () => {
  const finding: PerformanceFinding = {
    id: "PF-ENRICHED",
    assessmentId: "assess_test",
    title: "CRC alto en uplink",
    domain: "enterprise_lan_wan",
    affectedDeviceIds: ["core-01"],
    affectedInterfaceIds: ["Gi1/0/1"],
    severity: "high",
    performanceCategory: "errors",
    metricRefs: ["pm_crc"],
    evidence: ["show interfaces: crc_errors 22count"],
    impact: "Puede provocar perdida de paquetes y retransmisiones.",
    probableCause: "Degradacion probable de capa fisica: transceiver o cableado.",
    recommendation: metricRecommendation("crc_errors"),
    remediationCategory: "operational_change",
    confidence: 0.8,
    aiGenerated: false,
    status: "draft",
    relatedRiskDimensions: ["performance_capacity", "resilience_availability"]
  };

  withEnv({ AI_ENRICHED_FINDINGS: undefined }, () => {
    const [plain] = performanceFindingsToGenericFindings([finding]) as any[];
    assert.equal(plain.probable_cause, undefined);
    assert.equal(plain.technical_impact, undefined);
    assert.equal(plain.probability_of_failure, undefined);
    assert.equal(plain.impact_if_fails, undefined);
  });

  withEnv({ AI_ENRICHED_FINDINGS: "1" }, () => {
    const [enriched] = performanceFindingsToGenericFindings([finding]) as any[];
    assert.equal(enriched.probable_cause, finding.probableCause);
    assert.equal(enriched.technical_impact, finding.impact);
    assert.equal(enriched.probability_of_failure, "likely");
    assert.equal(enriched.impact_if_fails, "significant");
    assert.equal(enriched.probabilityOfFailure, "likely");
    assert.equal(enriched.impactIfFails, "significant");
    assert.equal(enriched.aiMetadata.probableCause, finding.probableCause);
    assert.equal(enriched.aiMetadata.technicalImpact, finding.impact);
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
