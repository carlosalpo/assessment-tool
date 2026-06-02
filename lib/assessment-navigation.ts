export const assessmentTabItems = [
  { id: "Alcance", label: "Alcance" },
  { id: "Inventario", label: "Inventario" },
  { id: "SOW", label: "SOW" },
  { id: "Scripts", label: "Scripts" },
  { id: "Data", label: "Data" },
  { id: "Estado Actual", label: "ARQUITECTURA ACTUAL" },
  { id: "performance", label: "PERFORMANCE" },
  { id: "Evaluacion AI", label: "Evaluacion AI" },
  { id: "Hallazgos", label: "Hallazgos" },
  { id: "Vigencia", label: "Vigencia" },
  { id: "Operaciones", label: "Operaciones" },
  { id: "Roadmap", label: "Roadmap" },
  { id: "Resumen", label: "Resumen" }
] as const;

export type AssessmentTab = (typeof assessmentTabItems)[number]["id"];

export const assessmentTabs = assessmentTabItems.map((tab) => tab.id) as AssessmentTab[];

export function assessmentTabLabel(tab: AssessmentTab) {
  return assessmentTabItems.find((item) => item.id === tab)?.label ?? tab;
}
