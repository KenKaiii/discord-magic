import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import rawConfig from "../server.config.ts";
import { createGuildApi } from "../src/discord/guild-api.ts";
import { createRest } from "../src/discord/rest.ts";
import { loadEnv } from "../src/env.ts";
import { applyPlan } from "../src/server/apply.ts";
import { readBackup, writeBackup } from "../src/server/backup.ts";
import { renderConfigSource, snapshotToConfig } from "../src/server/export.ts";
import { formatPlan } from "../src/server/format.ts";
import { buildPlan, countOps, hasErrors } from "../src/server/plan.ts";
import { parseServerConfig } from "../src/server/schema.ts";
import { main, ROOT } from "./_shared.ts";

const USAGE = `Usage:
  npm run server:plan   [-- --update-icon] [-- --json]
  npm run server:apply  [-- --update-icon]
  Deleting (plan first, then apply with the same flags plus --confirm-delete=<count>):
    --delete-channel "<name>"  (repeatable)   --delete-role "<name>"  (repeatable)
    --prune                    deletes EVERYTHING not in server.config.ts
  npm run server:backup
  npm run server:export [-- --from backups/<file>.json] [-- --out <file>] [-- --overwrite]`;

main(async () => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      prune: { type: "boolean", default: false },
      "delete-channel": { type: "string", multiple: true },
      "delete-role": { type: "string", multiple: true },
      "confirm-delete": { type: "string" },
      "update-icon": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      from: { type: "string" },
      out: { type: "string", default: "server.config.exported.ts" },
      overwrite: { type: "boolean", default: false },
    },
  });
  const command = positionals[0];
  const backupsDir = join(ROOT, "backups");

  if (command === "export" && values.from) {
    return exportConfig(await readBackup(values.from), values.out, values.overwrite);
  }

  const env = loadEnv();
  const api = createGuildApi(createRest(env.DISCORD_TOKEN), env.DISCORD_GUILD_ID);

  if (command === "backup") {
    const path = await writeBackup(await api.fetchSnapshot(), backupsDir);
    console.log(
      `Saved server structure to ${relative(ROOT, path)} (structure only, not messages).`,
    );
    return 0;
  }
  if (command === "export")
    return exportConfig(await api.fetchSnapshot(), values.out, values.overwrite);
  if (command !== "plan" && command !== "apply") {
    console.error(USAGE);
    return 1;
  }

  const config = parseServerConfig(rawConfig);
  const snapshot = await api.fetchSnapshot();
  const opts = {
    prune: values.prune,
    deleteChannels: values["delete-channel"],
    deleteRoles: values["delete-role"],
    updateIcon: values["update-icon"],
    rootDir: ROOT,
  };
  const plan = buildPlan(config, snapshot, opts);

  if (values.json) {
    console.log(JSON.stringify({ ...plan, summary: countOps(plan) }, null, 2));
    return hasErrors(plan) ? 1 : 0;
  }
  console.log(formatPlan(plan, { prune: values.prune }));
  if (hasErrors(plan)) return 1;
  if (command === "plan") {
    if (plan.ops.length > 0) console.log("\nRun `npm run server:apply` to make these changes.");
    return 0;
  }
  if (plan.ops.length === 0) return 0;

  const deletes = countOps(plan).delete;
  if (deletes > 0 && values["confirm-delete"] !== String(deletes)) {
    console.error(
      `\nRefusing to apply: this deletes ${deletes} item(s) and cannot be undone for channels.\n` +
        `Re-run with --confirm-delete=${deletes} once the user has approved exactly this list.`,
    );
    return 1;
  }

  const backup = await writeBackup(snapshot, backupsDir);
  console.log(`\nBackup of the current structure: ${relative(ROOT, backup)}\nApplying...`);
  const { completed } = await applyPlan(plan, api, (line) => console.log(`  ${line}`));

  const after = buildPlan(config, await api.fetchSnapshot(), {
    ...opts,
    deleteChannels: [],
    deleteRoles: [],
    prune: false,
  });
  if (after.ops.length === 0)
    console.log(`\nDone: ${completed} step(s) applied. Discord now matches server.config.ts.`);
  else {
    console.log(
      `\nApplied ${completed} step(s), but ${after.ops.length} change(s) still show as pending:`,
    );
    console.log(formatPlan(after));
    return 1;
  }
  return 0;
});

async function exportConfig(
  snapshot: Awaited<ReturnType<typeof readBackup>>,
  out: string,
  overwrite: boolean,
): Promise<number> {
  const path = join(ROOT, out);
  if (existsSync(path) && !overwrite) {
    console.error(`${out} already exists. Pass --overwrite to replace it.`);
    return 1;
  }
  const { config, skipped } = snapshotToConfig(snapshot);
  await writeFile(
    path,
    renderConfigSource(config, [
      `Exported from "${snapshot.guild.name}" at ${snapshot.takenAt}.`,
      "Review it, then replace server.config.ts with it to manage this server as-is.",
    ]),
  );
  console.log(`Wrote ${out}.`);
  if (skipped.length > 0) console.log(`Skipped (not supported):\n  ${skipped.join("\n  ")}`);
  return 0;
}
