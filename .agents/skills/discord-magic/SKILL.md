---
name: discord-magic
description: Main playbook for this Discord Magic project. Use for ANY request about the user's Discord server or bot - first-time setup, going live, building or restyling the server (channels, roles, names, descriptions, welcome, permissions), adding other bots, automations, commands, or "how do I...". Covers what to do yourself, what only the user can do, and how to talk to them.
---

# Discord Magic

The user owns a Discord server and wants it to look and work great. They are not a developer.
You do the work; they make decisions and click the few things only they can click.

## How to talk to the user

- **Lead with the outcome** in one plain sentence: "Done: #memes is live in Community." No jargon
  (say "channel settings", not "permission overwrites"; "online 24/7", not "deployed").
- **Do everything you safely can yourself.** Only hand a step to the user when it physically
  needs their browser, Discord account, or a decision. Never ask them to run commands you can run.
- **When the user must act**, give a numbered list, one action per line, with the exact button
  names in **bold** and the direct link. Max ~5 steps. End with "Tell me when that's done." Example:

  > I need you to do 2 quick things in Discord:
  > 1. Open **Server Settings → Roles**.
  > 2. Drag **Tester** (your bot) to the very top, then click **Save Changes**.
  >
  > Tell me when that's done.

- **Before changing their server**, show a short preview in plain words (from `server:plan`),
  e.g. "This will: add 3 channels to Community, rename #general to #lounge, give Members access to
  #showcase." Get a yes, then apply. For tiny, clearly-requested changes the request is the yes.
- **Ask with choices, not open questions.** Offer 2-4 options with your recommendation first.
  Fill in sensible defaults instead of asking about every detail.
- **After doing it**, say what changed and what they'll see in Discord. Offer one obvious next step
  at most.
- Never paste tokens or secrets back, never show stack traces; translate errors into what to do.

## What only the user can do

Everything else is yours. These need the user (give them the steps above):

| Thing | Steps to give |
|---|---|
| Create the Discord application / get the token | https://discord.com/developers/applications → **New Application** → **Bot** → **Reset Token** → copy. Ask them to paste it to you or into `.env`. |
| Turn on a privileged intent | https://discord.com/developers/applications/<app id>/bot → **Privileged Gateway Intents** → toggle → **Save Changes**. `npm run doctor` prints the exact link and toggle name. |
| Get the server ID | Discord **User Settings → Advanced → Developer Mode** on; right-click the server icon → **Copy Server ID**. |
| Invite this bot | Run `npm run invite` and give them the link → they pick nothing and click **Authorize**. |
| Invite another bot (MEE6, Carl-bot, etc.) | Give them that bot's official site; they click **Add to Discord**, choose the server, **Authorize**. Then you add it to `otherBots`. |
| Move the bot's role above others | **Server Settings → Roles** → drag the bot's role to the top. |
| Turn on Community (needed for announcement/stage channels, rules channel, server discovery) | **Server Settings → Enable Community → Get Started**, follow the 3 screens. |
| Log in to Railway | You run `railway login`; they approve in the browser that opens. |
| Pay for Railway / pick a workspace | Their call; ask before the first deploy. |
| Upload a server icon/banner image | Ask them to drop the image file into the project (e.g. `assets/icon.png`); you wire it up. |

## Map of the project

| To change... | Edit | Then run |
|---|---|---|
| Server name, description, icon, settings, roles, categories, channels, who-sees-what | `server.config.ts` (`docs/server-config.md` lists every field) | `npm run server:plan` → explain → `npm run server:apply` |
| Welcome card, auto-role, brand colour | `bot:` in `server.config.ts` | `npm run check`, then redeploy (`npm run deploy`) |
| Automations (do X when Y happens / every N minutes) | `src/bot/features/<name>.ts` + register in `src/bot/features/index.ts` | `npm run check`, test with `npm run dev`, then `npm run deploy` |
| Slash commands (`/something`) | `src/bot/commands/<name>.ts` + register in `src/bot/commands/index.ts` | same as above |
| Bot message look | Use `card()` from `src/bot/ui.ts` (see Styling) | |
| Hosting settings | `.railway/railway.ts` | `npm run deploy` |

