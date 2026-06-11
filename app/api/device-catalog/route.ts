import { NextResponse } from "next/server";
import { AdminAuthError, requireAdminUser } from "@/lib/ai-debug";
import {
  deleteDeviceProfile,
  listDeviceProfileCatalog,
  upsertDeviceProfile
} from "@/lib/device-profiles-store";

export const runtime = "nodejs";

// Lectura publica: el render del faceplate necesita el catalogo (semilla + overrides) para todos.
export async function GET() {
  try {
    return NextResponse.json(await listDeviceProfileCatalog());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    const admin = await requireAdminUser(request, body);
    const profile = await upsertDeviceProfile(body?.profile ?? body, admin.email);
    const catalog = await listDeviceProfileCatalog();
    return NextResponse.json({ profile, ...catalog });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id es requerido." }, { status: 400 });
  try {
    await requireAdminUser(request);
    await deleteDeviceProfile(id);
    return NextResponse.json(await listDeviceProfileCatalog());
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo operar el catalogo de equipos." }, { status: 503 });
}
