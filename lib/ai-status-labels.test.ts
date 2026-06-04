import assert from "node:assert/strict";
import test from "node:test";
import { humanizeScopeStatus } from "./ai-status-labels.ts";

const expectedStatuses = new Map([
  ["pending", "Pendiente"],
  ["queued", "En cola"],
  ["running", "En curso"],
  ["completed", "Completado"],
  ["complete", "Completado"],
  ["skipped", "Reutilizado"],
  ["skipped_existing_result", "Reutilizado"],
  ["partially_completed", "Parcial"],
  ["failed", "Falló"],
  ["blocked", "Bloqueado"],
  ["cancelled", "Cancelado"],
  ["error", "Error"],
  ["timeout", "Tiempo agotado"]
]);

test("humanizeScopeStatus returns Spanish labels and tooltips for known statuses", () => {
  for (const [status, label] of expectedStatuses) {
    const result = humanizeScopeStatus(status);
    assert.equal(result.label, label);
    assert.ok(result.tooltip.length > 0);
  }
});

test("humanizeScopeStatus preserves unknown status with fallback tooltip", () => {
  const result = humanizeScopeStatus("custom_status");
  assert.equal(result.label, "custom_status");
  assert.equal(result.tooltip, "Estado no reconocido.");
});
