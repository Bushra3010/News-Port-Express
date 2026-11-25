import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Supabase Postgres connection.
 *
 * On Cloudflare Workers postgres.js resolves its `workerd` export, which speaks
 * TCP over `cloudflare:sockets`. Supabase must therefore be reached through the
 * Supavisor *transaction* pooler (port 6543) and prepared statements must be
 * off: transaction pooling can hand out a different backend per statement.
 */

type Env = Record<string, string | undefined>;

let cachedEnv: Env | undefined;

/** Worker vars and secrets, falling back to process.env for scripts and builds. */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const merged: Env = { ...(process.env as Env) };
  let fromWorker: Env | undefined;
  try {
    fromWorker = getCloudflareContext().env as unknown as Env;
  } catch {
    // Outside a Cloudflare request context (build step, CLI scripts).
    fromWorker = undefined;
  }
  if (fromWorker) {
    for (const [k, v] of Object.entries(fromWorker)) if (typeof v === "string") merged[k] = v;
    // Only cache once the real Worker env has been seen, so a lookup during the
    // build does not freeze an empty environment for the whole isolate.
    cachedEnv = merged;
  }
  return merged;
}

export function requireEnv(name: string): string {
  const v = getEnv()[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. See .dev.vars.example.`);
  return v;
}

let sql: ReturnType<typeof postgres> | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;
let connectedWith: string | undefined;

export function getDb() {
  const url = requireEnv("DATABASE_URL");
  if (db && connectedWith === url) return db;
  sql = postgres(url, {
    // One connection per isolate; Supavisor multiplexes on its side.
    max: 1,
    // Required by Supavisor transaction mode.
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: "require",
  });
  db = drizzle(sql, { schema });
  connectedWith = url;
  return db;
}

export type DB = ReturnType<typeof getDb>;

export function siteUrl(): string {
  return (getEnv().SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}
