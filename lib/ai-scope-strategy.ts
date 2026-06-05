import { createHash } from "node:crypto";
import {
  buildAssessmentAIContext,
  generateCorrelationCandidates,
  type AssessmentAIContext,
  type ConfigurationFact,
  type CorrelationCandidate,
  type EvidenceReference,
  type OperationalStateFact
} from "./ai-analysis.ts";
import { patternForScope } from "./ai-scope-schemas.ts";
import { mapLegacyRemediation, type RemediationCategory } from "./types.ts";

export type AIScopeId =
  | "inventory"
  | "configuration"
  | "lifecycle"
  | "topology"
  | "routing"
  | "performance"
  | "security"
  | "high_availability"
  | "datacenter"
  | "campus"
  | "wan"
  | "perimeter"
  | "operations"
  | "evidence"
  | "roadmap"
  | "executive_summary";

export type AIScopeFindingType = "confirmed_finding" | "probable_issue" | "correlation_suspicion" | "visibility_gap" | "validation_required";

export type AIScopeStrategy = {
  id: AIScopeId;
  label: string;
  analysisGoal: string;
  primaryInputs: string[];
  expectedFindings: string[];
  allowedFindingTypes: AIScopeFindingType[];
  factCategories: Array<ConfigurationFact["category"] | OperationalStateFact["category"] | "performance" | "lifecycle" | "inventory" | "topology">;
  correlationTypes: CorrelationCandidate["correlationType"][];
  priorScopes: AIScopeId[];
  validationRules: string[];
  evidenceKeywords: string[];
};

export type AssessmentKnowledgeGraph = {
  assessmentId: string;
  nodes: {
    devices: AssessmentAIContext["devices"];
    interfaces: Array<{ id: string; deviceId: string; hostname: string; name: string; status: string; evidenceRefs: string[] }>;
    relationships: AssessmentAIContext["topologyRelationships"];
    configFacts: AssessmentAIContext["configurationFacts"];
    stateFacts: AssessmentAIContext["operationalStateFacts"];
    performanceMetrics: AssessmentAIContext["performanceMetrics"];
    evidenceRefs: AssessmentAIContext["evidenceReferences"];
    deterministicFindings: AssessmentAIContext["deterministicFindings"];
    correlations: CorrelationCandidate[];
  };
  edges: Array<{ from: string; to: string; type: string }>;
  sourceCounts: AssessmentAIContext["evidenceCoverage"] & { correlations: number };
};

export type AIScopePacket = {
  packetVersion: string;
  scopeId: AIScopeId;
  strategy: Omit<AIScopeStrategy, "evidenceKeywords">;
  context: {
    assessmentId: string;
    clientContext: AssessmentAIContext["clientContext"];
    scope: AssessmentAIContext["scope"];
    evidenceCoverage: AssessmentAIContext["evidenceCoverage"];
    riskScores: AssessmentAIContext["riskScores"];
    analysisLimitations: string[];
  };
  memory: {
    priorScopeSummaries: Array<{
      scopeId: string;
      status: string;
      executiveSummary?: string | null;
      findingCount: number;
      recommendationCount: number;
      topFindings?: ScopeBrief["topFindings"];
      openQuestions?: string[];
    }>;
    acceptedOrDeterministicFindings: AssessmentAIContext["deterministicFindings"];
    openCorrelationCandidates: CorrelationCandidate[];
    unresolvedQuestions: string[];
  };
  graphSlice: {
    devices: AssessmentAIContext["devices"];
    relationships: AssessmentAIContext["topologyRelationships"];
    configFacts: AssessmentAIContext["configurationFacts"];
    stateFacts: AssessmentAIContext["operationalStateFacts"];
    performanceMetrics: AssessmentAIContext["performanceMetrics"];
    lifecycle: AssessmentAIContext["lifecycleSummary"];
    missingEvidence: AssessmentAIContext["missingEvidence"];
  };
  evidencePack: EvidenceReference[];
  fullEvidenceRefIds: string[];
  fullConfigFactIds: string[];
  fullStateFactIds: string[];
  fullMetricIds: string[];
  fullCorrelationIds: string[];
  outputContract: {
    schemaName: string;
    requiredEvidenceRefs: boolean;
    allowedFindingTypes: AIScopeFindingType[];
  };
  budget: {
    maxInputTokens: number;
    estimatedInputTokens: number;
    trimmed: boolean;
    excludedEvidenceRefs: number;
  };
};

export type ScopePartition = {
  id: string;
  deviceHostnames: string[];
};

export type AIAnalysisAudit = {
  auditVersion: string;
  assessmentId: string;
  scopeId: AIScopeId;
  model: string;
  promptVersion: string;
  engineVersion: string;
  inputTokenEstimate: number;
  maxInputTokens: number;
  payloadHash: string;
  sentEvidenceRefs: string[];
  sentCorrelationIds: string[];
  sentFactIds: string[];
  excludedEvidenceRefs: number;
};

export type ScopeValidationResult = {
  validFindings: any[];
  rejectedFindings: Array<{ finding_id: string; title: string; reason: string }>;
};

const remediationCategories: RemediationCategory[] = [
  "professional_services",
  "new_technology",
  "platform_upgrade",
  "operational_change",
  "pending_validation"
];

export type ScopeBrief = {
  scopeId: string;
  scopeLabel: string;
  topFindings: Array<{
    finding_id: string;
    title: string;
    severity: string;
    finding_type: string;
    related_devices: string[];
    evidence_refs: string[];
    rationale: string;
  }>;
  openQuestions: string[];
};

export function isScopeBriefEnabled() {
  return process.env.AI_SCOPE_BRIEF === "1";
}

export function isEvidenceTieringEnabled() {
  return process.env.AI_EVIDENCE_TIERING === "1";
}

export function isDomainPartitionEnabled() {
  return process.env.AI_DOMAIN_PARTITION === "1";
}

export function getPromptVersion() {
  return isScopeBriefEnabled() ? "assessment-ai-prompts-v2" : "assessment-ai-prompts-v1";
}

const packetVersion = "ai-scope-packet-v1";
const defaultMaxInputTokens = 24000;
export const EVIDENCE_TOP_K = 12;
const fullEvidenceExcerptChars = 1200;
const compactEvidenceExcerptChars = 120;
const smallAssessmentMaxInputTokens = 16000;
const mediumAssessmentMaxInputTokens = 24000;
const largeAssessmentMaxInputTokens = 32000;
const domainPartitionDeviceThreshold = 20;
const domainPartitionDeviceCap = 40;
const maxDomainPartitions = 6;
const fullEvidenceCatalogByPacket = new WeakMap<AIScopePacket, EvidenceReference[]>();

