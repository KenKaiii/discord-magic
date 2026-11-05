// Your Discord server, as code. This is a starter: your agent tailors it to what your server is
// for. Preview with `npm run server:plan`, apply with `npm run server:apply`.
// Full reference: docs/server-config.md
import { defineServer } from "./src/server/schema.ts";

export default defineServer({
  name: "Magic Community",
  description: "A friendly place to build things together.",
  // icon: "assets/icon.png",

  settings: {
    verificationLevel: "low",
    defaultNotifications: "only_mentions",
    explicitContentFilter: "all_members",
    // Discord's own join/boost notices go to staff, so #welcome stays clean.
    systemChannel: "mod-log",
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
    // Pinned in #welcome and kept up to date: the one message every newcomer reads first.
    guide: {
      channel: "welcome",
      title: "Start here",
      message: [
        "Welcome to **{server}**! Here's where everything is:",
        "- {#rules}: read these first",
        "- {#announcements}: news from the team",
        "- {#introductions}: say hi and tell us what you're building",
        "- {#general}: chat about anything",
        "- {#showcase}: share what you've made",
        "- {#help}: ask a question, one post each",
      ].join("\n"),
    },
    // Greeting for each new member, kept out of #welcome so the guide never gets buried.
    welcome: {
      channel: "introductions",
      title: "Welcome to {server}",
      message:
        "Hey {user}, glad you're here! Tell us who you are and what you're building. The tour is in {#welcome}.",
    },
    autoRole: "Member",
  },
});
