import { isAtOrAboveBot, sortRolesTopDown } from "../order.ts";
import { normalizeChannelName } from "../schema.ts";
import type {
  ChannelBody,
  GuildApi,
  LiveChannel,
  LiveGuild,
  LiveRole,
  RoleBody,
  Snapshot,
} from "../types.ts";

export const GUILD_ID = "100000000000000000";
export const BOT_USER_ID = "100000000000000001";
export const BOT_ROLE_ID = "100000000000000002";
const ADMIN = (1n << 3n).toString();

/** In-memory stand-in for a Discord guild with the server-side behaviour that matters to sync. */
export class FakeGuild implements GuildApi {
  guild: LiveGuild;
  roles: LiveRole[];
  channels: LiveChannel[];
  botRoleIds: string[] = [BOT_ROLE_ID];
  calls: string[] = [];
  private nextId = 200000000000000000n;

  constructor(init?: { guild?: Partial<LiveGuild>; roles?: LiveRole[]; channels?: LiveChannel[] }) {
    this.guild = {
      id: GUILD_ID,
      name: "New Server",
      description: null,
      icon: null,
      ownerId: "1",
      features: [],
      verificationLevel: 0,
      defaultMessageNotifications: 0,
      explicitContentFilter: 0,
      systemChannelId: null,
      rulesChannelId: null,
      afkChannelId: null,
      afkTimeout: 300,
      premiumProgressBarEnabled: false,
      ...init?.guild,
    };
    this.roles = init?.roles ?? [
      this.role({ id: GUILD_ID, name: "@everyone", position: 0, permissions: "1024" }),
      this.role({
        id: BOT_ROLE_ID,
        name: "Magic Bot",
        position: 1,
        managed: true,
        permissions: ADMIN,
      }),
    ];
    this.channels = init?.channels ?? [];
  }

  id(): string {
    this.nextId += 1n;
    return this.nextId.toString();
  }

  role(partial: Partial<LiveRole> & { name: string }): LiveRole {
    return {
      id: this.id(),
      color: 0,
      hoist: false,
      mentionable: false,
      permissions: "0",
      position: 1,
      managed: false,
      ...partial,
    };
  }

  channel(partial: Partial<LiveChannel> & { name: string; type: number }): LiveChannel {
    return {
      id: this.id(),
      parentId: null,
      position: this.channels.length,
      topic: null,
      nsfw: false,
      rateLimitPerUser: 0,
      bitrate: partial.type === 2 ? 64000 : null,
      userLimit: partial.type === 2 ? 0 : null,
      overwrites: [],
      ...partial,
    };
  }

  private botTop(): number {
    return Math.max(
      ...this.roles.filter((r) => this.botRoleIds.includes(r.id)).map((r) => r.position),
    );
  }

  private editable(id: string): LiveRole {
    const role = this.roles.find((r) => r.id === id);
    if (!role) throw new Error("Unknown Role");
    if (isAtOrAboveBot(this.roles, this.botRoleIds, GUILD_ID, id))
      throw new Error("Missing Permissions");
    return role;
  }

  async fetchSnapshot(): Promise<Snapshot> {
    return structuredClone({
      takenAt: new Date().toISOString(),
      guild: this.guild,
      roles: this.roles,
      channels: this.channels,
      bot: { userId: BOT_USER_ID, roleIds: this.botRoleIds },
    });
  }

  async modifyGuild(body: Parameters<GuildApi["modifyGuild"]>[0]) {
    this.calls.push("modifyGuild");
    const g = this.guild;
    if (body.name !== undefined) g.name = body.name;
    if (body.description !== undefined) g.description = body.description;
    if (body.icon !== undefined) g.icon = "icon-hash";
    if (body.verification_level !== undefined) g.verificationLevel = body.verification_level;
    if (body.default_message_notifications !== undefined)
      g.defaultMessageNotifications = body.default_message_notifications;
    if (body.explicit_content_filter !== undefined)
      g.explicitContentFilter = body.explicit_content_filter;
    if (body.system_channel_id !== undefined) g.systemChannelId = body.system_channel_id;
    if (body.rules_channel_id !== undefined) g.rulesChannelId = body.rules_channel_id;
    if (body.afk_channel_id !== undefined) g.afkChannelId = body.afk_channel_id;
    if (body.afk_timeout !== undefined) g.afkTimeout = body.afk_timeout;
    if (body.premium_progress_bar_enabled !== undefined)
      g.premiumProgressBarEnabled = body.premium_progress_bar_enabled;
  }

