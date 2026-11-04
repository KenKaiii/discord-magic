import {
  ActionRowBuilder,
  type ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from "discord.js";
import type { ServerConfig } from "../server/schema.ts";

/** Discord's own brand colours; they read well in both light and dark mode. */
export const palette = {
  blurple: 0x5865f2,
  green: 0x57f287,
  yellow: 0xfee75c,
  red: 0xed4245,
  fuchsia: 0xeb459e,
} as const;

/** The server's accent colour (`bot.brandColor` in server.config.ts). */
export function brandColor(config: ServerConfig): number {
  return config.bot.brandColor
    ? Number.parseInt(config.bot.brandColor.slice(1), 16)
    : palette.blurple;
}

export interface CardOptions {
  /** Short headline, rendered as a heading. */
  title?: string;
  /** Markdown body. Mentions (<@id>, <#id>) work. */
  body?: string;
  /** Left accent bar colour. Use brandColor(config) or a palette colour for status. */
  accent?: number;
  /** Small square image to the right of the title/body (avatar, server icon). */
  thumbnail?: string | null;
  /** Compact label/value lines under the body. */
  fields?: { name: string; value: string }[];
  /** Full-width image or banner. */
  image?: string | null;
  /** Muted small print at the bottom. */
  footer?: string;
  /** Up to 5 buttons in one row. One primary at most; link buttons for URLs. */
  buttons?: ButtonBuilder[];
}

/**
 * A modern Discord "card" (Components V2 container). Every bot message should go through this
 * so the server has one consistent look. Send it with cardMessage()/cardReply().
 */
export function card(options: CardOptions): ContainerBuilder {
  const container = new ContainerBuilder();
  if (options.accent !== undefined) container.setAccentColor(options.accent);

  const head = [options.title ? `## ${options.title}` : "", options.body ?? ""]
    .filter(Boolean)
    .join("\n");
  if (head && options.thumbnail) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(head))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(options.thumbnail)),
    );
  } else if (head) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(head));
  }

  if (options.fields?.length) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        options.fields.map((f) => `**${f.name}** · ${f.value}`).join("\n"),
      ),
    );
  }
  if (options.image)
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems((item) => item.setURL(options.image ?? "")),
    );
  if (options.buttons?.length)
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(options.buttons.slice(0, 5)),
    );
  if (options.footer)
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${options.footer}`));
  return container;
}

/** Options for channel.send(). Only the listed users are pinged, never @everyone or roles. */
export function cardMessage(container: ContainerBuilder, mentionUsers: string[] = []) {
  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [], users: mentionUsers },
  };
}

/** Options for interaction.reply(). Ephemeral = only the person who ran the command sees it. */
export function cardReply(container: ContainerBuilder, options: { ephemeral?: boolean } = {}) {
  return {
    components: [container],
    flags: options.ephemeral
      ? ([MessageFlags.IsComponentsV2, MessageFlags.Ephemeral] as const)
      : ([MessageFlags.IsComponentsV2] as const),
    allowedMentions: { parse: [] },
  };
}
