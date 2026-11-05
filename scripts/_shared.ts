import { fileURLToPath } from "node:url";
import { DiscordAPIError, type REST, Routes } from "discord.js";
import { EnvError } from "../src/env.ts";
import { ApplyError } from "../src/server/apply.ts";
import { ServerConfigError } from "../src/server/schema.ts";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Turns common Discord API failures into a next step a beginner (or an agent) can act on. */
export function explainDiscordError(err: unknown): string | undefined {
  const inner = err instanceof ApplyError ? err.cause : err;
  if (!(inner instanceof DiscordAPIError)) return undefined;
  if (inner.status === 401)
    return "DISCORD_TOKEN was rejected. Reset it in the Developer Portal (Bot -> Reset Token) and update .env.";
  if (inner.code === 10004)
    return "DISCORD_GUILD_ID doesn't match a server the bot can see. Check the ID, then run `npm run invite`.";
  if (inner.code === 50001)
    return "The bot isn't in that server (or can't see it). Run `npm run invite` and add it.";
  if (inner.code === 50013)
    return "The bot is missing a permission. Run `npm run doctor` to see which, then re-invite with `npm run invite`.";
  if (inner.code === 50035)
    return "Discord rejected a value. Check the field mentioned above in server.config.ts.";
  return undefined;
}

export function main(fn: () => Promise<number | undefined>): void {
  fn().then(
    (code) => process.exit(code ?? 0),
    (err: unknown) => {
      if (err instanceof EnvError || err instanceof ServerConfigError || err instanceof ApplyError)
        console.error(`\n${err.message}`);
      else console.error(err);
      const hint = explainDiscordError(err);
      if (hint) console.error(`\nNext step: ${hint}`);
      process.exit(1);
    },
  );
}

export interface AppInfo {
  id: string;
  name: string;
  flags?: number;
}

export async function fetchApplication(rest: REST): Promise<AppInfo> {
  return (await rest.get(Routes.currentApplication())) as AppInfo;
}

export const ADMIN_PERMISSIONS = 8n;
// ManageGuild | ManageRoles | ManageChannels | ViewChannel | SendMessages | EmbedLinks | ReadMessageHistory | PinMessages
export const MINIMAL_PERMISSIONS =
  (1n << 5n) |
  (1n << 28n) |
  (1n << 4n) |
  (1n << 10n) |
  (1n << 11n) |
  (1n << 14n) |
  (1n << 16n) |
  (1n << 51n);

export function inviteUrl(
  applicationId: string,
  guildId: string | undefined,
  minimal = false,
): string {
  const params = new URLSearchParams({
    client_id: applicationId,
    scope: "bot applications.commands",
    permissions: String(minimal ? MINIMAL_PERMISSIONS : ADMIN_PERMISSIONS),
    integration_type: "0",
  });
  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorize?${params}`;
}
