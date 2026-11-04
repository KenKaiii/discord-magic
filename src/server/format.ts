import { CATEGORY_TYPE, channelLabel, countOps, type Op, type Plan } from "./plan.ts";

const changeList = (changes: { field: string; from: string; to: string }[]): string =>
  changes
    .map((c) => (c.from ? `${c.field}: ${c.from} -> ${c.to}` : `${c.field}: ${c.to}`))
    .join("; ");

export function describeOp(op: Op): string {
  switch (op.kind) {
    case "role.create":
      return `+ create role "${op.name}"`;
    case "role.update":
      return `~ update role "${op.name}" (${changeList(op.changes)})`;
    case "everyone.update":
      return `~ update @everyone (${changeList(op.changes)})`;
    case "roles.reorder":
      return "> reorder roles to match the config";
    case "channel.create": {
      const where = op.parentKey ? ` in "${op.parentKey.slice("category:".length)}"` : "";
      return `+ create ${channelLabel(op.name, op.type)}${where}`;
    }
    case "channel.update":
      return `~ update ${channelLabel(op.name, op.type)} (${changeList(op.changes)})`;
    case "channels.reorder":
      return `> reorder ${op.label}`;
    case "guild.update":
      return `~ update server settings (${changeList(op.changes)})`;
    case "channel.delete":
      return op.type === CATEGORY_TYPE
        ? `- DELETE ${channelLabel(op.name, op.type)} (its channels are kept, moved out of the category)`
        : `- DELETE ${channelLabel(op.name, op.type)} (all its messages are lost for good)`;
    case "role.delete":
      return `- DELETE role "${op.name}" (members lose it)`;
  }
}

export function formatPlan(plan: Plan, options: { prune?: boolean } = {}): string {
  const lines: string[] = [`Server "${plan.guildName}" (${plan.guildId})`, ""];
  if (plan.ops.length === 0) lines.push("No changes: Discord already matches server.config.ts.");
  else for (const op of plan.ops) lines.push(`  ${describeOp(op)}`);

  const deleting = new Set(
    plan.ops.flatMap((op) => (op.kind.endsWith(".delete") && "id" in op ? [op.id] : [])),
  );
  const roles = plan.unmanaged.roles.filter((r) => !deleting.has(r.id));
  const channels = plan.unmanaged.channels.filter((c) => !deleting.has(c.id));
  if (!options.prune && (roles.length > 0 || channels.length > 0)) {
    lines.push("", "Not in server.config.ts (left alone unless you ask to delete them):");
    for (const r of roles) lines.push(`  role "${r.name}"`);
    for (const c of channels) lines.push(`  ${channelLabel(c.name, c.type)}`);
  }

  const warnings = plan.issues.filter((i) => i.level === "warning");
  const errors = plan.issues.filter((i) => i.level === "error");
  if (warnings.length > 0) lines.push("", "Warnings:", ...warnings.map((w) => `  ! ${w.message}`));
  if (errors.length > 0)
    lines.push(
      "",
      "Errors (apply is blocked until fixed):",
      ...errors.map((e) => `  x ${e.message}`),
    );

  const n = countOps(plan);
  lines.push(
    "",
    `Summary: ${n.create} to create, ${n.update} to update, ${n.reorder} to reorder, ${n.delete} to delete.`,
  );
  return lines.join("\n");
}
