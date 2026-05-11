import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";

async function getHooksPath() {
  try {
    const { stdout } = await execa("git", ["config", "core.hooksPath"]);
    const hp = (stdout || "").trim();
    if (hp) return hp;
  } catch {}
  return ".git/hooks";
}

function removeIfManaged(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  if (!content.includes("aegis run")) return false;
  fs.unlinkSync(filePath);
  return true;
}

export async function uninstall() {
  const hooksPath = await getHooksPath();
  const posix = path.join(hooksPath, "pre-push");
  const win   = path.join(hooksPath, "pre-push.cmd");

  const removedPosix = removeIfManaged(posix);
  const removedWin   = removeIfManaged(win);

  if (removedPosix || removedWin) {
    if (removedPosix) console.log("🧹 Removed", posix);
    if (removedWin)   console.log("🧹 Removed", win);
  } else {
    console.log("ℹ No managed Aegis pre-push hook found in", hooksPath);
  }
}
