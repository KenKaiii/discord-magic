import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  channelClass,
  isAtOrAboveBot,
  planChannelPositions,
  planRolePositions,
  sortRolesTopDown,
} from "./order.ts";
import {
  describePermissionDiff,
  fromBits,
  hasBits,
  missingPermissions,
  type PermissionName,
  toBits,
} from "./permissions.ts";
import {
  type ChannelConfig,
  type ChannelKind,
  EVERYONE,
  isTextLike,
  normalizeChannelName,
  type OverwriteConfig,
  type ServerConfig,
} from "./schema.ts";
import type {
  ChannelBody,
  GuildBody,
  LiveChannel,
  LiveOverwrite,
  LiveRole,
  RoleBody,
  Snapshot,
} from "./types.ts";

export const CATEGORY_TYPE = 4;
export const CHANNEL_TYPE: Record<ChannelKind, number> = {
  text: 0,
  voice: 2,
  announcement: 5,
  stage: 13,
  forum: 15,
};
export const VERIFICATION_LEVEL = { none: 0, low: 1, medium: 2, high: 3, very_high: 4 } as const;
export const DEFAULT_NOTIFICATIONS = { all_messages: 0, only_mentions: 1 } as const;
export const CONTENT_FILTER = { disabled: 0, members_without_roles: 1, all_members: 2 } as const;

export interface Change {
  field: string;
  from: string;
  to: string;
}

export interface DesiredOverwrite {
  /** Role name, or "@everyone". */
  target: string;
  allow: string;
  deny: string;
}

export interface OverwritePlan {
  managed: DesiredOverwrite[];
  /** Member overwrites and overwrites for roles this config doesn't manage. Kept as-is. */
  preserved: LiveOverwrite[];
}

export type ChannelRefField = "system_channel_id" | "rules_channel_id" | "afk_channel_id";

export type Op =
  | { kind: "role.create"; name: string; body: RoleBody }
  | { kind: "role.update"; id: string; name: string; changes: Change[]; body: RoleBody }
  | { kind: "everyone.update"; changes: Change[]; permissions: string }
  | { kind: "roles.reorder" }
  | {
      kind: "channel.create";
      key: string;
      name: string;
      type: number;
      parentKey: string | null;
      body: ChannelBody & { name: string; type: number };
      overwrites?: OverwritePlan;
    }
  | {
      kind: "channel.update";
      key: string;
      id: string;
      name: string;
      type: number;
      changes: Change[];
      body: ChannelBody;
      /** Present only when the channel moves to another category (null = no category). */
      parentKey?: string | null;
      overwrites?: OverwritePlan;
    }
  | { kind: "channels.reorder"; group: string; label: string }
  | {
      kind: "guild.update";
      changes: Change[];
      body: GuildBody;
      channelRefs: Partial<Record<ChannelRefField, string | null>>;
      iconPath?: string;
    }
  | { kind: "channel.delete"; id: string; name: string; type: number }
  | { kind: "role.delete"; id: string; name: string };

export interface Issue {
  level: "error" | "warning";
  message: string;
}

export interface DesiredChannel {
  key: string;
  parentKey: string | null;
  config: ChannelConfig | { name: string; type: "category"; permissions?: OverwriteConfig[] };
  type: number;
  overwrites?: OverwriteConfig[];
}

export interface Plan {
  guildId: string;
  guildName: string;
  ops: Op[];
  /** Config role name -> existing role id. */
  roleIds: Record<string, string>;
  /** Channel key -> existing channel id. */
  channelIds: Record<string, string>;
  /** Config role names, top to bottom. */
  roleOrder: string[];
  /** Desired sibling order per parent key ("" = top level channels, "#categories" = categories). */
  channelOrder: Record<string, string[]>;
  unmanaged: { roles: { id: string; name: string }[]; channels: LiveChannel[] };
  issues: Issue[];
}

