import type {
  Assessment,
  Client,
  DeviceInventory,
  Domain,
  EvidenceFile,
  Finding,
  InterfaceRecord,
  NeighborRelation,
  ParsedAssessment,
  RemediationType,
  RiskLevel
} from "@/lib/types";
import type { OperationalAssessment } from "@/lib/operational-assessment";
import type { PerformanceMetric, PerformanceState } from "@/lib/performance-analysis";

export type AIFindingType = "confirmed_finding" | "probable_issue" | "correlation_suspicion" | "visibility_gap" | "validation_required";
export type AIFindingDomain = "datacenter" | "enterprise_networking" | "security" | "operations" | "performance" | "lifecycle";
export type AISuggestedFindingStatus = "ai_suggested" | "accepted" | "edited" | "discarded" | "validated";
export type CorrelationType =
  | "config_state_mismatch"
  | "config_performance_mismatch"
  | "topology_resiliency_gap"
  | "performance_topology_hotspot"
  | "protocol_instability"
  | "lifecycle_risk_amplifier"
  | "operational_visibility_gap"
  | "security_config_exposure"
  | "capacity_risk"
  | "evidence_conflict";

export type AIContextDevice = {
  id: string;
  hostname: string;
  role: string;
  site: string;
  platform: string;
  model: string;
  softwareVersion: string;
  lifecycleStatus: "unknown" | "active" | "end_of_sale" | "end_of_support" | "obsolete";
  criticality: "low" | "medium" | "high" | "critical";
  evidenceRefs: string[];
};

export type TopologyRelationshipFact = {
  id: string;
  sourceDevice: string;
  sourceInterface: string;
  targetDevice: string;
  targetInterface: string;
  relationshipType: "cdp" | "lldp" | "manual";
  evidenceSource: string;
  confidence: number;
};

export type ConfigurationFact = {
  id: string;
  deviceId: string;
  category: "security" | "interface" | "routing" | "switching" | "management" | "resiliency";
  factType: string;
  description: string;
  normalizedValue: string;
  evidenceRef: string;
  riskRelevance: "low" | "medium" | "high" | "critical";
};

export type OperationalStateFact = {
  id: string;
  deviceId: string;
  category: "interface" | "routing" | "switching" | "logging" | "environment" | "license";
  factType: string;
  observedState: string;
  severityHint: RiskLevel;
  evidenceRef: string;
  timestamp?: string;
};

export type AIContextPerformanceMetric = {
  id: string;
  deviceId: string;
  interfaceId?: string;
  metricType: string;
  value: number;
  unit: string;
  threshold: number;
  severityHint: RiskLevel;
  sampleType: "snapshot" | "historical";
  timeWindow: string;
  evidenceRef: string;
  confidence: number;
};

export type EvidenceReference = {
  id: string;
  sourceFile?: string;
  command?: string;
  deviceId?: string;
  interfaceId?: string;
  metricId?: string;
  configFactId?: string;
  stateFactId?: string;
  relationId?: string;
  findingId?: string;
  excerpt: string;
};

export type DeterministicFindingRef = {
  id: string;
  title: string;
  category: Finding["category"];
  affectedAssets: string[];
  evidenceRefs: string[];
  severity: RiskLevel;
  confidence: number;
  sourceEngine: "cisco-parser" | "performance-engine" | "operational-engine" | "lifecycle-engine" | "ai";
  status: Finding["status"];
};

export type MissingEvidence = {
  expectedEvidence: string;
  missingForDevices: string[];
  impactOnConfidence: "low" | "medium" | "high";
  reason: string;
};

export type AssessmentAIContext = {
  assessmentId: string;
  clientContext: {
    clientName: string;
    industry: string;
    owner: string;
  };
  scope: {
    domains: Domain[];
    performanceEnabled: boolean;
    performanceMode?: string;
  };
  evidenceCoverage: {
    evidenceFileCount: number;
    parsedDeviceCount: number;
    topologyRelationshipCount: number;
    performanceMetricCount: number;
  };
  devices: AIContextDevice[];
  topologyRelationships: TopologyRelationshipFact[];
  configurationFacts: ConfigurationFact[];
  operationalStateFacts: OperationalStateFact[];
  performanceMetrics: AIContextPerformanceMetric[];
  evidenceReferences: EvidenceReference[];
  deterministicFindings: DeterministicFindingRef[];
  riskScores: {
    irir?: number | null;
    ica?: number;
    performanceRiskScore?: number;
    operationalRiskScore?: number;
  };
  operationalAssessmentSummary?: {
    maturityScore: number;
    operationalRiskScore: number;
    confidenceScore: number;
    validationStatus: string;
    keyGaps: string[];
  };
  lifecycleSummary: {
    riskyDeviceCount: number;
    riskyDevices: string[];
  };
  missingEvidence: MissingEvidence[];
  analysisLimitations: string[];
};

export type CorrelationCandidate = {
  id: string;
  assessmentId: string;
  correlationType: CorrelationType;
  title: string;
  description: string;
  involvedDevices: string[];
  involvedInterfaces: string[];
  involvedFindings: string[];
  involvedMetrics: string[];
  involvedConfigFacts: string[];
  involvedStateFacts: string[];
  evidenceRefs: string[];
  confidence: number;
  severityHint: RiskLevel;
  correlationStrength: "weak" | "moderate" | "strong";
  recommendedAIReview: boolean;
};

export type AISuggestedFinding = {
  id: string;
  assessmentId: string;
  title: string;
  description: string;
  findingType: AIFindingType;
  domain: AIFindingDomain;
  severity: Exclude<RiskLevel, "info">;
  confidence: number;
  evidenceRefs: string[];
  relatedDevices: string[];
  relatedInterfaces: string[];
  relatedMetrics: string[];
  relatedConfigFacts: string[];
  relatedStateFacts: string[];
  relatedCorrelationCandidates: string[];
  businessImpact: string;
  technicalImpact: string;
  probableCause: string;
  recommendation: string;
  remediationType: "service" | "investment" | "mixed" | "validation_required";
  validationQuestions: string[];
  limitations: string[];
  status: AISuggestedFindingStatus;
};

export type AIAnalysisState = {
  context?: AssessmentAIContext;
  correlationCandidates: CorrelationCandidate[];
  suggestedFindings: AISuggestedFinding[];
  limitations: string[];
  updatedAt?: string;
};

