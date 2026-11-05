import { type SpawnSyncOptionsWithStringEncoding, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadEnv } from "../src/env.ts";
import { main, ROOT } from "./_shared.ts";
import { missingVariables, readVariables } from "./variables.ts";

/** First CLI release that runs `.railway/railway.ts` (older ones use a retired engine). */
export const MIN_RAILWAY_CLI = "5.42.1";
const LINKS_FILE = join(ROOT, ".railway", "github.json");
const RAILWAY_GITHUB_APP = "https://github.com/apps/railway-app/installations/new";

export type GitHubLinks = Record<string, { repo: string; branch: string }>;

// The railway/iac SDK version-checks the CLI via `$_ --version`; under npm `$_` is node.
export function railwayEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, _: "railway" };
}

/** "railway 5.62.1" -> true when at least MIN_RAILWAY_CLI. */
export function isSupportedCliVersion(output: string, min = MIN_RAILWAY_CLI): boolean {
  const have = output
    .match(/(\d+)\.(\d+)\.(\d+)/)
    ?.slice(1)
    .map(Number);
  const need = min.split(".").map(Number);
  if (!have) return false;
  for (let i = 0; i < 3; i++) {
    const a = have[i] ?? 0;
    const b = need[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/** owner/repo from any GitHub remote URL (https, ssh, git@), or null. */
export function parseGitHubRepo(url: string): string | null {
  const m = url.trim().match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

export function readLinks(path = LINKS_FILE): GitHubLinks {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as GitHubLinks;
  } catch {
    return {};
  }
}

function writeLinks(links: GitHubLinks, path = LINKS_FILE): void {
  writeFileSync(path, `${JSON.stringify(links, null, 2)}\n`);
}

function railway(args: string[], options: Partial<SpawnSyncOptionsWithStringEncoding> = {}) {
  return spawnSync("railway", args, { cwd: ROOT, env: railwayEnv(), ...options, encoding: "utf8" });
}

function git(args: string[]): string | null {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function step(title: string) {
  console.log(`\n==> ${title}`);
}

export function serviceName(): string {
  const source = readFileSync(join(ROOT, ".railway", "railway.ts"), "utf8");
  const match = source.match(/service\(\s*"([^"]+)"/);
  if (!match?.[1]) throw new Error('Couldn\'t find service("...") in .railway/railway.ts');
  return match[1];
}

/** Why the GitHub copy of `branch` differs from local, or null when they match. */
function unpushedReason(branch: string): string | null {
  if (git(["status", "--porcelain", "--untracked-files=no"]))
    return "There are uncommitted changes.";
  git(["fetch", "--quiet", "origin", branch]);
  const local = git(["rev-parse", "HEAD"]);
  const remote = git(["rev-parse", `origin/${branch}`]);
  if (!remote) return `Branch "${branch}" isn't on GitHub yet.`;
  return local === remote ? null : `Local commits aren't pushed to origin/${branch}.`;
}

interface Deployment {
  id: string;
  status: string;
  createdAt: string;
}

function latestDeployment(service: string): Deployment | undefined {
  const r = railway(["deployment", "list", "--service", service, "--json"]);
  if (r.status !== 0) return undefined;
  const list = JSON.parse(r.stdout || "[]") as Deployment[];
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits for a deployment newer than `after` to finish. GitHub deploys wait for CI first. */
async function waitForDeployment(service: string, after: string, minutes = 15): Promise<boolean> {
  const done = new Set(["SUCCESS", "FAILED", "CRASHED", "REMOVED", "SKIPPED"]);
  const deadline = Date.now() + minutes * 60_000;
  let last = "";
  while (Date.now() < deadline) {
    const d = latestDeployment(service);
    if (d && d.createdAt > after) {
      if (d.status !== last) console.log(`Deployment ${d.status.toLowerCase()}...`);
      last = d.status;
      if (done.has(d.status)) return d.status === "SUCCESS";
    }
    await sleep(10_000);
  }
  console.error(`Still not finished after ${minutes} minutes. Check: railway service status`);
  return false;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(deploy);

async function deploy(): Promise<number> {
  const { values } = parseArgs({
    options: {
      github: { type: "boolean", default: false },
      "unlink-github": { type: "boolean", default: false },
    },
  });

  step("Checking Railway CLI");
  const version = railway(["--version"]);
  if (version.error) {
    console.error(
      "Railway CLI not found. Install it with `npm i -g @railway/cli` (or `brew install railway` on macOS), then run this again.",
    );
    return 1;
  }
  if (!isSupportedCliVersion(version.stdout)) {
    console.error(
      `Railway CLI ${version.stdout.trim()} is too old (need ${MIN_RAILWAY_CLI}+). Run \`railway upgrade --yes\`, then try again.`,
    );
    return 1;
  }
  if (railway(["whoami"]).status !== 0) {
    console.error(
      "Not logged in to Railway. Run `railway login`: it opens the browser to sign in, or to sign up for free if there's no account yet.",
    );
    return 1;
  }
  console.log(version.stdout.trim());

  loadEnv();
  const variables = readVariables();
  const missing = missingVariables(variables);
  if (missing.length > 0) {
    for (const v of missing) console.error(`${v.key} is empty in .env. ${v.help}`);
    console.error("Fill these in (see .env.example), then run this again.");
    return 1;
  }
  const service = serviceName();

  step("Railway project");
  if (railway(["status", "--json"]).status !== 0) {
    const name = process.env.RAILWAY_PROJECT_NAME ?? "discord-magic";
    console.log(`No project linked to this folder; creating "${name}".`);
    const args = ["init", "--name", name];
    if (process.env.RAILWAY_WORKSPACE) args.push("--workspace", process.env.RAILWAY_WORKSPACE);
    if (railway(args, { stdio: "inherit" }).status !== 0) return 1;
  } else console.log("Using the linked project.");
  const status = railway(["status", "--json"]);
  const projectId = (JSON.parse(status.stdout || "{}") as { id?: string }).id;
  if (!projectId)
    throw new Error("Couldn't read the Railway project ID (`railway status --json`).");

  step(`Service "${service}"`);
  const list = railway(["service", "list", "--json"]);
  const services = list.status === 0 ? (JSON.parse(list.stdout || "[]") as { name: string }[]) : [];
  if (!services.some((s) => s.name === service)) {
    if (railway(["add", "--service", service], { stdio: "inherit" }).status !== 0) return 1;
  } else console.log("Already exists.");

  step("Variables (from your local .env, values never printed)");
  for (const { key } of variables) {
    const result = railway(
      ["variable", "set", key, "--stdin", "--service", service, "--skip-deploys"],
      { input: process.env[key], stdio: ["pipe", "ignore", "pipe"] },
    );
    if (result.status !== 0) {
      console.error(`Failed to set ${key}.`);
      return 1;
    }
    console.log(`${key} set.`);
  }

  const links = readLinks();
  let justConnected = false;
  const startedAt = new Date().toISOString();

  if (values["unlink-github"] && links[projectId]) {
    step("Disconnecting GitHub");
    if (railway(["service", "source", "disconnect", "--service", service]).status !== 0) return 1;
    delete links[projectId];
    writeLinks(links);
    console.log(
      "Disconnected. Deploys upload from this folder again. Commit .railway/github.json.",
    );
  }

  if (values.github) {
    step("Connecting GitHub auto-deploys");
    const repo = parseGitHubRepo(git(["remote", "get-url", "origin"]) ?? "");
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "main";
    if (!repo) {
      console.error(
        "This folder has no GitHub `origin` remote. Put the project in the user's own GitHub repo first, then run this again.",
      );
      return 1;
    }
    const reason = unpushedReason(branch);
    if (reason) {
      console.error(`${reason} Railway builds what's on GitHub: commit and push first.`);
      return 1;
    }
    const linked = railway(
      ["service", "source", "connect", "--repo", repo, "--branch", branch, "--service", service],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    if (linked.status !== 0) {
      console.error(
        `\nRailway couldn't connect ${repo}. The usual fix: give Railway's GitHub app access to the repo at ${RAILWAY_GITHUB_APP} (pick the account, then the repo), then run this again.`,
      );
      return 1;
    }
    links[projectId] = { repo, branch };
    writeLinks(links);
    justConnected = true;
    console.log(
      `Connected ${repo} (${branch}). Commit .railway/github.json so it stays connected.`,
    );
  }

  step("Service settings from .railway/railway.ts");
  // Never pass --confirm-destructive here: if the plan would delete something, stop and ask.
  if (railway(["config", "apply", "--yes"], { stdio: "inherit" }).status !== 0) {
    console.error(
      "\n`railway config apply` failed. Run `railway config plan` to see why. If it wants to delete something, check with the user first.",
    );
    return 1;
  }

  const link = links[projectId];
  if (link) {
    step(`Deploying from GitHub (${link.repo}, ${link.branch})`);
    const reason = unpushedReason(link.branch);
    if (reason)
      console.log(`Note: ${reason} Railway deploys what's on GitHub; push to ship local changes.`);
    // Connecting already starts a deploy; otherwise redeploy so new settings/secrets take effect.
    if (!justConnected) {
      const r = railway(["redeploy", "--service", service, "--from-source", "--yes"], {
        stdio: ["ignore", "inherit", "inherit"],
      });
      if (r.status !== 0) return 1;
    }
    console.log("Waiting for GitHub CI and the Railway build (a few minutes)...");
    if (!(await waitForDeployment(service, startedAt))) {
      console.error(`\nDeploy didn't succeed. Logs: railway logs --service ${service} --build`);
      return 1;
    }
    console.log(
      `\nDeployed. From now on every push to ${link.branch} deploys automatically after CI passes.\nLogs: railway logs --service ${service}`,
    );
    return 0;
  }

  step("Uploading this folder and deploying");
  if (railway(["up", "--service", service, "--ci"], { stdio: "inherit" }).status !== 0) {
    console.error(
      `\nDeploy failed. See the build logs above, or: railway logs --service ${service} --build`,
    );
    return 1;
  }
  console.log(
    `\nDeployed. Follow the bot's logs with: railway logs --service ${service}\nTip: \`npm run deploy -- --github\` makes every git push deploy automatically.`,
  );
  return 0;
}
