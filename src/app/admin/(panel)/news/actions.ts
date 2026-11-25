"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import { requireUser, can, type AuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articleMedia, articles, articleTags, categories, cities, districts, media, tags, users, type ArticleStatus } from "@/lib/schema";
import {
  canApprove, canArchive, canDeleteForever, canEdit, canPublish, canReject, canRestore, canSetFlags, canSubmit, canTrash, canUnpublish, inScope,
} from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { errMessage, fbool, fstr, ValidationError, type FormState } from "@/lib/forms";
import { cleanText, fromIstInput, isHttpUrl, isValidSlug, RESERVED_SLUGS, sanitizeHtml, slugify, stripHtml, toInt } from "@/lib/util";

type Intent = "draft" | "save" | "submit" | "approve" | "reject" | "publish" | "schedule";
const INTENTS: Intent[] = ["draft", "save", "submit", "approve", "reject", "publish", "schedule"];

async function uniqueSlug(base: string, exceptId?: number) {
  const db = getDb();
  let slug = base || `news-${Date.now().toString(36)}`;
  for (let i = 2; i < 200; i++) {
    const clash = await db.select({ id: articles.id }).from(articles)
      .where(exceptId ? and(eq(articles.slug, slug), ne(articles.id, exceptId)) : eq(articles.slug, slug)).limit(1).then((r) => r[0]);
    const catClash = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1).then((r) => r[0]);
    if (!clash && !catClash && !RESERVED_SLUGS.has(slug)) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function syncTags(articleId: number, raw: string) {
  const db = getDb();
  const names = [...new Set(raw.split(/[,،\n]/).map((t) => cleanText(t, 60)).filter(Boolean))].slice(0, 20);
  await db.delete(articleTags).where(eq(articleTags.articleId, articleId));
  if (!names.length) return;
  const rows = names.map((name) => ({ name, slug: slugify(name, 60) })).filter((t) => t.slug);
  for (const t of rows) await db.insert(tags).values(t).onConflictDoNothing();
  const ids = await db.select({ id: tags.id }).from(tags).where(inArray(tags.slug, rows.map((r) => r.slug)));
  if (ids.length) await db.insert(articleTags).values(ids.map((t) => ({ articleId, tagId: t.id }))).onConflictDoNothing();
}

async function syncGallery(articleId: number, ids: number[], captions: string[]) {
  const db = getDb();
  await db.delete(articleMedia).where(eq(articleMedia.articleId, articleId));
  const valid = ids.length ? await db.select({ id: media.id }).from(media).where(inArray(media.id, ids)) : [];
  const ok = new Set(valid.map((v) => v.id));
  const rows = ids.map((id, i) => ({ articleId, mediaId: id, sortOrder: i, caption: cleanText(captions[i], 200) || null })).filter((r) => ok.has(r.mediaId));
  if (rows.length) await db.insert(articleMedia).values(rows).onConflictDoNothing();
}

/** Reads and validates the editor form. Throws ValidationError with a message the editor can act on. */
async function readForm(fd: FormData, user: AuthUser, intent: Intent) {
  const db = getDb();
  const title = cleanText(fd.get("title"), 220);
  if (!title) throw new ValidationError("Enter a headline.");
  const type = (["news", "video", "gallery"].includes(fstr(fd, "type")) ? fstr(fd, "type") : "news") as "news" | "video" | "gallery";
  const content = sanitizeHtml(String(fd.get("content") ?? "")).slice(0, 400_000);
  const categoryId = toInt(fd.get("categoryId"));
  const subcategoryId = toInt(fd.get("subcategoryId"));
  const stateId = toInt(fd.get("stateId"));
  const districtId = stateId ? toInt(fd.get("districtId")) : null;
  const cityId = districtId ? toInt(fd.get("cityId")) : null;
  const videoUrl = fstr(fd, "videoUrl");
  if (videoUrl && !isHttpUrl(videoUrl)) throw new ValidationError("Video URL must start with https://");
  const canonicalUrl = fstr(fd, "canonicalUrl");
  if (canonicalUrl && !isHttpUrl(canonicalUrl)) throw new ValidationError("Canonical URL must be a full https:// address.");

  if (categoryId) {
    const c = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1).then((r) => r[0]);
    if (!c || c.parentId) throw new ValidationError("Choose a valid main category.");
  }
  if (subcategoryId) {
    const s = await db.select().from(categories).where(eq(categories.id, subcategoryId)).limit(1).then((r) => r[0]);
    if (!s || s.parentId !== categoryId) throw new ValidationError("The subcategory does not belong to the chosen category.");
  }
  if (districtId) {
    const d = await db.select().from(districts).where(eq(districts.id, districtId)).limit(1).then((r) => r[0]);
    if (!d || d.stateId !== stateId) throw new ValidationError("The district does not belong to the chosen state.");
  }
  if (cityId) {
    const c = await db.select().from(cities).where(eq(cities.id, cityId)).limit(1).then((r) => r[0]);
    if (!c || c.districtId !== districtId) throw new ValidationError("The city does not belong to the chosen district.");
  }
  if (!inScope(user, { categoryId, stateId })) {
    throw new ValidationError("You can only work on news in your assigned categories/states.");
  }
  const going = intent === "submit" || intent === "publish" || intent === "schedule" || intent === "approve";
  if (going) {
    if (!categoryId) throw new ValidationError("Choose a category before submitting or publishing.");
    if (type === "news" && stripHtml(content).length < 20) throw new ValidationError("Write the full news content before submitting or publishing.");
    if (type === "video" && !videoUrl && !toInt(fd.get("videoMediaId"))) throw new ValidationError("Add a video URL or upload a video.");
    if (type === "gallery" && fd.getAll("galleryIds").length < 2) throw new ValidationError("A photo gallery needs at least 2 images.");
  }

  // Author: reporters always write as themselves; others may pick any active user.
  let authorId = toInt(fd.get("authorId"));
  if (!can(user, "articles.edit_any") || !authorId) authorId = user.id;
  else {
    const a = await db.select({ id: users.id }).from(users).where(and(eq(users.id, authorId), eq(users.isActive, true))).limit(1).then((r) => r[0]);
    if (!a) authorId = user.id;
  }

  const slugInput = fstr(fd, "slug").toLowerCase();
  if (slugInput && !isValidSlug(slugInput)) throw new ValidationError("Slug may contain only letters, numbers and single hyphens.");

  const mediaId = (k: string) => toInt(fd.get(k));
  const v = {
    title, type, content,
    subtitle: cleanText(fd.get("subtitle"), 300) || null,
    summary: cleanText(fd.get("summary"), 600) || null,
    featuredMediaId: mediaId("featuredMediaId"),
    videoUrl: videoUrl || null,
    videoMediaId: mediaId("videoMediaId"),
    categoryId, subcategoryId: categoryId ? subcategoryId : null, stateId, districtId, cityId, authorId,
    byline: cleanText(fd.get("byline"), 120) || null,
    seoTitle: cleanText(fd.get("seoTitle"), 120) || null,
    metaDescription: cleanText(fd.get("metaDescription"), 300) || null,
    focusKeyword: cleanText(fd.get("focusKeyword"), 80) || null,
    keywords: cleanText(fd.get("keywords"), 400) || null,
    canonicalUrl: canonicalUrl || null,
    ogTitle: cleanText(fd.get("ogTitle"), 150) || null,
    ogDescription: cleanText(fd.get("ogDescription"), 300) || null,
    ogMediaId: mediaId("ogMediaId"),
  };
  const flags = canSetFlags(user)
    ? { isBreaking: fbool(fd, "isBreaking"), isTrending: fbool(fd, "isTrending"), isFeatured: fbool(fd, "isFeatured"), isSpecial: fbool(fd, "isSpecial") }
    : {};
  return { v, flags, slugInput, tagsRaw: fstr(fd, "tags"), galleryIds: fd.getAll("galleryIds").map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0), captions: fd.getAll("galleryCaptions").map(String) };
}