export type AssessmentAIContextInput = {
  id: string;
  client: Client;
  assessment: Assessment;
  scope: {
    performanceAnalysis?: {
      enabled: boolean;
      mode: string;
    };
  };
  targetInventory: Array<{
    id: string;
    hostname: string;
    managementIp: string;
    serial: string;
    model: string;
    deviceType: string;
    platform: string;
    role: string;
    site: string;
    priority: "low" | "medium" | "high" | "critical";
    included: boolean;
  }>;
  evidenceFiles: EvidenceFile[];
  parsed: ParsedAssessment;
  performance: PerformanceState;
  operationalAssessment?: OperationalAssessment;
  lifecycleEoxRecords?: Record<string, { endOfSaleDate?: string; lastDateOfSupport?: string }>;
  lifecycleConsultedProductIds?: string[];
};

export const emptyAIAnalysisState: AIAnalysisState = {
  correlationCandidates: [],
  suggestedFindings: [],
  limitations: []
};

export function buildAssessmentAIContext(input: AssessmentAIContextInput): AssessmentAIContext {
  const devices = buildContextDevices(input);
  const topologyRelationships = input.parsed.relations.map((relation) => relationshipFact(relation));
  const configurationFacts = extractConfigurationFacts(input);
  const operationalStateFacts = extractOperationalStateFacts(input);
  const performanceMetrics = input.performance.metrics.map((metric) => performanceMetricFact(metric));
  const deterministicFindings = input.parsed.findings.map((finding) => deterministicFindingRef(finding));
  const missingEvidence = buildMissingEvidence(input, devices);
  const evidenceReferences = buildEvidenceReferences({
    devices,
    topologyRelationships,
    configurationFacts,
    operationalStateFacts,
    performanceMetrics,
    deterministicFindings
  });
  const lifecycleRiskyDevices = devices.filter((device) => ["end_of_sale", "end_of_support", "obsolete"].includes(device.lifecycleStatus));
  const limitations = [
    ...missingEvidence.map((item) => item.reason),
    ...(input.scope.performanceAnalysis?.enabled && input.performance.assessment.limitations ? input.performance.assessment.limitations : [])
  ];

  return {
    assessmentId: input.id,
    clientContext: {
      clientName: input.client.name,
      industry: input.client.industry,
      owner: input.client.owner
    },
    scope: {
      domains: input.assessment.domains,
      performanceEnabled: Boolean(input.scope.performanceAnalysis?.enabled),
      performanceMode: input.scope.performanceAnalysis?.mode
    },
    evidenceCoverage: {
      evidenceFileCount: input.evidenceFiles.length,
      parsedDeviceCount: input.parsed.devices.length,
      topologyRelationshipCount: input.parsed.relations.length,
      performanceMetricCount: input.performance.metrics.length
    },
    devices,
    topologyRelationships,
    configurationFacts,
    operationalStateFacts,
    performanceMetrics,
    evidenceReferences,
    deterministicFindings,
    riskScores: {
      performanceRiskScore: input.performance.assessment.performanceRiskScore,
      operationalRiskScore: input.operationalAssessment?.operationalRiskScore
    },
    operationalAssessmentSummary: input.operationalAssessment
      ? {
          maturityScore: input.operationalAssessment.overallMaturityScore,
          operationalRiskScore: input.operationalAssessment.operationalRiskScore,
          confidenceScore: input.operationalAssessment.confidenceScore,
          validationStatus: input.operationalAssessment.status,
          keyGaps: input.operationalAssessment.keyGaps
        }
      : undefined,
    lifecycleSummary: {
      riskyDeviceCount: lifecycleRiskyDevices.length,
      riskyDevices: lifecycleRiskyDevices.map((device) => device.hostname)
    },
    missingEvidence,
    analysisLimitations: Array.from(new Set(limitations)).slice(0, 12)
  };
}

export function generateCorrelationCandidates(context: AssessmentAIContext): CorrelationCandidate[] {
  return dedupeCandidates([
    ...criticalUplinkWithErrorsRule(context),
    ...singleHomedCriticalDeviceRule(context),
    ...portChannelDegradedRule(context),
    ...routingInstabilityWithPhysicalErrorsRule(context),
    ...highUtilizationWithoutHistoryRule(context),
    ...lifecycleRiskAmplifierRule(context),
    ...lackMonitoringForCriticalAssetsRule(context),
    ...securityConfigExposureRule(context),
    ...evidenceConflictRule(context)
  ]);
}

