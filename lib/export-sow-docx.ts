"use client";

import JSZip from "jszip";

export type SowDocumentInput = {
  client: {
    name: string;
    industry: string;
    owner: string;
  };
  assessment: {
    name: string;
    status: string;
    domains: string[];
  };
  scope: {
    businessContext: string;
    objectives: string[];
    sites: string;
    environments: string[];
    constraints: string;
    deliverables: string[];
  };
  sowItems: Array<{ title: string; body: string }>;
  inventory: Array<{
    hostname: string;
    managementIp: string;
    serial: string;
    model: string;
    deviceType: string;
    role: string;
    site: string;
    priority: string;
    included: boolean;
  }>;
  evidenceCoverage: Array<{
    hostname: string;
    managementIp: string;
    model: string;
    role: string;
    collectedCount: number;
    missingCount: number;
    skippedCount: number;
    cells: Array<{ label: string; status: string; fileNames: string[] }>;
  }>;
  evidenceFiles: Array<{
    name: string;
    type: string;
    sizeKb: number;
    uploadedAt: string;
  }>;
  relations: Array<{
    localHostname: string;
    localInterface: string;
    remoteHostname: string;
    remoteInterface: string;
    protocol: string;
    confidence: number;
  }>;
  findings: Array<{
    title: string;
    category: string;
    risk: string;
    status: string;
    confidence: number;
    affectedAssets: string[];
    recommendation: string;
    remediationType: string;
  }>;
};

