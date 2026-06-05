import type { EvidenceFile, Finding, RemediationCategory } from "@/lib/types";

export type PerformanceAnalysisMode = "snapshot" | "historical" | "hybrid";
export type PerformanceEvidenceSourceType = "cli_snapshot" | "nms_export" | "telemetry_export" | "syslog" | "netflow" | "report" | "manual_upload";
export type PerformanceTimeWindow = "instant" | "24h" | "7d" | "30d" | "90d" | "custom";
export type PerformanceMetricType =
  | "utilization"
  | "utilization_in"
  | "utilization_out"
  | "input_rate_bps"
  | "output_rate_bps"
  | "input_errors"
  | "output_errors"
  | "crc_errors"
  | "frame_errors"
  | "overruns"
  | "ignored"
  | "drops"
  | "input_drops"
  | "output_drops"
  | "queue_drops"
  | "cpu"
  | "memory"
  | "latency"
  | "jitter"
  | "packet_loss"
  | "flaps"
  | "qos_drops"
  | "routing_neighbor_stability";

export type PerformanceRemediationCategory = RemediationCategory;

export type PerformanceScope = {
  enabled: boolean;
  mode: PerformanceAnalysisMode;
  expectedEvidenceTypes: string[];
  includedMetrics: string[];
  notes?: string;
};

export type PerformanceEvidenceFile = {
  id: string;
  assessmentId: string;
  fileName: string;
  fileType: string;
  sourceType: PerformanceEvidenceSourceType;
  vendor: string;
  deviceName: string;
  timeWindow: PerformanceTimeWindow;
  uploadedBy: string;
  uploadedAt: string;
  processingStatus: "pending" | "processing" | "processed" | "failed";
  parsedMetricCount: number;
  confidenceScore: number;
  notes?: string;
  content: string;
};

export type PerformanceMetric = {
  id: string;
  assessmentId: string;
  deviceId: string;
  deviceName?: string;
  deviceRole?: string;
  interfaceId?: string;
  interfaceName?: string;
  interfaceDescription?: string;
  metricType: PerformanceMetricType;
  value: number;
  unit: string;
  thresholdWarning?: number;
  thresholdCritical?: number;
  severityHint?: "normal" | "warning" | "high" | "critical";
  sampleType: "snapshot" | "historical";
  timeWindow: PerformanceTimeWindow;
  sourceType?: "cli" | "nms_export" | "telemetry" | "syslog" | "netflow" | "manual";
  source: string;
  evidenceFileId: string;
  evidenceCommand?: string;
  confidence: number;
  collectedAt?: string;
};

export type PerformanceFinding = {
  id: string;
  assessmentId: string;
  title: string;
  domain: "datacenter" | "enterprise_lan_wan" | "security_perimeter" | "operations";
  affectedDeviceIds: string[];
  affectedInterfaceIds: string[];
  severity: "low" | "medium" | "high" | "critical";
  performanceCategory: "saturation" | "errors" | "drops" | "resource_exhaustion" | "instability" | "qos" | "capacity" | "visibility_gap";
  metricRefs: string[];
  evidence: string[];
  impact: string;
  probableCause: string;
  recommendation: string;
  remediationCategory: PerformanceRemediationCategory;
  confidence: number;
  aiGenerated: boolean;
  status: "draft" | "ai_suggested" | "validated" | "discarded";
  relatedRiskDimensions: Array<"performance_capacity" | "resilience_availability" | "operations_support">;
};

export type PerformanceAssessment = {
  id: string;
  assessmentId: string;
  status: "draft" | "evidence_loaded" | "processed" | "ai_reviewed" | "validated";
  analysisMode: PerformanceAnalysisMode;
  dataCoverageScore: number;
  performanceRiskScore: number;
  confidenceScore: number;
  summary: string;
  criticalSymptoms: string[];
  visibilityGaps: string[];
  topMetrics: string[];
  recommendedActions: string[];
  limitations: string[];
  updatedAt: string;
};

export type PerformanceEvidenceSummary = {
  assessmentId: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  snapshotEvidenceCount: number;
  historicalEvidenceCount: number;
  detectedDevices: number;
  detectedInterfaces: number;
  detectedMetrics: number;
  dataCoverageScore: number;
  confidenceScore: number;
};

export type PerformanceChartType = "scorecard" | "horizontal_bar" | "vertical_bar" | "stacked_bar" | "line" | "area" | "heatmap" | "scatter" | "bubble" | "donut" | "table";

export type PerformanceChartData = {
  chartKey: string;
  assessmentId: string;
  title: string;
  description?: string;
  chartType?: PerformanceChartType;
  labels: string[];
  series: Array<{ name: string; values: number[]; unit: string }>;
  thresholds?: Record<string, number>;
  metadata: Record<string, string | number | boolean>;
  generatedAt: string;
};

export type PerformanceState = {
  evidenceFiles: PerformanceEvidenceFile[];
  metrics: PerformanceMetric[];
  findings: PerformanceFinding[];
  assessment: PerformanceAssessment;
  charts: PerformanceChartData[];
};

export const performanceIncludedMetrics = [
  "interface_utilization",
  "input_errors",
  "output_errors",
  "crc_errors",
  "drops",
  "cpu",
  "memory",
  "latency",
  "jitter",
  "packet_loss",
  "interface_flaps",
  "routing_neighbor_stability",
  "qos_drops",
  "capacity_trends"
];