export function validateAISuggestedFinding(
  finding: AISuggestedFinding,
  context?: AssessmentAIContext,
  correlationCandidates: CorrelationCandidate[] = []
) {
  const errors: string[] = [];
  const hasEvidence = finding.evidenceRefs.length > 0;
  const hasMetric = finding.relatedMetrics.length > 0;
  const evidenceCatalog = new Set(context?.evidenceReferences.map((ref) => ref.id) ?? []);
  const metricCatalog = new Set(context?.performanceMetrics.map((metric) => metric.id) ?? []);
  const configFactCatalog = new Set(context?.configurationFacts.map((fact) => fact.id) ?? []);
  const stateFactCatalog = new Set(context?.operationalStateFacts.map((fact) => fact.id) ?? []);
  const correlationCatalog = new Set(correlationCandidates.map((candidate) => candidate.id));

  if (!hasEvidence && finding.findingType === "confirmed_finding") errors.push("confirmed_finding requiere evidenceRefs.");
  if (finding.confidence < 70 && finding.findingType === "confirmed_finding") errors.push("confirmed_finding requiere confidence >= 70.");
  if (/saturaci[oó]n|saturation|utilizacion|utilizaci[oó]n/i.test(`${finding.title} ${finding.description}`) && !hasMetric) {
    errors.push("No se puede afirmar saturacion sin metricas relacionadas.");
  }
  if (finding.limitations.some((limitation) => /sin historico|snapshot/i.test(limitation)) && finding.findingType === "confirmed_finding") {
    errors.push("Hallazgos basados solo en snapshot no deben guardarse como confirmed_finding sin validacion.");
  }
  if (!hasEvidence && !["visibility_gap", "validation_required"].includes(finding.findingType)) {
    errors.push("Ausencia de evidencia debe clasificarse como visibility_gap o validation_required.");
  }
  if (context) {
    const unknownEvidence = finding.evidenceRefs.filter((ref) => !evidenceCatalog.has(ref));
    if (unknownEvidence.length > 0) errors.push(`evidenceRefs no existen en el AssessmentAIContext: ${unknownEvidence.join(", ")}.`);

    const unknownMetrics = finding.relatedMetrics.filter((metricId) => !metricCatalog.has(metricId));
    if (unknownMetrics.length > 0) errors.push(`relatedMetrics no existen en el AssessmentAIContext: ${unknownMetrics.join(", ")}.`);

    const unknownConfigFacts = finding.relatedConfigFacts.filter((factId) => !configFactCatalog.has(factId));
    if (unknownConfigFacts.length > 0) errors.push(`relatedConfigFacts no existen en el AssessmentAIContext: ${unknownConfigFacts.join(", ")}.`);

    const unknownStateFacts = finding.relatedStateFacts.filter((factId) => !stateFactCatalog.has(factId));
    if (unknownStateFacts.length > 0) errors.push(`relatedStateFacts no existen en el AssessmentAIContext: ${unknownStateFacts.join(", ")}.`);
  }
  if (correlationCandidates.length > 0) {
    const unknownCorrelations = finding.relatedCorrelationCandidates.filter((candidateId) => !correlationCatalog.has(candidateId));
    if (unknownCorrelations.length > 0) errors.push(`relatedCorrelationCandidates no existen: ${unknownCorrelations.join(", ")}.`);
  }
  if (context && finding.relatedMetrics.length > 0) {
    const metrics = context.performanceMetrics.filter((metric) => finding.relatedMetrics.includes(metric.id));
    const onlySnapshot = metrics.length > 0 && metrics.every((metric) => metric.sampleType === "snapshot");
    const claimsTrend = /tendencia|trend|historico|hist[oó]rico|recurren|recurring|crecimiento|growth/i.test(
      `${finding.title} ${finding.description} ${finding.technicalImpact} ${finding.probableCause}`
    );
    if (onlySnapshot && claimsTrend) errors.push("Metricas snapshot no pueden usarse como tendencia historica o recurrencia.");
    if (onlySnapshot && finding.findingType === "confirmed_finding") {
      errors.push("Metricas snapshot solo soportan probable_issue, correlation_suspicion o validation_required, no confirmed_finding.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateAIOutputSchema(findings: AISuggestedFinding[]) {
  return findings.map((finding) => ({ id: finding.id, ...validateAISuggestedFinding(finding) }));
}

export function normalizeAISuggestedFinding(raw: Partial<AISuggestedFinding>, assessmentId: string): AISuggestedFinding {
  return {
    id: cleanString(raw.id) || `aif_${stableId(`${assessmentId}-${raw.title ?? "finding"}`)}`,
    assessmentId,
    title: cleanString(raw.title) || "Hallazgo AI sin titulo",
    description: cleanString(raw.description),
    findingType: normalizeFindingType(raw.findingType),
    domain: normalizeDomain(raw.domain),
    severity: normalizeSeverity(raw.severity),
    confidence: normalizeConfidence(raw.confidence),
    evidenceRefs: normalizeStringArray(raw.evidenceRefs),
    relatedDevices: normalizeStringArray(raw.relatedDevices),
    relatedInterfaces: normalizeStringArray(raw.relatedInterfaces),
    relatedMetrics: normalizeStringArray(raw.relatedMetrics),
    relatedConfigFacts: normalizeStringArray(raw.relatedConfigFacts),
    relatedStateFacts: normalizeStringArray(raw.relatedStateFacts),
    relatedCorrelationCandidates: normalizeStringArray(raw.relatedCorrelationCandidates),
    businessImpact: cleanString(raw.businessImpact),
    technicalImpact: cleanString(raw.technicalImpact),
    probableCause: cleanString(raw.probableCause),
    recommendation: cleanString(raw.recommendation),
    remediationType: normalizeAIRemediation(raw.remediationType),
    validationQuestions: normalizeStringArray(raw.validationQuestions),
    limitations: normalizeStringArray(raw.limitations),
    status: normalizeAIStatus(raw.status)
  };
}

export function aiSuggestedFindingToFinding(finding: AISuggestedFinding, context?: AssessmentAIContext): Finding {
  const evidenceById = new Map(context?.evidenceReferences.map((ref) => [ref.id, ref]) ?? []);
  return {
    id: finding.id,
    title: finding.title,
    category: aiDomainToFindingCategory(finding.domain),
    risk: finding.severity,
    confidence: finding.confidence / 100,
    status: finding.status,
    affectedAssets: finding.relatedDevices,
    evidence: finding.evidenceRefs,
    recommendation: finding.recommendation || finding.description,
    remediationType: aiRemediationToRemediation(finding.remediationType),
    serviceOffer: "AI contextual correlation review",
    architectNotes: "",
    aiMetadata: {
      findingType: finding.findingType,
      domain: finding.domain,
      relatedCorrelationCandidates: finding.relatedCorrelationCandidates,
      relatedMetrics: finding.relatedMetrics,
      relatedConfigFacts: finding.relatedConfigFacts,
      relatedStateFacts: finding.relatedStateFacts,
      evidenceTraceRefs: finding.evidenceRefs.flatMap((evidenceRef) => {
        const ref = evidenceById.get(evidenceRef);
        return ref
          ? [{
              id: ref.id,
              sourceFile: ref.sourceFile,
              command: ref.command,
              deviceId: ref.deviceId,
              interfaceId: ref.interfaceId,
              metricId: ref.metricId,
              configFactId: ref.configFactId,
              stateFactId: ref.stateFactId,
              relationId: ref.relationId,
              excerpt: ref.excerpt
            }]
          : [];
      }),
      validationQuestions: finding.validationQuestions,
      limitations: finding.limitations,
      businessImpact: finding.businessImpact,
      technicalImpact: finding.technicalImpact,
      probableCause: finding.probableCause
    }
  };
}

export function acceptedOrValidatedFindings(findings: Finding[]) {
  return findings.filter((finding) => {
    if (finding.status === "discarded") return false;
    if (!finding.aiMetadata) return finding.status === "validated";
    return finding.status === "accepted" || finding.status === "edited" || finding.status === "validated";
  });
}

export function executiveSummaryFindings(findings: Finding[]) {
  return findings.filter((finding) => finding.status === "validated" || (finding.aiMetadata && finding.status === "accepted"));
}

export function buildSpecializedAIPrompt(type: "executive" | "technical_correlation" | "performance" | "risk_narrative" | "remediation_roadmap") {
  const shared = [
    "No inventes datos.",
    "Usa solo el AssessmentAIContext y CorrelationCandidates provistos.",
    "Toda conclusion debe incluir evidenceRefs existentes en AssessmentAIContext.evidenceReferences.",
    "Usa relatedMetrics, relatedConfigFacts, relatedStateFacts y relatedCorrelationCandidates solo si el ID existe en el input.",
    "Si falta evidencia, clasifica como visibility_gap o validation_required.",
    "La ausencia de evidencia nunca equivale a bajo riesgo; equivale a brecha de visibilidad o validacion pendiente.",
    "Metricas sampleType=snapshot solo soportan sintomas puntuales; no las describas como tendencia historica.",
    "Los hallazgos quedan como ai_suggested hasta validacion del arquitecto."
  ];
  const prompts = {
    executive: [
      "ExecutiveAIAnalysisPrompt: genera narrativa ejecutiva de alto nivel.",
      "Input principal: riskScores, top deterministic findings, top correlation candidates y limitations.",
      "Output: executiveSummary, keyRisks, businessImpact, recommendedPriorities, limitations."
    ],
    technical_correlation: [
      "TechnicalCorrelationAnalysisPrompt: analiza correlaciones tecnicas y propone hallazgos sugeridos.",
      "Input principal: CorrelationCandidates, evidenceRefs, topology, config facts, state facts y performance metrics.",
      "Output: AISuggestedFinding[] con evidenceRefs y confidence."
    ],
    performance: [
      "PerformanceAIAnalysisPrompt: analiza performance con contexto topologico y operativo.",
      "Input principal: performanceMetrics, topologyRelationships, criticality y visibility gaps.",
      "Output: sintomas, causas probables, validaciones requeridas y acciones recomendadas."
    ],
    risk_narrative: [
      "RiskNarrativePrompt: convierte hallazgos aceptados/validados en narrativa de riesgo.",
      "Input principal: IRIR, ICA, findings y correlations.",
      "Output: risk narrative, risk drivers y prioritization rationale."
    ],
    remediation_roadmap: [
      "RemediationRoadmapPrompt: agrupa hallazgos en acciones de servicio, inversion o mixtas.",
      "Input principal: findings, severity, dependencies y affected assets.",
      "Output: remediation plan, investment roadmap, quick wins y dependencies."
    ]
  };
  return [...shared, ...prompts[type]].join("\n");
}

export function aiSuggestedFindingsSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["suggestedFindings"],
    properties: {
      suggestedFindings: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "assessmentId",
            "title",
            "description",
            "findingType",
            "domain",
            "severity",
            "confidence",
            "evidenceRefs",
            "relatedDevices",
            "relatedInterfaces",
            "relatedMetrics",
            "relatedConfigFacts",
            "relatedStateFacts",
            "relatedCorrelationCandidates",
            "businessImpact",
            "technicalImpact",
            "probableCause",
            "recommendation",
            "remediationType",
            "validationQuestions",
            "limitations",
            "status"
          ],
          properties: {
            id: { type: "string" },
            assessmentId: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            findingType: { type: "string", enum: ["confirmed_finding", "probable_issue", "correlation_suspicion", "visibility_gap", "validation_required"] },
            domain: { type: "string", enum: ["datacenter", "enterprise_networking", "security", "operations", "performance", "lifecycle"] },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            evidenceRefs: { type: "array", items: { type: "string" } },
            relatedDevices: { type: "array", items: { type: "string" } },
            relatedInterfaces: { type: "array", items: { type: "string" } },
            relatedMetrics: { type: "array", items: { type: "string" } },
            relatedConfigFacts: { type: "array", items: { type: "string" } },
            relatedStateFacts: { type: "array", items: { type: "string" } },
            relatedCorrelationCandidates: { type: "array", items: { type: "string" } },
            businessImpact: { type: "string" },
            technicalImpact: { type: "string" },
            probableCause: { type: "string" },
            recommendation: { type: "string" },
            remediationType: { type: "string", enum: ["service", "investment", "mixed", "validation_required"] },
            validationQuestions: { type: "array", items: { type: "string" } },
            limitations: { type: "array", items: { type: "string" } },
            status: { type: "string", enum: ["ai_suggested", "accepted", "edited", "discarded", "validated"] }
          }
        }
      }
    }
  };
}

