import assert from "node:assert/strict";
import test from "node:test";
import { deriveFindingRisk } from "./finding-risk.ts";

test("deriveFindingRisk maps probability and impact to risk matrix severity", () => {
  assert.equal(deriveFindingRisk("very_likely", "severe"), "critical");
  assert.equal(deriveFindingRisk("likely", "moderate"), "high");
  assert.equal(deriveFindingRisk("possible", "moderate"), "medium");
  assert.equal(deriveFindingRisk("unlikely", "minor"), "low");
  assert.equal(deriveFindingRisk("very_unlikely", "negligible"), "info");
});
