import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, inArray, isNull, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { articleMedia, articles, articleTags, articleViews, categories, cities, districts, media, pages, states, tags, users } from "./schema";
import { istDay } from "./util";

export const mediaUrl = (key: string | null | undefined) => (key ? `/media/${key}` : null);

/** Visible to the public: published, or scheduled with its time reached; never trashed. */
export function publicWhere(): SQL {
  return and(
    isNull(articles.deletedAt),
    inArray(articles.status, ["published", "scheduled"]),
    lte(articles.publishedAt, Date.now()),
  )!;
}

const img = alias(media, "img");
const cat = alias(categories, "cat");

const cardFields = {
  id: articles.id,
  slug: articles.slug,
  type: articles.type,
  title: articles.title,
  summary: articles.summary,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
  videoUrl: articles.videoUrl,
  isBreaking: articles.isBreaking,
  byline: articles.byline,
  categorySlug: cat.slug,
  categoryName: cat.name,
  imageKey: img.storageKey,
  imageAlt: img.alt,
  imageW: img.width,
  imageH: img.height,
  cityName: cities.name,
};

export type Card = {
  id: number; slug: string; type: string; title: string; summary: string | null;
  publishedAt: number | null; updatedAt: number; videoUrl: string | null; isBreaking: boolean; byline: string | null;
  categorySlug: string | null; categoryName: string | null;
  imageKey: string | null; imageAlt: string | null; imageW: number | null; imageH: number | null; cityName: string | null;
};

export const articleHref = (a: { slug: string; categorySlug: string | null }) => `/${a.categorySlug || "news"}/${a.slug}`;

export type ListFilter = {
  categoryId?: number; // matches category or subcategory
  subcategoryId?: number;
  stateId?: number; districtId?: number; cityId?: number;
  type?: "news" | "video" | "gallery";
  tagId?: number; authorId?: number;
  breaking?: boolean; special?: boolean; featured?: boolean;
  q?: string;
  exclude?: number[];
};

function where(f: ListFilter): SQL {
  const c: SQL[] = [publicWhere()];
  if (f.categoryId) c.push(or(eq(articles.categoryId, f.categoryId), eq(articles.subcategoryId, f.categoryId))!);
  if (f.subcategoryId) c.push(eq(articles.subcategoryId, f.subcategoryId));
  if (f.stateId) c.push(eq(articles.stateId, f.stateId));
  if (f.districtId) c.push(eq(articles.districtId, f.districtId));
  if (f.cityId) c.push(eq(articles.cityId, f.cityId));
  if (f.type) c.push(eq(articles.type, f.type));
  if (f.authorId) c.push(eq(articles.authorId, f.authorId));
  if (f.breaking) c.push(eq(articles.isBreaking, true));
  if (f.special) c.push(eq(articles.isSpecial, true));
  if (f.featured) c.push(eq(articles.isFeatured, true));
  if (f.tagId) c.push(sql`${articles.id} IN (SELECT article_id FROM article_tags WHERE tag_id = ${f.tagId})`);
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    c.push(sql`(${articles.title} ILIKE ${like} OR ${articles.summary} ILIKE ${like} OR ${articles.keywords} ILIKE ${like})`);
  }
  if (f.exclude?.length) c.push(notInArray(articles.id, f.exclude));
  return and(...c)!;
}

function baseSelect() {
  return getDb()
    .select(cardFields)
    .from(articles)
    .leftJoin(cat, eq(cat.id, articles.categoryId))
    .leftJoin(img, eq(img.id, articles.featuredMediaId))
    .leftJoin(cities, eq(cities.id, articles.cityId));
}

export async function listArticles(f: ListFilter = {}, limit = 12, offset = 0): Promise<Card[]> {
  return baseSelect().where(where(f)).orderBy(desc(articles.publishedAt), desc(articles.id)).limit(limit).offset(offset);
}

export async function countArticles(f: ListFilter = {}): Promise<number> {
  const r = await getDb().select({ n: sql<number>`count(*)::int` }).from(articles).where(where(f)).limit(1).then((r) => r[0]);
  return r?.n ?? 0;
}

