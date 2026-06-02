import assert from "node:assert/strict";
import test from "node:test";
import {
  activateTemplateVersion,
  compareTemplateWithCurrentDefinition,
  documentTemplateDefinitions,
  extractPlaceholdersFromDocx,
  generateBaseTemplate,
  mapAssessmentDataToPlaceholders,
  replacePlaceholdersInWordXml,
  validatePlaceholderSet,
  validateUploadedTemplate,
  type DocumentTemplateVersion
} from "./document-templates.ts";

test("generateBaseTemplate includes required placeholders", async () => {
  const docx = await generateBaseTemplate("sow");
  const found = await extractPlaceholdersFromDocx(docx);
  const required = documentTemplateDefinitions.sow.placeholders.filter((placeholder) => placeholder.required).map((placeholder) => placeholder.placeholderSyntax);

  for (const placeholder of required) {
    assert.ok(found.includes(placeholder), `${placeholder} should be present in base template`);
  }
});

test("validateUploadedTemplate blocks missing required placeholders", async () => {
  const docx = await generateBaseTemplate("findings_report");
  const validResult = await validateUploadedTemplate(docx, "findings_report");
  assert.equal(validResult.canActivate, true);

  const missingResult = validatePlaceholderSet(["{{client.name}}"], "findings_report");
  assert.equal(missingResult.canActivate, false);
  assert.ok(missingResult.missingRequiredPlaceholders.includes("{{assessment.name}}"));
});

test("validateUploadedTemplate rejects non-docx packages", async () => {
  await assert.rejects(() => validateUploadedTemplate(new Blob(["not a docx"]), "sow"), /no es un DOCX valido/);
});

test("replacePlaceholdersInWordXml handles placeholders split across Word runs", () => {
  const xml = [
    "<w:p>",
    "<w:r><w:rPr><w:b/></w:rPr><w:t>{{client.</w:t></w:r>",
    "<w:r><w:rPr><w:i/></w:rPr><w:t>name}}</w:t></w:r>",
    "<w:r><w:t> keeps format</w:t></w:r>",
    "</w:p>"
  ].join("");

  const rendered = replacePlaceholdersInWordXml(xml, { "{{client.name}}": "Cliente Demo" });

  assert.match(rendered, /Cliente Demo/);
  assert.doesNotMatch(rendered, /{{client\.name}}/);
  assert.match(rendered, /<w:b\/>/);
  assert.match(rendered, /<w:i\/>/);
  assert.match(rendered, / keeps format/);
});

test("replacePlaceholdersInWordXml renders SOW inventory as Word table", () => {
  const values = mapAssessmentDataToPlaceholders(
    {
      targetInventory: [
        {
          hostname: "core-9500-01",
          managementIp: "10.10.0.11",
          model: "C9500-48Y4C",
          serial: "FCW2148L0AB",
          deviceType: "switch",
          role: "core",
          site: "HQ",
          priority: "high",
          included: true
        }
      ]
    },
    "sow"
  );
  const xml = "<w:p><w:r><w:t>{{sow.inventoryTable}}</w:t></w:r></w:p>";

  const rendered = replacePlaceholdersInWordXml(xml, values);

  assert.match(rendered, /<w:tbl>/);
  assert.match(rendered, /Hostname/);
  assert.match(rendered, /core-9500-01/);
  assert.doesNotMatch(rendered, /{{sow\.inventoryTable}}/);
});

test("replacePlaceholdersInWordXml removes disabled performance conditional blocks", () => {
  const values = mapAssessmentDataToPlaceholders(
    {
      scope: {
        performanceAnalysis: {
          enabled: false,
          mode: "snapshot",
          expectedEvidenceTypes: [],
          includedMetrics: []
        }
      }
    },
    "sow"
  );
  const xml = [
    "<w:p><w:r><w:t>{{#if sow.performance.enabled}}</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Performance section should disappear</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>{{sow.performance.scope}}</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>{{/if}}</w:t></w:r></w:p>",
    "<w:p><w:r><w:t>Next section</w:t></w:r></w:p>"
  ].join("");

  const rendered = replacePlaceholdersInWordXml(xml, values);

  assert.doesNotMatch(rendered, /Performance section should disappear/);
  assert.doesNotMatch(rendered, /sow\.performance/);
  assert.match(rendered, /Next section/);
});

