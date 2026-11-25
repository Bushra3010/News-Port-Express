import { eq, or, sql } from "drizzle-orm";
import { apiUser, deny } from "@/lib/admin-api";
import { can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { articleMedia, articles, categories, media } from "@/lib/schema";
import { audit } from "@/lib/audit";
import { cleanText, toInt } from "@/lib/util";

type P = { params: Promise<{ id: string }> };

async function load(req: Request, p: P, mutating: boolean) {
  const user = await apiUser(req, mutating);
  if (user instanceof Response) return { error: user };
  const id = toInt((await p.params).id);
  const m = id ? await getDb().select().from(media).where(eq(media.id, id)).limit(1).then((r) => r[0]) : undefined;
  if (!m) return { error: Response.json({ error: "Not found" }, { status: 404 }) };
  // Uploaders can edit their own files; media.manage can edit anything.
  if (!can(user, "media.manage") && m.uploadedBy !== user.id) return { error: deny() };
  return { user, m };
}

export async function PATCH(req: Request, p: P) {
  const r = await load(req, p, true);
  if ("error" in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const set = {
    alt: cleanText(body.alt, 250) || null,
    title: cleanText(body.title, 200) || null,
    description: cleanText(body.description, 1000) || null,
  };
  await getDb().update(media).set(set).where(eq(media.id, r.m.id));
  await audit(r.user, "media.update", "media", r.m.id);
  return Response.json({ ok: true, item: { ...r.m, ...set } });
}

export async function DELETE(req: Request, p: P) {
  const r = await load(req, p, true);
  if ("error" in r) return r.error;
  const db = getDb();
  const id = r.m.id;
  const used = await db.select({ n: sql<number>`count(*)::int` }).from(articles)
    .where(or(eq(articles.featuredMediaId, id), eq(articles.ogMediaId, id), eq(articles.videoMediaId, id), sql`${articles.content} ILIKE ${"%" + r.m.storageKey + "%"}`)).limit(1).then((r) => r[0]);
  const inGallery = await db.select({ n: sql<number>`count(*)::int` }).from(articleMedia).where(eq(articleMedia.mediaId, id)).limit(1).then((r) => r[0]);
  const inCat = await db.select({ n: sql<number>`count(*)::int` }).from(categories).where(eq(categories.imageMediaId, id)).limit(1).then((r) => r[0]);
  const n = (used?.n ?? 0) + (inGallery?.n ?? 0) + (inCat?.n ?? 0);
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (n && !force) return Response.json({ error: `This file is used in ${n} place(s). Delete anyway?`, inUse: n }, { status: 409 });
  await deleteObject(r.m.storageKey);
  await db.delete(media).where(eq(media.id, id));
  await audit(r.user, "media.delete", "media", id, { filename: r.m.filename, inUse: n });
  return Response.json({ ok: true });
}