/** Manually flagged trending first, then most viewed over the last 2 days, then newest. */
export async function trending(limit = 8): Promise<Card[]> {
  const since = istDay(Date.now() - 2 * 86_400_000);
  const views = sql<number>`coalesce((SELECT sum(views)::int FROM ${articleViews} v WHERE v.article_id = ${articles.id} AND v.day >= ${since}), 0)`;
  return baseSelect()
    .where(and(publicWhere(), sql`${articles.publishedAt} > ${Date.now() - 7 * 86_400_000}`))
    .orderBy(desc(articles.isTrending), desc(views), desc(articles.publishedAt))
    .limit(limit);
}

export const navCategories = cache(async () =>
  getDb()
    .select({ id: categories.id, name: categories.name, slug: categories.slug, showInNav: categories.showInNav })
    .from(categories)
    .where(and(isNull(categories.parentId), eq(categories.isActive, true)))
    .orderBy(asc(categories.sortOrder), asc(categories.id)),
);

export const getCategoryBySlug = cache(async (slug: string) => {
  const c = await getDb().select().from(categories).where(and(eq(categories.slug, slug), eq(categories.isActive, true))).limit(1).then((r) => r[0]);
  if (!c) return null;
  const [parent, children, image] = await Promise.all([
    c.parentId ? getDb().select().from(categories).where(eq(categories.id, c.parentId)).limit(1).then((r) => r[0]) : Promise.resolve(undefined),
    getDb().select().from(categories).where(and(eq(categories.parentId, c.id), eq(categories.isActive, true))).orderBy(asc(categories.sortOrder)),
    c.imageMediaId ? getDb().select().from(media).where(eq(media.id, c.imageMediaId)).limit(1).then((r) => r[0]) : Promise.resolve(undefined),
  ]);
  return { ...c, parent: parent ?? null, children, imageKey: image?.storageKey ?? null };
});

export const getArticleBySlug = cache(async (slug: string, opts: { preview?: boolean } = {}) => {
  const db = getDb();
  const sub = alias(categories, "sub");
  const og = alias(media, "og");
  const vid = alias(media, "vid");
  const row = await db
    .select({
      a: articles,
      categorySlug: cat.slug, categoryName: cat.name,
      subSlug: sub.slug, subName: sub.name,
      stateSlug: states.slug, stateName: states.name,
      districtSlug: districts.slug, districtName: districts.name,
      citySlug: cities.slug, cityName: cities.name,
      authorName: users.name, authorBio: users.bio,
      imageKey: img.storageKey, imageAlt: img.alt, imageW: img.width, imageH: img.height, imageTitle: img.title,
      ogKey: og.storageKey, videoKey: vid.storageKey, videoMime: vid.mime,
    })
    .from(articles)
    .leftJoin(cat, eq(cat.id, articles.categoryId))
    .leftJoin(sub, eq(sub.id, articles.subcategoryId))
    .leftJoin(states, eq(states.id, articles.stateId))
    .leftJoin(districts, eq(districts.id, articles.districtId))
    .leftJoin(cities, eq(cities.id, articles.cityId))
    .leftJoin(users, eq(users.id, articles.authorId))
    .leftJoin(img, eq(img.id, articles.featuredMediaId))
    .leftJoin(og, eq(og.id, articles.ogMediaId))
    .leftJoin(vid, eq(vid.id, articles.videoMediaId))
    .where(opts.preview ? eq(articles.slug, slug) : and(eq(articles.slug, slug), publicWhere()))
    .limit(1).then((r) => r[0]);
  if (!row) return null;
  const [gallery, tagRows] = await Promise.all([
    db
      .select({ key: media.storageKey, alt: media.alt, w: media.width, h: media.height, caption: articleMedia.caption, title: media.title })
      .from(articleMedia)
      .innerJoin(media, eq(media.id, articleMedia.mediaId))
      .where(eq(articleMedia.articleId, row.a.id))
      .orderBy(asc(articleMedia.sortOrder)),
    db.select({ name: tags.name, slug: tags.slug }).from(articleTags).innerJoin(tags, eq(tags.id, articleTags.tagId)).where(eq(articleTags.articleId, row.a.id)),
  ]);
  return { ...row, gallery, tags: tagRows };
});
export type FullArticle = NonNullable<Awaited<ReturnType<typeof getArticleBySlug>>>;

