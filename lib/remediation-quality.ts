export const GENERIC_REMEDIATION_VERBS = [
  "validar",
  "revisar",
  "verificar",
  "evaluar",
  "monitorear",
  "analizar",
  "confirmar",
  "considerar"
] as const;

const genericRemediationPattern = new RegExp(
  `^(?:${GENERIC_REMEDIATION_VERBS.join("|")})(?:\\s+(?:con\\s+el\\s+arquitecto|el\\s+caso|la\\s+evidencia|los\\s+datos|la\\s+configuracion|la\\s+configuración))?\\.?$`,
  "i"
);

export function isVacuousRemediation(text: unknown): boolean {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (normalized.length < 40) return true;
  return genericRemediationPattern.test(normalized);
}

export function isWeakRemediationStep(text: unknown): boolean {
  return isVacuousRemediation(text);
}
