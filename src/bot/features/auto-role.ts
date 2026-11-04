import { Events, GatewayIntentBits } from "discord.js";
import type { Feature } from "./types.ts";

/** Gives every new (human) member a role (bot.autoRole in server.config.ts). */
export const autoRole: Feature = {
  name: "auto-role",
  intents: [GatewayIntentBits.GuildMembers],
  enabled: (config) => Boolean(config.bot.autoRole),
  setup(client, { config, logger, guildId }) {
    client.on(Events.GuildMemberAdd, async (member) => {
      const name = config.bot.autoRole;
      if (member.guild.id !== guildId || !name || member.user.bot) return;
      const role = member.guild.roles.cache.find((r) => r.name === name);
      if (!role) {
        logger.warn({ autoRole: name }, "autoRole not found; run `npm run server:apply`");
        return;
      }
      try {
        await member.roles.add(role, "bot.autoRole in server.config.ts");
      } catch (err) {
        logger.error({ err }, "Auto-role failed (is the bot's role above it?)");
      }
    });
  },
};
