import JSZip from "jszip";

export type DocumentType = "sow" | "findings_report";
export type DocumentTemplateStatus = "draft" | "validation_failed" | "valid" | "active" | "archived";
export type DocumentContentType =
  | "text"
  | "rich_text"
  | "table"
  | "list"
  | "image"
  | "chart_image"
  | "repeated_block"
  | "conditional_block";

export type DocumentTemplateBlock = {
  id: string;
  documentType: DocumentType;
  blockKey: string;
  blockName: string;
  description: string;
  required: boolean;
  order: number;
  placeholderStart?: string;
  placeholderEnd?: string;
  supportedContentTypes: DocumentContentType[];
  dataSourcePath: string;
  fallbackText: string;
  versionIntroduced: string;
};

export type DocumentPlaceholder = {
  id: string;
  documentType: DocumentType;
  key: string;
  label: string;
  description: string;
  placeholderSyntax: string;
  required: boolean;
  blockKey: string;
  contentType: DocumentContentType;
  dataSourcePath: string;
  sampleValue: string;
  validationRule?: string;
  versionIntroduced: string;
};

export type DocumentTemplateDefinition = {
  id: string;
  documentType: DocumentType;
  name: string;
  description: string;
  version: string;
  requiredBlocks: DocumentTemplateBlock[];
  optionalBlocks: DocumentTemplateBlock[];
  placeholders: DocumentPlaceholder[];
  repeatableSections: string[];
  conditionalSections: string[];
  createdAt: string;
  updatedAt: string;
};

export type TemplateValidationResult = {
  isValid: boolean;
  documentType: DocumentType;
  definitionVersion: string;
  foundPlaceholders: string[];
  missingRequiredPlaceholders: string[];
  missingOptionalPlaceholders: string[];
  unknownPlaceholders: string[];
  warnings: string[];
  errors: string[];
  canActivate: boolean;
  validatedAt: string;
  packageChecks: {
    isDocxPackage: boolean;
    hasMainDocument: boolean;
    checkedParts: string[];
  };
};

export type DocumentTemplateAuditEvent = {
  id: string;
  action: "uploaded" | "validated" | "activated" | "archived";
  actor: string;
  at: string;
  notes: string;
  definitionVersion: string;
};

export type DocumentTemplateVersion = {
  id: string;
  documentType: DocumentType;
  templateName: string;
  templateVersion: string;
  templateFileName: string;
  templateFileDataUrl: string;
  uploadedBy: string;
  uploadedAt: string;
  status: DocumentTemplateStatus;
  validationResult: TemplateValidationResult;
  missingRequiredPlaceholders: string[];
  extraPlaceholders: string[];
  compatibleDefinitionVersion: string;
  notes: string;
  activatedAt?: string;
  activatedBy?: string;
  auditTrail?: DocumentTemplateAuditEvent[];
};

export type TemplateCompatibilityResult = {
  currentDefinitionVersion: string;
  templateDefinitionVersion: string;
  newRequiredPlaceholders: string[];
  newOptionalPlaceholders: string[];
  deprecatedPlaceholders: string[];
  compatibilityStatus: "compatible" | "compatible_with_warnings" | "incompatible";
};

export const documentTypeLabels: Record<DocumentType, string> = {
  sow: "SOW",
  findings_report: "Hallazgos y Resumen Ejecutivo"
};

const createdAt = "2026-06-01T00:00:00.000Z";
const conditionalBlockDisabled = "__DOCX_CONDITIONAL_BLOCK_DISABLED__";

const globalPlaceholders = [
  placeholder("global-client-name", "client.name", "Cliente", "Nombre legal o comercial del cliente.", true, "cover_page", "client.name", "GBM Cliente"),
  placeholder("global-client-industry", "client.industry", "Industria", "Industria o vertical del cliente.", false, "client_information", "client.industry", "Banca"),
  placeholder("global-assessment-name", "assessment.name", "Assessment", "Nombre del assessment tecnico.", true, "cover_page", "assessment.name", "Assessment Enterprise Networking"),
  placeholder("global-assessment-date", "assessment.date", "Fecha de assessment", "Fecha de referencia del assessment.", true, "document_control", "assessment.date", "2026-06-01"),
  placeholder("global-prepared-by", "assessment.preparedBy", "Preparado por", "Arquitecto o responsable del documento.", true, "document_control", "assessment.preparedBy", "Arquitecto GBM"),
  placeholder("global-company-name", "company.name", "Compania", "Nombre del integrador o empresa que emite el documento.", true, "document_control", "company.name", "GBM"),
  placeholder("global-document-version", "document.version", "Version documento", "Version editable del documento generado.", true, "document_control", "document.version", "v1.0"),
  placeholder("global-generated-date", "document.generatedDate", "Fecha generacion", "Fecha en que la aplicacion genero el documento.", true, "document_control", "document.generatedDate", "2026-06-01")
];

const sowBlocks = [
  block("sow", "cover_page", "Portada", "Identidad del documento, cliente y assessment.", true, 1, ["text", "image"]),
  block("sow", "document_control", "Control del documento", "Version, fecha y responsable.", true, 2, ["table", "text"]),
  block("sow", "client_information", "Informacion del cliente", "Datos generales del cliente.", true, 3, ["table", "text"]),
  block("sow", "project_summary", "Resumen del proyecto", "Contexto y objetivo del SOW.", true, 4, ["rich_text"]),
  block("sow", "service_objectives", "Objetivos del servicio", "Objetivos acordados para el assessment.", true, 5, ["list"]),
  block("sow", "scope_included", "Alcance incluido", "Elementos incluidos en la evaluacion.", true, 6, ["list", "table"]),
  block("sow", "scope_excluded", "Alcance excluido", "Elementos expresamente fuera de alcance.", true, 7, ["list"]),
  block("sow", "methodology", "Metodologia", "Fases y enfoque de levantamiento.", true, 8, ["rich_text", "list"]),
  block("sow", "performance_analysis", "Performance Analysis", "Alcance, modo y evidencia esperada de performance.", false, 9, ["rich_text", "table"]),
  block("sow", "required_information", "Informacion requerida", "Evidencias y datos que debe entregar el cliente.", true, 9, ["table"]),
  block("sow", "activities_by_phase", "Actividades por fase", "Actividades del servicio organizadas por fase.", true, 10, ["table"]),
  block("sow", "deliverables", "Entregables", "Entregables esperados del servicio.", true, 11, ["list"]),
  block("sow", "responsibilities_integrator", "Responsabilidades GBM", "Responsabilidades del integrador.", true, 12, ["list"]),
  block("sow", "responsibilities_client", "Responsabilidades cliente", "Responsabilidades del cliente.", true, 13, ["list"]),
  block("sow", "assumptions", "Supuestos", "Supuestos contractuales y tecnicos.", true, 14, ["list"]),
  block("sow", "restrictions", "Restricciones", "Restricciones, dependencias y ventanas.", false, 15, ["list"]),
  block("sow", "estimated_timeline", "Cronograma estimado", "Tiempo estimado por fase.", true, 16, ["table"]),
  block("sow", "work_team", "Equipo de trabajo", "Roles participantes.", false, 17, ["table"]),
  block("sow", "acceptance_criteria", "Criterios de aceptacion", "Condiciones para aceptar el servicio.", true, 18, ["list"]),
  block("sow", "annexes", "Anexos", "Anexos de referencia.", false, 19, ["rich_text"])
];

