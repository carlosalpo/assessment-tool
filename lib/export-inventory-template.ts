"use client";

import JSZip from "jszip";

export type InventoryTemplateMetadata = {
  clientName?: string;
  assessmentName?: string;
  industry?: string;
  owner?: string;
  domains?: string[];
  status?: string;
  assessmentCreatedAt?: string;
  updatedAt?: string;
  generatedAt?: string;
};

const inventoryHeaders = [
  "Hostname",
  "IP Gestion",
  "Serial",
  "Modelo",
  "Tipo",
  "Plataforma",
  "Rol",
  "Sitio",
  "Segmento Topologico",
  "Prioridad",
  "Notas"
];

const exampleRows = [
  ["core-9500-01", "10.10.10.1", "FCW2148L0AB", "C9500-48Y4C", "switch-l3", "ios-xe", "core", "HQ", "core", "critical", "Core principal"],
  ["access-9200-01", "10.10.11.10", "FCW2209A0CD", "C9200L-48P", "switch-l2", "ios-xe", "access", "HQ", "campus", "medium", "Switch de acceso"],
  ["wan-isr-01", "10.10.20.1", "FGL2201A1BC", "ISR4431", "router", "ios-xe", "wan-edge", "HQ", "perimeter", "high", "Router WAN"],
  ["branch-isr-01", "10.30.1.11", "FJC2134C0AA", "ISR4331", "router", "ios-xe", "branch-router", "Branch-01", "branches", "medium", "Router de sucursal"]
];

const guideRows = [
  ["Campo", "Descripcion", "Ejemplos / valores sugeridos"],
  ["Hostname", "Nombre operativo del equipo. Debe coincidir con la evidencia recolectada cuando sea posible.", "core-9500-01, branch-isr-01"],
  ["IP Gestion", "Direccion IP usada para administrar el equipo.", "10.10.10.1"],
  ["Serial", "Numero de serie del equipo o chasis.", "FCW2148L0AB"],
  ["Modelo", "Modelo o PID principal del equipo.", "C9500-48Y4C, ISR4331/K9"],
  ["Tipo", "Clasificacion tecnica usada para asignar comandos de levantamiento y analisis.", "switch-l2, switch-l3, router, nexus-switch, firewall, aci, wireless-controller, other"],
  ["Plataforma", "Sistema operativo o familia tecnologica soportada por comandos y analisis.", "ios-xe, ios, nx-os, asa, ftd, aci, unknown"],
  ["Rol", "Funcion del equipo dentro de la red.", "core, wan-edge, branch-router, access, leaf, spine"],
  ["Sitio", "Ubicacion fisica o logica.", "HQ, DC1, Branch-01"],
  ["Segmento Topologico", "Segmento/capa donde debe aparecer el equipo en el grafo de Topologia. Use Auto si desea que la herramienta lo infiera.", "branches, perimeter, core, datacenter, campus, other, auto"],
  ["Prioridad", "Criticidad relativa para planificacion y analisis.", "critical, high, medium, low"],
  ["Notas", "Contexto adicional para el equipo.", "Equipo en HA, pendiente de reemplazo, sitio remoto"]
];

const segmentRows = [
  ["Segmento Topologico", "Cuando usarlo"],
  ["branches", "Sucursales, sedes remotas, oficinas regionales o equipos branch que normalmente se conectan hacia equipos de perimetro/WAN."],
  ["perimeter", "Routers WAN, Internet edge, firewalls, VPN, DMZ o bordes externos."],
  ["core", "Backbone, core switching/routing y agregacion troncal principal."],
  ["datacenter", "Nexus, spine/leaf, ACI, UCS/FI y fabric de datacenter."],
  ["campus", "Switching de distribucion/acceso, wireless y red de usuarios."],
  ["other", "Equipos no clasificados o sin informacion suficiente."],
  ["auto", "Permite que la herramienta infiera el segmento usando hostname, rol, modelo, plataforma y sitio."]
];

