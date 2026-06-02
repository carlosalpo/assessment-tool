import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PersistedDocumentTemplate = {
  id?: unknown;
  documentType?: unknown;
  templateName?: unknown;
  templateVersion?: unknown;
  templateFileName?: unknown;
  templateFileDataUrl?: unknown;
  uploadedBy?: unknown;
  uploadedAt?: unknown;
  status?: unknown;
  validationResult?: unknown;
  compatibleDefinitionVersion?: unknown;
  notes?: unknown;
};

export async function GET() {
  try {
    const snapshots = await prisma.documentTemplateSnapshot.findMany({
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({
      templates: snapshots.map((snapshot) => snapshot.data),
      source: "postgres"
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: databaseErrorMessage(error),
        templates: [],
        source: "postgres"
      },
      { status: 503 }
    );
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const templates = Array.isArray(body?.templates) ? (body.templates as PersistedDocumentTemplate[]) : null;

  if (!templates) {
    return NextResponse.json({ error: "Solicitud invalida: se requiere templates[]." }, { status: 400 });
  }

  try {
    const ids = templates.map((template) => String(template?.id ?? "")).filter(Boolean);

    await prisma.$transaction([
      prisma.documentTemplateSnapshot.deleteMany({
        where: ids.length > 0 ? { id: { notIn: ids } } : undefined
      }),
      ...templates.map((template) => {
        const summary = templateSummary(template);
        return prisma.documentTemplateSnapshot.upsert({
          where: { id: summary.id },
          create: {
            ...summary,
            validationResult: summary.validationResult,
            data: template as Prisma.InputJsonValue
          },
          update: {
            ...summary,
            validationResult: summary.validationResult,
            data: template as Prisma.InputJsonValue
          }
        });
      })
    ]);

    return NextResponse.json({
      ok: true,
      saved: templates.length,
      source: "postgres"
    });
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 503 });
  }
}

function templateSummary(template: PersistedDocumentTemplate) {
  const id = clean(template.id);
  if (!id) throw new Error("Plantilla sin id no puede persistirse.");

  return {
    id,
    documentType: clean(template.documentType) || "unknown",
    templateName: clean(template.templateName) || "Plantilla sin nombre",
    templateVersion: clean(template.templateVersion) || "v1",
    templateFileName: clean(template.templateFileName) || "template.docx",
    templateFileDataUrl: clean(template.templateFileDataUrl),
    uploadedBy: clean(template.uploadedBy) || "Local user",
    uploadedAt: parseDate(template.uploadedAt),
    status: clean(template.status) || "draft",
    validationResult: (template.validationResult ?? {}) as Prisma.InputJsonValue,
    compatibleDefinitionVersion: clean(template.compatibleDefinitionVersion) || "unknown",
    notes: clean(template.notes)
  };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function databaseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `No se pudo acceder a PostgreSQL: ${error.message}`;
  }
  return "No se pudo acceder a PostgreSQL.";
}
