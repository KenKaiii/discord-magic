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

There is no database by default, and files written inside the Railway container are lost on every
redeploy. If a feature needs to remember things (points, tickets, reminders), ask the user before
adding a database: it adds usage cost. If yes:

1. In `.railway/railway.ts`: `const db = postgres("db");`, add `db` to the project's `resources`,
   and pass `DATABASE_URL: db.env.DATABASE_URL` in the bot service's `env`.
2. Add `DATABASE_URL` to `src/env.ts` (optional locally) and use a migration tool from the first
   table. Migrations are checked in and never edited once applied.
3. Never run destructive migrations, resets or deletes against the Railway database without a
   backup and the user's explicit go-ahead for that exact command. Tell the user to turn on
   Railway's database backups (the database's **Backups** tab) once real data exists.

## Before you finish

- `npm run check` passes.
- New env vars: add to `src/env.ts`, `.env.example` and `.railway/railway.ts` (`preserve()` for
  secrets), and tell the user to add the value to `.env`.
- Update `AGENTS.md` / this skill if you changed a convention.
