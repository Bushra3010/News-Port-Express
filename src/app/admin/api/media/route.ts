import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { apiUser, deny } from "@/lib/admin-api";
import { can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { putObject } from "@/lib/storage";
import { media, users } from "@/lib/schema";
import { audit } from "@/lib/audit";
import { cleanText } from "@/lib/util";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 95 * 1024 * 1024; // Workers accept request bodies up to 100 MB on most plans

const PER = 30;

export async function GET(req: Request) {
  const user = await apiUser(req);
  if (user instanceof Response) return user;
  if (!can(user, "media.upload")) return deny();
  const u = new URL(req.url);
  const q = cleanText(u.searchParams.get("q"), 80);
  const kind = u.searchParams.get("kind");
  const mine = u.searchParams.get("mine") === "1";
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const conds: SQL[] = [];
  if (q) conds.push(or(ilike(media.filename, `%${q}%`), ilike(media.alt, `%${q}%`), ilike(media.title, `%${q}%`), ilike(media.description, `%${q}%`))!);
  if (kind === "image" || kind === "video") conds.push(eq(media.kind, kind));
  if (mine) conds.push(eq(media.uploadedBy, user.id));
  const where = conds.length ? and(...conds) : undefined;
  const db = getDb();
  const [items, total] = await Promise.all([
    db.select({ m: media, uploader: users.name }).from(media).leftJoin(users, eq(users.id, media.uploadedBy))
      .where(where).orderBy(desc(media.createdAt)).limit(PER).offset((page - 1) * PER),
    db.select({ n: sql<number>`count(*)::int` }).from(media).where(where).limit(1).then((r) => r[0]),
  ]);
  return Response.json({
    items: items.map(({ m, uploader }) => ({ ...m, url: `/media/${m.storageKey}`, uploader })),
    total: total?.n ?? 0, page, pages: Math.ceil((total?.n ?? 0) / PER),
  });
}

export async function POST(req: Request) {
  const user = await apiUser(req, true);
  if (user instanceof Response) return user;
  if (!can(user, "media.upload")) return deny();
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No file received." }, { status: 400 });

  const ext = IMAGE_TYPES[file.type] ?? VIDEO_TYPES[file.type];
  if (!ext) return Response.json({ error: "Only JPG, PNG, WebP, GIF, AVIF images or MP4/WebM videos are allowed." }, { status: 415 });
  const kind = IMAGE_TYPES[file.type] ? "image" : "video";
  if (kind === "image" && file.size > MAX_IMAGE) return Response.json({ error: "Images must be under 8 MB." }, { status: 413 });
  if (kind === "video" && file.size > MAX_VIDEO) return Response.json({ error: "Videos must be under 95 MB. For longer videos use a YouTube link." }, { status: 413 });

  // Check the file really is what its type says (magic bytes).
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const hex = [...head].map((b) => b.toString(16).padStart(2, "0")).join("");
  const sig: Record<string, (h: string) => boolean> = {
    jpg: (h) => h.startsWith("ffd8ff"), png: (h) => h.startsWith("89504e47"), gif: (h) => h.startsWith("47494638"),
    webp: (h) => h.startsWith("52494646") && h.slice(16, 24) === "57454250", avif: (h) => h.slice(8, 16) === "66747970",
    mp4: (h) => h.slice(8, 16) === "66747970", webm: (h) => h.startsWith("1a45dfa3"),
  };
  if (!sig[ext](hex)) return Response.json({ error: "The file content does not match its type." }, { status: 415 });

  const d = new Date();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const key = `${kind}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${id}.${ext}`;
  // Passing the File straight through lets the runtime set Content-Length from
  // its size and stream the bytes, so large videos are never fully buffered.
  await putObject(key, file, file.type);

  const num = (k: string) => { const n = Number(fd.get(k)); return Number.isInteger(n) && n > 0 && n < 20000 ? n : null; };
  const filename = cleanText(fd.get("filename") || file.name, 200) || `${id}.${ext}`;
  const [row] = await getDb().insert(media).values({
    storageKey: key, kind, filename, mime: file.type, size: file.size, width: num("width"), height: num("height"),
    alt: cleanText(fd.get("alt"), 250) || null, title: cleanText(fd.get("title"), 200) || null, uploadedBy: user.id,
  }).returning();
  await audit(user, "media.upload", "media", row.id, { filename, size: file.size });
  return Response.json({ item: { ...row, url: `/media/${key}`, uploader: user.name } });
}
