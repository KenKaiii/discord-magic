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
| Get the bot token and server ID | Ask for both in one message (`discord-setup` steps 1-2), they paste them back to you, you write `.env`. |
| Get an API key or secret for a feature (YouTube, OpenAI, Stripe...) | Tell them exactly where (link + clicks) and to paste it back to you. You add it to `.env.example` (with that where-to-get-it note) and `.env`, then `npm run deploy` puts it on Railway. |
| Turn on a privileged intent | https://discord.com/developers/applications/<app id>/bot → **Privileged Gateway Intents** → toggle → **Save Changes**. `npm run doctor` prints the exact link and toggle name. |
| Get the server ID | Discord **User Settings → Advanced → Developer Mode** on; right-click the server icon → **Copy Server ID**. |
| Invite this bot | Run `npm run invite` and give them the link → they pick nothing and click **Authorize**. |
| Invite another bot (MEE6, Carl-bot, etc.) | In Discord (desktop or browser): **server name → Server Settings → App Directory** → search the bot → **Add App** → pick the server → **Authorize**. Or use the invite button on the bot's official site. Needs **Manage Server**. Then you add it to `otherBots`. |
| Move the bot's role above others | **Server Settings → Roles** → drag the bot's role to the top. |
| Turn on Community (needed for announcement/stage channels, the rules channel, onboarding, discovery) | **server name → Server Settings → Enable Community → Get Started**, follow the steps, then **Finish Setup**. Discord requires: verification level at least "low" (verified email), explicit content filter on all members, a rules channel and a community-updates channel. The starter config already sets the first two; pick #rules and #mod-log in the wizard. |
| Sign in to Railway (also creates the account) | You install the CLI if missing (`npm i -g @railway/cli`) and run `railway login`; they sign in and click **Authorize** in the browser page that opens. |
| Pay for Railway / pick a workspace | Their call; ask before the first deploy. |
| Sign in to GitHub (for auto-deploys) | You install `gh` if missing and run `gh auth login --web`; they enter the code shown in the browser. |
| Let Railway see their GitHub repo | Only if `npm run deploy -- --github` says it can't: https://github.com/apps/railway-app/installations/new → their account → **Only select repositories** → the repo → **Install**. |
| Upload a server icon/banner image | Ask them to drop the image file into the project (e.g. `assets/icon.png`); you wire it up. |

## Map of the project

| To change... | Edit | Then run |
|---|---|---|
| Server name, description, icon, settings, roles, categories, channels, who-sees-what | `server.config.ts` (`docs/server-config.md` lists every field) | `npm run server:plan` → explain → `npm run server:apply` |
| Pinned start-here guide, welcome card, auto-role, brand colour | `bot:` in `server.config.ts` | `npm run check`, then redeploy (`npm run deploy`) |
| Automations (do X when Y happens / every N minutes) | `src/bot/features/<name>.ts` + register in `src/bot/features/index.ts` | `npm run check`, test with `npm run dev`, then `npm run deploy` |
| Slash commands (`/something`) | `src/bot/commands/<name>.ts` + register in `src/bot/commands/index.ts` | same as above |
| Bot message look | Use `card()` from `src/bot/ui.ts` (see Styling) | |
| Hosting settings | `.railway/railway.ts` | `npm run deploy` |
| Put it online / auto-deploy on push | (nothing to edit) | `npm run deploy`, then `npm run deploy -- --github` (`discord-setup` step 7) |

Changes to `server.config.ts` structure apply instantly with `server:apply`. Code changes
(features, commands, `bot:` settings) go live on Railway with `git push` when GitHub auto-deploys are
on (`npm run doctor` says), otherwise with `npm run deploy`. Try them locally with `npm run dev`
first.

Detailed playbooks: `discord-setup` (setup, troubleshooting, Railway), `discord-server` (config
workflow, deleting, renaming), `discord-bot-feature` (commands and code). Read them when you go
deep into one area.

## Recipes