const scopeStrategies: Partial<Record<AIScopeId, AIScopeStrategy>> = {
  topology: {
    id: "topology",
    label: "Analisis topologico",
    analysisGoal: "Evaluar vecinos, redundancia, puntos unicos de falla y consistencia fisica/logica.",
    primaryInputs: ["Inventario incluido", "CDP/LLDP", "port-channel", "vPC/stack/HA"],
    expectedFindings: ["Baja cobertura de vecinos", "Equipos criticos single-homed", "Inconsistencias fisico/logicas", "Dependencias no evidenciadas", "Posibles puntos unicos de falla"],
    allowedFindingTypes: ["probable_issue", "correlation_suspicion", "visibility_gap", "validation_required"],
    factCategories: ["topology", "resiliency", "switching", "interface"],
    correlationTypes: ["topology_resiliency_gap", "performance_topology_hotspot", "protocol_instability", "evidence_conflict"],
    priorScopes: [],
    validationRules: [
      "No afirmes SPOF sin inventario critico y evidencia topologica.",
      "Si falta CDP/LLDP, genera visibility_gap o validation_required."
    ],
    evidenceKeywords: ["cdp", "lldp", "neighbor", "port-channel", "vpc", "stack", "redundancy", "spanning-tree"]
  },
  configuration: {
    id: "configuration",
    label: "Configuraciones",
    analysisGoal: "Evaluar running-config, estandares, desviaciones y parametros operativos.",
    primaryInputs: ["running-config", "startup-config", "facts normalizados", "desviaciones conocidas"],
    expectedFindings: ["Desviaciones de configuracion", "Parametros operativos riesgosos", "Inconsistencias entre equipos", "Features configuradas pero degradadas"],
    allowedFindingTypes: ["confirmed_finding", "probable_issue", "correlation_suspicion", "validation_required"],
    factCategories: ["security", "interface", "routing", "switching", "management", "resiliency"],
    correlationTypes: ["config_state_mismatch", "config_performance_mismatch", "evidence_conflict"],
    priorScopes: ["topology"],
    validationRules: ["Todo hallazgo debe apuntar a configFactId o evidenceRef de configuracion."],
    evidenceKeywords: ["running-config", "startup-config", "interface", "router", "line vty", "snmp", "aaa", "logging"]
  },
  security: {
    id: "security",
    label: "Seguridad",
    analysisGoal: "Evaluar plano de administracion, protocolos inseguros, SNMP, AAA y hardening.",
    primaryInputs: ["AAA", "SNMP", "SSH/Telnet", "HTTP", "ACLs", "management plane"],
    expectedFindings: ["Protocolos inseguros", "Credenciales debiles", "Exposicion administrativa", "SNMP inseguro", "Hardening incompleto"],
    allowedFindingTypes: ["confirmed_finding", "probable_issue", "visibility_gap", "validation_required"],
    factCategories: ["security", "management"],
    correlationTypes: ["security_config_exposure"],
    priorScopes: ["topology", "configuration"],
    validationRules: ["Severidad high/critical requiere evidencia explicita de exposicion o configuracion insegura."],
    evidenceKeywords: ["aaa", "snmp", "telnet", "ssh", "http", "access-list", "acl", "crypto", "nat", "vpn"]
  },
  lifecycle: {
    id: "lifecycle",
    label: "Vigencia tecnologica",
    analysisGoal: "Evaluar versiones de software, hardware, modelos y obsolescencia potencial.",
    primaryInputs: ["Modelo", "PID", "serial", "version de software", "Cisco EoX", "cobertura de soporte"],
    expectedFindings: ["Obsolescencia potencial", "Fin de soporte confirmado", "Software antiguo", "Riesgo de plataforma"],
    allowedFindingTypes: ["confirmed_finding", "probable_issue", "validation_required", "visibility_gap"],
    factCategories: ["inventory", "lifecycle", "performance"],
    correlationTypes: ["lifecycle_risk_amplifier"],
    priorScopes: ["topology"],
    validationRules: ["EoX confirmado solo con fuente Cisco o evidencia explicita; si no hay datos, usa validation_required."],
    evidenceKeywords: ["show version", "show inventory", "serial", "pid", "eox", "lifecycle", "support"]
  },
  operations: {
    id: "operations",
    label: "Operaciones",
    analysisGoal: "Evaluar estado de interfaces, documentacion, administracion y mantenibilidad.",
    primaryInputs: ["Estado de interfaces", "documentacion", "monitoreo", "NTP", "logging", "licencias"],
    expectedFindings: ["Brechas de visibilidad", "Interfaces degradadas", "Administracion inconsistente", "Falta de mantenibilidad operacional"],
    allowedFindingTypes: ["probable_issue", "correlation_suspicion", "visibility_gap", "validation_required"],
    factCategories: ["interface", "logging", "environment", "license", "management", "resiliency"],
    correlationTypes: ["operational_visibility_gap", "protocol_instability", "evidence_conflict"],
    priorScopes: ["topology", "configuration", "lifecycle"],
    validationRules: ["Separa riesgo confirmado de falta de evidencia; ausencia de monitoreo/documentacion produce visibility_gap."],
    evidenceKeywords: ["interface", "status", "logging", "ntp", "clock", "license", "environment", "monitor"]
  },
  evidence: {
    id: "evidence",
    label: "Logs y eventos",
    analysisGoal: "Evaluar eventos relevantes, errores recurrentes y senales de degradacion.",
    primaryInputs: ["logs", "syslog", "eventos parseados", "errores recurrentes", "flaps", "STP", "routing", "port-channel", "NTP"],
    expectedFindings: ["Senales de degradacion", "Recurrencia de errores", "Inestabilidad de protocolos", "Eventos correlacionados con interfaces/equipos"],
    allowedFindingTypes: ["probable_issue", "correlation_suspicion", "validation_required", "visibility_gap"],
    factCategories: ["logging", "routing", "switching", "interface", "performance"],
    correlationTypes: ["protocol_instability", "operational_visibility_gap", "evidence_conflict"],
    priorScopes: ["topology", "configuration", "operations"],
    validationRules: ["Recurrente solo si hay multiples eventos o ventana temporal; eventos aislados generan probable_issue o validation_required."],
    evidenceKeywords: ["%", "error", "down", "flap", "ospf", "bgp", "spanning-tree", "cannot_bundle", "ntp", "unsync"]
  }
};

export function getAIScopeStrategy(scopeId: AIScopeId): AIScopeStrategy {
  return scopeStrategies[scopeId] ?? {
    id: scopeId,
    label: scopeId,
    analysisGoal: "Analizar el ambito usando memoria incremental y evidencia trazable.",
    primaryInputs: ["Assessment context", "facts normalizados", "correlaciones previas", "evidencia trazable"],
    expectedFindings: ["Riesgos soportados por evidencia", "Brechas de visibilidad", "Validaciones pendientes"],
    allowedFindingTypes: ["probable_issue", "correlation_suspicion", "visibility_gap", "validation_required"],
    factCategories: ["inventory", "topology", "interface", "routing", "switching", "management", "performance"],
    correlationTypes: ["evidence_conflict", "operational_visibility_gap", "protocol_instability"],
    priorScopes: ["topology", "configuration"],
    validationRules: ["Todo hallazgo debe incluir evidencia trazable o declararse como validation_required."],
    evidenceKeywords: []
  };
}

