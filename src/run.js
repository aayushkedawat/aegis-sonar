import fs from "node:fs";
import { execa } from "execa";
import which from "which";
import path from "node:path";
import kleur from "kleur";

/* ------------------------- color controls (default ON) ------------------------- */

let useColor = computeColorEnabled();
const MAX_PRINT = 300;

function computeColorEnabled() {
  if (process.env.NO_COLOR) return false; // hard off
  if (process.env.AEGIS_COLOR === "0") return false;
  if (process.env.AEGIS_COLOR === "1") return true;
  return true; // default ON
}

export function applyColorMode(argv = {}) {
  if ("no-color" in argv) useColor = false;
  if ("color" in argv) useColor = true;
}

const c = {
  ok: (s) => (useColor ? kleur.green().bold(s) : s),
  err: (s) => (useColor ? kleur.red().bold(s) : s),
  warn: (s) => (useColor ? kleur.yellow().bold(s) : s),
  info: (s) => (useColor ? kleur.cyan(s) : s),
  dim: (s) => (useColor ? kleur.dim(s) : s),
  head: (s) => (useColor ? kleur.bold().underline(s) : s),
  sev: (sev, s) => {
    if (!useColor) return s;
    if (sev === "BLOCKER")
      return kleur
        .bgRed()
        .white()
        .bold(" " + s + " ");
    if (sev === "CRITICAL") return kleur.red().bold(s);
    if (sev === "MAJOR") return kleur.yellow(s);
    if (sev === "MINOR") return kleur.magenta(s);
    return kleur.white(s);
  },
  link: (s) => (useColor ? kleur.underline().blue(s) : s),
};

/* --------------------------------- utils --------------------------------- */

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(name + " not set");
  return v;
}

