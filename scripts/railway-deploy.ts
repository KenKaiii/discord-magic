import { type SpawnSyncOptionsWithStringEncoding, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../src/env.ts";
import { main, ROOT } from "./_shared.ts";

const SECRETS = ["DISCORD_TOKEN", "DISCORD_GUILD_ID"] as const;

// The railway/iac SDK version-checks the CLI via `$_ --version`; under npm `$_` is node.
export function railwayEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, _: "railway" };
}

function railway(args: string[], options: Partial<SpawnSyncOptionsWithStringEncoding> = {}) {
  return spawnSync("railway", args, { cwd: ROOT, env: railwayEnv(), ...options, encoding: "utf8" });
}

function step(title: string) {
  console.log(`\n==> ${title}`);
}

function serviceName(): string {
  const source = readFileSync(join(ROOT, ".railway", "railway.ts"), "utf8");
  const match = source.match(/service\(\s*"([^"]+)"/);
  if (!match?.[1]) throw new Error('Couldn\'t find service("...") in .railway/railway.ts');
  return match[1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(deploy);

async function deploy(): Promise<number> {
  step("Checking Railway CLI");
  const version = railway(["--version"]);
  if (version.error) {
    console.error(
      "Railway CLI not found. Install it: `brew install railway` or `npm i -g @railway/cli`.",
    );
    return 1;
  }
  if (railway(["whoami"]).status !== 0) {
    console.error(
      "Not logged in to Railway. Run `railway login` (opens a browser), then try again.",
    );
    return 1;
  }
  console.log(version.stdout.trim());

  const env = loadEnv();
  const service = serviceName();

  step("Railway project");
  if (railway(["status", "--json"]).status !== 0) {
    const name = process.env.RAILWAY_PROJECT_NAME ?? "discord-magic";
    console.log(`No project linked to this folder; creating "${name}".`);
    const args = ["init", "--name", name];
    if (process.env.RAILWAY_WORKSPACE) args.push("--workspace", process.env.RAILWAY_WORKSPACE);
    if (railway(args, { stdio: "inherit" }).status !== 0) return 1;
  } else console.log("Using the linked project.");

  step(`Service "${service}"`);
  const list = railway(["service", "list", "--json"]);
  const services = list.status === 0 ? (JSON.parse(list.stdout || "[]") as { name: string }[]) : [];
  if (!services.some((s) => s.name === service)) {
    if (railway(["add", "--service", service], { stdio: "inherit" }).status !== 0) return 1;
  } else console.log("Already exists.");

  step("Secrets (from your local .env, never printed)");
  for (const key of SECRETS) {
    const result = railway(
      ["variable", "set", key, "--stdin", "--service", service, "--skip-deploys"],
      { input: env[key], stdio: ["pipe", "ignore", "pipe"] },
    );
    if (result.status !== 0) {
      console.error(`Failed to set ${key}.`);
      return 1;
    }
    console.log(`${key} set.`);
  }

  step("Service settings from .railway/railway.ts");
  // Never pass --confirm-destructive here: if the plan would delete something, stop and ask.
  if (railway(["config", "apply", "--yes"], { stdio: "inherit" }).status !== 0) {
    console.error(
      "\n`railway config apply` failed. Run `railway config plan` to see why. If it wants to delete something, check with the user first.",
    );
    return 1;
  }

  step("Building and deploying");
  if (railway(["up", "--service", service, "--ci"], { stdio: "inherit" }).status !== 0) {
    console.error(
      `\nDeploy failed. See the build logs above, or: railway logs --service ${service} --build`,
    );
    return 1;
  }

  console.log(`\nDeployed. Follow the bot's logs with: railway logs --service ${service}`);
  return 0;
}
