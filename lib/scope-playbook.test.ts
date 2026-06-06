import assert from "node:assert/strict";
import test from "node:test";
import { hashScopeInput } from "./ai-analysis-jobs.ts";
import {
  applyExclusions,
  buildPlaybookPromptSection,
  deviceOsFamily,
  normalizeScopePlaybook,
  resolveDevicePlaybook,
  type ExclusionRule,
  type ScopePlaybook
} from "./scope-playbook.ts";

test("applyExclusions suppresses findings matching keywords severityBelow and findingTypeIn", () => {
  const findings = [
    finding({
      finding_id: "cfg_stp_low",
      title: "STP root bridge deviation",
      severity: "low",
      finding_type: "probable_issue",
      technical_rationale: "The spanning-tree root bridge priority is different from the baseline."
    }),
    finding({
      finding_id: "cfg_stp_high",
      title: "STP root bridge deviation",
      severity: "high",
      finding_type: "probable_issue",
      technical_rationale: "The spanning-tree root bridge priority is different from the baseline."
    }),
    finding({
      finding_id: "cfg_vty",
      title: "Line VTY permits legacy access",
      severity: "medium",
      finding_type: "confirmed_finding",
      technical_rationale: "line vty transport input telnet is present."
    })
  ];
  const exclusions: ExclusionRule[] = [{
    id: "suppress-low-stp",
    keywords: ["stp", "bridge"],
    severityBelow: "medium",
    findingTypeIn: ["probable_issue"],
    reason: "STP low signal accepted as local standard.",
    source: "manual",
    appliesTo: ["all"]
  }];

  const result = applyExclusions(findings, exclusions);
  assert.deepEqual(result.kept.map((item) => item.finding_id), ["cfg_stp_high", "cfg_vty"]);
  assert.equal(result.suppressed.length, 1);
  assert.equal(result.suppressed[0].ruleId, "suppress-low-stp");
  assert.equal(result.suppressed[0].reason, "STP low signal accepted as local standard.");
});

test("applyExclusions matches rules with partial conditions and keeps all without rules", () => {
  const findings = [
    finding({
      finding_id: "cfg_vty",
      title: "Line VTY management deviation",
      severity: "high",
      finding_type: "confirmed_finding",
      technical_rationale: "line vty lacks the expected access-class."
    }),
    finding({
      finding_id: "cfg_ospf",
      title: "OSPF timer mismatch",
      severity: "medium",
      finding_type: "probable_issue",
      technical_rationale: "routing protocol timers differ between peers."
    })
  ];

  const withoutRules = applyExclusions(findings, []);
  assert.deepEqual(withoutRules.kept.map((item) => item.finding_id), ["cfg_vty", "cfg_ospf"]);
  assert.deepEqual(withoutRules.suppressed, []);

  const keywordOnly = applyExclusions(findings, [{
    id: "suppress-vty",
    keywords: ["line", "vty"],
    reason: "Known management exception.",
    source: "manual",
    appliesTo: ["all"]
  }]);
  assert.deepEqual(keywordOnly.kept.map((item) => item.finding_id), ["cfg_ospf"]);
  assert.deepEqual(keywordOnly.suppressed.map((item) => item.ruleId), ["suppress-vty"]);
});

test("deviceOsFamily separates ios-xe ios nxos asa unknown and uses model fallback", () => {
  assert.equal(deviceOsFamily({ softwareVersion: "Cisco IOS XE Software, Version 17.9", platform: "", model: "C9300" }), "ios-xe");
  assert.equal(deviceOsFamily({ softwareVersion: "Cisco IOS Software, C6500 Software", platform: "", model: "WS-C6500" }), "ios");
  assert.equal(deviceOsFamily({ softwareVersion: "Cisco NX-OS Software 10.2", platform: "", model: "C93180YC" }), "nxos");
  assert.equal(deviceOsFamily({ softwareVersion: "", platform: "", model: "N9K-C93180YC-FX" }), "nxos");
  assert.equal(deviceOsFamily({ softwareVersion: "Cisco Adaptive Security Appliance Software Version 9.16", platform: "", model: "ASA5525" }), "asa");
  assert.equal(deviceOsFamily({ softwareVersion: "", platform: "", model: "FPR-2110" }), "asa");
  assert.equal(deviceOsFamily({ softwareVersion: "", platform: "", model: "mystery-box" }), "unknown");
});

test("resolveDevicePlaybook returns all plus matching OS family items", () => {
  const playbook = normalizeScopePlaybook({
    scopeId: "configuration",
    criteria: [
      { id: "all-criterion", aspect: "Common", guidance: "Common", appliesTo: ["all"] },
      { id: "asa-criterion", aspect: "ASA", guidance: "ASA", appliesTo: ["asa"] },
      { id: "nxos-criterion", aspect: "NX-OS", guidance: "NX-OS", appliesTo: ["nxos"] }
    ],
    expected: [
      { id: "all-expected", title: "Common", description: "Common", severityHint: "medium", exampleRationale: "", appliesTo: ["all"] },
      { id: "nxos-expected", title: "NX-OS", description: "NX-OS", severityHint: "medium", exampleRationale: "", appliesTo: ["nxos"] }
    ],
    exclusions: [
      { id: "all-exclusion", keywords: ["common"], reason: "Common", source: "manual", appliesTo: ["all"] },
      { id: "asa-exclusion", keywords: ["asa"], reason: "ASA", source: "manual", appliesTo: ["asa"] }
    ]
  });

  assert.deepEqual(resolveDevicePlaybook(playbook, "asa").criteria.map((item) => item.id), ["all-criterion", "asa-criterion"]);
  assert.deepEqual(resolveDevicePlaybook(playbook, "nxos").criteria.map((item) => item.id), ["all-criterion", "nxos-criterion"]);
  assert.deepEqual(resolveDevicePlaybook(playbook, "asa").expected.map((item) => item.id), ["all-expected"]);
  assert.deepEqual(resolveDevicePlaybook(playbook, "asa").exclusions.map((item) => item.id), ["all-exclusion", "asa-exclusion"]);
});

