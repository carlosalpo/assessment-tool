import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";

const maxCapturedJsonChars = 200 * 1024;

export type AiDebugSettingSnapshot = {
  assessmentId: string;
  captureEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type CreateAiInteractionLogInput = {
  jobId: string;
  assessmentId: string;
  scopeId: string;
  phaseName: string;
  model: string;
  promptVersion: string;
  engineVersion: string;
  httpStatus?: number | null;
  status: "ok" | "error" | "timeout";
  latencyMs?: number | null;
  inputTokensEst?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  budgetTrimmed?: boolean;
  excludedEvidenceRefs?: number;
  requestJson: unknown;
  responseJson?: unknown;
  rejectedFindings?: unknown;
};

export async function getAiDebugSetting(assessmentId: string): Promise<AiDebugSettingSnapshot> {
  const setting = await prisma.aiDebugSetting.findUnique({ where: { assessmentId } });
  return {
    assessmentId,
    captureEnabled: Boolean(setting?.captureEnabled),
    updatedBy: setting?.updatedBy ?? null,
    updatedAt: setting?.updatedAt?.toISOString() ?? null
  };
}

export async function setAiDebugSetting(input: { assessmentId: string; captureEnabled: boolean; updatedBy?: string | null }) {
  const setting = await prisma.aiDebugSetting.upsert({
    where: { assessmentId: input.assessmentId },
    create: {
      assessmentId: input.assessmentId,
      captureEnabled: input.captureEnabled,
      updatedBy: input.updatedBy ?? null
    },
    update: {
      captureEnabled: input.captureEnabled,
      updatedBy: input.updatedBy ?? null
    }
  });
  return {
    assessmentId: setting.assessmentId,
    captureEnabled: setting.captureEnabled,
    updatedBy: setting.updatedBy,
    updatedAt: setting.updatedAt.toISOString()
  };
}

export async function listAiInteractionLogs(assessmentId: string) {
  const logs = await prisma.aiInteractionLog.findMany({
    where: { assessmentId },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return logs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString()
  }));
}

export async function deleteAiInteractionLogs(assessmentId: string) {
  const result = await prisma.aiInteractionLog.deleteMany({ where: { assessmentId } });
  return { deleted: result.count };
}

export async function createAiInteractionLog(input: CreateAiInteractionLogInput) {
  return prisma.aiInteractionLog.create({
    data: {
      jobId: input.jobId,
      assessmentId: input.assessmentId,
      scopeId: input.scopeId,
      phaseName: input.phaseName,
      model: input.model,
      promptVersion: input.promptVersion,
      engineVersion: input.engineVersion,
      httpStatus: input.httpStatus ?? null,
      status: input.status,
      latencyMs: input.latencyMs ?? null,
      inputTokensEst: input.inputTokensEst ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      budgetTrimmed: Boolean(input.budgetTrimmed),
      excludedEvidenceRefs: input.excludedEvidenceRefs ?? 0,
      requestJson: sanitizeCapturedJson(input.requestJson) as Prisma.InputJsonValue,
      responseJson: input.responseJson === undefined ? undefined : sanitizeCapturedJson(input.responseJson) as Prisma.InputJsonValue,
      rejectedFindings: input.rejectedFindings === undefined ? undefined : sanitizeCapturedJson(input.rejectedFindings) as Prisma.InputJsonValue
    }
  });
}

export async function createAiInteractionLogSafely(input: CreateAiInteractionLogInput) {
  try {
    await createAiInteractionLog(input);
  } catch (error) {
    console.warn("AI debug capture failed", error instanceof Error ? error.message : error);
  }
}

export async function requireAdminUser(request: Request, body?: unknown) {
  const requestedBy = requestedByFromRequest(request, body).toLowerCase();
  if (!requestedBy) throw new AdminAuthError("Admin requerido para operar debug AI.");
  const user = await prisma.assessmentUserSnapshot.findFirst({
    where: {
      email: requestedBy,
      role: "admin",
      status: "active"
    }
  });
  if (!user) throw new AdminAuthError("Admin requerido para operar debug AI.");
  return { id: user.id, email: user.email, name: user.name };
}

export class AdminAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export function sanitizeCapturedJson(value: unknown): unknown {
  const redacted = redactSensitiveKeys(value);
  const serialized = JSON.stringify(redacted);
  if (serialized.length <= maxCapturedJsonChars) return redacted;
  return {
    truncated: true,
    originalChars: serialized.length,
    preview: serialized.slice(0, maxCapturedJsonChars)
  };
}

export function extractOpenAIUsage(payload: any) {
  const usage = payload?.usage ?? {};
  return {
    inputTokens: numberOrNull(usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens),
    outputTokens: numberOrNull(usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens)
  };
}

function requestedByFromRequest(request: Request, body?: unknown) {
  const url = new URL(request.url);
  const fromHeader = request.headers.get("x-user-email") || request.headers.get("x-updated-by") || request.headers.get("x-requested-by");
  const fromQuery = url.searchParams.get("updatedBy") || url.searchParams.get("requestedBy");
  const fromBody = typeof (body as any)?.updatedBy === "string"
    ? (body as any).updatedBy
    : typeof (body as any)?.requestedBy === "string"
      ? (body as any).requestedBy
      : "";
  return (fromHeader || fromQuery || fromBody || "").trim();
}

function redactSensitiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveKeys);
  if (!value || typeof value !== "object") return redactSensitiveString(value);

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
    if (/authorization|api[_-]?key|token|secret|password|bearer/i.test(key)) return [key, "[REDACTED]"];
    return [key, redactSensitiveKeys(item)];
  }));
}

function redactSensitiveString(value: unknown) {
  if (typeof value !== "string") return value;
  return value.replace(/Bearer\s+[A-Za-z0-9._\-]+/g, "Bearer [REDACTED]");
}

function numberOrNull(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
