// src/ci.js — GitHub Actions PR comment integration
import fs from "node:fs";

export function isGitHubActions() {
  return process.env.GITHUB_ACTIONS === "true";
}

function getPrNumber() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return null;
  try {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
    return event?.pull_request?.number ?? event?.number ?? null;
  } catch {
    return null;
  }
}

function getRepo() {
  return process.env.GITHUB_REPOSITORY || "";
}

function getToken() {
  return process.env.GITHUB_TOKEN || "";
}

const SEV_ICON = { BLOCKER: "🔴", CRITICAL: "🔴", MAJOR: "🟡", MINOR: "🔵", INFO: "⚪" };
const SEV_ORDER = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO"];

function severitySummary(bySeverity = {}) {
  return SEV_ORDER
    .filter((s) => bySeverity[s])
    .map((s) => (SEV_ICON[s] || "⚪") + " " + bySeverity[s] + " " + s)
    .join(" · ");
}

function buildPassBody(projectKey, serverUrl) {
  return [
    "## Aegis — Quality Gate passed ✅",
    "",
    `**Project:** \`${projectKey}\` · **Server:** ${serverUrl}`,
  ].join("\n");
}

function buildFailBody(projectKey, serverUrl, list) {
  const summary = severitySummary(list.bySeverity);
  const lines = [
    "## Aegis — Quality Gate failed ❌",
    "",
    `**Project:** \`${projectKey}\` · **Server:** ${serverUrl}`,
    `**Issues:** ${list.total ?? list.count}` + (summary ? " — " + summary : ""),
    "",
  ];

  if (list.count > 0) {
    lines.push("<details>");
    lines.push("<summary>View issues</summary>", "");
    lines.push(list.buildPayload("md"));
    lines.push("</details>");
  }

  return lines.join("\n");
}

async function findExistingComment(repo, prNumber, token) {
  const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;
  const resp = await fetch(url, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
    },
  });
  if (!resp.ok) return null;
  const comments = await resp.json();
  return comments.find((c) => c?.body?.startsWith("## Aegis —")) ?? null;
}

async function upsertComment(repo, prNumber, token, body) {
  const existing = await findExistingComment(repo, prNumber, token);
  const url = existing
    ? `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`
    : `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;

  const resp = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });

  if (!resp.ok) {
    throw new Error("GitHub comment API failed: " + resp.status);
  }
}

export async function postCiComment({ passed, projectKey, serverUrl, list, format }) {
  if (!isGitHubActions()) return;

  const token = getToken();
  const repo = getRepo();
  const prNumber = getPrNumber();

  if (!token || !repo || !prNumber) return;

  const body = passed
    ? buildPassBody(projectKey, serverUrl)
    : buildFailBody(projectKey, serverUrl, list);

  await upsertComment(repo, prNumber, token, body);
}