Changes to `server.config.ts` structure apply instantly with `server:apply`; code changes (features,
commands, `bot:` settings) only go live after `npm run deploy` (or locally with `npm run dev`).

Detailed playbooks: `discord-setup` (setup, troubleshooting, Railway), `discord-server` (config
workflow, deleting, renaming), `discord-bot-feature` (commands and code). Read them when you go
deep into one area.

## Recipes

### First-time setup / "help me get started"
Run `npm run doctor` and work through each FAIL using the `discord-setup` skill. Ask only for the
user-only steps above. Finish with the bot live on Railway and a quick tour: "Type /help in your
server."

### "Fill out my server" / "make it look good"
1. Ask what the server is for (offer: community, creator/fan server, gaming group, study/work team,
   support for a product) and the vibe (clean/minimal, playful, professional). Default:
   community + clean.
2. Draft a full layout in `server.config.ts`. Good defaults:
   - **Start Here**: `welcome`, `rules`, `announcements`, `roles` or `faq`
   - **Community**: `general`, `introductions`, `showcase`, `off-topic`, a `help` forum
   - **Voice**: `Lounge`, plus 1-2 themed rooms
   - **Staff** (hidden): `mod-chat`, `mod-log`
   - Roles: Admin, Moderator, a member role, optional fun/flair roles. Use a cohesive palette
     (e.g. one hue family plus one accent), `hoist: true` only for staff.
3. Style names consistently. Clean: lowercase-dashed (`off-topic`). Emoji style is fine if the
   user wants it: put the emoji at the start with a separator, same pattern everywhere
   (`👋・welcome`, `📢・announcements`). Category names in Title Case or small caps, consistently.
4. Every text channel gets a one-line `topic` that tells people what goes there.
5. Read-only info channels: `@everyone` deny `SendMessages`; staff channels hidden from
   `@everyone`.
6. Set `bot.brandColor` to match the server's look and write a warm welcome card.
7. Plan → explain in 4-6 bullets → apply → `npm run deploy` if `bot:` changed.

### Rename / re-describe / restyle something
Change `name`/`topic`/`color` and add `renamedFrom: "old name"` for renames so history and members
are kept. Plan → apply.

### Welcome new members
`bot.welcome` (`channel`, `title`, `message` with `{user}`, `{server}`, `{memberCount}`,
`{#channel}`) and `bot.autoRole`. Needs the **Server Members Intent** (user-only step). Redeploy.

### Members
The bot doesn't manage individual members through the config. For "give everyone role X" or
"remove inactive members", write a one-off script or a slash command for moderators; confirm
before anything that kicks/bans/removes roles in bulk, show the count first.

### Add another bot (music, moderation, levels, tickets...)
1. Recommend a well-known bot that fits (or offer to build the feature into this bot instead:
   no extra bot, full control, matches the brand).
2. Give the user the invite steps (table above).
3. Add its role name (what Discord shows in **Server Settings → Roles**, usually the bot's
   name) to `otherBots` in `server.config.ts`, and grant it channel access where needed, e.g.
   `{ role: "MEE6", allow: ["ViewChannel", "SendMessages"] }` in a hidden channel.
4. Plan → apply. Configure that bot itself on its own dashboard (give the user the link).

### Automations ("when someone X, do Y", "every Monday post Z")
Build a feature in `src/bot/features/` (see "Writing an automation" below). Common ones:
- Reaction/button role picker (members choose roles by clicking buttons)
- Scheduled announcements or reminders
- Logging joins/leaves/deleted messages to `mod-log`
- Starboard, level/XP, ticket/support threads, auto-thread in a channel, polls
- Keyword auto-replies (needs the Message Content intent; prefer slash commands where possible)

Ask for missing specifics with choices (which channel, what text, how often), confirm, build,
`npm run check`, try it locally with `npm run dev` (ask the user to test it in Discord), stop the
local bot, `npm run deploy`.

If the feature needs to remember things across restarts (XP, ticket counters, scheduled
items), say so: Railway containers lose files on redeploy, so it needs a database (add a Railway
Postgres in `.railway/railway.ts`) and the `durable` approach to migrations/backups. Ask before
adding one; it adds cost.

