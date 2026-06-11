# Cisco Faceplate Renderer — Propuesta funcional

> **Principio rector:** el objetivo no es una réplica fotográfica de cada equipo Cisco, sino
> una **representación visual consistente, clara y útil para assessment**. La prioridad es que el
> arquitecto entienda rápido qué puertos existen, cuáles están up/down/admin-down, cuáles tienen
> errores, cuáles son uplinks/trunks/routed, cuáles tienen vecino CDP/LLDP y cuáles requieren atención.
> Se usa un **renderer SVG/componentes propios**, nunca imágenes PNG/JPG.

Este documento supersede el borrador previo de esquema (`DeviceFaceplate` / `PortGroup`) y lo evoluciona.
Dos cambios respecto a lo acordado antes, derivados de la nueva guía:

1. **Equipos desconocidos:** en vez de bloquear con una alerta dura, se degrada con gracia mediante
   una **jerarquía de resolución con nivel de confianza** (exacto → familia → inferido → genérico).
   La "alerta" pasa a ser un banner de baja confianza + CTA para crear el perfil.
2. **Detalle de puerto:** se recomienda **panel lateral acoplado (side panel)** en lugar del popover
   flotante actual, para soportar el detalle rico (performance, errores, hallazgos, evidencia).

---

## 1. Arquitectura funcional (4 capas)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Capa 1 · Datos reales del assessment                                   │
│   parsed interfaces · CDP/LLDP · métricas de performance · findings    │
└──────────────────────────────┬───────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Capa 2 · Normalización  →  CanonicalInterface[]                        │
│   nombre canónico/corto · medio · slot/subslot/port · velocidad ·      │
│   admin/oper · modo · vlan · vecino · errores/drops/crc · util · poe   │
└──────────────────────────────┬───────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Capa 3 · Resolución de perfil visual                                   │
│   exacto(PID) → familia → inferido → genérico   (+ nivel de confianza) │
│   produce ResolvedFaceplate = perfil + slots bindeados + extras        │
└──────────────────────────────┬───────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Capa 4 · Renderer interactivo                                          │
│   Vista física (SVG)  +  Vista analítica  +  hover/click/filtros/panel │
└──────────────────────────────────────────────────────────────────────┘

Transversal · Editor admin de perfiles (subtab Topología, solo admin)
Persistencia · semilla en repo  +  override en PostgreSQL (patrón playbook)
```

Cada capa es independiente y testeable. Clave: la **Capa 2 (normalización) y la Vista analítica
funcionan para CUALQUIER equipo sin necesidad de perfil visual** — por eso se construyen primero.

---

## 2. Modelo de datos recomendado

### 2.1 `CanonicalInterface` (salida de la normalización)

```ts
type PortMedia = "RJ45" | "SFP" | "SFP+" | "SFP28" | "QSFP+" | "QSFP28" | "RJ45-mgmt" | "console" | "unknown";
type AdminState = "up" | "down" | "unknown";          // shutdown ⇒ down
type OperState  = "up" | "down" | "err-disabled" | "monitoring" | "unknown";
type PortMode   = "access" | "trunk" | "routed" | "logical" | "unknown";

type CanonicalInterface = {
  canonicalName: string;     // "GigabitEthernet1/0/1"
  shortName: string;         // "Gi1/0/1"
  isLogical: boolean;        // Po/Vlan/Lo/Tunnel/Null/etc.
  media: PortMedia;
  speed: string;             // "1G" | "10G" | "25G" | "40G" | "100G" | ""
  slot: number | null;       // 1
  subslot: number | null;    // 0
  port: number | null;       // 1
  adminState: AdminState;
  operState: OperState;
  mode: PortMode;
  vlan: string;              // access vlan, "trunk", "routed", rango trunk…
  description: string;
  neighbor: { protocol: "cdp" | "lldp"; remoteHostname: string; remoteInterface: string; platform?: string } | null;
  health: {
    crcErrors?: number; inputErrors?: number; outputDrops?: number; inputDrops?: number;
    utilizationPct?: number; poeActive?: boolean; channelGroup?: string; // "Po10"
  };
  flags: { hasErrors: boolean; hasDrops: boolean; highUtilization: boolean; noDescription: boolean };
  evidence: string[];        // líneas crudas
  findingIds: string[];      // hallazgos asociados
};
```

### 2.2 `DeviceVisualProfile` (perfil visual — el "layout", no una imagen)

```ts
type ProfileScope = "exact" | "family" | "generic";
type DeviceCategory = "switch" | "router" | "firewall" | "modular" | "generic";
type SectionRole = "downlink" | "uplink" | "mgmt" | "console" | "stack" | "psu" | "fan";

