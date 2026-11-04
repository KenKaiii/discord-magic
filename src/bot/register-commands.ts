import { type REST, Routes } from "discord.js";
import type { Command } from "./commands/types.ts";

/** Guild commands update instantly (global ones can take up to an hour). PUT replaces the full set. */
export async function registerGuildCommands(
  rest: REST,
  applicationId: string,
  guildId: string,
  commands: readonly Command[],
): Promise<number> {
  const body = commands.map((c) => c.data.toJSON());
  await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body });
  return body.length;
}
