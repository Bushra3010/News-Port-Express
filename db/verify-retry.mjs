#!/usr/bin/env node
// Proves the dead-connection retry works where it matters: through Drizzle,
// against a server that really does drop pooled connections.
//
// The local PGlite socket server resets a reused connection often, which is
// the same failure a Worker sees when the pooler drops a socket while the
// isolate was frozen. Run db/local-postgres.mjs first.
//
//   node --experimental-strip-types db/verify-retry.mjs
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { retryOnDeadConnection, isDeadConnection } from "../src/lib/retry.ts";
import * as schema from "../src/lib/schema.ts";

const URL_ = process.env.LOCAL_PG ?? "postgresql://postgres:postgres@127.0.0.1:54329/postgres";
const ROUNDS = Number(process.env.ROUNDS ?? 60);
// Idle time is what actually kills a pooled socket, so leave gaps: that is
// the Worker case, where the isolate is frozen between requests.
const PAUSE_MS = Number(process.env.PAUSE_MS ?? 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const connect = (wrap) => {
  const client = postgres(URL_, { max: 1, prepare: false, ssl: false, idle_timeout: 20 });
  return { client, db: drizzle(wrap ? retryOnDeadConnection(client) : client, { schema }) };
};

async function run(label, wrap) {
  const { client, db } = connect(wrap);
  let ok = 0, fail = 0;
  const codes = new Map();
  for (let i = 0; i < ROUNDS; i++) {
    if (PAUSE_MS && i) await sleep(PAUSE_MS);
    try {
      // A select, an aggregate and a transaction: the three shapes the app uses.
      await db.select().from(schema.settings);
      await db.select({ n: sql`count(*)::int` }).from(schema.categories);
      if (i % 10 === 0) {
        await db.transaction(async (tx) => {
          await tx.select({ n: sql`count(*)::int` }).from(schema.roles);
        });
      }
      ok++;
    } catch (err) {
      fail++;
      const c = err?.cause?.code ?? err?.code ?? String(err?.message).slice(0, 30);
      codes.set(c, (codes.get(c) ?? 0) + 1);
    }
  }
  await client.end({ timeout: 5 }).catch(() => {});
  console.log(`${label.padEnd(26)} ok=${String(ok).padStart(3)}  failed=${String(fail).padStart(3)}  ${fail ? JSON.stringify([...codes]) : ""}`);
  return fail;
}

console.log("\nerror classification");
for (const [name, err, want] of [
  ["ECONNRESET", Object.assign(new Error("x"), { code: "ECONNRESET" }), true],
  ["nested ECONNRESET", Object.assign(new Error("x"), { cause: { code: "ECONNRESET" } }), true],
  ["CONNECTION_CLOSED", Object.assign(new Error("x"), { code: "CONNECTION_CLOSED" }), true],
  ["syntax error (real bug)", Object.assign(new Error("x"), { code: "42601" }), false],
  ["unique violation", Object.assign(new Error("x"), { code: "23505" }), false],
  ["plain Error", new Error("x"), false],
]) {
  const got = isDeadConnection(err);
  console.log(`  ${got === want ? "ok  " : "FAIL"} ${name.padEnd(26)} treated as dead connection: ${got}`);
  if (got !== want) process.exitCode = 1;
}

console.log(`\n${ROUNDS} rounds against a connection-dropping server`);
const bare = await run("without retry", false);
const wrapped = await run("with retry", true);

console.log();
if (wrapped > bare) {
  console.log(`FAIL: the wrapper made things worse (${wrapped} vs ${bare}).`);
  process.exitCode = 1;
} else if (bare === 0) {
  console.log("Inconclusive: the server never dropped a connection this run; try more ROUNDS.");
} else if (wrapped === 0) {
  console.log(`Retry absorbed all ${bare} dropped connections.`);
} else {
  console.log(`Retry cut failures from ${bare} to ${wrapped}.`);
}
