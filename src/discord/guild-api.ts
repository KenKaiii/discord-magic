import {
  type APIGuild,
  type APIGuildMember,
  type APIRole,
  type APIUser,
  type REST,
  Routes,
} from "discord.js";
import type {
  ChannelBody,
  GuildApi,
  GuildBody,
  LiveChannel,
  LiveGuild,
  LiveRole,
  RoleBody,
  Snapshot,
} from "../server/types.ts";

const REASON = "server.config.ts sync";

interface RawChannel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  bitrate?: number;
  user_limit?: number;
  permission_overwrites?: { id: string; type: number; allow: string; deny: string }[];
}

export function toLiveGuild(g: APIGuild): LiveGuild {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    icon: g.icon,
    ownerId: g.owner_id,
    features: [...g.features],
    verificationLevel: g.verification_level,
    defaultMessageNotifications: g.default_message_notifications,
    explicitContentFilter: g.explicit_content_filter,
    systemChannelId: g.system_channel_id,
    rulesChannelId: g.rules_channel_id,
    afkChannelId: g.afk_channel_id,
    afkTimeout: g.afk_timeout,
    premiumProgressBarEnabled: g.premium_progress_bar_enabled,
  };
}

export function toLiveRole(r: APIRole): LiveRole {
  return {
    id: r.id,
    name: r.name,
    color: r.colors?.primary_color ?? r.color,
    hoist: r.hoist,
    mentionable: r.mentionable,
    permissions: r.permissions,
    position: r.position,
    managed: r.managed,
  };
}

export function toLiveChannel(c: RawChannel): LiveChannel {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    parentId: c.parent_id ?? null,
    position: c.position ?? 0,
    topic: c.topic ?? null,
    nsfw: c.nsfw ?? false,
    rateLimitPerUser: c.rate_limit_per_user ?? 0,
    bitrate: c.bitrate ?? null,
    userLimit: c.user_limit ?? null,
    overwrites: (c.permission_overwrites ?? []).map((o) => ({
      id: o.id,
      type: o.type === 1 ? 1 : 0,
      allow: o.allow,
      deny: o.deny,
    })),
  };
}

export function createGuildApi(rest: REST, guildId: string): GuildApi {
  return {
    async fetchSnapshot(): Promise<Snapshot> {
      const [guild, roles, channels, me] = await Promise.all([
        rest.get(Routes.guild(guildId)) as Promise<APIGuild>,
        rest.get(Routes.guildRoles(guildId)) as Promise<APIRole[]>,
        rest.get(Routes.guildChannels(guildId)) as Promise<RawChannel[]>,
        rest.get(Routes.user()) as Promise<APIUser>,
      ]);
      const member = (await rest.get(Routes.guildMember(guildId, me.id))) as APIGuildMember;
      return {
        takenAt: new Date().toISOString(),
        guild: toLiveGuild(guild),
        roles: roles.map(toLiveRole),
        channels: channels.map(toLiveChannel),
        bot: { userId: me.id, roleIds: member.roles },
      };
    },
    async modifyGuild(body: GuildBody) {
      await rest.patch(Routes.guild(guildId), { body, reason: REASON });
    },
    async createRole(body: RoleBody) {
      const role = (await rest.post(Routes.guildRoles(guildId), {
        body,
        reason: REASON,
      })) as APIRole;
      return { id: role.id };
    },
    async modifyRole(id: string, body: RoleBody) {
      await rest.patch(Routes.guildRole(guildId, id), { body, reason: REASON });
    },
    async setRolePositions(positions) {
      await rest.patch(Routes.guildRoles(guildId), { body: positions, reason: REASON });
    },
    async deleteRole(id: string) {
      await rest.delete(Routes.guildRole(guildId, id), { reason: REASON });
    },
    async createChannel(body: ChannelBody & { name: string; type: number }) {
      const channel = (await rest.post(Routes.guildChannels(guildId), {
        body,
        reason: REASON,
      })) as RawChannel;
      return { id: channel.id };
    },
    async modifyChannel(id: string, body: ChannelBody) {
      await rest.patch(Routes.channel(id), { body, reason: REASON });
    },
    async setChannelPositions(positions) {
      await rest.patch(Routes.guildChannels(guildId), { body: positions, reason: REASON });
    },
    async deleteChannel(id: string) {
      await rest.delete(Routes.channel(id), { reason: REASON });
    },
  };
}