test("compareTemplateWithCurrentDefinition detects compatible templates", async () => {
  const docx = await generateBaseTemplate("sow");
  const validationResult = await validateUploadedTemplate(docx, "sow");
  const template: DocumentTemplateVersion = {
    id: "tpl_test",
    documentType: "sow",
    templateName: "SOW base",
    templateVersion: "v1",
    templateFileName: "sow.docx",
    templateFileDataUrl: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,",
    uploadedBy: "test",
    uploadedAt: new Date().toISOString(),
    status: "valid",
    validationResult,
    missingRequiredPlaceholders: [],
    extraPlaceholders: [],
    compatibleDefinitionVersion: validationResult.definitionVersion,
    notes: ""
  };

  assert.equal(compareTemplateWithCurrentDefinition(template).compatibilityStatus, "compatible");
});

test("activateTemplateVersion archives previous active template", () => {
  const validationResult = validatePlaceholderSet(
    documentTemplateDefinitions.sow.placeholders.map((placeholder) => placeholder.placeholderSyntax),
    "sow"
  );
  const versions: DocumentTemplateVersion[] = [
    {
      id: "tpl_old",
      documentType: "sow",
      templateName: "Old",
      templateVersion: "v1",
      templateFileName: "old.docx",
      templateFileDataUrl: "",
      uploadedBy: "test",
      uploadedAt: new Date().toISOString(),
      status: "active",
      validationResult,
      missingRequiredPlaceholders: [],
      extraPlaceholders: [],
      compatibleDefinitionVersion: validationResult.definitionVersion,
      notes: ""
    },
    {
      id: "tpl_new",
      documentType: "sow",
      templateName: "New",
      templateVersion: "v2",
      templateFileName: "new.docx",
      templateFileDataUrl: "",
      uploadedBy: "test",
      uploadedAt: new Date().toISOString(),
      status: "valid",
      validationResult,
      missingRequiredPlaceholders: [],
      extraPlaceholders: [],
      compatibleDefinitionVersion: validationResult.definitionVersion,
      notes: ""
    }
  ];

  const activated = activateTemplateVersion(versions, "tpl_new");
  assert.equal(activated.find((template) => template.id === "tpl_old")?.status, "archived");
  assert.equal(activated.find((template) => template.id === "tpl_new")?.status, "active");
  assert.equal(activated.find((template) => template.id === "tpl_new")?.auditTrail?.at(-1)?.action, "activated");
});

test("mapAssessmentDataToPlaceholders keeps SOW and findings data separated", () => {
  const sowMap = mapAssessmentDataToPlaceholders(
    {
      client: { name: "Cliente Demo", industry: "Retail", owner: "Arquitecto" },
      assessment: { name: "Assessment Demo", domains: ["enterprise-networking"] },
      scope: { objectives: ["Validar inventario"], deliverables: ["SOW"], businessContext: "Contexto" }
    },
    "sow"
  );
  const findingsMap = mapAssessmentDataToPlaceholders(
    {
      client: { name: "Cliente Demo" },
      assessment: { name: "Assessment Demo" },
      parsed: { findings: [{ id: "F-1", title: "Hallazgo", risk: "high", evidence: ["show version"], recommendation: "Corregir" }] }
    },
    "findings_report"
  );

  assert.equal(sowMap["{{client.name}}"], "Cliente Demo");
  assert.equal(sowMap["{{sow.objectives}}"], "Validar inventario");
  assert.equal(findingsMap["{{finding.title}}"], "Hallazgo");
  assert.equal(sowMap["{{finding.title}}"], undefined);
});
