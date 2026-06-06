import { NextResponse } from "next/server";
import {
  AdminAuthError,
  requireAdminUser
} from "@/lib/ai-debug";
import {
  deriveReviewFeedbackExclusionRule,
  isSupportedScopePlaybookScopeId,
  normalizeScopePlaybook,
  type ExclusionRule
} from "@/lib/scope-playbook";
import {
  appendScopePlaybookExclusion,
  getScopePlaybook,
  upsertScopePlaybook
} from "@/lib/scope-playbook-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const scopeId = scopeIdFromRequest(request);
  const invalid = unsupportedScopeResponse(scopeId);
  if (invalid) return invalid;

  try {
    await requireAdminUser(request);
    return NextResponse.json({ playbook: await getScopePlaybook(scopeId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const scopeId = typeof body?.scopeId === "string" ? body.scopeId.trim() : "";
  const invalid = unsupportedScopeResponse(scopeId);
  if (invalid) return invalid;

  try {
    const admin = await requireAdminUser(request, body);
    const playbook = normalizeScopePlaybook({
      scopeId,
      criteria: body?.criteria,
      expected: body?.expected,
      exclusions: body?.exclusions,
      updatedBy: typeof body?.updatedBy === "string" ? body.updatedBy : admin.email
    });
    return NextResponse.json({
      playbook: await upsertScopePlaybook({ ...playbook, updatedBy: playbook.updatedBy ?? admin.email })
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const scopeId = typeof body?.scopeId === "string" ? body.scopeId.trim() : scopeIdFromRequest(request);
  const invalid = unsupportedScopeResponse(scopeId);
  if (invalid) return invalid;

  try {
    const admin = await requireAdminUser(request, body);
    const rule = ruleFromBody(body, scopeId);
    return NextResponse.json({
      playbook: await appendScopePlaybookExclusion({
        scopeId,
        rule,
        updatedBy: typeof body?.updatedBy === "string" ? body.updatedBy : admin.email
      }),
      rule
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function ruleFromBody(body: any, scopeId: string): ExclusionRule {
  if (body?.rule && typeof body.rule === "object") {
    const normalized = normalizeScopePlaybook({
      scopeId,
      exclusions: [body.rule]
    }).exclusions[0];
    if (!normalized) throw new Error("Regla de exclusion invalida.");
    return normalized;
  }

  const title = String(body?.finding?.title ?? body?.title ?? "").trim();
  if (!title) throw new Error("title o finding.title es requerido para derivar una exclusion.");
  return deriveReviewFeedbackExclusionRule({
    title,
    findingType: body?.finding?.finding_type ?? body?.findingType ?? null,
    reason: body?.reason ?? "Hallazgo descartado en revision; suprimir similares.",
    appliesTo: body?.appliesTo
  });
}

function scopeIdFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("scopeId")?.trim() ?? "";
}

function unsupportedScopeResponse(scopeId: string) {
  if (isSupportedScopePlaybookScopeId(scopeId)) return null;
  return NextResponse.json({
    error: "scopeId debe ser configuration, security, evidence o performance."
  }, { status: 400 });
}

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo operar el playbook." }, { status: 503 });
}
