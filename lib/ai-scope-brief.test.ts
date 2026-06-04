import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopeBrief,
  getAIScopeStrategy,
  getPromptVersion,
  summarizePriorScopeResults
} from "./ai-scope-strategy.ts";
import {
  buildReduceDigest,
  buildSynthesisDigest,
  buildScopeSystemPrompt,
  hashScopeInput,
  isReduceStageEnabled,
  isSynthesisStageEnabled,
  mergeScopePartitionResults,
  validateReduceResult,
  validateSynthesisResult
} from "./ai-analysis-jobs.ts";

test("buildScopeBrief caps top findings, sorts by severity and confidence, and extracts questions", () => {
  const brief = buildScopeBrief([
    finding("low-1", "low", "high", "probable_issue", ["low question"]),
    finding("high-1", "high", "low", "probable_issue", ["high low confidence"]),
    finding("critical-1", "critical", "low", "confirmed_finding", ["critical question"]),
    finding("medium-1", "medium", "high", "probable_issue", []),
    finding("high-2", "high", "high", "validation_required", ["high high confidence"]),
    finding("info-1", "informational", "high", "visibility_gap", [])
  ], "security", "Seguridad");

  assert.equal(brief.scopeId, "security");
  assert.equal(brief.scopeLabel, "Seguridad");
  assert.deepEqual(brief.topFindings.map((item) => item.finding_id), ["critical-1", "high-2", "high-1", "medium-1", "low-1"]);
  assert.equal(brief.topFindings.length, 5);
  assert.equal(brief.topFindings[0].rationale, "First sentence for critical-1.");
  assert.ok(brief.openQuestions.includes("critical question"));
  assert.ok(brief.openQuestions.includes("high high confidence"));
  assert.ok(brief.openQuestions.includes("Finding high-2"));
  assert.equal(brief.openQuestions.length <= 5, true);
});

test("summarizePriorScopeResults propagates scopeBrief content and falls back to summary counts", () => {
  const securityStrategy = getAIScopeStrategy("security");
  const summaries = summarizePriorScopeResults([
    {
      scopeId: "topology",
      status: "completed",
      executiveSummary: "Topology canned summary",
      findingsJson: [{ finding_id: "topo-1" }],
      recommendationsJson: ["Fix topology"],
      resultJson: {
        scopeBrief: {
          topFindings: [{ finding_id: "topo-1", title: "Single homed core", severity: "high" }],
          openQuestions: ["Confirm uplink inventory"]
        }
      }
    },
    {
      scopeId: "configuration",
      status: "completed",
      resultJson: {
        executiveSummary: "Configuration fallback summary",
        findings: [{ finding_id: "cfg-1" }, { finding_id: "cfg-2" }],
        recommendations: ["Fix SNMP"]
      }
    },
    {
      scopeId: "lifecycle",
      status: "completed",
      resultJson: { executiveSummary: "Unwanted prior scope" }
    }
  ], securityStrategy);

  assert.deepEqual(summaries.map((summary) => summary.scopeId), ["topology", "configuration"]);
  assert.deepEqual(summaries[0].topFindings?.map((finding: { finding_id: string }) => finding.finding_id), ["topo-1"]);
  assert.deepEqual(summaries[0].openQuestions, ["Confirm uplink inventory"]);
  assert.equal(summaries[1].executiveSummary, "Configuration fallback summary");
  assert.equal(summaries[1].findingCount, 2);
  assert.equal(summaries[1].recommendationCount, 1);
  assert.equal("topFindings" in summaries[1], false);
});

test("getPromptVersion switches only when AI_SCOPE_BRIEF is enabled", () => {
  const original = process.env.AI_SCOPE_BRIEF;
  try {
    delete process.env.AI_SCOPE_BRIEF;
    assert.equal(getPromptVersion(), "assessment-ai-prompts-v1");
    process.env.AI_SCOPE_BRIEF = "";
    assert.equal(getPromptVersion(), "assessment-ai-prompts-v1");
    process.env.AI_SCOPE_BRIEF = "1";
    assert.equal(getPromptVersion(), "assessment-ai-prompts-v2");
  } finally {
    if (original === undefined) {
      delete process.env.AI_SCOPE_BRIEF;
    } else {
      process.env.AI_SCOPE_BRIEF = original;
    }
  }
});

