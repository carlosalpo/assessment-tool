import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { assessmentTabItems, assessmentTabLabel, assessmentTabs } from "./assessment-navigation.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(resolve(currentDir, "../app/page.tsx"), "utf8");

test("assessment main tabs expose architecture and performance in the expected flow", () => {
  assert.equal(assessmentTabs.includes("INVERSION" as never), false);
  assert.equal(assessmentTabs[5], "Estado Actual");
  assert.equal(assessmentTabLabel(assessmentTabs[5]), "ARQUITECTURA ACTUAL");
  assert.equal(assessmentTabs[6], "performance");
  assert.equal(assessmentTabLabel(assessmentTabs[6]), "PERFORMANCE");
  assert.equal(assessmentTabs[7], "Evaluacion AI");
});

test("tab labels are separated from stable internal ids", () => {
  assert.deepEqual(assessmentTabItems[5], { id: "Estado Actual", label: "ARQUITECTURA ACTUAL" });
  assert.deepEqual(assessmentTabItems[6], { id: "performance", label: "PERFORMANCE" });
});

test("architecture tab no longer renders performance as an internal subtab", () => {
  const architectureStart = pageSource.indexOf("function ArchitectureCurrentTab");
  const performanceStart = pageSource.indexOf("function PerformanceTab");
  const architectureSource = pageSource.slice(architectureStart, performanceStart);

  assert.ok(architectureStart > -1);
  assert.ok(performanceStart > architectureStart);
  assert.match(architectureSource, /<TopologyTab record=\{record\} \/>/);
  assert.doesNotMatch(architectureSource, /Performance/);
});

test("performance renders as a standalone main tab", () => {
  assert.match(pageSource, /activeTab === "performance"/);
  assert.match(pageSource, /<PerformanceTab\s+record=\{record\}/);
});
