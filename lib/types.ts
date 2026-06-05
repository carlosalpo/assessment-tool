export type Domain = "enterprise-networking" | "datacenter-networking";

export type FindingStatus = "ai-draft" | "ai_suggested" | "accepted" | "edited" | "validated" | "discarded";
export type RiskLevel = "critical" | "high" | "medium" | "low" | "info";
export type RemediationCategory =
  | "professional_services"
  | "new_technology"
  | "platform_upgrade"
  | "operational_change"
  | "pending_validation";

export const remediationCategoryLabels: Record<RemediationCategory, string> = {
  professional_services: "Servicios profesionales",
  new_technology: "Nueva tecnologia",
  platform_upgrade: "Actualizacion de plataforma",
  operational_change: "Cambio operacional",
  pending_validation: "Pendiente de validacion"
};

export function mapLegacyRemediation(legacy: string): RemediationCategory {
  const normalized = legacy.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "service" || normalized === "professional_services") return "professional_services";
  if (normalized === "investment" || normalized === "new_technology") return "new_technology";
  if (normalized === "platform_upgrade") return "platform_upgrade";
  if (normalized === "operational_change") return "operational_change";
  if (normalized === "mixed" || normalized === "pending-validation" || normalized === "validation_required" || normalized === "pending_validation") {
    return "pending_validation";
  }
  return "pending_validation";
}

export type Client = {
  id: string;
  name: string;
  industry: string;
  owner: string;
  createdAt: string;
};

export type Assessment = {
  id: string;
  clientId: string;
  name: string;
  domains: Domain[];
  status: "draft" | "evidence" | "review" | "roadmap";
  createdAt: string;
};

export type EvidenceFile = {
  id: string;
  name: string;
  type: "txt" | "log" | "zip" | "other";
  content: string;
  uploadedAt: string;
};

export type DeviceInventory = {
  id: string;
  hostname: string;
  model: string;
  serial: string;
  softwareVersion: string;
  suggestedRole: string;
  sourceFiles: string[];
  evidence: string[];
  inventoryItems?: InventoryItem[];
};

export type InventoryItem = {
  id: string;
  hostname: string;
  name: string;
  description: string;
  productId: string;
  serial: string;
  itemType: "chassis" | "supervisor" | "line-card" | "power-supply" | "fan" | "module" | "software" | "unknown";
  sourceFile: string;
  evidence: string[];
};

export type InterfaceRecord = {
  id: string;
  deviceId: string;
  hostname: string;
  name: string;
  status: string;
  vlan?: string;
  duplex?: string;
  speed?: string;
  type?: string;
  description?: string;
  evidence: string[];
};

export type NeighborRelation = {
  id: string;
  localDeviceId: string;
  localHostname: string;
  localInterface: string;
  remoteHostname: string;
  remoteInterface: string;
  protocol: "cdp" | "lldp";
  platform?: string;
  managementIp?: string;
  confidence: number;
  evidence: string[];
};

export type Finding = {
  id: string;
  title: string;
  category: "lifecycle" | "security" | "resiliency" | "operations" | "configuration" | "inventory";
  risk: RiskLevel;
  confidence: number;
  status: FindingStatus;
  affectedAssets: string[];
  evidence: string[];
  recommendation: string;
  remediationCategory: RemediationCategory;
  serviceOffer: string;
  architectNotes?: string;
  aiMetadata?: {
    findingType?: "confirmed_finding" | "probable_issue" | "correlation_suspicion" | "visibility_gap" | "validation_required";
    domain?: "datacenter" | "enterprise_networking" | "security" | "operations" | "performance" | "lifecycle";
    relatedCorrelationCandidates?: string[];
    relatedMetrics?: string[];
    relatedConfigFacts?: string[];
    relatedStateFacts?: string[];
    evidenceTraceRefs?: Array<{
      id: string;
      sourceFile?: string;
      command?: string;
      deviceId?: string;
      interfaceId?: string;
      metricId?: string;
      configFactId?: string;
      stateFactId?: string;
      relationId?: string;
      excerpt?: string;
    }>;
    validationQuestions?: string[];
    limitations?: string[];
    businessImpact?: string;
    technicalImpact?: string;
    probableCause?: string;
  };
};

export type RoadmapItem = {
  id: string;
  quarter: string;
  initiative: string;
  remediationCategory: RemediationCategory;
  investmentBand: "low" | "medium" | "high" | "tbd";
  dependencies: string;
  linkedFindingIds: string[];
};

export type ParsedAssessment = {
  devices: DeviceInventory[];
  interfaces: InterfaceRecord[];
  relations: NeighborRelation[];
  findings: Finding[];
};