test("hashScopeInput changes when AI_SCOPE_BRIEF changes the effective prompt version", () => {
  const original = process.env.AI_SCOPE_BRIEF;
  const record = {
    id: "assess_hash",
    client: { id: "client_hash", name: "HashCo", industry: "Network", owner: "Arquitectura", createdAt: "2026-06-01" },
    assessment: { id: "assess_hash", clientId: "client_hash", name: "Hash Test", domains: ["enterprise-networking"], status: "review", createdAt: "2026-06-01" },
    scope: { performanceAnalysis: { enabled: false, mode: "snapshot" } },
    targetInventory: [],
    evidenceFiles: [],
    parsed: {},
    performance: {}
  };

  try {
    delete process.env.AI_SCOPE_BRIEF;
    const offHash = hashScopeInput(record, "security");
    process.env.AI_SCOPE_BRIEF = "1";
    const onHash = hashScopeInput(record, "security");
    assert.notEqual(onHash, offHash);
  } finally {
    if (original === undefined) {
      delete process.env.AI_SCOPE_BRIEF;
    } else {
      process.env.AI_SCOPE_BRIEF = original;
    }
  }
});

test("buildScopeSystemPrompt keeps the base prompt unless a map pattern query is wired", () => {
  withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: undefined }, () => {
    assert.equal(buildScopeSystemPrompt("security"), baseSystemPrompt());
  });
  withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: "1" }, () => {
    const entityPrompt = buildScopeSystemPrompt("security");
    assert.notEqual(entityPrompt, baseSystemPrompt());
    assert.match(entityPrompt, /Razona por equipo\/grupo contra el estandar\/control esperado/);
    assert.match(entityPrompt, /entity_target/);
    assert.match(entityPrompt, /No inventes equipos, rutas, conexiones ni vulnerabilidades/);
    assert.match(entityPrompt, /Usa solo el AIScopePacket provisto/);
    assert.match(entityPrompt, /evidence_refs existentes/);
    assert.equal(buildScopeSystemPrompt("roadmap"), baseSystemPrompt());
    const graphPrompt = buildScopeSystemPrompt("topology");
    assert.notEqual(graphPrompt, baseSystemPrompt());
    assert.match(graphPrompt, /Razona de forma relacional sobre el grafo de topologia/);
    assert.match(graphPrompt, /affected_relationships/);
    assert.match(graphPrompt, /No afirmes SPOF ni single-homed sin evidencia topologica relacionada/);
    assert.match(graphPrompt, /No inventes equipos, rutas, conexiones ni vulnerabilidades/);
    const aggregationPrompt = buildScopeSystemPrompt("evidence");
    assert.notEqual(aggregationPrompt, baseSystemPrompt());
    assert.match(aggregationPrompt, /Razona por agregacion temporal\/recurrencia o por ausencia/);
    assert.match(aggregationPrompt, /aggregation_basis/);
    assert.match(aggregationPrompt, /occurrence_count/);
    assert.match(aggregationPrompt, /No marques 'recurrente' con una sola evidencia/);
    assert.match(aggregationPrompt, /No inventes equipos, rutas, conexiones ni vulnerabilidades/);
  });
});

test("hashScopeInput changes for entity graph and aggregation but not synthesis scopes when AI_PATTERN_QUERIES is enabled", () => {
  const record = minimalRecord("assess_pattern_hash");

  withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: undefined }, () => {
    const securityOff = hashScopeInput(record, "security");
    const topologyOff = hashScopeInput(record, "topology");
    const evidenceOff = hashScopeInput(record, "evidence");
    const roadmapOff = hashScopeInput(record, "roadmap");
    withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: "1" }, () => {
      assert.notEqual(hashScopeInput(record, "security"), securityOff);
      assert.notEqual(hashScopeInput(record, "topology"), topologyOff);
      assert.notEqual(hashScopeInput(record, "evidence"), evidenceOff);
      assert.equal(hashScopeInput(record, "roadmap"), roadmapOff);
    });
  });
});

test("hashScopeInput changes when AI_EVIDENCE_TIERING is enabled", () => {
  const record = minimalRecord("assess_evidence_tiering_hash");

  withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: undefined, AI_EVIDENCE_TIERING: undefined }, () => {
    const offHash = hashScopeInput(record, "security");
    withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: undefined, AI_EVIDENCE_TIERING: "1" }, () => {
      assert.notEqual(hashScopeInput(record, "security"), offHash);
    });
    withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: undefined, AI_EVIDENCE_TIERING: "" }, () => {
      assert.equal(hashScopeInput(record, "security"), offHash);
    });
  });
});

