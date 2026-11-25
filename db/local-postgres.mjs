#!/usr/bin/env node
// A real Postgres server on localhost, backed by PGlite, speaking the wire
// protocol over TCP. It lets the whole application be exercised end to end
// without a Supabase project: the app, the migrations and the seed all connect
// to it exactly as they would to Supabase, minus TLS.
//
//   node db/local-postgres.mjs [port]
//
// Data lives in .local-pg/ so it survives restarts. Never used in production.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.argv[2] || 54329);
const db = await PGlite.create({ dataDir: ".local-pg" });

// Supabase ships these roles and db/rls.sql revokes privileges from them.
for (const role of ["anon", "authenticated", "service_role"]) {
  await db.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
      CREATE ROLE ${role} NOLOGIN;
    END IF;
  END $$;`);
}

const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
await server.start();
console.log(`local postgres listening on 127.0.0.1:${port}`);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