export interface PlanOptions {
  /** Delete every role/channel that is not in the config. */
  prune?: boolean;
  /** Delete only these channels/categories (by name) that are not in the config. */
  deleteChannels?: string[];
  /** Delete only these roles (by name) that are not in the config. */
  deleteRoles?: string[];
  /** Re-upload the icon even if the server already has one. */
  updateIcon?: boolean;
  /** Repo root, for resolving the icon path. */
  rootDir?: string;
}

export const categoryKey = (name: string): string => `category:${name}`;
export const channelKey = (parent: string | null, name: string): string =>
  `channel:${parent ?? ""}/${name}`;
export const CATEGORIES_GROUP = "#categories";
export const TOP_LEVEL_GROUP = "";

const hex = (n: number): string => `#${n.toString(16).toUpperCase().padStart(6, "0")}`;
const quote = (s: string | null | undefined): string => (s ? `"${s}"` : "(none)");
const label = (type: number): string =>
  type === CATEGORY_TYPE
    ? "category"
    : (Object.entries(CHANNEL_TYPE).find(([, v]) => v === type)?.[0] ?? `type-${type}`);

export function channelLabel(name: string, type: number): string {
  return type === CATEGORY_TYPE ? `category "${name}"` : `${label(type)} channel #${name}`;
}

/** Flattens the config into the ordered list of channels it wants, categories first. */
export function desiredChannels(config: ServerConfig): DesiredChannel[] {
  const out: DesiredChannel[] = [];
  for (const cat of config.categories) {
    out.push({
      key: categoryKey(cat.name),
      parentKey: null,
      config: { name: cat.name, type: "category", permissions: cat.permissions },
      type: CATEGORY_TYPE,
      overwrites: cat.permissions,
    });
  }
  for (const c of config.channels) {
    out.push({
      key: channelKey(null, c.name),
      parentKey: null,
      config: c,
      type: CHANNEL_TYPE[c.type],
      overwrites: c.permissions,
    });
  }
  for (const cat of config.categories) {
    for (const c of cat.channels) {
      out.push({
        key: channelKey(cat.name, c.name),
        parentKey: categoryKey(cat.name),
        config: c,
        type: CHANNEL_TYPE[c.type],
        overwrites: c.permissions ?? cat.permissions,
      });
    }
  }
  return out;
}

function overwriteMapFromConfig(
  list: OverwriteConfig[],
): Map<string, { allow: string; deny: string }> {
  const map = new Map<string, { allow: string; deny: string }>();
  for (const o of list) {
    const allow = toBits(o.allow);
    const deny = toBits(o.deny);
    if (allow !== "0" || deny !== "0") map.set(o.role, { allow, deny });
  }
  return map;
}

function describeOverwrites(map: Map<string, { allow: string; deny: string }>): string {
  if (map.size === 0) return "(none)";
  return [...map.entries()]
    .map(([target, { allow, deny }]) => {
      const parts = [...fromBits(allow).map((p) => `+${p}`), ...fromBits(deny).map((p) => `-${p}`)];
      return `${target}[${parts.join(" ")}]`;
    })
    .join(" ");
}

