import type {
  PerformanceAssessment,
  PerformanceEvidenceFile,
  PerformanceFinding,
  PerformanceMetric,
  PerformanceMetricType,
  PerformanceState,
  PerformanceTimeWindow
} from "@/lib/performance-analysis";

export type PerformanceSeverity = "normal" | "warning" | "high" | "critical";
export type PerformanceViewMode = "executive" | "technical";

export const performanceThresholds = {
  utilization: { warning: 70, high: 85, critical: 95 },
  inputErrors: { warning: 1, high: 100, critical: 1000 },
  crcErrors: { warning: 1, high: 50, critical: 500 },
  drops: { warning: 1, high: 1000, critical: 10000 },
  cpu: { warning: 70, high: 85, critical: 95 },
  memory: { warning: 70, high: 85, critical: 95 },
  packetLoss: { warning: 0.5, high: 1, critical: 3 },
  latencyMs: { warning: 100, high: 200, critical: 300 },
  jitterMs: { warning: 20, high: 30, critical: 50 },
  instabilityEvents: { warning: 1, high: 3, critical: 8 }
};

export type PerformanceDashboardFilters = {
  query?: string;
  severity?: PerformanceSeverity | "all";
  metricType?: PerformanceMetricType | "all";
  deviceId?: string;
  interfaceId?: string;
  sourceType?: string;
  timeWindow?: PerformanceTimeWindow | "all";
  sampleType?: "snapshot" | "historical" | "all";
  onlyCritical?: boolean;
  showVisibilityGaps?: boolean;
  healthCategory?: PerformanceHealthCategory | "all";
};

export type PerformanceChartPoint = {
  id: string;
  label: string;
  deviceId: string;
  interfaceId?: string;
  description?: string;
  value: number;
  secondaryValue?: number;
  unit: string;
  thresholdWarning: number;
  thresholdCritical: number;
  severity: PerformanceSeverity;
  evidenceRef: string;
  evidenceFileId: string;
  evidenceCommand?: string;
  evidenceSourceType?: string;
  source: string;
  sampleType: "snapshot" | "historical";
  confidence: number;
  metrics: PerformanceMetric[];
};

export type PerformanceStackedPoint = PerformanceChartPoint & {
  breakdown: Record<string, number>;
};

export type PerformanceHealthCategory = "utilization" | "errors" | "drops" | "cpu" | "memory" | "instability" | "qos";

export type PerformanceHeatmapCell = {
  id: string;
  deviceId: string;
  category: PerformanceHealthCategory;
  severity: PerformanceSeverity;
  score: number;
  metrics: PerformanceMetric[];
};

export type DataCoverageWidgetData = {
  withData: number;
  withoutData: number;
  snapshotOnly: number;
  historicalAvailable: number;
  interfacesAnalyzed: number;
  criticalInterfacesWithoutEvidence: number;
  criticalInterfacesWithoutEvidenceRefs: string[];
  confidenceScore: number;
  coverageScore: number;
  deviceCoverageScore: number;
  historicalCoverageScore: number;
  traceabilityScore: number;
  unknownSourceMetrics: number;
  metricsWithoutCommand: number;
};

export type PerformanceInsight = {
  id: string;
  assessmentId: string;
  insightType: "saturation" | "errors" | "drops" | "resource_pressure" | "instability" | "visibility_gap" | "capacity_risk" | "qos_congestion";
  sourceType: "deterministic_insight" | "ai_suggested" | "architect_validated";
  title: string;
  description: string;
  severity: Exclude<PerformanceSeverity, "normal">;
  confidence: number;
  relatedMetrics: string[];
  relatedDevices: string[];
  relatedInterfaces: string[];
  evidenceRefs: string[];
  recommendation: string;
  validationStatus?: PerformanceFinding["status"] | "deterministic";
  probableCause?: string;
  remediationCategory?: string;
};

export type PerformanceKpiRingData = {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  max: number;
  severity: PerformanceSeverity;
  helper: string;
};

export type PerformanceProcessingFunnelStage = {
  key: string;
  label: string;
  value: number;
  helper: string;
  severity: PerformanceSeverity;
};

export type PerformanceDistributionDatum = {
  key: string;
  label: string;
  value: number;
  severity?: PerformanceSeverity;
};

export type PerformanceTopPriority = {
  id: string;
  rank: number;
  title: string;
  category: PerformanceInsight["insightType"];
  affectedTarget: string;
  severity: Exclude<PerformanceSeverity, "normal">;
  confidence: number;
  recommendation: string;
  sourceType: PerformanceInsight["sourceType"];
  point?: PerformanceChartPoint;
  evidenceRefs: string[];
  affectedDevices: string[];
  affectedInterfaces: string[];
  affectedMetricCount: number;
  impact: string;
  observedSummary: string;
  validationStatus: PerformanceFinding["status"] | "deterministic";
  probableCause: string;
  remediationCategory: string;
  evidenceCommand?: string;
  evidenceFile?: string;
  sampleType?: "snapshot" | "historical";
  timeWindow?: PerformanceTimeWindow;
};

export type PerformanceExecutiveHeatmapData = {
  devices: string[];
  categories: PerformanceHealthCategory[];
  cells: PerformanceHeatmapCell[];
  totalDevices: number;
};

type DraftPerformanceTopPriority = Omit<PerformanceTopPriority, "rank">;

export type PerformanceExecutiveViewData = {
  dashboard: PerformanceDashboardData;
  kpiRings: PerformanceKpiRingData[];
  topPriorities: PerformanceTopPriority[];
  processingFunnel: PerformanceProcessingFunnelStage[];
  severityDistribution: PerformanceDistributionDatum[];
  sourceDistribution: PerformanceDistributionDatum[];
  categoryBreakdown: PerformanceDistributionDatum[];
  executiveHeatmap: PerformanceExecutiveHeatmapData;
  narrative: {
    status: string;
    primaryCause: string;
    affectedArea: string;
    confidence: string;
    recommendedAction: string;
    limitation?: string;
    visibilityGap?: string;
    traceabilityGap?: string;
  };
};

export type PerformanceTechnicalViewData = {
  dashboard: PerformanceDashboardData;
  evidenceCoverage: PerformanceDistributionDatum[];
};

export type PerformanceDashboardData = {
  summaryCards: Array<{
    key: string;
    label: string;
    value: string;
    level: string;
    severity: PerformanceSeverity;
    description: string;
    trend?: "up" | "down" | "flat" | "unavailable";
  }>;
  topUtilizationInterfaces: PerformanceChartPoint[];
  topErrorInterfaces: PerformanceStackedPoint[];
  topDropInterfaces: PerformanceStackedPoint[];
  deviceResourcePressure: PerformanceStackedPoint[];
  instabilityEvents: PerformanceStackedPoint[];
  dataCoverage: DataCoverageWidgetData;
  visibilityGaps: string[];
  timeSeriesCharts: Array<{
    id: string;
    metricType: PerformanceMetricType;
    deviceId: string;
    interfaceId?: string;
    unit: string;
    points: Array<{ timestamp: string; value: number; min?: number; max?: number; average?: number; percentile95?: number }>;
  }>;
  heatmapData: {
    devices: string[];
    categories: PerformanceHealthCategory[];
    cells: PerformanceHeatmapCell[];
  };
  criticalMetricsTable: PerformanceChartPoint[];
  insights: PerformanceInsight[];
  filteredMetrics: PerformanceMetric[];
  hasHistoricalData: boolean;
  hasSnapshotOnly: boolean;
  emptyState: "disabled" | "no_evidence" | "no_metrics" | "filtered_empty" | "ready";
};

