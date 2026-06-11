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
  RiskLevel
} from "@/lib/types";
import type { OperationalAssessment } from "@/lib/operational-assessment";
import type { PerformanceMetric, PerformanceState } from "@/lib/performance-analysis";
import { inferLifecycleEvaluation, type LifecycleEoxRecord, type LifecycleSource } from "./lifecycle-analysis.ts";

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
  lifecycleSource?: LifecycleSource;
  lifecycleDates?: {
    endOfSaleDate?: string;
    lastDateOfSupport?: string;
  };
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

export type AIAnalysisState = {
  context?: AssessmentAIContext;
  correlationCandidates: CorrelationCandidate[];
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
  lifecycleEoxRecords?: Record<string, LifecycleEoxRecord>;
  lifecycleConsultedProductIds?: string[];
};

export const emptyAIAnalysisState: AIAnalysisState = {
  correlationCandidates: [],
  limitations: []
};

export function buildAssessmentAIContext(input: AssessmentAIContextInput): AssessmentAIContext {
  const devices = buildContextDevices(input);
  const topologyRelationships = input.parsed.relations.map((relation) => relationshipFact(relation));
  const configurationFacts = extractConfigurationFacts(input);
  const operationalStateFacts = extractOperationalStateFacts(input);
  const performanceMetrics = input.performance.metrics.map((metric) => performanceMetricFact(metric));
  const deterministicFindings = input.parsed.findings
    .filter(includeFindingAsPriorSignal)
    .map((finding) => deterministicFindingRef(finding));
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

function buildContextDevices(input: AssessmentAIContextInput): AIContextDevice[] {
  const assetsByHost = new Map(input.targetInventory.map((asset) => [asset.hostname.toLowerCase(), asset]));
  const parsedByHost = new Map(input.parsed.devices.map((device) => [device.hostname.toLowerCase(), device]));
  const evidenceByHost = buildParsedEvidenceByHost(input.parsed);
  const hostnames = new Set([...assetsByHost.keys(), ...parsedByHost.keys(), ...evidenceByHost.keys()]);

  return Array.from(hostnames).map((key) => {
    const asset = assetsByHost.get(key);
    const parsed = parsedByHost.get(key);
    const inferredEvidence = Array.from(evidenceByHost.get(key) ?? []);
    const hostname = parsed?.hostname ?? asset?.hostname ?? key;
    const lifecycleEvaluation = inferLifecycleEvaluation(parsed, input.lifecycleEoxRecords ?? {});
    return {
      id: parsed?.id ?? asset?.id ?? hostname,
      hostname,
      role: asset?.role || parsed?.suggestedRole || "unknown",
      site: asset?.site || "unknown",
      platform: asset?.platform || inferPlatform(parsed?.model ?? ""),
      model: parsed?.model && parsed.model !== "No identificado" ? parsed.model : asset?.model || "unknown",
      softwareVersion: parsed?.softwareVersion ?? "unknown",
      lifecycleStatus: lifecycleEvaluation.status,
      lifecycleSource: lifecycleEvaluation.source,
      lifecycleDates: lifecycleEvaluation.source
        ? (lifecycleEvaluation.source === "hardware" ? lifecycleEvaluation.hardware.dates : lifecycleEvaluation.software.dates)
        : undefined,
      criticality: normalizeCriticality(asset?.priority, asset?.role || parsed?.suggestedRole || ""),
      evidenceRefs: Array.from(new Set([...(parsed?.sourceFiles ?? []), ...(parsed?.evidence ?? []), ...inferredEvidence])).slice(0, 8)
    };
  });
}

function buildParsedEvidenceByHost(parsed: ParsedAssessment) {
  const refs = new Map<string, Set<string>>();
  const add = (hostname: string | undefined, values: Array<string | undefined>) => {
    if (!hostname) return;
    const key = hostname.toLowerCase();
    const set = refs.get(key) ?? new Set<string>();
    values.filter((value): value is string => Boolean(value?.trim())).forEach((value) => set.add(value));
    refs.set(key, set);
  };

  for (const intf of parsed.interfaces) {
    add(intf.hostname, intf.evidence);
  }
  for (const relation of parsed.relations) {
    add(relation.localHostname, relation.evidence);
    add(relation.remoteHostname, relation.evidence);
  }
  return refs;
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
    const segments = splitEvidenceIntoDeviceSegments(file);
    const includeHostnameInEvidence = segments.length > 1;
    for (const segment of segments) {
      addMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /^snmp-server community\s+(public|private)\b[^\n]*/gim, "security", "insecure_snmp", "Comunidad SNMP insegura o por defecto", "critical");
      addMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /transport input[^\n]*telnet[^\n]*/gim, "management", "telnet_enabled", "Acceso administrativo permite Telnet", "critical");
      addMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /^ip http server\b[^\n]*/gim, "management", "http_server_enabled", "Servidor HTTP no cifrado habilitado", "medium");
      addMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /^access-list\s+\S+[^\n]*permit\s+ip\s+any\s+any[^\n]*/gim, "security", "permit_any_acl", "ACL permisiva permit ip any any", "critical");
      addMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /^username\s+\S+\s+privilege\s+15\s+password\s+0\s+[^\n]+/gim, "management", "weak_local_credentials", "Credenciales locales en texto claro o privilegio amplio", "high");
      addMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /^interface\s+Port-channel|^interface\s+TenGigabitEthernet|^interface\s+GigabitEthernet/gim, "interface", "interface_configured", "Configuracion de interfaz detectada", "low");
      addMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /^Group\s+Port-channel|Po\d+\(S[D]\)|\(\w*s\)|\(\w*I\)/gim, "resiliency", "port_channel_configured", "Port-channel configurado o con miembros no agrupados", "medium");
      addRunningConfigFacts(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence);
    }
  }
  for (const intf of input.parsed.interfaces) {
    facts.push({
      id: `cfg_${stableId(`${intf.hostname}-interface_inventory-${intf.name}-${intf.status}-${intf.vlan ?? ""}`)}`,
      deviceId: intf.hostname,
      category: "interface",
      factType: "interface_configured",
      description: "Interfaz detectada en evidencia operacional",
      normalizedValue: `${intf.name} ${intf.description ?? ""} ${intf.status} ${intf.vlan ?? ""}`.trim(),
      evidenceRef: intf.evidence[0] ?? `${intf.hostname}: ${intf.name} ${intf.status}`,
      riskRelevance: /err-disabled|suspended/i.test(intf.status) ? "medium" : "low"
    });
  }
  return dedupeConfigurationFacts(facts);
}

