"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Bot,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Copy,
  Activity,
  FileCode2,
  FileArchive,
  FileDown,
  FileText,
  Cpu,
  GitBranch,
  GitMerge,
  LayoutDashboard,
  Layers,
  LoaderCircle,
  Lock,
  LogOut,
  Moon,
  Network,
  Pencil,
  PlayCircle,
  Plus,
  RotateCcw,
  Save,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  ScrollText,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wrench,
  MoreHorizontal,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import JSZip from "jszip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { ScrollX } from "@/components/ui/scroll-x";
import { parseCiscoEvidence } from "@/lib/cisco-parsers";
import {
  activateTemplateVersion,
  compareTemplateWithCurrentDefinition,
  documentTemplateDefinitions,
  documentTypeLabels,
  generateBaseTemplate,
  generatePlaceholderReport,
  renderDocxTemplate,
  validateUploadedTemplate,
  mapAssessmentDataToPlaceholders,
  type DocumentTemplateVersion,
  type DocumentType,
  type TemplateCompatibilityResult
} from "@/lib/document-templates";
import { exportFindingsToExcel } from "@/lib/export-findings";
import { exportInventoryTemplate } from "@/lib/export-inventory-template";
import { importInventoryWorkbook } from "@/lib/import-inventory-workbook";
import {
  acceptedOrValidatedFindings,
  emptyAIAnalysisState,
  executiveSummaryFindings,
  type AIAnalysisState
} from "@/lib/ai-analysis";
import {
  findLifecycleEoxRecord,
  isConsultableLifecycleKey,
  lifecycleLookupVariants,
  lifecycleRecordStatus,
  type LifecycleEoxRecord as SharedLifecycleEoxRecord
} from "@/lib/lifecycle-analysis";
import {
  areaToFindingCategory,
  filterFindingsByArea,
  summarizeAreaFindings,
  type AreaFindingSummary
} from "@/lib/ai-finding-summary";
import { humanizeScopeStatus } from "@/lib/ai-status-labels";
import {
  aiScopeDisplayOrder,
  aiScopePhaseDisplay,
  crossScopeCorrelationDisplay,
  flagForStage,
  scopeProgressFromStatus,
  type AIStageFlag,
  type AIScopeDisplayGroup,
  type AIScopeDisplayMetadata,
  type AIScopeOrStageDisplayId
} from "@/lib/ai-scope-ui";
import { buildPipelineView, type PipelineViewStage } from "@/lib/ai-pipeline-view";
import {
  buildOperationalAIContext,
  createDefaultOperationalAssessment,
  operationalDomainLabels,
  operationalMaturityLevel,
  operationalQuestionBank,
  processOperationalAssessment,
  scoreOperationalAnswer,
  type OperationalAnswer,
  type OperationalAssessment,
  type OperationalEvidenceLevel,
  type OperationalInterview,
  type OperationalInterviewType,
  type OperationalQuestion
} from "@/lib/operational-assessment";
import { isOperationalAssessmentComplete } from "@/lib/operations-analysis";
import {
  buildPerformanceAIContext,
  buildPerformanceAssessment,
  buildPerformanceCharts,
  classifyPerformanceEvidence,
  createDefaultPerformanceScope,
  createDefaultPerformanceState,
  generatePerformanceFindings,
  performanceCommandsByVendor,
  performanceExpectedEvidenceTypes,
  performanceFindingsToGenericFindings,
  performanceIncludedMetrics,
  processPerformanceEvidence,
  type PerformanceAnalysisMode,
  type PerformanceChartData,
  type PerformanceEvidenceFile,
  type PerformanceFinding,
  type PerformanceMetric,
  type PerformanceScope,
  type PerformanceState
} from "@/lib/performance-analysis";
import {
  buildExecutivePerformanceViewData,
  buildPerformanceDashboardData,
  buildTechnicalPerformanceViewData,
  type PerformanceDistributionDatum,
  type PerformanceExecutiveHeatmapData,
  type PerformanceExecutiveViewData,
  type PerformanceChartPoint,
  type PerformanceDashboardFilters,
  type PerformanceHealthCategory,
  type PerformanceInsight,
  type PerformanceKpiRingData,
  type PerformanceProcessingFunnelStage,
  type PerformanceSeverity,
  type PerformanceStackedPoint,
  type PerformanceTechnicalViewData,
  type PerformanceTopPriority
} from "@/lib/performance-visualization-service";
import { mapLegacyRemediation, remediationCategoryLabels } from "@/lib/types";
import type { Assessment, Client, Domain, EvidenceFile, Finding, NeighborRelation, ParsedAssessment, RemediationCategory, RiskLevel } from "@/lib/types";
import { assessmentTabLabel, assessmentTabs as tabs, type AssessmentTab as Tab } from "@/lib/assessment-navigation";
import type { AIAnalysisJobSnapshot, AIAnalysisScopeId } from "@/lib/ai-analysis-jobs";
import { cn, formatDate, uid } from "@/lib/utils";

const domains: Array<{ id: Domain; label: string }> = [
  { id: "enterprise-networking", label: "Enterprise Networking" },
  { id: "datacenter-networking", label: "Datacenter Networking" }
];

type TabDefinition = {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  eyebrow: string;
};
type WorkspaceView = "dashboard" | "detail" | "settings";
type TopologyView = "relations" | "graph";

type EvaluationArea = "topology" | "configuration" | "security" | "lifecycle" | "operations" | "logs";
type AIEvaluationSubtab = "evaluation" | "findings" | "settings";
type AISettingsSubtab = "playbook" | "guidelines" | "debug";
type PlaybookScopeId = "configuration" | "security" | "evidence" | "performance";
type PlaybookEditorSubtab = "criteria" | "expected" | "exclusions";
type ScopePlaybookOsFamily = "all" | "ios" | "ios-xe" | "nxos" | "asa" | "unknown";
type DeviceType = "switch" | "router" | "nexus-switch" | "aci" | "wireless-controller" | "firewall" | "other";
type SortDirection = "asc" | "desc";
type InventorySortKey = "included" | "hostname" | "managementIp" | "serial" | "model" | "deviceType" | "role" | "topologyLayer" | "priority";
type EvidenceRequirementId = "identity" | "configuration" | "interfaces" | "topology-l2" | "routing-overlay" | "operations-security";
type UiMode = "dark" | "light";
type UserRole = "admin" | "architect" | "viewer";
type UserStatus = "active" | "disabled";
type SharePermission = "view" | "edit";
type TopologyLayerId = "branches" | "perimeter" | "core" | "datacenter" | "campus" | "other";

type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  passwordHash: string;
  passwordSalt: string;
  mustChangePassword: boolean;
  passwordUpdatedAt: string;
  createdAt: string;
};

type AssessmentShare = {
  userId: string;
  permission: SharePermission;
  sharedBy: string;
  sharedAt: string;
};

type EvidenceSkip = {
  assetId: string;
  requirementId: EvidenceRequirementId;
  skippedAt: string;
};
type EvidenceRequirementStatus = "collected" | "missing" | "skipped";
type EvidenceCoverageCell = {
  requirementId: EvidenceRequirementId;
  status: EvidenceRequirementStatus;
  fileNames: string[];
};
type EvidenceCoverageRow = {
  assetId: string;
  hostname: string;
  managementIp: string;
  serial: string;
  model: string;
  role: string;
  cells: EvidenceCoverageCell[];
  collectedCount: number;
  skippedCount: number;
  missingCount: number;
};
type TopologyNode = {
  id: string;
  hostname: string;
  model: string;
  managementIp: string;
  serial: string;
  role: string;
  site: string;
  deviceType: string;
  softwareVersion: string;
  sourceFiles: string[];
  layerId: TopologyLayerId;
  layerLabel: string;
  layerReason: string;
  layerEvidence: string[];
  layerOverride: boolean;
  x: number;
  y: number;
};
type TopologyLayoutNode = Omit<TopologyNode, "x" | "y">;
type TopologyEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  localInterface: string;
  remoteInterface: string;
  protocol: "cdp" | "lldp";
  confidence: number;
};
type TopologyGraph = {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  layers: TopologyLayerBand[];
  layerNodeCounts: Record<TopologyLayerId, number>;
  width: number;
  height: number;
};
type TopologyLayerBand = {
  id: TopologyLayerId;
  label: string;
  description: string;
  color: string;
  bg: string;
  lightBg: string;
  border: string;
  lightBorder: string;
  y: number;
  height: number;
  nodeCount: number;
  collapsed: boolean;
};

type ScopeDefinition = {
  businessContext: string;
  objectives: string[];
  sites: string;
  environments: string[];
  constraints: string;
  deliverables: string[];
  performanceAnalysis: PerformanceScope;
};

type InventoryAsset = {
  id: string;
  hostname: string;
  managementIp: string;
  serial: string;
  model: string;
  deviceType: DeviceType;
  platform: string;
  role: string;
  site: string;
  topologyLayer?: TopologyLayerId;
  priority: "critical" | "high" | "medium" | "low";
  included: boolean;
};

type LifecycleEoxRecord = SharedLifecycleEoxRecord & {
  inputValue?: string;
};

type LifecycleEoxLookupResult = {
  productId: string;
  normalizedProductId: string;
  source: "support-api" | "public-cisco";
  status: "matched" | "not-found";
  matchedProductId: string;
  bulletinNumber: string;
  bulletinUrl: string;
  datesFound: boolean;
  attempts: string[];
};

type LifecycleHardwareRow = {
  id: string;
  hostname: string;
  component: string;
  itemType: string;
  productId: string;
  serial: string;
  source: string;
  eox?: LifecycleEoxRecord;
  lookup?: LifecycleEoxLookupResult;
  consulted: boolean;
};

type LifecycleSoftwareRow = {
  id: string;
  hostname: string;
  model: string;
  productId: string;
  softwareVersion: string;
  source: string;
  eox?: LifecycleEoxRecord;
  lookup?: LifecycleEoxLookupResult;
  consulted: boolean;
};

type SupportCoverageRecord = {
  serial: string;
  isCovered: "YES" | "NO" | "UNKNOWN";
  coverageEndDate: string;
  warrantyEndDate: string;
  warrantyType: string;
  serviceContractNumber: string;
  serviceLineDescription: string;
  orderablePid: string;
  itemDescription: string;
  contractSiteCustomerName: string;
  source?: "sn2info-summary" | "sn2info-status";
};

type SupportCoverageRow = LifecycleHardwareRow & {
  coverage?: SupportCoverageRecord;
};

type AIAssessmentAnalysisStatus = {
  assessmentId: string;
  jobs: AIAnalysisJobSnapshot[];
  scopes: Array<{
    id: AIAnalysisScopeId;
    label: string;
    description: string;
    status: string;
    inputHash: string | null;
    updatedAt: string | null;
    stale: boolean;
  }>;
};

type AIAssessmentAnalysisResults = {
  assessmentId: string;
  results: Array<{
    id: string;
    scopeId: string;
    status: string;
    inputHash: string;
    executiveSummary?: string | null;
    findings: unknown;
    recommendations: unknown;
    updatedAt: string;
  }>;
};

type AIDebugSetting = {
  assessmentId: string;
  captureEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
};

type AIDebugInteraction = {
  id: string;
  jobId: string;
  assessmentId: string;
  scopeId: string;
  phaseName: string;
  model: string;
  promptVersion: string;
  engineVersion: string;
  httpStatus: number | null;
  status: "ok" | "error" | "timeout";
  latencyMs: number | null;
  inputTokensEst: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  budgetTrimmed: boolean;
  excludedEvidenceRefs: number;
  requestJson: unknown;
  responseJson: unknown | null;
  rejectedFindings: unknown | null;
  createdAt: string;
};

type DesignGuidelineSource = "assessment" | "global" | "default";

type TopologyDesignGuidelineSnapshot = {
  scopeKey: string;
  content: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

type ResolvedTopologyDesignGuideline = {
  assessmentId: string;
  content: string;
  source: DesignGuidelineSource;
  sourceScopeKey: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

type TopologyDesignGuidelineResponse = {
  scopeKey: string;
  guideline: ResolvedTopologyDesignGuideline;
  record: TopologyDesignGuidelineSnapshot | null;
  ok?: boolean;
  deleted?: number;
};

type ScopePlaybookCriterion = {
  id: string;
  aspect: string;
  guidance: string;
  appliesTo: ScopePlaybookOsFamily[];
};

type ScopePlaybookExpectedFinding = {
  id: string;
  title: string;
  description: string;
  severityHint: RiskLevel;
  exampleRationale: string;
  appliesTo: ScopePlaybookOsFamily[];
};

type ScopePlaybookExclusion = {
  id: string;
  keywords: string[];
  severityBelow?: RiskLevel;
  findingTypeIn?: string[];
  reason: string;
  source: "manual" | "review_feedback";
  appliesTo: ScopePlaybookOsFamily[];
};

type ScopePlaybookResponse = {
  playbook: {
    scopeId: string;
    criteria: ScopePlaybookCriterion[];
    expected: ScopePlaybookExpectedFinding[];
    exclusions: ScopePlaybookExclusion[];
    updatedBy: string | null;
    updatedAt: string | null;
    hash: string;
  };
  rule?: ScopePlaybookExclusion;
};

type RunEvaluationOptions = {
  forceReevaluate?: boolean;
};

type AssessmentRecord = {
  id: string;
  ownerUserId: string;
  shares: AssessmentShare[];
  client: Client;
  assessment: Assessment;
  scope: ScopeDefinition;
  targetInventory: InventoryAsset[];
  lifecycleEoxRecords: Record<string, LifecycleEoxRecord>;
  lifecycleEoxLookupResults: Record<string, LifecycleEoxLookupResult>;
  lifecycleConsultedProductIds: string[];
  lifecycleEoxMessage?: string;
  supportCoverageRecords: Record<string, SupportCoverageRecord>;
  supportCoverageConsultedSerials: string[];
  supportCoverageMessage?: string;
  operationalAssessment: OperationalAssessment;
  performance: PerformanceState;
  evidenceSkips: EvidenceSkip[];
  evidenceFiles: EvidenceFile[];
  parsed: ParsedAssessment;
  aiAnalysis: AIAnalysisState;
  updatedAt: string;
};

type CredentialCheckStatus = {
  state: "idle" | "checking" | "saving" | "valid" | "invalid";
  message: string;
};
type ApiCredentialMetadata = {
  provider: string;
  label: string;
  configured: boolean;
  source: "postgres" | "env" | "none";
  maskedValue: string;
  lastFour: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  encryptionVersion: string | null;
};
type PersistenceState = {
  mode: "loading" | "postgres" | "local" | "error";
  message: string;
  lastSyncedAt?: string;
};

type RiskDimensionScore = {
  id: string;
  name: string;
  description: string;
  weight: number;
  rawScore: number | null;
  normalizedScore: number;
  weightedScore: number;
  level: string;
  confidenceLevel: string;
  findingCount: number;
  evidenceSummary: string;
};

type ExecutiveRiskDashboard = {
  irir: number | null;
  irirLevel: string;
  ica: number;
  icaLevel: string;
  isSufficient: boolean;
  threshold: number;
  warnings: string[];
  dimensions: RiskDimensionScore[];
  topFindings: Finding[];
  severityCounts: Record<string, number>;
  domainCounts: Record<string, number>;
  actionCounts: Record<RemediationCategory, number>;
  recommendations: string[];
  operational?: {
    maturityScore: number;
    maturityLevel: string;
    operationalRiskScore: number;
    confidenceScore: number;
    keyStrengths: string[];
    keyGaps: string[];
    topRisks: string[];
    recommendedActions: string[];
    validationStatus: string;
    lastUpdated: string;
  };
  performance?: {
    enabled: boolean;
    status: string;
    analysisMode: PerformanceAnalysisMode;
    performanceRiskScore: number;
    confidenceScore: number;
    dataCoverageScore: number;
    summaryText: string;
    topRisks: string[];
    topMetrics: string[];
    visibilityGaps: string[];
    recommendedActions: string[];
    limitations: string[];
    lastUpdated: string;
  };
};

type AssessmentForm = {
  recordId?: string;
  clientName: string;
  industry: string;
  owner: string;
  assessmentName: string;
  status: Assessment["status"];
  domains: Domain[];
};

const tabDefinitions: Record<Tab, TabDefinition> = {
  Alcance: { icon: ClipboardList, eyebrow: "Scope" },
  Inventario: { icon: Server, eyebrow: "Equipos" },
  SOW: { icon: FileText, eyebrow: "Servicios" },
  Scripts: { icon: FileCode2, eyebrow: "Levantamiento" },
  Data: { icon: FileArchive, eyebrow: "Evidencia" },
  "Estado Actual": { icon: Network, eyebrow: "Topologia" },
  performance: { icon: LayoutDashboard, eyebrow: "Metricas" },
  "Evaluacion AI": { icon: Bot, eyebrow: "Analisis" },
  Hallazgos: { icon: AlertTriangle, eyebrow: "Riesgo" },
  Vigencia: { icon: ShieldCheck, eyebrow: "Lifecycle" },
  Operaciones: { icon: Settings2, eyebrow: "Operaciones" },
  Roadmap: { icon: GitBranch, eyebrow: "Plan" },
  Resumen: { icon: LayoutDashboard, eyebrow: "Ejecutivo" }
};

const emptyParsed: ParsedAssessment = {
  devices: [],
  interfaces: [],
  relations: [],
  findings: []
};

const riskTone: Record<RiskLevel, "neutral" | "info" | "success" | "warning" | "danger"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "info",
  info: "neutral"
};

const riskSummaryOrder: RiskLevel[] = ["critical", "high", "medium", "low", "info"];

const riskSummaryLabel: Record<RiskLevel, string> = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Info"
};

const findingTypeSummaryOrder = ["confirmed_finding", "probable_issue", "correlation_suspicion", "visibility_gap", "validation_required", "sin_tipo"];

const findingTypeSummaryLabel: Record<string, string> = {
  confirmed_finding: "Confirmados",
  probable_issue: "Probables",
  correlation_suspicion: "Correlaciones",
  visibility_gap: "Gaps",
  validation_required: "Validación",
  sin_tipo: "Sin tipo"
};

const scopeDisplayGroupOrder: AIScopeDisplayGroup[] = ["Fundamentos", "Riesgo", "Dominios", "Operación", "Síntesis"];

const statusLabel: Record<Assessment["status"], string> = {
  draft: "Draft",
  evidence: "Evidencia",
  review: "Revision",
  roadmap: "Roadmap"
};

const statusTone: Record<Assessment["status"], "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  evidence: "info",
  review: "warning",
  roadmap: "success"
};

const remediationCategoryLabel: Record<RemediationCategory, string> = remediationCategoryLabels;
const legacyRemediationField = "remediation" + "Type";

const evaluationAreas: Array<{ id: EvaluationArea; label: string; description: string }> = [
  { id: "topology", label: "Analisis topologico", description: "Vecinos, redundancia, puntos unicos de falla y consistencia fisica/logica." },
  { id: "configuration", label: "Configuraciones", description: "Running-config, estandares, desviaciones y parametros operativos." },
  { id: "security", label: "Seguridad", description: "Plano de administracion, protocolos inseguros, SNMP, AAA y hardening." },
  { id: "lifecycle", label: "Vigencia tecnologica", description: "Versiones de software, hardware, modelos y obsolescencia potencial." },
  { id: "operations", label: "Operaciones", description: "Estado de interfaces, documentacion, administracion y mantenibilidad." },
  { id: "logs", label: "Logs y eventos", description: "Eventos relevantes, errores recurrentes y senales de degradacion." }
];

const defaultObjectives = [
  "Validar inventario objetivo y alcance tecnico",
  "Identificar riesgos operativos, de seguridad y resiliencia",
  "Priorizar hallazgos con evidencia y recomendaciones accionables",
  "Preparar base tecnica para roadmap de remediacion"
];

const defaultDeliverables = [
  "Matriz de hallazgos",
  "Documento editable de hallazgos",
  "Inventario consolidado",
  "SOW preliminar",
  "Scripts de levantamiento"
];

const evidenceRequirements: Array<{ id: EvidenceRequirementId; label: string; shortLabel: string }> = [
  { id: "identity", label: "Identidad, version, inventario, modulos y licencias", shortLabel: "Identidad" },
  { id: "configuration", label: "Configuracion running-config y startup-config", shortLabel: "Config" },
  { id: "interfaces", label: "Estado, descripcion y detalle de interfaces", shortLabel: "Interfaces" },
  { id: "topology-l2", label: "Vecinos, VLAN, STP, trunks, port-channel y vPC", shortLabel: "Topologia L2" },
  { id: "routing-overlay", label: "Rutas, protocolos, OSPF, BGP, VRF, NVE y EVPN", shortLabel: "Routing" },
  { id: "operations-security", label: "Logs, NTP, reloj, redundancia, ambiente y seguridad/perimetro", shortLabel: "Operacion" }
];

const topologyLayerOrder: TopologyLayerId[] = ["branches", "perimeter", "core", "datacenter", "campus", "other"];

const topologyLayerConfig: Record<TopologyLayerId, {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bg: string;
  lightBg: string;
  border: string;
  lightBorder: string;
}> = {
  branches: {
    label: "BRANCHES",
    shortLabel: "Branches",
    description: "Sucursales, sedes remotas y equipos branch que normalmente se conectan hacia perimetro/WAN.",
    color: "#fbbf24",
    bg: "#241d0b",
    lightBg: "#fff7d6",
    border: "#9a6b12",
    lightBorder: "#eab308"
  },
  perimeter: {
    label: "PERIMETRO / WAN EDGE",
    shortLabel: "Perimetro",
    description: "Routers WAN, Internet edge, firewalls, VPN y bordes externos.",
    color: "#fb7185",
    bg: "#22161b",
    lightBg: "#fff1f2",
    border: "#7f2a35",
    lightBorder: "#fb7185"
  },
  core: {
    label: "CORE / BACKBONE",
    shortLabel: "Core",
    description: "Backbone real, core switching/routing y agregacion troncal explicita.",
    color: "#60a5fa",
    bg: "#142033",
    lightBg: "#eff6ff",
    border: "#2b5ea8",
    lightBorder: "#60a5fa"
  },
  datacenter: {
    label: "DATACENTER NETWORKING",
    shortLabel: "Datacenter",
    description: "Nexus, spine/leaf, ACI, UCS/FI y fabric de datacenter.",
    color: "#a78bfa",
    bg: "#1d1830",
    lightBg: "#f5f3ff",
    border: "#6d4bb6",
    lightBorder: "#8b5cf6"
  },
  campus: {
    label: "CAMPUS",
    shortLabel: "Campus",
    description: "Switching de distribucion/acceso, wireless y red de usuarios.",
    color: "#34d399",
    bg: "#10251f",
    lightBg: "#ecfdf5",
    border: "#21765e",
    lightBorder: "#10b981"
  },
  other: {
    label: "OTROS / NO CLASIFICADOS",
    shortLabel: "Otros",
    description: "Nodos sin rol claro o con evidencia insuficiente para ubicar capa.",
    color: "#94a3b8",
    bg: "#17202b",
    lightBg: "#f1f5f9",
    border: "#475569",
    lightBorder: "#94a3b8"
  }
};

const topologyNodeWidth = 170;
const topologyNodeHeight = 92;

export default function HomePage() {
  const postgresPersistenceEnabled = useRef(false);
  const aiPollingTimerRef = useRef<number | null>(null);
  const aiPollingInFlightRef = useRef(false);
  const importedAIJobIdsRef = useRef<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const [users, setUsers] = useState<AppUser[]>(() => createDefaultUsers());
  const [currentUserId, setCurrentUserId] = useState("");
  const [loginError, setLoginError] = useState("");
  const [records, setRecords] = useState<AssessmentRecord[]>(() => createInitialRecords());
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("dashboard");
  const [activeTab, setActiveTab] = useState<Tab>("Alcance");
  const [isParsing, setIsParsing] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<AssessmentForm | null>(null);
  const [settingsReturnView, setSettingsReturnView] = useState<Exclude<WorkspaceView, "settings">>("dashboard");
  const [uiMode, setUiMode] = useState<UiMode>("dark");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [openAiCredential, setOpenAiCredential] = useState<ApiCredentialMetadata>(() => emptyOpenAiCredentialMetadata());
  const [ciscoApiToken, setCiscoApiToken] = useState("");
  const [ciscoCredential, setCiscoCredential] = useState<ApiCredentialMetadata>(() => emptyCiscoCredentialMetadata());
  const [openAiCheck, setOpenAiCheck] = useState<CredentialCheckStatus>({ state: "idle", message: "" });
  const [ciscoTokenCheck, setCiscoTokenCheck] = useState<CredentialCheckStatus>({ state: "idle", message: "" });
  const [persistenceState, setPersistenceState] = useState<PersistenceState>({
    mode: "loading",
    message: "Cargando persistencia..."
  });
  const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplateVersion[]>([]);
  const [aiAnalysisStatusByAssessment, setAiAnalysisStatusByAssessment] = useState<Record<string, AIAssessmentAnalysisStatus>>({});

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      if (cancelled) return;
      const cachedRecords = readInitialRecords();
      const cachedUsers = readInitialUsers();
      const cachedCurrentUserId = readInitialCurrentUserId();
      setUsers(cachedUsers);
      setCurrentUserId(resolveCurrentUserId(cachedUsers, cachedCurrentUserId));
      setRecords(cachedRecords);
      setUiMode(readInitialUiMode());
      setOpenAiApiKey(readInitialOpenAiApiKey());
      setCiscoApiToken(readInitialCiscoApiToken());
      setDocumentTemplates(readInitialDocumentTemplates());

      try {
        const [persistedRecords, persistedTemplates, persistedUsers, persistedOpenAiCredential, persistedCiscoCredential] = await Promise.all([
          fetchPersistedAssessmentRecords(),
          fetchPersistedDocumentTemplates(),
          fetchPersistedUsers(),
          fetchOpenAiCredentialMetadata().catch(() => null),
          fetchCiscoCredentialMetadata().catch(() => null)
        ]);
        if (cancelled) return;
        const usersToUse = persistedUsers.length > 0 ? persistedUsers : cachedUsers;
        const recordsToUse = persistedRecords.length > 0 ? persistedRecords : cachedRecords;
        const templatesToUse = persistedTemplates.length > 0 ? persistedTemplates : readInitialDocumentTemplates();
        postgresPersistenceEnabled.current = true;
        setUsers(usersToUse);
        setCurrentUserId(resolveCurrentUserId(usersToUse, cachedCurrentUserId));
        setRecords(recordsToUse);
        setDocumentTemplates(templatesToUse);
        if (persistedOpenAiCredential) {
          setOpenAiCredential(persistedOpenAiCredential);
          if (persistedOpenAiCredential.configured) setOpenAiApiKey("");
        }
        if (persistedCiscoCredential) {
          setCiscoCredential(persistedCiscoCredential);
          if (persistedCiscoCredential.configured) setCiscoApiToken("");
        }
        setPersistenceState({
          mode: "postgres",
          message:
            persistedRecords.length > 0
              ? `PostgreSQL conectado. ${persistedRecords.length} assessments cargados. ${templatesToUse.length} plantillas disponibles. ${usersToUse.length} usuarios.`
              : cachedRecords.length > 0
                ? `PostgreSQL conectado. ${cachedRecords.length} assessments locales listos para migrar.`
                : "PostgreSQL conectado. Sin assessments persistidos aun.",
          lastSyncedAt: new Date().toISOString()
        });
      } catch (error) {
        if (cancelled) return;
        postgresPersistenceEnabled.current = false;
        setPersistenceState({
          mode: cachedRecords.length > 0 ? "local" : "error",
          message: error instanceof Error ? `${error.message} Usando cache local del navegador.` : "No se pudo conectar PostgreSQL. Usando cache local del navegador."
        });
      }

      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const hasPostgresPersistence = postgresPersistenceEnabled.current;
    const localCache = writeRecordsLocalCache(records, !hasPostgresPersistence);
    if (!hasPostgresPersistence) {
      if (localCache.stored === "metadata") {
        setPersistenceState({
          mode: "local",
          message: "Cache local limitado: se guardaron datos livianos sin contenido bruto de evidencia. Conecta PostgreSQL para conservar evidencias grandes.",
          lastSyncedAt: new Date().toISOString()
        });
      } else if (localCache.stored === "none") {
        setPersistenceState({
          mode: "error",
          message: "El navegador no tiene espacio para guardar este assessment localmente. Conecta PostgreSQL o reduce evidencia cargada.",
          lastSyncedAt: new Date().toISOString()
        });
      }
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        await syncPersistedAssessmentRecords(records);
        setPersistenceState({
          mode: "postgres",
          message: `PostgreSQL sincronizado. ${records.length} assessments persistidos.`,
          lastSyncedAt: new Date().toISOString()
        });
      } catch (error) {
        postgresPersistenceEnabled.current = false;
        setPersistenceState({
          mode: "error",
          message: error instanceof Error ? `${error.message} Cambios retenidos en cache local.` : "No se pudo sincronizar PostgreSQL. Cambios retenidos en cache local."
        });
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [isHydrated, records]);

  useEffect(() => {
    if (!isHydrated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Migrates persisted finding IDs once after hydration.
    setRecords((current) => {
      let changed = false;
      const nextRecords = current.map((record) => {
        const findings = record.parsed?.findings ?? [];
        const uniqueFindings = ensureUniqueFindingIds(findings);
        const hasChangedFindingId = uniqueFindings.some((finding, index) => finding.id !== findings[index]?.id);
        if (!hasChangedFindingId) return record;
        changed = true;
        return {
          ...record,
          parsed: {
            ...record.parsed,
            findings: uniqueFindings
          },
          updatedAt: new Date().toISOString()
        };
      });
      return changed ? nextRecords : current;
    });
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem("assessment-tool.users.v1", JSON.stringify(users));
    window.localStorage.setItem("assessment-tool.current-user-id.v1", currentUserId);
    if (!postgresPersistenceEnabled.current) return;

    const timeout = window.setTimeout(async () => {
      try {
        await syncPersistedUsers(users);
      } catch (error) {
        postgresPersistenceEnabled.current = false;
        setPersistenceState({
          mode: "error",
          message: error instanceof Error ? `${error.message} Usuarios retenidos en cache local.` : "No se pudieron sincronizar usuarios. Cambios retenidos en cache local."
        });
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [isHydrated, users, currentUserId]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", uiMode === "dark");
    document.documentElement.classList.toggle("light", uiMode === "light");
    document.documentElement.style.colorScheme = uiMode;
    if (!isHydrated) return;
    window.localStorage.setItem("assessment-tool.ui-mode.v1", uiMode);
  }, [isHydrated, uiMode]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.removeItem("assessment-tool.openai-api-key.v1");
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.removeItem("assessment-tool.cisco-api-token.v1");
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    window.localStorage.setItem("assessment-tool.document-templates.v1", JSON.stringify(documentTemplates));
    if (!postgresPersistenceEnabled.current) return;

    const timeout = window.setTimeout(async () => {
      try {
        await syncPersistedDocumentTemplates(documentTemplates);
      } catch (error) {
        postgresPersistenceEnabled.current = false;
        setPersistenceState({
          mode: "error",
          message: error instanceof Error ? `${error.message} Plantillas retenidas en cache local.` : "No se pudieron sincronizar plantillas. Cambios retenidos en cache local."
        });
      }
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [isHydrated, documentTemplates]);

  const currentUser = users.find((user) => user.id === currentUserId && user.status === "active") ?? null;
  const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? records[0];
  const selectedAIAnalysisStatus = selectedRecord ? aiAnalysisStatusByAssessment[selectedRecord.id] : undefined;
  const aiPollingEnabled = activeTab === "Evaluacion AI";
  const selectedHasRunningAIJob = hasRunningAIJob(selectedAIAnalysisStatus);

  useEffect(() => {
    if (aiPollingTimerRef.current) {
      window.clearTimeout(aiPollingTimerRef.current);
      aiPollingTimerRef.current = null;
    }
    if (!isHydrated || !selectedRecord?.id || !aiPollingEnabled) return;
    let cancelled = false;
    const assessmentId = selectedRecord.id;

    async function refresh() {
      if (cancelled || aiPollingInFlightRef.current) return;
      aiPollingInFlightRef.current = true;
      let shouldContinuePolling = false;
      try {
        const status = await fetchAIAnalysisStatus(assessmentId).catch(() => null);
        if (!status || cancelled) return;
        shouldContinuePolling = hasRunningAIJob(status);
        setAiAnalysisStatusByAssessment((current) => {
          const previous = current[assessmentId];
          if (previous && JSON.stringify(previous) === JSON.stringify(status)) return current;
          return { ...current, [assessmentId]: status };
        });
      } finally {
        aiPollingInFlightRef.current = false;
        if (!cancelled && shouldContinuePolling) aiPollingTimerRef.current = window.setTimeout(refresh, 1800);
      }
    }

    aiPollingTimerRef.current = window.setTimeout(refresh, selectedHasRunningAIJob ? 1000 : 250);
    return () => {
      cancelled = true;
      if (aiPollingTimerRef.current) {
        window.clearTimeout(aiPollingTimerRef.current);
        aiPollingTimerRef.current = null;
      }
    };
  }, [activeTab, isHydrated, aiPollingEnabled, selectedHasRunningAIJob, selectedRecord?.id]);

  useEffect(() => {
    if (!currentUser || !selectedRecord?.id || !selectedAIAnalysisStatus) return;
    const latestJob = selectedAIAnalysisStatus.jobs[0];
    if (!latestJob || latestJob.status === "queued" || latestJob.status === "running") return;
    if (importedAIJobIdsRef.current.has(latestJob.id)) return;
    importedAIJobIdsRef.current.add(latestJob.id);
    const recordId = selectedRecord.id;
    queueMicrotask(async () => {
      const response = await fetch(`/api/ai-analysis/assessments/${recordId}/results`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as AIAssessmentAnalysisResults | null;
      if (!response.ok || !payload) return;
      const jobScopeIds = new Set<string>(latestJob.steps.map((step) => step.scopeId));
      const importedResults = payload.results.filter((result) => latestJob.mode === "full" || jobScopeIds.has(result.scopeId));
      const findings = persistentAIResultsToFindings(importedResults, recordId);

      setRecords((current) =>
        current.map((record) => {
          if (record.id !== recordId || !canEditAssessment(currentUser, record)) return record;
          const existingKeys = new Set(record.parsed.findings.map((finding) => `${finding.category}:${finding.title}:${finding.affectedAssets.join(",")}`));
          const nextFindings = findings.filter((finding) => !existingKeys.has(`${finding.category}:${finding.title}:${finding.affectedAssets.join(",")}`));
          return {
            ...record,
            parsed: {
              ...record.parsed,
              findings: ensureUniqueFindingIds([...record.parsed.findings, ...nextFindings])
            },
            assessment: { ...record.assessment, status: nextFindings.length > 0 ? "review" : record.assessment.status },
            updatedAt: new Date().toISOString()
          };
        })
      );
    });
  }, [currentUser, selectedAIAnalysisStatus, selectedRecord?.id]);

  const activeFindings = useMemo(
    () => selectedRecord?.parsed.findings.filter((finding) => finding.status !== "discarded") ?? [],
    [selectedRecord]
  );
  const validatedFindings = useMemo(
    () => selectedRecord?.parsed.findings.filter((finding) => finding.status === "validated") ?? [],
    [selectedRecord]
  );
  const roadmap = useMemo(() => buildRoadmap(selectedRecord ? acceptedOrValidatedFindings(selectedRecord.parsed.findings) : []), [selectedRecord]);
  const selectedExecutiveSummary = useMemo(
    () => (selectedRecord ? getExecutiveRiskDashboard(selectedRecord) : null),
    [selectedRecord]
  );
  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return records.filter((record) => {
      const value = `${record.client.name} ${record.assessment.name} ${record.client.owner} ${record.client.industry}`.toLowerCase();
      return value.includes(normalizedQuery);
    });
  }, [query, records]);
  const dashboardExecutiveSummaries = useMemo(
    () => new Map(filteredRecords.map((record) => [record.id, getExecutiveRiskDashboard(record)])),
    [filteredRecords]
  );
  const portfolio = useMemo(() => summarizePortfolio(records), [records]);

  function updateRecord(recordId: string, updater: (record: AssessmentRecord) => AssessmentRecord) {
    if (!currentUser) return;
    setRecords((current) =>
      current.map((record) => (record.id === recordId && canEditAssessment(currentUser, record) ? updater(record) : record))
    );
  }

  function updateSelectedRecord(updater: (record: AssessmentRecord) => AssessmentRecord) {
    if (!selectedRecord) return;
    updateRecord(selectedRecord.id, updater);
  }

  async function testOpenAiCredential() {
    if (!openAiApiKey.trim() && !openAiCredential.configured) {
      setOpenAiCheck({ state: "invalid", message: "Agrega una API key o guarda una credencial persistente antes de probar." });
      return;
    }

    setOpenAiCheck({ state: "checking", message: "Validando con OpenAI..." });
    try {
      const headers = openAiApiKey.trim() ? { "x-openai-api-key": openAiApiKey.trim() } : undefined;
      const response = await fetch("/api/ai/test-key", {
        method: "POST",
        headers
      });
      const payload = await response.json().catch(() => null);
      setOpenAiCheck({
        state: response.ok && payload?.ok ? "valid" : "invalid",
        message: payload?.message || (response.ok ? "API key valida." : "No se pudo validar la API key.")
      });
    } catch {
      setOpenAiCheck({ state: "invalid", message: "No se pudo contactar el endpoint local de validacion." });
    }
  }

  async function saveOpenAiCredential() {
    if (!openAiApiKey.trim()) {
      setOpenAiCheck({ state: "invalid", message: "Pega una API key nueva antes de guardar." });
      return;
    }

    setOpenAiCheck({ state: "saving", message: "Guardando API key cifrada en PostgreSQL..." });
    try {
      const response = await fetch("/api/credentials/openai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: openAiApiKey.trim(),
          updatedBy: currentUser?.email ?? currentUser?.name ?? "local-user"
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.credential) throw new Error(payload?.error || "No se pudo guardar la API key.");
      setOpenAiCredential(payload.credential as ApiCredentialMetadata);
      setOpenAiApiKey("");
      window.localStorage.removeItem("assessment-tool.openai-api-key.v1");
      setOpenAiCheck({ state: "valid", message: "API key guardada cifrada en almacenamiento persistente." });
    } catch (error) {
      setOpenAiCheck({ state: "invalid", message: error instanceof Error ? error.message : "No se pudo guardar la API key." });
    }
  }

  async function deleteOpenAiCredential() {
    if (!confirmAction("Esto eliminara la API key OpenAI persistida. Deseas continuar?")) return;
    setOpenAiCheck({ state: "saving", message: "Eliminando credencial persistida..." });
    try {
      const response = await fetch("/api/credentials/openai", { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.credential) throw new Error(payload?.error || "No se pudo eliminar la credencial.");
      setOpenAiCredential(payload.credential as ApiCredentialMetadata);
      setOpenAiApiKey("");
      window.localStorage.removeItem("assessment-tool.openai-api-key.v1");
      setOpenAiCheck({ state: "valid", message: payload.credential.configured ? "Credencial persistida eliminada. Se usara OPENAI_API_KEY de entorno." : "Credencial OpenAI eliminada." });
    } catch (error) {
      setOpenAiCheck({ state: "invalid", message: error instanceof Error ? error.message : "No se pudo eliminar la credencial." });
    }
  }

  async function testCiscoCredential() {
    if (!ciscoApiToken.trim() && !ciscoCredential.configured) {
      setCiscoTokenCheck({ state: "invalid", message: "Agrega un access token o guarda una credencial persistente antes de probar." });
      return;
    }

    setCiscoTokenCheck({ state: "checking", message: "Validando token Cisco EoX..." });
    try {
      const headers = ciscoApiToken.trim() ? { "x-cisco-api-token": ciscoApiToken.trim() } : undefined;
      const response = await fetch("/api/cisco/eox/test-token", {
        method: "POST",
        headers
      });
      const payload = await response.json().catch(() => null);
      setCiscoTokenCheck({
        state: response.ok && payload?.ok ? "valid" : "invalid",
        message: payload?.message || (response.ok ? "Token valido." : "No se pudo validar el token.")
      });
    } catch {
      setCiscoTokenCheck({ state: "invalid", message: "No se pudo contactar el endpoint local de validacion." });
    }
  }

  async function saveCiscoCredential() {
    if (!ciscoApiToken.trim()) {
      setCiscoTokenCheck({ state: "invalid", message: "Pega un access token Cisco antes de guardar." });
      return;
    }

    setCiscoTokenCheck({ state: "saving", message: "Guardando token Cisco cifrado en PostgreSQL..." });
    try {
      const response = await fetch("/api/credentials/cisco", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiToken: ciscoApiToken.trim(),
          updatedBy: currentUser?.email ?? currentUser?.name ?? "local-user"
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.credential) throw new Error(payload?.error || "No se pudo guardar el token Cisco.");
      setCiscoCredential(payload.credential as ApiCredentialMetadata);
      setCiscoApiToken("");
      window.localStorage.removeItem("assessment-tool.cisco-api-token.v1");
      setCiscoTokenCheck({ state: "valid", message: "Token Cisco guardado cifrado en almacenamiento persistente." });
    } catch (error) {
      setCiscoTokenCheck({ state: "invalid", message: error instanceof Error ? error.message : "No se pudo guardar el token Cisco." });
    }
  }

  async function deleteCiscoCredential() {
    if (!confirmAction("Esto eliminara el token Cisco persistido. Deseas continuar?")) return;
    setCiscoTokenCheck({ state: "saving", message: "Eliminando credencial Cisco persistida..." });
    try {
      const response = await fetch("/api/credentials/cisco", { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.credential) throw new Error(payload?.error || "No se pudo eliminar la credencial Cisco.");
      setCiscoCredential(payload.credential as ApiCredentialMetadata);
      setCiscoApiToken("");
      window.localStorage.removeItem("assessment-tool.cisco-api-token.v1");
      setCiscoTokenCheck({ state: "valid", message: payload.credential.configured ? "Credencial persistida eliminada. Se usara CISCO_API_TOKEN de entorno." : "Credencial Cisco eliminada." });
    } catch (error) {
      setCiscoTokenCheck({ state: "invalid", message: error instanceof Error ? error.message : "No se pudo eliminar la credencial Cisco." });
    }
  }

  function updateAssessmentDomains(domain: Domain) {
    updateSelectedRecord((record) => {
      const exists = record.assessment.domains.includes(domain);
      return {
        ...record,
        updatedAt: new Date().toISOString(),
        assessment: {
          ...record.assessment,
          domains: exists ? record.assessment.domains.filter((item) => item !== domain) : [...record.assessment.domains, domain]
        }
      };
    });
  }

  function updateScope(patch: Partial<ScopeDefinition>) {
    updateSelectedRecord((record) => {
      const nextPerformanceScope = patch.performanceAnalysis
        ? {
            ...record.scope.performanceAnalysis,
            ...patch.performanceAnalysis
          }
        : record.scope.performanceAnalysis;
      const disablingPerformance = patch.performanceAnalysis?.enabled === false && record.scope.performanceAnalysis.enabled;

      return {
        ...record,
        scope: {
          ...record.scope,
          ...patch,
          performanceAnalysis: nextPerformanceScope
        },
        parsed: disablingPerformance
          ? {
              ...record.parsed,
              findings: record.parsed.findings.filter((finding) => !isPerformanceFindingId(finding.id))
            }
          : record.parsed,
        performance: disablingPerformance
          ? createDefaultPerformanceState(record.id, nextPerformanceScope.mode)
          : patch.performanceAnalysis?.mode
            ? {
                ...record.performance,
                assessment: {
                  ...record.performance.assessment,
                  analysisMode: patch.performanceAnalysis.mode
                }
              }
            : record.performance,
        updatedAt: new Date().toISOString()
      };
    });
  }

  function addInventoryAsset(asset: Omit<InventoryAsset, "id">) {
    updateSelectedRecord((record) => ({
      ...record,
      targetInventory: [{ id: uid("asset"), ...asset, included: asset.included ?? true }, ...record.targetInventory],
      updatedAt: new Date().toISOString()
    }));
  }

  function importInventoryAssets(assets: Array<Omit<InventoryAsset, "id">>) {
    if (assets.length === 0) return;
    updateSelectedRecord((record) => {
      const imported = assets.map((asset) => ({ id: uid("asset"), ...asset, included: asset.included ?? true }));
      const importedHostnames = new Set(imported.map((asset) => asset.hostname.toLowerCase()));
      return {
        ...record,
        targetInventory: [...imported, ...record.targetInventory.filter((asset) => !importedHostnames.has(asset.hostname.toLowerCase()))],
        updatedAt: new Date().toISOString()
      };
    });
  }

  function removeInventoryAsset(assetId: string) {
    updateSelectedRecord((record) => ({
      ...record,
      targetInventory: record.targetInventory.filter((asset) => asset.id !== assetId),
      updatedAt: new Date().toISOString()
    }));
  }

  function clearInventoryAssets() {
    if (!confirmAction("Esto borrara todos los equipos del inventario objetivo para cargar una nueva version. Deseas continuar?")) return;
    updateSelectedRecord((record) => ({
      ...record,
      targetInventory: [],
      updatedAt: new Date().toISOString()
    }));
  }

  function toggleInventoryAssetIncluded(assetId: string) {
    updateSelectedRecord((record) => ({
      ...record,
      targetInventory: record.targetInventory.map((asset) => (asset.id === assetId ? { ...asset, included: !asset.included } : asset)),
      updatedAt: new Date().toISOString()
    }));
  }

  function updateInventoryAssetTopologyLayer(assetId: string, topologyLayer: TopologyLayerId | null) {
    updateSelectedRecord((record) => ({
      ...record,
      targetInventory: record.targetInventory.map((asset) => (
        asset.id === assetId
          ? { ...asset, topologyLayer: topologyLayer ?? undefined }
          : asset
      )),
      updatedAt: new Date().toISOString()
    }));
  }

  function removeDuplicateInventoryAssets() {
    updateSelectedRecord((record) => {
      const seenSerials = new Set<string>();
      return {
        ...record,
        targetInventory: record.targetInventory.filter((asset) => {
          const serial = normalizedSerial(asset.serial);
          if (!serial) return true;
          if (seenSerials.has(serial)) return false;
          seenSerials.add(serial);
          return true;
        }),
        updatedAt: new Date().toISOString()
      };
    });
  }

  async function handleEvidenceUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedRecord) return;
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setIsParsing(true);
    const loaded = await loadEvidenceFiles(files);
    const nextEvidence = [...selectedRecord.evidenceFiles, ...loaded];
    const nextParsed = parseCiscoEvidence(nextEvidence);

    updateSelectedRecord((record) => ({
      ...record,
      evidenceFiles: nextEvidence,
      parsed: nextParsed,
      lifecycleEoxRecords: {},
      lifecycleEoxLookupResults: {},
      lifecycleConsultedProductIds: [],
      lifecycleEoxMessage: "",
      supportCoverageRecords: {},
      supportCoverageConsultedSerials: [],
      supportCoverageMessage: "",
      updatedAt: new Date().toISOString(),
      assessment: {
        ...record.assessment,
        status: nextParsed.findings.length > 0 ? "review" : "evidence"
      }
    }));
    setActiveTab("Data");
    setIsParsing(false);
    event.target.value = "";
  }

  async function handlePerformanceEvidenceUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedRecord) return;
    if (!selectedRecord.scope.performanceAnalysis.enabled) {
      event.target.value = "";
      return;
    }
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const loaded = await loadPerformanceEvidenceFiles(files, selectedRecord.id, currentUser?.name ?? "Local user");
    updateSelectedRecord((record) => {
      const mode = record.scope.performanceAnalysis.mode;
      const evidenceFiles = [...record.performance.evidenceFiles, ...loaded];
      const processed = processPerformanceEvidence(record.id, evidenceFiles, mode);
      const assessment = buildPerformanceAssessment(record.id, mode, processed.files, processed.metrics);
      const findings = generatePerformanceFindings(record.id, processed.metrics, processed.summary, mode);
      const charts = buildPerformanceCharts(record.id, processed.metrics);
      const genericFindings = performanceFindingsToGenericFindings(findings);
      return {
        ...record,
        parsed: {
          ...record.parsed,
          findings: [...record.parsed.findings.filter((finding) => !isPerformanceFindingId(finding.id)), ...genericFindings]
        },
        performance: {
          evidenceFiles: processed.files,
          metrics: processed.metrics,
          findings,
          assessment,
          charts
        },
        updatedAt: new Date().toISOString()
      };
    });
    event.target.value = "";
  }

  function processPerformanceForSelectedRecord() {
    updateSelectedRecord((record) => {
      const mode = record.scope.performanceAnalysis.mode;
      const processed = processPerformanceEvidence(record.id, record.performance.evidenceFiles, mode);
      const assessment = buildPerformanceAssessment(record.id, mode, processed.files, processed.metrics);
      const findings = generatePerformanceFindings(record.id, processed.metrics, processed.summary, mode);
      const charts = buildPerformanceCharts(record.id, processed.metrics);
      const genericFindings = performanceFindingsToGenericFindings(findings);
      return {
        ...record,
        parsed: {
          ...record.parsed,
          findings: [...record.parsed.findings.filter((finding) => !isPerformanceFindingId(finding.id)), ...genericFindings]
        },
        performance: {
          evidenceFiles: processed.files,
          metrics: processed.metrics,
          findings,
          assessment,
          charts
        },
        updatedAt: new Date().toISOString()
      };
    });
  }

  function markPerformanceAiReviewed() {
    updateSelectedRecord((record) => {
      const aiContext = buildPerformanceAIContext({
        assessmentId: record.id,
        scope: record.scope.performanceAnalysis,
        evidenceFiles: record.performance.evidenceFiles,
        metrics: record.performance.metrics,
        assessment: record.performance.assessment,
        findings: record.performance.findings,
        charts: record.performance.charts
      });
      const reviewedFindings = record.performance.findings.map((finding) => ({ ...finding, aiGenerated: true, status: "ai_suggested" as const }));
      const genericFindings = performanceFindingsToGenericFindings(reviewedFindings);
      return {
        ...record,
        parsed: {
          ...record.parsed,
          findings: [...record.parsed.findings.filter((finding) => !isPerformanceFindingId(finding.id)), ...genericFindings]
        },
        performance: {
          ...record.performance,
          findings: reviewedFindings,
          assessment: {
            ...record.performance.assessment,
            status: "ai_reviewed",
            limitations: Array.from(new Set([...record.performance.assessment.limitations, `Contexto AI preparado con ${aiContext.criticalMetrics.length} metricas criticas; validar manualmente antes de entregar.`])),
            updatedAt: new Date().toISOString()
          }
        },
        updatedAt: new Date().toISOString()
      };
    });
  }

  function resetPerformanceForSelectedRecord() {
    if (!confirmAction("Esto limpiara la evidencia, metricas y hallazgos de Performance Analysis. Deseas continuar?")) return;
    updateSelectedRecord((record) => ({
      ...record,
      parsed: {
        ...record.parsed,
        findings: record.parsed.findings.filter((finding) => !isPerformanceFindingId(finding.id))
      },
      performance: createDefaultPerformanceState(record.id, record.scope.performanceAnalysis.mode),
      updatedAt: new Date().toISOString()
    }));
  }

  function removeEvidenceFile(fileId: string) {
    if (!confirmAction("Esto borrara este archivo de evidencia STATUS/CONFIG y recalculara la informacion derivada. Deseas continuar?")) return;
    updateSelectedRecord((record) => {
      const nextEvidence = record.evidenceFiles.filter((file) => file.id !== fileId);
      const nextParsed = parseCiscoEvidence(nextEvidence);

      return {
        ...record,
        evidenceFiles: nextEvidence,
        parsed: nextParsed,
        lifecycleEoxRecords: {},
        lifecycleEoxLookupResults: {},
        lifecycleConsultedProductIds: [],
        lifecycleEoxMessage: "",
        supportCoverageRecords: {},
        supportCoverageConsultedSerials: [],
        supportCoverageMessage: "",
        updatedAt: new Date().toISOString(),
        assessment: {
          ...record.assessment,
          status: nextEvidence.length === 0 ? "draft" : nextParsed.findings.length > 0 ? "review" : "evidence"
        }
      };
    });
  }

  function clearEvidenceFiles() {
    if (!confirmAction("Esto borrara todos los archivos de evidencia STATUS/CONFIG y limpiara la informacion derivada. Deseas continuar?")) return;
    updateSelectedRecord((record) => ({
      ...record,
      evidenceFiles: [],
      parsed: parseCiscoEvidence([]),
      lifecycleEoxRecords: {},
      lifecycleEoxLookupResults: {},
      lifecycleConsultedProductIds: [],
      lifecycleEoxMessage: "",
      supportCoverageRecords: {},
      supportCoverageConsultedSerials: [],
      supportCoverageMessage: "",
      updatedAt: new Date().toISOString(),
      assessment: {
        ...record.assessment,
        status: "draft"
      }
    }));
  }

  function removePerformanceEvidenceFile(fileId: string) {
    if (!confirmAction("Esto borrara este archivo de evidencia PERFORMANCE y recalculara las metricas derivadas. Deseas continuar?")) return;
    updateSelectedRecord((record) => rebuildPerformanceState(record, record.performance.evidenceFiles.filter((file) => file.id !== fileId)));
  }

  function clearPerformanceEvidenceFiles() {
    if (!confirmAction("Esto borrara todos los archivos de evidencia PERFORMANCE, metricas y hallazgos derivados. Deseas continuar?")) return;
    updateSelectedRecord((record) => rebuildPerformanceState(record, []));
  }

  function toggleEvidenceRowSkip(assetId: string) {
    updateSelectedRecord((record) => {
      const row = buildEvidenceCoverageRows(record).find((item) => item.assetId === assetId);
      const hasSkipped = row?.skippedCount ? row.skippedCount > 0 : false;
      const missingRequirementIds = row?.cells.filter((cell) => cell.status === "missing").map((cell) => cell.requirementId) ?? [];
      const existingKeys = new Set(record.evidenceSkips.map((skip) => `${skip.assetId}:${skip.requirementId}`));

      return {
        ...record,
        evidenceSkips: hasSkipped
          ? record.evidenceSkips.filter((skip) => skip.assetId !== assetId)
          : [
              ...record.evidenceSkips,
              ...missingRequirementIds
                .filter((requirementId) => !existingKeys.has(`${assetId}:${requirementId}`))
                .map((requirementId) => ({ assetId, requirementId, skippedAt: new Date().toISOString() }))
            ],
        updatedAt: new Date().toISOString()
      };
    });
  }

  async function runEvaluation(area: EvaluationArea | "complete", options?: RunEvaluationOptions) {
    if (!selectedRecord) return;
    const mode = area === "complete" ? "full" : "scope";
    const scopeId = area === "complete" ? null : evaluationAreaToAIScope(area);
    const response = await fetch("/api/ai-analysis/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(openAiApiKey.trim() ? { "x-openai-api-key": openAiApiKey.trim() } : {})
      },
      body: JSON.stringify({
        assessmentId: selectedRecord.id,
        mode,
        scopeId,
        forceReevaluate: Boolean(options?.forceReevaluate),
        requestedBy: currentUser?.email ?? currentUser?.name ?? "local-user"
      })
    });
    if (!response.ok) {
      return;
    }

    const status = await fetchAIAnalysisStatus(selectedRecord.id).catch(() => null);
    if (status) setAiAnalysisStatusByAssessment((current) => ({ ...current, [selectedRecord.id]: status }));
  }

  async function cancelAnalysisJob(jobId: string) {
    if (!selectedRecord) return;
    const response = await fetch(`/api/ai-analysis/jobs/${jobId}/cancel`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (payload?.job) {
      const status = await fetchAIAnalysisStatus(selectedRecord.id).catch(() => null);
      if (status) setAiAnalysisStatusByAssessment((current) => ({ ...current, [selectedRecord.id]: status }));
    }
  }

  async function retryAnalysisJob(jobId: string) {
    if (!selectedRecord) return;
    const response = await fetch(`/api/ai-analysis/jobs/${jobId}/retry`, {
      method: "POST",
      headers: openAiApiKey.trim() ? { "x-openai-api-key": openAiApiKey.trim() } : {}
    });
    const payload = await response.json().catch(() => null);
    if (payload?.job) {
      const status = await fetchAIAnalysisStatus(selectedRecord.id).catch(() => null);
      if (status) setAiAnalysisStatusByAssessment((current) => ({ ...current, [selectedRecord.id]: status }));
    }
  }

  async function consultLifecycleEox(recordId: string, options?: { silent?: boolean; failOnError?: boolean }) {
    const record = records.find((item) => item.id === recordId);
    if (!record) return selectedRecord!;
    const productIds = lifecycleProductIds(record);
    if (productIds.length === 0) {
      const message = "No hay PIDs disponibles. Carga show inventory o inventario con modelo/PID.";
      updateRecord(recordId, (current) => ({ ...current, lifecycleEoxMessage: message, updatedAt: new Date().toISOString() }));
      return { ...record, lifecycleEoxMessage: message };
    }

    if (!options?.silent) {
      updateRecord(recordId, (current) => ({
        ...current,
        lifecycleEoxMessage: "Consultando Cisco EoX por PID...",
        updatedAt: new Date().toISOString()
      }));
    }

    try {
      const result = await fetchLifecycleEoxRecords(productIds, ciscoApiToken);
      const recordsMap = result.records;
      const lookupResults = result.lookupResults;
      const sourceLabel = result.source === "public-cisco" ? "fuente publica Cisco" : "Cisco Support EoX API";
      const message = `${Object.keys(recordsMap).length} registros EoX encontrados para ${productIds.length} PIDs consultados via ${sourceLabel}.${result.warning ? ` ${result.warning}` : ""}`;
      const nextRecord = {
        ...record,
        lifecycleEoxRecords: recordsMap,
        lifecycleEoxLookupResults: lookupResults,
        lifecycleConsultedProductIds: productIds,
        lifecycleEoxMessage: message,
        updatedAt: new Date().toISOString()
      };
      updateRecord(recordId, (current) => ({
        ...current,
        lifecycleEoxRecords: recordsMap,
        lifecycleEoxLookupResults: lookupResults,
        lifecycleConsultedProductIds: productIds,
        lifecycleEoxMessage: message,
        updatedAt: new Date().toISOString()
      }));
      return nextRecord;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo consultar Cisco EoX.";
      updateRecord(recordId, (current) => ({ ...current, lifecycleEoxMessage: message, updatedAt: new Date().toISOString() }));
      if (options?.failOnError) throw new Error(message);
      return { ...record, lifecycleEoxMessage: message };
    }
  }

  async function consultSupportCoverage(recordId: string) {
    const record = records.find((item) => item.id === recordId);
    if (!record) return selectedRecord!;
    const serials = supportCoverageSerials(record);
    if (serials.length === 0) {
      const message = "No hay seriales disponibles. Carga inventario objetivo o show inventory/show version.";
      updateRecord(recordId, (current) => ({ ...current, supportCoverageMessage: message, updatedAt: new Date().toISOString() }));
      return { ...record, supportCoverageMessage: message };
    }

    updateRecord(recordId, (current) => ({
      ...current,
      supportCoverageMessage: "Consultando cobertura Cisco por numero de serie...",
      updatedAt: new Date().toISOString()
    }));

    try {
      const result = await fetchSupportCoverageRecords(serials, ciscoApiToken);
      const message = `${Object.keys(result.records).length} registros de soporte encontrados para ${serials.length} seriales consultados via Cisco SN2INFO.`;
      const nextRecord = {
        ...record,
        supportCoverageRecords: result.records,
        supportCoverageConsultedSerials: serials,
        supportCoverageMessage: message,
        updatedAt: new Date().toISOString()
      };
      updateRecord(recordId, (current) => ({
        ...current,
        supportCoverageRecords: result.records,
        supportCoverageConsultedSerials: serials,
        supportCoverageMessage: message,
        updatedAt: new Date().toISOString()
      }));
      return nextRecord;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo consultar cobertura de soporte Cisco.";
      updateRecord(recordId, (current) => ({ ...current, supportCoverageMessage: message, updatedAt: new Date().toISOString() }));
      return { ...record, supportCoverageMessage: message };
    }
  }

  async function resetEvaluation(area: EvaluationArea | "complete") {
    if (!selectedRecord) return;
    if (!confirmAction(area === "complete" ? "Esto limpiara todos los analisis generados. Deseas continuar?" : `Esto limpiara el analisis de ${evaluationAreaLabel(area)}. Deseas continuar?`)) return;
    const recordId = selectedRecord.id;

    updateSelectedRecord((record) => {
      const areas = area === "complete" ? evaluationAreas.map((item) => item.id) : [area];
      const fallbackCategories = new Set(areas.map(areaToCategory));
      const clearLifecycle = areas.includes("lifecycle");
      const clearPerformance = area === "complete";
      const nextFindings =
        area === "complete"
          ? []
          : record.parsed.findings.filter((finding) => !fallbackCategories.has(finding.category));
      const nextAIAnalysis =
        area === "complete"
          ? createDefaultAIAnalysisState()
          : {
              ...normalizeAIAnalysisState(record.aiAnalysis),
              updatedAt: new Date().toISOString()
            };

      return {
        ...record,
        parsed: {
          ...record.parsed,
          findings: nextFindings
        },
        assessment: {
          ...record.assessment,
          status: nextFindings.length > 0 ? "review" : record.evidenceFiles.length > 0 ? "evidence" : "draft"
        },
        lifecycleEoxRecords: clearLifecycle ? {} : record.lifecycleEoxRecords,
        lifecycleEoxLookupResults: clearLifecycle ? {} : record.lifecycleEoxLookupResults,
        lifecycleConsultedProductIds: clearLifecycle ? [] : record.lifecycleConsultedProductIds,
        lifecycleEoxMessage: clearLifecycle ? "" : record.lifecycleEoxMessage,
        supportCoverageRecords: clearLifecycle ? {} : record.supportCoverageRecords,
        supportCoverageConsultedSerials: clearLifecycle ? [] : record.supportCoverageConsultedSerials,
        supportCoverageMessage: clearLifecycle ? "" : record.supportCoverageMessage,
        performance: clearPerformance ? createDefaultPerformanceState(record.id, record.scope.performanceAnalysis.mode) : record.performance,
        aiAnalysis: nextAIAnalysis,
        updatedAt: new Date().toISOString()
      };
    });

    const scopeId = area === "complete" ? null : evaluationAreaToAIScope(area);
    const status = await resetPersistentAIAnalysisStatus(recordId, scopeId).catch(() => null);
    setAiAnalysisStatusByAssessment((current) => {
      if (status) return { ...current, [recordId]: status };
      const next = { ...current };
      delete next[recordId];
      return next;
    });
    if (area === "complete") importedAIJobIdsRef.current.clear();
  }

  function resetLifecycleEox(recordId: string) {
    if (!confirmAction("Esto limpiara la tabla de Lifecycle y sus resultados Cisco EoX consultados. Deseas continuar?")) return;
    updateRecord(recordId, (record) => ({
      ...record,
      lifecycleEoxRecords: {},
      lifecycleEoxLookupResults: {},
      lifecycleConsultedProductIds: [],
      lifecycleEoxMessage: "",
      supportCoverageRecords: {},
      supportCoverageConsultedSerials: [],
      supportCoverageMessage: "",
      updatedAt: new Date().toISOString()
    }));
  }

  function updateFinding(id: string, patch: Partial<Finding>) {
    updateSelectedRecord((record) => {
      return {
        ...record,
        updatedAt: new Date().toISOString(),
        parsed: {
          ...record.parsed,
          findings: record.parsed.findings.map((finding) => (finding.id === id ? { ...finding, ...patch } : finding))
        },
        performance: isPerformanceFindingId(id)
          ? {
              ...record.performance,
              findings: record.performance.findings.map((finding) =>
                finding.id === id
                  ? {
                      ...finding,
                      title: patch.title ?? finding.title,
                      evidence: patch.evidence ?? finding.evidence,
                      recommendation: patch.recommendation ?? finding.recommendation,
                      status: patch.status === "validated" ? "validated" : patch.status === "discarded" ? "discarded" : finding.status
                    }
                  : finding
              ),
              assessment: {
                ...record.performance.assessment,
                status: patch.status === "validated" ? "validated" : record.performance.assessment.status,
                updatedAt: new Date().toISOString()
              }
          }
          : record.performance,
        aiAnalysis: {
          ...normalizeAIAnalysisState(record.aiAnalysis),
          updatedAt: new Date().toISOString()
        },
        assessment: {
          ...record.assessment,
          status: patch.status === "validated" ? "roadmap" : record.assessment.status
        }
      };
    });
  }

  function updateOperationalAssessment(updater: (assessment: OperationalAssessment) => OperationalAssessment) {
    updateSelectedRecord((record) => ({
      ...record,
      operationalAssessment: updater(record.operationalAssessment),
      updatedAt: new Date().toISOString()
    }));
  }

  function openCreateForm() {
    if (!currentUser || !canCreateAssessment(currentUser)) return;
    setForm({
      clientName: "",
      industry: "",
      owner: "",
      assessmentName: "",
      status: "draft",
      domains: ["enterprise-networking"]
    });
    setWorkspaceView("dashboard");
  }

  function openEditForm(record: AssessmentRecord) {
    if (!currentUser || !canEditAssessment(currentUser, record)) return;
    setForm({
      recordId: record.id,
      clientName: record.client.name,
      industry: record.client.industry,
      owner: record.client.owner,
      assessmentName: record.assessment.name,
      status: record.assessment.status,
      domains: record.assessment.domains
    });
    setWorkspaceView("dashboard");
  }

  function saveForm() {
    if (!form || !form.clientName.trim() || !form.assessmentName.trim()) return;

    if (form.recordId) {
      const targetRecord = records.find((record) => record.id === form.recordId);
      if (!currentUser || !targetRecord || !canEditAssessment(currentUser, targetRecord)) return;
      setRecords((current) =>
        current.map((record) =>
          record.id === form.recordId
            ? {
                ...record,
                updatedAt: new Date().toISOString(),
                client: {
                  ...record.client,
                  name: form.clientName.trim(),
                  industry: form.industry.trim(),
                  owner: form.owner.trim()
                },
                assessment: {
                  ...record.assessment,
                  name: form.assessmentName.trim(),
                  domains: form.domains,
                  status: form.status
                }
              }
            : record
        )
      );
      setForm(null);
      return;
    }

    if (!currentUser || !canCreateAssessment(currentUser)) return;
    const clientId = uid("client");
    const assessmentId = uid("assess");
    const newRecord: AssessmentRecord = {
      id: assessmentId,
      ownerUserId: currentUser.id,
      shares: [],
      client: {
        id: clientId,
        name: form.clientName.trim(),
        industry: form.industry.trim(),
        owner: form.owner.trim(),
        createdAt: new Date().toISOString()
      },
      assessment: {
        id: assessmentId,
        clientId,
        name: form.assessmentName.trim(),
        domains: form.domains,
        status: form.status,
        createdAt: new Date().toISOString()
      },
      scope: createDefaultScope(form.domains),
      targetInventory: [],
      evidenceSkips: [],
      evidenceFiles: [],
      parsed: emptyParsed,
      lifecycleEoxRecords: {},
      lifecycleEoxLookupResults: {},
      lifecycleConsultedProductIds: [],
      lifecycleEoxMessage: "",
      supportCoverageRecords: {},
      supportCoverageConsultedSerials: [],
      supportCoverageMessage: "",
      operationalAssessment: createDefaultOperationalAssessment(assessmentId, clientId),
      performance: createDefaultPerformanceState(assessmentId),
      aiAnalysis: createDefaultAIAnalysisState(),
      updatedAt: new Date().toISOString()
    };

    setRecords((current) => [newRecord, ...current]);
    setSelectedRecordId(newRecord.id);
    setWorkspaceView("detail");
    setActiveTab("Alcance");
    setForm(null);
  }

  function deleteRecord(recordId: string) {
    const targetRecord = records.find((record) => record.id === recordId);
    if (!currentUser || !targetRecord || !canDeleteAssessment(currentUser, targetRecord)) return;
    setRecords((current) => {
      const next = current.filter((record) => record.id !== recordId);
      if (selectedRecordId === recordId) {
        setSelectedRecordId(next[0]?.id ?? "");
        setWorkspaceView("dashboard");
      }
      return next;
    });
  }

  function selectRecord(recordId: string, targetView: WorkspaceView = "detail") {
    setSelectedRecordId(recordId);
    setWorkspaceView(targetView);
    setActiveTab("Alcance");
  }

  function openSettingsWorkspace() {
    setSettingsReturnView(workspaceView === "settings" ? settingsReturnView : workspaceView);
    setWorkspaceView("settings");
    setForm(null);
  }

  function closeSettingsWorkspace() {
    setWorkspaceView(settingsReturnView);
  }

  async function addUser(input: Omit<AppUser, "id" | "createdAt" | "status" | "passwordHash" | "passwordSalt" | "mustChangePassword" | "passwordUpdatedAt">) {
    if (!currentUser || !canManageUsers(currentUser)) return "";
    const email = input.email.trim().toLowerCase();
    if (!input.name.trim() || !email || users.some((user) => user.email.toLowerCase() === email)) return "";
    const temporaryPassword = generateTemporaryPassword();
    const credentials = await createPasswordCredentials(temporaryPassword);
    setUsers((current) => [
      {
        id: uid("user"),
        name: input.name.trim(),
        email,
        role: input.role,
        status: "active",
        ...credentials,
        mustChangePassword: true,
        passwordUpdatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    return temporaryPassword;
  }

  function updateUser(userId: string, patch: Partial<Pick<AppUser, "name" | "email" | "role" | "status">>) {
    if (!currentUser || !canManageUsers(currentUser)) return;
    setUsers((current) =>
      current.map((user) => {
        if (user.id !== userId) return user;
        const nextRole = user.id === currentUser.id && patch.role && patch.role !== "admin" ? user.role : patch.role ?? user.role;
        const nextStatus = user.id === currentUser.id && patch.status === "disabled" ? user.status : patch.status ?? user.status;
        return {
          ...user,
          ...patch,
          email: patch.email ? patch.email.trim().toLowerCase() : user.email,
          role: nextRole,
          status: nextStatus
        };
      })
    );
  }

  function removeUser(userId: string) {
    if (!currentUser || !canManageUsers(currentUser) || userId === currentUser.id) return;
    setUsers((current) => current.filter((user) => user.id !== userId));
    setRecords((current) =>
      current.map((record) => ({
        ...record,
        shares: record.shares.filter((share) => share.userId !== userId)
      }))
    );
  }

  function shareAssessment(recordId: string, userId: string, permission: SharePermission) {
    const targetRecord = records.find((record) => record.id === recordId);
    if (!currentUser || !targetRecord || !canShareAssessment(currentUser, targetRecord) || targetRecord.ownerUserId === userId) return;
    setRecords((current) =>
      current.map((record) =>
        record.id === recordId
          ? {
              ...record,
              shares: [
                { userId, permission, sharedBy: currentUser.id, sharedAt: new Date().toISOString() },
                ...record.shares.filter((share) => share.userId !== userId)
              ],
              updatedAt: new Date().toISOString()
            }
          : record
      )
    );
  }

  function removeAssessmentShare(recordId: string, userId: string) {
    const targetRecord = records.find((record) => record.id === recordId);
    if (!currentUser || !targetRecord || !canShareAssessment(currentUser, targetRecord)) return;
    setRecords((current) =>
      current.map((record) =>
        record.id === recordId
          ? {
              ...record,
              shares: record.shares.filter((share) => share.userId !== userId),
              updatedAt: new Date().toISOString()
            }
          : record
      )
    );
  }

  async function loginWithCredentials(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find((item) => item.email.toLowerCase() === normalizedEmail && item.status === "active");
    if (!user) {
      setLoginError("Usuario o password invalido.");
      return;
    }

    const passwordHash = await hashPassword(password, user.passwordSalt);
    if (passwordHash !== user.passwordHash) {
      setLoginError("Usuario o password invalido.");
      return;
    }

    setLoginError("");
    setCurrentUserId(user.id);
  }

  async function changeCurrentUserPassword(newPassword: string) {
    if (!currentUser) return;
    const credentials = await createPasswordCredentials(newPassword);
    setUsers((current) =>
      current.map((user) =>
        user.id === currentUser.id
          ? {
              ...user,
              ...credentials,
              mustChangePassword: false,
              passwordUpdatedAt: new Date().toISOString()
            }
          : user
      )
    );
  }

  async function resetUserPassword(userId: string) {
    if (!currentUser || !canManageUsers(currentUser)) return "";
    const temporaryPassword = generateTemporaryPassword();
    const credentials = await createPasswordCredentials(temporaryPassword);
    setUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? {
              ...user,
              ...credentials,
              mustChangePassword: true,
              passwordUpdatedAt: new Date().toISOString()
            }
          : user
      )
    );
    return temporaryPassword;
  }

  if (!currentUser) {
    return <LoginWorkspace error={loginError} onLogin={loginWithCredentials} />;
  }

  if (currentUser.mustChangePassword) {
    return <ChangePasswordWorkspace user={currentUser} onChangePassword={changeCurrentUserPassword} onLogout={() => setCurrentUserId("")} />;
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-28 shrink-0 items-center">
              <Image src="/brand/gbm-logo-blue.png" alt="GBM" width={1000} height={563} priority className="block h-auto w-full object-contain dark:hidden" />
              <Image src="/brand/gbm-logo-white.png" alt="GBM" width={1200} height={675} priority className="hidden h-auto w-full object-contain dark:block" />
            </div>
            <div className="min-w-0 border-l border-border pl-4">
              <h1 className="truncate text-xl font-semibold tracking-normal">NetIQ Assessment Platform</h1>
              <p className="truncate text-sm text-muted-foreground">
                {workspaceView === "dashboard"
                  ? `${records.length} assessments activos en el dashboard`
                  : workspaceView === "settings"
                    ? "Configuracion global, credenciales y plantillas"
                  : selectedRecord
                    ? `${selectedRecord.client.name} · ${selectedRecord.assessment.name}`
                    : "Sin assessment seleccionado"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={workspaceView === "dashboard" ? "primary" : "secondary"} onClick={() => setWorkspaceView("dashboard")}>
              <LayoutDashboard size={16} />
              Dashboard
            </Button>
            <Button onClick={openCreateForm} disabled={!currentUser || !canCreateAssessment(currentUser)}>
              <Plus size={16} />
              Nuevo
            </Button>
            <Button variant={workspaceView === "settings" ? "primary" : "secondary"} onClick={openSettingsWorkspace}>
              <Settings2 size={16} />
              Ajustes
            </Button>
            {currentUser && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                <span className="font-semibold">{currentUser.name}</span>
                <Badge tone={userRoleTone(currentUser.role)}>{userRoleLabel(currentUser.role)}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setCurrentUserId("")}>
                  <LogOut size={13} />
                  Salir
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {workspaceView === "settings" ? (
        <SettingsWorkspace
          uiMode={uiMode}
          onUiModeChange={setUiMode}
          persistenceState={persistenceState}
          openAiApiKey={openAiApiKey}
          openAiCredential={openAiCredential}
          onOpenAiApiKeyChange={setOpenAiApiKey}
          openAiCheck={openAiCheck}
          onOpenAiCheckChange={setOpenAiCheck}
          onTestOpenAiCredential={testOpenAiCredential}
          onSaveOpenAiCredential={saveOpenAiCredential}
          onDeleteOpenAiCredential={deleteOpenAiCredential}
          ciscoApiToken={ciscoApiToken}
          ciscoCredential={ciscoCredential}
          onCiscoApiTokenChange={setCiscoApiToken}
          ciscoTokenCheck={ciscoTokenCheck}
          onCiscoTokenCheckChange={setCiscoTokenCheck}
          onTestCiscoCredential={testCiscoCredential}
          onSaveCiscoCredential={saveCiscoCredential}
          onDeleteCiscoCredential={deleteCiscoCredential}
          documentTemplates={documentTemplates}
          onDocumentTemplatesChange={setDocumentTemplates}
          users={users}
          currentUser={currentUser}
          onAddUser={addUser}
          onUpdateUser={updateUser}
          onRemoveUser={removeUser}
          onResetUserPassword={resetUserPassword}
          onBack={closeSettingsWorkspace}
        />
      ) : workspaceView === "dashboard" ? (
        <DashboardWorkspace
          records={filteredRecords}
          users={users}
          currentUser={currentUser}
          portfolio={portfolio}
          executiveSummaries={dashboardExecutiveSummaries}
          query={query}
          form={form}
          onQueryChange={setQuery}
          onCreate={openCreateForm}
          onEdit={openEditForm}
          onDelete={deleteRecord}
          onSelect={selectRecord}
          onSaveForm={saveForm}
          onCancelForm={() => setForm(null)}
          onFormChange={setForm}
        />
      ) : selectedRecord ? (
        <AssessmentWorkspace
          record={selectedRecord}
          users={users}
          currentUser={currentUser}
          canEdit={currentUser ? canEditAssessment(currentUser, selectedRecord) : false}
          canShare={currentUser ? canShareAssessment(currentUser, selectedRecord) : false}
          activeTab={activeTab}
          isParsing={isParsing}
          activeFindings={activeFindings}
          validatedFindings={validatedFindings}
          roadmap={roadmap}
          executiveSummary={selectedExecutiveSummary}
          documentTemplates={documentTemplates}
          aiAnalysisStatus={selectedAIAnalysisStatus}
          onBack={() => setWorkspaceView("dashboard")}
          onTabChange={setActiveTab}
          onEdit={() => openEditForm(selectedRecord)}
          onDomainToggle={updateAssessmentDomains}
          onScopeChange={updateScope}
          onAddAsset={addInventoryAsset}
          onImportAssets={importInventoryAssets}
          onRemoveAsset={removeInventoryAsset}
          onToggleAssetIncluded={toggleInventoryAssetIncluded}
          onUpdateAssetTopologyLayer={updateInventoryAssetTopologyLayer}
          onClearAssets={clearInventoryAssets}
          onRemoveDuplicateAssets={removeDuplicateInventoryAssets}
          onEvidenceUpload={handleEvidenceUpload}
          onPerformanceEvidenceUpload={handlePerformanceEvidenceUpload}
          onRemoveEvidenceFile={removeEvidenceFile}
          onClearEvidenceFiles={clearEvidenceFiles}
          onRemovePerformanceEvidenceFile={removePerformanceEvidenceFile}
          onClearPerformanceEvidenceFiles={clearPerformanceEvidenceFiles}
          onToggleEvidenceRowSkip={toggleEvidenceRowSkip}
          onRunEvaluation={runEvaluation}
          onCancelAnalysisJob={cancelAnalysisJob}
          onRetryAnalysisJob={retryAnalysisJob}
          onResetEvaluation={resetEvaluation}
          onProcessPerformance={processPerformanceForSelectedRecord}
          onRunPerformanceAi={markPerformanceAiReviewed}
          onResetPerformance={resetPerformanceForSelectedRecord}
          onConsultLifecycleEox={(recordId) => consultLifecycleEox(recordId)}
          onConsultSupportCoverage={(recordId) => consultSupportCoverage(recordId)}
          onResetLifecycleEox={resetLifecycleEox}
          onUpdateOperationalAssessment={updateOperationalAssessment}
          onUpdateFinding={updateFinding}
          onShareAssessment={shareAssessment}
          onRemoveAssessmentShare={removeAssessmentShare}
        />
      ) : (
        <div className="mx-auto max-w-screen-2xl px-5 py-5">
          <EmptyState icon={<ClipboardList size={24} />} title="Crea un assessment para comenzar" />
        </div>
      )}
    </main>
  );
}

function LoginWorkspace({ error, onLogin }: { error: string; onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("admin@assessment.local");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setIsSubmitting(true);
    try {
      await onLogin(email, password);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-8">
      <div className="w-full" style={{ maxWidth: 440 }}>
        <Panel className="w-full">
          <PanelHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-28 shrink-0 items-center">
                <Image src="/brand/gbm-logo-blue.png" alt="GBM" width={1000} height={563} priority className="block h-auto w-full object-contain dark:hidden" />
                <Image src="/brand/gbm-logo-white.png" alt="GBM" width={1200} height={675} priority className="hidden h-auto w-full object-contain dark:block" />
              </div>
              <div>
                <h1 className="text-sm font-semibold">NetIQ Assessment Platform</h1>
                <p className="text-xs text-muted-foreground">Ingresa con usuario y password.</p>
              </div>
            </div>
          </PanelHeader>
          <PanelBody>
            <form className="space-y-3" onSubmit={submitLogin}>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Usuario</span>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@empresa.com" autoComplete="username" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Password</span>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" />
              </label>
              {error && (
                <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900">
                  {error}
                </div>
              )}
              <Button className="w-full" type="submit" disabled={!email.trim() || !password || isSubmitting}>
                {isSubmitting ? "Validando" : "Entrar"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Usuario inicial: admin@assessment.local · password temporal: admin123
              </p>
            </form>
          </PanelBody>
        </Panel>
      </div>
    </main>
  );
}

function ChangePasswordWorkspace({
  user,
  onChangePassword,
  onLogout
}: {
  user: AppUser;
  onChangePassword: (newPassword: string) => Promise<void>;
  onLogout: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError("El nuevo password debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("La confirmacion no coincide.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onChangePassword(password);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-8">
      <div className="w-full" style={{ maxWidth: 440 }}>
        <Panel className="w-full">
          <PanelHeader>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded bg-primary/10 text-primary">
                <ShieldCheck size={18} />
              </span>
              <div>
                <h1 className="text-sm font-semibold">Cambiar password temporal</h1>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </PanelHeader>
          <PanelBody>
            <form className="space-y-3" onSubmit={submitPassword}>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Nuevo password</span>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Confirmar password</span>
                <Input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" />
              </label>
              {error && (
                <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900">
                  {error}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!password || !confirmation || isSubmitting}>
                  <Save size={15} />
                  {isSubmitting ? "Guardando" : "Guardar password"}
                </Button>
                <Button type="button" variant="secondary" onClick={onLogout}>
                  <LogOut size={15} />
                  Salir
                </Button>
              </div>
            </form>
          </PanelBody>
        </Panel>
      </div>
    </main>
  );
}

function SettingsWorkspace({
  uiMode,
  onUiModeChange,
  persistenceState,
  openAiApiKey,
  openAiCredential,
  onOpenAiApiKeyChange,
  openAiCheck,
  onOpenAiCheckChange,
  onTestOpenAiCredential,
  onSaveOpenAiCredential,
  onDeleteOpenAiCredential,
  ciscoApiToken,
  ciscoCredential,
  onCiscoApiTokenChange,
  ciscoTokenCheck,
  onCiscoTokenCheckChange,
  onTestCiscoCredential,
  onSaveCiscoCredential,
  onDeleteCiscoCredential,
  documentTemplates,
  onDocumentTemplatesChange,
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onRemoveUser,
  onResetUserPassword,
  onBack
}: {
  uiMode: UiMode;
  onUiModeChange: (mode: UiMode) => void;
  persistenceState: PersistenceState;
  openAiApiKey: string;
  openAiCredential: ApiCredentialMetadata;
  onOpenAiApiKeyChange: (value: string) => void;
  openAiCheck: CredentialCheckStatus;
  onOpenAiCheckChange: (status: CredentialCheckStatus) => void;
  onTestOpenAiCredential: () => void;
  onSaveOpenAiCredential: () => void;
  onDeleteOpenAiCredential: () => void;
  ciscoApiToken: string;
  ciscoCredential: ApiCredentialMetadata;
  onCiscoApiTokenChange: (value: string) => void;
  ciscoTokenCheck: CredentialCheckStatus;
  onCiscoTokenCheckChange: (status: CredentialCheckStatus) => void;
  onTestCiscoCredential: () => void;
  onSaveCiscoCredential: () => void;
  onDeleteCiscoCredential: () => void;
  documentTemplates: DocumentTemplateVersion[];
  onDocumentTemplatesChange: React.Dispatch<React.SetStateAction<DocumentTemplateVersion[]>>;
  users: AppUser[];
  currentUser: AppUser | null;
  onAddUser: (input: Omit<AppUser, "id" | "createdAt" | "status" | "passwordHash" | "passwordSalt" | "mustChangePassword" | "passwordUpdatedAt">) => Promise<string>;
  onUpdateUser: (userId: string, patch: Partial<Pick<AppUser, "name" | "email" | "role" | "status">>) => void;
  onRemoveUser: (userId: string) => void;
  onResetUserPassword: (userId: string) => Promise<string>;
  onBack: () => void;
}) {
  const isAdmin = Boolean(currentUser && canManageUsers(currentUser));

  return (
    <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-5 sm:px-5">
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-primary/10 text-primary">
              <Settings2 size={18} />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Ajustes</h2>
              <p className="text-xs text-muted-foreground">Configuracion global, credenciales de integracion y plantillas documentales.</p>
            </div>
          </div>
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Regresar
          </Button>
        </PanelHeader>
        <PanelBody>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 md:col-span-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">UI mode</p>
                <p className="text-sm font-semibold">{uiMode === "dark" ? "Dark UI mode" : "Light UI mode"}</p>
              </div>
              <div className="flex rounded-md border border-border bg-white p-1">
                <button
                  className={cn("flex h-8 items-center gap-2 rounded px-3 text-xs font-medium", uiMode === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                  onClick={() => onUiModeChange("dark")}
                >
                  <Moon size={14} />
                  Dark
                </button>
                <button
                  className={cn("flex h-8 items-center gap-2 rounded px-3 text-xs font-medium", uiMode === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                  onClick={() => onUiModeChange("light")}
                >
                  <Sun size={14} />
                  Light
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 md:col-span-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Persistencia</p>
                <p className="text-sm font-semibold">{persistenceTitle(persistenceState.mode)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{persistenceState.message}</p>
              </div>
              <Badge tone={persistenceTone(persistenceState.mode)}>
                {persistenceState.mode === "postgres" ? "PostgreSQL" : persistenceState.mode === "loading" ? "Cargando" : persistenceState.mode === "local" ? "Local cache" : "Error"}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">OpenAI API key</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="primary" onClick={onSaveOpenAiCredential} disabled={!isAdmin || !openAiApiKey.trim() || openAiCheck.state === "saving"}>
                    <Save size={13} />
                    {openAiCheck.state === "saving" ? "Guardando" : "Guardar"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={onTestOpenAiCredential} disabled={!isAdmin || openAiCheck.state === "checking" || openAiCheck.state === "saving" || (!openAiApiKey.trim() && !openAiCredential.configured)}>
                    <Search size={13} />
                    {openAiCheck.state === "checking" ? "Probando" : "Probar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onOpenAiApiKeyChange("");
                      onOpenAiCheckChange({ state: "idle", message: "" });
                    }}
                    disabled={!isAdmin || !openAiApiKey}
                  >
                    <X size={13} />
                    Limpiar campo
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDeleteOpenAiCredential}
                    disabled={!isAdmin || openAiCredential.source !== "postgres" || openAiCheck.state === "saving"}
                  >
                    <Trash2 size={13} />
                    Eliminar
                  </Button>
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {openAiCredential.configured ? openAiCredential.maskedValue : "No configurada"}
                  </span>
                  <Badge tone={openAiCredential.configured ? "success" : "neutral"}>
                    {openAiCredential.source === "postgres" ? "Persistente cifrada" : openAiCredential.source === "env" ? "Entorno" : "Sin credencial"}
                  </Badge>
                </div>
                {openAiCredential.updatedAt && (
                  <p className="mt-1 text-muted-foreground">
                    Actualizada {formatDate(openAiCredential.updatedAt)}
                    {openAiCredential.updatedBy ? ` por ${openAiCredential.updatedBy}` : ""}
                  </p>
                )}
              </div>
              <Input
                type="password"
                value={openAiApiKey}
                onChange={(event) => {
                  onOpenAiApiKeyChange(event.target.value);
                  onOpenAiCheckChange({ state: "idle", message: "" });
                }}
                placeholder={openAiCredential.configured ? "Pega una nueva llave para reemplazar la actual" : "sk-..."}
                disabled={!isAdmin}
              />
              <CredentialCheckMessage status={openAiCheck} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Cisco EoX OAuth access token</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="primary" onClick={onSaveCiscoCredential} disabled={!isAdmin || !ciscoApiToken.trim() || ciscoTokenCheck.state === "saving"}>
                    <Save size={13} />
                    {ciscoTokenCheck.state === "saving" ? "Guardando" : "Guardar"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={onTestCiscoCredential} disabled={!isAdmin || ciscoTokenCheck.state === "checking" || ciscoTokenCheck.state === "saving" || (!ciscoApiToken.trim() && !ciscoCredential.configured)}>
                    <Search size={13} />
                    {ciscoTokenCheck.state === "checking" ? "Probando" : "Probar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onCiscoApiTokenChange("");
                      onCiscoTokenCheckChange({ state: "idle", message: "" });
                    }}
                    disabled={!isAdmin || !ciscoApiToken}
                  >
                    <X size={13} />
                    Limpiar campo
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDeleteCiscoCredential}
                    disabled={!isAdmin || ciscoCredential.source !== "postgres" || ciscoTokenCheck.state === "saving"}
                  >
                    <Trash2 size={13} />
                    Eliminar
                  </Button>
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {ciscoCredential.configured ? ciscoCredential.maskedValue : "No configurado"}
                  </span>
                  <Badge tone={ciscoCredential.configured ? "success" : "neutral"}>
                    {ciscoCredential.source === "postgres" ? "Persistente cifrado" : ciscoCredential.source === "env" ? "Entorno" : "Sin credencial"}
                  </Badge>
                </div>
                {ciscoCredential.updatedAt && (
                  <p className="mt-1 text-muted-foreground">
                    Actualizado {formatDate(ciscoCredential.updatedAt)}
                    {ciscoCredential.updatedBy ? ` por ${ciscoCredential.updatedBy}` : ""}
                  </p>
                )}
              </div>
              <Input
                type="password"
                value={ciscoApiToken}
                onChange={(event) => {
                  onCiscoApiTokenChange(event.target.value);
                  onCiscoTokenCheckChange({ state: "idle", message: "" });
                }}
                placeholder={ciscoCredential.configured ? "Pega un nuevo token para reemplazar el actual" : "Pega el access token, con o sin Bearer"}
                disabled={!isAdmin}
              />
              <CredentialCheckMessage status={ciscoTokenCheck} />
            </div>

            <div className="md:col-span-2">
              <SettingsDocumentTemplatesSection templates={documentTemplates} canManage={isAdmin} onTemplatesChange={onDocumentTemplatesChange} />
            </div>

            <div className="md:col-span-2">
              <SettingsUsersSection
                users={users}
                currentUser={currentUser}
                canManage={isAdmin}
                onAddUser={onAddUser}
                onUpdateUser={onUpdateUser}
                onRemoveUser={onRemoveUser}
                onResetUserPassword={onResetUserPassword}
              />
            </div>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

function DashboardWorkspace({
  records,
  users,
  currentUser,
  portfolio,
  executiveSummaries,
  query,
  form,
  onQueryChange,
  onCreate,
  onEdit,
  onDelete,
  onSelect,
  onSaveForm,
  onCancelForm,
  onFormChange
}: {
  records: AssessmentRecord[];
  users: AppUser[];
  currentUser: AppUser | null;
  portfolio: ReturnType<typeof summarizePortfolio>;
  executiveSummaries: Map<string, ExecutiveRiskDashboard>;
  query: string;
  form: AssessmentForm | null;
  onQueryChange: (value: string) => void;
  onCreate: () => void;
  onEdit: (record: AssessmentRecord) => void;
  onDelete: (recordId: string) => void;
  onSelect: (recordId: string, view?: WorkspaceView) => void;
  onSaveForm: () => void;
  onCancelForm: () => void;
  onFormChange: (form: AssessmentForm) => void;
}) {
  return (
    <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-5 sm:px-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <MetricPanel label="Assessments" value={portfolio.total} />
        <MetricPanel label="En revision" value={portfolio.inReview} />
        <MetricPanel label="Hallazgos" value={portfolio.findings} />
        <MetricPanel label="Validados" value={portfolio.validated} />
        <MetricPanel label="Dispositivos" value={portfolio.devices} />
      </div>

      {form && (
        <AssessmentFormPanel
          form={form}
          onChange={onFormChange}
          onSave={onSaveForm}
          onCancel={onCancelForm}
        />
      )}

      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Dashboard de assessments</h2>
            <p className="text-xs text-muted-foreground">Visibilidad central de estado, proceso y datos recolectados.</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-full pl-9 sm:w-72" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar cliente, owner o assessment" />
            </div>
            <Button onClick={onCreate} disabled={!currentUser || !canCreateAssessment(currentUser)}>
              <Plus size={16} />
              Crear
            </Button>
          </div>
        </PanelHeader>
        <PanelBody>
          {records.length === 0 ? (
            <EmptyState icon={<ClipboardList size={24} />} title="Sin assessments para mostrar" />
          ) : (
            <div className="space-y-2">
              {records.map((record) => {
                const progress = assessmentProgress(record);
                const effectiveParsed = effectiveParsedNetworkData(record);
                return (
                  <article key={record.id} className="rounded-md border border-border bg-white p-3 transition hover:border-primary/45">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button className="max-w-full text-left" onClick={() => onSelect(record.id)}>
                            <span className="block truncate text-base font-semibold hover:text-primary">{record.client.name}</span>
                          </button>
                          <Badge tone={statusTone[record.assessment.status]}>{statusLabel[record.assessment.status]}</Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{record.assessment.name}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="secondary" title="Abrir" onClick={() => onSelect(record.id)}>
                          <ClipboardList size={15} />
                        </Button>
                        <Button size="icon" variant="secondary" title="Editar" onClick={() => onEdit(record)} disabled={!currentUser || !canEditAssessment(currentUser, record)}>
                          <Pencil size={15} />
                        </Button>
                        <Button size="icon" variant="secondary" title="Borrar" onClick={() => onDelete(record.id)} disabled={!currentUser || !canDeleteAssessment(currentUser, record)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 grid auto-rows-fr gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,0.9fr)_minmax(250px,1.05fr)_minmax(210px,0.9fr)_minmax(230px,0.95fr)]">
                      <div className="flex min-h-[116px] flex-col rounded-md border border-border bg-muted/20 p-2.5">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Alcance</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {record.assessment.domains.map((domain) => (
                            <Badge key={domain} className="whitespace-nowrap">{domainLabel(domain)}</Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex min-h-[116px] flex-col justify-between rounded-md border border-border bg-muted/20 p-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Proceso</p>
                          <span className="text-xs font-semibold">{progress}%</span>
                        </div>
                        <div>
                          <div className="h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">Completado del flujo de assessment</p>
                        </div>
                      </div>

                      <div className="flex min-h-[116px] flex-col rounded-md border border-border bg-muted/20 p-2.5">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Datos</p>
                        <div className="mt-1.5 grid flex-1 grid-cols-4 gap-1.5 xl:grid-cols-2">
                          <DashboardDataPoint label="Evidencias" value={record.evidenceFiles.length} />
                          <DashboardDataPoint label="Equipos" value={effectiveParsed.devices.length} />
                          <DashboardDataPoint label="Links" value={effectiveParsed.relations.length} />
                          <DashboardDataPoint label="Hallazgos" value={record.parsed.findings.length} />
                        </div>
                      </div>

                      <div className="flex min-h-[116px] flex-col justify-between rounded-md border border-border bg-muted/20 p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Resumen ejecutivo</p>
                          <div className="shrink-0">
                            <ExecutiveDashboardPill summary={executiveSummaries.get(record.id)} />
                          </div>
                        </div>
                        <div className="mt-2 border-t border-border pt-2">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Owner</p>
                            <p className="truncate text-sm font-semibold">{recordOwnerName(record, users)}</p>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {currentUser && <span>{assessmentAccessLabel(currentUser, record)}</span>}
                            <span>{formatDate(record.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

function DashboardDataPoint({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-white/70 px-2 py-1">
      <p className="text-sm font-semibold leading-none">{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ExecutiveDashboardPill({ summary }: { summary?: ExecutiveRiskDashboard }) {
  if (!summary) return <Badge tone="neutral">Pendiente</Badge>;
  if (!summary.isSufficient) {
    return (
      <div className="space-y-1">
        <Badge tone="warning">Pendiente</Badge>
        <p className="text-xs text-muted-foreground">ICA {summary.ica}/100</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Badge tone={executiveLevelTone(summary.irirLevel)}>IRIR {summary.irir}</Badge>
      <p className="text-xs text-muted-foreground">ICA {summary.ica} · {summary.icaLevel}</p>
    </div>
  );
}

function AssessmentTabRail({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  const activeIndex = tabs.indexOf(activeTab) + 1;
  const activeLabel = assessmentTabLabel(activeTab);
  const tabButtonRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    tabButtonRefs.current[activeTab]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }, [activeTab]);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-white shadow-subtle">
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Flujo de assessment</p>
          <p className="truncate text-sm font-medium text-foreground">Etapa actual: {activeLabel}</p>
        </div>
        <Badge tone="info">
          Paso {activeIndex} de {tabs.length}
        </Badge>
      </div>
      <div className="assessment-tab-scroll overflow-x-auto">
        <nav className="flex min-w-max items-center gap-1 p-1" aria-label="Flujo de assessment">
          {tabs.map((tab, index) => {
            const { icon: Icon, eyebrow } = tabDefinitions[tab];
            const label = assessmentTabLabel(tab);
            const isActive = activeTab === tab;

            return (
              <button
                key={tab}
                ref={(element) => {
                  tabButtonRefs.current[tab] = element;
                }}
                className={cn(
                  "assessment-tab-snap-item flex h-11 shrink-0 items-center gap-2 rounded px-2.5 text-left text-xs font-medium transition",
                  isActive ? "bg-primary text-primary-foreground shadow-subtle" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
                onClick={() => onTabChange(tab)}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded border text-[11px] font-semibold",
                    isActive ? "border-primary-foreground/40 bg-primary-foreground/15" : "border-border bg-white text-muted-foreground"
                  )}
                >
                  {index + 1}
                </span>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className={cn("block text-[10px] font-semibold uppercase", isActive ? "text-primary-foreground/75" : "text-muted-foreground")}>
                    {eyebrow}
                  </span>
                  <span className="block whitespace-nowrap">{label}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function AssessmentWorkspace({
  record,
  users,
  currentUser,
  canEdit,
  canShare,
  activeTab,
  isParsing,
  activeFindings,
  validatedFindings,
  roadmap,
  executiveSummary,
  documentTemplates,
  aiAnalysisStatus,
  onBack,
  onTabChange,
  onEdit,
  onDomainToggle,
  onScopeChange,
  onAddAsset,
  onImportAssets,
  onRemoveAsset,
  onToggleAssetIncluded,
  onUpdateAssetTopologyLayer,
  onClearAssets,
  onRemoveDuplicateAssets,
  onEvidenceUpload,
  onPerformanceEvidenceUpload,
  onRemoveEvidenceFile,
  onClearEvidenceFiles,
  onRemovePerformanceEvidenceFile,
  onClearPerformanceEvidenceFiles,
  onToggleEvidenceRowSkip,
  onRunEvaluation,
  onCancelAnalysisJob,
  onRetryAnalysisJob,
  onResetEvaluation,
  onProcessPerformance,
  onRunPerformanceAi,
  onResetPerformance,
  onConsultLifecycleEox,
  onConsultSupportCoverage,
  onResetLifecycleEox,
  onUpdateOperationalAssessment,
  onUpdateFinding,
  onShareAssessment,
  onRemoveAssessmentShare
}: {
  record: AssessmentRecord;
  users: AppUser[];
  currentUser: AppUser | null;
  canEdit: boolean;
  canShare: boolean;
  activeTab: Tab;
  isParsing: boolean;
  activeFindings: Finding[];
  validatedFindings: Finding[];
  roadmap: ReturnType<typeof buildRoadmap>;
  executiveSummary: ExecutiveRiskDashboard | null;
  documentTemplates: DocumentTemplateVersion[];
  aiAnalysisStatus?: AIAssessmentAnalysisStatus;
  onBack: () => void;
  onTabChange: (tab: Tab) => void;
  onEdit: () => void;
  onDomainToggle: (domain: Domain) => void;
  onScopeChange: (patch: Partial<ScopeDefinition>) => void;
  onAddAsset: (asset: Omit<InventoryAsset, "id">) => void;
  onImportAssets: (assets: Array<Omit<InventoryAsset, "id">>) => void;
  onRemoveAsset: (assetId: string) => void;
  onToggleAssetIncluded: (assetId: string) => void;
  onUpdateAssetTopologyLayer: (assetId: string, topologyLayer: TopologyLayerId | null) => void;
  onClearAssets: () => void;
  onRemoveDuplicateAssets: () => void;
  onEvidenceUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPerformanceEvidenceUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveEvidenceFile: (fileId: string) => void;
  onClearEvidenceFiles: () => void;
  onRemovePerformanceEvidenceFile: (fileId: string) => void;
  onClearPerformanceEvidenceFiles: () => void;
  onToggleEvidenceRowSkip: (assetId: string) => void;
  onRunEvaluation: (area: EvaluationArea | "complete", options?: RunEvaluationOptions) => void;
  onCancelAnalysisJob: (jobId: string) => void;
  onRetryAnalysisJob: (jobId: string) => void;
  onResetEvaluation: (area: EvaluationArea | "complete") => void;
  onProcessPerformance: () => void;
  onRunPerformanceAi: () => void;
  onResetPerformance: () => void;
  onConsultLifecycleEox: (recordId: string) => Promise<AssessmentRecord>;
  onConsultSupportCoverage: (recordId: string) => Promise<AssessmentRecord>;
  onResetLifecycleEox: (recordId: string) => void;
  onUpdateOperationalAssessment: (updater: (assessment: OperationalAssessment) => OperationalAssessment) => void;
  onUpdateFinding: (id: string, patch: Partial<Finding>) => void;
  onShareAssessment: (recordId: string, userId: string, permission: SharePermission) => void;
  onRemoveAssessmentShare: (recordId: string, userId: string) => void;
}) {
  const [assessmentPanelOpen, setAssessmentPanelOpen] = useState(false);
  const effectiveParsed = useMemo(() => effectiveParsedNetworkData(record), [record]);

  return (
    <div className="mx-auto max-w-screen-2xl space-y-4 px-4 py-5 sm:px-5">
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-primary/10 text-primary">
              <Building2 size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{record.client.name} · {record.assessment.name}</h2>
              <p className="truncate text-xs text-muted-foreground">
                {record.client.industry || "Industria pendiente"} · {record.client.owner || "Owner pendiente"} · {statusLabel[record.assessment.status]}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft size={16} />
              Dashboard
            </Button>
            <Button variant="secondary" onClick={onEdit} disabled={!canEdit}>
              <Pencil size={15} />
              Editar
            </Button>
            <Button variant="secondary" onClick={() => setAssessmentPanelOpen((value) => !value)}>
              {assessmentPanelOpen ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
              {assessmentPanelOpen ? "Colapsar" : "Desplegar"}
            </Button>
          </div>
        </PanelHeader>
        {assessmentPanelOpen && (
          <PanelBody className="space-y-4">
            {!canEdit && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Modo solo lectura: puedes revisar este assessment, pero no modificar datos, evidencia, hallazgos ni configuraciones.
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Assessment</p>
                <p className="mt-1 truncate text-sm font-semibold">{record.assessment.name}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Estado</p>
                <div className="mt-1">
                  <Badge tone={statusTone[record.assessment.status]}>{statusLabel[record.assessment.status]}</Badge>
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Fechas</p>
                <p className="mt-1 text-sm">Creado: {formatDate(record.assessment.createdAt)}</p>
                <p className="text-xs text-muted-foreground">Actualizado: {formatDate(record.updatedAt)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Dominios activos</p>
                <p className="mt-1 truncate text-sm font-semibold">{record.assessment.domains.map(domainLabel).join(", ") || "Pendiente"}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Dominios</p>
              <div className="flex flex-wrap gap-2">
                {domains.map((domain) => (
                  <label key={domain.id} className="flex h-10 items-center gap-3 rounded-md border border-border bg-white px-3 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={record.assessment.domains.includes(domain.id)}
                      disabled={!canEdit}
                      onChange={() => onDomainToggle(domain.id)}
                    />
                    {domain.label}
                  </label>
                ))}
              </div>
            </div>
            <AssessmentSharingPanel
              record={record}
              users={users}
              currentUser={currentUser}
              canShare={canShare}
              onShareAssessment={onShareAssessment}
              onRemoveAssessmentShare={onRemoveAssessmentShare}
            />
          </PanelBody>
        )}
      </Panel>

      <section className="space-y-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          <MetricPanel label="Progreso" value={`${assessmentProgress(record)}%`} />
          <MetricPanel label="Evidencias" value={record.evidenceFiles.length} />
          <MetricPanel label="Equipos" value={effectiveParsed.devices.length} />
          <MetricPanel label="Validados" value={validatedFindings.length} />
        </div>

        <AssessmentTabRail activeTab={activeTab} onTabChange={onTabChange} />

        {activeTab === "Alcance" && (
          <ScopeTab
            record={record}
            activeFindings={activeFindings}
            onScopeChange={canEdit ? onScopeChange : () => undefined}
            onGoInventory={() => onTabChange("Inventario")}
          />
        )}

        {activeTab === "Inventario" && (
          <InventoryTab
            record={record}
            onAddAsset={canEdit ? onAddAsset : () => undefined}
            onImportAssets={canEdit ? onImportAssets : () => undefined}
            onRemoveAsset={canEdit ? onRemoveAsset : () => undefined}
            onToggleAssetIncluded={canEdit ? onToggleAssetIncluded : () => undefined}
            onUpdateAssetTopologyLayer={canEdit ? onUpdateAssetTopologyLayer : () => undefined}
            onClearAssets={canEdit ? onClearAssets : () => undefined}
            onRemoveDuplicateAssets={canEdit ? onRemoveDuplicateAssets : () => undefined}
          />
        )}

        {activeTab === "SOW" && <SowTab record={record} documentTemplates={documentTemplates} />}

        {activeTab === "Scripts" && <ScriptsTab record={record} />}

        {activeTab === "Data" && (
          <EvidenceTab
            record={record}
            isParsing={isParsing}
            onEvidenceUpload={canEdit ? onEvidenceUpload : () => undefined}
            onPerformanceEvidenceUpload={canEdit ? onPerformanceEvidenceUpload : () => undefined}
            onRemoveEvidenceFile={canEdit ? onRemoveEvidenceFile : () => undefined}
            onClearEvidenceFiles={canEdit ? onClearEvidenceFiles : () => undefined}
            onRemovePerformanceEvidenceFile={canEdit ? onRemovePerformanceEvidenceFile : () => undefined}
            onClearPerformanceEvidenceFiles={canEdit ? onClearPerformanceEvidenceFiles : () => undefined}
            onToggleEvidenceRowSkip={canEdit ? onToggleEvidenceRowSkip : () => undefined}
          />
        )}

        {activeTab === "Estado Actual" && <ArchitectureCurrentTab record={record} />}

        {activeTab === "performance" && (
          <PerformanceTab
            record={record}
            onProcessPerformance={canEdit ? onProcessPerformance : () => undefined}
            onRunPerformanceAi={canEdit ? onRunPerformanceAi : () => undefined}
            onResetPerformance={canEdit ? onResetPerformance : () => undefined}
          />
        )}

        {activeTab === "Hallazgos" && (
          <FindingsTab record={record} documentTemplates={documentTemplates} onUpdateFinding={canEdit ? onUpdateFinding : () => undefined} />
        )}

        {activeTab === "Evaluacion AI" && (
          <AiEvaluationTab
            record={record}
            currentUser={currentUser}
            aiAnalysisStatus={aiAnalysisStatus}
            onRunEvaluation={canEdit ? onRunEvaluation : () => undefined}
            onCancelAnalysisJob={canEdit ? onCancelAnalysisJob : () => undefined}
            onRetryAnalysisJob={canEdit ? onRetryAnalysisJob : () => undefined}
            onResetEvaluation={canEdit ? onResetEvaluation : () => undefined}
            onUpdateFinding={canEdit ? onUpdateFinding : () => undefined}
            onProcessPerformance={canEdit ? onProcessPerformance : () => undefined}
            onRunPerformanceAi={canEdit ? onRunPerformanceAi : () => undefined}
            onResetPerformance={canEdit ? onResetPerformance : () => undefined}
          />
        )}

        {activeTab === "Vigencia" && (
          <LifecycleTab
            record={record}
            onConsultLifecycleEox={canEdit ? onConsultLifecycleEox : async () => record}
            onConsultSupportCoverage={canEdit ? onConsultSupportCoverage : async () => record}
            onResetLifecycleEox={canEdit ? onResetLifecycleEox : () => undefined}
          />
        )}

        {activeTab === "Operaciones" && (
          <OperationsTab
            assessment={record.operationalAssessment}
            onUpdate={canEdit ? onUpdateOperationalAssessment : () => undefined}
          />
        )}

        {activeTab === "Roadmap" && (
          <RoadmapPlaceholder roadmap={roadmap} />
        )}

        {activeTab === "Resumen" && executiveSummary && (
          <ExecutiveSummaryTab record={record} summary={executiveSummary} documentTemplates={documentTemplates} />
        )}
      </section>
    </div>
  );
}

function AssessmentSharingPanel({
  record,
  users,
  currentUser,
  canShare,
  onShareAssessment,
  onRemoveAssessmentShare
}: {
  record: AssessmentRecord;
  users: AppUser[];
  currentUser: AppUser | null;
  canShare: boolean;
  onShareAssessment: (recordId: string, userId: string, permission: SharePermission) => void;
  onRemoveAssessmentShare: (recordId: string, userId: string) => void;
}) {
  const shareCandidates = useMemo(
    () => users.filter((user) => user.status === "active" && user.id !== record.ownerUserId),
    [users, record.ownerUserId]
  );
  const [targetUserId, setTargetUserId] = useState(shareCandidates[0]?.id ?? "");
  const [permission, setPermission] = useState<SharePermission>("edit");
  const effectiveTargetUserId = shareCandidates.some((user) => user.id === targetUserId) ? targetUserId : shareCandidates[0]?.id ?? "";

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Acceso</p>
          <h3 className="text-sm font-semibold">Compartir assessment</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Owner: {recordOwnerName(record, users)} · Tu acceso: {currentUser ? assessmentAccessLabel(currentUser, record) : "Sin sesion"}
          </p>
        </div>
        <Badge tone={canShare ? "success" : "neutral"}>{canShare ? "Puede compartir" : "Solo lectura"}</Badge>
      </div>

      {canShare && (
        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <select
            className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            value={effectiveTargetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
          >
            {shareCandidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} · {userRoleLabel(user.role)}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            value={permission}
            onChange={(event) => setPermission(event.target.value as SharePermission)}
          >
            <option value="edit">Editar</option>
            <option value="view">Solo lectura</option>
          </select>
          <Button onClick={() => onShareAssessment(record.id, effectiveTargetUserId, permission)} disabled={!effectiveTargetUserId}>
            <Users size={15} />
            Compartir
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {record.shares.length === 0 ? (
          <Badge tone="neutral">Sin usuarios compartidos</Badge>
        ) : (
          record.shares.map((share) => {
            const user = users.find((item) => item.id === share.userId);
            return (
              <div key={share.userId} className="flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1 text-xs">
                <span className="font-medium">{user?.name ?? "Usuario eliminado"}</span>
                <Badge tone={share.permission === "edit" ? "info" : "neutral"}>{share.permission === "edit" ? "Editor" : "Viewer"}</Badge>
                {canShare && (
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => onRemoveAssessmentShare(record.id, share.userId)}>
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ArchitectureCurrentTab({ record }: { record: AssessmentRecord }) {
  return <TopologyTab key={record.id} record={record} />;
}

function PerformanceTab({
  record,
  onProcessPerformance,
  onRunPerformanceAi,
  onResetPerformance
}: {
  record: AssessmentRecord;
  onProcessPerformance: () => void;
  onRunPerformanceAi: () => void;
  onResetPerformance: () => void;
}) {
  const [viewMode, setViewMode] = useState<"executive" | "technical">("executive");
  const [technicalView, setTechnicalView] = useState<"overview" | "interfaces" | "devices" | "instability" | "historical" | "evidence" | "insights">("overview");
  const [filters, setFilters] = useState<PerformanceDashboardFilters>({ severity: "all", metricType: "all", sampleType: "all", timeWindow: "all", showVisibilityGaps: true });
  const [selectedMetric, setSelectedMetric] = useState<PerformanceChartPoint | null>(null);
  const performance = record.performance;
  const effectiveParsed = useMemo(() => effectiveParsedNetworkData(record), [record]);
  const expectedDevices = record.targetInventory.filter((asset) => asset.included).map((asset) => asset.hostname);
  const criticalInterfaces = effectiveParsed.interfaces
    .filter((intf) => /uplink|trunk|wan|core|firewall|internet|server/i.test(`${intf.description ?? ""} ${intf.name}`))
    .map((intf) => ({ deviceId: intf.hostname, interfaceId: intf.name }));
  const executiveData = buildExecutivePerformanceViewData({
    assessmentId: record.id,
    enabled: record.scope.performanceAnalysis.enabled,
    performance,
    expectedDevices,
    criticalInterfaces,
    filters
  });
  const technicalData = buildTechnicalPerformanceViewData({
    assessmentId: record.id,
    enabled: record.scope.performanceAnalysis.enabled,
    performance,
    expectedDevices,
    criticalInterfaces,
    filters
  });
  const dashboard = viewMode === "executive" ? executiveData.dashboard : technicalData.dashboard;
  const deviceOptions = Array.from(new Set(record.performance.metrics.map((metric) => metric.deviceId))).sort();
  const metricOptions = Array.from(new Set(record.performance.metrics.map((metric) => metric.metricType))).sort();
  const sourceOptions = Array.from(new Set(record.performance.metrics.map((metric) => metric.sourceType).filter(Boolean) as string[])).sort();
  const clearFilters = () => setFilters({ severity: "all", metricType: "all", sampleType: "all", timeWindow: "all", showVisibilityGaps: true });
  const selectPriority = (priority: PerformanceTopPriority) => {
    if (priority.point) {
      setSelectedMetric(priority.point);
      return;
    }
    setViewMode("technical");
    setTechnicalView(priority.category === "instability" ? "instability" : priority.category === "resource_pressure" ? "devices" : "interfaces");
    setFilters((current) => ({
      ...current,
      deviceId: priority.affectedTarget.split(" · ")[0] || current.deviceId,
      severity: priority.severity
    }));
  };

  if (!record.scope.performanceAnalysis.enabled) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState icon={<Network size={24} />} title="El analisis de performance no esta incluido en el alcance de este assessment." />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <PerformanceHeader
        assessment={performance.assessment}
        performance={performance}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onProcessPerformance={onProcessPerformance}
        onRunPerformanceAi={onRunPerformanceAi}
        onResetPerformance={onResetPerformance}
      />
      <PerformanceKpiStickyStrip kpis={executiveData.kpiRings} analysisMode={performance.assessment.analysisMode} />
      <PerformanceEmptyStateNotices dashboard={dashboard} performance={performance} />
      {viewMode === "executive" ? (
        <PerformanceExecutiveFilters filters={filters} onChange={setFilters} onClear={clearFilters} />
      ) : (
        <PerformanceTechnicalFilters
          filters={filters}
          deviceOptions={deviceOptions}
          metricOptions={metricOptions}
          sourceOptions={sourceOptions}
          onChange={setFilters}
          onClear={clearFilters}
        />
      )}

      {viewMode === "executive" ? (
        <PerformanceExecutiveCommandCenter
          data={executiveData}
          selectedCategory={filters.healthCategory ?? "all"}
          onSelectCategory={(category) => setFilters((current) => ({ ...current, healthCategory: category }))}
          onSelectPriority={selectPriority}
          onOpenTechnical={() => {
            setViewMode("technical");
            setTechnicalView("overview");
          }}
        />
      ) : (
        <PerformanceTechnicalWorkbench
          data={technicalData}
          activeView={technicalView}
          onActiveViewChange={setTechnicalView}
          onSelectMetric={setSelectedMetric}
          selectedCategory={filters.healthCategory ?? "all"}
          onSelectCategory={(category) => setFilters((current) => ({ ...current, healthCategory: category }))}
        />
      )}

      <PerformanceMetricDrawer metric={selectedMetric} insights={dashboard.insights} onClose={() => setSelectedMetric(null)} />
    </div>
  );
}

function PerformanceHeader({
  assessment,
  performance,
  viewMode,
  onViewModeChange,
  onProcessPerformance,
  onRunPerformanceAi,
  onResetPerformance
}: {
  assessment: PerformanceState["assessment"];
  performance: PerformanceState;
  viewMode: "executive" | "technical";
  onViewModeChange: (mode: "executive" | "technical") => void;
  onProcessPerformance: () => void;
  onRunPerformanceAi: () => void;
  onResetPerformance: () => void;
}) {
  const statusTone = assessment.status === "validated" || assessment.status === "processed" || assessment.status === "ai_reviewed" ? "success" : "warning";
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Performance de la Red</h2>
            <Badge tone={statusTone}>{assessment.status}</Badge>
            <Badge tone="info">{assessment.analysisMode}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Metricas, sintomas de degradacion, capacidad y estabilidad.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onProcessPerformance} disabled={performance.evidenceFiles.length === 0} title="Procesar evidencia de performance">
            <PlayCircle size={14} />
            Procesar
          </Button>
          <Button variant="secondary" size="sm" onClick={onRunPerformanceAi} disabled={performance.findings.length === 0} title="Ejecutar revision AI de performance">
            <Bot size={14} />
            AI
          </Button>
          <Button variant="ghost" size="sm" onClick={onResetPerformance} disabled={performance.evidenceFiles.length === 0 && performance.metrics.length === 0 && performance.findings.length === 0} title="Reiniciar performance">
            <RotateCcw size={14} />
            Reset
          </Button>
          <Button variant="secondary" size="sm" disabled title="Exportacion de graficos pendiente">
            <FileDown size={14} />
            Exportar
          </Button>
          <div className="flex rounded-md border border-border bg-muted/40 p-1">
            {(["executive", "technical"] as const).map((mode) => (
              <button
                key={mode}
                className={cn("h-8 rounded px-3 text-xs font-semibold", viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                onClick={() => onViewModeChange(mode)}
              >
                {mode === "executive" ? "Ejecutiva" : "Tecnica"}
              </button>
            ))}
          </div>
        </div>
      </PanelHeader>
    </Panel>
  );
}

type PerformanceKpiTooltipState = {
  kpi: PerformanceKpiRingData;
  left: number;
  top: number;
};

function PerformanceKpiStickyStrip({ kpis }: { kpis: PerformanceKpiRingData[]; analysisMode: PerformanceAnalysisMode }) {
  const [activeTooltip, setActiveTooltip] = useState<PerformanceKpiTooltipState | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  function showTooltip(kpi: PerformanceKpiRingData, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const stripRect = stripRef.current?.getBoundingClientRect();
    const tooltipWidth = 260;
    const relativeLeft = stripRect ? rect.left - stripRect.left : rect.left;
    const relativeTop = stripRect ? rect.bottom - stripRect.top : rect.bottom;
    const maxLeft = Math.max(12, (stripRect?.width ?? window.innerWidth) - tooltipWidth - 12);
    const left = Math.min(Math.max(relativeLeft + rect.width / 2 - tooltipWidth / 2, 12), maxLeft);
    const top = relativeTop + 8;
    setActiveTooltip({ kpi, left, top });
  }

  return (
    <div ref={stripRef} className="relative sticky top-0 z-20 rounded-md border border-border bg-background/95 p-2 shadow-sm backdrop-blur">
      <div className="grid grid-cols-[repeat(6,minmax(118px,1fr))] gap-2 overflow-x-auto">
        {kpis.map((kpi) => (
          <PerformanceKpiCompactCard
            key={kpi.key}
            kpi={kpi}
            onShowTooltip={showTooltip}
            onHideTooltip={() => setActiveTooltip(null)}
          />
        ))}
      </div>
      {activeTooltip && <PerformanceKpiTooltip tooltip={activeTooltip} />}
    </div>
  );
}

function PerformanceKpiCompactCard({
  kpi,
  onShowTooltip,
  onHideTooltip
}: {
  kpi: PerformanceKpiRingData;
  onShowTooltip: (kpi: PerformanceKpiRingData, element: HTMLElement) => void;
  onHideTooltip: () => void;
}) {
  const color = performanceSeverityCssColor(kpi.severity);
  const tooltip = performanceKpiTooltipText(kpi);
  return (
    <div
      className="grid min-h-14 min-w-0 cursor-help grid-cols-[30px_minmax(0,1fr)] items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left shadow-sm transition-colors hover:border-primary/50"
      aria-label={tooltip}
      tabIndex={0}
      onPointerEnter={(event) => onShowTooltip(kpi, event.currentTarget)}
      onPointerLeave={onHideTooltip}
      onMouseEnter={(event) => onShowTooltip(kpi, event.currentTarget)}
      onMouseLeave={onHideTooltip}
      onFocus={(event) => onShowTooltip(kpi, event.currentTarget)}
      onBlur={onHideTooltip}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/30" style={{ color }}>
        <PerformanceKpiIcon kpiKey={kpi.key} />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1">
          <p className="truncate text-[10px] font-semibold uppercase text-muted-foreground">{kpiCompactLabel(kpi)}</p>
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-border text-[9px] font-bold leading-none text-muted-foreground" aria-hidden="true">
            ?
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
          <p className="truncate text-base font-semibold leading-none text-foreground">{kpiCompactValue(kpi)}</p>
          <span className="truncate text-[10px] font-semibold uppercase text-muted-foreground">{kpiCompactContext(kpi)}</span>
        </div>
      </div>
    </div>
  );
}

function PerformanceKpiTooltip({ tooltip }: { tooltip: PerformanceKpiTooltipState }) {
  const help = performanceKpiHelpContent[tooltip.kpi.key] ?? {
    title: tooltip.kpi.label,
    description: tooltip.kpi.helper,
    interpretation: "Revise este KPI junto con la evidencia relacionada."
  };
  return (
    <div
      className="pointer-events-none absolute z-50 w-[260px] rounded-md border border-border bg-[hsl(var(--surface-raised))] px-3 py-2 text-left text-foreground shadow-xl ring-1 ring-black/10 dark:ring-white/10"
      style={{ left: tooltip.left, top: tooltip.top }}
      role="tooltip"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-foreground">{help.title}</p>
        <span className="shrink-0 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {kpiCompactValue(tooltip.kpi)} {kpiCompactContext(tooltip.kpi)}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{help.description}</p>
    </div>
  );
}

function PerformanceKpiIcon({ kpiKey }: { kpiKey: string }) {
  if (kpiKey === "risk") return <AlertTriangle size={16} />;
  if (kpiKey === "confidence") return <ShieldCheck size={16} />;
  if (kpiKey === "device-coverage") return <Network size={16} />;
  if (kpiKey === "historical-depth") return <GitBranch size={16} />;
  if (kpiKey === "alert-interfaces") return <AlertTriangle size={16} />;
  if (kpiKey === "validated") return <ClipboardList size={16} />;
  return <Server size={16} />;
}

function kpiCompactLabel(kpi: PerformanceKpiRingData) {
  const labels: Record<string, string> = {
    risk: "Risk",
    confidence: "Confidence",
    "device-coverage": "Device",
    "historical-depth": "Historical",
    "alert-interfaces": "Alert IFs",
    validated: "Validated"
  };
  return labels[kpi.key] ?? kpi.label;
}

function kpiCompactValue(kpi: PerformanceKpiRingData) {
  if (kpi.key === "risk") return String(kpi.value);
  return kpi.displayValue;
}

function kpiCompactContext(kpi: PerformanceKpiRingData) {
  if (kpi.key === "risk") return kpi.severity === "critical" ? "critico" : kpi.severity;
  if (kpi.key === "alert-interfaces") return "interfaces";
  if (kpi.key === "validated") return "hallazgos";
  return kpi.max === 100 ? "score" : `max ${kpi.max}`;
}

const performanceKpiHelpContent: Record<string, { title: string; description: string; interpretation: string }> = {
  risk: {
    title: "Risk Score",
    description: "Riesgo agregado por saturacion, errores, drops, recursos e inestabilidad.",
    interpretation: "Mientras mas alto sea el valor, mayor es la probabilidad de degradacion o impacto operativo."
  },
  confidence: {
    title: "Confidence",
    description: "Confianza del analisis segun cobertura, trazabilidad y profundidad de la evidencia.",
    interpretation: "Un score bajo indica que se necesita mas evidencia antes de tomar conclusiones firmes."
  },
  "device-coverage": {
    title: "Device Coverage",
    description: "Equipos del alcance con al menos una metrica de performance reconocida.",
    interpretation: "Ayuda a saber si el assessment representa la red completa o solo una parte del inventario."
  },
  "historical-depth": {
    title: "Historical Depth",
    description: "Evidencia historica disponible para analizar tendencias y recurrencia.",
    interpretation: "0% indica que la data es principalmente puntual o snapshot, por lo que no confirma tendencias."
  },
  "alert-interfaces": {
    title: "Alert IFs",
    description: "Interfaces con metricas en warning, high o critical.",
    interpretation: "Sirve para ubicar rapidamente donde hay senales de congestion o degradacion."
  },
  validated: {
    title: "Validated Findings",
    description: "Hallazgos de performance confirmados por el arquitecto.",
    interpretation: "Diferencia observaciones preliminares de hallazgos listos para reporte o plan de accion."
  }
};

function performanceKpiTooltipText(kpi: PerformanceKpiRingData) {
  const help = performanceKpiHelpContent[kpi.key] ?? {
    title: kpi.label,
    description: kpi.helper,
    interpretation: "Revise este KPI junto con la evidencia y los hallazgos relacionados."
  };
  const currentValue = `${kpiCompactValue(kpi)} ${kpiCompactContext(kpi)}`.trim();
  return [
    help.title,
    help.description,
    `Valor actual: ${currentValue}.`
  ].join("\n");
}

function PerformanceEmptyStateNotices({ dashboard, performance }: { dashboard: ReturnType<typeof buildPerformanceDashboardData>; performance: PerformanceState }) {
  return (
    <div className="space-y-2">
      {dashboard.emptyState === "no_evidence" && (
        <Panel><PanelBody><EmptyState icon={<FileArchive size={24} />} title="No se ha cargado evidencia de performance. Cargue salidas CLI, exports NMS o archivos historicos para generar visualizaciones." /></PanelBody></Panel>
      )}
      {dashboard.emptyState === "no_metrics" && (
        <Panel><PanelBody><EmptyState icon={<Network size={24} />} title="La evidencia cargada no contiene metricas reconocidas por el parser de performance." /></PanelBody></Panel>
      )}
      {dashboard.emptyState === "filtered_empty" && (
        <Panel><PanelBody><EmptyState icon={<Search size={24} />} title="No hay metricas que coincidan con los filtros actuales. Limpia filtros o amplia el criterio de busqueda." /></PanelBody></Panel>
      )}
      {dashboard.hasSnapshotOnly && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
          El analisis actual se basa en evidencia puntual. No permite confirmar tendencias historicas de saturacion o crecimiento.
        </div>
      )}
      {performance.assessment.confidenceScore < 60 && (
        <div className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-500/40 dark:bg-sky-950/30 dark:text-sky-100">
          La cobertura de datos es limitada. Los resultados deben considerarse preliminares y la ausencia de evidencia reduce la confianza.
        </div>
      )}
    </div>
  );
}

function PerformanceExecutiveFilters({
  filters,
  onChange,
  onClear
}: {
  filters: PerformanceDashboardFilters;
  onChange: (filters: PerformanceDashboardFilters) => void;
  onClear: () => void;
}) {
  return (
    <Panel>
      <PanelBody className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-44 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Severidad</p>
          <select className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm" value={filters.severity ?? "all"} onChange={(event) => onChange({ ...filters, severity: event.target.value as PerformanceDashboardFilters["severity"] })}>
            <option value="all">Todas</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="warning">Warning</option>
            <option value="normal">Normal</option>
          </select>
          </div>
          <div className="min-w-48 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">Categoria</p>
          <select className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm" value={filters.healthCategory ?? "all"} onChange={(event) => onChange({ ...filters, healthCategory: event.target.value as PerformanceDashboardFilters["healthCategory"] })}>
            <option value="all">Todas</option>
            {(["utilization", "errors", "drops", "cpu", "memory", "instability", "qos"] as PerformanceHealthCategory[]).map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          </div>
          <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/20 px-3 text-sm text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={filters.showVisibilityGaps !== false} onChange={(event) => onChange({ ...filters, showVisibilityGaps: event.target.checked })} />
            Brechas de visibilidad
          </label>
          <Button variant="secondary" size="sm" className="h-9 px-3" onClick={onClear}>
            <X size={14} />
            Limpiar
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

function PerformanceTechnicalFilters({
  filters,
  deviceOptions,
  metricOptions,
  sourceOptions,
  onChange,
  onClear
}: {
  filters: PerformanceDashboardFilters;
  deviceOptions: string[];
  metricOptions: string[];
  sourceOptions: string[];
  onChange: (filters: PerformanceDashboardFilters) => void;
  onClear: () => void;
}) {
  return (
    <div className="sticky top-[58px] z-10">
      <PerformanceFilterBar filters={filters} deviceOptions={deviceOptions} metricOptions={metricOptions} sourceOptions={sourceOptions} onChange={onChange} onClear={onClear} />
    </div>
  );
}

function PerformanceExecutiveCommandCenter({
  data,
  selectedCategory,
  onSelectCategory,
  onSelectPriority,
  onOpenTechnical
}: {
  data: PerformanceExecutiveViewData;
  selectedCategory: PerformanceHealthCategory | "all";
  onSelectCategory: (category: PerformanceHealthCategory | "all") => void;
  onSelectPriority: (priority: PerformanceTopPriority) => void;
  onOpenTechnical: () => void;
}) {
  const dashboard = data.dashboard;
  return (
    <div className="space-y-4">
      <PerformanceExecutiveNarrativeCard data={data} />
      <PerformanceTopPriorities priorities={data.topPriorities} onSelect={onSelectPriority} />
      <PerformanceExecutiveHeatmap data={data.executiveHeatmap} selectedCategory={selectedCategory} onSelectCategory={onSelectCategory} onOpenTechnical={onOpenTechnical} />
      <PerformanceProcessingFunnel stages={data.processingFunnel} />
      <div className="grid gap-4 xl:grid-cols-3">
        <PerformanceDistributionPanel title="Severidad" data={data.severityDistribution} />
        <PerformanceDistributionPanel title="Fuente de evidencia" data={data.sourceDistribution} />
        <PerformanceDistributionPanel title="Tipo de problema" data={data.categoryBreakdown} />
      </div>
      <PerformanceExecutiveActionSummary priorities={data.topPriorities} insightCount={dashboard.insights.length} onSelect={onSelectPriority} />
    </div>
  );
}

function PerformanceExecutiveNarrativeCard({ data }: { data: PerformanceExecutiveViewData }) {
  const narrative = data.narrative;
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Resumen interpretativo</h2>
          <p className="text-xs text-muted-foreground">Lectura ejecutiva basada en evidencia disponible, cobertura y limitaciones de confianza.</p>
        </div>
        <Badge tone={data.dashboard.dataCoverage.confidenceScore >= 70 ? "success" : data.dashboard.dataCoverage.confidenceScore >= 45 ? "warning" : "danger"}>
          {data.dashboard.dataCoverage.confidenceScore}% confianza
        </Badge>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-md border border-rose-400/40 bg-rose-500/10 p-4">
            <p className="text-[11px] font-semibold uppercase text-rose-200">Lectura principal</p>
            <p className="mt-2 text-base font-semibold leading-snug text-foreground">{narrative.status}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Requiere validacion tecnica priorizada antes de convertir sintomas en hallazgos finales.</p>
          </div>
          <div className="rounded-md border border-primary/30 bg-primary/10 p-4">
            <p className="text-[11px] font-semibold uppercase text-primary">Accion recomendada</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">{narrative.recommendedAction}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <ExecutiveBriefTile title="Causa dominante" value={narrative.primaryCause} />
          <ExecutiveBriefTile title="Confianza" value={narrative.confidence} />
          <ExecutiveBriefTile title="Alcance afectado" value={narrative.affectedArea} />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <ExecutiveCoverageTile label="Device Coverage" value={`${data.dashboard.dataCoverage.deviceCoverageScore}%`} helper={`${data.dashboard.dataCoverage.withData} con data · ${data.dashboard.dataCoverage.withoutData} sin data`} severity={data.dashboard.dataCoverage.deviceCoverageScore >= 70 ? "normal" : "high"} />
          <ExecutiveCoverageTile label="Historical Depth" value={`${data.dashboard.dataCoverage.historicalCoverageScore}%`} helper={`${data.dashboard.dataCoverage.historicalAvailable} historico · ${data.dashboard.dataCoverage.snapshotOnly} solo snapshot`} severity={data.dashboard.dataCoverage.historicalCoverageScore >= 30 ? "warning" : "high"} />
          <ExecutiveCoverageTile label="Data Traceability" value={`${data.dashboard.dataCoverage.traceabilityScore}%`} helper={`${data.dashboard.dataCoverage.unknownSourceMetrics} sourceType unknown`} severity={data.dashboard.dataCoverage.traceabilityScore >= 70 ? "normal" : "high"} />
        </div>

        {(narrative.limitation || narrative.visibilityGap || narrative.traceabilityGap) && (
          <div className="grid gap-2">
            {narrative.limitation && <ExecutiveNotice tone="warning" title="Limitacion historica" text={narrative.limitation} />}
            {narrative.visibilityGap && <ExecutiveNotice tone="info" title="Brecha de visibilidad" text={narrative.visibilityGap} />}
            {narrative.traceabilityGap && <ExecutiveNotice tone="danger" title="Brecha de trazabilidad" text={narrative.traceabilityGap} />}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function ExecutiveBriefTile({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-3">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

function ExecutiveNotice({ tone, title, text }: { tone: "info" | "warning" | "danger"; title: string; text: string }) {
  const classes = {
    info: "border-sky-400/40 bg-sky-500/10 text-sky-100",
    warning: "border-amber-400/40 bg-amber-500/10 text-amber-100",
    danger: "border-rose-400/40 bg-rose-500/10 text-rose-100"
  }[tone];
  return (
    <div className={cn("rounded-md border px-3 py-2", classes)}>
      <p className="text-[11px] font-semibold uppercase opacity-80">{title}</p>
      <p className="mt-1 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function ExecutiveCoverageTile({ label, value, helper, severity }: { label: string; value: string; helper: string; severity: PerformanceSeverity }) {
  return (
    <div className={cn("rounded-md border border-border bg-card px-3 py-2", performanceSeveritySubtleBg(severity))}>
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}

function PerformanceTopPriorities({ priorities, onSelect }: { priorities: PerformanceTopPriority[]; onSelect: (priority: PerformanceTopPriority) => void }) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Top 5 prioridades</h2>
          <p className="text-xs text-muted-foreground">Agrupadas por patron de problema, activo y accion recomendada.</p>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-2">
        {priorities.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={22} />} title="Sin prioridades con la evidencia actual" />
        ) : priorities.map((priority) => (
          <button
            key={priority.id}
            className="group relative w-full overflow-hidden rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-muted/20"
            onClick={() => onSelect(priority)}
          >
            <span className={cn("absolute inset-y-0 left-0 w-1", performanceSeverityBar(priority.severity))} />
            <div className="grid gap-3 pl-2 lg:grid-cols-[minmax(240px,1.25fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">#{priority.rank}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{performanceInsightLabel(priority.category)}</span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm font-semibold leading-snug text-foreground">{priority.title}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <PriorityInlineMetric label="Activo" value={priority.affectedDevices.length || priority.affectedTarget} />
                <PriorityInlineMetric label="IFs" value={priority.affectedInterfaces.length} />
                <PriorityInlineMetric label="Metricas" value={priority.affectedMetricCount} />
              </div>

              <div className="min-w-0 space-y-1 text-xs leading-snug">
                <p className="line-clamp-1 text-foreground">
                  <span className="font-semibold text-muted-foreground">Impacto: </span>
                  {priority.impact}
                </p>
                <p className="line-clamp-1 text-muted-foreground">
                  <span className="font-semibold">Accion: </span>
                  {priority.recommendation}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1 lg:justify-end">
                <Badge tone={performanceSeverityTone(priority.severity)}>{priority.severity}</Badge>
                <Badge tone={priority.sourceType === "architect_validated" ? "success" : priority.sourceType === "ai_suggested" ? "info" : "neutral"}>{priority.confidence}%</Badge>
              </div>
            </div>
          </button>
        ))}
      </PanelBody>
    </Panel>
  );
}

function PriorityInlineMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/80 bg-muted/10 px-2 py-1">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function PriorityTextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/15 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

function PerformanceExecutiveHeatmap({
  data,
  selectedCategory,
  onSelectCategory,
  onOpenTechnical
}: {
  data: PerformanceExecutiveHeatmapData;
  selectedCategory: PerformanceHealthCategory | "all";
  onSelectCategory: (category: PerformanceHealthCategory | "all") => void;
  onOpenTechnical: () => void;
}) {
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Heatmap ejecutivo de riesgo</h2>
          <p className="text-xs text-muted-foreground">Top dispositivos por riesgo agregado. La vista tecnica muestra el heatmap completo.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onOpenTechnical}>Ver todo en vista tecnica</Button>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {data.devices.length === 0 ? (
          <EmptyState icon={<Network size={22} />} title="Sin dispositivos con metricas de performance" />
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <div className="grid min-w-[820px] gap-1" style={{ gridTemplateColumns: `180px repeat(${data.categories.length}, minmax(86px, 1fr))` }}>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground">Dispositivo</div>
                {data.categories.map((category) => (
                  <button key={category} className={cn("rounded-md border border-border bg-muted/50 px-2 py-2 text-[11px] font-semibold uppercase text-muted-foreground", selectedCategory === category && "border-primary text-primary")} onClick={() => onSelectCategory(category)}>
                    {performanceHealthCategoryLabel(category)}
                  </button>
                ))}
                {data.devices.map((device) => (
                  <React.Fragment key={device}>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-semibold">{device}</div>
                    {data.categories.map((category) => {
                      const cell = data.cells.find((item) => item.deviceId === device && item.category === category);
                      return (
                        <button key={`${device}:${category}`} className={cn("h-10 rounded-md border text-xs font-semibold hover:border-primary/60", performanceSeverityHeatmap(cell?.severity ?? "normal"))} title={`${device} ${performanceHealthCategoryLabel(category)}: ${cell?.metrics.length ?? 0} metrica(s)`} onClick={() => onSelectCategory(category)}>
                          {cell?.metrics.length ?? 0}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Mostrando {data.devices.length} de {data.totalDevices} dispositivos.</span>
              <span>Leyenda:</span>
              <Badge tone="success">normal</Badge>
              <Badge tone="info">warning</Badge>
              <Badge tone="warning">high</Badge>
              <Badge tone="danger">critical</Badge>
            </div>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}

function PerformanceProcessingFunnel({ stages }: { stages: PerformanceProcessingFunnelStage[] }) {
  const max = Math.max(1, ...stages.map((stage) => stage.value));
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Funnel de procesamiento</h2>
          <p className="text-xs text-muted-foreground">Explica cobertura, confianza y conversion desde evidencia hasta hallazgos.</p>
        </div>
      </PanelHeader>
      <PanelBody>
        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
          {stages.map((stage) => (
            <div key={stage.key} className="rounded-md border border-border bg-card p-3" title={stage.helper}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">{stage.label}</p>
                <Badge tone={performanceSeverityTone(stage.severity)}>{stage.value}</Badge>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", performanceSeverityBar(stage.severity))} style={{ width: `${Math.max(8, (stage.value / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}

function PerformanceDistributionPanel({ title, data }: { title: string; data: PerformanceDistributionDatum[] }) {
  const total = Math.max(1, data.reduce((sum, item) => sum + item.value, 0));
  return (
    <Panel>
      <PanelHeader>
        <h2 className="text-sm font-semibold">{title}</h2>
      </PanelHeader>
      <PanelBody className="space-y-2">
        {data.filter((item) => item.value > 0).length === 0 ? (
          <EmptyState icon={<Network size={22} />} title="Sin datos para distribuir" />
        ) : data.filter((item) => item.value > 0).slice(0, 6).map((item, index) => (
          <div key={item.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">{item.label}</span>
              <span className="font-semibold">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", item.severity ? performanceSeverityBar(item.severity) : stackedBarColor(index))} style={{ width: `${(item.value / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

function PerformanceExecutiveActionSummary({
  priorities,
  insightCount,
  onSelect
}: {
  priorities: PerformanceTopPriority[];
  insightCount: number;
  onSelect: (priority: PerformanceTopPriority) => void;
}) {
  const visiblePriorities = priorities.slice(0, 4);
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Plan de accion inmediato</h2>
          <p className="text-xs text-muted-foreground">Acciones ejecutables con problema, activo, impacto y siguiente paso.</p>
        </div>
        <Badge tone="info">{insightCount} insights trazables</Badge>
      </PanelHeader>
      <PanelBody>
        {visiblePriorities.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={22} />} title="Sin acciones prioritarias con la evidencia actual" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visiblePriorities.map((priority) => (
              <button
                key={priority.id}
                className="group relative overflow-hidden rounded-md border border-border bg-card p-2.5 text-left hover:border-primary/60 hover:bg-muted/20"
                onClick={() => onSelect(priority)}
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", performanceSeverityBar(priority.severity))} />
                <div className="pl-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">#{priority.rank}</span>
                        <span className="text-xs font-semibold uppercase text-muted-foreground">{performanceInsightLabel(priority.category)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">{priority.title}</p>
                    </div>
                    <Badge tone={performanceSeverityTone(priority.severity)}>{priority.severity}</Badge>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <MetricMini label="Activo" value={priority.affectedDevices.length || priority.affectedTarget} />
                    <MetricMini label="Interfaces" value={priority.affectedInterfaces.length} />
                    <MetricMini label="Metricas" value={priority.affectedMetricCount} />
                  </div>

                  <div className="mt-2 grid gap-2">
                    <PriorityTextBlock label="Impacto" text={priority.impact} />
                    <PriorityTextBlock label="Accion" text={priority.recommendation} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function PerformanceTechnicalWorkbench({
  data,
  activeView,
  onActiveViewChange,
  onSelectMetric,
  selectedCategory,
  onSelectCategory
}: {
  data: PerformanceTechnicalViewData;
  activeView: "overview" | "interfaces" | "devices" | "instability" | "historical" | "evidence" | "insights";
  onActiveViewChange: (view: "overview" | "interfaces" | "devices" | "instability" | "historical" | "evidence" | "insights") => void;
  onSelectMetric: (point: PerformanceChartPoint) => void;
  selectedCategory: PerformanceHealthCategory | "all";
  onSelectCategory: (category: PerformanceHealthCategory | "all") => void;
}) {
  const dashboard = data.dashboard;
  return (
    <div className="space-y-4">
      <PerformanceTechnicalNavigation activeView={activeView} onChange={onActiveViewChange} hasHistoricalData={dashboard.hasHistoricalData} />
      {activeView === "overview" && (
        <PerformanceTechnicalOverview
          dashboard={dashboard}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          onSelectMetric={onSelectMetric}
          onNavigate={onActiveViewChange}
        />
      )}
      {activeView === "interfaces" && (
        <div className="space-y-4">
          <PerformanceHealthHeatmap data={dashboard.heatmapData} selectedCategory={selectedCategory} onSelectCategory={onSelectCategory} />
          <div className="grid gap-4 xl:grid-cols-2">
            <TopUtilizationInterfacesChart data={dashboard.topUtilizationInterfaces} onSelect={onSelectMetric} />
            <ErrorsDropsStackedChart title="Errores / drops por interface" data={[...dashboard.topErrorInterfaces, ...dashboard.topDropInterfaces]} onSelect={onSelectMetric} />
          </div>
          <CriticalMetricsTable rows={dashboard.criticalMetricsTable.filter((row) => row.interfaceId)} onSelect={onSelectMetric} />
        </div>
      )}
      {activeView === "devices" && (
        <div className="space-y-4">
          <DeviceResourcePressureChart data={dashboard.deviceResourcePressure} onSelect={onSelectMetric} />
          <CriticalMetricsTable rows={dashboard.criticalMetricsTable.filter((row) => !row.interfaceId || row.metrics.some((metric) => metric.metricType === "cpu" || metric.metricType === "memory"))} onSelect={onSelectMetric} />
        </div>
      )}
      {activeView === "instability" && <InstabilityEventsChart data={dashboard.instabilityEvents} onSelect={onSelectMetric} />}
      {activeView === "historical" && <PerformanceTrendChart dashboard={dashboard} onSelect={onSelectMetric} />}
      {activeView === "evidence" && <PerformanceEvidenceCoveragePanel data={data.evidenceCoverage} />}
      {activeView === "insights" && <PerformanceInsightPanel insights={dashboard.insights} />}
    </div>
  );
}

function PerformanceTechnicalOverview({
  dashboard,
  selectedCategory,
  onSelectCategory,
  onSelectMetric,
  onNavigate
}: {
  dashboard: ReturnType<typeof buildPerformanceDashboardData>;
  selectedCategory: PerformanceHealthCategory | "all";
  onSelectCategory: (category: PerformanceHealthCategory | "all") => void;
  onSelectMetric: (point: PerformanceChartPoint) => void;
  onNavigate: (view: "overview" | "interfaces" | "devices" | "instability" | "historical" | "evidence" | "insights") => void;
}) {
  return (
    <div className="space-y-4">
      <TechnicalSummaryStrip dashboard={dashboard} />
      <TechnicalSignalCards dashboard={dashboard} onNavigate={onNavigate} />
      <PerformanceExecutiveHeatmap
        data={buildOverviewHeatmapData(dashboard)}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        onOpenTechnical={() => onNavigate("interfaces")}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <TechnicalTopMetricPanel title="Top utilizacion" data={dashboard.topUtilizationInterfaces.slice(0, 5)} onSelect={onSelectMetric} targetView="Interfaces" onNavigate={() => onNavigate("interfaces")} />
        <TechnicalTopMetricPanel title="Top errores/drops" data={[...dashboard.topErrorInterfaces, ...dashboard.topDropInterfaces].slice(0, 5)} onSelect={onSelectMetric} targetView="Interfaces" onNavigate={() => onNavigate("interfaces")} />
        <TechnicalTopMetricPanel title="Top CPU/memoria" data={dashboard.deviceResourcePressure.slice(0, 5)} onSelect={onSelectMetric} targetView="Dispositivos" onNavigate={() => onNavigate("devices")} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <TechnicalEvidenceQuality dashboard={dashboard} onNavigate={() => onNavigate("evidence")} />
        <TechnicalQuickNavigation dashboard={dashboard} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function TechnicalSummaryStrip({ dashboard }: { dashboard: ReturnType<typeof buildPerformanceDashboardData> }) {
  const affectedDevices = new Set(dashboard.criticalMetricsTable.map((metric) => metric.deviceId)).size;
  const alertInterfaces = new Set(dashboard.criticalMetricsTable.filter((metric) => metric.interfaceId).map((metric) => `${metric.deviceId}:${metric.interfaceId}`)).size;
  const items = [
    { label: "Metricas", value: dashboard.filteredMetrics.length, helper: "normalizadas", severity: "normal" as PerformanceSeverity },
    { label: "Interfaces alerta", value: alertInterfaces, helper: "warning/high/critical", severity: alertInterfaces > 0 ? "high" as PerformanceSeverity : "normal" as PerformanceSeverity },
    { label: "Dispositivos afectados", value: affectedDevices, helper: "con sintomas", severity: affectedDevices > 0 ? "warning" as PerformanceSeverity : "normal" as PerformanceSeverity },
    { label: "Historico", value: `${dashboard.dataCoverage.historicalCoverageScore}%`, helper: `${dashboard.dataCoverage.historicalAvailable} dispositivos`, severity: dashboard.dataCoverage.historicalCoverageScore >= 30 ? "warning" as PerformanceSeverity : "high" as PerformanceSeverity },
    { label: "Trazabilidad", value: `${dashboard.dataCoverage.traceabilityScore}%`, helper: `${dashboard.dataCoverage.unknownSourceMetrics} source unknown`, severity: dashboard.dataCoverage.traceabilityScore >= 70 ? "normal" as PerformanceSeverity : "high" as PerformanceSeverity }
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className={cn("rounded-md border border-border bg-card p-3", performanceSeveritySubtleBg(item.severity))}>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold leading-none">{item.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
        </div>
      ))}
    </div>
  );
}

function TechnicalSignalCards({
  dashboard,
  onNavigate
}: {
  dashboard: ReturnType<typeof buildPerformanceDashboardData>;
  onNavigate: (view: "overview" | "interfaces" | "devices" | "instability" | "historical" | "evidence" | "insights") => void;
}) {
  const signals = buildTechnicalSignalSummaries(dashboard);
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Senales tecnicas principales</h2>
          <p className="text-xs text-muted-foreground">Resumen por patron. El detalle completo vive en los tabs especializados.</p>
        </div>
      </PanelHeader>
      <PanelBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {signals.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={22} />} title="Sin senales tecnicas con la evidencia actual" />
        ) : signals.map((signal) => (
          <button
            key={signal.id}
            className="group relative overflow-hidden rounded-md border border-border bg-card p-2.5 text-left hover:border-primary/60 hover:bg-muted/20"
            onClick={() => onNavigate(signal.targetView)}
          >
            <span className={cn("absolute inset-y-0 left-0 w-1", performanceSeverityBar(signal.severity))} />
            <div className="pl-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/25 text-muted-foreground">
                    <TechnicalSignalIcon category={signal.id} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{signal.title}</p>
                    <p className="mt-0.5 text-[11px] font-medium uppercase text-muted-foreground">{signal.targetView}</p>
                  </div>
                </div>
                <Badge tone={performanceSeverityTone(signal.severity)}>{signal.severity}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <MetricMini label="Disp." value={signal.devices} />
                <MetricMini label="IFs" value={signal.interfaces} />
                <MetricMini label="Metricas" value={signal.metrics} />
              </div>
              <div className="mt-2 rounded-md border border-border bg-muted/15 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Siguiente validacion</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground">{signal.action}</p>
              </div>
            </div>
          </button>
        ))}
      </PanelBody>
    </Panel>
  );
}

function TechnicalSignalIcon({ category }: { category: string }) {
  if (category === "utilization") return <ArrowUp size={15} />;
  if (category === "errors") return <AlertTriangle size={15} />;
  if (category === "drops") return <ArrowDown size={15} />;
  if (category === "cpu" || category === "memory") return <Server size={15} />;
  if (category === "instability") return <GitBranch size={15} />;
  return <Network size={15} />;
}

function MetricMini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-border bg-muted/20 px-2 py-1">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function TechnicalTopMetricPanel({
  title,
  data,
  onSelect,
  targetView,
  onNavigate
}: {
  title: string;
  data: PerformanceChartPoint[];
  onSelect: (point: PerformanceChartPoint) => void;
  targetView: string;
  onNavigate: () => void;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));
  return (
    <Panel>
      <PanelHeader className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">Top 5 para triage rapido.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onNavigate}>Ver {targetView}</Button>
      </PanelHeader>
      <PanelBody className="space-y-2">
        {data.length === 0 ? (
          <EmptyState icon={<Network size={22} />} title="Sin metricas para resumir" />
        ) : data.map((point) => (
          <button key={point.id} className="w-full rounded-md border border-border bg-card px-3 py-2 text-left hover:border-primary/60" onClick={() => onSelect(point)}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold">{point.label}</span>
              <Badge tone={performanceSeverityTone(point.severity)}>{point.value}{point.unit}</Badge>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", performanceSeverityBar(point.severity))} style={{ width: `${Math.max(4, Math.min(100, (point.value / max) * 100))}%` }} />
            </div>
          </button>
        ))}
      </PanelBody>
    </Panel>
  );
}

function TechnicalEvidenceQuality({ dashboard, onNavigate }: { dashboard: ReturnType<typeof buildPerformanceDashboardData>; onNavigate: () => void }) {
  return (
    <Panel>
      <PanelHeader className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Calidad de evidencia</h2>
          <p className="text-xs text-muted-foreground">Confianza, trazabilidad y profundidad temporal.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onNavigate}>Ver evidencia</Button>
      </PanelHeader>
      <PanelBody className="grid gap-2 sm:grid-cols-2">
        <CoverageLine label="SourceType unknown" value={dashboard.dataCoverage.unknownSourceMetrics} tone={dashboard.dataCoverage.unknownSourceMetrics > 0 ? "warning" : "success"} />
        <CoverageLine label="Sin comando origen" value={dashboard.dataCoverage.metricsWithoutCommand} tone={dashboard.dataCoverage.metricsWithoutCommand > 0 ? "warning" : "success"} />
        <CoverageLine label="Solo snapshot" value={dashboard.dataCoverage.snapshotOnly} tone="warning" />
        <CoverageLine label="Historico disponible" value={dashboard.dataCoverage.historicalAvailable} tone={dashboard.hasHistoricalData ? "success" : "neutral"} />
      </PanelBody>
    </Panel>
  );
}

function TechnicalQuickNavigation({
  dashboard,
  onNavigate
}: {
  dashboard: ReturnType<typeof buildPerformanceDashboardData>;
  onNavigate: (view: "overview" | "interfaces" | "devices" | "instability" | "historical" | "evidence" | "insights") => void;
}) {
  const links = [
    { id: "interfaces", label: "Interfaces", helper: `${dashboard.topUtilizationInterfaces.length + dashboard.topErrorInterfaces.length + dashboard.topDropInterfaces.length} senales`, view: "interfaces" as const },
    { id: "devices", label: "Dispositivos", helper: `${dashboard.deviceResourcePressure.length} con CPU/memoria`, view: "devices" as const },
    { id: "instability", label: "Inestabilidad", helper: `${dashboard.instabilityEvents.length} eventos`, view: "instability" as const },
    { id: "historical", label: "Historico", helper: dashboard.hasHistoricalData ? "series disponibles" : "sin historico", view: "historical" as const },
    { id: "evidence", label: "Evidencia", helper: `${dashboard.filteredMetrics.length} metricas`, view: "evidence" as const },
    { id: "insights", label: "Insights", helper: `${dashboard.insights.length} trazables`, view: "insights" as const }
  ];
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Ir al detalle</h2>
          <p className="text-xs text-muted-foreground">Accesos rapidos a las vistas especializadas.</p>
        </div>
      </PanelHeader>
      <PanelBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => (
          <button key={link.id} className="rounded-md border border-border bg-card p-3 text-left hover:border-primary/60 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50" disabled={link.view === "historical" && !dashboard.hasHistoricalData} onClick={() => onNavigate(link.view)}>
            <p className="text-sm font-semibold">{link.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{link.helper}</p>
          </button>
        ))}
      </PanelBody>
    </Panel>
  );
}

function PerformanceTechnicalNavigation({
  activeView,
  onChange,
  hasHistoricalData
}: {
  activeView: "overview" | "interfaces" | "devices" | "instability" | "historical" | "evidence" | "insights";
  onChange: (view: "overview" | "interfaces" | "devices" | "instability" | "historical" | "evidence" | "insights") => void;
  hasHistoricalData: boolean;
}) {
  const items = [
    { id: "overview", label: "Overview" },
    { id: "interfaces", label: "Interfaces" },
    { id: "devices", label: "Dispositivos" },
    { id: "instability", label: "Inestabilidad" },
    { id: "historical", label: "Historico", disabled: !hasHistoricalData },
    { id: "evidence", label: "Evidencia" },
    { id: "insights", label: "Insights" }
  ] as const;
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-muted/20 p-1">
      <div className="flex min-w-max gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            disabled={"disabled" in item ? item.disabled : false}
            className={cn("h-9 rounded px-3 text-sm font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-45", activeView === item.id && "bg-primary text-primary-foreground")}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PerformanceEvidenceCoveragePanel({ data }: { data: PerformanceDistributionDatum[] }) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Cobertura tecnica de evidencia</h2>
          <p className="text-xs text-muted-foreground">Archivos fuente y metricas extraidas por archivo.</p>
        </div>
      </PanelHeader>
      <PanelBody>
        {data.length === 0 ? (
          <EmptyState icon={<FileArchive size={22} />} title="Sin archivos de performance cargados" />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Archivo</th>
                  <th className="px-3 py-2">Metricas</th>
                  <th className="px-3 py-2">Estado visual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((item) => (
                  <tr key={item.key}>
                    <td className="px-3 py-2 font-medium">{item.label}</td>
                    <td className="px-3 py-2">{item.value}</td>
                    <td className="px-3 py-2"><Badge tone={performanceSeverityTone(item.severity ?? "normal")}>{item.severity ?? "normal"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function PerformanceRiskOverviewCards({ cards }: { cards: ReturnType<typeof buildPerformanceDashboardData>["summaryCards"] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className={cn("flex min-h-[150px] flex-col rounded-md border bg-card p-4 shadow-sm", performanceSeverityBorder(card.severity))}>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="max-w-full text-xs font-semibold uppercase leading-snug text-muted-foreground">{card.label}</p>
              <p className="mt-2 break-words text-3xl font-semibold leading-tight text-foreground">{card.value}</p>
            </div>
            <Badge
              tone={performanceSeverityTone(card.severity)}
              className="h-auto max-w-36 whitespace-normal px-2 py-1 text-left text-[11px] font-semibold leading-tight"
            >
              {card.level}
            </Badge>
          </div>
          <p className="mt-3 min-w-0 text-xs leading-snug text-muted-foreground">{card.description}</p>
          <p className="mt-auto pt-2 text-xs font-medium leading-snug text-muted-foreground">
            {card.trend === "unavailable" ? "Trend no disponible" : card.trend ? `Trend ${card.trend}` : "Snapshot actual"}
          </p>
        </div>
      ))}
    </div>
  );
}

function PerformanceFilterBar({
  filters,
  deviceOptions,
  metricOptions,
  sourceOptions,
  onChange,
  onClear
}: {
  filters: PerformanceDashboardFilters;
  deviceOptions: string[];
  metricOptions: string[];
  sourceOptions: string[];
  onChange: (filters: PerformanceDashboardFilters) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Field label="Buscar">
          <Input value={filters.query ?? ""} placeholder="hostname o interface" onChange={(event) => onChange({ ...filters, query: event.target.value })} />
        </Field>
        <Field label="Severidad">
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filters.severity ?? "all"} onChange={(event) => onChange({ ...filters, severity: event.target.value as PerformanceDashboardFilters["severity"] })}>
            <option value="all">Todas</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="warning">Warning</option>
            <option value="normal">Normal</option>
          </select>
        </Field>
        <Field label="Equipo">
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filters.deviceId ?? ""} onChange={(event) => onChange({ ...filters, deviceId: event.target.value })}>
            <option value="">Todos</option>
            {deviceOptions.map((device) => <option key={device} value={device}>{device}</option>)}
          </select>
        </Field>
        <Field label="Metrica">
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filters.metricType ?? "all"} onChange={(event) => onChange({ ...filters, metricType: event.target.value as PerformanceDashboardFilters["metricType"] })}>
            <option value="all">Todas</option>
            {metricOptions.map((metric) => <option key={metric} value={metric}>{metric.replace(/_/g, " ")}</option>)}
          </select>
        </Field>
        <Field label="Fuente">
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filters.sourceType ?? ""} onChange={(event) => onChange({ ...filters, sourceType: event.target.value })}>
            <option value="">Todas</option>
            {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
          </select>
        </Field>
        <Field label="Muestra">
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={filters.sampleType ?? "all"} onChange={(event) => onChange({ ...filters, sampleType: event.target.value as PerformanceDashboardFilters["sampleType"] })}>
            <option value="all">Todas</option>
            <option value="snapshot">Snapshot</option>
            <option value="historical">Historico</option>
          </select>
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={Boolean(filters.onlyCritical)} onChange={(event) => onChange({ ...filters, onlyCritical: event.target.checked })} />
          Solo criticos/high
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={filters.showVisibilityGaps !== false} onChange={(event) => onChange({ ...filters, showVisibilityGaps: event.target.checked })} />
          Mostrar brechas de visibilidad
        </label>
        <Button variant="secondary" size="sm" onClick={onClear}>
          <X size={14} />
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}

function TopUtilizationInterfacesChart({ data, onSelect }: { data: PerformanceChartPoint[]; onSelect: (point: PerformanceChartPoint) => void }) {
  return <PerformanceHorizontalBarChart title="Top interfaces por utilizacion" description="Entrada/salida o rate absoluto cuando no hay velocidad disponible." data={data} onSelect={onSelect} />;
}

function ErrorsDropsStackedChart({ title, data, onSelect }: { title: string; data: PerformanceStackedPoint[]; onSelect: (point: PerformanceChartPoint) => void }) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">Breakdown por tipo de error/drop. Click abre evidencia.</p>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {data.length === 0 ? <EmptyState icon={<AlertTriangle size={22} />} title="Sin errores o drops reconocidos" /> : data.map((point) => <StackedMetricBar key={point.id} point={point} onSelect={onSelect} />)}
      </PanelBody>
    </Panel>
  );
}

function DeviceResourcePressureChart({ data, onSelect }: { data: PerformanceStackedPoint[]; onSelect: (point: PerformanceChartPoint) => void }) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">CPU y memoria por dispositivo</h2>
          <p className="text-xs text-muted-foreground">Presion de recursos separando snapshot e historico.</p>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {data.length === 0 ? <EmptyState icon={<Server size={22} />} title="Sin metricas de CPU o memoria" /> : data.map((point) => <StackedMetricBar key={point.id} point={point} onSelect={onSelect} />)}
      </PanelBody>
    </Panel>
  );
}

function InstabilityEventsChart({ data, onSelect }: { data: PerformanceStackedPoint[]; onSelect: (point: PerformanceChartPoint) => void }) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Eventos de inestabilidad</h2>
          <p className="text-xs text-muted-foreground">Flaps, vecinos routing, STP y eventos de agregacion.</p>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {data.length === 0 ? <EmptyState icon={<GitBranch size={22} />} title="Sin eventos de inestabilidad reconocidos" /> : data.map((point) => <StackedMetricBar key={point.id} point={point} onSelect={onSelect} />)}
      </PanelBody>
    </Panel>
  );
}

function PerformanceHorizontalBarChart({
  title,
  description,
  data,
  onSelect
}: {
  title: string;
  description: string;
  data: PerformanceChartPoint[];
  onSelect: (point: PerformanceChartPoint) => void;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {data.length === 0 ? (
          <EmptyState icon={<Network size={22} />} title="Sin metricas para graficar" />
        ) : data.map((point) => (
          <button key={point.id} className="w-full rounded-md border border-border bg-card p-3 text-left hover:border-primary/50 hover:bg-muted/30" title={`${point.evidenceRef} · umbral ${point.thresholdWarning}/${point.thresholdCritical}`} onClick={() => onSelect(point)}>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold">{point.label}</span>
              <span className={cn("rounded px-2 py-0.5 font-semibold", performanceSeverityPill(point.severity))}>{point.value}{point.unit}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-2 rounded-full", performanceSeverityBar(point.severity))} style={{ width: `${Math.min(100, (point.value / max) * 100)}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span>{point.sampleType}</span>
              <span>{point.confidence}% confianza</span>
              <span>{point.source}</span>
            </div>
          </button>
        ))}
      </PanelBody>
    </Panel>
  );
}

function StackedMetricBar({ point, onSelect }: { point: PerformanceStackedPoint; onSelect: (point: PerformanceChartPoint) => void }) {
  const total = Math.max(1, Object.values(point.breakdown).reduce((sum, value) => sum + value, 0));
  return (
    <button className="w-full rounded-md border border-border bg-card p-3 text-left hover:border-primary/50 hover:bg-muted/30" onClick={() => onSelect(point)} title={point.evidenceRef}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-semibold">{point.label}</span>
        <Badge tone={performanceSeverityTone(point.severity)}>{point.value}{point.unit}</Badge>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted">
        {Object.entries(point.breakdown).filter(([, value]) => value > 0).map(([name, value], index) => (
          <div key={name} className={cn("h-3", stackedBarColor(index))} style={{ width: `${Math.max(4, (value / total) * 100)}%` }} title={`${name}: ${value}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {Object.entries(point.breakdown).filter(([, value]) => value > 0).slice(0, 5).map(([name, value]) => (
          <span key={name} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{name.replace(/_/g, " ")} {value}</span>
        ))}
      </div>
    </button>
  );
}

function PerformanceHealthHeatmap({
  data,
  selectedCategory,
  onSelectCategory
}: {
  data: ReturnType<typeof buildPerformanceDashboardData>["heatmapData"];
  selectedCategory: PerformanceHealthCategory | "all";
  onSelectCategory: (category: PerformanceHealthCategory | "all") => void;
}) {
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Heatmap de salud por dispositivo</h2>
          <p className="text-xs text-muted-foreground">Click en una categoria filtra metricas relacionadas.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onSelectCategory("all")}>Ver todo</Button>
      </PanelHeader>
      <PanelBody>
        {data.devices.length === 0 ? (
          <EmptyState icon={<Network size={22} />} title="Sin dispositivos con metricas de performance" />
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="grid min-w-[980px] gap-1" style={{ gridTemplateColumns: `220px repeat(${data.categories.length}, minmax(110px, 1fr))` }}>
              <div />
              {data.categories.map((category) => (
                <button key={category} className={cn("rounded-md border border-border bg-muted/50 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground", selectedCategory === category && "border-primary text-primary")} onClick={() => onSelectCategory(category)}>
                  {category}
                </button>
              ))}
              {data.devices.map((device) => (
                <React.Fragment key={device}>
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-semibold">{device}</div>
                  {data.categories.map((category) => {
                    const cell = data.cells.find((item) => item.deviceId === device && item.category === category)!;
                    return (
                      <button key={cell.id} className={cn("h-10 rounded-md border text-xs font-semibold hover:border-primary/60", performanceSeverityHeatmap(cell.severity))} title={`${device} ${category}: ${cell.metrics.length} metricas`} onClick={() => onSelectCategory(category)}>
                        {cell.metrics.length}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function DataCoverageDonut({ data, hasHistoricalData }: { data: ReturnType<typeof buildPerformanceDashboardData>["dataCoverage"]; hasHistoricalData: boolean }) {
  const total = Math.max(1, data.withData + data.withoutData);
  const covered = Math.round((data.withData / total) * 100);
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Cobertura de datos</h2>
          <p className="text-xs text-muted-foreground">Dispositivos, interfaces y disponibilidad historica.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold leading-none">{covered}%</p>
          <p className="mt-1 text-xs text-muted-foreground">cobertura</p>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-3">
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{data.withData} con datos</span>
            <span>{data.withoutData} sin datos</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${covered}%` }} />
          </div>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <CoverageLine label="Con datos" value={data.withData} tone="success" />
          <CoverageLine label="Sin datos" value={data.withoutData} tone={data.withoutData > 0 ? "danger" : "neutral"} />
          <CoverageLine label="Solo snapshot" value={data.snapshotOnly} tone={hasHistoricalData ? "warning" : "info"} />
          <CoverageLine label="Historico disponible" value={data.historicalAvailable} tone={hasHistoricalData ? "success" : "neutral"} />
          <CoverageLine label="Interfaces analizadas" value={data.interfacesAnalyzed} tone="info" />
          <CoverageLine label="Criticas sin evidencia" value={data.criticalInterfacesWithoutEvidence} tone={data.criticalInterfacesWithoutEvidence > 0 ? "warning" : "neutral"} />
        </div>
      </PanelBody>
    </Panel>
  );
}

function CoverageLine({ label, value, tone }: { label: string; value: number; tone: "neutral" | "info" | "success" | "warning" | "danger" }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <span className="min-w-0 text-xs font-medium text-muted-foreground">{label}</span>
      <Badge tone={tone} className="h-auto shrink-0 px-2 py-1 text-xs font-semibold">{value}</Badge>
    </div>
  );
}

function PerformanceTrendChart({ dashboard, onSelect }: { dashboard: ReturnType<typeof buildPerformanceDashboardData>; onSelect: (point: PerformanceChartPoint) => void }) {
  if (!dashboard.hasHistoricalData) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState icon={<Network size={22} />} title="No se muestran tendencias porque no hay datos historicos. El analisis actual es snapshot." />
        </PanelBody>
      </Panel>
    );
  }
  const firstSeries = dashboard.timeSeriesCharts[0];
  const max = Math.max(1, ...(firstSeries?.points.map((point) => point.value) ?? [1]));
  const points = firstSeries?.points ?? [];
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Tendencia historica</h2>
          <p className="text-xs text-muted-foreground">{firstSeries ? `${firstSeries.deviceId} ${firstSeries.interfaceId ?? ""} · ${firstSeries.metricType}` : "Sin serie seleccionada"}</p>
        </div>
      </PanelHeader>
      <PanelBody>
        <div className="h-48 rounded-md border border-border bg-muted/20 p-4">
          <svg viewBox="0 0 600 160" className="h-full w-full overflow-visible">
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-primary"
              points={points.map((point, index) => `${(index / Math.max(1, points.length - 1)) * 600},${160 - (point.value / max) * 140}`).join(" ")}
            />
            {points.map((point, index) => (
              <circle key={`${point.timestamp}-${index}`} cx={(index / Math.max(1, points.length - 1)) * 600} cy={160 - (point.value / max) * 140} r="4" className="fill-primary" />
            ))}
          </svg>
        </div>
      </PanelBody>
    </Panel>
  );
}

function CriticalMetricsTable({ rows, onSelect }: { rows: PerformanceChartPoint[]; onSelect: (point: PerformanceChartPoint) => void }) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Metricas criticas</h2>
          <p className="text-xs text-muted-foreground">Tabla interactiva con evidencia, umbrales y accion recomendada.</p>
        </div>
      </PanelHeader>
      <PanelBody>
        {rows.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={22} />} title="Sin metricas sobre umbrales" />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Severidad</th>
                  <th className="px-3 py-2">Dispositivo</th>
                  <th className="px-3 py-2">Interface</th>
                  <th className="px-3 py-2">Metrica</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Umbral</th>
                  <th className="px-3 py-2">Fuente</th>
                  <th className="px-3 py-2">Confianza</th>
                  <th className="px-3 py-2">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onSelect(row)}>
                    <td className="px-3 py-2"><Badge tone={performanceSeverityTone(row.severity)}>{row.severity}</Badge></td>
                    <td className="px-3 py-2">{row.deviceId}</td>
                    <td className="px-3 py-2">{row.interfaceId ?? "Equipo"}</td>
                    <td className="px-3 py-2">{row.metrics[0].metricType.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 font-semibold">{row.value}{row.unit}</td>
                    <td className="px-3 py-2">{row.thresholdWarning}/{row.thresholdCritical}</td>
                    <td className="px-3 py-2">
                      <p>{row.source}</p>
                      <p className="text-xs text-muted-foreground">{row.evidenceCommand ?? "Comando no identificado"}</p>
                    </td>
                    <td className="px-3 py-2">{row.confidence}%</td>
                    <td className="px-3 py-2 text-muted-foreground">Revisar evidencia</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function PerformanceInsightPanel({ insights }: { insights: PerformanceInsight[] }) {
  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Insights de performance</h2>
          <p className="text-xs text-muted-foreground">Diferencia problemas confirmados, sintomas probables y brechas de visibilidad.</p>
        </div>
      </PanelHeader>
      <PanelBody className="grid gap-3 lg:grid-cols-2">
        {insights.length === 0 ? (
          <EmptyState icon={<Bot size={22} />} title="Sin insights generados con la evidencia actual" />
        ) : insights.map((insight) => (
          <div key={insight.id} className="rounded-md border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{insight.insightType.replace(/_/g, " ")}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={performanceSeverityTone(insight.severity)}>{insight.severity}</Badge>
                <Badge tone={insight.sourceType === "architect_validated" ? "success" : insight.sourceType === "ai_suggested" ? "info" : "neutral"}>{insight.sourceType.replace(/_/g, " ")}</Badge>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{insight.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">{insight.confidence}% confianza · {insight.evidenceRefs.length} evidencias</p>
            {insight.evidenceRefs.length > 0 && (
              <div className="mt-2 rounded-md border border-border bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                {insight.evidenceRefs.slice(0, 2).join(" · ")}
              </div>
            )}
            <p className="mt-2 text-xs font-medium">{insight.recommendation}</p>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

function PerformanceMetricDrawer({
  metric,
  insights,
  onClose
}: {
  metric: PerformanceChartPoint | null;
  insights: PerformanceInsight[];
  onClose: () => void;
}) {
  if (!metric) return null;
  const primaryMetric = metric.metrics[0];
  const metricIds = new Set(metric.metrics.map((item) => item.id));
  const relatedInsights = insights.filter((insight) => {
    const relatedMetric = insight.relatedMetrics.some((id) => metricIds.has(id));
    const relatedDevice = insight.relatedDevices.includes(metric.deviceId);
    const relatedInterface = metric.interfaceId ? insight.relatedInterfaces.includes(metric.interfaceId) : false;
    return relatedMetric || relatedDevice || relatedInterface;
  }).slice(0, 5);
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto border-l border-border bg-background p-5 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Detalle de metrica</p>
          <h2 className="mt-1 text-lg font-semibold">{metric.label}</h2>
        </div>
        <Button size="icon" variant="secondary" onClick={onClose} title="Cerrar">
          <X size={16} />
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricDetail label="Dispositivo" value={metric.deviceId} />
        <MetricDetail label="Interface" value={metric.interfaceId ?? "Equipo"} />
        <MetricDetail label="Metrica" value={primaryMetric.metricType.replace(/_/g, " ")} />
        <MetricDetail label="Valor" value={`${metric.value}${metric.unit}`} />
        <MetricDetail label="Umbral warning/critical" value={`${metric.thresholdWarning}/${metric.thresholdCritical}`} />
        <MetricDetail label="Severidad" value={metric.severity} />
        <MetricDetail label="Archivo fuente" value={metric.source} wide />
        <MetricDetail label="Evidence file ID" value={metric.evidenceFileId} wide />
        <MetricDetail label="Comando origen" value={primaryMetric.evidenceCommand ?? "No identificado"} wide />
        <MetricDetail label="Tipo de fuente" value={metric.evidenceSourceType ?? "No identificado"} />
        <MetricDetail label="Ventana" value={`${primaryMetric.sampleType} · ${primaryMetric.timeWindow}`} />
        <MetricDetail label="Confianza" value={`${metric.confidence}%`} />
      </div>
      <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Trazabilidad de evidencia</p>
        <div className="mt-2 max-h-72 space-y-2 overflow-auto">
          {metric.metrics.map((item) => (
            <div key={item.id} className="min-w-0 rounded-md border border-border bg-card px-3 py-2 text-xs">
              <p className="break-words font-semibold">{item.metricType.replace(/_/g, " ")} · {item.value}{item.unit}</p>
              <p className="mt-1 break-all text-muted-foreground">metricId: {item.id}</p>
              <p className="break-all text-muted-foreground">fileId: {item.evidenceFileId}</p>
              <p className="break-words text-muted-foreground">archivo: {item.source}</p>
              <p className="break-words text-muted-foreground">comando: {item.evidenceCommand ?? "No identificado"}</p>
              <p className="break-words text-muted-foreground">muestra: {item.sampleType} · {item.timeWindow}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Insights relacionados</p>
        <div className="mt-2 space-y-2">
          {relatedInsights.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay insights aceptados o deterministico relacionados con esta metrica.</p>
          ) : relatedInsights.map((insight) => (
            <div key={insight.id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold">{insight.title}</p>
                <Badge tone={performanceSeverityTone(insight.severity)}>{insight.severity}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{insight.sourceType.replace(/_/g, " ")} · {insight.confidence}% confianza · {insight.evidenceRefs.length} evidencias</p>
              <p className="mt-1 text-muted-foreground">{insight.recommendation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricDetail({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-md border border-border bg-card px-3 py-2", wide && "sm:col-span-2")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold leading-snug", wide ? "break-words" : "break-words")}>{value}</p>
    </div>
  );
}

function performanceInsightLabel(category: PerformanceInsight["insightType"]) {
  const labels: Record<PerformanceInsight["insightType"], string> = {
    saturation: "Saturacion",
    errors: "Errores",
    drops: "Drops",
    resource_pressure: "Recursos",
    instability: "Inestabilidad",
    visibility_gap: "Visibilidad",
    capacity_risk: "Capacidad",
    qos_congestion: "QoS"
  };
  return labels[category];
}

function performanceHealthCategoryLabel(category: PerformanceHealthCategory) {
  const labels: Record<PerformanceHealthCategory, string> = {
    utilization: "Utilizacion",
    errors: "Errores",
    drops: "Drops",
    cpu: "CPU",
    memory: "Memoria",
    instability: "Inestabilidad",
    qos: "QoS"
  };
  return labels[category];
}

function performanceSeverityCssColor(severity: PerformanceSeverity) {
  const colors: Record<PerformanceSeverity, string> = {
    normal: "#22c55e",
    warning: "#38bdf8",
    high: "#f59e0b",
    critical: "#f43f5e"
  };
  return colors[severity];
}

function performanceSeveritySubtleBg(severity: PerformanceSeverity) {
  const classes: Record<PerformanceSeverity, string> = {
    normal: "bg-emerald-500/5",
    warning: "bg-sky-500/5",
    high: "bg-amber-500/5",
    critical: "bg-rose-500/5"
  };
  return classes[severity];
}

function buildOverviewHeatmapData(dashboard: ReturnType<typeof buildPerformanceDashboardData>): PerformanceExecutiveHeatmapData {
  const deviceScores = dashboard.heatmapData.devices
    .map((deviceId) => {
      const cells = dashboard.heatmapData.cells.filter((cell) => cell.deviceId === deviceId);
      const score = cells.reduce((sum, cell) => sum + performanceSeverityNumericScore(cell.severity) * Math.max(1, cell.metrics.length), 0);
      return { deviceId, score };
    })
    .sort((left, right) => right.score - left.score || left.deviceId.localeCompare(right.deviceId));
  const devices = deviceScores.slice(0, 5).map((item) => item.deviceId);
  return {
    devices,
    categories: dashboard.heatmapData.categories,
    cells: dashboard.heatmapData.cells.filter((cell) => devices.includes(cell.deviceId)),
    totalDevices: dashboard.heatmapData.devices.length
  };
}

function buildTechnicalSignalSummaries(dashboard: ReturnType<typeof buildPerformanceDashboardData>) {
  const categories: Array<{ category: PerformanceHealthCategory; title: string; targetView: "interfaces" | "devices" | "instability"; action: string }> = [
    { category: "utilization", title: "Saturacion / capacidad", targetView: "interfaces", action: "Validar enlaces top, velocidad efectiva y recurrencia historica." },
    { category: "errors", title: "Errores fisicos o CRC", targetView: "interfaces", action: "Revisar transceivers, cableado, duplex/speed y counters tras clear." },
    { category: "drops", title: "Drops / descarte", targetView: "interfaces", action: "Revisar colas, QoS, buffers y oversubscription del camino." },
    { category: "cpu", title: "CPU", targetView: "devices", action: "Validar procesos, features y capacidad de plataforma." },
    { category: "memory", title: "Memoria", targetView: "devices", action: "Validar consumo, leaks, version y dimensionamiento." },
    { category: "instability", title: "Inestabilidad", targetView: "instability", action: "Correlacionar flaps, routing/STP y eventos de convergencia." }
  ];
  return categories
    .map((item) => {
      const metrics = dashboard.filteredMetrics.filter((metric) => metricBelongsToOverviewCategory(metric.metricType, item.category));
      const alertMetrics = metrics.filter((metric) => ["warning", "high", "critical"].includes(metric.severityHint ?? metricSeverityFromPointValue(metric.value, metric.thresholdWarning, metric.thresholdCritical)));
      const scopedMetrics = alertMetrics.length > 0 ? alertMetrics : metrics;
      const devices = new Set(scopedMetrics.map((metric) => metric.deviceId));
      const interfaces = new Set(scopedMetrics.map((metric) => metric.interfaceId).filter(Boolean));
      const severity = highestMetricSeverity(scopedMetrics);
      return {
        id: item.category,
        title: item.title,
        devices: devices.size,
        interfaces: interfaces.size,
        metrics: scopedMetrics.length,
        severity,
        targetView: item.targetView,
        action: item.action
      };
    })
    .filter((item) => item.metrics > 0)
    .sort((left, right) => performanceSeverityNumericScore(right.severity) - performanceSeverityNumericScore(left.severity) || right.metrics - left.metrics)
    .slice(0, 6);
}

function metricBelongsToOverviewCategory(metricType: PerformanceMetric["metricType"], category: PerformanceHealthCategory) {
  if (category === "utilization") return ["utilization", "utilization_in", "utilization_out", "input_rate_bps", "output_rate_bps"].includes(metricType);
  if (category === "errors") return ["input_errors", "output_errors", "crc_errors", "frame_errors", "overruns", "ignored"].includes(metricType);
  if (category === "drops") return ["drops", "input_drops", "output_drops", "queue_drops", "qos_drops"].includes(metricType);
  if (category === "cpu") return metricType === "cpu";
  if (category === "memory") return metricType === "memory";
  if (category === "instability") return ["flaps", "routing_neighbor_stability"].includes(metricType);
  if (category === "qos") return metricType === "qos_drops";
  return false;
}

function highestMetricSeverity(metrics: PerformanceMetric[]): PerformanceSeverity {
  return metrics.reduce<PerformanceSeverity>((highest, metric) => {
    const severity = metric.severityHint ?? metricSeverityFromPointValue(metric.value, metric.thresholdWarning, metric.thresholdCritical);
    return performanceSeverityNumericScore(severity) > performanceSeverityNumericScore(highest) ? severity : highest;
  }, "normal");
}

function metricSeverityFromPointValue(value: number, thresholdWarning?: number, thresholdCritical?: number): PerformanceSeverity {
  const warning = thresholdWarning ?? 1;
  const critical = thresholdCritical ?? 100;
  const high = (warning + critical) / 2;
  if (value >= critical) return "critical";
  if (value >= high) return "high";
  if (value >= warning) return "warning";
  return "normal";
}

function performanceSeverityNumericScore(severity: PerformanceSeverity) {
  return { normal: 0, warning: 1, high: 2, critical: 3 }[severity];
}

function performanceSeverityTone(severity: PerformanceSeverity): "neutral" | "info" | "success" | "warning" | "danger" {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  if (severity === "warning") return "info";
  return "success";
}

function performanceSeverityBorder(severity: PerformanceSeverity) {
  const classes: Record<PerformanceSeverity, string> = {
    normal: "border-emerald-300/50",
    warning: "border-sky-300/60",
    high: "border-amber-300/70",
    critical: "border-rose-300/80"
  };
  return classes[severity];
}

function performanceSeverityPill(severity: PerformanceSeverity) {
  const classes: Record<PerformanceSeverity, string> = {
    normal: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    warning: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
    high: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    critical: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
  };
  return classes[severity];
}

function performanceSeverityBar(severity: PerformanceSeverity) {
  const classes: Record<PerformanceSeverity, string> = {
    normal: "bg-emerald-500",
    warning: "bg-sky-500",
    high: "bg-amber-500",
    critical: "bg-rose-500"
  };
  return classes[severity];
}

function performanceSeverityHeatmap(severity: PerformanceSeverity) {
  const classes: Record<PerformanceSeverity, string> = {
    normal: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    warning: "border-sky-500/40 bg-sky-500/12 text-sky-700 dark:text-sky-200",
    high: "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200",
    critical: "border-rose-500/60 bg-rose-500/20 text-rose-800 dark:text-rose-200"
  };
  return classes[severity];
}

function stackedBarColor(index: number) {
  return ["bg-sky-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-emerald-500", "bg-slate-500"][index % 6];
}

function PerformanceChartCard({ chart }: { chart: PerformanceChartData }) {
  const values = chart.series[0]?.values ?? [];
  const max = Math.max(1, ...values);
  return (
    <Panel>
      <PanelHeader>
        <h2 className="text-sm font-semibold">{chart.title}</h2>
      </PanelHeader>
      <PanelBody className="space-y-2">
        {chart.labels.map((label, index) => {
          const value = values[index] ?? 0;
          return (
            <div key={`${chart.chartKey}-${label}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground">{label}</span>
                <span className="font-semibold">{value}{chart.series[0]?.unit ?? ""}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </PanelBody>
    </Panel>
  );
}

function TopologyTab({ record }: { record: AssessmentRecord }) {
  const [view, setView] = useState<TopologyView>("relations");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [layerOverrides, setLayerOverrides] = useState<Record<string, TopologyLayerId>>(() => readTopologyLayerOverrides(record.id));
  const [visibleLayerIds, setVisibleLayerIds] = useState<Set<TopologyLayerId>>(() => new Set(topologyLayerOrder));
  const [collapsedLayerIds, setCollapsedLayerIds] = useState<Set<TopologyLayerId>>(() => new Set());
  const [viewport, setViewport] = useState({ zoom: 1, translateX: 24, translateY: 24 });
  const [hasInitialFit, setHasInitialFit] = useState(false);
  const [userAdjustedView, setUserAdjustedView] = useState(false);
  const graphScrollRef = useRef<HTMLDivElement | null>(null);
  const effectiveParsed = useMemo(() => effectiveParsedNetworkData(record), [record]);
  const graph = useMemo(() => buildTopologyGraph(record, layerOverrides, visibleLayerIds, collapsedLayerIds), [record, layerOverrides, visibleLayerIds, collapsedLayerIds]);
  const selectedNode = selectedNodeId ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null : null;
  const focusedNodeIds = selectedNode ? directTopologyNodeIds(graph, selectedNode.id) : new Set<string>();
  const focusedEdgeIds = selectedNode ? directTopologyEdgeIds(graph, selectedNode.id) : new Set<string>();
  const hasRelations = effectiveParsed.relations.length > 0;
  const graphViewportWidth = detailPanelOpen ? 940 : 1280;
  const graphViewportHeight = 680;
  const graphBounds = useMemo(() => topologyVisibleBounds(graph), [graph]);
  const transformedMinX = graphBounds.minX * viewport.zoom + viewport.translateX;
  const transformedMaxX = graphBounds.maxX * viewport.zoom + viewport.translateX;
  const transformedMinY = graphBounds.minY * viewport.zoom + viewport.translateY;
  const transformedMaxY = graphBounds.maxY * viewport.zoom + viewport.translateY;
  const graphCanvasWidth = Math.max(graphViewportWidth, transformedMaxX + Math.max(96, -transformedMinX + 96));
  const graphCanvasHeight = Math.max(graphViewportHeight, transformedMaxY + Math.max(96, -transformedMinY + 96));
  const visibleNodeIds = new Set(graph.nodes.map((node) => node.id));
  const visibleEdges = graph.edges.filter((edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId));

  useEffect(() => {
    writeTopologyLayerOverrides(record.id, layerOverrides);
  }, [layerOverrides, record.id]);

  function showGraphView() {
    setView("graph");
    if (!hasInitialFit && !userAdjustedView) {
      setViewport(calculateTopologyFitView(graph, graphScrollRef.current?.clientWidth ?? graphViewportWidth, graphScrollRef.current?.clientHeight ?? graphViewportHeight));
      setHasInitialFit(true);
    }
  }

  function fitGraph() {
    setViewport(calculateTopologyFitView(graph, graphScrollRef.current?.clientWidth ?? graphViewportWidth, graphScrollRef.current?.clientHeight ?? graphViewportHeight));
    if (graphScrollRef.current) {
      graphScrollRef.current.scrollLeft = 0;
      graphScrollRef.current.scrollTop = 0;
    }
    setUserAdjustedView(true);
  }

  function changeZoom(delta: number) {
    setViewport((current) => ({
      ...current,
      zoom: clampZoom(Number((current.zoom + delta).toFixed(2)), graph.nodes.length)
    }));
    setUserAdjustedView(true);
  }

  function toggleLayerFilter(layerId: TopologyLayerId) {
    setVisibleLayerIds((current) => {
      const next = new Set(current);
      if (next.has(layerId) && next.size > 1) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
    if (selectedNode?.layerId === layerId && visibleLayerIds.has(layerId) && visibleLayerIds.size > 1) {
      setSelectedNodeId(null);
      setDetailPanelOpen(false);
    }
    setHasInitialFit(false);
  }

  function toggleLayerCollapse(layerId: TopologyLayerId) {
    setCollapsedLayerIds((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
    setHasInitialFit(false);
  }

  function updateNodeLayer(nodeId: string, layerId: TopologyLayerId | null) {
    setLayerOverrides((current) => {
      if (layerId) return { ...current, [nodeId]: layerId };
      const next = { ...current };
      delete next[nodeId];
      return next;
    });
    setHasInitialFit(false);
  }

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Topologia y relaciones</h2>
            <p className="text-xs text-muted-foreground">Revisa vecinos descubiertos o navega el grafo jerarquico por equipo.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-white p-1">
          <button
            className={cn("h-8 rounded px-3 text-xs font-medium", view === "relations" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            onClick={() => setView("relations")}
          >
            Relaciones
          </button>
          <button
            className={cn("h-8 rounded px-3 text-xs font-medium", view === "graph" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            onClick={showGraphView}
          >
            Grafo
          </button>
        </div>
      </PanelHeader>
      <PanelBody>
        {!hasRelations ? (
          <EmptyState icon={<Network size={24} />} title="Sin vecinos CDP/LLDP identificados" />
        ) : view === "relations" ? (
          <TopologyRelationsView record={record} />
        ) : (
          <div className={cn("grid gap-4", detailPanelOpen && "xl:grid-cols-[minmax(0,1fr)_320px]")}>
            <div className="overflow-hidden rounded-md border border-border bg-slate-50">
              <div className="space-y-3 border-b border-border bg-white px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => changeZoom(0.1)}>
                    <ZoomIn size={14} />
                    Zoom
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => changeZoom(-0.1)}>
                    <ZoomOut size={14} />
                    Zoom
                  </Button>
                  <Button size="sm" variant="secondary" onClick={fitGraph}>
                    <RotateCcw size={14} />
                    Ajustar vista
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setDetailPanelOpen((value) => !value)}
                    disabled={!selectedNode}
                  >
                    {detailPanelOpen ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                    Detalle
                  </Button>
                  </div>
                  <Badge tone="info">{Math.round(viewport.zoom * 100)}%</Badge>
                </div>
                <TopologyLayerLegend
                  graph={graph}
                  visibleLayerIds={visibleLayerIds}
                  collapsedLayerIds={collapsedLayerIds}
                  onToggleVisible={toggleLayerFilter}
                  onToggleCollapsed={toggleLayerCollapse}
                />
              </div>
              <div ref={graphScrollRef} className="h-[680px] overflow-auto">
                <div style={{ width: graphCanvasWidth, height: graphCanvasHeight }}>
                  <svg className="block" width={graphCanvasWidth} height={graphCanvasHeight}>
                    <g transform={`translate(${viewport.translateX}, ${viewport.translateY}) scale(${viewport.zoom})`}>
                      <defs>
                        <marker id="topology-arrow-start" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto" markerUnits="strokeWidth">
                          <path d="M 8 0 L 0 4 L 8 8 z" fill="#64748b" />
                        </marker>
                        <marker id="topology-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
                          <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b" />
                        </marker>
                      </defs>
                      {graph.layers.map((layer) => (
                        <TopologyLayerZone key={layer.id} layer={layer} graphWidth={graph.width} onToggle={() => toggleLayerCollapse(layer.id)} />
                      ))}
                      {visibleEdges.map((edge) => {
                        const source = graph.nodes.find((node) => node.id === edge.sourceId);
                        const target = graph.nodes.find((node) => node.id === edge.targetId);
                        if (!source || !target) return null;
                        const isFocused = !selectedNode || focusedEdgeIds.has(edge.id);
                        return <TopologyEdgePath key={edge.id} edge={edge} source={source} target={target} isFocused={isFocused} />;
                      })}
                      {graph.nodes.map((node) => {
                        const isFocused = !selectedNode || focusedNodeIds.has(node.id);
                        return (
                          <TopologyGraphNode
                            key={node.id}
                            node={node}
                            selected={selectedNode?.id === node.id}
                            dimmed={!isFocused}
                            onSelect={() => {
                              setSelectedNodeId(node.id);
                              setDetailPanelOpen(true);
                            }}
                          />
                        );
                      })}
                    </g>
                  </svg>
                </div>
              </div>
            </div>
            {detailPanelOpen && (
              <TopologyNodePanel
                graph={graph}
                selectedNode={selectedNode}
                onLayerOverride={updateNodeLayer}
                onCollapse={() => setDetailPanelOpen(false)}
                onClear={() => {
                  setSelectedNodeId(null);
                  setDetailPanelOpen(false);
                }}
              />
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function TopologyRelationsView({ record }: { record: AssessmentRecord }) {
  const effectiveParsed = effectiveParsedNetworkData(record);
  const groups = topologyRelationGroups(effectiveParsed.relations);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.hostname} className="topology-relation-group overflow-hidden rounded-md border border-border">
          <div className="topology-relation-group-header flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{group.hostname}</h3>
              <p className="text-xs text-muted-foreground">{group.relations.length} relaciones descubiertas</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {group.cdpCount > 0 && <Badge tone="info">CDP {group.cdpCount}</Badge>}
              {group.lldpCount > 0 && <Badge tone="success">LLDP {group.lldpCount}</Badge>}
            </div>
          </div>
          <div className="grid gap-2 p-2.5 md:grid-cols-2 xl:grid-cols-3">
            {group.relations.map((relation) => (
              <CompactTopologyRelationCard key={relation.id} relation={relation} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CompactTopologyRelationCard({ relation }: { relation: NeighborRelation }) {
  return (
    <article className="min-w-0 rounded-md border border-border bg-muted/20 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={relation.protocol === "cdp" ? "info" : "success"}>{relation.protocol.toUpperCase()}</Badge>
        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{Math.round(relation.confidence * 100)}%</span>
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.25fr)] items-center gap-2 text-xs">
        <p className="truncate rounded border border-border bg-background/60 px-2 py-1 font-medium" title={relation.localInterface}>
          {relation.localInterface}
        </p>
        <span className="text-muted-foreground">→</span>
        <div className="min-w-0 rounded border border-border bg-background/60 px-2 py-1">
          <p className="truncate font-semibold" title={relation.remoteHostname}>{relation.remoteHostname}</p>
          <p className="truncate text-[11px] text-muted-foreground" title={relation.remoteInterface}>{relation.remoteInterface}</p>
        </div>
      </div>
      {relation.managementIp && (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground" title={`IP gestion: ${relation.managementIp}`}>
          IP gestion: {relation.managementIp}
        </p>
      )}
    </article>
  );
}

function topologyRelationGroups(relations: NeighborRelation[]) {
  const groups = new Map<string, NeighborRelation[]>();
  for (const relation of relations) {
    const hostname = relation.localHostname || "Sin dispositivo local";
    groups.set(hostname, [...(groups.get(hostname) ?? []), relation]);
  }

  return Array.from(groups.entries())
    .map(([hostname, groupRelations]) => ({
      hostname,
      cdpCount: groupRelations.filter((relation) => relation.protocol === "cdp").length,
      lldpCount: groupRelations.filter((relation) => relation.protocol === "lldp").length,
      relations: groupRelations.sort((left, right) => (
        left.remoteHostname.localeCompare(right.remoteHostname) ||
        left.localInterface.localeCompare(right.localInterface) ||
        left.remoteInterface.localeCompare(right.remoteInterface)
      ))
    }))
    .sort((left, right) => left.hostname.localeCompare(right.hostname));
}

function TopologyLayerLegend({
  graph,
  visibleLayerIds,
  collapsedLayerIds,
  onToggleVisible,
  onToggleCollapsed
}: {
  graph: TopologyGraph;
  visibleLayerIds: Set<TopologyLayerId>;
  collapsedLayerIds: Set<TopologyLayerId>;
  onToggleVisible: (layerId: TopologyLayerId) => void;
  onToggleCollapsed: (layerId: TopologyLayerId) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {topologyLayerOrder.map((layerId) => {
        const config = topologyLayerConfig[layerId];
        const visible = visibleLayerIds.has(layerId);
        const collapsed = collapsedLayerIds.has(layerId);
        return (
          <div key={layerId} className={cn("flex items-center gap-1 rounded-md border px-2 py-1", visible ? "bg-white" : "bg-muted/40 opacity-60")} style={{ borderColor: config.border }}>
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] font-semibold uppercase text-foreground"
              onClick={() => onToggleVisible(layerId)}
              title={`Filtrar ${config.label}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: config.color }} />
              {config.shortLabel}
              <span className="text-muted-foreground">{graph.layerNodeCounts[layerId]}</span>
            </button>
            <button
              type="button"
              className="rounded px-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
              onClick={() => onToggleCollapsed(layerId)}
              title={`${collapsed ? "Expandir" : "Colapsar"} ${config.label}`}
            >
              {collapsed ? "+" : "-"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TopologyLayerZone({ layer, graphWidth, onToggle }: { layer: TopologyLayerBand; graphWidth: number; onToggle: () => void }) {
  const layerStyle = {
    "--topology-layer-bg-dark": layer.bg,
    "--topology-layer-bg-light": layer.lightBg,
    "--topology-layer-border-dark": layer.border,
    "--topology-layer-border-light": layer.lightBorder
  } as React.CSSProperties;

  return (
    <g className="topology-layer-zone" style={layerStyle} transform={`translate(0, ${layer.y})`}>
      <rect x="0" y="0" width={graphWidth} height={layer.height} rx="14" fill="var(--topology-layer-bg)" stroke="var(--topology-layer-border)" strokeWidth="1.5" />
      <rect x="0" y="0" width="6" height={layer.height} rx="3" fill={layer.color} />
      <g className="cursor-pointer" onClick={onToggle}>
        <rect x="16" y="14" width={graphWidth - 32} height="28" rx="8" fill="var(--topology-layer-header-bg)" />
        <circle cx="31" cy="28" r="5" fill={layer.color} />
        <text x="44" y="32" fill="var(--topology-layer-title)" className="text-[12px] font-semibold">
          {layer.label}
        </text>
        <text x={graphWidth - 42} y="32" textAnchor="end" fill="var(--topology-layer-muted)" className="text-[11px] font-medium">
          {layer.collapsed ? `expandir · ${layer.nodeCount}` : `${layer.nodeCount} nodos`}
        </text>
      </g>
      <text x="22" y="58" fill="var(--topology-layer-muted)" className="text-[11px]">
        {truncateSvgText(layer.description, Math.max(42, Math.floor(graphWidth / 12)))}
      </text>
    </g>
  );
}

function TopologyEdgePath({ edge, source, target, isFocused }: { edge: TopologyEdge; source: TopologyNode; target: TopologyNode; isFocused: boolean }) {
  const sourceCenterY = source.y + topologyNodeHeight / 2;
  const targetCenterY = target.y + topologyNodeHeight / 2;
  const useSideAnchors = Math.abs(sourceCenterY - targetCenterY) <= 8;
  const pathGeometry = useSideAnchors
    ? topologySideAnchoredPath(source, target)
    : topologyVerticalAnchoredPath(source, target);
  const { path, labelX, labelY } = pathGeometry;

  return (
    <g className={cn(!isFocused && "opacity-15")}>
      <path d={path} fill="none" stroke={edge.protocol === "cdp" ? "#0284c7" : "#059669"} strokeWidth={isFocused ? 2.5 : 1.5} markerStart="url(#topology-arrow-start)" markerEnd="url(#topology-arrow)" />
      {isFocused && (
        <text x={labelX} y={labelY - 6} textAnchor="middle" className="fill-slate-500 text-[10px] font-medium">
          {edge.protocol.toUpperCase()}
        </text>
      )}
    </g>
  );
}

function topologyVerticalAnchoredPath(source: TopologyNode, target: TopologyNode) {
  const upper = source.y <= target.y ? source : target;
  const lower = source.y <= target.y ? target : source;
  const sourceX = upper.x + topologyNodeWidth / 2;
  const sourceY = upper.y + topologyNodeHeight;
  const targetX = lower.x + topologyNodeWidth / 2;
  const targetY = lower.y;
  const controlOffset = Math.max(80, Math.abs(targetY - sourceY) * 0.45);

  return {
    path: `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + controlOffset}, ${targetX} ${targetY - controlOffset}, ${targetX} ${targetY}`,
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2
  };
}

function topologySideAnchoredPath(source: TopologyNode, target: TopologyNode) {
  const left = source.x <= target.x ? source : target;
  const right = source.x <= target.x ? target : source;
  const sourceX = left.x + topologyNodeWidth;
  const sourceY = left.y + topologyNodeHeight / 2;
  const targetX = right.x;
  const targetY = right.y + topologyNodeHeight / 2;
  const horizontalDistance = Math.abs(targetX - sourceX);
  const controlOffset = Math.min(Math.max(28, horizontalDistance * 0.35), Math.max(18, horizontalDistance / 2));

  return {
    path: `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`,
    labelX: (sourceX + targetX) / 2,
    labelY: (sourceY + targetY) / 2
  };
}

function TopologyGraphNode({
  node,
  selected,
  dimmed,
  onSelect
}: {
  node: TopologyNode;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
}) {
  const config = topologyLayerConfig[node.layerId];
  return (
    <g transform={`translate(${node.x}, ${node.y})`} className={cn("cursor-pointer transition", dimmed && "opacity-25")} onClick={onSelect}>
      <rect width={topologyNodeWidth} height={topologyNodeHeight} rx="8" fill={selected ? "#102b3d" : "#0f1720"} stroke={selected ? config.color : "#334155"} strokeWidth={selected ? 2.5 : 1.5} />
      <rect x="0" y="0" width="5" height={topologyNodeHeight} rx="2.5" fill={config.color} />
      <rect x="14" y="14" width="28" height="28" rx="6" fill="#172333" stroke="#334155" />
      <Server x={18} y={20} size={16} color="#dbeafe" />
      <text x="50" y="27" fill="#e5eef8" className="text-[12px] font-semibold">
        {truncateSvgText(node.hostname, 17)}
      </text>
      <text x="50" y="45" fill="#9fb0c3" className="text-[11px]">
        {truncateSvgText(node.model, 17)}
      </text>
      <text x="14" y="70" fill="#9fb0c3" className="text-[10px]">
        {truncateSvgText(node.role || node.layerLabel, 22)}
      </text>
      <text x="14" y="84" fill={config.color} className="text-[9px] font-semibold uppercase">
        {truncateSvgText(config.shortLabel, 24)}
      </text>
    </g>
  );
}

function TopologyNodePanel({
  graph,
  selectedNode,
  onLayerOverride,
  onCollapse,
  onClear
}: {
  graph: TopologyGraph;
  selectedNode: TopologyNode | null;
  onLayerOverride: (nodeId: string, layerId: TopologyLayerId | null) => void;
  onCollapse: () => void;
  onClear: () => void;
}) {
  if (!selectedNode) {
    return (
      <aside className="rounded-md border border-border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">Detalle del nodo</h3>
          </div>
          <Button size="icon" variant="ghost" title="Colapsar detalle" onClick={onCollapse}>
            <ArrowDown size={15} />
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Selecciona un equipo en el grafo para enfocar sus conexiones directas y revisar su informacion.</p>
      </aside>
    );
  }

  const directEdges = graph.edges.filter((edge) => edge.sourceId === selectedNode.id || edge.targetId === selectedNode.id);

  return (
    <aside className="rounded-md border border-border bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">{selectedNode.hostname}</h3>
          <p className="text-xs text-muted-foreground">{selectedNode.model}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" title="Colapsar detalle" onClick={onCollapse}>
            <ArrowDown size={15} />
          </Button>
          <Button size="icon" variant="ghost" title="Cerrar detalle" onClick={onClear}>
            <X size={15} />
          </Button>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid gap-2 text-sm">
          <TopologyDetail label="IP gestion" value={selectedNode.managementIp} />
          <TopologyDetail label="Serial" value={selectedNode.serial} />
          <TopologyDetail label="Rol" value={selectedNode.role} />
          <TopologyDetail label="Sitio" value={selectedNode.site} />
          <TopologyDetail label="Software" value={selectedNode.softwareVersion} />
          <TopologyDetail label="Tipo" value={selectedNode.deviceType} />
        </div>
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Capa topologica</p>
              <p className="mt-1 text-sm font-semibold">{selectedNode.layerLabel}</p>
            </div>
            {selectedNode.layerOverride && <Badge tone="info">Override manual</Badge>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{selectedNode.layerReason}</p>
          <div className="mt-3">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selectedNode.layerOverride ? selectedNode.layerId : "auto"}
              onChange={(event) => onLayerOverride(selectedNode.id, event.target.value === "auto" ? null : event.target.value as TopologyLayerId)}
            >
              <option value="auto">Automatico: {selectedNode.layerLabel}</option>
              {topologyLayerOrder.map((layerId) => (
                <option key={layerId} value={layerId}>{topologyLayerConfig[layerId].label}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {selectedNode.layerEvidence.length === 0 ? (
              <Badge>Sin evidencia explicita</Badge>
            ) : (
              selectedNode.layerEvidence.map((evidence) => <Badge key={evidence}>{evidence}</Badge>)
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Conexiones directas</p>
          <div className="mt-2 space-y-2">
            {directEdges.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin conexiones directas identificadas.</p>
            ) : (
              directEdges.map((edge) => {
                const peerId = edge.sourceId === selectedNode.id ? edge.targetId : edge.sourceId;
                const peer = graph.nodes.find((node) => node.id === peerId);
                return (
                  <div key={edge.id} className="rounded-md border border-border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{peer?.hostname ?? "Nodo desconocido"}</span>
                      <Badge tone={edge.protocol === "cdp" ? "info" : "success"}>{edge.protocol.toUpperCase()}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {edge.localInterface} ↔ {edge.remoteInterface} · {Math.round(edge.confidence * 100)}%
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopologyDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium">{value || "Pendiente"}</p>
    </div>
  );
}

function ScopeTab({
  record,
  activeFindings,
  onScopeChange,
  onGoInventory
}: {
  record: AssessmentRecord;
  activeFindings: Finding[];
  onScopeChange: (patch: Partial<ScopeDefinition>) => void;
  onGoInventory: () => void;
}) {
  const includedAssets = record.targetInventory.filter((asset) => asset.included).length;
  const scopeCompletion = [
    record.scope.businessContext.trim(),
    record.scope.sites.trim(),
    record.scope.objectives.length > 0,
    record.scope.environments.length > 0,
    record.scope.deliverables.length > 0,
    record.scope.constraints.trim()
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <DashboardSummary record={record} activeFindings={activeFindings} onGoEvidence={onGoInventory} />

      <Panel>
        <PanelHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Alcance de evaluacion</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Define con el cliente que ambientes, objetivos, entregables y restricciones entran en el assessment.
              </p>
            </div>
            <Badge tone={scopeCompletion >= 5 ? "success" : "warning"}>{scopeCompletion}/6 secciones listas</Badge>
          </div>
        </PanelHeader>
        <PanelBody>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ScopeFact label="Cliente" value={record.client.name} icon={Building2} />
            <ScopeFact label="Dominios" value={record.assessment.domains.map(domainLabel).join(", ") || "Pendiente"} icon={Network} />
            <ScopeFact label="Equipos incluidos" value={includedAssets || "Pendiente"} icon={Server} />
            <ScopeFact label="Hallazgos activos" value={activeFindings.length} icon={AlertTriangle} />
          </div>
        </PanelBody>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Panel>
          <PanelHeader>
            <h2 className="text-sm font-semibold">Contexto y cobertura</h2>
          </PanelHeader>
          <PanelBody className="space-y-4">
            <Field label="Contexto de negocio">
              <Textarea
                className="min-h-32"
                value={record.scope.businessContext}
                onChange={(event) => onScopeChange({ businessContext: event.target.value })}
                placeholder="Describe criticidad del ambiente, drivers del assessment y restricciones de negocio."
              />
            </Field>
            <Field label="Sitios / ubicaciones">
              <Textarea
                className="min-h-28"
                value={record.scope.sites}
                onChange={(event) => onScopeChange({ sites: event.target.value })}
                placeholder="Data centers, campus, sucursales, laboratorios o ambientes remotos."
              />
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <h2 className="text-sm font-semibold">Condiciones de evaluacion</h2>
          </PanelHeader>
          <PanelBody className="space-y-4">
            <Field label="Ambientes incluidos">
              <Input
                value={record.scope.environments.join(", ")}
                onChange={(event) => onScopeChange({ environments: splitCsv(event.target.value) })}
                placeholder="Produccion, DR, Campus, Core, DC"
              />
            </Field>
            <Field label="Restricciones">
              <Textarea
                className="min-h-28"
                value={record.scope.constraints}
                onChange={(event) => onScopeChange({ constraints: event.target.value })}
                placeholder="Ventanas, accesos, equipos excluidos, confidencialidad"
              />
            </Field>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Esta informacion alimenta el SOW preliminar, la generacion de scripts y los criterios de evaluacion.
            </div>
          </PanelBody>
        </Panel>
      </div>

      <PerformanceScopePanel
        scope={record.scope.performanceAnalysis}
        onChange={(performanceAnalysis) => onScopeChange({ performanceAnalysis })}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <h2 className="text-sm font-semibold">Objetivos del assessment</h2>
          </PanelHeader>
          <PanelBody>
            <ChecklistEditor
              title="Selecciona los objetivos acordados"
              values={record.scope.objectives}
              options={defaultObjectives}
              onChange={(objectives) => onScopeChange({ objectives })}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <h2 className="text-sm font-semibold">Entregables esperados</h2>
          </PanelHeader>
          <PanelBody>
            <ChecklistEditor
              title="Selecciona los entregables incluidos"
              values={record.scope.deliverables}
              options={defaultDeliverables}
              onChange={(deliverables) => onScopeChange({ deliverables })}
            />
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

function PerformanceScopePanel({
  scope,
  onChange
}: {
  scope: PerformanceScope;
  onChange: (scope: PerformanceScope) => void;
}) {
  function patch(patchValue: Partial<PerformanceScope>) {
    onChange({ ...scope, ...patchValue });
  }

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Performance Analysis</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Capacidad opcional para evaluar utilizacion, errores, drops, recursos y brechas de visibilidad con evidencia de performance.
          </p>
        </div>
        <Badge tone={scope.enabled ? "success" : "neutral"}>{scope.enabled ? "Incluido" : "Fuera de alcance"}</Badge>
      </PanelHeader>
      <PanelBody className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-3">
            <span>
              <span className="block text-sm font-semibold">Incluir en assessment</span>
              <span className="block text-xs text-muted-foreground">Activa scripts, evidencia, analisis, hallazgos y resumen de performance.</span>
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={scope.enabled}
              onChange={(event) => patch({ enabled: event.target.checked })}
            />
          </label>
          <Field label="Modo de analisis">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={scope.mode}
              disabled={!scope.enabled}
              onChange={(event) => patch({ mode: event.target.value as PerformanceAnalysisMode })}
            >
              <option value="snapshot">Snapshot</option>
              <option value="historical">Historico</option>
              <option value="hybrid">Hibrido</option>
            </select>
          </Field>
          <Field label="Notas de alcance">
            <Textarea
              className="min-h-20"
              value={scope.notes ?? ""}
              disabled={!scope.enabled}
              onChange={(event) => patch({ notes: event.target.value })}
              placeholder="Ventanas de muestreo, herramientas NMS disponibles o restricciones de performance."
            />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Evidencia esperada</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {performanceExpectedEvidenceTypes.slice(0, 6).map((item) => (
                <Badge key={item} tone={scope.enabled ? "info" : "neutral"}>{item}</Badge>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Metricas incluidas</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {performanceIncludedMetrics.slice(0, 10).map((item) => (
                <Badge key={item} tone={scope.enabled ? "success" : "neutral"}>{item.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function ScopeFact({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-white text-primary shadow-subtle">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function InventoryTab({
  record,
  onAddAsset,
  onImportAssets,
  onRemoveAsset,
  onToggleAssetIncluded,
  onUpdateAssetTopologyLayer,
  onClearAssets,
  onRemoveDuplicateAssets
}: {
  record: AssessmentRecord;
  onAddAsset: (asset: Omit<InventoryAsset, "id">) => void;
  onImportAssets: (assets: Array<Omit<InventoryAsset, "id">>) => void;
  onRemoveAsset: (assetId: string) => void;
  onToggleAssetIncluded: (assetId: string) => void;
  onUpdateAssetTopologyLayer: (assetId: string, topologyLayer: TopologyLayerId | null) => void;
  onClearAssets: () => void;
  onRemoveDuplicateAssets: () => void;
}) {
  const duplicateSerials = duplicateSerialSet(record.targetInventory);
  const duplicateCount = record.targetInventory.filter((item) => duplicateSerials.has(normalizedSerial(item.serial))).length;
  const includedCount = record.targetInventory.filter((item) => item.included).length;
  const [importStatus, setImportStatus] = useState<{ tone: "success" | "danger" | "info"; message: string } | null>(null);
  const [asset, setAsset] = useState<Omit<InventoryAsset, "id">>({
    hostname: "",
    managementIp: "",
    serial: "",
    model: "",
    deviceType: "switch",
    platform: "ios-xe",
    role: "access",
    site: "",
    topologyLayer: undefined,
    priority: "medium",
    included: true
  });

  function saveAsset() {
    if (!asset.hostname.trim() || !asset.managementIp.trim()) return;
    onAddAsset({
      ...asset,
      hostname: asset.hostname.trim(),
      managementIp: asset.managementIp.trim(),
      serial: asset.serial.trim(),
      model: asset.model.trim(),
      site: asset.site.trim()
    });
    setAsset({ hostname: "", managementIp: "", serial: "", model: "", deviceType: "switch", platform: "ios-xe", role: "access", site: "", topologyLayer: undefined, priority: "medium", included: true });
  }

  async function handleInventoryWorkbookUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus({ tone: "info", message: `Cargando ${file.name}...` });
    const result = await importInventoryWorkbook(file);
    if (result.errors.length > 0) {
      setImportStatus({ tone: "danger", message: result.errors.join(" ") });
      event.target.value = "";
      return;
    }

    onImportAssets(
      result.rows.map((row) => {
        const normalizedAsset = {
          hostname: row.hostname,
          managementIp: row.managementIp,
          serial: row.serial || "Pendiente",
          model: row.model || "Pendiente",
          deviceType: normalizeDeviceType(row.deviceType),
          platform: row.platform || "ios-xe",
          role: row.role || "pending",
          site: row.site || "Pendiente",
          topologyLayer: normalizeTopologyLayer(row.topologyLayer),
          priority: normalizePriority(row.priority),
          included: true
        };
        return {
          ...normalizedAsset,
          deviceType: row.deviceType ? normalizedAsset.deviceType : inferDeviceType(normalizedAsset)
        };
      })
    );
    setImportStatus({ tone: "success", message: `${result.rows.length} equipos importados desde ${file.name}. Revisa duplicados e inclusion.` });
    event.target.value = "";
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Inventario objetivo del cliente</h2>
            <p className="text-xs text-muted-foreground">
              {record.targetInventory.length} equipos cargados · {includedCount} incluidos · {duplicateCount} duplicados por serial
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition hover:bg-muted/70">
              <Upload size={16} />
              Cargar Excel
              <input className="sr-only" type="file" accept=".xlsx" onChange={handleInventoryWorkbookUpload} />
            </label>
            <Button
              variant="secondary"
              onClick={() =>
                exportInventoryTemplate({
                  clientName: record.client.name,
                  assessmentName: record.assessment.name,
                  industry: record.client.industry,
                  owner: record.client.owner,
                  domains: record.assessment.domains,
                  status: record.assessment.status,
                  assessmentCreatedAt: record.assessment.createdAt,
                  updatedAt: record.updatedAt
                })
              }
            >
              <FileDown size={16} />
              Template Excel
            </Button>
          </div>
        </PanelHeader>
        {importStatus && (
          <div className="border-b border-border px-4 py-3">
            <Badge tone={importStatus.tone}>{importStatus.message}</Badge>
          </div>
        )}
        <PanelBody className="grid gap-3 md:grid-cols-4">
          <Field label="Hostname">
            <Input value={asset.hostname} onChange={(event) => setAsset({ ...asset, hostname: event.target.value })} />
          </Field>
          <Field label="IP gestion">
            <Input value={asset.managementIp} onChange={(event) => setAsset({ ...asset, managementIp: event.target.value })} />
          </Field>
          <Field label="Serial">
            <Input value={asset.serial} onChange={(event) => setAsset({ ...asset, serial: event.target.value })} />
          </Field>
          <Field label="Modelo">
            <Input value={asset.model} onChange={(event) => setAsset({ ...asset, model: event.target.value })} />
          </Field>
          <Field label="Tipo equipo">
            <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={asset.deviceType} onChange={(event) => setAsset({ ...asset, deviceType: event.target.value as DeviceType })}>
              <option value="switch">Switch</option>
              <option value="router">Router</option>
              <option value="nexus-switch">Switch Nexus</option>
              <option value="aci">ACI</option>
              <option value="wireless-controller">WLC</option>
              <option value="firewall">Firewall</option>
              <option value="other">Otro</option>
            </select>
          </Field>
          <Field label="Plataforma">
            <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={asset.platform} onChange={(event) => setAsset({ ...asset, platform: event.target.value })}>
              <option value="ios-xe">IOS XE</option>
              <option value="nx-os">NX-OS</option>
              <option value="ios">IOS</option>
              <option value="aci">ACI</option>
            </select>
          </Field>
          <Field label="Rol">
            <Input value={asset.role} onChange={(event) => setAsset({ ...asset, role: event.target.value })} />
          </Field>
          <Field label="Sitio">
            <Input value={asset.site} onChange={(event) => setAsset({ ...asset, site: event.target.value })} />
          </Field>
          <Field label="Segmento topologico">
            <select
              className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
              value={asset.topologyLayer ?? "auto"}
              onChange={(event) => setAsset({ ...asset, topologyLayer: event.target.value === "auto" ? undefined : event.target.value as TopologyLayerId })}
            >
              <option value="auto">Auto</option>
              {topologyLayerOrder.map((layerId) => (
                <option key={layerId} value={layerId}>{topologyLayerConfig[layerId].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Prioridad">
            <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={asset.priority} onChange={(event) => setAsset({ ...asset, priority: event.target.value as InventoryAsset["priority"] })}>
              <option value="critical">Critica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </Field>
          <div className="md:col-span-4">
            <Button onClick={saveAsset} disabled={!asset.hostname.trim() || !asset.managementIp.trim()}>
              <Plus size={16} />
              Agregar equipo
            </Button>
          </div>
        </PanelBody>
      </Panel>

      <InventoryTable
        assets={record.targetInventory}
        duplicateSerials={duplicateSerials}
        onRemoveAsset={onRemoveAsset}
        onToggleAssetIncluded={onToggleAssetIncluded}
        onUpdateAssetTopologyLayer={onUpdateAssetTopologyLayer}
        onClearAssets={onClearAssets}
        onRemoveDuplicateAssets={onRemoveDuplicateAssets}
      />
    </div>
  );
}

function InventoryTable({
  assets,
  duplicateSerials,
  onRemoveAsset,
  onToggleAssetIncluded,
  onUpdateAssetTopologyLayer,
  onClearAssets,
  onRemoveDuplicateAssets
}: {
  assets: InventoryAsset[];
  duplicateSerials: Set<string>;
  onRemoveAsset: (assetId: string) => void;
  onToggleAssetIncluded: (assetId: string) => void;
  onUpdateAssetTopologyLayer: (assetId: string, topologyLayer: TopologyLayerId | null) => void;
  onClearAssets: () => void;
  onRemoveDuplicateAssets: () => void;
}) {
  const [sort, setSort] = useState<{ key: InventorySortKey; direction: SortDirection }>({ key: "hostname", direction: "asc" });
  const sortedAssets = useMemo(() => sortInventoryAssets(assets, sort.key, sort.direction), [assets, sort]);
  const duplicateCount = assets.filter((asset) => duplicateSerials.has(normalizedSerial(asset.serial))).length;

  if (assets.length === 0) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState icon={<Server size={24} />} title="Sin inventario objetivo cargado" />
        </PanelBody>
      </Panel>
    );
  }

  function toggleSort(key: InventorySortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Equipos a evaluar</h2>
          <p className="text-xs text-muted-foreground">Selecciona inclusion, revisa duplicados y elimina equipos que no correspondan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onRemoveDuplicateAssets} disabled={duplicateCount === 0}>
            <Trash2 size={16} />
            Eliminar duplicados
          </Button>
          <Button variant="danger" onClick={onClearAssets} disabled={assets.length === 0}>
            <Trash2 size={16} />
            Borrar inventario
          </Button>
        </div>
      </PanelHeader>
      <PanelBody>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
              <tr>
                <SortableInventoryHeader label="Incluido" sortKey="included" activeSort={sort} onSort={toggleSort} />
                <SortableInventoryHeader label="Hostname" sortKey="hostname" activeSort={sort} onSort={toggleSort} />
                <SortableInventoryHeader label="IP gestion" sortKey="managementIp" activeSort={sort} onSort={toggleSort} />
                <SortableInventoryHeader label="Serial" sortKey="serial" activeSort={sort} onSort={toggleSort} />
                <SortableInventoryHeader label="Modelo" sortKey="model" activeSort={sort} onSort={toggleSort} />
                <SortableInventoryHeader label="Tipo" sortKey="deviceType" activeSort={sort} onSort={toggleSort} />
                <SortableInventoryHeader label="Rol / Sitio" sortKey="role" activeSort={sort} onSort={toggleSort} />
                <SortableInventoryHeader label="Segmento topologico" sortKey="topologyLayer" activeSort={sort} onSort={toggleSort} />
                <SortableInventoryHeader label="Prioridad" sortKey="priority" activeSort={sort} onSort={toggleSort} />
                <th className="border-b border-border px-3 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {sortedAssets.map((asset) => {
                const serial = normalizedSerial(asset.serial);
                const isDuplicate = duplicateSerials.has(serial);
                return (
                  <tr key={asset.id} className={cn(isDuplicate && "bg-rose-50")}>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={asset.included}
                        onChange={() => onToggleAssetIncluded(asset.id)}
                      />
                    </td>
                    <td className="px-3 py-2 align-top font-medium">{asset.hostname}</td>
                    <td className="px-3 py-2 align-top">{asset.managementIp}</td>
                    <td className={cn("px-3 py-2 align-top", isDuplicate && "font-semibold text-rose-700")}>
                      {asset.serial || "Pendiente"}
                      {isDuplicate && <span className="ml-2 text-xs">duplicado</span>}
                    </td>
                    <td className="px-3 py-2 align-top">{asset.model}</td>
                    <td className="px-3 py-2 align-top">{deviceTypeLabel(asset.deviceType)}</td>
                    <td className="px-3 py-2 align-top">
                      <span className="block">{asset.role}</span>
                      <span className="text-xs text-muted-foreground">{asset.site}</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <select
                        className="h-9 min-w-40 rounded-md border border-border bg-white px-2 text-xs"
                        value={asset.topologyLayer ?? "auto"}
                        onChange={(event) => onUpdateAssetTopologyLayer(asset.id, event.target.value === "auto" ? null : event.target.value as TopologyLayerId)}
                        title="Ajustar segmento topologico"
                      >
                        <option value="auto">Auto</option>
                        {topologyLayerOrder.map((layerId) => (
                          <option key={layerId} value={layerId}>{topologyLayerConfig[layerId].shortLabel}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 align-top">{asset.priority}</td>
                    <td className="px-3 py-2 align-top">
                      <Button size="icon" variant="secondary" title="Eliminar" onClick={() => onRemoveAsset(asset.id)}>
                        <Trash2 size={15} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PanelBody>
    </Panel>
  );
}

function SortableInventoryHeader({
  label,
  sortKey,
  activeSort,
  onSort
}: {
  label: string;
  sortKey: InventorySortKey;
  activeSort: { key: InventorySortKey; direction: SortDirection };
  onSort: (key: InventorySortKey) => void;
}) {
  const isActive = activeSort.key === sortKey;
  const Icon = !isActive ? ArrowUpDown : activeSort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <th className="border-b border-border px-2 py-2 font-semibold">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1 rounded px-1 py-1 text-left text-xs uppercase transition hover:bg-white",
          isActive && "text-primary"
        )}
        onClick={() => onSort(sortKey)}
        title={`Ordenar por ${label}`}
      >
        <span>{label}</span>
        <Icon size={13} className="shrink-0" />
      </button>
    </th>
  );
}

function SowTab({ record, documentTemplates }: { record: AssessmentRecord; documentTemplates: DocumentTemplateVersion[] }) {
  const sowItems = buildSow(record);
  const activeTemplate = documentTemplates.find((template) => template.documentType === "sow" && template.status === "active");

  async function generateSowDocument() {
    if (!activeTemplate) {
      window.alert("No existe plantilla vigente para SOW. Descarga la plantilla base en Ajustes, formateala, subela y activala antes de generar el documento final.");
      return;
    }

    const validationResult = await validateUploadedTemplate(dataUrlToBlob(activeTemplate.templateFileDataUrl), "sow");
    const compatibility = compareTemplateWithCurrentDefinition({ ...activeTemplate, validationResult });
    if (!validationResult.canActivate || compatibility.compatibilityStatus === "incompatible") {
      window.alert("La plantilla vigente de SOW ya no es compatible. Revalidala o sube una version actualizada en Ajustes.");
      return;
    }

    const rendered = await renderDocxTemplate(dataUrlToBlob(activeTemplate.templateFileDataUrl), mapAssessmentDataToPlaceholders(record, "sow"));
    downloadBlob(`${safeFileName(record.assessment.name)}-sow.docx`, rendered);
  }

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">SOW preliminar autogenerado</h2>
          <p className="text-xs text-muted-foreground">Servicios, alcance, supuestos y entregables derivados del formulario de alcance.</p>
        </div>
        <Button variant="secondary" onClick={generateSowDocument} disabled={!activeTemplate}>
          <FileDown size={16} />
          Generar SOW
        </Button>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {!activeTemplate && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Para generar el SOW final se requiere una plantilla Word vigente en Ajustes. La plantilla base no se usa automaticamente como entregable final.
          </div>
        )}
        {sowItems.map((item) => (
          <div key={item.title} className="rounded-md border border-border p-3">
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

function ScriptsTab({ record }: { record: AssessmentRecord }) {
  const [view, setView] = useState<"status" | "performance">("status");
  const script = buildCollectionScript(record);
  const performanceScript = buildPerformanceCollectionScript(record);
  const scriptGroups = buildScriptGroups(record);
  const performanceGroups = buildPerformanceScriptGroups(record);
  const performanceEnabled = record.scope.performanceAnalysis.enabled;
  const effectiveView = performanceEnabled ? view : "status";
  const downloadName = effectiveView === "performance" ? `${safeFileName(record.assessment.name)}-performance-scripts.txt` : `${safeFileName(record.assessment.name)}-collection-scripts.txt`;
  const downloadContent = effectiveView === "performance" ? performanceScript : script;
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode2 size={16} className="text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Scripts de levantamiento</h2>
            <p className="text-xs text-muted-foreground">Comandos por tipo de equipo generados desde el inventario objetivo.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border bg-white p-1">
            <button className={cn("h-8 rounded px-3 text-sm", effectiveView === "status" ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => setView("status")}>Status / Config</button>
            {performanceEnabled && (
              <button className={cn("h-8 rounded px-3 text-sm", effectiveView === "performance" ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => setView("performance")}>Performance</button>
            )}
          </div>
          <Button variant="secondary" onClick={() => downloadTextFile(downloadName, downloadContent)}>
            <FileDown size={16} />
            Descargar TXT
          </Button>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(effectiveView === "performance" ? performanceGroups : scriptGroups).map((group) => (
            <div key={group.deviceType} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{deviceTypeLabel(group.deviceType as DeviceType)}</p>
                <Badge tone={group.assets.length > 0 ? "info" : "neutral"}>{group.assets.length} equipos</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {group.assets.length === 0 ? (
                  <Badge>Sin equipos</Badge>
                ) : (
                  group.assets.map((asset) => <Badge key={asset.id}>{asset.hostname}</Badge>)
                )}
              </div>
            </div>
          ))}
        </div>
        <pre className="max-h-[520px] overflow-auto rounded-md border border-border bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">{downloadContent}</pre>
      </PanelBody>
    </Panel>
  );
}

function EvidenceTab({
  record,
  isParsing,
  onEvidenceUpload,
  onPerformanceEvidenceUpload,
  onRemoveEvidenceFile,
  onClearEvidenceFiles,
  onRemovePerformanceEvidenceFile,
  onClearPerformanceEvidenceFiles,
  onToggleEvidenceRowSkip
}: {
  record: AssessmentRecord;
  isParsing: boolean;
  onEvidenceUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPerformanceEvidenceUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveEvidenceFile: (fileId: string) => void;
  onClearEvidenceFiles: () => void;
  onRemovePerformanceEvidenceFile: (fileId: string) => void;
  onClearPerformanceEvidenceFiles: () => void;
  onToggleEvidenceRowSkip: (assetId: string) => void;
}) {
  const [view, setView] = useState<"status" | "performance">("status");
  const [evidenceSubtab, setEvidenceSubtab] = useState<"compliance" | "files">("compliance");
  const coverageRows = buildEvidenceCoverageRows(record);
  const completedRows = coverageRows.filter((row) => row.missingCount === 0 && row.skippedCount === 0).length;
  const readyWithSkipsRows = coverageRows.filter((row) => row.missingCount === 0 && row.skippedCount > 0).length;
  const missingRows = coverageRows.filter((row) => row.missingCount > 0).length;
  const performanceEnabled = record.scope.performanceAnalysis.enabled;
  const effectiveView = performanceEnabled ? view : "status";
  const compliancePercent = coverageRows.length === 0 ? 0 : Math.round((completedRows / coverageRows.length) * 100);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Carga de data obtenida</h2>
            <p className="text-xs text-muted-foreground">TXT, LOG y ZIP generados por los scripts de levantamiento.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border bg-white p-1">
              <button className={cn("h-8 rounded px-3 text-sm", effectiveView === "status" ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => setView("status")}>Status / Config</button>
              {performanceEnabled && (
                <button className={cn("h-8 rounded px-3 text-sm", effectiveView === "performance" ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => setView("performance")}>Performance</button>
              )}
            </div>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Upload size={16} />
              Subir
              <input
                className="sr-only"
                type="file"
                multiple
                accept={effectiveView === "performance" ? ".txt,.log,.csv,.zip,.xlsx,.pdf" : ".txt,.log,.zip"}
                onChange={effectiveView === "performance" ? onPerformanceEvidenceUpload : onEvidenceUpload}
              />
            </label>
          </div>
        </PanelHeader>
        <PanelBody>
          {effectiveView === "performance" ? (
            <PerformanceEvidenceSummaryPanel record={record} />
          ) : isParsing ? (
            <div className="rounded-md border border-border bg-muted/50 p-6 text-sm">Procesando evidencia...</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <EvidenceMetric label="Archivos cargados" value={record.evidenceFiles.length} tone="info" />
              <EvidenceMetric label="Completed" value={completedRows} tone="success" />
              <EvidenceMetric label="Con skip" value={readyWithSkipsRows} tone="warning" />
              <EvidenceMetric label="Pendientes" value={missingRows} tone={missingRows > 0 ? "danger" : "success"} />
            </div>
          )}
        </PanelBody>
      </Panel>

      {effectiveView === "performance" ? (
        <PerformanceEvidencePanel
          record={record}
          onRemovePerformanceEvidenceFile={onRemovePerformanceEvidenceFile}
          onClearPerformanceEvidenceFiles={onClearPerformanceEvidenceFiles}
        />
      ) : (
        <EvidenceStatusSubtabs
          activeSubtab={evidenceSubtab}
          compliancePercent={compliancePercent}
          fileCount={record.evidenceFiles.length}
          coverageRows={coverageRows}
          evidenceFiles={record.evidenceFiles}
          onSubtabChange={setEvidenceSubtab}
          onRemoveEvidenceFile={onRemoveEvidenceFile}
          onClearEvidenceFiles={onClearEvidenceFiles}
          onToggleEvidenceRowSkip={onToggleEvidenceRowSkip}
        />
      )}
    </div>
  );
}

function EvidenceStatusSubtabs({
  activeSubtab,
  compliancePercent,
  fileCount,
  coverageRows,
  evidenceFiles,
  onSubtabChange,
  onRemoveEvidenceFile,
  onClearEvidenceFiles,
  onToggleEvidenceRowSkip
}: {
  activeSubtab: "compliance" | "files";
  compliancePercent: number;
  fileCount: number;
  coverageRows: EvidenceCoverageRow[];
  evidenceFiles: EvidenceFile[];
  onSubtabChange: (subtab: "compliance" | "files") => void;
  onRemoveEvidenceFile: (fileId: string) => void;
  onClearEvidenceFiles: () => void;
  onToggleEvidenceRowSkip: (assetId: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Evidencia</h2>
          <p className="text-xs text-muted-foreground">Cumplimiento por equipo y archivos recibidos separados para reducir scroll.</p>
        </div>
        <div className="flex rounded-md border border-border bg-white p-1">
          <button
            type="button"
            className={cn("flex h-8 items-center gap-2 rounded px-3 text-xs font-medium", activeSubtab === "compliance" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            onClick={() => onSubtabChange("compliance")}
          >
            Cumplimiento de Evidencia
            <Badge tone={compliancePercent >= 80 ? "success" : compliancePercent >= 50 ? "warning" : "neutral"}>{compliancePercent}%</Badge>
          </button>
          <button
            type="button"
            className={cn("flex h-8 items-center gap-2 rounded px-3 text-xs font-medium", activeSubtab === "files" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            onClick={() => onSubtabChange("files")}
          >
            Archivos Recibidos
            <Badge tone={fileCount > 0 ? "info" : "neutral"}>{fileCount}</Badge>
          </button>
        </div>
      </PanelHeader>
      <PanelBody>
        {activeSubtab === "compliance" ? (
          <EvidenceCompliancePanel coverageRows={coverageRows} onToggleEvidenceRowSkip={onToggleEvidenceRowSkip} />
        ) : (
          <EvidenceFilesPanel
            evidenceFiles={evidenceFiles}
            onRemoveEvidenceFile={onRemoveEvidenceFile}
            onClearEvidenceFiles={onClearEvidenceFiles}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

function EvidenceCompliancePanel({
  coverageRows,
  onToggleEvidenceRowSkip
}: {
  coverageRows: EvidenceCoverageRow[];
  onToggleEvidenceRowSkip: (assetId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Matriz de cumplimiento de evidencia</h2>
        <p className="text-xs text-muted-foreground">Revision por equipo incluido en inventario y salidas requeridas para el analisis.</p>
      </div>
      {coverageRows.length === 0 ? (
        <EmptyState icon={<Server size={24} />} title="Sin inventario incluido para revisar" />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-[hsl(var(--surface-raised))]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[hsl(var(--surface-muted))] text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-52 px-3 py-2 font-semibold">Equipo</th>
                <th className="w-28 px-3 py-2 font-semibold">IP</th>
                <th className="w-36 px-3 py-2 font-semibold">Estado</th>
                <th className="w-32 px-3 py-2 font-semibold">Accion</th>
                {evidenceRequirements.map((requirement) => (
                  <th key={requirement.id} className="px-2 py-2 text-center font-semibold" title={requirement.label}>{requirement.shortLabel}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {coverageRows.map((row) => (
                <tr
                  key={row.assetId}
                  className={cn(
                    "transition-colors hover:bg-[hsl(var(--surface-muted))]",
                    row.missingCount === 0 && row.skippedCount === 0
                      ? "bg-emerald-500/10"
                      : row.missingCount === 0
                        ? "bg-amber-500/10"
                        : "bg-[hsl(var(--surface-raised))]"
                  )}
                >
                  <td className="px-3 py-3 align-middle">
                    <p className="font-semibold text-foreground">{row.hostname}</p>
                    <p className="text-xs text-muted-foreground/90">{row.model} · {row.role || "Rol pendiente"}</p>
                  </td>
                  <td className="px-3 py-3 align-middle text-sm font-medium text-muted-foreground/95">{row.managementIp || "Pendiente"}</td>
                  <td className="px-3 py-3 align-middle">
                    <EvidenceRowStatus row={row} />
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <EvidenceRowAction row={row} onToggleEvidenceRowSkip={onToggleEvidenceRowSkip} />
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.requirementId} className="px-2 py-3 align-middle">
                      <EvidenceRequirementCell cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EvidenceFilesPanel({
  evidenceFiles,
  onRemoveEvidenceFile,
  onClearEvidenceFiles
}: {
  evidenceFiles: EvidenceFile[];
  onRemoveEvidenceFile: (fileId: string) => void;
  onClearEvidenceFiles: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Archivos recibidos</h2>
        <Button variant="danger" size="sm" onClick={onClearEvidenceFiles} disabled={evidenceFiles.length === 0}>
          <Trash2 size={14} />
          Borrar todo
        </Button>
      </div>
      {evidenceFiles.length === 0 ? (
        <EmptyState icon={<FileArchive size={24} />} title="Sin data cargada" />
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {evidenceFiles.map((file) => (
            <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <FileText size={16} className="shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(file.uploadedAt)} · {file.type.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{Math.round(file.content.length / 1024)} KB</Badge>
                <Button size="icon" variant="secondary" title="Borrar archivo" onClick={() => onRemoveEvidenceFile(file.id)}>
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PerformanceEvidenceSummaryPanel({ record }: { record: AssessmentRecord }) {
  const performance = record.performance;
  if (!record.scope.performanceAnalysis.enabled) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
        Performance Analysis esta fuera de alcance. Activalo en Alcance antes de cargar evidencia de rendimiento.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <EvidenceMetric label="Archivos performance" value={performance.evidenceFiles.length} tone="info" />
      <EvidenceMetric label="Metricas" value={performance.metrics.length} tone="success" />
      <EvidenceMetric label="Confianza" value={`${performance.assessment.confidenceScore}%`} tone={performance.assessment.confidenceScore >= 70 ? "success" : "warning"} />
      <EvidenceMetric label="Riesgo performance" value={`${performance.assessment.performanceRiskScore}/100`} tone={performance.assessment.performanceRiskScore >= 60 ? "danger" : "info"} />
    </div>
  );
}

function PerformanceEvidencePanel({
  record,
  onRemovePerformanceEvidenceFile,
  onClearPerformanceEvidenceFiles
}: {
  record: AssessmentRecord;
  onRemovePerformanceEvidenceFile: (fileId: string) => void;
  onClearPerformanceEvidenceFiles: () => void;
}) {
  const [performanceEvidenceSubtab, setPerformanceEvidenceSubtab] = useState<"compliance" | "files">("compliance");

  if (!record.scope.performanceAnalysis.enabled) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState icon={<FileArchive size={24} />} title="Performance Analysis fuera de alcance" />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Evidencia de performance</h2>
          <p className="text-xs text-muted-foreground">Evidencia recibida y metricas reconocidas separadas para reducir scroll.</p>
        </div>
        <div className="flex rounded-md border border-border bg-white p-1">
          <button
            type="button"
            className={cn("flex h-8 items-center gap-2 rounded px-3 text-xs font-medium", performanceEvidenceSubtab === "compliance" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            onClick={() => setPerformanceEvidenceSubtab("compliance")}
          >
            Cumplimiento de Evidencia
            <Badge tone={record.performance.evidenceFiles.length > 0 ? "info" : "neutral"}>{record.performance.evidenceFiles.length}</Badge>
          </button>
          <button
            type="button"
            className={cn("flex h-8 items-center gap-2 rounded px-3 text-xs font-medium", performanceEvidenceSubtab === "files" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
            onClick={() => setPerformanceEvidenceSubtab("files")}
          >
            Archivos Recibidos
            <Badge tone={record.performance.metrics.length > 0 ? "success" : "neutral"}>{record.performance.metrics.length}</Badge>
          </button>
        </div>
      </PanelHeader>
      <PanelBody>
        {performanceEvidenceSubtab === "compliance" ? (
          <PerformanceEvidenceFilesPanel
            record={record}
            onRemovePerformanceEvidenceFile={onRemovePerformanceEvidenceFile}
            onClearPerformanceEvidenceFiles={onClearPerformanceEvidenceFiles}
          />
        ) : (
          <PerformanceMetricsPanel record={record} />
        )}
      </PanelBody>
    </Panel>
  );
}

function PerformanceEvidenceFilesPanel({
  record,
  onRemovePerformanceEvidenceFile,
  onClearPerformanceEvidenceFiles
}: {
  record: AssessmentRecord;
  onRemovePerformanceEvidenceFile: (fileId: string) => void;
  onClearPerformanceEvidenceFiles: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Cumplimiento de evidencia performance</h2>
          <p className="text-xs text-muted-foreground">Archivos CLI, NMS, telemetria, syslog, NetFlow o reportes usados para metricas de rendimiento.</p>
        </div>
        <Button variant="danger" size="sm" onClick={onClearPerformanceEvidenceFiles} disabled={record.performance.evidenceFiles.length === 0}>
          <Trash2 size={14} />
          Borrar todo
        </Button>
      </div>
      {record.performance.evidenceFiles.length === 0 ? (
        <EmptyState icon={<FileArchive size={24} />} title="Sin evidencia de performance cargada" />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Archivo</th>
                <th className="px-3 py-2 font-semibold">Fuente</th>
                <th className="px-3 py-2 font-semibold">Equipo</th>
                <th className="px-3 py-2 font-semibold">Ventana</th>
                <th className="px-3 py-2 font-semibold">Metricas</th>
                <th className="px-3 py-2 font-semibold">Confianza</th>
                <th className="px-3 py-2 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {record.performance.evidenceFiles.map((file) => (
                <tr key={file.id}>
                  <td className="px-3 py-3 align-top">
                    <p className="font-semibold">{file.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(file.uploadedAt)}</p>
                  </td>
                  <td className="px-3 py-3 align-top">{file.sourceType.replace(/_/g, " ")}</td>
                  <td className="px-3 py-3 align-top">{file.deviceName}</td>
                  <td className="px-3 py-3 align-top">{file.timeWindow}</td>
                  <td className="px-3 py-3 align-top">{file.parsedMetricCount}</td>
                  <td className="px-3 py-3 align-top"><Badge tone={file.confidenceScore >= 70 ? "success" : "warning"}>{file.confidenceScore}%</Badge></td>
                  <td className="px-3 py-3 align-top">
                    <Button size="icon" variant="secondary" title="Borrar archivo performance" onClick={() => onRemovePerformanceEvidenceFile(file.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PerformanceMetricsPanel({ record }: { record: AssessmentRecord }) {
  if (record.performance.metrics.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Metricas reconocidas</h2>
          <EmptyState icon={<Network size={24} />} title="Sin metricas reconocidas por el parser de performance" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
        <h2 className="text-sm font-semibold">Metricas reconocidas</h2>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Equipo</th>
                <th className="px-3 py-2 font-semibold">Interfaz</th>
                <th className="px-3 py-2 font-semibold">Metrica</th>
                <th className="px-3 py-2 font-semibold">Valor</th>
                <th className="px-3 py-2 font-semibold">Muestra</th>
                <th className="px-3 py-2 font-semibold">Fuente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {record.performance.metrics.slice(0, 80).map((metric) => (
                <tr key={metric.id}>
                  <td className="px-3 py-2">{metric.deviceId}</td>
                  <td className="px-3 py-2">{metric.interfaceId ?? "Equipo"}</td>
                  <td className="px-3 py-2">{metric.metricType.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 font-semibold">{metric.value}{metric.unit}</td>
                  <td className="px-3 py-2">{metric.sampleType}</td>
                  <td className="px-3 py-2">{metric.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}

function EvidenceMetric({ label, value, tone }: { label: string; value: React.ReactNode; tone: "info" | "success" | "warning" | "danger" }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-2xl font-semibold">{value}</p>
        <Badge tone={tone}>{label}</Badge>
      </div>
    </div>
  );
}

function EvidenceRowStatus({ row }: { row: EvidenceCoverageRow }) {
  if (row.missingCount === 0 && row.skippedCount === 0) {
    return (
      <div className="space-y-1">
        <span className="inline-flex h-6 items-center rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2 text-xs font-semibold text-emerald-200">
          Completed
        </span>
        <p className="text-xs text-muted-foreground/90">{row.collectedCount}/{evidenceRequirements.length} grupos</p>
      </div>
    );
  }
  if (row.missingCount === 0) {
    return (
      <div className="space-y-1">
        <span className="inline-flex h-6 items-center rounded-md border border-amber-400/35 bg-amber-500/15 px-2 text-xs font-semibold text-amber-200">
          Ready con skip
        </span>
        <p className="text-xs text-muted-foreground/90">{row.skippedCount} omitidas</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <span className="inline-flex h-6 items-center rounded-md border border-rose-400/35 bg-rose-500/15 px-2 text-xs font-semibold text-rose-200">
        {row.missingCount} faltantes
      </span>
      <p className="text-xs text-muted-foreground/90">{row.collectedCount}/{evidenceRequirements.length} grupos</p>
    </div>
  );
}

function EvidenceRowAction({ row, onToggleEvidenceRowSkip }: { row: EvidenceCoverageRow; onToggleEvidenceRowSkip: (assetId: string) => void }) {
  if (row.missingCount === 0 && row.skippedCount === 0) {
    return <span className="text-xs font-medium text-muted-foreground/85">Sin accion</span>;
  }

  return (
    <Button size="sm" variant={row.skippedCount > 0 ? "ghost" : "secondary"} className="h-8 whitespace-nowrap px-2.5" onClick={() => onToggleEvidenceRowSkip(row.assetId)}>
      {row.skippedCount > 0 ? "Reincluir" : "Skip fila"}
    </Button>
  );
}

function EvidenceRequirementCell({ cell }: { cell: EvidenceCoverageCell }) {
  const requirement = evidenceRequirements.find((item) => item.id === cell.requirementId);

  if (cell.status === "collected") {
    return (
      <div className="flex justify-center" title={`${requirement?.label ?? cell.requirementId}: ${cell.fileNames.join(", ")}`}>
        <span className="inline-flex h-7 min-w-16 items-center justify-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2 text-xs font-semibold text-emerald-100">
          <Check size={13} />
          OK
        </span>
      </div>
    );
  }

  if (cell.status === "skipped") {
    return (
      <div className="flex justify-center" title={requirement?.label ?? cell.requirementId}>
        <span className="inline-flex h-7 min-w-16 items-center justify-center rounded-md border border-border bg-muted/30 px-2 text-xs font-semibold text-muted-foreground">
          Skip
        </span>
      </div>
    );
  }

  return (
    <div className="flex justify-center" title={requirement?.label ?? cell.requirementId}>
      <span className="inline-flex h-7 min-w-16 items-center justify-center gap-1 rounded-md border border-rose-400/35 bg-rose-500/15 px-2 text-xs font-semibold text-rose-100">
        <X size={13} />
        Falta
      </span>
    </div>
  );
}

function buildEvidenceCoverageRows(record: AssessmentRecord): EvidenceCoverageRow[] {
  const inventoryAssets = record.targetInventory.filter((asset) => asset.included);
  const effectiveParsed = effectiveParsedNetworkData(record);
  const assets =
    inventoryAssets.length > 0
      ? inventoryAssets.map((asset) => ({
          assetId: asset.id,
          hostname: asset.hostname,
          managementIp: asset.managementIp,
          serial: asset.serial,
          model: asset.model,
          role: asset.role
        }))
      : effectiveParsed.devices.map((device) => ({
          assetId: `parsed:${device.id}`,
          hostname: device.hostname,
          managementIp: "No identificado",
          serial: device.serial,
          model: device.model,
          role: device.suggestedRole
        }));

  return assets.map((asset) => {
    const relevantFiles = findEvidenceFilesForAsset(record, asset);
    const cells = evidenceRequirements.map((requirement) => {
      const collectedFiles = relevantFiles.filter((file) => evidenceFileHasRequirement(file, requirement.id));
      const skipped = record.evidenceSkips.some((skip) => skip.assetId === asset.assetId && skip.requirementId === requirement.id);

      return {
        requirementId: requirement.id,
        status: collectedFiles.length > 0 ? "collected" : skipped ? "skipped" : "missing",
        fileNames: collectedFiles.map((file) => file.name)
      } satisfies EvidenceCoverageCell;
    });

    return {
      ...asset,
      cells,
      collectedCount: cells.filter((cell) => cell.status === "collected").length,
      skippedCount: cells.filter((cell) => cell.status === "skipped").length,
      missingCount: cells.filter((cell) => cell.status === "missing").length
    };
  });
}

function findEvidenceFilesForAsset(
  record: AssessmentRecord,
  asset: Pick<EvidenceCoverageRow, "hostname" | "serial">
) {
  const hostname = normalizeEvidenceToken(asset.hostname);
  const serial = normalizeEvidenceToken(asset.serial);
  const parsedDevice = effectiveParsedNetworkData(record).devices.find((device) => normalizeEvidenceToken(device.hostname) === hostname);
  const parsedSourceFiles = new Set(parsedDevice?.sourceFiles ?? []);

  return record.evidenceFiles.filter((file) => {
    const localHostnames = extractEvidenceLocalHostnames(file.content).map(normalizeEvidenceToken);
    const fileName = normalizeEvidenceToken(file.name);
    const contentStart = normalizeEvidenceToken(file.content.slice(0, 2500));

    return (
      parsedSourceFiles.has(file.name) ||
      (!!hostname && localHostnames.includes(hostname)) ||
      (!!hostname && fileName.includes(hostname)) ||
      (!!serial && serial !== "pendiente" && serial !== "noidentificado" && contentStart.includes(serial))
    );
  });
}

function extractEvidenceLocalHostnames(content: string) {
  const values = new Set<string>();
  for (const match of content.matchAll(/^(\S+)#\s*show\s+/gim)) values.add(match[1]);
  for (const match of content.matchAll(/^hostname\s+(\S+)/gim)) values.add(match[1]);
  for (const match of content.matchAll(/^(\S+)\s+uptime is\s+/gim)) values.add(match[1]);
  return Array.from(values);
}

function evidenceFileHasRequirement(file: EvidenceFile, requirementId: EvidenceRequirementId) {
  const content = file.content;

  switch (requirementId) {
    case "identity":
      return (
        /#\s*show\s+(?:version|ver|inventory|license|module)\b/i.test(content) ||
        /Cisco IOS(?: XE)? Software,\s*Version/i.test(content) ||
        /NXOS:\s*version/i.test(content) ||
        /PID:\s*[^,\n]+.*SN:\s*\S+/i.test(content)
      );
    case "configuration":
      return (
        /#\s*show\s+(?:running-config|startup-config|run)\b/i.test(content) ||
        /^hostname\s+\S+[\s\S]*(?:line vty|snmp-server|interface\s+\S+)/im
          .test(content)
      );
    case "interfaces":
      return (
        /#\s*show\s+(?:interfaces(?:\s+(?:status|description))?|ip\s+interface\s+brief|interface\s+(?:trunk|switchport|summary)|interface\s+ip\s+brief)\b/i
          .test(content) ||
        /^Port\s+Name\s+Status\s+Vlan\s+Duplex\s+Speed\s+Type/im.test(content) ||
        /^Interface\s+IP-Address\s+OK\?\s+Method\s+Status\s+Protocol/im.test(content)
      );
    case "topology-l2":
      return (
        /#\s*show\s+(?:cdp\s+neighbors\s+detail|lldp\s+neighbors\s+detail|vlan(?:\s+brief)?|spanning-tree|etherchannel\s+summary|port-channel\s+summary|vpc(?:\s+consistency-parameters\s+global)?)\b/i
          .test(content) ||
        /Device ID:\s*[\s\S]*?Port ID \(outgoing port\):/i.test(content) ||
        /(?:System Name:|Chassis id:)[\s\S]*?Local Intf:/i.test(content)
      );
    case "routing-overlay":
      return /#\s*show\s+(?:ip\s+route|route|ip\s+protocols|ip\s+ospf\s+neighbor|bgp\s+summary|bgp\s+l2vpn\s+evpn\s+summary|vrf|nve\s+peers)\b/i
        .test(content);
    case "operations-security":
      return /#\s*show\s+(?:logging|ntp\s+associations|clock|redundancy|environment|feature|failover|access-list|nat|vpn-sessiondb|crypto\s+ikev2\s+sa|conn\s+count|asp\s+drop)\b/i
        .test(content);
  }
}

function normalizeEvidenceToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildTopologyGraph(
  record: AssessmentRecord,
  layerOverrides: Record<string, TopologyLayerId> = {},
  visibleLayerIds: Set<TopologyLayerId> = new Set(topologyLayerOrder),
  collapsedLayerIds: Set<TopologyLayerId> = new Set()
): TopologyGraph {
  const effectiveParsed = effectiveParsedNetworkData(record);
  const nodeMap = new Map<string, Omit<TopologyNode, "x" | "y" | "layerId" | "layerLabel" | "layerReason" | "layerEvidence" | "layerOverride">>();
  const inventoryLayerOverrides = new Map<string, TopologyLayerId>();

  function upsertNode(hostname: string, patch: Partial<Omit<TopologyNode, "id" | "hostname" | "x" | "y" | "layerId" | "layerLabel" | "layerReason" | "layerEvidence" | "layerOverride">>) {
    const id = topologyNodeId(hostname);
    if (!id) return;
    const existing = nodeMap.get(id);
    const next = {
      id,
      hostname: existing?.hostname || hostname,
      model: preferTopologyValue(existing?.model ?? "", patch.model ?? ""),
      managementIp: preferTopologyValue(existing?.managementIp ?? "", patch.managementIp ?? ""),
      serial: preferTopologyValue(existing?.serial ?? "", patch.serial ?? ""),
      role: preferTopologyValue(existing?.role ?? "", patch.role ?? ""),
      site: preferTopologyValue(existing?.site ?? "", patch.site ?? ""),
      deviceType: preferTopologyValue(existing?.deviceType ?? "", patch.deviceType ?? ""),
      softwareVersion: preferTopologyValue(existing?.softwareVersion ?? "", patch.softwareVersion ?? ""),
      sourceFiles: Array.from(new Set([...(existing?.sourceFiles ?? []), ...(patch.sourceFiles ?? [])]))
    };
    nodeMap.set(id, next);
  }

  for (const asset of record.targetInventory) {
    if (!asset.included) continue;
    if (asset.topologyLayer) inventoryLayerOverrides.set(topologyNodeId(asset.hostname), asset.topologyLayer);
    upsertNode(asset.hostname, {
      model: asset.model,
      managementIp: asset.managementIp,
      serial: asset.serial,
      role: asset.role,
      site: asset.site,
      deviceType: deviceTypeLabel(asset.deviceType)
    });
  }

  for (const device of effectiveParsed.devices) {
    upsertNode(device.hostname, {
      model: device.model,
      serial: device.serial,
      role: device.suggestedRole,
      softwareVersion: device.softwareVersion,
      sourceFiles: device.sourceFiles
    });
  }

  const edgeMap = new Map<string, TopologyEdge>();
  for (const relation of effectiveParsed.relations) {
    upsertNode(relation.localHostname, {});
    upsertNode(relation.remoteHostname, {
      model: relation.platform ?? "",
      managementIp: relation.managementIp ?? ""
    });

    const sourceId = topologyNodeId(relation.localHostname);
    const targetId = topologyNodeId(relation.remoteHostname);
    if (!sourceId || !targetId || sourceId === targetId) continue;
    const edgeKey = [sourceId, targetId, relation.localInterface, relation.remoteInterface, relation.protocol].join(":");
    edgeMap.set(edgeKey, {
      id: edgeKey,
      sourceId,
      targetId,
      localInterface: relation.localInterface,
      remoteInterface: relation.remoteInterface,
      protocol: relation.protocol,
      confidence: relation.confidence
    });
  }

  const allNodes = Array.from(nodeMap.values()).map((node) => {
    const override = inventoryLayerOverrides.get(node.id) ?? layerOverrides[node.id];
    const classification = classifyTopologyLayer(node, override);
    return {
      ...node,
      layerId: classification.layerId,
      layerLabel: topologyLayerConfig[classification.layerId].label,
      layerReason: classification.reason,
      layerEvidence: classification.evidence,
      layerOverride: Boolean(override)
    };
  });
  const nodeCounts = countTopologyNodesByLayer(allNodes);
  const activeLayerIds = topologyLayerOrder.filter((layerId) => visibleLayerIds.has(layerId));
  const allEdges = Array.from(edgeMap.values());
  const layerRows = activeLayerIds.map((layerId) => buildTopologyLayerRows(
    allNodes.filter((node) => node.layerId === layerId),
    allEdges,
    allNodes
  ));
  const gapX = 74;
  const gapY = 32;
  const padding = 56;
  const layerHeaderHeight = 74;
  const layerInnerPadding = 18;
  const collapsedLayerHeight = 76;
  const maxCount = Math.max(1, ...layerRows.flat().map((nodes) => nodes.length));
  const contentWidth = Math.max(860, maxCount * topologyNodeWidth + (maxCount - 1) * gapX);
  const nodes: TopologyNode[] = [];
  const layers: TopologyLayerBand[] = [];
  let cursorY = padding;

  activeLayerIds.forEach((layerId, layerIndex) => {
    const rows = layerRows[layerIndex];
    const collapsed = collapsedLayerIds.has(layerId);
    const config = topologyLayerConfig[layerId];
    const rowGapY = topologyLayerRowGap(rows, allEdges);
    const expandedHeight =
      layerHeaderHeight +
      layerInnerPadding +
      rows.length * topologyNodeHeight +
      Math.max(0, rows.length - 1) * rowGapY +
      26;
    const height = collapsed ? collapsedLayerHeight : expandedHeight;
    layers.push({
      id: layerId,
      label: config.label,
      description: config.description,
      color: config.color,
      bg: config.bg,
      lightBg: config.lightBg,
      border: config.border,
      lightBorder: config.lightBorder,
      y: cursorY,
      height,
      nodeCount: nodeCounts.get(layerId) ?? 0,
      collapsed
    });

    if (!collapsed) {
      rows.forEach((rowNodes, rowIndex) => {
        const rowWidth = rowNodes.length * topologyNodeWidth + Math.max(0, rowNodes.length - 1) * gapX;
        const startX = padding + (contentWidth - rowWidth) / 2;
        rowNodes.forEach((node, nodeIndex) => {
          nodes.push({
            ...node,
            x: startX + nodeIndex * (topologyNodeWidth + gapX),
            y: cursorY + layerHeaderHeight + layerInnerPadding + rowIndex * (topologyNodeHeight + rowGapY)
          });
        });
      });
    }
    cursorY += height + gapY;
  });

  return {
    nodes,
    edges: allEdges,
    layers,
    layerNodeCounts: Object.fromEntries(topologyLayerOrder.map((layerId) => [layerId, nodeCounts.get(layerId) ?? 0])) as Record<TopologyLayerId, number>,
    width: padding * 2 + contentWidth,
    height: Math.max(360, cursorY + padding - gapY)
  };
}

function directTopologyNodeIds(graph: TopologyGraph, nodeId: string) {
  const ids = new Set<string>([nodeId]);
  for (const edge of graph.edges) {
    if (edge.sourceId === nodeId) ids.add(edge.targetId);
    if (edge.targetId === nodeId) ids.add(edge.sourceId);
  }
  return ids;
}

function directTopologyEdgeIds(graph: TopologyGraph, nodeId: string) {
  return new Set(graph.edges.filter((edge) => edge.sourceId === nodeId || edge.targetId === nodeId).map((edge) => edge.id));
}

function topologyNodeId(hostname: string) {
  return hostname.trim().toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}

function classifyTopologyLayer(
  device: Pick<TopologyNode, "hostname" | "model" | "role" | "site" | "deviceType" | "softwareVersion">,
  override?: TopologyLayerId
): { layerId: TopologyLayerId; reason: string; evidence: string[] } {
  if (override) {
    return {
      layerId: override,
      reason: `Capa asignada manualmente por el usuario a ${topologyLayerConfig[override].label}.`,
      evidence: ["override manual"]
    };
  }

  const hostname = device.hostname.toLowerCase();
  const model = device.model.toLowerCase();
  const role = device.role.toLowerCase();
  const site = device.site.toLowerCase();
  const deviceType = device.deviceType.toLowerCase();
  const software = device.softwareVersion.toLowerCase();
  const value = `${hostname} ${model} ${role} ${site} ${deviceType} ${software}`;
  const evidence: string[] = [];
  const addEvidence = (label: string, matched: boolean) => {
    if (matched) evidence.push(label);
    return matched;
  };
  const explicitCore = addEvidence("rol/hostname core o backbone", /\b(core|backbone)\b/.test(`${hostname} ${role}`));
  const branchSignal =
    addEvidence("branch / sucursal", /\b(branch|sucursal|remote[- ]?site|remote office|oficina remota|site remoto)\b/.test(value)) ||
    addEvidence("rol branch", /\b(branch-router|branch-access|branch-edge)\b/.test(value));
  if (branchSignal) {
    return {
      layerId: "branches",
      reason: "Clasificado como branch/sucursal por hostname, sitio o rol de sede remota.",
      evidence
    };
  }

  const datacenterSignal =
    addEvidence("Nexus / NX-OS", /\b(nexus|nx-os|n[579]k|cisco nexus)\b/.test(value)) ||
    addEvidence("spine/leaf", /\b(spine|leaf)\b/.test(value)) ||
    addEvidence("ACI / APIC", /\b(aci|apic)\b/.test(value)) ||
    addEvidence("UCS / Fabric Interconnect", /\b(ucs|fabric interconnect|\bfi\b)\b/.test(value)) ||
    addEvidence("fabric DC", /\b(datacenter|data center|dc fabric|fabric)\b/.test(value));
  if (datacenterSignal) {
    return {
      layerId: "datacenter",
      reason: "Clasificado como datacenter por plataforma o rol de fabric DC.",
      evidence
    };
  }

  const routerSignal = addEvidence("router", /\b(router|isr|asr|c8[0-9]{3}|cisco router)\b/.test(value));
  const perimeterSignal =
    routerSignal ||
    addEvidence("firewall", /\b(firewall|fw|asa|ftd|firepower|fortigate|palo alto)\b/.test(value)) ||
    addEvidence("WAN / Internet edge", /\b(wan|internet|edge|border|perimeter|perimetro|dmz)\b/.test(value)) ||
    addEvidence("VPN", /\b(vpn|ipsec|ssl vpn|remote access)\b/.test(value));
  if (perimeterSignal && !explicitCore) {
    return {
      layerId: "perimeter",
      reason: "Clasificado como perimetro/WAN edge por rol de router, firewall, VPN o borde externo.",
      evidence
    };
  }

  if (explicitCore) {
    return {
      layerId: "core",
      reason: "Clasificado como core porque el rol o hostname declara explicitamente core/backbone.",
      evidence
    };
  }

  const campusSignal =
    addEvidence("switch campus", /\b(switch|catalyst|c9[236]00|c2960|c3560|c3750)\b/.test(value)) ||
    addEvidence("distribucion/acceso", /\b(distribution|distribucion|dist|access|acceso|campus|user|usuario)\b/.test(value)) ||
    addEvidence("wireless", /\b(wireless|wlc|ap\b|access point)\b/.test(value));
  if (campusSignal) {
    return {
      layerId: "campus",
      reason: "Clasificado como campus por switching de distribucion/acceso o wireless.",
      evidence
    };
  }

  return {
    layerId: "other",
    reason: "No hay evidencia suficiente para ubicar el nodo en una capa topologica especifica.",
    evidence
  };
}

function countTopologyNodesByLayer(nodes: Array<Pick<TopologyNode, "layerId">>) {
  const counts = new Map<TopologyLayerId, number>();
  for (const layerId of topologyLayerOrder) counts.set(layerId, 0);
  for (const node of nodes) counts.set(node.layerId, (counts.get(node.layerId) ?? 0) + 1);
  return counts;
}

function buildTopologyLayerRows(nodes: TopologyLayoutNode[], edges: TopologyEdge[], allNodes: TopologyLayoutNode[]) {
  if (nodes.length === 0) return [];
  const allNodeById = new Map(allNodes.map((node) => [node.id, node]));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const sameLayerEdges = edges.filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId));
  const sameLayerPeers = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  const lowerLayerConnectionCounts = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    const source = allNodeById.get(edge.sourceId);
    const target = allNodeById.get(edge.targetId);
    if (!source || !target) continue;

    if (nodeIds.has(source.id) && nodeIds.has(target.id)) {
      sameLayerPeers.get(source.id)?.add(target.id);
      sameLayerPeers.get(target.id)?.add(source.id);
    }

    if (nodeIds.has(source.id) && topologyLayerIndex(target.layerId) > topologyLayerIndex(source.layerId)) {
      lowerLayerConnectionCounts.set(source.id, (lowerLayerConnectionCounts.get(source.id) ?? 0) + 1);
    }
    if (nodeIds.has(target.id) && topologyLayerIndex(source.layerId) > topologyLayerIndex(target.layerId)) {
      lowerLayerConnectionCounts.set(target.id, (lowerLayerConnectionCounts.get(target.id) ?? 0) + 1);
    }
  }

  const downstreamAggregatorIds = new Set(
    nodes.filter((node) => (lowerLayerConnectionCounts.get(node.id) ?? 0) > 0).map((node) => node.id)
  );
  const upstreamIds = new Set(
    nodes
      .filter((node) => {
        if ((lowerLayerConnectionCounts.get(node.id) ?? 0) > 0) return false;
        return Array.from(sameLayerPeers.get(node.id) ?? []).some((peerId) => downstreamAggregatorIds.has(peerId));
      })
      .map((node) => node.id)
  );
  const hasStructuralSplit = downstreamAggregatorIds.size > 0 && upstreamIds.size > 0;
  const tiers = hasStructuralSplit
    ? new Map(nodes.map((node) => [node.id, downstreamAggregatorIds.has(node.id) ? 1 : 0]))
    : buildFallbackTopologyTiers(nodes, sameLayerEdges);

  const rows = Array.from(
    nodes.reduce((map, node) => {
      const tier = tiers.get(node.id) ?? 0;
      const row = map.get(tier) ?? [];
      row.push(node);
      map.set(tier, row);
      return map;
    }, new Map<number, TopologyLayoutNode[]>())
  )
    .sort(([left], [right]) => left - right)
    .map(([, row]) => row.sort((left, right) =>
      topologyNodeVerticalPriority(left) - topologyNodeVerticalPriority(right) ||
      left.hostname.localeCompare(right.hostname)
    ));

  return rows;
}

function buildFallbackTopologyTiers(nodes: TopologyLayoutNode[], sameLayerEdges: TopologyEdge[]) {
  const tiers = new Map(nodes.map((node) => [node.id, topologyNodeBaseTier(node)]));

  for (let pass = 0; pass < Math.max(2, nodes.length); pass += 1) {
    let changed = false;
    for (const edge of sameLayerEdges) {
      const source = nodes.find((node) => node.id === edge.sourceId);
      const target = nodes.find((node) => node.id === edge.targetId);
      if (!source || !target) continue;
      const sourceTier = tiers.get(source.id) ?? 0;
      const targetTier = tiers.get(target.id) ?? 0;
      if (sourceTier !== targetTier) continue;

      const sourcePriority = topologyNodeVerticalPriority(source);
      const targetPriority = topologyNodeVerticalPriority(target);
      if (sourcePriority === targetPriority) continue;
      const lowerNode = sourcePriority > targetPriority ? source : target;
      tiers.set(lowerNode.id, sourceTier + 1);
      changed = true;
    }
    if (!changed) break;
  }

  return tiers;
}

function topologyLayerRowGap(rows: TopologyLayoutNode[][], edges: TopologyEdge[]) {
  if (rows.length <= 1) return 42;
  const rowByNodeId = new Map<string, number>();
  rows.forEach((row, rowIndex) => {
    for (const node of row) rowByNodeId.set(node.id, rowIndex);
  });
  const crossRowEdges = edges.filter((edge) => {
    const sourceRow = rowByNodeId.get(edge.sourceId);
    const targetRow = rowByNodeId.get(edge.targetId);
    return sourceRow !== undefined && targetRow !== undefined && sourceRow !== targetRow;
  }).length;

  if (crossRowEdges >= 6) return 96;
  if (crossRowEdges >= 3) return 82;
  return 72;
}

function topologyLayerIndex(layerId: TopologyLayerId) {
  return topologyLayerOrder.indexOf(layerId);
}

function topologyNodeBaseTier(node: Pick<TopologyNode, "hostname" | "model" | "role" | "site" | "deviceType" | "softwareVersion">) {
  const value = topologyNodeSearchText(node);
  if (/\b(branch|sucursal|remote[- ]?site|remote office|oficina remota|site remoto)\b/.test(value)) return 0;
  if (/\b(router|isr|asr|wan|internet|edge|border|firewall|fw|asa|ftd|vpn)\b/.test(value)) return 1;
  if (/\b(spine|apic|fabric interconnect|\bfi\b)\b/.test(value)) return 1;
  if (/\b(core|backbone|c6500|c6509|c6800|c9500|c9600)\b/.test(value)) return 2;
  if (/\b(distribution|distribucion|dist|aggregation|agg|leaf|nexus|n[579]k)\b/.test(value)) return 3;
  if (/\b(access|acceso|campus|wireless|wlc|ap\b|c9200|c9300|c2960)\b/.test(value)) return 4;
  return 2;
}

function topologyNodeVerticalPriority(node: Pick<TopologyNode, "hostname" | "model" | "role" | "site" | "deviceType" | "softwareVersion">) {
  const value = topologyNodeSearchText(node);
  if (/\b(branch|sucursal|remote[- ]?site|remote office|oficina remota|site remoto)\b/.test(value)) return 0;
  if (/\b(router|isr|asr|wan|internet|edge|border|firewall|fw|asa|ftd|vpn)\b/.test(value)) return 1;
  if (/\b(spine|apic|fabric interconnect|\bfi\b)\b/.test(value)) return 2;
  if (/\b(core|backbone|c6500|c6509|c6800|c9500|c9600)\b/.test(value)) return 3;
  if (/\b(distribution|distribucion|dist|aggregation|agg|leaf|nexus|n[579]k)\b/.test(value)) return 4;
  if (/\b(access|acceso|campus|wireless|wlc|ap\b|c9200|c9300|c2960)\b/.test(value)) return 5;
  return 6;
}

function topologyNodeSearchText(node: Pick<TopologyNode, "hostname" | "model" | "role" | "site" | "deviceType" | "softwareVersion">) {
  return `${node.hostname} ${node.model} ${node.role} ${node.site} ${node.deviceType} ${node.softwareVersion}`.toLowerCase();
}

function calculateTopologyFitView(graph: TopologyGraph, viewportWidth: number, viewportHeight: number) {
  const bounds = topologyVisibleBounds(graph);
  const padding = graph.nodes.length <= 3 ? 110 : 96;
  const availableWidth = Math.max(420, viewportWidth - 28);
  const availableHeight = Math.max(360, viewportHeight - 28);
  const fitZoom = Math.min(availableWidth / (bounds.width + padding * 2), availableHeight / (bounds.height + padding * 2));
  const zoom = clampZoom(fitZoom, graph.nodes.length);
  const translateX = Math.max(48, (availableWidth - bounds.width * zoom) / 2 - bounds.minX * zoom + 14);
  const translateY = Math.max(18, (availableHeight - bounds.height * zoom) / 2 - bounds.minY * zoom);

  return {
    zoom,
    translateX: Number(translateX.toFixed(2)),
    translateY: Number(translateY.toFixed(2))
  };
}

function topologyVisibleBounds(graph: TopologyGraph) {
  if (graph.nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: graph.width, maxY: graph.height, width: graph.width, height: graph.height };
  }

  const minX = Math.min(...graph.nodes.map((node) => node.x));
  const minY = Math.min(...graph.nodes.map((node) => node.y));
  const maxX = Math.max(...graph.nodes.map((node) => node.x + topologyNodeWidth));
  const maxY = Math.max(...graph.nodes.map((node) => node.y + topologyNodeHeight));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function clampZoom(value: number, nodeCount: number) {
  const minZoom = nodeCount <= 3 ? 0.85 : nodeCount <= 12 ? 0.55 : 0.35;
  const maxZoom = nodeCount <= 3 ? 1.35 : 1.6;
  return Math.min(maxZoom, Math.max(minZoom, Number(value.toFixed(2))));
}

function readTopologyLayerOverrides(assessmentId: string): Record<string, TopologyLayerId> {
  if (typeof window === "undefined") return {};
  const stored = window.localStorage.getItem(`assessment-tool.topology-layer-overrides.${assessmentId}.v1`);
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, layerId]) => topologyLayerOrder.includes(layerId as TopologyLayerId))
    ) as Record<string, TopologyLayerId>;
  } catch {
    return {};
  }
}

function writeTopologyLayerOverrides(assessmentId: string, overrides: Record<string, TopologyLayerId>) {
  if (typeof window === "undefined") return;
  const key = `assessment-tool.topology-layer-overrides.${assessmentId}.v1`;
  if (Object.keys(overrides).length === 0) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(overrides));
}

function preferTopologyValue(current: string, next: string) {
  if (!current || current === "Pendiente" || current === "No identificado") return next || current;
  if (!next || next === "Pendiente" || next === "No identificado") return current;
  return current.length >= next.length ? current : next;
}

function truncateSvgText(value: string, maxLength: number) {
  if (!value) return "Pendiente";
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function AiEvaluationTab({
  record,
  currentUser,
  aiAnalysisStatus,
  onRunEvaluation,
  onCancelAnalysisJob,
  onRetryAnalysisJob,
  onResetEvaluation,
  onUpdateFinding,
  onProcessPerformance,
  onRunPerformanceAi,
  onResetPerformance
}: {
  record: AssessmentRecord;
  currentUser: AppUser | null;
  aiAnalysisStatus?: AIAssessmentAnalysisStatus;
  onRunEvaluation: (area: EvaluationArea | "complete", options?: RunEvaluationOptions) => void;
  onCancelAnalysisJob: (jobId: string) => void;
  onRetryAnalysisJob: (jobId: string) => void;
  onResetEvaluation: (area: EvaluationArea | "complete") => void;
  onUpdateFinding: (id: string, patch: Partial<Finding>) => void;
  onProcessPerformance: () => void;
  onRunPerformanceAi: () => void;
  onResetPerformance: () => void;
}) {
  const hasAnyAnalysis = record.parsed.findings.length > 0 || hasAnyScopeAnalysisActivity(aiAnalysisStatus);
  const hasRunningAnalysis = hasRunningAIJob(aiAnalysisStatus);
  const performanceEnabled = record.scope.performanceAnalysis.enabled;
  const latestJob = aiAnalysisStatus?.jobs[0];
  const activeJob = aiAnalysisStatus?.jobs.find((job) => isActiveAIJobStatus(job.status));
  const isAdmin = Boolean(currentUser && canManageUsers(currentUser));
  const [expandedAreaDetails, setExpandedAreaDetails] = useState<Partial<Record<EvaluationArea, boolean>>>({});
  const [showFullBreakdown, setShowFullBreakdown] = useState(false);
  const [scopeFindingFilter, setScopeFindingFilter] = useState<EvaluationArea | null>(null);
  const [activeSubtab, setActiveSubtab] = useState<AIEvaluationSubtab>("evaluation");
  const subtabRefs = useRef<Partial<Record<AIEvaluationSubtab, HTMLButtonElement | null>>>({});
  const pipelineStages = buildPipelineView(aiAnalysisStatus, latestJob);
  const engineJob = activeJob ?? latestJob;
  const aiFindingsToReviewCount = record.parsed.findings.filter((finding) => finding.aiMetadata && finding.status === "ai_suggested").length;
  const aiSubtabs = [
    { id: "evaluation" as const, label: "Evaluacion", count: null, active: Boolean(activeJob) },
    { id: "findings" as const, label: "Hallazgos", count: aiFindingsToReviewCount, active: false },
    ...(isAdmin ? [{ id: "settings" as const, label: "Ajustes", count: null, active: false }] : [])
  ];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset the internal AI subtab when switching assessments.
    setActiveSubtab("evaluation");
  }, [record.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Non-admin users cannot remain on the admin-only settings subtab.
    if (!isAdmin && activeSubtab === "settings") setActiveSubtab("evaluation");
  }, [activeSubtab, isAdmin]);

  function handleSubtabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = aiSubtabs.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowRight"
          ? currentIndex === lastIndex ? 0 : currentIndex + 1
          : currentIndex === 0 ? lastIndex : currentIndex - 1;
    const nextSubtab = aiSubtabs[nextIndex].id;
    setActiveSubtab(nextSubtab);
    window.requestAnimationFrame(() => subtabRefs.current[nextSubtab]?.focus());
  }

  function toggleScopeFindingFilterFromEvaluation(area: EvaluationArea) {
    setScopeFindingFilter((current) => current === area ? null : area);
    setActiveSubtab("findings");
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto rounded-md border border-border bg-muted/30 p-1" role="tablist" aria-label="Secciones internas de Evaluacion AI">
        {aiSubtabs.map((tab, index) => {
          const selected = activeSubtab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                subtabRefs.current[tab.id] = element;
              }}
              id={`ai-evaluation-subtab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`ai-evaluation-subtab-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded px-3 text-sm font-medium outline-none transition focus:ring-2 focus:ring-primary/70",
                selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"
              )}
              onClick={() => setActiveSubtab(tab.id)}
              onKeyDown={(event) => handleSubtabKeyDown(event, index)}
            >
              <span>{tab.label}{typeof tab.count === "number" ? ` (${tab.count})` : ""}</span>
              {tab.active && (
                <span className={cn("h-2 w-2 rounded-full", selected ? "bg-primary-foreground" : "bg-primary")} aria-label="Job activo" />
              )}
            </button>
          );
        })}
      </div>

      {activeSubtab === "evaluation" && (
        <div
          id="ai-evaluation-subtab-panel-evaluation"
          role="tabpanel"
          aria-labelledby="ai-evaluation-subtab-evaluation"
          className="space-y-4"
        >
          <Panel>
            <PanelHeader className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                  <Bot size={20} />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Evaluación AI</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ejecuta la evaluación completa o analiza cada ámbito de forma independiente.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => onResetEvaluation("complete")} disabled={!hasAnyAnalysis || hasRunningAnalysis}>
                  <RotateCcw size={16} />
                  Limpiar todo
                </Button>
                <Button size="sm" onClick={() => onRunEvaluation("complete")} disabled={hasRunningAnalysis}>
                  <PlayCircle size={16} />
                  Evaluación completa
                </Button>
                {activeJob && (
                  <Button variant="danger" size="sm" onClick={() => onCancelAnalysisJob(activeJob.id)}>
                    <X size={16} />
                    Cancelar evaluación
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowFullBreakdown((current) => !current)}>
                  {showFullBreakdown ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  Desglose completo
                </Button>
              </div>
            </PanelHeader>
            <PanelBody className="space-y-5 p-4 sm:p-5">
              <EvaluationStageRail stages={pipelineStages} activeJob={activeJob} />
              {engineJob && (
                <EvaluationEngineStrip
                  job={engineJob}
                  onCancelAnalysisJob={onCancelAnalysisJob}
                  onRetryAnalysisJob={onRetryAnalysisJob}
                />
              )}
              {showFullBreakdown && (
                <FullEvaluationScopeBreakdown
                  record={record}
                  aiAnalysisStatus={aiAnalysisStatus}
                  latestJob={latestJob}
                />
              )}
              <section className="rounded-xl border border-border bg-muted/10 p-4" aria-labelledby="map-workspace-title">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 id="map-workspace-title" className="text-base font-semibold text-foreground">
                      Map · Análisis por ámbito
                    </h3>
                    <p className="text-sm text-muted-foreground">Cada ámbito puede ejecutarse de forma independiente.</p>
                  </div>
                  <Badge tone="neutral" className="w-fit">
                    6 fases por ámbito
                  </Badge>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {evaluationAreas.map((area, index) => {
                    const scopeId = evaluationAreaToAIScope(area.id);
                    const scopeStatus = aiAnalysisStatus?.scopes.find((scope) => scope.id === scopeId);
                    const latestScopeJob = latestJob?.mode === "scope" && latestJob.scopeId === scopeId ? latestJob : undefined;
                    const isScopeRunning = isScopeJobActive(scopeId, aiAnalysisStatus, latestJob);
                    const isCurrentScopeExecuting = isScopeCurrentlyExecuting(scopeId, latestJob);
                    const areaFindings = record.parsed.findings.filter((finding) => finding.category === areaToCategory(area.id));
                    const canResetArea = hasScopeDisplayActivity(scopeId, aiAnalysisStatus, latestJob, areaFindings);
                    const displayedStatus = statusForScopeDisplay(scopeId, aiAnalysisStatus, latestJob);
                    const scopeProgress = scopeProgressFromStatus(scopeId, aiAnalysisStatus, latestJob);
                    const scopeMessage = scopeStatusMessage(scopeId, displayedStatus, scopeStatus, latestScopeJob ?? latestJob);
                    const findingSummary = summarizeAreaFindings(areaFindings);
                    const scopeDisplay = aiScopeDisplayOrder.find((scope) => scope.id === scopeId);
                    const detailOpen = Boolean(expandedAreaDetails[area.id]);
                    const findingsFilterActive = scopeFindingFilter === area.id;
                    const operationsInterviewBlocked = area.id === "operations" && !isOperationalAssessmentComplete(record.operationalAssessment);
                    const evaluationDisabledReason = operationsInterviewBlocked ? "Completa las entrevistas del Tab 11 primero" : undefined;

                    return (
                      <EvaluationAmbitoNode
                        key={area.id}
                        order={index + 1}
                        label={area.label}
                        description={area.description}
                        icon={evaluationAreaIcon(area.id)}
                        status={displayedStatus}
                        active={isCurrentScopeExecuting}
                        progress={scopeProgress}
                        message={scopeMessage}
                        findingSummary={findingSummary}
                        blockedMessage={operationsInterviewBlocked ? evaluationDisabledReason : undefined}
                        detailOpen={detailOpen}
                        onToggleDetail={() => setExpandedAreaDetails((current) => ({ ...current, [area.id]: !current[area.id] }))}
                        onViewFindings={() => toggleScopeFindingFilterFromEvaluation(area.id)}
                        findingsFilterActive={findingsFilterActive}
                        detail={scopeDisplay ? (
                          <ScopeDetailPanel
                            scope={scopeDisplay}
                            summary={findingSummary}
                            status={displayedStatus}
                            steps={aiAnalysisStatus?.jobs.flatMap((job) => job.steps).filter((step) => step.scopeId === scopeId) ?? []}
                            currentPhase={latestJob?.currentPhase ?? null}
                          />
                        ) : null}
                        actions={(
                          <>
                            <span title={evaluationDisabledReason}>
                              <Button size="sm" onClick={() => onRunEvaluation(area.id)} disabled={isScopeRunning || hasRunningAnalysis || operationsInterviewBlocked}>
                                <PlayCircle size={14} />
                                Evaluar
                              </Button>
                            </span>
                            <CardOverflowMenu
                              label={`Acciones de ${area.label}`}
                              actions={[
                                {
                                  label: "Forzar re-evaluación",
                                  onSelect: () => onRunEvaluation(area.id, { forceReevaluate: true }),
                                  disabled: isScopeRunning || hasRunningAnalysis || operationsInterviewBlocked
                                },
                                {
                                  label: "Reset",
                                  onSelect: () => onResetEvaluation(area.id),
                                  disabled: !canResetArea || isScopeRunning
                                }
                              ]}
                            />
                          </>
                        )}
                      />
                    );
                  })}
                  {performanceEnabled && (
                    <PerformanceAnalysisRunCard
                      record={record}
                      order={evaluationAreas.length + 1}
                      onProcessPerformance={onProcessPerformance}
                      onRunPerformanceAi={onRunPerformanceAi}
                      onResetPerformance={onResetPerformance}
                    />
                  )}
                </div>
              </section>
              <section
                className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-4"
                aria-label="Leyenda de estados"
              >
                <LegendItem
                  icon={CheckCircle2}
                  label="Completado"
                  className="border-emerald-300/40 bg-emerald-400/10 text-emerald-300"
                />
                <LegendItem icon={LoaderCircle} label="En curso" className="border-primary/50 bg-primary/10 text-primary" />
                <LegendItem icon={Circle} label="En cola" className="border-amber-300/40 bg-amber-400/10 text-amber-300" />
                <LegendItem icon={Circle} label="Pendiente" className="border-border bg-muted/40 text-muted-foreground" />
                <LegendItem icon={Lock} label="Bloqueado" className="border-rose-300/40 bg-rose-400/10 text-rose-300" />
              </section>
            </PanelBody>
          </Panel>
        </div>
      )}

      {activeSubtab === "findings" && (
        <div
          id="ai-evaluation-subtab-panel-findings"
          role="tabpanel"
          aria-labelledby="ai-evaluation-subtab-findings"
        >
          <AIReviewPanel
            record={record}
            currentUser={currentUser}
            scopeFindingFilter={scopeFindingFilter}
            onClearScopeFindingFilter={() => setScopeFindingFilter(null)}
            onUpdateFinding={onUpdateFinding}
          />
        </div>
      )}

      {activeSubtab === "settings" && isAdmin && currentUser && (
        <div
          id="ai-evaluation-subtab-panel-settings"
          role="tabpanel"
          aria-labelledby="ai-evaluation-subtab-settings"
          className="space-y-4"
        >
          <AISettingsAdminTabs record={record} currentUser={currentUser} />
        </div>
      )}
    </div>
  );
}

function AISettingsAdminTabs({ record, currentUser }: { record: AssessmentRecord; currentUser: AppUser }) {
  const [activeSettingsSubtab, setActiveSettingsSubtab] = useState<AISettingsSubtab>("playbook");
  const settingsSubtabRefs = useRef<Partial<Record<AISettingsSubtab, HTMLButtonElement | null>>>({});
  const settingsSubtabs = [
    { id: "playbook" as const, label: "Playbooks", panelId: "ai-settings-subtab-panel-playbook" },
    { id: "guidelines" as const, label: "Guidelines de diseno - Topologia", panelId: "ai-settings-subtab-panel-guidelines" },
    { id: "debug" as const, label: "Debug OpenAI", panelId: "ai-settings-subtab-panel-debug" }
  ];

  function handleSettingsSubtabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = settingsSubtabs.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowRight"
          ? currentIndex === lastIndex ? 0 : currentIndex + 1
          : currentIndex === 0 ? lastIndex : currentIndex - 1;
    const nextSubtab = settingsSubtabs[nextIndex].id;
    setActiveSettingsSubtab(nextSubtab);
    window.requestAnimationFrame(() => settingsSubtabRefs.current[nextSubtab]?.focus());
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto rounded-md border border-border bg-muted/30 p-1" role="tablist" aria-label="Ajustes de Evaluacion AI">
        {settingsSubtabs.map((tab, index) => {
          const selected = activeSettingsSubtab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                settingsSubtabRefs.current[tab.id] = element;
              }}
              id={`ai-settings-subtab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={tab.panelId}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded px-3 text-sm font-medium outline-none transition focus:ring-2 focus:ring-primary/70",
                selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-background hover:text-foreground"
              )}
              onClick={() => setActiveSettingsSubtab(tab.id)}
              onKeyDown={(event) => handleSettingsSubtabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div id="ai-settings-subtab-panel-playbook" role="tabpanel" aria-labelledby="ai-settings-subtab-playbook" hidden={activeSettingsSubtab !== "playbook"}>
        <ScopePlaybooksAdminPanel currentUser={currentUser} />
      </div>

      <div id="ai-settings-subtab-panel-guidelines" role="tabpanel" aria-labelledby="ai-settings-subtab-guidelines" hidden={activeSettingsSubtab !== "guidelines"}>
        <TopologyDesignGuidelinesAdminPanel record={record} currentUser={currentUser} />
      </div>

      <div id="ai-settings-subtab-panel-debug" role="tabpanel" aria-labelledby="ai-settings-subtab-debug" hidden={activeSettingsSubtab !== "debug"}>
        <AIDebugAdminPanel record={record} currentUser={currentUser} />
      </div>
    </div>
  );
}

function CardOverflowMenu({
  label,
  actions
}: {
  label: string;
  actions: Array<{ label: string; onSelect: () => void; disabled?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="secondary"
        size="icon"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal size={16} />
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border border-border bg-white p-1 shadow-lg" role="menu">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              className="flex w-full items-center rounded px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const completedPipelineStatuses = new Set(["completed", "complete", "skipped", "skipped_existing_result"]);
const failedPipelineStatuses = new Set(["failed", "blocked", "error", "timeout", "cancelled"]);

function isCompletedPipelineStatus(status: string | undefined) {
  return Boolean(status && completedPipelineStatuses.has(status));
}

function isFailedPipelineStatus(status: string | undefined) {
  return Boolean(status && failedPipelineStatuses.has(status));
}

function EvaluationStageCard({ stage, showCurrentPill }: { stage: PipelineViewStage; showCurrentPill: boolean }) {
  const statusLabel = humanizeScopeStatus(stage.status);
  const Icon = stage.active
    ? LoaderCircle
    : isCompletedPipelineStatus(stage.status)
      ? CheckCircle2
      : stage.stage === "map"
        ? Layers
        : stage.stage === "reduce"
          ? GitMerge
          : Sparkles;
  const title = stage.stage === "map"
    ? "Map · Análisis por ámbito"
    : stage.stage === "reduce"
      ? "Reduce · Correlación"
      : "Synthesize · Salida";
  const subtitle = stage.stage === "map"
    ? `${stage.total} ámbitos · evidencia + inventario`
    : stage.stage === "reduce"
      ? "Hallazgos cruzados entre ámbitos"
      : "Roadmap + resumen ejecutivo";

  return (
    <div
      className={cn(
        "relative min-h-[148px] flex-1 rounded-xl border p-4 transition",
        stage.active && "mk-glow border-primary bg-primary/10",
        isCompletedPipelineStatus(stage.status) && !stage.active && "border-emerald-300/40 bg-emerald-400/10",
        isFailedPipelineStatus(stage.status) && !stage.active && "border-rose-300/40 bg-rose-400/10",
        !stage.active && !isCompletedPipelineStatus(stage.status) && !isFailedPipelineStatus(stage.status) && "border-border bg-muted/20 opacity-80"
      )}
    >
      {showCurrentPill ? (
        <span className="absolute -top-3 left-4 rounded-full border border-primary/50 bg-background px-2 py-0.5 text-[10px] font-semibold text-primary shadow-subtle">
          ETAPA ACTUAL
        </span>
      ) : null}
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
              stage.active && "border-primary/50 bg-primary/15 text-primary",
              isCompletedPipelineStatus(stage.status) && !stage.active && "border-emerald-300/40 bg-emerald-400/10 text-emerald-300",
              isFailedPipelineStatus(stage.status) && !stage.active && "border-rose-300/40 bg-rose-400/10 text-rose-300",
              !stage.active && !isCompletedPipelineStatus(stage.status) && !isFailedPipelineStatus(stage.status) && "border-border bg-background text-muted-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", stage.active && "animate-spin")} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span title={statusLabel.tooltip}>
            <AnimatedStatusBadge
              active={stage.active || isAnimatedStatus(stage.status)}
              label={statusLabel.label}
              tone={scopeStatusTone(stage.status)}
            />
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {stage.completed}/{stage.total}
          </span>
        </div>
      </div>
    </div>
  );
}

function EvaluationStageConnector({ status }: { status: "flow" | "charging" | "idle" }) {
  return (
    <div className="hidden w-16 shrink-0 items-center gap-2 md:flex" aria-hidden="true">
      <span
        className={cn(
          "h-[3px] flex-1 rounded-full",
          status === "flow" && "mk-conn mk-conn-flow",
          status === "charging" && "mk-conn mk-conn-charging",
          status === "idle" && "bg-border"
        )}
      />
      <ArrowRight className={cn("h-4 w-4", status === "idle" ? "text-muted-foreground" : "text-primary")} />
    </div>
  );
}

function EvaluationStageRail({ stages, activeJob }: { stages: PipelineViewStage[]; activeJob?: AIAnalysisJobSnapshot }) {
  const currentStageId = stages.find((stage) => stage.active)?.stage ?? (activeJob ? "map" : null);

  return (
    <section aria-label="Riel de proceso Map Reduce Synthesize">
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {stages.map((stage, index) => {
          const nextStage = stages[index + 1];
          const connectorStatus = isCompletedPipelineStatus(stage.status)
            ? "flow"
            : stage.active
              ? "charging"
              : "idle";
          return (
            <React.Fragment key={stage.stage}>
              <EvaluationStageCard stage={stage} showCurrentPill={currentStageId === stage.stage} />
              {nextStage ? <EvaluationStageConnector status={connectorStatus} /> : null}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

function EvaluationEngineStrip({
  job,
  onCancelAnalysisJob,
  onRetryAnalysisJob
}: {
  job: AIAnalysisJobSnapshot;
  onCancelAnalysisJob: (jobId: string) => void;
  onRetryAnalysisJob: (jobId: string) => void;
}) {
  const completed = job.steps.filter((step) => step.status === "completed").length;
  const skipped = job.steps.filter((step) => step.status === "skipped").length;
  const failed = job.steps.filter((step) => step.status === "failed").length;
  const jobStatusLabel = humanizeScopeStatus(job.status);
  const isActive = isActiveAIJobStatus(job.status);
  const canRetry = job.status === "failed" || job.status === "cancelled" || job.status === "partially_completed";

  return (
    <section
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/10 px-3 py-2",
        isActive && job.progress < 100 && "mk-glow",
        job.errorMessage && "border-rose-300/40 bg-rose-400/10"
      )}
      aria-label="Estado del motor"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
          <Cpu className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-foreground">Motor de análisis</span>
        <span title={jobStatusLabel.tooltip}>
          <AnimatedStatusBadge
            active={isActive}
            label={jobStatusLabel.label}
            tone={scopeStatusTone(job.status)}
          />
        </span>
      </div>

      <div className="flex min-w-[10rem] flex-1 items-center gap-2 sm:flex-none">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:w-40 sm:flex-none">
          <div
            className={cn("relative h-full rounded-full", isActive ? "bg-primary" : "bg-emerald-400")}
            style={{ width: `${job.progress}%` }}
          >
            {isActive ? <span className="mk-shimmer absolute inset-0" aria-hidden="true" /> : null}
          </div>
        </div>
        <span className="text-xs font-medium text-foreground">{job.progress}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{completed}/{job.steps.length} fases</span>
        <span aria-hidden="true">·</span>
        <span>{skipped} omitidas</span>
        <span aria-hidden="true">·</span>
        <span className={cn(failed > 0 && "text-rose-300")}>{failed} fallidas</span>
        <span aria-hidden="true">·</span>
        <span>act. {formatDate(job.updatedAt)}</span>
        <span aria-hidden="true">·</span>
        <span>{job.currentPhase ?? "Preparando siguiente fase"}</span>
      </div>

      {job.errorMessage ? <span className="text-xs text-rose-300">{job.errorMessage}</span> : null}

      {(isActive || canRetry) ? (
        <div className="ml-auto flex flex-wrap gap-2">
          {isActive ? (
            <Button variant="danger" size="sm" onClick={() => onCancelAnalysisJob(job.id)}>
              <X size={14} />
              Cancelar
            </Button>
          ) : null}
          {canRetry ? (
            <Button variant="secondary" size="sm" onClick={() => onRetryAnalysisJob(job.id)}>
              <RotateCcw size={14} />
              Reintentar
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function evaluationAreaIcon(area: EvaluationArea): React.ComponentType<{ className?: string; size?: number }> {
  const icons: Record<EvaluationArea, React.ComponentType<{ className?: string; size?: number }>> = {
    topology: Network,
    configuration: Settings2,
    security: ShieldCheck,
    lifecycle: CalendarClock,
    operations: Wrench,
    logs: ScrollText
  };
  return icons[area];
}

function progressFillClass(status: string, active: boolean) {
  if (active) return "bg-primary";
  if (isCompletedPipelineStatus(status) || status === "ok" || status === "processed" || status === "ai_reviewed" || status === "validated") return "bg-emerald-400";
  if (isFailedPipelineStatus(status)) return "bg-rose-400";
  return "bg-primary";
}

function EvaluationAmbitoNode({
  order,
  label,
  description,
  icon: AreaIcon,
  status,
  active,
  progress,
  message,
  findingSummary,
  blockedMessage,
  detailOpen,
  onToggleDetail,
  onViewFindings,
  findingsFilterActive,
  detail,
  actions
}: {
  order: number;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  status: string;
  active: boolean;
  progress: number;
  message: string;
  findingSummary: AreaFindingSummary;
  blockedMessage?: string;
  detailOpen?: boolean;
  onToggleDetail?: () => void;
  onViewFindings?: () => void;
  findingsFilterActive?: boolean;
  detail?: React.ReactNode;
  actions: React.ReactNode;
}) {
  const statusLabel = humanizeScopeStatus(status);
  const completed = isCompletedPipelineStatus(status) || status === "ok" || status === "processed" || status === "ai_reviewed" || status === "validated";
  const queued = status === "queued";
  const failed = isFailedPipelineStatus(status);
  const Icon = active ? LoaderCircle : completed ? CheckCircle2 : AreaIcon;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition",
        active && "mk-glow border-primary bg-primary/10",
        completed && !active && "border-emerald-300/40 bg-emerald-400/[0.05]",
        queued && !active && "border-amber-300/40 bg-amber-400/10",
        failed && !active && "border-rose-300/40 bg-rose-400/[0.07]",
        !active && !completed && !queued && !failed && "border-border"
      )}
    >
      {active ? <span className="mk-topbar absolute inset-x-0 top-0 h-1" aria-hidden="true" /> : null}
      <span className="absolute right-4 top-4 z-10" title={statusLabel.tooltip}>
        <AnimatedStatusBadge
          active={active}
          label={statusLabel.label}
          tone={scopeStatusTone(status)}
        />
      </span>
      <div className="flex items-start gap-3 pr-32">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            active && "border-primary/50 bg-primary/15 text-primary",
            completed && !active && "border-emerald-300/40 bg-emerald-400/10 text-emerald-300",
            queued && !active && "border-amber-300/40 bg-amber-400/10 text-amber-300",
            failed && !active && "border-rose-300/40 bg-rose-400/10 text-rose-300",
            !active && !completed && !queued && !failed && "border-border bg-muted/40 text-muted-foreground"
          )}
        >
          <Icon className={cn("h-5 w-5", active && "animate-spin")} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{String(order).padStart(2, "0")}</span>
            <h3 className="text-sm font-semibold text-foreground">{label}</h3>
            {active ? <AIWorkingIndicator label="Trabajando" /> : null}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-4">
        {blockedMessage ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-300/40 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
            <Lock className="h-4 w-4 shrink-0" />
            <span>{blockedMessage}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("relative h-full rounded-full transition-all", progressFillClass(status, active))}
                style={{ width: `${progress}%` }}
              >
                {active ? <span className="mk-shimmer absolute inset-0" aria-hidden="true" /> : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{progress}% · {message}</p>
          </div>
        )}
      </div>

      <CompactFindingSummary summary={findingSummary} />

      <div className="mt-3 flex flex-wrap gap-2">
        {actions}
        {onToggleDetail ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDetail}
            aria-expanded={detailOpen}
            className="text-muted-foreground"
          >
            {detailOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Ver detalle
          </Button>
        ) : null}
        {onViewFindings ? (
          <Button variant="ghost" size="sm" onClick={onViewFindings} className="text-muted-foreground">
            <Search size={14} />
            {findingsFilterActive ? "Ocultar filtro" : "Ver hallazgos"}
          </Button>
        ) : null}
      </div>

      {detailOpen && detail ? <div className="mt-4 border-t border-border pt-4">{detail}</div> : null}
    </article>
  );
}

function LegendItem({
  icon: Icon,
  label,
  className
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg border", className)}>
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </div>
  );
}

function FullEvaluationScopeBreakdown({
  record,
  aiAnalysisStatus,
  latestJob
}: {
  record: AssessmentRecord;
  aiAnalysisStatus?: AIAssessmentAnalysisStatus;
  latestJob?: AIAnalysisJobSnapshot;
}) {
  const visibleScopes = [...aiScopeDisplayOrder, crossScopeCorrelationDisplay].filter((scope) => {
    const findings = findingsForScopeDisplay(record.parsed.findings, scope);
    return shouldShowScopeDisplay(scope, aiAnalysisStatus, latestJob, findings);
  });
  const groupedScopes = scopeDisplayGroupOrder
    .map((group) => ({
      group,
      scopes: visibleScopes.filter((scope) => scope.group === group)
    }))
    .filter((group) => group.scopes.length > 0);

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Desglose de evaluación completa</p>
          <p className="text-xs text-muted-foreground">Scopes del motor persistente agrupados por dominio de análisis.</p>
        </div>
        <Badge tone="neutral">{visibleScopes.length} scopes</Badge>
      </div>
      <div className="mt-3 space-y-3">
        {groupedScopes.map((group) => (
          <div key={group.group} className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{group.group}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {group.scopes.map((scope) => {
                const findings = findingsForScopeDisplay(record.parsed.findings, scope);
                const summary = summarizeAreaFindings(findings);
                const status = statusForScopeDisplay(scope.id, aiAnalysisStatus, latestJob);
                const statusLabel = humanizeScopeStatus(status);
                return (
                  <div key={scope.id} className="rounded border border-border bg-background/60 p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{scope.label}</p>
                        <p className="text-muted-foreground">{scope.id}</p>
                      </div>
                      <span title={statusLabel.tooltip}>
                        <AnimatedStatusBadge
                          active={isScopeCurrentlyExecuting(scope.id, latestJob)}
                          label={statusLabel.label}
                          tone={scopeStatusTone(status)}
                        />
                      </span>
                    </div>
                    <CompactFindingSummary summary={summary} compact />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScopeDetailPanel({
  scope,
  summary,
  status,
  steps,
  currentPhase
}: {
  scope: AIScopeDisplayMetadata;
  summary: AreaFindingSummary;
  status: string;
  steps: AIAnalysisJobSnapshot["steps"];
  currentPhase: string | null;
}) {
  const statusLabel = humanizeScopeStatus(status);

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/20 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">Scope {scope.id}</span>
        <span title={statusLabel.tooltip}>
          <AnimatedStatusBadge
            active={isAnimatedStatus(status)}
            label={statusLabel.label}
            tone={scopeStatusTone(status)}
          />
        </span>
      </div>
      <CompactFindingSummary summary={summary} compact />
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {aiScopePhaseDisplay.map((phase) => {
          const step = steps.find((item) => item.phaseName === phase.id);
          const phaseStatus = currentPhase === `${scope.id}:${phase.id}` ? "running" : step?.status ?? "pending";
          const phaseStatusLabel = humanizeScopeStatus(phaseStatus);
          return (
            <div key={phase.id} className="flex items-center justify-between gap-2 rounded border border-border bg-background/60 px-2 py-1">
              <span className="text-muted-foreground">{phase.label}</span>
              <span title={phaseStatusLabel.tooltip}>
                <AnimatedStatusBadge
                  active={phaseStatus === "running"}
                  label={phaseStatusLabel.label}
                  tone={scopeStatusTone(phaseStatus)}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function humanizeAIPhase(phaseName: string) {
  return aiScopePhaseDisplay.find((phase) => phase.id === phaseName)?.label ?? phaseName.replaceAll("_", " ");
}

function CompactFindingSummary({ summary, compact = false }: { summary: AreaFindingSummary; compact?: boolean }) {
  const severitySummary = riskSummaryOrder
    .map((risk) => ({ risk, count: summary.bySeverity[risk] }))
    .filter((item) => item.count > 0);
  const findingTypeSummary = findingTypeSummaryOrder
    .map((type) => ({ type, count: summary.byFindingType[type] ?? 0 }))
    .concat(Object.entries(summary.byFindingType)
      .filter(([type]) => !findingTypeSummaryOrder.includes(type))
      .map(([type, count]) => ({ type, count })))
    .filter((item) => item.count > 0);

  if (summary.total === 0) {
    return <p className={cn("text-xs text-muted-foreground", compact ? "mt-1" : "mt-2")}>Sin hallazgos</p>;
  }

  return (
    <div className={cn("space-y-1 text-xs", compact ? "mt-1" : "mt-2")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{summary.total} {summary.total === 1 ? "hallazgo" : "hallazgos"}</span>
        {severitySummary.map((item) => (
          <Badge key={item.risk} tone={riskTone[item.risk]}>
            {riskSummaryLabel[item.risk]} {item.count}
          </Badge>
        ))}
        {summary.pendingValidation > 0 && (
          <Badge tone="warning">{summary.pendingValidation} por validar</Badge>
        )}
      </div>
      {findingTypeSummary.length > 0 && (
        <p className="text-muted-foreground">
          Tipos: {findingTypeSummary.map((item) => `${findingTypeSummaryLabel[item.type] ?? item.type}: ${item.count}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

function AnimatedStatusBadge({
  active,
  label,
  tone
}: {
  active: boolean;
  label: string;
  tone: React.ComponentProps<typeof Badge>["tone"];
}) {
  return (
    <Badge tone={tone} className={active ? "gap-1 border-primary/40 bg-primary/10 text-primary" : undefined}>
      <span className={active ? "animate-pulse" : undefined}>{label}</span>
      {active && (
        <span className="inline-flex items-center gap-0.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1 w-1 animate-bounce rounded-full bg-current"
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}
        </span>
      )}
    </Badge>
  );
}

function AIWorkingIndicator({ label = "Analizando" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-primary" aria-label="Analisis en progreso">
      <span>{label}</span>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  );
}

function TopologyDesignGuidelinesAdminPanel({ record, currentUser }: { record: AssessmentRecord; currentUser: AppUser }) {
  const isAdmin = canManageUsers(currentUser);
  const [globalGuideline, setGlobalGuideline] = useState<TopologyDesignGuidelineResponse | null>(null);
  const [assessmentGuideline, setAssessmentGuideline] = useState<TopologyDesignGuidelineResponse | null>(null);
  const [globalDraft, setGlobalDraft] = useState("");
  const [assessmentDraft, setAssessmentDraft] = useState("");
  const [status, setStatus] = useState<{ state: "idle" | "loading" | "saving" | "deleting" | "error"; message: string }>({
    state: "idle",
    message: ""
  });

  const loadGuidelines = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [nextGlobal, nextAssessment] = await Promise.all([
        fetchTopologyDesignGuideline("global", currentUser),
        fetchTopologyDesignGuideline(record.id, currentUser)
      ]);
      setGlobalGuideline(nextGlobal);
      setAssessmentGuideline(nextAssessment);
      setGlobalDraft(nextGlobal.record?.content ?? nextGlobal.guideline.content);
      setAssessmentDraft(nextAssessment.record?.content ?? nextAssessment.guideline.content);
      setStatus({ state: "idle", message: "" });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudieron cargar guidelines de diseno." });
    }
  }, [currentUser, isAdmin, record.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGuidelines();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadGuidelines]);

  async function saveGlobalGuideline() {
    setStatus({ state: "saving", message: "Guardando guideline global..." });
    try {
      const nextGlobal = await updateTopologyDesignGuideline("global", globalDraft, currentUser);
      const nextAssessment = await fetchTopologyDesignGuideline(record.id, currentUser);
      setGlobalGuideline(nextGlobal);
      setAssessmentGuideline(nextAssessment);
      setAssessmentDraft(nextAssessment.record?.content ?? nextAssessment.guideline.content);
      setStatus({ state: "idle", message: "Guideline global guardada." });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudo guardar guideline global." });
    }
  }

  async function saveAssessmentGuideline() {
    setStatus({ state: "saving", message: "Guardando override del assessment..." });
    try {
      const nextAssessment = await updateTopologyDesignGuideline(record.id, assessmentDraft, currentUser);
      setAssessmentGuideline(nextAssessment);
      setAssessmentDraft(nextAssessment.record?.content ?? nextAssessment.guideline.content);
      setStatus({ state: "idle", message: "Override del assessment guardado." });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudo guardar override del assessment." });
    }
  }

  async function clearAssessmentGuideline() {
    setStatus({ state: "deleting", message: "Limpiando override del assessment..." });
    try {
      const nextAssessment = await deleteTopologyDesignGuideline(record.id, currentUser);
      setAssessmentGuideline(nextAssessment);
      setAssessmentDraft(nextAssessment.guideline.content);
      setStatus({ state: "idle", message: "Override eliminado; el assessment vuelve a heredar." });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudo eliminar override del assessment." });
    }
  }

  if (!isAdmin) return null;

  const busy = status.state === "loading" || status.state === "saving" || status.state === "deleting";
  const globalSource = globalGuideline?.record ? "Global personalizado" : "Default semilla";
  const assessmentSource = assessmentGuideline ? designGuidelineSourceLabel(assessmentGuideline.guideline.source) : "Cargando";
  const assessmentInheritance = assessmentGuideline?.record ? "Override activo para este assessment" : `Hereda de: ${assessmentSource}`;

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network size={16} className="text-primary" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Guidelines de diseno - Topologia (admin)</h2>
              <Badge tone="neutral">{assessmentSource}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {assessmentGuideline?.guideline.updatedAt ? `Fuente efectiva actualizada ${formatDate(assessmentGuideline.guideline.updatedAt)}` : "Usa el default global hasta que exista contenido persistido."}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setStatus({ state: "loading", message: "Cargando guidelines..." });
            void loadGuidelines();
          }}
          disabled={busy}
        >
          <RotateCcw size={14} />
          Refrescar
        </Button>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {status.message && (
          <div className={cn("rounded-md border px-3 py-2 text-xs", status.state === "error" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-border bg-muted/40 text-muted-foreground")}>
            {status.message}
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Global</p>
                <p className="text-xs text-muted-foreground">
                  {globalSource}{globalGuideline?.record?.updatedAt ? ` · ${formatDate(globalGuideline.record.updatedAt)}` : ""}
                </p>
              </div>
              <Badge tone={globalGuideline?.record ? "success" : "neutral"}>{globalGuideline?.record ? "Persistido" : "Semilla"}</Badge>
            </div>
            <Textarea
              className="mt-3 min-h-72 font-mono text-xs"
              value={globalDraft}
              disabled={busy}
              onChange={(event) => setGlobalDraft(event.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => void saveGlobalGuideline()} disabled={busy}>
                <Save size={14} />
                Guardar global
              </Button>
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Este assessment</p>
                <p className="text-xs text-muted-foreground">
                  {assessmentInheritance}{assessmentGuideline?.record?.updatedAt ? ` · ${formatDate(assessmentGuideline.record.updatedAt)}` : ""}
                </p>
              </div>
              <Badge tone={assessmentGuideline?.record ? "success" : "neutral"}>{assessmentGuideline?.record ? "Override activo" : "Heredado"}</Badge>
            </div>
            <Textarea
              className="mt-3 min-h-72 font-mono text-xs"
              value={assessmentDraft}
              disabled={busy}
              onChange={(event) => setAssessmentDraft(event.target.value)}
            />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => void clearAssessmentGuideline()} disabled={busy || !assessmentGuideline?.record}>
                <Trash2 size={14} />
                Volver a global
              </Button>
              <Button size="sm" onClick={() => void saveAssessmentGuideline()} disabled={busy}>
                <Save size={14} />
                Guardar override
              </Button>
            </div>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

const playbookScopeTabs: Array<{ id: PlaybookScopeId; label: string; description: string }> = [
  { id: "configuration", label: "Configuraciones", description: "Criterios y exclusiones para configuracion de equipos." },
  { id: "security", label: "Seguridad", description: "Hardening, exposiciones administrativas y controles de seguridad." },
  { id: "evidence", label: "Logs y Eventos", description: "Eventos, logs, recurrencia y brechas de evidencia operacional." },
  { id: "performance", label: "Performance Análisis", description: "Metricas, capacidad, errores, drops y gaps de performance." }
];

function ScopePlaybooksAdminPanel({ currentUser }: { currentUser: AppUser }) {
  const [activeScope, setActiveScope] = useState<PlaybookScopeId>("configuration");
  const scopeTabRefs = useRef<Partial<Record<PlaybookScopeId, HTMLButtonElement | null>>>({});

  function handleScopeTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = playbookScopeTabs.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowRight"
          ? currentIndex === lastIndex ? 0 : currentIndex + 1
          : currentIndex === 0 ? lastIndex : currentIndex - 1;
    const nextScope = playbookScopeTabs[nextIndex].id;
    setActiveScope(nextScope);
    window.requestAnimationFrame(() => scopeTabRefs.current[nextScope]?.focus());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Playbooks</h2>
            <p className="text-xs text-muted-foreground">Ajustes globales por ambito de salidas de comando.</p>
          </div>
        </div>
        <Badge tone="info">Global</Badge>
      </div>
      <div className="space-y-4">
        <div className="flex gap-1 overflow-x-auto border-b border-border pt-1" role="tablist" aria-label="Ambitos de playbook">
          {playbookScopeTabs.map((tab, index) => {
            const selected = activeScope === tab.id;
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  scopeTabRefs.current[tab.id] = element;
                }}
                id={`scope-playbook-scope-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`scope-playbook-scope-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className={cn(
                  "-mb-px inline-flex h-10 shrink-0 items-center rounded-t-md border px-3 text-sm font-medium outline-none transition focus:ring-2 focus:ring-primary/70",
                  selected
                    ? "border-border border-b-background bg-background text-foreground shadow-sm"
                    : "border-transparent bg-muted/30 text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground"
                )}
                onClick={() => setActiveScope(tab.id)}
                onKeyDown={(event) => handleScopeTabKeyDown(event, index)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {playbookScopeTabs.map((scope) => (
          <div
            key={scope.id}
            id={`scope-playbook-scope-panel-${scope.id}`}
            role="tabpanel"
            aria-labelledby={`scope-playbook-scope-tab-${scope.id}`}
            hidden={activeScope !== scope.id}
          >
            <ScopePlaybookAdminPanel
              currentUser={currentUser}
              scopeId={scope.id}
              scopeLabel={scope.label}
              scopeDescription={scope.description}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ScopePlaybookAdminPanel({
  currentUser,
  scopeId,
  scopeLabel,
  scopeDescription
}: {
  currentUser: AppUser;
  scopeId: PlaybookScopeId;
  scopeLabel: string;
  scopeDescription: string;
}) {
  const isAdmin = canManageUsers(currentUser);
  const [playbook, setPlaybook] = useState<ScopePlaybookResponse["playbook"] | null>(null);
  const [draft, setDraft] = useState<Pick<ScopePlaybookResponse["playbook"], "criteria" | "expected" | "exclusions">>({
    criteria: [],
    expected: [],
    exclusions: []
  });
  const [status, setStatus] = useState<{ state: "idle" | "loading" | "saving" | "error"; message: string }>({
    state: "idle",
    message: ""
  });
  const [activePlaybookSubtab, setActivePlaybookSubtab] = useState<PlaybookEditorSubtab>("criteria");
  const [playbookFamilyFilter, setPlaybookFamilyFilter] = useState<ScopePlaybookOsFamily>("all");
  const playbookSubtabRefs = useRef<Partial<Record<PlaybookEditorSubtab, HTMLButtonElement | null>>>({});

  const loadPlaybook = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await fetchScopePlaybook(scopeId, currentUser);
      setPlaybook(response.playbook);
      setDraft({
        criteria: response.playbook.criteria,
        expected: response.playbook.expected,
        exclusions: response.playbook.exclusions
      });
      setStatus({ state: "idle", message: "" });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudo cargar el playbook." });
    }
  }, [currentUser, isAdmin, scopeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlaybook();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPlaybook]);

  async function savePlaybook() {
    setStatus({ state: "saving", message: "Guardando playbook..." });
    try {
      const response = await updateScopePlaybook(scopeId, draft, currentUser);
      setPlaybook(response.playbook);
      setDraft({
        criteria: response.playbook.criteria,
        expected: response.playbook.expected,
        exclusions: response.playbook.exclusions
      });
      setStatus({ state: "idle", message: "Playbook guardado." });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudo guardar el playbook." });
    }
  }

  if (!isAdmin) return null;
  const busy = status.state === "loading" || status.state === "saving";
  const visibleCriteriaCount = draft.criteria.filter((item) => playbookItemVisibleForFamily(item, playbookFamilyFilter)).length;
  const visibleExpectedCount = draft.expected.filter((item) => playbookItemVisibleForFamily(item, playbookFamilyFilter)).length;
  const visibleExclusionCount = draft.exclusions.filter((item) => playbookItemVisibleForFamily(item, playbookFamilyFilter)).length;
  const playbookSubtabs = [
    { id: "criteria" as const, label: "Criterios", count: visibleCriteriaCount, panelId: `scope-playbook-${scopeId}-subtab-panel-criteria` },
    { id: "expected" as const, label: "Hallazgos esperados", count: visibleExpectedCount, panelId: `scope-playbook-${scopeId}-subtab-panel-expected` },
    { id: "exclusions" as const, label: "Exclusiones", count: visibleExclusionCount, panelId: `scope-playbook-${scopeId}-subtab-panel-exclusions` }
  ];

  function handlePlaybookSubtabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const lastIndex = playbookSubtabs.length - 1;
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? lastIndex
        : event.key === "ArrowRight"
          ? currentIndex === lastIndex ? 0 : currentIndex + 1
          : currentIndex === 0 ? lastIndex : currentIndex - 1;
    const nextSubtab = playbookSubtabs[nextIndex].id;
    setActivePlaybookSubtab(nextSubtab);
    window.requestAnimationFrame(() => playbookSubtabRefs.current[nextSubtab]?.focus());
  }

  function addPlaybookItem() {
    if (activePlaybookSubtab === "criteria") {
      setDraft((current) => ({
        ...current,
        criteria: [...current.criteria, { id: uid("criterion"), aspect: "", guidance: "", appliesTo: ["all"] }]
      }));
      return;
    }
    if (activePlaybookSubtab === "expected") {
      setDraft((current) => ({
        ...current,
        expected: [...current.expected, { id: uid("expected"), title: "", description: "", severityHint: "medium", exampleRationale: "", appliesTo: ["all"] }]
      }));
      return;
    }
    setDraft((current) => ({
      ...current,
      exclusions: [...current.exclusions, { id: uid("exclusion"), keywords: [], reason: "", source: "manual", appliesTo: ["all"] }]
    }));
  }

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-primary" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Playbook - {scopeLabel}</h2>
              <Badge tone="neutral">{playbook ? shortHash(playbook.hash) : "Cargando"}</Badge>
              <Badge tone="info">Global</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {playbook?.updatedAt ? `Actualizado ${formatDate(playbook.updatedAt)} por ${playbook.updatedBy ?? "admin"}` : scopeDescription}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setStatus({ state: "loading", message: "Cargando playbook..." });
              void loadPlaybook();
            }}
            disabled={busy}
          >
            <RotateCcw size={14} />
            Refrescar
          </Button>
          <Button size="sm" onClick={() => void savePlaybook()} disabled={busy}>
            <Save size={14} />
            Guardar
          </Button>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {status.message && (
          <div className={cn("rounded-md border px-3 py-2 text-xs", status.state === "error" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-border bg-muted/40 text-muted-foreground")}>
            {status.message}
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border pt-1">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label={`Secciones del playbook de ${scopeLabel}`}>
            {playbookSubtabs.map((tab, index) => {
              const selected = activePlaybookSubtab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(element) => {
                    playbookSubtabRefs.current[tab.id] = element;
                  }}
                  id={`scope-playbook-${scopeId}-subtab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={tab.panelId}
                  tabIndex={selected ? 0 : -1}
                  className={cn(
                    "-mb-px inline-flex h-10 shrink-0 items-center gap-2 rounded-t-md border px-3 text-sm font-medium outline-none transition focus:ring-2 focus:ring-primary/70",
                    selected
                      ? "border-border border-b-background bg-background text-foreground shadow-sm"
                      : "border-transparent bg-muted/30 text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground"
                  )}
                  onClick={() => setActivePlaybookSubtab(tab.id)}
                  onKeyDown={(event) => handlePlaybookSubtabKeyDown(event, index)}
                >
                  <span>{tab.label}</span>
                  <Badge tone="neutral">{tab.count}</Badge>
                </button>
              );
            })}
          </div>
          <Button size="sm" variant="secondary" className="mb-1" onClick={addPlaybookItem} disabled={busy}>
            <Plus size={14} />
            Agregar
          </Button>
        </div>
        <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
          Ver items de:
          <select
            className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground"
            value={playbookFamilyFilter}
            onChange={(event) => setPlaybookFamilyFilter(event.target.value as ScopePlaybookOsFamily)}
          >
            {playbookOsFamilyOptions.map((family) => (
              <option key={family} value={family}>{playbookOsFamilyLabel(family)}</option>
            ))}
          </select>
        </label>

        <div
          id={`scope-playbook-${scopeId}-subtab-panel-criteria`}
          role="tabpanel"
          aria-labelledby={`scope-playbook-${scopeId}-subtab-criteria`}
          className="rounded-b-md rounded-tr-md border border-t-0 border-border bg-background p-3"
          hidden={activePlaybookSubtab !== "criteria"}
        >
          <PlaybookCriteriaEditor
            values={draft.criteria}
            disabled={busy}
            familyFilter={playbookFamilyFilter}
            onChange={(criteria) => setDraft((current) => ({ ...current, criteria }))}
          />
        </div>

        <div
          id={`scope-playbook-${scopeId}-subtab-panel-expected`}
          role="tabpanel"
          aria-labelledby={`scope-playbook-${scopeId}-subtab-expected`}
          className="rounded-b-md rounded-tr-md border border-t-0 border-border bg-background p-3"
          hidden={activePlaybookSubtab !== "expected"}
        >
          <PlaybookExpectedEditor
            values={draft.expected}
            disabled={busy}
            familyFilter={playbookFamilyFilter}
            onChange={(expected) => setDraft((current) => ({ ...current, expected }))}
          />
        </div>

        <div
          id={`scope-playbook-${scopeId}-subtab-panel-exclusions`}
          role="tabpanel"
          aria-labelledby={`scope-playbook-${scopeId}-subtab-exclusions`}
          className="rounded-b-md rounded-tr-md border border-t-0 border-border bg-background p-3"
          hidden={activePlaybookSubtab !== "exclusions"}
        >
          <PlaybookExclusionEditor
            values={draft.exclusions}
            disabled={busy}
            familyFilter={playbookFamilyFilter}
            onChange={(exclusions) => setDraft((current) => ({ ...current, exclusions }))}
          />
        </div>
      </PanelBody>
    </Panel>
  );
}

function PlaybookCriteriaEditor({
  values,
  disabled,
  familyFilter,
  onChange
}: {
  values: ScopePlaybookCriterion[];
  disabled: boolean;
  familyFilter: ScopePlaybookOsFamily;
  onChange: (values: ScopePlaybookCriterion[]) => void;
}) {
  function update(index: number, patch: Partial<ScopePlaybookCriterion>) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }
  return (
    <div>
      <div className="space-y-2">
        {values.map((item, index) => playbookItemVisibleForFamily(item, familyFilter) && (
          <div key={item.id} className="grid gap-2 rounded-md border border-border bg-muted/20 p-2 md:grid-cols-[170px_220px_1fr_auto]">
            <Input value={item.aspect} disabled={disabled} placeholder="Aspecto" onChange={(event) => update(index, { aspect: event.target.value })} />
            <PlaybookAppliesToSelector value={item.appliesTo} disabled={disabled} onChange={(appliesTo) => update(index, { appliesTo })} />
            <Textarea value={item.guidance} disabled={disabled} className="min-h-20" placeholder="Guia de evaluacion" onChange={(event) => update(index, { guidance: event.target.value })} />
            <Button size="icon" variant="ghost" title="Quitar criterio" disabled={disabled} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaybookExpectedEditor({
  values,
  disabled,
  familyFilter,
  onChange
}: {
  values: ScopePlaybookExpectedFinding[];
  disabled: boolean;
  familyFilter: ScopePlaybookOsFamily;
  onChange: (values: ScopePlaybookExpectedFinding[]) => void;
}) {
  function update(index: number, patch: Partial<ScopePlaybookExpectedFinding>) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }
  return (
    <div>
      <div className="space-y-2">
        {values.map((item, index) => playbookItemVisibleForFamily(item, familyFilter) && (
          <div key={item.id} className="grid gap-2 rounded-md border border-border bg-muted/20 p-2 lg:grid-cols-[1fr_130px_220px_1fr_auto]">
            <Input value={item.title} disabled={disabled} placeholder="Titulo esperado" onChange={(event) => update(index, { title: event.target.value })} />
            <select
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
              value={item.severityHint}
              disabled={disabled}
              onChange={(event) => update(index, { severityHint: event.target.value as RiskLevel })}
            >
              {riskLevelsForEditor.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
            </select>
            <PlaybookAppliesToSelector value={item.appliesTo} disabled={disabled} onChange={(appliesTo) => update(index, { appliesTo })} />
            <Textarea value={item.description} disabled={disabled} className="min-h-20" placeholder="Descripcion" onChange={(event) => update(index, { description: event.target.value })} />
            <Button size="icon" variant="ghost" title="Quitar esperado" disabled={disabled} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 size={14} />
            </Button>
            <Textarea
              value={item.exampleRationale}
              disabled={disabled}
              className="min-h-16 lg:col-span-4"
              placeholder="Ejemplo de racional"
              onChange={(event) => update(index, { exampleRationale: event.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaybookExclusionEditor({
  values,
  disabled,
  familyFilter,
  onChange
}: {
  values: ScopePlaybookExclusion[];
  disabled: boolean;
  familyFilter: ScopePlaybookOsFamily;
  onChange: (values: ScopePlaybookExclusion[]) => void;
}) {
  function update(index: number, patch: Partial<ScopePlaybookExclusion>) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }
  return (
    <div>
      <div className="space-y-2">
        {values.map((item, index) => playbookItemVisibleForFamily(item, familyFilter) && (
          <div key={item.id} className="grid gap-2 rounded-md border border-border bg-muted/20 p-2 lg:grid-cols-[1fr_150px_1fr_220px_120px_auto]">
            <Input
              value={item.keywords.join(", ")}
              disabled={disabled}
              placeholder="keywords separadas por coma"
              onChange={(event) => update(index, { keywords: splitCsv(event.target.value) })}
            />
            <select
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
              value={item.severityBelow ?? ""}
              disabled={disabled}
              onChange={(event) => update(index, { severityBelow: event.target.value ? event.target.value as RiskLevel : undefined })}
            >
              <option value="">Sin umbral</option>
              {riskLevelsForEditor.map((risk) => <option key={risk} value={risk}>Bajo {risk}</option>)}
            </select>
            <Input
              value={(item.findingTypeIn ?? []).join(", ")}
              disabled={disabled}
              placeholder="finding_type incluidos"
              onChange={(event) => update(index, { findingTypeIn: splitCsv(event.target.value) })}
            />
            <PlaybookAppliesToSelector value={item.appliesTo} disabled={disabled} onChange={(appliesTo) => update(index, { appliesTo })} />
            <Badge tone={item.source === "review_feedback" ? "info" : "neutral"}>{item.source === "review_feedback" ? "Revision" : "Manual"}</Badge>
            <Button size="icon" variant="ghost" title="Quitar exclusion" disabled={disabled} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 size={14} />
            </Button>
            <Textarea
              value={item.reason}
              disabled={disabled}
              className="min-h-16 lg:col-span-5"
              placeholder="Motivo"
              onChange={(event) => update(index, { reason: event.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaybookAppliesToSelector({
  value,
  disabled,
  onChange
}: {
  value: ScopePlaybookOsFamily[];
  disabled: boolean;
  onChange: (value: ScopePlaybookOsFamily[]) => void;
}) {
  const normalized = normalizePlaybookAppliesTo(value);
  return (
    <div className="rounded-md border border-border bg-white px-2 py-1">
      <p className="text-[11px] font-medium text-muted-foreground">Aplica a</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {playbookOsFamilyOptions.map((family) => {
          const checked = normalized.includes(family);
          return (
            <label
              key={family}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1 rounded border px-2 text-xs",
                checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground"
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(togglePlaybookAppliesTo(normalized, family))}
              />
              {playbookOsFamilyLabel(family)}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function playbookItemVisibleForFamily(item: { appliesTo?: ScopePlaybookOsFamily[] }, family: ScopePlaybookOsFamily) {
  if (family === "all") return true;
  const appliesTo = normalizePlaybookAppliesTo(item.appliesTo);
  return appliesTo.includes("all") || appliesTo.includes(family);
}

function normalizePlaybookAppliesTo(value: ScopePlaybookOsFamily[] | undefined): ScopePlaybookOsFamily[] {
  const valid = new Set(playbookOsFamilyOptions);
  const normalized = Array.from(new Set((Array.isArray(value) ? value : []).filter((family) => valid.has(family))));
  return normalized.length > 0 ? normalized : ["all"];
}

function togglePlaybookAppliesTo(current: ScopePlaybookOsFamily[], family: ScopePlaybookOsFamily): ScopePlaybookOsFamily[] {
  if (family === "all") return ["all"];
  const withoutAll = current.filter((item) => item !== "all");
  const next = withoutAll.includes(family) ? withoutAll.filter((item) => item !== family) : [...withoutAll, family];
  return next.length > 0 ? next : ["all"];
}

function playbookOsFamilyLabel(family: ScopePlaybookOsFamily) {
  if (family === "ios-xe") return "IOS-XE";
  if (family === "ios") return "IOS";
  if (family === "nxos") return "NX-OS";
  if (family === "asa") return "ASA";
  if (family === "unknown") return "Desconocido";
  return "Todos";
}

function inferFindingOsFamilies(finding: Finding, record: AssessmentRecord): ScopePlaybookOsFamily[] {
  const assetKeys = new Set(finding.affectedAssets.map((asset) => asset.toLowerCase()));
  const families = new Set<ScopePlaybookOsFamily>();
  const parsedDevices = Array.isArray(record.parsed.devices) ? record.parsed.devices : [];

  for (const device of parsedDevices as any[]) {
    if (assetKeys.has(String(device.hostname ?? "").toLowerCase()) || assetKeys.has(String(device.id ?? "").toLowerCase())) {
      const family = uiDeviceOsFamily(device);
      if (family !== "unknown") families.add(family);
    }
  }

  for (const asset of record.targetInventory as any[]) {
    if (assetKeys.has(String(asset.hostname ?? "").toLowerCase()) || assetKeys.has(String(asset.id ?? "").toLowerCase())) {
      const family = uiDeviceOsFamily(asset);
      if (family !== "unknown") families.add(family);
    }
  }

  return families.size > 0 ? Array.from(families) : ["all"];
}

function uiDeviceOsFamily(device: { softwareVersion?: unknown; platform?: unknown; model?: unknown }): ScopePlaybookOsFamily {
  const software = `${device.softwareVersion ?? ""} ${device.platform ?? ""}`.toLowerCase();
  const model = String(device.model ?? "").toLowerCase();
  return detectUiOsFamily(software) ?? detectUiOsFamily(model) ?? "unknown";
}

function detectUiOsFamily(value: string): ScopePlaybookOsFamily | null {
  if (!value.trim()) return null;
  if (value.includes("ios-xe") || value.includes("ios xe")) return "ios-xe";
  if (value.includes("nx-os") || value.includes("nx os") || value.includes("nexus") || /\bn[975]k\b/.test(value)) return "nxos";
  if (value.includes("adaptive security") || /\basa\b/.test(value) || /\bfpr\b/.test(value)) return "asa";
  if (value.includes("ios") && !value.includes("xe")) return "ios";
  return null;
}

function AIDebugAdminPanel({ record, currentUser }: { record: AssessmentRecord; currentUser: AppUser }) {
  const isAdmin = canManageUsers(currentUser);
  const [setting, setSetting] = useState<AIDebugSetting | null>(null);
  const [interactions, setInteractions] = useState<AIDebugInteraction[]>([]);
  const [status, setStatus] = useState<{ state: "idle" | "loading" | "saving" | "purging" | "error"; message: string }>({
    state: "idle",
    message: ""
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedDebugScopes, setExpandedDebugScopes] = useState<Record<string, boolean>>({});

  const debugScopeGroups = useMemo(() => {
    const groups = new Map<string, {
      scopeId: string;
      itemCount: number;
      rejectedCount: number;
      phases: Map<string, { phaseName: string; items: AIDebugInteraction[] }>;
    }>();
    interactions.forEach((interaction) => {
      const group = groups.get(interaction.scopeId) ?? {
        scopeId: interaction.scopeId,
        itemCount: 0,
        rejectedCount: 0,
        phases: new Map<string, { phaseName: string; items: AIDebugInteraction[] }>()
      };
      const phase = group.phases.get(interaction.phaseName) ?? { phaseName: interaction.phaseName, items: [] };
      phase.items.push(interaction);
      group.itemCount += 1;
      group.rejectedCount += summarizeRejectedFindings(interaction.rejectedFindings).count;
      group.phases.set(interaction.phaseName, phase);
      groups.set(interaction.scopeId, group);
    });
    return Array.from(groups.values()).map((group) => ({
      scopeId: group.scopeId,
      itemCount: group.itemCount,
      rejectedCount: group.rejectedCount,
      phases: Array.from(group.phases.values())
    }));
  }, [interactions]);

  const loadDebugData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [nextSetting, nextInteractions] = await Promise.all([
        fetchAIDebugSetting(record.id, currentUser),
        fetchAIDebugInteractions(record.id, currentUser)
      ]);
      setSetting(nextSetting);
      setInteractions(nextInteractions);
      setStatus({ state: "idle", message: nextInteractions.length ? `Ultima consulta: ${formatDate(new Date().toISOString())}` : "" });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudo cargar debug AI." });
    }
  }, [currentUser, isAdmin, record.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDebugData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDebugData]);

  async function toggleCapture(nextEnabled: boolean) {
    setStatus({ state: "saving", message: nextEnabled ? "Activando captura..." : "Desactivando captura..." });
    try {
      const nextSetting = await updateAIDebugSetting(record.id, nextEnabled, currentUser);
      setSetting(nextSetting);
      setStatus({ state: "idle", message: nextEnabled ? "Captura activa para este assessment." : "Captura desactivada." });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudo actualizar captura AI." });
    }
  }

  async function purgeInteractions() {
    if (!window.confirm("Eliminar interacciones capturadas de este assessment?")) return;
    setStatus({ state: "purging", message: "Eliminando interacciones..." });
    try {
      await deleteAIDebugInteractions(record.id, currentUser);
      setInteractions([]);
      setStatus({ state: "idle", message: "Interacciones eliminadas." });
    } catch (error) {
      setStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudo purgar debug AI." });
    }
  }

  async function copyInteractionJson(key: string, value: unknown) {
    await navigator.clipboard.writeText(prettyDebugJson(value));
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1600);
  }

  if (!isAdmin) return null;

  const busy = status.state === "loading" || status.state === "saving" || status.state === "purging";
  const captureEnabled = Boolean(setting?.captureEnabled);

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode2 size={16} className="text-primary" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Debug OpenAI</h2>
              <Badge tone={captureEnabled ? "success" : "neutral"}>{captureEnabled ? "Captura activa" : "Captura off"}</Badge>
              <Badge tone="neutral">{interactions.length} logs</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {setting?.updatedAt ? `Actualizado ${formatDate(setting.updatedAt)} por ${setting.updatedBy ?? "admin"}` : "Sin configuracion persistida"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={captureEnabled}
              disabled={busy}
              onChange={(event) => void toggleCapture(event.target.checked)}
            />
            Capturar
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setStatus({ state: "loading", message: "Cargando captura AI..." });
              void loadDebugData();
            }}
            disabled={busy}
          >
            <RotateCcw size={14} />
            Refrescar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void purgeInteractions()} disabled={busy || interactions.length === 0}>
            <Trash2 size={14} />
            Purgar
          </Button>
        </div>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {status.message && (
          <div className={cn("rounded-md border px-3 py-2 text-xs", status.state === "error" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-border bg-muted/40 text-muted-foreground")}>
            {status.message}
          </div>
        )}
        {debugScopeGroups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            No hay interacciones capturadas para este assessment.
          </div>
        ) : (
          <div className="space-y-3">
            {debugScopeGroups.map((scopeGroup, index) => (
              <details
                key={scopeGroup.scopeId}
                className="rounded-md border border-border"
                open={expandedDebugScopes[scopeGroup.scopeId] ?? index === 0}
                onToggle={(event) => {
                  const open = event.currentTarget.open;
                  setExpandedDebugScopes((current) => ({ ...current, [scopeGroup.scopeId]: open }));
                }}
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">{scopeLabel(scopeGroup.scopeId as AIAnalysisScopeId)}</p>
                    <p className="text-xs text-muted-foreground">{scopeGroup.phases.length} fases capturadas</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{scopeGroup.itemCount} llamadas</Badge>
                    <Badge tone={scopeGroup.rejectedCount > 0 ? "danger" : "neutral"}>{scopeGroup.rejectedCount} rechazados</Badge>
                  </div>
                </summary>
                <div className="space-y-3 border-t border-border p-3">
                  {scopeGroup.phases.map((group) => (
                    <div key={`${scopeGroup.scopeId}:${group.phaseName}`} className="rounded-md border border-border bg-muted/10">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold">{humanizeAIPhase(group.phaseName)}</p>
                          <p className="text-xs text-muted-foreground">{group.phaseName}</p>
                        </div>
                        <Badge tone="neutral">{group.items.length} llamadas</Badge>
                      </div>
                      <div className="space-y-2 p-3">
                        {group.items.map((interaction) => {
                          const rejectedSummary = summarizeRejectedFindings(interaction.rejectedFindings);
                          const interactionStatusLabel = humanizeScopeStatus(interaction.status);
                          return (
                            <div key={interaction.id} className="rounded-md border border-border bg-background/50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span title={interactionStatusLabel.tooltip}>
                                      <Badge tone={scopeStatusTone(interaction.status)}>{interactionStatusLabel.label}</Badge>
                                    </span>
                                    <span className="text-xs font-medium">{interaction.model}</span>
                                    <span className="text-xs text-muted-foreground">{formatDate(interaction.createdAt)}</span>
                                  </div>
                                  <p className="mt-1 truncate text-xs text-muted-foreground">
                                    job {interaction.jobId} · {interaction.promptVersion} · {interaction.engineVersion}
                                  </p>
                                </div>
                                <div className="grid min-w-full gap-2 text-xs sm:min-w-[520px] sm:grid-cols-4">
                                  <DebugMetric label="HTTP" value={interaction.httpStatus ?? "-"} />
                                  <DebugMetric label="Latencia" value={formatDebugLatency(interaction.latencyMs)} />
                                  <DebugMetric label="Input" value={`${formatDebugNumber(interaction.inputTokensEst)} est / ${formatDebugNumber(interaction.inputTokens)} real`} />
                                  <DebugMetric label="Output" value={formatDebugNumber(interaction.outputTokens)} />
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                <Badge tone={interaction.budgetTrimmed ? "warning" : "neutral"}>
                                  {interaction.budgetTrimmed ? "Budget recortado" : "Budget completo"}
                                </Badge>
                                <Badge tone={interaction.excludedEvidenceRefs > 0 ? "warning" : "neutral"}>
                                  {interaction.excludedEvidenceRefs} evidencias excluidas
                                </Badge>
                                <Badge tone={rejectedSummary.count > 0 ? "danger" : "neutral"}>
                                  {rejectedSummary.count} rechazados
                                </Badge>
                                {rejectedSummary.reasons.map((reason) => (
                                  <span key={reason} className="rounded bg-muted px-2 py-1 text-muted-foreground">{reason}</span>
                                ))}
                              </div>
                              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                                <DebugJsonBlock
                                  title="Request"
                                  size={debugJsonSizeLabel(interaction.requestJson)}
                                  value={interaction.requestJson}
                                  copied={copiedKey === `${interaction.id}:request`}
                                  onCopy={() => void copyInteractionJson(`${interaction.id}:request`, interaction.requestJson)}
                                />
                                <DebugJsonBlock
                                  title="Response"
                                  size={debugJsonSizeLabel(interaction.responseJson)}
                                  value={interaction.responseJson}
                                  copied={copiedKey === `${interaction.id}:response`}
                                  onCopy={() => void copyInteractionJson(`${interaction.id}:response`, interaction.responseJson)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function DebugMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-muted/30 px-2 py-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words font-semibold">{value}</p>
    </div>
  );
}

function DebugJsonBlock({
  title,
  size,
  value,
  copied,
  onCopy
}: {
  title: string;
  size: string;
  value: unknown;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <details className="rounded-md border border-border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium">
        <span>{title} · {size}</span>
        <Button variant="ghost" size="sm" onClick={(event) => { event.preventDefault(); onCopy(); }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </summary>
      <pre className="max-h-80 overflow-auto border-t border-border p-3 text-[11px] leading-relaxed text-muted-foreground">
        {prettyDebugJson(value)}
      </pre>
    </details>
  );
}

function AIReviewPanel({
  record,
  currentUser,
  scopeFindingFilter,
  onClearScopeFindingFilter,
  onUpdateFinding
}: {
  record: AssessmentRecord;
  currentUser: AppUser | null;
  scopeFindingFilter: EvaluationArea | null;
  onClearScopeFindingFilter: () => void;
  onUpdateFinding: (id: string, patch: Partial<Finding>) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | Finding["status"]>("all");
  const [reviewSuppressionStatus, setReviewSuppressionStatus] = useState<{ state: "idle" | "saving" | "error"; message: string }>({ state: "idle", message: "" });
  const aiFindingsById = new Map(record.parsed.findings.filter((finding) => finding.aiMetadata).map((finding) => [finding.id, finding]));
  const areaFilteredFindings = filterFindingsByArea(Array.from(aiFindingsById.values()), scopeFindingFilter);
  const aiFindings = areaFilteredFindings.filter((finding) => statusFilter === "all" || finding.status === statusFilter);
  const acceptedCount = aiFindings.filter((finding) => finding.status === "accepted" || finding.status === "edited" || finding.status === "validated").length;
  const filterLabel = scopeFindingFilter ? evaluationAreaLabel(scopeFindingFilter) : null;
  const canAppendReviewSuppression = Boolean(currentUser && canManageUsers(currentUser));

  async function suppressLikeFinding(finding: Finding) {
    const playbookScopeId = playbookScopeIdForFinding(finding);
    if (!currentUser || !playbookScopeId) return;
    setReviewSuppressionStatus({ state: "saving", message: "Creando exclusion en playbook..." });
    try {
      await appendReviewSuppressionToScopePlaybook(playbookScopeId, finding, currentUser, record);
      onUpdateFinding(finding.id, { status: "discarded" });
      setReviewSuppressionStatus({ state: "idle", message: `Exclusion agregada al playbook de ${playbookScopeLabel(playbookScopeId)}.` });
    } catch (error) {
      setReviewSuppressionStatus({ state: "error", message: error instanceof Error ? error.message : "No se pudo crear la exclusion." });
    }
  }

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Revision AI y correlacion</h2>
            <p className="text-xs text-muted-foreground">
              {record.aiAnalysis.correlationCandidates.length} correlaciones · {aiFindingsById.size} sugerencias · {acceptedCount} aceptadas o validadas
            </p>
          </div>
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | Finding["status"])}
        >
          <option value="all">Todos los estados</option>
          <option value="ai_suggested">Sugeridos</option>
          <option value="accepted">Aceptados</option>
          <option value="edited">Editados</option>
          <option value="validated">Validados</option>
          <option value="discarded">Descartados</option>
        </select>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {scopeFindingFilter && filterLabel && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="info">Filtrando: {filterLabel}</Badge>
            <Button variant="ghost" size="sm" onClick={onClearScopeFindingFilter}>
              <X size={14} />
              Limpiar filtro
            </Button>
          </div>
        )}
        {reviewSuppressionStatus.message && (
          <div className={cn("rounded-md border px-3 py-2 text-xs", reviewSuppressionStatus.state === "error" ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-border bg-muted/40 text-muted-foreground")}>
            {reviewSuppressionStatus.message}
          </div>
        )}
        {record.aiAnalysis.limitations.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-semibold">Limitaciones de analisis</p>
            <p className="mt-1">{record.aiAnalysis.limitations.join(" · ")}</p>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {record.aiAnalysis.correlationCandidates.slice(0, 6).map((candidate) => (
            <div key={candidate.id} className="rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{candidate.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{candidate.correlationType}</p>
                </div>
                <Badge tone={riskTone[candidate.severityHint]}>{candidate.severityHint}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{candidate.description}</p>
              <div className="mt-3 flex flex-wrap gap-1 text-[11px]">
                {candidate.involvedDevices.slice(0, 4).map((device) => (
                  <span key={device} className="rounded border border-border px-2 py-0.5 text-muted-foreground">{device}</span>
                ))}
                <span className="rounded border border-border px-2 py-0.5 text-muted-foreground">{candidate.confidence}% confianza</span>
              </div>
            </div>
          ))}
        </div>
        {aiFindings.length === 0 ? (
          <EmptyState icon={<Bot size={24} />} title="Sin sugerencias AI para revisar" />
        ) : (
          <div className="space-y-3">
            {aiFindings.map((finding, index) => (
              <FindingRow
                key={findingRenderKey(finding, index)}
                finding={finding}
                onChange={(patch) => onUpdateFinding(finding.id, patch)}
                onSuppressLike={canAppendReviewSuppression && playbookScopeIdForFinding(finding) ? () => void suppressLikeFinding(finding) : undefined}
                suppressLikeBusy={reviewSuppressionStatus.state === "saving"}
              />
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function PerformanceAnalysisRunCard({
  record,
  order,
  onProcessPerformance,
  onRunPerformanceAi,
  onResetPerformance
}: {
  record: AssessmentRecord;
  order: number;
  onProcessPerformance: () => void;
  onRunPerformanceAi: () => void;
  onResetPerformance: () => void;
}) {
  const progress = Math.max(record.performance.assessment.dataCoverageScore, record.performance.metrics.length > 0 ? 70 : 0);
  const performanceFindings = record.parsed.findings.filter((finding) => finding.serviceOffer === "Performance Analysis");
  const findingSummary = summarizeAreaFindings(performanceFindings);
  const processIsPrimary = record.performance.metrics.length === 0;
  const performancePrimaryAction = processIsPrimary
    ? {
        label: "Procesar evidencia",
        icon: <PlayCircle size={14} />,
        onClick: onProcessPerformance,
        disabled: record.performance.evidenceFiles.length === 0
      }
    : {
        label: "Evaluar con AI",
        icon: <Bot size={14} />,
        onClick: onRunPerformanceAi,
        disabled: record.performance.findings.length === 0
      };
  return (
    <EvaluationAmbitoNode
      order={order}
      label="Performance Analysis"
      description="Procesa evidencia de rendimiento, genera metricas, hallazgos con evidencia y contexto para AI."
      icon={Activity}
      status={record.performance.assessment.status}
      active={isAnimatedStatus(record.performance.assessment.status)}
      progress={progress}
      message={`${record.performance.metrics.length} metricas · ${record.performance.findings.length} hallazgos · confianza ${record.performance.assessment.confidenceScore}%`}
      findingSummary={findingSummary}
      actions={(
        <>
          <Button size="sm" onClick={performancePrimaryAction.onClick} disabled={performancePrimaryAction.disabled}>
            {performancePrimaryAction.icon}
            {performancePrimaryAction.label}
          </Button>
          <CardOverflowMenu
            label="Acciones de Performance"
            actions={[
              {
                label: "Reset",
                onSelect: onResetPerformance,
                disabled: record.performance.evidenceFiles.length === 0 && record.performance.metrics.length === 0 && record.performance.findings.length === 0
              }
            ]}
          />
        </>
      )}
    />
  );
}

function FindingsTab({
  record,
  documentTemplates,
  onUpdateFinding
}: {
  record: AssessmentRecord;
  documentTemplates: DocumentTemplateVersion[];
  onUpdateFinding: (id: string, patch: Partial<Finding>) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<EvaluationArea, boolean>>(() => (
    Object.fromEntries(evaluationAreas.map((area) => [area.id, false])) as Record<EvaluationArea, boolean>
  ));
  const matrix = buildRiskAssessmentMatrix(record.parsed.findings);
  const grouped = evaluationAreas.map((area) => ({
    ...area,
    findings: record.parsed.findings.filter((finding) => finding.category === areaToCategory(area.id))
  }));
  const allCollapsed = grouped.every((group) => collapsedGroups[group.id]);
  const allExpanded = grouped.every((group) => !collapsedGroups[group.id]);
  const activeTemplate = documentTemplates.find((template) => template.documentType === "findings_report" && template.status === "active");

  async function generateFindingsDocument() {
    await downloadFinalReportDocument(record, activeTemplate, `${safeFileName(record.assessment.name)}-hallazgos-resumen-ejecutivo.docx`);
  }

  function setAllGroupsCollapsed(collapsed: boolean) {
    setCollapsedGroups(Object.fromEntries(evaluationAreas.map((area) => [area.id, collapsed])) as Record<EvaluationArea, boolean>);
  }

  function toggleGroupCollapsed(groupId: EvaluationArea) {
    setCollapsedGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <div>
              <h2 className="text-sm font-semibold">Riesgo / Hallazgos</h2>
              <p className="text-xs text-muted-foreground">Exporta la matriz de hallazgos preliminares y validados.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAllGroupsCollapsed(true)} disabled={allCollapsed || record.parsed.findings.length === 0}>
              <ChevronRight size={16} />
              Colapsar todo
            </Button>
            <Button variant="secondary" onClick={() => setAllGroupsCollapsed(false)} disabled={allExpanded || record.parsed.findings.length === 0}>
              <ChevronDown size={16} />
              Expandir todo
            </Button>
            <Button variant="secondary" onClick={generateFindingsDocument} disabled={record.parsed.findings.length === 0}>
              <FileDown size={16} />
              Word
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportFindingsToExcel(record.parsed.findings, record.assessment.name)}
              disabled={record.parsed.findings.length === 0}
            >
              <FileText size={16} />
              Excel
            </Button>
          </div>
        </PanelHeader>
      </Panel>
      <RiskAssessmentMatrix matrix={matrix} onUpdateFinding={onUpdateFinding} />
      {record.parsed.findings.length === 0 ? (
        <Panel>
          <PanelBody>
            <EmptyState icon={<ShieldCheck size={24} />} title="Sin hallazgos preliminares" />
          </PanelBody>
        </Panel>
      ) : (
        grouped.map((group) => (
          <Panel key={group.id}>
            <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <div>
                  <h2 className="text-sm font-semibold">{group.label}</h2>
                  <FindingSeveritySummary findings={group.findings} compact />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={group.findings.length > 0 ? "warning" : "neutral"}>{group.findings.length} hallazgos</Badge>
                <Button variant="secondary" size="sm" onClick={() => toggleGroupCollapsed(group.id)}>
                  {collapsedGroups[group.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  {collapsedGroups[group.id] ? "Expandir" : "Colapsar"}
                </Button>
              </div>
            </PanelHeader>
            {!collapsedGroups[group.id] && (
              <PanelBody>
                {group.findings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin hallazgos en este ambito.</p>
                ) : (
                  <div className="space-y-3">
                    {group.findings.map((finding, index) => (
                      <FindingRow key={findingRenderKey(finding, index)} finding={finding} onChange={(patch) => onUpdateFinding(finding.id, patch)} />
                    ))}
                  </div>
                )}
              </PanelBody>
            )}
          </Panel>
        ))
      )}
    </div>
  );
}

function FindingSeveritySummary({ findings, compact = false }: { findings: Finding[]; compact?: boolean }) {
  const counts = riskSummaryOrder.map((risk) => ({
    risk,
    count: findings.filter((finding) => finding.risk === risk).length
  }));
  const visibleCounts = counts.filter((item) => item.count > 0);

  if (visibleCounts.length === 0) {
    return compact
      ? <p className="mt-1 text-xs text-muted-foreground">Sin hallazgos</p>
      : <p className="text-sm text-muted-foreground">Sin hallazgos en este ambito.</p>;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", compact ? "mt-1" : "rounded-md border border-border bg-muted/30 p-3")}>
      {!compact && <span className="mr-1 text-sm font-medium text-foreground">Resumen por criticidad:</span>}
      {visibleCounts.map((item) => (
        <Badge key={item.risk} tone={riskTone[item.risk]}>
          {riskSummaryLabel[item.risk]}: {item.count}
        </Badge>
      ))}
    </div>
  );
}

function RiskAssessmentMatrix({
  matrix,
  onUpdateFinding
}: {
  matrix: ReturnType<typeof buildRiskAssessmentMatrix>;
  onUpdateFinding: (id: string, patch: Partial<Finding>) => void;
}) {
  const [selectedCell, setSelectedCell] = useState<{ probabilityId: string; severityId: string } | null>(null);
  const selectedProbability = selectedCell ? matrix.probabilities.find((probability) => probability.id === selectedCell.probabilityId) : undefined;
  const selectedSeverity = selectedCell ? matrix.severities.find((severity) => severity.id === selectedCell.severityId) : undefined;
  const selectedMatrixCell = selectedCell && selectedProbability && selectedSeverity
    ? matrix.cells[selectedProbability.id][selectedSeverity.id]
    : null;

  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Matriz de riesgo</h2>
          <p className="text-xs text-muted-foreground">Probabilidad por severidad. Cada celda muestra la cantidad de hallazgos ubicados en ese cuadrante.</p>
        </div>
      </PanelHeader>
      <PanelBody>
        <div className="relative">
          <div className="min-w-0 overflow-x-auto">
            <div className="w-full min-w-[980px]">
              <div className="mb-2 ml-44 flex items-center gap-3 text-sm font-semibold text-foreground">
                <span>Severidad / impacto</span>
                <div className="h-px flex-1 bg-primary" />
                <ArrowUp className="rotate-90 text-primary" size={18} />
              </div>
              <div className="grid grid-cols-[160px_repeat(5,minmax(0,1fr))] gap-1">
                <div />
                {matrix.severities.map((severity) => (
                  <div key={severity.id} className="rounded-md border border-border bg-muted/70 px-3 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">
                    {severity.label}
                  </div>
                ))}
                {matrix.probabilities.map((probability) => (
                  <React.Fragment key={probability.id}>
                    <div className="flex items-center justify-end rounded-md border border-border bg-muted/70 px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                      {probability.label}
                    </div>
                    {matrix.severities.map((severity) => {
                      const cell = matrix.cells[probability.id][severity.id];
                      const isSelected = selectedCell?.probabilityId === probability.id && selectedCell.severityId === severity.id;
                      return (
                        <button
                          key={`${probability.id}-${severity.id}`}
                          type="button"
                          className={cn(
                            "min-h-24 rounded-md border px-3 py-2 text-left transition hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/70",
                            riskMatrixToneClass(cell.level),
                            isSelected && "ring-2 ring-primary"
                          )}
                          title={`${probability.label} x ${severity.label}: ${cell.label}. Click para ver hallazgos.`}
                          onClick={() => setSelectedCell({ probabilityId: probability.id, severityId: severity.id })}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase">{cell.label}</span>
                            <span className="rounded border border-white/70 bg-white/70 px-2 py-0.5 text-sm font-bold shadow-sm dark:border-white/10 dark:bg-slate-950/35 dark:text-current">
                              {cell.findings.length}
                            </span>
                          </div>
                          {cell.findings.length > 0 && (
                            <div className="mt-2 flex max-h-12 flex-wrap gap-0.5 overflow-hidden">
                              {cell.findings.slice(0, 10).map((finding, index) => (
                                <span
                                  key={findingRenderKey(finding, index)}
                                  className="rounded border border-white/70 bg-white/70 px-1 py-0 text-[9px] font-semibold leading-4 shadow-sm dark:border-white/10 dark:bg-slate-950/35 dark:text-current"
                                  title={finding.title}
                                >
                                  {shortFindingId(finding)}
                                </span>
                              ))}
                              {cell.findings.length > 10 && (
                                <span className="rounded border border-white/70 bg-white/70 px-1 py-0 text-[9px] font-semibold leading-4 shadow-sm dark:border-white/10 dark:bg-slate-950/35 dark:text-current">+{cell.findings.length - 10}</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Leyenda:</span>
                {["low", "low-medium", "medium", "medium-high", "high"].map((level) => (
                  <span key={level} className={cn("rounded border px-2 py-1", riskMatrixToneClass(level))}>{riskMatrixLabel(level)}</span>
                ))}
              </div>
            </div>
          </div>
          {selectedMatrixCell && selectedProbability && selectedSeverity && (
            <div className="absolute inset-y-0 right-0 z-10 w-[min(360px,calc(100%-1rem))]">
              <RiskMatrixFindingPanel
                probabilityLabel={selectedProbability.label}
                severityLabel={selectedSeverity.label}
                cellLabel={selectedMatrixCell.label}
                findings={selectedMatrixCell.findings}
                onClose={() => setSelectedCell(null)}
                onUpdateFinding={onUpdateFinding}
              />
            </div>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
}

function RiskMatrixFindingPanel({
  probabilityLabel,
  severityLabel,
  cellLabel,
  findings,
  onClose,
  onUpdateFinding
}: {
  probabilityLabel: string;
  severityLabel: string;
  cellLabel: string;
  findings: Finding[];
  onClose: () => void;
  onUpdateFinding: (id: string, patch: Partial<Finding>) => void;
}) {
  return (
    <aside className="flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-md border border-border bg-[hsl(var(--surface))] shadow-2xl ring-1 ring-black/10">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Hallazgos de la celda</p>
          <h3 className="mt-1 break-words text-sm font-semibold">{probabilityLabel} x {severityLabel}</h3>
          <p className="mt-1 break-words text-xs text-muted-foreground">{cellLabel} · {findings.length} hallazgo(s)</p>
        </div>
        <Button size="icon" variant="ghost" title="Cerrar panel" onClick={onClose}>
          <X size={15} />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {findings.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={24} />} title="Sin hallazgos en esta celda" />
        ) : (
          findings.map((finding, index) => (
            <article key={findingRenderKey(finding, index)} className="min-w-0 rounded-md border border-border bg-[hsl(var(--surface-raised))] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">{shortFindingId(finding)}</p>
                  <h4 className="mt-1 line-clamp-2 break-words text-sm font-semibold">{finding.title}</h4>
                </div>
                <Badge tone={riskTone[finding.risk]}>{finding.risk.toUpperCase()}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 break-words text-xs text-muted-foreground">{finding.recommendation}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                <Badge tone="info">{Math.round(finding.confidence * 100)}% confianza</Badge>
                <Badge tone="neutral">{finding.status}</Badge>
                {finding.affectedAssets.slice(0, 2).map((asset) => (
                  <span key={asset} className="max-w-full break-all rounded border border-border px-2 py-1 text-muted-foreground">{asset}</span>
                ))}
                {finding.affectedAssets.length > 2 && (
                  <span className="rounded border border-border px-2 py-1 text-muted-foreground">+{finding.affectedAssets.length - 2}</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => onUpdateFinding(finding.id, { status: "validated" })} disabled={finding.status === "validated"}>
                  <Check size={13} />
                  Validar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onUpdateFinding(finding.id, { status: "discarded" })} disabled={finding.status === "discarded"}>
                  <X size={13} />
                  Descartar
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

function LifecycleTab({
  record,
  onConsultLifecycleEox,
  onConsultSupportCoverage,
  onResetLifecycleEox
}: {
  record: AssessmentRecord;
  onConsultLifecycleEox: (recordId: string) => Promise<AssessmentRecord>;
  onConsultSupportCoverage: (recordId: string) => Promise<AssessmentRecord>;
  onResetLifecycleEox: (recordId: string) => void;
}) {
  const [view, setView] = useState<"hardware" | "software" | "support">("hardware");
  const [eoxFilter, setEoxFilter] = useState<"all" | "with-eox" | "not-found" | "not-consulted">("all");
  const [detailRow, setDetailRow] = useState<LifecycleHardwareRow | LifecycleSoftwareRow | null>(null);
  const [isCheckingEox, setIsCheckingEox] = useState(false);
  const [isCheckingSupport, setIsCheckingSupport] = useState(false);
  const productIds = useMemo(() => lifecycleProductIds(record), [record]);
  const hardwareRows = useMemo(
    () => buildLifecycleHardwareRows(record, record.lifecycleEoxRecords, record.lifecycleConsultedProductIds, record.lifecycleEoxLookupResults),
    [record]
  );
  const softwareRows = useMemo(
    () => buildLifecycleSoftwareRows(record, record.lifecycleEoxRecords, record.lifecycleConsultedProductIds, record.lifecycleEoxLookupResults),
    [record]
  );
  const supportRows = useMemo(
    () => buildSupportCoverageRows(record, record.supportCoverageRecords, record.supportCoverageConsultedSerials),
    [record]
  );
  const filteredHardwareRows = useMemo(() => filterLifecycleEoxRows(hardwareRows, eoxFilter), [hardwareRows, eoxFilter]);
  const filteredSoftwareRows = useMemo(() => filterLifecycleEoxRows(softwareRows, eoxFilter), [softwareRows, eoxFilter]);
  const supportSerials = useMemo(() => supportCoverageSerials(record), [record]);
  const hasOnlyDeviceLevelInventory = hardwareRows.some((row) => row.source === "show version");
  const hasLifecycleResults =
    Object.keys(record.lifecycleEoxRecords).length > 0 ||
    record.lifecycleConsultedProductIds.length > 0 ||
    Object.keys(record.lifecycleEoxLookupResults ?? {}).length > 0 ||
    Boolean(record.lifecycleEoxMessage) ||
    Object.keys(record.supportCoverageRecords).length > 0 ||
    record.supportCoverageConsultedSerials.length > 0 ||
    Boolean(record.supportCoverageMessage);

  async function consultCiscoEox() {
    setIsCheckingEox(true);
    try {
      await onConsultLifecycleEox(record.id);
    } finally {
      setIsCheckingEox(false);
    }
  }

  async function consultCiscoSupport() {
    setIsCheckingSupport(true);
    try {
      await onConsultSupportCoverage(record.id);
    } finally {
      setIsCheckingSupport(false);
    }
  }

  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Vigencia tecnologica</h2>
            <p className="text-xs text-muted-foreground">Consulta oficial Cisco EoX por PID. No se completan fechas sin respuesta confirmada.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "support" ? (
            <Button variant="secondary" onClick={consultCiscoSupport} disabled={isCheckingSupport || supportSerials.length === 0}>
              <Search size={16} />
              {isCheckingSupport ? "Consultando..." : "Consultar soporte"}
            </Button>
          ) : (
            <Button variant="secondary" onClick={consultCiscoEox} disabled={isCheckingEox || productIds.length === 0}>
              <Search size={16} />
              {isCheckingEox ? "Consultando..." : "Consultar Cisco EoX"}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onResetLifecycleEox(record.id)} disabled={isCheckingEox || isCheckingSupport || !hasLifecycleResults}>
            <RotateCcw size={16} />
            Limpiar tabla
          </Button>
          <div className="flex rounded-md border border-border bg-white p-1">
            <button className={cn("h-8 rounded px-3 text-sm", view === "hardware" ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => setView("hardware")}>HW</button>
            <button className={cn("h-8 rounded px-3 text-sm", view === "software" ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => setView("software")}>SW</button>
            <button className={cn("h-8 rounded px-3 text-sm", view === "support" ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => setView("support")}>Soporte / Contratos</button>
          </div>
        </div>
      </PanelHeader>
      <PanelBody>
        {view !== "support" && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Filtro EoX</span>
            {[
              { id: "all", label: "Todos" },
              { id: "with-eox", label: "Solo con EoX" },
              { id: "not-found", label: "Sin resultado" },
              { id: "not-consulted", label: "No consultados" }
            ].map((filter) => (
              <button
                key={filter.id}
                className={cn("h-8 rounded-md border border-border px-3 text-xs font-semibold", eoxFilter === filter.id ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted")}
                onClick={() => setEoxFilter(filter.id as typeof eoxFilter)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
        {record.lifecycleEoxMessage && (
          <div className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{record.lifecycleEoxMessage}</div>
        )}
        {view === "support" && record.supportCoverageMessage && (
          <div className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{record.supportCoverageMessage}</div>
        )}
        {view === "hardware" && hasOnlyDeviceLevelInventory && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Para chasis modulares y componentes internos se requiere cargar salidas de show inventory; con show version solo se consulta el PID/modelo del equipo.
          </div>
        )}
        {view === "hardware" ? (
          <LifecycleHardwareTable rows={filteredHardwareRows} onShowDetail={setDetailRow} />
        ) : view === "software" ? (
          <LifecycleSoftwareTable rows={filteredSoftwareRows} onShowDetail={setDetailRow} />
        ) : (
          <SupportCoverageTable rows={supportRows} />
        )}
        {detailRow && <LifecycleEoxDetailDialog row={detailRow} onClose={() => setDetailRow(null)} />}
      </PanelBody>
    </Panel>
  );
}

function LifecycleHardwareTable({ rows, onShowDetail }: { rows: LifecycleHardwareRow[]; onShowDetail: (row: LifecycleHardwareRow) => void }) {
  if (rows.length === 0) return <EmptyState icon={<Server size={24} />} title="Sin inventario hardware para evaluar" />;

  return (
    <ScrollX className="rounded-md border border-border">
      <table className="w-full min-w-[1500px] text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-10 w-72 min-w-72 bg-[hsl(var(--muted))] px-3 py-2 font-semibold">Equipo</th>
            <th className="px-3 py-2 font-semibold">Componente</th>
            <th className="px-3 py-2 font-semibold">PID</th>
            <th className="px-3 py-2 font-semibold">Serial</th>
            <th className="w-52 px-3 py-2 font-semibold">Estado</th>
            <th className="px-3 py-2 font-semibold">End-of-Life Announcement Date</th>
            <th className="px-3 py-2 font-semibold">End-of-Sale Date</th>
            <th className="px-3 py-2 font-semibold">End of Vulnerability/Security Support</th>
            <th className="px-3 py-2 font-semibold">End of New Service Attachment Date</th>
            <th className="px-3 py-2 font-semibold">Last Date of Support</th>
            <th className="px-3 py-2 font-semibold">Boletin</th>
            <th className="px-3 py-2 font-semibold">Detalle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="sticky left-0 z-10 w-72 min-w-72 bg-[hsl(var(--surface))] px-3 py-3 align-top">
                <p className="break-words font-semibold leading-snug">{row.hostname}</p>
                <p className="mt-1 break-words text-xs leading-snug text-muted-foreground">{row.source}</p>
              </td>
              <td className="px-3 py-3 align-top">
                <p className="font-medium">{row.component}</p>
                <p className="text-xs text-muted-foreground">{row.itemType}</p>
              </td>
              <td className="px-3 py-3 align-top font-mono text-xs">{row.productId}</td>
              <td className="px-3 py-3 align-top font-mono text-xs">{row.serial}</td>
              <td className="w-52 px-3 py-3 align-top"><LifecycleStatusBadge row={row} /></td>
              <td className="px-3 py-3 align-top">{dateOrPending(row.eox?.announcementDate, row.consulted)}</td>
              <td className="px-3 py-3 align-top">{dateOrPending(row.eox?.endOfSaleDate, row.consulted)}</td>
              <td className="px-3 py-3 align-top">{dateOrPending(row.eox?.endOfSecurityVulSupportDate, row.consulted)}</td>
              <td className="px-3 py-3 align-top">{dateOrPending(row.eox?.endOfSvcAttachDate, row.consulted)}</td>
              <td className="px-3 py-3 align-top">{dateOrPending(row.eox?.lastDateOfSupport, row.consulted)}</td>
              <td className="px-3 py-3 align-top">
                {row.eox?.bulletinUrl ? (
                  <div className="space-y-1">
                    <a className="text-primary underline-offset-2 hover:underline" href={row.eox.bulletinUrl} target="_blank" rel="noreferrer">
                      {row.eox.bulletinNumber || "Abrir"}
                    </a>
                    {row.eox.source && <p className="text-xs text-muted-foreground">{row.eox.source === "public-cisco" ? "Cisco publico" : "Support API"}</p>}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Pendiente</span>
                )}
              </td>
              <td className="px-3 py-3 align-top">
                <Button size="sm" variant="secondary" onClick={() => onShowDetail(row)}>
                  <Search size={13} />
                  Ver
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

function LifecycleSoftwareTable({ rows, onShowDetail }: { rows: LifecycleSoftwareRow[]; onShowDetail: (row: LifecycleSoftwareRow) => void }) {
  if (rows.length === 0) return <EmptyState icon={<Server size={24} />} title="Sin inventario software para evaluar" />;

  return (
    <ScrollX className="rounded-md border border-border">
      <table className="w-full min-w-[1280px] text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-10 w-72 min-w-72 bg-[hsl(var(--muted))] px-3 py-2 font-semibold">Equipo</th>
            <th className="px-3 py-2 font-semibold">Modelo / PID</th>
            <th className="px-3 py-2 font-semibold">Version</th>
            <th className="w-56 px-3 py-2 font-semibold">Estado</th>
            <th className="px-3 py-2 font-semibold">Referencia Cisco</th>
            <th className="px-3 py-2 font-semibold">Accion</th>
            <th className="px-3 py-2 font-semibold">Detalle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="sticky left-0 z-10 w-72 min-w-72 bg-[hsl(var(--surface))] px-3 py-3 align-top">
                <p className="break-words font-semibold leading-snug">{row.hostname}</p>
                <p className="mt-1 break-words text-xs leading-snug text-muted-foreground">{row.source}</p>
              </td>
              <td className="px-3 py-3 align-top">
                <p className="font-medium">{row.model}</p>
                <p className="font-mono text-xs text-muted-foreground">{row.productId}</p>
              </td>
              <td className="px-3 py-3 align-top font-mono text-xs">{row.softwareVersion}</td>
              <td className="w-56 px-3 py-3 align-top"><LifecycleSoftwareStatusBadge row={row} /></td>
              <td className="px-3 py-3 align-top">
                {row.eox?.bulletinUrl ? (
                  <div className="space-y-1">
                    <a className="text-primary underline-offset-2 hover:underline" href={row.eox.bulletinUrl} target="_blank" rel="noreferrer">
                      {row.eox.bulletinNumber || "Abrir boletin"}
                    </a>
                    {row.eox.source && <p className="text-xs text-muted-foreground">{row.eox.source === "public-cisco" ? "Cisco publico" : "Support API"}</p>}
                  </div>
                ) : (
                  <span className="text-muted-foreground">{row.consulted ? "Sin boletin asociado al PID" : "Pendiente"}</span>
                )}
              </td>
              <td className="px-3 py-3 align-top">{softwareLifecycleAction(row)}</td>
              <td className="px-3 py-3 align-top">
                <Button size="sm" variant="secondary" onClick={() => onShowDetail(row)}>
                  <Search size={13} />
                  Ver
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

function filterLifecycleEoxRows<T extends LifecycleHardwareRow | LifecycleSoftwareRow>(rows: T[], filter: "all" | "with-eox" | "not-found" | "not-consulted") {
  if (filter === "with-eox") return rows.filter((row) => Boolean(row.eox));
  if (filter === "not-found") return rows.filter((row) => row.consulted && !row.eox);
  if (filter === "not-consulted") return rows.filter((row) => !row.consulted);
  return rows;
}

function LifecycleEoxDetailDialog({ row, onClose }: { row: LifecycleHardwareRow | LifecycleSoftwareRow; onClose: () => void }) {
  const lookup = row.lookup;
  const sourceLabel = row.eox?.source === "support-api" || lookup?.source === "support-api" ? "Cisco Support EoX API" : row.eox?.source === "public-cisco" || lookup?.source === "public-cisco" ? "Cisco publico" : "No consultado";
  const statusLabel = row.eox ? "Registro EoX encontrado" : row.consulted ? "Consultado sin resultado" : "Pendiente de consulta";
  const dates = [
    ["Anuncio", row.eox?.announcementDate],
    ["End-of-Sale", row.eox?.endOfSaleDate],
    ["Vulnerability/Security", row.eox?.endOfSecurityVulSupportDate],
    ["New Service Attachment", row.eox?.endOfSvcAttachDate],
    ["Last Date of Support", row.eox?.lastDateOfSupport]
  ];
  const attempts = lookup?.attempts ?? [
    `PID normalizado: ${normalizeProductId(row.productId)}`,
    row.consulted ? "PID incluido en la ultima consulta, pero no se guardo detalle de lookup." : "Este PID no ha sido consultado."
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[86vh] w-full max-w-2xl overflow-hidden rounded-md border border-border bg-[hsl(var(--surface))] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Detalle de consulta EoX</p>
            <h3 className="mt-1 break-words text-base font-semibold">{row.hostname} · {row.productId}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{statusLabel} · {sourceLabel}</p>
          </div>
          <Button size="icon" variant="ghost" title="Cerrar detalle" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
        <div className="max-h-[calc(86vh-84px)] space-y-4 overflow-auto p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <MetricDetail label="PID consultado" value={lookup?.productId ?? row.productId} />
            <MetricDetail label="PID normalizado" value={lookup?.normalizedProductId ?? normalizeProductId(row.productId)} />
            <MetricDetail label="Match Cisco" value={lookup?.matchedProductId || row.eox?.productId || "Sin match"} />
            <MetricDetail label="Boletin" value={row.eox?.bulletinNumber || lookup?.bulletinNumber || "Sin boletin"} />
          </div>
          <div className="rounded-md border border-border bg-[hsl(var(--surface-raised))] p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Fechas EoX</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {dates.map(([label, value]) => (
                <div key={label} className="rounded border border-border px-2 py-1">
                  <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
                  <p className="mt-0.5 font-semibold">{value || "Sin dato Cisco"}</p>
                </div>
              ))}
            </div>
          </div>
          {row.eox?.bulletinUrl || lookup?.bulletinUrl ? (
            <a className="inline-flex text-primary underline-offset-2 hover:underline" href={row.eox?.bulletinUrl || lookup?.bulletinUrl} target="_blank" rel="noreferrer">
              Abrir boletin Cisco
            </a>
          ) : null}
          <div className="rounded-md border border-border bg-[hsl(var(--surface-raised))] p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Log de analisis</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {attempts.map((attempt, index) => (
                <li key={`${attempt}-${index}`} className="break-words">- {attempt}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function SupportCoverageTable({ rows }: { rows: SupportCoverageRow[] }) {
  if (rows.length === 0) return <EmptyState icon={<Server size={24} />} title="Sin seriales para consultar soporte" />;

  return (
    <ScrollX className="rounded-md border border-border">
      <table className="w-full min-w-[1440px] text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-10 w-72 min-w-72 bg-[hsl(var(--muted))] px-3 py-2 font-semibold">Equipo</th>
            <th className="px-3 py-2 font-semibold">Componente</th>
            <th className="px-3 py-2 font-semibold">Serial</th>
            <th className="px-3 py-2 font-semibold">PID</th>
            <th className="w-56 px-3 py-2 font-semibold">Estado soporte</th>
            <th className="px-3 py-2 font-semibold">Contrato</th>
            <th className="px-3 py-2 font-semibold">SLA / Servicio</th>
            <th className="px-3 py-2 font-semibold">Fin cobertura</th>
            <th className="px-3 py-2 font-semibold">Garantia</th>
            <th className="px-3 py-2 font-semibold">Cliente contrato</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {rows.map((row) => (
            <tr key={`support-${row.id}`}>
              <td className="sticky left-0 z-10 w-72 min-w-72 bg-[hsl(var(--surface))] px-3 py-3 align-top">
                <p className="break-words font-semibold leading-snug">{row.hostname}</p>
                <p className="mt-1 break-words text-xs leading-snug text-muted-foreground">{row.source}</p>
              </td>
              <td className="px-3 py-3 align-top">
                <p className="font-medium">{row.component}</p>
                <p className="text-xs text-muted-foreground">{row.itemType}</p>
              </td>
              <td className="px-3 py-3 align-top font-mono text-xs">{row.serial || "No identificado"}</td>
              <td className="px-3 py-3 align-top font-mono text-xs">{row.coverage?.orderablePid || row.productId || "Pendiente"}</td>
              <td className="w-56 px-3 py-3 align-top"><SupportCoverageStatusBadge row={row} /></td>
              <td className="px-3 py-3 align-top">{row.coverage?.serviceContractNumber || supportPending(row)}</td>
              <td className="px-3 py-3 align-top">{row.coverage?.serviceLineDescription || supportPending(row)}</td>
              <td className="px-3 py-3 align-top">{row.coverage?.coverageEndDate || supportPending(row)}</td>
              <td className="px-3 py-3 align-top">
                <p>{row.coverage?.warrantyEndDate || supportPending(row)}</p>
                {row.coverage?.warrantyType && <p className="text-xs text-muted-foreground">{row.coverage.warrantyType}</p>}
              </td>
              <td className="px-3 py-3 align-top">{row.coverage?.contractSiteCustomerName || supportPending(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}

function LifecycleStatusBadge({ row }: { row: LifecycleHardwareRow }) {
  let tone: "neutral" | "info" | "success" | "warning" | "danger" = "neutral";
  let title = "No consultado";
  let description = "Pendiente de consulta EoX";
  let Icon = Search;

  if (!isConsultableCiscoProductId(row.productId)) {
    tone = "warning";
    title = "Sin PID";
    description = "No hay identificador consultable";
    Icon = AlertTriangle;
  } else if (row.consulted && !row.eox) {
    tone = "info";
    title = "Sin anuncio";
    description = "No hay EoX publico confirmado";
    Icon = Check;
  }

  const status = lifecycleRecordStatus(row.eox);
  if (status === "end_of_support") {
    tone = "danger";
    title = "Sin soporte";
    description = "Last Date of Support vencida";
    Icon = AlertTriangle;
  } else if (status === "end_of_sale") {
    tone = "warning";
    title = "End-of-sale";
    description = "Venta finalizada, soporte vigente";
    Icon = AlertTriangle;
  } else if (status === "active") {
    tone = "success";
    title = "Con EoX";
    description = "Boletin Cisco identificado";
    Icon = Check;
  }

  const styles = {
    neutral: "border-border bg-muted/40 text-muted-foreground",
    info: "border-sky-200 bg-sky-50 text-sky-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-800"
  } satisfies Record<"neutral" | "info" | "success" | "warning" | "danger", string>;

  return (
    <div className={cn("inline-flex min-w-44 max-w-48 items-start gap-2 rounded-md border px-2.5 py-2", styles[tone])}>
      <Icon size={15} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug opacity-80">{description}</p>
      </div>
    </div>
  );
}

function LifecycleSoftwareStatusBadge({ row }: { row: LifecycleSoftwareRow }) {
  let tone: "neutral" | "info" | "success" | "warning" | "danger" = "neutral";
  let title = "No consultado";
  let description = "Pendiente de consulta lifecycle";
  let Icon = Search;

  if (!row.softwareVersion || row.softwareVersion === "No identificado") {
    tone = "warning";
    title = "Sin version";
    description = "No se pudo extraer version";
    Icon = AlertTriangle;
  } else if (!isConsultableLifecycleKey(row.softwareVersion) && !isConsultableCiscoProductId(row.productId)) {
    tone = "warning";
    title = "Sin clave";
    description = "No hay version/PID consultable";
    Icon = AlertTriangle;
  }

  const status = lifecycleRecordStatus(row.eox);
  if (status === "end_of_support") {
    tone = "danger";
    title = "Sin soporte";
    description = "Release fuera de soporte";
    Icon = AlertTriangle;
  } else if (status === "end_of_sale") {
    tone = "warning";
    title = "End-of-sale";
    description = "Release con venta finalizada";
    Icon = AlertTriangle;
  } else if (status === "active") {
    tone = "success";
    title = "Con EoX";
    description = "Boletin lifecycle identificado";
    Icon = Check;
  } else if (row.consulted) {
    tone = "info";
    title = "Sin anuncio";
    description = "No hay EoX publico confirmado";
    Icon = Check;
  }

  const styles = {
    neutral: "border-border bg-muted/40 text-muted-foreground",
    info: "border-sky-200 bg-sky-50 text-sky-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-800"
  } satisfies Record<"neutral" | "info" | "success" | "warning" | "danger", string>;

  return (
    <div className={cn("inline-flex min-w-44 max-w-52 items-start gap-2 rounded-md border px-2.5 py-2", styles[tone])}>
      <Icon size={15} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug opacity-80">{description}</p>
      </div>
    </div>
  );
}

function SupportCoverageStatusBadge({ row }: { row: SupportCoverageRow }) {
  let tone: "neutral" | "info" | "success" | "warning" | "danger" = "neutral";
  let title = "No consultado";
  let description = "Pendiente de consulta SN2INFO";
  let Icon = Search;

  if (!row.serial || row.serial === "No identificado") {
    tone = "warning";
    title = "Sin serial";
    description = "No hay serial consultable";
    Icon = AlertTriangle;
  } else if (row.coverage?.isCovered === "YES") {
    tone = "success";
    title = "Cubierto";
    description = row.coverage.serviceLineDescription || "Contrato activo";
    Icon = Check;
  } else if (row.coverage?.isCovered === "NO") {
    tone = "danger";
    title = "Sin cobertura";
    description = "Cisco reporta sin contrato";
    Icon = AlertTriangle;
  } else if (row.consulted) {
    tone = "info";
    title = "Sin registro";
    description = "Serial consultado sin detalle";
    Icon = AlertTriangle;
  }

  const styles = {
    neutral: "border-border bg-muted/40 text-muted-foreground",
    info: "border-sky-200 bg-sky-50 text-sky-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-800"
  } satisfies Record<"neutral" | "info" | "success" | "warning" | "danger", string>;

  return (
    <div className={cn("inline-flex min-w-44 max-w-52 items-start gap-2 rounded-md border px-2.5 py-2", styles[tone])}>
      <Icon size={15} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug opacity-80">{description}</p>
      </div>
    </div>
  );
}

function supportPending(row: SupportCoverageRow) {
  return <span className="text-muted-foreground">{row.consulted ? "Sin dato Cisco" : "Pendiente"}</span>;
}

function OperationsTab({
  assessment,
  onUpdate
}: {
  assessment: OperationalAssessment;
  onUpdate: (updater: (assessment: OperationalAssessment) => OperationalAssessment) => void;
}) {
  const [activeDomain, setActiveDomain] = useState(Object.keys(operationalDomainLabels)[0] as keyof typeof operationalDomainLabels);
  const [newInterview, setNewInterview] = useState({
    interviewType: "network_operations" as OperationalInterviewType,
    participants: "",
    interviewer: "",
    durationMinutes: 60,
    notes: ""
  });
  const domainQuestions = operationalQuestionBank.filter((question) => question.domain === activeDomain);

  function addInterview() {
    const interview: OperationalInterview = {
      id: uid("opint"),
      assessmentId: assessment.assessmentId,
      interviewType: newInterview.interviewType,
      participants: newInterview.participants,
      date: new Date().toISOString().slice(0, 10),
      durationMinutes: Number(newInterview.durationMinutes) || 60,
      interviewer: newInterview.interviewer,
      notes: newInterview.notes
    };
    onUpdate((current) => ({
      ...current,
      status: "in_progress",
      interviews: [interview, ...current.interviews],
      updatedAt: new Date().toISOString()
    }));
    setNewInterview({ interviewType: "network_operations", participants: "", interviewer: "", durationMinutes: 60, notes: "" });
  }

  function updateAnswer(question: OperationalQuestion, patch: Partial<OperationalAnswer>) {
    onUpdate((current) => {
      const existing = current.answers.find((answer) => answer.questionId === question.id);
      const base: OperationalAnswer = existing ?? {
        id: uid("opans"),
        questionId: question.id,
        interviewId: current.interviews[0]?.id ?? "interview-pending",
        assessmentId: current.assessmentId,
        value: null,
        score: null,
        evidenceLevel: "none",
        evidenceFiles: [],
        comments: "",
        answeredBy: "",
        reviewedByArchitect: false
      };
      const nextAnswer = { ...base, ...patch };
      nextAnswer.score = scoreOperationalAnswer(question, nextAnswer);
      return {
        ...current,
        status: "in_progress",
        answers: existing
          ? current.answers.map((answer) => (answer.id === existing.id ? nextAnswer : answer))
          : [...current.answers, nextAnswer],
        updatedAt: new Date().toISOString()
      };
    });
  }

  function processAssessment() {
    onUpdate((current) => processOperationalAssessment(current));
  }

  function validateAssessment() {
    onUpdate((current) => ({
      ...current,
      status: "validated",
      executiveSummary: current.executiveSummary
        ? { ...current.executiveSummary, validationStatus: "validated", lastUpdated: new Date().toISOString() }
        : current.executiveSummary,
      updatedAt: new Date().toISOString()
    }));
  }

  function runAiReview() {
    const context = buildOperationalAIContext(assessment);
    onUpdate((current) => ({
      ...current,
      status: "ai_reviewed",
      aiSummary: `Contexto AI preparado con ${context.domainScores.length} dominios, ${context.preliminaryFindings.length} hallazgos preliminares y ${context.lowConfidenceAreas.length} areas de baja confianza.`,
      updatedAt: new Date().toISOString()
    }));
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Evaluacion Operativa</h2>
              <p className="text-xs text-muted-foreground">Entrevista deterministica, scoring operacional y resumen ejecutivo.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={assessment.status === "validated" ? "success" : assessment.status === "completed" ? "info" : "warning"}>{assessment.status}</Badge>
            <Button variant="secondary" onClick={processAssessment}>Procesar evaluacion</Button>
            <Button variant="secondary" onClick={runAiReview}>Ejecutar analisis AI</Button>
            <Button onClick={validateAssessment} disabled={assessment.status === "draft"}>Validar resultados</Button>
          </div>
        </PanelHeader>
      </Panel>

      <Panel>
        <PanelHeader>
          <h2 className="text-sm font-semibold">Entrevistas</h2>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Tipo">
              <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={newInterview.interviewType} onChange={(event) => setNewInterview({ ...newInterview, interviewType: event.target.value as OperationalInterviewType })}>
                {["it_management", "network_operations", "network_architecture", "security_operations", "datacenter_operations", "service_desk", "continuity_dr", "lifecycle_contracts"].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Participantes"><Input value={newInterview.participants} onChange={(event) => setNewInterview({ ...newInterview, participants: event.target.value })} /></Field>
            <Field label="Entrevistador"><Input value={newInterview.interviewer} onChange={(event) => setNewInterview({ ...newInterview, interviewer: event.target.value })} /></Field>
            <Field label="Duracion"><Input type="number" value={newInterview.durationMinutes} onChange={(event) => setNewInterview({ ...newInterview, durationMinutes: Number(event.target.value) })} /></Field>
            <div className="flex items-end"><Button className="w-full" onClick={addInterview}>Crear entrevista</Button></div>
          </div>
          {assessment.interviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin entrevistas registradas.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assessment.interviews.map((interview) => <Badge key={interview.id}>{interview.interviewType} · {interview.participants || "Sin participantes"}</Badge>)}
            </div>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <h2 className="text-sm font-semibold">Formulario deterministico</h2>
        </PanelHeader>
        <PanelBody className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-1">
            {Object.entries(operationalDomainLabels).map(([domain, label]) => (
              <button
                key={domain}
                className={cn("w-full rounded-md px-3 py-2 text-left text-sm", activeDomain === domain ? "bg-primary text-white" : "hover:bg-muted")}
                onClick={() => setActiveDomain(domain as keyof typeof operationalDomainLabels)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {domainQuestions.map((question) => {
              const answer = assessment.answers.find((item) => item.questionId === question.id);
              return (
                <OperationalQuestionCard key={question.id} question={question} answer={answer} onChange={(patch) => updateAnswer(question, patch)} />
              );
            })}
          </div>
        </PanelBody>
      </Panel>

      <OperationalResultsPanel assessment={assessment} />
    </div>
  );
}

function RoadmapPlaceholder({ roadmap }: { roadmap: ReturnType<typeof buildRoadmap> }) {
  return (
    <Panel>
      <PanelHeader>
        <h2 className="text-sm font-semibold">Roadmap de remediacion</h2>
      </PanelHeader>
      <PanelBody>
        <EmptyState icon={<GitBranch size={24} />} title={`Roadmap pendiente de arquitectura (${roadmap.length} necesidades detectadas sin priorizar)`} />
      </PanelBody>
    </Panel>
  );
}

function OperationalQuestionCard({
  question,
  answer,
  onChange
}: {
  question: OperationalQuestion;
  answer?: OperationalAnswer;
  onChange: (patch: Partial<OperationalAnswer>) => void;
}) {
  const score = answer?.score ?? null;

  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{question.id}</Badge>
            {question.critical && <Badge tone="warning">Critica</Badge>}
            <Badge tone={score === null ? "neutral" : score >= 3 ? "success" : "danger"}>Score {score ?? "pendiente"}</Badge>
          </div>
          <p className="mt-2 text-sm font-semibold">{question.question}</p>
          <p className="mt-1 text-xs text-muted-foreground">{question.helpText}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <OperationalAnswerControl question={question} value={answer?.value ?? null} onChange={(value) => onChange({ value })} />
        <Field label="Evidencia">
          <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={answer?.evidenceLevel ?? "none"} onChange={(event) => onChange({ evidenceLevel: event.target.value as OperationalEvidenceLevel })}>
            {["none", "self_declared", "documented", "tool_export", "validated"].map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Comentarios">
            <Textarea className="min-h-16" value={answer?.comments ?? ""} onChange={(event) => onChange({ comments: event.target.value })} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function OperationalAnswerControl({
  question,
  value,
  onChange
}: {
  question: OperationalQuestion;
  value: OperationalAnswer["value"];
  onChange: (value: OperationalAnswer["value"]) => void;
}) {
  if (question.responseType === "boolean") {
    return (
      <Field label="Respuesta">
        <div className="flex gap-2">
          <Button variant={value === true ? "primary" : "secondary"} onClick={() => onChange(true)}>Si</Button>
          <Button variant={value === false ? "primary" : "secondary"} onClick={() => onChange(false)}>No</Button>
        </div>
      </Field>
    );
  }
  if (question.responseType === "percentage") {
    return <Field label="Porcentaje"><Input type="number" min={0} max={100} value={typeof value === "number" ? value : ""} onChange={(event) => onChange(Number(event.target.value))} /></Field>;
  }
  if (question.responseType === "frequency" || question.responseType === "maturity_0_5" || question.responseType === "single_select") {
    return (
      <Field label="Respuesta">
        <select className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Pendiente</option>
          {(question.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </Field>
    );
  }
  return <Field label="Respuesta"><Input value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /></Field>;
}

function OperationalResultsPanel({ assessment }: { assessment: OperationalAssessment }) {
  if (assessment.domains.length === 0) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState icon={<Settings2 size={24} />} title="Procesa la evaluacion para generar resultados operativos" />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricPanel label="Madurez operacional" value={`${assessment.overallMaturityScore}/5`} />
        <MetricPanel label="Riesgo operativo" value={`${assessment.operationalRiskScore}/100`} />
        <MetricPanel label="Confianza operacional" value={`${assessment.confidenceScore}/100`} />
      </div>
      <Panel>
        <PanelHeader><h2 className="text-sm font-semibold">Resultados por dominio</h2></PanelHeader>
        <PanelBody className="space-y-3">
          {assessment.domains.map((domain) => (
            <div key={domain.domain} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{operationalDomainLabels[domain.domain]}</p>
                  <p className="text-xs text-muted-foreground">{domain.maturityLevel} · confianza {domain.confidence}%</p>
                </div>
                <Badge tone={domain.score >= 3 ? "success" : domain.score >= 2 ? "warning" : "danger"}>{domain.score}/5</Badge>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(domain.score / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </PanelBody>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader><h2 className="text-sm font-semibold">Fortalezas y brechas</h2></PanelHeader>
          <PanelBody className="space-y-3 text-sm">
            <div><p className="font-semibold">Fortalezas</p><ul className="mt-2 space-y-1 text-muted-foreground">{assessment.keyStrengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
            <div><p className="font-semibold">Brechas</p><ul className="mt-2 space-y-1 text-muted-foreground">{assessment.keyGaps.map((item) => <li key={item}>{item}</li>)}</ul></div>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader><h2 className="text-sm font-semibold">Hallazgos operativos preliminares</h2></PanelHeader>
          <PanelBody className="space-y-2">
            {assessment.findings.length === 0 ? <p className="text-sm text-muted-foreground">Sin hallazgos operativos preliminares.</p> : assessment.findings.map((finding) => (
              <div key={finding.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{finding.title}</p>
                  <Badge tone={finding.severity === "critical" || finding.severity === "high" ? "danger" : "warning"}>{finding.severity}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{finding.recommendation}</p>
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>
      {assessment.aiSummary && (
        <Panel>
          <PanelHeader><h2 className="text-sm font-semibold">Panel AI</h2></PanelHeader>
          <PanelBody><p className="text-sm text-muted-foreground">{assessment.aiSummary}</p></PanelBody>
        </Panel>
      )}
    </div>
  );
}

function ExecutiveSummaryTab({
  record,
  summary,
  documentTemplates
}: {
  record: AssessmentRecord;
  summary: ExecutiveRiskDashboard;
  documentTemplates: DocumentTemplateVersion[];
}) {
  const activeTemplate = documentTemplates.find((template) => template.documentType === "findings_report" && template.status === "active");

  async function downloadFinalReport() {
    await downloadFinalReportDocument(record, activeTemplate, `${safeFileName(record.assessment.name)}-reporte-final.docx`);
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <div>
              <h2 className="text-sm font-semibold">Reporte final</h2>
              <p className="text-xs text-muted-foreground">Genera el documento Word editable con resumen ejecutivo, hallazgos y recomendaciones.</p>
            </div>
          </div>
          <Button onClick={downloadFinalReport}>
            <FileDown size={16} />
            Descargar reporte final
          </Button>
        </PanelHeader>
        {!activeTemplate && (
          <PanelBody>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No hay plantilla vigente para Hallazgos y Resumen Ejecutivo. Activa una plantilla Word en Ajustes para descargar el reporte final.
            </div>
          </PanelBody>
        )}
      </Panel>

      {!summary.isSufficient && (
        <Panel>
          <PanelBody>
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
              <div>
                <p className="text-sm font-semibold">Resumen ejecutivo pendiente por evidencia insuficiente</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  El ICA esta en {summary.ica}/100 y el umbral configurado es {summary.threshold}/100. El IRIR no se publica como definitivo para evitar subestimar riesgo.
                </p>
              </div>
            </div>
          </PanelBody>
        </Panel>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <ExecutiveScoreCard
          title="IRIR"
          subtitle="Indice de Riesgo de Infraestructura de Red"
          score={summary.irir}
          level={summary.irirLevel}
          pending={!summary.isSufficient}
        />
        <ExecutiveScoreCard
          title="ICA"
          subtitle="Indice de Confianza del Assessment"
          score={summary.ica}
          level={summary.icaLevel}
          pending={false}
        />
      </div>

      <ExecutiveOperationsSummaryCard summary={summary} />
      <ExecutivePerformanceSummaryCard summary={summary} />

      <Panel>
        <PanelHeader>
          <h2 className="text-sm font-semibold">Dimensiones de riesgo</h2>
        </PanelHeader>
        <PanelBody className="space-y-3">
          {summary.dimensions.map((dimension) => (
            <div key={dimension.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{dimension.name}</p>
                  <p className="text-xs text-muted-foreground">{dimension.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={dimension.rawScore === null ? "warning" : executiveLevelTone(dimension.level)}>{dimension.level}</Badge>
                  <Badge>peso {dimension.weight}%</Badge>
                  <Badge>{dimension.findingCount} hallazgos</Badge>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${summary.isSufficient ? dimension.normalizedScore : 0}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{dimension.evidenceSummary}</p>
            </div>
          ))}
        </PanelBody>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <PanelHeader>
            <h2 className="text-sm font-semibold">Top hallazgos ejecutivos</h2>
          </PanelHeader>
          <PanelBody>
            {summary.topFindings.length === 0 ? (
              <EmptyState icon={<AlertTriangle size={24} />} title="Sin hallazgos validados para ranking ejecutivo" />
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[840px] text-left text-sm">
                  <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">ID</th>
                      <th className="px-3 py-2 font-semibold">Hallazgo</th>
                      <th className="px-3 py-2 font-semibold">Dominio</th>
                      <th className="px-3 py-2 font-semibold">Severidad</th>
                      <th className="px-3 py-2 font-semibold">Accion</th>
                      <th className="px-3 py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-white">
                    {summary.topFindings.map((finding, index) => (
                      <tr key={findingRenderKey(finding, index)}>
                        <td className="px-3 py-2 font-mono text-xs">{shortFindingId(finding)}</td>
                        <td className="px-3 py-2">{finding.title}</td>
                        <td className="px-3 py-2">{finding.category}</td>
                        <td className="px-3 py-2"><Badge tone={riskTone[finding.risk]}>{finding.risk}</Badge></td>
                        <td className="px-3 py-2">{remediationCategoryLabel[finding.remediationCategory]}</td>
                        <td className="px-3 py-2">{finding.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <h2 className="text-sm font-semibold">Acciones y advertencias</h2>
          </PanelHeader>
          <PanelBody className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(summary.actionCounts).map(([type, count]) => (
                <div key={type} className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{remediationCategoryLabel[type as RemediationCategory]}</p>
                  <p className="mt-1 text-xl font-semibold">{count}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Advertencias</p>
              <div className="space-y-2">
                {summary.warnings.map((warning) => (
                  <div key={warning} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{warning}</div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recomendaciones preliminares</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {summary.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
              </ul>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <p className="text-xs text-muted-foreground">
        Assessment: {record.client.name} · {record.assessment.name}. Los scores son determinísticos y no sustituyen la validación del arquitecto.
      </p>
    </div>
  );
}

function ExecutivePerformanceSummaryCard({ summary }: { summary: ExecutiveRiskDashboard }) {
  const performance = summary.performance;
  if (!performance?.enabled) return null;

  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Resumen de performance</h2>
          <p className="text-xs text-muted-foreground">Incluido desde Performance Analysis cuando forma parte del alcance.</p>
        </div>
      </PanelHeader>
      <PanelBody className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <MetricPanel label="Riesgo performance" value={`${performance.performanceRiskScore}/100`} />
          <MetricPanel label="Confianza" value={`${performance.confidenceScore}%`} />
          <MetricPanel label="Cobertura" value={`${performance.dataCoverageScore}%`} />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={performance.status === "validated" || performance.status === "ai_reviewed" || performance.status === "processed" ? "success" : "warning"}>{performance.status}</Badge>
            <Badge>{performance.analysisMode}</Badge>
            {performance.confidenceScore < 70 && <Badge tone="warning">Confianza baja</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{performance.summaryText}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <ExecutiveList title="Metricas criticas" items={performance.topMetrics.slice(0, 3)} />
            <ExecutiveList title="Brechas" items={performance.visibilityGaps.slice(0, 3)} />
            <ExecutiveList title="Acciones" items={performance.recommendedActions.slice(0, 3)} />
            <ExecutiveList title="Limitaciones" items={performance.limitations.slice(0, 3)} />
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function ExecutiveScoreCard({
  title,
  subtitle,
  score,
  level,
  pending
}: {
  title: string;
  subtitle: string;
  score: number | null;
  level: string;
  pending: boolean;
}) {
  return (
    <Panel>
      <PanelBody>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
            <h2 className="mt-1 text-sm font-semibold">{subtitle}</h2>
          </div>
          <Badge tone={pending ? "warning" : executiveLevelTone(level)}>{level}</Badge>
        </div>
        <p className="mt-4 text-4xl font-semibold">{pending || score === null ? "Pendiente" : score}</p>
        <div className="mt-3 h-2 rounded-full bg-muted">
          <div className={cn("h-2 rounded-full", pending ? "bg-amber-400" : "bg-primary")} style={{ width: `${pending || score === null ? 0 : score}%` }} />
        </div>
      </PanelBody>
    </Panel>
  );
}

function ExecutiveOperationsSummaryCard({ summary }: { summary: ExecutiveRiskDashboard }) {
  const operational = summary.operational;
  if (!operational) {
    return (
      <Panel>
        <PanelBody>
          <EmptyState icon={<Settings2 size={24} />} title="Resumen operativo pendiente de procesar en el tab Operaciones" />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <h2 className="text-sm font-semibold">Resumen operativo</h2>
          <p className="text-xs text-muted-foreground">Consumido desde el tab Operaciones; no se recalcula en este resumen.</p>
        </div>
      </PanelHeader>
      <PanelBody className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <MetricPanel label="Madurez" value={`${operational.maturityScore}/5`} />
          <MetricPanel label="Riesgo operativo" value={`${operational.operationalRiskScore}/100`} />
          <MetricPanel label="Confianza" value={`${operational.confidenceScore}/100`} />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={operational.validationStatus === "validated" ? "success" : "warning"}>{operational.validationStatus}</Badge>
            <Badge>{operational.maturityLevel}</Badge>
            {operational.confidenceScore < 70 && <Badge tone="warning">Confianza baja</Badge>}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ExecutiveList title="Top brechas" items={operational.keyGaps.slice(0, 3)} />
            <ExecutiveList title="Fortalezas" items={operational.keyStrengths.slice(0, 3)} />
            <ExecutiveList title="Riesgos" items={operational.topRisks.slice(0, 3)} />
            <ExecutiveList title="Acciones inmediatas" items={operational.recommendedActions.slice(0, 3)} />
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function ExecutiveList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Pendiente</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

function AssessmentFormPanel({
  form,
  onChange,
  onSave,
  onCancel
}: {
  form: AssessmentForm;
  onChange: (form: AssessmentForm) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <Panel>
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{form.recordId ? "Editar assessment" : "Nuevo assessment"}</h2>
          <p className="text-xs text-muted-foreground">Define cliente, owner, estado inicial y dominios de alcance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>
            <X size={16} />
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={!form.clientName.trim() || !form.assessmentName.trim()}>
            <Save size={16} />
            Guardar
          </Button>
        </div>
      </PanelHeader>
      <PanelBody className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Cliente">
          <Input value={form.clientName} onChange={(event) => onChange({ ...form, clientName: event.target.value })} placeholder="Nombre del cliente" />
        </Field>
        <Field label="Assessment">
          <Input value={form.assessmentName} onChange={(event) => onChange({ ...form, assessmentName: event.target.value })} placeholder="Nombre del assessment" />
        </Field>
        <Field label="Industria">
          <Input value={form.industry} onChange={(event) => onChange({ ...form, industry: event.target.value })} placeholder="Sector" />
        </Field>
        <Field label="Owner">
          <Input value={form.owner} onChange={(event) => onChange({ ...form, owner: event.target.value })} placeholder="Arquitecto responsable" />
        </Field>
        <Field label="Estado">
          <select
            className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            value={form.status}
            onChange={(event) => onChange({ ...form, status: event.target.value as Assessment["status"] })}
          >
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <div className="space-y-1 md:col-span-2 lg:col-span-3">
          <span className="text-xs font-medium text-muted-foreground">Dominios</span>
          <div className="flex flex-wrap gap-2">
            {domains.map((domain) => {
              const checked = form.domains.includes(domain.id);
              return (
                <label key={domain.id} className="flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={checked}
                    onChange={() => {
                      const nextDomains = checked ? form.domains.filter((item) => item !== domain.id) : [...form.domains, domain.id];
                      onChange({ ...form, domains: nextDomains.length > 0 ? nextDomains : [domain.id] });
                    }}
                  />
                  {domain.label}
                </label>
              );
            })}
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}

function MetricPanel({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Panel>
      <PanelBody>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </PanelBody>
    </Panel>
  );
}

function CredentialCheckMessage({ status }: { status: CredentialCheckStatus }) {
  if (status.state === "idle" || !status.message) return null;

  const styles = {
    checking: "border-sky-200 bg-sky-50 text-sky-800",
    saving: "border-sky-200 bg-sky-50 text-sky-800",
    valid: "border-emerald-200 bg-emerald-50 text-emerald-800",
    invalid: "border-rose-200 bg-rose-50 text-rose-800"
  } satisfies Record<Exclude<CredentialCheckStatus["state"], "idle">, string>;
  const Icon = status.state === "valid" ? Check : status.state === "invalid" ? AlertTriangle : Search;

  return (
    <div className={cn("flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs", styles[status.state])}>
      <Icon size={13} className="mt-0.5 shrink-0" />
      <span>{status.message}</span>
    </div>
  );
}

function SettingsDocumentTemplatesSection({
  templates,
  canManage,
  onTemplatesChange
}: {
  templates: DocumentTemplateVersion[];
  canManage: boolean;
  onTemplatesChange: React.Dispatch<React.SetStateAction<DocumentTemplateVersion[]>>;
}) {
  const documentTypes: DocumentType[] = ["sow", "findings_report"];

  async function downloadBase(documentType: DocumentType) {
    const blob = await generateBaseTemplate(documentType);
    downloadBlob(`${documentType}-plantilla-base-${documentTemplateDefinitions[documentType].version}.docx`, blob);
  }

  async function uploadTemplate(documentType: DocumentType, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      window.alert("Solo se permiten archivos .docx.");
      return;
    }

    try {
      const validationResult = await validateUploadedTemplate(file, documentType);
      const nextTemplate: DocumentTemplateVersion = {
        id: uid("template"),
        documentType,
        templateName: `${documentTypeLabels[documentType]} corporativa`,
        templateVersion: nextTemplateVersion(templates, documentType),
        templateFileName: file.name,
        templateFileDataUrl: await fileToDataUrl(file),
        uploadedBy: "Local user",
        uploadedAt: new Date().toISOString(),
        status: validationResult.canActivate ? "valid" : "validation_failed",
        validationResult,
        missingRequiredPlaceholders: validationResult.missingRequiredPlaceholders,
        extraPlaceholders: validationResult.unknownPlaceholders,
        compatibleDefinitionVersion: validationResult.definitionVersion,
        notes: validationResult.canActivate ? "Plantilla validada contra la definicion vigente." : "Faltan placeholders requeridos.",
        auditTrail: [
          templateAuditEvent("uploaded", "Local user", "Plantilla cargada desde Ajustes.", validationResult.definitionVersion),
          templateAuditEvent("validated", "Local user", "Validacion inicial ejecutada al cargar la plantilla.", validationResult.definitionVersion)
        ]
      };
      onTemplatesChange((current) => {
        const nextTemplates = [nextTemplate, ...current];
        const hasActiveTemplate = current.some((template) => template.documentType === documentType && template.status === "active");
        return validationResult.canActivate && !hasActiveTemplate
          ? activateTemplateVersion(nextTemplates, nextTemplate.id, "Local user")
          : nextTemplates;
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo validar la plantilla cargada.");
    }
  }

  async function revalidateTemplate(template: DocumentTemplateVersion) {
    try {
      const validationResult = await validateUploadedTemplate(dataUrlToBlob(template.templateFileDataUrl), template.documentType);
      onTemplatesChange((current) =>
        current.map((item) =>
              item.id === template.id
            ? {
                ...item,
                status: item.status === "active" && validationResult.canActivate ? "active" : validationResult.canActivate ? "valid" : "validation_failed",
                validationResult,
                missingRequiredPlaceholders: validationResult.missingRequiredPlaceholders,
                extraPlaceholders: validationResult.unknownPlaceholders,
                compatibleDefinitionVersion: validationResult.definitionVersion,
                notes: validationResult.canActivate ? "Plantilla revalidada contra la definicion vigente." : "Faltan placeholders requeridos.",
                auditTrail: [
                  ...(item.auditTrail ?? []),
                  templateAuditEvent("validated", "Local user", "Revalidacion manual ejecutada en Ajustes.", validationResult.definitionVersion)
                ]
              }
            : item
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo revalidar la plantilla.");
    }
  }

  async function activateTemplate(template: DocumentTemplateVersion) {
    try {
      const validationResult = await validateUploadedTemplate(dataUrlToBlob(template.templateFileDataUrl), template.documentType);
      if (!validationResult.canActivate) {
        onTemplatesChange((current) =>
          current.map((item) =>
            item.id === template.id
              ? {
                  ...item,
                  status: "validation_failed",
                  validationResult,
                  missingRequiredPlaceholders: validationResult.missingRequiredPlaceholders,
                  extraPlaceholders: validationResult.unknownPlaceholders,
                  compatibleDefinitionVersion: validationResult.definitionVersion,
                  notes: "Activacion bloqueada porque faltan placeholders requeridos.",
                  auditTrail: [
                    ...(item.auditTrail ?? []),
                    templateAuditEvent("validated", "Local user", "Validacion de activacion fallida.", validationResult.definitionVersion)
                  ]
                }
              : item
          )
        );
        window.alert("No se puede activar: faltan placeholders requeridos.");
        return;
      }

      const refreshedTemplate = {
        ...template,
        status: "valid" as const,
        validationResult,
        missingRequiredPlaceholders: validationResult.missingRequiredPlaceholders,
        extraPlaceholders: validationResult.unknownPlaceholders,
        compatibleDefinitionVersion: validationResult.definitionVersion,
        notes: "Plantilla revalidada antes de activacion.",
        auditTrail: [
          ...(template.auditTrail ?? []),
          templateAuditEvent("validated", "Local user", "Validacion previa a activacion ejecutada.", validationResult.definitionVersion)
        ]
      };

      onTemplatesChange((current) =>
        activateTemplateVersion(
          current.map((item) => (item.id === template.id ? refreshedTemplate : item)),
          template.id,
          "Local user"
        )
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo activar la plantilla.");
    }
  }

  function downloadReport(documentType: DocumentType, template?: DocumentTemplateVersion) {
    downloadTextFile(
      `${documentType}-reporte-placeholders.txt`,
      generatePlaceholderReport(documentType, template?.validationResult)
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Plantillas de Documentos</p>
          <h2 className="text-sm font-semibold">Word templates</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Descarga una base DOCX, formateala en Word conservando los placeholders, subela y activala como plantilla vigente.
          </p>
        </div>
        <Badge tone="info">{templates.filter((template) => template.status === "active").length} activas</Badge>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        {documentTypes.map((documentType) => {
          const definitionItem = documentTemplateDefinitions[documentType];
          const versions = templates.filter((template) => template.documentType === documentType);
          const activeTemplate = versions.find((template) => template.status === "active");
          const latestTemplate = versions[0];
          const compatibility = activeTemplate ? compareTemplateWithCurrentDefinition(activeTemplate) : null;

          return (
            <div key={documentType} className="rounded-md border border-border bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Definicion {definitionItem.version}</p>
                  <h3 className="text-sm font-semibold">{documentTypeLabels[documentType]}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {definitionItem.requiredBlocks.length} bloques requeridos · {definitionItem.placeholders.length} placeholders
                  </p>
                </div>
                <Badge tone={activeTemplate ? "success" : "warning"}>{activeTemplate ? "Vigente" : "Pendiente"}</Badge>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" onClick={() => downloadBase(documentType)}>
                  <FileDown size={15} />
                  Descargar base
                </Button>
                <Button variant="ghost" onClick={() => downloadReport(documentType, latestTemplate)}>
                  <FileText size={15} />
                  Reporte
                </Button>
              </div>

              <div className="mt-3 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Subir nueva plantilla DOCX</span>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
                  <input
                    id={`${documentType}-template-upload`}
                    className="sr-only"
                    type="file"
                    accept=".docx"
                    disabled={!canManage}
                    onChange={(event) => uploadTemplate(documentType, event)}
                  />
                  <label
                    htmlFor={`${documentType}-template-upload`}
                    className={cn(
                      "inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground transition hover:bg-muted/70",
                      canManage ? "cursor-pointer" : "pointer-events-none opacity-50"
                    )}
                  >
                    <Upload size={13} />
                    Subir DOCX
                  </label>
                  <span className="text-xs text-muted-foreground">La app validara placeholders antes de permitir activar.</span>
                </div>
              </div>

              <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">Plantilla vigente</p>
                {activeTemplate ? (
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{activeTemplate.templateFileName}</span>
                      <Badge tone={templateStatusTone(activeTemplate.status)}>{templateStatusLabel(activeTemplate.status)}</Badge>
                      <Badge tone={compatibilityTone(compatibility?.compatibilityStatus ?? "compatible")}>
                        {compatibilityStatusLabel(compatibility?.compatibilityStatus ?? "compatible")}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      Version {activeTemplate.templateVersion} · subida {formatDate(activeTemplate.uploadedAt)} · {activeTemplate.uploadedBy}
                    </p>
                    {activeTemplate.activatedAt && (
                      <p className="text-muted-foreground">
                        Activada {formatDate(activeTemplate.activatedAt)} por {activeTemplate.activatedBy || "Local user"}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No hay plantilla activa. Descarga la base, formateala, subela y activala.</p>
                )}
              </div>

              <TemplateValidationPanel template={latestTemplate} />

              <div className="mt-3 overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Version</th>
                      <th className="px-3 py-2 font-semibold">Archivo</th>
                      <th className="px-3 py-2 font-semibold">Estado</th>
                      <th className="px-3 py-2 font-semibold">Validacion</th>
                      <th className="px-3 py-2 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {versions.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                          Sin versiones cargadas.
                        </td>
                      </tr>
                    ) : (
                      versions.map((template) => (
                        <tr key={template.id}>
                          <td className="px-3 py-2 font-medium">{template.templateVersion}</td>
                          <td className="px-3 py-2">
                            <span className="block font-medium">{template.templateFileName}</span>
                            <span className="text-muted-foreground">{formatDate(template.uploadedAt)}</span>
                            {template.auditTrail?.length ? (
                              <span className="block text-muted-foreground">{template.auditTrail.length} eventos de auditoria</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <Badge tone={templateStatusTone(template.status)}>{templateStatusLabel(template.status)}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn("font-medium", template.validationResult.canActivate ? "text-emerald-700" : "text-rose-700")}>
                              {template.validationResult.canActivate ? "Activable" : "Bloqueada"}
                            </span>
                            <span className="block text-muted-foreground">
                              {template.validationResult.missingRequiredPlaceholders.length} requeridos faltantes · {template.validationResult.missingOptionalPlaceholders.length} opcionales
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="ghost" onClick={() => revalidateTemplate(template)} disabled={!canManage}>
                                <Check size={13} />
                                Validar
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => activateTemplate(template)} disabled={!canManage || !template.validationResult.canActivate || template.status === "active"}>
                                Activar
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => downloadBlob(template.templateFileName, dataUrlToBlob(template.templateFileDataUrl))}>
                                <FileDown size={13} />
                                DOCX
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TemplateValidationPanel({ template }: { template?: DocumentTemplateVersion }) {
  if (!template) return null;
  const result = template.validationResult;

  return (
    <div
      className={cn(
        "mt-3 rounded-md border px-3 py-2 text-xs",
        result.canActivate ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-rose-300 bg-rose-50 text-rose-900"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{result.canActivate ? "Validacion correcta" : "Validacion incompleta"}</p>
        <span>{result.foundPlaceholders.length} placeholders encontrados</span>
      </div>
      {result.errors.length > 0 && (
        <p className="mt-1">
          Requeridos faltantes: {result.missingRequiredPlaceholders.slice(0, 6).join(", ")}
          {result.missingRequiredPlaceholders.length > 6 ? "..." : ""}
        </p>
      )}
      {result.warnings.length > 0 && (
        <p className="mt-1 text-muted-foreground">
          Advertencias: {result.warnings.slice(0, 3).join(" · ")}
          {result.warnings.length > 3 ? "..." : ""}
        </p>
      )}
    </div>
  );
}

function SettingsUsersSection({
  users,
  currentUser,
  canManage,
  onAddUser,
  onUpdateUser,
  onRemoveUser,
  onResetUserPassword
}: {
  users: AppUser[];
  currentUser: AppUser | null;
  canManage: boolean;
  onAddUser: (input: Omit<AppUser, "id" | "createdAt" | "status" | "passwordHash" | "passwordSalt" | "mustChangePassword" | "passwordUpdatedAt">) => Promise<string>;
  onUpdateUser: (userId: string, patch: Partial<Pick<AppUser, "name" | "email" | "role" | "status">>) => void;
  onRemoveUser: (userId: string) => void;
  onResetUserPassword: (userId: string) => Promise<string>;
}) {
  const [draftUser, setDraftUser] = useState({ name: "", email: "", role: "architect" as UserRole });
  const [temporaryPasswordNotice, setTemporaryPasswordNotice] = useState<{ userName: string; password: string } | null>(null);

  async function addDraftUser() {
    const password = await onAddUser(draftUser);
    if (password) setTemporaryPasswordNotice({ userName: draftUser.name.trim(), password });
    setDraftUser({ name: "", email: "", role: "architect" });
  }

  async function resetPassword(user: AppUser) {
    const password = await onResetUserPassword(user.id);
    if (password) setTemporaryPasswordNotice({ userName: user.name, password });
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Usuarios y permisos</p>
          <h2 className="text-sm font-semibold">Control de acceso</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Define roles, propietarios de assessments y permisos de edicion compartida entre ingenieros.
          </p>
        </div>
        <Badge tone={canManage ? "success" : "neutral"}>{canManage ? "Admin" : "Solo lectura"}</Badge>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {(["admin", "architect", "viewer"] as UserRole[]).map((role) => (
          <div key={role} className="rounded-md border border-border bg-white p-3">
            <Badge tone={userRoleTone(role)}>{userRoleLabel(role)}</Badge>
            <p className="mt-2 text-xs text-muted-foreground">{userRoleDescription(role)}</p>
          </div>
        ))}
      </div>

      {canManage && (
        <>
          <div className="mt-3 grid gap-2 rounded-md border border-border bg-white p-3 md:grid-cols-[1fr_1fr_180px_auto]">
            <Input value={draftUser.name} onChange={(event) => setDraftUser((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre" />
            <Input value={draftUser.email} onChange={(event) => setDraftUser((current) => ({ ...current, email: event.target.value }))} placeholder="email@empresa.com" />
            <select
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
              value={draftUser.role}
              onChange={(event) => setDraftUser((current) => ({ ...current, role: event.target.value as UserRole }))}
            >
              <option value="architect">Arquitecto</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Administrador</option>
            </select>
            <Button onClick={addDraftUser} disabled={!draftUser.name.trim() || !draftUser.email.trim()}>
              <UserPlus size={15} />
              Agregar
            </Button>
          </div>
          {temporaryPasswordNotice && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Password temporal para <strong>{temporaryPasswordNotice.userName}</strong>
                </span>
                <code className="rounded border border-amber-300 bg-white px-2 py-1 font-mono text-sm">{temporaryPasswordNotice.password}</code>
              </div>
              <p className="mt-1 text-amber-900">Compartelo por un canal seguro. El usuario debera cambiarlo en su primer login.</p>
            </div>
          )}
        </>
      )}

      <div className="mt-3 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[900px] table-fixed text-left text-xs">
          <colgroup>
            <col className="w-[190px]" />
            <col className="w-[150px]" />
            <col className="w-[90px]" />
            <col className="w-[145px]" />
            <col className="w-[145px]" />
            <col className="w-[180px]" />
          </colgroup>
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-2 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Password</th>
              <th className="px-4 py-3 font-semibold">Permisos</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {users.map((user) => (
              <tr key={user.id} className="align-top transition hover:bg-muted/20">
                <td className="px-4 py-4">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </td>
                <td className="px-2 py-4">
                  {canManage ? (
                    <select
                      className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm"
                      value={user.role}
                      onChange={(event) => onUpdateUser(user.id, { role: event.target.value as UserRole })}
                      disabled={user.id === currentUser?.id}
                    >
                      <option value="admin">Administrador</option>
                      <option value="architect">Arquitecto</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <Badge tone={userRoleTone(user.role)} className="whitespace-nowrap">{userRoleLabel(user.role)}</Badge>
                  )}
                </td>
                <td className="px-4 py-4">
                  <Badge tone={user.status === "active" ? "success" : "neutral"} className="whitespace-nowrap">{user.status === "active" ? "Activo" : "Deshabilitado"}</Badge>
                </td>
                <td className="px-4 py-4">
                  <Badge tone={user.mustChangePassword ? "warning" : "success"} className="whitespace-nowrap">{user.mustChangePassword ? "Cambio requerido" : "Actualizado"}</Badge>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(user.passwordUpdatedAt)}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm font-medium text-foreground">{userPermissionSummary(user.role)}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{user.role === "admin" ? "Global" : user.role === "architect" ? "Propios / compartidos" : "Lectura"}</span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => resetPassword(user)} disabled={!canManage}>
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="whitespace-nowrap"
                      onClick={() => onUpdateUser(user.id, { status: user.status === "active" ? "disabled" : "active" })}
                      disabled={!canManage || user.id === currentUser?.id}
                    >
                      {user.status === "active" ? "Deshabilitar" : "Activar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="whitespace-nowrap" onClick={() => onRemoveUser(user.id)} disabled={!canManage || user.id === currentUser?.id}>
                      <Trash2 size={13} />
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function templateStatusLabel(status: DocumentTemplateVersion["status"]) {
  if (status === "validation_failed") return "Fallo validacion";
  if (status === "active") return "Activa";
  if (status === "valid") return "Valida";
  if (status === "archived") return "Archivada";
  return "Borrador";
}

function templateStatusTone(status: DocumentTemplateVersion["status"]): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "valid") return "info";
  if (status === "validation_failed") return "danger";
  if (status === "archived") return "neutral";
  return "warning";
}

function compatibilityStatusLabel(status: TemplateCompatibilityResult["compatibilityStatus"]) {
  if (status === "compatible") return "Compatible";
  if (status === "compatible_with_warnings") return "Compatible con alertas";
  return "Incompatible";
}

function compatibilityTone(status: TemplateCompatibilityResult["compatibilityStatus"]): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "compatible") return "success";
  if (status === "compatible_with_warnings") return "warning";
  return "danger";
}

function nextTemplateVersion(templates: DocumentTemplateVersion[], documentType: DocumentType) {
  const versionNumbers = templates
    .filter((template) => template.documentType === documentType)
    .map((template) => Number(template.templateVersion.replace(/^v/i, "")))
    .filter((value) => Number.isFinite(value));
  return `v${Math.max(0, ...versionNumbers) + 1}`;
}

function templateAuditEvent(
  action: NonNullable<DocumentTemplateVersion["auditTrail"]>[number]["action"],
  actor: string,
  notes: string,
  definitionVersion: string
): NonNullable<DocumentTemplateVersion["auditTrail"]>[number] {
  return {
    id: uid("audit"),
    action,
    actor,
    at: new Date().toISOString(),
    notes,
    definitionVersion
  };
}

function persistenceTitle(mode: PersistenceState["mode"]) {
  if (mode === "postgres") return "Almacenamiento persistente activo";
  if (mode === "local") return "Modo local de respaldo";
  if (mode === "error") return "PostgreSQL no disponible";
  return "Verificando almacenamiento";
}

function persistenceTone(mode: PersistenceState["mode"]): "neutral" | "info" | "success" | "warning" | "danger" {
  if (mode === "postgres") return "success";
  if (mode === "local") return "warning";
  if (mode === "error") return "danger";
  return "info";
}

function userRoleLabel(role: UserRole) {
  if (role === "admin") return "Administrador";
  if (role === "architect") return "Arquitecto";
  return "Viewer";
}

function userRoleDescription(role: UserRole) {
  if (role === "admin") return "Gestiona usuarios, tokens, API, plantillas Word y todos los assessments.";
  if (role === "architect") return "Crea assessments y edita solo los propios o compartidos con permiso de edicion.";
  return "Solo lectura de assessments.";
}

function userPermissionSummary(role: UserRole) {
  if (role === "admin") return "Control total";
  if (role === "architect") return "Crear y editar";
  return "Solo lectura";
}

function userRoleTone(role: UserRole): "neutral" | "info" | "success" | "warning" | "danger" {
  if (role === "admin") return "danger";
  if (role === "architect") return "info";
  return "neutral";
}

function canManageUsers(user: AppUser) {
  return user.role === "admin" && user.status === "active";
}

function canCreateAssessment(user: AppUser) {
  return user.status === "active" && (user.role === "admin" || user.role === "architect");
}

function canEditAssessment(user: AppUser, record: AssessmentRecord) {
  if (user.status !== "active") return false;
  if (user.role === "admin") return true;
  if (user.role === "viewer") return false;
  if (record.ownerUserId === user.id) return true;
  return record.shares.some((share) => share.userId === user.id && share.permission === "edit");
}

function canDeleteAssessment(user: AppUser, record: AssessmentRecord) {
  if (user.status !== "active") return false;
  return user.role === "admin" || record.ownerUserId === user.id;
}

function canShareAssessment(user: AppUser, record: AssessmentRecord) {
  if (user.status !== "active") return false;
  return user.role === "admin" || record.ownerUserId === user.id;
}

function recordOwnerName(record: AssessmentRecord, users: AppUser[]) {
  return users.find((user) => user.id === record.ownerUserId)?.name ?? (record.client.owner || "Pendiente");
}

function assessmentAccessLabel(user: AppUser, record: AssessmentRecord) {
  if (user.role === "admin") return "Acceso admin";
  if (record.ownerUserId === user.id) return "Owner";
  const share = record.shares.find((item) => item.userId === user.id);
  if (share?.permission === "edit") return "Compartido editable";
  if (share?.permission === "view") return "Compartido lectura";
  return "Lectura";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ChecklistEditor({
  title,
  values,
  options,
  onChange
}: {
  title: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  const [customValue, setCustomValue] = useState("");

  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function addCustom() {
    if (!customValue.trim()) return;
    onChange(Array.from(new Set([...values, customValue.trim()])));
    setCustomValue("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Badge tone={values.length > 0 ? "success" : "neutral"}>{values.length} seleccionados</Badge>
      </div>
      <div className="grid gap-2">
        {options.map((option) => {
          const checked = values.includes(option);

          return (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition",
                checked ? "border-primary/40 bg-primary/5 text-foreground" : "border-border bg-white text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(option)} />
              <span
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border",
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white"
                )}
              >
                {checked && <Check size={13} />}
              </span>
              <span className="leading-5">{option}</span>
            </label>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input value={customValue} onChange={(event) => setCustomValue(event.target.value)} placeholder="Agregar otro" />
        <Button variant="secondary" onClick={addCustom}>
          <Plus size={14} />
        </Button>
      </div>
    </div>
  );
}

function DashboardSummary({
  record,
  activeFindings,
  onGoEvidence
}: {
  record: AssessmentRecord;
  activeFindings: Finding[];
  onGoEvidence: () => void;
}) {
  const effectiveParsed = effectiveParsedNetworkData(record);
  const metrics = [
    ["Evidencias", record.evidenceFiles.length],
    ["Dispositivos", effectiveParsed.devices.length],
    ["Interfaces", effectiveParsed.interfaces.length],
    ["Relaciones", effectiveParsed.relations.length],
    ["Hallazgos activos", activeFindings.length]
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(([label, value]) => (
          <MetricPanel key={label} label={String(label)} value={value} />
        ))}
      </div>
      <Panel>
        <PanelHeader>
          <h2 className="text-sm font-semibold">Proceso del assessment</h2>
        </PanelHeader>
        <PanelBody>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Crear cliente", true],
              ["Crear assessment", true],
              ["Seleccionar dominios", record.assessment.domains.length > 0],
              ["Cargar evidencia", record.evidenceFiles.length > 0],
              ["Parsear comandos Cisco", effectiveParsed.devices.length > 0 || effectiveParsed.interfaces.length > 0],
              ["Generar inventario", effectiveParsed.devices.length > 0],
              ["Descubrir relaciones", effectiveParsed.relations.length > 0],
              ["Validar hallazgos", record.parsed.findings.some((finding) => finding.status === "validated")],
              ["Exportar matriz Excel", record.parsed.findings.length > 0]
            ].map(([item, done], index) => (
              <div key={String(item)} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full", done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                  {done ? <Check size={14} /> : index + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onGoEvidence}>
              <ClipboardList size={16} />
              Continuar proceso
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

async function downloadFinalReportDocument(record: AssessmentRecord, activeTemplate: DocumentTemplateVersion | undefined, fileName: string) {
  if (!activeTemplate) {
    window.alert("No existe plantilla vigente para Hallazgos y Resumen Ejecutivo. Descarga la plantilla base en Ajustes, formateala, subela y activala.");
    return;
  }

  const validationResult = await validateUploadedTemplate(dataUrlToBlob(activeTemplate.templateFileDataUrl), "findings_report");
  const compatibility = compareTemplateWithCurrentDefinition({ ...activeTemplate, validationResult });
  if (!validationResult.canActivate || compatibility.compatibilityStatus === "incompatible") {
    window.alert("La plantilla vigente de Hallazgos ya no es compatible. Revalidala o sube una version actualizada en Ajustes.");
    return;
  }

  const executive = getExecutiveRiskDashboard(record);
  const rendered = await renderDocxTemplate(
    dataUrlToBlob(activeTemplate.templateFileDataUrl),
    mapAssessmentDataToPlaceholders({ ...record, executive }, "findings_report")
  );
  downloadBlob(fileName, rendered);
}

function FindingRow({
  finding,
  onChange,
  onSuppressLike,
  suppressLikeBusy = false
}: {
  finding: Finding;
  onChange: (patch: Partial<Finding>) => void;
  onSuppressLike?: () => void;
  suppressLikeBusy?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const probability = probabilityForFinding(finding);
  const severity = severityForFinding(finding);
  const isAISuggested = Boolean(finding.aiMetadata);
  const canAccept = isAISuggested && finding.status === "ai_suggested";

  return (
    <article className={cn("rounded-md border p-3", finding.status === "discarded" ? "border-border bg-muted/40 opacity-70" : "border-border bg-card")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={riskTone[finding.risk]}>{finding.risk.toUpperCase()}</Badge>
            <Badge tone="info">Severidad: {severity.label}</Badge>
            <Badge tone="neutral">Probabilidad: {probability.label}</Badge>
            {isAISuggested && <Badge tone="info">{finding.aiMetadata?.findingType ?? "ai"}</Badge>}
            <Badge tone={finding.status === "validated" || finding.status === "accepted" ? "success" : finding.status === "discarded" ? "neutral" : "warning"}>
              {finding.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{Math.round(finding.confidence * 100)}% confianza</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold">{finding.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{finding.recommendation}</p>
        </div>
        <div className="flex gap-1">
          {canAccept && (
            <Button size="icon" variant="secondary" title="Aceptar sugerencia AI" onClick={() => onChange({ status: "accepted" })}>
              <ShieldCheck size={15} />
            </Button>
          )}
          <Button size="icon" variant="secondary" title="Editar" onClick={() => setEditing((value) => !value)}>
            <Pencil size={15} />
          </Button>
          <Button size="icon" variant="secondary" title="Validar" onClick={() => onChange({ status: "validated" })}>
            <Check size={15} />
          </Button>
          <Button size="icon" variant="secondary" title="Descartar" onClick={() => onChange({ status: "discarded" })}>
            <X size={15} />
          </Button>
        </div>
      </div>
      {onSuppressLike && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={onSuppressLike} disabled={suppressLikeBusy || finding.status === "discarded"}>
            <X size={13} />
            Suprimir hallazgos como este
          </Button>
        </div>
      )}

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
        <div className="rounded-md bg-muted/50 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Evidencia</p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{finding.evidence.join("\n\n")}</pre>
        </div>
        <div className="space-y-2 text-xs">
          <p><span className="font-semibold">Activos:</span> {finding.affectedAssets.join(", ")}</p>
          <p><span className="font-semibold">Categoria:</span> {finding.category}</p>
          <p><span className="font-semibold">Remediacion:</span> {remediationCategoryLabel[finding.remediationCategory]}</p>
          <p><span className="font-semibold">Servicio:</span> {finding.serviceOffer}</p>
          {finding.aiMetadata?.relatedCorrelationCandidates?.length ? (
            <p><span className="font-semibold">Correlaciones:</span> {finding.aiMetadata.relatedCorrelationCandidates.join(", ")}</p>
          ) : null}
          {finding.aiMetadata?.limitations?.length ? (
            <p><span className="font-semibold">Limitaciones:</span> {finding.aiMetadata.limitations.join(" · ")}</p>
          ) : null}
        </div>
      </div>

      {finding.aiMetadata && (
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <div className="grid gap-3 md:grid-cols-3">
            <p><span className="font-semibold">Causa probable:</span> {finding.aiMetadata.probableCause || "Pendiente de validar"}</p>
            <p><span className="font-semibold">Impacto tecnico:</span> {finding.aiMetadata.technicalImpact || "Pendiente"}</p>
            <p><span className="font-semibold">Impacto negocio:</span> {finding.aiMetadata.businessImpact || "Pendiente"}</p>
          </div>
          {finding.aiMetadata.validationQuestions?.length ? (
            <p className="mt-2 text-muted-foreground"><span className="font-semibold text-foreground">Validar:</span> {finding.aiMetadata.validationQuestions.join(" · ")}</p>
          ) : null}
          {finding.aiMetadata.evidenceTraceRefs?.length ? (
            <div className="mt-3 rounded border border-border bg-card/70 p-2">
              <p className="font-semibold">Trazabilidad de evidencia</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {finding.aiMetadata.evidenceTraceRefs.slice(0, 6).map((ref) => (
                  <div key={ref.id} className="rounded border border-border px-2 py-1 text-muted-foreground">
                    <p className="font-medium text-foreground">{ref.command ?? "Evidencia"}</p>
                    <p>{[ref.sourceFile, ref.deviceId, ref.interfaceId, ref.metricId].filter(Boolean).join(" · ")}</p>
                    {ref.excerpt && <p className="mt-1 line-clamp-2">{ref.excerpt}</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {editing && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Titulo">
            <Input value={finding.title} onChange={(event) => onChange({ title: event.target.value, status: isAISuggested ? "edited" : finding.status })} />
          </Field>
          <Field label="Servicio">
            <Input value={finding.serviceOffer} onChange={(event) => onChange({ serviceOffer: event.target.value, status: isAISuggested ? "edited" : finding.status })} />
          </Field>
          <Field label="Recomendacion">
            <Textarea value={finding.recommendation} onChange={(event) => onChange({ recommendation: event.target.value, status: isAISuggested ? "edited" : finding.status })} />
          </Field>
          <Field label="Notas del arquitecto">
            <Textarea value={finding.architectNotes ?? ""} onChange={(event) => onChange({ architectNotes: event.target.value, status: isAISuggested ? "edited" : finding.status })} />
          </Field>
        </div>
      )}
    </article>
  );
}

function DataTable({
  title,
  emptyTitle,
  columns,
  rows
}: {
  title: string;
  emptyTitle: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <Panel>
      <PanelHeader>
        <h2 className="text-sm font-semibold">{title}</h2>
      </PanelHeader>
      <PanelBody>
        {rows.length === 0 ? (
          <EmptyState icon={<FileText size={24} />} title={emptyTitle} />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase text-muted-foreground">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="border-b border-border px-3 py-2 font-semibold">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map((row, index) => (
                  <tr key={`${title}-${index}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${title}-${index}-${cellIndex}`} className="max-w-80 px-3 py-2 align-top">{cell || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function EmptyState({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-6 text-center">
      <div className="mb-2 text-muted-foreground">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
    </div>
  );
}

async function loadEvidenceFiles(files: File[]) {
  const loaded: EvidenceFile[] = [];

  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !/\.(txt|log)$/i.test(entry.name)) continue;
        loaded.push({
          id: uid("ev"),
          name: entry.name,
          type: entry.name.toLowerCase().endsWith(".log") ? "log" : "txt",
          content: await entry.async("text"),
          uploadedAt: new Date().toISOString()
        });
      }
    } else {
      loaded.push({
        id: uid("ev"),
        name: file.name,
        type: file.name.toLowerCase().endsWith(".log") ? "log" : file.name.toLowerCase().endsWith(".txt") ? "txt" : "other",
        content: await file.text(),
        uploadedAt: new Date().toISOString()
      });
    }
  }

  return loaded;
}

async function loadPerformanceEvidenceFiles(files: File[], assessmentId: string, uploadedBy: string) {
  const loaded: PerformanceEvidenceFile[] = [];

  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !/\.(txt|log|csv)$/i.test(entry.name)) continue;
        const content = await entry.async("text");
        const classification = classifyPerformanceEvidence(entry.name, content);
        loaded.push({
          id: uid("perf_ev"),
          assessmentId,
          fileName: entry.name,
          ...classification,
          uploadedBy,
          uploadedAt: new Date().toISOString(),
          processingStatus: "pending",
          parsedMetricCount: 0,
          confidenceScore: 0,
          content
        });
      }
    } else {
      const content = /\.(txt|log|csv)$/i.test(file.name) ? await file.text() : "";
      const classification = classifyPerformanceEvidence(file.name, content);
      loaded.push({
        id: uid("perf_ev"),
        assessmentId,
        fileName: file.name,
        ...classification,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
        processingStatus: "pending",
        parsedMetricCount: 0,
        confidenceScore: 0,
        content
      });
    }
  }

  return loaded;
}

function createInitialRecords(): AssessmentRecord[] {
  return [];
}

const defaultAdminPasswordSalt = "assessment_default_admin_salt";
const defaultAdminPasswordHash = "90f5b7c2632c06c81bac1af00137734eea150ee93b3c18ed1a9f363396a2ae4b";

async function hashPassword(password: string, salt: string) {
  const payload = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await window.crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createPasswordCredentials(password: string) {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  const passwordSalt = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return {
    passwordSalt,
    passwordHash: await hashPassword(password, passwordSalt)
  };
}

function generateTemporaryPassword() {
  const bytes = new Uint8Array(6);
  window.crypto.getRandomValues(bytes);
  const fragment = Array.from(bytes)
    .map((byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 10);
  return `Temp-${fragment}!`;
}

function createDefaultUsers(): AppUser[] {
  return [
    {
      id: "user_admin",
      name: "Administrador",
      email: "admin@assessment.local",
      role: "admin",
      status: "active",
      passwordHash: defaultAdminPasswordHash,
      passwordSalt: defaultAdminPasswordSalt,
      mustChangePassword: true,
      passwordUpdatedAt: "2026-06-01T00:00:00.000Z",
      createdAt: "2026-06-01T00:00:00.000Z"
    }
  ];
}

function readInitialUsers() {
  if (typeof window === "undefined") return createDefaultUsers();
  const stored = window.localStorage.getItem("assessment-tool.users.v1");
  if (!stored) return createDefaultUsers();

  try {
    const users = JSON.parse(stored) as AppUser[];
    const normalized = Array.isArray(users) ? users.map(normalizeUser).filter(Boolean) as AppUser[] : [];
    return normalized.length > 0 ? ensureAdminUser(normalized) : createDefaultUsers();
  } catch {
    return createDefaultUsers();
  }
}

function readInitialCurrentUserId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("assessment-tool.current-user-id.v1") ?? "";
}

async function fetchPersistedUsers() {
  const response = await fetch("/api/users", { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "No se pudieron cargar usuarios desde PostgreSQL.");

  const users = Array.isArray(payload?.users) ? (payload.users as AppUser[]) : [];
  const normalized = users.map(normalizeUser).filter(Boolean) as AppUser[];
  return normalized.length > 0 ? ensureAdminUser(normalized) : [];
}

async function syncPersistedUsers(users: AppUser[]) {
  const response = await fetch("/api/users", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ users })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "No se pudieron sincronizar usuarios en PostgreSQL.");
  return payload as { ok: boolean; saved: number };
}

function normalizeUser(user: AppUser): AppUser | null {
  if (!user?.id || !user?.email) return null;
  const role = user.role === "admin" || user.role === "architect" || user.role === "viewer" ? user.role : "viewer";
  const status = user.status === "disabled" ? "disabled" : "active";
  const hasCredentials = Boolean(user.passwordHash && user.passwordSalt);
  return {
    id: user.id,
    name: user.name || user.email,
    email: user.email.toLowerCase(),
    role,
    status,
    passwordHash: hasCredentials ? user.passwordHash : defaultAdminPasswordHash,
    passwordSalt: hasCredentials ? user.passwordSalt : defaultAdminPasswordSalt,
    mustChangePassword: hasCredentials ? Boolean(user.mustChangePassword) : true,
    passwordUpdatedAt: user.passwordUpdatedAt ?? user.createdAt ?? new Date().toISOString(),
    createdAt: user.createdAt ?? new Date().toISOString()
  };
}

function ensureAdminUser(users: AppUser[]) {
  return users.some((user) => user.role === "admin") ? users : [...users, ...createDefaultUsers()];
}

function resolveCurrentUserId(users: AppUser[], currentUserId: string) {
  if (users.some((user) => user.id === currentUserId && user.status === "active")) return currentUserId;
  return "";
}

function readInitialRecords() {
  if (typeof window === "undefined") return createInitialRecords();

  const stored = window.localStorage.getItem("assessment-tool.records.v1");
  if (!stored) return createInitialRecords();

  try {
    const records = JSON.parse(stored) as AssessmentRecord[];
    return records.map(normalizeRecord).filter((record) => !isDemoRecord(record));
  } catch {
    return createInitialRecords();
  }
}

function writeRecordsLocalCache(records: AssessmentRecord[], preferFullContent: boolean) {
  if (typeof window === "undefined") return { stored: "none" as const };
  const storageKey = "assessment-tool.records.v1";

  if (preferFullContent) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(records));
      return { stored: "full" as const };
    } catch (error) {
      if (!isStorageQuotaError(error)) throw error;
    }
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(records.map(stripRecordEvidenceContentForLocalCache)));
    return { stored: "metadata" as const };
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    try {
      window.localStorage.removeItem(storageKey);
      window.localStorage.setItem(storageKey, JSON.stringify(records.map(stripRecordEvidenceContentForLocalCache)));
      return { stored: "metadata" as const };
    } catch {
      return { stored: "none" as const };
    }
  }
}

function stripRecordEvidenceContentForLocalCache(record: AssessmentRecord): AssessmentRecord {
  return {
    ...record,
    evidenceFiles: (record.evidenceFiles ?? []).map(stripEvidenceFileContent),
    performance: {
      ...record.performance,
      evidenceFiles: (record.performance?.evidenceFiles ?? []).map(stripPerformanceEvidenceFileContent)
    }
  };
}

function stripEvidenceFileContent(file: EvidenceFile): EvidenceFile {
  return { ...file, content: "" };
}

function stripPerformanceEvidenceFileContent(file: PerformanceEvidenceFile): PerformanceEvidenceFile {
  return { ...file, content: "" };
}

function isStorageQuotaError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014)
  );
}

async function fetchPersistedAssessmentRecords() {
  const response = await fetch("/api/assessments", { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "No se pudo cargar PostgreSQL.");

  const records = Array.isArray(payload?.records) ? payload.records as AssessmentRecord[] : [];
  return records.map(normalizeRecord).filter((record) => !isDemoRecord(record));
}

async function syncPersistedAssessmentRecords(records: AssessmentRecord[]) {
  const response = await fetch("/api/assessments", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "No se pudo sincronizar PostgreSQL.");
  return payload as { ok: boolean; saved: number };
}

async function fetchPersistedDocumentTemplates() {
  const response = await fetch("/api/document-templates", { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "No se pudieron cargar plantillas desde PostgreSQL.");

  const templates = Array.isArray(payload?.templates) ? (payload.templates as DocumentTemplateVersion[]) : [];
  return ensureActiveDocumentTemplates(templates.filter((template) => template?.id && template?.documentType && template?.validationResult));
}

async function syncPersistedDocumentTemplates(templates: DocumentTemplateVersion[]) {
  const response = await fetch("/api/document-templates", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templates })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "No se pudieron sincronizar plantillas en PostgreSQL.");
  return payload as { ok: boolean; saved: number };
}

async function fetchOpenAiCredentialMetadata() {
  const response = await fetch("/api/credentials/openai", { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "No se pudo cargar la credencial OpenAI.");
  return (payload?.credential ?? emptyOpenAiCredentialMetadata()) as ApiCredentialMetadata;
}

async function fetchCiscoCredentialMetadata() {
  const response = await fetch("/api/credentials/cisco", { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "No se pudo cargar la credencial Cisco.");
  return (payload?.credential ?? emptyCiscoCredentialMetadata()) as ApiCredentialMetadata;
}

function emptyOpenAiCredentialMetadata(): ApiCredentialMetadata {
  return {
    provider: "openai",
    label: "OpenAI API key",
    configured: false,
    source: "none",
    maskedValue: "",
    lastFour: null,
    updatedAt: null,
    updatedBy: null,
    encryptionVersion: null
  };
}

function emptyCiscoCredentialMetadata(): ApiCredentialMetadata {
  return {
    provider: "cisco_eox",
    label: "Cisco EoX OAuth access token",
    configured: false,
    source: "none",
    maskedValue: "",
    lastFour: null,
    updatedAt: null,
    updatedBy: null,
    encryptionVersion: null
  };
}

function readInitialUiMode(): UiMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("assessment-tool.ui-mode.v1");
  return stored === "light" ? "light" : "dark";
}

function readInitialOpenAiApiKey() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("assessment-tool.openai-api-key.v1") ?? "";
}

function readInitialCiscoApiToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("assessment-tool.cisco-api-token.v1") ?? "";
}

function readInitialDocumentTemplates() {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem("assessment-tool.document-templates.v1");
  if (!stored) return [];

  try {
    const templates = JSON.parse(stored) as DocumentTemplateVersion[];
    return Array.isArray(templates)
      ? ensureActiveDocumentTemplates(templates.filter((template) => template?.id && template?.documentType && template?.validationResult))
      : [];
  } catch {
    return [];
  }
}

function ensureActiveDocumentTemplates(templates: DocumentTemplateVersion[]) {
  let normalized = templates;
  for (const documentType of ["sow", "findings_report"] as DocumentType[]) {
    const versions = normalized.filter((template) => template.documentType === documentType);
    if (versions.some((template) => template.status === "active")) continue;
    const activableTemplate = versions.find((template) => template.validationResult?.canActivate && (template.status === "valid" || template.status === "draft"));
    if (!activableTemplate) continue;
    try {
      normalized = activateTemplateVersion(normalized, activableTemplate.id, "System");
    } catch {
      normalized = normalized.map((template) =>
        template.id === activableTemplate.id
          ? {
              ...template,
              status: "valid",
              notes: "Plantilla valida pendiente de activacion manual."
            }
          : template
      );
    }
  }
  return normalized;
}

function normalizeRecord(record: AssessmentRecord) {
  const normalizedScope = {
    ...createDefaultScope(record.assessment.domains),
    ...(record.scope ?? {}),
    performanceAnalysis: {
      ...createDefaultPerformanceScope(),
      ...(record.scope?.performanceAnalysis ?? {})
    }
  };
  const performance = record.performance ?? createDefaultPerformanceState(record.assessment.id, normalizedScope.performanceAnalysis.mode);
  return {
    ...record,
    ownerUserId: record.ownerUserId ?? "user_admin",
    shares: record.shares ?? [],
    scope: normalizedScope,
    targetInventory: (record.targetInventory ?? []).map((asset) => ({
      ...asset,
      deviceType: asset.deviceType ?? inferDeviceType(asset),
      topologyLayer: normalizeTopologyLayer(asset.topologyLayer),
      included: asset.included ?? true
    })),
    lifecycleEoxRecords: record.lifecycleEoxRecords ?? {},
    lifecycleEoxLookupResults: record.lifecycleEoxLookupResults ?? {},
    lifecycleConsultedProductIds: record.lifecycleConsultedProductIds ?? [],
    lifecycleEoxMessage: record.lifecycleEoxMessage ?? "",
    supportCoverageRecords: record.supportCoverageRecords ?? {},
    supportCoverageConsultedSerials: record.supportCoverageConsultedSerials ?? [],
    supportCoverageMessage: record.supportCoverageMessage ?? "",
    operationalAssessment: record.operationalAssessment ?? createDefaultOperationalAssessment(record.assessment.id, record.client.id),
    parsed: {
      ...record.parsed,
      findings: ensureUniqueFindingIds((record.parsed?.findings ?? []).map(normalizeFindingRemediationCategory))
    },
    performance: {
      ...createDefaultPerformanceState(record.assessment.id, normalizedScope.performanceAnalysis.mode),
      ...performance,
      assessment: {
        ...createDefaultPerformanceState(record.assessment.id, normalizedScope.performanceAnalysis.mode).assessment,
        ...performance.assessment,
        analysisMode: normalizedScope.performanceAnalysis.mode
      },
      evidenceFiles: performance.evidenceFiles ?? [],
      metrics: performance.metrics ?? [],
      findings: (performance.findings ?? []).map((finding: any) => ({
        ...finding,
        remediationCategory: mapLegacyRemediation(String(finding?.remediationCategory ?? finding?.[legacyRemediationField] ?? ""))
      })),
      charts: performance.charts ?? []
    },
    evidenceSkips: record.evidenceSkips ?? [],
    aiAnalysis: normalizeAIAnalysisState(record.aiAnalysis)
  };
}

function ensureUniqueFindingIds(findings: Finding[]) {
  const usedIds = new Set<string>();
  return findings.map((finding) => {
    const uniqueId = uniqueFindingId(finding.id || uid("find"), usedIds);
    return uniqueId === finding.id ? finding : { ...finding, id: uniqueId };
  });
}

function normalizeFindingRemediationCategory(finding: Finding | (Omit<Finding, "remediationCategory"> & { remediationCategory?: unknown })): Finding {
  const source = finding as Finding & Record<string, unknown>;
  const { [legacyRemediationField]: _legacyRemediation, ...rest } = source;
  return {
    ...(rest as Finding),
    remediationCategory: mapLegacyRemediation(String(source.remediationCategory ?? source[legacyRemediationField] ?? ""))
  };
}

function uniqueFindingId(baseId: string, usedIds: Set<string>) {
  const normalizedBaseId = baseId.trim() || uid("find");
  if (!usedIds.has(normalizedBaseId)) {
    usedIds.add(normalizedBaseId);
    return normalizedBaseId;
  }

  let suffix = 2;
  let candidate = `${normalizedBaseId}_dup${suffix}`;
  while (usedIds.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBaseId}_dup${suffix}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function createDefaultAIAnalysisState(): AIAnalysisState {
  return {
    correlationCandidates: [...emptyAIAnalysisState.correlationCandidates],
    limitations: [...emptyAIAnalysisState.limitations]
  };
}

function normalizeAIAnalysisState(state?: AIAnalysisState): AIAnalysisState {
  return {
    context: state?.context,
    correlationCandidates: state?.correlationCandidates ?? [],
    limitations: state?.limitations ?? [],
    updatedAt: state?.updatedAt
  };
}

function isDemoRecord(record: AssessmentRecord) {
  const demoIds = new Set(["assess_core_modernization", "assess_campus_refresh", "assess_dc_readiness"]);
  const demoNames = new Set(["cliente demo", "banco norte", "retail andino"]);
  return demoIds.has(record.id) || demoNames.has(record.client.name.trim().toLowerCase());
}

function createDefaultScope(selectedDomains: Domain[]): ScopeDefinition {
  return {
    businessContext: "Assessment tecnico para identificar riesgos, brechas operativas y oportunidades de remediacion.",
    objectives: defaultObjectives,
    sites: "Pendiente de confirmar con el cliente.",
    environments: selectedDomains.includes("datacenter-networking") ? ["Datacenter", "Core", "DR"] : ["Campus", "Core", "Acceso"],
    constraints: "Sujeto a disponibilidad de accesos, ventanas operativas y aprobacion del cliente.",
    deliverables: defaultDeliverables,
    performanceAnalysis: createDefaultPerformanceScope()
  };
}

function evaluationAreaLabel(area: EvaluationArea) {
  return evaluationAreas.find((item) => item.id === area)?.label ?? area;
}

function evaluationAreaToAIScope(area: EvaluationArea): AIAnalysisScopeId {
  const map: Record<EvaluationArea, AIAnalysisScopeId> = {
    topology: "topology",
    configuration: "configuration",
    security: "security",
    lifecycle: "lifecycle",
    operations: "operations",
    logs: "evidence"
  };
  return map[area];
}

function scopeLabel(scopeId: string) {
  const labels: Record<string, string> = {
    inventory: "Inventario",
    configuration: "Configuracion",
    lifecycle: "Lifecycle",
    topology: "Topologia",
    routing: "Routing",
    performance: "Performance",
    security: "Seguridad",
    high_availability: "Alta disponibilidad",
    datacenter: "Datacenter",
    campus: "Campus",
    wan: "WAN",
    perimeter: "Perimetro",
    operations: "Operacion",
    evidence: "Evidencia",
    roadmap: "Roadmap",
    executive_summary: "Resumen ejecutivo"
  };
  return labels[scopeId] ?? scopeId;
}

function findingsForScopeDisplay(findings: Finding[], scope: AIScopeDisplayMetadata) {
  const serviceOffers = new Set([
    `${scope.label} Analysis`,
    `${scope.id} Analysis`
  ]);
  if (aiScopeDisplayOrder.some((item) => item.id === scope.id)) {
    serviceOffers.add(`${scopeLabel(scope.id as AIAnalysisScopeId)} Analysis`);
  }
  return findings.filter((finding) => finding.aiMetadata && serviceOffers.has(finding.serviceOffer));
}

function shouldShowScopeDisplay(
  scope: AIScopeDisplayMetadata,
  aiAnalysisStatus: AIAssessmentAnalysisStatus | undefined,
  latestJob: AIAnalysisJobSnapshot | undefined,
  findings: Finding[]
) {
  const flag = flagForStage(scope.id);
  if (!flag) return true;
  return isUIStageFlagEnabled(flag) || hasScopeDisplayActivity(scope.id, aiAnalysisStatus, latestJob, findings);
}

function shouldShowPipelineStage(
  stage: PipelineViewStage,
  record: AssessmentRecord,
  aiAnalysisStatus: AIAssessmentAnalysisStatus | undefined,
  latestJob: AIAnalysisJobSnapshot | undefined
) {
  if (stage.stage === "map") return true;
  if (stage.stage === "reduce") {
    const findings = findingsForScopeDisplay(record.parsed.findings, crossScopeCorrelationDisplay);
    return shouldShowScopeDisplay(crossScopeCorrelationDisplay, aiAnalysisStatus, latestJob, findings);
  }
  return ["roadmap", "executive_summary"].some((scopeId) => {
    const scope = aiScopeDisplayOrder.find((item) => item.id === scopeId);
    if (!scope) return false;
    const findings = findingsForScopeDisplay(record.parsed.findings, scope);
    return shouldShowScopeDisplay(scope, aiAnalysisStatus, latestJob, findings);
  });
}

function hasScopeDisplayActivity(
  scopeId: AIScopeOrStageDisplayId,
  aiAnalysisStatus: AIAssessmentAnalysisStatus | undefined,
  latestJob: AIAnalysisJobSnapshot | undefined,
  findings: Finding[]
) {
  if (findings.length > 0) return true;
  if (latestJob?.currentPhase?.startsWith(`${scopeId}:`)) return true;
  const scopeStatus = aiAnalysisStatus?.scopes.find((scope) => scope.id === scopeId);
  if (scopeStatus && (scopeStatus.status !== "pending" || scopeStatus.inputHash || scopeStatus.updatedAt)) return true;
  return Boolean(aiAnalysisStatus?.jobs.some((job) =>
    job.steps.some((step) => step.scopeId === scopeId && (step.status !== "pending" || step.inputHash || step.completedAt))
  ));
}

function hasAnyScopeAnalysisActivity(aiAnalysisStatus: AIAssessmentAnalysisStatus | undefined) {
  return Boolean(aiAnalysisStatus?.scopes.some((scope) =>
    scope.status !== "pending" || scope.inputHash || scope.updatedAt
  ) || aiAnalysisStatus?.jobs.some((job) =>
    job.steps.some((step) => step.status !== "pending" || step.inputHash || step.completedAt)
  ));
}

function isScopeJobActive(
  scopeId: AIScopeOrStageDisplayId,
  aiAnalysisStatus: AIAssessmentAnalysisStatus | undefined,
  latestJob: AIAnalysisJobSnapshot | undefined
) {
  const activeJobs = [
    ...(latestJob ? [latestJob] : []),
    ...(aiAnalysisStatus?.jobs ?? [])
  ].filter((job) => isActiveAIJobStatus(job.status));
  return activeJobs.some((job) =>
    job.currentPhase?.startsWith(`${scopeId}:`) ||
    job.scopeId === scopeId ||
    job.steps.some((step) => step.scopeId === scopeId)
  );
}

function isScopeCurrentlyExecuting(
  scopeId: AIScopeOrStageDisplayId,
  latestJob: AIAnalysisJobSnapshot | undefined
) {
  return Boolean(latestJob?.currentPhase?.startsWith(`${scopeId}:`) && isActiveAIJobStatus(latestJob.status));
}

function isAnimatedStatus(status: string | undefined) {
  return status === "running" || status === "queued";
}

function statusForScopeDisplay(
  scopeId: AIScopeOrStageDisplayId,
  aiAnalysisStatus: AIAssessmentAnalysisStatus | undefined,
  latestJob: AIAnalysisJobSnapshot | undefined
) {
  if (latestJob?.currentPhase?.startsWith(`${scopeId}:`) && isActiveAIJobStatus(latestJob.status)) return "running";
  const scopeStatus = aiAnalysisStatus?.scopes.find((scope) => scope.id === scopeId);
  if (scopeStatus?.status) return scopeStatus.status;
  const latestStep = aiAnalysisStatus?.jobs
    .flatMap((job) => job.steps)
    .filter((step) => step.scopeId === scopeId)
    .sort((left, right) => String(right.completedAt ?? right.startedAt ?? "").localeCompare(String(left.completedAt ?? left.startedAt ?? "")))[0];
  return latestStep?.status ?? "pending";
}

function scopeStatusMessage(
  scopeId: AIScopeOrStageDisplayId,
  status: string,
  scopeStatus: AIAssessmentAnalysisStatus["scopes"][number] | undefined,
  latestJob: AIAnalysisJobSnapshot | undefined
) {
  const statusLabel = humanizeScopeStatus(status).label;
  const currentPhase = latestJob?.currentPhase?.startsWith(`${scopeId}:`)
    ? latestJob.currentPhase.split(":").slice(1).join(":")
    : null;
  const updatedAt = scopeStatus?.updatedAt ? ` · Ultima evaluacion ${formatDate(scopeStatus.updatedAt)}` : "";
  return currentPhase ? `${statusLabel} · ${currentPhase}${updatedAt}` : `${statusLabel}${updatedAt}`;
}

function isUIStageFlagEnabled(flag: AIStageFlag) {
  if (flag === "AI_REDUCE_STAGE") return process.env.NEXT_PUBLIC_AI_REDUCE_STAGE === "1" || process.env.AI_REDUCE_STAGE === "1";
  return process.env.NEXT_PUBLIC_AI_SYNTHESIS_STAGE === "1" || process.env.AI_SYNTHESIS_STAGE === "1";
}

function isActiveAIJobStatus(status: string) {
  return status === "queued" || status === "running";
}

function hasRunningAIJob(status?: AIAssessmentAnalysisStatus) {
  return Boolean(status?.jobs.some((job) => isActiveAIJobStatus(job.status)));
}

function scopeStatusTone(status: string | undefined): React.ComponentProps<typeof Badge>["tone"] {
  if (status === "ok") return "success";
  if (status === "completed" || status === "complete" || status === "processed" || status === "ai_reviewed" || status === "validated") return "success";
  if (status === "running" || status === "queued" || status === "pending" || status === "draft" || status === "evidence_loaded" || status === "processing") return "warning";
  if (status === "error" || status === "timeout" || status === "failed" || status === "blocked" || status === "cancelled") return "danger";
  if (status === "skipped" || status === "partially_completed") return "info";
  return "neutral";
}

function formatDebugNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? new Intl.NumberFormat("es-ES").format(value as number) : "-";
}

function formatDebugLatency(value: number | null | undefined) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("es-ES").format(value as number)} ms`;
}

function prettyDebugJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

function debugJsonSizeLabel(value: unknown) {
  const chars = prettyDebugJson(value).length;
  if (chars < 1024) return `${chars} B`;
  return `${Math.ceil(chars / 1024)} KB`;
}

function summarizeRejectedFindings(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  const reasons = Array.from(new Set(items
    .map((item) => {
      const candidate = item as { reason?: unknown; message?: unknown; error?: unknown };
      return String(candidate.reason ?? candidate.message ?? candidate.error ?? "").trim();
    })
    .filter(Boolean))).slice(0, 3);
  return { count: items.length, reasons };
}

const riskLevelsForEditor: RiskLevel[] = ["critical", "high", "medium", "low", "info"];
const playbookOsFamilyOptions: ScopePlaybookOsFamily[] = ["all", "ios", "ios-xe", "nxos", "asa"];

function shortHash(value: string) {
  return value ? value.slice(0, 8) : "sin hash";
}

async function fetchAIAnalysisStatus(assessmentId: string): Promise<AIAssessmentAnalysisStatus> {
  const response = await fetch(`/api/ai-analysis/assessments/${assessmentId}/status`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo consultar estado AI.");
  return payload as AIAssessmentAnalysisStatus;
}

async function resetPersistentAIAnalysisStatus(assessmentId: string, scopeId?: AIAnalysisScopeId | null): Promise<AIAssessmentAnalysisStatus> {
  const suffix = scopeId ? `?scopeId=${encodeURIComponent(scopeId)}` : "";
  const response = await fetch(`/api/ai-analysis/assessments/${assessmentId}/status${suffix}`, { method: "DELETE" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo limpiar estado AI.");
  return payload as AIAssessmentAnalysisStatus;
}

async function fetchTopologyDesignGuideline(scopeKey: string, currentUser: AppUser): Promise<TopologyDesignGuidelineResponse> {
  const response = await fetch(`/api/ai-analysis/design-guidelines?scopeKey=${encodeURIComponent(scopeKey)}`, {
    cache: "no-store",
    headers: { "x-user-email": currentUser.email }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo consultar guideline de diseno.");
  return payload as TopologyDesignGuidelineResponse;
}

async function updateTopologyDesignGuideline(scopeKey: string, content: string, currentUser: AppUser): Promise<TopologyDesignGuidelineResponse> {
  const response = await fetch("/api/ai-analysis/design-guidelines", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": currentUser.email
    },
    body: JSON.stringify({
      scopeKey,
      content,
      updatedBy: currentUser.email
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo guardar guideline de diseno.");
  return payload as TopologyDesignGuidelineResponse;
}

async function deleteTopologyDesignGuideline(scopeKey: string, currentUser: AppUser): Promise<TopologyDesignGuidelineResponse> {
  const response = await fetch(`/api/ai-analysis/design-guidelines?scopeKey=${encodeURIComponent(scopeKey)}`, {
    method: "DELETE",
    headers: { "x-user-email": currentUser.email }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo eliminar guideline de diseno.");
  return payload as TopologyDesignGuidelineResponse;
}

async function fetchScopePlaybook(scopeId: PlaybookScopeId, currentUser: AppUser): Promise<ScopePlaybookResponse> {
  const response = await fetch(`/api/ai-analysis/playbook?scopeId=${encodeURIComponent(scopeId)}`, {
    cache: "no-store",
    headers: { "x-user-email": currentUser.email }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo consultar el playbook.");
  return payload as ScopePlaybookResponse;
}

async function updateScopePlaybook(
  scopeId: PlaybookScopeId,
  draft: Pick<ScopePlaybookResponse["playbook"], "criteria" | "expected" | "exclusions">,
  currentUser: AppUser
): Promise<ScopePlaybookResponse> {
  const response = await fetch("/api/ai-analysis/playbook", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": currentUser.email
    },
    body: JSON.stringify({
      scopeId,
      criteria: draft.criteria,
      expected: draft.expected,
      exclusions: draft.exclusions,
      updatedBy: currentUser.email
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo guardar el playbook.");
  return payload as ScopePlaybookResponse;
}

async function appendReviewSuppressionToScopePlaybook(scopeId: PlaybookScopeId, finding: Finding, currentUser: AppUser, record: AssessmentRecord): Promise<ScopePlaybookResponse> {
  const appliesTo = inferFindingOsFamilies(finding, record);
  const response = await fetch("/api/ai-analysis/playbook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": currentUser.email
    },
    body: JSON.stringify({
      scopeId,
      finding: {
        title: finding.title,
        finding_type: finding.aiMetadata?.findingType
      },
      appliesTo,
      reason: "Hallazgo descartado en revision; suprimir similares.",
      updatedBy: currentUser.email
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo crear la exclusion.");
  return payload as ScopePlaybookResponse;
}

function playbookScopeIdForFinding(finding: Finding): PlaybookScopeId | null {
  const serviceOffer = String(finding.serviceOffer ?? "").toLowerCase();
  if (serviceOffer.includes("configuracion") || serviceOffer.includes("configuration")) return "configuration";
  if (serviceOffer.includes("seguridad") || serviceOffer.includes("security")) return "security";
  if (serviceOffer.includes("evidencia") || serviceOffer.includes("evidence") || serviceOffer.includes("logs")) return "evidence";
  if (serviceOffer.includes("performance")) return "performance";
  if (finding.aiMetadata?.domain === "performance") return "performance";
  if (finding.category === "configuration") return "configuration";
  if (finding.category === "security") return "security";
  return null;
}

function playbookScopeLabel(scopeId: PlaybookScopeId) {
  return playbookScopeTabs.find((tab) => tab.id === scopeId)?.label ?? scopeId;
}

function designGuidelineSourceLabel(source: DesignGuidelineSource) {
  if (source === "assessment") return "Override del assessment";
  if (source === "global") return "Global";
  return "Default semilla";
}

async function fetchAIDebugSetting(assessmentId: string, currentUser: AppUser): Promise<AIDebugSetting> {
  const response = await fetch(`/api/ai-analysis/debug/setting?assessmentId=${encodeURIComponent(assessmentId)}`, {
    cache: "no-store",
    headers: { "x-user-email": currentUser.email }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo consultar configuracion debug AI.");
  return payload.setting as AIDebugSetting;
}

async function updateAIDebugSetting(assessmentId: string, captureEnabled: boolean, currentUser: AppUser): Promise<AIDebugSetting> {
  const response = await fetch("/api/ai-analysis/debug/setting", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-email": currentUser.email
    },
    body: JSON.stringify({
      assessmentId,
      captureEnabled,
      updatedBy: currentUser.email
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo actualizar configuracion debug AI.");
  return payload.setting as AIDebugSetting;
}

async function fetchAIDebugInteractions(assessmentId: string, currentUser: AppUser): Promise<AIDebugInteraction[]> {
  const response = await fetch(`/api/ai-analysis/debug/interactions?assessmentId=${encodeURIComponent(assessmentId)}`, {
    cache: "no-store",
    headers: { "x-user-email": currentUser.email }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudieron consultar interacciones debug AI.");
  return payload.interactions as AIDebugInteraction[];
}

async function deleteAIDebugInteractions(assessmentId: string, currentUser: AppUser) {
  const response = await fetch(`/api/ai-analysis/debug/interactions?assessmentId=${encodeURIComponent(assessmentId)}`, {
    method: "DELETE",
    headers: { "x-user-email": currentUser.email }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudieron purgar interacciones debug AI.");
  return payload as { ok: boolean; deleted: number };
}

function persistentAIResultsToFindings(results: AIAssessmentAnalysisResults["results"], assessmentId: string): Finding[] {
  const usedIds = new Set<string>();
  return results.flatMap((result) => {
    const findings = Array.isArray(result.findings) ? result.findings as any[] : [];
    return findings
      .filter((finding) => !isPersistentAICredentialPlaceholder(finding))
      .map((finding) => {
        const id = uniqueFindingId(persistentAIFindingBaseId(finding, result.scopeId, assessmentId), usedIds);
        return persistentAIFindingToFinding(finding, result.scopeId, assessmentId, id);
      });
  });
}

function isPersistentAICredentialPlaceholder(finding: any) {
  const title = String(finding?.title ?? "");
  const evidence = Array.isArray(finding?.evidence) ? finding.evidence : [];
  return title.includes("OPENAI_API_KEY") || evidence.some((item: any) => String(item?.excerpt ?? "").includes("no llamo OpenAI"));
}

function persistentAIFindingToFinding(finding: any, scopeId: string, assessmentId: string, id: string): Finding {
  const evidenceItems = Array.isArray(finding?.evidence) ? finding.evidence : [];
  const evidence = evidenceItems.map((item: any) => {
    const source = [item?.source_name, item?.hostname, item?.command].filter(Boolean).join(" · ");
    return `${source || "AI analysis"}: ${String(item?.excerpt ?? "").slice(0, 600)}`;
  }).filter(Boolean);
  const relatedDevices = Array.isArray(finding?.related_devices) ? finding.related_devices.map(String) : [];

  return {
    id,
    title: cleanPersistentAIText(finding?.title) || "Hallazgo AI pendiente de titulo",
    category: scopeToFindingCategory(scopeId),
    risk: normalizePersistentAIRisk(finding?.severity),
    confidence: normalizePersistentAIConfidence(finding?.confidence),
    status: "ai_suggested",
    affectedAssets: relatedDevices.length > 0 ? relatedDevices : ["Assessment"],
    evidence: evidence.length > 0 ? evidence : ["Resultado AI persistente sin evidencia detallada."],
    recommendation: cleanPersistentAIText(finding?.recommendation) || "Validar con arquitecto antes de emitir recomendacion final.",
    remediationCategory: mapLegacyRemediation(String(finding?.remediation_category ?? finding?.remediationCategory ?? finding?.[legacyRemediationField] ?? "")),
    serviceOffer: `${scopeLabel(scopeId)} Analysis`,
    architectNotes: "",
    aiMetadata: {
      findingType: "validation_required",
      domain: scopeToAIFindingDomain(scopeId),
      businessImpact: cleanPersistentAIText(finding?.business_impact),
      technicalImpact: cleanPersistentAIText(finding?.technical_rationale),
      validationQuestions: ["Validar evidencia, severidad y recomendacion antes de aceptar el hallazgo."],
      limitations: []
    }
  };
}

function persistentAIFindingBaseId(finding: any, scopeId: string, assessmentId: string) {
  const findingId = cleanPersistentAIText(finding?.finding_id) || uid("ai");
  return ["aijob", assessmentId, scopeId, findingId].map(safePersistentAIIdPart).join("_");
}

function safePersistentAIIdPart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function scopeToFindingCategory(scopeId: string): Finding["category"] {
  if (scopeId === "lifecycle") return "lifecycle";
  if (scopeId === "security" || scopeId === "perimeter") return "security";
  if (scopeId === "topology" || scopeId === "high_availability") return "resiliency";
  if (scopeId === "configuration") return "configuration";
  if (scopeId === "inventory") return "inventory";
  return "operations";
}

function scopeToAIFindingDomain(scopeId: string): NonNullable<Finding["aiMetadata"]>["domain"] {
  if (scopeId === "datacenter") return "datacenter";
  if (scopeId === "security" || scopeId === "perimeter") return "security";
  if (scopeId === "performance") return "performance";
  if (scopeId === "lifecycle") return "lifecycle";
  return scopeId === "operations" ? "operations" : "enterprise_networking";
}

function normalizePersistentAIRisk(value: unknown): RiskLevel {
  if (value === "critical" || value === "high" || value === "medium" || value === "low") return value;
  return "info";
}

function normalizePersistentAIConfidence(value: unknown) {
  if (value === "high") return 0.86;
  if (value === "medium") return 0.68;
  if (value === "low") return 0.42;
  return 0.5;
}

function cleanPersistentAIText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function areaToCategory(area: EvaluationArea): Finding["category"] {
  return areaToFindingCategory(area);
}

const riskSeverities = [
  { id: "negligible", label: "Negligible", weight: 1 },
  { id: "minor", label: "Minor", weight: 2 },
  { id: "moderate", label: "Moderate", weight: 3 },
  { id: "significant", label: "Significant", weight: 4 },
  { id: "severe", label: "Severe", weight: 5 }
] as const;

const riskProbabilities = [
  { id: "very-likely", label: "Very Likely", weight: 5 },
  { id: "likely", label: "Likely", weight: 4 },
  { id: "possible", label: "Possible", weight: 3 },
  { id: "unlikely", label: "Unlikely", weight: 2 },
  { id: "very-unlikely", label: "Very Unlikely", weight: 1 }
] as const;

function buildRiskAssessmentMatrix(findings: Finding[]) {
  const cells = Object.fromEntries(
    riskProbabilities.map((probability) => [
      probability.id,
      Object.fromEntries(
        riskSeverities.map((severity) => [
          severity.id,
          { ...riskMatrixCell(probability.weight, severity.weight), findings: [] as Finding[] }
        ])
      )
    ])
  ) as Record<(typeof riskProbabilities)[number]["id"], Record<(typeof riskSeverities)[number]["id"], ReturnType<typeof riskMatrixCell> & { findings: Finding[] }>>;

  for (const finding of findings.filter((item) => item.status !== "discarded")) {
    const probability = probabilityForFinding(finding);
    const severity = severityForFinding(finding);
    cells[probability.id][severity.id].findings.push(finding);
  }

  return {
    probabilities: riskProbabilities,
    severities: riskSeverities,
    cells
  };
}

function severityForFinding(finding: Finding) {
  const map: Record<RiskLevel, (typeof riskSeverities)[number]> = {
    info: riskSeverities[0],
    low: riskSeverities[1],
    medium: riskSeverities[2],
    high: riskSeverities[3],
    critical: riskSeverities[4]
  };
  return map[finding.risk];
}

function probabilityForFinding(finding: Finding) {
  if (finding.confidence >= 0.85) return riskProbabilities[0];
  if (finding.confidence >= 0.7) return riskProbabilities[1];
  if (finding.confidence >= 0.5) return riskProbabilities[2];
  if (finding.confidence >= 0.3) return riskProbabilities[3];
  return riskProbabilities[4];
}

function riskMatrixCell(probabilityWeight: number, severityWeight: number) {
  const score = probabilityWeight * severityWeight;
  if (score >= 16) return { level: "high", label: "High" };
  if (score >= 12) return { level: "medium-high", label: "Med Hi" };
  if (score >= 8) return { level: "medium", label: "Medium" };
  if (score >= 4) return { level: "low-medium", label: "Low Med" };
  return { level: "low", label: "Low" };
}

function riskMatrixLabel(level: string) {
  const labels: Record<string, string> = {
    low: "Low",
    "low-medium": "Low Med",
    medium: "Medium",
    "medium-high": "Med Hi",
    high: "High"
  };
  return labels[level] ?? level;
}

function riskMatrixToneClass(level: string) {
  const classes: Record<string, string> = {
    low: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-600/60 dark:bg-emerald-950/55 dark:text-emerald-200",
    "low-medium": "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-500/60 dark:bg-teal-950/50 dark:text-teal-100",
    medium: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/60 dark:bg-amber-950/45 dark:text-amber-200",
    "medium-high": "border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-500/65 dark:bg-orange-950/45 dark:text-orange-200",
    high: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/70 dark:bg-rose-950/55 dark:text-rose-200"
  };
  return classes[level] ?? "border-border bg-muted text-foreground dark:bg-muted/50";
}

function shortFindingId(finding: Finding) {
  const suffix = finding.id.replace(/^find[_-]?/i, "").slice(0, 5).toUpperCase();
  return `F-${suffix || "00000"}`;
}

function findingRenderKey(finding: Pick<Finding, "id">, index: number) {
  return `${finding.id}:${index}`;
}

function isPerformanceFindingId(id: string) {
  return /^PF-/i.test(id);
}

function riskWeight(value: string) {
  const weights: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
  return weights[value] ?? 0;
}

function buildSow(record: AssessmentRecord) {
  const items = [
    {
      title: "Alcance",
      body: `${record.assessment.domains.map(domainLabel).join(", ")} en ${record.scope.environments.join(", ")}. Sitios: ${record.scope.sites}.`
    },
    {
      title: "Inventario objetivo",
      body: `${record.targetInventory.length} equipos declarados por el cliente para evaluacion tecnica.`
    },
    {
      title: "Actividades",
      body: "Levantamiento de informacion, parsing de salidas, analisis por ambito, validacion de hallazgos, matriz de riesgo/impacto y documento editable."
    },
    {
      title: "Supuestos y restricciones",
      body: record.scope.constraints
    },
    {
      title: "Entregables",
      body: record.scope.deliverables.join(", ")
    }
  ];

  if (record.scope.performanceAnalysis.enabled) {
    items.splice(3, 0, {
      title: "Performance Analysis",
      body: `Incluido en modo ${record.scope.performanceAnalysis.mode}. Se evaluaran utilizacion, errores, drops, recursos y brechas de visibilidad con evidencia provista por el cliente.`
    });
  }

  return items;
}

function buildSowExportInput(record: AssessmentRecord, sowItems: Array<{ title: string; body: string }>) {
  const effectiveParsed = effectiveParsedNetworkData(record);

  return {
    client: {
      name: record.client.name,
      industry: record.client.industry,
      owner: record.client.owner
    },
    assessment: {
      name: record.assessment.name,
      status: statusLabel[record.assessment.status],
      domains: record.assessment.domains.map(domainLabel)
    },
    scope: {
      businessContext: record.scope.businessContext,
      objectives: record.scope.objectives,
      sites: record.scope.sites,
      environments: record.scope.environments,
      constraints: record.scope.constraints,
      deliverables: record.scope.deliverables
    },
    sowItems,
    inventory: record.targetInventory.map((asset) => ({
      hostname: asset.hostname,
      managementIp: asset.managementIp,
      serial: asset.serial,
      model: asset.model,
      deviceType: deviceTypeLabel(asset.deviceType),
      role: asset.role,
      site: asset.site,
      topologyLayer: asset.topologyLayer ? topologyLayerConfig[asset.topologyLayer].label : "Auto",
      priority: asset.priority,
      included: asset.included
    })),
    evidenceCoverage: buildEvidenceCoverageRows(record).map((row) => ({
      hostname: row.hostname,
      managementIp: row.managementIp,
      model: row.model,
      role: row.role,
      collectedCount: row.collectedCount,
      missingCount: row.missingCount,
      skippedCount: row.skippedCount,
      cells: row.cells.map((cell) => ({
        label: evidenceRequirements.find((requirement) => requirement.id === cell.requirementId)?.label ?? cell.requirementId,
        status: cell.status,
        fileNames: cell.fileNames
      }))
    })),
    evidenceFiles: record.evidenceFiles.map((file) => ({
      name: file.name,
      type: file.type.toUpperCase(),
      sizeKb: Math.max(1, Math.round(file.content.length / 1024)),
      uploadedAt: formatDate(file.uploadedAt)
    })),
    relations: effectiveParsed.relations.map((relation) => ({
      localHostname: relation.localHostname,
      localInterface: relation.localInterface,
      remoteHostname: relation.remoteHostname,
      remoteInterface: relation.remoteInterface,
      protocol: relation.protocol,
      confidence: relation.confidence
    })),
    findings: record.parsed.findings.map((finding) => ({
      title: finding.title,
      category: finding.category,
      risk: finding.risk,
      status: finding.status,
      confidence: finding.confidence,
      affectedAssets: finding.affectedAssets,
      recommendation: finding.recommendation,
      remediationCategory: remediationCategoryLabel[finding.remediationCategory]
    }))
  };
}

function buildCollectionScript(record: AssessmentRecord) {
  const intro = [
    `# Assessment: ${record.assessment.name}`,
    `# Cliente: ${record.client.name}`,
    "# Ejecutar los comandos por equipo y guardar la salida completa entre marcadores.",
    "# No modificar los delimitadores BEGIN_DEVICE / END_DEVICE.",
    ""
  ].join("\n");

  const includedAssets = record.targetInventory.filter((asset) => asset.included);

  if (includedAssets.length === 0) {
    return `${intro}${scriptProfiles.switch.commands.join("\n")}`;
  }

  return `${intro}${includedAssets
    .map((asset) => {
      const deviceType = asset.deviceType ?? inferDeviceType(asset);
      const profile = scriptProfiles[deviceType] ?? scriptProfiles.other;
      return [
        `##### BEGIN_DEVICE hostname=${asset.hostname} management_ip=${asset.managementIp} type=${deviceType} platform=${asset.platform} role=${asset.role} #####`,
        `! Perfil: ${deviceTypeLabel(deviceType)}`,
        `! Sitio: ${asset.site || "Pendiente"} | Prioridad: ${asset.priority}`,
        ...profile.commands,
        `##### END_DEVICE hostname=${asset.hostname} #####`
      ].join("\n");
    })
    .join("\n\n")}`;
}

function buildPerformanceCollectionScript(record: AssessmentRecord) {
  const intro = [
    `# Performance Analysis: ${record.assessment.name}`,
    `# Cliente: ${record.client.name}`,
    `# Modo: ${record.scope.performanceAnalysis.mode}`,
    "# Ejecutar durante ventana acordada y guardar la salida completa entre marcadores.",
    "# No modificar los delimitadores BEGIN_PERFORMANCE / END_PERFORMANCE.",
    ""
  ].join("\n");

  if (!record.scope.performanceAnalysis.enabled) {
    return `${intro}# Performance Analysis esta fuera de alcance. Activalo en Alcance para generar comandos.`;
  }

  const includedAssets = record.targetInventory.filter((asset) => asset.included);
  if (includedAssets.length === 0) {
    return `${intro}${performanceCommandsByVendor.generic.join("\n")}`;
  }

  return `${intro}${includedAssets
    .map((asset) => {
      const vendor = performanceVendorForAsset(asset);
      const commands = performanceCommandsByVendor[vendor] ?? performanceCommandsByVendor.generic;
      return [
        `##### BEGIN_PERFORMANCE hostname=${asset.hostname} management_ip=${asset.managementIp} type=${asset.deviceType} platform=${asset.platform} mode=${record.scope.performanceAnalysis.mode} #####`,
        `! Perfil performance: ${vendor.replace(/_/g, " ")}`,
        `! Sitio: ${asset.site || "Pendiente"} | Rol: ${asset.role || "Pendiente"} | Prioridad: ${asset.priority}`,
        ...commands,
        `##### END_PERFORMANCE hostname=${asset.hostname} #####`
      ].join("\n");
    })
    .join("\n\n")}`;
}

const ciscoBaselineCommands = [
  "terminal length 0",
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
  "show ip protocols",
  "show ip ospf neighbor",
  "show bgp summary",
  "show logging",
  "show ntp associations",
  "show clock",
  "show redundancy",
  "show license"
];

const nexusDatacenterCommands = [
  "show vpc",
  "show vpc consistency-parameters global",
  "show port-channel summary",
  "show interface trunk",
  "show interface switchport",
  "show nve peers",
  "show bgp l2vpn evpn summary",
  "show vlan",
  "show vrf",
  "show feature",
  "show module",
  "show environment"
];

const securityPerimeterCommands = [
  "terminal pager 0",
  "show failover",
  "show route",
  "show access-list",
  "show nat",
  "show vpn-sessiondb",
  "show crypto ikev2 sa",
  "show conn count",
  "show asp drop",
  "show version",
  "show inventory",
  "show running-config"
];

const wirelessControllerCommands = [
  "terminal length 0",
  "show version",
  "show inventory",
  "show running-config",
  "show startup-config",
  "show sysinfo",
  "show ap summary",
  "show wlan summary",
  "show client summary",
  "show interface summary",
  "show logging",
  "show ntp associations",
  "show clock",
  "show license"
];

function mergeCommands(...groups: string[][]) {
  return Array.from(new Set(groups.flat()));
}

const scriptProfiles: Record<DeviceType, { description: string; commands: string[] }> = {
  switch: {
    description: "Switch campus IOS/IOS XE: baseline completo de inventario, configuracion, interfaces, capa 2, routing, logs, NTP, redundancia y licencias.",
    commands: ciscoBaselineCommands
  },
  router: {
    description: "Router IOS/IOS XE: baseline completo de inventario, configuracion, interfaces, routing, protocolos, vecinos, logs, NTP, redundancia y licencias.",
    commands: ciscoBaselineCommands
  },
  "nexus-switch": {
    description: "Switch Nexus / Datacenter NX-OS: baseline Cisco mas vPC, port-channel, trunks, switchport, VXLAN/EVPN, VRF, features, modulos y ambiente.",
    commands: mergeCommands(ciscoBaselineCommands, nexusDatacenterCommands)
  },
  aci: {
    description: "ACI/APIC: fabric membership, faults, tenants, fabric nodes y salud general.",
    commands: [
      "show version",
      "show controller",
      "show fabric membership",
      "show fault summary",
      "show tenants",
      "show endpoint summary",
      "show interface brief",
      "show running-config"
    ]
  },
  "wireless-controller": {
    description: "Wireless controller: baseline de version, inventario, configuracion, APs, WLANs, clientes, interfaces, logs, NTP y licencias.",
    commands: wirelessControllerCommands
  },
  firewall: {
    description: "Seguridad/perimetro Cisco: failover, rutas, ACL, NAT, VPN, IKEv2, conexiones, ASP drop, version, inventario y configuracion.",
    commands: securityPerimeterCommands
  },
  other: {
    description: "Perfil generico Cisco IOS/IOS XE/NX-OS cuando el tipo de equipo no esta clasificado.",
    commands: ciscoBaselineCommands
  }
};

function buildScriptGroups(record: AssessmentRecord) {
  const types = Object.keys(scriptProfiles) as DeviceType[];
  return types.map((deviceType) => ({
    deviceType,
    description: scriptProfiles[deviceType].description,
    assets: record.targetInventory.filter((asset) => asset.included && (asset.deviceType ?? inferDeviceType(asset)) === deviceType)
  }));
}

function buildPerformanceScriptGroups(record: AssessmentRecord) {
  const types = Object.keys(scriptProfiles) as DeviceType[];
  return types.map((deviceType) => ({
    deviceType,
    description: record.scope.performanceAnalysis.enabled
      ? `Comandos de performance para ${deviceTypeLabel(deviceType)}: interfaces, errores, drops, recursos, colas, logs y estabilidad.`
      : "Performance Analysis fuera de alcance.",
    assets: record.targetInventory.filter((asset) => asset.included && (asset.deviceType ?? inferDeviceType(asset)) === deviceType)
  }));
}

function performanceVendorForAsset(asset: InventoryAsset): keyof typeof performanceCommandsByVendor {
  const value = `${asset.deviceType} ${asset.platform} ${asset.model} ${asset.role}`.toLowerCase();
  if (/asa|ftd|firewall|firepower/.test(value)) return "cisco_asa_ftd";
  if (/nx-os|nexus|n9k|n7k|aci|leaf|spine/.test(value)) return "cisco_nxos";
  if (/ios|ios-xe|catalyst|c9[236]00|isr|asr|router|switch/.test(value)) return "cisco_ios_xe";
  return "generic";
}

function inferDeviceType(asset: Pick<InventoryAsset, "model" | "platform" | "role">): DeviceType {
  const value = `${asset.model} ${asset.platform} ${asset.role}`.toLowerCase();
  if (/n9k|n7k|n5k|nexus|nx-os/.test(value)) return "nexus-switch";
  if (/router|wan|isr|asr|edge/.test(value)) return "router";
  if (/aci|apic|leaf|spine/.test(value)) return "aci";
  if (/wlc|wireless|9800/.test(value)) return "wireless-controller";
  if (/asa|firepower|ftd|firewall/.test(value)) return "firewall";
  if (/switch|c9[236]00|c3850|access|core|distribution|dist/.test(value)) return "switch";
  return "other";
}

function deviceTypeLabel(deviceType: DeviceType) {
  const labels: Record<DeviceType, string> = {
    switch: "Switch",
    router: "Router",
    "nexus-switch": "Switch Nexus",
    aci: "ACI",
    "wireless-controller": "WLC",
    firewall: "Firewall",
    other: "Otro"
  };
  return labels[deviceType];
}

function duplicateSerialSet(assets: InventoryAsset[]) {
  const counts = new Map<string, number>();
  for (const asset of assets) {
    const serial = normalizedSerial(asset.serial);
    if (!serial) continue;
    counts.set(serial, (counts.get(serial) ?? 0) + 1);
  }
  return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([serial]) => serial));
}

function normalizedSerial(serial: string) {
  const value = serial.trim().toLowerCase();
  if (!value || value === "pendiente" || value === "n/a" || value === "na" || value === "unknown") return "";
  return value;
}

function sortInventoryAssets(assets: InventoryAsset[], key: InventorySortKey, direction: SortDirection) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...assets].sort((left, right) => compareInventoryValues(left, right, key) * multiplier);
}

function compareInventoryValues(left: InventoryAsset, right: InventoryAsset, key: InventorySortKey) {
  if (key === "included") return Number(right.included) - Number(left.included);
  if (key === "priority") return priorityWeight(right.priority) - priorityWeight(left.priority);
  if (key === "managementIp") return compareIp(left.managementIp, right.managementIp);
  return inventorySortValue(left, key).localeCompare(inventorySortValue(right, key), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function inventorySortValue(asset: InventoryAsset, key: InventorySortKey) {
  if (key === "deviceType") return deviceTypeLabel(asset.deviceType);
  if (key === "role") return `${asset.role} ${asset.site}`;
  if (key === "topologyLayer") return asset.topologyLayer ? topologyLayerConfig[asset.topologyLayer].label : "Auto";
  return String(asset[key] ?? "");
}

function compareIp(left: string, right: string) {
  const leftParts = ipParts(left);
  const rightParts = ipParts(right);
  for (let index = 0; index < 4; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function ipParts(value: string) {
  return value.split(".").map((part) => Number(part));
}

function priorityWeight(priority: InventoryAsset["priority"]) {
  const weights: Record<InventoryAsset["priority"], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };
  return weights[priority];
}

function normalizeDeviceType(value: string): DeviceType {
  const normalized = value.toLowerCase().trim();
  if (normalized === "switch") return "switch";
  if (normalized === "router") return "router";
  if (normalized === "nexus-switch" || normalized === "nexus" || normalized === "switch nexus") return "nexus-switch";
  if (normalized === "aci" || normalized === "apic") return "aci";
  if (normalized === "wireless-controller" || normalized === "wlc") return "wireless-controller";
  if (normalized === "firewall" || normalized === "fw") return "firewall";
  return "other";
}

function normalizePriority(value: string): InventoryAsset["priority"] {
  const normalized = value.toLowerCase().trim();
  if (normalized === "critical" || normalized === "critica" || normalized === "crítica") return "critical";
  if (normalized === "high" || normalized === "alta") return "high";
  if (normalized === "low" || normalized === "baja") return "low";
  return "medium";
}

function normalizeTopologyLayer(value: unknown): TopologyLayerId | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase().trim().replace(/[\s_]+/g, "-");
  if (normalized === "auto" || normalized === "automatico" || normalized === "automático") return undefined;
  if (normalized === "branch" || normalized === "branches" || normalized === "sucursal" || normalized === "sucursales" || normalized === "remote-site" || normalized === "remote-office") return "branches";
  if (normalized === "perimetro" || normalized === "perímetro" || normalized === "wan-edge" || normalized === "edge") return "perimeter";
  if (normalized === "dc" || normalized === "data-center" || normalized === "data-center-fabric" || normalized === "fabric") return "datacenter";
  if (normalized === "campus-access" || normalized === "access" || normalized === "acceso" || normalized === "distribution" || normalized === "distribucion") return "campus";
  return topologyLayerOrder.includes(normalized as TopologyLayerId) ? normalized as TopologyLayerId : undefined;
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl: string) {
  const [header, base64 = ""] = dataUrl.split(",");
  const mimeMatch = header.match(/^data:(.*?);base64$/);
  const mimeType = mimeMatch?.[1] || "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "assessment";
}

const riskDimensions: Array<{
  id: string;
  name: string;
  description: string;
  weight: number;
  categories: Finding["category"][];
}> = [
  { id: "resiliency", name: "Resiliencia y disponibilidad", description: "Redundancia, topologia, puntos unicos de falla y continuidad.", weight: 20, categories: ["resiliency"] },
  { id: "security", name: "Seguridad y exposicion", description: "Hardening, acceso administrativo, vulnerabilidades y exposicion.", weight: 20, categories: ["security"] },
  { id: "lifecycle", name: "Ciclo de vida y soporte", description: "EoX, soporte, vigencia tecnologica de hardware y software.", weight: 15, categories: ["lifecycle"] },
  { id: "configuration", name: "Diseno y configuracion", description: "Baseline, configuraciones, consistencia y mejores practicas.", weight: 15, categories: ["configuration"] },
  { id: "operations", name: "Operacion y soporte", description: "Logs, estado operativo, mantenibilidad y procesos.", weight: 15, categories: ["operations"] },
  { id: "performance", name: "Performance y capacidad", description: "Capacidad, utilizacion, errores y salud de interfaces.", weight: 10, categories: ["operations", "resiliency"] },
  { id: "documentation", name: "Documentacion y trazabilidad", description: "Inventario, evidencia, trazabilidad y completitud documental.", weight: 5, categories: ["inventory"] }
];

const executiveConfidenceThreshold = 70;

function getExecutiveRiskDashboard(record: AssessmentRecord): ExecutiveRiskDashboard {
  const activeFindings = acceptedOrValidatedFindings(record.parsed.findings);
  const validatedFindings = executiveSummaryFindings(record.parsed.findings);
  const confidence = calculateConfidenceIndex(record);
  const dimensions = calculateRiskDimensions(record, validatedFindings, confidence.overall);
  const isSufficient = confidence.overall >= executiveConfidenceThreshold && validatedFindings.length > 0;
  const irir = isSufficient ? Math.round(dimensions.reduce((sum, dimension) => sum + dimension.weightedScore, 0)) : null;
  const actionCounts = {
    professional_services: 0,
    new_technology: 0,
    platform_upgrade: 0,
    operational_change: 0,
    pending_validation: 0
  } satisfies Record<RemediationCategory, number>;
  for (const finding of activeFindings) actionCounts[finding.remediationCategory] += 1;

  const warnings = [...confidence.warnings];
  if (validatedFindings.length === 0) warnings.push("No hay hallazgos validados o AI aceptados por el arquitecto.");
  if (confidence.overall < executiveConfidenceThreshold) warnings.push("El riesgo puede estar subestimado por falta de evidencia suficiente.");

  const performanceSummary = record.scope.performanceAnalysis.enabled
    ? {
        enabled: true,
        status: record.performance.assessment.status,
        analysisMode: record.performance.assessment.analysisMode,
        performanceRiskScore: record.performance.assessment.performanceRiskScore,
        confidenceScore: record.performance.assessment.confidenceScore,
        dataCoverageScore: record.performance.assessment.dataCoverageScore,
        summaryText: record.performance.assessment.summary,
        topRisks: record.performance.findings.slice(0, 5).map((finding) => finding.title),
        topMetrics: record.performance.assessment.topMetrics,
        visibilityGaps: record.performance.assessment.visibilityGaps,
        recommendedActions: record.performance.assessment.recommendedActions,
        limitations: record.performance.assessment.limitations,
        lastUpdated: record.performance.assessment.updatedAt
      }
    : undefined;

  return {
    irir,
    irirLevel: irir === null ? "Pendiente" : executiveRiskLevel(irir),
    ica: confidence.overall,
    icaLevel: confidenceLevel(confidence.overall),
    isSufficient,
    threshold: executiveConfidenceThreshold,
    warnings: warnings.length > 0 ? warnings : ["Sin advertencias criticas de suficiencia."],
    dimensions,
    topFindings: [...validatedFindings].sort((left, right) => riskWeight(right.risk) - riskWeight(left.risk) || right.confidence - left.confidence).slice(0, 10),
    severityCounts: countBy(activeFindings, (finding) => finding.risk),
    domainCounts: countBy(activeFindings, (finding) => finding.category),
    actionCounts,
    recommendations: executiveRecommendations(irir, confidence.overall, actionCounts),
    operational: record.operationalAssessment.executiveSummary
      ? {
          maturityScore: record.operationalAssessment.executiveSummary.overallMaturityScore,
          maturityLevel: record.operationalAssessment.executiveSummary.maturityLevel,
          operationalRiskScore: record.operationalAssessment.executiveSummary.operationalRiskScore,
          confidenceScore: record.operationalAssessment.executiveSummary.confidenceScore,
          keyStrengths: record.operationalAssessment.executiveSummary.keyStrengths,
          keyGaps: record.operationalAssessment.executiveSummary.keyGaps,
          topRisks: record.operationalAssessment.executiveSummary.topRisks,
          recommendedActions: record.operationalAssessment.executiveSummary.recommendedActions,
          validationStatus: record.operationalAssessment.executiveSummary.validationStatus,
          lastUpdated: record.operationalAssessment.executiveSummary.lastUpdated
        }
      : undefined,
    performance: performanceSummary
  };
}

function calculateRiskDimensions(record: AssessmentRecord, findings: Finding[], confidenceOverall = calculateConfidenceIndex(record).overall): RiskDimensionScore[] {
  return riskDimensions.filter((dimension) => dimension.id !== "performance" || record.scope.performanceAnalysis.enabled).map((dimension) => {
    const dimensionFindings = findings.filter((finding) => findingBelongsToRiskDimension(finding, dimension.id, dimension.categories));
    const hasEvidence = dimensionHasEvidence(record, dimension.id);
    const findingRawScore = dimensionFindings.length > 0 ? Math.max(...dimensionFindings.map((finding) => rawRiskScore(finding.risk))) : null;
    const operationalRawScore =
      dimension.id === "operations" && record.operationalAssessment.executiveSummary
        ? riskScoreToRawScore(record.operationalAssessment.operationalRiskScore)
        : null;
    const rawScore = Math.max(findingRawScore ?? -1, operationalRawScore ?? -1) >= 0
      ? Math.max(findingRawScore ?? 0, operationalRawScore ?? 0)
      : hasEvidence ? 0 : null;
    const normalizedScore = rawScore === null ? 0 : (rawScore / 5) * 100;

    return {
      id: dimension.id,
      name: dimension.name,
      description: dimension.description,
      weight: dimension.weight,
      rawScore,
      normalizedScore,
      weightedScore: (normalizedScore * dimension.weight) / 100,
      level: rawScore === null ? "Insufficient evidence" : rawScoreLevel(rawScore),
      confidenceLevel: confidenceLevel(confidenceOverall),
      findingCount: dimensionFindings.length,
      evidenceSummary:
        rawScore === null
          ? "Evidencia insuficiente; no se interpreta como bajo riesgo."
          : dimension.id === "operations" && operationalRawScore !== null
            ? `Incluye riesgo operativo procesado (${record.operationalAssessment.operationalRiskScore}/100).`
          : dimensionFindings.length > 0
            ? `${dimensionFindings.length} hallazgos validados asociados.`
            : "Sin hallazgos validados asociados con evidencia disponible."
    };
  });
}

function findingBelongsToRiskDimension(finding: Finding, dimensionId: string, categories: Finding["category"][]) {
  if (dimensionId === "performance") return isPerformanceFindingId(finding.id);
  if (dimensionId === "operations" && isPerformanceFindingId(finding.id)) return false;
  return categories.includes(finding.category);
}

function calculateConfidenceIndex(record: AssessmentRecord) {
  const coverageRows = buildEvidenceCoverageRows(record);
  const effectiveParsed = effectiveParsedNetworkData(record);
  const expectedDevices = Math.max(record.targetInventory.filter((asset) => asset.included).length, effectiveParsed.devices.length);
  const completedCoverageRows = coverageRows.filter((row) => row.missingCount === 0).length;
  const evidenceReceived = Math.min(100, (record.evidenceFiles.length / Math.max(1, expectedDevices)) * 100);
  const deviceCoverage = expectedDevices === 0 ? 0 : Math.min(100, (effectiveParsed.devices.length / expectedDevices) * 100);
  const configCompleteness = coverageRows.length === 0 ? 0 : (completedCoverageRows / coverageRows.length) * 100;
  const interviewCompletion = operationsFormScore(record);
  const lifecycleData = lifecycleProductIds(record).length > 0 ? record.lifecycleConsultedProductIds.length > 0 ? 100 : 60 : 0;
  const topologyConfidence = expectedDevices <= 1 ? 100 : effectiveParsed.relations.length > 0 ? 85 : 20;
  const performanceConfidence = record.performance.assessment.confidenceScore;
  const overall = record.scope.performanceAnalysis.enabled
    ? Math.round(
        evidenceReceived * 0.18 +
        deviceCoverage * 0.18 +
        configCompleteness * 0.18 +
        interviewCompletion * 0.14 +
        lifecycleData * 0.14 +
        topologyConfidence * 0.1 +
        performanceConfidence * 0.08
      )
    : Math.round(
        evidenceReceived * 0.2 +
        deviceCoverage * 0.2 +
        configCompleteness * 0.2 +
        interviewCompletion * 0.15 +
        lifecycleData * 0.15 +
        topologyConfidence * 0.1
      );
  const warnings: string[] = [];

  if (evidenceReceived < 60) warnings.push("Evidencia tecnica recibida por debajo del umbral esperado.");
  if (deviceCoverage < 80) warnings.push("Cobertura de dispositivos incompleta contra inventario objetivo.");
  if (configCompleteness < 70) warnings.push("La matriz de evidencia muestra salidas faltantes.");
  if (lifecycleData < 70) warnings.push("Datos de ciclo de vida incompletos o no consultados.");
  if (topologyConfidence < 70) warnings.push("Relaciones topologicas insuficientes para confianza alta.");
  if (record.scope.performanceAnalysis.enabled && performanceConfidence < 70) warnings.push("Performance Analysis habilitado con evidencia o confianza insuficiente.");

  return { overall, warnings };
}

function dimensionHasEvidence(record: AssessmentRecord, dimensionId: string) {
  const effectiveParsed = effectiveParsedNetworkData(record);
  if (dimensionId === "resiliency") return effectiveParsed.relations.length > 0 || record.evidenceFiles.some((file) => /spanning-tree|redundancy|vpc|etherchannel/i.test(file.content));
  if (dimensionId === "security") return record.evidenceFiles.some((file) => /running-config|access-list|snmp|aaa|transport input|crypto/i.test(file.content));
  if (dimensionId === "lifecycle") return effectiveParsed.devices.length > 0 || lifecycleProductIds(record).length > 0;
  if (dimensionId === "configuration") return record.evidenceFiles.some((file) => /running-config|startup-config/i.test(file.content));
  if (dimensionId === "operations") return effectiveParsed.interfaces.length > 0 || record.evidenceFiles.some((file) => /logging|ntp|clock|environment/i.test(file.content));
  if (dimensionId === "performance") {
    if (!record.scope.performanceAnalysis.enabled) return false;
    return record.performance.metrics.length > 0 || record.performance.evidenceFiles.length > 0;
  }
  return record.evidenceFiles.length > 0 || record.targetInventory.length > 0;
}

function rawRiskScore(risk: RiskLevel) {
  const map: Record<RiskLevel, number> = { info: 0, low: 1, medium: 3, high: 4, critical: 5 };
  return map[risk];
}

function riskScoreToRawScore(score: number) {
  if (score >= 81) return 5;
  if (score >= 61) return 4;
  if (score >= 41) return 3;
  if (score >= 21) return 2;
  if (score > 0) return 1;
  return 0;
}

function rawScoreLevel(score: number) {
  if (score >= 5) return "Critico";
  if (score >= 4) return "Muy alto";
  if (score >= 3) return "Alto";
  if (score >= 2) return "Moderado";
  if (score >= 1) return "Bajo";
  return "Sin riesgo identificado";
}

function executiveRiskLevel(score: number) {
  if (score >= 81) return "Critico";
  if (score >= 61) return "Muy alto";
  if (score >= 41) return "Alto";
  if (score >= 21) return "Moderado";
  return "Bajo";
}

function confidenceLevel(score: number) {
  if (score >= 81) return "Alto";
  if (score >= 61) return "Bueno con brechas";
  if (score >= 41) return "Limitado";
  return "Bajo";
}

function executiveLevelTone(level: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (/critico|muy alto/i.test(level)) return "danger";
  if (/alto|moderado|limitado|pendiente|insufficient/i.test(level)) return "warning";
  if (/bajo|bueno|sin riesgo/i.test(level)) return "success";
  return "info";
}

function operationsFormScore(_record: AssessmentRecord) {
  return _record.operationalAssessment.confidenceScore || 0;
}

function countBy<T>(items: T[], selector: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function executiveRecommendations(irir: number | null, ica: number, actionCounts: Record<RemediationCategory, number>) {
  const recommendations: string[] = [];
  if (ica < executiveConfidenceThreshold) recommendations.push("Completar evidencia tecnica antes de publicar conclusiones ejecutivas definitivas.");
  if (irir !== null && irir >= 61) recommendations.push("Priorizar remediaciones de alto impacto y validar plan de renovacion con arquitectura.");
  if (actionCounts.professional_services > 0) recommendations.push("Agrupar acciones de remediacion por paquetes de servicios ejecutables.");
  if (actionCounts.new_technology + actionCounts.platform_upgrade > 0) recommendations.push("Preparar roadmap preliminar para remediaciones y renovaciones tecnologicas.");
  return recommendations.length > 0 ? recommendations : ["Mantener revision arquitectonica y monitorear hallazgos de menor severidad."];
}

async function fetchLifecycleEoxRecords(productIds: string[], ciscoToken: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ciscoToken.trim()) headers["x-cisco-api-token"] = ciscoToken.trim();

  const response = await fetch("/api/cisco/eox", {
    method: "POST",
    headers,
    body: JSON.stringify({ productIds })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo consultar Cisco EoX.");

  const records = Object.fromEntries(
    ((payload.records ?? []) as LifecycleEoxRecord[]).flatMap((item) => (
      lifecycleProductIdVariants(item.productId || item.inputValue || "").map((variant) => [variant, item])
    ))
  ) as Record<string, LifecycleEoxRecord>;
  const lookupResults = Object.fromEntries(
    ((payload.lookupResults ?? []) as LifecycleEoxLookupResult[]).flatMap((item) => (
      lifecycleProductIdVariants(item.productId).map((variant) => [variant, item])
    ))
  ) as Record<string, LifecycleEoxLookupResult>;

  return {
    records,
    lookupResults,
    source: payload.source as "support-api" | "public-cisco" | undefined,
    warning: payload.warning as string | undefined
  };
}

async function fetchSupportCoverageRecords(serials: string[], ciscoToken: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ciscoToken.trim()) headers["x-cisco-api-token"] = ciscoToken.trim();

  const response = await fetch("/api/cisco/support", {
    method: "POST",
    headers,
    body: JSON.stringify({ serials })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error || "No se pudo consultar soporte Cisco.");

  const records = Object.fromEntries(
    ((payload.records ?? []) as SupportCoverageRecord[]).map((item) => [normalizeSupportSerial(item.serial), item])
  ) as Record<string, SupportCoverageRecord>;

  return { records };
}

function lifecycleProductIds(record: AssessmentRecord) {
  return Array.from(new Set([
    ...buildLifecycleHardwareRows(record, {}, []).map((row) => row.productId).filter(isKnownProductId),
    ...buildLifecycleSoftwareRows(record, {}, []).map((row) => row.softwareVersion).filter(isConsultableLifecycleKey)
  ]));
}

function supportCoverageSerials(record: AssessmentRecord) {
  return Array.from(
    new Set(
      buildSupportCoverageRows(record, {}, [])
        .map((row) => normalizeSupportSerial(row.serial))
        .filter(isKnownSerial)
    )
  );
}

function buildLifecycleHardwareRows(
  record: AssessmentRecord,
  eoxRecords: Record<string, LifecycleEoxRecord>,
  consultedProductIds: string[],
  lookupResults: Record<string, LifecycleEoxLookupResult> = {}
): LifecycleHardwareRow[] {
  const consulted = new Set(consultedProductIds.map(normalizeProductId));
  const rows: LifecycleHardwareRow[] = [];
  const lifecycleDevices = lifecycleDevicesForRecord(record);
  const parsedHostnames = new Set(lifecycleDevices.map((device) => device.hostname.toLowerCase()));

  for (const device of lifecycleDevices) {
    const inventoryItems = device.inventoryItems ?? [];
    const chassisItem = preferredChassisInventoryItem(inventoryItems);
    const isModular = isModularCiscoPlatform(device.model, inventoryItems);

    if (inventoryItems.length > 0 && isModular) {
      for (const item of inventoryItems) {
        const productKey = normalizeProductId(item.productId);
        rows.push({
          id: item.id,
          hostname: device.hostname,
          component: item.name || item.description || item.productId,
          itemType: inventoryItemTypeLabel(item.itemType),
          productId: item.productId,
          serial: item.serial,
          source: `show inventory · ${item.sourceFile}`,
          eox: lifecycleEoxRecordForProduct(productKey, eoxRecords),
          lookup: lifecycleLookupForProduct(productKey, lookupResults),
          consulted: lifecycleConsultedHas(productKey, consulted)
        });
      }
      continue;
    }

    const productId = chassisItem?.productId || device.model;
    const serial = chassisItem?.serial || device.serial;
    const productKey = normalizeProductId(productId);
    rows.push({
      id: chassisItem?.id ?? `device:${device.id}`,
      hostname: device.hostname,
      component: "Chasis",
      itemType: "Chasis",
      productId,
      serial,
      source: chassisItem ? `show inventory · fixed platform` : "show version",
      eox: lifecycleEoxRecordForProduct(productKey, eoxRecords),
      lookup: lifecycleLookupForProduct(productKey, lookupResults),
      consulted: lifecycleConsultedHas(productKey, consulted)
    });
  }

  for (const asset of record.targetInventory.filter((item) => item.included && !parsedHostnames.has(item.hostname.toLowerCase()))) {
    const productKey = normalizeProductId(asset.model);
    rows.push({
      id: `asset:${asset.id}`,
      hostname: asset.hostname,
      component: "Chasis",
      itemType: deviceTypeLabel(asset.deviceType),
      productId: asset.model,
      serial: asset.serial,
      source: "Inventario cargado",
      eox: lifecycleEoxRecordForProduct(productKey, eoxRecords),
      lookup: lifecycleLookupForProduct(productKey, lookupResults),
      consulted: lifecycleConsultedHas(productKey, consulted)
    });
  }

  return rows.sort((left, right) => left.hostname.localeCompare(right.hostname) || left.itemType.localeCompare(right.itemType) || left.productId.localeCompare(right.productId));
}

function buildLifecycleSoftwareRows(
  record: AssessmentRecord,
  eoxRecords: Record<string, LifecycleEoxRecord>,
  consultedProductIds: string[],
  lookupResults: Record<string, LifecycleEoxLookupResult> = {}
): LifecycleSoftwareRow[] {
  const consulted = new Set(consultedProductIds.map(normalizeProductId));
  const rows: LifecycleSoftwareRow[] = [];
  const lifecycleDevices = lifecycleDevicesForRecord(record);
  const parsedHostnames = new Set(lifecycleDevices.map((device) => device.hostname.toLowerCase()));

  for (const device of lifecycleDevices) {
    const inventoryItems = device.inventoryItems ?? [];
    const chassisItem = preferredChassisInventoryItem(inventoryItems);
    const productId = chassisItem?.productId || device.model || "No identificado";
    const productKey = normalizeProductId(productId);
    const softwareKey = device.softwareVersion || "No identificado";
    rows.push({
      id: `software:${device.id}:${productKey}`,
      hostname: device.hostname,
      model: device.model || chassisItem?.productId || "No identificado",
      productId,
      softwareVersion: device.softwareVersion || "No identificado",
      source: device.sourceFiles?.[0] ?? "show version",
      eox: lifecycleEoxRecordForProduct(softwareKey, eoxRecords) ?? lifecycleEoxRecordForProduct(productKey, eoxRecords),
      lookup: lifecycleLookupForProduct(softwareKey, lookupResults) ?? lifecycleLookupForProduct(productKey, lookupResults),
      consulted: lifecycleConsultedHas(softwareKey, consulted) || lifecycleConsultedHas(productKey, consulted)
    });
  }

  for (const asset of record.targetInventory.filter((item) => item.included && !parsedHostnames.has(item.hostname.toLowerCase()))) {
    const productId = asset.model || "No identificado";
    const productKey = normalizeProductId(productId);
    const softwareKey = "No identificado";
    rows.push({
      id: `software:${asset.id}:${productKey}`,
      hostname: asset.hostname,
      model: asset.model || "No identificado",
      productId,
      softwareVersion: "No identificado",
      source: "Inventario cargado",
      eox: lifecycleEoxRecordForProduct(softwareKey, eoxRecords) ?? lifecycleEoxRecordForProduct(productKey, eoxRecords),
      lookup: lifecycleLookupForProduct(softwareKey, lookupResults) ?? lifecycleLookupForProduct(productKey, lookupResults),
      consulted: lifecycleConsultedHas(softwareKey, consulted) || lifecycleConsultedHas(productKey, consulted)
    });
  }

  return rows.sort((left, right) => left.hostname.localeCompare(right.hostname) || left.productId.localeCompare(right.productId));
}

function lifecycleLookupForProduct(productId: string, lookupResults: Record<string, LifecycleEoxLookupResult>) {
  const variants = lifecycleLookupVariants(productId);
  for (const variant of variants) {
    const lookup = lookupResults[variant];
    if (lookup) return lookup;
  }
  return undefined;
}

function lifecycleEoxRecordForProduct(productId: string, eoxRecords: Record<string, LifecycleEoxRecord>) {
  return findLifecycleEoxRecord(productId, eoxRecords);
}

function lifecycleConsultedHas(productId: string, consulted: Set<string>) {
  return lifecycleLookupVariants(productId).some((variant) => consulted.has(variant));
}

const effectiveParsedCache = new WeakMap<AssessmentRecord, ParsedAssessment>();

function effectiveParsedNetworkData(record: AssessmentRecord) {
  const cached = effectiveParsedCache.get(record);
  if (cached) return cached;

  const currentParsed = record.parsed;
  if (record.evidenceFiles.length === 0) {
    effectiveParsedCache.set(record, currentParsed);
    return currentParsed;
  }

  const reparsed = parseCiscoEvidence(record.evidenceFiles);
  const currentInventoryCount = currentParsed.devices.reduce((count, device) => count + (device.inventoryItems?.length ?? 0), 0);
  const reparsedInventoryCount = reparsed.devices.reduce((count, device) => count + (device.inventoryItems?.length ?? 0), 0);
  const hasRicherNetworkData =
    reparsed.devices.length > currentParsed.devices.length ||
    reparsed.interfaces.length > currentParsed.interfaces.length ||
    reparsed.relations.length > currentParsed.relations.length ||
    reparsedInventoryCount > currentInventoryCount;

  const effectiveParsed = hasRicherNetworkData
    ? {
        ...currentParsed,
        devices: reparsed.devices,
        interfaces: reparsed.interfaces,
        relations: reparsed.relations
      }
    : currentParsed;

  effectiveParsedCache.set(record, effectiveParsed);
  return effectiveParsed;
}

function lifecycleDevicesForRecord(record: AssessmentRecord) {
  return effectiveParsedNetworkData(record).devices;
}

function buildSupportCoverageRows(
  record: AssessmentRecord,
  coverageRecords: Record<string, SupportCoverageRecord>,
  consultedSerials: string[]
): SupportCoverageRow[] {
  const consulted = new Set(consultedSerials.map(normalizeSupportSerial));
  const rows = buildLifecycleHardwareRows(record, {}, []).map((row) => {
    const serialKey = normalizeSupportSerial(row.serial);
    return {
      ...row,
      coverage: coverageRecords[serialKey],
      consulted: consulted.has(serialKey)
    };
  });
  const knownSerials = new Set(rows.map((row) => normalizeSupportSerial(row.serial)).filter(Boolean));

  for (const asset of record.targetInventory.filter((item) => item.included)) {
    const serialKey = normalizeSupportSerial(asset.serial);
    if (!serialKey || knownSerials.has(serialKey)) continue;
    rows.push({
      id: `support:${asset.id}`,
      hostname: asset.hostname,
      component: "Chasis",
      itemType: deviceTypeLabel(asset.deviceType),
      productId: asset.model,
      serial: asset.serial,
      source: "Inventario cargado",
      consulted: consulted.has(serialKey),
      coverage: coverageRecords[serialKey]
    });
    knownSerials.add(serialKey);
  }

  return rows.sort((left, right) => left.hostname.localeCompare(right.hostname) || left.itemType.localeCompare(right.itemType) || left.serial.localeCompare(right.serial));
}

function preferredChassisInventoryItem(items: NonNullable<ParsedAssessment["devices"][number]["inventoryItems"]>) {
  return (
    items.find((item) => item.itemType === "chassis") ??
    items.find((item) => /chassis|pid|switch|router|nexus|catalyst/i.test(`${item.name} ${item.description}`)) ??
    items[0]
  );
}

function isModularCiscoPlatform(model: string, items: NonNullable<ParsedAssessment["devices"][number]["inventoryItems"]>) {
  const value = normalizeProductId([model, ...items.map((item) => `${item.productId} ${item.name} ${item.description}`)].join(" "));
  if (/\b(N7K|N77|N5K-C56|WS-C65|C650|C680|C940|C960|ASR-?900|ASR9K|NCS|CRS)\b/.test(value)) return true;
  if (/\bN9K-C95(04|08|16|18)\b/.test(value)) return true;
  if (/\bN9K-C93|N9K-C92|N9K-C91|N9K-C35|N9K-C36/.test(value)) return false;
  return items.some((item) => item.itemType === "supervisor" || /supervisor|fabric module|line card/i.test(`${item.name} ${item.description}`));
}

function isKnownProductId(value: string) {
  return isConsultableCiscoProductId(value);
}

function normalizeProductId(value: string) {
  return value.trim().toUpperCase();
}

function isConsultableCiscoProductId(value: string) {
  const normalized = normalizeProductId(value);
  if (!normalized) return false;
  if (["NO IDENTIFICADO", "PENDIENTE", "N/A", "NA", "UNKNOWN", "CISCO", "PID", "CHASSIS", "MODULE"].includes(normalized)) return false;
  if (!/[0-9]/.test(normalized)) return false;
  if (normalized.length < 5) return false;
  return /^[A-Z0-9][A-Z0-9./_-]+=?$/.test(normalized);
}

function lifecycleProductIdVariants(value: string) {
  const normalized = normalizeProductId(value);
  if (!isConsultableCiscoProductId(normalized)) return [];
  const variants = new Set([normalized]);
  variants.add(normalized.replace(/=$/, ""));
  variants.add(normalized.replace(/-(E|A|S)$/i, ""));
  variants.add(normalized.replace(/\/K9=?$/i, "/K9"));
  variants.add(normalized.replace(/\/K9=?$/i, ""));
  return Array.from(variants).filter(isConsultableCiscoProductId);
}

function normalizeSupportSerial(value: string) {
  return value.trim().toUpperCase();
}

function isKnownSerial(value: string) {
  const normalized = normalizeSupportSerial(value);
  return Boolean(normalized && normalized !== "NO IDENTIFICADO" && normalized !== "PENDIENTE" && normalized !== "N/A" && normalized !== "NA" && normalized !== "UNKNOWN");
}

function inventoryItemTypeLabel(value: string) {
  const labels: Record<string, string> = {
    chassis: "Chasis",
    supervisor: "Supervisora",
    "line-card": "Tarjeta/modulo",
    "power-supply": "Fuente de poder",
    fan: "Fan",
    module: "Modulo",
    software: "Software",
    unknown: "Componente"
  };
  return labels[value] ?? value;
}

function dateOrPending(value: string | undefined, consulted: boolean) {
  if (value) return value;
  return <span className="text-muted-foreground">{consulted ? "Sin dato Cisco" : "Pendiente"}</span>;
}

function confirmAction(message: string) {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}

function rebuildPerformanceState(record: AssessmentRecord, evidenceFiles: PerformanceEvidenceFile[]) {
  if (evidenceFiles.length === 0) {
    return {
      ...record,
      parsed: {
        ...record.parsed,
        findings: record.parsed.findings.filter((finding) => !isPerformanceFindingId(finding.id))
      },
      performance: createDefaultPerformanceState(record.id, record.scope.performanceAnalysis.mode),
      updatedAt: new Date().toISOString()
    };
  }

  const mode = record.scope.performanceAnalysis.mode;
  const processed = processPerformanceEvidence(record.id, evidenceFiles, mode);
  const assessment = buildPerformanceAssessment(record.id, mode, processed.files, processed.metrics);
  const findings = generatePerformanceFindings(record.id, processed.metrics, processed.summary, mode);
  const genericFindings = performanceFindingsToGenericFindings(findings);

  return {
    ...record,
    parsed: {
      ...record.parsed,
      findings: [...record.parsed.findings.filter((finding) => !isPerformanceFindingId(finding.id)), ...genericFindings]
    },
    performance: {
      evidenceFiles: processed.files,
      metrics: processed.metrics,
      findings,
      assessment,
      charts: buildPerformanceCharts(record.id, processed.metrics)
    },
    updatedAt: new Date().toISOString()
  };
}

function softwareLifecycleAction(row: LifecycleSoftwareRow) {
  if (!row.softwareVersion || row.softwareVersion === "No identificado") {
    return "Cargar show version para extraer version de software.";
  }
  if (!row.consulted) {
    return "Consultar Cisco EoX para obtener contexto lifecycle de la version y del PID.";
  }
  if (row.eox) {
    return "Planificar upgrade validando release recomendado, compatibilidad y ventana de cambio.";
  }
  return "Validar release recomendado y ventana de upgrade contra guias Cisco.";
}

function splitCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function summarizePortfolio(records: AssessmentRecord[]) {
  return records.reduce(
    (summary, record) => {
      const effectiveParsed = effectiveParsedNetworkData(record);
      return {
        total: summary.total + 1,
        inReview: summary.inReview + (record.assessment.status === "review" ? 1 : 0),
        findings: summary.findings + record.parsed.findings.length,
        validated: summary.validated + record.parsed.findings.filter((finding) => finding.status === "validated").length,
        devices: summary.devices + effectiveParsed.devices.length
      };
    },
    { total: 0, inReview: 0, findings: 0, validated: 0, devices: 0 }
  );
}

function assessmentProgress(record: AssessmentRecord) {
  const effectiveParsed = effectiveParsedNetworkData(record);
  const checks = [
    true,
    record.assessment.domains.length > 0,
    record.scope.objectives.length > 0,
    record.targetInventory.length > 0,
    record.scope.deliverables.length > 0,
    record.evidenceFiles.length > 0,
    effectiveParsed.devices.length > 0,
    effectiveParsed.relations.length > 0,
    record.parsed.findings.some((finding) => finding.aiMetadata),
    record.parsed.findings.length > 0,
    record.parsed.findings.some((finding) => finding.status === "validated")
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function domainLabel(domain: Domain) {
  return domains.find((item) => item.id === domain)?.label ?? domain;
}

function buildRoadmap(findings: Finding[]) {
  return findings.map((finding, index) => ({
    id: uid("road"),
    quarter: `Q${(index % 4) + 1}`,
    initiative: finding.recommendation,
    remediationCategory: finding.remediationCategory,
    investmentBand: finding.risk === "critical" || finding.risk === "high" ? "high" : finding.risk === "medium" ? "medium" : "low",
    dependencies: finding.status === "validated" ? "Aprobacion tecnica" : "Validacion de arquitecto",
    linkedFindingIds: [finding.id]
  }));
}