const findingsBlocks = [
  block("findings_report", "cover_page", "Portada", "Identidad del documento, cliente y assessment.", true, 1, ["text", "image"]),
  block("findings_report", "executive_letter", "Carta ejecutiva", "Mensaje ejecutivo inicial.", false, 2, ["rich_text"]),
  block("findings_report", "table_of_contents", "Tabla de contenido", "Indice editable del documento.", false, 3, ["text"]),
  block("findings_report", "executive_summary", "Resumen ejecutivo", "Resumen consolidado del assessment.", true, 4, ["rich_text"]),
  block("findings_report", "risk_index_summary", "Indice de riesgo", "IRIR y principales drivers.", true, 5, ["table", "chart_image"]),
  block("findings_report", "confidence_index_summary", "Indice de confianza", "ICA y completitud de evidencia.", true, 6, ["table"]),
  block("findings_report", "assessment_scope", "Alcance evaluado", "Dominios, sitios y equipos incluidos.", true, 7, ["table", "list"]),
  block("findings_report", "methodology_summary", "Metodologia", "Criterios y forma de evaluacion.", true, 8, ["rich_text"]),
  block("findings_report", "key_findings_summary", "Hallazgos clave", "Principales hallazgos agrupados.", true, 9, ["table"]),
  block("findings_report", "risk_heatmap", "Mapa de riesgo", "Matriz de riesgo y probabilidad.", true, 10, ["table", "chart_image"]),
  block("findings_report", "domain_scorecards", "Scorecards por dominio", "Resumen por ambito evaluado.", false, 11, ["table", "repeated_block"]),
  block("findings_report", "critical_high_findings", "Criticos y altos", "Resumen de hallazgos mas relevantes.", true, 12, ["table"]),
  block("findings_report", "detailed_findings", "Detalle de hallazgos", "Bloque repetible con evidencia y recomendacion.", true, 13, ["repeated_block"]),
  block("findings_report", "findings_matrix", "Matriz de hallazgos", "Tabla completa exportable.", true, 14, ["table"]),
  block("findings_report", "operational_assessment_summary", "Evaluacion operacional", "Madurez, riesgos y brechas de operacion.", false, 15, ["rich_text", "table"]),
  block("findings_report", "performance_assessment_summary", "Performance Analysis", "Riesgo, confianza, metricas y brechas de performance.", false, 15.5, ["rich_text", "table", "chart_image"]),
  block("findings_report", "remediation_plan", "Plan de remediacion", "Acciones recomendadas.", true, 16, ["table"]),
  block("findings_report", "investment_roadmap", "Roadmap de inversion", "Iniciativas e inversiones requeridas.", false, 17, ["table"]),
  block("findings_report", "roadmap_phases", "Fases del roadmap", "Secuencia de ejecucion.", false, 18, ["table"]),
  block("findings_report", "next_steps", "Siguientes pasos", "Acciones inmediatas.", true, 19, ["list"]),
  block("findings_report", "evidence_inventory", "Inventario de evidencia", "Evidencia usada como sustento.", true, 20, ["table"]),
  block("findings_report", "annexes", "Anexos", "Datos detallados y referencias.", false, 21, ["rich_text"])
];

const sowPlaceholders = [
  placeholder("sow-project-summary", "sow.projectSummary", "Resumen del proyecto", "Contexto del assessment y necesidad del cliente.", true, "project_summary", "scope.businessContext", "Resumen del proyecto"),
  placeholder("sow-objectives", "sow.objectives", "Objetivos", "Lista de objetivos del servicio.", true, "service_objectives", "scope.objectives", "Objetivo 1; Objetivo 2", "list"),
  placeholder("sow-scope-included", "sow.scope.included", "Alcance incluido", "Dominios, sitios y equipos incluidos.", true, "scope_included", "scope.included", "Enterprise Networking"),
  placeholder("sow-scope-excluded", "sow.scope.excluded", "Alcance excluido", "Exclusiones acordadas.", true, "scope_excluded", "scope.excluded", "Implementacion de cambios"),
  placeholder("sow-methodology", "sow.methodology", "Metodologia", "Metodologia de ejecucion.", true, "methodology", "sow.methodology", "Levantamiento, analisis, hallazgos y roadmap."),
  placeholder("sow-performance-if-start", "#if sow.performance.enabled", "Inicio performance SOW", "Bloque condicional para Performance Analysis en SOW.", false, "performance_analysis", "scope.performanceAnalysis.enabled", "", "conditional_block"),
  placeholder("sow-performance-enabled", "sow.performance.enabled", "Performance incluido", "Indica si Performance Analysis forma parte del alcance.", false, "performance_analysis", "scope.performanceAnalysis.enabled", "Incluido"),
  placeholder("sow-performance-mode", "sow.performance.mode", "Modo performance", "Snapshot, historico o hibrido.", false, "performance_analysis", "scope.performanceAnalysis.mode", "hybrid"),
  placeholder("sow-performance-scope", "sow.performance.scope", "Alcance performance", "Resumen de evidencia, metricas y restricciones de performance.", false, "performance_analysis", "scope.performanceAnalysis", "Analisis de utilizacion, errores y capacidad."),
  placeholder("sow-performance-if-end", "/if", "Fin performance SOW", "Fin del bloque condicional de Performance Analysis en SOW.", false, "performance_analysis", "scope.performanceAnalysis.enabled", "", "conditional_block"),
  placeholder("sow-required-information", "sow.requiredInformation", "Informacion requerida", "Checklist de evidencias requeridas.", true, "required_information", "evidence.requirements", "Tabla de requerimientos", "table"),
  placeholder("sow-activities-by-phase", "sow.activitiesByPhase", "Actividades por fase", "Actividades del servicio por fase.", true, "activities_by_phase", "sow.activitiesByPhase", "Tabla de actividades", "table"),
  placeholder("sow-deliverables", "sow.deliverables", "Entregables", "Entregables esperados.", true, "deliverables", "scope.deliverables", "Matriz de hallazgos", "list"),
  placeholder("sow-assumptions", "sow.assumptions", "Supuestos", "Supuestos de ejecucion.", true, "assumptions", "sow.assumptions", "Cliente provee accesos y evidencias.", "list"),
  placeholder("sow-timeline", "sow.timeline", "Cronograma", "Cronograma estimado.", true, "estimated_timeline", "sow.timeline", "2 a 4 semanas", "table"),
  placeholder("sow-acceptance", "sow.acceptanceCriteria", "Criterios de aceptacion", "Criterios de cierre.", true, "acceptance_criteria", "sow.acceptanceCriteria", "Entregables revisados por cliente.", "list"),
  placeholder("sow-inventory", "sow.inventoryTable", "Inventario objetivo", "Equipos incluidos para evaluar.", false, "annexes", "targetInventory", "Tabla de inventario", "table")
];

