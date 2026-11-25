import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { publicWhere, recordView } from "@/lib/news";
import { articles } from "@/lib/schema";
import { toInt } from "@/lib/util";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless/i;

export async function POST(req: Request) {
  if (BOT.test(req.headers.get("user-agent") || "")) return new Response(null, { status: 204 });
  let id: number | null = null;
  try {
    id = toInt(((await req.json()) as { id?: unknown }).id);
  } catch {
    /* bad body */
  }
  if (!id) return new Response(null, { status: 400 });
  const exists = await getDb().select({ id: articles.id }).from(articles).where(and(eq(articles.id, id), publicWhere())).get();
  if (exists) await recordView(id);
  return new Response(null, { status: 204 });
}
