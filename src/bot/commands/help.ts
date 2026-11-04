import { SlashCommandBuilder } from "discord.js";
import { brandColor, card, cardReply } from "../ui.ts";
import type { Command } from "./types.ts";

export const help: Command = {
  data: new SlashCommandBuilder().setName("help").setDescription("List the bot's commands."),
  async execute(interaction, { commands, config }) {
    const lines = commands.map((c) => {
      const json = c.data.toJSON();
      return `\`/${json.name}\`  ${json.description}`;
    });
    await interaction.reply(
      cardReply(card({ accent: brandColor(config), title: "Commands", body: lines.join("\n") }), {
        ephemeral: true,
      }),
    );
  },
};
