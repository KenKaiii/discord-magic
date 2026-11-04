import { about } from "./about.ts";
import { help } from "./help.ts";
import { ping } from "./ping.ts";
import type { Command } from "./types.ts";

/** Every slash command the bot registers. Add new ones here. */
export const commands: readonly Command[] = [ping, about, help];
