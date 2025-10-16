// src/verify-hooks.js
import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import kleur from "kleur";

const useColor = !!process.stdout?.isTTY && !process.env.NO_COLOR;
const c = {
  ok: (s) => (useColor ? kleur.green().bold(s) : s),
  err: (s) => (useColor ? kleur.red().bold(s) : s),
  warn: (s) => (useColor ? kleur.yellow().bold(s) : s),
  info: (s) => (useColor ? kleur.cyan(s) : s),
  dim: (s) => (useColor ? kleur.dim(s) : s),
  head: (s) => (useColor ? kleur.bold().underline(s) : s),
};

async function getHooksPath() {
  try {
    const { stdout } = await execa("git", ["config", "core.hooksPath"]);
    const hp = (stdout || "").trim();
    return hp || ".git/hooks";
  } catch {
    return ".git/hooks";
  }
}
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function writePosixHook(file, body) {
  fs.writeFileSync(file, body.replaceAll("\r\n", "\n"), {
    encoding: "utf-8",
    mode: 0o755,
  });
  try {
    fs.chmodSync(file, 0o755);
  } catch {}
}
function writeWinHook(file, body) {
  fs.writeFileSync(file, body, "utf-8");
}
function appendLog(hooksPath, line) {
  const logPath = path.join(hooksPath, "_hook-fired.log");
  fs.appendFileSync(logPath, line + "\n", "utf-8");
  return logPath;
}

const POSIX_TEST_HOOK = `#!/bin/sh
# Aegis verify-hooks (temp test hook - POSIX)
npx --no-install aegis verify-hooks --from-hook "$@"
`;
const WIN_TEST_HOOK = `@echo off
REM Aegis verify-hooks (temp test hook - Windows)
npx --no-install aegis verify-hooks --from-hook %*
`;

/* ---------------- Helpers to lower complexity ---------------- */

function logHeader(hooksPath) {
  console.log(c.head("🔍 Aegis verify-hooks"));
  console.log(c.info("• hooksPath:"), c.dim(hooksPath));
}

function pathsFor(hooksPath) {
  const posixHook = path.join(hooksPath, "pre-push");
  const winHook = path.join(hooksPath, "pre-push.cmd");
  return {
    posixHook,
    winHook,
    backupPosix: posixHook + ".aegis.bak",
    backupWin: winHook + ".aegis.bak",
  };
}

function backupIfPresent(src, bak, label) {
  if (!fs.existsSync(src) || fs.existsSync(bak)) return;
  fs.copyFileSync(src, bak);
  console.log(
    c.info("•"),
    "Backed up",
    c.dim(label),
    "→",
    c.dim(path.basename(bak))
  );
}

function installTempHooks(posixHook, winHook) {
  writePosixHook(posixHook, POSIX_TEST_HOOK);
  writeWinHook(winHook, WIN_TEST_HOOK);
  console.log(c.ok("✔"), "Installed temporary test hooks:");
  console.log(c.info("•"), c.dim(posixHook));
  console.log(c.info("•"), c.dim(winHook));
  console.log("");
  console.log(c.info("Next:"));
  console.log(
    " - Try pushing from your GUI (e.g., GitHub Desktop) or terminal."
  );
  console.log(
    " - You should see the push blocked and a log entry appended to",
    c.dim(path.join(path.dirname(posixHook), "_hook-fired.log"))
  );
  console.log(
    " - When done, run",
    c.dim("npx aegis verify-hooks --uninstall"),
    "to restore."
  );
}

function restoreBackups(backupPosix, posixHook, backupWin, winHook) {
  let changed = false;
  if (fs.existsSync(backupPosix)) {
    fs.copyFileSync(backupPosix, posixHook);
    fs.unlinkSync(backupPosix);
    console.log(c.ok("✔"), "Restored", c.dim("pre-push"), "from backup");
    changed = true;
  }
  if (fs.existsSync(backupWin)) {
    fs.copyFileSync(backupWin, winHook);
    fs.unlinkSync(backupWin);
    console.log(c.ok("✔"), "Restored", c.dim("pre-push.cmd"), "from backup");
    changed = true;
  }
  if (changed) {
    console.log(c.ok("✔"), "Test hooks removed. Original hooks back in place.");
  } else {
    console.log(c.info("ℹ"), "No backups found. Nothing to restore.");
  }
}

function showPassiveStatus(hooksPath, posixHook, winHook) {
  const hasPosix = fs.existsSync(posixHook);
  const hasWin = fs.existsSync(winHook);
  console.log(c.info("• pre-push:"), hasPosix ? c.ok("yes") : c.warn("no"));
  console.log(c.info("• pre-push.cmd:"), hasWin ? c.ok("yes") : c.warn("no"));
  console.log("");
  console.log(c.info("To actively test hook firing:"));
  console.log(
    " - Run",
    c.dim("npx aegis verify-hooks --install"),
    "then perform a push."
  );
  console.log(
    " - Check",
    c.dim(path.join(hooksPath, "_hook-fired.log")),
    "for a new timestamp."
  );
  console.log(
    " - Finally, run",
    c.dim("npx aegis verify-hooks --uninstall"),
    "to restore."
  );
}

/* --------------- Main (reduced complexity via early returns) --------------- */

export async function verifyHooks(argv = {}) {
  const hooksPath = await getHooksPath();
  const { posixHook, winHook, backupPosix, backupWin } = pathsFor(hooksPath);

  logHeader(hooksPath);

  if (argv["from-hook"]) {
    const ts = new Date().toISOString();
    const logPath = appendLog(hooksPath, `${ts} pre-push fired`);
    console.log(c.ok("✔"), "pre-push fired — logged to", c.dim(logPath));

    if (argv["no-block"]) {
      console.log(c.info("ℹ"), "Exiting 0 (--no-block). Push will continue.");
      process.exit(0);
    }
    console.log(
      c.warn("⚠"),
      "Exiting 1 (default). Push will be blocked to prove enforcement."
    );
    process.exit(1);
  }

  if (argv.install) {
    ensureDir(hooksPath);
    backupIfPresent(posixHook, backupPosix, "pre-push");
    backupIfPresent(winHook, backupWin, "pre-push.cmd");
    installTempHooks(posixHook, winHook);
    process.exit(0);
  }

  if (argv.uninstall) {
    restoreBackups(backupPosix, posixHook, backupWin, winHook);
    process.exit(0);
  }

  // default: passive report
  showPassiveStatus(hooksPath, posixHook, winHook);
  process.exit(0);
}
