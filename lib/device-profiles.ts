// Cisco Faceplate Renderer — motor de perfiles visuales por modelo.
//
// Un "perfil visual" NO es una imagen: es una definicion estructurada del layout fisico
// aproximado de un equipo (secciones, medios, conteos, patrones de nombre). El render
// consume este perfil para dibujar el faceplate de forma consistente.
//
// La resolucion sigue una jerarquia: exacto (PID) -> familia -> inferido -> generico,
// exponiendo siempre el nivel de confianza para no fingir precision.

export type PortMedia = "RJ45" | "SFP" | "SFP+" | "SFP28" | "QSFP+" | "QSFP28" | "RJ45-mgmt";
export type SectionRole = "downlink" | "uplink" | "mgmt";
export type DeviceCategory = "switch" | "router" | "firewall" | "generic";
export type ProfileScope = "exact" | "family" | "generic";
export type LayoutConfidence = "exact" | "family" | "inferred" | "generic";

export type ProfileSection = {
  id: string;
  label: string;
  role: SectionRole;
  media: PortMedia;
  speed: string;
  count: number;
  namePattern: string; // contiene {n}
  startIndex: number;
  rows: 1 | 2;
  blockSize?: number;
};

export type DeviceVisualProfile = {
  id: string;
  scope: ProfileScope;
  vendor: "cisco";
  category: DeviceCategory;
  title: string;
  match: { pids?: string[]; familyPatterns?: string[] };
  uplinkBaySlots?: number;
  sections: ProfileSection[];
  updatedBy?: string | null;
  updatedAt?: string;
};

export type ProfileSlot = {
  sectionId: string;
  role: SectionRole;
  media: PortMedia;
  speed: string;
  index: number; // {n}
  name: string; // nombre canonico generado del patron
  blockSize?: number;
  rows: 1 | 2;
};

export type ProfileMatch = {
  profile: DeviceVisualProfile | null;
  match: "exact" | "family" | "none";
};

// --- Normalizacion ----------------------------------------------------------

export function normalizePid(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Clave canonica para enlazar interfaces observadas con slots del perfil.
// Unifica prefijos largos/cortos de Cisco (Gi/Te/Twe/Fo/Hu/Eth/Mgmt...).
export function canonicalInterfaceKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^twentyfivegigabitethernet/, "twe")
    .replace(/^twentyfivegige/, "twe")
    .replace(/^hundredgigabitethernet/, "hu")
    .replace(/^hundredgige/, "hu")
    .replace(/^fortygigabitethernet/, "fo")
    .replace(/^fortygige/, "fo")
    .replace(/^tengigabitethernet/, "te")
    .replace(/^tengige/, "te")
    .replace(/^gigabitethernet/, "gi")
    .replace(/^fastethernet/, "fa")
    .replace(/^ethernet/, "eth")
    .replace(/^mgmt/, "mgmt")
    .replace(/^management/, "mgmt")
    .replace(/^port-channel/, "po")
    .replace(/^vlan/, "vl")
    .replace(/^loopback/, "lo")
    .replace(/^tunnel/, "tu")
    .replace(/\s+/g, "");
}

export function mediaIsFiber(media: PortMedia): boolean {
  return media === "SFP" || media === "SFP+" || media === "SFP28" || media === "QSFP+" || media === "QSFP28";
}

// --- Resolucion de perfil ---------------------------------------------------

export function resolveDeviceProfile(
  input: { model?: string; platform?: string; deviceType?: string; role?: string },
  profiles: DeviceVisualProfile[] = DEFAULT_DEVICE_PROFILES
): ProfileMatch {
  const pid = normalizePid(input.model ?? input.platform ?? "");
  const haystack = `${input.model ?? ""} ${input.platform ?? ""} ${input.deviceType ?? ""} ${input.role ?? ""}`.toLowerCase();

  if (pid) {
    const exact = profiles.find((profile) => (profile.match.pids ?? []).some((candidate) => normalizePid(candidate) === pid));
    if (exact) return { profile: exact, match: "exact" };
  }

  const family = profiles.find((profile) => (profile.match.familyPatterns ?? []).some((pattern) => {
    try {
      return new RegExp(pattern, "i").test(pid) || new RegExp(pattern, "i").test(haystack);
    } catch {
      return false;
    }
  }));
  if (family) return { profile: family, match: "family" };

  return { profile: null, match: "none" };
}

