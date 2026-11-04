export interface LiveRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
  position: number;
  /** Owned by an integration (bot role, booster role). Discord won't let us edit these. */
  managed: boolean;
}

export interface LiveOverwrite {
  id: string;
  /** 0 = role, 1 = member */
  type: 0 | 1;
  allow: string;
  deny: string;
}

export interface LiveChannel {
  id: string;
  name: string;
  type: number;
  parentId: string | null;
  position: number;
  topic: string | null;
  nsfw: boolean;
  rateLimitPerUser: number;
  bitrate: number | null;
  userLimit: number | null;
  overwrites: LiveOverwrite[];
}

export interface LiveGuild {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  ownerId: string;
  features: string[];
  verificationLevel: number;
  defaultMessageNotifications: number;
  explicitContentFilter: number;
  systemChannelId: string | null;
  rulesChannelId: string | null;
  afkChannelId: string | null;
  afkTimeout: number;
  premiumProgressBarEnabled: boolean;
}

export interface Snapshot {
  takenAt: string;
  guild: LiveGuild;
  roles: LiveRole[];
  channels: LiveChannel[];
  bot: { userId: string; roleIds: string[] };
}

export interface OverwriteBody {
  id: string;
  type: 0 | 1;
  allow: string;
  deny: string;
}

export interface RoleBody {
  name?: string;
  colors?: { primary_color: number };
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string;
}

export interface ChannelBody {
  name?: string;
  type?: number;
  topic?: string;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  user_limit?: number;
  bitrate?: number;
  parent_id?: string | null;
  permission_overwrites?: OverwriteBody[];
}

export interface GuildBody {
  name?: string;
  description?: string | null;
  icon?: string;
  verification_level?: number;
  default_message_notifications?: number;
  explicit_content_filter?: number;
  system_channel_id?: string | null;
  rules_channel_id?: string | null;
  afk_channel_id?: string | null;
  afk_timeout?: number;
  premium_progress_bar_enabled?: boolean;
}

/** Everything server:apply needs from Discord. The REST version lives in src/discord/guild-api.ts. */
export interface GuildApi {
  fetchSnapshot(): Promise<Snapshot>;
  modifyGuild(body: GuildBody): Promise<void>;
  createRole(body: RoleBody): Promise<{ id: string }>;
  modifyRole(id: string, body: RoleBody): Promise<void>;
  setRolePositions(positions: { id: string; position: number }[]): Promise<void>;
  deleteRole(id: string): Promise<void>;
  createChannel(body: ChannelBody & { name: string; type: number }): Promise<{ id: string }>;
  modifyChannel(id: string, body: ChannelBody): Promise<void>;
  setChannelPositions(positions: { id: string; position: number }[]): Promise<void>;
  deleteChannel(id: string): Promise<void>;
}
