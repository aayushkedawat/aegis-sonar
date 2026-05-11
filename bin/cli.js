#!/usr/bin/env node
import minimist from "minimist";
import { initHook } from "../src/init.js";
import { run } from "../src/run.js";
import { status } from "../src/status.js";
import { watch } from "../src/watch.js";
import { uninstall } from "../src/uninstall.js";
import { doctor } from "../src/doctor.js";
import { verifyHooks } from "../src/verify-hooks.js";

const [, , rawCmd, ...rest] = process.argv;

const argv = minimist(rest, {
  boolean: [
    "help", "h", "version", "v",
    "preview", "dry-run", "verbose",
    "print-issues", "color", "no-color",
    "scaffold", "force", "install", "uninstall", "no-block",
    "from-hook",
  ],
  string: ["base", "cwd", "format", "hooksPath"],
  alias: { h: "help", v: "version" },
});

function printHelp() {
  console.log(`
Usage:
  npx aegis init                                         Interactive setup wizard
  npx aegis init [--hooksPath <dir>] [--scaffold]        Non-interactive (CI/scripts)
  npx aegis run [--preview] [--base <branch>] [--cwd <dir>] [--dry-run] [--verbose] [--format text|md|json] [--print-issues]
  npx aegis status [--format text|md|json]               Compact issue summary (no scan)
  npx aegis watch                                        Live status on file changes
  npx aegis doctor
  npx aegis uninstall
  npx aegis verify-hooks [--install] [--uninstall] [--no-block]

Options:
  --preview        Scan only changed files since base branch
  --base <branch>  Base branch to compare against (for --preview)
  --cwd <dir>      Run in a different working directory
  --dry-run        Fetch existing issues without running scanner
  --verbose        Show full command and debug info
  --format         Output format: text | md | json
  --print-issues   Also print issues to console (in addition to file)
  --color          Force colored output
  --no-color       Disable colored output
  -h, --help       Show this help
  -v, --version    Show package version
`);
}

const cmd = (rawCmd || "").trim();

if (argv.version) {
  const v = process.env.npm_package_version || "unknown";
  console.log(`aegis-sonar ${v}`);
  process.exit(0);
}

if (argv.help || !cmd) {
  printHelp();
  process.exit(0);
}

try {
  switch (cmd) {
    case "init":
      await initHook(argv);
      break;
    case "run":
      await run(argv);
      break;
    case "status":
      await status(argv);
      break;
    case "watch":
      await watch(argv);
      break;
    case "uninstall":
      await uninstall(argv);
      break;
    case "doctor":
      await doctor(argv);
      break;
    case "verify-hooks":
      await verifyHooks(argv);
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exit(1);
  }
} catch (e) {
  console.error("❌", e?.message || e);
  process.exit(1);
}
