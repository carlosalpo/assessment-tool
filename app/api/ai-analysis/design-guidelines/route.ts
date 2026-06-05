import { NextResponse } from "next/server";
import {
  AdminAuthError,
  requireAdminUser
} from "@/lib/ai-debug";
import {
  deleteTopologyDesignGuideline,
  getTopologyDesignGuidelineRecords,
  resolveDesignGuidelines,
  topologyDesignGuidelineGlobalScopeKey,
  topologyDesignGuidelineSnapshot,
  upsertTopologyDesignGuideline
} from "@/lib/ai-design-guidelines";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const scopeKey = scopeKeyFromUrl(request);
  if (!scopeKey) return NextResponse.json({ error: "scopeKey es requerido." }, { status: 400 });

  try {
    await requireAdminUser(request);
    return NextResponse.json(await guidelineResponse(scopeKey));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const scopeKey = typeof body?.scopeKey === "string" ? body.scopeKey.trim() : "";
  const content = typeof body?.content === "string" ? body.content : null;
  if (!scopeKey || content === null) {
    return NextResponse.json({ error: "Solicitud invalida: scopeKey y content son requeridos." }, { status: 400 });
  }

  try {
    const admin = await requireAdminUser(request, body);
    const updatedBy = typeof body?.updatedBy === "string" && body.updatedBy.trim() ? body.updatedBy.trim() : admin.email;
    await upsertTopologyDesignGuideline({ scopeKey, content, updatedBy });
    return NextResponse.json(await guidelineResponse(scopeKey));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const scopeKey = scopeKeyFromUrl(request);
  if (!scopeKey) return NextResponse.json({ error: "scopeKey es requerido." }, { status: 400 });
  if (scopeKey === topologyDesignGuidelineGlobalScopeKey) {
    return NextResponse.json({ error: "El default global no se elimina; edita su contenido o limpia overrides por assessment." }, { status: 400 });
  }

  try {
    await requireAdminUser(request);
    const result = await deleteTopologyDesignGuideline(scopeKey);
    return NextResponse.json({ ok: true, ...result, ...(await guidelineResponse(scopeKey)) });
  } catch (error) {
    return errorResponse(error);
  }
}

async function guidelineResponse(scopeKey: string) {
  const keys = scopeKey === topologyDesignGuidelineGlobalScopeKey
    ? [topologyDesignGuidelineGlobalScopeKey]
    : [scopeKey, topologyDesignGuidelineGlobalScopeKey];
  const records = await getTopologyDesignGuidelineRecords(keys);
  const requestedRecord = records.find((record) => record.scopeKey === scopeKey) ?? null;
  return {
    scopeKey,
    guideline: resolveDesignGuidelines(scopeKey, records),
    record: requestedRecord ? topologyDesignGuidelineSnapshot(requestedRecord) : null
  };
}

function scopeKeyFromUrl(request: Request) {
  return new URL(request.url).searchParams.get("scopeKey")?.trim() ?? "";
}

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo operar guidelines de diseno." }, { status: 503 });
}