const findingsPlaceholders = [
  placeholder("findings-executive-summary", "executive.summary", "Resumen ejecutivo", "Resumen ejecutivo consolidado.", true, "executive_summary", "executiveSummary", "Resumen ejecutivo del assessment."),
  placeholder("findings-irir-score", "risk.irirScore", "IRIR score", "Indice de riesgo integral.", true, "risk_index_summary", "executive.irir", "72"),
  placeholder("findings-irir-level", "risk.irirLevel", "IRIR nivel", "Nivel cualitativo de riesgo.", true, "risk_index_summary", "executive.irirLevel", "Alto"),
  placeholder("findings-ica-score", "risk.icaScore", "ICA score", "Indice de confianza del analisis.", true, "confidence_index_summary", "executive.ica", "84"),
  placeholder("findings-ica-level", "risk.icaLevel", "ICA nivel", "Nivel cualitativo de confianza.", true, "confidence_index_summary", "executive.icaLevel", "Suficiente"),
  placeholder("findings-top-risks", "risk.topRisks", "Top riesgos", "Riesgos principales priorizados.", true, "key_findings_summary", "executive.topFindings", "Riesgo 1; Riesgo 2", "list"),
  placeholder("findings-critical-high", "findings.criticalHighSummary", "Criticos y altos", "Resumen de hallazgos criticos y altos.", true, "critical_high_findings", "findings.criticalHigh", "Tabla de hallazgos", "table"),
  placeholder("findings-detail-start", "#findings", "Inicio hallazgos", "Inicio de bloque repetible de hallazgos.", true, "detailed_findings", "findings", "", "repeated_block"),
  placeholder("finding-id", "finding.id", "ID hallazgo", "Identificador del hallazgo.", true, "detailed_findings", "finding.id", "F-ABC12"),
  placeholder("finding-title", "finding.title", "Titulo hallazgo", "Titulo del hallazgo.", true, "detailed_findings", "finding.title", "Configuracion inconsistente"),
  placeholder("finding-severity", "finding.severity", "Severidad", "Severidad o impacto del hallazgo.", true, "detailed_findings", "finding.severity", "Significant"),
  placeholder("finding-probability", "finding.probability", "Probabilidad", "Probabilidad de ocurrencia.", true, "detailed_findings", "finding.probability", "Likely"),
  placeholder("finding-evidence", "finding.evidence", "Evidencia", "Evidencia asociada al hallazgo.", true, "detailed_findings", "finding.evidence", "show running-config"),
  placeholder("finding-recommendation", "finding.recommendation", "Recomendacion", "Recomendacion tecnica.", true, "detailed_findings", "finding.recommendation", "Normalizar baseline"),
  placeholder("findings-detail-end", "/findings", "Fin hallazgos", "Fin de bloque repetible de hallazgos.", true, "detailed_findings", "findings", "", "repeated_block"),
  placeholder("findings-matrix", "findings.matrix", "Matriz de hallazgos", "Matriz completa de hallazgos.", true, "findings_matrix", "findings.matrix", "Tabla completa", "table"),
  placeholder("operations-if-start", "#if operations.enabled", "Inicio operaciones", "Bloque condicional para operaciones.", false, "operational_assessment_summary", "operations.enabled", "", "conditional_block"),
  placeholder("operations-summary", "operations.summary", "Resumen operacional", "Resumen de madurez operacional.", false, "operational_assessment_summary", "operations.summary", "Madurez operacional actual."),
  placeholder("operations-if-end", "/if", "Fin operaciones", "Fin del bloque condicional.", false, "operational_assessment_summary", "operations.enabled", "", "conditional_block"),
  placeholder("performance-if-start", "#if performance.enabled", "Inicio performance", "Bloque condicional para performance.", false, "performance_assessment_summary", "performance.enabled", "", "conditional_block"),
  placeholder("performance-summary", "performance.summary", "Resumen performance", "Resumen ejecutivo de performance.", false, "performance_assessment_summary", "performance.summary", "Riesgo de performance y brechas de visibilidad."),
  placeholder("performance-score", "performance.score", "Score performance", "Riesgo de performance calculado.", false, "performance_assessment_summary", "performance.performanceRiskScore", "58/100"),
  placeholder("performance-confidence", "performance.confidence", "Confianza performance", "Confianza de la evaluacion de performance.", false, "performance_assessment_summary", "performance.confidenceScore", "72%"),
  placeholder("performance-top-metrics", "performance.topMetrics", "Metricas performance", "Metricas criticas de performance.", false, "performance_assessment_summary", "performance.topMetrics", "CPU 92%; Interface utilization 88%", "list"),
  placeholder("performance-if-end", "/if", "Fin performance", "Fin del bloque condicional.", false, "performance_assessment_summary", "performance.enabled", "", "conditional_block"),
  placeholder("remediation-plan", "remediation.plan", "Plan remediacion", "Plan de remediacion recomendado.", true, "remediation_plan", "roadmap.remediationPlan", "Tabla de remediacion", "table"),
  placeholder("investment-roadmap", "investment.roadmap", "Roadmap inversion", "Roadmap de inversion.", false, "investment_roadmap", "roadmap.investment", "Roadmap", "table"),
  placeholder("next-steps", "nextSteps", "Siguientes pasos", "Siguientes pasos recomendados.", true, "next_steps", "executive.nextSteps", "Validar hallazgos con stakeholders.", "list"),
  placeholder("evidence-inventory", "evidence.inventory", "Inventario evidencia", "Inventario de evidencias usadas.", true, "evidence_inventory", "evidence.files", "Tabla de evidencia", "table")
];

