import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.ts";
import {
  DEFAULT_DEVICE_PROFILES,
  normalizeDeviceProfile,
  type DeviceVisualProfile
} from "./device-profiles.ts";

export type DeviceProfileCatalog = {
  profiles: DeviceVisualProfile[];
  overrideIds: string[];
};

type DeviceProfileRecord = {
  id: string;
  scope: string;
  vendor: string;
  category: string;
  title: string;
  matchJson: unknown;
  uplinkBaySlots: number | null;
  sectionsJson: unknown;
  updatedBy?: string | null;
  updatedAt?: Date | string | null;
};

function recordToProfile(record: DeviceProfileRecord): DeviceVisualProfile {
  return normalizeDeviceProfile({
    id: record.id,
    scope: record.scope,
    vendor: record.vendor,
    category: record.category,
    title: record.title,
    match: record.matchJson,
    uplinkBaySlots: record.uplinkBaySlots ?? undefined,
    sections: record.sectionsJson,
    updatedBy: record.updatedBy ?? null,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt ?? undefined
  });
}

function profileToPrisma(profile: DeviceVisualProfile) {
  return {
    id: profile.id,
    scope: profile.scope,
    vendor: profile.vendor,
    category: profile.category,
    title: profile.title,
    matchJson: profile.match as unknown as Prisma.InputJsonValue,
    uplinkBaySlots: profile.uplinkBaySlots ?? null,
    sectionsJson: profile.sections as unknown as Prisma.InputJsonValue,
    updatedBy: profile.updatedBy ?? null
  };
}

// Los overrides en DB son opcionales: si la migracion aun no corre, el catalogo cae a la semilla.
async function findOverrides(): Promise<DeviceProfileRecord[]> {
  try {
    return await prisma.deviceVisualProfile.findMany();
  } catch (error) {
    console.warn("Device profile overrides no disponibles (¿migracion pendiente?):", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function listDeviceProfileCatalog(): Promise<DeviceProfileCatalog> {
  const overrides = await findOverrides();
  const byId = new Map<string, DeviceVisualProfile>();
  for (const seed of DEFAULT_DEVICE_PROFILES) byId.set(seed.id, seed);
  const overrideIds: string[] = [];
  for (const record of overrides) {
    try {
      byId.set(record.id, recordToProfile(record));
      overrideIds.push(record.id);
    } catch (error) {
      console.warn(`Perfil de equipo invalido en DB (${record.id}):`, error instanceof Error ? error.message : error);
    }
  }
  const profiles = Array.from(byId.values()).sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: "base" }));
  return { profiles, overrideIds };
}

export async function upsertDeviceProfile(input: unknown, updatedBy?: string | null): Promise<DeviceVisualProfile> {
  const profile = normalizeDeviceProfile(input);
  profile.updatedBy = updatedBy ?? profile.updatedBy ?? null;
  const data = profileToPrisma(profile);
  const record = await prisma.deviceVisualProfile.upsert({
    where: { id: profile.id },
    create: data,
    update: data
  });
  return recordToProfile(record);
}

export async function deleteDeviceProfile(id: string): Promise<void> {
  try {
    await prisma.deviceVisualProfile.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return; // no existia
    throw error;
  }
}
