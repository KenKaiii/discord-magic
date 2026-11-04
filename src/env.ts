import { z } from "zod";

const schema = z.object({
  DISCORD_TOKEN: z
    .string({ error: "is missing" })
    .min(50, "doesn't look like a bot token (Developer Portal -> Bot -> Reset Token)"),
  DISCORD_GUILD_ID: z
    .string({ error: "is missing" })
    .regex(/^\d{17,20}$/, "must be a numeric server ID (right-click the server -> Copy Server ID)"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.output<typeof schema>;

export class EnvError extends Error {
  override name = "EnvError";
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ""),
  );
  const result = schema.safeParse(cleaned);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => `  ${i.path.join(".")} ${i.message}`);
  throw new EnvError(
    `Environment variables are missing or invalid:\n${lines.join("\n")}\n` +
      "Locally: copy .env.example to .env and fill it in. On Railway: set them under Variables.",
  );
}
