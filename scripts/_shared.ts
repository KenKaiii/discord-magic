import { spawnSync } from "node:child_process";
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

/**
 * Invite link for another bot (MEE6, Carl-bot...) from its official discord.com invite URL, with
 * the user's server preselected so they only click Authorize. A bare application ID gives the
 * Discord-provided link, which uses that bot's own default permissions.
 */
export function otherBotInvite(input: string, guildId: string | undefined): string {
  const trimmed = input.trim();
  if (/^\d{17,20}$/.test(trimmed))
    return `https://discord.com/oauth2/authorize?client_id=${trimmed}`;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`"${trimmed}" isn't a link or an application ID.`);
  }
  const host = url.hostname.replace(/^(www|ptb|canary)\./, "");
  if (
    !["discord.com", "discordapp.com"].includes(host) ||
    !/^\/(api\/)?oauth2\/authorize\/?$/.test(url.pathname) ||
    !url.searchParams.get("client_id")
  )
    throw new Error(
      "That isn't a Discord invite link (discord.com/oauth2/authorize?client_id=...). If the bot's site gives a short link, follow its redirect to get the full one.",
    );
  url.hostname = "discord.com";
  url.pathname = "/oauth2/authorize";
  if (guildId && (url.searchParams.get("scope") ?? "").split(/[\s+]/).includes("bot")) {
    url.searchParams.set("guild_id", guildId);
    url.searchParams.set("disable_guild_select", "true");
  }
  return url.toString();
}

/** Opens a link in the user's browser. False when there's no browser (SSH, CI, containers). */
export function openInBrowser(url: string): boolean {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];
  const result = spawnSync(cmd, args, { stdio: "ignore", timeout: 10_000 });
  return !result.error && result.status === 0;
}