export const performanceExpectedEvidenceTypes = [
  "CLI snapshot de interfaces y recursos",
  "CSV/XLSX de NMS si existe",
  "Syslog historico",
  "NetFlow/telemetria",
  "Reportes de latencia, perdida y jitter",
  "Reportes Catalyst Center, Nexus Dashboard o NDFC"
];

export const performanceStatusConfigCommands = [
  "show version",
  "show inventory",
  "show running-config",
  "show startup-config",
  "show interfaces status",
  "show interfaces description",
  "show interfaces",
  "show ip interface brief",
  "show cdp neighbors detail",
  "show lldp neighbors detail",
  "show vlan brief",
  "show spanning-tree",
  "show etherchannel summary",
  "show ip route",
  "show logging"
];

export const performanceCommandsByVendor = {
  cisco_ios_xe: [
    "show interfaces",
    "show interfaces counters errors",
    "show interfaces status",
    "show interfaces description",
    "show processes cpu sorted",
    "show memory statistics",
    "show logging",
    "show spanning-tree detail",
    "show etherchannel summary",
    "show platform resources",
    "show environment",
    "show ip ospf neighbor",
    "show bgp summary",
    "show policy-map interface",
    "show queueing interface"
  ],
  cisco_nxos: [
    "show interface",
    "show interface counters errors",
    "show interface transceiver details",
    "show port-channel summary",
    "show vpc",
    "show vpc consistency-parameters global",
    "show system resources",
    "show logging",
    "show queuing interface",
    "show policy-map interface",
    "show nve peers",
    "show bgp l2vpn evpn summary"
  ],
  cisco_asa_ftd: [
    "show interface",
    "show cpu usage",
    "show memory",
    "show conn count",
    "show asp drop",
    "show logging",
    "show failover",
    "show route"
  ],
  generic: ["show interfaces", "show logging"]
} satisfies Record<string, string[]>;

export function createDefaultPerformanceScope(): PerformanceScope {
  return {
    enabled: false,
    mode: "snapshot",
    expectedEvidenceTypes: performanceExpectedEvidenceTypes,
    includedMetrics: performanceIncludedMetrics,
    notes: ""
  };
}

export function createDefaultPerformanceState(assessmentId: string, mode: PerformanceAnalysisMode = "snapshot"): PerformanceState {
  return {
    evidenceFiles: [],
    metrics: [],
    findings: [],
    charts: [],
    assessment: {
      id: `perf_${assessmentId}`,
      assessmentId,
      status: "draft",
      analysisMode: mode,
      dataCoverageScore: 0,
      performanceRiskScore: 0,
      confidenceScore: 0,
      summary: "Analisis de performance pendiente de evidencia.",
      criticalSymptoms: [],
      visibilityGaps: ["No se ha cargado evidencia de performance."],
      topMetrics: [],
      recommendedActions: [],
      limitations: ["Sin evidencia no es posible concluir estado de performance."],
      updatedAt: new Date().toISOString()
    }
  };
}

export function classifyPerformanceEvidence(fileName: string, content = "") {
  const lower = `${fileName}\n${content.slice(0, 1000)}`.toLowerCase();
  const fileType = fileName.split(".").pop()?.toLowerCase() || "txt";
  const sourceType: PerformanceEvidenceSourceType =
    /\.(csv|xlsx)$/i.test(fileName) ? "nms_export" :
    /\.pdf$/i.test(fileName) ? "report" :
    /netflow|flow/.test(lower) ? "netflow" :
    /syslog|logging/.test(lower) ? "syslog" :
    /telemetry|ndfc|nexus dashboard|catalyst center|dnac|thousandeyes|prtg|solarwinds|zabbix|librenms/.test(lower) ? "telemetry_export" :
    /show[-_\s]?interfaces|show[-_\s]?interface|show[-_\s]?processes[-_\s]?cpu|show[-_\s]?system[-_\s]?resources|show[-_\s]?memory/.test(lower) ? "cli_snapshot" :
    "manual_upload";
  const timeWindow: PerformanceTimeWindow = /90d|90 d|90 days|trimestre/.test(lower) ? "90d" :
    /30d|30 d|30 days|mensual/.test(lower) ? "30d" :
    /7d|7 d|7 days|semanal/.test(lower) ? "7d" :
    /24h|24 h|daily|diario/.test(lower) ? "24h" :
    sourceType === "cli_snapshot" ? "instant" : "custom";
  const deviceName = detectDeviceName(fileName, content);
  return { fileType, sourceType, timeWindow, deviceName, vendor: detectVendor(content) };
}

export function processPerformanceEvidence(assessmentId: string, files: PerformanceEvidenceFile[], mode: PerformanceAnalysisMode): {
  files: PerformanceEvidenceFile[];
  metrics: PerformanceMetric[];
  summary: PerformanceEvidenceSummary;
} {
  const metrics = files.flatMap((file) => parsePerformanceMetrics(assessmentId, file));
  const processedFiles = files.map((file) => ({
    ...file,
    deviceName: performanceFileDeviceLabel(file, metrics),
    processingStatus: "processed" as const,
    parsedMetricCount: metrics.filter((metric) => metric.evidenceFileId === file.id).length,
    confidenceScore: file.timeWindow === "instant" ? 55 : 75
  }));
  return {
    files: processedFiles,
    metrics,
    summary: summarizePerformanceEvidence(assessmentId, processedFiles, metrics, mode)
  };
}

