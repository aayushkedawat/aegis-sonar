import fs from "fs";
import which from "which";
import fetch from "node-fetch";
import kleur from "kleur";

/* ----------------------------- color helpers ----------------------------- */

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const color = {
  ok: (s) => (useColor ? kleur.green().bold(s) : s),
  err: (s) => (useColor ? kleur.red().bold(s) : s),
  info: (s) => (useColor ? kleur.cyan(s) : s),
  dim: (s) => (useColor ? kleur.dim(s) : s),
  head: (s) => (useColor ? kleur.bold().underline(s) : s),
};

/* ------------------------------- utilities ------------------------------- */

function logOk(msg, extra) {
  console.log(color.ok("✔"), msg, extra ?? "");
}
function logErr(msg, extra) {
  console.error(color.err("✖"), msg, extra ?? "");
}
function logInfo(msg, extra) {
  console.log(color.info("ℹ"), msg, extra ?? "");
}

function trimSlash(u) {
  return u?.endsWith("/") ? u.slice(0, -1) : u;
}

function readProperties(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  const txt = fs.readFileSync(file, "utf-8");
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function loadConfig() {
  const defaults = {
    severities: "BLOCKER,CRITICAL,MAJOR",
    types: "BUG,VULNERABILITY,CODE_SMELL",
    max: 500,
    issuesFile: "sonar-issues.txt",
    format: "text",
  };
  const result = { ...defaults };
  for (const p of [".aegisrc.json", ".aegisrc.local.json"]) {
    if (!fs.existsSync(p)) continue;
    try {
      const user = JSON.parse(fs.readFileSync(p, "utf-8"));
      if (user && typeof user === "object") Object.assign(result, user);
    } catch {
      /* ignore */
    }
  }
  if (!Number.isFinite(result.max)) result.max = defaults.max;
  if (!["text", "md", "json"].includes(result.format))
    result.format = defaults.format;
  return result;
}

function makeAuthHeader(token) {
  const b64 = Buffer.from(String(token ?? "") + ":").toString("base64");
  return { Authorization: "Basic " + b64 };
}

/* ----------------------- focused, single-step checks ---------------------- */

async function hasScanner() {
  try {
    const bin = await which("sonar-scanner");
    logOk("sonar-scanner found", color.dim("→ " + bin));
    return true;
  } catch {
    logErr("sonar-scanner not found in PATH");
    logInfo("Install (macOS):", color.dim("brew install sonar-scanner"));
    return false;
  }
}

function getToken() {
  const token = process.env.SONAR_TOKEN;
  if (token) {
    logOk("SONAR_TOKEN is set");
    return { ok: true, token };
  }
  logErr(
    "SONAR_TOKEN not set. Run:",
    color.dim("export SONAR_TOKEN=<your-token>")
  );
  return { ok: false, token: null };
}

function getSonarProps() {
  const props = readProperties("sonar-project.properties");
  if (Object.keys(props).length === 0) {
    logErr("sonar-project.properties missing or empty in repo root");
    return { ok: false, host: null, projectKey: null };
  }
  logOk("sonar-project.properties found");

  const host = props["sonar.host.url"] ?? "";
  const projectKey = props["sonar.projectKey"] ?? "";

  let ok = true;
  if (host) logOk("sonar.host.url", color.dim("→ " + host));
  else {
    logErr("sonar.host.url missing in sonar-project.properties");
    ok = false;
  }
  if (projectKey) logOk("sonar.projectKey", color.dim("→ " + projectKey));
  else {
    logErr("sonar.projectKey missing in sonar-project.properties");
    ok = false;
  }

  return { ok, host, projectKey };
}

async function checkHealth(baseUrl) {
  try {
    const resp = await fetch(baseUrl + "/api/system/health");
    const js = await resp.json().catch(() => ({}));
    if (resp.ok) {
      logOk("Server health", color.dim(js?.health ?? "unknown"));
      return true;
    }
    logErr("Server health check failed", color.dim("HTTP " + resp.status));
    return false;
  } catch (e) {
    logErr("Cannot reach SonarQube server", color.dim(e?.message ?? String(e)));
    return false;
  }
}

async function validateToken(baseUrl, headers) {
  try {
    const resp = await fetch(baseUrl + "/api/authentication/validate", {
      headers,
    });
    const js = await resp.json().catch(() => ({}));
    if (resp.ok && js?.valid === true) {
      logOk("Token valid for SonarQube");
      return true;
    }
    logErr("Token invalid for SonarQube");
    return false;
  } catch (e) {
    logErr("Auth validation call failed", color.dim(e?.message ?? String(e)));
    return false;
  }
}

async function checkProject(baseUrl, headers, projectKey) {
  try {
    const url = new URL(baseUrl + "/api/components/show");
    url.searchParams.set("component", projectKey);
    const resp = await fetch(url, { headers });
    if (resp.status === 404) {
      logErr("Project not found in SonarQube", color.dim("key=" + projectKey));
      return false;
    }
    if (!resp.ok) {
      logErr("Project lookup failed", color.dim("HTTP " + resp.status));
      return false;
    }
    logOk("Project exists in SonarQube", color.dim("key=" + projectKey));
    return true;
  } catch (e) {
    logErr("Project lookup error", color.dim(e?.message ?? String(e)));
    return false;
  }
}

/* --------------------------------- main ---------------------------------- */

export async function doctor() {
  console.log(color.head("🩺 Aegis doctor"));
  console.log(""); // spacing

  // Non-fatal: scanner presence
  const scannerOk = await hasScanner();

  // Token + props (fatal if missing)
  const { ok: tokenOk, token } = getToken();
  const { ok: propsOk, host, projectKey } = getSonarProps();

  // Config summary (informational)
  const cfg = loadConfig();
  logInfo(
    "Config",
    color.dim(
      "severities=" +
        cfg.severities +
        "; types=" +
        cfg.types +
        "; max=" +
        cfg.max +
        "; issuesFile=" +
        cfg.issuesFile +
        "; format=" +
        cfg.format
    )
  );

  // Hard prerequisites must exist
  if (!tokenOk || !propsOk) {
    console.log("");
    console.error(color.err("Doctor finished with errors."));
    process.exit(1);
  }

  const base = trimSlash(host);
  const headers = makeAuthHeader(token);

  // Run independent remote checks
  const [healthOk, authOk, projectOk] = await Promise.all([
    checkHealth(base),
    validateToken(base, headers),
    checkProject(base, headers, projectKey),
  ]);

  const hadError = !(scannerOk && healthOk && authOk && projectOk);

  console.log("");
  if (hadError) {
    console.error(color.err("Doctor check complete (issues found)."));
    process.exit(1);
  } else {
    console.log(color.ok("Doctor check complete."));
    process.exit(0);
  }
}