export function buildAssessmentKnowledgeGraph(record: any): AssessmentKnowledgeGraph {
  const context = buildAssessmentAIContext(record);
  const correlations = generateCorrelationCandidates(context);
  const interfaces = (record?.parsed?.interfaces ?? []).map((item: any) => ({
    id: item.id ?? `${item.hostname}:${item.name}`,
    deviceId: item.deviceId ?? item.hostname,
    hostname: item.hostname ?? item.deviceId ?? "unknown",
    name: item.name ?? "unknown",
    status: item.status ?? "unknown",
    evidenceRefs: Array.isArray(item.evidence) ? item.evidence : []
  }));

  return {
    assessmentId: context.assessmentId,
    nodes: {
      devices: context.devices,
      interfaces,
      relationships: context.topologyRelationships,
      configFacts: context.configurationFacts,
      stateFacts: context.operationalStateFacts,
      performanceMetrics: context.performanceMetrics,
      evidenceRefs: context.evidenceReferences,
      deterministicFindings: context.deterministicFindings,
      correlations
    },
    edges: buildGraphEdges(context, interfaces, correlations),
    sourceCounts: {
      ...context.evidenceCoverage,
      correlations: correlations.length
    }
  };
}

export function buildAIScopePacket(input: {
  record: any;
  scopeId: AIScopeId;
  priorScopeResults?: any[];
  maxInputTokens?: number;
  partitionDevices?: string[];
}): AIScopePacket {
  const strategy = getAIScopeStrategy(input.scopeId);
  const context = buildAssessmentAIContext(input.record);
  const graph = buildAssessmentKnowledgeGraph(input.record);
  const partitionDeviceSet = input.partitionDevices?.length ? new Set(input.partitionDevices.map(normalize)) : null;
  const relevantDeviceIds = new Set<string>();
  const relevantEvidenceIds = new Set<string>();

  const openCorrelationCandidates = graph.nodes.correlations
    .filter((candidate) => isCorrelationRelevant(candidate, strategy, input.scopeId) && candidateMatchesPartition(candidate, partitionDeviceSet))
    .slice(0, input.scopeId === "topology" ? 90 : 50);
  for (const candidate of openCorrelationCandidates) {
    candidate.involvedDevices.forEach((device) => relevantDeviceIds.add(normalize(device)));
    candidate.evidenceRefs.forEach((ref) => relevantEvidenceIds.add(ref));
  }

  const devices = graph.nodes.devices
    .filter((device) => hostnameMatchesPartition(device.hostname, partitionDeviceSet) && isDeviceRelevant(device, input.scopeId, relevantDeviceIds))
    .slice(0, input.scopeId === "topology" ? 160 : 90);
  devices.forEach((device) => device.evidenceRefs.forEach((ref) => relevantEvidenceIds.add(ref)));

  const relationships = graph.nodes.relationships
    .filter((relation) => relationMatchesPartition(relation, partitionDeviceSet) && (input.scopeId === "topology" || relevantDeviceIds.has(normalize(relation.sourceDevice)) || relevantDeviceIds.has(normalize(relation.targetDevice))))
    .slice(0, input.scopeId === "topology" ? 140 : 60);
  relationships.forEach((relation) => relevantEvidenceIds.add(relation.evidenceSource));

  const configFacts = graph.nodes.configFacts
    .filter((fact) => hostnameMatchesPartition(fact.deviceId, partitionDeviceSet) && isConfigFactRelevant(fact, strategy, relevantDeviceIds))
    .slice(0, input.scopeId === "configuration" || input.scopeId === "security" ? 120 : 45);
  configFacts.forEach((fact) => relevantEvidenceIds.add(fact.evidenceRef));

  const stateFacts = graph.nodes.stateFacts
    .filter((fact) => hostnameMatchesPartition(fact.deviceId, partitionDeviceSet) && isStateFactRelevant(fact, strategy, relevantDeviceIds))
    .slice(0, input.scopeId === "operations" || input.scopeId === "evidence" ? 120 : 45);
  stateFacts.forEach((fact) => relevantEvidenceIds.add(fact.evidenceRef));

  const performanceMetrics = graph.nodes.performanceMetrics
    .filter((metric) => hostnameMatchesPartition(metric.deviceId, partitionDeviceSet) && isMetricRelevant(metric, input.scopeId, relevantDeviceIds, openCorrelationCandidates))
    .slice(0, 70);
  performanceMetrics.forEach((metric) => relevantEvidenceIds.add(metric.evidenceRef));

  const deterministicFindings = graph.nodes.deterministicFindings
    .filter((finding) => findingMatchesPartition(finding, partitionDeviceSet) && isFindingRelevant(finding, input.scopeId, relevantDeviceIds))
    .slice(0, 60);
  const scopeDerivedFindings = buildScopeDerivedFindingRefs(context, graph, input.scopeId)
    .filter((finding) => findingMatchesPartition(finding, partitionDeviceSet));
  deterministicFindings.forEach((finding) => finding.evidenceRefs.forEach((ref) => relevantEvidenceIds.add(ref)));
  scopeDerivedFindings.forEach((finding) => finding.evidenceRefs.forEach((ref) => relevantEvidenceIds.add(ref)));

  const missingEvidence = context.missingEvidence
    .filter((item) => isMissingEvidenceRelevant(item, input.scopeId))
    .slice(0, 12)
    .map((item) => ({
      ...item,
      missingForDevices: item.missingForDevices.filter((device) => hostnameMatchesPartition(device, partitionDeviceSet)).slice(0, 25)
    }))
    .filter((item) => !partitionDeviceSet || item.missingForDevices.length > 0);

  const unresolvedQuestions = missingEvidence.map((item) => `${item.expectedEvidence}: ${item.reason}`);
  const selectedEvidence = graph.nodes.evidenceRefs
    .filter((ref) => relevantEvidenceIds.has(ref.id) || evidenceMatchesStrategy(ref, strategy))
    .filter((ref) => evidenceMatchesPartition(ref, partitionDeviceSet, relevantEvidenceIds))
    .map((ref) => isEvidenceTieringEnabled() ? ref : compactEvidenceRef(ref));

  const initialPacket: AIScopePacket = {
    packetVersion,
    scopeId: input.scopeId,
    strategy: stripKeywords(strategy),
    context: {
      assessmentId: context.assessmentId,
      clientContext: context.clientContext,
      scope: context.scope,
      evidenceCoverage: context.evidenceCoverage,
      riskScores: context.riskScores,
      analysisLimitations: context.analysisLimitations.slice(0, 12)
    },
    memory: {
      priorScopeSummaries: summarizePriorScopeResults(input.priorScopeResults ?? [], strategy),
      acceptedOrDeterministicFindings: [...scopeDerivedFindings, ...deterministicFindings].slice(0, 80),
      openCorrelationCandidates,
      unresolvedQuestions
    },
    graphSlice: {
      devices,
      relationships,
      configFacts,
      stateFacts,
      performanceMetrics,
      lifecycle: {
        ...context.lifecycleSummary,
        riskyDevices: context.lifecycleSummary.riskyDevices.slice(0, 50)
      },
      missingEvidence
    },
    evidencePack: selectedEvidence,
    fullEvidenceRefIds: graph.nodes.evidenceRefs.map((ref) => ref.id),
    fullConfigFactIds: graph.nodes.configFacts.map((fact) => fact.id),
    fullStateFactIds: graph.nodes.stateFacts.map((fact) => fact.id),
    fullMetricIds: graph.nodes.performanceMetrics.map((metric) => metric.id),
    fullCorrelationIds: graph.nodes.correlations.map((candidate) => candidate.id),
    outputContract: {
      schemaName: "scope_analysis_result",
      requiredEvidenceRefs: true,
      allowedFindingTypes: strategy.allowedFindingTypes
    },
    budget: {
      maxInputTokens: resolveMaxInputTokens(input.record, input.maxInputTokens),
      estimatedInputTokens: 0,
      trimmed: false,
      excludedEvidenceRefs: 0
    }
  };

  return applyContextBudget(attachFullEvidenceCatalog(initialPacket, graph.nodes.evidenceRefs));
}