export function confidenceForMatch(match: ProfileMatch["match"], hasObservedPorts: boolean): LayoutConfidence {
  if (match === "exact") return "exact";
  if (match === "family") return "family";
  return hasObservedPorts ? "inferred" : "generic";
}

export function generateProfileSlots(profile: DeviceVisualProfile): ProfileSlot[] {
  const slots: ProfileSlot[] = [];
  for (const section of profile.sections) {
    for (let offset = 0; offset < section.count; offset += 1) {
      const index = section.startIndex + offset;
      slots.push({
        sectionId: section.id,
        role: section.role,
        media: section.media,
        speed: section.speed,
        index,
        name: section.namePattern.replace(/\{n\}/g, String(index)),
        blockSize: section.blockSize,
        rows: section.rows
      });
    }
  }
  return slots;
}

const PORT_MEDIA_VALUES: PortMedia[] = ["RJ45", "SFP", "SFP+", "SFP28", "QSFP+", "QSFP28", "RJ45-mgmt"];
const SECTION_ROLE_VALUES: SectionRole[] = ["downlink", "uplink", "mgmt"];
const DEVICE_CATEGORY_VALUES: DeviceCategory[] = ["switch", "router", "firewall", "generic"];

// Valida y normaliza un perfil entrante (editor o DB). Lanza si es invalido.
export function normalizeDeviceProfile(input: unknown): DeviceVisualProfile {
  const raw = (input ?? {}) as Record<string, unknown>;
  const id = String(raw.id ?? "").trim();
  if (!id) throw new Error("El PID/id del perfil es requerido.");

  const category: DeviceCategory = DEVICE_CATEGORY_VALUES.includes(raw.category as DeviceCategory)
    ? (raw.category as DeviceCategory)
    : "switch";
  const scope: ProfileScope = raw.scope === "family" || raw.scope === "generic" ? raw.scope : "exact";

  const rawMatch = (raw.match ?? {}) as Record<string, unknown>;
  const pids = Array.isArray(rawMatch.pids)
    ? rawMatch.pids.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const familyPatterns = Array.isArray(rawMatch.familyPatterns)
    ? rawMatch.familyPatterns.map((value) => String(value).trim()).filter(Boolean)
    : [];

  const rawSections = Array.isArray(raw.sections) ? raw.sections : [];
  const sections: ProfileSection[] = rawSections.map((value, index) => {
    const section = (value ?? {}) as Record<string, unknown>;
    const namePattern = String(section.namePattern ?? "").trim();
    if (!namePattern.includes("{n}")) {
      throw new Error(`La seccion ${index + 1} debe tener un patron de nombre con {n} (ej. GigabitEthernet1/0/{n}).`);
    }
    const count = Math.max(0, Math.floor(Number(section.count ?? 0)));
    if (count <= 0) throw new Error(`La seccion ${index + 1} debe tener un conteo de puertos mayor que 0.`);
    return {
      id: String(section.id ?? `sec-${index + 1}`).trim() || `sec-${index + 1}`,
      label: String(section.label ?? "").trim() || `Seccion ${index + 1}`,
      role: SECTION_ROLE_VALUES.includes(section.role as SectionRole) ? (section.role as SectionRole) : "downlink",
      media: PORT_MEDIA_VALUES.includes(section.media as PortMedia) ? (section.media as PortMedia) : "RJ45",
      speed: String(section.speed ?? "").trim(),
      count,
      namePattern,
      startIndex: Number.isFinite(Number(section.startIndex)) ? Math.floor(Number(section.startIndex)) : 1,
      rows: section.rows === 2 || section.rows === "2" ? 2 : 1,
      blockSize: section.blockSize === undefined || section.blockSize === null || section.blockSize === ""
        ? undefined
        : Math.max(1, Math.floor(Number(section.blockSize)))
    };
  });
  if (sections.length === 0) throw new Error("El perfil debe tener al menos una seccion de puertos.");

  const uplinkBaySlots = raw.uplinkBaySlots === undefined || raw.uplinkBaySlots === null || raw.uplinkBaySlots === ""
    ? undefined
    : Math.max(0, Math.floor(Number(raw.uplinkBaySlots)));

  return {
    id,
    scope,
    vendor: "cisco",
    category,
    title: String(raw.title ?? "").trim() || id,
    match: { pids, familyPatterns },
    uplinkBaySlots,
    sections,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
  };
}

