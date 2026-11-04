// Your Discord server, as code. Edit this file, then run `npm run server:plan` to preview and
// `npm run server:apply` to make Discord match. Full reference: docs/server-config.md
import { defineServer } from "./src/server/schema.ts";

export default defineServer({
  name: "Magic Community",
  description: "A friendly place to build things together.",
  // icon: "assets/icon.png",

  settings: {
    verificationLevel: "low",
    defaultNotifications: "only_mentions",
    explicitContentFilter: "all_members",
    systemChannel: "welcome",
  },

  // What every member can do by default. Discord's defaults minus @everyone pings,
  // emoji/sticker uploads and event creation.
  everyone: {
    permissions: [
      "ViewChannel",
      "CreateInstantInvite",
      "ChangeNickname",
      "SendMessages",
      "SendMessagesInThreads",
      "CreatePublicThreads",
      "CreatePrivateThreads",
      "ReadMessageHistory",
      "AddReactions",
      "EmbedLinks",
      "AttachFiles",
      "UseExternalEmojis",
      "UseExternalStickers",
      "SendVoiceMessages",
      "SendPolls",
      "UseApplicationCommands",
      "UseExternalApps",
      "UseEmbeddedActivities",
      "Connect",
      "Speak",
      "Stream",
      "UseVAD",
      "UseSoundboard",
      "UseExternalSounds",
      "RequestToSpeak",
      "SetVoiceChannelStatus",
    ],
  },

  // Highest first. These sit directly below the bot's own role.
  roles: [
    { name: "Admin", color: "#E74C3C", hoist: true, permissions: ["Administrator"] },
    {
      name: "Moderator",
      color: "#3498DB",
      hoist: true,
      mentionable: true,
      permissions: [
        "KickMembers",
        "BanMembers",
        "ModerateMembers",
        "ManageMessages",
        "ManageThreads",
        "ManageNicknames",
        "MuteMembers",
        "MoveMembers",
        "ViewAuditLog",
      ],
    },
    { name: "Member", color: "#2ECC71" },
  ],

  categories: [
    {
      name: "Information",
      // Read-only for members; moderators can post.
      permissions: [
        { role: "@everyone", deny: ["SendMessages", "CreatePublicThreads"] },
        { role: "Moderator", allow: ["SendMessages"] },
      ],
      channels: [
        { name: "welcome", topic: "New members land here. Say hi!" },
        { name: "rules", topic: "Be kind. Read before posting." },
        { name: "announcements", topic: "News and updates from the team." },
      ],
    },
    {
      name: "Community",
      channels: [
        { name: "general", topic: "Chat about anything." },
        { name: "introductions", topic: "Tell us who you are and what you're building." },
        { name: "showcase", topic: "Share what you've made.", slowmode: 30 },
        { name: "help", type: "forum", topic: "One post per question, please." },
      ],
    },
    {
      name: "Voice",
      channels: [
        { name: "Lounge", type: "voice" },
        { name: "Co-working", type: "voice", userLimit: 10 },
      ],
    },
    {
      name: "Staff",
      permissions: [
        { role: "@everyone", deny: ["ViewChannel"] },
        { role: "Moderator", allow: ["ViewChannel"] },
      ],
      channels: [{ name: "mod-chat" }, { name: "mod-log", topic: "Moderation and bot logs." }],
    },
  ],

  // Runtime behaviour of the bot (needs the Server Members intent, see AGENTS.md).
  bot: {
    // Accent colour on every bot message.
    brandColor: "#5865F2",
    welcome: {
      channel: "welcome",
      title: "Welcome to {server}",
      message: "Hey {user}, glad you're here! Have a read of {#rules}, then say hi in {#general}.",
    },
    autoRole: "Member",
  },
});
