"use client";

import JSZip from "jszip";
import type { Assessment, Client, Finding } from "@/lib/types";

type FindingDocumentInput = {
  client: Client;
  assessment: Assessment;
  findings: Finding[];
  summary: Array<{ risk: string; impact: string; count: number }>;
};

export async function exportFindingsToWord(input: FindingDocumentInput) {
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
  link.download = `${safeName(input.assessment.name)}-hallazgos.docx`;
  link.click();
  URL.revokeObjectURL(url);
}

function documentXml(input: FindingDocumentInput) {
  const findingSections = input.findings.length
    ? input.findings.map(findingXml).join("")
    : paragraph("Sin hallazgos validados o preliminares disponibles.");
  const summaryRows = input.summary.length
    ? input.summary.map((row) => paragraph(`${row.risk.toUpperCase()} / Impacto ${row.impact.toUpperCase()}: ${row.count}`)).join("")
    : paragraph("Matriz de riesgo e impacto sin datos.");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${heading("Documento de Hallazgos", 1)}
    ${paragraph(`Cliente: ${input.client.name}`)}
    ${paragraph(`Assessment: ${input.assessment.name}`)}
    ${paragraph(`Estado: ${input.assessment.status}`)}
    ${heading("Resumen Ejecutivo", 2)}
    ${paragraph("Este documento consolida los hallazgos identificados durante el assessment tecnico. Todo hallazgo debe ser revisado y validado por el arquitecto responsable antes de ser entregado como version final.")}
    ${heading("Matriz de Riesgo e Impacto", 2)}
    ${summaryRows}
    ${heading("Hallazgos", 2)}
    ${findingSections}
    ${heading("Notas para Edicion", 2)}
    ${paragraph("Agregar contexto del cliente, priorizacion final, dependencias, responsables y plan de remediacion acordado.")}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;
}

function findingXml(finding: Finding) {
  return [
    heading(finding.title, 3),
    paragraph(`Ambito: ${finding.category}`),
    paragraph(`Riesgo: ${finding.risk} | Confianza: ${Math.round(finding.confidence * 100)}% | Estado: ${finding.status}`),
    paragraph(`Activos afectados: ${finding.affectedAssets.join(", ") || "Pendiente"}`),
    paragraph(`Recomendacion: ${finding.recommendation}`),
    paragraph(`Tipo de remediacion: ${finding.remediationType}`),
    paragraph(`Evidencia: ${finding.evidence.join(" | ")}`)
  ].join("");
}

function heading(text: string, level: 1 | 2 | 3) {
  const size = level === 1 ? "32" : level === 2 ? "26" : "22";
  return `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function paragraph(text: string) {
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
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
