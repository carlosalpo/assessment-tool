import { NextResponse } from "next/server";
import {
  deleteOpenAIApiKey,
  getOpenAICredentialMetadata,
  saveOpenAIApiKey
} from "@/lib/server-credentials";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ credential: await getOpenAICredentialMetadata() });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const updatedBy = typeof body?.updatedBy === "string" ? body.updatedBy.trim() : undefined;
  if (!apiKey) {
    return NextResponse.json({ error: "Solicitud invalida: apiKey es requerida." }, { status: 400 });
  }

  try {
    return NextResponse.json({ credential: await saveOpenAIApiKey(apiKey, updatedBy) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    return NextResponse.json({ credential: await deleteOpenAIApiKey() });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo actualizar la credencial OpenAI.";
}