export function resolveMaxInputTokens(record: any, explicit?: number) {
  if (explicit !== undefined && Number.isFinite(explicit)) return explicit;
  if (!isEvidenceTieringEnabled()) return defaultMaxInputTokens;

  const deviceCount = countIncludedDevices(record);
  if (deviceCount < 20) return smallAssessmentMaxInputTokens;
  if (deviceCount <= 100) return mediumAssessmentMaxInputTokens;
  return largeAssessmentMaxInputTokens;
}

export function planScopePartitions(record: any, scopeId: AIScopeId, basePacket: AIScopePacket): ScopePartition[] {
  if (
    !isDomainPartitionEnabled() ||
    !basePacket.budget.trimmed ||
    patternForScope(scopeId) === "synthesis"
  ) {
    return [allScopePartition()];
  }

  const context = buildAssessmentAIContext(record);
  const devices = context.devices
    .map((device) => ({
      hostname: String(device.hostname ?? "").trim(),
      site: String(device.site ?? "unknown").trim() || "unknown"
    }))
    .filter((device) => device.hostname);

  if (devices.length <= domainPartitionDeviceThreshold) return [allScopePartition()];

  const pattern = patternForScope(scopeId);
  const partitions = pattern === "graph"
    ? planGraphPartitions(devices, context.topologyRelationships)
    : planSitePartitions(devices);

  if (partitions.length <= 1) return [allScopePartition()];
  return applyPartitionCap(partitions);
}

export function createAIAnalysisAudit(input: {
  packet: AIScopePacket;
  model: string;
  promptVersion: string;
  engineVersion: string;
}): AIAnalysisAudit {
  const factIds = [
    ...input.packet.graphSlice.configFacts.map((fact) => fact.id),
    ...input.packet.graphSlice.stateFacts.map((fact) => fact.id),
    ...input.packet.graphSlice.performanceMetrics.map((metric) => metric.id)
  ];
  const payloadHash = createHash("sha256").update(stableStringify(input.packet)).digest("hex");
  return {
    auditVersion: "ai-analysis-audit-v1",
    assessmentId: input.packet.context.assessmentId,
    scopeId: input.packet.scopeId,
    model: input.model,
    promptVersion: input.promptVersion,
    engineVersion: input.engineVersion,
    inputTokenEstimate: input.packet.budget.estimatedInputTokens,
    maxInputTokens: input.packet.budget.maxInputTokens,
    payloadHash,
    sentEvidenceRefs: input.packet.evidencePack.map((ref) => ref.id),
    sentCorrelationIds: input.packet.memory.openCorrelationCandidates.map((candidate) => candidate.id),
    sentFactIds: factIds,
    excludedEvidenceRefs: input.packet.budget.excludedEvidenceRefs
  };
}

export function fullEvidenceCatalogForPacket(packet: AIScopePacket): EvidenceReference[] {
  return fullEvidenceCatalogByPacket.get(packet) ?? packet.evidencePack;
}

