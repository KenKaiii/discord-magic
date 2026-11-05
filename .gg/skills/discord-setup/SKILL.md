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
the first FAIL. If everything is `ok`, setup is done; go to step 6 or 7. `warn` lines about
Railway mean step 7 isn't finished yet.

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

## 7. Put it online with Railway (24/7)

You do the heavy lifting. The user only signs in to Railway (and GitHub, for auto-deploys) and
clicks approve in their browser. Work through these in order and skip any that are already done.

**a. Cost check (ask once).** Railway pricing as of Nov 2026 (https://railway.com/pricing): a
30-day Free Trial with $5 of credit (no card), then the Free plan ($1/month of usage) or Hobby
($5/month including $5 of usage). A small bot like this normally fits in Hobby's included usage.
Ask with choices; recommend continuing.

**b. Railway CLI (you install it).** Check `railway --version`.
- Missing: install it yourself with `npm i -g @railway/cli` (works on macOS, Windows and Linux;
  Node is already installed). If npm's global install fails with a permissions error, use
  `brew install railway` on macOS or `bash <(curl -fsSL railway.com/install.sh)` on macOS/Linux/WSL.
- Older than 5.42.1 (needed for `.railway/railway.ts`): `railway upgrade --yes`.
- Tell the user in one line what you installed. Don't ask them to run it.

**c. Sign in (the user approves).** Check `railway whoami`. If not signed in, run `railway login`
yourself (in the background; it opens their browser). It also creates a free account if they don't
have one. Tell them:

> A Railway page just opened in your browser:
> 1. Sign in (or sign up with GitHub, the quickest way).
> 2. Click **Authorize**.
>
> Tell me when that's done.

If no browser opens (SSH or remote machine), use `railway login --browserless` and give them the
link and code it prints.

**d. Deploy.**

```bash
npm run deploy
```

This creates or reuses the Railway project and the `discord-bot` service, copies
`DISCORD_TOKEN`/`DISCORD_GUILD_ID` from `.env` into Railway (never printed), applies
`.railway/railway.ts` (Dockerfile build, `/health` check, single replica) and uploads this folder.
If they have several Railway workspaces, `railway list --json` shows them; ask which one, then run
`RAILWAY_WORKSPACE=<name> npm run deploy`. `RAILWAY_PROJECT_NAME` overrides the project name.

**e. Auto-deploy from GitHub (recommended once it's live).** Afterwards every `git push` ships
the bot on its own, and only after the GitHub checks pass.

1. The project must be in the user's own GitHub repo. Check `git remote get-url origin`. If it
   points at the boilerplate they cloned (not their account), or there's no remote:
   - GitHub CLI missing? Install it yourself (`brew install gh`, `winget install GitHub.cli`, or
     https://cli.github.com), then run `gh auth login --web` and tell the user to enter the code it
     shows on the page that opens.
   - Keep the boilerplate as `upstream` (`git remote rename origin upstream`), commit, then
     `gh repo create <name> --private --source . --remote origin --push`. Recommend private.
2. Commit and push any changes, then run:

   ```bash
   npm run deploy -- --github
   ```

   It connects the service to `origin` on the current branch, records the link in
   `.railway/github.json` (keyed by Railway project ID, so other people's clones aren't affected),
   turns on Wait for CI, and waits for the first GitHub deploy to go live. Commit and push
   `.railway/github.json` afterwards.
3. If it says Railway can't access the repo, that's a user step:

   > Railway needs permission to see your GitHub repo:
   > 1. Open https://github.com/apps/railway-app/installations/new
   > 2. Pick your account, choose **Only select repositories**, select **<repo>**, click
   >    **Install** (or **Save**).
   >
   > Tell me when that's done.

   Then run `npm run deploy -- --github` again.

`npm run deploy -- --unlink-github` goes back to uploading from this folder.

**f. Check it's live.** `railway logs --service discord-bot --lines 50` should show
`Connected to Discord` and `Slash commands registered`. `npm run doctor` shows whether Railway
auto-deploys from GitHub. Then ask the user to try `/ping` in Discord.

### Shipping changes later

| Change | How it goes live |
| --- | --- |
| Server layout (`server.config.ts` roles/channels/settings) | `npm run server:apply`; instant, no deploy. |
| Code, commands, features, `bot:` settings | Linked to GitHub: commit and `git push` (after the user OKs it); Railway deploys once CI passes. Not linked: `npm run deploy`. |
| Token or server ID changed in `.env` | `npm run deploy` (copies secrets, then redeploys). |
| Hosting settings (`.railway/railway.ts`) | `npm run deploy`. |

Stop any local `npm run dev` before shipping, or two bots answer every command.

If `railway config apply` reports it would delete something, stop and show the user; never add
`--confirm-destructive`. A resource added in the Railway dashboard must also be added to
`.railway/railway.ts` (and new secret variables listed there with `preserve()`), or the next apply
will try to remove it.

## Moving an existing Railway bot off railway.json / railway.toml

Railway stops reading `railway.json` / `railway.toml` on **2026-12-01**; services that still use
them need `.railway/railway.ts`. If the user brings an older bot that's already on Railway:

1. Link the folder to its project (`railway link`), then `npm i -D -E railway` (the SDK
   `.railway/railway.ts` imports).
2. `railway config pull` imports the live setup: services, volumes and their mounts, and variables
   as `preserve()` (values never written to the file). It also writes `.railway/README.md`, which is
   fine to keep. `railway config migrate` (a dry run by default) shows how the old file's
   build/start settings translate; copy those into the pulled file instead of applying migrate
   over it.
3. `railway config plan` must show **0 to destroy**. Show the user the plan in plain words, and get
   a yes before `railway config apply --yes`.
4. Delete the old file, commit, redeploy the way that project normally deploys, and check the logs.
   A service with a volume has a few seconds of downtime on redeploy; startup logs that re-seed or
   recreate data mean the volume didn't reattach, so stop and tell the user.

Never pass `--confirm-destructive`, above all when there's a volume: it holds the bot's data.

## Troubleshooting

| Symptom                             | Fix                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `Discord rejected DISCORD_TOKEN`    | Reset the token (step 1), update `.env` and redeploy (`npm run deploy` re-copies it).         |
| `Discord refused a privileged intent` | `npm run doctor` names the toggle; switch it on (step 1.3), then restart/redeploy. |
| Slash commands don't show           | Wait a few seconds, restart Discord (Ctrl/Cmd+R). Check logs for `Slash commands registered`. |
| `Missing Permissions` on apply      | Bot role not at the top, or bot invited with `--minimal`. Run `npm run doctor`.               |
| Commands answer twice               | Two bots are running (local `npm run dev` and Railway). Stop one.                             |
| Railway healthcheck fails           | Logs: `railway logs --service discord-bot`. Usually a bad token or missing variable.          |
| `railway: command not found`         | Step 7b: install it yourself with `npm i -g @railway/cli`.                                     |
| Pushed but Railway didn't deploy     | GitHub checks failed (Railway waits for CI): `gh run list`, fix, push again. Or not linked: `npm run doctor`. |
| Railway can't access the GitHub repo | Step 7e.3: the user gives Railway's GitHub app access to that repo.                           |