function addRunningConfigFacts(
  facts: ConfigurationFact[],
  sourceFile: string,
  content: string,
  hostname: string,
  includeHostnameInEvidence: boolean
) {
  const runningConfig = extractCommandOutput(content, "show running-config");
  if (!runningConfig) return;

  const add = (
    factType: string,
    category: ConfigurationFact["category"],
    description: string,
    normalizedValue: string,
    evidence: string,
    riskRelevance: ConfigurationFact["riskRelevance"]
  ) => {
    const evidenceRef = includeHostnameInEvidence ? `${sourceFile}: ${hostname}: ${evidence}` : `${sourceFile}: ${evidence}`;
    facts.push({
      id: `cfg_${stableId(`${hostname}-${factType}-${normalizedValue}`)}`,
      deviceId: hostname,
      category,
      factType,
      description,
      normalizedValue,
      evidenceRef,
      riskRelevance
    });
  };

  if (!/^\s*aaa\s+new-model\b|^\s*feature\s+tacacs\+?\b|^\s*(tacacs|radius)-server\b|^\s*aaa\s+group\s+server\b/im.test(runningConfig)) {
    add("aaa_missing", "management", "AAA centralizado no visible en running-config", "Sin AAA/TACACS/RADIUS en running-config", "show running-config sin aaa new-model, TACACS ni RADIUS", "high");
  }
  if (!/^\s*logging\s+(host|server)\b/im.test(runningConfig)) {
    add("syslog_missing", "management", "Syslog central no visible en running-config", "Sin logging host/server en running-config", "show running-config sin logging host/server", "medium");
  }
  if (!/^\s*ntp\s+(server|peer)\b/im.test(runningConfig)) {
    add("ntp_missing", "management", "NTP confiable no visible en running-config", "Sin ntp server/peer en running-config", "show running-config sin ntp server/peer", "medium");
  }

  const interfaceBlocks = extractInterfaceBlocks(runningConfig);
  const trunkWithoutAllowed = interfaceBlocks
    .filter((item) => /^\s*switchport\s+mode\s+trunk\b/im.test(item.body))
    .filter((item) => !/^\s*switchport\s+trunk\s+allowed\s+vlan\b/im.test(item.body))
    .map((item) => item.name);
  if (trunkWithoutAllowed.length > 0) {
    add(
      "trunk_allowed_vlan_missing",
      "switching",
      "Trunks sin lista allowed VLAN explicita",
      `${trunkWithoutAllowed.length} trunks sin allowed VLAN explicita: ${trunkWithoutAllowed.slice(0, 8).join(", ")}`,
      `show running-config: ${trunkWithoutAllowed.length} trunks sin switchport trunk allowed vlan (${trunkWithoutAllowed.slice(0, 8).join(", ")})`,
      "medium"
    );
  }

  const hasGlobalBpduGuard = /^\s*spanning-tree\s+portfast\s+(edge\s+)?bpduguard\s+default\b/im.test(runningConfig);
  const accessWithoutBpduGuard = interfaceBlocks
    .filter((item) => /^\s*switchport\s+mode\s+access\b/im.test(item.body))
    .filter((item) => !/^\s*spanning-tree\s+bpduguard\s+enable\b/im.test(item.body))
    .map((item) => item.name);
  if (!hasGlobalBpduGuard && accessWithoutBpduGuard.length > 0) {
    add(
      "bpdu_guard_missing_access",
      "switching",
      "Puertos de acceso sin BPDU Guard visible",
      `${accessWithoutBpduGuard.length} access ports sin BPDU Guard: ${accessWithoutBpduGuard.slice(0, 8).join(", ")}`,
      `show running-config: ${accessWithoutBpduGuard.length} access ports sin spanning-tree bpduguard enable (${accessWithoutBpduGuard.slice(0, 8).join(", ")})`,
      "medium"
    );
  }

  if (accessWithoutBpduGuard.length > 0 && !/^\s*ip\s+dhcp\s+snooping\b/im.test(runningConfig)) {
    add(
      "dhcp_snooping_missing",
      "security",
      "DHCP Snooping no visible en switches con puertos de acceso",
      "Sin ip dhcp snooping en running-config con puertos de acceso",
      "show running-config contiene puertos access pero no ip dhcp snooping",
      "medium"
    );
  }

  if (/^\s*feature\s+vpc\b/im.test(runningConfig) && !/^\s*vpc\s+domain\b/im.test(runningConfig)) {
    add(
      "vpc_feature_without_domain",
      "resiliency",
      "NX-OS tiene feature vPC habilitado sin dominio vPC visible",
      "feature vpc sin vpc domain/peer-keepalive/peer-link en running-config",
      "show running-config contiene feature vpc pero no vpc domain",
      "high"
    );
  }

  if ((/^\s*vlan\s+\d+/im.test(runningConfig) || interfaceBlocks.some((item) => /switchport/i.test(item.body))) && !/^\s*spanning-tree\s+(mode|vlan)\b/im.test(runningConfig)) {
    add(
      "stp_mode_or_root_missing",
      "switching",
      "Modo o root STP no visible en running-config",
      "Sin spanning-tree mode ni prioridades/root por VLAN en running-config",
      "show running-config con VLAN/switchport sin spanning-tree mode ni spanning-tree vlan",
      "medium"
    );
  }
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
    const segments = splitEvidenceIntoDeviceSegments(file);
    const includeHostnameInEvidence = segments.length > 1;
    for (const segment of segments) {
      addStateMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /%OSPF|EXSTART|DOWN\/|Active|neighbor.*down|BGP.*Active/gi, "routing", "routing_instability", "Routing neighbor instability", "high");
      addStateMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /%SPANTREE|topology changes|RECV_PVID_ERR|bpduguard/gi, "switching", "stp_instability", "STP/BPDU event detected", "high");
      addStateMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /Po\d+\(SD\)|\(\w*s\)|\(\w*I\)|CANNOT_BUNDLE/gi, "switching", "port_channel_degraded", "Port-channel member down/suspended/not bundled", "high");
      addStateMatches(facts, file.name, segment.content, segment.hostname, includeHostnameInEvidence, /NTP.*UNSYNC|unsynchronized|\.INIT\./gi, "logging", "time_sync_issue", "NTP/time synchronization issue", "medium");
    }
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

