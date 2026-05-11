# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**aegis-sonar** is a zero-build Node.js CLI tool (published to npm as `aegis-sonar`) that enforces SonarQube Quality Gates locally before code is pushed. It installs as a Git `pre-push` hook and blocks pushes when the Quality Gate fails. It also supports dry-run mode, preview mode (scan only changed files), and report exports.

## Commands

```bash
npm ci                   # install dependencies
npm run lint             # lint (placeholder – wire up a real linter here when adding one)
npm test                 # test (placeholder – currently just prints "ok")
```

There is **no build step** – the package is pure ESM and runs directly in Node.

### Running locally during development

```bash
npm link                          # symlink `aegis` CLI globally
aegis doctor                      # sanity-check environment
aegis run --dry-run --verbose     # fetch issues without running scanner
aegis run --preview --base main   # scan only changed JS/TS files
```

Or without linking:

```bash
node -e 'import("./src/run.js").then(m=>m.run({ "dry-run": true, format: "md", verbose: true }))'
```

### Releases (maintainers only)

```bash
npm run release:patch   # bumps patch version, commits, pushes tag
npm run release:minor
npm run release:major
```

The `publish` GitHub Actions workflow triggers on version tags and publishes to npm with provenance. `NPM_TOKEN` must be set in repo secrets.

## Architecture

### Entry point and dispatch

`bin/cli.js` parses `process.argv` with `minimist` and dispatches to one of five command modules. All boolean and string flags are declared in `cli.js`; add new flags there first.

### Command modules (`src/`)

| File | Command | Responsibility |
|---|---|---|
| `src/run.js` | `aegis run` | Runs sonar-scanner, polls Quality Gate, fetches issues, writes report files |
| `src/init.js` | `aegis init` | Scaffolds `pre-push`/`pre-push.cmd` hooks, `sonar-project.properties`, `.aegisrc.json` |
| `src/doctor.js` | `aegis doctor` | Checks scanner on PATH, `SONAR_TOKEN`, server reachability, token validity, project access, hook presence |
| `src/uninstall.js` | `aegis uninstall` | Removes the managed pre-push hook |
| `src/verify-hooks.js` | `aegis verify-hooks` | Installs/uninstalls a temporary test hook to verify GUI clients fire hooks |

### Issue fetch flow in `run.js`

On Quality Gate failure, `run.js` attempts two strategies to collect issues:

1. **Task-based** (`listIssuesFromTask`): reads `.scannerwork/report-task.txt` (written by the scanner) to get `serverUrl` and `projectKey`, then calls `fetchIssuesDirect`.
2. **Fallback**: reads `sonar-project.properties` directly and calls `fetchIssuesDirect`.

`fetchIssuesDirect` calls the SonarQube REST API (`/api/issues/search`) with Basic auth from `SONAR_TOKEN`. It returns an object with `console` (colored lines), `count`, and `buildPayload(fmt)` for file serialization.

### Report formats

`run.js` contains three file builders: `buildTextTable`, `buildMarkdown`, `buildJson`. All three accept `{ rows, meta }`. The `meta` object (from `buildMeta`) includes timestamp, project key, server URL, filter summary, and tool/runtime versions. Files written to disk are always plain text – no ANSI escape codes.

### Config loading

`loadConfig` in `run.js` merges defaults → `.aegisrc.json` → `.aegisrc.local.json` → CLI `--format` flag. The `issuesFile` key is a base name without extension; `resolveIssuesPath` appends the correct extension based on format.

### Color helpers

Each module defines its own local `c` object wrapping `kleur`. Colors are **on by default** and respect both `--no-color` CLI flag and the `NO_COLOR` / `AEGIS_COLOR` env vars. `run.js` has a module-level `useColor` that `applyColorMode(argv)` mutates; other modules compute it at import time from `process.stdout.isTTY`.

### Templates

`templates/` holds reference copies of `.aegisrc.json` and `sonar-project.properties`. The actual content written during `aegis init` is generated inline in `src/init.js` (not read from the templates directory).

## Key Conventions

- **ESM only** – all files use `import`/`export`; no `require`. Node >= 18 required.
- **No nested template literals** in console log calls.
- **Early returns** to reduce nesting; extract single-purpose helpers.
- **Conventional Commits** for all commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, etc.).
- Branches: `feat/<short-name>` or `fix/<short-name>` off `main`.
- When adding a new report format: extend `resolveIssuesPath` (the extension map) and add a builder function alongside `buildTextTable`/`buildMarkdown`/`buildJson`.
- The `prop(txt, key)` helper in `run.js` has a known recursive bug (`escapeRegExp` calls itself). Do not rely on it for keys containing regex metacharacters until fixed.
- CI tests on Node 18 and 20. Ensure changes stay compatible with both.
