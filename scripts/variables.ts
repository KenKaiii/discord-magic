import { readFileSync } from "node:fs";

export interface VariableSpec {
  key: string;
  /** The comment above it in .env.example: where the user gets the value. */
  help: string;
}

/**
 * Every uncommented `KEY=` line in .env.example is a variable the bot needs everywhere:
 * doctor checks it, `npm run deploy` copies it to Railway, and .railway/railway.ts keeps it.
 * Commented lines (`# PORT=3000`) are optional or local-only and stay out.
 */
export function parseVariables(example: string): VariableSpec[] {
  const specs: VariableSpec[] = [];
  let comments: string[] = [];
  for (const raw of example.split(/\r?\n/)) {
    const line = raw.trim();
    const key = line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1];
    if (key) {
      specs.push({ key, help: comments.join(" ") });
      comments = [];
    } else if (line.startsWith("#")) comments.push(line.replace(/^#+\s?/, ""));
    else comments = [];
  }
  return specs;
}

export function readVariables(
  file: URL | string = new URL("../.env.example", import.meta.url),
): VariableSpec[] {
  return parseVariables(readFileSync(file, "utf8"));
}

export function missingVariables(
  specs: VariableSpec[],
  env: NodeJS.ProcessEnv = process.env,
): VariableSpec[] {
  return specs.filter((s) => !env[s.key]?.trim());
}