function includeFindingAsPriorSignal(finding: Finding) {
  if (finding.status === "discarded") return false;
  if (finding.aiMetadata) {
    return finding.status === "accepted" || finding.status === "edited" || finding.status === "validated";
  }
  return true;
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
  sourceFile: string,
  content: string,
  hostname: string,
  includeHostnameInEvidence: boolean,
  pattern: RegExp,
  category: ConfigurationFact["category"],
  factType: string,
  description: string,
  riskRelevance: ConfigurationFact["riskRelevance"]
) {
  for (const match of content.matchAll(pattern)) {
    const evidence = match[0].trim();
    const evidenceRef = includeHostnameInEvidence ? `${sourceFile}: ${hostname}: ${evidence}` : `${sourceFile}: ${evidence}`;
    facts.push({
      id: `cfg_${stableId(`${hostname}-${factType}-${evidence}`)}`,
      deviceId: hostname,
      category,
      factType,
      description,
      normalizedValue: evidence,
      evidenceRef,
      riskRelevance
    });
  }
}

function addStateMatches(
  facts: OperationalStateFact[],
  sourceFile: string,
  content: string,
  hostname: string,
  includeHostnameInEvidence: boolean,
  pattern: RegExp,
  category: OperationalStateFact["category"],
  factType: string,
  description: string,
  severityHint: RiskLevel
) {
  for (const match of content.matchAll(pattern)) {
    const evidence = match[0].trim();
    const evidenceRef = includeHostnameInEvidence ? `${sourceFile}: ${hostname}: ${evidence}` : `${sourceFile}: ${evidence}`;
    facts.push({
      id: `state_${stableId(`${hostname}-${factType}-${evidence}`)}`,
      deviceId: hostname,
      category,
      factType,
      observedState: description,
      severityHint,
      evidenceRef
    });
  }
}

