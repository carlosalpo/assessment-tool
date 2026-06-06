import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import {
  defaultConfigurationScopePlaybook,
  normalizeScopePlaybook,
  scopePlaybookHash,
  type ExclusionRule,
  type ScopePlaybook
} from "./scope-playbook.ts";

export type ScopePlaybookSnapshot = ScopePlaybook & {
  hash: string;
};

export async function getScopePlaybook(scopeId: string): Promise<ScopePlaybookSnapshot> {
  const record = await prisma.scopePlaybook.findUnique({ where: { scopeId } });
  if (!record && scopeId === "configuration") {
    const seeded = await prisma.scopePlaybook.upsert({
      where: { scopeId },
      create: scopePlaybookToPrisma(defaultConfigurationScopePlaybook),
      update: {}
    });
    return scopePlaybookSnapshot(seeded);
  }
  if (!record) throw new Error(`Playbook no encontrado para ${scopeId}.`);
  return scopePlaybookSnapshot(record);
}

export async function upsertScopePlaybook(input: ScopePlaybook & { updatedBy?: string | null }): Promise<ScopePlaybookSnapshot> {
  if (input.scopeId !== "configuration") throw new Error("El prototipo solo permite editar el playbook de configuration.");
  const playbook = normalizeScopePlaybook(input);
  const record = await prisma.scopePlaybook.upsert({
    where: { scopeId: playbook.scopeId },
    create: scopePlaybookToPrisma({ ...playbook, updatedBy: input.updatedBy ?? playbook.updatedBy ?? null }),
    update: {
      criteriaJson: playbook.criteria as unknown as Prisma.InputJsonValue,
      expectedJson: playbook.expected as unknown as Prisma.InputJsonValue,
      exclusionsJson: playbook.exclusions as unknown as Prisma.InputJsonValue,
      updatedBy: input.updatedBy ?? playbook.updatedBy ?? null
    }
  });
  return scopePlaybookSnapshot(record);
}

export async function appendScopePlaybookExclusion(input: {
  scopeId: string;
  rule: ExclusionRule;
  updatedBy?: string | null;
}): Promise<ScopePlaybookSnapshot> {
  if (input.scopeId !== "configuration") throw new Error("El prototipo solo permite exclusiones en configuration.");
  const current = await getScopePlaybook(input.scopeId);
  return upsertScopePlaybook({
    ...current,
    exclusions: [...current.exclusions, input.rule],
    updatedBy: input.updatedBy ?? current.updatedBy ?? null
  });
}

function scopePlaybookSnapshot(record: {
  scopeId: string;
  criteriaJson: unknown;
  expectedJson: unknown;
  exclusionsJson: unknown;
  updatedBy?: string | null;
  updatedAt?: Date | string | null;
}): ScopePlaybookSnapshot {
  const playbook = normalizeScopePlaybook({
    scopeId: record.scopeId,
    criteria: record.criteriaJson as any,
    expected: record.expectedJson as any,
    exclusions: record.exclusionsJson as any,
    updatedBy: record.updatedBy ?? null,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt ?? null
  });
  return {
    ...playbook,
    hash: scopePlaybookHash(playbook)
  };
}

function scopePlaybookToPrisma(playbook: ScopePlaybook) {
  const normalized = normalizeScopePlaybook(playbook);
  return {
    scopeId: normalized.scopeId,
    criteriaJson: normalized.criteria as unknown as Prisma.InputJsonValue,
    expectedJson: normalized.expected as unknown as Prisma.InputJsonValue,
    exclusionsJson: normalized.exclusions as unknown as Prisma.InputJsonValue,
    updatedBy: normalized.updatedBy ?? null
  };
}
