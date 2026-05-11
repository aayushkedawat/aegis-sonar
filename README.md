# Aegis 🛡️

[![npm version](https://img.shields.io/npm/v/aegis-sonar.svg?logo=npm)](https://www.npmjs.com/package/aegis-sonar)
[![CI](https://github.com/aayushkedawat/aegis-sonar/actions/workflows/ci.yml/badge.svg)](https://github.com/aayushkedawat/aegis-sonar/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/npm/dm/aegis-sonar.svg)](https://www.npmjs.com/package/aegis-sonar)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**Aegis** is a developer-first CLI tool to enforce **SonarQube / SonarCloud Quality Gates** locally, before code is pushed or deployed.  
Think of it as a **shield** between sloppy commits and your production pipelines.

---

## ✨ Features

- **Pre-push guard** → blocks `git push` if Quality Gate fails
- **Live watch mode** → re-checks issues on every file save, no manual triggers
- **Instant status** → compact severity summary without running a scan
- **Preview mode** → scan only changed files for faster feedback
- **SonarCloud support** → auto-detected from `sonar.host.url`
- **Multi-language** → works with any language sonar-scanner supports
- **GitHub Actions** → posts a PR comment automatically on pass/fail
- **Reports** → export to `.txt`, `.md`, or `.json` with full metadata
- **Doctor** → sanity-checks your environment with per-OS fix instructions
- **Interactive setup** → wizard prompts and validates your config on first run

---

## 🚀 Installation

```bash
npm install -g aegis-sonar
```

Or project-local:

```bash
npm install --save-dev aegis-sonar
```

### Install sonar-scanner

| Platform | Command |
|---|---|
| macOS | `brew install sonar-scanner` |
| Windows | `choco install sonarscanner-msbuild-net46` |
| Linux | Download from [docs.sonarsource.com](https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/scanners/sonarscanner/) or use `docker run sonarsource/sonar-scanner-cli` |

---

## ⚡ Quick Start

```bash
npx aegis init
```

The interactive wizard will ask for your server URL, project key, and token — and validate them live before writing any files. It also sets up the pre-push hook and updates `.gitignore` automatically.

**For SonarCloud**, use `https://sonarcloud.io` as the host and provide your organization slug when prompted.

---

## 🛠️ Commands

```bash
npx aegis init                    # Interactive setup wizard (TTY) or file scaffold (CI)
npx aegis run                     # Full scan — blocks push on Quality Gate failure
npx aegis run --preview           # Scan only files changed since base branch
npx aegis run --dry-run           # Fetch existing issues without running scanner
npx aegis status                  # Compact severity summary (no scan, exits 0)
npx aegis watch                   # Live status — re-checks on every file save
npx aegis doctor                  # Check scanner, token, project, server health
npx aegis uninstall               # Remove the managed pre-push hook
```

### `aegis status` — quick issue summary

```
📊 Aegis status  SonarCloud · my-org_my-repo

  🔴  BLOCKER       3  ███
  🔴  CRITICAL     12  ████████████
  🟡  MAJOR        27  ████████████████████████████

  ✖ Quality Gate likely failing  (42 issues shown, 42 total)
```

### `aegis watch` — live feedback

Runs `status` on startup, then watches for file saves and re-runs automatically (2 s debounce). Shows a staleness warning when the last scan is over an hour old.

```
👁  Aegis watch  Ctrl+C to stop

📊 Aegis status  SonarQube · my-project
  ...
Last scan: 4m ago

── file changed · re-checking ──
```

---

## 🖨️ Console output

By default Aegis saves issues to a file and does not flood the terminal. Add `--print-issues` to also print them, grouped by file with clickable `file:line` links:

```
src/auth.js  (3 issues)
  :42  CRITICAL  BUG        null dereference  → https://sonar.example.com/...
  :87  MAJOR     CODE_SMELL  unused variable  → https://sonar.example.com/...

src/api.js  (1 issue)
  :12  BLOCKER  VULNERABILITY  hardcoded secret  → https://sonar.example.com/...
```

Console output is capped at 300 lines to stay readable.

---

## 📄 Reports

Aegis saves scan results to disk (auto-added to `.gitignore` by `aegis init`):

- `sonar-report.txt` → raw scanner output
- `sonar-issues.{txt|md|json}` → formatted issues (based on `--format`)

Each report includes metadata:

```json
{
  "generatedAt": "2025-10-15T12:34:56.789Z",
  "format": "json",
  "projectKey": "my_project",
  "serverUrl": "https://sonar.example.com",
  "total": 42,
  "filters": "severities=BLOCKER,CRITICAL; types=BUG,VULNERABILITY",
  "generator": { "name": "aegis-sonar", "version": "1.0.0" },
  "runtime": { "node": "v20.10.0", "platform": "linux" }
}
```

---

## ⚙️ Config

Optional `.aegisrc.json` (created by `aegis init`):

```json
{
  "severities": "BLOCKER,CRITICAL",
  "types": "BUG,VULNERABILITY",
  "max": 200,
  "issuesFile": "sonar-issues",
  "format": "md",
  "previewExtensions": ".java,.kt"
}
```

`previewExtensions` restricts `--preview` mode to specific file types. Set to `null` (the default) to include all changed files.

---

## 🔍 Troubleshooting

### `✖ Project lookup failed HTTP 403` or `✖ Server health check failed HTTP 403`

- Token valid → your token authenticates successfully
- Project 403 → token lacks **Browse / See Source Code** permission on the project
- Health 403 → token user lacks **System Admin** rights (health check is optional)

**Fix:** use a token with at least "Browse" permission on the project.

### `aegis watch` shows stale results

Watch mode shows the current server state — it does not run a local scan. If you've fixed issues locally, run `aegis run` to push a fresh scan to the server, then the watch output will update.

---

## ⚠️ Known Limitations

- Requires `sonar-scanner` installed and on `PATH` (see install table above).
- Requires a SonarQube or SonarCloud server reachable from your machine.
- Reports are non-incremental: each run overwrites the previous issue file.
- Pre-push hook tested on Git only (not Mercurial or others).

---

## 📦 Roadmap

- [ ] VS Code extension (status bar count + inline issue markers)
- [ ] HTML/CSV report formats
- [ ] Local scan in watch mode (run sonar-scanner on save, no server round-trip latency)
- [ ] Flutter/Dart support

---

## 📝 License

MIT © 2025 — Built with ☕ and ❤️ by **Aayush Kedawat** to keep code quality shields up.
