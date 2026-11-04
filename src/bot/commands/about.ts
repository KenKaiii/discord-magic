import { SlashCommandBuilder, time } from "discord.js";
import { brandColor, card, cardReply } from "../ui.ts";
import type { Command } from "./types.ts";

export const about: Command = {
  data: new SlashCommandBuilder().setName("about").setDescription("What this server is about."),
  async execute(interaction, { config }) {
    const guild = interaction.guild;
    await interaction.reply(
      cardReply(
        card({
          accent: brandColor(config),
          title: guild?.name ?? config.name,
          body: config.description || "No description yet.",
          thumbnail: guild?.iconURL({ size: 256 }) ?? null,
          fields: [
            { name: "Members", value: String(guild?.memberCount ?? "?") },
            ...(guild ? [{ name: "Since", value: time(guild.createdAt, "D") }] : []),
          ],
          footer: "Type /help to see everything I can do",
        }),
      ),
    );
  },
};