test("hashScopeInput changes when AI_DOMAIN_PARTITION is enabled", () => {
  const record = minimalRecord("assess_domain_partition_hash");

  withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: undefined, AI_EVIDENCE_TIERING: undefined, AI_DOMAIN_PARTITION: undefined }, () => {
    const offHash = hashScopeInput(record, "security");
    withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: undefined, AI_EVIDENCE_TIERING: undefined, AI_DOMAIN_PARTITION: "1" }, () => {
      assert.notEqual(hashScopeInput(record, "security"), offHash);
    });
    withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: undefined, AI_EVIDENCE_TIERING: undefined, AI_DOMAIN_PARTITION: "" }, () => {
      assert.equal(hashScopeInput(record, "security"), offHash);
    });
  });
});

test("mergeScopePartitionResults dedupes findings and is stable when inputs are reordered", () => {
  const partitions = [
    { id: "site-a-01", deviceHostnames: ["core-01"] },
    { id: "site-b-01", deviceHostnames: ["core-02"] }
  ];
  const resultA = {
    partitionId: "site-a-01",
    pattern: "entity",
    findings: [
      scopeFinding({ finding_id: "low-dup", title: "SNMP inseguro", severity: "medium", confidence: "low", related_devices: ["core-01"] }),
      scopeFinding({ finding_id: "unique-a", title: "Telnet habilitado", severity: "high", confidence: "medium", related_devices: ["core-01"] })
    ],
    recommendations: ["Migrar a SNMPv3", "Deshabilitar Telnet"],
    limitations: ["site-a limitation"]
  };
  const resultB = {
    partitionId: "site-b-01",
    pattern: "entity",
    findings: [
      scopeFinding({ finding_id: "high-dup", title: "SNMP inseguro", severity: "high", confidence: "high", related_devices: ["core-01"] }),
      scopeFinding({ finding_id: "unique-b", title: "HTTP habilitado", severity: "medium", confidence: "medium", related_devices: ["core-02"] })
    ],
    recommendations: ["Migrar a SNMPv3", "Deshabilitar HTTP"],
    limitations: ["site-b limitation"]
  };

  const merged = mergeScopePartitionResults("security", [resultB, resultA], partitions);
  const reordered = mergeScopePartitionResults("security", [resultA, resultB], [...partitions].reverse());

  assert.deepEqual(merged.findings, reordered.findings);
  assert.deepEqual(merged.recommendations, ["Migrar a SNMPv3", "Deshabilitar Telnet", "Deshabilitar HTTP"]);
  assert.equal(merged.partitions, 2);
  assert.deepEqual(merged.partitionIds, ["site-a-01", "site-b-01"]);
  assert.ok(merged.limitations.includes("merged from 2 partitions"));
  assert.equal(merged.findings.find((finding: any) => finding.title === "SNMP inseguro")?.finding_id, "high-dup");
});

test("isReduceStageEnabled toggles only with AI_REDUCE_STAGE=1", () => {
  withEnv({ AI_REDUCE_STAGE: undefined }, () => {
    assert.equal(isReduceStageEnabled(), false);
  });
  withEnv({ AI_REDUCE_STAGE: "" }, () => {
    assert.equal(isReduceStageEnabled(), false);
  });
  withEnv({ AI_REDUCE_STAGE: "1" }, () => {
    assert.equal(isReduceStageEnabled(), true);
  });
});

test("buildReduceDigest builds a stable scoped finding catalog and caps by severity", () => {
  const digest = buildReduceDigest([
    reduceScopeResult("security", [
      ...Array.from({ length: 10 }, (_item, index) => scopeFinding({
        finding_id: `sec-${index}`,
        title: `Security ${index}`,
        severity: index === 9 ? "critical" : index % 2 === 0 ? "high" : "low",
        confidence: "medium",
        related_devices: [`core-${index}`]
      }))
    ]),
    reduceScopeResult("topology", [
      scopeFinding({ finding_id: "topo-1", title: "Single homed", severity: "high", related_devices: ["core-9"] })
    ]),
    reduceScopeResult("roadmap", [
      scopeFinding({ finding_id: "roadmap-1", title: "Ignored synthesis", severity: "critical" })
    ]),
    reduceScopeResult("cross_scope_correlation", [
      scopeFinding({ finding_id: "reduce-1", title: "Ignored reduce", severity: "critical" })
    ])
  ]);

  assert.equal(digest.digestVersion, "ai-reduce-digest-v1");
  assert.deepEqual(Object.keys(digest.catalog).sort(), ["security", "topology"]);
  assert.equal(digest.catalog.security.length, 8);
  assert.equal(digest.catalog.security[0], "sec-9");
  assert.deepEqual(digest.catalog.topology, ["topo-1"]);
  assert.equal(digest.findings.some((finding) => finding.scope === "roadmap"), false);
});

