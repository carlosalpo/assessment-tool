import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptedOrValidatedFindings,
  aiSuggestedFindingToFinding,
  buildAssessmentAIContext,
  executiveSummaryFindings,
  generateCorrelationCandidates,
  validateAISuggestedFinding,
  validateAIOutputSchema,
  type AISuggestedFinding,
  type AssessmentAIContextInput
} from "./ai-analysis.ts";

const baseInput = (): AssessmentAIContextInput => ({
  id: "assess_ai",
  client: { id: "client_1", name: "PseudoCo", industry: "Finance", owner: "Arquitectura", createdAt: "2026-06-01" },
  assessment: { id: "assess_ai", clientId: "client_1", name: "AI Context Test", domains: ["enterprise-networking"], status: "review", createdAt: "2026-06-01" },
  scope: { performanceAnalysis: { enabled: true, mode: "snapshot" } },
  targetInventory: [
    asset("core-01", "10.0.0.1", "C9500-48Y4C", "core", "critical"),
    asset("dist-01", "10.0.1.1", "C9300-48P", "distribution", "critical"),
    asset("core-02", "10.0.0.2", "WS-C6509-E", "core", "critical")
  ],
  evidenceFiles: [
    evidence("core-01.log", [
      "hostname core-01",
      "snmp-server community public RO",
      "line vty 0 15",
      " transport input telnet ssh",
      "Group  Port-channel  Protocol    Ports",
      "10     Po10(SD)        LACP      Te1/0/1(I) Te1/0/2(s)",
      "%OSPF-5-ADJCHG: Process 10, Nbr 10.0.1.1 on Te1/0/1 from FULL to DOWN, Neighbor Down",
      "%EC-5-CANNOT_BUNDLE2: Te1/0/2 is not compatible with Te1/0/1"
    ].join("\n")),
    evidence("dist-01.log", "hostname dist-01\nshow cdp neighbors detail\nDevice ID: core-01\nInterface: Te1/0/1,  Port ID (outgoing port): Te1/0/1"),
    evidence("core-02.log", "hostname core-02\ncore-02 uptime is 5 years\nCisco IOS Software, Version 15.1(2)SY8")
  ],
  parsed: {
    devices: [
      device("dev_core01", "core-01", "C9500-48Y4C", "17.9.4"),
      device("dev_dist01", "dist-01", "C9300-48P", "17.6.5"),
      device("dev_core02", "core-02", "WS-C6509-E", "15.1(2)SY8")
    ],
    interfaces: [
      { id: "if_1", deviceId: "dev_core01", hostname: "core-01", name: "Te1/0/1", status: "connected", vlan: "trunk", description: "to_dist", evidence: ["Te1/0/1 to dist connected trunk"] },
      { id: "if_2", deviceId: "dev_core01", hostname: "core-01", name: "Te1/0/2", status: "suspended", vlan: "trunk", description: "po member", evidence: ["Te1/0/2 suspended"] }
    ],
    relations: [
      { id: "rel_1", localDeviceId: "dev_core01", localHostname: "core-01", localInterface: "Te1/0/1", remoteHostname: "dist-01", remoteInterface: "Te1/0/1", protocol: "cdp", confidence: 0.92, evidence: ["Device ID: dist-01 Interface: Te1/0/1"] }
    ],
    findings: [
      { id: "find_det_1", title: "Comunidad SNMP publica configurada", category: "security", risk: "high", confidence: 0.9, status: "ai-draft", affectedAssets: ["core-01"], evidence: ["snmp-server community public RO"], recommendation: "Migrar a SNMPv3", remediationType: "service", serviceOffer: "Hardening" }
    ]
  },
  performance: {
    evidenceFiles: [],
    metrics: [
      metric("pm_crc", "core-01", "Te1/0/1", "crc_errors", 12, "count"),
      metric("pm_inerr", "core-01", "Te1/0/1", "input_errors", 42, "count"),
      metric("pm_drop", "core-01", "Te1/0/1", "drops", 25, "count"),
      metric("pm_util", "core-01", "Te1/0/1", "utilization", 91, "%"),
      metric("pm_cpu_core02", "core-02", undefined, "cpu", 88, "%")
    ],
    findings: [],
    charts: [],
    assessment: {
      id: "perf_assess_ai",
      assessmentId: "assess_ai",
      status: "processed",
      analysisMode: "snapshot",
      dataCoverageScore: 50,
      performanceRiskScore: 90,
      confidenceScore: 65,
      summary: "Snapshot con sintomas.",
      criticalSymptoms: [],
      visibilityGaps: [],
      topMetrics: [],
      recommendedActions: [],
      limitations: ["Analisis basado solo en snapshot; no permite confirmar recurrencia."],
      updatedAt: "2026-06-01"
    }
  },
  operationalAssessment: undefined,
  lifecycleEoxRecords: {
    "WS-C6509-E": { endOfSaleDate: "2020-10-30", lastDateOfSupport: "2025-10-31" }
  },
  lifecycleConsultedProductIds: ["WS-C6509-E"]
});

