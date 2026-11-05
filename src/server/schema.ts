import { z } from "zod";
import { ALL_PERMISSION_NAMES, type PermissionName } from "./permissions.ts";

const permission = z.enum(ALL_PERMISSION_NAMES as [PermissionName, ...PermissionName[]]);
const permissionList = z.array(permission).default([]);

const names = z
  .union([z.string().min(1), z.array(z.string().min(1))])
  .transform((v) => (Array.isArray(v) ? v : [v]))
  .optional();

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like "#5865F2"')
  .transform((v) => v.toUpperCase());

export const EVERYONE = "@everyone";

const overwriteSchema = z.strictObject({
  /** Role name from `roles` or `otherBots`, or "@everyone". */
  role: z.string().min(1),
  allow: permissionList,
  deny: permissionList,
});

export const CHANNEL_TYPES = ["text", "voice", "announcement", "forum", "stage"] as const;
export type ChannelKind = (typeof CHANNEL_TYPES)[number];

export function isTextLike(type: ChannelKind | "category"): boolean {
  return type === "text" || type === "announcement" || type === "forum";
}

/** Discord lowercases text-channel names and turns spaces into dashes; mirror it so diffs converge. */
export function normalizeChannelName(type: ChannelKind | "category", name: string): string {
  const trimmed = name.trim();
  return isTextLike(type) ? trimmed.toLowerCase().replace(/\s+/g, "-") : trimmed;
}

const channelSchema = z
  .strictObject({
    name: z.string().min(1).max(100),
    type: z.enum(CHANNEL_TYPES).default("text"),
    /** Text/announcement/forum only. Omit for an empty topic. */
    topic: z.string().max(1024).optional(),
    nsfw: z.boolean().default(false),
    /** Seconds between messages per user (0-21600). Not supported on announcement channels. */
    slowmode: z.number().int().min(0).max(21600).default(0),
    /** Voice only. 0 = unlimited. */
    userLimit: z.number().int().min(0).max(99).default(0),
    /** Voice/stage only. Omit to leave Discord's default. */
    bitrate: z.number().int().min(8000).max(384000).optional(),
    /** Omit to inherit the category's permissions (or leave existing ones untouched). */
    permissions: z.array(overwriteSchema).optional(),
    /** Old name(s): set when renaming so the existing channel (and its messages) is kept. */
    renamedFrom: names,
  })
  .transform((c) => ({
    ...c,
    name: normalizeChannelName(c.type, c.name),
    renamedFrom: c.renamedFrom?.map((n) => normalizeChannelName(c.type, n)),
  }));

const categorySchema = z.strictObject({
  name: z.string().min(1).max(100),
  permissions: z.array(overwriteSchema).optional(),
  channels: z.array(channelSchema).default([]),
  renamedFrom: names,
});

const roleSchema = z.strictObject({
  name: z.string().min(1).max(100),
  color: hexColor.optional(),
  /** Show members with this role separately in the member list. */
  hoist: z.boolean().default(false),
  mentionable: z.boolean().default(false),
  /** Exactly the server-wide permissions this role grants (on top of @everyone). */
  permissions: permissionList,
  renamedFrom: names,
});

const settingsSchema = z.strictObject({
  verificationLevel: z.enum(["none", "low", "medium", "high", "very_high"]).optional(),
  defaultNotifications: z.enum(["all_messages", "only_mentions"]).optional(),
  explicitContentFilter: z.enum(["disabled", "members_without_roles", "all_members"]).optional(),
  /** Channel name where Discord posts join/boost messages, or null to turn off. */
  systemChannel: z.string().nullable().optional(),
  /** Community servers only. */
  rulesChannel: z.string().nullable().optional(),
  afkChannel: z.string().nullable().optional(),
  afkTimeout: z
    .union([z.literal(60), z.literal(300), z.literal(900), z.literal(1800), z.literal(3600)])
    .optional(),
  boostProgressBar: z.boolean().optional(),
});

const botSchema = z.strictObject({
  /** Accent colour for every bot message card. Defaults to Discord blurple. */
  brandColor: hexColor.optional(),
  /** Card posted when someone joins. Placeholders: {user} {server} {memberCount} {#channel}. Needs the Server Members intent. */
  welcome: z
    .strictObject({
      channel: z.string().min(1),
      title: z.string().min(1).max(256).optional(),
      message: z.string().min(1).max(2000),
    })
    .optional(),
  /** One pinned "start here" card the bot keeps up to date in a channel. Placeholders: {server} {#channel}. */
  guide: z
    .strictObject({
      channel: z.string().min(1),
      title: z.string().min(1).max(256).optional(),
      message: z.string().min(1).max(3500),
    })
    .optional(),
  /** Role given to every new member. Needs the Server Members intent. */
  autoRole: z.string().min(1).optional(),
});