export function calculatePerformanceRiskScore(metrics: PerformanceMetric[], summary: PerformanceEvidenceSummary, mode: PerformanceAnalysisMode) {
  let score = 0;
  const contributors: string[] = [];
  const criticalMetrics = metrics.filter((metric) => isCriticalMetric(metric));
  for (const metric of criticalMetrics) {
    score += metricRiskContribution(metric);
    contributors.push(metricLabel(metric));
  }
  if (summary.historicalEvidenceCount === 0 && mode !== "snapshot") {
    score += 12;
    contributors.push("Sin historico suficiente para tendencias/capacidad");
  }
  if (summary.dataCoverageScore < 50) {
    score += 10;
    contributors.push("Cobertura de datos insuficiente");
  }
  return {
    score: Math.min(100, Math.round(score)),
    contributors: Array.from(new Set(contributors)).slice(0, 8)
  };
}

export function generatePerformanceFindings(assessmentId: string, metrics: PerformanceMetric[], summary: PerformanceEvidenceSummary, mode: PerformanceAnalysisMode): PerformanceFinding[] {
  const findings: PerformanceFinding[] = [];
  const critical = metrics.filter((metric) => isCriticalMetric(metric));
  for (const metric of critical.slice(0, 12)) {
    findings.push(metricToFinding(assessmentId, metric));
  }
  if (summary.historicalEvidenceCount === 0 && mode !== "snapshot") {
    findings.push({
      id: `PF-${stableId(`${assessmentId}-visibility`)}`,
      assessmentId,
      title: "Brecha de visibilidad historica para performance",
      domain: "operations",
      affectedDeviceIds: [],
      affectedInterfaceIds: [],
      severity: "medium",
      performanceCategory: "visibility_gap",
      metricRefs: [],
      evidence: ["No se identificaron archivos historicos de performance."],
      impact: "Reduce la confianza para evaluar tendencias, capacidad y recurrencia.",
      probableCause: "Evidencia limitada a snapshot o ausencia de exportes historicos.",
      recommendation: "Solicitar reportes NMS/telemetria de 7, 30 o 90 dias para validar tendencias.",
      remediationCategory: "pending_validation",
      confidence: 0.7,
      aiGenerated: false,
      status: "draft",
      relatedRiskDimensions: ["performance_capacity", "operations_support"]
    });
  }
  return findings;
}

export function buildPerformanceAssessment(assessmentId: string, mode: PerformanceAnalysisMode, files: PerformanceEvidenceFile[], metrics: PerformanceMetric[]): PerformanceAssessment {
  const summary = summarizePerformanceEvidence(assessmentId, files, metrics, mode);
  const risk = calculatePerformanceRiskScore(metrics, summary, mode);
  const findings = generatePerformanceFindings(assessmentId, metrics, summary, mode);
  const confidencePenalty = mode !== "snapshot" && summary.historicalEvidenceCount === 0 ? 20 : 0;
  return {
    id: `perf_${assessmentId}`,
    assessmentId,
    status: files.length === 0 ? "draft" : metrics.length > 0 ? "processed" : "evidence_loaded",
    analysisMode: mode,
    dataCoverageScore: summary.dataCoverageScore,
    performanceRiskScore: risk.score,
    confidenceScore: Math.max(0, summary.confidenceScore - confidencePenalty),
    summary: metrics.length > 0
      ? `Se procesaron ${metrics.length} metricas de performance. Principales contribuyentes: ${risk.contributors.slice(0, 3).join(", ") || "sin sintomas criticos"}.`
      : "Evidencia de performance pendiente de procesar o sin metricas reconocidas.",
    criticalSymptoms: risk.contributors,
    visibilityGaps: visibilityGaps(summary, mode),
    topMetrics: metrics.filter(isCriticalMetric).slice(0, 5).map(metricLabel),
    recommendedActions: performanceRecommendations(findings, summary),
    limitations: performanceLimitations(summary, mode),
    updatedAt: new Date().toISOString()
  };
}

export function buildPerformanceCharts(assessmentId: string, metrics: PerformanceMetric[]): PerformanceChartData[] {
  const now = new Date().toISOString();
  return [
    chartFromMetrics("top-interface-utilization", assessmentId, "Top interfaces por utilizacion", metrics, "utilization", now),
    chartFromMetrics("top-interface-errors", assessmentId, "Top interfaces por errores", metrics, "input_errors", now),
    chartFromMetrics("top-interface-drops", assessmentId, "Top interfaces por drops", metrics, "drops", now),
    chartFromMetrics("cpu-by-device", assessmentId, "CPU por dispositivo", metrics, "cpu", now),
    chartFromMetrics("memory-by-device", assessmentId, "Memoria por dispositivo", metrics, "memory", now),
    chartFromMetrics("flaps-by-device", assessmentId, "Eventos/flaps por dispositivo", metrics, "flaps", now)
  ].filter((chart) => chart.labels.length > 0);
}