test("buildAssessmentAIContext normalizes core assessment data", () => {
  const context = buildAssessmentAIContext(baseInput());
  assert.equal(context.assessmentId, "assess_ai");
  assert.equal(context.devices.length, 3);
  assert.ok(context.configurationFacts.some((fact) => fact.factType === "insecure_snmp"));
  assert.ok(context.operationalStateFacts.some((fact) => fact.factType === "port_channel_degraded"));
  assert.equal(context.performanceMetrics.length, 5);
  assert.ok(context.evidenceReferences.some((ref) => ref.sourceFile === "core-01.log" && ref.command === "show running-config" && ref.deviceId === "core-01"));
  assert.ok(context.evidenceReferences.some((ref) => ref.metricId === "pm_crc" && ref.command === "show interfaces" && ref.interfaceId === "Te1/0/1"));
});

test("critical uplink with errors generates config_performance_mismatch", () => {
  const candidates = generateCorrelationCandidates(buildAssessmentAIContext(baseInput()));
  assert.ok(candidates.some((candidate) => candidate.correlationType === "config_performance_mismatch" && candidate.involvedMetrics.includes("pm_crc")));
});

test("single-homed critical device generates topology_resiliency_gap", () => {
  const candidates = generateCorrelationCandidates(buildAssessmentAIContext(baseInput()));
  assert.ok(candidates.some((candidate) => candidate.correlationType === "topology_resiliency_gap" && candidate.involvedDevices.includes("dist-01")));
});

test("port-channel degraded generates config_state_mismatch", () => {
  const candidates = generateCorrelationCandidates(buildAssessmentAIContext(baseInput()));
  assert.ok(candidates.some((candidate) => candidate.correlationType === "config_state_mismatch"));
});

test("routing instability with physical errors generates protocol_instability", () => {
  const candidates = generateCorrelationCandidates(buildAssessmentAIContext(baseInput()));
  assert.ok(candidates.some((candidate) => candidate.correlationType === "protocol_instability"));
});

test("high utilization without history generates capacity_risk", () => {
  const candidates = generateCorrelationCandidates(buildAssessmentAIContext(baseInput()));
  assert.ok(candidates.some((candidate) => candidate.correlationType === "capacity_risk" && candidate.involvedMetrics.includes("pm_util")));
});

test("critical device with lifecycle risk and performance symptoms generates lifecycle_risk_amplifier", () => {
  const candidates = generateCorrelationCandidates(buildAssessmentAIContext(baseInput()));
  assert.ok(candidates.some((candidate) => candidate.correlationType === "lifecycle_risk_amplifier" && candidate.involvedDevices.includes("core-02")));
});

test("lack of monitoring for critical assets generates operational_visibility_gap", () => {
  const input = baseInput();
  input.performance.metrics = [];
  const candidates = generateCorrelationCandidates(buildAssessmentAIContext(input));
  assert.ok(candidates.some((candidate) => candidate.correlationType === "operational_visibility_gap"));
});

test("validateAISuggestedFinding rejects confirmed finding without evidence", () => {
  const result = validateAISuggestedFinding(aiFinding({ findingType: "confirmed_finding", evidenceRefs: [], confidence: 92 }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /evidenceRefs/.test(error)));
});

test("validateAISuggestedFinding rejects invented evidence references", () => {
  const context = buildAssessmentAIContext(baseInput());
  const result = validateAISuggestedFinding(
    aiFinding({ evidenceRefs: ["invented evidence ref"], relatedMetrics: ["pm_crc"] }),
    context,
    generateCorrelationCandidates(context)
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /evidenceRefs no existen/.test(error)));
});

test("validateAISuggestedFinding rejects invented correlation references", () => {
  const context = buildAssessmentAIContext(baseInput());
  const metric = context.performanceMetrics.find((item) => item.id === "pm_crc")!;
  const result = validateAISuggestedFinding(
    aiFinding({ evidenceRefs: [metric.evidenceRef], relatedMetrics: ["pm_crc"], relatedCorrelationCandidates: ["corr_invented"] }),
    context,
    generateCorrelationCandidates(context)
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /relatedCorrelationCandidates/.test(error)));
});