type ProfileSection = {
  id: string;
  label: string;            // "1-48", "Uplinks", "Mgmt"
  role: SectionRole;
  media: PortMedia;
  speed: string;
  count: number;
  namePattern: string;      // contiene {n}; admite {s}/{ss} para modulares: "Te{s}/0/{n}"
  startIndex: number;
  rows: 1 | 2;              // downlink switch = 2 (impares arriba / pares abajo)
  blockSize?: number;       // separador visual (típico 6)
  fill?: "odd-even" | "sequential";
  position?: "left" | "right" | "inline";   // uplinks ⇒ right
};

type DeviceVisualProfile = {
  id: string;               // "cisco/catalyst-48p" o "C9300-48P"
  scope: ProfileScope;      // exact | family | generic
  vendor: "cisco";
  category: DeviceCategory;
  title: string;            // "Catalyst 48p + uplinks"
  match: {                  // cómo se asocia a un equipo
    pids?: string[];        // exactos, normalizados
    familyPatterns?: string[]; // regex sobre PID/plataforma, p.ej. "^c9300-48"
  };
  uplinkBaySlots?: number;  // ancho reservado de la bahía (switch), default 6
  sections: ProfileSection[];
  updatedBy?: string | null;
  updatedAt: string;
};
```

### 2.3 `ResolvedFaceplate` (lo que consume el renderer)

```ts
type LayoutConfidence = "exact" | "family" | "inferred" | "generic";

type FaceplateSlot = {
  section: ProfileSection;
  index: number;                       // n del patrón
  expectedName: string;                // generado del patrón
  iface: CanonicalInterface | null;    // dato real bindeado, o null = "libre/sin dato"
};

