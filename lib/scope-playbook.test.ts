import assert from "node:assert/strict";
import test from "node:test";
import {
  applyScopePlaybookExclusions,
  buildScopePlaybookSystemPrompt,
  hashScopeInput
} from "./ai-analysis-jobs.ts";
import { defaultScopePlaybook } from "./scope-playbook-store.ts";
import {
  applyExclusions,
  applicableCriteriaForOs,
  buildCoveragePlan,
  buildPlaybookPromptSection,
  defaultConfigurationScopePlaybook,
  defaultEvidenceScopePlaybook,
  defaultOperationsScopePlaybook,
  defaultPerformanceScopePlaybook,
  defaultSecurityScopePlaybook,
  defaultTopologyScopePlaybook,
  deviceOsFamily,
  isSupportedScopePlaybookScopeId,
  normalizeScopePlaybook,
  resolveDevicePlaybook,
  supportedScopePlaybookScopeIds,
  type ExclusionRule,
  type ScopePlaybook
} from "./scope-playbook.ts";

function assertUniqueBy<T>(items: T[], selector: (item: T) => string, label: string) {
  const seen = new Map<string, number>();
  const duplicates = new Set<string>();
  items.forEach((item, index) => {
    const key = selector(item).trim().toLowerCase();
    if (seen.has(key)) {
      duplicates.add(`${key} (#${seen.get(key)} and #${index})`);
    } else {
      seen.set(key, index);
    }
  });
  assert.deepEqual([...duplicates], [], `${label} should not contain duplicates`);
}

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

test("applicableCriteriaForOs filters by OS family with all applying to every device", () => {
  const playbook = normalizeScopePlaybook({
    scopeId: "security",
    criteria: [
      { id: "all-criterion", aspect: "Common", guidance: "Common", appliesTo: ["all"] },
      { id: "ios-criterion", aspect: "IOS", guidance: "IOS", appliesTo: ["ios"] },
      { id: "nxos-criterion", aspect: "NX-OS", guidance: "NX-OS", appliesTo: ["nxos"] }
    ],
    expected: [],
    exclusions: []
  });

  assert.deepEqual(applicableCriteriaForOs(playbook, "ios").map((item) => item.id), ["all-criterion", "ios-criterion"]);
  assert.deepEqual(applicableCriteriaForOs(playbook, "nxos").map((item) => item.id), ["all-criterion", "nxos-criterion"]);
});

