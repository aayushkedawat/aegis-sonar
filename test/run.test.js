import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  readProps,
  loadConfig,
  resolveIssuesPath,
  buildTextTable,
  buildMarkdown,
  buildJson,
  escapeRegExp,
  trimSlash,
  pad,
  escMd,
} from "../src/run.js";

// ─── escapeRegExp ────────────────────────────────────────────────────────────

test("escapeRegExp: leaves plain string unchanged", () => {
  assert.equal(escapeRegExp("hello"), "hello");
});

test("escapeRegExp: escapes regex metacharacters", () => {
  assert.equal(escapeRegExp("a.b*c+d?"), "a\\.b\\*c\\+d\\?");
});

test("escapeRegExp: escapes brackets and braces", () => {
  assert.equal(escapeRegExp("a[b]{c}(d)"), "a\\[b\\]\\{c\\}\\(d\\)");
});

test("escapeRegExp: coerces non-string input", () => {
  assert.equal(escapeRegExp(42), "42");
});

// ─── trimSlash ───────────────────────────────────────────────────────────────

test("trimSlash: removes trailing slash", () => {
  assert.equal(trimSlash("https://example.com/"), "https://example.com");
});

test("trimSlash: leaves URL without trailing slash unchanged", () => {
  assert.equal(trimSlash("https://example.com"), "https://example.com");
});

test("trimSlash: returns empty string for undefined", () => {
  assert.equal(trimSlash(undefined), "");
});

// ─── pad ─────────────────────────────────────────────────────────────────────

test("pad: pads short string to target width", () => {
  assert.equal(pad("hi", 5), "hi   ");
});

test("pad: does not truncate string longer than target", () => {
  assert.equal(pad("toolong", 4), "toolong");
});

test("pad: handles null/undefined as empty string", () => {
  assert.equal(pad(null, 3), "   ");
  assert.equal(pad(undefined, 3), "   ");
});

// ─── escMd ───────────────────────────────────────────────────────────────────

test("escMd: escapes pipe characters", () => {
  assert.equal(escMd("a|b|c"), "a\\|b\\|c");
});

test("escMd: leaves strings without pipes unchanged", () => {
  assert.equal(escMd("no pipes here"), "no pipes here");
});

test("escMd: coerces null to empty string", () => {
  assert.equal(escMd(null), "");
});

// ─── resolveIssuesPath ───────────────────────────────────────────────────────

test("resolveIssuesPath: adds .txt for text format", () => {
  assert.equal(resolveIssuesPath("sonar-issues", "text"), "sonar-issues.txt");
});

test("resolveIssuesPath: adds .md for md format", () => {
  assert.equal(resolveIssuesPath("sonar-issues", "md"), "sonar-issues.md");
});

test("resolveIssuesPath: adds .json for json format", () => {
  assert.equal(resolveIssuesPath("sonar-issues", "json"), "sonar-issues.json");
});

test("resolveIssuesPath: replaces existing extension", () => {
  assert.equal(resolveIssuesPath("sonar-issues.txt", "json"), "sonar-issues.json");
  assert.equal(resolveIssuesPath("sonar-issues.md", "text"), "sonar-issues.txt");
});

test("resolveIssuesPath: defaults to sonar-issues when baseName is falsy", () => {
  assert.equal(resolveIssuesPath("", "text"), "sonar-issues.txt");
  assert.equal(resolveIssuesPath(null, "md"), "sonar-issues.md");
});

test("resolveIssuesPath: unknown format falls back to .txt", () => {
  assert.equal(resolveIssuesPath("sonar-issues", "csv"), "sonar-issues.txt");
});

// ─── readProps ───────────────────────────────────────────────────────────────

test("readProps: parses key=value pairs", () => {
  const tmp = path.join(os.tmpdir(), "aegis-test-props.properties");
  fs.writeFileSync(tmp, "sonar.host.url=https://example.com\nsonar.projectKey=my_project\n");
  const result = readProps(tmp);
  assert.equal(result["sonar.host.url"], "https://example.com");
  assert.equal(result["sonar.projectKey"], "my_project");
  fs.unlinkSync(tmp);
});

test("readProps: ignores comment lines and blank lines", () => {
  const tmp = path.join(os.tmpdir(), "aegis-test-props2.properties");
  fs.writeFileSync(tmp, "# comment\n\nsonar.projectKey=proj\n");
  const result = readProps(tmp);
  assert.deepEqual(result, { "sonar.projectKey": "proj" });
  fs.unlinkSync(tmp);
});

test("readProps: returns empty object when file does not exist", () => {
  const result = readProps("/nonexistent/path/sonar.properties");
  assert.deepEqual(result, {});
});

test("readProps: handles value containing = sign", () => {
  const tmp = path.join(os.tmpdir(), "aegis-test-props3.properties");
  fs.writeFileSync(tmp, "key=val=ue\n");
  const result = readProps(tmp);
  assert.equal(result["key"], "val=ue");
  fs.unlinkSync(tmp);
});

// ─── loadConfig ──────────────────────────────────────────────────────────────

