// Railway Infrastructure as Code: `railway config plan` previews, `railway config apply` applies.
// `npm run deploy` runs the whole flow. Secrets are set from .env and kept with preserve().
import { defineRailway, preserve, project, service } from "railway/iac";

export default defineRailway((ctx) => {
  const bot = service("discord-bot", {
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
      DISCORD_TOKEN: preserve(),
      DISCORD_GUILD_ID: preserve(),
    },
  });

  return project(ctx.projectName ?? "discord-magic", { resources: [bot] });
});