export const documentTemplateDefinitions: Record<DocumentType, DocumentTemplateDefinition> = {
  sow: definition("sow", "SOW", "Plantilla para Statement of Work tecnico.", "1.1.0", sowBlocks, [...globalPlaceholders, ...sowPlaceholders]),
  findings_report: definition(
    "findings_report",
    "Hallazgos y Resumen Ejecutivo",
    "Plantilla para documento ejecutivo y tecnico de hallazgos.",
    "1.1.0",
    findingsBlocks,
    [...globalPlaceholders, ...findingsPlaceholders]
  )
};

export async function generateBaseTemplate(documentType: DocumentType): Promise<Blob> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.folder("_rels")?.file(".rels", rootRelsXml());
  zip.folder("word")?.file("document.xml", baseTemplateDocumentXml(documentTemplateDefinitions[documentType]));
  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", documentRelsXml());

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

export async function extractPlaceholdersFromDocx(file: Blob | ArrayBuffer): Promise<string[]> {
  const buffer = file instanceof Blob ? await file.arrayBuffer() : file;
  const zip = await JSZip.loadAsync(buffer);
  const xmlFiles = wordXmlPartNames(zip);
  const xmlParts = await Promise.all(xmlFiles.map((path) => zip.file(path)?.async("string") ?? ""));
  const flattened = xmlParts.map(extractWordText).join("\n");
  return unique(flattened.match(/{{[^{}]+}}/g) ?? []);
}

export async function validateUploadedTemplate(file: Blob | ArrayBuffer, documentType: DocumentType): Promise<TemplateValidationResult> {
  const buffer = file instanceof Blob ? await file.arrayBuffer() : file;
  const zip = await JSZip.loadAsync(buffer).catch((error) => {
    throw new Error(error instanceof Error ? `El archivo no es un DOCX valido: ${error.message}` : "El archivo no es un DOCX valido.");
  });
  const packageChecks = inspectDocxPackage(zip);
  const xmlParts = await Promise.all(packageChecks.checkedParts.map((path) => zip.file(path)?.async("string") ?? ""));
  const flattened = xmlParts.map(extractWordText).join("\n");
  const foundPlaceholders = unique(flattened.match(/{{[^{}]+}}/g) ?? []);
  return validatePlaceholderSet(foundPlaceholders, documentType, packageChecks, flattened);
}

export function validatePlaceholderSet(
  foundPlaceholders: string[],
  documentType: DocumentType,
  packageChecks: TemplateValidationResult["packageChecks"] = {
    isDocxPackage: true,
    hasMainDocument: true,
    checkedParts: ["word/document.xml"]
  },
  rawText = foundPlaceholders.join("\n")
): TemplateValidationResult {
  const definition = documentTemplateDefinitions[documentType];
  const expected = definition.placeholders.map((placeholderItem) => placeholderItem.placeholderSyntax);
  const required = definition.placeholders.filter((placeholderItem) => placeholderItem.required).map((placeholderItem) => placeholderItem.placeholderSyntax);
  const optional = definition.placeholders.filter((placeholderItem) => !placeholderItem.required).map((placeholderItem) => placeholderItem.placeholderSyntax);
  const found = unique(foundPlaceholders);
  const missingRequiredPlaceholders = required.filter((placeholderItem) => !found.includes(placeholderItem));
  const missingOptionalPlaceholders = optional.filter((placeholderItem) => !found.includes(placeholderItem));
  const unknownPlaceholders = found.filter((placeholderItem) => !expected.includes(placeholderItem));
  const warnings = [
    ...missingOptionalPlaceholders.map((placeholderItem) => `Placeholder opcional ausente: ${placeholderItem}`),
    ...unknownPlaceholders.map((placeholderItem) => `Placeholder no registrado en la definicion: ${placeholderItem}`),
    ...repeatableSectionWarnings(rawText, definition.repeatableSections),
    ...conditionalSectionWarnings(rawText, definition.conditionalSections)
  ];
  const errors = [
    ...(!packageChecks.isDocxPackage ? ["El archivo no tiene estructura OpenXML DOCX completa."] : []),
    ...(!packageChecks.hasMainDocument ? ["El archivo no contiene word/document.xml."] : []),
    ...missingRequiredPlaceholders.map((placeholderItem) => `Placeholder requerido ausente: ${placeholderItem}`)
  ];

  return {
    isValid: errors.length === 0,
    documentType,
    definitionVersion: definition.version,
    foundPlaceholders: found,
    missingRequiredPlaceholders,
    missingOptionalPlaceholders,
    unknownPlaceholders,
    warnings,
    errors,
    canActivate: errors.length === 0,
    validatedAt: new Date().toISOString(),
    packageChecks
  };
}

export function activateTemplateVersion(versions: DocumentTemplateVersion[], templateVersionId: string, actor = "Local user"): DocumentTemplateVersion[] {
  const selected = versions.find((version) => version.id === templateVersionId);
  if (!selected) throw new Error("La plantilla seleccionada no existe.");
  if (!selected.validationResult.canActivate) throw new Error("La plantilla no puede activarse porque faltan placeholders requeridos.");
  const compatibility = compareTemplateWithCurrentDefinition(selected);
  if (compatibility.compatibilityStatus === "incompatible") {
    throw new Error("La plantilla no puede activarse porque no es compatible con la definicion vigente.");
  }

  const activatedAt = new Date().toISOString();

  return versions.map((version) => {
    if (version.id === templateVersionId) {
      return {
        ...version,
        status: "active",
        activatedAt,
        activatedBy: actor,
        auditTrail: [
          ...(version.auditTrail ?? []),
          auditEvent("activated", actor, activatedAt, "Plantilla marcada como vigente.", version.validationResult.definitionVersion)
        ]
      };
    }
    if (version.documentType === selected.documentType && version.status === "active") {
      return {
        ...version,
        status: "archived",
        auditTrail: [
          ...(version.auditTrail ?? []),
          auditEvent("archived", actor, activatedAt, `Archivada automaticamente al activar ${selected.templateVersion}.`, version.validationResult.definitionVersion)
        ]
      };
    }
    return version;
  });
}