export function buildPlan(
  config: ServerConfig,
  snapshot: Snapshot,
  options: PlanOptions = {},
): Plan {
  const { guild } = snapshot;
  const issues: Issue[] = [];
  const ops: Op[] = [];
  const error = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });

  const everyone = snapshot.roles.find((r) => r.id === guild.id);
  const aboveBot = (id: string) =>
    isAtOrAboveBot(snapshot.roles, snapshot.bot.roleIds, guild.id, id);
  const botPerms = snapshot.roles
    .filter((r) => r.id === guild.id || snapshot.bot.roleIds.includes(r.id))
    .reduce((acc, r) => acc | BigInt(r.permissions), 0n);
  const botIsAdmin = hasBits(botPerms, toBits(["Administrator"]));

  // ---- Roles -------------------------------------------------------------------------------
  const roleIds: Record<string, string> = {};
  const usedRoles = new Set<string>();
  const editableRoles = sortRolesTopDown(
    snapshot.roles.filter(
      (r) => r.id !== guild.id && !r.managed && !snapshot.bot.roleIds.includes(r.id),
    ),
  );

  for (const role of config.roles) {
    const names = [role.name, ...(role.renamedFrom ?? [])];
    let live: LiveRole | undefined;
    for (const n of names) {
      const hits = editableRoles.filter((r) => r.name === n && !usedRoles.has(r.id));
      if (hits.length > 1) warn(`${hits.length} roles are named "${n}"; using the highest one.`);
      live = hits[0];
      if (live) break;
    }
    const desired: Required<RoleBody> = {
      name: role.name,
      colors: { primary_color: role.color ? Number.parseInt(role.color.slice(1), 16) : 0 },
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: toBits(role.permissions),
    };

    if (!botIsAdmin) {
      const missing = missingPermissions(botPerms, desired.permissions);
      if (missing.length > 0)
        error(
          `Role "${role.name}" grants ${missing.join(", ")}, which the bot doesn't have. Give the bot Administrator (re-invite with \`npm run invite\`) or remove them.`,
        );
    }

    if (!live) {
      ops.push({ kind: "role.create", name: role.name, body: desired });
      continue;
    }
    usedRoles.add(live.id);
    roleIds[role.name] = live.id;
    if (aboveBot(live.id))
      error(
        `Role "${live.name}" is above the bot's role, so the bot can't edit it. In Discord: Server Settings -> Roles, drag the bot's role to the top.`,
      );

    const changes: Change[] = [];
    const body: RoleBody = {};
    if (live.name !== desired.name) {
      changes.push({ field: "name", from: quote(live.name), to: quote(desired.name) });
      body.name = desired.name;
    }
    if (live.color !== desired.colors.primary_color) {
      changes.push({
        field: "color",
        from: hex(live.color),
        to: hex(desired.colors.primary_color),
      });
      body.colors = desired.colors;
    }
    if (live.hoist !== desired.hoist) {
      changes.push({ field: "hoist", from: String(live.hoist), to: String(desired.hoist) });
      body.hoist = desired.hoist;
    }
    if (live.mentionable !== desired.mentionable) {
      changes.push({
        field: "mentionable",
        from: String(live.mentionable),
        to: String(desired.mentionable),
      });
      body.mentionable = desired.mentionable;
    }
    if (live.permissions !== desired.permissions) {
      changes.push({
        field: "permissions",
        from: "",
        to: describePermissionDiff(live.permissions, desired.permissions),
      });
      body.permissions = desired.permissions;
    }
    if (changes.length > 0)
      ops.push({ kind: "role.update", id: live.id, name: role.name, changes, body });
  }

  if (config.everyone && everyone) {
    const permissions = toBits(config.everyone.permissions);
    if (everyone.permissions !== permissions)
      ops.push({
        kind: "everyone.update",
        permissions,
        changes: [
          {
            field: "permissions",
            from: "",
            to: describePermissionDiff(everyone.permissions, permissions),
          },
        ],
      });
  }

  // Other bots' roles: never edited, only referenced from channel permissions.
  for (const name of config.otherBots) {
    const hits = snapshot.roles.filter((r) => r.managed && r.name === name);
    if (hits.length === 0)
      error(
        `No bot role named "${name}" (otherBots). Add that bot to the server first; Discord gives it a role with its name.`,
      );
    else if (hits.length > 1)
      warn(`${hits.length} bot roles are named "${name}"; using the highest.`);
    const hit = sortRolesTopDown(hits)[0];
    if (hit) roleIds[name] = hit.id;
  }

  // Discord puts new roles at an arbitrary low position, so creating any role means re-checking
  // the order at apply time (a no-op if it already matches).
  const creatingRoles = config.roles.some((r) => !roleIds[r.name]);
  const managedRoleIdsInOrder = config.roles.flatMap((r) => roleIds[r.name] ?? []);
  if (
    creatingRoles ||
    planRolePositions(snapshot.roles, snapshot.bot.roleIds, guild.id, managedRoleIdsInOrder)
  )
    ops.push({ kind: "roles.reorder" });

  // ---- Channels ----------------------------------------------------------------------------
  const desired = desiredChannels(config);
  const channelIds: Record<string, string> = {};
  const usedChannels = new Set<string>();
  const managedRoleNameById = new Map<string, string>([[guild.id, EVERYONE]]);
  for (const [name, id] of Object.entries(roleIds)) managedRoleNameById.set(id, name);
  const isCommunity = guild.features.includes("COMMUNITY");

  for (const want of desired) {
    const names = [
      want.config.name,
      ...("renamedFrom" in want.config ? (want.config.renamedFrom ?? []) : []),
    ];
    const wantParentId = want.parentKey ? channelIds[want.parentKey] : null;
    const sameType = snapshot.channels.filter(
      (c) => c.type === want.type && !usedChannels.has(c.id),
    );
    let live: LiveChannel | undefined;
    for (const n of names) {
      const hits = sameType.filter((c) => c.name === n);
      live = hits.find((c) => c.parentId === (wantParentId ?? null)) ?? hits[0];
      if (live) break;
    }

    const kind = want.config.type;
    if (kind === "announcement" || kind === "stage") {
      if (!isCommunity)
        error(
          `#${want.config.name} is a ${kind} channel, which needs a Community server. In Discord: Server Settings -> Enable Community, or change its type.`,
        );
    }
    if (!live) {
      const clash = snapshot.channels.find(
        (c) => c.name === want.config.name && c.type !== want.type && !usedChannels.has(c.id),
      );
      if (clash)
        warn(
          `${channelLabel(clash.name, clash.type)} already exists with a different type; a new ${label(want.type)} channel will be created next to it.`,
        );
    }

    // Body with every managed field at its desired value.
    const full: ChannelBody & { name: string; type: number } = {
      name: want.config.name,
      type: want.type,
    };
    if (want.config.type !== "category") {
      const c = want.config;
      full.nsfw = c.nsfw;
      if (isTextLike(c.type)) full.topic = c.topic ?? "";
      if (c.type !== "announcement") full.rate_limit_per_user = c.slowmode;
      if (c.type === "voice") full.user_limit = c.userLimit;
      if ((c.type === "voice" || c.type === "stage") && c.bitrate !== undefined)
        full.bitrate = c.bitrate;
    }

    let overwrites: OverwritePlan | undefined;
    let overwritesChange: Change | undefined;
    if (want.overwrites) {
      const desiredMap = overwriteMapFromConfig(want.overwrites);
      const preserved: LiveOverwrite[] = [];
      const liveMap = new Map<string, { allow: string; deny: string }>();
      for (const o of live?.overwrites ?? []) {
        const name = o.type === 0 ? managedRoleNameById.get(o.id) : undefined;
        if (name === undefined) preserved.push(o);
        else if (o.allow !== "0" || o.deny !== "0")
          liveMap.set(name, { allow: o.allow, deny: o.deny });
      }
      overwrites = {
        managed: [...desiredMap.entries()].map(([target, v]) => ({ target, ...v })),
        preserved,
      };
      const same =
        live !== undefined &&
        liveMap.size === desiredMap.size &&
        [...desiredMap].every(([k, v]) => {
          const l = liveMap.get(k);
          return l?.allow === v.allow && l.deny === v.deny;
        });
      if (!same && live)
        overwritesChange = {
          field: "permissions",
          from: describeOverwrites(liveMap),
          to: describeOverwrites(desiredMap),
        };
      if (same) overwrites = undefined;
    }

    if (!live) {
      ops.push({
        kind: "channel.create",
        key: want.key,
        name: want.config.name,
        type: want.type,
        parentKey: want.parentKey,
        body: full,
        ...(overwrites ? { overwrites } : {}),
      });
      continue;
    }

    usedChannels.add(live.id);
    channelIds[want.key] = live.id;
    const changes: Change[] = [];
    const body: ChannelBody = {};
    if (live.name !== full.name) {
      changes.push({ field: "name", from: quote(live.name), to: quote(full.name) });
      body.name = full.name;
    }
    if (full.topic !== undefined && (live.topic ?? "") !== full.topic) {
      changes.push({ field: "topic", from: quote(live.topic), to: quote(full.topic) });
      body.topic = full.topic;
    }
    if (full.nsfw !== undefined && live.nsfw !== full.nsfw) {
      changes.push({ field: "nsfw", from: String(live.nsfw), to: String(full.nsfw) });
      body.nsfw = full.nsfw;
    }
    if (
      full.rate_limit_per_user !== undefined &&
      live.rateLimitPerUser !== full.rate_limit_per_user
    ) {
      changes.push({
        field: "slowmode",
        from: `${live.rateLimitPerUser}s`,
        to: `${full.rate_limit_per_user}s`,
      });
      body.rate_limit_per_user = full.rate_limit_per_user;
    }
    if (full.user_limit !== undefined && (live.userLimit ?? 0) !== full.user_limit) {
      changes.push({
        field: "userLimit",
        from: String(live.userLimit ?? 0),
        to: String(full.user_limit),
      });
      body.user_limit = full.user_limit;
    }
    if (full.bitrate !== undefined && live.bitrate !== full.bitrate) {
      changes.push({ field: "bitrate", from: String(live.bitrate), to: String(full.bitrate) });
      body.bitrate = full.bitrate;
    }
    let parentKey: string | null | undefined;
    const wantsParent = want.parentKey !== null;
    const parentChanged = wantsParent
      ? live.parentId === null || live.parentId !== wantParentId
      : live.parentId !== null;
    if (want.type !== CATEGORY_TYPE && parentChanged) {
      const fromParent = snapshot.channels.find((c) => c.id === live.parentId)?.name;
      changes.push({
        field: "category",
        from: quote(fromParent),
        to: quote(want.parentKey?.slice("category:".length)),
      });
      parentKey = want.parentKey;
    }
    if (overwritesChange) changes.push(overwritesChange);
    if (changes.length > 0)
      ops.push({
        kind: "channel.update",
        key: want.key,
        id: live.id,
        name: full.name,
        type: want.type,
        changes,
        body,
        ...(parentKey !== undefined ? { parentKey } : {}),
        ...(overwrites ? { overwrites } : {}),
      });
  }

  // Ordering: simulate creates/moves, then see whether any sibling group is out of order.
  const channelOrder: Record<string, string[]> = { [CATEGORIES_GROUP]: [], [TOP_LEVEL_GROUP]: [] };
  for (const want of desired) {
    const group =
      want.type === CATEGORY_TYPE ? CATEGORIES_GROUP : (want.parentKey ?? TOP_LEVEL_GROUP);
    channelOrder[group] ??= [];
    channelOrder[group].push(want.key);
  }
  const simId = (key: string) => channelIds[key] ?? `new:${key}`;
  for (const [group, keys] of Object.entries(channelOrder)) {
    const parentId = group === CATEGORIES_GROUP || group === TOP_LEVEL_GROUP ? null : simId(group);
    const managedIds = keys.map(simId);
    const managedSet = new Set(managedIds);
    const members = snapshot.channels
      .filter((c) =>
        group === CATEGORIES_GROUP
          ? c.type === CATEGORY_TYPE
          : c.type !== CATEGORY_TYPE &&
            (managedSet.has(c.id) ||
              (!Object.values(channelIds).includes(c.id) && c.parentId === parentId)),
      )
      .map((c) => ({ id: c.id, type: c.type, position: c.position }));
    // New or moved channels land wherever Discord puts them, so re-check order at apply time.
    const arriving = keys.some((key) => {
      const id = channelIds[key];
      if (!id) return true;
      if (group === CATEGORIES_GROUP) return false;
      return (snapshot.channels.find((c) => c.id === id)?.parentId ?? null) !== parentId;
    });
    if (arriving || planChannelPositions(members, managedIds))
      ops.push({
        kind: "channels.reorder",
        group,
        label:
          group === CATEGORIES_GROUP
            ? "categories"
            : group === TOP_LEVEL_GROUP
              ? "channels outside categories"
              : `channels in "${group.slice("category:".length)}"`,
      });
  }

  // ---- Server settings ---------------------------------------------------------------------
  const guildChanges: Change[] = [];
  const guildBody: GuildBody = {};
  const channelRefs: Partial<Record<ChannelRefField, string | null>> = {};
  let iconPath: string | undefined;
  if (guild.name !== config.name) {
    guildChanges.push({ field: "name", from: quote(guild.name), to: quote(config.name) });
    guildBody.name = config.name;
  }
  if (config.description !== undefined) {
    const want = config.description || null;
    if ((guild.description || null) !== want) {
      guildChanges.push({ field: "description", from: quote(guild.description), to: quote(want) });
      guildBody.description = want;
    }
  }
  const s = config.settings;
  const enumSetting = <K extends string>(
    field: string,
    value: K | undefined,
    table: Record<K, number>,
    live: number,
    apply: (n: number) => void,
  ) => {
    if (value === undefined || table[value] === live) return;
    const from = Object.entries(table).find(([, v]) => v === live)?.[0] ?? String(live);
    guildChanges.push({ field, from, to: value });
    apply(table[value]);
  };
  enumSetting(
    "verificationLevel",
    s.verificationLevel,
    VERIFICATION_LEVEL,
    guild.verificationLevel,
    (n) => {
      guildBody.verification_level = n;
    },
  );
  enumSetting(
    "defaultNotifications",
    s.defaultNotifications,
    DEFAULT_NOTIFICATIONS,
    guild.defaultMessageNotifications,
    (n) => {
      guildBody.default_message_notifications = n;
    },
  );
  enumSetting(
    "explicitContentFilter",
    s.explicitContentFilter,
    CONTENT_FILTER,
    guild.explicitContentFilter,
    (n) => {
      guildBody.explicit_content_filter = n;
    },
  );
  if (s.afkTimeout !== undefined && s.afkTimeout !== guild.afkTimeout) {
    guildChanges.push({
      field: "afkTimeout",
      from: `${guild.afkTimeout}s`,
      to: `${s.afkTimeout}s`,
    });
    guildBody.afk_timeout = s.afkTimeout;
  }
  if (s.boostProgressBar !== undefined && s.boostProgressBar !== guild.premiumProgressBarEnabled) {
    guildChanges.push({
      field: "boostProgressBar",
      from: String(guild.premiumProgressBarEnabled),
      to: String(s.boostProgressBar),
    });
    guildBody.premium_progress_bar_enabled = s.boostProgressBar;
  }

  const keyForChannelName = (name: string, voice: boolean): string | undefined =>
    desired.find(
      (d) =>
        d.type !== CATEGORY_TYPE &&
        (channelClass(d.type) === "voice") === voice &&
        d.config.name === normalizeChannelName(voice ? "voice" : "text", name),
    )?.key;
  const channelRef = (
    field: ChannelRefField,
    label: string,
    value: string | null | undefined,
    liveId: string | null,
    voice: boolean,
  ) => {
    if (value === undefined) return;
    const key = value === null ? null : keyForChannelName(value, voice);
    if (key === undefined) return;
    const wantId = key === null ? null : (channelIds[key] ?? `new:${key}`);
    if (wantId === liveId) return;
    const liveName = snapshot.channels.find((c) => c.id === liveId)?.name;
    guildChanges.push({
      field: label,
      from: liveName ? `#${liveName}` : "(none)",
      to: value ? `#${value}` : "(none)",
    });
    channelRefs[field] = key;
  };
  channelRef("system_channel_id", "systemChannel", s.systemChannel, guild.systemChannelId, false);
  channelRef("rules_channel_id", "rulesChannel", s.rulesChannel, guild.rulesChannelId, false);
  channelRef("afk_channel_id", "afkChannel", s.afkChannel, guild.afkChannelId, true);
  if (s.rulesChannel && !isCommunity)
    error(
      "settings.rulesChannel only works on Community servers (Server Settings -> Enable Community).",
    );

  if (config.icon) {
    const abs = resolve(options.rootDir ?? process.cwd(), config.icon);
    if (!existsSync(abs)) error(`Icon file not found: ${config.icon}`);
    else if (!guild.icon || options.updateIcon) {
      guildChanges.push({
        field: "icon",
        from: guild.icon ? "(current icon)" : "(none)",
        to: config.icon,
      });
      iconPath = abs;
    }
  }
  if (guildChanges.length > 0)
    ops.push({
      kind: "guild.update",
      changes: guildChanges,
      body: guildBody,
      channelRefs,
      ...(iconPath ? { iconPath } : {}),
    });

  // ---- Unmanaged / prune ---------------------------------------------------------------------
  const unmanagedRoles = editableRoles
    .filter((r) => !usedRoles.has(r.id))
    .map((r) => ({ id: r.id, name: r.name, position: r.position }));
  const unmanagedChannels = snapshot.channels.filter((c) => !usedChannels.has(c.id));
  const pickTargets = <T extends { name: string }>(
    pool: T[],
    all: T[],
    names: string[] | undefined,
    what: string,
  ): T[] => {
    if (options.prune) return pool;
    const picked: T[] = [];
    for (const name of names ?? []) {
      const hits = pool.filter(
        (x) => x.name === name || x.name === normalizeChannelName("text", name),
      );
      if (hits.length > 0) picked.push(...hits);
      else if (all.some((x) => x.name === name))
        error(
          `${what} "${name}" is still in server.config.ts; remove it there before deleting it.`,
        );
      else error(`There is no ${what} named "${name}" in Discord.`);
    }
    return [...new Set(picked)];
  };
  const channelsToDelete = pickTargets(
    unmanagedChannels,
    snapshot.channels,
    options.deleteChannels,
    "channel",
  );
  const rolesToDelete = pickTargets(unmanagedRoles, editableRoles, options.deleteRoles, "role");
  {
    const byCategoryLast = [...channelsToDelete].sort(
      (a, b) => Number(a.type === CATEGORY_TYPE) - Number(b.type === CATEGORY_TYPE),
    );
    for (const c of byCategoryLast)
      ops.push({ kind: "channel.delete", id: c.id, name: c.name, type: c.type });
    for (const r of rolesToDelete) {
      if (aboveBot(r.id)) {
        warn(`Role "${r.name}" is above the bot's role, so it can't be deleted; skipping.`);
        continue;
      }
      ops.push({ kind: "role.delete", id: r.id, name: r.name });
    }
  }

  // ---- Bot permission checks -------------------------------------------------------------------
  if (!botIsAdmin) {
    const needs: [string, PermissionName][] = [];
    if (ops.some((o) => o.kind.startsWith("role") || o.kind === "everyone.update"))
      needs.push(["roles", "ManageRoles"]);
    if (ops.some((o) => o.kind.startsWith("channel"))) needs.push(["channels", "ManageChannels"]);
    if (ops.some((o) => o.kind === "guild.update")) needs.push(["server settings", "ManageGuild"]);
    for (const [what, perm] of needs)
      if (!hasBits(botPerms, toBits([perm])))
        error(
          `The bot needs the ${perm} permission to change ${what}. Re-invite it with \`npm run invite\`.`,
        );
  }

  return {
    guildId: guild.id,
    guildName: guild.name,
    ops,
    roleIds,
    channelIds,
    roleOrder: config.roles.map((r) => r.name),
    channelOrder,
    unmanaged: {
      roles: unmanagedRoles.map(({ id, name }) => ({ id, name })),
      channels: unmanagedChannels,
    },
    issues,
  };
}

export function countOps(plan: Plan): {
  create: number;
  update: number;
  reorder: number;
  delete: number;
} {
  const count = { create: 0, update: 0, reorder: 0, delete: 0 };
  for (const op of plan.ops) {
    if (op.kind.endsWith(".create")) count.create++;
    else if (op.kind.endsWith(".delete")) count.delete++;
    else if (op.kind.endsWith(".reorder")) count.reorder++;
    else count.update++;
  }
  return count;
}

export function hasErrors(plan: Plan): boolean {
  return plan.issues.some((i) => i.level === "error");
}