export function validateScopeAnalysisResult(parsed: any, packet: AIScopePacket): ScopeValidationResult {
  const strategy = getAIScopeStrategy(packet.scopeId);
  const fullEvidenceCatalog = fullEvidenceCatalogForPacket(packet);
  const evidenceCatalog = new Set((packet.fullEvidenceRefIds?.length ? packet.fullEvidenceRefIds : packet.evidencePack.map((ref) => ref.id)));
  const configFactCatalog = new Set((packet.fullConfigFactIds?.length ? packet.fullConfigFactIds : packet.graphSlice.configFacts.map((fact) => fact.id)));
  const stateFactCatalog = new Set((packet.fullStateFactIds?.length ? packet.fullStateFactIds : packet.graphSlice.stateFacts.map((fact) => fact.id)));
  const metricCatalog = new Set((packet.fullMetricIds?.length ? packet.fullMetricIds : packet.graphSlice.performanceMetrics.map((metric) => metric.id)));
  const correlationCatalog = new Set((packet.fullCorrelationIds?.length ? packet.fullCorrelationIds : packet.memory.openCorrelationCandidates.map((candidate) => candidate.id)));
  const validFindings: any[] = [];
  const rejectedFindings: ScopeValidationResult["rejectedFindings"] = [];

  for (const finding of Array.isArray(parsed?.findings) ? parsed.findings : []) {
    const reasons: string[] = [];
    const evidenceRefs = normalizeStringArray(finding.evidence_refs);
    const relatedFactIds = normalizeStringArray(finding.related_fact_ids);
    const relatedMetricIds = normalizeStringArray(finding.related_metric_ids);
    const relatedCorrelationIds = normalizeStringArray(finding.related_correlation_ids);
    const findingType = String(finding.finding_type ?? "");
    const severity = String(finding.severity ?? "");
    const text = `${finding.title ?? ""} ${finding.technical_rationale ?? ""} ${finding.business_impact ?? ""}`.toLowerCase();
    finding.remediation_category = normalizeScopeRemediationCategory(finding.remediation_category ?? finding.remediationCategory);

    if (findingType && !strategy.allowedFindingTypes.includes(findingType as AIScopeFindingType)) {
      reasons.push(`finding_type ${findingType} no esta permitido para ${packet.scopeId}.`);
    }
    if (evidenceRefs.length === 0 && !["visibility_gap", "validation_required"].includes(findingType)) {
      reasons.push("Hallazgo sin evidence_refs debe ser visibility_gap o validation_required.");
    }
    const unknownEvidence = evidenceRefs.filter((ref) => !evidenceCatalog.has(ref));
    if (unknownEvidence.length > 0) reasons.push(`evidence_refs desconocidos: ${unknownEvidence.join(", ")}.`);
    const unknownFacts = relatedFactIds.filter((id) => !configFactCatalog.has(id) && !stateFactCatalog.has(id));
    if (unknownFacts.length > 0) reasons.push(`related_fact_ids desconocidos: ${unknownFacts.join(", ")}.`);
    const unknownMetrics = relatedMetricIds.filter((id) => !metricCatalog.has(id));
    if (unknownMetrics.length > 0) reasons.push(`related_metric_ids desconocidos: ${unknownMetrics.join(", ")}.`);
    const unknownCorrelations = relatedCorrelationIds.filter((id) => !correlationCatalog.has(id));
    if (unknownCorrelations.length > 0) reasons.push(`related_correlation_ids desconocidos: ${unknownCorrelations.join(", ")}.`);

    if (packet.scopeId === "topology" && /spof|single point|punto unico|single-homed|single homed/.test(text)) {
      const hasTopologyEvidence = evidenceRefs.some((ref) => fullEvidenceCatalog.some((item) => item.id === ref && item.relationId));
      if (!hasTopologyEvidence) reasons.push("SPOF o single-homed requiere evidencia topologica relacionada.");
    }
    if (packet.scopeId === "configuration" && relatedFactIds.length === 0 && evidenceRefs.length === 0) {
      reasons.push("Configuracion requiere configFactId o evidenceRef de configuracion.");
    }
    if (packet.scopeId === "security" && ["critical", "high"].includes(severity) && ["confirmed_finding", "probable_issue"].includes(findingType)) {
      const hasSecurityFact = relatedFactIds.some((id) => configFactCatalog.has(id));
      const hasExplicitSecurityEvidence = evidenceRefs.some((refId) => {
        const ref = fullEvidenceCatalog.find((item) => item.id === refId);
        return ref ? isExplicitSecurityEvidence(ref) : false;
      });
      if (!hasSecurityFact && !hasExplicitSecurityEvidence) {
        reasons.push("Seguridad high/critical requiere configFactId o evidencia explicita de AAA, SNMP, Telnet, HTTP, ACL, crypto, NAT o VPN.");
      }
    }
    if (packet.scopeId === "lifecycle" && /eox|end.of.support|fin de soporte|obsole/.test(text)) {
      const hasLifecycleEvidence = evidenceRefs.some((ref) => /eox|lifecycle|show version|show inventory|serial|pid|support/i.test(ref));
      if (!hasLifecycleEvidence && findingType === "confirmed_finding") reasons.push("Lifecycle confirmado requiere fuente Cisco/EoX o evidencia explicita.");
    }
    if (packet.scopeId === "evidence" && /recurrente|recurren|recurring|frecuente/.test(text) && evidenceRefs.length < 2) {
      reasons.push("Recurrencia en logs/eventos requiere multiples evidencias o ventana temporal.");
    }

    if (reasons.length > 0) {
      rejectedFindings.push({
        finding_id: String(finding.finding_id ?? "unknown"),
        title: String(finding.title ?? "Hallazgo sin titulo"),
        reason: reasons.join(" ")
      });
    } else {
      validFindings.push(finding);
    }
  }

  return { validFindings, rejectedFindings };
}

function normalizeScopeRemediationCategory(value: unknown): RemediationCategory {
  const text = String(value ?? "");
  return remediationCategories.includes(text as RemediationCategory) ? (text as RemediationCategory) : mapLegacyRemediation(text);
}

export function buildScopeBrief(findings: any[], scopeId: AIScopeId | string, scopeLabel: string): ScopeBrief {
  const sortedFindings = [...(Array.isArray(findings) ? findings : [])].sort((left, right) => {
    const severityDelta = severityRank(right?.severity) - severityRank(left?.severity);
    if (severityDelta !== 0) return severityDelta;
    return confidenceRank(right?.confidence) - confidenceRank(left?.confidence);
  });
  const openQuestions = uniqueStrings([
    ...sortedFindings.flatMap((finding) => normalizeStringArray(finding?.validation_questions)),
    ...sortedFindings
      .filter((finding) => finding?.finding_type === "validation_required" || finding?.finding_type === "visibility_gap")
      .map((finding) => String(finding?.title ?? "").trim())
  ]).slice(0, 5);

  return {
    scopeId: String(scopeId),
    scopeLabel,
    topFindings: sortedFindings.slice(0, 5).map((finding) => ({
      finding_id: String(finding?.finding_id ?? ""),
      title: String(finding?.title ?? ""),
      severity: String(finding?.severity ?? ""),
      finding_type: String(finding?.finding_type ?? ""),
      related_devices: normalizeStringArray(finding?.related_devices),
      evidence_refs: normalizeStringArray(finding?.evidence_refs),
      rationale: firstSentence(finding?.technical_rationale)
    })),
    openQuestions
  };
}

function buildGraphEdges(context: AssessmentAIContext, interfaces: AssessmentKnowledgeGraph["nodes"]["interfaces"], correlations: CorrelationCandidate[]) {
  const edges: AssessmentKnowledgeGraph["edges"] = [];
  for (const intf of interfaces) edges.push({ from: `device:${intf.hostname}`, to: `interface:${intf.hostname}:${intf.name}`, type: "has_interface" });
  for (const relation of context.topologyRelationships) {
    edges.push({ from: `interface:${relation.sourceDevice}:${relation.sourceInterface}`, to: `interface:${relation.targetDevice}:${relation.targetInterface}`, type: relation.relationshipType });
  }
  for (const fact of context.configurationFacts) edges.push({ from: `device:${fact.deviceId}`, to: `configFact:${fact.id}`, type: "has_config_fact" });
  for (const fact of context.operationalStateFacts) edges.push({ from: `device:${fact.deviceId}`, to: `stateFact:${fact.id}`, type: "has_state_fact" });
  for (const metric of context.performanceMetrics) edges.push({ from: `device:${metric.deviceId}`, to: `metric:${metric.id}`, type: "has_metric" });
  for (const candidate of correlations) {
    candidate.involvedDevices.forEach((device) => edges.push({ from: `device:${device}`, to: `correlation:${candidate.id}`, type: "involved_in" }));
    candidate.evidenceRefs.forEach((ref) => edges.push({ from: `evidence:${ref}`, to: `correlation:${candidate.id}`, type: "supports" }));
  }
  return edges;
}

function attachFullEvidenceCatalog<T extends AIScopePacket>(packet: T, catalog: EvidenceReference[]): T {
  fullEvidenceCatalogByPacket.set(packet, catalog);
  return packet;
}

function applyContextBudget(packet: AIScopePacket): AIScopePacket {
  if (isEvidenceTieringEnabled()) return applyTieredContextBudget(packet);
  return applyLegacyContextBudget(packet);
}

