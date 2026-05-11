# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**aegis-sonar** is a zero-build Node.js CLI tool (published to npm as `aegis-sonar`) that enforces SonarQube Quality Gates locally before code is pushed. It installs as a Git `pre-push` hook and blocks pushes when the Quality Gate fails. It also supports dry-run mode, preview mode (scan only changed files), and report exports.

## Commands

```bash
npm ci                   # install dependencies
npm run lint             # lint (placeholder – wire up a real linter here when adding one)
npm test                 # run test suite (node:test, no extra deps)
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
| `src/status.js` | `aegis status` | Compact severity summary — fetches issues without scanning, exits 0 |
| `src/watch.js` | `aegis watch` | Runs `status` on startup then re-runs on file changes (debounced 2s) |
| `src/init.js` | `aegis init` | Interactive setup wizard (TTY) or non-interactive scaffolding; always updates `.gitignore` |
| `src/doctor.js` | `aegis doctor` | Checks scanner on PATH, `SONAR_TOKEN`, server reachability, token validity, project access, hook presence |
| `src/uninstall.js` | `aegis uninstall` | Removes the managed pre-push hook |
| `src/verify-hooks.js` | `aegis verify-hooks` | Installs/uninstalls a temporary test hook to verify GUI clients fire hooks |
| `src/ci.js` | (library) | GitHub Actions PR comment integration — called automatically when `GITHUB_ACTIONS=true` |
| `src/colors.js` | (library) | Shared `c` color helper and `applyColorMode`; imported by all command modules |

### Console output format

`fetchIssuesDirect` returns issues grouped by file for readable terminal output. Each file is a header line followed by indented `:line  SEVERITY  TYPE  message  url` rows. File paths are printed as `filename:line` so terminals and IDEs render them as clickable links. The return value includes `bySeverity` (map of severity → count) and `total` (server total) in addition to `count` (page size) and `buildPayload(fmt)`.

### Issue fetch flow in `run.js`

On Quality Gate failure, `run.js` attempts two strategies to collect issues:

1. **Task-based** (`listIssuesFromTask`): reads `.scannerwork/report-task.txt` (written by the scanner) to get `serverUrl` and `projectKey`, then calls `fetchIssuesDirect`.
2. **Fallback**: reads `sonar-project.properties` directly and calls `fetchIssuesDirect`.

`fetchIssuesDirect` calls the SonarQube REST API (`/api/issues/search`) with Basic auth from `SONAR_TOKEN`. It returns an object with `console` (colored lines), `count`, and `buildPayload(fmt)` for file serialization.

### Report formats

`run.js` contains three file builders: `buildTextTable`, `buildMarkdown`, `buildJson`. All three accept `{ rows, meta }`. The `meta` object (from `buildMeta`) includes timestamp, project key, server URL, filter summary, and tool/runtime versions. Files written to disk are always plain text – no ANSI escape codes.

### SonarCloud vs SonarQube

`isSonarCloud(serverUrl)` (in `run.js`) detects SonarCloud by checking whether the host URL contains `sonarcloud.io`. When detected, `sonar.organization` is required in `sonar-project.properties` and is passed as `-Dsonar.organization=` to the scanner and as the `organization` param to `/api/issues/search`. `doctor.js` also validates the organization field for SonarCloud setups.

### GitHub Actions CI integration

`src/ci.js` exports `postCiComment` which is called automatically after every scan when `GITHUB_ACTIONS=true`. It reads `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, and `GITHUB_EVENT_PATH` to find the PR number and upsert a comment (updates an existing Aegis comment if present, otherwise creates one). It is a no-op when any of these env vars is missing, so it never breaks local or non-PR runs.

### Config loading

`loadConfig` in `run.js` merges defaults → `.aegisrc.json` → `.aegisrc.local.json` → CLI `--format` flag. The `issuesFile` key is a base name without extension; `resolveIssuesPath` appends the correct extension based on format. The `previewExtensions` key (default `null`) controls which file extensions are passed to `sonar.inclusions` in `--preview` mode; `null` means all changed files are included.

### Color helpers

All color logic lives in `src/colors.js`, which exports a shared `c` object and `applyColorMode(argv)`. Colors are **on by default** and respect `--no-color`, `NO_COLOR`, and `AEGIS_COLOR` env vars. `applyColorMode` is called once at the start of `run()` to apply CLI flags; other commands import `c` directly without calling it.

### Templates

`templates/` holds reference copies of `.aegisrc.json` and `sonar-project.properties`. The actual content written during `aegis init` is generated inline in `src/init.js` (not read from the templates directory).

## Key Conventions

- **ESM only** – all files use `import`/`export`; no `require`. Node >= 18 required.
- **No nested template literals** in console log calls.
- **Early returns** to reduce nesting; extract single-purpose helpers.
- **Conventional Commits** for all commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, etc.).
- Branches: `feat/<short-name>` or `fix/<short-name>` off `main`.
- When adding a new report format: extend `resolveIssuesPath` (the extension map) and add a builder function alongside `buildTextTable`/`buildMarkdown`/`buildJson`.
- Tests live in `test/` and use Node's built-in `node:test` runner — no extra test dependencies. Add new test files as `test/*.test.js`. Pure functions that are testable should be exported from the bottom of their module under a comment `// Exported for testing`.
- CI tests on Node 18 and 20. Ensure changes stay compatible with both.
