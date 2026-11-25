#!/usr/bin/env node
// Applies a .sql file to Supabase Postgres.
//
// Used for files drizzle-kit does not own (RLS, seed data). Statements run
// inside one transaction, so a failure applies nothing.
//
//   node --env-file=.dev.vars db/run-sql.mjs db/rls.sql
//
// Reads MIGRATION_DATABASE_URL if set, else DATABASE_URL. Prefer a *session*
// connection (port 5432) here: DDL does not belong on a transaction pooler.
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const file = process.argv[2];
if (!file) {
  console.error("usage: node db/run-sql.mjs <file.sql>");
  process.exit(1);
}

const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set MIGRATION_DATABASE_URL or DATABASE_URL (see .dev.vars.example).");
  process.exit(1);
}

const sqlText = await readFile(file, "utf8");
// Supabase demands TLS; a local development server has none.
let loopback = false;
try {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  loopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
} catch {}

const sql = postgres(url, { max: 1, prepare: false, ssl: loopback ? false : "require", idle_timeout: 5 });

try {
  await sql.begin((tx) => [tx.unsafe(sqlText)]);
  console.log(`applied ${file}`);
} catch (err) {
  console.error(`failed to apply ${file}:`);
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
