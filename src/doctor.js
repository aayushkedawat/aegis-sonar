// src/doctor.js
import fs from "node:fs";
import { execa } from "execa";
import which from "which";
import { c } from "./colors.js";

/* ---------------------- small utils ---------------------- */
function readProperties(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  const txt = fs.readFileSync(file, "utf-8");
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    out[key] = val;
  }
  return out;
}
function trimSlash(u) {
  return u?.endsWith("/") ? u.slice(0, -1) : u;
}

/* ---------------------- checks (split out) ---------------------- */
async function checkScanner() {
  try {
    const bin = await which("sonar-scanner");
    console.log(c.ok("✔"), "sonar-scanner found", c.dim(`→ ${bin}`));
    return true;
  } catch {
    console.error(c.err("✖"), "sonar-scanner not found on PATH");
    console.log(
      c.info("ℹ"),
      "Install (macOS):",
      c.dim("brew install sonar-scanner")
    );
    return false;
  }
}

function checkToken() {
  const token = process.env.SONAR_TOKEN;
  if (token) {
    console.log(c.ok("✔"), "SONAR_TOKEN is set");
    return { ok: true, token };
  }
  console.error(c.err("✖"), "SONAR_TOKEN not set");
  console.log(c.info("ℹ"), "Run:", c.dim("export SONAR_TOKEN=<your-token>"));
  return { ok: false, token: "" };
}

function checkProps() {
  const props = readProperties("sonar-project.properties");
  if (Object.keys(props).length === 0) {
    console.error(
      c.err("✖"),
      "sonar-project.properties missing or empty in repo root"
    );
    return { ok: false, host: "", projectKey: "" };
  }
  console.log(c.ok("✔"), "sonar-project.properties found");

  const host = props["sonar.host.url"] || "";
  const projectKey = props["sonar.projectKey"] || "";
  const organization = props["sonar.organization"] || "";
  const sonarCloud = host.toLowerCase().includes("sonarcloud.io");

  if (host) {
    console.log(c.ok("✔"), "sonar.host.url", c.dim(`→ ${host}`));
  } else {
    console.error(c.err("✖"), "sonar.host.url missing");
  }

  if (projectKey) {
    console.log(c.ok("✔"), "sonar.projectKey", c.dim(`→ ${projectKey}`));
  } else {
    console.error(c.err("✖"), "sonar.projectKey missing");
  }

  if (sonarCloud) {
    if (organization) {
      console.log(c.ok("✔"), "sonar.organization", c.dim(`→ ${organization}`));
    } else {
      console.error(c.err("✖"), "sonar.organization missing (required for SonarCloud)");
    }
  }

  return { ok: Boolean(host && projectKey && (!sonarCloud || organization)), host, projectKey };
}

function buildAuthHeader(token) {
  return token
    ? {
        Authorization: "Basic " + Buffer.from(`${token}:`).toString("base64"),
      }
    : null;
}

async function checkServerHealth(base) {
  if (!base) return false;
  try {
    const resp = await fetch(base + "/api/system/health");
    const json = await resp.json().catch(() => ({}));
    if (resp.ok) {
      console.log(
        c.ok("✔"),
        "Server health",
        c.dim(String(json?.health ?? "unknown"))
      );
      return true;
    }
    console.error(
      c.err("✖"),
      "Server health check failed",
      c.dim("HTTP " + resp.status)
    );
    if (resp.status === 403) {
      console.log(
        c.info("ℹ"),
        "Your token user may not have permission to read system health; this is optional."
      );
    }
    return false;
  } catch (e) {
    console.error(
      c.err("✖"),
      "Cannot reach SonarQube server",
      c.dim(e?.message || String(e))
    );
    return false;
  }
}

