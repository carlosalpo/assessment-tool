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
import {
  buildAIScopePacket,
  buildAssessmentKnowledgeGraph,
  EVIDENCE_TOP_K,
  getAIScopeStrategy,
  resolveMaxInputTokens,
  tierEvidenceRef,
  validateScopeAnalysisResult
} from "./ai-scope-strategy.ts";

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

test("buildAssessmentKnowledgeGraph creates stable graph nodes and edges", () => {
  const graph = buildAssessmentKnowledgeGraph(baseInput());
  assert.equal(graph.assessmentId, "assess_ai");
  assert.equal(graph.nodes.devices.length, 3);
  assert.ok(graph.nodes.configFacts.some((fact) => fact.factType === "insecure_snmp"));
  assert.ok(graph.nodes.correlations.some((candidate) => candidate.correlationType === "topology_resiliency_gap"));
  assert.ok(graph.edges.some((edge) => edge.type === "has_interface" && edge.from === "device:core-01"));
});

test("AIScope strategies define independent scope behavior", () => {
  const topology = getAIScopeStrategy("topology");
  const security = getAIScopeStrategy("security");
  const lifecycle = getAIScopeStrategy("lifecycle");
  assert.ok(topology.expectedFindings.some((item) => /puntos unicos/i.test(item)));
  assert.ok(security.primaryInputs.includes("SNMP"));
  assert.ok(lifecycle.validationRules.some((rule) => /EoX confirmado/.test(rule)));
  assert.notDeepEqual(topology.correlationTypes, security.correlationTypes);
});

test("buildAIScopePacket sends facts and citations instead of raw evidence file content", () => {
  const input = baseInput();
  input.evidenceFiles.push(evidence("raw-secret.log", "hostname raw-secret\nTHIS_SECRET_RAW_LINE_SHOULD_NOT_BE_SENT\nshow running-config\n! no matching risky fact"));
  const packet = buildAIScopePacket({ record: input, scopeId: "security", maxInputTokens: 8000 });
  const serialized = JSON.stringify(packet);
  assert.equal(serialized.includes("THIS_SECRET_RAW_LINE_SHOULD_NOT_BE_SENT"), false);
  assert.ok(packet.evidencePack.every((ref) => ref.excerpt.length <= 320));
  assert.ok(packet.graphSlice.configFacts.some((fact) => fact.factType === "insecure_snmp"));
});

test("buildAIScopePacket includes compact prior scope memory for incremental correlation", () => {
  const packet = buildAIScopePacket({
    record: baseInput(),
    scopeId: "security",
    priorScopeResults: [
      { scopeId: "topology", status: "completed", executiveSummary: "Topologia con baja redundancia.", findingsJson: [{ id: "f1" }], recommendationsJson: ["Validar redundancia"] },
      { scopeId: "lifecycle", status: "completed", executiveSummary: "No debe entrar aun.", findingsJson: [{ id: "f2" }], recommendationsJson: [] }
    ]
  });
  assert.deepEqual(packet.memory.priorScopeSummaries.map((item) => item.scopeId), ["topology"]);
  assert.equal(packet.memory.priorScopeSummaries[0].findingCount, 1);
});

test("buildAIScopePacket applies token budget by trimming evidence first", () => {
  const input = baseInput();
  for (let index = 0; index < 80; index += 1) {
    input.evidenceFiles.push(evidence(`sec-${index}.log`, `hostname sec-${index}\nsnmp-server community public RO ${index}\nline vty 0 4\n transport input telnet ssh`));
  }
  const packet = buildAIScopePacket({ record: input, scopeId: "security", maxInputTokens: 1200 });
  assert.ok(packet.budget.trimmed);
  assert.ok(packet.budget.estimatedInputTokens >= 0);
  assert.ok(packet.evidencePack.length < input.evidenceFiles.length);
});

test("tierEvidenceRef preserves fuller top evidence and compact references stay short", () => {
  const longExcerpt = `snmp-server community public RO ${"x".repeat(1800)}`;
  const full = tierEvidenceRef({ id: "full-ref", command: "show running-config", excerpt: longExcerpt }, "full");
  const compact = tierEvidenceRef({ id: "compact-ref", command: "show running-config", excerpt: longExcerpt }, "compact");

  assert.ok(full.excerpt.length > 320);
  assert.ok(full.excerpt.length <= 1202);
  assert.ok(compact.excerpt.length <= 122);
});

test("buildAIScopePacket keeps legacy 320 char evidence excerpts when evidence tiering is off", () => {
  withEnv({ AI_EVIDENCE_TIERING: undefined }, () => {
    const input = inputWithLongSecurityEvidence(18);
    const packet = buildAIScopePacket({ record: input, scopeId: "security", maxInputTokens: 50000 });

    assert.ok(packet.evidencePack.length > EVIDENCE_TOP_K);
    assert.ok(packet.evidencePack.every((ref) => ref.excerpt.length <= 322));
  });
});