export function compareTemplateWithCurrentDefinition(template: DocumentTemplateVersion): TemplateCompatibilityResult {
  const definition = documentTemplateDefinitions[template.documentType];
  const currentPlaceholders = definition.placeholders.map((placeholderItem) => placeholderItem.placeholderSyntax);
  const required = definition.placeholders.filter((placeholderItem) => placeholderItem.required).map((placeholderItem) => placeholderItem.placeholderSyntax);
  const optional = definition.placeholders.filter((placeholderItem) => !placeholderItem.required).map((placeholderItem) => placeholderItem.placeholderSyntax);
  const found = template.validationResult.foundPlaceholders;
  const newRequiredPlaceholders = required.filter((placeholderItem) => !found.includes(placeholderItem));
  const newOptionalPlaceholders = optional.filter((placeholderItem) => !found.includes(placeholderItem));
  const deprecatedPlaceholders = found.filter((placeholderItem) => !currentPlaceholders.includes(placeholderItem));
  const compatibilityStatus =
    newRequiredPlaceholders.length > 0 ? "incompatible" : newOptionalPlaceholders.length > 0 || deprecatedPlaceholders.length > 0 ? "compatible_with_warnings" : "compatible";

  return {
    currentDefinitionVersion: definition.version,
    templateDefinitionVersion: template.compatibleDefinitionVersion,
    newRequiredPlaceholders,
    newOptionalPlaceholders,
    deprecatedPlaceholders,
    compatibilityStatus
  };
}

export function generatePlaceholderReport(documentType: DocumentType, validationResult?: TemplateValidationResult) {
  const definition = documentTemplateDefinitions[documentType];
  const lines = [
    `Documento: ${definition.name}`,
    `Tipo: ${documentType}`,
    `Version de definicion: ${definition.version}`,
    "",
    "Reglas de edicion:",
    "- Puede modificar estilos, colores, tipografias, logos, portadas, encabezados y pies de pagina.",
    "- No debe eliminar, renombrar ni alterar los placeholders entre llaves dobles.",
    "- Puede mover bloques completos si conserva los placeholders.",
    "- Las secciones repetibles deben conservar sus marcadores de inicio y cierre.",
    "- Si elimina placeholders requeridos, la plantilla no podra activarse.",
    "",
    "Bloques requeridos:",
    ...definition.requiredBlocks.map((blockItem) => `- ${blockItem.blockKey}: ${blockItem.blockName}`),
    "",
    "Bloques opcionales:",
    ...definition.optionalBlocks.map((blockItem) => `- ${blockItem.blockKey}: ${blockItem.blockName}`),
    "",
    "Placeholders:",
    ...definition.placeholders.map(
      (placeholderItem) =>
        `- ${placeholderItem.placeholderSyntax} | ${placeholderItem.required ? "requerido" : "opcional"} | ${placeholderItem.contentType} | ${placeholderItem.description}`
    )
  ];

  if (validationResult) {
    lines.push(
      "",
      "Resultado de validacion:",
      `- Estado: ${validationResult.canActivate ? "activable" : "bloqueada"}`,
      `- Faltantes requeridos: ${validationResult.missingRequiredPlaceholders.join(", ") || "ninguno"}`,
      `- Faltantes opcionales: ${validationResult.missingOptionalPlaceholders.join(", ") || "ninguno"}`,
      `- Desconocidos: ${validationResult.unknownPlaceholders.join(", ") || "ninguno"}`
    );
  }

  return `${lines.join("\n")}\n`;
}