  private patchRole(role: LiveRole, body: RoleBody) {
    if (body.name !== undefined) role.name = body.name;
    if (body.colors !== undefined) role.color = body.colors.primary_color;
    if (body.hoist !== undefined) role.hoist = body.hoist;
    if (body.mentionable !== undefined) role.mentionable = body.mentionable;
    if (body.permissions !== undefined) role.permissions = body.permissions;
  }

  async createRole(body: RoleBody) {
    this.calls.push("createRole");
    // Like Discord: new roles get position 1 without renumbering, so positions can repeat.
    const role = this.role({ name: body.name ?? "new role", position: 1 });
    this.patchRole(role, body);
    this.roles.push(role);
    return { id: role.id };
  }

  async modifyRole(id: string, body: RoleBody) {
    this.calls.push("modifyRole");
    this.patchRole(this.editable(id), body);
  }

  async setRolePositions(positions: { id: string; position: number }[]) {
    this.calls.push("setRolePositions");
    for (const p of positions) {
      const role = this.editable(p.id);
      if (p.position > this.botTop()) throw new Error("Missing Permissions");
      role.position = p.position;
    }
    // Like Discord: any position change renumbers every role 1..n in displayed order.
    const ranked = sortRolesTopDown(this.roles.filter((r) => r.id !== GUILD_ID));
    ranked.forEach((r, i) => {
      r.position = ranked.length - i;
    });
  }

  async deleteRole(id: string) {
    this.calls.push("deleteRole");
    this.editable(id);
    this.roles = this.roles.filter((r) => r.id !== id);
  }

  private patchChannel(c: LiveChannel, body: ChannelBody) {
    if (body.name !== undefined)
      c.name = [0, 5, 15].includes(c.type) ? normalizeChannelName("text", body.name) : body.name;
    if (body.topic !== undefined) c.topic = body.topic || null;
    if (body.nsfw !== undefined) c.nsfw = body.nsfw;
    if (body.rate_limit_per_user !== undefined) c.rateLimitPerUser = body.rate_limit_per_user;
    if (body.user_limit !== undefined) c.userLimit = body.user_limit;
    if (body.bitrate !== undefined) c.bitrate = body.bitrate;
    if (body.parent_id !== undefined) c.parentId = body.parent_id;
    if (body.permission_overwrites !== undefined) c.overwrites = body.permission_overwrites;
  }

  async createChannel(body: ChannelBody & { name: string; type: number }) {
    this.calls.push("createChannel");
    if (body.parent_id && !this.channels.some((c) => c.id === body.parent_id))
      throw new Error("Invalid parent");
    const c = this.channel({
      name: body.name,
      type: body.type,
      // Like Discord: forums arrive at position 0, others after the highest existing position.
      position: body.type === 15 ? 0 : Math.max(0, ...this.channels.map((x) => x.position)) + 1,
    });
    this.patchChannel(c, body);
    this.channels.push(c);
    return { id: c.id };
  }

  async modifyChannel(id: string, body: ChannelBody) {
    this.calls.push("modifyChannel");
    const c = this.channels.find((x) => x.id === id);
    if (!c) throw new Error("Unknown Channel");
    this.patchChannel(c, body);
  }

  async setChannelPositions(positions: { id: string; position: number }[]) {
    this.calls.push("setChannelPositions");
    for (const p of positions) {
      const c = this.channels.find((x) => x.id === p.id);
      if (!c) throw new Error("Unknown Channel");
      c.position = p.position;
    }
  }

  async deleteChannel(id: string) {
    this.calls.push("deleteChannel");
    this.channels = this.channels
      .filter((c) => c.id !== id)
      .map((c) => (c.parentId === id ? { ...c, parentId: null } : c));
  }
}

/** A brand-new server as Discord creates it, with the bot invited. */
export function freshServer(): FakeGuild {
  const g = new FakeGuild();
  const text = g.channel({ name: "Text Channels", type: 4, position: 0 });
  const voice = g.channel({ name: "Voice Channels", type: 4, position: 1 });
  g.channels = [
    text,
    voice,
    g.channel({ name: "general", type: 0, parentId: text.id, position: 0 }),
    g.channel({ name: "General", type: 2, parentId: voice.id, position: 0 }),
  ];
  g.guild.systemChannelId = g.channels[2]?.id ?? null;
  return g;
}