export function buildPerformanceDashboardData(input: {
  assessmentId: string;
  enabled: boolean;
  performance: PerformanceState;
  expectedDevices?: string[];
  criticalInterfaces?: Array<{ deviceId: string; interfaceId: string }>;
  filters?: PerformanceDashboardFilters;
}): PerformanceDashboardData {
  const filters = normalizeFilters(input.filters);
  const allMetrics = input.performance.metrics;
  const metrics = applyPerformanceFilters(allMetrics, filters);
  const evidenceFiles = input.performance.evidenceFiles;
  const assessment = input.performance.assessment;
  const hasHistoricalData = metrics.some((metric) => metric.sampleType === "historical");
  const hasSnapshotOnly = metrics.length > 0 && metrics.every((metric) => metric.sampleType === "snapshot");
  const emptyState = !input.enabled
    ? "disabled"
    : evidenceFiles.length === 0
      ? "no_evidence"
      : allMetrics.length === 0
        ? "no_metrics"
        : metrics.length === 0
          ? "filtered_empty"
          : "ready";
  const dataCoverage = buildDataCoverageWidget({
    metrics,
    evidenceFiles,
    assessment,
    expectedDevices: input.expectedDevices ?? [],
    criticalInterfaces: input.criticalInterfaces ?? []
  });
  const insights = buildPerformanceInsights(input.assessmentId, metrics, filterFindingsForDashboard(input.performance.findings, metrics, filters), assessment);

  return {
    summaryCards: buildSummaryCards(assessment, metrics, dataCoverage, hasHistoricalData),
    topUtilizationInterfaces: buildTopUtilizationChart(metrics),
    topErrorInterfaces: buildErrorsAndDropsChart(metrics, "errors"),
    topDropInterfaces: buildErrorsAndDropsChart(metrics, "drops"),
    deviceResourcePressure: buildDeviceResourceChart(metrics),
    instabilityEvents: buildInstabilityChart(metrics),
    dataCoverage,
    visibilityGaps: assessment.visibilityGaps,
    timeSeriesCharts: buildTimeSeriesCharts(metrics),
    heatmapData: buildPerformanceHeatmap(metrics),
    criticalMetricsTable: buildCriticalMetricsTable(metrics),
    insights: filters.showVisibilityGaps === false ? insights.filter((insight) => insight.insightType !== "visibility_gap") : insights,
    filteredMetrics: metrics,
    hasHistoricalData,
    hasSnapshotOnly,
    emptyState
  };
}

export function buildExecutivePerformanceViewData(input: {
  assessmentId: string;
  enabled: boolean;
  performance: PerformanceState;
  expectedDevices?: string[];
  criticalInterfaces?: Array<{ deviceId: string; interfaceId: string }>;
  filters?: PerformanceDashboardFilters;
}): PerformanceExecutiveViewData {
  const dashboard = buildPerformanceDashboardData(input);
  return {
    dashboard,
    kpiRings: buildKpiRingData(input.performance, dashboard),
    topPriorities: buildTopPrioritiesData(dashboard),
    processingFunnel: buildProcessingFunnelData(input.performance, dashboard),
    severityDistribution: buildSeverityDistributionData(dashboard),
    sourceDistribution: buildSourceDistributionData(input.performance, dashboard),
    categoryBreakdown: buildCategoryBreakdownData(dashboard),
    executiveHeatmap: buildExecutiveHeatmapData(dashboard),
    narrative: buildExecutiveNarrative(input.performance, dashboard)
  };
}

export function buildTechnicalPerformanceViewData(input: {
  assessmentId: string;
  enabled: boolean;
  performance: PerformanceState;
  expectedDevices?: string[];
  criticalInterfaces?: Array<{ deviceId: string; interfaceId: string }>;
  filters?: PerformanceDashboardFilters;
}): PerformanceTechnicalViewData {
  const dashboard = buildPerformanceDashboardData(input);
  return {
    dashboard,
    evidenceCoverage: buildEvidenceCoverageData(input.performance, dashboard)
  };
}

export function buildKpiRingData(performance: PerformanceState, dashboard: PerformanceDashboardData): PerformanceKpiRingData[] {
  const alertInterfaces = new Set(dashboard.criticalMetricsTable.filter((point) => point.interfaceId).map((point) => `${point.deviceId}:${point.interfaceId}`)).size;
  const alertMetrics = dashboard.criticalMetricsTable.length;
  const criticalPriorities = buildTopPrioritiesData(dashboard).filter((priority) => priority.severity === "critical").length;
  return [
    {
      key: "risk",
      label: "Risk Score",
      value: performance.assessment.performanceRiskScore,
      displayValue: `${performance.assessment.performanceRiskScore}/100`,
      max: 100,
      severity: scoreSeverity(performance.assessment.performanceRiskScore),
      helper: "Riesgo agregado por capacidad, errores, drops, recursos e inestabilidad."
    },
    {
      key: "alert-interfaces",
      label: "Interfaces en alerta",
      value: alertInterfaces,
      displayValue: String(alertInterfaces),
      max: Math.max(alertInterfaces, dashboard.dataCoverage.interfacesAnalyzed, 1),
      severity: alertInterfaces > 0 ? "high" : "normal",
      helper: "Interfaces con metricas warning, high o critical."
    },
    {
      key: "metric-alerts",
      label: "Metricas con alerta",
      value: alertMetrics,
      displayValue: String(alertMetrics),
      max: Math.max(alertMetrics, dashboard.filteredMetrics.length, 1),
      severity: alertMetrics > 0 ? "high" : "normal",
      helper: "Metricas en warning, high o critical listas para validar."
    },
    {
      key: "critical-priorities",
      label: "Prioridades criticas",
      value: criticalPriorities,
      displayValue: String(criticalPriorities),
      max: Math.max(criticalPriorities, dashboard.insights.length, 1),
      severity: criticalPriorities > 0 ? "critical" : "normal",
      helper: "Prioridades ejecutivas con severidad critical."
    }
  ];
}

