import { NextResponse } from "next/server";
import {
  AdminAuthError,
  getAiDebugSetting,
  requireAdminUser,
  setAiDebugSetting
} from "@/lib/ai-debug";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const assessmentId = new URL(request.url).searchParams.get("assessmentId")?.trim() ?? "";
  if (!assessmentId) return NextResponse.json({ error: "assessmentId es requerido." }, { status: 400 });

  try {
    await requireAdminUser(request);
    return NextResponse.json({ setting: await getAiDebugSetting(assessmentId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  return updateSetting(request);
}

export async function PUT(request: Request) {
  return updateSetting(request);
}

async function updateSetting(request: Request) {
  const body = await request.json().catch(() => null);
  const assessmentId = typeof body?.assessmentId === "string" ? body.assessmentId.trim() : "";
  if (!assessmentId || typeof body?.captureEnabled !== "boolean") {
    return NextResponse.json({ error: "Solicitud invalida: assessmentId y captureEnabled son requeridos." }, { status: 400 });
  }

  try {
    const admin = await requireAdminUser(request, body);
    const updatedBy = typeof body?.updatedBy === "string" && body.updatedBy.trim() ? body.updatedBy.trim() : admin.email;
    return NextResponse.json({
      setting: await setAiDebugSetting({
        assessmentId,
        captureEnabled: body.captureEnabled,
        updatedBy
      })
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar debug AI." }, { status: 503 });
}
