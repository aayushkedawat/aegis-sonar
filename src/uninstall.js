import fs from "fs";
import path from "path";
import { execa } from "execa";

export async function uninstall() {
  const { stdout: root } = await execa("git", ["rev-parse", "--show-toplevel"]);
  const hook = path.join(root, ".git", "hooks", "pre-push");
  if (fs.existsSync(hook)) {
    const content = fs.readFileSync(hook, "utf-8");
    if (content.includes("Aegis (aegis-sonar)")) {
      fs.unlinkSync(hook);
      console.log("🧹 Removed pre-push hook");
      return;
    }
  }
  console.log("ℹ No managed pre-push hook found");
}
