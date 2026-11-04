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
3. Reply within 3 seconds, or call `await interaction.deferReply()` first and
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

When a feature needs a privileged intent, tell the user exactly which toggle to turn on (doctor
prints the link). If you use a privileged intent not in `PRIVILEGED` in
`src/bot/features/index.ts`, add it there.

Only act in the configured server: compare `guild.id` with `ctx.guildId`.

## Configurable behaviour

If the user should be able to tweak the behaviour without code (a channel name, a message), add a
field to `botSchema` in `src/server/schema.ts` (with validation and a cross-reference check in
`superRefine` if it names a channel/role), use it from `config.bot`, document it in
`docs/server-config.md`, and add it to `server.config.ts`.

## Storing data

There is no database by default. If a feature needs to remember things (points, tickets,
reminders), ask the user before adding one: Railway Postgres costs extra. If yes, add
`postgres("postgres")` to `.railway/railway.ts` and pass `DATABASE_URL: db.env.DATABASE_URL` to
the service, use a migration tool from the first table, and never run destructive migrations
against the Railway database without the user's explicit approval and a backup.

## Before you finish

- `npm run check` passes.
- New env vars: add to `src/env.ts`, `.env.example` and `.railway/railway.ts` (`preserve()` for
  secrets), and tell the user to add the value to `.env`.
- Update `AGENTS.md` / this skill if you changed a convention.
