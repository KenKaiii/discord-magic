import { describe, expect, it } from "vitest";
import exampleConfig from "../../server.config.ts";
import { applyPlan } from "./apply.ts";
import { renderConfigSource, snapshotToConfig } from "./export.ts";
import { formatPlan } from "./format.ts";
import { buildPlan, countOps, hasErrors, type Plan } from "./plan.ts";
import { parseServerConfig, type ServerConfigInput } from "./schema.ts";
import { BOT_ROLE_ID, type FakeGuild, freshServer, GUILD_ID } from "./testing/fake-guild.ts";

const config = (input: ServerConfigInput) => parseServerConfig(input);

async function sync(guild: FakeGuild, input: ServerConfigInput, opts = {}): Promise<Plan> {
  const plan = buildPlan(config(input), await guild.fetchSnapshot(), opts);
  expect(plan.issues.filter((i) => i.level === "error")).toEqual([]);
  await applyPlan(plan, guild);
  return plan;
}

async function replan(guild: FakeGuild, input: ServerConfigInput, opts = {}): Promise<Plan> {
  return buildPlan(config(input), await guild.fetchSnapshot(), opts);
}

describe("server sync", () => {
  it("builds the example server on a fresh guild and converges to zero changes", async () => {
    const guild = freshServer();
    const first = await sync(guild, exampleConfig);
    expect(countOps(first).create).toBeGreaterThan(5);
    expect(countOps(first).delete).toBe(0);

    const second = await replan(guild, exampleConfig);
    expect(formatPlan(second)).toContain("No changes");
    expect(second.ops).toEqual([]);

    // Default channels the config doesn't mention are reported, never deleted.
    expect(second.unmanaged.channels.map((c) => c.name).sort()).toEqual([
      "General",
      "Text Channels",
      "Voice Channels",
    ]);
    const general = guild.channels.find((c) => c.name === "general");
    const community = guild.channels.find((c) => c.name === "Community");
    expect(general?.parentId).toBe(community?.id);
  });

  it("handles Discord giving new roles duplicate positions", async () => {
    const guild = freshServer();
    await sync(guild, exampleConfig);
    const positions = guild.roles.map((r) => r.position);
    expect(new Set(positions).size).toBe(positions.length);
    expect((await replan(guild, exampleConfig)).issues).toEqual([]);
  });

  it("orders roles top-down directly below the bot role", async () => {
    const guild = freshServer();
    await sync(guild, exampleConfig);
    const order = [...guild.roles].sort((a, b) => b.position - a.position).map((r) => r.name);
    expect(order).toEqual(["Magic Bot", "Admin", "Moderator", "Member", "@everyone"]);

    await sync(guild, { ...exampleConfig, roles: [...(exampleConfig.roles ?? [])].reverse() });
    const reversed = [...guild.roles].sort((a, b) => b.position - a.position).map((r) => r.name);
    expect(reversed).toEqual(["Magic Bot", "Member", "Moderator", "Admin", "@everyone"]);
    expect(
      (await replan(guild, { ...exampleConfig, roles: [...(exampleConfig.roles ?? [])].reverse() }))
        .ops,
    ).toEqual([]);
  });

  it("orders channels in config order, text above voice", async () => {
    const guild = freshServer();
    const input: ServerConfigInput = {
      name: "Srv",
      categories: [
        {
          name: "B",
          channels: [{ name: "two" }, { name: "one" }, { name: "talk", type: "voice" }],
        },
        { name: "A", channels: [] },
      ],
    };
    await sync(guild, input);
    const b = guild.channels.find((c) => c.name === "B");
    const inB = guild.channels
      .filter((c) => c.parentId === b?.id)
      .sort((x, y) => x.position - y.position)
      .map((c) => c.name);
    expect(inB).toEqual(["two", "one", "talk"]);
    expect((await replan(guild, input)).ops).toEqual([]);

    const swapped: ServerConfigInput = {
      ...input,
      categories: [
        { name: "A", channels: [] },
        {
          name: "B",
          channels: [{ name: "one" }, { name: "two" }, { name: "talk", type: "voice" }],
        },
      ],
    };
    const plan = await sync(guild, swapped);
    expect(plan.ops.map((o) => o.kind)).toEqual(["channels.reorder", "channels.reorder"]);
    expect((await replan(guild, swapped)).ops).toEqual([]);
  });

  it("renames with renamedFrom instead of creating a new channel or role", async () => {
    const guild = freshServer();
    await sync(guild, exampleConfig);
    const before = guild.channels.find((c) => c.name === "general")?.id;
    const memberId = guild.roles.find((r) => r.name === "Member")?.id;

    const renamed = structuredClone(exampleConfig);
    const community = renamed.categories?.find((c) => c.name === "Community");
    const general = community?.channels?.find((c) => c.name === "general");
    if (!general) throw new Error("fixture");
    general.name = "Main Chat";
    general.renamedFrom = "general";
    renamed.roles = renamed.roles?.map((r) =>
      r.name === "Member" ? { ...r, name: "Builder", renamedFrom: "Member" } : r,
    );
    if (renamed.bot) renamed.bot.autoRole = "Builder";

    const plan = await sync(guild, renamed);
    expect(countOps(plan).create).toBe(0);
    expect(guild.channels.find((c) => c.name === "main-chat")?.id).toBe(before);
    expect(guild.roles.find((r) => r.name === "Builder")?.id).toBe(memberId);
  });

  it("matches text channel names the way Discord stores them", async () => {
    const guild = freshServer();
    guild.channels.push(guild.channel({ name: "off-topic", type: 0 }));
    const plan = await replan(guild, { name: "New Server", channels: [{ name: "Off Topic" }] });
    expect(plan.ops.filter((o) => o.kind === "channel.create")).toEqual([]);
  });

  it("never deletes without --prune, and deletes children before categories with it", async () => {
    const guild = freshServer();
    await guild.createRole({ name: "Old Role" });
    const input: ServerConfigInput = { name: "New Server", channels: [{ name: "general" }] };

    const safe = await replan(guild, input);
    expect(safe.ops.some((o) => o.kind.endsWith(".delete"))).toBe(false);
    expect(formatPlan(safe)).toContain('role "Old Role"');

    const pruned = await replan(guild, input, { prune: true });
    const deletes = pruned.ops
      .filter((o) => o.kind.endsWith(".delete"))
      .map((o) => ("name" in o ? o.name : ""));
    expect(deletes).toEqual(["General", "Text Channels", "Voice Channels", "Old Role"]);
    expect(formatPlan(pruned, { prune: true })).toContain("all its messages are lost");
  });

  it("deletes only the named items with --delete-channel/--delete-role", async () => {
    const guild = freshServer();
    await guild.createRole({ name: "Old Role" });
    const input: ServerConfigInput = { name: "New Server", channels: [{ name: "general" }] };
    const plan = await replan(guild, input, {
      deleteChannels: ["General"],
      deleteRoles: ["Old Role"],
    });
    const deletes = plan.ops
      .filter((o) => o.kind.endsWith(".delete"))
      .map((o) => ("name" in o ? o.name : ""));
    expect(deletes).toEqual(["General", "Old Role"]);
    const text = formatPlan(plan);
    expect(text).not.toContain("  voice channel #General\n");
    expect(text).toContain('category "Text Channels"');

    const managed = await replan(guild, input, { deleteChannels: ["general"] });
    expect(managed.issues.map((i) => i.message).join()).toContain("still in server.config.ts");
    const missing = await replan(guild, input, { deleteRoles: ["Ghost"] });
    expect(hasErrors(missing)).toBe(true);
  });

  it("keeps member overwrites and unmanaged role overwrites when setting channel permissions", async () => {
    const guild = freshServer();
    const other = guild.role({ name: "Other Bot Role", position: 1, managed: true });
    guild.roles.push(other);
    const ch = guild.channel({
      name: "secret",
      type: 0,
      overwrites: [
        { id: "555", type: 1, allow: "1024", deny: "0" },
        { id: other.id, type: 0, allow: "1024", deny: "0" },
      ],
    });
    guild.channels.push(ch);
    const input: ServerConfigInput = {
      name: "New Server",
      channels: [{ name: "secret", permissions: [{ role: "@everyone", deny: ["ViewChannel"] }] }],
    };
    await sync(guild, input);
    const live = guild.channels.find((c) => c.id === ch.id);
    expect(live?.overwrites).toEqual(
      expect.arrayContaining([
        { id: GUILD_ID, type: 0, allow: "0", deny: "1024" },
        { id: "555", type: 1, allow: "1024", deny: "0" },
        { id: other.id, type: 0, allow: "1024", deny: "0" },
      ]),
    );
    expect((await replan(guild, input)).ops).toEqual([]);
  });

  it("grants other bots channel access by their role name without editing them", async () => {
    const guild = freshServer();
    const mee6 = guild.role({ name: "MEE6", position: 1, managed: true });
    guild.roles.push(mee6);
    const input: ServerConfigInput = {
      name: "New Server",
      otherBots: ["MEE6"],
      channels: [
        {
          name: "bot-log",
          permissions: [
            { role: "@everyone", deny: ["ViewChannel"] },
            { role: "MEE6", allow: ["ViewChannel", "SendMessages"] },
          ],
        },
      ],
    };
    await sync(guild, input);
    const log = guild.channels.find((c) => c.name === "bot-log");
    expect(log?.overwrites).toContainEqual({ id: mee6.id, type: 0, allow: "3072", deny: "0" });
    expect((await replan(guild, input)).ops).toEqual([]);
    expect(guild.calls).not.toContain("modifyRole");

    const exported = snapshotToConfig(await guild.fetchSnapshot()).config;
    expect(exported.otherBots).toEqual(["MEE6"]);
    expect(buildPlan(config(exported), await guild.fetchSnapshot()).ops).toEqual([]);
  });

  it("blocks apply when an otherBots role is missing", async () => {
    const plan = await replan(freshServer(), { name: "New Server", otherBots: ["Ghost Bot"] });
    expect(plan.issues.map((i) => i.message).join()).toContain("Add that bot to the server first");
  });

  it("blocks apply when a managed role sits above the bot", async () => {
    const guild = freshServer();
    guild.roles.push(guild.role({ name: "Admin", position: 5 }));
    const plan = await replan(guild, { name: "New Server", roles: [{ name: "Admin" }] });
    expect(hasErrors(plan)).toBe(true);
    expect(formatPlan(plan)).toContain("drag the bot's role to the top");
  });

  it("blocks Community-only channel types on normal servers", async () => {
    const plan = await replan(freshServer(), {
      name: "New Server",
      channels: [{ name: "news", type: "announcement" }],
    });
    expect(plan.issues.some((i) => i.level === "error" && i.message.includes("Community"))).toBe(
      true,
    );
  });

  it("blocks granting permissions a non-admin bot doesn't have", async () => {
    const guild = freshServer();
    const bot = guild.roles.find((r) => r.id === BOT_ROLE_ID);
    if (bot) bot.permissions = "268435472"; // ManageRoles + ManageChannels
    const plan = await replan(guild, {
      name: "New Server",
      roles: [{ name: "Mod", permissions: ["BanMembers"] }],
    });
    expect(plan.issues.map((i) => i.message).join()).toContain("BanMembers");
  });

  it("uploads the icon only when the server has none (or when asked)", async () => {
    const guild = freshServer();
    const input = { name: "New Server", icon: "package.json" };
    expect((await replan(guild, input)).ops.map((o) => o.kind)).toEqual(["guild.update"]);
    guild.guild.icon = "abc";
    expect((await replan(guild, input)).ops).toEqual([]);
    expect((await replan(guild, input, { updateIcon: true })).ops).toHaveLength(1);
  });

  it("stops at the first failure and reports the step", async () => {
    const guild = freshServer();
    guild.createChannel = async () => {
      throw new Error("Missing Access");
    };
    const plan = buildPlan(
      config({ name: "Srv", channels: [{ name: "a" }] }),
      await guild.fetchSnapshot(),
    );
    await expect(applyPlan(plan, guild)).rejects.toThrow(/Failed on step 1\/.*Missing Access/s);
  });
});

describe("export", () => {
  it("round-trips a live server into a config that plans zero changes", async () => {
    const guild = freshServer();
    await sync(guild, exampleConfig);
    // Add some hand-made drift that export must capture.
    const lounge = guild.channels.find((c) => c.name === "Lounge");
    if (lounge) lounge.userLimit = 4;
    guild.channels.push(guild.channel({ name: "random", type: 0, topic: "misc", nsfw: true }));

    const snapshot = await guild.fetchSnapshot();
    const { config: exported, skipped } = snapshotToConfig(snapshot);
    expect(skipped).toEqual([]);
    const plan = buildPlan(config(exported), snapshot);
    expect(plan.ops).toEqual([]);
    expect(plan.unmanaged.channels).toEqual([]);

    const source = renderConfigSource(exported, ["generated"]);
    expect(source).toContain("export default defineServer({");
    expect(source).toContain('name: "Magic Community"');
  });
});
