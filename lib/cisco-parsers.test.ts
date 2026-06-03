import assert from "node:assert/strict";
import test from "node:test";
import { parseCiscoEvidence } from "./cisco-parsers.ts";
import type { EvidenceFile } from "./types.ts";

test("parseCiscoEvidence separates multiple devices in one CLI file", () => {
  const evidence: EvidenceFile = {
    id: "ev_multi_status",
    name: "multi-device-status.txt",
    type: "txt",
    uploadedAt: "2026-06-02T00:00:00.000Z",
    content: `
ACC-01#show version
Cisco IOS XE Software, Version 17.09.03
Cisco C9300-48P processor with 8388608K bytes of memory.
System serial number            : FDO1111AAAA
ACC-01#show inventory
NAME: "Switch 1", DESCR: "Cisco Catalyst 9300"
PID: C9300-48P          , VID: V01  , SN: FDO1111AAAA

DIST-01#show version
Cisco IOS XE Software, Version 17.06.05
Cisco C9500-24Y4C processor with 16777216K bytes of memory.
System serial number            : FDO2222BBBB
DIST-01#show inventory
NAME: "Chassis", DESCR: "Cisco Catalyst 9500"
PID: C9500-24Y4C        , VID: V01  , SN: FDO2222BBBB
`
  };

  const parsed = parseCiscoEvidence([evidence]);
  const hostnames = parsed.devices.map((device) => device.hostname).sort();
  const inventoryHosts = (parsed.devices.flatMap((device) => device.inventoryItems ?? []).map((item) => item.hostname)).sort();

  assert.deepEqual(hostnames, ["ACC-01", "DIST-01"]);
  assert.equal(parsed.devices.find((device) => device.hostname === "ACC-01")?.model, "C9300-48P");
  assert.equal(parsed.devices.find((device) => device.hostname === "DIST-01")?.model, "C9500-24Y4C");
  assert.deepEqual(inventoryHosts, ["ACC-01", "DIST-01"]);
});
