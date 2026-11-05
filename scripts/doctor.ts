import { spawnSync } from "node:child_process";
import { type APIUser, DiscordAPIError, Routes } from "discord.js";
import rawConfig from "../server.config.ts";
import { privilegedIntentsNeeded } from "../src/bot/features/index.ts";
import { createGuildApi } from "../src/discord/guild-api.ts";
import { createRest } from "../src/discord/rest.ts";
import { loadEnv } from "../src/env.ts";
import { isAtOrAboveBot } from "../src/server/order.ts";
import { hasBits, missingPermissions, toBits } from "../src/server/permissions.ts";
import { buildPlan, countOps } from "../src/server/plan.ts";
import { parseServerConfig, type ServerConfig } from "../src/server/schema.ts";
import { fetchApplication, inviteUrl, main, ROOT } from "./_shared.ts";
import {
  isSupportedCliVersion,
  MIN_RAILWAY_CLI,
  readLinks,
  serviceName,
} from "./railway-deploy.ts";
import { missingVariables, readVariables } from "./variables.ts";

let failures = 0;
const ok = (msg: string) => console.log(`  ok   ${msg}`);
const warn = (msg: string) => console.log(`  warn ${msg}`);
const fail = (msg: string, fix: string) => {
  failures++;
  console.log(`  FAIL ${msg}\n       -> ${fix}`);
};

main(async () => {
  console.log("Checking your setup...\n");

  let config: ServerConfig;
  try {
    config = parseServerConfig(rawConfig);
    ok(`server.config.ts is valid ("${config.name}")`);
  } catch (err) {
    fail("server.config.ts is invalid", err instanceof Error ? err.message : String(err));
    return 1;
  }

  const variables = readVariables();
  const missing = missingVariables(variables);
  for (const v of missing) fail(`${v.key} is empty in .env`, v.help || "see .env.example");
  if (missing.length > 0) return 1;

  let env: ReturnType<typeof loadEnv>;
  try {
    env = loadEnv();
    ok(`.env has every variable the bot needs (${variables.map((v) => v.key).join(", ")})`);
  } catch (err) {
    fail("Environment", err instanceof Error ? err.message : String(err));
    return 1;
  }

  const rest = createRest(env.DISCORD_TOKEN);
  let me: APIUser;
  try {
    me = (await rest.get(Routes.user())) as APIUser;
    ok(`Token works (bot: ${me.username})`);
  } catch {
    fail(
      "Discord rejected DISCORD_TOKEN",
      "Developer Portal -> your app -> Bot -> Reset Token, then update .env",
    );
    return 1;
  }

  const app = await fetchApplication(rest);
  const flags = app.flags ?? 0;
  for (const need of privilegedIntentsNeeded(config)) {
    if ((flags & need.flags) !== 0) ok(`${need.toggle} is on`);
    else
      fail(
        `${need.toggle} is off, but an enabled feature needs it`,
        `https://discord.com/developers/applications/${app.id}/bot -> Privileged Gateway Intents -> ${need.toggle} -> Save Changes`,
      );
  }

  const api = createGuildApi(rest, env.DISCORD_GUILD_ID);
  let snapshot: Awaited<ReturnType<typeof api.fetchSnapshot>>;
  try {
    snapshot = await api.fetchSnapshot();
    ok(`Bot is in "${snapshot.guild.name}"`);
  } catch (err) {
    if (err instanceof DiscordAPIError && [403, 404].includes(Number(err.status)))
      fail(
        "The bot can't see DISCORD_GUILD_ID",
        `Check the ID, then invite the bot: ${inviteUrl(app.id, env.DISCORD_GUILD_ID)}`,
      );
    else throw err;
    return 1;
  }

  const perms = snapshot.roles
    .filter((r) => r.id === snapshot.guild.id || snapshot.bot.roleIds.includes(r.id))
    .reduce((acc, r) => acc | BigInt(r.permissions), 0n);
  if (hasBits(perms, toBits(["Administrator"]))) ok("Bot has Administrator");
  else {
    const missing = missingPermissions(
      perms,
      toBits(["ManageGuild", "ManageRoles", "ManageChannels"]),
    );
    if (missing.length > 0)
      fail(
        `Bot is missing ${missing.join(", ")}`,
        `Re-invite it: ${inviteUrl(app.id, env.DISCORD_GUILD_ID)}`,
      );
    else warn("Bot isn't Administrator: it can only grant permissions it has itself");
  }

  const configRoles = new Set(config.roles.map((r) => r.name));
  const above = snapshot.roles.filter(
    (r) =>
      configRoles.has(r.name) &&
      !snapshot.bot.roleIds.includes(r.id) &&
      isAtOrAboveBot(snapshot.roles, snapshot.bot.roleIds, snapshot.guild.id, r.id),
  );
  if (above.length > 0)
    fail(
      `Roles above the bot's role: ${above.map((r) => r.name).join(", ")}`,
      "Discord -> Server Settings -> Roles -> drag the bot's role to the very top",
    );
  else ok("Bot's role is above every role in server.config.ts");

  const plan = buildPlan(config, snapshot, { rootDir: ROOT });
  for (const issue of plan.issues.filter((i) => i.level === "error"))
    fail("server:plan", issue.message);
  const n = countOps(plan);
  if (plan.ops.length === 0) ok("Discord matches server.config.ts");
  else
    warn(
      `server.config.ts has ${n.create + n.update + n.reorder} pending change(s): run \`npm run server:plan\``,
    );

  const run = (args: string[]) => spawnSync("railway", args, { encoding: "utf8" });
  const version = run(["--version"]);
  if (version.error)
    warn("Railway CLI not installed (needed to go online): `npm i -g @railway/cli`");
  else if (!isSupportedCliVersion(version.stdout))
    warn(`Railway CLI is too old (need ${MIN_RAILWAY_CLI}+): run \`railway upgrade --yes\``);
  else if (run(["whoami"]).status !== 0)
    warn("Railway CLI is installed but not logged in: run `railway login`");
  else {
    ok("Railway CLI is installed and logged in");
    const status = run(["status", "--json"]);
    const projectId =
      status.status === 0 ? (JSON.parse(status.stdout || "{}") as { id?: string }).id : undefined;
    const link = projectId ? readLinks()[projectId] : undefined;
    if (!projectId) warn("No Railway project linked yet: `npm run deploy` creates one");
    else {
      // Only the names are used; values stay in memory and are never printed.
      const listed = run(["variable", "list", "--service", serviceName(), "--json"]);
      if (listed.status === 0) {
        const onRailway = new Set(Object.keys(JSON.parse(listed.stdout || "{}") as object));
        const absent = variables.filter((v) => !onRailway.has(v.key)).map((v) => v.key);
        if (absent.length > 0)
          warn(`Railway is missing ${absent.join(", ")}: \`npm run deploy\` copies them from .env`);
        else ok("Railway has every variable from .env.example");
      }
      if (link) ok(`Railway auto-deploys from GitHub ${link.repo} (${link.branch})`);
      else warn("Railway deploys by upload; `npm run deploy -- --github` turns on auto-deploys");
    }
  }

  console.log(failures === 0 ? "\nAll good." : `\n${failures} problem(s) to fix.`);
  return failures === 0 ? 0 : 1;
});