function buildContextDevices(input: AssessmentAIContextInput): AIContextDevice[] {
  const assetsByHost = new Map(input.targetInventory.map((asset) => [asset.hostname.toLowerCase(), asset]));
  const parsedByHost = new Map(input.parsed.devices.map((device) => [device.hostname.toLowerCase(), device]));
  const hostnames = new Set([...assetsByHost.keys(), ...parsedByHost.keys()]);

  return Array.from(hostnames).map((key) => {
    const asset = assetsByHost.get(key);
    const parsed = parsedByHost.get(key);
    const hostname = parsed?.hostname ?? asset?.hostname ?? key;
    const lifecycleStatus = inferLifecycleStatus(parsed, input.lifecycleEoxRecords ?? {});
    return {
      id: parsed?.id ?? asset?.id ?? hostname,
      hostname,
      role: asset?.role || parsed?.suggestedRole || "unknown",
      site: asset?.site || "unknown",
      platform: asset?.platform || inferPlatform(parsed?.model ?? ""),
      model: parsed?.model && parsed.model !== "No identificado" ? parsed.model : asset?.model || "unknown",
      softwareVersion: parsed?.softwareVersion ?? "unknown",
      lifecycleStatus,
      criticality: normalizeCriticality(asset?.priority, asset?.role || parsed?.suggestedRole || ""),
      evidenceRefs: Array.from(new Set([...(parsed?.sourceFiles ?? []), ...(parsed?.evidence ?? [])])).slice(0, 8)
    };
  });
}

function relationshipFact(relation: NeighborRelation): TopologyRelationshipFact {
  return {
    id: relation.id,
    sourceDevice: relation.localHostname,
    sourceInterface: relation.localInterface,
    targetDevice: relation.remoteHostname,
    targetInterface: relation.remoteInterface,
    relationshipType: relation.protocol,
    evidenceSource: relation.evidence[0] ?? `${relation.localHostname} ${relation.localInterface} -> ${relation.remoteHostname}`,
    confidence: Math.round(relation.confidence * 100)
  };
}

function extractConfigurationFacts(input: AssessmentAIContextInput): ConfigurationFact[] {
  const facts: ConfigurationFact[] = [];
  for (const file of input.evidenceFiles) {
    const hostname = extractHostname(file.content) || file.name.replace(/\.[^.]+$/, "");
    addMatches(facts, file, hostname, /^snmp-server community\s+(public|private)\b[^\n]*/gim, "security", "insecure_snmp", "Comunidad SNMP insegura o por defecto", "critical");
    addMatches(facts, file, hostname, /transport input[^\n]*telnet[^\n]*/gim, "management", "telnet_enabled", "Acceso administrativo permite Telnet", "critical");
    addMatches(facts, file, hostname, /^ip http server\b[^\n]*/gim, "management", "http_server_enabled", "Servidor HTTP no cifrado habilitado", "medium");
    addMatches(facts, file, hostname, /^access-list\s+\S+[^\n]*permit\s+ip\s+any\s+any[^\n]*/gim, "security", "permit_any_acl", "ACL permisiva permit ip any any", "critical");
    addMatches(facts, file, hostname, /^username\s+\S+\s+privilege\s+15\s+password\s+0\s+[^\n]+/gim, "management", "weak_local_credentials", "Credenciales locales en texto claro o privilegio amplio", "high");
    addMatches(facts, file, hostname, /^interface\s+Port-channel|^interface\s+TenGigabitEthernet|^interface\s+GigabitEthernet/gim, "interface", "interface_configured", "Configuracion de interfaz detectada", "low");
    addMatches(facts, file, hostname, /^Group\s+Port-channel|Po\d+\(S[D]\)|\(\w*s\)|\(\w*I\)/gim, "resiliency", "port_channel_configured", "Port-channel configurado o con miembros no agrupados", "medium");
  }
  return facts;
}

