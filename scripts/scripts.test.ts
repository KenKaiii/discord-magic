import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inviteUrl, otherBotInvite, ROOT } from "./_shared.ts";
import { setEnvValue } from "./pick-server.ts";
import { isSupportedCliVersion, parseGitHubRepo, railwayEnv, readLinks } from "./railway-deploy.ts";
import { MIRRORS, SOURCE } from "./sync-skills.ts";
import { missingVariables, parseVariables, readVariables } from "./variables.ts";

describe("inviteUrl", () => {
  it("locks the invite to the configured server", () => {
    const url = new URL(inviteUrl("111", "222"));
    expect(url.searchParams.get("client_id")).toBe("111");
    expect(url.searchParams.get("scope")).toBe("bot applications.commands");
    expect(url.searchParams.get("permissions")).toBe("8");
    expect(url.searchParams.get("guild_id")).toBe("222");
  });
});

describe("agent skills", () => {
  it("mirrors are in sync with .agents/skills (run `npm run skills:sync`)", () => {
    const skills = readdirSync(join(ROOT, SOURCE));
    expect(skills.length).toBeGreaterThan(0);
    for (const mirror of MIRRORS)
      for (const skill of skills)
        expect(
          readFileSync(join(ROOT, mirror, skill, "SKILL.md"), "utf8"),
          `${mirror}/${skill}`,
        ).toBe(readFileSync(join(ROOT, SOURCE, skill, "SKILL.md"), "utf8"));
  });
});

describe("railwayEnv", () => {
  it("points $_ at the Railway CLI so the IaC SDK's version check passes under npm", () => {
    expect(railwayEnv({ _: "/opt/homebrew/bin/node", PATH: "/bin" })).toEqual({
      _: "railway",
      PATH: "/bin",
    });
  });
});

describe("railway deploy helpers", () => {
  it("reads owner/repo from every GitHub remote style", () => {
    for (const url of [
      "https://github.com/KenKaiii/discord-magic.git",
      "https://github.com/KenKaiii/discord-magic",
      "git@github.com:KenKaiii/discord-magic.git",
      "ssh://git@github.com/KenKaiii/discord-magic.git",
    ])
      expect(parseGitHubRepo(url), url).toBe("KenKaiii/discord-magic");
    expect(parseGitHubRepo("https://gitlab.com/a/b.git")).toBeNull();
    expect(parseGitHubRepo("")).toBeNull();
  });

  it("requires a Railway CLI that can run .railway/railway.ts", () => {
    expect(isSupportedCliVersion("railway 5.62.1")).toBe(true);
    expect(isSupportedCliVersion("railway 5.42.1")).toBe(true);
    expect(isSupportedCliVersion("railway 5.42.0")).toBe(false);
    expect(isSupportedCliVersion("railway 4.99.9")).toBe(false);
    expect(isSupportedCliVersion("garbage")).toBe(false);
  });

  it("keeps GitHub links keyed by Railway project ID", () => {
    const links = readLinks(join(ROOT, ".railway", "github.json"));
    for (const [projectId, link] of Object.entries(links)) {
      expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
      expect(link.repo).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(link.branch.length).toBeGreaterThan(0);
    }
    expect(readLinks("/nonexistent/github.json")).toEqual({});
  });
});

describe("variables (.env.example)", () => {
  it("lists required keys with the comment that says where to get them", () => {
    const specs = parseVariables(
      "# Header\n\n# Token: open the portal\n# then copy it\nTOKEN=\n\n# Optional\n# PORT=3000\nAPI_KEY=abc\n",
    );
    expect(specs).toEqual([
      { key: "TOKEN", help: "Token: open the portal then copy it" },
      { key: "API_KEY", help: "Optional PORT=3000" },
    ]);
    expect(missingVariables(specs, { TOKEN: "x", API_KEY: "  " }).map((v) => v.key)).toEqual([
      "API_KEY",
    ]);
  });

  it("covers the Discord variables, each with a where-to-get-it note, and keeps local-only ones out", () => {
    const specs = readVariables();
    expect(specs.map((v) => v.key)).toEqual(["DISCORD_TOKEN", "DISCORD_GUILD_ID"]);
    for (const v of specs) expect(v.help, v.key).toMatch(/\S{10,}/);
  });
});

describe("invites without copying IDs by hand", () => {
  it("lets the user pick the server when its ID isn't known yet", () => {
    const url = new URL(inviteUrl("111", undefined));
    expect(url.searchParams.has("guild_id")).toBe(false);
    expect(url.searchParams.get("client_id")).toBe("111");
  });

  it("preselects the server on another bot's official invite link", () => {
    const url = new URL(
      otherBotInvite(
        "https://discordapp.com/api/oauth2/authorize?client_id=159985870458322944&permissions=8&scope=bot%20applications.commands",
        "222",
      ),
    );
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("permissions")).toBe("8");
    expect(url.searchParams.get("guild_id")).toBe("222");
    expect(url.searchParams.get("disable_guild_select")).toBe("true");
  });

  it("uses the Discord-provided link for a bare application ID and rejects other links", () => {
    expect(otherBotInvite("159985870458322944", "222")).toBe(
      "https://discord.com/oauth2/authorize?client_id=159985870458322944",
    );
    expect(() => otherBotInvite("https://mee6.xyz/add", "222")).toThrow(/redirect/);
    expect(() => otherBotInvite("https://evil.com/oauth2/authorize?client_id=1", "2")).toThrow();
  });

  it("writes the server ID into .env without touching other lines", () => {
    expect(setEnvValue("DISCORD_TOKEN=abc\nDISCORD_GUILD_ID=\n", "DISCORD_GUILD_ID", "9")).toBe(
      "DISCORD_TOKEN=abc\nDISCORD_GUILD_ID=9\n",
    );
    expect(setEnvValue("DISCORD_TOKEN=abc", "DISCORD_GUILD_ID", "9")).toBe(
      "DISCORD_TOKEN=abc\nDISCORD_GUILD_ID=9\n",
    );
  });
});
