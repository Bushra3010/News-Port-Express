import { asc, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { pollVotes } from "@/lib/schema";
import { getSettings } from "@/lib/settings";

async function tally(pollId: string, n: number) {
  const rows = await getDb().select().from(pollVotes).where(eq(pollVotes.pollId, pollId)).orderBy(asc(pollVotes.optionIndex));
  return Array.from({ length: n }, (_, i) => rows.find((r) => r.optionIndex === i)?.votes ?? 0);
}

export async function GET(req: Request) {
  const { poll } = await getSettings();
  const id = new URL(req.url).searchParams.get("id");
  if (!poll.enabled || id !== poll.id) return Response.json({ votes: [] });
  return Response.json({ votes: await tally(poll.id, poll.options.length) });
}

export async function POST(req: Request) {
  const { poll } = await getSettings();
  let body: { id?: string; option?: number } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  if (!poll.enabled || body.id !== poll.id || !Number.isInteger(body.option) || body.option! < 0 || body.option! >= poll.options.length) {
    return Response.json({ error: "invalid vote" }, { status: 400 });
  }
  const jar = await cookies();
  const cookie = `np_poll_${poll.id.replace(/[^a-z0-9-]/gi, "")}`;
  if (!jar.get(cookie)) {
    await getDb()
      .insert(pollVotes)
      .values({ pollId: poll.id, optionIndex: body.option!, votes: 1 })
      .onConflictDoUpdate({ target: [pollVotes.pollId, pollVotes.optionIndex], set: { votes: sql`${pollVotes.votes} + 1` } });
    jar.set(cookie, "1", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 90, path: "/" });
  }
  return Response.json({ votes: await tally(poll.id, poll.options.length) });
}
