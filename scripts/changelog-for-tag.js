#!/usr/bin/env node
/**
 * Extract the section for a given tag (e.g. v1.2.3) from CHANGELOG.md.
 * Usage:
 *   node scripts/changelog-for-tag.js v1.2.3 > RELEASE_NOTES.md
 *
 * Rules:
 * - Matches headings like "## [1.2.3] - 2025-10-15" (with or without "v")
 * - Falls back to "Unreleased" if tag section not found
 */

import fs from "fs";
import path from "path";
import process from "process";

const tagInput = process.argv[2] || "";
const tag = String(tagInput).replace(/^refs\/tags\//, ""); // if passed from GITHUB_REF
const version = tag.replace(/^v/i, "");

const changelogPath = path.resolve(process.cwd(), "CHANGELOG.md");
if (!fs.existsSync(changelogPath)) {
  console.error("CHANGELOG.md not found");
  process.exit(2);
}

const md = fs.readFileSync(changelogPath, "utf8");

// Build a regex that captures from the target heading to the next heading (or EOF)
function sectionRegex(ver) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Matches: ## [1.2.3] - YYYY-MM-DD  OR  ## 1.2.3  OR  ## [v1.2.3] ...
  const head =
    "^##\\s*\\[?v?" + esc(ver) + "\\]?\\s*(?:-\\s*\\d{4}-\\d{2}-\\d{2})?\\s*$";
  return new RegExp(head + "[\\s\\S]*?(?=^##\\s|\\Z)", "m");
}

// Try exact section
let match = md.match(sectionRegex(version));

// Fallback to Unreleased if exact section not found
if (!match) {
  const unreleased = md.match(/^##\s*\[?Unreleased\]?\s*$/m);
  if (unreleased) {
    const idx = unreleased.index;
    // from Unreleased heading to next heading or EOF
    const rest = md.slice(idx);
    const m2 = rest.match(/^##\s.*$/m); // the first heading in rest (which is itself)
    // capture until the next heading after the first line
    const nextHead = rest.slice(m2[0].length).match(/^##\s.*$/m);
    const end = nextHead ? m2[0].length + nextHead.index : rest.length;
    match = [rest.slice(0, end)];
  }
}

// Final fallback
const body = match
  ? match[0].trim()
  : `### Notes\n- No matching entry for ${tag}.`;

console.log(body);