export function mapAssessmentDataToPlaceholders(assessmentData: any, documentType: DocumentType): Record<string, string> {
  const client = assessmentData?.client ?? {};
  const assessment = assessmentData?.assessment ?? {};
  const scope = assessmentData?.scope ?? {};
  const findings = assessmentData?.parsed?.findings ?? [];
  const executive = assessmentData?.executive ?? {};
  const performanceScope = scope?.performanceAnalysis ?? {};
  const performance = assessmentData?.performance?.assessment ?? executive?.performance ?? {};

  const common = {
    "{{client.name}}": cleanValue(client.name),
    "{{client.industry}}": cleanValue(client.industry),
    "{{assessment.name}}": cleanValue(assessment.name),
    "{{assessment.date}}": cleanValue(assessment.date ?? assessmentData?.updatedAt),
    "{{assessment.preparedBy}}": cleanValue(client.owner),
    "{{company.name}}": "GBM",
    "{{document.version}}": "v1.0",
    "{{document.generatedDate}}": new Date().toISOString().slice(0, 10)
  };

  if (documentType === "sow") {
    return {
      ...common,
      "{{sow.projectSummary}}": cleanValue(scope.businessContext),
      "{{sow.objectives}}": joinValues(scope.objectives),
      "{{sow.scope.included}}": joinValues(assessment.domains),
      "{{sow.scope.excluded}}": cleanValue(scope.constraints),
      "{{sow.methodology}}": "Levantamiento de informacion, analisis tecnico, validacion de hallazgos y roadmap.",
      "{{#if sow.performance.enabled}}": performanceScope.enabled ? "" : conditionalBlockDisabled,
      "{{sow.performance.enabled}}": performanceScope.enabled ? "Incluido" : "",
      "{{sow.performance.mode}}": cleanValue(performanceScope.mode ?? "No aplica"),
      "{{sow.performance.scope}}": performanceScope.enabled
        ? `Modo ${cleanValue(performanceScope.mode)}. Evidencia esperada: ${joinValues(performanceScope.expectedEvidenceTypes ?? [])}. Metricas: ${joinValues(performanceScope.includedMetrics ?? [])}. Notas: ${cleanValue(performanceScope.notes)}`
        : "",
      "{{/if}}": "",
      "{{sow.requiredInformation}}": "Inventario, configuraciones, vecinos, interfaces, rutas, logs y evidencia operacional.",
      "{{sow.activitiesByPhase}}": "Fase 1: alcance; Fase 2: levantamiento; Fase 3: analisis; Fase 4: resultados.",
      "{{sow.deliverables}}": joinValues(scope.deliverables),
      "{{sow.assumptions}}": "El cliente provee acceso a la informacion y valida hallazgos antes de la entrega final.",
      "{{sow.timeline}}": "Cronograma a confirmar segun alcance, cantidad de equipos y ventanas disponibles.",
      "{{sow.acceptanceCriteria}}": "Entregables revisados y aprobados por el arquitecto responsable y el cliente.",
      "{{sow.inventoryTable}}": inventoryTableXml(assessmentData?.targetInventory ?? [])
    };
  }

  return {
    ...common,
    "{{executive.summary}}": cleanValue(executive.summary ?? "Resumen ejecutivo pendiente de generar."),
    "{{risk.irirScore}}": cleanValue(executive.irir),
    "{{risk.irirLevel}}": cleanValue(executive.irirLevel),
    "{{risk.icaScore}}": cleanValue(executive.ica),
    "{{risk.icaLevel}}": cleanValue(executive.icaLevel),
    "{{risk.topRisks}}": joinValues((executive.topFindings ?? findings).slice(0, 5).map((finding: any) => finding.title)),
    "{{findings.criticalHighSummary}}": joinValues(findings.filter((finding: any) => ["critical", "high"].includes(finding.risk)).map((finding: any) => `${finding.id}: ${finding.title}`)),
    "{{#findings}}": "",
    "{{finding.id}}": joinValues(findings.map((finding: any) => finding.id)),
    "{{finding.title}}": joinValues(findings.map((finding: any) => finding.title)),
    "{{finding.severity}}": joinValues(findings.map((finding: any) => cleanValue(finding.risk))),
    "{{finding.probability}}": joinValues(findings.map((finding: any) => cleanValue(finding.probability ?? "Por validar"))),
    "{{finding.evidence}}": joinValues(findings.map((finding: any) => joinValues(finding.evidence))),
    "{{finding.recommendation}}": joinValues(findings.map((finding: any) => finding.recommendation)),
    "{{/findings}}": "",
    "{{findings.matrix}}": joinValues(findings.map((finding: any) => `${finding.id}: ${finding.risk} - ${finding.title}`)),
    "{{#if operations.enabled}}": "",
    "{{operations.summary}}": cleanValue(assessmentData?.operationalAssessment?.executiveSummary ?? "Evaluacion operacional pendiente."),
    "{{/if}}": "",
    "{{#if performance.enabled}}": assessmentData?.scope?.performanceAnalysis?.enabled ? "" : conditionalBlockDisabled,
    "{{performance.summary}}": cleanValue(performance.summary ?? executive?.performance?.summaryText ?? "Performance Analysis pendiente."),
    "{{performance.score}}": cleanValue(performance.performanceRiskScore ?? executive?.performance?.performanceRiskScore ?? "Pendiente"),
    "{{performance.confidence}}": cleanValue(performance.confidenceScore ?? executive?.performance?.confidenceScore ?? "Pendiente"),
    "{{performance.topMetrics}}": joinValues(performance.topMetrics ?? executive?.performance?.topMetrics ?? []),
    "{{remediation.plan}}": cleanValue(executive.remediationPlan ?? "Plan de remediacion pendiente."),
    "{{investment.roadmap}}": cleanValue(executive.investmentRoadmap ?? "Roadmap de inversion pendiente."),
    "{{nextSteps}}": joinValues(executive.nextSteps ?? ["Validar hallazgos", "Priorizar remediaciones", "Acordar roadmap"]),
    "{{evidence.inventory}}": joinValues((assessmentData?.evidenceFiles ?? []).map((file: any) => file.name))
  };
}

export async function renderDocxTemplate(templateFile: Blob | ArrayBuffer, values: Record<string, string>): Promise<Blob> {
  const buffer = templateFile instanceof Blob ? await templateFile.arrayBuffer() : templateFile;
  const zip = await JSZip.loadAsync(buffer);
  const xmlFiles = wordXmlPartNames(zip);

  await Promise.all(
    xmlFiles.map(async (path) => {
      const file = zip.file(path);
      if (!file) return;
      let xml = await file.async("string");
      xml = replacePlaceholdersInWordXml(xml, values);
      zip.file(path, xml);
    })
  );

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

export function replacePlaceholdersInWordXml(xml: string, values: Record<string, string>) {
  xml = applyConditionalParagraphBlocks(xml, values);
  const normalizedValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === conditionalBlockDisabled ? "" : value])
  );
  const xmlValues = Object.fromEntries(Object.entries(normalizedValues).filter(([, value]) => isWordXmlFragment(value)));
  const textValues = Object.fromEntries(Object.entries(normalizedValues).filter(([, value]) => !isWordXmlFragment(value)));
  xml = replaceXmlFragmentPlaceholders(xml, xmlValues);

  const textNodes = Array.from(xml.matchAll(/<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g)).map((match) => ({
    full: match[0],
    attrs: match[1] ?? "",
    inner: match[2] ?? "",
    decoded: decodeXml(match[2] ?? "")
  }));

  if (textNodes.length === 0) return xml;

  const combinedText = textNodes.map((node) => node.decoded).join("");
  const matches = placeholderMatches(combinedText, textValues);
  if (matches.length === 0) return xml;

  let cursor = 0;
  const renderedNodes = textNodes.map((node) => {
    const start = cursor;
    const end = start + node.decoded.length;
    cursor = end;
    const rendered = renderTextSegment(node.decoded, start, matches);
    return `<w:t${node.attrs}>${escapeXml(rendered)}</w:t>`;
  });

  let nodeIndex = 0;
  return xml.replace(/<w:t(\s[^>]*)?>[\s\S]*?<\/w:t>/g, () => renderedNodes[nodeIndex++] ?? "");
}

function applyConditionalParagraphBlocks(xml: string, values: Record<string, string>) {
  let nextXml = xml;
  for (const [startSyntax, value] of Object.entries(values)) {
    if (!startSyntax.startsWith("{{#if") || value !== conditionalBlockDisabled) continue;
    nextXml = removeConditionalParagraphBlock(nextXml, startSyntax, "{{/if}}");
  }
  return nextXml;
}

