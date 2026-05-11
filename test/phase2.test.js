import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadConfig, resolveIssuesPath } from "../src/run.js";
import { isGitHubActions, postCiComment } from "../src/ci.js";

// ─── SonarCloud: loadConfig picks up previewExtensions ───────────────────────

test("loadConfig: previewExtensions defaults to null", () => {
  const prev = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-p2-"));
  try {
    process.chdir(tmp);
    const cfg = loadConfig(undefined);
    assert.equal(cfg.previewExtensions, null);
  } finally {
    process.chdir(prev);
    fs.rmdirSync(tmp);
  }
});

test("loadConfig: previewExtensions can be set via .aegisrc.json", () => {
  const prev = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aegis-p2-"));
  try {
    process.chdir(tmp);
    fs.writeFileSync(
      path.join(tmp, ".aegisrc.json"),
      JSON.stringify({ previewExtensions: ".java,.kt" })
    );
    const cfg = loadConfig(undefined);
    assert.equal(cfg.previewExtensions, ".java,.kt");
  } finally {
    process.chdir(prev);
    fs.rmSync(tmp, { recursive: true });
  }
});

// ─── GitHub Actions detection ─────────────────────────────────────────────────

test("isGitHubActions: returns false when GITHUB_ACTIONS is not set", () => {
  const prev = process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTIONS;
  assert.equal(isGitHubActions(), false);
  if (prev !== undefined) process.env.GITHUB_ACTIONS = prev;
});

test("isGitHubActions: returns true when GITHUB_ACTIONS=true", () => {
  const prev = process.env.GITHUB_ACTIONS;
  process.env.GITHUB_ACTIONS = "true";
  assert.equal(isGitHubActions(), true);
  if (prev !== undefined) process.env.GITHUB_ACTIONS = prev;
  else delete process.env.GITHUB_ACTIONS;
});

// ─── postCiComment: no-ops outside GitHub Actions ────────────────────────────

test("postCiComment: resolves without throwing when not in GitHub Actions", async () => {
  const prev = process.env.GITHUB_ACTIONS;
  delete process.env.GITHUB_ACTIONS;
  await assert.doesNotReject(() =>
    postCiComment({
      passed: true,
      projectKey: "my_project",
      serverUrl: "https://sonar.example.com",
      list: { count: 0, buildPayload: () => "" },
      format: "md",
    })
  );
  if (prev !== undefined) process.env.GITHUB_ACTIONS = prev;
});

test("postCiComment: resolves without throwing when token/repo missing in CI env", async () => {
  const prevGA = process.env.GITHUB_ACTIONS;
  const prevToken = process.env.GITHUB_TOKEN;
  const prevRepo = process.env.GITHUB_REPOSITORY;
  process.env.GITHUB_ACTIONS = "true";
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_REPOSITORY;
  await assert.doesNotReject(() =>
    postCiComment({
      passed: false,
      projectKey: "my_project",
      serverUrl: "https://sonar.example.com",
      list: { count: 1, buildPayload: () => "| a | b |" },
      format: "md",
    })
  );
  if (prevGA !== undefined) process.env.GITHUB_ACTIONS = prevGA;
  else delete process.env.GITHUB_ACTIONS;
  if (prevToken !== undefined) process.env.GITHUB_TOKEN = prevToken;
  if (prevRepo !== undefined) process.env.GITHUB_REPOSITORY = prevRepo;
});
