# Contributing to Aegis 🛡️

Thanks for your interest in improving **Aegis**! This document explains how to get set up, make changes, and submit a pull request.

---

## 📋 Ground Rules

- Be respectful and constructive. Assume positive intent.
- Prefer small, focused PRs over big, mixed ones.
- Write clear commit messages (see **Conventional Commits** below).
- Add/adjust tests when changing behavior.
- Keep console output readable; avoid nested template literals.
- Maintain Node.js >= 18 compatibility.

---

## 🧰 Getting Started

### Prerequisites

- **Node.js >= 18**
- **npm >= 9**
- A local **SonarQube** instance (or a reachable server)
- `sonar-scanner` installed and available on `PATH`
- `SONAR_TOKEN` exported

### Clone & Install

```bash
git clone https://github.com/aayushkedawat/aegis-sonar.git
cd aegis-sonar
npm ci
```

### Quick Project Tour

```
bin/cli.js         # CLI entry
src/run.js         # main runner
src/doctor.js      # environment checks
templates/         # scaffold templates (.aegisrc.json, hooks)
README.md          # user docs
```

---

## 🧪 Local Development

### Build (None)

This is a pure Node.js package—no compile step required.

### Lint & Test

```bash
npm run lint
npm test
```

> If you add a linter later, wire it to `npm run lint`.

### Try it Locally

From the repo root:

```bash
node -e 'import("./src/run.js").then(m=>m.run({ "dry-run": true, format: "md", verbose: true }))'
```

Or link and run:

```bash
npm link
aegis doctor
aegis run --dry-run --format json
aegis run --preview --verbose
```

---

## 🧾 Conventional Commits

Follow the **Conventional Commits** format:

```
<type>(optional scope): <description>

[optional body]

[optional footer(s)]
```

Common types:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` code change that neither fixes a bug nor adds a feature
- `perf:` performance improvement
- `test:` test-only changes
- `chore:` tooling / CI / meta
- `build:` build system or external dependencies
- `ci:` CI-related changes

Examples:

```
feat(run): add --format json with metadata
fix(doctor): handle 403 for components API
docs(readme): add badges and limitations
```

---

## 🌿 Branching Model

- Base branch: `main`
- Feature branches: `feat/<short-name>` or `fix/<short-name>`
- Keep branches up to date with `main` (rebase preferred).

---

## ✅ Pull Request Checklist

- [ ] Title follows **Conventional Commits**
- [ ] PR description explains _what_ and _why_
- [ ] Behavior change covered by tests (if applicable)
- [ ] README/Docs updated (if user-facing)
- [ ] `npm test` passed on Node 18 and 20 locally
- [ ] No nested template literals in console logs
- [ ] Colors respect `--no-color` and `NO_COLOR`

---

## 🐛 Filing Issues

Please include:

- A brief description and expected vs actual behavior
- Reproduction steps and environment (Node version, OS)
- Logs/output if relevant
- SonarQube version and whether it’s SonarQube or SonarCloud

For security-sensitive reports, **do not** open a public issue—email the maintainer instead.

---

## 🔐 Security Policy (Short)

- Report vulnerabilities privately to the maintainer.
- Avoid committing credentials or tokens.
- Do not include server URLs or tokens in example logs.

---

## 🚢 Releases (Maintainers)

This repo uses **tag-based releases** via GitHub Actions.

1. Bump version & push tag:

```bash
npm run release:patch   # or :minor / :major
```

2. The `publish` workflow:
   - runs tests
   - publishes to npm with provenance
   - (optional) creates GitHub Release notes

> Ensure `NPM_TOKEN` (automation token) is set in repo secrets.

---

## 🧭 Coding Style Notes

- Prefer **early returns** to reduce nesting.
- Extract helpers for single-purpose logic.
- Use **optional chaining** and **nullish coalescing** where helpful.
- Keep console colors **on by default**, but respect `--no-color` / `NO_COLOR`.
- All files written to disk should be **plain text** (no ANSI colors).
- When adding formats, extend `resolveIssuesPath` and report builders.

---

## 🙌 Thanks

Your contributions help keep code quality shields up for everyone.  
Built with ☕ and ❤️ by **Aayush Kedawat**.
