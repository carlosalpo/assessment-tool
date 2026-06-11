import assert from "node:assert/strict";
import test from "node:test";
import {
  baseFindingSchema,
  impactIfFailsEnum,
  isCoverageLedgerEnabled,
  isEnrichedFindingsEnabled,
  patternForScope,
  probabilityOfFailureEnum,
  reduceResultSchema,
  scopeAnalysisResultSchemaForPattern,
  scopePattern,
  synthesisResultSchema,
  usesPatternQuery,
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
  "remediation_category",
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

const enrichedFindingFields = ["probable_cause", "technical_impact", "probability_of_failure", "impact_if_fails"];

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

test("usesPatternQuery wires map patterns but not synthesis scopes when flag is enabled", () => {
  const original = process.env.AI_PATTERN_QUERIES;
  try {
    delete process.env.AI_PATTERN_QUERIES;
    assert.equal(usesPatternQuery("security"), false);
    process.env.AI_PATTERN_QUERIES = "";
    assert.equal(usesPatternQuery("security"), false);
    process.env.AI_PATTERN_QUERIES = "1";
    assert.equal(usesPatternQuery("security"), true);
    assert.equal(usesPatternQuery("configuration"), true);
    assert.equal(usesPatternQuery("performance"), true);
    assert.equal(usesPatternQuery("topology"), true);
    assert.equal(usesPatternQuery("high_availability"), true);
    assert.equal(usesPatternQuery("evidence"), true);
    assert.equal(usesPatternQuery("operations"), true);
    assert.equal(usesPatternQuery("roadmap"), false);
  } finally {
    if (original === undefined) {
      delete process.env.AI_PATTERN_QUERIES;
    } else {
      process.env.AI_PATTERN_QUERIES = original;
    }
  }
});

test("baseFindingSchema keeps the current generic finding contract", () => {
  withEnv({ AI_ENRICHED_FINDINGS: undefined }, () => {
    const schema = baseFindingSchema();
    assert.equal(isEnrichedFindingsEnabled(), false);
    assert.deepEqual(Object.keys(schema.properties).sort(), [...baseFindingFields].sort());
    assert.deepEqual(schema.required.sort(), [...baseFindingFields].sort());
  });
});

test("baseFindingSchema requires enriched synthesis fields only when AI_ENRICHED_FINDINGS is enabled", () => {
  withEnv({ AI_ENRICHED_FINDINGS: "1" }, () => {
    const schema = baseFindingSchema();
    assert.equal(isEnrichedFindingsEnabled(), true);
    assert.deepEqual(Object.keys(schema.properties).sort(), [...baseFindingFields, ...enrichedFindingFields].sort());
    assert.deepEqual(schema.required.sort(), [...baseFindingFields, ...enrichedFindingFields].sort());
    assert.deepEqual(schema.properties.probability_of_failure.enum, probabilityOfFailureEnum);
    assert.deepEqual(schema.properties.impact_if_fails.enum, impactIfFailsEnum);
  });
});

test("coverage ledger fields are absent from schemas when AI_COVERAGE_LEDGER is disabled", () => {
  withEnv({ AI_COVERAGE_LEDGER: undefined, AI_ENRICHED_FINDINGS: undefined }, () => {
    const findingSchema = baseFindingSchema("configuration");
    const resultSchema = scopeAnalysisResultSchemaForPattern("entity", "configuration");
    assert.equal(isCoverageLedgerEnabled(), false);
    assert.equal(findingSchema.properties.criterion_ids, undefined);
    assert.equal(resultSchema.properties.evidence_gaps, undefined);
    assert.equal(resultSchema.properties.evaluated_clean, undefined);
    assert.equal(resultSchema.properties.findings.items.properties.criterion_ids, undefined);
    assert.equal(resultSchema.required.includes("evidence_gaps"), false);
    assert.equal(resultSchema.required.includes("evaluated_clean"), false);
  });
});

test("coverage ledger fields are required only for covered scopes when AI_COVERAGE_LEDGER is enabled", () => {
  withEnv({ AI_COVERAGE_LEDGER: "1", AI_ENRICHED_FINDINGS: undefined }, () => {
    const configurationFinding = baseFindingSchema("configuration");
    const configurationResult = scopeAnalysisResultSchemaForPattern("entity", "configuration");
    const evidenceResult = scopeAnalysisResultSchemaForPattern("aggregation", "evidence");
    const performanceFinding = baseFindingSchema("performance");
    const performanceResult = scopeAnalysisResultSchemaForPattern("entity", "performance");

    assert.equal(isCoverageLedgerEnabled(), true);
    assert.ok(configurationFinding.properties.criterion_ids);
    assert.ok(configurationFinding.required.includes("criterion_ids"));
    assert.ok(configurationResult.properties.evidence_gaps);
    assert.ok(configurationResult.properties.evaluated_clean);
    assert.ok(configurationResult.required.includes("evidence_gaps"));
    assert.ok(configurationResult.required.includes("evaluated_clean"));
    assert.ok(configurationResult.properties.findings.items.properties.criterion_ids);
    assert.ok(configurationResult.properties.findings.items.required.includes("criterion_ids"));
    assert.ok(evidenceResult.properties.evidence_gaps);
    assert.ok(evidenceResult.properties.evaluated_clean);
    assert.equal(performanceFinding.properties.criterion_ids, undefined);
    assert.equal(performanceResult.properties.evidence_gaps, undefined);
    assert.equal(performanceResult.properties.evaluated_clean, undefined);
  });
});

for (const pattern of ["graph", "entity", "aggregation"] as const) {
  test(`${pattern} result schema is strict-valid recursively`, () => {
    assertStrictSchema(scopeAnalysisResultSchemaForPattern(pattern), `${pattern} result`);
  });

  test(`${pattern} finding contains base fields and pattern extension fields`, () => {
    const schema = scopeAnalysisResultSchemaForPattern(pattern);
    const findingSchema = schema.properties.findings.items;
    const expectedFields = [...baseFindingFields, ...activeEnrichedFindingFields(), ...patternSpecificFields[pattern]];
    assert.deepEqual(Object.keys(findingSchema.properties).sort(), expectedFields.sort());
    assert.deepEqual(findingSchema.required.sort(), expectedFields.sort());
  });
}

test("map pattern synthesis schema is handled by the dedicated synthesis schema", () => {
  assert.throws(() => scopeAnalysisResultSchemaForPattern("synthesis"), /synthesisResultSchema/);
});

test("reduce result schema is strict-valid and includes composite fields", () => {
  const schema = reduceResultSchema();
  assertStrictSchema(schema, "reduce result");
  const findingSchema = schema.properties.findings.items;
  const expectedFields = [...baseFindingFields, ...activeEnrichedFindingFields(), "source_finding_ids", "composite_rationale"];
  assert.deepEqual(Object.keys(findingSchema.properties).sort(), expectedFields.sort());
  assert.deepEqual(findingSchema.required.sort(), expectedFields.sort());
});

test("synthesis roadmap schema is strict-valid and requires source finding ids", () => {
  const schema = synthesisResultSchema("roadmap");
  assertStrictSchema(schema, "synthesis roadmap");
  const itemSchema = schema.properties.items.items;
  assert.ok(itemSchema.properties.source_finding_ids);
  assert.ok(itemSchema.properties.remediation_category);
  assert.ok(itemSchema.required.includes("source_finding_ids"));
  assert.ok(itemSchema.required.includes("remediation_category"));
});

test("synthesis executive summary schema is strict-valid and requires source finding ids", () => {
  const schema = synthesisResultSchema("executive_summary");
  assertStrictSchema(schema, "synthesis executive summary");
  const riskSchema = schema.properties.top_risks.items;
  assert.ok(riskSchema.properties.source_finding_ids);
  assert.ok(riskSchema.properties.remediation_category);
  assert.ok(riskSchema.required.includes("source_finding_ids"));
  assert.ok(riskSchema.required.includes("remediation_category"));
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

function activeEnrichedFindingFields() {
  return isEnrichedFindingsEnabled() ? enrichedFindingFields : [];
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
