import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Snapshot } from "./types.ts";

/** Saves the server's structure (not messages) so it can be re-created with `server:export --from`. */
export async function writeBackup(snapshot: Snapshot, dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  const stamp = snapshot.takenAt.replace(/[:.]/g, "-");
  const path = join(dir, `${snapshot.guild.id}-${stamp}.json`);
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });
  return path;
}

export async function readBackup(path: string): Promise<Snapshot> {
  const data = JSON.parse(await readFile(path, "utf8")) as Partial<Snapshot>;
  if (!data.guild?.id || !Array.isArray(data.roles) || !Array.isArray(data.channels))
    throw new Error(`${path} is not a server backup`);
  return data as Snapshot;
}
