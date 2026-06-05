import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildAIScopePacket, validateScopeAnalysisResult, type AIScopeId } from "../lib/ai-scope-strategy.ts";
import { buildLifecycleFindings } from "../lib/lifecycle-analysis.ts";
import { buildOperationsFindings } from "../lib/operations-analysis.ts";
import { evalFixtures } from "./fixtures/index.ts";
import { aggregateMetrics, evaluateScope, type ScopeGolden } from "./metrics.ts";
import type { ProducedFinding } from "./matching.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const goldenDir = join(currentDir, "golden");
const stubDir = join(currentDir, "model-stubs");
const thresholds = readJson<{ aggregate: Thresholds; scopes: Record<string, Thresholds> }>(join(currentDir, "thresholds.json"));
const fixturesById = new Map(evalFixtures.map((fixture) => [fixture.id, fixture]));

type Thresholds = {
  minPrecision: number;
  minRecall: number;
  maxLeaked: number;
};

test("offline golden harness validates expected scope findings", () => {
  const reports = readdirSync(goldenDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const golden = readJson<ScopeGolden>(join(goldenDir, file));
      const fixture = fixturesById.get(golden.fixtureId);
      assert.ok(fixture, `Fixture ${golden.fixtureId} not found`);

      const packet = buildAIScopePacket({ record: fixture.record, scopeId: golden.scopeId as AIScopeId, maxInputTokens: 8000 });
      const stub = readJson<any>(join(stubDir, file));
      const validation = validateScopeAnalysisResult(stub, packet);
      const produced = dedupeProduced([
        ...validation.validFindings,
        ...deterministicFindingsFromPacket(packet),
        ...deterministicFindingsFromRecord(golden.scopeId, fixture.record)
      ]).filter((finding) => finding.scope === golden.scopeId);
      const metrics = evaluateScope(golden, produced);
      const threshold = thresholds.scopes[golden.scopeId] ?? thresholds.aggregate;

      console.log(formatReport(metrics, validation.rejectedFindings.length));
      assert.equal(metrics.missing.length, 0, `${golden.fixtureId}/${golden.scopeId} missing mustFind: ${JSON.stringify(metrics.missing)}`);
      assert.equal(metrics.leaked.length, 0, `${golden.fixtureId}/${golden.scopeId} leaked mustNotFind: ${JSON.stringify(metrics.leaked)}`);
      assert.ok(metrics.recall >= threshold.minRecall, `${golden.fixtureId}/${golden.scopeId} recall ${metrics.recall} < ${threshold.minRecall}`);
      assert.ok(metrics.precision >= threshold.minPrecision, `${golden.fixtureId}/${golden.scopeId} precision ${metrics.precision} < ${threshold.minPrecision}`);
      assert.ok(metrics.leaked.length <= threshold.maxLeaked, `${golden.fixtureId}/${golden.scopeId} leaked ${metrics.leaked.length} > ${threshold.maxLeaked}`);
      return metrics;
    });

  const aggregate = aggregateMetrics(reports);
  console.log(`aggregate precision=${pct(aggregate.precision)} recall=${pct(aggregate.recall)} coverage=${pct(aggregate.coverage)} produced=${aggregate.produced} leaked=${aggregate.leaked.length}`);
  assert.equal(aggregate.missing.length, 0, `aggregate missing mustFind: ${JSON.stringify(aggregate.missing)}`);
  assert.equal(aggregate.leaked.length, 0, `aggregate leaked mustNotFind: ${JSON.stringify(aggregate.leaked)}`);
  assert.ok(aggregate.precision >= thresholds.aggregate.minPrecision, `aggregate precision ${aggregate.precision} < ${thresholds.aggregate.minPrecision}`);
  assert.ok(aggregate.recall >= thresholds.aggregate.minRecall, `aggregate recall ${aggregate.recall} < ${thresholds.aggregate.minRecall}`);
});

function deterministicFindingsFromPacket(packet: ReturnType<typeof buildAIScopePacket>): ProducedFinding[] {
  const deterministic = packet.memory.acceptedOrDeterministicFindings.map((finding) => ({
    finding_id: finding.id,
    scope: packet.scopeId,
    title: finding.title,
    finding_type: finding.evidenceRefs.length > 0 ? "probable_issue" : "validation_required",
    severity: finding.severity === "info" ? "informational" : finding.severity,
    evidence_refs: finding.evidenceRefs,
    related_devices: finding.affectedAssets
  }));
  const correlations = packet.memory.openCorrelationCandidates.map((candidate) => ({
    finding_id: candidate.id,
    scope: packet.scopeId,
    title: candidate.title,
    finding_type: "correlation_suspicion",
    severity: candidate.severityHint === "info" ? "informational" : candidate.severityHint,
    evidence_refs: candidate.evidenceRefs,
    related_devices: candidate.involvedDevices,
    technical_rationale: candidate.description
  }));
  return [...deterministic, ...correlations];
}

function deterministicFindingsFromRecord(scopeId: string, record: any): ProducedFinding[] {
  if (scopeId === "lifecycle") {
    return buildLifecycleFindings({ devices: record?.parsed?.devices ?? [] }, record?.lifecycleEoxRecords ?? {}).map((finding) => ({
      finding_id: finding.id,
      scope: "lifecycle",
      title: finding.title,
      finding_type: finding.dates.endOfSaleDate || finding.dates.lastDateOfSupport ? "confirmed_finding" : "probable_issue",
      severity: finding.severity,
      evidence_refs: finding.evidenceRefs,
      related_devices: finding.affectedAssets,
      technical_rationale: finding.technical_rationale,
      business_impact: finding.business_impact,
      recommendation: finding.recommendation
    }));
  }
  if (scopeId === "operations") {
    return buildOperationsFindings(record?.operationalAssessment).map((finding) => ({
      finding_id: finding.id,
      scope: "operations",
      title: `${finding.dimension}: ${finding.gap}`,
      finding_type: "probable_issue",
      severity: finding.severity,
      evidence_refs: finding.evidence,
      related_devices: [],
      technical_rationale: finding.technical_rationale,
      business_impact: finding.business_impact,
      recommendation: finding.recommendation
    }));
  }
  return [];
}

function dedupeProduced(findings: ProducedFinding[]) {
  return Array.from(new Map(findings.map((finding, index) => [finding.finding_id ?? `${finding.title}-${index}`, finding])).values());
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as T;
}

function formatReport(metrics: ReturnType<typeof evaluateScope>, rejected: number) {
  return `${metrics.fixtureId}/${metrics.scopeId} precision=${pct(metrics.precision)} recall=${pct(metrics.recall)} coverage=${pct(metrics.coverage)} produced=${metrics.produced} rejected=${rejected} leaked=${metrics.leaked.length}`;
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}