type ResolvedFaceplate = {
  device: { hostname: string; model: string; role: string; site: string; os?: string };
  profile: DeviceVisualProfile | null; // null cuando confidence = "generic" sin sección física
  confidence: LayoutConfidence;
  slots: FaceplateSlot[];
  logical: CanonicalInterface[];       // Po/Vlan/Lo… → fuera del faceplate físico
  extras: CanonicalInterface[];        // físicas que no matchean ningún slot
  summary: DeviceSummary;              // ver §10
};
```

### 2.4 Persistencia (patrón playbook ya existente)

- **Semilla en repo:** `lib/device-profiles.ts` (perfiles exactos + familia + genéricos), versionada en git.
- **Override en PostgreSQL:** modelo Prisma `DeviceVisualProfile` (espejo de `ScopePlaybook`), editable
  desde el editor admin. Precedencia: **DB override → semilla → resolución inferida/genérica**.
- Store `lib/device-profiles-store.ts` con `list / get / upsert / delete` (merge semilla+DB).

---

## 3. Reglas de normalización de interfaces

1. **Tabla de prefijos** (canónico ↔ corto):
   `Gi/GigabitEthernet`, `Te/TenGigabitEthernet`, `Twe/TwentyFiveGigE`, `Fo/FortyGigabitEthernet`,
   `Hu/HundredGigabitEthernet`, `Fa/FastEthernet`, `Eth|Et/Ethernet` (Nexus), `Po/Port-channel`,
   `Vl/Vlan`, `Lo/Loopback`, `Tu/Tunnel`, `Mgmt|mgmt0/Management0`.
2. **Slot/subslot/port:** parsear el sufijo numérico `a/b/c` → `{slot,subslot,port}`. Nexus suele ser
   `Eth1/1` (`slot=1, port=1`). Stack/modular: `Gi2/0/5` (`slot=2`). Guardar todos para binding y orden.
3. **Medio (`media`):** por prefijo + velocidad + transceiver (`sfp/qsfp/sr/lr/lx/sx/twinax` ⇒ fibra;
   `base-t/rj-45/10/100/1000` ⇒ cobre). 10/25/40/100G sin cobre explícito ⇒ SFP/QSFP.
4. **Modo:** `switchport mode trunk` ⇒ trunk; `no switchport`/`ip address` ⇒ routed; access vlan ⇒ access;
   prefijos lógicos ⇒ logical.
5. **Lógicas:** `Po|Vlan|Lo|Tunnel|Null|Mgmt-virtual` ⇒ `isLogical = true` (no van al faceplate físico).
6. **Estados:** `admin` desde shutdown/admin-down; `oper` desde connected/up/notconnect/down/err-disabled/monitoring.
7. **Salud:** extraer CRC, input/output errors, drops, utilización (%), PoE, `channel-group` ⇒ `Po`.
8. **Flags derivados:** `hasErrors`, `hasDrops`, `highUtilization` (umbral configurable, p.ej. ≥70%),
   `noDescription`.
9. **Clave canónica de binding:** `normalize(canonicalName)` (lowercase, prefijo largo→corto unificado),
   usada para mapear interfaz ↔ slot del perfil.

> La normalización es **independiente del perfil**: alimenta tanto la vista física como la analítica.

---

## 4. Reglas de selección de perfil visual (resolución jerárquica)

```
1. EXACTO   → match.pids incluye normalizePid(device.model)            confidence = "exact"
2. FAMILIA  → algún match.familyPatterns matchea PID/plataforma        confidence = "family"
3. INFERIDO → no hay perfil; se construye layout desde las interfaces  confidence = "inferred"
              detectadas (conteo, medios, slots) con perfiles genéricos como molde
