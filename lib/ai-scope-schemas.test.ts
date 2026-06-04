import assert from "node:assert/strict";
import test from "node:test";
import {
  baseFindingSchema,
  patternForScope,
  scopeAnalysisResultSchemaForPattern,
  scopePattern,
  type ScopeQueryPattern
} from "./ai-scope-schemas.ts";
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

const baseFindingFields = [
  "finding_id",
  "scope",
  "title",
  "finding_type",
  "severity",
  "confidence",
  "evidence_refs",
  "related_fact_ids",
  "related_metric_ids",
  "related_correlation_ids",
  "evidence",
  "technical_rationale",
  "business_impact",
  "recommendation",
  "remediation_steps",
  "validation_questions",
  "related_devices",
  "related_sites",
  "dependencies"
];

const patternSpecificFields: Record<Exclude<ScopeQueryPattern, "synthesis">, string[]> = {
  graph: ["affected_relationships", "topology_basis", "coverage_note"],
  entity: ["entity_target", "expected_state", "observed_state", "standard_or_control"],
  aggregation: ["aggregation_basis", "occurrence_count", "time_window", "correlated_entity"]
};

test("scopePattern covers every AI scope exactly once", () => {
  assert.deepEqual(Object.keys(scopePattern).sort(), [...allScopes].sort());
  assert.equal(Object.keys(scopePattern).length, 16);
});

test("patternForScope returns expected representative patterns", () => {
  assert.equal(patternForScope("topology"), "graph");
  assert.equal(patternForScope("security"), "entity");
  assert.equal(patternForScope("evidence"), "aggregation");
  assert.equal(patternForScope("roadmap"), "synthesis");
});

test("baseFindingSchema keeps the current generic finding contract", () => {
  const schema = baseFindingSchema();
  assert.deepEqual(Object.keys(schema.properties).sort(), [...baseFindingFields].sort());
  assert.deepEqual(schema.required.sort(), [...baseFindingFields].sort());
});

for (const pattern of ["graph", "entity", "aggregation"] as const) {
  test(`${pattern} result schema is strict-valid recursively`, () => {
    assertStrictSchema(scopeAnalysisResultSchemaForPattern(pattern), `${pattern} result`);
  });

  test(`${pattern} finding contains base fields and pattern extension fields`, () => {
    const schema = scopeAnalysisResultSchemaForPattern(pattern);
    const findingSchema = schema.properties.findings.items;
    const expectedFields = [...baseFindingFields, ...patternSpecificFields[pattern]];
    assert.deepEqual(Object.keys(findingSchema.properties).sort(), expectedFields.sort());
    assert.deepEqual(findingSchema.required.sort(), expectedFields.sort());
  });
}

test("synthesis schema is intentionally deferred to INC-7", () => {
  assert.throws(() => scopeAnalysisResultSchemaForPattern("synthesis"), /INC-7/);
});

function assertStrictSchema(schema: any, path: string) {
  if (!schema || typeof schema !== "object") return;
  const type = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (type.includes("object")) {
    assert.equal(schema.additionalProperties, false, `${path} must set additionalProperties:false`);
    assert.ok(schema.properties && typeof schema.properties === "object", `${path} must define properties`);
    assert.deepEqual(
      [...(schema.required ?? [])].sort(),
      Object.keys(schema.properties).sort(),
      `${path} required must include every property`
    );
    for (const [key, child] of Object.entries(schema.properties)) {
      assertStrictSchema(child, `${path}.${key}`);
    }
  }
  if (type.includes("array") && schema.items) {
    assertStrictSchema(schema.items, `${path}[]`);
  }
}