function readProps(file = "sonar-project.properties") {
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

function loadConfig(argvFormat) {
  const defaults = {
    severities: "BLOCKER,CRITICAL,MAJOR",
    types: "BUG,VULNERABILITY,CODE_SMELL",
    max: 500,
    issuesFile: "sonar-issues", // base name; extension will be added by format
    format: "text",
  };
  const merged = { ...defaults };
  for (const p of [".aegisrc.json", ".aegisrc.local.json"]) {
    if (fs.existsSync(p)) {
      try {
        Object.assign(merged, JSON.parse(fs.readFileSync(p, "utf-8")));
      } catch {}
    }
  }
  if (!Number.isFinite(merged.max)) merged.max = defaults.max;
  if (argvFormat && ["text", "md", "json"].includes(String(argvFormat))) {
    merged.format = argvFormat;
  }
  return merged;
}

function shouldPrintIssues(argv) {
  return Boolean(argv?.["print-issues"]);
}

function printIssuesToConsole(list) {
  const n = Math.min(MAX_PRINT, list.console.length);
  for (let i = 0; i < n; i++) console.log(list.console[i]);
  if (list.console.length > MAX_PRINT) {
    console.log(
      c.dim(
        "… (" + (list.console.length - MAX_PRINT) + " more lines truncated)"
      )
    );
  }
}

async function getChangedFiles(baseBranch) {
  let base = baseBranch;
  if (!base) {
    for (const cand of [
      "origin/HEAD",
      "origin/main",
      "main",
      "origin/master",
      "master",
    ]) {
      try {
        await execa("git", ["rev-parse", "--verify", cand]);
        base = cand;
        break;
      } catch {}
    }
    if (!base) base = "HEAD~1";
  }
  let mergeBase = null;
  try {
    const { stdout } = await execa("git", ["merge-base", base, "HEAD"]);
    mergeBase = stdout.trim();
  } catch {}
  const diffRange = mergeBase ? mergeBase + "...HEAD" : base + "...HEAD";
  const { stdout } = await execa("git", ["diff", "--name-only", diffRange]);
  const all = stdout.split(/\r?\n/).filter(Boolean);
  const keep = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
  return all.filter((f) => keep.has(path.extname(f)) && fs.existsSync(f));
}

function trimSlash(u) {
  return u?.endsWith("/") ? u.slice(0, -1) : u || "";
}

/* ---------- report path + metadata helpers ---------- */

function resolveIssuesPath(baseName, format) {
  let ext;
  if (format === "md") ext = ".md";
  else if (format === "json") ext = ".json";
  else ext = ".txt";

  const base = String(baseName || "sonar-issues");
  const hasExt = /\.(txt|md|json)$/i.test(base);
  return hasExt ? base.replace(/\.(txt|md|json)$/i, ext) : base + ext;
}

function printAndSaveIssues(cfg, list) {
  // Avoid huge console output: show only top N lines to prevent inspect/stack churn.
  const MAX_PRINT = Math.min(300, list.console.length); // adjustable
  for (let i = 0; i < MAX_PRINT; i++) console.log(list.console[i]);
  if (list.console.length > MAX_PRINT) {
    console.log(
      c.dim(
        "… (" + (list.console.length - MAX_PRINT) + " more lines truncated)"
      )
    );
  }

  /* ---- issue printing control ---- */

  const outPath = resolveIssuesPath(cfg.issuesFile, cfg.format);
  fs.writeFileSync(outPath, formatIssuesFile(cfg.format, list), "utf-8");
  console.error(
    "\n",
    c.warn("📝"),
    "Saved issue list to",
    c.dim(outPath),
    c.info("(" + list.count + " items, format=" + cfg.format + ")")
  );
}

function nowIso() {
  return new Date().toISOString();
}

function toolVersion() {
  return process.env.npm_package_version || "unknown";
}

function buildMeta({ projectKey, serverUrl, total, filters, format }) {
  return {
    generatedAt: nowIso(),
    format,
    projectKey,
    serverUrl,
    total,
    filters,
    generator: { name: "aegis-sonar", version: toolVersion() },
    runtime: { node: process.version, platform: process.platform },
  };
}

/* ----------------------------- file builders ----------------------------- */

// moved to outer scope (was inner)
function pad(s, n) {
  const str = String(s ?? "");
  return str + " ".repeat(Math.max(0, n - str.length));
}

function buildTextTable({ rows, meta }) {
  const headers = [
    "FILE",
    "LINE",
    "SEVERITY",
    "TYPE",
    "RULE",
    "MESSAGE",
    "URL",
  ];
  const cols = [
    rows.map((r) => r.file).concat(headers[0]),
    rows.map((r) => String(r.line)).concat(headers[1]),
    rows.map((r) => r.sev).concat(headers[2]),
    rows.map((r) => r.type).concat(headers[3]),
    rows.map((r) => r.rule).concat(headers[4]),
    rows.map((r) => r.msg).concat(headers[5]),
    rows.map((r) => r.url).concat(headers[6]),
  ];
  const widths = cols.map((col) =>
    Math.max(...col.map((v) => (v ?? "").length))
  );
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const header = headers.map((h, i) => pad(h, widths[i])).join("  ");
  const body = rows.map((r) =>
    [
      pad(r.file, widths[0]),
      pad(r.line, widths[1]),
      pad(r.sev, widths[2]),
      pad(r.type, widths[3]),
      pad(r.rule, widths[4]),
      pad(r.msg, widths[5]),
      pad(r.url, widths[6]),
    ].join("  ")
  );
  return [
    "Sonar Issues Report",
    "Generated: " + meta.generatedAt,
    "Format   : " + meta.format,
    "Project  : " + meta.projectKey,
    "Server   : " + meta.serverUrl,
    "Total    : " + meta.total,
    "Filters  : " + meta.filters,
    "Tool     : " + meta.generator.name + "@" + meta.generator.version,
    "Runtime  : node " + meta.runtime.node + " (" + meta.runtime.platform + ")",
    "",
    header,
    sep,
    ...body,
    "",
  ].join("\n");
}
function buildMarkdown({ rows, meta }) {
  const header = "| FILE | LINE | SEVERITY | TYPE | RULE | MESSAGE | URL |";
  const sep = "| ---- | ---- | -------- | ---- | ---- | ------- | --- |";
  const lines = rows.map(
    (r) =>
      "| " +
      escMd(r.file) +
      " | " +
      r.line +
      " | " +
      escMd(r.sev) +
      " | " +
      escMd(r.type) +
      " | " +
      escMd(r.rule) +
      " | " +
      escMd(r.msg) +
      " | [link](" +
      r.url +
      ") |"
  );
  return [
    "# Sonar Issues Report",
    "",
    "**Generated:** " + escMd(meta.generatedAt) + "  ",
    "**Format:** " + escMd(meta.format) + "  ",
    "**Project:** " + escMd(meta.projectKey) + "  ",
    "**Server:** " + escMd(meta.serverUrl) + "  ",
    "**Total:** " + meta.total + "  ",
    "**Filters:** " + escMd(meta.filters) + "  ",
    "**Tool:** " +
      escMd(meta.generator.name + "@" + meta.generator.version) +
      "  ",
    "**Runtime:** " +
      escMd("node " + meta.runtime.node + " (" + meta.runtime.platform + ")"),
    "",
    header,
    sep,
    ...lines,
    "",
  ].join("\n");
}

function buildJson({ rows, meta }) {
  return JSON.stringify({ meta, issues: rows }, null, 2);
}

function formatIssuesFile(format, list) {
  return list.buildPayload(format);
}

/* ------------------------------ helpers for run ------------------------------ */

function hasPropsFile() {
  return fs.existsSync("sonar-project.properties");
}

function ensureProps() {
  if (!hasPropsFile()) {
    console.log(
      c.info("ℹ"),
      "sonar-project.properties not found: skipping Sonar scan"
    );
    process.exit(0);
  }
  const props = readProps();
  const serverUrl = trimSlash(props?.["sonar.host.url"] || "");
  const projectKey = props?.["sonar.projectKey"] || "";
  if (!serverUrl || !projectKey) {
    console.error(
      c.err("✖"),
      "sonar.host.url or sonar.projectKey missing in sonar-project.properties"
    );
    process.exit(1);
  }
  return { serverUrl, projectKey };
}

async function ensureScannerAndToken() {
  try {
    await which("sonar-scanner");
  } catch {
    throw new Error("sonar-scanner not found on PATH");
  }
  need("SONAR_TOKEN");
}

async function performDryRun(cfg, serverUrl, projectKey, opts = {}) {
  need("SONAR_TOKEN");
  console.log(
    c.head("🧪 Aegis dry-run"),
    c.dim("(no analyzer; fetch existing issues)")
  );
  try {
    const list = await fetchIssuesDirect(cfg, serverUrl, projectKey);

    if (opts.printIssues) {
      printIssuesToConsole(list);
    }

    const outPath = resolveIssuesPath(cfg.issuesFile, cfg.format);
    fs.writeFileSync(outPath, formatIssuesFile(cfg.format, list), "utf-8");
    console.log(
      c.ok("✔"),
      "Saved issue list to",
      c.dim(outPath),
      c.info("(" + list.count + " items, format=" + cfg.format + ")")
    );
    process.exit(0);
  } catch (e) {
    console.error(c.err("✖"), "dry-run failed:", c.dim(e?.message || e));
    process.exit(1);
  }
}

async function buildPreviewProps(argv) {
  if (!argv?.preview) return [];
  const files = await getChangedFiles(argv?.base);
  if (files.length === 0) {
    console.log(
      c.info("ℹ"),
      "--preview: no changed JS/TS files detected; skipping scan"
    );
    process.exit(0);
  }
  console.log(
    c.head("🔎 Aegis preview"),
    c.dim(
      "(" +
        files.length +
        " changed file(s), base=" +
        (argv?.base || "auto") +
        ")"
    )
  );
  return [
    "-Dsonar.inclusions=" + files.join(","),
    "-Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**,**/.next/**",
  ];
}

function handleScanPass(cfg, stdout, opts = {}) {
  fs.writeFileSync("sonar-report.txt", stdout || "", "utf-8");

  if (opts.printIssues) {
    // When requested, read issues produced by the just-finished scan
    listIssuesFromTask(cfg)
      .then((list) => {
        printIssuesToConsole(list);
        const outPath = resolveIssuesPath(cfg.issuesFile, cfg.format);
        fs.writeFileSync(outPath, formatIssuesFile(cfg.format, list), "utf-8");
        console.log(
          c.ok("✔"),
          "Sonar Quality Gate passed — issues saved to",
          c.dim(outPath),
          c.info("(" + list.count + " items, format=" + cfg.format + ")")
        );
      })
      .catch(() => {
        // If the task isn’t available for any reason, just keep the success message
        console.log(c.ok("✔"), "Sonar Quality Gate passed");
      });
  } else {
    // Quiet default: remove any stale issues file (if present)
    const outPath = resolveIssuesPath(cfg.issuesFile, cfg.format);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    console.log(c.ok("✔"), "Sonar Quality Gate passed");
  }
}

async function handleScanFail(cfg, error, opts = {}) {
  const scanOutput = (error?.stdout || error?.stderr || "").toString();
  fs.writeFileSync("sonar-report.txt", scanOutput, "utf-8");

  console.error(
    c.err("✖"),
    "Sonar Quality Gate failed — issues saved to file."
  );

  // First attempt: from .scannerwork
  try {
    const list = await listIssuesFromTask(cfg);

    if (opts.printIssues) {
      printIssuesToConsole(list);
    }

    const outPath = resolveIssuesPath(cfg.issuesFile, cfg.format);
    fs.writeFileSync(outPath, formatIssuesFile(cfg.format, list), "utf-8");
    console.error(
      c.warn("📝"),
      "Saved",
      c.dim(outPath),
      c.info("(" + list.count + " items, format=" + cfg.format + ")")
    );
    process.exit(1);
  } catch (error) {
    console.warn(
      c.info("ℹ"),
      "Task-based issue list unavailable:",
      c.dim(error?.message || error)
    );
  }

  // Fallback: direct fetch via sonar-project.properties
  try {
    const props = readProps();
    const serverUrl = trimSlash(props?.["sonar.host.url"] || "");
    const projectKey = props?.["sonar.projectKey"] || "";
    if (!serverUrl || !projectKey)
      throw new Error("Missing sonar.host.url/projectKey");

    const list = await fetchIssuesDirect(cfg, serverUrl, projectKey);

    if (opts.printIssues) {
      printIssuesToConsole(list);
    }

    const outPath = resolveIssuesPath(cfg.issuesFile, cfg.format);
    fs.writeFileSync(outPath, formatIssuesFile(cfg.format, list), "utf-8");
    console.error(
      c.warn("📝"),
      "Saved",
      c.dim(outPath),
      c.info("(" + list.count + " items, format=" + cfg.format + ")")
    );
  } catch (error) {
    console.warn(
      c.info("ℹ"),
      "Direct fetch issue list unavailable:",
      c.dim(error?.message || error)
    );
    console.warn(
      c.info("ℹ"),
      "Tip:",
      c.dim("npx aegis run --dry-run --format md"),
      "to verify API access."
    );
  }

  process.exit(1);
}

/* ---------------------------------- run ---------------------------------- */

export async function run(argv = {}) {
  applyColorMode(argv); // honor --color / --no-color, default ON
  if (argv?.cwd) process.chdir(argv.cwd);

  const { serverUrl, projectKey } = ensureProps();
  const cfg = loadConfig(argv?.format);

  if (argv?.["dry-run"]) {
    await performDryRun(cfg, serverUrl, projectKey, {
      printIssues: shouldPrintIssues(argv),
    });
    return;
  }

  await ensureScannerAndToken();
  const previewProps = await buildPreviewProps(argv);

  const cmd = "sonar-scanner";
  const args = [
    "-Dsonar.qualitygate.wait=true",
    "-Dsonar.login=" + process.env.SONAR_TOKEN,
    ...previewProps,
  ];

  if (argv?.verbose) {
    console.log(c.info("🔧 Command:"), c.dim([cmd, ...args].join(" ")));
  }

  console.log(c.head("▶ SonarQube scan"), c.dim("(blocking on Quality Gate)"));
  try {
    const { stdout } = await execa(cmd, args, {
      stdio: ["inherit", "pipe", "inherit"],
    });
    handleScanPass(cfg, stdout, { printIssues: shouldPrintIssues(argv) });
  } catch (e) {
    await handleScanFail(cfg, e, { printIssues: shouldPrintIssues(argv) });
  }
}

/* -------------------------- issue listing (shared) -------------------------- */

async function listIssuesFromTask(cfg) {
  const taskFile = ".scannerwork/report-task.txt";
  if (!fs.existsSync(taskFile))
    throw new Error(taskFile + " not found (scanner didn’t run)");
  const txt = fs.readFileSync(taskFile, "utf-8");
  const serverUrl = trimSlash(prop(txt, "serverUrl") || "");
  const projectKey = prop(txt, "projectKey") || "";
  if (!serverUrl || !projectKey) {
    throw new Error("Missing serverUrl/projectKey in report-task.txt");
  }
  return await fetchIssuesDirect(cfg, serverUrl, projectKey);
}

function escapeRegExp(s) {
  // regex is required; replaceAll would not be equivalent here
  // return String(s).replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escapeRegExp(String(s));
}

function prop(txt, key) {
  // String.raw to avoid escaping backslashes in the template
  const re = new RegExp(String.raw`^${escapeRegExp(key)}=(.*)$`, "m");
  const m = txt?.match(re);
  return m?.[1]?.trim() ?? null;
}

async function fetchIssuesDirect(cfg, serverUrl, projectKey) {
  const params = new URLSearchParams({
    componentKeys: projectKey,
    resolved: "false",
    ps: String(cfg.max ?? 500),
    severities: cfg.severities || "BLOCKER,CRITICAL,MAJOR",
    types: cfg.types || "BUG,VULNERABILITY,CODE_SMELL",
  });

  const resp = await fetch(
    serverUrl + "/api/issues/search?" + params.toString(),
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from((process.env.SONAR_TOKEN ?? "") + ":").toString("base64"),
      },
    }
  );
  if (!resp.ok) throw new Error("Sonar issues api failed: " + resp.status);
  const data = await resp.json();
  const issues = data.issues || [];

  const baseUi = trimSlash(serverUrl) + "/project/issues";
  const rows = issues.map((i) => {
    const sev = i?.severity || "";
    const sevCol = c.sev(sev, sev);
    return {
      file: (i?.component || "").split(":").pop() || "",
      line: i?.line || 1,
      sev, // plain for files
      sevCol, // colored for console
      type: i?.type || "",
      rule: i?.rule || "",
      msg: (i?.message || "").replaceAll(/\s+/g, " ").trim(),
      url:
        baseUi +
        "?open=" +
        encodeURIComponent(i?.key || "") +
        "&id=" +
        encodeURIComponent(projectKey),
    };
  });

  const consoleLines = [
    c.info("🔎"),
    String(data.total) + " issues",
    c.dim(
      "(sev: " +
        (cfg.severities || "BLOCKER,CRITICAL,MAJOR") +
        "; types: " +
        (cfg.types || "BUG,VULNERABILITY,CODE_SMELL") +
        "; max: " +
        (cfg.max ?? 500) +
        ")"
    ),
    ...rows.map(
      (r) =>
        c.dim(r.file + ":" + r.line) +
        " | " +
        r.sevCol +
        " | " +
        c.dim(r.type) +
        " | " +
        c.dim(r.rule) +
        " | " +
        r.msg +
        " | " +
        c.link(r.url)
    ),
  ];

  const filters =
    "severities=" +
    (cfg.severities || "BLOCKER,CRITICAL,MAJOR") +
    "; types=" +
    (cfg.types || "BUG,VULNERABILITY,CODE_SMELL") +
    "; max=" +
    (cfg.max ?? 500);

  const meta = buildMeta({
    projectKey,
    serverUrl,
    total: data.total,
    filters,
    format: cfg.format,
  });

  return {
    console: consoleLines,
    count: rows.length,
    buildPayload: (fmt) => {
      const plainRows = rows.map(
        ({ file, line, sev, type, rule, msg, url }) => ({
          file,
          line,
          sev,
          type,
          rule,
          msg,
          url,
        })
      );
      if (fmt === "md") return buildMarkdown({ rows: plainRows, meta });
      if (fmt === "json") return buildJson({ rows: plainRows, meta });
      return buildTextTable({ rows: plainRows, meta });
    },
  };
}

function escMd(s) {
  // prefer replaceAll + String.raw for the backslash
  return String(s ?? "").replaceAll("|", String.raw`\|`);
}