function applyLegacyContextBudget(packet: AIScopePacket): AIScopePacket {
  const fullEvidenceCatalog = fullEvidenceCatalogForPacket(packet);
  let next = { ...packet, evidencePack: rankEvidence(packet).map(compactEvidenceRef) };
  let estimated = estimateTokens(next);
  let excludedEvidenceRefs = 0;
  while (estimated > next.budget.maxInputTokens && next.evidencePack.length > 20) {
    excludedEvidenceRefs += 1;
    next = { ...next, evidencePack: next.evidencePack.slice(0, -1) };
    estimated = estimateTokens(next);
  }
  if (estimated > next.budget.maxInputTokens) {
    next = {
      ...next,
      graphSlice: {
        ...next.graphSlice,
        devices: next.graphSlice.devices.slice(0, 50),
        relationships: next.graphSlice.relationships.slice(0, 45),
        configFacts: next.graphSlice.configFacts.slice(0, 40),
        stateFacts: next.graphSlice.stateFacts.slice(0, 40),
        performanceMetrics: next.graphSlice.performanceMetrics.slice(0, 35)
      },
      memory: {
        ...next.memory,
        acceptedOrDeterministicFindings: next.memory.acceptedOrDeterministicFindings.slice(0, 30),
        openCorrelationCandidates: next.memory.openCorrelationCandidates.slice(0, 30)
      }
    };
    estimated = estimateTokens(next);
  }
  return attachFullEvidenceCatalog({
    ...next,
    budget: {
      ...next.budget,
      estimatedInputTokens: estimated,
      trimmed: excludedEvidenceRefs > 0 || estimated > packet.budget.maxInputTokens,
      excludedEvidenceRefs
    }
  }, fullEvidenceCatalog);
}

function applyTieredContextBudget(packet: AIScopePacket): AIScopePacket {
  const fullEvidenceCatalog = fullEvidenceCatalogForPacket(packet);
  const rankedEvidence = rankEvidence(packet);
  const fullEvidence = rankedEvidence.slice(0, EVIDENCE_TOP_K).map((ref) => tierEvidenceRef(ref, "full"));
  let compactEvidence = rankedEvidence.slice(EVIDENCE_TOP_K).map((ref) => tierEvidenceRef(ref, "compact"));
  let next = { ...packet, evidencePack: [...fullEvidence, ...compactEvidence] };
  let estimated = estimateTokens(next);
  let excludedEvidenceRefs = 0;

  while (estimated > next.budget.maxInputTokens && compactEvidence.length > 0) {
    compactEvidence = compactEvidence.slice(0, -1);
    excludedEvidenceRefs += 1;
    next = { ...next, evidencePack: [...fullEvidence, ...compactEvidence] };
    estimated = estimateTokens(next);
  }

  if (estimated > next.budget.maxInputTokens) {
    next = trimGraphAndMemory(next);
    estimated = estimateTokens(next);
  }

  return attachFullEvidenceCatalog({
    ...next,
    budget: {
      ...next.budget,
      estimatedInputTokens: estimated,
      trimmed: excludedEvidenceRefs > 0 || estimated > packet.budget.maxInputTokens,
      excludedEvidenceRefs
    }
  }, fullEvidenceCatalog);
}

function trimGraphAndMemory(packet: AIScopePacket): AIScopePacket {
  return {
    ...packet,
    graphSlice: {
      ...packet.graphSlice,
      devices: packet.graphSlice.devices.slice(0, 50),
      relationships: packet.graphSlice.relationships.slice(0, 45),
      configFacts: packet.graphSlice.configFacts.slice(0, 40),
      stateFacts: packet.graphSlice.stateFacts.slice(0, 40),
      performanceMetrics: packet.graphSlice.performanceMetrics.slice(0, 35)
    },
    memory: {
      ...packet.memory,
      acceptedOrDeterministicFindings: packet.memory.acceptedOrDeterministicFindings.slice(0, 30),
      openCorrelationCandidates: packet.memory.openCorrelationCandidates.slice(0, 30)
    }
  };
}

function rankEvidence(packet: AIScopePacket) {
  const directIds = new Set<string>();
  packet.memory.openCorrelationCandidates.forEach((candidate) => candidate.evidenceRefs.forEach((id) => directIds.add(id)));
  packet.memory.acceptedOrDeterministicFindings.forEach((finding) => finding.evidenceRefs.forEach((id) => directIds.add(id)));
  packet.graphSlice.relationships.forEach((relation) => directIds.add(relation.evidenceSource));
  packet.graphSlice.configFacts.forEach((fact) => directIds.add(fact.evidenceRef));
  packet.graphSlice.stateFacts.forEach((fact) => directIds.add(fact.evidenceRef));
  packet.graphSlice.performanceMetrics.forEach((metric) => directIds.add(metric.evidenceRef));
  return [...packet.evidencePack].sort((a, b) => evidenceScore(b, packet, directIds) - evidenceScore(a, packet, directIds));
}

function evidenceScore(ref: EvidenceReference, packet: AIScopePacket, directIds: Set<string>) {
  let score = directIds.has(ref.id) ? 100 : 0;
  const haystack = `${ref.id} ${ref.command ?? ""} ${ref.excerpt ?? ""}`.toLowerCase();
  for (const keyword of getAIScopeStrategy(packet.scopeId).evidenceKeywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 8;
  }
  if (ref.relationId) score += 20;
  if (ref.configFactId || ref.stateFactId || ref.metricId) score += 16;
  if (ref.deviceId && packet.graphSlice.devices.some((device) => device.hostname === ref.deviceId && ["critical", "high"].includes(device.criticality))) score += 10;
  return score;
}

export function summarizePriorScopeResults(results: any[], strategy: AIScopeStrategy) {
  const wanted = new Set(strategy.priorScopes);
  return results
    .filter((result) => wanted.has(String(result.scopeId) as AIScopeId))
    .map((result) => {
      const scopeBrief = result.resultJson?.scopeBrief;
      return {
        scopeId: String(result.scopeId),
        status: String(result.status ?? "unknown"),
        executiveSummary: result.executiveSummary ?? result.resultJson?.executiveSummary ?? null,
        findingCount: Array.isArray(result.findingsJson) ? result.findingsJson.length : Array.isArray(result.resultJson?.findings) ? result.resultJson.findings.length : 0,
        recommendationCount: Array.isArray(result.recommendationsJson) ? result.recommendationsJson.length : Array.isArray(result.resultJson?.recommendations) ? result.resultJson.recommendations.length : 0,
        ...(scopeBrief ? {
          topFindings: Array.isArray(scopeBrief.topFindings) ? scopeBrief.topFindings.slice(0, 5) : [],
          openQuestions: normalizeStringArray(scopeBrief.openQuestions).slice(0, 5)
        } : {})
      };
    })
    .slice(0, 6);
}

