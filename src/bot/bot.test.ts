import type { Server } from "node:http";
import { GatewayIntentBits, type Message, MessageFlags } from "discord.js";
import { afterEach, describe, expect, it } from "vitest";
import exampleConfig from "../../server.config.ts";
import { EnvError, loadEnv } from "../env.ts";
import { startHealthServer } from "../health.ts";
import { parseServerConfig } from "../server/schema.ts";
import { commands } from "./commands/index.ts";
import { findGuide, guideCard } from "./features/guide.ts";
import { activeFeatures, privilegedIntentsNeeded, requiredIntents } from "./features/index.ts";
import { fillTemplate, welcomeCard } from "./features/welcome.ts";
import { card, cardMessage, cardReply } from "./ui.ts";

describe("commands", () => {
  it("have unique, valid slash command definitions", () => {
    const json = commands.map((c) => c.data.toJSON());
    const names = json.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const c of json) {
      expect(c.name).toMatch(/^[\p{Ll}\p{Lm}\p{Lo}\p{N}_-]{1,32}$/u);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });
});

describe("fillTemplate", () => {
  it("fills placeholders and links known channels", () => {
    const text = fillTemplate(
      "Hi {user}, welcome to {server} (#{memberCount}). See {#general} and {#nope}.",
      {
        userId: "42",
        serverName: "Magic",
        memberCount: 7,
        channels: new Map([["general", "99"]]),
      },
    );
    expect(text).toBe("Hi <@42>, welcome to Magic (#7). See <#99> and #nope.");
  });
});

describe("loadEnv", () => {
  const token = `${"a".repeat(24)}.${"b".repeat(6)}.${"c".repeat(38)}`;

  it("parses valid env with defaults", () => {
    const env = loadEnv({ DISCORD_TOKEN: token, DISCORD_GUILD_ID: "123456789012345678" });
    expect(env).toMatchObject({ LOG_LEVEL: "info", PORT: 3000, NODE_ENV: "development" });
  });

  it("lists every missing variable with a fix", () => {
    expect(() => loadEnv({ DISCORD_TOKEN: "" })).toThrow(EnvError);
    expect(() => loadEnv({})).toThrow(/DISCORD_TOKEN is missing[\s\S]*DISCORD_GUILD_ID is missing/);
    expect(() => loadEnv({ DISCORD_TOKEN: token, DISCORD_GUILD_ID: "my-server" })).toThrow(
      /numeric server ID/,
    );
  });
});

describe("health server", () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  it("reports 503 until ready, then 200", async () => {
    let ready = false;
    server = await startHealthServer(0, () => ready);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(503);
    ready = true;
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(200);
  });
});

const config = parseServerConfig(exampleConfig);
const vars = {
  userId: "42",
  serverName: "Magic",
  memberCount: 7,
  channels: new Map([["general", "99"]]),
};

describe("ui cards", () => {
  it("builds a Components V2 container with accent, thumbnail, fields and footer", () => {
    const json = card({
      accent: 0x123456,
      title: "Hello",
      body: "World",
      thumbnail: "https://example.com/a.png",
      fields: [{ name: "Members", value: "7" }],
      footer: "small print",
    }).toJSON();
    expect(json.accent_color).toBe(0x123456);
    const [section, separator, fields, footer] = json.components;
    expect(section).toMatchObject({
      type: 9,
      components: [{ type: 10, content: "## Hello\nWorld" }],
      accessory: { type: 11, media: { url: "https://example.com/a.png" } },
    });
    expect(separator).toMatchObject({ type: 14, divider: true });
    expect(fields).toMatchObject({ type: 10, content: "**Members** · 7" });
    expect(footer).toMatchObject({ type: 10, content: "-# small print" });
  });

  it("only pings the users it is told to, and marks messages as Components V2", () => {
    const msg = cardMessage(card({ body: "hi" }), ["42"]);
    expect(msg.flags).toBe(MessageFlags.IsComponentsV2);
    expect(msg.allowedMentions).toEqual({ parse: [], users: ["42"] });
    expect(cardReply(card({ body: "hi" }), { ephemeral: true }).flags).toEqual([
      MessageFlags.IsComponentsV2,
      MessageFlags.Ephemeral,
    ]);
  });
});

describe("welcome feature", () => {
  it("renders the configured welcome as a branded card", () => {
    const json = welcomeCard(config, vars, "https://cdn/avatar.png")?.toJSON();
    expect(json?.accent_color).toBe(
      Number.parseInt((config.bot.brandColor ?? "#5865F2").slice(1), 16),
    );
    expect(JSON.stringify(json)).toContain("<@42>");
    expect(JSON.stringify(json)).toContain("-# Member #7");
  });

  it("is skipped when bot.welcome is not set", () => {
    const bare = parseServerConfig({ name: "Srv" });
    expect(welcomeCard(bare, vars, null)).toBeNull();
    expect(activeFeatures(bare)).toEqual([]);
    expect(requiredIntents(bare)).toEqual([GatewayIntentBits.Guilds]);
    expect(privilegedIntentsNeeded(bare)).toEqual([]);
  });

  it("asks for the Server Members intent when welcome/autoRole are on", () => {
    expect(privilegedIntentsNeeded(config).map((p) => p.toggle)).toEqual(["Server Members Intent"]);
  });
});

describe("guide feature", () => {
  it("renders the starter guide with channel links and no greeting placeholders", () => {
    const channels = new Map([
      ["rules", "1"],
      ["general", "2"],
    ]);
    const text = JSON.stringify(guideCard(config, { serverName: "Magic", channels })?.toJSON());
    expect(text).toContain("<#1>");
    expect(text).toContain("Magic");
    expect(text).not.toMatch(/\{server\}|\{#rules\}/);
  });

  it("keeps the guide and greetings in different channels in the starter config", () => {
    expect(config.bot.guide?.channel).toBeDefined();
    expect(config.bot.welcome?.channel).not.toBe(config.bot.guide?.channel);
    expect(config.settings.systemChannel).not.toBe(config.bot.guide?.channel);
  });

  it("leaves {user} alone when there is no member", () => {
    expect(fillTemplate("{user} {memberCount}", { serverName: "S", channels: new Map() })).toBe(
      "{user} {memberCount}",
    );
  });

  it("edits the bot's oldest pinned message instead of posting a new one", () => {
    const msg = (id: string, author: string, at: number) =>
      ({ id, author: { id: author }, createdTimestamp: at }) as unknown as Message;
    const pinned = [msg("a", "someone", 1), msg("b", "bot", 3), msg("c", "bot", 2)];
    expect(findGuide(pinned, "bot")?.id).toBe("c");
    expect(findGuide([msg("a", "someone", 1)], "bot")).toBeUndefined();
  });

  it("needs no privileged intent", () => {
    const onlyGuide = parseServerConfig({
      name: "Srv",
      channels: [{ name: "welcome" }],
      bot: { guide: { channel: "welcome", message: "Hi" } },
    });
    expect(privilegedIntentsNeeded(onlyGuide)).toEqual([]);
  });

  it("rejects a guide channel that isn't in the config", () => {
    expect(() =>
      parseServerConfig({ name: "Srv", bot: { guide: { channel: "nope", message: "Hi" } } }),
    ).toThrow(/nope/);
  });
});
