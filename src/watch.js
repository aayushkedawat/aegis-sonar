// src/watch.js
import fs from "node:fs";
import path from "node:path";
import { c, applyColorMode } from "./colors.js";
import { status } from "./status.js";

const IGNORED = new Set([".git", "node_modules", ".scannerwork", ".next", "dist", "build"]);

function shouldIgnore(filename) {
  if (!filename) return true;
  const parts = filename.split(path.sep);
  if (parts.some((p) => IGNORED.has(p))) return true;
  // Ignore aegis output files
  if (/^sonar-(issues|report)/.test(path.basename(filename))) return true;
  return false;
}

function clearLine() {
  if (process.stdout.isTTY) process.stdout.write("\r\x1b[K");
}

export async function watch(argv = {}) {
  applyColorMode(argv);
  if (argv?.cwd) process.chdir(argv.cwd);

  console.log(c.head("👁  Aegis watch") + "  " + c.dim("Ctrl+C to stop"));
  console.log("");

  // Run initial status check
  await status(argv).catch(() => {});

  let debounceTimer = null;
  let running = false;

  async function runStatus() {
    if (running) return;
    running = true;
    console.log(c.dim("\n── file changed · re-checking ──\n"));
    try {
      await status(argv);
    } catch {}
    running = false;
  }

  function scheduleRun() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runStatus, 2000);
  }

  // Try fs.watch with recursive option (Node 20+ on Linux, all platforms on 19.1+)
  let watcher = null;
  try {
    watcher = fs.watch(".", { recursive: true }, (_eventType, filename) => {
      if (shouldIgnore(filename)) return;
      clearLine();
      process.stdout.write(c.dim("changed: " + filename));
      scheduleRun();
    });
  } catch {
    // Recursive watch not supported (older Node on Linux) — fall back to polling
    console.log(c.dim("(recursive file watch unavailable — polling every 30s)"));
    setInterval(scheduleRun, 30_000);
  }

  // Keep process alive; clean up on exit
  process.stdin.resume();
  process.on("SIGINT", () => {
    clearLine();
    console.log(c.dim("Aegis watch stopped."));
    watcher?.close();
    process.exit(0);
  });
}
