---
name: discord-server
description: Customise the Discord server through server.config.ts - server name, description, icon, settings, roles, categories, channels, channel permissions, welcome message and auto-role - using the plan/apply workflow. Use for any request to change how the Discord server looks or who can see/do what.
---

# Customise the Discord server

`server.config.ts` is the single source of truth for the server's structure. You never click
around Discord for the user: you edit the config, preview, get approval, apply.

Field reference with examples: `docs/server-config.md`. Permission names are Discord.js
`PermissionFlagsBits` keys (`ViewChannel`, `SendMessages`, `ManageMessages`, ...); the editor and
`npm run typecheck` autocomplete and validate them.

## Workflow

1. **Understand** the request. If something is genuinely ambiguous (who should see a channel,
   whether to delete or keep something), ask with the question tool, recommending a default.
2. **Edit** `server.config.ts`. Keep the existing style and comments.
3. **Validate**: `npm run typecheck` (catches typos in field and permission names).
4. **Preview**: `npm run server:plan`. Read the whole output. Lines mean:
   `+` create, `~` update, `>` reorder, `-` DELETE, `!` warning, `x` error (blocks apply).
5. **Explain** the plan to the user in plain words, in a few bullets ("Creates a #memes channel in
   Community that only Members can see; moves #help above #showcase"). Mention warnings.
6. **Apply** after they agree: `npm run server:apply`. It backs up the current structure to
   `backups/`, applies, re-plans and confirms "Discord now matches server.config.ts".
7. If apply fails part-way, read the "Next step" hint, fix, and run plan/apply again; it picks up
   where it stopped.

Small, clearly-requested, non-destructive changes ("rename the server to X") still go through
plan, but you can apply straight after showing the plan if the user already said "go ahead".

## Translating requests

| User says                                      | Config change                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Rename the server" / "change the description" | `name` / `description`                                                                                                                             |
| "Use this logo"                                | Save the image as `assets/icon.png`, set `icon: "assets/icon.png"`. If the server already has an icon, apply with `-- --update-icon`.              |
| "Add a channel"                                | Add `{ name, topic }` to the right category's `channels`, in the position it should appear.                                                        |
| "Make it a voice / forum channel"              | `type: "voice"` / `"forum"`. Announcement and stage need a Community server.                                                                       |
| "Read-only channel"                            | `permissions: [{ role: "@everyone", deny: ["SendMessages", "CreatePublicThreads"] }, { role: "Moderator", allow: ["SendMessages"] }]`              |
| "Private / staff-only"                         | `permissions: [{ role: "@everyone", deny: ["ViewChannel"] }, { role: "Moderator", allow: ["ViewChannel"] }]` on the channel or the whole category. |
| "Only Members can see X"                       | `@everyone` deny `ViewChannel`, `Member` allow `ViewChannel`.                                                                                      |
| "Add a role"                                   | Add to `roles` (list is top = highest). `color: "#RRGGBB"`, `hoist: true` to list members separately, `permissions` = what it grants server-wide.  |
| "Rename #x to #y" / "rename role"              | Change `name`, add `renamedFrom: "x"`. Remove `renamedFrom` later (optional).                                                                      |
| "Reorder channels/roles"                       | Reorder them in the file.                                                                                                                          |
| "Slow mode"                                    | `slowmode: <seconds>` (not on announcement channels).                                                                                              |
| "Change the welcome message"                   | `bot.welcome.message`; placeholders `{user}` `{server}` `{memberCount}` `{#channel-name}`. Needs a redeploy to take effect on Railway.             |
| "Give new members a role automatically"        | `bot.autoRole: "<role name>"`. Needs Server Members Intent.                                                                                        |
| "Delete #x" / "remove role Y"                  | See Deleting below.                                                                                                                                |

Channels inherit their category's `permissions` unless they set their own. Omitting
`permissions` on a channel in a category without permissions leaves that channel's existing
permissions untouched. Member-specific overwrites and overwrites for roles not in the config are
always preserved.

## Deleting

Removing something from the config never deletes it; it shows under "Not in server.config.ts".
To delete:

1. Remove it from `server.config.ts`.
2. Preview just that deletion and show the user the `- DELETE` lines:
   `npm run server:plan -- --delete-channel "old-chat" --delete-role "Old Role"`
3. Tell the user plainly: deleting a channel erases its messages forever; backups only keep
   structure. Get an explicit yes for that exact list.
4. Apply with the same flags plus the count the plan printed:
   `npm run server:apply -- --delete-channel "old-chat" --delete-role "Old Role" --confirm-delete=2`

`--prune` deletes everything not in the config (including Discord's default channels). Only use it
when the user asked for exactly that after seeing the full list.

## Adopting or restoring

- Existing server, keep what's there: `npm run server:export` -> review
  `server.config.exported.ts` -> move it over `server.config.ts` (keep the `bot:` section).
- Re-create structure from a backup (e.g. after an accidental change):
  `npm run server:export -- --from backups/<file>.json --overwrite`, review, copy into
  `server.config.ts`, then plan/apply. Messages in deleted channels can't be restored.

## Not covered by the config

Members, messages, emojis/stickers, invites, onboarding, AutoMod, scheduled events, enabling
Community. Tell the user how to do these in Discord, or offer to extend `src/server/` (schema ->
plan -> apply -> export, with tests against `src/server/testing/fake-guild.ts`).
