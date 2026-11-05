---
name: discord-bot-feature
description: Code-level detail for adding bot behaviour - slash commands, automations (features), buttons, intents, configurable settings, storing data. Use with discord-magic when writing bot code.
---

# Add bot behaviour

User-facing workflow, message styling and automation ideas are in the `discord-magic` skill.
This is the code reference.

## Slash command

1. Copy `src/bot/commands/ping.ts` to `src/bot/commands/<name>.ts`. Build `data` with
   `SlashCommandBuilder` (lowercase name, description required, options via `.addStringOption`
   etc.). `execute(interaction, ctx)` gets `ctx.config` (parsed `server.config.ts`), `ctx.logger`
   and `ctx.commands`.
2. Add it to the array in `src/bot/commands/index.ts`.
3. Reply within 3 seconds (Discord's hard limit), or call `await interaction.deferReply()` first and
   `interaction.editReply(...)` later. Reply with `interaction.reply(cardReply(card({...})))`
   from `src/bot/ui.ts`; pass `{ ephemeral: true }` for private replies.
4. Staff-only: `.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)` on the builder.
5. Put any non-trivial logic in a pure function and test it in a `*.test.ts` next to it.
6. `npm run check`, then `npm run dev` and try it in Discord. Commands are registered to the
   server automatically on start (instant). Deploy with `npm run deploy`.

## Automations (features)

Anything the bot does by itself (on an event or a timer) is a `Feature` in
`src/bot/features/<name>.ts`, registered in `src/bot/features/index.ts`. See `welcome.ts` and
`auto-role.ts`. A feature declares `name`, `intents`, optional `enabled(config)` and
`setup(client, ctx)`. The bot only requests the intents of enabled features, and `npm run doctor`
checks the privileged ones. `src/bot/client.ts` only wires things up; don't put feature logic there.

Each event needs its gateway intent in the feature's `intents`:

| Event                  | Intent                  | Privileged (toggle in Developer Portal -> Bot)           |
| ---------------------- | ----------------------- | -------------------------------------------------------- |
| Member joins/leaves    | `GuildMembers`          | Yes: Server Members Intent                               |
| Messages in the server | `GuildMessages`         | No, but reading message text needs `MessageContent`: Yes |
| Reactions              | `GuildMessageReactions` | No                                                       |
| Voice joins/leaves     | `GuildVoiceStates`      | No                                                       |
| Online status/activity | `GuildPresences`        | Yes: Presence Intent                                     |

When a feature needs a privileged intent, tell the user exactly which toggle to turn on (doctor
prints the link). The three privileged intents (Server Members, Presence, Message Content) are
listed in `PRIVILEGED_INTENTS` in `src/bot/features/index.ts`, which drives that check.

Only act in the configured server: compare `guild.id` with `ctx.guildId`.

## Configurable behaviour

If the user should be able to tweak the behaviour without code (a channel name, a message), add a
field to `botSchema` in `src/server/schema.ts` (with validation and a cross-reference check in
`superRefine` if it names a channel/role), use it from `config.bot`, document it in
`docs/server-config.md`, and add it to `server.config.ts`.

## Storing data

There is no storage by default, and files written inside the Railway container are lost on every
redeploy. If a feature needs to remember things (XP, ticket counters, posted feed items), ask the
user before adding storage (it adds a little usage cost), then pick:

**SQLite on a Railway volume (recommended for this bot).** One instance, one writer, no extra
service. Node's built-in `node:sqlite` (`DatabaseSync`, Release candidate in Node 26) means nothing
to install.

1. `.railway/railway.ts`: `const data = volume("bot-data");`, add `volumeMounts: { "/data": data }`
   and `RAILWAY_RUN_UID: "0"` (the Dockerfile runs as a non-root user, which can't write to a
   Railway volume otherwise) to the bot service's config/env, and add `data` to `resources`.
   Import `volume` from `railway/iac`.
2. `DATABASE_PATH` env var: `/data/bot.db` on Railway, `./data/bot.db` locally (gitignore `data/`).
3. On open: `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;`.
   One module owns every table; create tables with `CREATE TABLE IF NOT EXISTS`, and put schema
   changes in numbered migrations tracked in a `schema_version` table, never edited once shipped.
4. Volumes allow one replica only (already the setting) and a redeploy has a few seconds of
   downtime. Tell the user to turn on backups: Railway → the `discord-bot` service → **Backups** tab
   → **Daily** (kept 6 days). A backup only counts once a restore has been tried.

**Postgres** if they need a database other tools can reach too: `const db = postgres("db");` in
`.railway/railway.ts`, add `db` to `resources`, pass `DATABASE_URL: db.env.DATABASE_URL`, and use a
migration tool from the first table.

Either way: never run destructive migrations, resets or bulk deletes against the Railway data
without a backup and the user's explicit go-ahead for that exact command.

## Proven patterns (from a production community bot)

Lessons from a live 24/7 community bot with feeds, levels, polls and scheduled calls. Follow them
when building similar features:

- **External feeds (RSS, YouTube, GitHub, news).** On a source's first run, save existing items as
  already seen without posting them (no back-catalog dump), but do still post items from the last
  48 hours. Keep a stable dedupe key per source and never rename it once live, or everything reposts.
  Cap posts per poll (about 3), give every fetch a timeout (`AbortSignal.timeout(15_000)`), send a
  browser-like `User-Agent` (many Cloudflare-fronted feeds return 403 without one), and on any
  fetch/parse failure log and skip that cycle; it must never crash the bot. YouTube has a per-channel
  feed: `https://www.youtube.com/feeds/videos.xml?channel_id=<id>`. Unit-test the filtering and
  "should post" logic; feed bugs are silent otherwise.
- **Pings are opt-in.** Nobody gets pinged unless they chose to: make one role per kind of ping
  ("Event Pings", "News Pings") and give members toggle buttons on a pinned message in #welcome
  (`customId` like `"pings:news"`; clicking adds the role, clicking again removes it, with an ephemeral
  confirmation). When posting, mention only that role: `allowedMentions: { parse: [], roles: [id] }`.
- **Pinned guide and rules messages.** Edit the bot's existing message instead of posting a new
  one each time: find the bot's own pinned message in the channel (or store its ID), `edit` it, and
  only `send` + `pin` if it's missing. Turn channel names into clickable `<#id>` links.
- **Schedules.** Use a cron library with an explicit IANA timezone (e.g. `croner`:
  `new Cron("0 30 9 * * THU", { timezone: "Asia/Kuala_Lumpur" }, fn)`) rather than `setInterval`
  for "every Thursday 9:30". Put the timezone and days in `server.config.ts` `bot:` settings. In
  messages, write times as Discord timestamps (`<t:UNIX:F>`, or `<t:UNIX:R>` for "in 15 minutes")
  so every member sees their own local time.
- **Levels/XP.** Give XP only in chosen channels, at most once per member per minute, random 15-25 per
  message; members keep only their highest milestone role; announce milestones in one channel, not
  where they chatted. Needs storage (above) and the `GuildMessages` intent; it reads only who posted
  where, so the privileged Message Content intent isn't needed.
- **Polls.** Discord's native polls (`poll: { question: { text }, answers, duration, allowMultiselect }`)
  beat reaction votes. They can't be sent as a card (Components V2 disables `poll`), so send them as a
  normal message. Limit the command with `.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)`.
- **Suggestions.** `/suggest` posts the idea as a card in a read-only channel and adds 👍/👎
  reactions for voting.
- **Images in cards.** Local images (banners in `assets/`) go in `files` and are shown with
  `attachment://<name>` in the card's `image`; attachments don't show on card messages otherwise.
- **Read-only channels.** If the bot isn't Administrator (invited with `--minimal`), denying
  `SendMessages` to @everyone also blocks the bot: add an overwrite for the bot's own role that
  allows it.

## Before you finish

- `npm run check` passes.
- New env vars: add to `src/env.ts`, `.env.example` and `.railway/railway.ts` (`preserve()` for
  secrets), and tell the user to add the value to `.env`.
- Update `AGENTS.md` / this skill if you changed a convention.
