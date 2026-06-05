import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTopologyDesignGuidelines,
  resolveDesignGuidelines,
  topologyDesignGuidelineGlobalScopeKey,
  type TopologyDesignGuidelineRecord
} from "./ai-design-guidelines.ts";

test("resolveDesignGuidelines prefers assessment override over global and default", () => {
  const records: TopologyDesignGuidelineRecord[] = [
    { scopeKey: topologyDesignGuidelineGlobalScopeKey, content: "Global topology rubric", updatedBy: "admin@example.com", updatedAt: "2026-06-01T00:00:00.000Z" },
    { scopeKey: "assess_1", content: "Assessment topology rubric", updatedBy: "lead@example.com", updatedAt: "2026-06-02T00:00:00.000Z" }
  ];

  const resolved = resolveDesignGuidelines("assess_1", records);

  assert.equal(resolved.content, "Assessment topology rubric");
  assert.equal(resolved.source, "assessment");
  assert.equal(resolved.sourceScopeKey, "assess_1");
  assert.equal(resolved.updatedBy, "lead@example.com");
});

test("resolveDesignGuidelines falls back to global when assessment override is absent or empty", () => {
  const records: TopologyDesignGuidelineRecord[] = [
    { scopeKey: topologyDesignGuidelineGlobalScopeKey, content: "Global topology rubric" },
    { scopeKey: "assess_1", content: "   " }
  ];

  const resolved = resolveDesignGuidelines("assess_1", records);

  assert.equal(resolved.content, "Global topology rubric");
  assert.equal(resolved.source, "global");
  assert.equal(resolved.sourceScopeKey, topologyDesignGuidelineGlobalScopeKey);
});

test("resolveDesignGuidelines treats global scope as global source", () => {
  const resolved = resolveDesignGuidelines(topologyDesignGuidelineGlobalScopeKey, [
    { scopeKey: topologyDesignGuidelineGlobalScopeKey, content: "Global topology rubric" }
  ]);

  assert.equal(resolved.content, "Global topology rubric");
  assert.equal(resolved.source, "global");
  assert.equal(resolved.sourceScopeKey, topologyDesignGuidelineGlobalScopeKey);
});

test("resolveDesignGuidelines falls back to default seed when no usable records exist", () => {
  const resolved = resolveDesignGuidelines("assess_1", [
    { scopeKey: topologyDesignGuidelineGlobalScopeKey, content: "" }
  ]);

  assert.equal(resolved.content, defaultTopologyDesignGuidelines);
  assert.equal(resolved.source, "default");
  assert.equal(resolved.sourceScopeKey, topologyDesignGuidelineGlobalScopeKey);
});