test("validateReduceResult enforces real sources from at least two scopes and known devices", () => {
  const digest = buildReduceDigest([
    reduceScopeResult("security", [
      scopeFinding({ finding_id: "sec-1", title: "SNMP insecure", related_devices: ["core-01"] })
    ]),
    reduceScopeResult("topology", [
      scopeFinding({ finding_id: "topo-1", title: "Single homed", related_devices: ["core-01"] })
    ])
  ]);

  const accepted = validateReduceResult({
    findings: [
      compositeFinding({
        finding_id: "cmp-1",
        related_devices: ["core-01"],
        source_finding_ids: [
          { scope: "security", finding_id: "sec-1" },
          { scope: "topology", finding_id: "topo-1" }
        ]
      })
    ]
  }, digest);
  assert.equal(accepted.validFindings.length, 1);
  assert.equal(accepted.rejected.length, 0);

  const invalid = validateReduceResult({
    findings: [
      compositeFinding({
        finding_id: "missing-source",
        source_finding_ids: [
          { scope: "security", finding_id: "sec-missing" },
          { scope: "topology", finding_id: "topo-1" }
        ]
      }),
      compositeFinding({
        finding_id: "one-scope",
        source_finding_ids: [
          { scope: "security", finding_id: "sec-1" },
          { scope: "security", finding_id: "sec-1" }
        ]
      }),
      compositeFinding({
        finding_id: "unknown-device",
        related_devices: ["core-99"],
        source_finding_ids: [
          { scope: "security", finding_id: "sec-1" },
          { scope: "topology", finding_id: "topo-1" }
        ]
      })
    ]
  }, digest);

  assert.equal(invalid.validFindings.length, 0);
  assert.equal(invalid.rejected.length, 3);
  assert.match(invalid.rejected[0].reason, /inexistentes/);
  assert.match(invalid.rejected[1].reason, /2 scopes distintos/);
  assert.match(invalid.rejected[2].reason, /related_devices/);
});

test("isSynthesisStageEnabled toggles only with AI_SYNTHESIS_STAGE=1", () => {
  withEnv({ AI_SYNTHESIS_STAGE: undefined }, () => {
    assert.equal(isSynthesisStageEnabled(), false);
  });
  withEnv({ AI_SYNTHESIS_STAGE: "" }, () => {
    assert.equal(isSynthesisStageEnabled(), false);
  });
  withEnv({ AI_SYNTHESIS_STAGE: "1" }, () => {
    assert.equal(isSynthesisStageEnabled(), true);
  });
});

test("buildSynthesisDigest includes reduce composites and excludes synthesis scopes", () => {
  const digest = buildSynthesisDigest([
    reduceScopeResult("security", [
      scopeFinding({ finding_id: "sec-1", title: "SNMP insecure", severity: "high" })
    ]),
    reduceScopeResult("cross_scope_correlation", [
      scopeFinding({ finding_id: "cmp-1", scope: "cross_scope_correlation", title: "Compound risk", severity: "critical" })
    ]),
    reduceScopeResult("roadmap", [
      scopeFinding({ finding_id: "roadmap-1", title: "Ignored roadmap", severity: "critical" })
    ]),
    reduceScopeResult("executive_summary", [
      scopeFinding({ finding_id: "summary-1", title: "Ignored summary", severity: "critical" })
    ])
  ]);

  assert.equal(digest.digestVersion, "ai-synthesis-digest-v1");
  assert.deepEqual(Object.keys(digest.catalog).sort(), ["cross_scope_correlation", "security"]);
  assert.deepEqual(digest.catalog.cross_scope_correlation, ["cmp-1"]);
  assert.equal(digest.findings.some((finding) => finding.scope === "roadmap"), false);
  assert.equal(digest.findings.some((finding) => finding.scope === "executive_summary"), false);
});

