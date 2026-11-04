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
- **Free to run.** Discord costs nothing. This bot runs 24/7 for the price of a small Railway plan.
- **It grows with you.** Start with a few channels, add roles, automations and other bots as you go.

## Why Discord Magic

- **Just ask.** "Add a private channel for moderators", "make the roles purple", "put it online". Your agent plans the change, shows you, then applies it.
- **Looks good out of the box.** A complete starter server, and bot messages in Discord's modern card style with your brand colour.
- **Safe by default.** Every change is previewed first and the old structure is backed up. Nothing gets deleted unless you name it.
- **Online in one command.** `npm run deploy` puts the bot on Railway and keeps it running.
- **Made for beginners.** When something needs you (a click in Discord, a toggle), your agent tells you exactly where, in a few short steps.

| Ask your agent                                         | What happens                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| "Set up my Discord bot"                                | Walks you through the bot token and invite, then checks everything |
| "Fill out my server for a fitness community"           | Plans categories, channels, roles and colours, then builds them    |
| "Rename #general to #lounge"                           | Renames it and keeps all its messages                        |
| "Welcome new people and give them the Member role"     | New members get a welcome card and the role automatically    |
| "Add MEE6 and give it the bot-log channel"             | Tells you how to invite it, then sets up its access          |
| "Post a weekly challenge every Monday"                 | Builds the automation, tests it, deploys it                  |

## Also included

- **Slash commands:** `/ping`, `/about` and `/help`, ready to copy for your own.
- **Automations folder:** one file per automation, with welcome cards and auto-role built in.
- **Health check:** `npm run doctor` finds what's wrong and says how to fix it.
- **Copy an existing server:** turn a server you already run into a config file in one command.

## Get started

1. Get the project:

   ```bash
   git clone https://github.com/KenKaiii/discord-magic.git
   cd discord-magic
   npm install
   ```

   You need [Node.js](https://nodejs.org) 24 or newer and a Discord account.

2. Open the folder in your coding agent ([GG Coder](https://github.com/KenKaiii/gg-framework), Claude Code, Codex or any other) and say:

   > Set up my Discord bot.

3. Follow the few steps it gives you. Then ask for whatever you want your server to be.

## For developers

Everything an agent needs is written down, so you can read it too:

- [**AGENTS.md**](AGENTS.md): Commands, safety rules and how the project fits together.
- [**server.config.ts**](server.config.ts): The whole server as one file. Every field is in [docs/server-config.md](docs/server-config.md).
- [**.agents/skills**](.agents/skills): Step-by-step playbooks for setup, server changes and bot features.

Doing it by hand:

```bash
cp .env.example .env     # add DISCORD_TOKEN and DISCORD_GUILD_ID
npm run invite           # add the bot to your server
npm run doctor           # fix anything marked FAIL
npm run server:plan      # preview the server
npm run server:apply     # build it
npm run deploy           # put it online (railway login first)
```

Licensed under AGPL-3.0: you can build on it, and if you distribute your changes or run them as a network service, you share their source under the same license.

## Learn with me

Come build with me in my [Skool community](https://skool.com/kenkai). Get help, share what you're making, and learn how to get more out of AI.
