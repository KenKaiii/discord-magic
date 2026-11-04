import type { LiveChannel, LiveRole } from "./types.ts";

export function compareSnowflakes(a: string, b: string): number {
  const x = BigInt(a.replace(/\D/g, "") || "0");
  const y = BigInt(b.replace(/\D/g, "") || "0");
  return x < y ? -1 : x > y ? 1 : 0;
}

const VOICE_LIKE = new Set([2, 13]);

/** Discord shows text-like channels above voice-like ones inside a category, whatever their position. */
export function channelClass(type: number): "text" | "voice" {
  return VOICE_LIKE.has(type) ? "voice" : "text";
}

export function sortChannels<T extends Pick<LiveChannel, "id" | "position">>(channels: T[]): T[] {
  return [...channels].sort((a, b) => a.position - b.position || compareSnowflakes(a.id, b.id));
}

export function sortRolesTopDown<T extends Pick<LiveRole, "id" | "position">>(roles: T[]): T[] {
  return [...roles].sort((a, b) => b.position - a.position || compareSnowflakes(a.id, b.id));
}

/**
 * Role ids strictly below the bot's highest role, in displayed order. Discord gives new roles
 * duplicate positions and breaks ties by id, so this uses rank, never the raw position.
 */
export function rolesBelowBot(
  roles: Pick<LiveRole, "id" | "position">[],
  botRoleIds: string[],
  guildId: string,
): string[] {
  const ranked = sortRolesTopDown(roles.filter((r) => r.id !== guildId));
  const botIndex = ranked.findIndex((r) => botRoleIds.includes(r.id));
  return ranked.slice(botIndex + 1).map((r) => r.id);
}

/** True when the role is listed at or above the bot's highest role (so the bot can't manage it). */
export function isAtOrAboveBot(
  roles: Pick<LiveRole, "id" | "position">[],
  botRoleIds: string[],
  guildId: string,
  roleId: string,
): boolean {
  return roleId !== guildId && !rolesBelowBot(roles, botRoleIds, guildId).includes(roleId);
}

/** Every role has a distinct position (Discord renumbers them whenever positions are set). */
export function hasDistinctRolePositions(roles: Pick<LiveRole, "position">[]): boolean {
  return new Set(roles.map((r) => r.position)).size === roles.length;
}

/**
 * Config roles sit directly below the bot's highest role, in config order; other roles below
 * the bot keep their relative order underneath. Roles at/above the bot are never touched.
 * Positions assume distinct positions (see hasDistinctRolePositions). Null when nothing moves.
 */
export function planRolePositions(
  roles: LiveRole[],
  botRoleIds: string[],
  guildId: string,
  managedIdsTopDown: string[],
): { id: string; position: number }[] | null {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const below = rolesBelowBot(roles, botRoleIds, guildId).flatMap((id) => byId.get(id) ?? []);
  const belowIds = new Set(below.map((r) => r.id));
  const managed = managedIdsTopDown.filter((id) => belowIds.has(id));
  const managedSet = new Set(managed);
  const target = [...managed, ...below.filter((r) => !managedSet.has(r.id)).map((r) => r.id)];
  if (target.every((id, i) => id === below[i]?.id)) return null;
  return target.map((id, i) => ({ id, position: target.length - i }));
}

/**
 * Orders one sibling group (same parent). Managed channels come first in config order, then
 * unmanaged ones in their current order. Returns null when Discord would already show this order.
 */
export function planChannelPositions(
  group: Pick<LiveChannel, "id" | "position" | "type">[],
  managedIdsInOrder: string[],
): { id: string; position: number }[] | null {
  const current = sortChannels(group);
  const ids = new Set(current.map((c) => c.id));
  const managed = managedIdsInOrder.filter((id) => ids.has(id));
  const managedSet = new Set(managed);
  const target = [...managed, ...current.filter((c) => !managedSet.has(c.id)).map((c) => c.id)];

  const typeOf = new Map(current.map((c) => [c.id, c.type]));
  const byClass = (list: string[], cls: "text" | "voice") =>
    list.filter((id) => channelClass(typeOf.get(id) ?? 0) === cls).join(",");
  const currentIds = current.map((c) => c.id);
  const same = (["text", "voice"] as const).every(
    (cls) => byClass(currentIds, cls) === byClass(target, cls),
  );
  if (same) return null;
  return target.map((id, i) => ({ id, position: i }));
}
