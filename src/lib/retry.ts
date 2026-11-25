/**
 * Retrying queries whose connection died underneath them.
 *
 * Kept out of db.ts, and free of "server-only", so db/verify-retry.mjs can
 * exercise it directly against a database that drops connections.
 */
import type postgres from "postgres";

/**
 * Errors that mean the socket died rather than that the statement was bad.
 *
 * A Worker isolate is reused between requests and may be frozen in between, so
 * its timers never fire and postgres.js cannot notice that the pooler has long
 * since dropped the connection. The next query then fails on a dead socket.
 * Without this the site returns a 500 to a real reader after any quiet spell.
 */
export function isDeadConnection(err: unknown): boolean {
  const codes = new Set([
    "CONNECTION_CLOSED",
    "CONNECTION_ENDED",
    "CONNECTION_DESTROYED",
    "CONNECT_TIMEOUT",
    "ECONNRESET",
    "EPIPE",
  ]);
  let cur = err as { code?: unknown; cause?: unknown } | undefined;
  for (let depth = 0; cur && depth < 4; depth++) {
    if (typeof cur.code === "string" && codes.has(cur.code)) return true;
    cur = cur.cause as typeof cur;
  }
  return false;
}

export type Client = ReturnType<typeof postgres>;

/**
 * Retries a query once when the connection was dead, letting postgres.js open a
 * fresh socket.
 *
 * Losing the connection rolls back anything uncommitted, so a retried statement
 * or transaction cannot apply twice. The one exception is a statement that
 * committed just as the socket died, where the reply never arrived; a repeated
 * insert is caught by the unique indexes on slug, session id and the view and
 * vote primary keys, which is why a single retry is worth far more than the
 * stray 500s it removes.
 */
export function retryOnDeadConnection(client: Client): Client {
  const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

  // Retrying in the same tick reuses the socket postgres.js has not yet torn
  // down, so the second attempt fails the same way. A short pause lets it drop
  // the dead connection and dial a new one; two attempts cover the case where
  // the replacement is refused while the pooler is still cleaning up.
  const BACKOFF_MS = [25, 150, 500];

  const once = async <T>(exec: () => Promise<T>): Promise<T> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1]);
      try {
        return await exec();
      } catch (err) {
        if (!isDeadConnection(err)) throw err;
        lastErr = err;
      }
    }
    throw lastErr;
  };

  return new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown;
      if (typeof value !== "function") return value;
      const fn = value as (...args: unknown[]) => unknown;

      // Drizzle runs every statement through unsafe(), sometimes calling
      // .values() on the pending query, and uses begin() for transactions.
      if (prop === "unsafe") {
        return (...args: unknown[]) => {
          const start = () => fn.apply(target, args) as PromiseLike<unknown> & {
            values: () => PromiseLike<unknown>;
            execute: () => PromiseLike<unknown>;
          };
          return {
            then: (ok?: never, bad?: never) => once(async () => start()).then(ok, bad),
            catch: (bad?: never) => once(async () => start()).catch(bad),
            finally: (f?: never) => once(async () => start()).finally(f),
            values: () => once(async () => start().values()),
            execute: () => once(async () => start().execute()),
          };
        };
      }
      if (prop === "begin") {
        return (...args: unknown[]) => once(async () => fn.apply(target, args) as Promise<unknown>);
      }
      return fn.bind(target);
    },
  }) as Client;
}

