import { parseArgs } from "node:util";
import { createRest } from "../src/discord/rest.ts";
import { fetchApplication, inviteUrl, main, openInBrowser, otherBotInvite } from "./_shared.ts";

main(async () => {
  const { values } = parseArgs({
    options: {
      minimal: { type: "boolean", default: false },
      open: { type: "boolean", default: false },
      // Another bot's official invite link (or application ID), to preselect the user's server.
      for: { type: "string" },
    },
  });
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || undefined;
  let url: string;

  if (values.for) {
    url = otherBotInvite(values.for, guildId);
    console.log(`Invite link for that bot:\n\n${url}\n`);
    console.log(
      url.includes("guild_id=")
        ? "Their server is preselected: they only click Authorize. Then add the bot's role to `otherBots`."
        : "They pick their server in the dropdown and click Authorize. Then add the bot's role to `otherBots`.",
    );
  } else {
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error("DISCORD_TOKEN is missing. Copy .env.example to .env and add it.");
    const app = await fetchApplication(createRest(token));
    url = inviteUrl(app.id, guildId, values.minimal);
    console.log(`Invite link for ${app.name}:\n\n${url}\n`);
    console.log(
      values.minimal
        ? "Minimal permissions: the bot can only grant permissions it has itself."
        : "Uses Administrator so server:apply can set any role/channel permission. Use --minimal for a scoped bot.",
    );
    if (!guildId)
      console.log(
        "No server ID yet: they pick their server in the dropdown and click Authorize. Then run `npm run server:pick` to save it.",
      );
  }

  if (values.open)
    console.log(
      openInBrowser(url)
        ? "\nOpened it in the browser."
        : "\nCouldn't open a browser here; give the user the link.",
    );
  return 0;
});