export function buildProcessingFunnelData(performance: PerformanceState, dashboard: PerformanceDashboardData): PerformanceProcessingFunnelStage[] {
  const metricsWithAlerts = dashboard.criticalMetricsTable.length;
  const validatedFindings = performance.findings.filter((finding) => finding.status === "validated").length;
  return [
    { key: "loaded", label: "Archivos cargados", value: performance.evidenceFiles.length, helper: "Evidencia de performance cargada.", severity: performance.evidenceFiles.length > 0 ? "normal" : "warning" },
    { key: "processed", label: "Archivos procesados", value: performance.evidenceFiles.filter((file) => file.processingStatus === "processed").length, helper: "Archivos parseados por el worker/app.", severity: "normal" },
    { key: "devices", label: "Dispositivos con data", value: dashboard.dataCoverage.withData, helper: "Dispositivos con al menos una metrica reconocida.", severity: dashboard.dataCoverage.withData > 0 ? "normal" : "warning" },
    { key: "interfaces", label: "Interfaces analizadas", value: dashboard.dataCoverage.interfacesAnalyzed, helper: "Interfaces con metricas extraidas.", severity: dashboard.dataCoverage.interfacesAnalyzed > 0 ? "normal" : "warning" },
    { key: "metrics", label: "Metricas extraidas", value: dashboard.filteredMetrics.length, helper: "Metricas despues de filtros aplicados.", severity: dashboard.filteredMetrics.length > 0 ? "normal" : "warning" },
    { key: "alerts", label: "Metricas con alerta", value: metricsWithAlerts, helper: "Metricas en warning/high/critical.", severity: metricsWithAlerts > 0 ? "high" : "normal" },
    { key: "insights", label: "Insights generados", value: dashboard.insights.length, helper: "Insights determinísticos, AI sugeridos o validados.", severity: dashboard.insights.length > 0 ? "normal" : "warning" },
    { key: "validated", label: "Hallazgos validados", value: validatedFindings, helper: "Hallazgos confirmados por arquitecto.", severity: validatedFindings > 0 ? "normal" : "warning" }
  ];
}

export function buildTopPrioritiesData(dashboard: PerformanceDashboardData, limit = 5): PerformanceTopPriority[] {
  const insightPriorities = dashboard.insights
    .filter((insight) => insight.evidenceRefs.length > 0 || insight.insightType === "visibility_gap")
    .map((insight) => {
      const point = dashboard.criticalMetricsTable.find((item) => insight.relatedMetrics.includes(item.id));
      return {
        id: insight.id,
        title: insight.title,
        category: insight.insightType,
        affectedTarget: [insight.relatedDevices[0], insight.relatedInterfaces[0]].filter(Boolean).join(" · ") || "Assessment",
        severity: insight.severity,
        confidence: insight.confidence,
        recommendation: insight.recommendation,
        sourceType: insight.sourceType,
        evidenceRefs: insight.evidenceRefs,
        point,
        affectedDevices: insight.relatedDevices,
        affectedInterfaces: insight.relatedInterfaces,
        affectedMetricCount: insight.relatedMetrics.length,
        impact: insight.description || impactForInsightType(insight.insightType),
        observedSummary: point ? observedSummaryForPoint(point) : insight.evidenceRefs[0] ?? "Brecha de visibilidad sin metrica asociada.",
        validationStatus: insight.validationStatus ?? "deterministic" as const,
        probableCause: insight.probableCause ?? probableCauseForInsightType(insight.insightType),
        remediationCategory: insight.remediationCategory ?? remediationCategoryForInsightType(insight.insightType),
        evidenceCommand: point?.evidenceCommand,
        evidenceFile: point?.source ?? insight.evidenceRefs[0],
        sampleType: point?.sampleType,
        timeWindow: point?.metrics[0]?.timeWindow
      };
    });
  const metricPriorities = dashboard.criticalMetricsTable.map((point) => ({
    id: `priority_${point.id}`,
    title: `${point.metrics[0].metricType.replace(/_/g, " ")} en ${point.interfaceId ?? point.deviceId}`,
    category: insightTypeForMetric(point.metrics[0].metricType),
    affectedTarget: [point.deviceId, point.interfaceId].filter(Boolean).join(" · "),
    severity: point.severity === "normal" ? "warning" as const : point.severity,
    confidence: point.confidence,
    recommendation: recommendationForMetric(point.metrics[0].metricType),
    sourceType: "deterministic_insight" as const,
    evidenceRefs: [point.evidenceRef],
    point,
    affectedDevices: [point.deviceId],
    affectedInterfaces: point.interfaceId ? [point.interfaceId] : [],
    affectedMetricCount: point.metrics.length,
    impact: impactForInsightType(insightTypeForMetric(point.metrics[0].metricType)),
    observedSummary: observedSummaryForPoint(point),
    validationStatus: "deterministic" as const,
    probableCause: probableCauseForMetric(point.metrics[0].metricType),
    remediationCategory: remediationCategoryForInsightType(insightTypeForMetric(point.metrics[0].metricType)),
    evidenceCommand: point.evidenceCommand,
    evidenceFile: point.source,
    sampleType: point.sampleType,
    timeWindow: point.metrics[0]?.timeWindow
  }));
  return groupExecutivePriorities([...insightPriorities, ...metricPriorities])
    .sort((left, right) => severityScore(right.severity) - severityScore(left.severity) || right.confidence - left.confidence)
    .slice(0, limit)
    .map((priority, index) => ({ ...priority, rank: index + 1 }));
}

export function buildSeverityDistributionData(dashboard: PerformanceDashboardData): PerformanceDistributionDatum[] {
  const severities: PerformanceSeverity[] = ["critical", "high", "warning", "normal"];
  return severities.map((severity) => ({
    key: severity,
    label: severity,
    value: dashboard.filteredMetrics.filter((metric) => metricSeverity(metric) === severity).length,
    severity
  }));
}

export function buildSourceDistributionData(performance: PerformanceState, dashboard: PerformanceDashboardData): PerformanceDistributionDatum[] {
  const metrics = dashboard.filteredMetrics.length > 0 ? dashboard.filteredMetrics : performance.metrics;
  return Array.from(groupBy(metrics.filter((metric) => Boolean(metric.sourceType)), (metric) => metric.sourceType!).entries())
    .map(([source, metricsForSource]) => ({ key: source, label: source.replace(/_/g, " "), value: metricsForSource.length }))
    .sort((left, right) => right.value - left.value);
}

export function buildCategoryBreakdownData(dashboard: PerformanceDashboardData): PerformanceDistributionDatum[] {
  const categories: PerformanceHealthCategory[] = ["utilization", "errors", "drops", "cpu", "memory", "instability", "qos"];
  return categories.map((category) => ({
    key: category,
    label: category,
    value: dashboard.filteredMetrics.filter((metric) => metricBelongsToHealthCategory(metric, category)).length,
    severity: scoreToSeverity(Math.max(0, ...dashboard.filteredMetrics.filter((metric) => metricBelongsToHealthCategory(metric, category)).map((metric) => severityScore(metricSeverity(metric)))))
  }));
}

export function buildEvidenceCoverageData(performance: PerformanceState, dashboard: PerformanceDashboardData): PerformanceDistributionDatum[] {
  return performance.evidenceFiles
    .map((file) => ({
      key: file.id,
      label: file.fileName,
      value: dashboard.filteredMetrics.filter((metric) => metric.evidenceFileId === file.id).length,
      severity: file.processingStatus === "failed" ? "critical" as const : file.parsedMetricCount > 0 ? "normal" as const : "warning" as const
    }))
    .sort((left, right) => right.value - left.value);
}

export function buildExecutiveHeatmapData(dashboard: PerformanceDashboardData, limit = 6): PerformanceExecutiveHeatmapData {
  const deviceScores = dashboard.heatmapData.devices
    .map((deviceId) => {
      const cells = dashboard.heatmapData.cells.filter((cell) => cell.deviceId === deviceId);
      const score = cells.reduce((sum, cell) => sum + severityScore(cell.severity) * Math.max(1, cell.metrics.length), 0);
      return { deviceId, score };
    })
    .sort((left, right) => right.score - left.score || left.deviceId.localeCompare(right.deviceId));
  const devices = deviceScores.slice(0, limit).map((item) => item.deviceId);
  return {
    devices,
    categories: dashboard.heatmapData.categories,
    cells: dashboard.heatmapData.cells.filter((cell) => devices.includes(cell.deviceId)),
    totalDevices: dashboard.heatmapData.devices.length
  };
}