export function emptyDeviceProfile(): DeviceVisualProfile {
  return {
    id: "",
    scope: "exact",
    vendor: "cisco",
    category: "switch",
    title: "",
    match: { pids: [], familyPatterns: [] },
    uplinkBaySlots: 4,
    sections: [
      { id: "dl", label: "1-24", role: "downlink", media: "RJ45", speed: "1G", count: 24, namePattern: "GigabitEthernet1/0/{n}", startIndex: 1, rows: 2, blockSize: 6 }
    ],
    updatedAt: new Date().toISOString()
  };
}

export const LAYOUT_CONFIDENCE_LABEL: Record<LayoutConfidence, string> = {
  exact: "Layout exacto",
  family: "Layout por familia",
  inferred: "Layout inferido",
  generic: "Layout generico"
};

// --- Semilla de perfiles (versionada en repo) -------------------------------
//
// Perfiles EXACTOS (match.pids) tienen prioridad sobre FAMILIAS (match.familyPatterns).
// Conteos y nombres siguen los datasheets de Cisco; el admin podra agregar mas via DB.

export const DEFAULT_DEVICE_PROFILES: DeviceVisualProfile[] = [
  // --- Catalyst 9500 (exactos: casos que la familia no cubre bien) ---
  {
    id: "C9500-24Y4C",
    scope: "exact",
    vendor: "cisco",
    category: "switch",
    title: "Catalyst 9500 24x25G + 4x100G",
    match: { pids: ["C9500-24Y4C"] },
    uplinkBaySlots: 6,
    sections: [
      { id: "dl", label: "1-24", role: "downlink", media: "SFP28", speed: "25G", count: 24, namePattern: "TwentyFiveGigE1/0/{n}", startIndex: 1, rows: 2, blockSize: 6 },
      { id: "ul", label: "Uplinks", role: "uplink", media: "QSFP28", speed: "100G", count: 4, namePattern: "HundredGigE1/0/{n}", startIndex: 25, rows: 1 }
    ]
  },
  {
    id: "C9500-40X",
    scope: "exact",
    vendor: "cisco",
    category: "switch",
    title: "Catalyst 9500 40x10G",
    match: { pids: ["C9500-40X"] },
    uplinkBaySlots: 0,
    sections: [
      { id: "dl", label: "1-40", role: "downlink", media: "SFP+", speed: "10G", count: 40, namePattern: "TenGigabitEthernet1/0/{n}", startIndex: 1, rows: 2, blockSize: 6 }
    ]
  },
  {
    id: "C9500-48Y4C",
    scope: "exact",
    vendor: "cisco",
    category: "switch",
    title: "Catalyst 9500 48x25G + 4x100G",
    match: { pids: ["C9500-48Y4C"] },
    uplinkBaySlots: 6,
    sections: [
      { id: "dl", label: "1-48", role: "downlink", media: "SFP28", speed: "25G", count: 48, namePattern: "TwentyFiveGigE1/0/{n}", startIndex: 1, rows: 2, blockSize: 6 },
      { id: "ul", label: "Uplinks", role: "uplink", media: "QSFP28", speed: "100G", count: 4, namePattern: "HundredGigE1/0/{n}", startIndex: 49, rows: 1 }
    ]
  },
  {
    id: "WS-C2960X-48FPD-L",
    scope: "exact",
    vendor: "cisco",
    category: "switch",
    title: "Catalyst 2960-X 48p + 2x10G SFP+",
    match: { pids: ["WS-C2960X-48FPD-L"] },
    uplinkBaySlots: 2,
    sections: [
      { id: "dl", label: "1-48", role: "downlink", media: "RJ45", speed: "1G", count: 48, namePattern: "GigabitEthernet1/0/{n}", startIndex: 1, rows: 2, blockSize: 6 },
      { id: "ul", label: "Uplinks", role: "uplink", media: "SFP+", speed: "10G", count: 2, namePattern: "TenGigabitEthernet1/0/{n}", startIndex: 49, rows: 1 }
    ]
  },

  // --- Familias Catalyst ---
  {
    id: "cisco/catalyst-48p-uplink",
    scope: "family",
    vendor: "cisco",
    category: "switch",
    title: "Catalyst 48p + uplinks",
    match: { familyPatterns: ["^c9[2345]00[a-z]*-48", "^ws-c3[6-8]\\d{2}.*-48", "^ws-c29\\d{2}.*-48"] },
    uplinkBaySlots: 4,
    sections: [
      { id: "dl", label: "1-48", role: "downlink", media: "RJ45", speed: "1G", count: 48, namePattern: "GigabitEthernet1/0/{n}", startIndex: 1, rows: 2, blockSize: 6 },
      { id: "ul", label: "Uplinks", role: "uplink", media: "SFP+", speed: "10G", count: 4, namePattern: "TenGigabitEthernet1/1/{n}", startIndex: 1, rows: 1 }
    ]
  },
  {
    id: "cisco/catalyst-24p-uplink",
    scope: "family",
    vendor: "cisco",
    category: "switch",
    title: "Catalyst 24p + uplinks",
    match: { familyPatterns: ["^c9[2345]00[a-z]*-24", "^ws-c3[6-8]\\d{2}.*-24", "^ws-c29\\d{2}.*-24"] },
    uplinkBaySlots: 4,
    sections: [
      { id: "dl", label: "1-24", role: "downlink", media: "RJ45", speed: "1G", count: 24, namePattern: "GigabitEthernet1/0/{n}", startIndex: 1, rows: 2, blockSize: 6 },
      { id: "ul", label: "Uplinks", role: "uplink", media: "SFP+", speed: "10G", count: 4, namePattern: "TenGigabitEthernet1/1/{n}", startIndex: 1, rows: 1 }
    ]
  },

  // --- Familias Nexus 9300 ---
  {
    id: "cisco/nexus-93180",
    scope: "family",
    vendor: "cisco",
    category: "switch",
    title: "Nexus 9300 48x25G + 6x100G",
    match: { familyPatterns: ["93180", "n9k-c93180"] },
    uplinkBaySlots: 6,
    sections: [
      { id: "dl", label: "1-48", role: "downlink", media: "SFP28", speed: "25G", count: 48, namePattern: "Ethernet1/{n}", startIndex: 1, rows: 2, blockSize: 6 },
      { id: "ul", label: "Uplinks", role: "uplink", media: "QSFP28", speed: "100G", count: 6, namePattern: "Ethernet1/{n}", startIndex: 49, rows: 1 }
    ]
  },
  {
    id: "cisco/nexus-93108",
    scope: "family",
    vendor: "cisco",
    category: "switch",
    title: "Nexus 9300 48x10G-T + 6x100G",
    match: { familyPatterns: ["93108", "n9k-c93108"] },
    uplinkBaySlots: 6,
    sections: [
      { id: "dl", label: "1-48", role: "downlink", media: "RJ45", speed: "10G", count: 48, namePattern: "Ethernet1/{n}", startIndex: 1, rows: 2, blockSize: 6 },
      { id: "ul", label: "Uplinks", role: "uplink", media: "QSFP28", speed: "100G", count: 6, namePattern: "Ethernet1/{n}", startIndex: 49, rows: 1 }
    ]
  },

  // --- Routers (sin grid) ---
  {
    id: "cisco/isr4331",
    scope: "exact",
    vendor: "cisco",
    category: "router",
    title: "ISR 4331 (3x GE onboard)",
    match: { pids: ["ISR4331", "ISR4331/K9"] },
    sections: [
      { id: "ge", label: "GE onboard", role: "downlink", media: "RJ45", speed: "1G", count: 3, namePattern: "GigabitEthernet0/0/{n}", startIndex: 0, rows: 1 }
    ]
  },
  {
    id: "cisco/router-generic",
    scope: "family",
    vendor: "cisco",
    category: "router",
    title: "Router modular Cisco (generico)",
    match: { familyPatterns: ["isr", "asr", "^c8[0-9]{3}", "router", "edge"] },
    sections: [
      { id: "ge", label: "GE", role: "downlink", media: "RJ45", speed: "1G", count: 4, namePattern: "GigabitEthernet0/0/{n}", startIndex: 0, rows: 1 }
    ]
  }
];