async function validateAuth(base, authHeader) {
  if (!base || !authHeader) return false;
  try {
    const resp = await fetch(base + "/api/authentication/validate", {
      headers: authHeader,
    });
    const json = await resp.json().catch(() => ({}));
    if (resp.ok && json?.valid === true) {
      console.log(c.ok("✔"), "Token valid for SonarQube");
      return true;
    }
    console.error(c.err("✖"), "Token invalid for SonarQube");
    return false;
  } catch (e) {
    console.error(
      c.err("✖"),
      "Auth validation call failed",
      c.dim(e?.message || String(e))
    );
    return false;
  }
}

async function checkProjectExists(base, authHeader, projectKey) {
  if (!base || !authHeader || !projectKey) return false;
  try {
    const url = new URL(base + "/api/components/show");
    url.searchParams.set("component", projectKey);
    const resp = await fetch(url, { headers: authHeader });

    if (resp.ok) {
      console.log(
        c.ok("✔"),
        "Project exists in SonarQube",
        c.dim("key=" + projectKey)
      );
      return true;
    }

    if (resp.status === 404) {
      console.error(
        c.err("✖"),
        "Project not found in SonarQube",
        c.dim("key=" + projectKey)
      );
    } else {
      console.error(
        c.err("✖"),
        "Project lookup failed",
        c.dim("HTTP " + resp.status)
      );
      if (resp.status === 403) {
        console.log(
          c.info("ℹ"),
          "Ensure the token user has at least",
          c.dim("Browse"),
          "permission on the project."
        );
      }
    }
    return false;
  } catch (e) {
    console.error(
      c.err("✖"),
      "Project lookup error",
      c.dim(e?.message || String(e))
    );
    return false;
  }
}

/* ---------------------- Git hooks health ---------------------- */
async function reportHooks() {
  console.log("");
  console.log(c.head("🔩 Git Hooks Health"));

  let hooksPath = "";
  try {
    const { stdout } = await execa("git", ["config", "core.hooksPath"]);
    hooksPath = (stdout || "").trim();
  } catch {
    // ignore; not a git repo or git not available
  }
  if (!hooksPath) hooksPath = ".git/hooks";

  const hasPosix = fs.existsSync(`${hooksPath}/pre-push`);
  const hasWin = fs.existsSync(`${hooksPath}/pre-push.cmd`);

  console.log(c.info("• hooksPath:"), c.dim(hooksPath));
  console.log(c.info("• pre-push:"), hasPosix ? c.ok("yes") : c.warn("no"));
  console.log(c.info("• pre-push.cmd:"), hasWin ? c.ok("yes") : c.warn("no"));

  if (hasPosix || hasWin) {
    console.log(
      c.ok("✔"),
      "Hooks detected. If GitHub Desktop still bypasses hooks, ensure files are named exactly",
      c.dim("pre-push"),
      "and",
      c.dim("pre-push.cmd"),
      "and that",
      c.dim("pre-push"),
      "is executable with LF line endings."
    );
    return;
  }

  // no hooks present
  console.log(
    c.warn("⚠"),
    "No pre-push hook detected. Run",
    c.dim("npx aegis init --scaffold"),
    "to install cross-platform hooks."
  );
}

/* ---------------------- Sonar doctor ---------------------- */
export async function doctor() {
  console.log(c.head("🩺 Aegis doctor"));
  console.log("");

  let ok = true;

  ok = (await checkScanner()) && ok;

  const { ok: tokenOk, token } = checkToken();
  ok = tokenOk && ok;

  const { ok: propsOk, host, projectKey } = checkProps();
  ok = propsOk && ok;

  // Even if basics failed, continue to show as much diagnostic info as possible
  const base = trimSlash(host);
  const authHeader = buildAuthHeader(token);

  ok = (await checkServerHealth(base)) && ok;
  ok = (await validateAuth(base, authHeader)) && ok;
  ok = (await checkProjectExists(base, authHeader, projectKey)) && ok;

  await reportHooks();

  console.log("");
  if (ok) {
    console.log(c.ok("Doctor check complete."));
    process.exit(0);
  } else {
    console.error(c.err("Doctor check complete (issues found)."));
    process.exit(1);
  }
}
