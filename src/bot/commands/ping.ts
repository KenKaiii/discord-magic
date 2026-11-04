import { SlashCommandBuilder } from "discord.js";
import { brandColor, card, cardReply } from "../ui.ts";
import type { Command } from "./types.ts";

export const ping: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Check that the bot is alive."),
  async execute(interaction, { config }) {
    const ws = interaction.client.ws.ping;
    await interaction.reply(
      cardReply(
        card({
          accent: brandColor(config),
          body: `**Pong!** Gateway latency ${ws >= 0 ? `\`${ws}ms\`` : "is still being measured"}.`,
        }),
        { ephemeral: true },
      ),
    );
  },
};