test("validateAISuggestedFinding rejects snapshot metrics described as historical trend", () => {
  const context = buildAssessmentAIContext(baseInput());
  const metric = context.performanceMetrics.find((item) => item.id === "pm_util")!;
  const result = validateAISuggestedFinding(
    aiFinding({
      title: "Tendencia historica de saturacion",
      description: "El enlace muestra recurrencia historica de saturacion.",
      findingType: "probable_issue",
      evidenceRefs: [metric.evidenceRef],
      relatedMetrics: ["pm_util"]
    }),
    context
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /snapshot/.test(error)));
});

test("validateAISuggestedFinding rejects confirmed findings based only on snapshot metrics", () => {
  const context = buildAssessmentAIContext(baseInput());
  const metric = context.performanceMetrics.find((item) => item.id === "pm_util")!;
  const result = validateAISuggestedFinding(
    aiFinding({
      findingType: "confirmed_finding",
      confidence: 90,
      evidenceRefs: [metric.evidenceRef],
      relatedMetrics: ["pm_util"]
    }),
    context
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /Metricas snapshot/.test(error)));
});

test("AI output schema validation returns errors for unsafe saturation claim", () => {
  const result = validateAIOutputSchema([aiFinding({ title: "Saturacion critica", description: "saturation", relatedMetrics: [] })]);
  assert.equal(result[0].valid, false);
});

test("executive summary excludes discarded AI findings and only includes accepted/validated", () => {
  const accepted = aiSuggestedFindingToFinding(aiFinding({ id: "aif_accepted", status: "accepted", evidenceRefs: ["e1"] }));
  const discarded = aiSuggestedFindingToFinding(aiFinding({ id: "aif_discarded", status: "discarded", evidenceRefs: ["e2"] }));
  const validated = { ...accepted, id: "find_validated", status: "validated" as const, aiMetadata: undefined };
  assert.deepEqual(executiveSummaryFindings([accepted, discarded, validated]).map((finding) => finding.id), ["aif_accepted", "find_validated"]);
});

test("risk consumers include accepted/edited/validated AI findings only", () => {
  const accepted = aiSuggestedFindingToFinding(aiFinding({ id: "aif_accepted", status: "accepted", evidenceRefs: ["e1"] }));
  const suggested = aiSuggestedFindingToFinding(aiFinding({ id: "aif_suggested", status: "ai_suggested", evidenceRefs: ["e2"] }));
  const edited = aiSuggestedFindingToFinding(aiFinding({ id: "aif_edited", status: "edited", evidenceRefs: ["e3"] }));
  assert.deepEqual(acceptedOrValidatedFindings([accepted, suggested, edited]).map((finding) => finding.id), ["aif_accepted", "aif_edited"]);
});

function asset(hostname: string, ip: string, model: string, role: string, priority: "low" | "medium" | "high" | "critical") {
  return { id: `asset_${hostname}`, hostname, managementIp: ip, serial: `SN-${hostname}`, model, deviceType: "switch", platform: "ios-xe", role, site: "HQ", priority, included: true };
}

function evidence(name: string, content: string) {
  return { id: `ev_${name}`, name, type: "log" as const, content, uploadedAt: "2026-06-01" };
}

function device(id: string, hostname: string, model: string, softwareVersion: string) {
  return { id, hostname, model, serial: `SN-${hostname}`, softwareVersion, suggestedRole: "core", sourceFiles: [`${hostname}.log`], evidence: [`${hostname} evidence`] };
}

function metric(id: string, deviceId: string, interfaceId: string | undefined, metricType: any, value: number, unit: string) {
  return {
    id,
    assessmentId: "assess_ai",
    deviceId,
    interfaceId,
    metricType,
    value,
    unit,
    sampleType: "snapshot" as const,
    timeWindow: "instant" as const,
    source: `${deviceId}.log`,
    evidenceFileId: `ev_${deviceId}`,
    confidence: 0.7
  };
}

function aiFinding(patch: Partial<AISuggestedFinding> = {}): AISuggestedFinding {
  return {
    id: "aif_test",
    assessmentId: "assess_ai",
    title: "Hallazgo AI",
    description: "Descripcion",
    findingType: "probable_issue",
    domain: "performance",
    severity: "high",
    confidence: 80,
    evidenceRefs: ["evidence"],
    relatedDevices: ["core-01"],
    relatedInterfaces: ["Te1/0/1"],
    relatedMetrics: ["pm_util"],
    relatedConfigFacts: [],
    relatedStateFacts: [],
    relatedCorrelationCandidates: [],
    businessImpact: "Impacto potencial",
    technicalImpact: "Impacto tecnico",
    probableCause: "Causa probable",
    recommendation: "Validar y corregir",
    remediationType: "service",
    validationQuestions: ["Confirmar ventana"],
    limitations: [],
    status: "ai_suggested",
    ...patch
  };
}
