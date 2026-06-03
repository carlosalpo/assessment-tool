import { NextResponse } from "next/server";
import {
  deleteCiscoApiToken,
  getCiscoCredentialMetadata,
  saveCiscoApiToken
} from "@/lib/server-credentials";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ credential: await getCiscoCredentialMetadata() });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const apiToken = typeof body?.apiToken === "string" ? body.apiToken.trim() : "";
  const updatedBy = typeof body?.updatedBy === "string" ? body.updatedBy.trim() : undefined;
  if (!apiToken) {
    return NextResponse.json({ error: "Solicitud invalida: apiToken es requerido." }, { status: 400 });
  }

  try {
    return NextResponse.json({ credential: await saveCiscoApiToken(apiToken, updatedBy) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    return NextResponse.json({ credential: await deleteCiscoApiToken() });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo actualizar la credencial Cisco.";
}
