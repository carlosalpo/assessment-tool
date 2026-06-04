import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopeBrief,
  getAIScopeStrategy,
  getPromptVersion,
  summarizePriorScopeResults
} from "./ai-scope-strategy.ts";
import { buildScopeSystemPrompt, hashScopeInput } from "./ai-analysis-jobs.ts";

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

test("buildScopeSystemPrompt keeps the base prompt unless an entity or graph pattern query is wired", () => {
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
    assert.match(entityPrompt, /evidencia_refs existentes/);
    assert.equal(buildScopeSystemPrompt("evidence"), baseSystemPrompt());
    const graphPrompt = buildScopeSystemPrompt("topology");
    assert.notEqual(graphPrompt, baseSystemPrompt());
    assert.match(graphPrompt, /Razona de forma relacional sobre el grafo de topologia/);
    assert.match(graphPrompt, /affected_relationships/);
    assert.match(graphPrompt, /No afirmes SPOF ni single-homed sin evidencia topologica relacionada/);
    assert.match(graphPrompt, /No inventes equipos, rutas, conexiones ni vulnerabilidades/);
  });
});

test("hashScopeInput changes only for wired entity and graph scopes when AI_PATTERN_QUERIES is enabled", () => {
  const record = minimalRecord("assess_pattern_hash");

  withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: undefined }, () => {
    const securityOff = hashScopeInput(record, "security");
    const topologyOff = hashScopeInput(record, "topology");
    const evidenceOff = hashScopeInput(record, "evidence");
    withEnv({ AI_SCOPE_BRIEF: undefined, AI_PATTERN_QUERIES: "1" }, () => {
      assert.notEqual(hashScopeInput(record, "security"), securityOff);
      assert.notEqual(hashScopeInput(record, "topology"), topologyOff);
      assert.equal(hashScopeInput(record, "evidence"), evidenceOff);
    });
  });
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
    "Todo hallazgo debe tener evidencia_refs existentes en AIScopePacket.evidencePack o debe clasificarse como visibility_gap/validation_required.",
    "Respeta la estrategia, tipos de hallazgo y reglas de validacion especificas del ambito.",
    "Si la evidencia es insuficiente, usa validation_required o visibility_gap en vez de inferir.",
    "Prompt version: assessment-ai-prompts-v1. Engine version: ai-analysis-engine-v2."
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