function buildExecutiveNarrative(performance: PerformanceState, dashboard: PerformanceDashboardData): PerformanceExecutiveViewData["narrative"] {
  const topPriority = buildTopPrioritiesData(dashboard, 1)[0];
  const topCategory = buildCategoryBreakdownData(dashboard).sort((left, right) => right.value - left.value)[0];
  const topTarget = topPriority?.affectedTarget || dashboard.heatmapData.devices[0] || "sin dispositivo dominante";
  const risk = performance.assessment.performanceRiskScore >= 80 ? "riesgo critico" : performance.assessment.performanceRiskScore >= 60 ? "riesgo alto" : performance.assessment.performanceRiskScore >= 35 ? "riesgo moderado" : "riesgo controlado";
  const alertInterfaces = new Set(dashboard.criticalMetricsTable.filter((point) => point.interfaceId).map((point) => `${point.deviceId}:${point.interfaceId}`)).size;
  return {
    status: `El assessment muestra ${risk} de performance: ${alertInterfaces} interfaces presentan sintomas sobre umbral y requieren priorizacion tecnica.`,
    primaryCause: topPriority ? `Causa dominante: ${humanizeInsightType(topPriority.category)} concentrado en ${topPriority.affectedDevices.length} dispositivo(s) y ${topPriority.affectedInterfaces.length} interface(s).` : "No hay una causa dominante con la evidencia actual.",
    affectedArea: `Area mas afectada: ${topTarget}${topCategory?.value ? `, con mayor concentracion en ${humanizeHealthCategory(topCategory.key as PerformanceHealthCategory)}` : ""}.`,
    confidence: `Confianza ejecutiva ${dashboard.dataCoverage.confidenceScore}%: device coverage ${dashboard.dataCoverage.deviceCoverageScore}%, historico ${dashboard.dataCoverage.historicalCoverageScore}% y trazabilidad ${dashboard.dataCoverage.traceabilityScore}%.`,
    recommendedAction: topPriority?.recommendation ?? "Completar evidencia, validar metricas con el arquitecto y priorizar los sintomas de mayor impacto.",
    limitation: dashboard.hasSnapshotOnly || dashboard.dataCoverage.historicalCoverageScore < 30 ? "La evidencia disponible es principalmente snapshot; permite identificar sintomas actuales, pero no confirma tendencia historica ni crecimiento sostenido." : undefined,
    visibilityGap: dashboard.visibilityGaps[0],
    traceabilityGap: dashboard.dataCoverage.unknownSourceMetrics > 0 ? `${dashboard.dataCoverage.unknownSourceMetrics} metricas no tienen sourceType identificado; se tratan como brecha de trazabilidad y reducen confianza.` : undefined
  };
}

export function buildTopUtilizationChart(metrics: PerformanceMetric[], limit = 8): PerformanceChartPoint[] {
  return groupMetricsByInterface(metrics.filter((metric) => utilizationMetricTypes.has(metric.metricType)))
    .map((group) => {
      const input = maxMetric(group.metrics, ["utilization_in", "utilization"]);
      const output = maxMetric(group.metrics, ["utilization_out", "utilization"]);
      const absolute = maxMetric(group.metrics, ["input_rate_bps", "output_rate_bps"]);
      const primary = input ?? output ?? absolute ?? group.metrics[0];
      const value = input || output ? Math.max(input?.value ?? 0, output?.value ?? 0) : absolute?.value ?? 0;
      return chartPoint(primary, {
        label: `${group.deviceId} ${group.interfaceId ?? "device"}`,
        value,
        secondaryValue: output?.value,
        unit: input || output ? "%" : absolute?.unit ?? primary.unit,
        metrics: group.metrics,
        thresholdWarning: input || output ? performanceThresholds.utilization.warning : 0,
        thresholdCritical: input || output ? performanceThresholds.utilization.critical : Number.MAX_SAFE_INTEGER
      });
    })
    .sort(sortBySeverityAndValue)
    .slice(0, limit);
}

export function buildErrorsAndDropsChart(metrics: PerformanceMetric[], mode: "errors" | "drops" = "errors", limit = 8): PerformanceStackedPoint[] {
  const selectedTypes = mode === "errors" ? errorMetricTypes : dropMetricTypes;
  return groupMetricsByInterface(metrics.filter((metric) => selectedTypes.has(metric.metricType)))
    .map((group) => {
      const breakdown = Object.fromEntries(Array.from(selectedTypes).map((type) => [type, sumMetricValues(group.metrics, type)]));
      const value = Object.values(breakdown).reduce((sum, item) => sum + item, 0);
      const primary = group.metrics.sort((left, right) => right.value - left.value)[0];
      return {
        ...chartPoint(primary, {
          label: `${group.deviceId} ${group.interfaceId ?? "device"}`,
          value,
          unit: "count",
          metrics: group.metrics,
          thresholdWarning: mode === "errors" ? performanceThresholds.inputErrors.warning : performanceThresholds.drops.warning,
          thresholdCritical: mode === "errors" ? performanceThresholds.inputErrors.critical : performanceThresholds.drops.critical
        }),
        breakdown
      };
    })
    .sort(sortBySeverityAndValue)
    .slice(0, limit);
}

export function buildDeviceResourceChart(metrics: PerformanceMetric[], limit = 10): PerformanceStackedPoint[] {
  return Array.from(groupBy(metrics.filter((metric) => metric.metricType === "cpu" || metric.metricType === "memory"), (metric) => metric.deviceId).entries())
    .map(([deviceId, groupMetrics]) => {
      const breakdown = {
        cpu: maxValue(groupMetrics, "cpu"),
        memory: maxValue(groupMetrics, "memory")
      };
      const primary = groupMetrics.sort((left, right) => right.value - left.value)[0];
      return {
        ...chartPoint(primary, {
          label: deviceId,
          value: Math.max(breakdown.cpu, breakdown.memory),
          unit: "%",
          metrics: groupMetrics,
          thresholdWarning: performanceThresholds.cpu.warning,
          thresholdCritical: performanceThresholds.cpu.critical
        }),
        breakdown
      };
    })
    .sort(sortBySeverityAndValue)
    .slice(0, limit);
}

export function buildInstabilityChart(metrics: PerformanceMetric[], limit = 8): PerformanceStackedPoint[] {
  return Array.from(groupBy(metrics.filter((metric) => instabilityMetricTypes.has(metric.metricType)), (metric) => metric.deviceId).entries())
    .map(([deviceId, groupMetrics]) => {
      const breakdown = {
        interface_flaps: sumMetricValues(groupMetrics, "flaps"),
        routing_neighbor_flaps: sumMetricValues(groupMetrics, "routing_neighbor_stability")
      };
      const primary = groupMetrics.sort((left, right) => right.value - left.value)[0];
      return {
        ...chartPoint(primary, {
          label: deviceId,
          value: Object.values(breakdown).reduce((sum, item) => sum + item, 0),
          unit: "events",
          metrics: groupMetrics,
          thresholdWarning: performanceThresholds.instabilityEvents.warning,
          thresholdCritical: performanceThresholds.instabilityEvents.critical
        }),
        breakdown
      };
    })
    .sort(sortBySeverityAndValue)
    .slice(0, limit);
}

