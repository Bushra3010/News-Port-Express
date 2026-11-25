import "server-only";
import { sql } from "drizzle-orm";
import { getDb, getEnv, siteUrl } from "./db";
import { users } from "./schema";

export async function userCount() {
  const r = await getDb().select({ n: sql<number>`count(*)` }).from(users).get();
  return r?.n ?? 0;
}

export function setupToken(): string | undefined {
  return (getEnv() as unknown as Record<string, string | undefined>).SETUP_TOKEN || undefined;
}

/** Production requires a SETUP_TOKEN secret so nobody else can claim the first account. */
export async function setupNeedsToken() {
  return siteUrl().startsWith("https://") || !!setupToken();
}