test("buildAIScopePacket tiers evidence and preserves top full refs while trimming compact refs", () => {
  withEnv({ AI_EVIDENCE_TIERING: "1" }, () => {
    const input = inputWithLongSecurityEvidence(36);
    const untrimmed = buildAIScopePacket({ record: input, scopeId: "security", maxInputTokens: 200000 });
    const topFullIds = untrimmed.evidencePack.slice(0, EVIDENCE_TOP_K).map((ref) => ref.id);

    assert.ok(untrimmed.evidencePack.length > EVIDENCE_TOP_K);
    assert.ok(untrimmed.evidencePack.slice(EVIDENCE_TOP_K).every((ref) => ref.excerpt.length <= 122));

    const trimmed = buildAIScopePacket({ record: input, scopeId: "security", maxInputTokens: 1200 });
    assert.ok(trimmed.budget.trimmed);
    assert.ok(trimmed.evidencePack.length >= EVIDENCE_TOP_K);
    assert.ok(trimmed.evidencePack.length < untrimmed.evidencePack.length);
    assert.deepEqual(trimmed.evidencePack.slice(0, EVIDENCE_TOP_K).map((ref) => ref.id), topFullIds);
  });
});

test("resolveMaxInputTokens uses assessment size tiers only when evidence tiering is enabled", () => {
  withEnv({ AI_EVIDENCE_TIERING: undefined }, () => {
    assert.equal(resolveMaxInputTokens(recordWithDeviceCount(10)), 24000);
    assert.equal(resolveMaxInputTokens(recordWithDeviceCount(101)), 24000);
  });

  withEnv({ AI_EVIDENCE_TIERING: "1" }, () => {
    assert.equal(resolveMaxInputTokens(recordWithDeviceCount(10)), 16000);
    assert.equal(resolveMaxInputTokens(recordWithDeviceCount(20)), 24000);
    assert.equal(resolveMaxInputTokens(recordWithDeviceCount(101)), 32000);
    assert.equal(resolveMaxInputTokens(recordWithDeviceCount(101), 12345), 12345);
  });
});

test("validateScopeAnalysisResult rejects invented evidence, facts and correlations", () => {
  const packet = buildAIScopePacket({ record: baseInput(), scopeId: "security" });
  const result = validateScopeAnalysisResult({
    findings: [{
      finding_id: "sec_invented",
      scope: "security",
      title: "SNMP inseguro inventado",
      finding_type: "confirmed_finding",
      severity: "high",
      confidence: "high",
      evidence_refs: ["invented-ref"],
      related_fact_ids: ["cfg_invented"],
      related_metric_ids: [],
      related_correlation_ids: ["corr_invented"],
      evidence: [{ source_type: "cli", source_name: "invented", hostname: "core-01", command: "show running-config", excerpt: "invented" }],
      technical_rationale: "Inventado",
      business_impact: "Inventado",
      recommendation: "Validar",
      remediation_steps: [],
      validation_questions: [],
      related_devices: ["core-01"],
      related_sites: [],
      dependencies: []
    }]
  }, packet);
  assert.equal(result.validFindings.length, 0);
  assert.equal(result.rejectedFindings.length, 1);
  assert.match(result.rejectedFindings[0].reason, /desconocidos/);
});

test("validateScopeAnalysisResult accepts evidence-bound security findings", () => {
  const packet = buildAIScopePacket({ record: baseInput(), scopeId: "security" });
  const fact = packet.graphSlice.configFacts.find((item) => item.factType === "insecure_snmp")!;
  const result = validateScopeAnalysisResult({
    findings: [{
      finding_id: "sec_snmp_public",
      scope: "security",
      title: "SNMP comunitario inseguro",
      finding_type: "confirmed_finding",
      severity: "high",
      confidence: "high",
      evidence_refs: [fact.evidenceRef],
      related_fact_ids: [fact.id],
      related_metric_ids: [],
      related_correlation_ids: [],
      evidence: [{ source_type: "cli", source_name: fact.evidenceRef, hostname: "core-01", command: "show running-config", excerpt: "snmp-server community public RO" }],
      technical_rationale: "SNMP community public expone administracion insegura.",
      business_impact: "Aumenta riesgo de acceso no autorizado.",
      recommendation: "Migrar a SNMPv3.",
      remediation_steps: ["Eliminar comunidades inseguras"],
      validation_questions: [],
      related_devices: ["core-01"],
      related_sites: ["HQ"],
      dependencies: [],
      entity_target: "core-01",
      expected_state: "SNMPv3 o comunidades no inseguras",
      observed_state: "snmp-server community public RO",
      standard_or_control: "Management plane hardening"
    }]
  }, packet);
  assert.equal(result.validFindings.length, 1);
  assert.equal(result.rejectedFindings.length, 0);
});

