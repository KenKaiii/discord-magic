import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { Routes } from "discord.js";
import { createRest } from "../src/discord/rest.ts";
import { main, ROOT } from "./_shared.ts";

/** Sets KEY=value in .env text, replacing an existing line or appending one. */
export function setEnvValue(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const existing = new RegExp(`^${key}=.*$`, "m");
  if (existing.test(content)) return content.replace(existing, () => line);
  const sep = content === "" || content.endsWith("\n") ? "" : "\n";
  return `${content}${sep}${line}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main(async () => {
    const { positionals } = parseArgs({ allowPositionals: true });
    const token = process.env.DISCORD_TOKEN?.trim();
    if (!token) throw new Error("DISCORD_TOKEN is missing in .env. Add the bot token first.");

    // The bot can see every server it was invited to, so nobody has to copy an ID by hand.
    const guilds = (await createRest(token).get(Routes.userGuilds())) as {
      id: string;
      name: string;
    }[];
    const wanted = positionals[0];
    const pick = wanted
      ? guilds.find((g) => g.id === wanted)
      : guilds.length === 1
        ? guilds[0]
        : undefined;

    if (!pick) {
      if (guilds.length === 0)
        console.error(
          "The bot isn't in any server yet. Run `npm run invite -- --open`, then have the user pick their server and click Authorize.",
        );
      else {
        if (wanted) console.error(`The bot isn't in a server with ID ${wanted}.`);
        console.error("The bot is in these servers:");
        for (const g of guilds) console.error(`  ${g.id}  ${g.name}`);
        console.error("Ask the user which one, then run `npm run server:pick -- <id>`.");
      }
      return 1;
    }

    const envPath = join(ROOT, ".env");
    const current = existsSync(envPath)
      ? readFileSync(envPath, "utf8")
      : readFileSync(join(ROOT, ".env.example"), "utf8");
    writeFileSync(envPath, setEnvValue(current, "DISCORD_GUILD_ID", pick.id));
    console.log(`Saved DISCORD_GUILD_ID for "${pick.name}" (${pick.id}) to .env.`);
    return 0;
  });
