import type {
  AIContextDevice,
  AIContextPerformanceMetric,
  AssessmentAIContext,
  ConfigurationFact,
  EvidenceReference,
  OperationalStateFact,
  TopologyRelationshipFact
} from "./ai-analysis.ts";

const maxNeighbors = 12;
const maxProtocolFacts = 16;
const maxConfigurationFacts = 32;
const maxOperationalStateFacts = 24;
const maxPerformanceMetrics = 24;
const maxEvidenceReferences = 40;
const interactionCategories = new Set<ConfigurationFact["category"]>(["routing", "switching", "management"]);

export type DeviceInteraction = {
  peer: string;
  localInterface: string;
  peerInterface: string;
  protocol: "cdp" | "lldp" | "manual";
  evidenceSource: string;
};

export type DeviceContext = {
  deviceId: string;
  found: boolean;
  identity: {
    id: string;
    hostname: string;
    role: string;
    model: string;
    site: string;
    criticality: AIContextDevice["criticality"] | "unknown";
    lifecycleStatus: AIContextDevice["lifecycleStatus"] | "unknown";
    evidenceRefs: string[];
  };
  interactions: DeviceInteraction[];
  protocolFacts: ConfigurationFact[];
  configurationFacts: ConfigurationFact[];
  operationalStateFacts: OperationalStateFact[];
  performanceMetrics: AIContextPerformanceMetric[];
  evidenceReferences: EvidenceReference[];
  summary: string;
};

export function buildDeviceContext(context: AssessmentAIContext, deviceId: string): DeviceContext {
  const device = findDevice(context, deviceId);
  const deviceKeys = deviceMatchKeys(device, deviceId);
  const configurationFacts = context.configurationFacts.filter((fact) => matchesAnyDeviceKey(fact.deviceId, deviceKeys)).slice(0, maxConfigurationFacts);
  const operationalStateFacts = context.operationalStateFacts.filter((fact) => matchesAnyDeviceKey(fact.deviceId, deviceKeys)).slice(0, maxOperationalStateFacts);
  const performanceMetrics = context.performanceMetrics.filter((metric) => matchesAnyDeviceKey(metric.deviceId, deviceKeys)).slice(0, maxPerformanceMetrics);
  const relationshipFacts = context.topologyRelationships.filter((relation) => relationshipMatchesDevice(relation, deviceKeys)).slice(0, maxNeighbors);
  const interactions = relationshipFacts.map((relation) => interactionFromRelationship(relation, deviceKeys));
  const protocolFacts = configurationFacts.filter((fact) => interactionCategories.has(fact.category)).slice(0, maxProtocolFacts);
  const evidenceReferences = collectEvidenceReferences(context, {
    deviceKeys,
    device,
    relationships: relationshipFacts,
    configurationFacts,
    operationalStateFacts,
    performanceMetrics
  });

  return {
    deviceId,
    found: Boolean(device),
    identity: {
      id: device?.id ?? deviceId,
      hostname: device?.hostname ?? deviceId,
      role: device?.role ?? "unknown",
      model: device?.model ?? "unknown",
      site: device?.site ?? "unknown",
      criticality: device?.criticality ?? "unknown",
      lifecycleStatus: device?.lifecycleStatus ?? "unknown",
      evidenceRefs: [...(device?.evidenceRefs ?? [])]
    },
    interactions,
    protocolFacts,
    configurationFacts,
    operationalStateFacts,
    performanceMetrics,
    evidenceReferences,
    summary: summarizeDeviceContext(device, deviceId, interactions, protocolFacts)
  };
}

function findDevice(context: AssessmentAIContext, deviceId: string) {
  const key = normalize(deviceId);
  return context.devices.find((device) => normalize(device.id) === key || normalize(device.hostname) === key);
}

function deviceMatchKeys(device: AIContextDevice | undefined, deviceId: string) {
  return new Set([deviceId, device?.id, device?.hostname].filter((value): value is string => Boolean(value)).map(normalize));
}

function matchesAnyDeviceKey(value: string | undefined, deviceKeys: Set<string>) {
  return Boolean(value && deviceKeys.has(normalize(value)));
}

function relationshipMatchesDevice(relation: TopologyRelationshipFact, deviceKeys: Set<string>) {
  return matchesAnyDeviceKey(relation.sourceDevice, deviceKeys) || matchesAnyDeviceKey(relation.targetDevice, deviceKeys);
}

function interactionFromRelationship(relation: TopologyRelationshipFact, deviceKeys: Set<string>): DeviceInteraction {
  const isSource = matchesAnyDeviceKey(relation.sourceDevice, deviceKeys);
  return {
    peer: isSource ? relation.targetDevice : relation.sourceDevice,
    localInterface: isSource ? relation.sourceInterface : relation.targetInterface,
    peerInterface: isSource ? relation.targetInterface : relation.sourceInterface,
    protocol: relation.relationshipType,
    evidenceSource: relation.evidenceSource
  };
}

function collectEvidenceReferences(
  context: AssessmentAIContext,
  input: {
    deviceKeys: Set<string>;
    device: AIContextDevice | undefined;
    relationships: TopologyRelationshipFact[];
    configurationFacts: ConfigurationFact[];
    operationalStateFacts: OperationalStateFact[];
    performanceMetrics: AIContextPerformanceMetric[];
  }
) {
  const evidenceIds = new Set<string>();
  input.device?.evidenceRefs.forEach((id) => evidenceIds.add(id));
  input.relationships.forEach((relation) => evidenceIds.add(relation.evidenceSource));
  input.configurationFacts.forEach((fact) => evidenceIds.add(fact.evidenceRef));
  input.operationalStateFacts.forEach((fact) => evidenceIds.add(fact.evidenceRef));
  input.performanceMetrics.forEach((metric) => evidenceIds.add(metric.evidenceRef));

  return context.evidenceReferences
    .filter((ref) => evidenceIds.has(ref.id) || matchesAnyDeviceKey(ref.deviceId, input.deviceKeys))
    .slice(0, maxEvidenceReferences);
}

function summarizeDeviceContext(device: AIContextDevice | undefined, deviceId: string, interactions: DeviceInteraction[], protocolFacts: ConfigurationFact[]) {
  if (!device) return `${deviceId}: equipo no encontrado en el contexto AI.`;
  const neighborText = interactions.length > 0
    ? `vecinos ${interactions.slice(0, 3).map((item) => `${item.peer} via ${item.protocol}`).join(", ")}`
    : "sin vecinos topologicos en contexto";
  const protocolText = protocolFacts.length > 0
    ? `protocolos/senales ${Array.from(new Set(protocolFacts.map((fact) => fact.factType))).slice(0, 4).join(", ")}`
    : "sin senales de protocolo configuradas";
  return `${device.hostname}: rol ${device.role}, modelo ${device.model}, criticidad ${device.criticality}; ${neighborText}; ${protocolText}.`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