function extractOperationalStateFacts(input: AssessmentAIContextInput): OperationalStateFact[] {
  const facts: OperationalStateFact[] = [];
  for (const intf of input.parsed.interfaces) {
    if (/err-disabled|disabled|suspended|notconnect/i.test(intf.status)) {
      facts.push({
        id: `state_${stableId(`${intf.hostname}-${intf.name}-${intf.status}`)}`,
        deviceId: intf.hostname,
        category: "interface",
        factType: "interface_degraded",
        observedState: `${intf.name} ${intf.status}`,
        severityHint: /err-disabled|suspended/i.test(intf.status) ? "high" : "medium",
        evidenceRef: intf.evidence[0] ?? `${intf.hostname} ${intf.name} ${intf.status}`
      });
    }
  }

  for (const file of input.evidenceFiles) {
    const hostname = extractHostname(file.content) || file.name.replace(/\.[^.]+$/, "");
    addStateMatches(facts, file, hostname, /%OSPF|EXSTART|DOWN\/|Active|neighbor.*down|BGP.*Active/gi, "routing", "routing_instability", "Routing neighbor instability", "high");
    addStateMatches(facts, file, hostname, /%SPANTREE|topology changes|RECV_PVID_ERR|bpduguard/gi, "switching", "stp_instability", "STP/BPDU event detected", "high");
    addStateMatches(facts, file, hostname, /Po\d+\(SD\)|\(\w*s\)|\(\w*I\)|CANNOT_BUNDLE/gi, "switching", "port_channel_degraded", "Port-channel member down/suspended/not bundled", "high");
    addStateMatches(facts, file, hostname, /NTP.*UNSYNC|unsynchronized|\.INIT\./gi, "logging", "time_sync_issue", "NTP/time synchronization issue", "medium");
  }
  return facts;
}

function performanceMetricFact(metric: PerformanceMetric): AIContextPerformanceMetric {
  const threshold = metricThreshold(metric.metricType);
  return {
    id: metric.id,
    deviceId: metric.deviceId,
    interfaceId: metric.interfaceId,
    metricType: metric.metricType,
    value: metric.value,
    unit: metric.unit,
    threshold,
    severityHint: metric.value >= threshold * 1.2 ? "critical" : metric.value >= threshold ? "high" : "medium",
    sampleType: metric.sampleType,
    timeWindow: metric.timeWindow,
    evidenceRef: `${metric.source}: ${metric.metricType} ${metric.value}${metric.unit}${metric.interfaceId ? ` on ${metric.interfaceId}` : ""}`,
    confidence: Math.round(metric.confidence * 100)
  };
}

function deterministicFindingRef(finding: Finding): DeterministicFindingRef {
  return {
    id: finding.id,
    title: finding.title,
    category: finding.category,
    affectedAssets: finding.affectedAssets,
    evidenceRefs: finding.evidence,
    severity: finding.risk,
    confidence: Math.round(finding.confidence * 100),
    sourceEngine: finding.id.startsWith("PF-") ? "performance-engine" : finding.aiMetadata ? "ai" : "cisco-parser",
    status: finding.status
  };
}

function buildEvidenceReferences(input: {
  devices: AIContextDevice[];
  topologyRelationships: TopologyRelationshipFact[];
  configurationFacts: ConfigurationFact[];
  operationalStateFacts: OperationalStateFact[];
  performanceMetrics: AIContextPerformanceMetric[];
  deterministicFindings: DeterministicFindingRef[];
}): EvidenceReference[] {
  const refs = new Map<string, EvidenceReference>();
  const add = (ref: EvidenceReference) => {
    if (!ref.id) return;
    refs.set(ref.id, { ...refs.get(ref.id), ...ref, excerpt: ref.excerpt || refs.get(ref.id)?.excerpt || ref.id });
  };

  for (const device of input.devices) {
    for (const ref of device.evidenceRefs) {
      add({
        id: ref,
        sourceFile: looksLikeFileName(ref) ? ref : undefined,
        deviceId: device.hostname,
        excerpt: ref
      });
    }
  }

  for (const relation of input.topologyRelationships) {
    add({
      id: relation.evidenceSource,
      command: relation.relationshipType === "cdp" ? "show cdp neighbors detail" : "show lldp neighbors detail",
      deviceId: relation.sourceDevice,
      interfaceId: relation.sourceInterface,
      relationId: relation.id,
      excerpt: relation.evidenceSource
    });
  }

  for (const fact of input.configurationFacts) {
    const parsed = parseTextEvidenceRef(fact.evidenceRef);
    add({
      id: fact.evidenceRef,
      sourceFile: parsed.sourceFile,
      command: parsed.command ?? commandForConfigurationFact(fact.factType),
      deviceId: fact.deviceId,
      configFactId: fact.id,
      excerpt: parsed.excerpt
    });
  }

  for (const fact of input.operationalStateFacts) {
    const parsed = parseTextEvidenceRef(fact.evidenceRef);
    add({
      id: fact.evidenceRef,
      sourceFile: parsed.sourceFile,
      command: parsed.command ?? commandForStateFact(fact.factType),
      deviceId: fact.deviceId,
      stateFactId: fact.id,
      excerpt: parsed.excerpt
    });
  }

  for (const metric of input.performanceMetrics) {
    const parsed = parseTextEvidenceRef(metric.evidenceRef);
    add({
      id: metric.evidenceRef,
      sourceFile: parsed.sourceFile,
      command: commandForMetric(metric.metricType),
      deviceId: metric.deviceId,
      interfaceId: metric.interfaceId,
      metricId: metric.id,
      excerpt: parsed.excerpt
    });
  }

  for (const finding of input.deterministicFindings) {
    for (const ref of finding.evidenceRefs) {
      const parsed = parseTextEvidenceRef(ref);
      add({
        id: ref,
        sourceFile: parsed.sourceFile,
        command: parsed.command,
        findingId: finding.id,
        excerpt: parsed.excerpt
      });
    }
  }

  return Array.from(refs.values());
}

