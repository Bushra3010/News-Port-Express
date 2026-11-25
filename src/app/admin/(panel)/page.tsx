import Link from "next/link";
import { and, desc, eq, gte, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { can, requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles, articleViews, categories, roles, states, users } from "@/lib/schema";
import { istDay } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const fmt = (ms: number | null) => (ms ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(ms) : "—");

function Bars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="hint">No data yet.</p>;
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="r" key={r.label}><span title={r.label}>{r.label}</span><span className="track"><i style={{ width: `${(r.n / max) * 100}%` }} /></span><b>{r.n.toLocaleString("en-IN")}</b></div>
      ))}
    </div>
  );
}

export default async function Dashboard() {
  const user = await requirePage("dashboard.view");
  const db = getDb();
  const now = Date.now();

  // Scheduled stories whose time has come are live already; record that in their status too.
  await db.update(articles).set({ status: "published" }).where(and(eq(articles.status, "scheduled"), lte(articles.publishedAt, now)));

  const full = can(user, "analytics.view");
  const mine: SQL | undefined = full ? undefined : or(eq(articles.createdBy, user.id), eq(articles.authorId, user.id));
  const live = isNull(articles.deletedAt);
  const cnt = (extra?: SQL) => db.select({ n: sql<number>`count(*)` }).from(articles).where(and(live, mine, extra)).get().then((r) => r?.n ?? 0);

  const since30 = istDay(now - 29 * 86_400_000);
  const [total, published, draft, pending, scheduled, rejected, catCount, roleCounts, recentPub, recentSub, mostViewed, byCat, byState, daily, views30] = await Promise.all([
    cnt(), cnt(eq(articles.status, "published")), cnt(eq(articles.status, "draft")), cnt(eq(articles.status, "pending")),
    cnt(and(eq(articles.status, "scheduled"), gte(articles.publishedAt, now))), cnt(eq(articles.status, "rejected")),
    db.select({ n: sql<number>`count(*)` }).from(categories).get().then((r) => r?.n ?? 0),
    db.select({ key: roles.key, n: sql<number>`count(${users.id})` }).from(roles).leftJoin(users, eq(users.roleId, roles.id)).groupBy(roles.id).all(),
    db.select({ id: articles.id, title: articles.title, publishedAt: articles.publishedAt, viewCount: articles.viewCount }).from(articles)
      .where(and(live, mine, eq(articles.status, "published"))).orderBy(desc(articles.publishedAt)).limit(8).all(),
    db.select({ id: articles.id, title: articles.title, submittedAt: articles.submittedAt, status: articles.status, author: users.name }).from(articles)
      .leftJoin(users, eq(users.id, articles.authorId))
      .where(and(live, mine, sql`${articles.submittedAt} IS NOT NULL`)).orderBy(desc(articles.submittedAt)).limit(8).all(),
    db.select({ id: articles.id, title: articles.title, viewCount: articles.viewCount }).from(articles)
      .where(and(live, mine, eq(articles.status, "published"))).orderBy(desc(articles.viewCount)).limit(8).all(),
    full ? db.select({ label: categories.name, n: sql<number>`count(${articles.id})` }).from(categories)
      .leftJoin(articles, and(or(eq(articles.categoryId, categories.id), eq(articles.subcategoryId, categories.id)), live, eq(articles.status, "published")))
      .where(isNull(categories.parentId)).groupBy(categories.id).orderBy(desc(sql`2`)).all() : Promise.resolve([]),
    full ? db.select({ label: states.name, n: sql<number>`count(${articles.id})` }).from(articles)
      .innerJoin(states, eq(states.id, articles.stateId)).where(and(live, eq(articles.status, "published"))).groupBy(states.id).orderBy(desc(sql`2`)).limit(12).all() : Promise.resolve([]),
    full ? db.select({ day: sql<string>`strftime('%Y-%m-%d', (${articles.publishedAt} / 1000) + 19800, 'unixepoch')`, n: sql<number>`count(*)` }).from(articles)
      .where(and(live, eq(articles.status, "published"), gte(articles.publishedAt, now - 29 * 86_400_000))).groupBy(sql`1`).all() : Promise.resolve([]),
    full ? db.select({ day: articleViews.day, n: sql<number>`sum(${articleViews.views})` }).from(articleViews).where(gte(articleViews.day, since30)).groupBy(articleViews.day).all() : Promise.resolve([]),
  ]);
  const roleN = (k: string) => roleCounts.find((r) => r.key === k)?.n ?? 0;
  const days = Array.from({ length: 30 }, (_, i) => istDay(now - (29 - i) * 86_400_000));
  const series = (rows: { day: string; n: number }[]) => days.map((d) => rows.find((r) => r.day === d)?.n ?? 0);
  const pubSeries = series(daily);
  const viewSeries = series(views30);

  const Spark = ({ data, label }: { data: number[]; label: string }) => {
    const max = Math.max(1, ...data);
    return (
      <>
        <div className="spark" role="img" aria-label={label}>{data.map((v, i) => <div key={i} style={{ height: `${(v / max) * 100}%` }} title={`${days[i]}: ${v}`} />)}</div>
        <div className="spark-labels">{days.map((d, i) => <span key={d}>{i % 5 === 0 ? d.slice(5) : ""}</span>)}</div>
      </>
    );
  };

  const S = ({ label, n, href, hl }: { label: string; n: number; href?: string; hl?: boolean }) =>
    href ? <Link className={`stat${hl ? " hl" : ""}`} href={href}><span>{label}</span><b>{n.toLocaleString("en-IN")}</b></Link>
      : <div className={`stat${hl ? " hl" : ""}`}><span>{label}</span><b>{n.toLocaleString("en-IN")}</b></div>;

  return (
    <>
      <div className="head">
        <div><h1>Namaste, {user.name.split(" ")[0]}</h1><p>{user.roleName}{full ? " · Site-wide overview" : " · Your articles"}</p></div>
        {can(user, "articles.create") ? <Link className="btn" href="/admin/news/new">＋ Add News</Link> : null}
      </div>

      <div className="stats">
        <S label="Total News" n={total} href="/admin/news" />
        <S label="Published" n={published} href="/admin/news?status=published" />
        <S label="Drafts" n={draft} href="/admin/news?status=draft" />
        <S label="Pending Approval" n={pending} href="/admin/news?status=pending" hl={pending > 0} />
        <S label="Scheduled" n={scheduled} href="/admin/news?status=scheduled" />
        <S label="Rejected" n={rejected} href="/admin/news?status=rejected" hl={!full && rejected > 0} />
        {full ? <>
          <S label="Categories" n={catCount} href={can(user, "categories.manage") ? "/admin/categories" : undefined} />
          <S label="Admin Users" n={roleN("super_admin") + roleN("admin")} href={can(user, "users.manage_all") ? "/admin/users" : undefined} />
          <S label="Editors" n={roleN("editor")} />
          <S label="Reporters" n={roleN("reporter")} />
        </> : null}
      </div>

      {full ? (
        <div className="grid g2">
          <div className="card"><h2>Articles published · last 30 days</h2><Spark data={pubSeries} label="Articles published per day" /></div>
          <div className="card"><h2>Page views · last 30 days</h2><Spark data={viewSeries} label="Article views per day" /><p className="hint" style={{ margin: "6px 0 0" }}>{viewSeries.reduce((a, b) => a + b, 0).toLocaleString("en-IN")} views in 30 days (one per reader per session).</p></div>
        </div>
      ) : null}

      <div className="grid g3">
        <div className="card">
          <h2>Recently Published</h2>
          <ul className="list">{recentPub.map((a) => <li key={a.id}><Link href={`/admin/news/${a.id}`}>{a.title}</Link><span className="hint" style={{ whiteSpace: "nowrap" }}>{fmt(a.publishedAt)}</span></li>)}</ul>
          {!recentPub.length ? <p className="hint">Nothing published yet.</p> : null}
        </div>
        <div className="card">
          <h2>Recently Submitted</h2>
          <ul className="list">{recentSub.map((a) => <li key={a.id}><span><Link href={`/admin/news/${a.id}`}>{a.title}</Link><br /><span className="hint">{a.author ?? "—"} · {fmt(a.submittedAt)}</span></span><span className={`badge b-${a.status}`}>{a.status}</span></li>)}</ul>
          {!recentSub.length ? <p className="hint">No submissions yet.</p> : null}
        </div>
        <div className="card">
          <h2>Most Viewed</h2>
          <ul className="list">{mostViewed.map((a) => <li key={a.id}><Link href={`/admin/news/${a.id}`}>{a.title}</Link><b>{a.viewCount.toLocaleString("en-IN")}</b></li>)}</ul>
          {!mostViewed.length ? <p className="hint">No views yet.</p> : null}
        </div>
      </div>

      {full ? (
        <div className="grid g2">
          <div className="card"><h2>Published news by category</h2><Bars rows={byCat} /></div>
          <div className="card"><h2>Published news by state</h2><Bars rows={byState} /></div>
        </div>
      ) : null}
    </>
  );
}
