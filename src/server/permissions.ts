import { PermissionFlagsBits } from "discord.js";

export type PermissionName = keyof typeof PermissionFlagsBits;

const DEPRECATED_ALIASES = new Set<string>(["ManageEmojisAndStickers"]);

export const ALL_PERMISSION_NAMES = Object.keys(PermissionFlagsBits) as PermissionName[];

/** Canonical names only (deprecated aliases removed), in Discord's bit order. */
export const PERMISSION_NAMES = ALL_PERMISSION_NAMES.filter((n) => !DEPRECATED_ALIASES.has(n));

export function toBits(names: readonly PermissionName[]): string {
  let bits = 0n;
  for (const name of names) bits |= PermissionFlagsBits[name];
  return bits.toString();
}

export function fromBits(bits: string | bigint): PermissionName[] {
  const value = BigInt(bits);
  return PERMISSION_NAMES.filter((name) => (value & PermissionFlagsBits[name]) !== 0n);
}

export function hasBits(have: string | bigint, need: string | bigint): boolean {
  const required = BigInt(need);
  return (BigInt(have) & required) === required;
}

/** Names present in `need` but missing from `have`. */
export function missingPermissions(have: string | bigint, need: string | bigint): PermissionName[] {
  return fromBits(BigInt(need) & ~BigInt(have));
}

export function describePermissionDiff(from: string, to: string): string {
  const before = new Set(fromBits(from));
  const after = new Set(fromBits(to));
  const added = [...after].filter((p) => !before.has(p)).map((p) => `+${p}`);
  const removed = [...before].filter((p) => !after.has(p)).map((p) => `-${p}`);
  const parts = [...added, ...removed];
  return parts.length > 0 ? parts.join(" ") : "(unknown bits changed)";
}
