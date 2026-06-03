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
    priorScopeSummaries: Array<{ scopeId: string; status: string; executiveSummary?: string | null; findingCount: number; recommendationCount: number }>;
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

const packetVersion = "ai-scope-packet-v1";
const defaultMaxInputTokens = 24000;

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
}): AIScopePacket {
  const strategy = getAIScopeStrategy(input.scopeId);
  const context = buildAssessmentAIContext(input.record);
  const graph = buildAssessmentKnowledgeGraph(input.record);
  const relevantDeviceIds = new Set<string>();
  const relevantEvidenceIds = new Set<string>();

  const openCorrelationCandidates = graph.nodes.correlations
    .filter((candidate) => isCorrelationRelevant(candidate, strategy, input.scopeId))
    .slice(0, input.scopeId === "topology" ? 90 : 50);
  for (const candidate of openCorrelationCandidates) {
    candidate.involvedDevices.forEach((device) => relevantDeviceIds.add(normalize(device)));
    candidate.evidenceRefs.forEach((ref) => relevantEvidenceIds.add(ref));
  }

  const devices = graph.nodes.devices
    .filter((device) => isDeviceRelevant(device, input.scopeId, relevantDeviceIds))
    .slice(0, input.scopeId === "topology" ? 160 : 90);
  devices.forEach((device) => device.evidenceRefs.forEach((ref) => relevantEvidenceIds.add(ref)));

  const relationships = graph.nodes.relationships
    .filter((relation) => input.scopeId === "topology" || relevantDeviceIds.has(normalize(relation.sourceDevice)) || relevantDeviceIds.has(normalize(relation.targetDevice)))
    .slice(0, input.scopeId === "topology" ? 140 : 60);
  relationships.forEach((relation) => relevantEvidenceIds.add(relation.evidenceSource));

  const configFacts = graph.nodes.configFacts
    .filter((fact) => isConfigFactRelevant(fact, strategy, relevantDeviceIds))
    .slice(0, input.scopeId === "configuration" || input.scopeId === "security" ? 120 : 45);
  configFacts.forEach((fact) => relevantEvidenceIds.add(fact.evidenceRef));

  const stateFacts = graph.nodes.stateFacts
    .filter((fact) => isStateFactRelevant(fact, strategy, relevantDeviceIds))
    .slice(0, input.scopeId === "operations" || input.scopeId === "evidence" ? 120 : 45);
  stateFacts.forEach((fact) => relevantEvidenceIds.add(fact.evidenceRef));

  const performanceMetrics = graph.nodes.performanceMetrics
    .filter((metric) => isMetricRelevant(metric, input.scopeId, relevantDeviceIds, openCorrelationCandidates))
    .slice(0, 70);
  performanceMetrics.forEach((metric) => relevantEvidenceIds.add(metric.evidenceRef));

  const deterministicFindings = graph.nodes.deterministicFindings
    .filter((finding) => isFindingRelevant(finding, input.scopeId, relevantDeviceIds))
    .slice(0, 60);
  const scopeDerivedFindings = buildScopeDerivedFindingRefs(context, graph, input.scopeId);
  deterministicFindings.forEach((finding) => finding.evidenceRefs.forEach((ref) => relevantEvidenceIds.add(ref)));
  scopeDerivedFindings.forEach((finding) => finding.evidenceRefs.forEach((ref) => relevantEvidenceIds.add(ref)));

  const missingEvidence = context.missingEvidence
    .filter((item) => isMissingEvidenceRelevant(item, input.scopeId))
    .slice(0, 12)
    .map((item) => ({ ...item, missingForDevices: item.missingForDevices.slice(0, 25) }));

  const unresolvedQuestions = missingEvidence.map((item) => `${item.expectedEvidence}: ${item.reason}`);
  const selectedEvidence = graph.nodes.evidenceRefs
    .filter((ref) => relevantEvidenceIds.has(ref.id) || evidenceMatchesStrategy(ref, strategy))
    .map(compactEvidenceRef);

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
    outputContract: {
      schemaName: "scope_analysis_result",
      requiredEvidenceRefs: true,
      allowedFindingTypes: strategy.allowedFindingTypes
    },
    budget: {
      maxInputTokens: input.maxInputTokens ?? defaultMaxInputTokens,
      estimatedInputTokens: 0,
      trimmed: false,
      excludedEvidenceRefs: 0
    }
  };

  return applyContextBudget(initialPacket);
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

export function validateScopeAnalysisResult(parsed: any, packet: AIScopePacket): ScopeValidationResult {
  const strategy = getAIScopeStrategy(packet.scopeId);
  const evidenceCatalog = new Set(packet.evidencePack.map((ref) => ref.id));
  const configFactCatalog = new Set(packet.graphSlice.configFacts.map((fact) => fact.id));
  const stateFactCatalog = new Set(packet.graphSlice.stateFacts.map((fact) => fact.id));
  const metricCatalog = new Set(packet.graphSlice.performanceMetrics.map((metric) => metric.id));
  const correlationCatalog = new Set(packet.memory.openCorrelationCandidates.map((candidate) => candidate.id));
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
      const hasTopologyEvidence = evidenceRefs.some((ref) => packet.evidencePack.some((item) => item.id === ref && item.relationId));
      if (!hasTopologyEvidence) reasons.push("SPOF o single-homed requiere evidencia topologica relacionada.");
    }
    if (packet.scopeId === "configuration" && relatedFactIds.length === 0 && evidenceRefs.length === 0) {
      reasons.push("Configuracion requiere configFactId o evidenceRef de configuracion.");
    }
    if (packet.scopeId === "security" && ["critical", "high"].includes(severity) && ["confirmed_finding", "probable_issue"].includes(findingType)) {
      const hasSecurityFact = relatedFactIds.some((id) => configFactCatalog.has(id));
      const hasExplicitSecurityEvidence = evidenceRefs.some((refId) => {
        const ref = packet.evidencePack.find((item) => item.id === refId);
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

function applyContextBudget(packet: AIScopePacket): AIScopePacket {
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
  return {
    ...next,
    budget: {
      ...next.budget,
      estimatedInputTokens: estimated,
      trimmed: excludedEvidenceRefs > 0 || estimated > packet.budget.maxInputTokens,
      excludedEvidenceRefs
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

function summarizePriorScopeResults(results: any[], strategy: AIScopeStrategy) {
  const wanted = new Set(strategy.priorScopes);
  return results
    .filter((result) => wanted.has(String(result.scopeId) as AIScopeId))
    .map((result) => ({
      scopeId: String(result.scopeId),
      status: String(result.status ?? "unknown"),
      executiveSummary: result.executiveSummary ?? result.resultJson?.executiveSummary ?? null,
      findingCount: Array.isArray(result.findingsJson) ? result.findingsJson.length : Array.isArray(result.resultJson?.findings) ? result.resultJson.findings.length : 0,
      recommendationCount: Array.isArray(result.recommendationsJson) ? result.recommendationsJson.length : Array.isArray(result.resultJson?.recommendations) ? result.resultJson.recommendations.length : 0
    }))
    .slice(0, 6);
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

function isExplicitSecurityEvidence(ref: EvidenceReference) {
  const value = `${ref.id} ${ref.command ?? ""} ${ref.excerpt ?? ""}`.toLowerCase();
  return /aaa|snmp-server|community\s+(public|private)|telnet|transport input[^\n]*telnet|ip http server|access-list|permit ip any any|username\s+\S+\s+privilege\s+15\s+password\s+0|crypto|nat|vpn/.test(value);
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
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
