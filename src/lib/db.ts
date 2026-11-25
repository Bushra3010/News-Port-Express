import "server-only";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { retryOnDeadConnection } from "./retry";

/**
 * Supabase Postgres connection.
 *
 * On Cloudflare Workers postgres.js resolves its `workerd` export, which speaks
 * TCP over `cloudflare:sockets`. Supabase must therefore be reached through the
 * Supavisor *transaction* pooler (port 6543) and prepared statements must be
 * off: transaction pooling can hand out a different backend per statement.
 */

type Env = Record<string, string | undefined>;

/** Hyperdrive hands the Worker a ready-made connection string. */
type Bindings = { HYPERDRIVE?: { connectionString?: string } };

let cachedEnv: Env | undefined;

/** The raw Worker env, which getEnv() cannot carry because bindings are objects. */
function getBindings(): Bindings | undefined {
  try {
    return getCloudflareContext().env as unknown as Bindings;
  } catch {
    return undefined;
  }
}

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

function isLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/**
 * Where to connect, and whether TLS is needed.
 *
 * In the Worker this is Hyperdrive: workerd rejects Supabase's wildcard pooler
 * certificate, so a direct connection fails the TLS handshake. Hyperdrive sits
 * on Cloudflare's side of that, and the Worker reaches it locally, so TLS is
 * neither needed nor possible on this hop.
 *
 * Outside the Worker — migrations, scripts, `next dev` without a binding — it
 * falls back to DATABASE_URL, with TLS unless the host is loopback.
 */
function connection(): { url: string; ssl: boolean } {
  const hyperdrive = getBindings()?.HYPERDRIVE?.connectionString;
  if (hyperdrive) return { url: hyperdrive, ssl: false };
  const url = requireEnv("DATABASE_URL");
  return { url, ssl: !isLoopback(url) };
}

/**
 * One connection per request.
 *
 * A Worker may not touch a socket that was opened while handling a different
 * request — it fails with "Cannot perform I/O on behalf of a different
 * request". Holding the client at module scope therefore works for the first
 * request an isolate serves and breaks every one after it, which reads as
 * random 500s rather than as a connection bug.
 *
 * React's cache() scopes the client to the current request, so every call
 * during one request shares a connection and none outlives it. Hyperdrive does
 * the pooling, so opening a connection per request is cheap.
 */
export const getDb = cache(() => {
  const { url, ssl } = connection();
  const client = postgres(url, {
    // One connection per request; Hyperdrive pools on Cloudflare's side.
    max: 1,
    // Required by transaction-mode pooling, which can move each statement to a
    // different backend.
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: ssl ? "require" : false,
    // Hyperdrive advises against type discovery: it adds a round trip to every
    // new connection and the schema uses only built-in types.
    fetch_types: false,
  });
  return drizzle(retryOnDeadConnection(client), { schema });
});

export type DB = ReturnType<typeof getDb>;

export function siteUrl(): string {
  return (getEnv().SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}
