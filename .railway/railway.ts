// Railway Infrastructure as Code: `railway config plan` previews, `railway config apply` applies.
// `npm run deploy` runs the whole flow. Variables are set from .env and kept with preserve().
import { readFileSync } from "node:fs";
import { defineRailway, github, preserve, project, service } from "railway/iac";
import { readVariables } from "../scripts/variables.ts";

// Railway project ID -> GitHub repo it auto-deploys from. Written by `npm run deploy -- --github`.
// Keyed by project so a clone of this repo never deploys someone else's GitHub repo.
const links = JSON.parse(readFileSync(new URL("./github.json", import.meta.url), "utf8")) as Record<
  string,
  { repo: string; branch: string }
>;

export default defineRailway((ctx) => {
  const link = ctx.projectId ? links[ctx.projectId] : undefined;

  const bot = service("discord-bot", {
    // Linked: every push to the branch deploys once GitHub CI passes. Otherwise `railway up` uploads.
    ...(link ? { source: github(link.repo, { branch: link.branch, checkSuites: true }) } : {}),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    // One gateway connection only: extra replicas or overlapping deploys answer commands twice.
    replicas: 1,
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 120,
      // Restart policy is left at Railway's default (restart on failure, 10 retries); setting
      // it explicitly is stored as null and shows as permanent drift.
      overlapSeconds: 0,
      drainingSeconds: 10,
    },
    env: {
      NODE_ENV: "production",
      LOG_LEVEL: "info",
      // Everything required in .env.example; `npm run deploy` sets the values.
      ...Object.fromEntries(readVariables().map((v) => [v.key, preserve()])),
    },
  });

  return project(ctx.projectName ?? "discord-magic", { resources: [bot] });
});
