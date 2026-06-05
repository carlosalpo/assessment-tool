import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPerformanceAssessment,
  classifyPerformanceEvidence,
  processPerformanceEvidence,
  type PerformanceEvidenceFile,
  type PerformanceFinding
} from "./performance-analysis.ts";
import {
  applyPerformanceFilters,
  buildCategoryBreakdownData,
  buildDataCoverageWidget,
  buildDeviceResourceChart,
  buildErrorsAndDropsChart,
  buildExecutivePerformanceViewData,
  buildKpiRingData,
  buildPerformanceDashboardData,
  buildPerformanceHeatmap,
  buildProcessingFunnelData,
  buildSeverityDistributionData,
  buildSourceDistributionData,
  buildTechnicalPerformanceViewData,
  buildTopPrioritiesData,
  buildTopUtilizationChart
} from "./performance-visualization-service.ts";

function evidence(content: string, fileName = "core-01-show-interfaces.log"): PerformanceEvidenceFile {
  const classification = classifyPerformanceEvidence(fileName, content);
  return {
    id: `perf_${fileName}`,
    assessmentId: "assess_perf",
    fileName,
    ...classification,
    uploadedBy: "test",
    uploadedAt: "2026-06-01T00:00:00.000Z",
    processingStatus: "pending",
    parsedMetricCount: 0,
    confidenceScore: 0,
    content
  };
}

function processedPerformance() {
  const files = [
    evidence([
      "hostname core-01",
      "GigabitEthernet1/0/1 is up, line protocol is up",
      "  Description: uplink to distribution",
      "  MTU 1500 bytes, BW 1000000 Kbit/sec",
      "  reliability 255/255, txload 240/255, rxload 230/255",
      "  5 minute input rate 910000000 bits/sec, 120000 packets/sec",
      "  5 minute output rate 880000000 bits/sec, 110000 packets/sec",
      "  22 input errors, 4 CRC, 1 frame, 0 overrun, 2 ignored",
      "  Total output drops: 1400",
      "CPU utilization for five seconds: 91%",
      "Processor Pool Total: 100000 Used: 87000 Free: 13000",
      "%OSPF-5-ADJCHG: Nbr 10.0.0.2 from FULL to DOWN",
      "policy-map interface Gi1/0/1 class class-default drops 2000"
    ].join("\n"))
  ];
  const processed = processPerformanceEvidence("assess_perf", files, "snapshot");
  const assessment = buildPerformanceAssessment("assess_perf", "snapshot", processed.files, processed.metrics);
  return { ...processed, assessment };
}

test("parser extracts show interfaces utilization, errors and drops", () => {
  const processed = processedPerformance();
  assert.ok(processed.metrics.some((metric) => metric.metricType === "utilization_in" && metric.value >= 90));
  assert.ok(processed.metrics.some((metric) => metric.metricType === "utilization_out" && metric.value >= 88));
  assert.ok(processed.metrics.some((metric) => metric.metricType === "crc_errors" && metric.value === 4));
  assert.ok(processed.metrics.some((metric) => metric.metricType === "output_drops" && metric.value === 1400));
  assert.ok(processed.metrics.some((metric) => metric.metricType === "qos_drops" && metric.value === 2000));
});

test("parser extracts CPU and memory pressure", () => {
  const processed = processedPerformance();
  assert.ok(processed.metrics.some((metric) => metric.metricType === "cpu" && metric.value === 91));
  assert.ok(processed.metrics.some((metric) => metric.metricType === "memory" && metric.value === 87));
});

test("buildTopUtilizationChart uses parsed metrics and evidence", () => {
  const processed = processedPerformance();
  const chart = buildTopUtilizationChart(processed.metrics);
  assert.ok(chart.length > 0);
  assert.ok(chart[0].value > 0);
  assert.match(chart[0].evidenceRef, /core-01-show-interfaces/);
  assert.match(chart[0].evidenceRef, /show interfaces/);
  assert.equal(chart[0].evidenceFileId, "perf_core-01-show-interfaces.log");
  assert.match(chart[0].evidenceCommand ?? "", /show interfaces/);
});

test("buildErrorsAndDropsChart groups breakdown by interface", () => {
  const processed = processedPerformance();
  const errors = buildErrorsAndDropsChart(processed.metrics, "errors");
  const drops = buildErrorsAndDropsChart(processed.metrics, "drops");
  assert.ok(errors.some((point) => point.breakdown.crc_errors === 4));
  assert.ok(drops.some((point) => point.breakdown.output_drops === 1400 || point.breakdown.qos_drops === 2000));
});

test("buildDeviceResourceChart groups CPU and memory by device", () => {
  const processed = processedPerformance();
  const chart = buildDeviceResourceChart(processed.metrics);
  assert.equal(chart[0].deviceId, "core-01");
  assert.equal(chart[0].breakdown.cpu, 91);
  assert.equal(chart[0].breakdown.memory, 87);
});

