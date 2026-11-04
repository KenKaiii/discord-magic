import { type ContainerBuilder, Events, GatewayIntentBits } from "discord.js";
import type { ServerConfig } from "../../server/schema.ts";
import { brandColor, card, cardMessage } from "../ui.ts";
import type { Feature } from "./types.ts";

export interface WelcomeVars {
  userId: string;
  serverName: string;
  memberCount: number;
  /** Channel name -> id, used for {#channel-name} placeholders. */
  channels: Map<string, string>;
}

export function fillTemplate(template: string, vars: WelcomeVars): string {
  return template
    .replaceAll("{user}", `<@${vars.userId}>`)
    .replaceAll("{server}", vars.serverName)
    .replaceAll("{memberCount}", String(vars.memberCount))
    .replace(/\{#([^}]+)\}/g, (_whole, name: string) => {
      const id = vars.channels.get(name.trim().toLowerCase());
      return id ? `<#${id}>` : `#${name}`;
    });
}

export function welcomeCard(
  config: ServerConfig,
  vars: WelcomeVars,
  avatarUrl: string | null,
): ContainerBuilder | null {
  const welcome = config.bot.welcome;
  if (!welcome) return null;
  return card({
    accent: brandColor(config),
    ...(welcome.title ? { title: fillTemplate(welcome.title, vars) } : {}),
    body: fillTemplate(welcome.message, vars),
    thumbnail: avatarUrl,
    footer: `Member #${vars.memberCount}`,
  });
}

/** Posts a welcome card when someone joins (bot.welcome in server.config.ts). */
export const welcome: Feature = {
  name: "welcome",
  intents: [GatewayIntentBits.GuildMembers],
  enabled: (config) => Boolean(config.bot.welcome),
  setup(client, { config, logger, guildId }) {
    client.on(Events.GuildMemberAdd, async (member) => {
      if (member.guild.id !== guildId || !config.bot.welcome) return;
      try {
        const target = config.bot.welcome.channel;
        const channel = member.guild.channels.cache.find(
          (c) => c.name === target && c.isTextBased(),
        );
        if (!channel?.isSendable()) {
          logger.warn({ channel: target }, "Welcome channel not found; run `npm run server:apply`");
          return;
        }
        const vars: WelcomeVars = {
          userId: member.id,
          serverName: member.guild.name,
          memberCount: member.guild.memberCount,
          channels: new Map(member.guild.channels.cache.map((c) => [c.name.toLowerCase(), c.id])),
        };
        const container = welcomeCard(config, vars, member.displayAvatarURL({ size: 256 }));
        if (container) await channel.send(cardMessage(container, [member.id]));
      } catch (err) {
        logger.error({ err }, "Welcome message failed");
      }
    });
  },
};
