export const manifest = {
  screens: {
    scr_00oe2l: { name: "Sign In", route: "/login", state: { "demo": false }, position: { "x": 160, "y": 220 } },
    scr_oe1wqa: { name: "Dashboard", route: "/dashboard", state: { "demo": true }, position: { "x": 160, "y": 2200 } },
    scr_jbmtri: { name: "Devices", route: "/devices", state: { "demo": true }, position: { "x": 160, "y": 4180 } },
    scr_i4hri2: { name: "Device Detail", route: "/devices/dev-fortinet-fw-01", state: { "demo": true }, position: { "x": 1560, "y": 4180 } },
    scr_gstt6k: { name: "Configurations", route: "/configurations", state: { "demo": true }, position: { "x": 160, "y": 6160 } },
    scr_w40hp7: { name: "Configuration Detail", route: "/configurations/cfg-dev-fortinet-fw-01", state: { "demo": true }, position: { "x": 1560, "y": 6160 } },
    scr_v6v5m4: { name: "Compliance", route: "/compliance", state: { "demo": true }, position: { "x": 160, "y": 8140 } },
    scr_8i5yfs: { name: "Compliance Rule", route: "/compliance/NET-016", state: { "demo": true }, position: { "x": 1560, "y": 8140 } },
    scr_flc2hl: { name: "Network Intent", route: "/network-intent", state: { "demo": true }, position: { "x": 160, "y": 10120 } },
    scr_aihs1r: { name: "Reachability", route: "/reachability", state: { "demo": true }, position: { "x": 1560, "y": 10120 } },
    scr_1n3p6s: { name: "Topology", route: "/topology", state: { "demo": true }, position: { "x": 2960, "y": 10120 } },
    scr_gtfrku: { name: "Vendors", route: "/vendors", state: { "demo": true }, position: { "x": 160, "y": 12100 } },
    scr_29ce08: { name: "Dependencies", route: "/dependencies", state: { "demo": true }, position: { "x": 1560, "y": 12100 } },
    scr_am6012: { name: "Drift", route: "/drift", state: { "demo": true }, position: { "x": 160, "y": 14080 } },
    scr_y7iilu: { name: "Findings", route: "/findings", state: { "demo": true }, position: { "x": 2960, "y": 8140 } },
    scr_jleaq0: { name: "Finding Detail", route: "/findings/f-cmp-NET-005", state: { "demo": true }, position: { "x": 4360, "y": 8140 } },
    scr_2grhiq: { name: "AI Assistant", route: "/ai-assistant", state: { "demo": true }, position: { "x": 160, "y": 16060 } },
    scr_y84pci: { name: "Reports", route: "/reports", state: { "demo": true }, position: { "x": 1560, "y": 16060 } },
    scr_ic2jx5: { name: "Risk Analysis", route: "/risk-analysis", state: { "demo": true }, position: { "x": 1560, "y": 14080 } },
    scr_pmimjo: { name: "Settings", route: "/settings", state: { "demo": true }, position: { "x": 160, "y": 18040 } }
  },
  sections: {
    sec_aa7yzm: { name: "Authentication", x: 0, y: 0, width: 1520, height: 1180 },
    sec_2m8g3w: { name: "Dashboard", x: 0, y: 1980, width: 1520, height: 1180 },
    sec_j2mywv: { name: "Device Management", x: 0, y: 3960, width: 2920, height: 1180 },
    sec_j19vdg: { name: "Configuration Management", x: 0, y: 5940, width: 2920, height: 1180 },
    sec_3gdcbi: { name: "Compliance & Findings", x: 0, y: 7920, width: 5720, height: 1180 },
    sec_mv96pw: { name: "Network Analysis", x: 0, y: 9900, width: 4320, height: 1180 },
    sec_abdsdn: { name: "Infrastructure", x: 0, y: 11880, width: 2920, height: 1180 },
    sec_zx1zu9: { name: "Monitoring & Risk", x: 0, y: 13860, width: 2920, height: 1180 },
    sec_wqt4p8: { name: "Intelligence & Reporting", x: 0, y: 15840, width: 2920, height: 1180 },
    sec_mq0l7e: { name: "Settings", x: 0, y: 17820, width: 1520, height: 1180 }
  },
  layers: [
  { kind: "section", id: "sec_aa7yzm", children: [
    { kind: "screen", id: "scr_00oe2l" }]
  },
  { kind: "section", id: "sec_2m8g3w", children: [
    { kind: "screen", id: "scr_oe1wqa" }]
  },
  { kind: "section", id: "sec_j2mywv", children: [
    { kind: "screen", id: "scr_jbmtri" },
    { kind: "screen", id: "scr_i4hri2" }]
  },
  { kind: "section", id: "sec_j19vdg", children: [
    { kind: "screen", id: "scr_gstt6k" },
    { kind: "screen", id: "scr_w40hp7" }]
  },
  { kind: "section", id: "sec_3gdcbi", children: [
    { kind: "screen", id: "scr_v6v5m4" },
    { kind: "screen", id: "scr_8i5yfs" },
    { kind: "screen", id: "scr_y7iilu" },
    { kind: "screen", id: "scr_jleaq0" }]
  },
  { kind: "section", id: "sec_mv96pw", children: [
    { kind: "screen", id: "scr_flc2hl" },
    { kind: "screen", id: "scr_aihs1r" },
    { kind: "screen", id: "scr_1n3p6s" }]
  },
  { kind: "section", id: "sec_abdsdn", children: [
    { kind: "screen", id: "scr_gtfrku" },
    { kind: "screen", id: "scr_29ce08" }]
  },
  { kind: "section", id: "sec_zx1zu9", children: [
    { kind: "screen", id: "scr_am6012" },
    { kind: "screen", id: "scr_ic2jx5" }]
  },
  { kind: "section", id: "sec_wqt4p8", children: [
    { kind: "screen", id: "scr_2grhiq" },
    { kind: "screen", id: "scr_y84pci" }]
  },
  { kind: "section", id: "sec_mq0l7e", children: [
    { kind: "screen", id: "scr_pmimjo" }]
  }]

};