### First-time setup / "help me get started"
Run `npm run doctor` and work through each FAIL using the `discord-setup` skill. Ask only for the
user-only steps above. Once the bot is in their server, do "Get to know their server" (next)
before building anything, then put it online. Finish with: "Type /help in your server."

### Get to know their server (before building, and whenever you don't know what it's for)
Every server is different, and `server.config.ts` is only a starting point. Never apply the
starter layout as-is to a real server. Check **Project decisions** in `AGENTS.md` first; if the
purpose is already recorded there, don't ask again.

1. Ask a few quick questions (one `ask_user` call with choices, and allow typed answers, which
   many users prefer). Recommend a default for each:
   - **What's it for?** Community around a topic, creator/fan server, course or paid members,
     gaming group, study/work team, support for a product.
   - **Who's coming, and how many?** Friends (under 50), a growing community (hundreds), a big
     audience (thousands: more moderation and structure).
   - **The vibe:** clean and minimal, playful, professional.
   - **Must-haves** (multi-select): welcome and a start-here guide, events or live calls, posts
     from YouTube/blog/news, levels and ranks, support tickets, members-only areas, other bots
     (music, games).
2. Show what's possible in a short plain-words list, so they can pick ideas they hadn't thought
   of. Pick 4-6 that fit their answers, not the whole menu:
   - **Layout:** channels, categories, voice rooms, Q&A forums, private staff or members-only areas.
   - **Roles:** colours, who can do what, staff, flair roles members choose themselves.
   - **First impressions:** a pinned start-here guide, a welcome card for each new member, a role
     given automatically.
   - **Automations:** scheduled posts and event reminders in everyone's local time, auto-posting
     YouTube/blog/news, levels and ranks, polls, suggestions, support tickets, mod logs, opt-in pings.
   - **Other bots:** music, games, moderation (you set up their access; they click Add App).
   - **The bot's look:** its name, picture, brand colour and the style of its messages.
   - **Online 24/7** on Railway, updating itself whenever the project changes.
3. Propose a tailored layout in 4-8 bullets (categories, channels, roles, what the bot does).
   Rewrite `server.config.ts` for it: keep useful parts of the starter, drop what doesn't fit, and
   update the guide's channel list to match. Get a yes, then plan → apply.