function removeConditionalParagraphBlock(xml: string, startSyntax: string, endSyntax: string) {
  const paragraphs = Array.from(xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g));
  const startIndex = paragraphs.findIndex((match) => extractWordText(match[0]).includes(startSyntax));
  if (startIndex < 0) return xml;
  const endIndex = paragraphs.findIndex((match, index) => index >= startIndex && extractWordText(match[0]).includes(endSyntax));
  if (endIndex < 0) return xml;
  const start = paragraphs[startIndex].index ?? 0;
  const end = (paragraphs[endIndex].index ?? 0) + paragraphs[endIndex][0].length;
  return `${xml.slice(0, start)}${xml.slice(end)}`;
}

function definition(
  documentType: DocumentType,
  name: string,
  description: string,
  version: string,
  blocks: DocumentTemplateBlock[],
  placeholders: Omit<DocumentPlaceholder, "documentType">[]
): DocumentTemplateDefinition {
  return {
    id: `${documentType}-definition`,
    documentType,
    name,
    description,
    version,
    requiredBlocks: blocks.filter((blockItem) => blockItem.required),
    optionalBlocks: blocks.filter((blockItem) => !blockItem.required),
    placeholders: placeholders.map((placeholderItem) => ({ ...placeholderItem, documentType })),
    repeatableSections: placeholders.filter((placeholderItem) => placeholderItem.contentType === "repeated_block").map((placeholderItem) => placeholderItem.placeholderSyntax),
    conditionalSections: placeholders.filter((placeholderItem) => placeholderItem.contentType === "conditional_block").map((placeholderItem) => placeholderItem.placeholderSyntax),
    createdAt,
    updatedAt: createdAt
  };
}

function block(
  documentType: DocumentType,
  blockKey: string,
  blockName: string,
  description: string,
  required: boolean,
  order: number,
  supportedContentTypes: DocumentContentType[]
): DocumentTemplateBlock {
  return {
    id: `${documentType}-${blockKey}`,
    documentType,
    blockKey,
    blockName,
    description,
    required,
    order,
    supportedContentTypes,
    dataSourcePath: blockKey,
    fallbackText: "Pendiente",
    versionIntroduced: "1.0.0"
  };
}

function placeholder(
  id: string,
  key: string,
  label: string,
  description: string,
  required: boolean,
  blockKey: string,
  dataSourcePath: string,
  sampleValue: string,
  contentType: DocumentContentType = "text"
): Omit<DocumentPlaceholder, "documentType"> {
  return {
    id,
    key,
    label,
    description,
    placeholderSyntax: `{{${key}}}`,
    required,
    blockKey,
    contentType,
    dataSourcePath,
    sampleValue,
    versionIntroduced: "1.0.0"
  };
}

function baseTemplateDocumentXml(definitionItem: DocumentTemplateDefinition) {
  const blocks = [...definitionItem.requiredBlocks, ...definitionItem.optionalBlocks].sort((left, right) => left.order - right.order);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${heading(`${definitionItem.name} - Plantilla base`, 1)}
    ${paragraph(`Tipo de documento: ${definitionItem.documentType}`)}
    ${paragraph(`Version de definicion: ${definitionItem.version}`)}
    ${heading("Instrucciones para edicion en Word", 2)}
    ${bullet("Puede modificar estilos, colores, tipografias, logos, portadas, encabezados y pies de pagina.")}
    ${bullet("No debe eliminar, renombrar ni alterar los placeholders entre llaves dobles.")}
    ${bullet("Puede mover bloques completos si conserva los placeholders.")}
    ${bullet("Las secciones repetibles deben conservar sus marcadores de inicio y cierre.")}
    ${bullet("Si elimina placeholders requeridos, la plantilla no podra activarse.")}
    ${heading("Referencia rapida de placeholders", 2)}
    ${table([
      ["Placeholder", "Requerido", "Bloque", "Descripcion"],
      ...definitionItem.placeholders.map((placeholderItem) => [
        placeholderItem.placeholderSyntax,
        placeholderItem.required ? "Si" : "No",
        placeholderItem.blockKey,
        placeholderItem.description
      ])
    ])}
    ${blocks
      .map((blockItem) => {
        const blockPlaceholders = definitionItem.placeholders.filter((placeholderItem) => placeholderItem.blockKey === blockItem.blockKey);
        return [
          heading(`${blockItem.order}. ${blockItem.blockName}`, 2),
          paragraph(blockItem.description),
          paragraph(`Bloque ${blockItem.required ? "requerido" : "opcional"} · fuente: ${blockItem.dataSourcePath}`),
          ...blockPlaceholders.map((placeholderItem) => paragraph(placeholderItem.placeholderSyntax))
        ].join("");
      })
      .join("")}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr>
  </w:body>
</w:document>`;
}

function heading(text: string, level: 1 | 2 | 3) {
  const size = level === 1 ? "32" : level === 2 ? "26" : "22";
  return `<w:p><w:pPr><w:spacing w:before="160" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function paragraph(text: string) {
  return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function bullet(text: string) {
  return paragraph(`- ${text}`);
}

function table(rows: string[][]) {
  return `<w:tbl>
    <w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borderXml()}</w:tblBorders></w:tblPr>
    ${rows.map((row, index) => `<w:tr>${row.map((cell) => tableCell(cell, index === 0)).join("")}</w:tr>`).join("")}
  </w:tbl>`;
}

function inventoryTableXml(assets: any[]) {
  const includedAssets = assets.filter((asset) => asset?.included !== false);
  if (includedAssets.length === 0) return paragraph("Inventario pendiente de confirmar.");

  return compactTable(
    [
      ["Hostname", "IP gestion", "Modelo", "Serial", "Tipo", "Rol / sitio", "Prioridad"],
      ...includedAssets.map((asset) => [
        cleanValue(asset.hostname),
        cleanValue(asset.managementIp),
        cleanValue(asset.model),
        cleanValue(asset.serial),
        cleanValue(asset.deviceType),
        [asset.role, asset.site].filter(Boolean).join(" / ") || "Pendiente",
        cleanValue(asset.priority)
      ])
    ],
    ["1700", "1500", "1700", "1700", "1200", "1900", "1200"]
  );
}

function isWordXmlFragment(value: string) {
  return /^\s*<w:(?:tbl|p)\b/.test(value);
}

function replaceXmlFragmentPlaceholders(xml: string, values: Record<string, string>) {
  let nextXml = xml;
  for (const [placeholderSyntax, fragment] of Object.entries(values)) {
    nextXml = replaceParagraphContainingPlaceholder(nextXml, placeholderSyntax, fragment);
  }
  return nextXml;
}

function replaceParagraphContainingPlaceholder(xml: string, placeholderSyntax: string, fragment: string) {
  const paragraphs = Array.from(xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g));
  const paragraph = paragraphs.find((match) => extractWordText(match[0]).includes(placeholderSyntax));
  if (!paragraph) return xml;
  return `${xml.slice(0, paragraph.index)}${wordBlockFragment(fragment)}${xml.slice((paragraph.index ?? 0) + paragraph[0].length)}`;
}

function tableCell(text: string, isHeader: boolean) {
  const shading = isHeader ? '<w:shd w:fill="E9EEF5"/>' : "";
  const bold = isHeader ? "<w:b/>" : "";
  return `<w:tc>
    <w:tcPr><w:tcW w:w="2400" w:type="dxa"/>${shading}</w:tcPr>
    <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr>${bold}<w:sz w:val="18"/></w:rPr><w:t>${escapeXml(text || "Pendiente")}</w:t></w:r></w:p>
  </w:tc>`;
}

function compactTable(rows: string[][], widths: string[]) {
  const grid = `<w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>`;
  return `<w:tbl>
    <w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borderXml()}</w:tblBorders></w:tblPr>
    ${grid}
    ${rows.map((row, rowIndex) => `<w:tr>${row.map((cell, cellIndex) => compactTableCell(cell, rowIndex === 0, widths[cellIndex] ?? "1500")).join("")}</w:tr>`).join("")}
  </w:tbl>`;
}

function wordBlockFragment(fragment: string) {
  if (/^\s*<w:tbl\b/.test(fragment)) return `${fragment}${paragraph("")}`;
  return fragment;
}

function compactTableCell(text: string, isHeader: boolean, width: string) {
  const shading = isHeader ? '<w:shd w:fill="E9EEF5"/>' : "";
  const bold = isHeader ? "<w:b/>" : "";
  return `<w:tc>
    <w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}</w:tcPr>
    <w:p><w:pPr><w:spacing w:after="20"/></w:pPr><w:r><w:rPr>${bold}<w:sz w:val="16"/></w:rPr><w:t>${escapeXml(text || "Pendiente")}</w:t></w:r></w:p>
  </w:tc>`;
}

function borderXml() {
  return [
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>',
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>',
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>',
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>',
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>',
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
  ].join("");
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function documentRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
}

function inspectDocxPackage(zip: JSZip): TemplateValidationResult["packageChecks"] {
  const checkedParts = wordXmlPartNames(zip);
  return {
    isDocxPackage: Boolean(zip.file("[Content_Types].xml")) && Boolean(zip.file("_rels/.rels")),
    hasMainDocument: Boolean(zip.file("word/document.xml")),
    checkedParts
  };
}

function wordXmlPartNames(zip: JSZip) {
  return Object.keys(zip.files).filter((path) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(path));
}

function extractWordText(xml: string) {
  return Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g))
    .map((match) => decodeXml(match[1] ?? ""))
    .join("");
}