export function buildPerformanceAIContext(input: {
  assessmentId: string;
  scope: PerformanceScope;
  evidenceFiles: PerformanceEvidenceFile[];
  metrics: PerformanceMetric[];
  assessment: PerformanceAssessment;
  findings: PerformanceFinding[];
  charts: PerformanceChartData[];
}) {
  return {
    instruction: "Analiza solo metricas, evidencia y brechas provistas. No inventes datos.",
    assessmentId: input.assessmentId,
    scope: input.scope,
    status: input.assessment.status,
    scores: {
      performanceRiskScore: input.assessment.performanceRiskScore,
      confidenceScore: input.assessment.confidenceScore,
      dataCoverageScore: input.assessment.dataCoverageScore
    },
    evidence: input.evidenceFiles.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      sourceType: file.sourceType,
      timeWindow: file.timeWindow,
      parsedMetricCount: file.parsedMetricCount,
      confidenceScore: file.confidenceScore
    })),
    criticalMetrics: input.metrics.filter(isCriticalMetric).map((metric) => ({
      id: metric.id,
      type: metric.metricType,
      device: metric.deviceId,
      interface: metric.interfaceId,
      value: metric.value,
      unit: metric.unit,
      source: metric.source,
      evidenceFileId: metric.evidenceFileId,
      confidence: metric.confidence
    })),
    charts: input.charts.map((chart) => ({ chartKey: chart.chartKey, title: chart.title, points: chart.labels.length })),
    preliminaryFindings: input.findings.map((finding) => ({
      id: finding.id,
      title: finding.title,
      category: finding.performanceCategory,
      evidence: finding.evidence,
      confidence: finding.confidence,
      status: finding.status
    })),
    visibilityGaps: input.assessment.visibilityGaps,
    limitations: input.assessment.limitations
  };
}

export function performanceFindingsToGenericFindings(findings: PerformanceFinding[]): Finding[] {
  return findings
    .filter((finding) => finding.evidence.length > 0 && finding.confidence > 0)
    .map((finding) => ({
      id: finding.id,
      title: finding.title,
      category: "operations",
      risk: finding.severity,
      affectedAssets: [...finding.affectedDeviceIds, ...finding.affectedInterfaceIds],
      evidence: finding.evidence,
      recommendation: finding.recommendation,
      remediationCategory: finding.remediationCategory,
      serviceOffer: "Performance Analysis",
      confidence: finding.confidence,
      status:
        finding.status === "validated"
          ? "validated"
          : finding.status === "discarded"
            ? "discarded"
            : finding.status === "ai_suggested"
              ? "ai_suggested"
              : "ai-draft"
    }));
}

function parsePerformanceMetrics(assessmentId: string, file: PerformanceEvidenceFile): PerformanceMetric[] {
  const metrics: PerformanceMetric[] = [];
  const sampleType = file.timeWindow === "instant" ? "snapshot" : "historical";

  for (const section of splitPerformanceDeviceSections(file)) {
    const sectionFile = { ...file, content: section.content, deviceName: section.deviceName };
    const cpuMatch = section.content.match(/(?:CPU utilization|CPU states|CPU usage|show processes cpu)[^\n]*?(\d+(?:\.\d+)?)\s*%/i);
    if (cpuMatch) metrics.push(metric(assessmentId, sectionFile, section.deviceName, undefined, "cpu", Number(cpuMatch[1]), "%", sampleType));

    const memoryPercent = parseMemoryPercent(section.content);
    if (memoryPercent > 0) metrics.push(metric(assessmentId, sectionFile, section.deviceName, undefined, "memory", memoryPercent, "%", sampleType));

    metrics.push(...parseInterfaceBlocks(assessmentId, sectionFile, sampleType));
    metrics.push(...parseInstabilityEvents(assessmentId, sectionFile, sampleType));
    metrics.push(...parseQosDrops(assessmentId, sectionFile, sampleType));

    for (const line of section.content.split(/\r?\n/)) {
      const interfaceName = line.match(/^(?:interface\s+)?((?:Gi|Te|Eth|Ethernet|Port-channel|Po|Hu|Twe|Fo|Fa)[\w/.-]+)/i)?.[1];
      if (!interfaceName) continue;
      const inputErrors = numberAfter(line, /input errors?|in errors?/i);
      const outputErrors = numberAfter(line, /output errors?|out errors?/i);
      const crc = numberAfter(line, /\bcrc\b/i);
      const inputDrops = numberAfter(line, /input drops?|input discard/i);
      const outputDrops = numberAfter(line, /output drops?|output discard/i);
      const drops = numberAfter(line, /drops?|discard/i);
      const utilization = percentAfter(line, /util|rate|load/i);
      if (inputErrors > 0) metrics.push(metric(assessmentId, sectionFile, section.deviceName, interfaceName, "input_errors", inputErrors, "count", sampleType));
      if (outputErrors > 0) metrics.push(metric(assessmentId, sectionFile, section.deviceName, interfaceName, "output_errors", outputErrors, "count", sampleType));
      if (crc > 0) metrics.push(metric(assessmentId, sectionFile, section.deviceName, interfaceName, "crc_errors", crc, "count", sampleType));
      if (inputDrops > 0) metrics.push(metric(assessmentId, sectionFile, section.deviceName, interfaceName, "input_drops", inputDrops, "count", sampleType));
      if (outputDrops > 0) metrics.push(metric(assessmentId, sectionFile, section.deviceName, interfaceName, "output_drops", outputDrops, "count", sampleType));
      if (drops > 0) metrics.push(metric(assessmentId, sectionFile, section.deviceName, interfaceName, "drops", drops, "count", sampleType));
      if (utilization > 0) metrics.push(metric(assessmentId, sectionFile, section.deviceName, interfaceName, "utilization", utilization, "%", sampleType));
    }
  }

  return dedupeMetrics(metrics);
}

