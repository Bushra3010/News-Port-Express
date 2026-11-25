import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  // Migrations need a session connection: DDL and advisory locks do not work
  // through a transaction pooler.
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || "" },
} satisfies Config;
