import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPerformanceAIContext,
  buildPerformanceAssessment,
  buildPerformanceCharts,
  classifyPerformanceEvidence,
  createDefaultPerformanceScope,
  generatePerformanceFindings,
  performanceFindingsToGenericFindings,
  processPerformanceEvidence,
  type PerformanceFinding,
  type PerformanceEvidenceFile
} from "./performance-analysis.ts";

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

test("generatePerformanceFindings creates findings only from critical metrics with evidence", () => {
  const input = evidence("hostname core-01\nGi1/0/1 input errors 22 crc 4 drops 11 util 88%");
  const processed = processPerformanceEvidence("assess_test", [input], "snapshot");
  const findings = generatePerformanceFindings("assess_test", processed.metrics, processed.summary, "snapshot");

  assert.ok(findings.length > 0);
  assert.ok(findings.every((finding) => finding.evidence.length > 0));
  assert.ok(findings.every((finding) => finding.confidence > 0));
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
    remediationType: "validation_required",
    confidence: 0.7,
    aiGenerated: true,
    status: "ai_suggested",
    relatedRiskDimensions: ["performance_capacity"]
  };

  assert.deepEqual(performanceFindingsToGenericFindings([incompleteFinding]), []);
});