function summarizePerformanceEvidence(assessmentId: string, files: PerformanceEvidenceFile[], metrics: PerformanceMetric[], mode: PerformanceAnalysisMode): PerformanceEvidenceSummary {
  const devices = new Set(metrics.map((metricItem) => metricItem.deviceId).filter(Boolean));
  const interfaces = new Set(metrics.map((metricItem) => metricItem.interfaceId).filter(Boolean));
  const metricTypes = new Set(metrics.map((metricItem) => metricItem.metricType));
  const historicalEvidenceCount = files.filter((file) => file.timeWindow !== "instant").length;
  const dataCoverageScore = Math.min(100, Math.round(metricTypes.size * 7 + devices.size * 8 + historicalEvidenceCount * 12));
  const confidenceBase = files.length === 0 ? 0 : Math.min(85, 35 + metricTypes.size * 5 + historicalEvidenceCount * 15 + (mode === "snapshot" ? 10 : 0));
  return {
    assessmentId,
    totalFiles: files.length,
    processedFiles: files.filter((file) => file.processingStatus === "processed").length,
    failedFiles: files.filter((file) => file.processingStatus === "failed").length,
    snapshotEvidenceCount: files.filter((file) => file.timeWindow === "instant").length,
    historicalEvidenceCount,
    detectedDevices: devices.size,
    detectedInterfaces: interfaces.size,
    detectedMetrics: metrics.length,
    dataCoverageScore,
    confidenceScore: files.length > 0 && metrics.length === 0 ? 25 : confidenceBase
  };
}

function metric(assessmentId: string, file: PerformanceEvidenceFile, deviceId: string, interfaceId: string | undefined, metricType: PerformanceMetricType, value: number, unit: string, sampleType: "snapshot" | "historical"): PerformanceMetric {
  const thresholds = metricThresholds(metricType);
  return {
    id: `pm_${stableId(`${file.id}-${deviceId}-${interfaceId ?? "device"}-${metricType}-${value}`)}`,
    assessmentId,
    deviceId: deviceId || "unknown-device",
    deviceName: deviceId || "unknown-device",
    interfaceId,
    interfaceName: interfaceId,
    metricType,
    value,
    unit,
    thresholdWarning: thresholds.warning,
    thresholdCritical: thresholds.critical,
    severityHint: metricSeverityHint(metricType, value),
    sampleType,
    timeWindow: file.timeWindow,
    sourceType: normalizeMetricSourceType(file.sourceType),
    source: file.fileName,
    evidenceFileId: file.id,
    evidenceCommand: inferPerformanceCommand(metricType),
    confidence: sampleType === "historical" ? 0.8 : 0.6,
    collectedAt: file.uploadedAt
  };
}

function metricToFinding(assessmentId: string, metricItem: PerformanceMetric): PerformanceFinding {
  const category = metricCategory(metricItem.metricType);
  return {
    id: `PF-${stableId(metricItem.id).slice(0, 6).toUpperCase()}`,
    assessmentId,
    title: `${metricTitle(metricItem.metricType)} en ${metricItem.interfaceId || metricItem.deviceId}`,
    domain: "enterprise_lan_wan",
    affectedDeviceIds: [metricItem.deviceId],
    affectedInterfaceIds: metricItem.interfaceId ? [metricItem.interfaceId] : [],
    severity: metricSeverity(metricItem),
    performanceCategory: category,
    metricRefs: [metricItem.id],
    evidence: [`${metricItem.source}: ${metricLabel(metricItem)}`],
    impact: "Puede degradar disponibilidad, estabilidad o experiencia de usuarios/aplicaciones.",
    probableCause: "Saturacion, errores fisicos/logicos, drops o presion de recursos. Requiere validacion tecnica.",
    recommendation: metricRecommendation(metricItem.metricType),
    remediationCategory: category === "capacity" || category === "resource_exhaustion" ? "new_technology" : "operational_change",
    confidence: metricItem.confidence,
    aiGenerated: false,
    status: "draft",
    relatedRiskDimensions: ["performance_capacity", "resilience_availability", "operations_support"]
  };
}

function chartFromMetrics(chartKey: string, assessmentId: string, title: string, metrics: PerformanceMetric[], metricType: PerformanceMetricType, generatedAt: string): PerformanceChartData {
  const selected = metrics
    .filter((metricItem) => metricItem.metricType === metricType)
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
  return {
    chartKey,
    assessmentId,
    title,
    labels: selected.map((metricItem) => metricItem.interfaceId ? `${metricItem.deviceId} ${metricItem.interfaceId}` : metricItem.deviceId),
    series: [{ name: title, values: selected.map((metricItem) => metricItem.value), unit: selected[0]?.unit ?? "" }],
    metadata: { metricType, sampleCount: selected.length },
    generatedAt
  };
}

function performanceFileDeviceLabel(file: PerformanceEvidenceFile, metrics: PerformanceMetric[]) {
  const devices = Array.from(new Set(metrics.filter((metricItem) => metricItem.evidenceFileId === file.id).map((metricItem) => metricItem.deviceId).filter(Boolean)));
  if (devices.length > 1) return `${devices.length} dispositivos`;
  return devices[0] || file.deviceName;
}

