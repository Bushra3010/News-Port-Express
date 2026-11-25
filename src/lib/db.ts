import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getEnv(): CloudflareEnv {
  return getCloudflareContext().env;
}

export function getDb() {
  return drizzle(getEnv().DB, { schema });
}

export type DB = ReturnType<typeof getDb>;

export function siteUrl(): string {
  return (getEnv().SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}