export function tierEvidenceRef(ref: EvidenceReference, tier: "full" | "compact"): EvidenceReference {
  return {
    ...ref,
    excerpt: truncateText(ref.excerpt ?? ref.id, tier === "full" ? fullEvidenceExcerptChars : compactEvidenceExcerptChars)
  };
}

function compactEvidenceRef(ref: EvidenceReference): EvidenceReference {
  return {
    ...ref,
    excerpt: truncateText(ref.excerpt ?? ref.id, 320)
  };
}

function stripKeywords(strategy: AIScopeStrategy): Omit<AIScopeStrategy, "evidenceKeywords"> {
  const { evidenceKeywords: _evidenceKeywords, ...rest } = strategy;
  return rest;
}

function isCorrelationRelevant(candidate: CorrelationCandidate, strategy: AIScopeStrategy, scopeId: AIScopeId) {
  return strategy.correlationTypes.includes(candidate.correlationType) ||
    (scopeId === "configuration" && candidate.correlationType.startsWith("config_")) ||
    (scopeId === "evidence" && candidate.correlationType === "protocol_instability");
}

function isDeviceRelevant(device: AssessmentAIContext["devices"][number], scopeId: AIScopeId, relevantDeviceIds: Set<string>) {
  if (relevantDeviceIds.has(normalize(device.hostname))) return true;
  if (scopeId === "lifecycle") return device.lifecycleStatus !== "unknown" || ["critical", "high"].includes(device.criticality);
  if (scopeId === "topology") return ["critical", "high"].includes(device.criticality);
  return ["critical", "high"].includes(device.criticality);
}

function isConfigFactRelevant(fact: ConfigurationFact, strategy: AIScopeStrategy, relevantDeviceIds: Set<string>) {
  return strategy.factCategories.includes(fact.category) || relevantDeviceIds.has(normalize(fact.deviceId));
}

function isStateFactRelevant(fact: OperationalStateFact, strategy: AIScopeStrategy, relevantDeviceIds: Set<string>) {
  if (strategy.id === "security") return strategy.factCategories.includes(fact.category);
  return strategy.factCategories.includes(fact.category) || relevantDeviceIds.has(normalize(fact.deviceId)) || ["high", "critical"].includes(fact.severityHint);
}

function isMetricRelevant(metric: AssessmentAIContext["performanceMetrics"][number], scopeId: AIScopeId, relevantDeviceIds: Set<string>, candidates: CorrelationCandidate[]) {
  if (scopeId === "performance" || scopeId === "operations" || scopeId === "evidence" || scopeId === "lifecycle") return true;
  if (relevantDeviceIds.has(normalize(metric.deviceId))) return true;
  return candidates.some((candidate) => candidate.involvedMetrics.includes(metric.id));
}

function isFindingRelevant(finding: AssessmentAIContext["deterministicFindings"][number], scopeId: AIScopeId, relevantDeviceIds: Set<string>) {
  if (finding.affectedAssets.some((asset) => relevantDeviceIds.has(normalize(asset)))) return true;
  if (scopeId === "security") return finding.category === "security";
  if (scopeId === "configuration") return finding.category === "configuration";
  if (scopeId === "lifecycle") return finding.category === "lifecycle";
  if (scopeId === "operations" || scopeId === "evidence") return finding.category === "operations";
  if (scopeId === "topology") return finding.category === "resiliency";
  return false;
}

function isMissingEvidenceRelevant(item: AssessmentAIContext["missingEvidence"][number], scopeId: AIScopeId) {
  const value = `${item.expectedEvidence} ${item.reason}`.toLowerCase();
  if (scopeId === "topology") return /cdp|lldp|topolog|vecino/.test(value);
  if (scopeId === "operations" || scopeId === "evidence") return /metric|performance|historico|evidencia|monitor/.test(value);
  return true;
}

function buildScopeDerivedFindingRefs(context: AssessmentAIContext, graph: AssessmentKnowledgeGraph, scopeId: AIScopeId): AssessmentAIContext["deterministicFindings"] {
  if (scopeId !== "topology") return [];
  const findings: AssessmentAIContext["deterministicFindings"] = [];
  const selfRelations = graph.nodes.relationships.filter((relation) => normalize(relation.sourceDevice) === normalize(relation.targetDevice));
  if (selfRelations.length > 0) {
    findings.push({
      id: "topology_self_neighbor_relations",
      title: "Relaciones CDP/LLDP autoreferenciadas requieren validacion topologica",
      category: "resiliency",
      affectedAssets: Array.from(new Set(selfRelations.flatMap((relation) => [relation.sourceDevice, relation.targetDevice]))).filter(Boolean),
      evidenceRefs: selfRelations.map((relation) => relation.evidenceSource).filter(Boolean).slice(0, 8),
      severity: selfRelations.length > 2 ? "medium" : "low",
      confidence: 82,
      sourceEngine: "cisco-parser",
      status: "ai_suggested"
    });
  }

  const relationCount = new Map<string, number>();
  for (const relation of graph.nodes.relationships) {
    relationCount.set(normalize(relation.sourceDevice), (relationCount.get(normalize(relation.sourceDevice)) ?? 0) + 1);
    relationCount.set(normalize(relation.targetDevice), (relationCount.get(normalize(relation.targetDevice)) ?? 0) + 1);
  }
  const lowCoverage = graph.nodes.devices
    .filter((device) => ["critical", "high"].includes(device.criticality))
    .filter((device) => (relationCount.get(normalize(device.hostname)) ?? 0) <= 1)
    .slice(0, 12);
  if (lowCoverage.length > 0) {
    findings.push({
      id: "topology_critical_devices_low_neighbor_coverage",
      title: "Equipos criticos con baja cobertura de vecinos topologicos",
      category: "resiliency",
      affectedAssets: lowCoverage.map((device) => device.hostname),
      evidenceRefs: lowCoverage.flatMap((device) => device.evidenceRefs).filter(Boolean).slice(0, 8),
      severity: lowCoverage.some((device) => device.criticality === "critical") ? "high" : "medium",
      confidence: graph.nodes.relationships.length > 0 ? 72 : 48,
      sourceEngine: "cisco-parser",
      status: "ai_suggested"
    });
  }

  if (graph.nodes.relationships.length === 0 && graph.nodes.devices.length > 1) {
    findings.push({
      id: "topology_missing_neighbor_evidence",
      title: "No hay evidencia CDP/LLDP suficiente para validar dependencias topologicas",
      category: "resiliency",
      affectedAssets: graph.nodes.devices.slice(0, 20).map((device) => device.hostname),
      evidenceRefs: graph.nodes.devices.flatMap((device) => device.evidenceRefs).filter(Boolean).slice(0, 8),
      severity: "medium",
      confidence: 90,
      sourceEngine: "cisco-parser",
      status: "ai_suggested"
    });
  }

  return findings;
}

function evidenceMatchesStrategy(ref: EvidenceReference, strategy: AIScopeStrategy) {
  const value = `${ref.id} ${ref.sourceFile ?? ""} ${ref.command ?? ""} ${ref.excerpt ?? ""}`.toLowerCase();
  return strategy.evidenceKeywords.some((keyword) => value.includes(keyword.toLowerCase()));
}

