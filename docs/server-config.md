# server.config.ts reference

`server.config.ts` describes your Discord server. `npm run server:plan` shows the difference
between this file and Discord; `npm run server:apply` makes Discord match it.

```ts
import { defineServer } from "./src/server/schema.ts";

export default defineServer({
  name: "My Server",
  roles: [{ name: "Member" }],
  categories: [{ name: "Chat", channels: [{ name: "general" }] }],
});
```

## How matching works

- Things are matched to Discord **by name**. Text channel names are stored lowercase with dashes
  (`"Off Topic"` becomes `off-topic`).
- To rename, change `name` and add `renamedFrom: "old name"` (a string or a list). Without it, a
  new item is created and the old one is left alone.
- Anything in Discord that isn't in the file is **left alone** and listed in the plan. Deleting is
  a separate, explicit step (`--delete-channel`, `--delete-role`, `--prune`, always with
  `--confirm-delete=<count>`).
- Order in the file is order in Discord: roles top to bottom (directly under the bot's role),
  categories top to bottom, channels top to bottom within their category. Discord always shows
  text channels above voice channels inside a category.

## Top level

| Field         | Type                            | Notes                                                                                                                      |
| ------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `name`        | string (2-100)                  | Server name. Required.                                                                                                     |
| `description` | string or `null`                | Omit to leave as is; `null` clears it. Shown on Community servers.                                                         |
| `icon`        | path                            | PNG/JPEG/GIF, ideally 1024x1024, relative to the repo root. Uploaded when the server has no icon, or with `--update-icon`. |
| `settings`    | object                          | See below. Each setting is only managed when present.                                                                      |
| `everyone`    | `{ permissions: Permission[] }` | Base permissions for all members. Omit to leave @everyone alone.                                                           |
| `roles`       | Role[]                          | Top (highest) first.                                                                                                       |
| `channels`    | Channel[]                       | Channels outside any category (shown above all categories).                                                                |
| `categories`  | Category[]                      | Top first.                                                                                                                 |
| `bot`         | object                          | Runtime behaviour of the bot. See below.                                                                                   |

## settings

| Field                   | Values                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `verificationLevel`     | `"none"`, `"low"` (verified email), `"medium"` (+5 min on Discord), `"high"` (+10 min in server), `"very_high"` (verified phone) |
| `defaultNotifications`  | `"all_messages"`, `"only_mentions"`                                                                                              |
| `explicitContentFilter` | `"disabled"`, `"members_without_roles"`, `"all_members"`                                                                         |
| `systemChannel`         | Text channel name for Discord's join/boost messages, or `null` for none                                                          |
| `rulesChannel`          | Text channel name (Community servers only)                                                                                       |
| `afkChannel`            | Voice channel name, or `null`                                                                                                    |
| `afkTimeout`            | `60`, `300`, `900`, `1800`, `3600` (seconds)                                                                                     |
| `boostProgressBar`      | `true` / `false`                                                                                                                 |

## Role

| Field         | Default  | Notes                                                                |
| ------------- | -------- | -------------------------------------------------------------------- |
| `name`        | required | Unique.                                                              |
| `color`       | none     | `"#RRGGBB"`.                                                         |
| `hoist`       | `false`  | Show members with this role separately in the member list.           |
| `mentionable` | `false`  | Anyone can @mention it.                                              |
| `permissions` | `[]`     | Exactly the server-wide permissions it grants (on top of @everyone). |
| `renamedFrom` |          | Old name(s).                                                         |

## otherBots

```ts
otherBots: ["MEE6", "Carl-bot"],
```

Role names of other bots in the server (Discord gives each bot a role named after it). Listing a bot
here lets channel/category `permissions` use it, e.g. `{ role: "MEE6", allow: ["ViewChannel"] }`.
These roles are never edited or reordered. Invite the bot first; the plan errors if its role is missing.

## Category

| Field         | Notes                                                                 |
| ------------- | --------------------------------------------------------------------- |
| `name`        | Unique.                                                               |
| `permissions` | Overwrite[]. Channels inside inherit these unless they set their own. |
| `channels`    | Channel[], top first.                                                 |
| `renamedFrom` | Old name(s).                                                          |

## Channel

| Field         | Default         | Applies to                | Notes                                                         |
| ------------- | --------------- | ------------------------- | ------------------------------------------------------------- |
| `name`        | required        | all                       | Unique within its category.                                   |
| `type`        | `"text"`        |                           | `"text"`, `"voice"`, `"forum"`, `"announcement"`\*, `"stage"`\* |
| `topic`       | `""`            | text, announcement, forum | For forums this is the post guidelines.                       |
| `nsfw`        | `false`         | all                       | Age-restricted.                                               |
| `slowmode`    | `0`             | all but announcement      | Seconds between messages per member (max 21600).              |
| `userLimit`   | `0`             | voice                     | 0 = unlimited, max 99.                                        |
| `bitrate`     | Discord default | voice, stage              | 8000-96000 normally; higher with boosts.                      |
| `permissions` | inherit         | all                       | Overwrite[]. See below.                                       |
| `renamedFrom` |                 | all                       | Old name(s).                                                  |

\* Needs a Community server (Server Settings -> Enable Community).

## Overwrite (channel/category permissions)

```ts
{ role: "@everyone", deny: ["ViewChannel"] }
{ role: "Moderator", allow: ["ViewChannel", "ManageMessages"] }
```

`role` is a role name from `roles` or `otherBots`, or `"@everyone"`. Anything not allowed or denied falls back to
the role's server-wide permissions. When a channel/category has `permissions`, the overwrites for
`@everyone` and config roles are set to exactly this list; overwrites for individual members and
for roles not in the config are kept.

Common recipes:

| Want                     | Overwrites                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Read-only, mods can post | `@everyone` deny `SendMessages`, `CreatePublicThreads`; `Moderator` allow `SendMessages` |
| Hidden except for a role | `@everyone` deny `ViewChannel`; `<Role>` allow `ViewChannel`                             |
| Voice: listen only       | `@everyone` deny `Speak`                                                                 |

## bot

| Field             | Notes                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `brandColor`      | `"#RRGGBB"` accent colour on every bot message card. Default Discord blurple.                                      |
| `guide.channel`   | Text channel for one pinned "start here" card. The bot posts and pins it on start, then edits it in place on every later start (no reposts). |
| `guide.title`     | Optional card heading. Placeholders: `{server}`, `{#channel-name}`.                                                |
| `guide.message`   | Up to 3500 chars. Placeholders: `{server}`, `{#channel-name}` (clickable channel link). One line per channel works well. |
| `welcome.channel` | Text channel name to post the welcome card in when someone joins. Use a different channel from `guide` so greetings don't bury it. |
| `welcome.title`   | Optional card heading, same placeholders as `message`.                                                             |
| `welcome.message` | Up to 2000 chars. Placeholders: `{user}` (mention), `{server}`, `{memberCount}`, `{#channel-name}` (channel link). |
| `autoRole`        | Role name given to every new (non-bot) member.                                                                     |

`welcome` and `autoRole` need the **Server Members Intent** (Developer Portal -> Bot -> Privileged
Gateway Intents); `guide` doesn't. The bot reads all of these at start-up, so restart/redeploy after
changing them. The guide needs the bot to be able to post and pin in its channel (Administrator
covers it; with `--minimal`, give the bot's role `SendMessages` there if the channel is read-only).

## Permission names

ViewChannel, SendMessages, SendMessagesInThreads, CreatePublicThreads, CreatePrivateThreads,
ReadMessageHistory, AddReactions, EmbedLinks, AttachFiles, UseExternalEmojis,
UseExternalStickers, UseExternalSounds, UseApplicationCommands, UseExternalApps, SendPolls,
SendVoiceMessages, SendTTSMessages, MentionEveryone, PinMessages, ManageMessages, ManageThreads,
ChangeNickname, ManageNicknames, CreateInstantInvite, Connect, Speak, Stream, UseVAD,
PrioritySpeaker, MuteMembers, DeafenMembers, MoveMembers, UseSoundboard, UseEmbeddedActivities,
RequestToSpeak, SetVoiceChannelStatus, KickMembers, BanMembers, ModerateMembers, ManageChannels,
ManageRoles, ManageWebhooks, ManageGuild, ManageGuildExpressions, CreateGuildExpressions,
ManageEvents, CreateEvents, ViewAuditLog, ViewGuildInsights, ViewCreatorMonetizationAnalytics,
BypassSlowmode, Administrator.