function detectDeviceName(fileName: string, content: string) {
  return content.match(/^hostname\s+(\S+)/im)?.[1] || content.match(/^([A-Za-z0-9][\w.-]{0,63})[>#]\s*(?:show|sh\b|display|terminal|do\s+show)/im)?.[1] || fileName.replace(/\.[^.]+$/, "");
}

function detectVendor(content: string) {
  if (/nx-os|nexus|n9k|n7k/i.test(content)) return "cisco_nxos";
  if (/adaptive security|ftd|asa/i.test(content)) return "cisco_asa_ftd";
  if (/ios xe|catalyst|show processes cpu/i.test(content)) return "cisco_ios_xe";
  return "generic";
}

function splitPerformanceDeviceSections(file: PerformanceEvidenceFile) {
  const sections: Array<{ deviceName: string; content: string }> = [];
  const lines = file.content.split(/\r?\n/);
  let currentDevice = file.deviceName || "unknown-device";
  let currentLines: string[] = [];
  let markerCount = 0;

  for (const line of lines) {
    const deviceMarker = detectDeviceMarker(line);
    if (deviceMarker) {
      if (currentLines.some((currentLine) => currentLine.trim())) {
        sections.push({ deviceName: currentDevice, content: currentLines.join("\n") });
      }
      currentDevice = deviceMarker;
      currentLines = [line];
      markerCount += 1;
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.some((line) => line.trim())) {
    sections.push({ deviceName: currentDevice, content: currentLines.join("\n") });
  }

  if (markerCount === 0 || sections.length === 0) {
    return [{ deviceName: file.deviceName || "unknown-device", content: file.content }];
  }

  return sections.map((section) => ({
    ...section,
    deviceName: section.deviceName || file.deviceName || "unknown-device"
  }));
}

function detectDeviceMarker(line: string) {
  const hostnameMatch = line.match(/^hostname\s+(\S+)/i);
  if (hostnameMatch) return hostnameMatch[1];
  const promptMatch = line.match(/^([A-Za-z0-9][\w.-]{0,63})[>#]\s*(?:show|sh\b|display|terminal|do\s+show)/i);
  return promptMatch?.[1];
}

function numberAfter(line: string, label: RegExp) {
  const index = line.search(label);
  if (index < 0) return 0;
  const match = line.slice(index).match(/(?:input errors?|in errors?|output errors?|out errors?|\bcrc\b|drops?|discard|overrun|ignored|frame)\D*(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : 0;
}

function percentAfter(line: string, label: RegExp) {
  if (!label.test(line)) return 0;
  const match = line.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : 0;
}

function parseInterfaceBlocks(assessmentId: string, file: PerformanceEvidenceFile, sampleType: "snapshot" | "historical") {
  const metrics: PerformanceMetric[] = [];
  const blocks = file.content.split(/\n(?=(?:[A-Z][\w.-]*(?:Ethernet|Channel|Vlan|Tunnel|Serial)|(?:Gi|Te|Eth|Hu|Twe|Fo|Fa|Po)\S+)\s+is\s+)/i);
  for (const block of blocks) {
    const interfaceName = block.match(/^((?:[A-Z][\w.-]*(?:Ethernet|Channel|Vlan|Tunnel|Serial)|(?:Gi|Te|Eth|Hu|Twe|Fo|Fa|Po)[\w/.-]+))/i)?.[1];
    if (!interfaceName) continue;
    const bandwidthKbit = Number(block.match(/\bBW\s+(\d+)\s+Kbit/i)?.[1] ?? 0);
    const inputRateBps = Number(block.match(/input rate\s+(\d+)\s+bits\/sec/i)?.[1] ?? 0);
    const outputRateBps = Number(block.match(/output rate\s+(\d+)\s+bits\/sec/i)?.[1] ?? 0);
    const inputErrors = Number(block.match(/(\d+)\s+input errors/i)?.[1] ?? 0);
    const outputErrors = Number(block.match(/(\d+)\s+output errors/i)?.[1] ?? 0);
    const crc = Number(block.match(/(\d+)\s+CRC/i)?.[1] ?? 0);
    const frame = Number(block.match(/(\d+)\s+frame/i)?.[1] ?? 0);
    const overruns = Number(block.match(/(\d+)\s+overrun/i)?.[1] ?? 0);
    const ignored = Number(block.match(/(\d+)\s+ignored/i)?.[1] ?? 0);
    const outputDrops = Number(block.match(/Total output drops:\s*(\d+)/i)?.[1] ?? 0);
    const inputDrops = Number(block.match(/(\d+)\s+input queue drops/i)?.[1] ?? 0);
    const resets = Number(block.match(/(\d+)\s+interface resets/i)?.[1] ?? 0);
    const carrierTransitions = Number(block.match(/(\d+)\s+carrier transitions/i)?.[1] ?? 0);
    const rxload = loadFractionToPercent(block.match(/rxload\s+(\d+)\/255/i)?.[1]);
    const txload = loadFractionToPercent(block.match(/txload\s+(\d+)\/255/i)?.[1]);

    if (inputRateBps > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "input_rate_bps", inputRateBps, "bps", sampleType));
    if (outputRateBps > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "output_rate_bps", outputRateBps, "bps", sampleType));
    if (bandwidthKbit > 0 && inputRateBps > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "utilization_in", Math.round((inputRateBps / (bandwidthKbit * 1000)) * 1000) / 10, "%", sampleType));
    if (bandwidthKbit > 0 && outputRateBps > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "utilization_out", Math.round((outputRateBps / (bandwidthKbit * 1000)) * 1000) / 10, "%", sampleType));
    if (rxload > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "utilization_in", rxload, "%", sampleType));
    if (txload > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "utilization_out", txload, "%", sampleType));
    if (inputErrors > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "input_errors", inputErrors, "count", sampleType));
    if (outputErrors > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "output_errors", outputErrors, "count", sampleType));
    if (crc > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "crc_errors", crc, "count", sampleType));
    if (frame > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "frame_errors", frame, "count", sampleType));
    if (overruns > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "overruns", overruns, "count", sampleType));
    if (ignored > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "ignored", ignored, "count", sampleType));
    if (inputDrops > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "input_drops", inputDrops, "count", sampleType));
    if (outputDrops > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "output_drops", outputDrops, "count", sampleType));
    if (resets > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "flaps", resets, "count", sampleType));
    if (carrierTransitions > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "flaps", carrierTransitions, "count", sampleType));
  }
  return metrics;
}