function allScopePartition(): ScopePartition {
  return { id: "all", deviceHostnames: [] };
}

function planGraphPartitions(
  devices: Array<{ hostname: string; site: string }>,
  relationships: AssessmentAIContext["topologyRelationships"]
): ScopePartition[] {
  if (relationships.length === 0) return planSitePartitions(devices);

  const knownHosts = new Set(devices.map((device) => normalize(device.hostname)));
  const labels = new Map(devices.map((device) => [normalize(device.hostname), device.hostname]));
  const adjacency = new Map<string, Set<string>>();
  for (const device of devices) adjacency.set(normalize(device.hostname), new Set());

  for (const relation of relationships) {
    const source = normalize(relation.sourceDevice);
    const target = normalize(relation.targetDevice);
    if (!knownHosts.has(source) || !knownHosts.has(target)) continue;
    adjacency.get(source)?.add(target);
    adjacency.get(target)?.add(source);
  }

  const visited = new Set<string>();
  const partitions: ScopePartition[] = [];
  for (const host of Array.from(adjacency.keys()).sort()) {
    if (visited.has(host)) continue;
    const stack = [host];
    const component: string[] = [];
    visited.add(host);
    while (stack.length > 0) {
      const current = stack.pop() as string;
      component.push(labels.get(current) ?? current);
      for (const next of Array.from(adjacency.get(current) ?? []).sort()) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
    partitions.push({
      id: `component-${String(partitions.length + 1).padStart(2, "0")}`,
      deviceHostnames: uniqueSorted(component)
    });
  }
  return partitions;
}

function planSitePartitions(devices: Array<{ hostname: string; site: string }>): ScopePartition[] {
  const bySite = new Map<string, string[]>();
  for (const device of devices) {
    const site = partitionSlug(device.site || "unknown");
    bySite.set(site, [...(bySite.get(site) ?? []), device.hostname]);
  }

  const partitions: ScopePartition[] = [];
  for (const [site, hostnames] of Array.from(bySite.entries()).sort(([left], [right]) => left.localeCompare(right))) {
    const sortedHostnames = uniqueSorted(hostnames);
    for (let index = 0; index < sortedHostnames.length; index += domainPartitionDeviceCap) {
      partitions.push({
        id: `site-${site}-${String(Math.floor(index / domainPartitionDeviceCap) + 1).padStart(2, "0")}`,
        deviceHostnames: sortedHostnames.slice(index, index + domainPartitionDeviceCap)
      });
    }
  }
  return partitions;
}

function applyPartitionCap(partitions: ScopePartition[]): ScopePartition[] {
  const normalizedPartitions = partitions
    .map((partition) => ({ ...partition, deviceHostnames: uniqueSorted(partition.deviceHostnames) }))
    .filter((partition) => partition.deviceHostnames.length > 0);
  if (normalizedPartitions.length <= maxDomainPartitions) return sortPartitions(normalizedPartitions);

  const bySize = [...normalizedPartitions].sort((left, right) =>
    right.deviceHostnames.length - left.deviceHostnames.length || left.id.localeCompare(right.id)
  );
  const kept = bySize.slice(0, maxDomainPartitions - 1);
  const merged = bySize.slice(maxDomainPartitions - 1);
  return sortPartitions([
    ...kept,
    {
      id: "merged-small",
      deviceHostnames: uniqueSorted(merged.flatMap((partition) => partition.deviceHostnames))
    }
  ]);
}

function sortPartitions(partitions: ScopePartition[]) {
  return [...partitions].sort((left, right) => left.id.localeCompare(right.id));
}

function partitionSlug(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function candidateMatchesPartition(candidate: CorrelationCandidate, partitionDeviceSet: Set<string> | null) {
  return !partitionDeviceSet || candidate.involvedDevices.some((device) => partitionDeviceSet.has(normalize(device)));
}

function relationMatchesPartition(
  relation: AssessmentAIContext["topologyRelationships"][number],
  partitionDeviceSet: Set<string> | null
) {
  return !partitionDeviceSet ||
    (partitionDeviceSet.has(normalize(relation.sourceDevice)) && partitionDeviceSet.has(normalize(relation.targetDevice)));
}

function hostnameMatchesPartition(hostname: string, partitionDeviceSet: Set<string> | null) {
  return !partitionDeviceSet || partitionDeviceSet.has(normalize(hostname));
}

function findingMatchesPartition(finding: { affectedAssets?: string[] }, partitionDeviceSet: Set<string> | null) {
  return !partitionDeviceSet || (Array.isArray(finding.affectedAssets) && finding.affectedAssets.some((device) => partitionDeviceSet.has(normalize(device))));
}

function evidenceMatchesPartition(ref: EvidenceReference, partitionDeviceSet: Set<string> | null, relevantEvidenceIds: Set<string>) {
  if (!partitionDeviceSet) return true;
  if (relevantEvidenceIds.has(ref.id)) return true;
  if (ref.deviceId && partitionDeviceSet.has(normalize(ref.deviceId))) return true;
  const source = `${ref.id} ${ref.sourceFile ?? ""}`.toLowerCase();
  return Array.from(partitionDeviceSet).some((hostname) => source.includes(hostname));
}

function countIncludedDevices(record: any) {
  if (Array.isArray(record?.targetInventory)) {
    return record.targetInventory.filter((device: any) => device?.included !== false).length;
  }
  if (Array.isArray(record?.parsed?.devices)) return record.parsed.devices.length;
  return 0;
}

function isExplicitSecurityEvidence(ref: EvidenceReference) {
  const value = `${ref.id} ${ref.command ?? ""} ${ref.excerpt ?? ""}`.toLowerCase();
  return /aaa|snmp-server|community\s+(public|private)|telnet|transport input[^\n]*telnet|ip http server|access-list|permit ip any any|username\s+\S+\s+privilege\s+15\s+password\s+0|crypto|nat|vpn/.test(value);
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function severityRank(value: unknown) {
  const rank: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, informational: 1, info: 1 };
  return rank[String(value ?? "").toLowerCase()] ?? 0;
}

function confidenceRank(value: unknown) {
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  if (typeof value === "number") return value;
  return rank[String(value ?? "").toLowerCase()] ?? 0;
}

function firstSentence(value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const match = text.match(/^.*?[.!?](?:\s|$)/);
  return truncateText((match?.[0] ?? text).trim(), 220);
}

function estimateTokens(value: unknown) {
  return Math.ceil(stableStringify(value).length / 4);
}

function stableStringify(value: unknown) {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.keys(item as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (item as Record<string, unknown>)[key];
        return acc;
      }, {});
    }
    return item;
  });
}

function truncateText(value: string, limit: number) {
  if (!value || value.length <= limit) return value;
  return `${value.slice(0, limit - 1).trimEnd()}...`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
