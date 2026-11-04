import { createRequire } from "node:module";
import { type Logger, pino } from "pino";

export type { Logger };

function prettyAvailable(): boolean {
  try {
    createRequire(import.meta.url).resolve("pino-pretty");
    return true;
  } catch {
    return false;
  }
}

export function createLogger(level: string, pretty: boolean): Logger {
  return pino({
    level,
    ...(pretty && prettyAvailable()
      ? {
          transport: { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname" } },
        }
      : {}),
  });
}
