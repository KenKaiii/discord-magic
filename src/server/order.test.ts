import { describe, expect, it } from "vitest";
import { planChannelPositions, planRolePositions } from "./order.ts";
import type { LiveRole } from "./types.ts";

const role = (id: string, position: number): LiveRole => ({
  id,
  name: id,
  color: 0,
  hoist: false,
  mentionable: false,
  permissions: "0",
  position,
  managed: false,
});

describe("planRolePositions", () => {
  it("puts managed roles under the bot and leaves roles above the bot alone", () => {
    const roles = [
      role("0", 0),
      role("1", 1),
      role("2", 2),
      role("3", 3),
      role("9", 4),
      role("8", 5),
    ];
    // bot role "9" at 4; "8" is above the bot and must not move.
    const result = planRolePositions(roles, ["9"], "0", ["1", "3"]);
    expect(result).toEqual([
      { id: "1", position: 3 },
      { id: "3", position: 2 },
      { id: "2", position: 1 },
    ]);
  });

  it("returns null when already ordered", () => {
    const roles = [role("0", 0), role("1", 2), role("2", 1), role("9", 3)];
    expect(planRolePositions(roles, ["9"], "0", ["1", "2"])).toBeNull();
  });
});

describe("planChannelPositions", () => {
  it("ignores text/voice interleaving Discord can't display anyway", () => {
    const group = [
      { id: "1", type: 0, position: 0 },
      { id: "2", type: 2, position: 1 },
      { id: "3", type: 0, position: 2 },
    ];
    expect(planChannelPositions(group, ["1", "3", "2"])).toBeNull();
    expect(planChannelPositions(group, ["3", "1", "2"])).toEqual([
      { id: "3", position: 0 },
      { id: "1", position: 1 },
      { id: "2", position: 2 },
    ]);
  });
});
