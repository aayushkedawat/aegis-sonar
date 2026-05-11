import kleur from "kleur";

let enabled = computeEnabled();

function computeEnabled() {
  if (process.env.NO_COLOR) return false;
  if (process.env.AEGIS_COLOR === "0") return false;
  if (process.env.AEGIS_COLOR === "1") return true;
  return true;
}

export function applyColorMode(argv = {}) {
  if ("no-color" in argv) enabled = false;
  if ("color" in argv) enabled = true;
}

export const c = {
  ok:   (s) => (enabled ? kleur.green().bold(s) : s),
  err:  (s) => (enabled ? kleur.red().bold(s) : s),
  warn: (s) => (enabled ? kleur.yellow().bold(s) : s),
  info: (s) => (enabled ? kleur.cyan(s) : s),
  dim:  (s) => (enabled ? kleur.dim(s) : s),
  head: (s) => (enabled ? kleur.bold().underline(s) : s),
  link: (s) => (enabled ? kleur.underline().blue(s) : s),
  sev: (sev, s) => {
    if (!enabled) return s;
    if (sev === "BLOCKER") return kleur.bgRed().white().bold(" " + s + " ");
    if (sev === "CRITICAL") return kleur.red().bold(s);
    if (sev === "MAJOR") return kleur.yellow(s);
    if (sev === "MINOR") return kleur.magenta(s);
    return kleur.white(s);
  },
};
