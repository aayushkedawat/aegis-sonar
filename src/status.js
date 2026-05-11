// src/status.js
import fs from "node:fs";
import { c, applyColorMode } from "./colors.js";
import { readProps, loadConfig, fetchIssuesDirect, isSonarCloud, trimSlash } from "./run.js";

const SEV_ORDER = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO"];

const SEV_ICON = {
  BLOCKER:  "🔴",
  CRITICAL: "🔴",
  MAJOR:    "🟡",
  MINOR:    "🔵",
  INFO:     "⚪",
};

function severityBar(count, max) {
  if (max === 0) return "";
  const filled = Math.max(1, Math.round((count / max) * 20));
  return "█".repeat(filled);
}

function formatSummaryTable(bySeverity) {
  const present = SEV_ORDER.filter((s) => bySeverity[s]);
  if (present.length === 0) return "  " + c.ok("No issues found");

  const max = Math.max(...present.map((s) => bySeverity[s]));
  const lines = [];
  for (const sev of present) {
    const n = bySeverity[sev];
    const icon = SEV_ICON[sev] || "⚪";
    const label = c.sev(sev, sev.padEnd(8));
    const count = String(n).padStart(4);
    const bar = c.dim(severityBar(n, max));
    lines.push("  " + icon + "  " + label + "  " + count + "  " + bar);
  }
  return lines.join("\n");
}

export async function status(argv = {}) {
  applyColorMode(argv);
  if (argv?.cwd) process.chdir(argv.cwd);

  if (!fs.existsSync("sonar-project.properties")) {
    console.error(c.err("✖"), "sonar-project.properties not found");
    process.exit(1);
  }

  const props = readProps();
  const serverUrl = trimSlash(props?.["sonar.host.url"] || "");
  const projectKey = props?.["sonar.projectKey"] || "";
  const organization = props?.["sonar.organization"] || "";

  if (!serverUrl || !projectKey) {
    console.error(c.err("✖"), "sonar.host.url or sonar.projectKey missing");
    process.exit(1);
  }

  if (!process.env.SONAR_TOKEN) {
    console.error(c.err("✖"), "SONAR_TOKEN not set");
    process.exit(1);
  }

  const cfg = loadConfig(argv?.format);
  const label = isSonarCloud(serverUrl) ? "SonarCloud" : "SonarQube";

  console.log(
    c.head("📊 Aegis status") + "  " + c.dim(label + " · " + projectKey)
  );
  console.log("");

  try {
    const list = await fetchIssuesDirect(cfg, serverUrl, projectKey, organization);
    const total = list.total ?? list.count;

    console.log(formatSummaryTable(list.bySeverity));
    console.log("");

    if (total === 0) {
      console.log(c.ok("✔"), "Quality Gate is green — no issues.");
    } else {
      const shown = list.count;
      const gate = total > 0 ? c.err("✖ Quality Gate likely failing") : c.ok("✔ Quality Gate passing");
      console.log(gate + "  " + c.dim("(" + shown + " issues shown, " + total + " total)"));
    }
  } catch (e) {
    console.error(c.err("✖"), "Status check failed:", c.dim(e?.message || e));
    process.exit(1);
  }
}
