import { NextResponse } from "next/server";
import {
  AdminAuthError,
  deleteAiInteractionLogs,
  listAiInteractionLogs,
  requireAdminUser
} from "@/lib/ai-debug";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const assessmentId = new URL(request.url).searchParams.get("assessmentId")?.trim() ?? "";
  if (!assessmentId) return NextResponse.json({ error: "assessmentId es requerido." }, { status: 400 });

  try {
    await requireAdminUser(request);
    return NextResponse.json({ interactions: await listAiInteractionLogs(assessmentId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const assessmentId = new URL(request.url).searchParams.get("assessmentId")?.trim() ?? "";
  if (!assessmentId) return NextResponse.json({ error: "assessmentId es requerido." }, { status: 400 });

  try {
    await requireAdminUser(request);
    return NextResponse.json({ ok: true, ...(await deleteAiInteractionLogs(assessmentId)) });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar debug AI." }, { status: 503 });
}
