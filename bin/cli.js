#!/usr/bin/env node
import minimist from "minimist";
import { initHook } from "../src/init.js";
import { run } from "../src/run.js";
import { uninstall } from "../src/uninstall.js";
import { doctor } from "../src/doctor.js";

const [, , rawCmd, ...rest] = process.argv;

const argv = minimist(rest, {
  boolean: [
    "help",
    "h",
    "version",
    "v",
    "preview",
    "dry-run",
    "verbose",
    "print-issues",
    "color",
    "no-color",
    "scaffold",
  ],
  string: ["base", "cwd", "format", "hooksPath"],
  alias: { h: "help", v: "version" },
});

function printHelp() {
  console.log(`
Usage:
  npx aegis init [--hooksPath <dir>] [--scaffold]
  npx aegis run [--preview] [--base <branch>] [--cwd <dir>] [--dry-run] [--verbose] [--format text|md|json] [--print-issues]
  npx aegis uninstall
  npx aegis doctor

Options:
  --preview        Scan only changed files since base branch
  --base <branch>  Base branch to compare against (for --preview)
  --cwd <dir>      Run in a different working directory
  --dry-run        Fetch existing issues without running scanner
  --verbose        Show full command and debug info
  --format         Output format for issues file (text, md, json)
  --print-issues   Print issues to console in addition to saving file
  --color          Force colored output
  --no-color       Disable colored output
  -h, --help       Show this help
  -v, --version    Show package version
`);
}

const cmd = (rawCmd || "").trim();

// Global flags
if (argv.version) {
  const v = process.env.npm_package_version || "unknown";
  console.log(`aegis-sonar ${v}`);
  process.exit(0);
}

if (argv.help || !cmd) {
  printHelp();
  process.exit(0);
}

// Top-level await command dispatch
try {
  switch (cmd) {
    case "init":
      await initHook(argv);
      break;
    case "run":
      await run(argv);
      break;
    case "uninstall":
      await uninstall(argv);
      break;
    case "doctor":
      await doctor(argv);
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
