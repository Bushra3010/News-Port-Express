#!/usr/bin/env node
// Exits non-zero unless DATABASE_URL actually authenticates.
//
// Pushing a secret that does not work is worse than failing: Wrangler reports
// success, the Worker takes the value, and the error only appears later as a
// 500 on a page. Nothing about the value is printed.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
if (url.includes("[DB-PASSWORD]")) {
  console.error("DATABASE_URL still holds a placeholder. Run ./scripts/set-secrets.sh first.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, ssl: "require", connect_timeout: 20, idle_timeout: 3 });
try {
  await sql`select 1`;
  console.log("  database connection verified");
  process.exit(0);
} catch (err) {
  const code = err?.code ?? err?.cause?.code ?? "";
  if (code === "28P01") {
    console.error("  the database rejected the password (28P01).");
    console.error("  Run ./scripts/set-secrets.sh and paste the password once;");
    console.error("  check the character count it reports before continuing.");
  } else {
    console.error(`  could not reach the database: ${code} ${String(err?.message).slice(0, 120)}`);
  }
  process.exit(1);
} finally {
  await sql.end({ timeout: 3 }).catch(() => {});
}
