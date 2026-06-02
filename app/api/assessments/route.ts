import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PersistedAssessmentRecord = {
  id?: unknown;
  client?: { name?: unknown };
  assessment?: { id?: unknown; name?: unknown; status?: unknown };
  updatedAt?: unknown;
};

export async function GET() {
  try {
    const snapshots = await prisma.assessmentSnapshot.findMany({
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({
      records: snapshots.map((snapshot) => snapshot.data),
      source: "postgres"
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: databaseErrorMessage(error),
        records: [],
        source: "postgres"
      },
      { status: 503 }
    );
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const records = Array.isArray(body?.records) ? (body.records as PersistedAssessmentRecord[]) : null;

  if (!records) {
    return NextResponse.json({ error: "Solicitud invalida: se requiere records[]." }, { status: 400 });
  }

  try {
    const ids = records.map((record: PersistedAssessmentRecord) => String(record?.id ?? "")).filter(Boolean);

    await prisma.$transaction([
      prisma.assessmentSnapshot.deleteMany({
        where: ids.length > 0 ? { id: { notIn: ids } } : undefined
      }),
      ...records.map((record: PersistedAssessmentRecord) => {
        const summary = snapshotSummary(record);
        return prisma.assessmentSnapshot.upsert({
          where: { id: summary.id },
          create: {
            id: summary.id,
            clientName: summary.clientName,
            assessmentName: summary.assessmentName,
            status: summary.status,
            recordUpdatedAt: summary.recordUpdatedAt,
            data: record as Prisma.InputJsonValue
          },
          update: {
            clientName: summary.clientName,
            assessmentName: summary.assessmentName,
            status: summary.status,
            recordUpdatedAt: summary.recordUpdatedAt,
            data: record as Prisma.InputJsonValue
          }
        });
      })
    ]);

    return NextResponse.json({
      ok: true,
      saved: records.length,
      source: "postgres"
    });
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 503 });
  }
}

function snapshotSummary(record: any) {
  const id = String(record?.id ?? record?.assessment?.id ?? "");
  if (!id) throw new Error("Assessment sin id no puede persistirse.");

  return {
    id,
    clientName: clean(record?.client?.name) || "Cliente sin nombre",
    assessmentName: clean(record?.assessment?.name) || "Assessment sin nombre",
    status: clean(record?.assessment?.status) || "draft",
    recordUpdatedAt: parseDate(record?.updatedAt)
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