test("applyExclusions is OS-aware when device OS lookup is provided", () => {
  const findings = [
    finding({
      finding_id: "asa_mgmt",
      title: "Management deviation",
      technical_rationale: "legacy management exception",
      related_devices: ["asa-01"]
    }),
    finding({
      finding_id: "ios_mgmt",
      title: "Management deviation",
      technical_rationale: "legacy management exception",
      related_devices: ["ios-01"]
    })
  ];
  const result = applyExclusions(findings, [{
    id: "asa-management",
    keywords: ["management", "legacy"],
    reason: "ASA exception only.",
    source: "manual",
    appliesTo: ["asa"]
  }], { deviceOsByName: { "asa-01": "asa", "ios-01": "ios" } });

  assert.deepEqual(result.suppressed.map((item) => item.finding.finding_id), ["asa_mgmt"]);
  assert.deepEqual(result.kept.map((item) => item.finding_id), ["ios_mgmt"]);
});

test("legacy playbook items without appliesTo normalize to all", () => {
  const normalized = normalizeScopePlaybook({
    scopeId: "configuration",
    criteria: [{ id: "legacy-criterion", aspect: "Legacy", guidance: "Legacy" }],
    expected: [{ id: "legacy-expected", title: "Legacy", description: "", severityHint: "low", exampleRationale: "" }],
    exclusions: [{ id: "legacy-exclusion", keywords: ["legacy"], reason: "Legacy", source: "manual" }]
  } as any);

  assert.deepEqual(normalized.criteria[0].appliesTo, ["all"]);
  assert.deepEqual(normalized.expected[0].appliesTo, ["all"]);
  assert.deepEqual(normalized.exclusions[0].appliesTo, ["all"]);
});

test("buildPlaybookPromptSection includes criteria and expected findings", () => {
  const section = buildPlaybookPromptSection(playbook());
  assert.match(section, /Evalua estos aspectos/);
  assert.match(section, /Spanning-tree/);
  assert.match(section, /Tipos de hallazgo esperados/);
  assert.match(section, /STP root no deseado/);
  assert.match(section, /Ejemplo de racional/);
});

test("configuration input hash changes with playbook hash only when flag is enabled", () => {
  const previous = process.env.AI_SCOPE_PLAYBOOK;
  try {
    process.env.AI_SCOPE_PLAYBOOK = "";
    const offA = hashScopeInput(record(), "configuration", { scopePlaybookHash: "playbook-a" });
    const offB = hashScopeInput(record(), "configuration", { scopePlaybookHash: "playbook-b" });
    assert.equal(offA, offB);

    process.env.AI_SCOPE_PLAYBOOK = "1";
    const onA = hashScopeInput(record(), "configuration", { scopePlaybookHash: "playbook-a" });
    const onB = hashScopeInput(record(), "configuration", { scopePlaybookHash: "playbook-b" });
    assert.notEqual(onA, onB);

    const securityA = hashScopeInput(record(), "security", { scopePlaybookHash: "playbook-a" });
    const securityB = hashScopeInput(record(), "security", { scopePlaybookHash: "playbook-b" });
    assert.equal(securityA, securityB);
  } finally {
    process.env.AI_SCOPE_PLAYBOOK = previous;
  }
});

function finding(overrides: Record<string, unknown>) {
  return {
    finding_id: "cfg",
    title: "Config finding",
    severity: "medium",
    finding_type: "probable_issue",
    technical_rationale: "Config rationale.",
    ...overrides
  };
}

function playbook(): Pick<ScopePlaybook, "criteria" | "expected"> {
  return {
    criteria: [{
      id: "criterion-stp",
      aspect: "Spanning-tree",
      guidance: "Revisar raiz STP, PortFast y BPDU Guard.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    }],
    expected: [{
      id: "expected-stp",
      title: "STP root no deseado",
      description: "Root bridge inesperado para el dominio de capa 2.",
      severityHint: "medium",
      exampleRationale: "La prioridad observada no coincide con el rol esperado del equipo.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    }]
  };
}

function record() {
  return {
    id: "assess_playbook",
    client: { name: "Cliente" },
    assessment: { name: "Assessment" },
    scope: {},
    targetInventory: [{
      id: "device_core_01",
      hostname: "core-01",
      priority: "high",
      included: true
    }],
    evidenceFiles: [{
      id: "ev_cfg_core_01",
      name: "core-01-running-config.txt",
      type: "txt",
      deviceName: "core-01",
      command: "show running-config",
      content: "hostname core-01\nspanning-tree vlan 1 priority 32768\nline vty 0 4\n transport input ssh\n"
    }],
    parsed: {
      devices: [],
      interfaces: [],
      relations: [],
      findings: []
    },
    performance: {
      metrics: []
    }
  };
}
