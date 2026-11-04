import { parseArgs } from "node:util";
import { createRest } from "../src/discord/rest.ts";
import { fetchApplication, inviteUrl, main } from "./_shared.ts";

main(async () => {
  const { values } = parseArgs({ options: { minimal: { type: "boolean", default: false } } });
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN is missing. Copy .env.example to .env and add it.");
  const app = await fetchApplication(createRest(token));
  console.log(
    `Invite link for ${app.name}:\n\n${inviteUrl(app.id, process.env.DISCORD_GUILD_ID, values.minimal)}\n`,
  );
  console.log(
    values.minimal
      ? "Minimal permissions: the bot can only grant permissions it has itself."
      : "Uses Administrator so server:apply can set any role/channel permission. Use --minimal for a scoped bot.",
  );
  return 0;
});
