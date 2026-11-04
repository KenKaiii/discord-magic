import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { describeOp } from "./format.ts";
import { hasDistinctRolePositions, planChannelPositions, planRolePositions } from "./order.ts";
import {
  CATEGORIES_GROUP,
  CATEGORY_TYPE,
  type ChannelRefField,
  type Op,
  type OverwritePlan,
  type Plan,
  TOP_LEVEL_GROUP,
} from "./plan.ts";
import { EVERYONE } from "./schema.ts";
import type { GuildApi, GuildBody, OverwriteBody } from "./types.ts";

export class ApplyError extends Error {
  override name = "ApplyError";
  readonly completed: number;
  readonly failedOp: Op;

  constructor(message: string, completed: number, failedOp: Op, cause: unknown) {
    super(message, { cause });
    this.completed = completed;
    this.failedOp = failedOp;
  }
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

async function imageDataUri(path: string): Promise<string> {
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error(`Icon must be .png, .jpg or .gif: ${path}`);
  const data = await readFile(path);
  return `data:${mime};base64,${data.toString("base64")}`;
}

/** Runs a plan in order. Stops at the first failure; re-running plan/apply picks up where it left off. */
export async function applyPlan(
  plan: Plan,
  api: GuildApi,
  log: (line: string) => void = () => {},
): Promise<{ completed: number }> {
  const roleIds: Record<string, string> = { ...plan.roleIds };
  const channelIds: Record<string, string> = { ...plan.channelIds };

  const need = (map: Record<string, string>, key: string, what: string): string => {
    const id = map[key];
    if (!id) throw new Error(`Internal: no id for ${what} "${key}"`);
    return id;
  };
  const overwriteBodies = (o: OverwritePlan): OverwriteBody[] => [
    ...o.managed.map((m) => ({
      id: m.target === EVERYONE ? plan.guildId : need(roleIds, m.target, "role"),
      type: 0 as const,
      allow: m.allow,
      deny: m.deny,
    })),
    ...o.preserved.map(({ id, type, allow, deny }) => ({ id, type, allow, deny })),
  ];

  const run = async (op: Op): Promise<void> => {
    switch (op.kind) {
      case "role.create":
        roleIds[op.name] = (await api.createRole(op.body)).id;
        return;
      case "role.update":
        return api.modifyRole(op.id, op.body);
      case "everyone.update":
        return api.modifyRole(plan.guildId, { permissions: op.permissions });
      case "roles.reorder": {
        let snap = await api.fetchSnapshot();
        if (!hasDistinctRolePositions(snap.roles)) {
          // Setting any position makes Discord renumber every role; do a no-op move first.
          const lowest = snap.roles
            .filter((r) => r.id !== plan.guildId && !r.managed)
            .sort((a, b) => a.position - b.position)[0];
          if (lowest) await api.setRolePositions([{ id: lowest.id, position: lowest.position }]);
          snap = await api.fetchSnapshot();
        }
        const ids = plan.roleOrder.map((n) => roleIds[n]).filter((id): id is string => !!id);
        const positions = planRolePositions(snap.roles, snap.bot.roleIds, plan.guildId, ids);
        if (positions) await api.setRolePositions(positions);
        return;
      }
      case "channel.create": {
        const created = await api.createChannel({
          ...op.body,
          ...(op.parentKey ? { parent_id: need(channelIds, op.parentKey, "category") } : {}),
          ...(op.overwrites ? { permission_overwrites: overwriteBodies(op.overwrites) } : {}),
        });
        channelIds[op.key] = created.id;
        return;
      }
      case "channel.update":
        return api.modifyChannel(op.id, {
          ...op.body,
          ...(op.parentKey !== undefined
            ? { parent_id: op.parentKey ? need(channelIds, op.parentKey, "category") : null }
            : {}),
          ...(op.overwrites ? { permission_overwrites: overwriteBodies(op.overwrites) } : {}),
        });
      case "channels.reorder": {
        const snap = await api.fetchSnapshot();
        const keys = plan.channelOrder[op.group] ?? [];
        const ids = keys.map((k) => channelIds[k]).filter((id): id is string => !!id);
        const parentId =
          op.group === CATEGORIES_GROUP || op.group === TOP_LEVEL_GROUP
            ? null
            : need(channelIds, op.group, "category");
        const group = snap.channels.filter((c) =>
          op.group === CATEGORIES_GROUP
            ? c.type === CATEGORY_TYPE
            : c.type !== CATEGORY_TYPE && c.parentId === parentId,
        );
        const positions = planChannelPositions(group, ids);
        if (positions) await api.setChannelPositions(positions);
        return;
      }
      case "guild.update": {
        const body: GuildBody = { ...op.body };
        for (const [field, key] of Object.entries(op.channelRefs) as [
          ChannelRefField,
          string | null,
        ][])
          body[field] = key === null ? null : need(channelIds, key, "channel");
        if (op.iconPath) body.icon = await imageDataUri(op.iconPath);
        return api.modifyGuild(body);
      }
      case "channel.delete":
        return api.deleteChannel(op.id);
      case "role.delete":
        return api.deleteRole(op.id);
    }
  };

  let completed = 0;
  for (const op of plan.ops) {
    log(describeOp(op));
    try {
      await run(op);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new ApplyError(
        `Failed on step ${completed + 1}/${plan.ops.length}: ${describeOp(op)}\n  Discord said: ${reason}`,
        completed,
        op,
        cause,
      );
    }
    completed++;
  }
  return { completed };
}
