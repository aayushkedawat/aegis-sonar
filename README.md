# Aegis 🛡️

[![npm version](https://img.shields.io/npm/v/aegis-sonar.svg?logo=npm)](https://www.npmjs.com/package/aegis-sonar)
[![CI](https://github.com/aayushkedawat/aegis-sonar/actions/workflows/ci.yml/badge.svg)](https://github.com/aayushkedawat/aegis-sonar/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/npm/dm/aegis-sonar.svg)](https://www.npmjs.com/package/aegis-sonar)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**Aegis** is a developer-first CLI tool to enforce **SonarQube Quality Gates** locally, before code is pushed or deployed.  
Think of it as a **shield** between sloppy commits and your production pipelines.

---

## ✨ Features

- **Pre-push guard** → blocks `git push` if SonarQube Quality Gate fails
- **Preview mode** → scan only changed JS/TS files for quick feedback
- **Dry-run mode** → fetch current Sonar issues without running analysis
- **Developer friendly** → colorized console output, detailed issue reports
- **Reports** → export to `.txt`, `.md`, or `.json` with metadata
- **Metadata included** → timestamp, filters used, Node/CLI version
- **Configurable** → `.aegisrc.json` for severities, types, limits, etc.
- **Doctor** → sanity-checks your environment (scanner, token, project, server health)

---

## 🚀 Installation

```bash
npm install -g aegis-sonar
```

Or project-local:

```bash
npm install --save-dev aegis-sonar
```

---

## ⚡ Quick Start

1. Ensure you have:

   - `sonar-scanner` installed (e.g., `brew install sonar-scanner`)
   - `SONAR_TOKEN` exported as env var
   - `sonar-project.properties` at repo root with:
     ```properties
     sonar.host.url=https://your-sonarqube.server
     sonar.projectKey=my_project
     ```

2. Run manually:

```bash
npx aegis run
```

3. Add as a pre-push hook:

```bash
npx aegis init --scaffold
```

Now every `git push` runs Aegis first.

---

## 🛠️ Commands

```bash
npx aegis run           # full scan (blocks on Quality Gate)
npx aegis run --preview # scan only changed files
npx aegis run --dry-run # fetch issues without scanning
npx aegis doctor        # check scanner, token, project, server health
```

---

## 📄 Reports

Aegis saves scan results to disk:

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

Optional `.aegisrc.json`:

```json
{
  "severities": "BLOCKER,CRITICAL",
  "types": "BUG,VULNERABILITY",
  "max": 200,
  "issuesFile": "sonar-issues",
  "format": "md"
}
```

---

## 🔍 Troubleshooting

### Doctor shows `✖ Project lookup failed HTTP 403` or `✖ Server health check failed HTTP 403`

- ✔ Token valid → means your token works
- ✖ Project lookup 403 → your token doesn’t have **Browse / See Source Code** permissions for that project
- ✖ Health check 403 → token user doesn’t have **System Admin / System Health** rights

**Fix:**  
Create or use a token from a user with **at least “Browse” permissions** on the project.  
For health checks, system-level permissions may be required (optional; you can skip health if not needed).

---

## ⚠️ Known Limitations

- Currently supports only **JavaScript/TypeScript** projects (`.js`, `.ts`, `.jsx`, `.tsx`, `.mjs`, `.cjs`).
- Requires **SonarQube server** accessible from your machine (no SonarCloud API yet).
- Requires **`sonar-scanner`** installed locally and on `PATH`.
- Pre-push hook integration tested only on **Git** (not Mercurial or others).
- Reports are **non-incremental**: a new run overwrites the previous issue file.
- Flutter/Dart, Java, and other stacks are **not yet supported** (planned).

---

## 📦 Roadmap

- [ ] Flutter/Dart support (planned)
- [ ] HTML/CSV report formats
- [ ] VS Code extension wrapper
- [ ] GitHub Action for PR comments

---

## 📝 License

MIT © 2025 — Built with ☕ and ❤️ by **Aayush Kedawat** to keep code quality shields up.