export const serverSchema = z
  .strictObject({
    name: z.string().min(2).max(100),
    /** Omit to leave the current description alone; null clears it. */
    description: z.string().max(300).nullable().optional(),
    /** Path (relative to the repo root) to a PNG/JPEG/GIF, ideally 1024x1024. */
    icon: z.string().min(1).optional(),
    settings: settingsSchema.default({}),
    /** Base permissions every member has. Omit to leave @everyone untouched. */
    everyone: z.strictObject({ permissions: permissionList }).optional(),
    /** Listed top (highest) to bottom. */
    roles: z.array(roleSchema).default([]),
    /** Roles of other bots added to the server (usually the bot's name), so channel permissions can include them. */
    otherBots: z.array(z.string().min(1).max(100)).default([]),
    /** Channels outside any category (shown above all categories). */
    channels: z.array(channelSchema).default([]),
    categories: z.array(categorySchema).default([]),
    bot: botSchema.default({}),
  })
  .superRefine((server, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: "custom", message, path });

    const roleNames = new Set<string>();
    server.roles.forEach((role, i) => {
      if (role.name === EVERYONE) issue(`Use "everyone" for @everyone, not roles`, ["roles", i]);
      if (roleNames.has(role.name)) issue(`Duplicate role "${role.name}"`, ["roles", i, "name"]);
      roleNames.add(role.name);
    });
    const botRoleNames = new Set<string>();
    server.otherBots.forEach((name, i) => {
      if (roleNames.has(name) || botRoleNames.has(name))
        issue(`"${name}" is listed twice (roles/otherBots)`, ["otherBots", i]);
      botRoleNames.add(name);
    });

    const checkOverwrites = (
      list: { role: string }[] | undefined,
      path: (string | number)[],
    ): void => {
      list?.forEach((o, i) => {
        if (o.role !== EVERYONE && !roleNames.has(o.role) && !botRoleNames.has(o.role))
          issue(`Unknown role "${o.role}" (add it to roles or otherBots, or use "@everyone")`, [
            ...path,
            i,
          ]);
      });
    };

    const allChannels: { name: string; type: ChannelKind }[] = [];
    const checkChannels = (
      list: z.output<typeof channelSchema>[],
      path: (string | number)[],
    ): void => {
      const seen = new Set<string>();
      list.forEach((c, i) => {
        if (seen.has(c.name)) issue(`Duplicate channel "${c.name}" here`, [...path, i, "name"]);
        seen.add(c.name);
        checkOverwrites(c.permissions, [...path, i, "permissions"]);
        allChannels.push(c);
      });
    };

    checkChannels(server.channels, ["channels"]);
    const categoryNames = new Set<string>();
    server.categories.forEach((cat, i) => {
      if (categoryNames.has(cat.name))
        issue(`Duplicate category "${cat.name}"`, ["categories", i, "name"]);
      categoryNames.add(cat.name);
      checkOverwrites(cat.permissions, ["categories", i, "permissions"]);
      checkChannels(cat.channels, ["categories", i, "channels"]);
    });

    const checkChannelRef = (
      ref: string | null | undefined,
      want: "text" | "voice",
      path: (string | number)[],
    ): void => {
      if (ref == null) return;
      const matches = allChannels.filter(
        (c) => c.name === normalizeChannelName(want === "text" ? "text" : "voice", ref),
      );
      const ok = matches.filter((c) =>
        want === "voice" ? c.type === "voice" : isTextLike(c.type),
      );
      if (ok.length === 0) issue(`No ${want} channel named "${ref}" in this config`, path);
      else if (ok.length > 1) issue(`Channel name "${ref}" is used more than once`, path);
    };
    checkChannelRef(server.settings.systemChannel, "text", ["settings", "systemChannel"]);
    checkChannelRef(server.settings.rulesChannel, "text", ["settings", "rulesChannel"]);
    checkChannelRef(server.settings.afkChannel, "voice", ["settings", "afkChannel"]);
    checkChannelRef(server.bot.welcome?.channel, "text", ["bot", "welcome", "channel"]);
    checkChannelRef(server.bot.guide?.channel, "text", ["bot", "guide", "channel"]);
    if (server.bot.autoRole && !roleNames.has(server.bot.autoRole))
      issue(`Unknown role "${server.bot.autoRole}"`, ["bot", "autoRole"]);
  });

export type ServerConfigInput = z.input<typeof serverSchema>;
export type ServerConfig = z.output<typeof serverSchema>;
export type ChannelConfig = z.output<typeof channelSchema>;
export type CategoryConfig = z.output<typeof categorySchema>;
export type RoleConfig = z.output<typeof roleSchema>;
export type OverwriteConfig = z.output<typeof overwriteSchema>;

/** Typed helper for server.config.ts (gives autocomplete; validation happens on load). */
export function defineServer(config: ServerConfigInput): ServerConfigInput {
  return config;
}

export class ServerConfigError extends Error {
  override name = "ServerConfigError";
}

export function parseServerConfig(input: unknown): ServerConfig {
  const result = serverSchema.safeParse(input);
  if (!result.success)
    throw new ServerConfigError(`server.config.ts is invalid:\n${z.prettifyError(result.error)}`);
  return result.data;
}
