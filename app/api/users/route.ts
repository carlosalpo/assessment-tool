import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PersistedUser = {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  role?: unknown;
  status?: unknown;
};

export async function GET() {
  try {
    const snapshots = await prisma.assessmentUserSnapshot.findMany({
      orderBy: { updatedAt: "desc" }
    });

    return NextResponse.json({
      users: snapshots.map((snapshot) => snapshot.data),
      source: "postgres"
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: databaseErrorMessage(error),
        users: [],
        source: "postgres"
      },
      { status: 503 }
    );
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const users = Array.isArray(body?.users) ? (body.users as PersistedUser[]) : null;

  if (!users) {
    return NextResponse.json({ error: "Solicitud invalida: se requiere users[]." }, { status: 400 });
  }

  try {
    const ids = users.map((user) => String(user?.id ?? "")).filter(Boolean);

    await prisma.$transaction([
      prisma.assessmentUserSnapshot.deleteMany({
        where: ids.length > 0 ? { id: { notIn: ids } } : undefined
      }),
      ...users.map((user) => {
        const summary = userSummary(user);
        return prisma.assessmentUserSnapshot.upsert({
          where: { id: summary.id },
          create: {
            ...summary,
            data: user as Prisma.InputJsonValue
          },
          update: {
            ...summary,
            data: user as Prisma.InputJsonValue
          }
        });
      })
    ]);

    return NextResponse.json({ ok: true, saved: users.length, source: "postgres" });
  } catch (error) {
    return NextResponse.json({ error: databaseErrorMessage(error) }, { status: 503 });
  }
}

function userSummary(user: PersistedUser) {
  const id = clean(user.id);
  if (!id) throw new Error("Usuario sin id no puede persistirse.");

  return {
    id,
    name: clean(user.name) || "Usuario sin nombre",
    email: clean(user.email).toLowerCase() || "sin-email@local",
    role: clean(user.role) || "viewer",
    status: clean(user.status) || "active"
  };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function databaseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `No se pudo acceder a PostgreSQL: ${error.message}`;
  }
  return "No se pudo acceder a PostgreSQL.";
}