function buildMissingEvidence(input: AssessmentAIContextInput, devices: AIContextDevice[]): MissingEvidence[] {
  const missing: MissingEvidence[] = [];
  const criticalDevices = devices.filter((device) => device.criticality === "critical" || device.criticality === "high");
  const performanceDevices = new Set(input.performance.metrics.map((metric) => metric.deviceId.toLowerCase()));
  const devicesWithoutPerformance = criticalDevices.filter((device) => !performanceDevices.has(device.hostname.toLowerCase()));
  if (input.scope.performanceAnalysis?.enabled && devicesWithoutPerformance.length > 0) {
    missing.push({
      expectedEvidence: "Performance CLI/NMS evidence",
      missingForDevices: devicesWithoutPerformance.map((device) => device.hostname),
      impactOnConfidence: "high",
      reason: "Equipos criticos sin metricas de performance reconocidas."
    });
  }
  if (input.scope.performanceAnalysis?.enabled && input.performance.metrics.every((metric) => metric.sampleType === "snapshot")) {
    missing.push({
      expectedEvidence: "Historico de performance 7/30/90 dias",
      missingForDevices: criticalDevices.map((device) => device.hostname),
      impactOnConfidence: "medium",
      reason: "El analisis de performance se basa solo en snapshot; no confirma tendencia o recurrencia."
    });
  }
  if (input.parsed.relations.length === 0 && devices.length > 1) {
    missing.push({
      expectedEvidence: "CDP/LLDP neighbors detail",
      missingForDevices: devices.map((device) => device.hostname),
      impactOnConfidence: "high",
      reason: "No hay relaciones topologicas suficientes para afirmar dependencias."
    });
  }
  return missing;
}

function criticalUplinkWithErrorsRule(context: AssessmentAIContext): CorrelationCandidate[] {
  return context.performanceMetrics
    .filter((metric) => metric.interfaceId && ["crc_errors", "input_errors", "output_errors", "drops"].includes(metric.metricType) && metric.value >= metric.threshold)
    .filter((metric) => isUplink(context, metric.deviceId, metric.interfaceId!))
    .map((metric) => candidate(context, "config_performance_mismatch", {
      title: `Uplink critico con ${metric.metricType}`,
      description: `${metric.deviceId} ${metric.interfaceId} supera umbral de ${metric.metricType}: ${metric.value}${metric.unit}.`,
      involvedDevices: [metric.deviceId],
      involvedInterfaces: [metric.interfaceId!],
      involvedMetrics: [metric.id],
      evidenceRefs: [metric.evidenceRef],
      confidence: Math.max(75, metric.confidence),
      severityHint: metric.severityHint
    }));
}

function singleHomedCriticalDeviceRule(context: AssessmentAIContext): CorrelationCandidate[] {
  return context.devices
    .filter((device) => device.criticality === "critical" || device.criticality === "high")
    .filter((device) => relationshipCount(context, device.hostname) <= 1)
    .map((device) => candidate(context, "topology_resiliency_gap", {
      title: `Dispositivo critico con una sola relacion detectada`,
      description: `${device.hostname} tiene criticidad ${device.criticality} y ${relationshipCount(context, device.hostname)} relacion topologica detectada.`,
      involvedDevices: [device.hostname],
      evidenceRefs: device.evidenceRefs,
      confidence: context.topologyRelationships.length > 0 ? 72 : 45,
      severityHint: device.criticality === "critical" ? "high" : "medium"
    }));
}

function portChannelDegradedRule(context: AssessmentAIContext): CorrelationCandidate[] {
  return context.operationalStateFacts
    .filter((fact) => fact.factType === "port_channel_degraded")
    .map((fact) => candidate(context, "config_state_mismatch", {
      title: "Port-channel configurado con estado degradado",
      description: fact.observedState,
      involvedDevices: [fact.deviceId],
      involvedStateFacts: [fact.id],
      evidenceRefs: [fact.evidenceRef],
      confidence: 82,
      severityHint: fact.severityHint
    }));
}

function routingInstabilityWithPhysicalErrorsRule(context: AssessmentAIContext): CorrelationCandidate[] {
  const routingFacts = context.operationalStateFacts.filter((fact) => fact.factType === "routing_instability");
  const errorMetrics = context.performanceMetrics.filter((metric) => ["crc_errors", "input_errors", "output_errors", "drops"].includes(metric.metricType) && metric.value >= metric.threshold);
  const candidates: CorrelationCandidate[] = [];
  for (const fact of routingFacts) {
    const relatedMetrics = errorMetrics.filter((metric) => metric.deviceId === fact.deviceId);
    if (relatedMetrics.length === 0) continue;
    candidates.push(candidate(context, "protocol_instability", {
      title: "Inestabilidad de protocolo correlacionada con errores fisicos/logicos",
      description: `${fact.deviceId} presenta eventos de routing y metricas de errores/drops en interfaces relacionadas.`,
      involvedDevices: [fact.deviceId],
      involvedMetrics: relatedMetrics.map((metric) => metric.id),
      involvedStateFacts: [fact.id],
      involvedInterfaces: relatedMetrics.map((metric) => metric.interfaceId).filter(Boolean) as string[],
      evidenceRefs: [fact.evidenceRef, ...relatedMetrics.map((metric) => metric.evidenceRef)],
      confidence: 78,
      severityHint: "high"
    }));
  }
  return candidates;
}

function highUtilizationWithoutHistoryRule(context: AssessmentAIContext): CorrelationCandidate[] {
  return context.performanceMetrics
    .filter((metric) => metric.metricType === "utilization" && metric.value >= metric.threshold)
    .filter((metric) => metric.sampleType === "snapshot" && !hasHistoricalMetric(context, metric.deviceId, metric.interfaceId, "utilization"))
    .map((metric) => candidate(context, "capacity_risk", {
      title: "Alta utilizacion sin historico para tendencia",
      description: `${metric.deviceId} ${metric.interfaceId ?? ""} reporta ${metric.value}${metric.unit} en snapshot sin historico reconocido.`,
      involvedDevices: [metric.deviceId],
      involvedInterfaces: metric.interfaceId ? [metric.interfaceId] : [],
      involvedMetrics: [metric.id],
      evidenceRefs: [metric.evidenceRef],
      confidence: 70,
      severityHint: metric.value >= 90 ? "critical" : "high"
    }));
}