export function buildPerformanceHeatmap(metrics: PerformanceMetric[]) {
  const devices = Array.from(new Set(metrics.map((metric) => metric.deviceId))).sort();
  const categories: PerformanceHealthCategory[] = ["utilization", "errors", "drops", "cpu", "memory", "instability", "qos"];
  const cells = devices.flatMap((deviceId) =>
    categories.map((category) => {
      const categoryMetrics = metrics.filter((metric) => metric.deviceId === deviceId && metricBelongsToHealthCategory(metric, category));
      const score = Math.max(0, ...categoryMetrics.map((metric) => severityScore(metricSeverity(metric))));
      return {
        id: `${deviceId}:${category}`,
        deviceId,
        category,
        severity: scoreToSeverity(score),
        score,
        metrics: categoryMetrics
      };
    })
  );
  return { devices, categories, cells };
}

export function buildDataCoverageWidget(input: {
  metrics: PerformanceMetric[];
  evidenceFiles: PerformanceEvidenceFile[];
  assessment: PerformanceAssessment;
  expectedDevices: string[];
  criticalInterfaces: Array<{ deviceId: string; interfaceId: string }>;
}): DataCoverageWidgetData {
  const devicesWithData = new Set(input.metrics.map((metric) => metric.deviceId));
  const expectedDevices = new Set(input.expectedDevices.filter(Boolean));
  const totalDeviceScope = expectedDevices.size > 0 ? expectedDevices.size : devicesWithData.size;
  const withoutData = expectedDevices.size > 0
    ? Array.from(expectedDevices).filter((device) => !devicesWithData.has(device)).length
    : Math.max(0, input.assessment.dataCoverageScore === 0 ? 1 : 0);
  const historicalDevices = new Set(input.metrics.filter((metric) => metric.sampleType === "historical").map((metric) => metric.deviceId));
  const snapshotDevices = new Set(input.metrics.filter((metric) => metric.sampleType === "snapshot").map((metric) => metric.deviceId));
  const interfacesWithData = new Set(input.metrics.map((metric) => `${metric.deviceId}:${metric.interfaceId ?? ""}`).filter((value) => !value.endsWith(":")));
  const criticalInterfacesWithoutEvidenceRefs = input.criticalInterfaces
    .filter((item) => !interfacesWithData.has(`${item.deviceId}:${item.interfaceId}`))
    .map((item) => `${item.deviceId} · ${item.interfaceId}`);
  const unknownSourceMetrics = input.metrics.filter((metric) => !metric.sourceType).length;
  const metricsWithoutCommand = input.metrics.filter((metric) => !metric.evidenceCommand).length;
  const sourceTraceability = input.metrics.length > 0 ? ((input.metrics.length - unknownSourceMetrics) / input.metrics.length) * 100 : 0;
  const commandTraceability = input.metrics.length > 0 ? ((input.metrics.length - metricsWithoutCommand) / input.metrics.length) * 100 : 0;
  const traceabilityScore = Math.round(sourceTraceability * 0.7 + commandTraceability * 0.3);
  const deviceCoverageScore = totalDeviceScope > 0 ? Math.round((devicesWithData.size / totalDeviceScope) * 100) : 0;
  const historicalCoverageScore = devicesWithData.size > 0 ? Math.round((historicalDevices.size / devicesWithData.size) * 100) : 0;
  const traceabilityFactor = input.metrics.length > 0 ? 0.65 + (traceabilityScore / 100) * 0.35 : 1;
  const adjustedConfidenceScore = Math.round(input.assessment.confidenceScore * traceabilityFactor);

  return {
    withData: devicesWithData.size,
    withoutData,
    snapshotOnly: Array.from(snapshotDevices).filter((device) => !historicalDevices.has(device)).length,
    historicalAvailable: historicalDevices.size,
    interfacesAnalyzed: interfacesWithData.size,
    criticalInterfacesWithoutEvidence: criticalInterfacesWithoutEvidenceRefs.length,
    criticalInterfacesWithoutEvidenceRefs,
    confidenceScore: Math.min(input.assessment.confidenceScore, adjustedConfidenceScore),
    coverageScore: input.assessment.dataCoverageScore,
    deviceCoverageScore,
    historicalCoverageScore,
    traceabilityScore,
    unknownSourceMetrics,
    metricsWithoutCommand
  };
}

export function applyPerformanceFilters(metrics: PerformanceMetric[], filters: PerformanceDashboardFilters = {}) {
  const normalized = normalizeFilters(filters);
  return metrics.filter((metric) => {
    if (normalized.query) {
      const haystack = `${metric.deviceId} ${metric.interfaceId ?? ""} ${metric.interfaceDescription ?? ""} ${metric.metricType} ${metric.source}`.toLowerCase();
      if (!haystack.includes(normalized.query.toLowerCase())) return false;
    }
    if (normalized.severity !== "all" && metricSeverity(metric) !== normalized.severity) return false;
    if (normalized.metricType !== "all" && metric.metricType !== normalized.metricType) return false;
    if (normalized.deviceId && metric.deviceId !== normalized.deviceId) return false;
    if (normalized.interfaceId && metric.interfaceId !== normalized.interfaceId) return false;
    if (normalized.sourceType && metric.sourceType !== normalized.sourceType) return false;
    if (normalized.timeWindow !== "all" && metric.timeWindow !== normalized.timeWindow) return false;
    if (normalized.sampleType !== "all" && metric.sampleType !== normalized.sampleType) return false;
    if (normalized.onlyCritical && !["high", "critical"].includes(metricSeverity(metric))) return false;
    if (normalized.healthCategory !== "all" && !metricBelongsToHealthCategory(metric, normalized.healthCategory)) return false;
    return true;
  });
}