function parseInstabilityEvents(assessmentId: string, file: PerformanceEvidenceFile, sampleType: "snapshot" | "historical") {
  const text = file.content;
  const events = [
    { type: "flaps" as const, pattern: /LINEPROTO|LINK-\d+-CHANGED|carrier transitions|interface resets/gi },
    { type: "routing_neighbor_stability" as const, pattern: /OSPF-5-ADJCHG|BGP.*(Down|Active|Idle)|neighbor.*down/gi },
    { type: "flaps" as const, pattern: /SPANTREE|topology change|CANNOT_BUNDLE|vPC.*consistency|port-channel.*down/gi }
  ];
  return events.flatMap((event) => {
    const count = Array.from(text.matchAll(event.pattern)).length;
    return count > 0 ? [metric(assessmentId, file, file.deviceName, undefined, event.type, count, "events", sampleType)] : [];
  });
}

function parseQosDrops(assessmentId: string, file: PerformanceEvidenceFile, sampleType: "snapshot" | "historical") {
  const metrics: PerformanceMetric[] = [];
  for (const line of file.content.split(/\r?\n/)) {
    if (!/drop|exceed|violate|queue/i.test(line)) continue;
    const interfaceName = line.match(/((?:Gi|Te|Eth|Ethernet|Port-channel|Po|Hu|Twe|Fo|Fa)[\w/.-]+)/i)?.[1];
    const value = Number(line.match(/(?:drop|drops|exceed|violate)\D+(\d+)/i)?.[1] ?? 0);
    if (value > 0) metrics.push(metric(assessmentId, file, file.deviceName, interfaceName, "qos_drops", value, "count", sampleType));
  }
  return metrics;
}

function parseMemoryPercent(content: string) {
  const usedFreeMatch = content.match(/Processor Pool Total:\s*(\d+)\s+Used:\s*(\d+)\s+Free:\s*(\d+)/i);
  if (usedFreeMatch) {
    const total = Number(usedFreeMatch[1]);
    const used = Number(usedFreeMatch[2]);
    return total > 0 ? Math.round((used / total) * 100) : 0;
  }
  const directMatch = content.match(/(?:memory|processor pool|used memory)[^\n]*?(\d+(?:\.\d+)?)\s*%/i);
  if (directMatch) return Number(directMatch[1]);
  return 0;
}

function loadFractionToPercent(value: string | undefined) {
  if (!value) return 0;
  return Math.round((Number(value) / 255) * 1000) / 10;
}

function dedupeMetrics(metrics: PerformanceMetric[]) {
  return Array.from(new Map(metrics.map((metricItem) => [metricItem.id, metricItem])).values());
}

function isCriticalMetric(metricItem: PerformanceMetric) {
  if (metricItem.metricType === "utilization" || metricItem.metricType === "utilization_in" || metricItem.metricType === "utilization_out") return metricItem.value >= 80;
  if (metricItem.metricType === "cpu" || metricItem.metricType === "memory") return metricItem.value >= 75;
  if (metricItem.metricType === "crc_errors") return metricItem.value > 0;
  if (["input_errors", "output_errors", "frame_errors", "overruns", "ignored", "drops", "input_drops", "output_drops", "queue_drops", "qos_drops"].includes(metricItem.metricType)) return metricItem.value >= 10;
  if (metricItem.metricType === "flaps" || metricItem.metricType === "routing_neighbor_stability") return metricItem.value >= 3;
  return false;
}

function metricRiskContribution(metricItem: PerformanceMetric) {
  if (metricItem.metricType === "utilization" || metricItem.metricType === "utilization_in" || metricItem.metricType === "utilization_out") return metricItem.value >= 90 ? 18 : 12;
  if (metricItem.metricType === "cpu" || metricItem.metricType === "memory") return metricItem.value >= 90 ? 16 : 10;
  if (metricItem.metricType === "crc_errors") return 14;
  if (["drops", "input_drops", "output_drops", "queue_drops", "qos_drops"].includes(metricItem.metricType)) return 12;
  return 8;
}

function metricSeverity(metricItem: PerformanceMetric): PerformanceFinding["severity"] {
  const hint = metricItem.severityHint ?? metricSeverityHint(metricItem.metricType, metricItem.value);
  if (hint === "critical") return "critical";
  if (hint === "high") return "high";
  if (hint === "warning") return "medium";
  if (metricItem.metricType === "crc_errors" || metricItem.value >= 90) return "critical";
  if (metricItem.value >= 75 || ["drops", "input_drops", "output_drops", "queue_drops", "input_errors", "output_errors"].includes(metricItem.metricType)) return "high";
  return "medium";
}