4. GENÉRICO → no se puede inferir con confianza                        confidence = "generic"
```

- El PID se toma de `device.model` y, como respaldo, del `platform` de CDP/LLDP.
- **Siempre se muestra el nivel de confianza** (badge en la tarjeta). No se finge precisión.
- En inferido/genérico se ofrece **"Guardar como perfil"** (fase posterior) para reutilizarlo.
- La **inferencia nunca inventa puertos fuera de lo observado**: si infiere, usa el rango real
  detectado; lo no observado se marca "no observado", no se rellena por capacidad supuesta salvo
  que exista perfil exacto/familia que lo justifique.

---

## 5. Ejemplos de perfiles

### Catalyst 48p con uplinks (familia)
```ts
{
  id: "cisco/catalyst-48p-uplink", scope: "family", vendor: "cisco", category: "switch",
  title: "Catalyst 48p + uplinks", match: { familyPatterns: ["^c9[23]00-48", "^ws-c29\\d{2}.*-48"] },
  uplinkBaySlots: 4,
  sections: [
    { id: "dl", label: "1-48", role: "downlink", media: "RJ45", speed: "1G",
      count: 48, namePattern: "GigabitEthernet1/0/{n}", startIndex: 1, rows: 2, blockSize: 6, fill: "odd-even", position: "left" },
    { id: "ul", label: "Uplinks", role: "uplink", media: "SFP+", speed: "10G",
      count: 4, namePattern: "TenGigabitEthernet1/1/{n}", startIndex: 1, rows: 1, position: "right" }
  ]
}
```

### Catalyst 24p (familia)
```ts
{
  id: "cisco/catalyst-24p", scope: "family", vendor: "cisco", category: "switch",
  title: "Catalyst 24p", match: { familyPatterns: ["^c9[23]00-24", "^ws-c29\\d{2}.*-24"] },
  uplinkBaySlots: 4,
  sections: [
    { id: "dl", label: "1-24", role: "downlink", media: "RJ45", speed: "1G",
      count: 24, namePattern: "GigabitEthernet1/0/{n}", startIndex: 1, rows: 2, blockSize: 6, fill: "odd-even", position: "left" },
    { id: "ul", label: "Uplinks", role: "uplink", media: "SFP+", speed: "10G",
      count: 4, namePattern: "TenGigabitEthernet1/1/{n}", startIndex: 1, rows: 1, position: "right" }
  ]
}
```

### Nexus 48p + uplinks QSFP (familia)
```ts
{
  id: "cisco/nexus-93180-48p", scope: "family", vendor: "cisco", category: "switch",
  title: "Nexus 9300 48p SFP28 + 6x QSFP28", match: { familyPatterns: ["^n9k-c93180", "93180"] },
  uplinkBaySlots: 6,
  sections: [
    { id: "dl", label: "1-48", role: "downlink", media: "SFP28", speed: "25G",
      count: 48, namePattern: "Ethernet1/{n}", startIndex: 1, rows: 2, blockSize: 6, fill: "odd-even", position: "left" },
    { id: "ul", label: "Uplinks", role: "uplink", media: "QSFP28", speed: "100G",
      count: 6, namePattern: "Ethernet1/{n}", startIndex: 49, rows: 1, position: "right" }
  ]
}
```

> Perfiles **exactos** (p.ej. `C9500-24Y4C`, `C9500-40X`) se declaran con `match.pids` y los conteos
> reales del modelo; tienen prioridad sobre la familia.

---

## 6. Comportamiento de hover y click

- **Hover (tooltip breve):** nombre canónico, admin/oper, modo, VLAN, velocidad, descripción, vecino,
  alertas principales (err-disabled / CRC / drops / alta util).
- **Click (panel lateral acoplado):**
  - Estado y configuración (admin/oper, modo, vlan, duplex, velocidad, medio/transceiver, PoE, Po).
  - Performance (utilización, tendencia si existe).
  - Errores (CRC, input/output errors, drops).
  - Relación CDP/LLDP (vecino, interfaz remota, plataforma, IP gestión, confianza).
  - Hallazgos asociados (findingIds) + recomendaciones.
  - Evidencia cruda.
  - Navegación anterior/siguiente puerto; cierre con Esc / click fuera.

---

## 7. Filtros recomendados (compartidos por vista física y analítica)

- Solo puertos con problemas (down operativo inesperado / err-disabled / CRC / drops / alta util).
- Solo uplinks · Solo trunks · Solo access · Solo routed.
- Solo activos (oper up) · Solo admin down.
- Interfaces sin descripción.
- Interfaces con vecino CDP/LLDP.
- Interfaces con errores / drops / CRC.
- Interfaces con alta utilización.
- Búsqueda por nombre / descripción / vecino.
- (Combinables; los badges del resumen actúan como filtros rápidos.)

---

## 8. Estados visuales recomendados (sobrios y consistentes)

| Condición            | Representación                                              |
|----------------------|------------------------------------------------------------|
| Oper up              | Puerto resaltado moderado (no saturado)                    |
| Oper down            | Apagado / gris                                             |
| Admin down           | Apagado con borde/indicador diferenciado                  |
| Err-disabled         | Alerta fuerte (rojo)                                       |
| CRC / drops          | Badge de advertencia pequeño en la esquina                |
| Alta utilización     | Indicador pequeño o mini-barra                            |
| Trunk                | Marcador discreto (p.ej. franja superior)                 |
| Access               | Estado normal                                             |
| Routed (L3)          | Icono L3 discreto                                          |
| PoE activo           | Indicador pequeño                                         |
| Port-channel member  | Badge "Po"                                                |

Reglas: **no abusar del color**; el color base codifica oper-state, los matices (errores, trunk, L3,
PoE) van como **badges/íconos pequeños** + **cue no cromático** (forma/símbolo) para accesibilidad.
El relleno fuerte se reserva para selección.

---

## 9. Manejo de equipos desconocidos

- Nunca se bloquea la vista. Se aplica la jerarquía de §4 y se rotula la confianza.
- **`generic` / `inferred`:** banner discreto "Layout aproximado — sin perfil exacto para `{PID}`"
  con CTA **"Crear/ajustar perfil"** (abre el editor admin pre-llenando PID y un borrador inferido).
- Aunque no haya perfil físico fiable, **la vista analítica siempre funciona** (usa solo la
  normalización), así el assessment nunca se queda sin información utilizable.
- Futuro: "Guardar perfil inferido" convierte el borrador en perfil reutilizable (DB).

---

## 10. Resumen superior de la tarjeta de equipo

Hostname · Modelo · Rol · Sitio · SO · **Perfil usado** · **Nivel de confianza** ·
Total puertos físicos · Activos · Down · Admin down · Con errores · Trunks · Access · Routed ·
Uplinks detectados. (Los contadores son clicables → filtran.)

---

## 11. Roadmap por fases

| Fase | Entrega | Notas |
|------|---------|-------|
| **0 · Normalización + Vista analítica** | Capa 2 (`CanonicalInterface`) + vista analítica con agrupaciones y filtros. | Funciona para **cualquier** equipo sin perfiles. Valor inmediato y base de todo. |
| **1 · Perfiles + render físico** | Esquema `DeviceVisualProfile`, semilla en repo, resolución jerárquica con confianza, renderer SVG de la vista física para familias comunes. Arregla C9500-24Y4C / C9500-40X. | Sin DB ni editor todavía. |
| **2 · Persistencia + Editor admin** | Modelo Prisma + store (override DB) + subtab admin en Topología con **preview WYSIWYG** (reusa el renderer). | Patrón playbook. |
| **3 · Interacción rica** | Panel lateral de detalle, hover, filtros completos, resumen header clicable. | |
| **4 · Escala y aprendizaje** | "Guardar perfil inferido", más familias (firewall ASA/Firepower, modular ISR/ASR, Nexus 3K/5K), perfiles exactos adicionales. | Crecimiento incremental. |

Familias iniciales de alto valor (Fase 1): Catalyst 24p, Catalyst 48p, Catalyst 48p+uplinks,
Nexus 48p+uplinks, router modular genérico, firewall genérico, layout genérico desconocido.

---

## 12. Riesgos / errores de diseño a evitar

1. **Inventar puertos** que no existen (bug actual con uplinks/"puerto 15"): los slots solo salen del
   perfil; lo no observado se marca, no se inventa.
2. **Fingir precisión**: siempre exponer el nivel de confianza.
3. **Overfitting por PID**: declarar todo a nivel modelo es inmantenible → priorizar **familias** y
   reservar perfiles exactos solo para casos que la familia no cubre.
4. **Sobrecarga de color**: degrada la lectura; usar paleta sobria + badges + cues no cromáticos.
5. **Mezclar lógicas en el faceplate físico**: Po/Vlan/Lo van a la vista lógica/analítica.
6. **Naming rígido**: soportar slot/subslot (`{s}/{ss}/{n}`) para stacks y modulares; binding por
   slot, no por índice global.
7. **Ambigüedad de binding** en stacks (`1/0/x` vs `2/0/x`): la clave canónica debe incluir slot.
8. **Imágenes PNG/JPG**: descartadas (resolución, licencias, alineación, responsividad).
9. **Popover flotante que se sale de pantalla**: migrar a panel lateral acoplado.
10. **Rendimiento** con 48+ puertos × muchos equipos: render ligero (SVG/celdas memoizadas),
    virtualización si hace falta, evitar re-render global al hacer hover.
11. **La vista física como decoración**: debe ser herramienta de análisis (filtros + estados reales),
    no adorno.