4. Record the answers as one line in **Project decisions** (e.g. "Server: fitness coaching
   community, ~200 members, clean style, must-haves: events, levels"), so later sessions build in
   the same direction.
5. Build automations one at a time after the layout, each confirmed first. Offer the next idea
   at most once per reply; don't push.

### "Fill out my server" / "make it look good"
1. If you don't know what the server is for yet, do "Get to know their server" first. Default if
   they'd rather you choose: community + clean.
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
6. Keep the welcome split the starter config uses: #welcome holds only the pinned guide
   (`bot.guide`, one line per channel with `{#channel}` links), greetings go to another channel
   (`bot.welcome.channel`, e.g. `introductions`), and Discord's own join notices go to staff
   (`settings.systemChannel: "mod-log"`). When channels change, update the guide's list to match.
   Opt-in ping buttons on the guide: "Proven patterns" in `discord-bot-feature`.
7. Set `bot.brandColor` to match the server's look and write a warm welcome card.
8. Plan → explain in 4-6 bullets → apply → `npm run deploy` if `bot:` changed. Offer to style the
   bot itself to match (next recipe).

### Bot's look (avatar, banner, name, About Me, status)
You do all of this; the user only supplies images (dropped into `assets/`) and picks wording.
Write a short one-off script in `.tmp/` (gitignored), using `createRest` from
`src/discord/rest.ts`, run it with `node --env-file=.env .tmp/<name>.ts`, then delete it. Images go
as data URIs (`data:image/png;base64,...`); square PNG for avatars.

| Want | Call |
| --- | --- |
| Avatar / banner everywhere | `PATCH /users/@me` with `avatar` / `banner` (`Routes.user()`). Avatar changes are rate-limited: change it rarely, and if Discord refuses, wait and retry later. |
| Different look in just this server | `PATCH /guilds/{id}/members/@me` with `nick`, `avatar`, `banner`, `bio` (`Routes.guildMember(guildId, "@me")`). |
| Bot's name | `PATCH /users/@me` with `username`, or Developer Portal → **Bot** → **Username**. A per-server `nick` is often all they want. |
| About Me text on its profile | `PATCH /applications/@me` with `description` (`Routes.currentApplication()`). |
| Status line ("Helping 120 builders") | A small feature that runs on ready: `client.user.setPresence({ activities: [{ name: "status", type: ActivityType.Custom, state: "..." }] })`. Deploy to apply. |

### Rename / re-describe / restyle something
Change `name`/`topic`/`color` and add `renamedFrom: "old name"` for renames so history and members
are kept. Plan → apply.

### Welcome new members
`bot.welcome` (`channel`, `title`, `message` with `{user}`, `{server}`, `{memberCount}`,
`{#channel}`) and `bot.autoRole`. Needs the **Server Members Intent** (user-only step). Redeploy.
Keep greetings out of the guide's channel.

### Start-here guide
`bot.guide` (`channel`, `title`, `message` with `{server}`, `{#channel}`). On every start the bot
edits its pinned guide in place (posts and pins it the first time), so changing the text and
redeploying updates it with no repost. To move it, change `channel`, then unpin/delete the old one
in Discord (or with a one-off script, after the user says yes).

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
Build a feature in `src/bot/features/` (see "Writing an automation" below). Popular ones, with
proven patterns in the `discord-bot-feature` skill ("Proven patterns"):
- Opt-in ping roles: buttons on a pinned #welcome guide so members choose what pings them
- Scheduled announcements, events or live-call reminders (shown in each member's local time)
- Auto-posting feeds: YouTube uploads, blog/RSS, news, GitHub releases
- Levels/XP with milestone roles, `/rank` and `/leaderboard`
- Native polls (`/poll`) and suggestions with voting (`/suggest`)
- Logging joins/leaves/deleted messages to `mod-log`; starboard; ticket/support threads
- Keyword auto-replies (needs the Message Content intent; prefer slash commands where possible)

Ask for missing specifics with choices (which channel, what text, how often), confirm, build,
`npm run check`, try it locally with `npm run dev` (ask the user to test it in Discord), stop the
local bot, `npm run deploy`.

If the feature needs to remember things across restarts (XP, posted feed items, ticket counters),
say so: Railway containers lose files on redeploy, so it needs storage (SQLite on a Railway volume
is the simple default). Ask before adding it (small extra cost), then follow "Storing data" in the
`discord-bot-feature` skill, including asking the user to turn on daily backups.

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
- Limits: 40 components per message (every text block, separator and button counts). Card
  messages can't also carry `content` or `embeds`, and button labels max out at 80 characters.

## Always

- `npm run check` after code changes; fix everything it reports.
- Never delete channels/roles, kick/ban, or bulk-change members without the user approving the exact
  list. Deleted channels lose their messages forever.
- Never print, log or commit the bot token or any key. `.env` is the only place they live locally.
- Ask for values in one go: when a request needs things only the user can get (a token, API key,
  channel link), list them all with where to get each, and let them paste everything back at once.
  You set them locally and on Railway; the user never edits `.env` or the Railway dashboard.
- Two running copies of the bot answer everything twice: stop `npm run dev` before `npm run deploy`.
- Keep the docs true: if you add a config field, command or feature, update
  `docs/server-config.md`, `AGENTS.md` and this skill's tables if they change. (`/help` lists
  commands automatically from `src/bot/commands/index.ts`.)
- Remember the user's decisions. When they decide something on purpose ("no #introductions
  channel", "never ping @everyone", "times in Sydney time"), add one line to **Project decisions**
  in `AGENTS.md`. Read that section before suggesting changes, and never undo a decision there
  without asking.