test("buildCoveragePlan produces one entry per device with applicable criterion ids and aspects", () => {
  const playbook = normalizeScopePlaybook({
    scopeId: "evidence",
    criteria: [
      { id: "all-criterion", aspect: "Common", guidance: "Common", appliesTo: ["all"] },
      { id: "ios-criterion", aspect: "IOS", guidance: "IOS", appliesTo: ["ios"] },
      { id: "nxos-criterion", aspect: "NX-OS", guidance: "NX-OS", appliesTo: ["nxos"] }
    ],
    expected: [],
    exclusions: []
  });

  const plan = buildCoveragePlan(playbook, [
    { identity: { hostname: "nxos-01", osFamily: "nxos" } },
    { identity: { hostname: "ios-01", osFamily: "ios" } }
  ]);

  assert.deepEqual(plan, [
    {
      deviceHostname: "ios-01",
      osFamily: "ios",
      criteria: [
        { id: "all-criterion", aspect: "Common" },
        { id: "ios-criterion", aspect: "IOS" }
      ]
    },
    {
      deviceHostname: "nxos-01",
      osFamily: "nxos",
      criteria: [
        { id: "all-criterion", aspect: "Common" },
        { id: "nxos-criterion", aspect: "NX-OS" }
      ]
    }
  ]);
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

test("default configuration playbook covers key platform best-practice areas", () => {
  assert.equal(defaultConfigurationScopePlaybook.criteria.length, 50);
  assert.ok(defaultConfigurationScopePlaybook.expected.length >= 30);
  assertUniqueBy(defaultConfigurationScopePlaybook.criteria, (item) => item.id, "configuration criterion ids");
  assertUniqueBy(defaultConfigurationScopePlaybook.criteria, (item) => item.aspect, "configuration criterion aspects");
  assertUniqueBy(defaultConfigurationScopePlaybook.expected, (item) => item.id, "configuration expected finding ids");
  assertUniqueBy(defaultConfigurationScopePlaybook.expected, (item) => item.title, "configuration expected finding titles");

  for (const id of [
    "cfg-06-disable-telnet",
    "cfg-12-snmpv3-authpriv",
    "cfg-27-stp-root-primary-secondary",
    "cfg-35-trunk-allowed-vlans",
    "cfg-44-dynamic-arp-inspection",
    "cfg-50-vpc-keepalive-peerlink-orphans"
  ]) {
    assert.ok(defaultConfigurationScopePlaybook.criteria.some((item) => item.id === id), `${id} criterion should exist`);
  }

  for (const id of [
    "expected-cfg-telnet-enabled",
    "expected-cfg-snmpv2c-rw",
    "expected-cfg-vlan1-user-management",
    "expected-cfg-trunk-allowed-all",
    "expected-cfg-stp-root-uncontrolled",
    "expected-cfg-bpdu-guard-missing",
    "expected-cfg-unused-ports-active",
    "expected-cfg-syslog-missing",
    "expected-cfg-ntp-unreliable",
    "expected-cfg-config-backup-missing",
    "expected-cfg-change-rollback-missing",
    "expected-cfg-shared-local-users",
    "expected-cfg-port-channel-inconsistent",
    "expected-cfg-dai-ipsg-bindings",
    "expected-cfg-vpc-treated-as-stack"
  ]) {
    assert.ok(defaultConfigurationScopePlaybook.expected.some((item) => item.id === id), `${id} expected finding should exist`);
  }
});

test("default security playbook covers key platform hardening areas", () => {
  assert.equal(defaultSecurityScopePlaybook.scopeId, "security");
  assert.ok(defaultSecurityScopePlaybook.criteria.length >= 18);
  assert.ok(defaultSecurityScopePlaybook.expected.length >= 18);
  assert.ok(defaultSecurityScopePlaybook.criteria.some((item) => item.id === "sec-management-plane-aaa" && item.appliesTo.includes("all")));
  assert.ok(defaultSecurityScopePlaybook.criteria.some((item) => item.id === "sec-asa-management-hardening" && item.appliesTo.includes("asa")));
  assert.ok(defaultSecurityScopePlaybook.criteria.some((item) => item.id === "sec-nxos-rbac" && item.appliesTo.includes("nxos")));
  assert.ok(defaultSecurityScopePlaybook.expected.some((item) => item.id === "expected-sec-telnet-enabled"));
  assert.ok(defaultSecurityScopePlaybook.expected.some((item) => item.id === "expected-sec-control-plane-unprotected"));
  assert.ok(defaultSecurityScopePlaybook.expected.some((item) => item.id === "expected-sec-asa-acl-any-any"));
});

test("default evidence playbook covers key log and event analysis areas", () => {
  assert.equal(defaultEvidenceScopePlaybook.scopeId, "evidence");
  assert.ok(defaultEvidenceScopePlaybook.criteria.length >= 18);
  assert.ok(defaultEvidenceScopePlaybook.expected.length >= 18);
  assert.ok(defaultEvidenceScopePlaybook.criteria.some((item) => item.id === "ev-log-coverage-quality" && item.appliesTo.includes("all")));
  assert.ok(defaultEvidenceScopePlaybook.criteria.some((item) => item.id === "ev-routing-adjacency-churn" && item.appliesTo.includes("ios-xe")));
  assert.ok(defaultEvidenceScopePlaybook.criteria.some((item) => item.id === "ev-asa-failover-interface" && item.appliesTo.includes("asa")));
  assert.ok(defaultEvidenceScopePlaybook.criteria.some((item) => item.id === "ev-nxos-vpc-fex-fabric" && item.appliesTo.includes("nxos")));
  assert.ok(defaultEvidenceScopePlaybook.expected.some((item) => item.id === "expected-ev-routing-neighbor-churn"));
  assert.ok(defaultEvidenceScopePlaybook.expected.some((item) => item.id === "expected-ev-asa-failover-interface-risk"));
  assert.ok(defaultEvidenceScopePlaybook.expected.some((item) => item.id === "expected-ev-evidence-conflict-validation"));
});

test("default performance playbook covers root-cause oriented metric domains", () => {
  assert.equal(defaultScopePlaybook("performance"), defaultPerformanceScopePlaybook);
  assert.equal(defaultPerformanceScopePlaybook.scopeId, "performance");
  assert.ok(defaultPerformanceScopePlaybook.criteria.length >= 6);
  assert.ok(defaultPerformanceScopePlaybook.expected.length >= 1);
  assert.ok(defaultPerformanceScopePlaybook.exclusions.length >= 1);
  assertUniqueBy(defaultPerformanceScopePlaybook.criteria, (item) => item.id, "performance criterion ids");
  assertUniqueBy(defaultPerformanceScopePlaybook.expected, (item) => item.id, "performance expected finding ids");

  const criterionText = defaultPerformanceScopePlaybook.criteria
    .map((item) => `${item.id} ${item.aspect} ${item.guidance}`)
    .join("\n")
    .toLowerCase();
  const expectedText = defaultPerformanceScopePlaybook.expected
    .map((item) => `${item.id} ${item.title} ${item.description} ${item.exampleRationale}`)
    .join("\n")
    .toLowerCase();

  assert.match(criterionText, /cpu|memory/);
  assert.match(criterionText, /crc|input_errors|frame/);
  assert.match(criterionText, /drops|queue/);
  assert.match(criterionText, /saturation|utilization/);
  assert.match(criterionText, /instability|flaps|routing_neighbor_stability/);
  assert.match(criterionText, /qos/);
  assert.match(criterionText, /causa raiz|root-cause|top procesos|cdp\/lldp|transceiver|sobre-suscripcion/);
  assert.match(expectedText, /cpu|memoria/);
  assert.match(expectedText, /errores fisicos|crc/);
  assert.match(expectedText, /drops|congestion/);
  assert.match(expectedText, /saturacion|utilizacion/);
  assert.match(expectedText, /flapeando|inestable/);
  assert.match(expectedText, /qos/);
  assert.ok(defaultPerformanceScopePlaybook.criteria.every((item) => item.appliesTo.length >= 1));
  assert.ok(defaultPerformanceScopePlaybook.expected.every((item) => item.appliesTo.length >= 1));
  assert.ok(defaultPerformanceScopePlaybook.exclusions.every((item) => item.appliesTo.length >= 1 && item.source === "manual"));
});

test("default topology playbook covers STP routing and HA/SPOF areas", () => {
  assert.equal(defaultTopologyScopePlaybook.scopeId, "topology");
  assert.ok(defaultTopologyScopePlaybook.criteria.length >= 18);
  assert.ok(defaultTopologyScopePlaybook.expected.length >= 1);
  assert.ok(defaultTopologyScopePlaybook.exclusions.length >= 1);
  assertUniqueBy(defaultTopologyScopePlaybook.criteria, (item) => item.id, "topology criterion ids");
  assertUniqueBy(defaultTopologyScopePlaybook.expected, (item) => item.id, "topology expected finding ids");

  const criterionText = defaultTopologyScopePlaybook.criteria
    .map((item) => `${item.id} ${item.aspect} ${item.guidance}`)
    .join("\n")
    .toLowerCase();
  const expectedText = defaultTopologyScopePlaybook.expected
    .map((item) => `${item.id} ${item.title} ${item.description}`)
    .join("\n")
    .toLowerCase();

  assert.match(criterionText, /stp|root bridge/);
  assert.match(criterionText, /ospf|eigrp/);
  assert.match(criterionText, /ha|spof|single-homed/);
  assert.match(expectedText, /spof/);
  assert.match(expectedText, /root bridge/);
  assert.ok(defaultTopologyScopePlaybook.criteria.every((item) => item.appliesTo.length >= 1));
  assert.ok(defaultTopologyScopePlaybook.expected.every((item) => item.appliesTo.length >= 1));
  assert.ok(defaultTopologyScopePlaybook.exclusions.every((item) => item.appliesTo.length >= 1 && item.source === "manual"));
});

test("default operations playbook covers operational domains", () => {
  assert.equal(defaultOperationsScopePlaybook.scopeId, "operations");
  assert.equal(defaultOperationsScopePlaybook.criteria.length, 10);
  assert.ok(defaultOperationsScopePlaybook.expected.length >= 1);
  assert.ok(defaultOperationsScopePlaybook.exclusions.length >= 1);
  assertUniqueBy(defaultOperationsScopePlaybook.criteria, (item) => item.id, "operations criterion ids");
  assertUniqueBy(defaultOperationsScopePlaybook.expected, (item) => item.id, "operations expected finding ids");

  const criterionText = defaultOperationsScopePlaybook.criteria
    .map((item) => `${item.id} ${item.aspect} ${item.guidance}`)
    .join("\n")
    .toLowerCase();
  const expectedText = defaultOperationsScopePlaybook.expected
    .map((item) => `${item.id} ${item.title} ${item.description}`)
    .join("\n")
    .toLowerCase();

  assert.match(criterionText, /monitoreo|monitoring/);
  assert.match(criterionText, /cambios|change/);
  assert.match(criterionText, /backup/);
  assert.match(criterionText, /continuidad|dr/);
  assert.match(criterionText, /incidentes|incident/);
  assert.match(expectedText, /monitoreo|monitoring/);
  assert.match(expectedText, /cambios|change/);
  assert.match(expectedText, /backup/);
  assert.match(expectedText, /continuidad|dr/);
  assert.match(expectedText, /incidentes|incident/);
  assert.ok(defaultOperationsScopePlaybook.criteria.every((item) => item.appliesTo.includes("all")));
  assert.ok(defaultOperationsScopePlaybook.expected.every((item) => item.appliesTo.includes("all")));
  assert.ok(defaultOperationsScopePlaybook.exclusions.every((item) => item.appliesTo.includes("all") && item.source === "manual"));
});

test("playbook API allowlist accepts the six editable scopes and rejects others", () => {
  assert.deepEqual(supportedScopePlaybookScopeIds, ["configuration", "security", "evidence", "performance", "topology", "operations"]);
  assert.equal(isSupportedScopePlaybookScopeId("configuration"), true);
  assert.equal(isSupportedScopePlaybookScopeId("security"), true);
  assert.equal(isSupportedScopePlaybookScopeId("evidence"), true);
  assert.equal(isSupportedScopePlaybookScopeId("performance"), true);
  assert.equal(isSupportedScopePlaybookScopeId("topology"), true);
  assert.equal(isSupportedScopePlaybookScopeId("operations"), true);
  assert.equal(isSupportedScopePlaybookScopeId("lifecycle"), false);
});

test("scope playbook prompt is injected for all supported per-device scopes", () => {
  const previousScopePlaybook = process.env.AI_SCOPE_PLAYBOOK;
  const previousTopologyPlaybook = process.env.AI_TOPOLOGY_PLAYBOOK;
  try {
    process.env.AI_SCOPE_PLAYBOOK = "1";
    process.env.AI_TOPOLOGY_PLAYBOOK = "";
    for (const scopeId of ["configuration", "security", "evidence", "performance"] as const) {
      const prompt = buildScopePlaybookSystemPrompt(scopeId, normalizeScopePlaybook({
        scopeId,
        criteria: [{ id: `${scopeId}-criterion`, aspect: `${scopeId} aspect`, guidance: `${scopeId} guidance`, appliesTo: ["all"] }],
        expected: [{ id: `${scopeId}-expected`, title: `${scopeId} expected`, description: "Expected", severityHint: "medium", exampleRationale: "Rationale", appliesTo: ["all"] }],
        exclusions: []
      }));
      assert.match(prompt ?? "", new RegExp(`${scopeId} aspect`));
      assert.match(prompt ?? "", new RegExp(`${scopeId} expected`));
    }
    assert.equal(buildScopePlaybookSystemPrompt("topology", defaultTopologyScopePlaybook), undefined);

    process.env.AI_TOPOLOGY_PLAYBOOK = "1";
    const topologyPrompt = buildScopePlaybookSystemPrompt("topology", defaultTopologyScopePlaybook);
    assert.match(topologyPrompt ?? "", /Scope Playbook - topology/);
    assert.match(topologyPrompt ?? "", /STP root bridge/);
    assert.match(topologyPrompt ?? "", /OSPF\/EIGRP/);
    assert.match(topologyPrompt ?? "", /SPOF por uplink/);
    assert.equal(buildScopePlaybookSystemPrompt("operations", defaultOperationsScopePlaybook), undefined);
  } finally {
    restoreEnv("AI_SCOPE_PLAYBOOK", previousScopePlaybook);
    restoreEnv("AI_TOPOLOGY_PLAYBOOK", previousTopologyPlaybook);
  }
});

test("scope playbook exclusions apply for security evidence and performance with appliesTo", () => {
  const previous = process.env.AI_SCOPE_PLAYBOOK;
  try {
    process.env.AI_SCOPE_PLAYBOOK = "1";
    for (const scopeId of ["security", "evidence", "performance"] as const) {
      const playbook = normalizeScopePlaybook({
        scopeId,
        exclusions: [{
          id: `${scopeId}-ios-suppress`,
          keywords: ["known", "noise"],
          reason: "Known noise for IOS only.",
          source: "manual",
          appliesTo: ["ios"]
        }]
      });
      const result = applyScopePlaybookExclusions(scopeId, [
        finding({ finding_id: `${scopeId}_ios`, title: "Known signal", technical_rationale: "Known noise.", related_devices: ["ios-01"] }),
        finding({ finding_id: `${scopeId}_asa`, title: "Known signal", technical_rationale: "Known noise.", related_devices: ["asa-01"] })
      ], playbook, { "ios-01": "ios", "asa-01": "asa" });

      assert.deepEqual(result.suppressed.map((item) => item.finding.finding_id), [`${scopeId}_ios`]);
      assert.deepEqual(result.kept.map((item) => item.finding_id), [`${scopeId}_asa`]);
    }
  } finally {
    process.env.AI_SCOPE_PLAYBOOK = previous;
  }
});

test("topology playbook exclusions apply only when topology playbook flag is enabled", () => {
  const previousScopePlaybook = process.env.AI_SCOPE_PLAYBOOK;
  const previousTopologyPlaybook = process.env.AI_TOPOLOGY_PLAYBOOK;
  try {
    const playbook = normalizeScopePlaybook({
      scopeId: "topology",
      exclusions: [{
        id: "topology-lab-noise",
        keywords: ["lab", "single-homed"],
        reason: "Lab segment accepted.",
        source: "manual",
        appliesTo: ["all"]
      }]
    });
    const findings = [
      finding({ finding_id: "topo_lab", title: "Lab single-homed", technical_rationale: "lab single-homed segment." }),
      finding({ finding_id: "topo_prod", title: "Production single-homed", technical_rationale: "production single-homed segment." })
    ];

    process.env.AI_SCOPE_PLAYBOOK = "1";
    process.env.AI_TOPOLOGY_PLAYBOOK = "";
    const off = applyScopePlaybookExclusions("topology", findings, playbook);
    assert.deepEqual(off.kept.map((item) => item.finding_id), ["topo_lab", "topo_prod"]);
    assert.deepEqual(off.suppressed, []);

    process.env.AI_TOPOLOGY_PLAYBOOK = "1";
    const on = applyScopePlaybookExclusions("topology", findings, playbook);
    assert.deepEqual(on.suppressed.map((item) => item.finding.finding_id), ["topo_lab"]);
    assert.deepEqual(on.kept.map((item) => item.finding_id), ["topo_prod"]);
  } finally {
    restoreEnv("AI_SCOPE_PLAYBOOK", previousScopePlaybook);
    restoreEnv("AI_TOPOLOGY_PLAYBOOK", previousTopologyPlaybook);
  }
});

test("supported scope input hash changes with playbook hash only when flag is enabled", () => {
  const previousScopePlaybook = process.env.AI_SCOPE_PLAYBOOK;
  const previousTopologyPlaybook = process.env.AI_TOPOLOGY_PLAYBOOK;
  const previousOperationsPlaybook = process.env.AI_OPERATIONS_PLAYBOOK;
  try {
    process.env.AI_SCOPE_PLAYBOOK = "";
    process.env.AI_TOPOLOGY_PLAYBOOK = "";
    process.env.AI_OPERATIONS_PLAYBOOK = "";
    for (const scopeId of ["configuration", "security", "evidence", "performance"] as const) {
      const offA = hashScopeInput(record(), scopeId, { scopePlaybookHash: "playbook-a" });
      const offB = hashScopeInput(record(), scopeId, { scopePlaybookHash: "playbook-b" });
      assert.equal(offA, offB);
    }

    process.env.AI_SCOPE_PLAYBOOK = "1";
    process.env.AI_TOPOLOGY_PLAYBOOK = "";
    for (const scopeId of ["configuration", "security", "evidence", "performance"] as const) {
      const onA = hashScopeInput(record(), scopeId, { scopePlaybookHash: "playbook-a" });
      const onB = hashScopeInput(record(), scopeId, { scopePlaybookHash: "playbook-b" });
      assert.notEqual(onA, onB);
    }

    const topologyA = hashScopeInput(record(), "topology", { scopePlaybookHash: "playbook-a" });
    const topologyB = hashScopeInput(record(), "topology", { scopePlaybookHash: "playbook-b" });
    assert.equal(topologyA, topologyB);

    const operationsA = hashScopeInput(record(), "operations", { scopePlaybookHash: "playbook-a" });
    const operationsB = hashScopeInput(record(), "operations", { scopePlaybookHash: "playbook-b" });
    assert.equal(operationsA, operationsB);

    process.env.AI_OPERATIONS_PLAYBOOK = "1";
    const operationsOnA = hashScopeInput(record(), "operations", { scopePlaybookHash: "playbook-a" });
    const operationsOnB = hashScopeInput(record(), "operations", { scopePlaybookHash: "playbook-b" });
    assert.notEqual(operationsOnA, operationsOnB);

    process.env.AI_TOPOLOGY_PLAYBOOK = "1";
    const topologyOnA = hashScopeInput(record(), "topology", { scopePlaybookHash: "playbook-a" });
    const topologyOnB = hashScopeInput(record(), "topology", { scopePlaybookHash: "playbook-b" });
    assert.notEqual(topologyOnA, topologyOnB);
  } finally {
    restoreEnv("AI_SCOPE_PLAYBOOK", previousScopePlaybook);
    restoreEnv("AI_TOPOLOGY_PLAYBOOK", previousTopologyPlaybook);
    restoreEnv("AI_OPERATIONS_PLAYBOOK", previousOperationsPlaybook);
  }
});

test("coverage ledger input hash changes only for covered scopes", () => {
  const previous = process.env.AI_COVERAGE_LEDGER;
  try {
    process.env.AI_COVERAGE_LEDGER = "";
    const offConfiguration = hashScopeInput(record(), "configuration");
    const offTopology = hashScopeInput(record(), "topology");

    process.env.AI_COVERAGE_LEDGER = "1";
    assert.notEqual(hashScopeInput(record(), "configuration"), offConfiguration);
    assert.equal(hashScopeInput(record(), "topology"), offTopology);
  } finally {
    if (previous === undefined) {
      delete process.env.AI_COVERAGE_LEDGER;
    } else {
      process.env.AI_COVERAGE_LEDGER = previous;
    }
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

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
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