function buildSummaryCards(assessment: PerformanceAssessment, metrics: PerformanceMetric[], coverage: DataCoverageWidgetData, hasHistoricalData: boolean): PerformanceDashboardData["summaryCards"] {
  const alertInterfaces = new Set(metrics.filter((metric) => ["high", "critical"].includes(metricSeverity(metric)) && metric.interfaceId).map((metric) => `${metric.deviceId}:${metric.interfaceId}`)).size;
  const criticalMetrics = metrics.filter((metric) => metricSeverity(metric) === "critical").length;
  return [
    {
      key: "risk",
      label: "Performance Risk Score",
      value: `${assessment.performanceRiskScore}/100`,
      level: riskLevel(assessment.performanceRiskScore),
      severity: scoreSeverity(assessment.performanceRiskScore),
      description: "Riesgo agregado por saturacion, errores, drops, recursos e inestabilidad.",
      trend: hasHistoricalData ? "flat" : "unavailable"
    },
    {
      key: "confidence",
      label: "Confidence Score",
      value: `${assessment.confidenceScore}%`,
      level: assessment.confidenceScore >= 70 ? "Confiable" : "Limitado",
      severity: assessment.confidenceScore >= 70 ? "normal" : assessment.confidenceScore >= 45 ? "warning" : "high",
      description: "Confianza basada en cobertura, fuente y disponibilidad historica.",
      trend: hasHistoricalData ? "flat" : "unavailable"
    },
    {
      key: "coverage",
      label: "Data Coverage",
      value: `${assessment.dataCoverageScore}%`,
      level: `${coverage.withData} dispositivos con data`,
      severity: assessment.dataCoverageScore >= 70 ? "normal" : assessment.dataCoverageScore >= 45 ? "warning" : "high",
      description: "Cobertura de dispositivos, interfaces, metricas y evidencia historica.",
      trend: hasHistoricalData ? "flat" : "unavailable"
    },
    {
      key: "alerts",
      label: "Interfaces con alertas",
      value: String(alertInterfaces),
      level: `${criticalMetrics} metricas criticas`,
      severity: criticalMetrics > 0 ? "critical" : alertInterfaces > 0 ? "high" : "normal",
      description: "Interfaces con metricas sobre umbrales high o critical."
    }
  ];
}

function buildTimeSeriesCharts(metrics: PerformanceMetric[]): PerformanceDashboardData["timeSeriesCharts"] {
  const historical = metrics.filter((metric) => metric.sampleType === "historical");
  return Array.from(groupBy(historical, (metric) => `${metric.deviceId}:${metric.interfaceId ?? "device"}:${metric.metricType}`).entries()).map(([id, groupMetrics]) => ({
    id,
    metricType: groupMetrics[0].metricType,
    deviceId: groupMetrics[0].deviceId,
    interfaceId: groupMetrics[0].interfaceId,
    unit: groupMetrics[0].unit,
    points: groupMetrics.map((metric) => ({
      timestamp: metric.collectedAt ?? metric.timeWindow,
      value: metric.value,
      average: metric.value,
      percentile95: metric.value
    }))
  }));
}

function buildCriticalMetricsTable(metrics: PerformanceMetric[], limit = 80): PerformanceChartPoint[] {
  return metrics
    .filter((metric) => ["warning", "high", "critical"].includes(metricSeverity(metric)))
    .map((metric) => chartPoint(metric, {
      label: `${metric.deviceId} ${metric.interfaceId ?? "device"} ${metric.metricType}`,
      value: metric.value,
      unit: metric.unit,
      metrics: [metric],
      thresholdWarning: metric.thresholdWarning ?? thresholdForMetric(metric.metricType).warning,
      thresholdCritical: metric.thresholdCritical ?? thresholdForMetric(metric.metricType).critical
    }))
    .sort(sortBySeverityAndValue)
    .slice(0, limit);
}

function buildPerformanceInsights(assessmentId: string, metrics: PerformanceMetric[], findings: PerformanceFinding[], assessment: PerformanceAssessment): PerformanceInsight[] {
  const deterministic = buildCriticalMetricsTable(metrics, 12).map((point) => ({
    id: `pi_${point.id}`,
    assessmentId,
    insightType: insightTypeForMetric(point.metrics[0].metricType),
    sourceType: "deterministic_insight" as const,
    title: `${point.metrics[0].metricType.replace(/_/g, " ")} elevado en ${point.label}`,
    description: `${point.value}${point.unit} supera umbral ${point.thresholdWarning}/${point.thresholdCritical}.`,
    severity: point.severity === "normal" ? "warning" as const : point.severity,
    confidence: point.confidence,
    relatedMetrics: point.metrics.map((metric) => metric.id),
    relatedDevices: [point.deviceId],
    relatedInterfaces: point.interfaceId ? [point.interfaceId] : [],
    evidenceRefs: [point.evidenceRef],
    recommendation: recommendationForMetric(point.metrics[0].metricType)
  }));
  const fromFindings = findings
    .filter((finding) => finding.status !== "discarded")
    .filter((finding) => finding.evidence.length > 0)
    .filter((finding) => !finding.aiGenerated || finding.status === "validated" || finding.status === "ai_suggested")
    .map((finding) => ({
      id: `pi_${finding.id}`,
      assessmentId,
      insightType: finding.performanceCategory === "visibility_gap" ? "visibility_gap" as const : insightTypeForFinding(finding),
      sourceType: finding.status === "validated" ? "architect_validated" as const : finding.aiGenerated ? "ai_suggested" as const : "deterministic_insight" as const,
      title: finding.title,
      description: finding.impact,
      severity: normalizeInsightSeverity(finding.severity),
      confidence: Math.round(finding.confidence * 100),
      relatedMetrics: finding.metricRefs,
      relatedDevices: finding.affectedDeviceIds,
      relatedInterfaces: finding.affectedInterfaceIds,
      evidenceRefs: finding.evidence,
      recommendation: finding.recommendation,
      validationStatus: finding.status,
      probableCause: finding.probableCause,
      remediationCategory: finding.remediationCategory
    }));
  const visibility = assessment.visibilityGaps.map((gap) => ({
    id: `pi_gap_${stableId(gap)}`,
    assessmentId,
    insightType: "visibility_gap" as const,
    sourceType: "deterministic_insight" as const,
    title: "Brecha de visibilidad de performance",
    description: gap,
    severity: "warning" as const,
    confidence: Math.max(25, assessment.confidenceScore),
    relatedMetrics: [],
    relatedDevices: [],
    relatedInterfaces: [],
    evidenceRefs: [],
    recommendation: "Completar evidencia de performance para mejorar confianza del analisis.",
    validationStatus: "deterministic" as const,
    probableCause: "Evidencia incompleta o no reconocida por el parser de performance.",
    remediationCategory: "pending_validation"
  }));
  return dedupeBy([...fromFindings, ...deterministic, ...visibility], (insight) => insight.id).slice(0, 18);
}

const utilizationMetricTypes = new Set<PerformanceMetricType>(["utilization", "utilization_in", "utilization_out", "input_rate_bps", "output_rate_bps"]);
const errorMetricTypes = new Set<PerformanceMetricType>(["input_errors", "output_errors", "crc_errors", "frame_errors", "overruns", "ignored"]);
const dropMetricTypes = new Set<PerformanceMetricType>(["drops", "input_drops", "output_drops", "queue_drops", "qos_drops"]);
const instabilityMetricTypes = new Set<PerformanceMetricType>(["flaps", "routing_neighbor_stability"]);

function groupMetricsByInterface(metrics: PerformanceMetric[]) {
  return Array.from(groupBy(metrics, (metric) => `${metric.deviceId}:${metric.interfaceId ?? "device"}`).entries()).map(([key, groupMetrics]) => {
    const [deviceId, interfaceId] = key.split(":");
    return { deviceId, interfaceId: interfaceId === "device" ? undefined : interfaceId, metrics: groupMetrics };
  });
}

