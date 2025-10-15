#!/usr/bin/env node
import minimist from "minimist";
import { initHook } from "../src/init.js";
import { run } from "../src/run.js";
import { uninstall } from "../src/uninstall.js";
import { doctor } from "../src/doctor.js";

const [, , cmd, ...rest] = process.argv;
const argv = minimist(rest);

async function main() {
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
      console.log(`
Usage:
  npx aegis init [--hooksPath <dir>] [--scaffold]
  npx aegis run [--preview] [--base <branch>] [--cwd <dir>] [--dry-run] [--verbose] [--format text|md|json]
  npx aegis uninstall
  npx aegis doctor
`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌", e?.message || e);
  process.exit(1);
});