type EvidenceDeviceSegment = {
  content: string;
  hostname: string;
};

function splitEvidenceIntoDeviceSegments(file: EvidenceFile): EvidenceDeviceSegment[] {
  const fallbackHostname = file.name.replace(/\.[^.]+$/, "");
  const content = file.content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const promptSegments = splitByPromptCommands(content);
  const segments = promptSegments.length > 1 ? promptSegments : splitByUptimeHeaders(content);

  return segments.map((segment) => ({
    content: segment.content,
    hostname: extractHostname(segment.content) || segment.hostname || fallbackHostname
  })).filter((segment) => segment.content.trim() && segment.hostname.trim());
}

function splitByPromptCommands(content: string): Array<{ content: string; hostname?: string }> {
  const promptRegex = /^([A-Za-z0-9_.:-]+)[#>]\s*show\s+[^\n]*$/gim;
  const matches = Array.from(content.matchAll(promptRegex));
  if (matches.length <= 1) return [{ content }];

  const grouped: Array<{ content: string; hostname?: string }> = [];
  for (const [index, match] of matches.entries()) {
    const hostname = match[1];
    const segment = content.slice(match.index ?? 0, matches[index + 1]?.index ?? content.length);
    const previous = grouped[grouped.length - 1];
    if (previous?.hostname?.toLowerCase() === hostname.toLowerCase()) {
      previous.content = `${previous.content.trimEnd()}\n${segment}`;
    } else {
      grouped.push({ hostname, content: segment });
    }
  }
  return grouped;
}

function splitByUptimeHeaders(content: string): Array<{ content: string; hostname?: string }> {
  const uptimeRegex = /^([A-Za-z0-9_.:-]+)\s+uptime is\s+/gim;
  const matches = Array.from(content.matchAll(uptimeRegex));
  if (matches.length <= 1) return [{ content }];

  return matches.map((match, index) => ({
    hostname: match[1],
    content: content.slice(match.index ?? 0, matches[index + 1]?.index ?? content.length)
  }));
}

function extractCommandOutput(content: string, command: string) {
  const lines = content.split("\n");
  const commandLine = new RegExp(`^[A-Za-z0-9_.:-]+[#>]\\s*${escapeRegExp(command)}\\s*$`, "i");
  const nextCommandLine = /^[A-Za-z0-9_.:-]+[#>]\s*show\s+/i;
  const start = lines.findIndex((line) => commandLine.test(line.trim()));
  if (start < 0) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (nextCommandLine.test(lines[index].trim())) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

function extractInterfaceBlocks(runningConfig: string) {
  const matches = Array.from(runningConfig.matchAll(/^interface\s+(.+)$/gim));
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? runningConfig.length;
    return {
      name: match[1].trim(),
      body: runningConfig.slice(start, end)
    };
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dedupeConfigurationFacts(facts: ConfigurationFact[]) {
  return Array.from(new Map(facts.map((fact) => [fact.id, fact])).values());
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
  if (/snmp-server|line vty|transport input|username|ip http|access-list|aaa|tacacs|radius|logging host|logging server|ntp server|switchport|bpduguard|dhcp snooping|feature vpc|vpc domain|spanning-tree/i.test(excerpt)) return "show running-config";
  if (/Group\s+Port-channel|Po\d+|CANNOT_BUNDLE|LACP|PAgP/i.test(excerpt)) return "show etherchannel summary";
  if (/%OSPF|BGP.*Active|neighbor.*down/i.test(excerpt)) return "show ip ospf neighbor / show bgp summary / show logging";
  if (/%SPANTREE|bpduguard|topology changes/i.test(excerpt)) return "show spanning-tree / show logging";
  if (/NTP|UNSYNC|INIT/i.test(excerpt)) return "show ntp associations / show clock";
  if (/interface|connected|notconnect|err-disabled|suspended/i.test(excerpt)) return "show interfaces status / show interfaces";
  return undefined;
}

function commandForConfigurationFact(factType: string) {
  if ([
    "insecure_snmp",
    "telnet_enabled",
    "http_server_enabled",
    "permit_any_acl",
    "weak_local_credentials",
    "aaa_missing",
    "syslog_missing",
    "ntp_missing",
    "trunk_allowed_vlan_missing",
    "bpdu_guard_missing_access",
    "dhcp_snooping_missing",
    "vpc_feature_without_domain",
    "stp_mode_or_root_missing"
  ].includes(factType)) {
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