export async function saveArticle(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const intent = fstr(fd, "intent") as Intent;
    if (!INTENTS.includes(intent)) return { error: "Unknown action." };
    const db = getDb();
    const id = toInt(fd.get("id"));
    let user: AuthUser;
    let existing: typeof articles.$inferSelect | undefined;

    if (id) {
      user = await requireUser();
      existing = await db.select().from(articles).where(eq(articles.id, id)).limit(1).then((r) => r[0]);
      if (!existing) return { error: "This article no longer exists." };
      // Approve/reject reviewers may also correct the copy while reviewing.
      if (!canEdit(user, existing) && !(intent === "approve" && canApprove(user, existing)) && !(intent === "reject" && canReject(user, existing))) {
        return { error: "You do not have permission to edit this article." };
      }
      if (fstr(fd, "updatedAt") && Number(fstr(fd, "updatedAt")) !== existing.updatedAt) {
        return { error: "Someone else saved this article after you opened it. Copy your changes, reload the page and try again." };
      }
    } else {
      user = await requireUser("articles.create");
    }

    const { v, flags, slugInput, tagsRaw, galleryIds, captions } = await readForm(fd, user, intent);
    const now = Date.now();
    const ref = { ...(existing ?? { createdBy: user.id, authorId: v.authorId, status: "draft" as ArticleStatus, deletedAt: null }), categoryId: v.categoryId, stateId: v.stateId };

    // Decide the next status from the button pressed.
    let status: ArticleStatus = existing?.status ?? "draft";
    let publishedAt = existing?.publishedAt ?? null;
    const extra: Partial<typeof articles.$inferInsert> = {};
    switch (intent) {
      case "draft":
        if (["rejected", "draft"].includes(status)) status = "draft";
        else if (!["pending", "approved"].includes(status)) return { error: "Live articles are updated with “Update”, not saved as drafts. Unpublish first to turn it back into a draft." };
        break;
      case "save":
        break;
      case "submit":
        if (!canSubmit(user, ref)) return { error: "You cannot submit this article for approval." };
        status = "pending";
        extra.submittedAt = now;
        extra.reviewNote = null;
        break;
      case "approve":
        if (!canApprove(user, ref)) return { error: "You cannot approve this article." };
        status = "approved";
        extra.reviewedBy = user.id;
        extra.reviewNote = cleanText(fd.get("reviewNote"), 1000) || null;
        break;
      case "reject": {
        if (!canReject(user, ref)) return { error: "You cannot reject this article." };
        const note = cleanText(fd.get("reviewNote"), 1000);
        if (!note) return { error: "Write a note telling the author why it was rejected." };
        status = "rejected";
        extra.reviewedBy = user.id;
        extra.reviewNote = note;
        break;
      }
      case "publish":
        if (status !== "published" && !canPublish(user, ref)) return { error: "You do not have permission to publish." };
        if (status === "published" && !canEdit(user, ref)) return { error: "You cannot update this article." };
        if (status !== "published" || !publishedAt || publishedAt > now) publishedAt = now;
        status = "published";
        if (!existing || existing.status !== "published") extra.reviewedBy = extra.reviewedBy ?? user.id;
        break;
      case "schedule": {
        if (!canPublish(user, { ...ref, status: ref.status === "published" ? "approved" : ref.status })) return { error: "You do not have permission to schedule." };
        const at = fromIstInput(fstr(fd, "scheduledAt"));
        if (!at || at < now + 60_000) return { error: "Choose a future date and time (IST) for scheduling." };
        status = "scheduled";
        publishedAt = at;
        break;
      }
    }

    const slugBase = slugInput || slugify(v.title);
    const slug = existing && (!slugInput || slugInput === existing.slug) ? existing.slug : await uniqueSlug(slugBase, existing?.id);

    let articleId: number;
    if (existing) {
      await db.update(articles).set({ ...v, ...flags, ...extra, slug, status, publishedAt, updatedBy: user.id, updatedAt: now }).where(eq(articles.id, existing.id));
      articleId = existing.id;
    } else {
      const [row] = await db.insert(articles).values({ ...v, ...flags, ...extra, slug, status, publishedAt, createdBy: user.id, updatedBy: user.id }).returning({ id: articles.id });
      articleId = row.id;
    }
    await syncTags(articleId, tagsRaw);
    await syncGallery(articleId, galleryIds, captions);
    await audit(user, existing ? `article.${intent}` : `article.create.${intent}`, "article", articleId, { title: v.title, status });
    revalidatePath("/admin/news");

    const msg: Record<Intent, string> = {
      draft: "Draft saved.", save: status === "published" ? "Published article updated." : "Saved.", submit: "Submitted for approval.",
      approve: "Approved. It can now be published.", reject: "Rejected and returned to the author.", publish: "Published — it is now live on the website.",
      schedule: "Scheduled. It will go live automatically at the chosen time.",
    };
    if (!existing) redirect(`/admin/news/${articleId}?msg=${encodeURIComponent(msg[intent])}`);
    return { ok: true, message: msg[intent], id: articleId, version: now };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

type BulkOp = "publish" | "unpublish" | "archive" | "trash" | "restore" | "delete" | "approve" | "submit";

/** Bulk and single-row actions from the news table. Each article is checked individually. */
export async function articleBulk(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requireUser();
    const op = fstr(fd, "op") as BulkOp;
    const ids = fd.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
    if (!ids.length) return { error: "Select at least one article." };
    const db = getDb();
    const rows = await db.select().from(articles).where(inArray(articles.id, ids));
    const now = Date.now();
    let done = 0;
    for (const a of rows) {
      let set: Partial<typeof articles.$inferInsert> | null = null;
      switch (op) {
        case "publish": if (canPublish(user, a)) set = { status: "published", publishedAt: a.status === "scheduled" || !a.publishedAt || a.publishedAt > now ? now : a.publishedAt }; break;
        case "unpublish": if (canUnpublish(user, a)) set = { status: "draft" }; break;
        case "archive": if (canArchive(user, a)) set = { status: "archived" }; break;
        case "approve": if (canApprove(user, a)) set = { status: "approved", reviewedBy: user.id }; break;
        case "submit": if (canSubmit(user, a)) set = { status: "pending", submittedAt: now }; break;
        case "trash": if (canTrash(user, a)) set = { deletedAt: now }; break;
        case "restore": if (canRestore(user, a)) set = { deletedAt: null }; break;
        case "delete":
          if (canDeleteForever(user, a)) {
            await db.delete(articles).where(eq(articles.id, a.id));
            await audit(user, "article.delete", "article", a.id, { title: a.title });
            done++;
          }
          continue;
        default: return { error: "Unknown action." };
      }
      if (set) {
        await db.update(articles).set({ ...set, updatedBy: user.id, updatedAt: now }).where(eq(articles.id, a.id));
        await audit(user, `article.${op}`, "article", a.id, { title: a.title });
        done++;
      }
    }
    revalidatePath("/admin/news");
    const skipped = ids.length - done;
    return done
      ? { ok: true, message: `${done} article${done > 1 ? "s" : ""} updated.${skipped ? ` ${skipped} skipped (not allowed or not applicable).` : ""}` }
      : { error: "None of the selected articles could be changed with your permissions." };
  } catch (e) {
    return { error: errMessage(e) };
  }
}
