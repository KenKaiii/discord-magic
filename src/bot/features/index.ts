import { ApplicationFlags, GatewayIntentBits } from "discord.js";
import type { ServerConfig } from "../../server/schema.ts";
import { autoRole } from "./auto-role.ts";
import { guide } from "./guide.ts";
import type { Feature } from "./types.ts";
import { welcome } from "./welcome.ts";

/** Every automation the bot runs. Add new ones here. */
export const features: readonly Feature[] = [guide, welcome, autoRole];

export function activeFeatures(config: ServerConfig, list = features): Feature[] {
  return list.filter((f) => f.enabled?.(config) ?? true);
}

export function requiredIntents(config: ServerConfig, list = features): GatewayIntentBits[] {
  const intents = new Set<GatewayIntentBits>([GatewayIntentBits.Guilds]);
  for (const f of activeFeatures(config, list)) for (const i of f.intents ?? []) intents.add(i);
  return [...intents];
}

/** Intents Discord only allows after a toggle in the Developer Portal (Bot page). */
export const PRIVILEGED_INTENTS = new Map<GatewayIntentBits, { toggle: string; flags: number }>([
  [
    GatewayIntentBits.GuildMembers,
    {
      toggle: "Server Members Intent",
      flags: ApplicationFlags.GatewayGuildMembers | ApplicationFlags.GatewayGuildMembersLimited,
    },
  ],
  [
    GatewayIntentBits.GuildPresences,
    {
      toggle: "Presence Intent",
      flags: ApplicationFlags.GatewayPresence | ApplicationFlags.GatewayPresenceLimited,
    },
  ],
  [
    GatewayIntentBits.MessageContent,
    {
      toggle: "Message Content Intent",
      flags: ApplicationFlags.GatewayMessageContent | ApplicationFlags.GatewayMessageContentLimited,
    },
  ],
]);

/** Privileged intents the config needs, each with the Developer Portal toggle that enables it. */
export function privilegedIntentsNeeded(config: ServerConfig, list = features) {
  return requiredIntents(config, list).flatMap((intent) => {
    const info = PRIVILEGED_INTENTS.get(intent);
    return info ? [{ intent, ...info }] : [];
  });
}