test("loadConfig: returns defaults when no rc files exist", () => {
  // Run from a temp dir where no .aegisrc.json exists
  const prev = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-cfg-"));
  try {
    process.chdir(tmp);
    const cfg = loadConfig(undefined);
    assert.equal(cfg.severities, "BLOCKER,CRITICAL,MAJOR");
    assert.equal(cfg.types, "BUG,VULNERABILITY,CODE_SMELL");
    assert.equal(cfg.max, 500);
    assert.equal(cfg.issuesFile, "sonar-issues");
    assert.equal(cfg.format, "text");
  } finally {
    process.chdir(prev);
    fs.rmdirSync(tmp);
  }
});

test("loadConfig: merges .aegisrc.json over defaults", () => {
  const prev = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-cfg-"));
  try {
    process.chdir(tmp);
    fs.writeFileSync(
      path.join(tmp, ".aegisrc.json"),
      JSON.stringify({ severities: "BLOCKER", max: 100, format: "md" })
    );
    const cfg = loadConfig(undefined);
    assert.equal(cfg.severities, "BLOCKER");
    assert.equal(cfg.max, 100);
    assert.equal(cfg.format, "md");
    assert.equal(cfg.types, "BUG,VULNERABILITY,CODE_SMELL"); // default preserved
  } finally {
    process.chdir(prev);
    fs.rmSync(tmp, { recursive: true });
  }
});

test("loadConfig: argv format overrides rc file format", () => {
  const prev = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-cfg-"));
  try {
    process.chdir(tmp);
    fs.writeFileSync(
      path.join(tmp, ".aegisrc.json"),
      JSON.stringify({ format: "md" })
    );
    const cfg = loadConfig("json");
    assert.equal(cfg.format, "json");
  } finally {
    process.chdir(prev);
    fs.rmSync(tmp, { recursive: true });
  }
});

test("loadConfig: invalid max in rc falls back to default 500", () => {
  const prev = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-cfg-"));
  try {
    process.chdir(tmp);
    fs.writeFileSync(
      path.join(tmp, ".aegisrc.json"),
      JSON.stringify({ max: "not-a-number" })
    );
    const cfg = loadConfig(undefined);
    assert.equal(cfg.max, 500);
  } finally {
    process.chdir(prev);
    fs.rmSync(tmp, { recursive: true });
  }
});

// ─── report builders ─────────────────────────────────────────────────────────

const SAMPLE_ROWS = [
  {
    file: "src/index.js",
    line: 42,
    sev: "CRITICAL",
    type: "BUG",
    rule: "javascript:S1234",
    msg: "Fix this",
    url: "https://sonar.example.com/issues?open=abc",
  },
];

const SAMPLE_META = {
  generatedAt: "2025-01-01T00:00:00.000Z",
  format: "text",
  projectKey: "my_project",
  serverUrl: "https://sonar.example.com",
  total: 1,
  filters: "severities=CRITICAL",
  generator: { name: "aegis-sonar", version: "1.0.0" },
  runtime: { node: "v20.0.0", platform: "linux" },
};

test("buildTextTable: contains expected header fields", () => {
  const out = buildTextTable({ rows: SAMPLE_ROWS, meta: SAMPLE_META });
  assert.ok(out.includes("FILE"));
  assert.ok(out.includes("SEVERITY"));
  assert.ok(out.includes("MESSAGE"));
  assert.ok(out.includes("src/index.js"));
  assert.ok(out.includes("CRITICAL"));
  assert.ok(out.includes("Fix this"));
});

test("buildTextTable: includes metadata block", () => {
  const out = buildTextTable({ rows: SAMPLE_ROWS, meta: SAMPLE_META });
  assert.ok(out.includes("my_project"));
  assert.ok(out.includes("https://sonar.example.com"));
  assert.ok(out.includes("2025-01-01T00:00:00.000Z"));
});

test("buildMarkdown: produces valid markdown table syntax", () => {
  const out = buildMarkdown({ rows: SAMPLE_ROWS, meta: SAMPLE_META });
  assert.ok(out.startsWith("# Sonar Issues Report"));
  assert.ok(out.includes("| FILE | LINE |"));
  assert.ok(out.includes("| ---- |"));
  assert.ok(out.includes("src/index.js"));
});

test("buildMarkdown: escapes pipe characters in cell values", () => {
  const rows = [{ ...SAMPLE_ROWS[0], msg: "a|b" }];
  const out = buildMarkdown({ rows, meta: SAMPLE_META });
  assert.ok(out.includes("a\\|b"));
});

test("buildJson: produces valid JSON with meta and issues keys", () => {
  const out = buildJson({ rows: SAMPLE_ROWS, meta: SAMPLE_META });
  const parsed = JSON.parse(out);
  assert.ok(Array.isArray(parsed.issues));
  assert.equal(parsed.issues.length, 1);
  assert.equal(parsed.issues[0].file, "src/index.js");
  assert.equal(parsed.meta.projectKey, "my_project");
});

test("buildJson: empty issues array produces valid JSON", () => {
  const out = buildJson({ rows: [], meta: SAMPLE_META });
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed.issues, []);
});
