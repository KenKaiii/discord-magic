import { cpSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Skills are written once in .agents/skills and copied for tools that look elsewhere. */
export const SOURCE = ".agents/skills";
export const MIRRORS = [".claude/skills", ".gg/skills"];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const skill of readdirSync(join(ROOT, SOURCE))) {
    for (const mirror of MIRRORS) {
      const target = join(ROOT, mirror, skill);
      rmSync(target, { recursive: true, force: true });
      cpSync(join(ROOT, SOURCE, skill), target, { recursive: true });
    }
    console.log(`Synced ${skill} -> ${MIRRORS.join(", ")}`);
  }
}
