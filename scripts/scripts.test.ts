import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inviteUrl, ROOT } from "./_shared.ts";
import { isSupportedCliVersion, parseGitHubRepo, railwayEnv, readLinks } from "./railway-deploy.ts";
import { MIRRORS, SOURCE } from "./sync-skills.ts";

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