## Writing an automation

```ts
// src/bot/features/goodbye.ts
import { Events, GatewayIntentBits } from "discord.js";
import { brandColor, card, cardMessage } from "../ui.ts";
import type { Feature } from "./types.ts";

export const goodbye: Feature = {
  name: "goodbye",
  intents: [GatewayIntentBits.GuildMembers],
  setup(client, { config, logger, guildId }) {
    client.on(Events.GuildMemberRemove, async (member) => {
      if (member.guild.id !== guildId) return;
      try {
        const log = member.guild.channels.cache.find((c) => c.name === "mod-log");
        if (!log?.isSendable()) return;
        await log.send(
          cardMessage(card({ accent: brandColor(config), body: `**${member.user.username}** left.` })),
        );
      } catch (err) {
        logger.error({ err }, "goodbye failed");
      }
    });
  },
};
```

Then add it to the list in `src/bot/features/index.ts`. Rules:
- Ignore events from other servers (`guildId` check). Catch errors and log them; one failing
  feature must never crash the bot.
- Declare the `intents` you need. Privileged ones (Server Members, Message Content, Presence)
  also need the user to flip the toggle; `npm run doctor` tells them which.
- Find channels/roles by the names in `server.config.ts`, not hard-coded IDs.
- Buttons and menus: give `customId`s the feature's prefix (`"roles:pick"`) and handle them in the
  same feature with `client.on(Events.InteractionCreate, ...)`.
- Timers: `setInterval` inside `setup`, guarded so they don't run before `ClientReady`.
- Pure logic (formatting, picking, scheduling maths) goes in exported functions with a test next to
  the file.
- Settings the user may want to tweak (channel, text, schedule) go in `server.config.ts` under `bot:`
  (add them to the Zod schema in `src/server/schema.ts` and to `docs/server-config.md`).

## Styling bot messages (modern Discord look)

Always build messages with `card()` from `src/bot/ui.ts`, never plain text or old-style embeds.
It renders a Components V2 container: accent bar, heading, body, optional thumbnail, fields,
image, buttons, muted footer.

```ts
await channel.send(
  cardMessage(
    card({
      accent: brandColor(config),
      title: "Weekly challenge",
      body: "Build something with **only 3 colours**.\nPost it in <#123> by Friday.",
      fields: [{ name: "Prize", value: "Showcase role" }],
      footer: "Resets every Monday",
      buttons: [new ButtonBuilder().setCustomId("challenge:join").setLabel("I'm in").setStyle(ButtonStyle.Primary)],
    }),
  ),
);
// Command replies: interaction.reply(cardReply(card({...}), { ephemeral: true }))
```

Style rules:
- **One accent colour** (`brandColor(config)`) for normal messages; `palette.green/yellow/red` only
  for success/warning/error states.
- **Short and scannable**: a heading of 2-6 words, 1-3 short lines of body, bold only the key bit.
  No walls of text, no ALL CAPS, at most one emoji per heading.
- Use Discord markdown: `## Heading`, `**bold**`, `-# small print`, `> quote`, `<#channelId>`,
  `<@userId>`, `<t:UNIX:R>` for live relative times ("in 2 hours").
- **Buttons**: label = verb + outcome ("Get role", "Open ticket"), max ~25 characters, one
  `Primary` per row, `Secondary` for the rest, `Link` style for URLs. Max 5 per row.
- **Private feedback** ("Done", errors, settings) uses ephemeral replies so the channel stays clean.
- Never ping `@everyone`/roles from bot messages unless the user asked; `cardMessage` only pings the
  users you pass it.
- Limits: 40 components per message; text and buttons only live inside components when using
  cards (no `content`/`embeds` on the same message).

## Always

- `npm run check` after code changes; fix everything it reports.
- Never delete channels/roles, kick/ban, or bulk-change members without the user approving the exact
  list. Deleted channels lose their messages forever.
- Never print, log or commit the bot token. `.env` is the only place it lives locally.
- Two running copies of the bot answer everything twice: stop `npm run dev` before `npm run deploy`.
- Keep the docs true: if you add a config field, command or feature, update `docs/server-config.md`,
  `/help` text, and this skill's tables if they change.
