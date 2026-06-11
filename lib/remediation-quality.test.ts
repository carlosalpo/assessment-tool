import assert from "node:assert/strict";
import test from "node:test";
import { GENERIC_REMEDIATION_VERBS, isVacuousRemediation } from "./remediation-quality.ts";

test("isVacuousRemediation flags empty short and generic recommendations", () => {
  assert.ok(GENERIC_REMEDIATION_VERBS.includes("validar"));
  assert.equal(isVacuousRemediation(""), true);
  assert.equal(isVacuousRemediation("Validar."), true);
  assert.equal(isVacuousRemediation("Revisar con el arquitecto"), true);
  assert.equal(isVacuousRemediation("verificar"), true);
  assert.equal(isVacuousRemediation("Analizar la evidencia."), true);
});

test("isVacuousRemediation accepts concrete actionable recommendations", () => {
  assert.equal(isVacuousRemediation("Reemplazar el transceiver del uplink Gi1/0/1, limpiar conectores y re-medir CRC por 24 horas."), false);
  assert.equal(isVacuousRemediation("Deshabilitar Telnet en VTY, habilitar SSHv2 y cerrar con prueba de acceso administrativo por SSH."), false);
  assert.equal(isVacuousRemediation("Configurar root guard en uplinks de acceso hacia distribucion y validar que no reciban BPDUs superiores."), false);
});
