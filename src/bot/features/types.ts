import type { Client, GatewayIntentBits } from "discord.js";
import type { Logger } from "../../logger.ts";
import type { ServerConfig } from "../../server/schema.ts";

export interface FeatureContext {
  config: ServerConfig;
  logger: Logger;
  /** The one server this bot manages. Ignore events from anywhere else. */
  guildId: string;
}

/** An automation: something the bot does on its own when an event happens or on a timer. */
export interface Feature {
  /** Short id. Also the prefix for its button/menu customIds, e.g. "roles:pick". */
  name: string;
  /** Gateway intents it needs (Guilds is always on). Privileged ones are checked by doctor. */
  intents?: GatewayIntentBits[];
  /** Whether it runs with the current config. Default: always. */
  enabled?: (config: ServerConfig) => boolean;
  /** Attach event listeners/timers. Catch your own errors and log them with ctx.logger. */
  setup: (client: Client, ctx: FeatureContext) => void;
}