function lifecycleRiskAmplifierRule(context: AssessmentAIContext): CorrelationCandidate[] {
  const riskyDevices = context.devices.filter((device) =>
    ["end_of_sale", "end_of_support", "obsolete"].includes(device.lifecycleStatus) &&
    (device.criticality === "critical" || device.criticality === "high")
  );
  return riskyDevices.flatMap((device) => {
    const symptoms = context.performanceMetrics.filter((metric) => metric.deviceId === device.hostname && metric.value >= metric.threshold);
    if (symptoms.length === 0) return [];
    return [candidate(context, "lifecycle_risk_amplifier", {
      title: "Riesgo de lifecycle amplificado por sintomas operativos",
      description: `${device.hostname} tiene estado ${device.lifecycleStatus}, criticidad ${device.criticality} y sintomas de performance/estado.`,
      involvedDevices: [device.hostname],
      involvedMetrics: symptoms.map((metric) => metric.id),
      evidenceRefs: [...device.evidenceRefs, ...symptoms.map((metric) => metric.evidenceRef)],
      confidence: 76,
      severityHint: "high"
    })];
  });
}

function lackMonitoringForCriticalAssetsRule(context: AssessmentAIContext): CorrelationCandidate[] {
  return context.missingEvidence
    .filter((item) => /performance|historico|metricas/i.test(item.expectedEvidence + item.reason))
    .flatMap((item) => item.missingForDevices.map((hostname) => candidate(context, "operational_visibility_gap", {
      title: "Brecha de visibilidad en activo critico",
      description: `${hostname}: ${item.reason}`,
      involvedDevices: [hostname],
      evidenceRefs: [`Missing evidence: ${item.expectedEvidence}`],
      confidence: item.impactOnConfidence === "high" ? 82 : 68,
      severityHint: item.impactOnConfidence === "high" ? "high" : "medium"
    })));
}

function securityConfigExposureRule(context: AssessmentAIContext): CorrelationCandidate[] {
  return context.configurationFacts
    .filter((fact) => fact.category === "security" || fact.riskRelevance === "critical" || ["telnet_enabled", "insecure_snmp", "permit_any_acl", "weak_local_credentials"].includes(fact.factType))
    .map((fact) => candidate(context, "security_config_exposure", {
      title: "Exposicion de seguridad por configuracion",
      description: fact.description,
      involvedDevices: [fact.deviceId],
      involvedConfigFacts: [fact.id],
      evidenceRefs: [fact.evidenceRef],
      confidence: 88,
      severityHint: fact.riskRelevance === "critical" ? "critical" : "high"
    }));
}

function evidenceConflictRule(context: AssessmentAIContext): CorrelationCandidate[] {
  const conflicts = context.deterministicFindings.filter((finding) => /inventario|modelo|serial|conflict/i.test(finding.title));
  return conflicts.map((finding) => candidate(context, "evidence_conflict", {
    title: "Conflicto de evidencia detectado",
    description: finding.title,
    involvedDevices: finding.affectedAssets,
    involvedFindings: [finding.id],
    evidenceRefs: finding.evidenceRefs,
    confidence: finding.confidence,
    severityHint: "medium"
  }));
}

function candidate(context: AssessmentAIContext, correlationType: CorrelationType, input: Partial<CorrelationCandidate> & Pick<CorrelationCandidate, "title" | "description">): CorrelationCandidate {
  const evidenceRefs = Array.from(new Set(input.evidenceRefs ?? [])).filter(Boolean).slice(0, 8);
  const confidence = clamp(input.confidence ?? 65, 0, 100);
  return {
    id: `corr_${stableId(`${context.assessmentId}-${correlationType}-${input.title}-${evidenceRefs.join("|")}`)}`,
    assessmentId: context.assessmentId,
    correlationType,
    title: input.title,
    description: input.description,
    involvedDevices: Array.from(new Set(input.involvedDevices ?? [])).filter(Boolean),
    involvedInterfaces: Array.from(new Set(input.involvedInterfaces ?? [])).filter(Boolean),
    involvedFindings: Array.from(new Set(input.involvedFindings ?? [])).filter(Boolean),
    involvedMetrics: Array.from(new Set(input.involvedMetrics ?? [])).filter(Boolean),
    involvedConfigFacts: Array.from(new Set(input.involvedConfigFacts ?? [])).filter(Boolean),
    involvedStateFacts: Array.from(new Set(input.involvedStateFacts ?? [])).filter(Boolean),
    evidenceRefs,
    confidence,
    severityHint: input.severityHint ?? "medium",
    correlationStrength: confidence >= 80 ? "strong" : confidence >= 65 ? "moderate" : "weak",
    recommendedAIReview: confidence >= 60 && evidenceRefs.length > 0
  };
}

function addMatches(
  facts: ConfigurationFact[],
  file: EvidenceFile,
  hostname: string,
  pattern: RegExp,
  category: ConfigurationFact["category"],
  factType: string,
  description: string,
  riskRelevance: ConfigurationFact["riskRelevance"]
) {
  for (const match of file.content.matchAll(pattern)) {
    const evidence = match[0].trim();
    facts.push({
      id: `cfg_${stableId(`${hostname}-${factType}-${evidence}`)}`,
      deviceId: hostname,
      category,
      factType,
      description,
      normalizedValue: evidence,
      evidenceRef: `${file.name}: ${evidence}`,
      riskRelevance
    });
  }
}

function addStateMatches(
  facts: OperationalStateFact[],
  file: EvidenceFile,
  hostname: string,
  pattern: RegExp,
  category: OperationalStateFact["category"],
  factType: string,
  description: string,
  severityHint: RiskLevel
) {
  for (const match of file.content.matchAll(pattern)) {
    const evidence = match[0].trim();
    facts.push({
      id: `state_${stableId(`${hostname}-${factType}-${evidence}`)}`,
      deviceId: hostname,
      category,
      factType,
      observedState: description,
      severityHint,
      evidenceRef: `${file.name}: ${evidence}`
    });
  }
}

function relationshipCount(context: AssessmentAIContext, hostname: string) {
  return context.topologyRelationships.filter((relation) =>
    relation.sourceDevice.toLowerCase() === hostname.toLowerCase() ||
    relation.targetDevice.toLowerCase() === hostname.toLowerCase()
  ).length;
}

function isUplink(context: AssessmentAIContext, hostname: string, intf: string) {
  const related = context.topologyRelationships.some((relation) =>
    relation.sourceDevice === hostname && relation.sourceInterface === intf ||
    relation.targetDevice === hostname && relation.targetInterface === intf
  );
  if (related) return true;
  return /Te|Po|Port-channel|wan|uplink|trunk/i.test(intf);
}