function repeatableSectionWarnings(rawText: string, repeatableSections: string[]) {
  const warnings: string[] = [];
  for (const startSyntax of repeatableSections.filter((syntax) => syntax.startsWith("{{#"))) {
    const endSyntax = matchingSectionEnd(startSyntax);
    if (rawText.includes(startSyntax) !== rawText.includes(endSyntax)) {
      warnings.push(`Bloque repetible incompleto: se requiere conservar ${startSyntax} y ${endSyntax}.`);
    }
  }
  return warnings;
}

function conditionalSectionWarnings(rawText: string, conditionalSections: string[]) {
  const warnings: string[] = [];
  for (const startSyntax of conditionalSections.filter((syntax) => syntax.startsWith("{{#if"))) {
    const hasStart = rawText.includes(startSyntax);
    const hasEnd = rawText.includes("{{/if}}");
    if (hasStart !== hasEnd) {
      warnings.push(`Bloque condicional incompleto: se requiere conservar ${startSyntax} y {{/if}}.`);
    }
  }
  return warnings;
}

function matchingSectionEnd(startSyntax: string) {
  return startSyntax.replace("{{#", "{{/");
}

function placeholderMatches(combinedText: string, values: Record<string, string>) {
  const matches: Array<{ start: number; end: number; value: string }> = [];
  const placeholders = Object.keys(values).sort((left, right) => right.length - left.length);

  for (const placeholderSyntax of placeholders) {
    let index = combinedText.indexOf(placeholderSyntax);
    while (index >= 0) {
      const end = index + placeholderSyntax.length;
      if (!matches.some((match) => rangesOverlap(index, end, match.start, match.end))) {
        matches.push({ start: index, end, value: values[placeholderSyntax] ?? "" });
      }
      index = combinedText.indexOf(placeholderSyntax, end);
    }
  }

  return matches.sort((left, right) => left.start - right.start);
}

function renderTextSegment(text: string, globalStart: number, matches: Array<{ start: number; end: number; value: string }>) {
  let rendered = "";
  for (let index = 0; index < text.length; index += 1) {
    const globalIndex = globalStart + index;
    const startingMatch = matches.find((match) => match.start === globalIndex);
    if (startingMatch) rendered += startingMatch.value;
    if (matches.some((match) => globalIndex >= match.start && globalIndex < match.end)) continue;
    rendered += text[index];
  }
  return rendered;
}

function rangesOverlap(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function auditEvent(
  action: DocumentTemplateAuditEvent["action"],
  actor: string,
  at: string,
  notes: string,
  definitionVersion: string
): DocumentTemplateAuditEvent {
  return {
    id: `audit_${Math.random().toString(36).slice(2, 10)}`,
    action,
    actor,
    at,
    notes,
    definitionVersion
  };
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeXml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Pendiente";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function joinValues(values: unknown) {
  if (!Array.isArray(values) || values.length === 0) return "Pendiente";
  return values.map(cleanValue).join("\n");
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
