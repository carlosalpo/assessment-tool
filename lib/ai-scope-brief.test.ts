import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopeBrief,
  getAIScopeStrategy,
  getPromptVersion,
  summarizePriorScopeResults
} from "./ai-scope-strategy.ts";
import { hashScopeInput } from "./ai-analysis-jobs.ts";

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