function chartPoint(metric: PerformanceMetric, override: Partial<PerformanceChartPoint> & { label: string; value: number; unit: string; metrics: PerformanceMetric[] }): PerformanceChartPoint {
  const threshold = thresholdForMetric(metric.metricType);
  const thresholdWarning = override.thresholdWarning ?? metric.thresholdWarning ?? threshold.warning;
  const thresholdCritical = override.thresholdCritical ?? metric.thresholdCritical ?? threshold.critical;
  return {
    id: metric.id,
    label: override.label,
    deviceId: metric.deviceId,
    interfaceId: metric.interfaceId,
    description: metric.interfaceDescription,
    value: override.value,
    secondaryValue: override.secondaryValue,
    unit: override.unit,
    thresholdWarning,
    thresholdCritical,
    severity: metricSeverity({ ...metric, value: override.value, thresholdWarning, thresholdCritical }),
    evidenceRef: `${metric.evidenceFileId} · ${metric.source} · ${metric.evidenceCommand ?? "comando no identificado"} · ${metric.metricType} ${metric.value}${metric.unit}`,
    evidenceFileId: metric.evidenceFileId,
    evidenceCommand: metric.evidenceCommand,
    evidenceSourceType: metric.sourceType,
    source: metric.source,
    sampleType: metric.sampleType,
    confidence: Math.round(metric.confidence * 100),
    metrics: override.metrics
  };
}

function thresholdForMetric(metricType: PerformanceMetricType) {
  if (utilizationMetricTypes.has(metricType)) return performanceThresholds.utilization;
  if (metricType === "cpu") return performanceThresholds.cpu;
  if (metricType === "memory") return performanceThresholds.memory;
  if (metricType === "crc_errors") return performanceThresholds.crcErrors;
  if (errorMetricTypes.has(metricType)) return performanceThresholds.inputErrors;
  if (dropMetricTypes.has(metricType)) return performanceThresholds.drops;
  if (metricType === "packet_loss") return performanceThresholds.packetLoss;
  if (metricType === "latency") return performanceThresholds.latencyMs;
  if (metricType === "jitter") return performanceThresholds.jitterMs;
  if (instabilityMetricTypes.has(metricType)) return performanceThresholds.instabilityEvents;
  return { warning: 1, high: 10, critical: 100 };
}

function metricSeverity(metric: Pick<PerformanceMetric, "metricType" | "value" | "thresholdWarning" | "thresholdCritical" | "severityHint">): PerformanceSeverity {
  if (metric.severityHint) return metric.severityHint;
  const threshold = thresholdForMetric(metric.metricType);
  const warning = metric.thresholdWarning ?? threshold.warning;
  const critical = metric.thresholdCritical ?? threshold.critical;
  const high = "high" in threshold ? threshold.high : (warning + critical) / 2;
  if (metric.value >= critical) return "critical";
  if (metric.value >= high) return "high";
  if (metric.value >= warning) return "warning";
  return "normal";
}

function metricBelongsToHealthCategory(metric: PerformanceMetric, category: PerformanceHealthCategory) {
  if (category === "utilization") return utilizationMetricTypes.has(metric.metricType);
  if (category === "errors") return errorMetricTypes.has(metric.metricType);
  if (category === "drops") return dropMetricTypes.has(metric.metricType);
  if (category === "cpu") return metric.metricType === "cpu";
  if (category === "memory") return metric.metricType === "memory";
  if (category === "instability") return instabilityMetricTypes.has(metric.metricType);
  if (category === "qos") return metric.metricType === "qos_drops";
  return false;
}

function maxMetric(metrics: PerformanceMetric[], types: PerformanceMetricType[]) {
  return metrics.filter((metric) => types.includes(metric.metricType)).sort((left, right) => right.value - left.value)[0];
}

function sumMetricValues(metrics: PerformanceMetric[], metricType: string) {
  return metrics.filter((metric) => metric.metricType === metricType).reduce((sum, metric) => sum + metric.value, 0);
}

function maxValue(metrics: PerformanceMetric[], metricType: PerformanceMetricType) {
  return Math.max(0, ...metrics.filter((metric) => metric.metricType === metricType).map((metric) => metric.value));
}

function sortBySeverityAndValue(left: PerformanceChartPoint, right: PerformanceChartPoint) {
  return severityScore(right.severity) - severityScore(left.severity) || right.value - left.value;
}

function severityScore(severity: PerformanceSeverity) {
  return { normal: 0, warning: 1, high: 2, critical: 3 }[severity];
}

function scoreToSeverity(score: number): PerformanceSeverity {
  if (score >= 3) return "critical";
  if (score >= 2) return "high";
  if (score >= 1) return "warning";
  return "normal";
}

function scoreSeverity(score: number): PerformanceSeverity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "warning";
  return "normal";
}

function riskLevel(score: number) {
  if (score >= 80) return "Critico";
  if (score >= 60) return "Alto";
  if (score >= 35) return "Moderado";
  return "Controlado";
}

function insightTypeForMetric(metricType: PerformanceMetricType): PerformanceInsight["insightType"] {
  if (utilizationMetricTypes.has(metricType)) return "saturation";
  if (errorMetricTypes.has(metricType)) return "errors";
  if (dropMetricTypes.has(metricType)) return metricType === "qos_drops" ? "qos_congestion" : "drops";
  if (metricType === "cpu" || metricType === "memory") return "resource_pressure";
  if (instabilityMetricTypes.has(metricType)) return "instability";
  return "capacity_risk";
}

function groupExecutivePriorities(priorities: DraftPerformanceTopPriority[]): DraftPerformanceTopPriority[] {
  const grouped = new Map<string, DraftPerformanceTopPriority[]>();
  for (const priority of priorities) {
    const primaryDevice = priority.affectedDevices[0] ?? priority.point?.deviceId ?? "assessment";
    const key = `${priority.category}:${primaryDevice}:${priority.recommendation}`;
    grouped.set(key, [...(grouped.get(key) ?? []), priority]);
  }
  return Array.from(grouped.values()).map((items) => {
    const first = items[0];
    const representative = items.find((item) => item.point) ?? first;
    const affectedDevices = Array.from(new Set(items.flatMap((item) => item.affectedDevices)));
    const affectedInterfaces = Array.from(new Set(items.flatMap((item) => item.affectedInterfaces)));
    const evidenceRefs = Array.from(new Set(items.flatMap((item) => item.evidenceRefs)));
    const severity = items.sort((left, right) => severityScore(right.severity) - severityScore(left.severity))[0].severity;
    const confidence = Math.round(items.reduce((sum, item) => sum + item.confidence, 0) / items.length);
    const target = affectedDevices.length === 1 ? affectedDevices[0] : `${affectedDevices.length} dispositivos`;
    return {
      ...first,
      id: `priority_group_${stableId(`${first.category}:${target}:${first.recommendation}:${affectedInterfaces.join(",")}`)}`,
      title: `${humanizeInsightType(first.category)} en ${target}`,
      affectedTarget: affectedInterfaces.length > 0 ? `${target} · ${affectedInterfaces.length} interface(s)` : target,
      severity,
      confidence,
      evidenceRefs,
      affectedDevices,
      affectedInterfaces,
      affectedMetricCount: items.reduce((sum, item) => sum + item.affectedMetricCount, 0),
      impact: impactForInsightType(first.category),
      point: representative.point,
      observedSummary: representative.observedSummary,
      validationStatus: items.some((item) => item.validationStatus === "validated") ? "validated" : first.validationStatus,
      probableCause: representative.probableCause,
      remediationCategory: representative.remediationCategory,
      evidenceCommand: representative.evidenceCommand,
      evidenceFile: representative.evidenceFile,
      sampleType: representative.sampleType,
      timeWindow: representative.timeWindow
    };
  });
}

