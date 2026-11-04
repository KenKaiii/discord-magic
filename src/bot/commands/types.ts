import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import type { Logger } from "../../logger.ts";
import type { ServerConfig } from "../../server/schema.ts";

export interface BotContext {
  config: ServerConfig;
  logger: Logger;
  commands: readonly Command[];
}

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction, ctx: BotContext): Promise<void>;
}
