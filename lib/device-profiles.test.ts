import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalInterfaceKey,
  confidenceForMatch,
  generateProfileSlots,
  normalizeDeviceProfile,
  normalizePid,
  resolveDeviceProfile,
  DEFAULT_DEVICE_PROFILES
} from "./device-profiles.ts";

test("normalizePid uppercases and collapses whitespace", () => {
  assert.equal(normalizePid("  c9500-24y4c "), "C9500-24Y4C");
  assert.equal(normalizePid("WS-C2960X-48FPD-L"), "WS-C2960X-48FPD-L");
});

test("canonicalInterfaceKey unifies long/short Cisco prefixes", () => {
  assert.equal(canonicalInterfaceKey("GigabitEthernet1/0/1"), "gi1/0/1");
  assert.equal(canonicalInterfaceKey("Gi1/0/1"), "gi1/0/1");
  assert.equal(canonicalInterfaceKey("TwentyFiveGigE1/0/3"), "twe1/0/3");
  assert.equal(canonicalInterfaceKey("HundredGigE1/0/25"), "hu1/0/25");
  assert.equal(canonicalInterfaceKey("Ethernet1/49"), "eth1/49");
  assert.equal(canonicalInterfaceKey("Eth1/49"), "eth1/49");
});

test("resolveDeviceProfile matches exact PID before family", () => {
  const c9500 = resolveDeviceProfile({ model: "C9500-24Y4C" });
  assert.equal(c9500.match, "exact");
  assert.equal(c9500.profile?.id, "C9500-24Y4C");

  const fam = resolveDeviceProfile({ model: "C9300-48P" });
  assert.equal(fam.match, "family");
  assert.equal(fam.profile?.id, "cisco/catalyst-48p-uplink");
});

test("resolveDeviceProfile falls back to none for unknown models", () => {
  const unknown = resolveDeviceProfile({ model: "ACME-WIDGET-9000" });
  assert.equal(unknown.match, "none");
  assert.equal(unknown.profile, null);
});

test("confidenceForMatch degrades gracefully", () => {
  assert.equal(confidenceForMatch("exact", true), "exact");
  assert.equal(confidenceForMatch("family", false), "family");
  assert.equal(confidenceForMatch("none", true), "inferred");
  assert.equal(confidenceForMatch("none", false), "generic");
});

test("C9500-24Y4C generates 24 downlinks (25G) + 4 uplinks (100G), no phantom ports", () => {
  const profile = DEFAULT_DEVICE_PROFILES.find((item) => item.id === "C9500-24Y4C");
  assert.ok(profile);
  const slots = generateProfileSlots(profile!);
  const downlinks = slots.filter((slot) => slot.role === "downlink");
  const uplinks = slots.filter((slot) => slot.role === "uplink");
  assert.equal(downlinks.length, 24);
  assert.equal(uplinks.length, 4);
  assert.equal(slots.length, 28);
  assert.ok(downlinks.every((slot) => slot.media === "SFP28"));
  assert.equal(canonicalInterfaceKey(uplinks[0].name), "hu1/0/25");
});

test("C9500-40X generates 40 downlinks, not clamped to 24", () => {
  const profile = DEFAULT_DEVICE_PROFILES.find((item) => item.id === "C9500-40X");
  assert.ok(profile);
  const slots = generateProfileSlots(profile!);
  assert.equal(slots.length, 40);
  assert.ok(slots.every((slot) => slot.role === "downlink" && slot.media === "SFP+"));
});

test("normalizeDeviceProfile validates id, namePattern and count", () => {
  assert.throws(() => normalizeDeviceProfile({ sections: [] }), /id del perfil es requerido/);
  assert.throws(() => normalizeDeviceProfile({ id: "X", sections: [{ namePattern: "Gi1/0/", count: 4 }] }), /\{n\}/);
  assert.throws(() => normalizeDeviceProfile({ id: "X", sections: [{ namePattern: "Gi1/0/{n}", count: 0 }] }), /conteo de puertos/);
  assert.throws(() => normalizeDeviceProfile({ id: "X", sections: [] }), /al menos una seccion/);
});

test("normalizeDeviceProfile coerces and defaults a valid profile", () => {
  const profile = normalizeDeviceProfile({
    id: "  custom-48  ",
    category: "switch",
    sections: [{ label: "1-48", role: "downlink", media: "RJ45", speed: "1G", count: "48", namePattern: "GigabitEthernet1/0/{n}", startIndex: "1", rows: "2", blockSize: "6" }]
  });
  assert.equal(profile.id, "custom-48");
  assert.equal(profile.vendor, "cisco");
  assert.equal(profile.title, "custom-48");
  assert.equal(profile.sections[0].count, 48);
  assert.equal(profile.sections[0].rows, 2);
  assert.equal(profile.sections[0].blockSize, 6);
  assert.equal(generateProfileSlots(profile).length, 48);
});

test("Nexus 93180 family puts SFP28 downlinks and QSFP28 uplinks with continuous numbering", () => {
  const resolved = resolveDeviceProfile({ model: "N9K-C93180YC-FX" });
  assert.equal(resolved.match, "family");
  const slots = generateProfileSlots(resolved.profile!);
  assert.equal(slots.filter((slot) => slot.role === "downlink").length, 48);
  const uplinks = slots.filter((slot) => slot.role === "uplink");
  assert.equal(uplinks.length, 6);
  assert.equal(canonicalInterfaceKey(uplinks[0].name), "eth1/49");
});
