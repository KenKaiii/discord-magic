---
name: discord-setup
description: First-time setup of this Discord bot boilerplate (Discord app, token, server ID, invite, permissions), diagnosing "the bot isn't working", and deploying to Railway. Use when the user is starting out, something is broken, or they want it online 24/7.
---

# Discord setup and deploy

The user is probably not a developer. Do every step you can yourself; for steps that need their
browser or Discord account, give one short instruction at a time with the exact link, then wait.

## 0. Where are we?

```bash
ls .env node_modules >/dev/null 2>&1 || npm install
npm run doctor
```

`doctor` prints `ok` / `warn` / `FAIL` lines, each FAIL with its fix. Jump to the step that fixes
the first FAIL. If everything is `ok`, setup is done; go to step 6 or 7.

## 1. Discord application and token (user does this in the browser)

1. Open https://discord.com/developers/applications -> **New Application** -> name it (this is the
   bot's name) -> Create.
2. Left menu **Bot** -> **Reset Token** -> copy it.
3. Same page, **Privileged Gateway Intents** -> turn on **Server Members Intent** ->
   **Save Changes**. (Needed because `server.config.ts` uses `bot.welcome` / `bot.autoRole`.)

Ask the user to paste the token into `.env` themselves if they're comfortable; otherwise they can
paste it to you. Either way it must end up only in `.env`:

```bash
test -f .env || cp .env.example .env
```

Then set `DISCORD_TOKEN=` in `.env` with a file edit. Never echo the token, put it in a shell
command, or repeat it back.

## 2. Server ID

The user needs a Discord server they own or administer (a new empty one is ideal for a first try:
the **+** (Add a Server) button at the bottom of the server list -> **Create My Own**).

- Desktop: cog icon bottom-left (**User Settings**) -> **Advanced** -> turn on **Developer Mode**.
  Then right-click the server icon -> **Copy Server ID**.
- Mobile: avatar bottom-right -> cog top-right -> **Advanced** -> **Developer Mode**. Then tap the
  server name -> **Copy Server ID**.

Put it in `.env` as `DISCORD_GUILD_ID=`.

## 3. Invite the bot

```bash
npm run invite
```

Give the user the printed link. They open it, pick nothing (the server is preselected), click
Authorize. The link grants Administrator so `server:apply` can set any permission; if the user
wants a scoped bot, use `npm run invite -- --minimal` and expect permission errors for roles that
grant more than the bot has.

If the server already has roles: Server Settings -> Roles -> drag the bot's role (same name as
the app) to the top.

## 4. Verify

```bash
npm run doctor
```

Repeat until there is no FAIL.

## 5. Shape the server

Ask the user which they want (use the question tool, recommend the first for an existing server
with history, the second for a fresh server):

- **Keep the current layout**: `npm run server:export`, review `server.config.exported.ts`, then
  replace `server.config.ts` with it (keep the `bot:` section from the old file if they want the
  welcome message/auto-role). From now on changes go through the config.
- **Start from the starter template** in `server.config.ts`: adapt name/description first.

Then follow the `discord-server` skill (plan -> user approves -> apply).

## 6. Try it locally

```bash
npm run dev
```

Run it in the background, wait for `Connected to Discord` and `Slash commands registered`, then
ask the user to type `/ping` in their server. Stop the dev bot before deploying, or two copies
will answer every command.

## 7. Deploy to Railway (online 24/7)

Confirm first that they're OK with Railway's pricing (https://railway.com/pricing). As of Nov
2026: a 30-day Free Trial with $5 credit, then the Free plan ($1/month of usage) or Hobby ($5/month
including $5 of usage). A small bot like this one normally fits in Hobby's included usage.
Then:

1. Railway CLI installed? `railway --version`. If not, pick one: `brew install railway` (macOS),
   `npm i -g @railway/cli` (any OS), or `bash <(curl -fsSL railway.com/install.sh)`
   (macOS/Linux/WSL). Version 5.42.1 or newer is needed for `.railway/railway.ts`.
2. Logged in? `railway whoami`. If not, run `railway login` (opens their browser).
3. Deploy:

   ```bash
   npm run deploy
   ```

   It creates or reuses the Railway project and the `discord-bot` service, copies
   `DISCORD_TOKEN`/`DISCORD_GUILD_ID` from `.env` into Railway (without printing them), applies
   `.railway/railway.ts` (Dockerfile build, `/health` healthcheck, restart on failure, single
   replica) and uploads the code. With several Railway workspaces, set `RAILWAY_WORKSPACE=<name>`
   first. `RAILWAY_PROJECT_NAME` overrides the project name.
4. Check it: `railway logs --service discord-bot --lines 50` should show
   `Connected to Discord`.

Redeploy after changes with `npm run deploy` again. Server layout changes (`server:apply`) take
effect immediately and don't need a deploy, but the bot reads `bot.welcome`/`bot.autoRole` at
start-up, so redeploy after changing those.

**Auto-deploy from GitHub (optional):** push the repo to GitHub, then in the Railway dashboard:
click the `discord-bot` service -> **Settings** tab -> **Service Source** -> **Connect Repo** and
pick the repo (Railway asks them to install its GitHub app the first time). Every push to the
connected branch then redeploys; turn on **Wait for CI** in the same settings so a failing GitHub
check doesn't ship. Afterwards run `railway config plan`: if it wants to change the source, add
`source: github("<owner>/<repo>")` (imported from `railway/iac`) to the service in
`.railway/railway.ts` so the two agree.

If `railway config apply` reports it would delete something, stop and show the user; do not add
`--confirm-destructive`. A resource added in the dashboard must be added to `.railway/railway.ts`
(and new secret variables listed there with `preserve()`), or the next apply will try to remove it.

## Troubleshooting

| Symptom                             | Fix                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `Discord rejected DISCORD_TOKEN`    | Reset the token (step 1), update `.env` and redeploy (`npm run deploy` re-copies it).         |
| `Discord refused a privileged intent` | `npm run doctor` names the toggle; switch it on (step 1.3), then restart/redeploy. |
| Slash commands don't show           | Wait a few seconds, restart Discord (Ctrl/Cmd+R). Check logs for `Slash commands registered`. |
| `Missing Permissions` on apply      | Bot role not at the top, or bot invited with `--minimal`. Run `npm run doctor`.               |
| Commands answer twice               | Two bots are running (local `npm run dev` and Railway). Stop one.                             |
| Railway healthcheck fails           | Logs: `railway logs --service discord-bot`. Usually a bad token or missing variable.          |
