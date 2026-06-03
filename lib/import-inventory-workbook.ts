"use client";

import JSZip from "jszip";

export type InventoryWorkbookRow = {
  hostname: string;
  managementIp: string;
  serial: string;
  model: string;
  deviceType: string;
  platform: string;
  role: string;
  site: string;
  topologyLayer: string;
  priority: string;
  notes: string;
};

export type InventoryWorkbookImportResult = {
  rows: InventoryWorkbookRow[];
  errors: string[];
};

const requiredHeaders = ["hostname", "managementip", "serial", "model", "devicetype", "platform", "role", "site", "priority"];

export async function importInventoryWorkbook(file: File): Promise<InventoryWorkbookImportResult> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { rows: [], errors: ["El archivo debe tener extension .xlsx."] };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    return { rows: [], errors: ["No se pudo abrir el archivo. Verifica que sea un Excel .xlsx valido."] };
  }

  const sharedStrings = await readSharedStrings(zip);
  const sheetPath = await firstWorksheetPath(zip);
  const sheetXml = await zip.file(sheetPath)?.async("text");
  if (!sheetXml) return { rows: [], errors: ["No se encontro una hoja de inventario dentro del archivo."] };

  const documentXml = parseXml(sheetXml);
  const rawRows = Array.from(documentXml.getElementsByTagName("row")).map((row) => readRow(row, sharedStrings));
  const headerMatch = findHeaderRow(rawRows);
  if (!headerMatch) return { rows: [], errors: ["El archivo no contiene los encabezados requeridos de inventario."] };

  const { headerMap, rowIndex } = headerMatch;
  const dataRows = rawRows.slice(rowIndex + 1);

  const parsedRows = dataRows
    .map((row) => ({
      hostname: cell(row, headerMap, "hostname"),
      managementIp: cell(row, headerMap, "managementip"),
      serial: cell(row, headerMap, "serial"),
      model: cell(row, headerMap, "model"),
      deviceType: cell(row, headerMap, "devicetype"),
      platform: cell(row, headerMap, "platform"),
      role: cell(row, headerMap, "role"),
      site: cell(row, headerMap, "site"),
      topologyLayer: cell(row, headerMap, "topologylayer"),
      priority: cell(row, headerMap, "priority"),
      notes: cell(row, headerMap, "notes")
    }))
    .filter((row) => row.hostname && row.managementIp);

  if (parsedRows.length === 0) {
    return { rows: [], errors: ["El archivo no contiene filas validas con hostname e IP de gestion."] };
  }

  return { rows: parsedRows, errors: [] };
}

async function readSharedStrings(zip: JSZip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (!xml) return [];
  const documentXml = parseXml(xml);
  return Array.from(documentXml.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t")).map((textNode) => textNode.textContent ?? "").join("")
  );
}

async function firstWorksheetPath(zip: JSZip) {
  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  if (!workbookXml || !relsXml) return "xl/worksheets/sheet1.xml";

  const workbook = parseXml(workbookXml);
  const rels = parseXml(relsXml);
  const firstSheet = workbook.getElementsByTagName("sheet")[0];
  const relationshipId = firstSheet?.getAttribute("r:id");
  const relationship = Array.from(rels.getElementsByTagName("Relationship")).find((item) => item.getAttribute("Id") === relationshipId);
  const target = relationship?.getAttribute("Target") ?? "worksheets/sheet1.xml";
  if (target.startsWith("/xl/")) return target.slice(1);
  return target.startsWith("xl/") ? target : `xl/${target}`;
}

function readRow(row: Element, sharedStrings: string[]) {
  const values: string[] = [];
  for (const cellNode of Array.from(row.getElementsByTagName("c"))) {
    const reference = cellNode.getAttribute("r") ?? "";
    const columnIndex = columnIndexFromReference(reference);
    values[columnIndex] = readCell(cellNode, sharedStrings);
  }
  return values.map((value) => value ?? "");
}

function readCell(cellNode: Element, sharedStrings: string[]) {
  const type = cellNode.getAttribute("t");
  if (type === "inlineStr") {
    return Array.from(cellNode.getElementsByTagName("t")).map((node) => node.textContent ?? "").join("");
  }

  const value = cellNode.getElementsByTagName("v")[0]?.textContent ?? "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  return value;
}

function columnIndexFromReference(reference: string) {
  const letters = reference.match(/[A-Z]+/i)?.[0] ?? "A";
  return letters
    .toUpperCase()
    .split("")
    .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function cell(row: string[], headerMap: Record<string, number>, key: string) {
  const index = headerMap[key];
  return index === undefined ? "" : (row[index] ?? "").trim();
}

function findHeaderRow(rows: string[][]) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const headerMap = rows[rowIndex].reduce<Record<string, number>>((map, value, index) => {
      const normalized = canonicalHeader(value);
      if (normalized && map[normalized] === undefined) map[normalized] = index;
      return map;
    }, {});
    const missingHeaders = requiredHeaders.filter((header) => headerMap[header] === undefined);
    if (missingHeaders.length === 0) return { headerMap, rowIndex };
  }
  return null;
}

function canonicalHeader(value: string) {
  const normalized = normalizeHeader(value);
  const aliases: Record<string, string> = {
    hostname: "hostname",
    equipo: "hostname",
    dispositivo: "hostname",
    ipgestion: "managementip",
    ipdegestion: "managementip",
    ipgestión: "managementip",
    managementip: "managementip",
    mgmtip: "managementip",
    serial: "serial",
    serie: "serial",
    numerodeserie: "serial",
    model: "model",
    modelo: "model",
    devicetype: "devicetype",
    tipodeequipo: "devicetype",
    tipoequipo: "devicetype",
    tipo: "devicetype",
    platform: "platform",
    plataforma: "platform",
    role: "role",
    rol: "role",
    site: "site",
    sitio: "site",
    ubicacion: "site",
    ubicación: "site",
    topologylayer: "topologylayer",
    segmentotopologico: "topologylayer",
    segmentotopológico: "topologylayer",
    segmentotopologia: "topologylayer",
    segmentodetopologia: "topologylayer",
    priority: "priority",
    prioridad: "priority",
    criticality: "priority",
    criticidad: "priority",
    notes: "notes",
    notas: "notes",
    comentarios: "notes"
  };
  return aliases[normalized] ?? "";
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseXml(xml: string) {
  return new DOMParser().parseFromString(xml, "application/xml");
}
