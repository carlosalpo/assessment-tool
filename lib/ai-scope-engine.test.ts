import assert from "node:assert/strict";
import test from "node:test";
import { engineForScope, scopeEngine } from "./ai-scope-engine.ts";
import type { AIScopeId } from "./ai-scope-strategy.ts";

const allScopes: AIScopeId[] = [
  "inventory",
  "configuration",
  "lifecycle",
  "topology",
  "routing",
  "performance",
  "security",
  "high_availability",
  "datacenter",
  "campus",
  "wan",
  "perimeter",
  "operations",
  "evidence",
  "roadmap",
  "executive_summary"
];

test("scopeEngine covers exactly the 16 AI scopes", () => {
  assert.deepEqual(Object.keys(scopeEngine).sort(), [...allScopes].sort());
  assert.equal(Object.keys(scopeEngine).length, allScopes.length);
});

test("engineForScope returns the authoritative engine classes", () => {
  assert.equal(engineForScope("topology"), "ai-design");
  assert.equal(engineForScope("high_availability"), "ai-design");

  assert.equal(engineForScope("configuration"), "ai-per-device");
  assert.equal(engineForScope("security"), "ai-per-device");
  assert.equal(engineForScope("evidence"), "ai-per-device");
  assert.equal(engineForScope("performance"), "ai-per-device");

  assert.equal(engineForScope("lifecycle"), "deterministic-narrate");
  assert.equal(engineForScope("operations"), "deterministic-narrate");

  assert.equal(engineForScope("roadmap"), "synthesis");
  assert.equal(engineForScope("executive_summary"), "synthesis");
});
