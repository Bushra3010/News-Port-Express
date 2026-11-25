import Link from "next/link";
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { can, requireUser, type AuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles, categories, districts, media, states, users, ARTICLE_STATUSES } from "@/lib/schema";
import { cleanText, fromIstInput, toInt } from "@/lib/util";
import NewsTable, { type Row } from "@/components/admin/NewsTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "All News" };

const PER = 25;
const SORTS = { updated: articles.updatedAt, published: articles.publishedAt, created: articles.createdAt, title: articles.title, views: articles.viewCount } as const;

type SP = Record<string, string | undefined>;

/** Rows a user may see in the newsroom: own work always; others' work if they review/edit/publish within scope. */
function visibility(user: AuthUser): SQL | undefined {
  if (user.roleKey === "super_admin") return undefined;
  const own = or(eq(articles.createdBy, user.id), eq(articles.authorId, user.id))!;
  const reviewer = can(user, "articles.edit_any") || can(user, "articles.approve") || can(user, "articles.publish");
  if (!reviewer) return own;
  const scope: SQL[] = [];
  if (user.categoryScope) scope.push(sql`${articles.categoryId} IN (${sql.join(user.categoryScope.map((i) => sql`${i}`), sql`, `)})`);
  if (user.stateScope) scope.push(sql`${articles.stateId} IN (${sql.join(user.stateScope.map((i) => sql`${i}`), sql`, `)})`);
  return scope.length ? or(own, and(...scope)) : undefined;
}

