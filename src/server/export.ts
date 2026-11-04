import { sortChannels, sortRolesTopDown } from "./order.ts";
import { fromBits } from "./permissions.ts";
import {
  CATEGORY_TYPE,
  CHANNEL_TYPE,
  CONTENT_FILTER,
  DEFAULT_NOTIFICATIONS,
  VERIFICATION_LEVEL,
} from "./plan.ts";
import { type ChannelKind, EVERYONE, type ServerConfigInput } from "./schema.ts";
import type { LiveChannel, LiveOverwrite, Snapshot } from "./types.ts";

type ChannelInput = NonNullable<ServerConfigInput["channels"]>[number];
type OverwriteInput = NonNullable<ChannelInput["permissions"]>[number];

const reverse = <K extends string>(table: Record<K, number>, value: number): K | undefined =>
  (Object.entries(table) as [K, number][]).find(([, v]) => v === value)?.[0];

/** Turns a live server (or a backup) into a server.config.ts starting point. */
export function snapshotToConfig(snapshot: Snapshot): {
  config: ServerConfigInput;
  skipped: string[];
} {
  const { guild } = snapshot;
  const skipped: string[] = [];
  const roleName = new Map<string, string>([[guild.id, EVERYONE]]);

  const roles = sortRolesTopDown(
    snapshot.roles.filter(
      (r) => r.id !== guild.id && !r.managed && !snapshot.bot.roleIds.includes(r.id),
    ),
  ).map((r) => {
    roleName.set(r.id, r.name);
    return {
      name: r.name,
      ...(r.color ? { color: `#${r.color.toString(16).toUpperCase().padStart(6, "0")}` } : {}),
      ...(r.hoist ? { hoist: true } : {}),
      ...(r.mentionable ? { mentionable: true } : {}),
      permissions: fromBits(r.permissions),
    };
  });

  const managedName = new Map(snapshot.roles.filter((r) => r.managed).map((r) => [r.id, r.name]));
  const otherBots = new Set<string>();
  const overwrites = (list: LiveOverwrite[]): OverwriteInput[] =>
    list.flatMap((o) => {
      const bot = o.type === 0 ? managedName.get(o.id) : undefined;
      if (bot) otherBots.add(bot);
      const role = o.type === 0 ? (roleName.get(o.id) ?? bot) : undefined;
      if (!role) return [];
      const allow = fromBits(o.allow);
      const deny = fromBits(o.deny);
      if (allow.length === 0 && deny.length === 0) return [];
      return [{ role, ...(allow.length ? { allow } : {}), ...(deny.length ? { deny } : {}) }];
    });
  const sameOverwrites = (a: OverwriteInput[], b: OverwriteInput[]) =>
    JSON.stringify([...a].sort((x, y) => x.role.localeCompare(y.role))) ===
    JSON.stringify([...b].sort((x, y) => x.role.localeCompare(y.role)));

  const kindOf = (type: number): ChannelKind | undefined =>
    (Object.entries(CHANNEL_TYPE) as [ChannelKind, number][]).find(([, v]) => v === type)?.[0];

  const channel = (
    c: LiveChannel,
    parentPerms: OverwriteInput[] | undefined,
  ): ChannelInput | null => {
    const type = kindOf(c.type);
    if (!type) {
      skipped.push(`#${c.name} (channel type ${c.type} isn't supported by server.config.ts)`);
      return null;
    }
    const perms = overwrites(c.overwrites);
    const inherit = parentPerms !== undefined && sameOverwrites(perms, parentPerms);
    return {
      name: c.name,
      ...(type !== "text" ? { type } : {}),
      ...(c.topic ? { topic: c.topic } : {}),
      ...(c.nsfw ? { nsfw: true } : {}),
      ...(c.rateLimitPerUser && type !== "announcement" ? { slowmode: c.rateLimitPerUser } : {}),
      ...(type === "voice" && c.userLimit ? { userLimit: c.userLimit } : {}),
      ...((type === "voice" || type === "stage") && c.bitrate ? { bitrate: c.bitrate } : {}),
      ...(!inherit ? { permissions: perms } : {}),
    };
  };

  const notNull = <T>(v: T | null): v is T => v !== null;
  const topLevel = sortChannels(
    snapshot.channels.filter((c) => c.type !== CATEGORY_TYPE && c.parentId === null),
  )
    .map((c) => channel(c, undefined))
    .filter(notNull);
  const categories = sortChannels(snapshot.channels.filter((c) => c.type === CATEGORY_TYPE)).map(
    (cat) => {
      const perms = overwrites(cat.overwrites);
      return {
        name: cat.name,
        permissions: perms,
        channels: sortChannels(snapshot.channels.filter((c) => c.parentId === cat.id))
          .map((c) => channel(c, perms))
          .filter(notNull),
      };
    },
  );

  const channelName = (id: string | null): string | null =>
    snapshot.channels.find((c) => c.id === id)?.name ?? null;
  const settings: NonNullable<ServerConfigInput["settings"]> = {};
  const verification = reverse(VERIFICATION_LEVEL, guild.verificationLevel);
  if (verification) settings.verificationLevel = verification;
  const notifications = reverse(DEFAULT_NOTIFICATIONS, guild.defaultMessageNotifications);
  if (notifications) settings.defaultNotifications = notifications;
  const filter = reverse(CONTENT_FILTER, guild.explicitContentFilter);
  if (filter) settings.explicitContentFilter = filter;
  settings.systemChannel = channelName(guild.systemChannelId);
  if (guild.rulesChannelId) settings.rulesChannel = channelName(guild.rulesChannelId);
  if (guild.afkChannelId) settings.afkChannel = channelName(guild.afkChannelId);
  if ([60, 300, 900, 1800, 3600].includes(guild.afkTimeout))
    settings.afkTimeout = guild.afkTimeout as 60 | 300 | 900 | 1800 | 3600;

  const everyone = snapshot.roles.find((r) => r.id === guild.id);
  return {
    config: {
      name: guild.name,
      description: guild.description,
      settings,
      ...(everyone ? { everyone: { permissions: fromBits(everyone.permissions) } } : {}),
      roles,
      ...(otherBots.size > 0 ? { otherBots: [...otherBots] } : {}),
      channels: topLevel,
      categories,
    },
    skipped,
  };
}

export function renderConfigSource(config: ServerConfigInput, header: string[] = []): string {
  const body = JSON.stringify(config, null, 2).replace(/(?<!\\)"([A-Za-z_$][\w$]*)":/g, "$1:");
  return [
    ...header.map((l) => `// ${l}`),
    'import { defineServer } from "./src/server/schema.ts";',
    "",
    `export default defineServer(${body});`,
    "",
  ].join("\n");
}