export async function related(a: FullArticle["a"], limit = 6): Promise<Card[]> {
  const first = a.categoryId ? await listArticles({ categoryId: a.categoryId, exclude: [a.id] }, limit) : [];
  if (first.length >= limit) return first;
  const more = await listArticles({ exclude: [a.id, ...first.map((x) => x.id)] }, limit - first.length);
  return [...first, ...more];
}

export async function getStateBySlug(slug: string) {
  return getDb().select().from(states).where(and(eq(states.slug, slug), eq(states.isActive, true))).limit(1).then((r) => r[0]);
}
export async function getDistrict(stateId: number, slug: string) {
  return getDb().select().from(districts).where(and(eq(districts.stateId, stateId), eq(districts.slug, slug))).limit(1).then((r) => r[0]);
}
export async function getCity(districtId: number, slug: string) {
  return getDb().select().from(cities).where(and(eq(cities.districtId, districtId), eq(cities.slug, slug))).limit(1).then((r) => r[0]);
}
export async function districtsOf(stateId: number) {
  return getDb().select().from(districts).where(eq(districts.stateId, stateId)).orderBy(asc(districts.sortOrder), asc(districts.name));
}
export async function citiesOf(districtId: number) {
  return getDb().select().from(cities).where(eq(cities.districtId, districtId)).orderBy(asc(cities.sortOrder), asc(cities.name));
}

/** States that have at least one public article, with counts. */
export async function statesWithNews() {
  return getDb()
    .select({ id: states.id, name: states.name, slug: states.slug, n: sql<number>`count(${articles.id})::int` })
    .from(states)
    .leftJoin(articles, and(eq(articles.stateId, states.id), publicWhere()))
    .where(eq(states.isActive, true))
    .groupBy(states.id)
    .orderBy(asc(states.sortOrder));
}

export const featuredCities = cache(async () =>
  getDb()
    .select({ id: cities.id, name: cities.name, slug: cities.slug, districtSlug: districts.slug, stateSlug: states.slug })
    .from(cities)
    .innerJoin(districts, eq(districts.id, cities.districtId))
    .innerJoin(states, eq(states.id, districts.stateId))
    .where(eq(cities.isFeatured, true))
    .orderBy(asc(states.sortOrder), asc(cities.sortOrder)),
);

export const cityHref = (c: { slug: string; districtSlug: string; stateSlug: string }) => `/state/${c.stateSlug}/${c.districtSlug}/${c.slug}`;

export async function getTagBySlug(slug: string) {
  return getDb().select().from(tags).where(eq(tags.slug, slug)).limit(1).then((r) => r[0]);
}

export async function getAuthor(id: number) {
  return getDb().select({ id: users.id, name: users.name, bio: users.bio }).from(users).where(eq(users.id, id)).limit(1).then((r) => r[0]);
}

export const footerPages = cache(async () =>
  getDb()
    .select({ slug: pages.slug, title: pages.title })
    .from(pages)
    .where(and(eq(pages.isPublished, true), eq(pages.showInFooter, true)))
    .orderBy(asc(pages.sortOrder)),
);

export async function getPage(slug: string) {
  return getDb().select().from(pages).where(and(eq(pages.slug, slug), eq(pages.isPublished, true))).limit(1).then((r) => r[0]);
}

export async function recordView(articleId: number) {
  const db = getDb();
  const day = istDay();
  await db.transaction(async (tx) => {
    await tx.insert(articleViews).values({ articleId, day, views: 1 }).onConflictDoUpdate({
      target: [articleViews.articleId, articleViews.day],
      set: { views: sql`${articleViews.views} + 1` },
    });
    await tx.update(articles).set({ viewCount: sql`${articles.viewCount} + 1` }).where(eq(articles.id, articleId));
  });
}