export default async function NewsList({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const db = getDb();
  const status = sp.status && (ARTICLE_STATUSES as readonly string[]).concat("trash").includes(sp.status) ? sp.status : "";
  const q = cleanText(sp.q, 100);
  const cat = toInt(sp.category);
  const st = toInt(sp.state);
  const dist = toInt(sp.district);
  const author = toInt(sp.author);
  const type = ["news", "video", "gallery"].includes(sp.type ?? "") ? sp.type : "";
  const from = sp.from ? fromIstInput(`${sp.from}T00:00`) : null;
  const to = sp.to ? fromIstInput(`${sp.to}T23:59`) : null;
  const sortKey = (sp.sort && sp.sort in SORTS ? sp.sort : "updated") as keyof typeof SORTS;
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.page) || 1);

  const vis = visibility(user);
  const base: SQL[] = vis ? [vis] : [];
  const filters: SQL[] = [];
  if (q) filters.push(sql`(${articles.title} LIKE ${`%${q}%`} OR ${articles.slug} LIKE ${`%${q}%`} OR ${articles.id} = ${Number(q) || -1})`);
  if (cat) filters.push(or(eq(articles.categoryId, cat), eq(articles.subcategoryId, cat))!);
  if (st) filters.push(eq(articles.stateId, st));
  if (dist) filters.push(eq(articles.districtId, dist));
  if (author) filters.push(eq(articles.authorId, author));
  if (type) filters.push(eq(articles.type, type as "news"));
  if (from) filters.push(gte(sql`coalesce(${articles.publishedAt}, ${articles.createdAt})`, from));
  if (to) filters.push(lte(sql`coalesce(${articles.publishedAt}, ${articles.createdAt})`, to));

  const statusCond = status === "trash" ? isNotNull(articles.deletedAt)
    : status === "scheduled" ? and(isNull(articles.deletedAt), eq(articles.status, "scheduled"), gte(articles.publishedAt, Date.now()))
    : status === "published" ? and(isNull(articles.deletedAt), or(eq(articles.status, "published"), and(eq(articles.status, "scheduled"), lte(articles.publishedAt, Date.now()))))
    : status ? and(isNull(articles.deletedAt), eq(articles.status, status as "draft"))
    : isNull(articles.deletedAt);
  const where = and(...base, ...filters, statusCond);

  const authorU = alias(users, "author");
  const img = alias(media, "img");
  const sortCol = SORTS[sortKey];

  const [rows, totalRow, counts, catOpts, stateOpts, distOpts, authorOpts] = await Promise.all([
    db.select({
      id: articles.id, title: articles.title, slug: articles.slug, status: articles.status, type: articles.type,
      publishedAt: articles.publishedAt, updatedAt: articles.updatedAt, createdAt: articles.createdAt, deletedAt: articles.deletedAt,
      isBreaking: articles.isBreaking, isFeatured: articles.isFeatured, viewCount: articles.viewCount,
      categoryName: categories.name, categorySlug: categories.slug, stateName: states.name, authorName: authorU.name, byline: articles.byline,
      thumb: img.storageKey, createdBy: articles.createdBy, authorId: articles.authorId, categoryId: articles.categoryId, stateId: articles.stateId,
    })
      .from(articles)
      .leftJoin(categories, eq(categories.id, articles.categoryId))
      .leftJoin(states, eq(states.id, articles.stateId))
      .leftJoin(authorU, eq(authorU.id, articles.authorId))
      .leftJoin(img, eq(img.id, articles.featuredMediaId))
      .where(where)
      .orderBy(dir === "asc" ? asc(sortCol) : desc(sortCol), desc(articles.id))
      .limit(PER).offset((page - 1) * PER).all(),
    db.select({ n: sql<number>`count(*)` }).from(articles).where(where).get(),
    db.select({
      status: sql<string>`CASE WHEN ${articles.deletedAt} IS NOT NULL THEN 'trash' WHEN ${articles.status} = 'scheduled' AND ${articles.publishedAt} <= ${Date.now()} THEN 'published' ELSE ${articles.status} END`,
      n: sql<number>`count(*)`,
    }).from(articles).where(and(...base, ...filters)).groupBy(sql`1`).all(),
    db.select({ id: categories.id, name: categories.name, parentId: categories.parentId }).from(categories).orderBy(asc(categories.sortOrder)).all(),
    db.select({ id: states.id, name: states.name }).from(states).orderBy(asc(states.sortOrder)).all(),
    st ? db.select({ id: districts.id, name: districts.name }).from(districts).where(eq(districts.stateId, st)).orderBy(asc(districts.name)).all() : Promise.resolve([]),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name)).all(),
  ]);
  const total = totalRow?.n ?? 0;
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const all = counts.filter((c) => c.status !== "trash").reduce((a, c) => a + c.n, 0);

  const qs = (over: SP) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) u.set(k, v);
    const s = u.toString();
    return `/admin/news${s ? `?${s}` : ""}`;
  };
  const tabs: [string, string, number][] = [
    ["", "All", all], ["draft", "Drafts", count("draft")], ["pending", "Pending Approval", count("pending")], ["approved", "Approved", count("approved")],
    ["published", "Published", count("published")], ["scheduled", "Scheduled", count("scheduled")], ["rejected", "Rejected", count("rejected")],
    ["archived", "Archived", count("archived")], ["trash", "Trash", count("trash")],
  ];
  const pages = Math.ceil(total / PER);

  return (
    <>
      <div className="head">
        <div><h1>News</h1><p>{total} article{total === 1 ? "" : "s"}{status ? ` · ${tabs.find((t) => t[0] === status)?.[1]}` : ""}</p></div>
        {can(user, "articles.create") ? <Link className="btn" href="/admin/news/new">＋ Add News</Link> : null}
      </div>

      <nav className="tabsbar" aria-label="Status">
        {tabs.map(([k, label, n]) => <Link key={k || "all"} href={qs({ status: k || undefined, page: undefined })} className={status === k ? "on" : ""}>{label} <span>({n})</span></Link>)}
      </nav>

      <form className="filters card" action="/admin/news" style={{ padding: 12 }}>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label>Search<input type="search" name="q" defaultValue={q} placeholder="Headline, slug or ID" /></label>
        <label>Category<select name="category" defaultValue={cat ?? ""}><option value="">All</option>{catOpts.map((c) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}</select></label>
        <label>State<select name="state" defaultValue={st ?? ""}><option value="">All</option>{stateOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>District<select name="district" defaultValue={dist ?? ""} disabled={!st}><option value="">{st ? "All" : "Pick a state"}</option>{distOpts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>Author<select name="author" defaultValue={author ?? ""}><option value="">All</option>{authorOpts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>From<input type="date" name="from" defaultValue={sp.from ?? ""} /></label>
        <label>To<input type="date" name="to" defaultValue={sp.to ?? ""} /></label>
        <div className="row"><button className="btn">Filter</button><Link className="btn ghost" href={qs({ q: undefined, category: undefined, state: undefined, district: undefined, author: undefined, from: undefined, to: undefined, type: undefined, page: undefined })}>Reset</Link></div>
      </form>

      <NewsTable
        rows={rows as Row[]}
        sort={sortKey} dir={dir}
        sortHref={Object.fromEntries((Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => [k, qs({ sort: k, dir: sortKey === k && dir === "desc" ? "asc" : "desc", page: undefined })]))}
        trashView={status === "trash"}
        canDelete={can(user, "articles.delete")}
        bulkOps={{
          publish: can(user, "articles.publish"), unpublish: can(user, "articles.unpublish"), approve: can(user, "articles.approve"),
          submit: can(user, "articles.submit"), trash: true, archive: can(user, "articles.unpublish"),
        }}
      />

      {pages > 1 ? (
        <div className="pager">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })}>‹ Prev</Link> : null}
          <span className="cur">Page {page} of {pages}</span>
          {page < pages ? <Link href={qs({ page: String(page + 1) })}>Next ›</Link> : null}
        </div>
      ) : null}
    </>
  );
}