const confidentialityDisclaimer =
  "Este documento contiene informacion tecnica, operativa, topologica y potencialmente sensible del cliente. Su uso esta limitado exclusivamente al alcance del assessment acordado entre GBM y el cliente. La informacion debe tratarse como confidencial, resguardarse con controles razonables de seguridad, compartirse solo con personal autorizado y no copiarse, publicarse, reenviarse ni utilizarse para fines distintos al proyecto sin autorizacion escrita. La entrega, recepcion y manejo de este archivo se realizan bajo los compromisos de confidencialidad y NDA vigentes entre las partes. Al completar o enviar esta plantilla, el cliente confirma que la informacion incluida puede ser utilizada por GBM unicamente para analizar, documentar y preparar recomendaciones relacionadas con el assessment.";

type CellInput = string | { value: string; style?: number };

export async function exportInventoryTemplate(metadata: InventoryTemplateMetadata = {}) {
  const zip = new JSZip();
  const logo = await fetchLogo();

  zip.file("[Content_Types].xml", contentTypesXml(Boolean(logo)));
  zip.folder("_rels")?.file(".rels", rootRelsXml());
  zip.folder("xl")?.file("workbook.xml", workbookXml());
  zip.folder("xl")?.file("styles.xml", stylesXml());
  zip.folder("xl")?.folder("_rels")?.file("workbook.xml.rels", workbookRelsXml());
  zip.folder("xl")?.folder("worksheets")?.file("sheet1.xml", inventoryWorksheetXml(Boolean(logo), metadata));
  zip.folder("xl")?.folder("worksheets")?.file("sheet2.xml", guideWorksheetXml());

  if (logo) {
    zip.folder("xl")?.folder("worksheets")?.folder("_rels")?.file("sheet1.xml.rels", inventoryWorksheetRelsXml());
    zip.folder("xl")?.folder("drawings")?.file("drawing1.xml", logoDrawingXml());
    zip.folder("xl")?.folder("drawings")?.folder("_rels")?.file("drawing1.xml.rels", logoDrawingRelsXml());
    zip.folder("xl")?.folder("media")?.file("gbm-logo-blue.png", logo);
  }

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "assessment-inventory-template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

async function fetchLogo() {
  try {
    const response = await fetch("/brand/gbm-logo-blue.png");
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

function inventoryWorksheetXml(hasLogo: boolean, metadata: InventoryTemplateMetadata) {
  const generatedAt = metadata.generatedAt ?? new Date().toISOString();
  const rows = [
    row(1, ["", "", { value: "Template de Inventario para Assessment Tecnico", style: 1 }], { height: 26 }),
    row(2, ["", "", { value: "Uso confidencial bajo NDA entre GBM y el cliente", style: 2 }], { height: 20 }),
    row(4, [{ value: "Informacion del assessment", style: 5 }], { height: 22 }),
    row(5, [
      { value: "Cliente", style: 3 },
      { value: metadata.clientName?.trim() || "Pendiente", style: 4 },
      "",
      { value: "Proyecto / Assessment", style: 3 },
      { value: metadata.assessmentName?.trim() || "Pendiente", style: 4 },
      "",
      { value: "Estado", style: 3 },
      { value: metadata.status?.trim() || "Pendiente", style: 4 }
    ]),
    row(6, [
      { value: "Industria", style: 3 },
      { value: metadata.industry?.trim() || "Pendiente", style: 4 },
      "",
      { value: "Owner / Contacto", style: 3 },
      { value: metadata.owner?.trim() || "Pendiente", style: 4 },
      "",
      { value: "Dominios", style: 3 },
      { value: metadata.domains?.join(", ") || "Pendiente", style: 4 }
    ]),
    row(7, [
      { value: "Fecha creacion", style: 3 },
      { value: formatTemplateDate(metadata.assessmentCreatedAt), style: 4 },
      "",
      { value: "Ultima actualizacion", style: 3 },
      { value: formatTemplateDate(metadata.updatedAt), style: 4 },
      "",
      { value: "Fecha generacion", style: 3 },
      { value: formatTemplateDate(generatedAt), style: 4 }
    ]),
    row(9, [{ value: "Confidencialidad y manejo de informacion", style: 5 }], { height: 22 }),
    row(10, [{ value: confidentialityDisclaimer, style: 6 }], { height: 84 }),
    row(13, inventoryHeaders.map((value) => ({ value, style: 7 })), { height: 28 }),
    ...exampleRows.map((values, index) => row(14 + index, values.map((value) => ({ value, style: 8 }))))
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="13" topLeftCell="A14" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>
    ${[18, 16, 18, 22, 18, 16, 20, 18, 24, 14, 34].map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}
  </cols>
  <sheetData>${rows}</sheetData>
  <mergeCells count="5">
    <mergeCell ref="C1:K1"/>
    <mergeCell ref="C2:K2"/>
    <mergeCell ref="A4:K4"/>
    <mergeCell ref="A9:K9"/>
    <mergeCell ref="A10:K11"/>
  </mergeCells>
  ${hasLogo ? '<drawing r:id="rId1"/>' : ""}
</worksheet>`;
}

function guideWorksheetXml() {
  const rows = [
    row(1, [{ value: "Guia para completar el inventario", style: 9 }], { height: 26 }),
    row(3, [{ value: "Instrucciones", style: 5 }], { height: 22 }),
    row(4, [{ value: "Complete una fila por equipo incluido en el assessment. Mantenga los encabezados de la hoja Inventario sin cambios.", style: 6 }], { height: 32 }),
    row(5, [{ value: "Use Segmento Topologico para controlar donde aparecera el equipo en el grafo de Topologia. Si no esta seguro, use auto.", style: 6 }], { height: 32 }),
    row(7, [{ value: "Campos del inventario", style: 5 }], { height: 22 }),
    ...guideRows.map((values, index) => row(8 + index, values.map((value) => ({ value, style: index === 0 ? 11 : 8 })))),
    row(22, [{ value: "Segmentos topologicos", style: 5 }], { height: 22 }),
    ...segmentRows.map((values, index) => row(23 + index, values.map((value) => ({ value, style: index === 0 ? 11 : 8 }))))
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>
    <col min="1" max="1" width="26" customWidth="1"/>
    <col min="2" max="2" width="86" customWidth="1"/>
    <col min="3" max="3" width="48" customWidth="1"/>
  </cols>
  <sheetData>${rows}</sheetData>
  <mergeCells count="4">
    <mergeCell ref="A1:C1"/>
    <mergeCell ref="A3:C3"/>
    <mergeCell ref="A4:C4"/>
    <mergeCell ref="A5:C5"/>
  </mergeCells>
</worksheet>`;
}

function row(rowIndex: number, values: CellInput[], options: { style?: number; height?: number } = {}) {
  const rowAttributes = [`r="${rowIndex}"`];
  if (options.height) rowAttributes.push(`ht="${options.height}" customHeight="1"`);
  const cells = values
    .map((cell, columnIndex) => {
      const value = typeof cell === "string" ? cell : cell.value;
      const style = typeof cell === "string" ? options.style : cell.style ?? options.style;
      const ref = `${columnName(columnIndex + 1)}${rowIndex}`;
      return `<c r="${ref}"${style === undefined ? "" : ` s="${style}"`} t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
    })
    .join("");
  return `<row ${rowAttributes.join(" ")}>${cells}</row>`;
}

function columnName(index: number) {
  let name = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatTemplateDate(value?: string) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function contentTypesXml(hasLogo: boolean) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${hasLogo ? '<Default Extension="png" ContentType="image/png"/>' : ""}
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  ${hasLogo ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ""}
</Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Inventario" sheetId="1" r:id="rId1"/>
    <sheet name="Guia" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function inventoryWorksheetRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;
}

function logoDrawingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:oneCellAnchor>
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:ext cx="1645920" cy="925830"/>
    <xdr:pic>
      <xdr:nvPicPr><xdr:cNvPr id="2" name="GBM Logo"/><xdr:cNvPicPr/></xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>
</xdr:wsDr>`;
}

function logoDrawingRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/gbm-logo-blue.png"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><sz val="11"/><color rgb="FFEAF4FF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0B376D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF4FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F243E"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2F5597"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFB7C9D6"/></left>
      <right style="thin"><color rgb="FFB7C9D6"/></right>
      <top style="thin"><color rgb="FFB7C9D6"/></top>
      <bottom style="thin"><color rgb="FFB7C9D6"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="12">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`;
}