function hasHistoricalMetric(context: AssessmentAIContext, deviceId: string, interfaceId: string | undefined, metricType: string) {
  return context.performanceMetrics.some((metric) =>
    metric.deviceId === deviceId &&
    metric.interfaceId === interfaceId &&
    metric.metricType === metricType &&
    metric.sampleType === "historical"
  );
}

function inferLifecycleStatus(device: DeviceInventory | undefined, eoxRecords: Record<string, { endOfSaleDate?: string; lastDateOfSupport?: string }>): AIContextDevice["lifecycleStatus"] {
  const pids = [device?.model, ...(device?.inventoryItems ?? []).map((item) => item.productId)].filter(Boolean) as string[];
  const records = pids.map((pid) => eoxRecords[pid]).filter(Boolean);
  if (records.some((record) => isPastDate(record.lastDateOfSupport))) return "end_of_support";
  if (records.some((record) => isPastDate(record.endOfSaleDate))) return "end_of_sale";
  if (/^(12|15)\./.test(device?.softwareVersion ?? "")) return "obsolete";
  return records.length > 0 ? "active" : "unknown";
}

function normalizeCriticality(priority: string | undefined, role: string) {
  if (priority === "critical" || /core|wan|internet|firewall|collapsed/i.test(role)) return "critical";
  if (priority === "high" || /distribution|dc|datacenter/i.test(role)) return "high";
  if (priority === "low") return "low";
  return "medium";
}

function inferPlatform(model: string) {
  if (/asa|firepower|fpr/i.test(model)) return "asa";
  if (/n9k|nexus/i.test(model)) return "nx-os";
  return "ios-xe";
}

function metricThreshold(metricType: string) {
  if (metricType === "utilization" || metricType === "cpu" || metricType === "memory") return 80;
  if (metricType === "drops" || metricType === "input_errors" || metricType === "output_errors") return 10;
  if (metricType === "crc_errors") return 1;
  return 1;
}

function extractHostname(content: string) {
  return content.match(/^hostname\s+(\S+)/im)?.[1] ?? content.match(/^(\S+)\s+uptime is\s+/im)?.[1] ?? content.match(/^(\S+)#\s*show\s+/im)?.[1] ?? "";
}

function parseTextEvidenceRef(value: string) {
  const [sourceFile, ...rest] = value.split(":");
  const excerpt = rest.length > 0 ? rest.join(":").trim() : value;
  return {
    sourceFile: rest.length > 0 && looksLikeFileName(sourceFile.trim()) ? sourceFile.trim() : undefined,
    command: inferCommandFromExcerpt(excerpt),
    excerpt
  };
}

function looksLikeFileName(value: string) {
  return /\.(txt|log|cfg|zip)$/i.test(value.trim());
}

function inferCommandFromExcerpt(excerpt: string) {
  if (/snmp-server|line vty|transport input|username|ip http|access-list/i.test(excerpt)) return "show running-config";
  if (/Group\s+Port-channel|Po\d+|CANNOT_BUNDLE|LACP|PAgP/i.test(excerpt)) return "show etherchannel summary";
  if (/%OSPF|BGP.*Active|neighbor.*down/i.test(excerpt)) return "show ip ospf neighbor / show bgp summary / show logging";
  if (/%SPANTREE|bpduguard|topology changes/i.test(excerpt)) return "show spanning-tree / show logging";
  if (/NTP|UNSYNC|INIT/i.test(excerpt)) return "show ntp associations / show clock";
  if (/interface|connected|notconnect|err-disabled|suspended/i.test(excerpt)) return "show interfaces status / show interfaces";
  return undefined;
}

function commandForConfigurationFact(factType: string) {
  if (["insecure_snmp", "telnet_enabled", "http_server_enabled", "permit_any_acl", "weak_local_credentials"].includes(factType)) {
    return "show running-config";
  }
  if (factType === "port_channel_configured") return "show etherchannel summary";
  if (factType === "interface_configured") return "show interfaces description / show interfaces status";
  return undefined;
}

function commandForStateFact(factType: string) {
  const commands: Record<string, string> = {
    interface_degraded: "show interfaces status / show interfaces",
    routing_instability: "show ip ospf neighbor / show bgp summary / show logging",
    stp_instability: "show spanning-tree / show logging",
    port_channel_degraded: "show etherchannel summary / show logging",
    time_sync_issue: "show ntp associations / show clock"
  };
  return commands[factType];
}

function commandForMetric(metricType: string) {
  if (["crc_errors", "input_errors", "output_errors", "drops", "utilization"].includes(metricType)) return "show interfaces";
  if (metricType === "cpu") return "show processes cpu";
  if (metricType === "memory") return "show memory statistics";
  return "performance evidence";
}

function isPastDate(value?: string) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function dedupeCandidates(candidates: CorrelationCandidate[]) {
  return Array.from(new Map(candidates.map((item) => [item.id, item])).values());
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];
}

function normalizeFindingType(value: unknown): AIFindingType {
  return ["confirmed_finding", "probable_issue", "correlation_suspicion", "visibility_gap", "validation_required"].includes(String(value))
    ? value as AIFindingType
    : "validation_required";
}

function normalizeDomain(value: unknown): AIFindingDomain {
  return ["datacenter", "enterprise_networking", "security", "operations", "performance", "lifecycle"].includes(String(value))
    ? value as AIFindingDomain
    : "operations";
}

function normalizeSeverity(value: unknown): Exclude<RiskLevel, "info"> {
  return ["low", "medium", "high", "critical"].includes(String(value)) ? value as Exclude<RiskLevel, "info"> : "medium";
}

function normalizeConfidence(value: unknown) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 50;
  return numeric <= 1 ? Math.round(numeric * 100) : clamp(Math.round(numeric), 0, 100);
}

function normalizeAIRemediation(value: unknown): AISuggestedFinding["remediationType"] {
  return ["service", "investment", "mixed", "validation_required"].includes(String(value)) ? value as AISuggestedFinding["remediationType"] : "validation_required";
}

function normalizeAIStatus(value: unknown): AISuggestedFindingStatus {
  return ["accepted", "edited", "discarded", "validated"].includes(String(value)) ? value as AISuggestedFindingStatus : "ai_suggested";
}

function aiDomainToFindingCategory(domain: AIFindingDomain): Finding["category"] {
  if (domain === "security") return "security";
  if (domain === "lifecycle") return "lifecycle";
  if (domain === "performance" || domain === "operations") return "operations";
  if (domain === "datacenter" || domain === "enterprise_networking") return "resiliency";
  return "configuration";
}

function aiRemediationToRemediation(remediationType: AISuggestedFinding["remediationType"]): RemediationType {
  return remediationType === "validation_required" ? "pending-validation" : remediationType;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