test("buildPerformanceHeatmap creates device category cells", () => {
  const processed = processedPerformance();
  const heatmap = buildPerformanceHeatmap(processed.metrics);
  assert.ok(heatmap.devices.includes("core-01"));
  assert.ok(heatmap.cells.some((cell) => cell.deviceId === "core-01" && cell.category === "utilization" && cell.severity !== "normal"));
});

test("buildDataCoverageWidget reports missing expected devices", () => {
  const processed = processedPerformance();
  const coverage = buildDataCoverageWidget({
    metrics: processed.metrics,
    evidenceFiles: processed.files,
    assessment: processed.assessment,
    expectedDevices: ["core-01", "dist-01"],
    criticalInterfaces: [{ deviceId: "core-01", interfaceId: "Gi9/9/9" }]
  });
  assert.equal(coverage.withData, 1);
  assert.equal(coverage.withoutData, 1);
  assert.equal(coverage.criticalInterfacesWithoutEvidence, 1);
});

test("dashboard filters metrics without hardcoded chart data", () => {
  const processed = processedPerformance();
  const filtered = applyPerformanceFilters(processed.metrics, { metricType: "cpu", severity: "high" });
  assert.ok(filtered.every((metric) => metric.metricType === "cpu"));
  const dashboard = buildPerformanceDashboardData({
    assessmentId: "assess_perf",
    enabled: true,
    performance: { evidenceFiles: processed.files, metrics: processed.metrics, findings: [], charts: [], assessment: processed.assessment },
    filters: { onlyCritical: true }
  });
  assert.ok(dashboard.criticalMetricsTable.length > 0);
  assert.ok(dashboard.criticalMetricsTable.every((point) => ["high", "critical"].includes(point.severity)));
});

test("dashboard reports filtered empty state separately from parser empty state", () => {
  const processed = processedPerformance();
  const dashboard = buildPerformanceDashboardData({
    assessmentId: "assess_perf",
    enabled: true,
    performance: { evidenceFiles: processed.files, metrics: processed.metrics, findings: [], charts: [], assessment: processed.assessment },
    filters: { deviceId: "missing-device" }
  });
  assert.equal(dashboard.emptyState, "filtered_empty");
  assert.equal(dashboard.filteredMetrics.length, 0);
});

test("dashboard does not expose trend charts without historical metrics", () => {
  const processed = processedPerformance();
  const dashboard = buildPerformanceDashboardData({
    assessmentId: "assess_perf",
    enabled: true,
    performance: { evidenceFiles: processed.files, metrics: processed.metrics, findings: [], charts: [], assessment: processed.assessment }
  });
  assert.equal(dashboard.hasSnapshotOnly, true);
  assert.equal(dashboard.hasHistoricalData, false);
  assert.equal(dashboard.timeSeriesCharts.length, 0);
});

test("dashboard insights exclude discarded findings and AI findings without evidence", () => {
  const processed = processedPerformance();
  const metric = processed.metrics.find((item) => item.metricType === "crc_errors") ?? processed.metrics[0];
  const findings: PerformanceFinding[] = [
    {
      id: "PF-VALID",
      assessmentId: "assess_perf",
      title: "CRC confirmado",
      domain: "enterprise_lan_wan",
      affectedDeviceIds: [metric.deviceId],
      affectedInterfaceIds: metric.interfaceId ? [metric.interfaceId] : [],
      severity: "high",
      performanceCategory: "errors",
      metricRefs: [metric.id],
      evidence: [`${metric.source}: ${metric.metricType}`],
      impact: "Errores fisicos detectados.",
      probableCause: "Capa fisica.",
      recommendation: "Validar cableado.",
      remediationCategory: "operational_change",
      confidence: 0.8,
      aiGenerated: false,
      status: "validated",
      relatedRiskDimensions: ["performance_capacity"]
    },
    {
      id: "PF-DISCARDED",
      assessmentId: "assess_perf",
      title: "Descartado",
      domain: "enterprise_lan_wan",
      affectedDeviceIds: [metric.deviceId],
      affectedInterfaceIds: [],
      severity: "high",
      performanceCategory: "capacity",
      metricRefs: [metric.id],
      evidence: ["evidencia"],
      impact: "No debe salir.",
      probableCause: "N/A",
      recommendation: "N/A",
      remediationCategory: "pending_validation",
      confidence: 0.8,
      aiGenerated: true,
      status: "discarded",
      relatedRiskDimensions: ["performance_capacity"]
    },
    {
      id: "PF-AI-NO-EVIDENCE",
      assessmentId: "assess_perf",
      title: "AI sin evidencia",
      domain: "enterprise_lan_wan",
      affectedDeviceIds: [metric.deviceId],
      affectedInterfaceIds: [],
      severity: "high",
      performanceCategory: "capacity",
      metricRefs: [metric.id],
      evidence: [],
      impact: "No debe salir.",
      probableCause: "N/A",
      recommendation: "N/A",
      remediationCategory: "pending_validation",
      confidence: 0.5,
      aiGenerated: true,
      status: "ai_suggested",
      relatedRiskDimensions: ["performance_capacity"]
    }
  ];
  const dashboard = buildPerformanceDashboardData({
    assessmentId: "assess_perf",
    enabled: true,
    performance: { evidenceFiles: processed.files, metrics: processed.metrics, findings, charts: [], assessment: processed.assessment }
  });
  const insightTitles = dashboard.insights.map((insight) => insight.title);
  assert.ok(insightTitles.includes("CRC confirmado"));
  assert.ok(!insightTitles.includes("Descartado"));
  assert.ok(!insightTitles.includes("AI sin evidencia"));
});

