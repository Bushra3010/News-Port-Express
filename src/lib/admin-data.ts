import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { articleMedia, articles, articleTags, categories, cities, districts, media, states, tags, users } from "./schema";
import { can, type AuthUser } from "./auth";
import {
  canApprove, canArchive, canEdit, canPublish, canReject, canRestore, canSetFlags, canSubmit, canTrash, canUnpublish,
} from "./permissions";
import { toIstInput } from "./util";
import type { ArticleFormData, Caps } from "@/components/admin/ArticleForm";

export async function editorOptions(user: AuthUser, stateId: number | null, districtId: number | null) {
  const db = getDb();
  const [cats, sts, ds, cs, authors] = await Promise.all([
    db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder), asc(categories.name)).all(),
    db.select({ id: states.id, name: states.name }).from(states).where(eq(states.isActive, true)).orderBy(asc(states.sortOrder)).all(),
    stateId ? db.select({ id: districts.id, name: districts.name }).from(districts).where(eq(districts.stateId, stateId)).orderBy(asc(districts.sortOrder), asc(districts.name)).all() : Promise.resolve([]),
    districtId ? db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.districtId, districtId)).orderBy(asc(cities.sortOrder), asc(cities.name)).all() : Promise.resolve([]),
    can(user, "articles.edit_any") ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)).all() : Promise.resolve([{ id: user.id, name: user.name }]),
  ]);
  // Scoped users only see their categories/states.
  const scopedCats = user.categoryScope ? cats.filter((c) => user.categoryScope!.includes(c.parentId ?? c.id)) : cats;
  const scopedStates = user.stateScope ? sts.filter((s) => user.stateScope!.includes(s.id)) : sts;
  return { categories: scopedCats, states: scopedStates, districts: ds, cities: cs, authors };
}

export function emptyArticle(user: AuthUser): ArticleFormData {
  return {
    type: "news", title: "", subtitle: "", summary: "", content: "", slug: "", categoryId: null, subcategoryId: null,
    stateId: user.stateScope?.length === 1 ? user.stateScope[0] : null, districtId: null, cityId: null, authorId: user.id,
    byline: "", tags: "", keywords: "", videoUrl: "", featured: null, og: null, video: null, gallery: [],
    seoTitle: "", metaDescription: "", focusKeyword: "", canonicalUrl: "", ogTitle: "", ogDescription: "",
    isBreaking: false, isTrending: false, isFeatured: false, isSpecial: false, status: "draft", scheduledAt: "", reviewNote: "",
    deleted: false, categorySlug: null,
  };
}

export const newCaps = (user: AuthUser): Caps => ({
  edit: true, submit: can(user, "articles.submit"), approve: false, reject: false, publish: can(user, "articles.publish"),
  unpublish: false, archive: false, trash: false, restore: false, flags: canSetFlags(user), chooseAuthor: can(user, "articles.edit_any"),
});

export async function loadArticleForEdit(id: number, user: AuthUser) {
  const db = getDb();
  const a = await db.select().from(articles).where(eq(articles.id, id)).get();
  if (!a) return null;
  const mediaIds = [a.featuredMediaId, a.ogMediaId, a.videoMediaId].filter((x): x is number => !!x);
  const [mrows, gal, tagRows, cat] = await Promise.all([
    mediaIds.length ? db.select().from(media).where(inArray(media.id, mediaIds)).all() : Promise.resolve([]),
    db.select({ id: media.id, key: media.storageKey, caption: articleMedia.caption }).from(articleMedia).innerJoin(media, eq(media.id, articleMedia.mediaId)).where(eq(articleMedia.articleId, id)).orderBy(asc(articleMedia.sortOrder)).all(),
    db.select({ name: tags.name }).from(articleTags).innerJoin(tags, eq(tags.id, articleTags.tagId)).where(eq(articleTags.articleId, id)).all(),
    a.categoryId ? db.select({ slug: categories.slug }).from(categories).where(and(eq(categories.id, a.categoryId), isNull(categories.parentId))).get() : Promise.resolve(undefined),
  ]);
  const img = (mid: number | null) => {
    const m = mrows.find((x) => x.id === mid);
    return m ? { id: m.id, url: `/media/${m.storageKey}` } : null;
  };
  const data: ArticleFormData = {
    id: a.id, type: a.type, title: a.title, subtitle: a.subtitle ?? "", summary: a.summary ?? "", content: a.content, slug: a.slug,
    categoryId: a.categoryId, subcategoryId: a.subcategoryId, stateId: a.stateId, districtId: a.districtId, cityId: a.cityId,
    authorId: a.authorId, byline: a.byline ?? "", tags: tagRows.map((t) => t.name).join(", "), keywords: a.keywords ?? "",
    videoUrl: a.videoUrl ?? "", featured: img(a.featuredMediaId), og: img(a.ogMediaId), video: img(a.videoMediaId),
    gallery: gal.map((g) => ({ id: g.id, url: `/media/${g.key}`, caption: g.caption })),
    seoTitle: a.seoTitle ?? "", metaDescription: a.metaDescription ?? "", focusKeyword: a.focusKeyword ?? "", canonicalUrl: a.canonicalUrl ?? "",
    ogTitle: a.ogTitle ?? "", ogDescription: a.ogDescription ?? "",
    isBreaking: a.isBreaking, isTrending: a.isTrending, isFeatured: a.isFeatured, isSpecial: a.isSpecial,
    status: a.status, scheduledAt: a.status === "scheduled" ? toIstInput(a.publishedAt) : "", reviewNote: a.reviewNote ?? "",
    updatedAt: a.updatedAt, deleted: !!a.deletedAt, categorySlug: cat?.slug ?? null,
  };
  const caps: Caps = {
    edit: canEdit(user, a), submit: canSubmit(user, a), approve: canApprove(user, a), reject: canReject(user, a),
    publish: canPublish(user, a), unpublish: canUnpublish(user, a), archive: canArchive(user, a),
    trash: canTrash(user, a), restore: canRestore(user, a), flags: canSetFlags(user), chooseAuthor: can(user, "articles.edit_any"),
  };
  return { a, data, caps };
}
