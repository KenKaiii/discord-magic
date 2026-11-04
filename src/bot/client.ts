import { type ChatInputCommandInteraction, Client, Events, MessageFlags } from "discord.js";
import type { Env } from "../env.ts";
import type { Logger } from "../logger.ts";
import type { ServerConfig } from "../server/schema.ts";
import type { BotContext, Command } from "./commands/types.ts";
import { activeFeatures, features as allFeatures, requiredIntents } from "./features/index.ts";
import type { Feature } from "./features/types.ts";
import { registerGuildCommands } from "./register-commands.ts";

export function createBot(options: {
  env: Env;
  config: ServerConfig;
  logger: Logger;
  commands: readonly Command[];
  features?: readonly Feature[];
}): Client {
  const { env, config, logger, commands, features = allFeatures } = options;
  const client = new Client({ intents: requiredIntents(config, features) });
  const ctx: BotContext = { config, logger, commands };
  const byName = new Map(commands.map((c) => [c.data.name, c]));

  client.once(Events.ClientReady, async (ready) => {
    logger.info({ user: ready.user.tag }, "Connected to Discord");
    if (!ready.guilds.cache.has(env.DISCORD_GUILD_ID))
      logger.warn(
        "The bot isn't in DISCORD_GUILD_ID yet. Run `npm run invite` for the invite link.",
      );
    try {
      const count = await registerGuildCommands(
        ready.rest,
        ready.application.id,
        env.DISCORD_GUILD_ID,
        commands,
      );
      logger.info({ count }, "Slash commands registered");
    } catch (err) {
      logger.error({ err }, "Could not register slash commands");
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = byName.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, ctx);
    } catch (err) {
      logger.error({ err, command: interaction.commandName }, "Command failed");
      await replyWithError(interaction);
    }
  });

  const featureCtx = { config, logger, guildId: env.DISCORD_GUILD_ID };
  for (const feature of activeFeatures(config, features)) {
    feature.setup(client, { ...featureCtx, logger: logger.child({ feature: feature.name }) });
    logger.debug({ feature: feature.name }, "Feature enabled");
  }

  client.on(Events.Error, (err) => logger.error({ err }, "Discord client error"));
  return client;
}

async function replyWithError(interaction: ChatInputCommandInteraction): Promise<void> {
  const content = "Something went wrong running that command.";
  try {
    if (interaction.replied || interaction.deferred)
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  } catch {
    // The interaction may have expired; nothing else to do.
  }
}
