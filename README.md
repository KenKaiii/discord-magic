<h1 align="center">Discord Magic</h1>

<p align="center">
  <strong>Cause setting up a Discord server by hand is a pain in the arse.</strong>
</p>

<p align="center">
  <a href="https://github.com/KenKaiii/discord-magic/stargazers"><img src="https://img.shields.io/github/stars/KenKaiii/discord-magic?style=for-the-badge&label=Stars&color=yellow" alt="Star Discord Magic on GitHub"></a>
  <a href="https://railway.com"><img src="https://img.shields.io/badge/Deploys%20on-Railway-b0b6ff?style=for-the-badge&logo=railway&logoColor=white" alt="Deploys on Railway"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=for-the-badge" alt="AGPL-3.0 License"></a>
  <a href="https://youtube.com/@kenkaidoesai"><img src="https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="YouTube"></a>
  <a href="https://skool.com/kenkai"><img src="https://img.shields.io/badge/Skool-Community-b0b6ff?style=for-the-badge" alt="Skool"></a>
</p>

Discord Magic is a Discord server and bot that your coding agent builds, styles and runs for you. You say what you want; it does the rest.

## Why have a Discord server

- **Your own space.** No algorithm decides who sees your posts. Your members get your announcements.
- **Real conversations.** Chat, voice, forums and events in one place, live, every day.
- **People help each other.** A good community answers questions and shares wins while you sleep.
- **Cheap to run.** Discord costs nothing. This bot runs 24/7 on a small Railway plan.
- **It grows with you.** Start with a few channels, add roles, automations and other bots as you go.

## Why Discord Magic

- **Just ask.** "Add a private channel for moderators", "make the roles purple", "put it online". Your agent plans the change, shows you, then applies it.
- **Looks good out of the box.** A complete starter server, and bot messages in Discord's modern card style with your brand colour.
- **Safe by default.** Every change is previewed first and the old structure is backed up. Nothing gets deleted unless you name it.
- **Online in one command.** `npm run deploy` puts the bot on Railway. Your agent installs the Railway CLI if you don't have it, and you just sign in. Link GitHub once and every push goes live by itself.
- **Made for beginners.** When something needs you (a click in Discord, a toggle), your agent tells you exactly where, in a few short steps.

| Ask your agent                                         | What happens                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| "Set up my Discord bot"                                | Walks you through the bot token and invite, then checks everything |
| "Fill out my server for a fitness community"           | Plans categories, channels, roles and colours, then builds them    |
| "Rename #general to #lounge"                           | Renames it and keeps all its messages                        |
| "Welcome new people and give them the Member role"     | New members get a welcome card and the role automatically    |
| "Update the start-here guide"                          | Edits the pinned guide in #welcome, no repost                |
| "Add MEE6 and give it the bot-log channel"             | Tells you how to invite it, then sets up its access          |
| "Post a weekly challenge every Monday"                 | Builds the automation, tests it, deploys it                  |

## Also included

- **Slash commands:** `/ping`, `/about` and `/help`, ready to copy for your own.
- **Automations folder:** one file per automation, with a pinned start-here guide, welcome cards and auto-role built in.
- **Health check:** `npm run doctor` finds what's wrong and says how to fix it.
- **Copy an existing server:** turn a server you already run into a config file in one command.

## Get started

1. Open your coding agent ([GG Coder](https://github.com/KenKaiii/gg-framework), Claude Code, Codex or any other) and paste:

   > Set up Discord Magic for me: https://github.com/KenKaiii/discord-magic

   It downloads the project, installs what's missing and starts the setup. All you need is a Discord account.

2. Follow the few steps it gives you (copy a token, click Authorize, sign in to Railway).

3. Your agent asks what your server is for, shows you what's possible, then builds it to fit. After that, ask for anything you want. Next time, open the `discord-magic` folder in your agent and just keep asking.

Already downloaded it? Open the folder in your agent and say "Set up my Discord bot."

### For agents

If a user pasted this repo's link and asked you to set it up:

1. Make sure `git` and Node.js 24+ are installed (`node -v`). If not, install them for the user: macOS `brew install node git`, Windows `winget install OpenJS.NodeJS.LTS Git.Git`, Linux the distro package manager or nvm.
2. `git clone https://github.com/KenKaiii/discord-magic.git`, `cd discord-magic`, `npm install`.
3. Read `AGENTS.md` and `.agents/skills/discord-magic/SKILL.md`, then follow its "First-time setup" recipe. Your skill list may not include this project's skills yet, so read the files directly.
4. When setup is done, tell the user to open the `discord-magic` folder in their agent from now on.

## For developers

Everything an agent needs is written down, so you can read it too:

- [**AGENTS.md**](AGENTS.md): Commands, safety rules and how the project fits together.
- [**server.config.ts**](server.config.ts): The whole server as one file. Every field is in [docs/server-config.md](docs/server-config.md).
- [**.agents/skills**](.agents/skills): Step-by-step playbooks for setup, server changes and bot features.

Doing it by hand:

```bash
cp .env.example .env     # fill in every empty KEY=; the comments say where to get each
npm run invite           # add the bot to your server
npm run doctor           # fix anything marked FAIL
npm run server:plan      # preview the server
npm run server:apply     # build it
npm i -g @railway/cli    # if you don't have it, then: railway login
npm run deploy           # put it online
npm run deploy -- --github   # optional: every git push deploys
```

Licensed under AGPL-3.0: you can build on it, and if you distribute your changes or run them as a network service, you share their source under the same license.

## Learn with me

Come build with me in my [Skool community](https://skool.com/kenkai). Get help, share what you're making, and learn how to get more out of AI.