test("validateScopeAnalysisResult accepts graph findings with graph extension fields", () => {
  const packet = buildAIScopePacket({ record: baseInput(), scopeId: "topology" });
  const topologyRef = packet.evidencePack.find((item) => item.relationId) ?? packet.evidencePack[0];
  const result = validateScopeAnalysisResult({
    findings: [{
      finding_id: "topology_neighbor_coverage",
      scope: "topology",
      title: "Cobertura topologica limitada entre core y distribucion",
      finding_type: "probable_issue",
      severity: "medium",
      confidence: "medium",
      evidence_refs: [topologyRef.id],
      related_fact_ids: [],
      related_metric_ids: [],
      related_correlation_ids: [],
      evidence: [{ source_type: "cli", source_name: topologyRef.id, hostname: topologyRef.deviceId ?? null, command: topologyRef.command ?? null, excerpt: topologyRef.excerpt }],
      technical_rationale: "La evidencia CDP/LLDP disponible muestra una relacion limitada que requiere validacion de redundancia.",
      business_impact: "Puede limitar la visibilidad de dependencia fisica.",
      recommendation: "Validar vecinos y redundancia declarada.",
      remediation_steps: ["Revisar CDP/LLDP y diagrama fisico"],
      validation_questions: [],
      related_devices: ["core-01", "dist-01"],
      related_sites: ["HQ"],
      dependencies: [],
      affected_relationships: ["core-01:Te1/0/1 <-> dist-01:Te1/0/1"],
      topology_basis: "Evidencia de vecinos CDP/LLDP.",
      coverage_note: "Cobertura parcial basada en evidencia disponible."
    }]
  }, packet);
  assert.equal(result.validFindings.length, 1);
  assert.equal(result.rejectedFindings.length, 0);
});

test("validateScopeAnalysisResult still rejects topology SPOF without topology evidence", () => {
  const packet = buildAIScopePacket({ record: baseInput(), scopeId: "topology" });
  const nonTopologyRef = packet.evidencePack.find((item) => !item.relationId) ?? packet.evidencePack[0];
  const result = validateScopeAnalysisResult({
    findings: [{
      finding_id: "topology_spof_without_topology_evidence",
      scope: "topology",
      title: "Equipo critico single-homed sin redundancia",
      finding_type: "probable_issue",
      severity: "high",
      confidence: "medium",
      evidence_refs: [nonTopologyRef.id],
      related_fact_ids: [],
      related_metric_ids: [],
      related_correlation_ids: [],
      evidence: [{ source_type: "inventory", source_name: nonTopologyRef.id, hostname: nonTopologyRef.deviceId ?? null, command: nonTopologyRef.command ?? null, excerpt: nonTopologyRef.excerpt }],
      technical_rationale: "El texto afirma single-homed sin apuntar a una relacion topologica.",
      business_impact: "Puede ser un punto unico de falla.",
      recommendation: "Validar fisicamente redundancia.",
      remediation_steps: ["Levantar vecinos CDP/LLDP"],
      validation_questions: [],
      related_devices: ["dist-01"],
      related_sites: ["HQ"],
      dependencies: [],
      affected_relationships: [],
      topology_basis: "Inventario solamente.",
      coverage_note: "Sin evidencia topologica relacionada."
    }]
  }, packet);
  assert.equal(result.validFindings.length, 0);
  assert.equal(result.rejectedFindings.length, 1);
  assert.match(result.rejectedFindings[0].reason, /SPOF o single-homed requiere evidencia topologica/);
});

test("validateScopeAnalysisResult accepts aggregation findings with aggregation extension fields", () => {
  const packet = buildAIScopePacket({ record: baseInput(), scopeId: "evidence" });
  const refs = packet.evidencePack.slice(0, 2);
  const result = validateScopeAnalysisResult({
    findings: [{
      finding_id: "evidence_recurrent_protocol_events",
      scope: "evidence",
      title: "Eventos recurrentes de inestabilidad de protocolo",
      finding_type: "probable_issue",
      severity: "medium",
      confidence: "medium",
      evidence_refs: refs.map((ref) => ref.id),
      related_fact_ids: [],
      related_metric_ids: [],
      related_correlation_ids: [],
      evidence: refs.map((ref) => ({ source_type: "cli", source_name: ref.id, hostname: ref.deviceId ?? null, command: ref.command ?? null, excerpt: ref.excerpt })),
      technical_rationale: "La recurrencia esta soportada por multiples evidencias del paquete.",
      business_impact: "Puede indicar inestabilidad operacional.",
      recommendation: "Correlacionar eventos por ventana y dispositivo.",
      remediation_steps: ["Revisar logs y vecinos afectados"],
      validation_questions: [],
      related_devices: ["core-01"],
      related_sites: ["HQ"],
      dependencies: [],
      aggregation_basis: "Multiples eventos observados en la evidencia disponible.",
      occurrence_count: 2,
      time_window: "snapshot",
      correlated_entity: "core-01"
    }]
  }, packet);
  assert.equal(result.validFindings.length, 1);
  assert.equal(result.rejectedFindings.length, 0);
});

