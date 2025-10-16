// src/init.js
import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import kleur from "kleur";

const useColor = !process.env.NO_COLOR;
const c = {
  ok: (s) => (useColor ? kleur.green().bold(s) : s),
  err: (s) => (useColor ? kleur.red().bold(s) : s),
  info: (s) => (useColor ? kleur.cyan(s) : s),
  dim: (s) => (useColor ? kleur.dim(s) : s),
  head: (s) => (useColor ? kleur.bold().underline(s) : s),
  warn: (s) => (useColor ? kleur.yellow().bold(s) : s),
};

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function gitDir() {
  const { stdout } = await execa("git", ["rev-parse", "--git-dir"]);
  return stdout.trim();
}

async function setHooksPath(hooksPath) {
  await execa("git", ["config", "core.hooksPath", hooksPath]);
}

function writeFileIfNeeded(filePath, content, { force = false, mode } = {}) {
  if (fs.existsSync(filePath) && !force) return "skipped";
  fs.writeFileSync(filePath, content, { encoding: "utf-8", mode });
  return fs.existsSync(filePath) ? "written" : "error";
}

function isWindows() {
  return process.platform === "win32";
}

const POSIX_HOOK = `#!/bin/sh
# Aegis pre-push (POSIX)
# Quiet by default; add --print-issues locally if you want console output
npx --no-install aegis run "$@"
status=$?
if [ $status -ne 0 ]; then
  echo "Aegis blocked push (Quality Gate failed). See saved issues file."
fi
exit $status
`;

const WIN_HOOK = `@echo off
REM Aegis pre-push (Windows)
npx --no-install aegis run %*
set EXITCODE=%ERRORLEVEL%
if NOT %EXITCODE%==0 (
  echo Aegis blocked push (Quality Gate failed). See saved issues file.
  exit /b %EXITCODE%
)
exit /b 0
`;

export async function initHook(argv = {}) {
  const force = Boolean(argv.force);
  let hooksPath = String(argv.hooksPath || ".githooks");

  try {
    console.log(c.head("🔧 Aegis hook setup"));
    // 1) Verify git repo
    const repoGitDir = await gitDir().catch(() => null);
    if (!repoGitDir) {
      console.error(c.err("✖"), "Not a Git repository (run inside a repo).");
      process.exit(1);
    }

    // 2) Resolve hooks path (relative to repo root)
    // If user gave a relative path, keep it as relative in git config
    // but ensure the directory exists on disk.
    ensureDir(hooksPath);
    await setHooksPath(hooksPath);
    console.log(
      c.ok("✔"),
      "Set",
      c.dim("core.hooksPath"),
      "to",
      c.dim(hooksPath)
    );

    // 3) Write both pre-push files
    const posixPath = path.join(hooksPath, "pre-push");
    const winPath = path.join(hooksPath, "pre-push.cmd");

    const posixRes = writeFileIfNeeded(posixPath, POSIX_HOOK, {
      force,
      mode: 0o755,
    });
    if (posixRes === "written") {
      // Ensure LF endings for POSIX hook
      try {
        const lf = fs.readFileSync(posixPath, "utf-8").replaceAll("\r\n", "\n");
        fs.writeFileSync(posixPath, lf, "utf-8");
      } catch {}
      // Ensure executable on POSIX
      try {
        if (!isWindows()) fs.chmodSync(posixPath, 0o755);
      } catch {}
    }

    const winRes = writeFileIfNeeded(winPath, WIN_HOOK, { force });

    const statusText = (s) => {
      if (s === "written") return c.ok("created");
      if (s === "skipped") return c.dim("exists (skipped)");
      return c.err("error");
    };

    console.log(
      c.info("• POSIX hook:"),
      c.dim(posixPath),
      "-",
      statusText(posixRes)
    );
    console.log(
      c.info("• Windows hook:"),
      c.dim(winPath),
      "-",
      statusText(winRes)
    );

    // 4) Small self-check hint
    console.log(
      c.info("ℹ"),
      "Hooks are repository-local. Committers using GitHub Desktop should now have the pre-push enforced."
    );
    console.log(
      c.info("ℹ"),
      "If the hook does not fire in your GUI, verify",
      c.dim("git config core.hooksPath"),
      "and that filenames are exactly",
      c.dim("pre-push"),
      "and",
      c.dim("pre-push.cmd") + "."
    );

    console.log(
      "\n",
      c.ok("✔"),
      "Aegis pre-push hook setup complete.",
      c.dim("(use --force to overwrite existing hooks)")
    );
  } catch (e) {
    console.error(c.err("✖"), "Hook setup failed:", c.dim(e?.message || e));
    process.exit(1);
  }
}