test("executive view data builds kpis, funnel, priorities and distributions from metrics", () => {
  const processed = processedPerformance();
  const state = { evidenceFiles: processed.files, metrics: processed.metrics, findings: [], charts: [], assessment: processed.assessment };
  const executive = buildExecutivePerformanceViewData({
    assessmentId: "assess_perf",
    enabled: true,
    performance: state,
    expectedDevices: ["core-01"]
  });

  assert.ok(executive.kpiRings.some((kpi) => kpi.key === "risk" && kpi.value === processed.assessment.performanceRiskScore));
  assert.ok(executive.processingFunnel.some((stage) => stage.key === "metrics" && stage.value === processed.metrics.length));
  assert.ok(executive.topPriorities.length > 0);
  assert.ok(executive.severityDistribution.reduce((sum, item) => sum + item.value, 0) === processed.metrics.length);
  assert.ok(executive.sourceDistribution.length > 0);
  assert.ok(executive.categoryBreakdown.some((item) => item.key === "utilization" && item.value > 0));
});

test("executive view uses decision KPIs, grouped priorities and traceability gaps", () => {
  const processed = processedPerformance();
  const metricsWithUnknownSource = processed.metrics.map((metric, index) => index < 2 ? { ...metric, sourceType: undefined } : metric);
  const state = { evidenceFiles: processed.files, metrics: metricsWithUnknownSource, findings: [], charts: [], assessment: processed.assessment };
  const executive = buildExecutivePerformanceViewData({
    assessmentId: "assess_perf",
    enabled: true,
    performance: state,
    expectedDevices: ["core-01"]
  });

  const kpiKeys = executive.kpiRings.map((kpi) => kpi.key);
  assert.ok(kpiKeys.includes("risk"));
  assert.ok(kpiKeys.includes("device-coverage"));
  assert.ok(kpiKeys.includes("historical-depth"));
  assert.ok(!kpiKeys.includes("critical-metrics"));
  assert.equal(executive.kpiRings.find((kpi) => kpi.key === "risk")?.severity, "critical");
  assert.ok(executive.dashboard.dataCoverage.unknownSourceMetrics > 0);
  assert.ok(executive.narrative.traceabilityGap);
  assert.ok(executive.sourceDistribution.every((item) => item.key !== "unknown"));
  assert.ok(executive.topPriorities.every((priority) => priority.affectedMetricCount > 0));
  assert.ok(executive.executiveHeatmap.devices.length <= 6);
});

test("standalone builder helpers use supplied dashboard data", () => {
  const processed = processedPerformance();
  const state = { evidenceFiles: processed.files, metrics: processed.metrics, findings: [], charts: [], assessment: processed.assessment };
  const dashboard = buildPerformanceDashboardData({
    assessmentId: "assess_perf",
    enabled: true,
    performance: state
  });

  assert.ok(buildKpiRingData(state, dashboard).length >= 5);
  assert.ok(buildProcessingFunnelData(state, dashboard).some((stage) => stage.value === processed.metrics.length));
  assert.ok(buildTopPrioritiesData(dashboard).every((priority) => priority.evidenceRefs.length > 0));
  assert.equal(buildSeverityDistributionData(dashboard).reduce((sum, item) => sum + item.value, 0), processed.metrics.length);
  assert.ok(buildSourceDistributionData(state, dashboard).length > 0);
  assert.ok(buildCategoryBreakdownData(dashboard).some((item) => item.value > 0));
});

test("technical view data includes evidence coverage derived from files", () => {
  const processed = processedPerformance();
  const technical = buildTechnicalPerformanceViewData({
    assessmentId: "assess_perf",
    enabled: true,
    performance: { evidenceFiles: processed.files, metrics: processed.metrics, findings: [], charts: [], assessment: processed.assessment }
  });

  assert.ok(technical.evidenceCoverage.length > 0);
  assert.ok(technical.evidenceCoverage.every((item) => item.value >= 0));
  assert.equal(technical.dashboard.filteredMetrics.length, processed.metrics.length);
});