function metricCategory(metricType: PerformanceMetricType): PerformanceFinding["performanceCategory"] {
  if (metricType === "utilization" || metricType === "utilization_in" || metricType === "utilization_out" || metricType === "input_rate_bps" || metricType === "output_rate_bps") return "saturation";
  if (metricType === "cpu" || metricType === "memory") return "resource_exhaustion";
  if (["drops", "input_drops", "output_drops", "queue_drops"].includes(metricType)) return "drops";
  if (metricType === "qos_drops") return "qos";
  if (metricType === "flaps" || metricType === "routing_neighbor_stability") return "instability";
  if (["input_errors", "output_errors", "crc_errors", "frame_errors", "overruns", "ignored"].includes(metricType)) return "errors";
  return "capacity";
}

function metricTitle(metricType: PerformanceMetricType) {
  return metricType.replace(/_/g, " ");
}

function metricLabel(metricItem: PerformanceMetric) {
  return `${metricTitle(metricItem.metricType)} ${metricItem.value}${metricItem.unit} (${metricItem.deviceId}${metricItem.interfaceId ? ` ${metricItem.interfaceId}` : ""})`;
}

function metricRecommendation(metricType: PerformanceMetricType) {
  if (metricType === "crc_errors") return "Validar capa fisica, transceiver/cableado, errores de puerto y reemplazo preventivo si aplica.";
  if (metricType === "utilization") return "Validar capacidad del enlace, patrones de trafico y necesidad de upgrade o redistribucion.";
  if (metricType === "cpu" || metricType === "memory") return "Revisar procesos, features habilitados y dimensionamiento de plataforma.";
  if (metricType === "drops" || metricType === "qos_drops") return "Revisar colas, politicas QoS, oversubscription y congestiones intermitentes.";
  return "Validar metrica con historico y correlacionar con logs/eventos.";
}

function performanceRecommendations(findings: PerformanceFinding[], summary: PerformanceEvidenceSummary) {
  const actions = findings.slice(0, 4).map((finding) => finding.recommendation);
  if (summary.historicalEvidenceCount === 0) actions.push("Solicitar historico de 7/30 dias para validar tendencias y recurrencia.");
  return Array.from(new Set(actions));
}

function visibilityGaps(summary: PerformanceEvidenceSummary, mode: PerformanceAnalysisMode) {
  const gaps: string[] = [];
  if (summary.totalFiles === 0) gaps.push("No hay evidencia de performance cargada.");
  if (summary.detectedMetrics === 0 && summary.totalFiles > 0) gaps.push("Evidencia cargada sin metricas reconocidas por el parser.");
  if (summary.historicalEvidenceCount === 0 && mode !== "snapshot") gaps.push("No se identifico historico para tendencias/capacidad.");
  return gaps;
}

function performanceLimitations(summary: PerformanceEvidenceSummary, mode: PerformanceAnalysisMode) {
  const limitations: string[] = [];
  if (summary.snapshotEvidenceCount > 0 && summary.historicalEvidenceCount === 0) limitations.push("Analisis basado solo en snapshot; no permite confirmar recurrencia.");
  if (mode !== "snapshot" && summary.historicalEvidenceCount === 0) limitations.push("La ausencia de historico reduce la confianza del analisis.");
  if (summary.dataCoverageScore < 50) limitations.push("Cobertura de metricas insuficiente para conclusiones definitivas.");
  return limitations;
}

function metricThresholds(metricType: PerformanceMetricType) {
  if (metricType === "utilization" || metricType === "utilization_in" || metricType === "utilization_out" || metricType === "cpu" || metricType === "memory") {
    return { warning: 70, high: 85, critical: 95 };
  }
  if (metricType === "crc_errors") return { warning: 1, high: 50, critical: 500 };
  if (metricType === "input_errors" || metricType === "output_errors" || metricType === "frame_errors" || metricType === "overruns" || metricType === "ignored") {
    return { warning: 1, high: 100, critical: 1000 };
  }
  if (metricType === "drops" || metricType === "input_drops" || metricType === "output_drops" || metricType === "queue_drops" || metricType === "qos_drops") {
    return { warning: 1, high: 1000, critical: 10000 };
  }
  if (metricType === "packet_loss") return { warning: 0.5, high: 1, critical: 3 };
  if (metricType === "latency") return { warning: 100, high: 200, critical: 300 };
  if (metricType === "jitter") return { warning: 20, high: 30, critical: 50 };
  if (metricType === "flaps" || metricType === "routing_neighbor_stability") return { warning: 1, high: 3, critical: 8 };
  return { warning: 1, high: 10, critical: 100 };
}

function metricSeverityHint(metricType: PerformanceMetricType, value: number): PerformanceMetric["severityHint"] {
  const thresholds = metricThresholds(metricType);
  if (value >= thresholds.critical) return "critical";
  if (value >= thresholds.high) return "high";
  if (value >= thresholds.warning) return "warning";
  return "normal";
}

function normalizeMetricSourceType(sourceType: PerformanceEvidenceSourceType): PerformanceMetric["sourceType"] {
  if (sourceType === "cli_snapshot") return "cli";
  if (sourceType === "telemetry_export") return "telemetry";
  if (sourceType === "manual_upload" || sourceType === "report") return "manual";
  return sourceType;
}

function inferPerformanceCommand(metricType: PerformanceMetricType) {
  if (["cpu"].includes(metricType)) return "show processes cpu sorted / show system resources";
  if (["memory"].includes(metricType)) return "show memory statistics / show system resources";
  if (["flaps", "routing_neighbor_stability"].includes(metricType)) return "show logging / show ip ospf neighbor / show bgp summary";
  if (["qos_drops"].includes(metricType)) return "show policy-map interface / show queueing interface";
  return "show interfaces / show interface counters errors";
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
