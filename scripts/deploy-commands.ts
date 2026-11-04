import { commands } from "../src/bot/commands/index.ts";
import { registerGuildCommands } from "../src/bot/register-commands.ts";
import { createRest } from "../src/discord/rest.ts";
import { loadEnv } from "../src/env.ts";
import { fetchApplication, main } from "./_shared.ts";

// The bot also does this on every start; this is for registering without running the bot.
main(async () => {
  const env = loadEnv();
  const rest = createRest(env.DISCORD_TOKEN);
  const app = await fetchApplication(rest);
  const count = await registerGuildCommands(rest, app.id, env.DISCORD_GUILD_ID, commands);
  console.log(`Registered ${count} slash command(s) in server ${env.DISCORD_GUILD_ID}.`);
  return 0;
});
