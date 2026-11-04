import rawConfig from "../server.config.ts";
import { createBot } from "./bot/client.ts";
import { commands } from "./bot/commands/index.ts";
import { type Env, loadEnv } from "./env.ts";
import { startHealthServer } from "./health.ts";
import { createLogger } from "./logger.ts";
import { parseServerConfig, type ServerConfig } from "./server/schema.ts";

let env: Env;
let config: ServerConfig;
try {
  env = loadEnv();
  config = parseServerConfig(rawConfig);
} catch (err) {
  // Startup misconfiguration: print the readable message, not a stack trace.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV !== "production");
const client = createBot({ env, config, logger, commands });

const health = await startHealthServer(env.PORT, () => client.isReady());
logger.info({ port: env.PORT }, "Health check listening on /health");

let shuttingDown = false;
async function shutdown(signal: string, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  await client.destroy();
  health.close();
  process.exit(code);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error({ err }, "Unhandled promise rejection"));

try {
  await client.login(env.DISCORD_TOKEN);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (/disallowed intents/i.test(message))
    logger.fatal(
      "Discord refused a privileged intent. Run `npm run doctor` to see which toggle to switch on (Developer Portal -> your app -> Bot -> Privileged Gateway Intents).",
    );
  else if (/token/i.test(message))
    logger.fatal(
      "Discord rejected DISCORD_TOKEN. Reset it in the Developer Portal (Bot -> Reset Token).",
    );
  else logger.fatal({ err }, "Could not connect to Discord");
  await shutdown("login-failed", 1);
}
