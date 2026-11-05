# AGENTS.md

This repo is a Discord bot plus the Discord server it runs, managed by you, the coding agent. The
user describes what they want in plain words ("rename the server", "add a #memes channel only
Members can see", "deploy it"); you edit code/config, run the commands below, and report back in
plain language. Assume the user is not a developer.

Skills in `.agents/skills/` (mirrored to `.claude/skills/` and `.gg/skills/`) hold the playbooks.
**Start with `discord-magic` for any request**: it covers how to talk to the user, what only they
can do, recipes and message styling. The others go deeper:

| User wants to... | Skill |
| --- | --- |
| Anything (start here): setup, server makeover, other bots, automations, styling | `discord-magic` |
| First-time setup details, troubleshooting, Railway deploys | `discord-setup` |
| Server config workflow: plan/apply, renaming, deleting, permissions | `discord-server` |
| Writing bot code: slash commands, automations, intents, storing data | `discord-bot-feature` |

## Safety rules (always)

1. **Secrets.** `DISCORD_TOKEN` lives only in `.env` (gitignored) and in Railway variables. Never
   print it, echo it, log it, commit it, or put it in a command line. If the user pastes a token
   in chat, write it into `.env` and tell them to reset it later if the chat is shared.
2. **Preview before changing Discord.** Run `npm run server:plan`, summarise the plan for the user
   in plain words, and get a yes before `npm run server:apply`. Apply re-checks and backs up first.
3. **Deleting is opt-in and exact.** Never pass `--prune` or `--confirm-delete` unless the user
   asked to delete those specific channels/roles after seeing the list. Deleting a channel erases
   its messages permanently; backups in `backups/` only hold structure (names, permissions), never
   messages.
4. **Rename, don't recreate.** To rename a channel, category or role, change `name` and set
   `renamedFrom: "<old name>"`, so the existing one (and its messages/members) is kept.
5. **Railway.** Install the Railway CLI yourself if it's missing (`npm i -g @railway/cli`) and
   run `railway login` for the user (they approve in the browser). Deploy with `npm run deploy`. Never pass `--confirm-destructive`, and never run
   `railway delete`, `railway down`, `railway service delete` or `railway variable delete`
   without the user's explicit go-ahead for that exact command. Creating a Railway project can
   cost money: confirm with the user before the first deploy.
6. **Quality gate.** After any code change run `npm run check` (types, lint, tests) and fix what
   it reports. `npm run fix` auto-formats.

## Commands

| Command                   | What it does                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run doctor`          | Checks token, invite, permissions, intents, role order, config, Railway CLI/login and GitHub auto-deploys. Start here when anything is off. |
| `npm run invite`          | Prints the bot's invite link for the user's server.                                                                                            |
| `npm run server:plan`     | Shows what would change in Discord to match `server.config.ts`. Read-only.                                                                     |
| `npm run server:apply`    | Backs up the current structure, applies the plan, verifies.                                                                                    |
| `npm run server:backup`   | Saves the server structure to `backups/`.                                                                                                      |
| `npm run server:export`   | Writes the live server as `server.config.exported.ts` (to adopt an existing server). `-- --from backups/<file>.json` exports a backup instead. |
| `npm run dev`             | Runs the bot locally, restarting on file changes.                                                                                              |
| `npm run commands:deploy` | Registers slash commands without starting the bot (the bot also does this on start).                                                           |
| `npm run deploy`          | Creates/updates the Railway project, syncs secrets and settings, deploys. `-- --github` links the GitHub repo so every push deploys after CI. |
| `npm run logs` | Streams the deployed bot's Railway logs. |
| `npm run check`           | Typecheck + lint + tests.                                                                                                                      |
| `npm run skills:sync`     | Copies `.agents/skills` to the other agent folders after editing a skill.                                                                      |

Flags go after `--`, e.g. `npm run server:plan -- --json`.

## Map

```
server.config.ts          The Discord server as code. Edit this for server changes.
docs/server-config.md     Every field in server.config.ts, with examples.
src/index.ts              Bot entry: env, health server, Discord login.
src/bot/client.ts         Wires commands and features to the Discord client.
src/bot/commands/         One file per slash command; register in commands/index.ts.
src/bot/features/         Automations (start-here guide, welcome, auto-role, ...); register in features/index.ts.
src/bot/ui.ts             card() helper: the one look for every bot message (Components V2).
src/server/               Server-as-code engine: schema, plan (diff), apply, export, backup.
src/discord/              Discord REST adapters.
scripts/                  CLI entry points behind the npm scripts.
.railway/railway.ts       Railway service settings (Infrastructure as Code).
.railway/github.json      Railway project ID -> GitHub repo it auto-deploys from (written by deploy --github).
Dockerfile                Production image Railway builds.
```

## Code conventions

- TypeScript runs directly on Node (type stripping), no build step. So: import local files with
  the `.ts` extension, use `import type` for types, and don't use `enum`, `namespace` or
  constructor parameter properties (`npm run typecheck` enforces this).
- Biome formats and lints (`npm run fix`). Tests are `*.test.ts` next to the code (Vitest).
- `server.config.ts` belongs to the user: tests only check that it's valid and builds cleanly. Tests
  that need fixed names use `src/server/testing/starter-config.ts`. Never undo the user's config
  choices to make `npm run check` pass.
- Keep pure logic (diffing, formatting) separate from Discord calls so it can be tested; the
  server engine is tested against an in-memory fake guild in `src/server/testing/`.
- Dependencies are pinned to exact versions. Add with `npm i -E <pkg>`; check for updates with
  `npm outdated`. Dependabot opens weekly update PRs once the repo is on GitHub.
- Node version: `.node-version` (also used by CI and the Dockerfile).

## Known gotchas

- The bot's own role must be above every role it manages (Server Settings -> Roles -> drag it to
  the top). `doctor` and `server:plan` flag this.
- Features that need a privileged intent (welcome/auto-role need **Server Members Intent**) make
  the bot refuse to log in until the user flips the toggle; `npm run doctor` prints the link.
- Announcement and stage channels and `rulesChannel` need a Community server (Server Settings ->
  Enable Community). The plan blocks them otherwise.
- Discord stores text channel names lowercase with dashes; the config normalises them.
- Members, messages, emojis, invites, onboarding and AutoMod are not managed by
  `server.config.ts`. Extend `src/server/` if the user needs them.

## Project decisions

Choices the user made on purpose. Read before suggesting changes; never undo one without asking.
Add one line per decision as they come up (see the `discord-magic` skill).

- None yet.
