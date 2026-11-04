import { describe, expect, it } from "vitest";
import exampleConfig from "../../server.config.ts";
import { fromBits, toBits } from "./permissions.ts";
import { normalizeChannelName, parseServerConfig } from "./schema.ts";

describe("server config schema", () => {
  it("accepts the shipped server.config.ts", () => {
    expect(() => parseServerConfig(exampleConfig)).not.toThrow();
  });

  it.each([
    [{ name: "S", roles: [{ name: "A" }, { name: "A" }] }, 'Duplicate role "A"'],
    [
      { name: "S", channels: [{ name: "x", permissions: [{ role: "Ghost" }] }] },
      'Unknown role "Ghost"',
    ],
    [{ name: "S", settings: { systemChannel: "nope" } }, 'No text channel named "nope"'],
    [{ name: "S", bot: { autoRole: "Nobody" } }, 'Unknown role "Nobody"'],
    [{ name: "S", otherBots: ["MEE6"], bot: { autoRole: "MEE6" } }, 'Unknown role "MEE6"'],
    [{ name: "S", roles: [{ name: "A" }], otherBots: ["A"] }, "listed twice"],
    [{ name: "S", bot: { brandColor: "blue" } }, "hex colour"],
    [{ name: "S", roles: [{ name: "A", permissions: ["Fly"] }] }, "roles"],
    [{ name: "S", roles: [{ name: "A", colour: "#fff" }] }, "colour"],
  ])("rejects bad config %#", (input, message) => {
    expect(() => parseServerConfig(input)).toThrow(message);
  });

  it("normalizes text channel names like Discord does", () => {
    expect(normalizeChannelName("text", "  Off Topic ")).toBe("off-topic");
    expect(normalizeChannelName("voice", "Off Topic")).toBe("Off Topic");
  });

  it("round-trips permission names through bits", () => {
    expect(fromBits(toBits(["ViewChannel", "SendMessages"]))).toEqual([
      "ViewChannel",
      "SendMessages",
    ]);
    expect(fromBits(toBits(["ManageEmojisAndStickers"]))).toEqual(["ManageGuildExpressions"]);
  });
});