export async function exportSowToWord(input: SowDocumentInput) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml());
  zip.folder("_rels")?.file(".rels", rootRelsXml());
  zip.folder("word")?.file("document.xml", documentXml(input));
  zip.folder("word")?.folder("_rels")?.file("document.xml.rels", documentRelsXml());

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName(input.assessment.name)}-sow-preliminar.docx`;
  link.click();
  URL.revokeObjectURL(url);
}

function documentXml(input: SowDocumentInput) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${heading("Statement of Work Preliminar", 1)}
    ${paragraph(`Cliente: ${input.client.name}`)}
    ${paragraph(`Assessment: ${input.assessment.name}`)}
    ${paragraph(`Estado: ${input.assessment.status}`)}
    ${paragraph(`Dominios: ${input.assessment.domains.join(", ") || "Pendiente"}`)}
    ${paragraph(`Generado: ${new Date().toLocaleDateString()}`)}

    ${heading("1. Informacion General", 2)}
    ${table([
      ["Campo", "Detalle"],
      ["Cliente", input.client.name],
      ["Industria", input.client.industry || "Pendiente"],
      ["Owner / Arquitecto", input.client.owner || "Pendiente"],
      ["Assessment", input.assessment.name],
      ["Estado", input.assessment.status],
      ["Dominios", input.assessment.domains.join(", ") || "Pendiente"]
    ])}

    ${heading("2. Alcance de Evaluacion", 2)}
    ${table([
      ["Elemento", "Detalle"],
      ["Contexto de negocio", input.scope.businessContext || "Pendiente"],
      ["Sitios / ubicaciones", input.scope.sites || "Pendiente"],
      ["Ambientes incluidos", input.scope.environments.join(", ") || "Pendiente"],
      ["Restricciones", input.scope.constraints || "Pendiente"]
    ])}

    ${heading("3. Objetivos", 2)}
    ${table([["Objetivo"], ...toSingleColumnRows(input.scope.objectives)])}

    ${heading("4. Entregables", 2)}
    ${table([["Entregable"], ...toSingleColumnRows(input.scope.deliverables)])}

    ${heading("5. Servicios y Actividades SOW", 2)}
    ${table([["Seccion", "Descripcion"], ...input.sowItems.map((item) => [item.title, item.body])])}

    ${heading("6. Inventario Objetivo", 2)}
    ${table([
      ["Incluido", "Hostname", "IP gestion", "Serial", "Modelo", "Tipo", "Rol", "Sitio", "Prioridad"],
      ...input.inventory.map((asset) => [
        asset.included ? "Si" : "No",
        asset.hostname,
        asset.managementIp,
        asset.serial,
        asset.model,
        asset.deviceType,
        asset.role,
        asset.site,
        asset.priority
      ])
    ])}

    ${heading("7. Cumplimiento de Evidencia", 2)}
    ${table([
      ["Equipo", "IP gestion", "Modelo", "Rol", "Recibidas", "Faltantes", "Omitidas", "Detalle por comando"],
      ...input.evidenceCoverage.map((row) => [
        row.hostname,
        row.managementIp,
        row.model,
        row.role,
        String(row.collectedCount),
        String(row.missingCount),
        String(row.skippedCount),
        row.cells.map((cell) => `${cell.label}: ${cell.status}${cell.fileNames.length ? ` (${cell.fileNames.join(", ")})` : ""}`).join("; ")
      ])
    ])}

    ${heading("8. Archivos de Evidencia", 2)}
    ${table([
      ["Archivo", "Tipo", "Tamano KB", "Fecha de carga"],
      ...input.evidenceFiles.map((file) => [file.name, file.type, String(file.sizeKb), file.uploadedAt])
    ])}

    ${heading("9. Relaciones Descubiertas", 2)}
    ${table([
      ["Origen", "Interfaz origen", "Destino", "Interfaz destino", "Protocolo", "Confianza"],
      ...input.relations.map((relation) => [
        relation.localHostname,
        relation.localInterface,
        relation.remoteHostname,
        relation.remoteInterface,
        relation.protocol.toUpperCase(),
        `${Math.round(relation.confidence * 100)}%`
      ])
    ])}

    ${heading("10. Hallazgos Preliminares", 2)}
    ${table([
      ["Hallazgo", "Ambito", "Riesgo", "Estado", "Confianza", "Activos", "Remediacion", "Recomendacion"],
      ...input.findings.map((finding) => [
        finding.title,
        finding.category,
        finding.risk,
        finding.status,
        `${Math.round(finding.confidence * 100)}%`,
        finding.affectedAssets.join(", ") || "Pendiente",
        finding.remediationType,
        finding.recommendation
      ])
    ])}

    ${heading("11. Notas", 2)}
    ${paragraph("Este documento es una base editable generada automaticamente. Debe ser revisado por el arquitecto responsable antes de compartirse como version contractual o entregable formal.")}
    <w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="900" w:right="720" w:bottom="900" w:left="720"/></w:sectPr>
  </w:body>
</w:document>`;
}

function toSingleColumnRows(values: string[]) {
  return values.length ? values.map((value) => [value]) : [["Pendiente"]];
}

function heading(text: string, level: 1 | 2 | 3) {
  const size = level === 1 ? "32" : level === 2 ? "26" : "22";
  return `<w:p><w:pPr><w:spacing w:before="160" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function paragraph(text: string) {
  return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function table(rows: string[][]) {
  if (rows.length === 1) rows.push(["Sin datos"]);

  return `<w:tbl>
    <w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${borderXml()}</w:tblBorders></w:tblPr>
    ${rows.map((row, index) => tableRow(row, index === 0)).join("")}
  </w:tbl>`;
}

function tableRow(cells: string[], isHeader: boolean) {
  return `<w:tr>${cells.map((cell) => tableCell(cell, isHeader)).join("")}</w:tr>`;
}

function tableCell(text: string, isHeader: boolean) {
  const shading = isHeader ? '<w:shd w:fill="E9EEF5"/>' : "";
  const bold = isHeader ? "<w:b/>" : "";
  return `<w:tc>
    <w:tcPr><w:tcW w:w="2400" w:type="dxa"/>${shading}</w:tcPr>
    <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr>${bold}<w:sz w:val="18"/></w:rPr><w:t>${escapeXml(text || "Pendiente")}</w:t></w:r></w:p>
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

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "assessment";
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