function humanizeInsightType(type: PerformanceInsight["insightType"]) {
  const labels: Record<PerformanceInsight["insightType"], string> = {
    saturation: "saturacion de capacidad",
    errors: "errores fisicos/logicos",
    drops: "drops o descarte de paquetes",
    resource_pressure: "presion de recursos",
    instability: "inestabilidad operativa",
    visibility_gap: "brecha de visibilidad",
    capacity_risk: "riesgo de capacidad",
    qos_congestion: "congestion QoS"
  };
  return labels[type];
}

function humanizeHealthCategory(category: PerformanceHealthCategory) {
  const labels: Record<PerformanceHealthCategory, string> = {
    utilization: "utilizacion",
    errors: "errores",
    drops: "drops",
    cpu: "CPU",
    memory: "memoria",
    instability: "inestabilidad",
    qos: "QoS"
  };
  return labels[category];
}

function impactForInsightType(type: PerformanceInsight["insightType"]) {
  const impacts: Record<PerformanceInsight["insightType"], string> = {
    saturation: "Riesgo de degradacion o congestion en enlaces criticos.",
    errors: "Riesgo de retransmisiones, perdida de paquetes y degradacion intermitente.",
    drops: "Riesgo de descarte de trafico y afectacion a aplicaciones sensibles.",
    resource_pressure: "Riesgo de inestabilidad de plataforma o procesamiento lento.",
    instability: "Riesgo de reconvergencia, cortes intermitentes y perdida de disponibilidad.",
    visibility_gap: "Riesgo de tomar decisiones con evidencia incompleta.",
    capacity_risk: "Riesgo de agotamiento de capacidad si el patron se mantiene.",
    qos_congestion: "Riesgo de afectacion a trafico prioritario por colas o QoS."
  };
  return impacts[type];
}

function observedSummaryForPoint(point: PerformanceChartPoint) {
  const metricType = point.metrics[0]?.metricType.replace(/_/g, " ") ?? "metrica";
  return `${metricType} ${formatMetricValue(point.value, point.unit)} vs warn ${formatMetricValue(point.thresholdWarning, point.unit)} / crit ${formatMetricValue(point.thresholdCritical, point.unit)}`;
}

function formatMetricValue(value: number, unit: string) {
  if (!Number.isFinite(value) || value >= Number.MAX_SAFE_INTEGER / 2) return "N/A";
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return unit === "%" ? `${rounded}${unit}` : `${rounded} ${unit}`;
}

function insightTypeForFinding(finding: PerformanceFinding): PerformanceInsight["insightType"] {
  if (finding.performanceCategory === "resource_exhaustion") return "resource_pressure";
  if (finding.performanceCategory === "qos") return "qos_congestion";
  if (finding.performanceCategory === "capacity") return "capacity_risk";
  return finding.performanceCategory;
}

function normalizeInsightSeverity(severity: PerformanceFinding["severity"]): PerformanceInsight["severity"] {
  if (severity === "critical" || severity === "high") return severity;
  return "warning";
}

function recommendationForMetric(metricType: PerformanceMetricType) {
  if (utilizationMetricTypes.has(metricType)) return "Validar capacidad del enlace y confirmar recurrencia con historico.";
  if (errorMetricTypes.has(metricType)) return "Revisar capa fisica, transceiver, cableado y counters posteriores a clearing.";
  if (dropMetricTypes.has(metricType)) return "Revisar colas, QoS y oversubscription en el camino de trafico.";
  if (metricType === "cpu" || metricType === "memory") return "Validar procesos, features y dimensionamiento de plataforma.";
  return "Correlacionar con logs, topologia y ventana operacional.";
}

function probableCauseForMetric(metricType: PerformanceMetricType) {
  return probableCauseForInsightType(insightTypeForMetric(metricType));
}

function probableCauseForInsightType(type: PerformanceInsight["insightType"]) {
  const causes: Record<PerformanceInsight["insightType"], string> = {
    saturation: "Capacidad insuficiente, crecimiento de trafico o ventana operacional con picos recurrentes.",
    errors: "Posible degradacion fisica, transceiver/cableado, duplex/speed o counters acumulados sin clear.",
    drops: "Colas congestionadas, microbursts, buffers insuficientes u oversubscription.",
    resource_pressure: "Carga de procesos, features habilitados o dimensionamiento de plataforma cercano al limite.",
    instability: "Flaps de enlace, cambios STP/routing o inestabilidad fisica/logica intermitente.",
    visibility_gap: "Evidencia incompleta, snapshot aislado o ausencia de historico para confirmar recurrencia.",
    capacity_risk: "Patron de capacidad sin historico suficiente o tendencia que requiere validacion.",
    qos_congestion: "Congestion en colas, politica QoS restrictiva o trafico prioritario excediendo perfil."
  };
  return causes[type];
}

function remediationCategoryForInsightType(type: PerformanceInsight["insightType"]) {
  const categories: Record<PerformanceInsight["insightType"], string> = {
    saturation: "capacity_upgrade",
    errors: "operational_change",
    drops: "traffic_engineering",
    resource_pressure: "platform_tuning",
    instability: "pending_validation",
    visibility_gap: "pending_validation",
    capacity_risk: "capacity_planning",
    qos_congestion: "qos_tuning"
  };
  return categories[type];
}

function normalizeFilters(filters?: PerformanceDashboardFilters): Required<PerformanceDashboardFilters> {
  return {
    query: filters?.query ?? "",
    severity: filters?.severity ?? "all",
    metricType: filters?.metricType ?? "all",
    deviceId: filters?.deviceId ?? "",
    interfaceId: filters?.interfaceId ?? "",
    sourceType: filters?.sourceType ?? "",
    timeWindow: filters?.timeWindow ?? "all",
    sampleType: filters?.sampleType ?? "all",
    onlyCritical: Boolean(filters?.onlyCritical),
    showVisibilityGaps: filters?.showVisibilityGaps ?? true,
    healthCategory: filters?.healthCategory ?? "all"
  };
}

function filterFindingsForDashboard(findings: PerformanceFinding[], metrics: PerformanceMetric[], filters: Required<PerformanceDashboardFilters>) {
  const metricIds = new Set(metrics.map((metric) => metric.id));
  const query = filters.query.toLowerCase();
  return findings.filter((finding) => {
    if (finding.status === "discarded") return false;
    if (filters.deviceId && !finding.affectedDeviceIds.includes(filters.deviceId)) return false;
    if (filters.interfaceId && !finding.affectedInterfaceIds.includes(filters.interfaceId)) return false;
    if (filters.severity !== "all" && normalizeInsightSeverity(finding.severity) !== filters.severity) return false;
    if (query) {
      const haystack = `${finding.title} ${finding.impact} ${finding.recommendation} ${finding.affectedDeviceIds.join(" ")} ${finding.affectedInterfaceIds.join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (finding.metricRefs.length > 0) return finding.metricRefs.some((metricRef) => metricIds.has(metricRef));
    return finding.performanceCategory === "visibility_gap" && filters.showVisibilityGaps;
  });
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [keyFn(item), item])).values());
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
