import { NextResponse } from "next/server";
import {
  deleteCiscoOAuthCredential,
  getCiscoCredentialMetadata,
  saveCiscoOAuthCredential
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
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret = typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";
  const updatedBy = typeof body?.updatedBy === "string" ? body.updatedBy.trim() : undefined;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Solicitud invalida: clientId y clientSecret son requeridos." }, { status: 400 });
  }

  try {
    return NextResponse.json({ credential: await saveCiscoOAuthCredential({ clientId, clientSecret }, updatedBy) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    return NextResponse.json({ credential: await deleteCiscoOAuthCredential() });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo actualizar la credencial Cisco.";
}
