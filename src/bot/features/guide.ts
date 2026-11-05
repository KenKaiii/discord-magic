import {
  ChannelType,
  type Client,
  type ContainerBuilder,
  Events,
  type Message,
  MessageType,
  type NewsChannel,
  type TextChannel,
} from "discord.js";
import type { ServerConfig } from "../../server/schema.ts";
import { brandColor, card, cardMessage } from "../ui.ts";
import type { Feature, FeatureContext } from "./types.ts";
import { fillTemplate, type TemplateVars } from "./welcome.ts";

export function guideCard(config: ServerConfig, vars: TemplateVars): ContainerBuilder | null {
  const guide = config.bot.guide;
  if (!guide) return null;
  return card({
    accent: brandColor(config),
    ...(guide.title ? { title: fillTemplate(guide.title, vars) } : {}),
    body: fillTemplate(guide.message, vars),
  });
}

/** The guide is the bot's own pinned message in the guide channel (oldest, if there are several). */
export function findGuide(pinned: readonly Message[], botId: string): Message | undefined {
  return pinned
    .filter((m) => m.author.id === botId)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)[0];
}

async function syncGuide(client: Client<true>, { config, logger, guildId }: FeatureContext) {
  const settings = config.bot.guide;
  if (!settings) return;
  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();
  const channel = channels.find(
    (c): c is TextChannel | NewsChannel =>
      c?.name === settings.channel &&
      (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement),
  );
  if (!channel) {
    logger.warn(
      { channel: settings.channel },
      "Guide channel not found; run `npm run server:apply`",
    );
    return;
  }
  const container = guideCard(config, {
    serverName: guild.name,
    channels: new Map(
      [...channels.values()].flatMap((c) => (c ? [[c.name.toLowerCase(), c.id]] : [])),
    ),
  });
  if (!container) return;
  const message = cardMessage(container);

  const pins = await channel.messages.fetchPins();
  const existing = findGuide(
    pins.items.map((p) => p.message),
    client.user.id,
  );
  if (existing) {
    await existing.edit(message);
    logger.info({ channel: settings.channel }, "Guide updated");
    return;
  }
  const sent = await channel.send(message);
  try {
    await sent.pin();
  } catch (err) {
    logger.warn({ err }, "Posted the guide but couldn't pin it (needs Pin Messages permission)");
    return;
  }
  try {
    // Pinning adds a "pinned a message" notice under the guide; tidy it away.
    const recent = await channel.messages.fetch({ limit: 5 });
    const notice = recent.find(
      (m) => m.type === MessageType.ChannelPinnedMessage && m.reference?.messageId === sent.id,
    );
    await notice?.delete();
  } catch (err) {
    logger.warn({ err }, "Pinned the guide but couldn't remove the 'pinned a message' notice");
  }
  logger.info({ channel: settings.channel }, "Guide posted");
}

/** Keeps one pinned "start here" card in a channel, edited in place on every start (bot.guide). */
export const guide: Feature = {
  name: "guide",
  enabled: (config) => Boolean(config.bot.guide),
  setup(client, ctx) {
    client.once(Events.ClientReady, (ready) => {
      syncGuide(ready, ctx).catch((err: unknown) => ctx.logger.error({ err }, "Guide failed"));
    });
  },
};