test("validateSynthesisResult accepts real citations and rejects invented sources", () => {
  const digest = buildSynthesisDigest([
    reduceScopeResult("security", [
      scopeFinding({ finding_id: "sec-1", title: "SNMP insecure", severity: "high" })
    ]),
    reduceScopeResult("cross_scope_correlation", [
      scopeFinding({ finding_id: "cmp-1", scope: "cross_scope_correlation", title: "Compound risk", severity: "critical" })
    ])
  ]);

  const roadmap = validateSynthesisResult({
    items: [
      roadmapItem({ item_id: "rm-1", source_finding_ids: [{ scope: "cross_scope_correlation", finding_id: "cmp-1" }] }),
      roadmapItem({ item_id: "rm-bad", source_finding_ids: [{ scope: "security", finding_id: "missing" }] })
    ]
  }, digest, "roadmap");
  assert.equal(roadmap.valid.length, 1);
  assert.equal(roadmap.rejected.length, 1);
  assert.match(roadmap.rejected[0].reason, /inexistentes/);

  const summary = validateSynthesisResult({
    top_risks: [
      topRisk({ title: "Compound risk", source_finding_ids: [{ scope: "security", finding_id: "sec-1" }] }),
      topRisk({ title: "Invented risk", source_finding_ids: [] })
    ]
  }, digest, "executive_summary");
  assert.equal(summary.valid.length, 1);
  assert.equal(summary.rejected.length, 1);
  assert.match(summary.rejected[0].reason, /Debe citar/);
});

function finding(id: string, severity: string, confidence: string, findingType: string, validationQuestions: string[]) {
  return {
    finding_id: id,
    title: `Finding ${id}`,
    severity,
    confidence,
    finding_type: findingType,
    related_devices: [`device-${id}`],
    evidence_refs: [`evidence-${id}`],
    technical_rationale: `First sentence for ${id}. Second sentence should not appear in rationale.`,
    validation_questions: validationQuestions
  };
}

function scopeFinding(patch: Record<string, unknown>) {
  return {
    finding_id: "finding",
    scope: "security",
    title: "Finding",
    finding_type: "probable_issue",
    severity: "medium",
    confidence: "medium",
    evidence_refs: [],
    related_fact_ids: [],
    related_metric_ids: [],
    related_correlation_ids: [],
    evidence: [],
    technical_rationale: "Rationale",
    business_impact: "Impact",
    recommendation: "Recommendation",
    remediation_steps: [],
    validation_questions: [],
    related_devices: [],
    related_sites: [],
    dependencies: [],
    ...patch
  };
}

function compositeFinding(patch: Record<string, unknown>) {
  return {
    ...scopeFinding({
      finding_id: "composite",
      scope: "cross_scope_correlation",
      title: "Riesgo compuesto",
      related_devices: ["core-01"],
      source_finding_ids: [],
      composite_rationale: "Correlaciona hallazgos de multiples scopes.",
      ...patch
    })
  };
}

function reduceScopeResult(scopeId: string, findingsJson: any[]) {
  return {
    assessmentId: "assess_reduce",
    scopeId,
    status: "completed",
    findingsJson,
    recommendationsJson: [],
    resultJson: {}
  };
}

function roadmapItem(patch: Record<string, unknown>) {
  return {
    item_id: "rm",
    title: "Hardening",
    priority: "P1",
    severity: "high",
    effort: "medium",
    recommendation: "Remediar",
    source_finding_ids: [],
    dependencies: [],
    ...patch
  };
}

function topRisk(patch: Record<string, unknown>) {
  return {
    title: "Riesgo",
    severity: "high",
    source_finding_ids: [],
    ...patch
  };
}

function minimalRecord(id: string) {
  return {
    id,
    client: { id: `${id}_client`, name: "HashCo", industry: "Network", owner: "Arquitectura", createdAt: "2026-06-01" },
    assessment: { id, clientId: `${id}_client`, name: "Hash Test", domains: ["enterprise-networking"], status: "review", createdAt: "2026-06-01" },
    scope: { performanceAnalysis: { enabled: false, mode: "snapshot" } },
    targetInventory: [],
    evidenceFiles: [],
    parsed: {},
    performance: {}
  };
}

function baseSystemPrompt() {
  return [
    "Eres un arquitecto senior Cisco ejecutando una fase incremental de assessment.",
    "No inventes equipos, rutas, conexiones ni vulnerabilidades.",
    "Usa solo el AIScopePacket provisto. No uses conocimiento externo para completar datos faltantes.",
    "Todo hallazgo debe tener evidence_refs existentes en AIScopePacket.fullEvidenceRefIds o debe clasificarse como visibility_gap/validation_required.",
    "Respeta la estrategia, tipos de hallazgo y reglas de validacion especificas del ambito.",
    "Si la evidencia es insuficiente, usa validation_required o visibility_gap en vez de inferir.",
    "Prompt version: assessment-ai-prompts-v1. Engine version: ai-analysis-engine-v3."
  ].join("\n");
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