test("validateScopeAnalysisResult still rejects recurrent evidence findings with fewer than two refs", () => {
  const packet = buildAIScopePacket({ record: baseInput(), scopeId: "evidence" });
  const ref = packet.evidencePack[0];
  const result = validateScopeAnalysisResult({
    findings: [{
      finding_id: "evidence_recurrent_single_ref",
      scope: "evidence",
      title: "Evento recurrente de error con una sola evidencia",
      finding_type: "probable_issue",
      severity: "medium",
      confidence: "medium",
      evidence_refs: [ref.id],
      related_fact_ids: [],
      related_metric_ids: [],
      related_correlation_ids: [],
      evidence: [{ source_type: "cli", source_name: ref.id, hostname: ref.deviceId ?? null, command: ref.command ?? null, excerpt: ref.excerpt }],
      technical_rationale: "Afirma evento recurrente aunque solo hay una evidencia.",
      business_impact: "Riesgo no soportado por recurrencia.",
      recommendation: "Validar mas logs.",
      remediation_steps: [],
      validation_questions: [],
      related_devices: ["core-01"],
      related_sites: ["HQ"],
      dependencies: [],
      aggregation_basis: "Una sola evidencia.",
      occurrence_count: 1,
      time_window: "snapshot",
      correlated_entity: "core-01"
    }]
  }, packet);
  assert.equal(result.validFindings.length, 0);
  assert.equal(result.rejectedFindings.length, 1);
  assert.match(result.rejectedFindings[0].reason, /Recurrencia en logs\/eventos requiere multiples evidencias/);
});

test("validateScopeAnalysisResult rejects high security findings backed only by inventory evidence", () => {
  const packet = buildAIScopePacket({ record: baseInput(), scopeId: "security" });
  const inventoryRef = packet.evidencePack.find((item) => !item.configFactId) ?? packet.evidencePack[0];
  const result = validateScopeAnalysisResult({
    findings: [{
      finding_id: "sec_weak_evidence",
      scope: "security",
      title: "Exposicion de protocolos inseguros",
      finding_type: "confirmed_finding",
      severity: "high",
      confidence: "medium",
      evidence_refs: [inventoryRef.id],
      related_fact_ids: [],
      related_metric_ids: [],
      related_correlation_ids: [],
      evidence: [{ source_type: "inventory", source_name: inventoryRef.id, hostname: inventoryRef.deviceId ?? null, command: inventoryRef.command ?? null, excerpt: inventoryRef.excerpt }],
      technical_rationale: "Afirma inseguridad sin evidencia de configuracion.",
      business_impact: "Riesgo no soportado.",
      recommendation: "Validar configuracion.",
      remediation_steps: [],
      validation_questions: [],
      related_devices: ["core-01"],
      related_sites: [],
      dependencies: []
    }]
  }, packet);
  assert.equal(result.validFindings.length, 0);
  assert.match(result.rejectedFindings[0].reason, /Seguridad high\/critical/);
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

function inputWithLongSecurityEvidence(count: number) {
  const input = baseInput();
  for (let index = 0; index < count; index += 1) {
    const hostname = `sec-${String(index).padStart(2, "0")}`;
    input.targetInventory.push(asset(hostname, `10.10.0.${index + 10}`, "C9300-48P", "access", "high"));
    input.parsed.devices.push(device(`dev_${hostname}`, hostname, "C9300-48P", "17.9.4"));
    input.evidenceFiles.push(evidence(`${hostname}.log`, [
      `hostname ${hostname}`,
      `snmp-server community public RO ${"security-control-gap ".repeat(90)}${index}`,
      "line vty 0 4",
      " transport input telnet ssh"
    ].join("\n")));
  }
  return input;
}

function recordWithDeviceCount(count: number) {
  const record = baseInput();
  record.targetInventory = Array.from({ length: count }, (_item, index) => asset(`dev-${index}`, `10.20.0.${index}`, "C9300-48P", "access", "medium"));
  record.parsed.devices = Array.from({ length: count }, (_item, index) => device(`dev_${index}`, `dev-${index}`, "C9300-48P", "17.9.4"));
  return record;
}

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
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
