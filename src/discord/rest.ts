import { REST } from "discord.js";

export function createRest(token: string): REST {
  return new REST({ version: "10" }).setToken(token);
}
