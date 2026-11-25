#!/usr/bin/env node
// Integration check for the Supabase Postgres port.
//
// Runs the real schema, RLS, seed and demo SQL against PGlite (Postgres built
// to WASM), then executes the query shapes that changed in the move off SQLite.
// No network and no credentials, so it can run before Supabase is reachable.
//
//   node --experimental-strip-types db/verify.mjs
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, asc, desc, eq, gte, ilike, isNull, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as schema from "../src/lib/schema.ts";

const { articles, articleViews, categories, cities, districts, media, states, users, roles, permissions, rolePermissions, pages, settings, auditLogs, pollVotes, tags, articleTags, articleMedia, loginAttempts, sessions } = schema;

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name} ${extra}`); failures++; }
};

const pg = new PGlite();
const db = drizzle(pg, { schema });
const read = (f) => readFile(f, "utf8");

console.log("\n1. schema");
await pg.exec(await read("db/migrations/0000_init.sql"));
const tables = await pg.query(`select tablename from pg_tables where schemaname='public' order by 1`);
check(`22 tables created`, tables.rows.length === 22, `(got ${tables.rows.length})`);

console.log("\n2. row level security");
// Supabase ships these roles; PGlite does not, so stand them up first.
await pg.exec(`create role anon; create role authenticated;`);
await pg.exec(await read("db/rls.sql"));
const rls = await pg.query(`select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity`);
check("RLS enabled on every table", rls.rows[0].n === 0, `(${rls.rows[0].n} without)`);
const grants = await pg.query(
  `select count(*)::int n from information_schema.role_table_grants
   where table_schema='public' and grantee in ('anon','authenticated')`,
);
check("no grants left for anon/authenticated", grants.rows[0].n === 0, `(${grants.rows[0].n} grants)`);

console.log("\n3. seed");
await pg.exec(await read("db/seed.sql"));
const [permCount] = await db.select({ n: sql`count(*)::int` }).from(permissions);
const [roleCount] = await db.select({ n: sql`count(*)::int` }).from(roles);
const [catCount] = await db.select({ n: sql`count(*)::int` }).from(categories);
const [stateCount] = await db.select({ n: sql`count(*)::int` }).from(states);
const [cityCount] = await db.select({ n: sql`count(*)::int` }).from(cities);
const [pageCount] = await db.select({ n: sql`count(*)::int` }).from(pages);
check("21 permissions", permCount.n === 21, `(got ${permCount.n})`);
check("4 roles", roleCount.n === 4, `(got ${roleCount.n})`);
check("categories seeded", catCount.n > 15, `(got ${catCount.n})`);
check("36 states/UTs", stateCount.n === 36, `(got ${stateCount.n})`);
check("cities seeded", cityCount.n > 20, `(got ${cityCount.n})`);
check("6 static pages", pageCount.n === 6, `(got ${pageCount.n})`);
check("count() returns a number, not a string", typeof permCount.n === "number", `(got ${typeof permCount.n})`);

console.log("\n4. seed is re-runnable");
await pg.exec(await read("db/seed.sql"));
const [permAgain] = await db.select({ n: sql`count(*)::int` }).from(permissions);
check("second seed run inserts nothing", permAgain.n === 21, `(got ${permAgain.n})`);

console.log("\n5. identity sequences recovered from explicit ids");
const [newCat] = await db.insert(categories).values({ name: "परीक्षण", slug: "seq-test", sortOrder: 999 }).returning();
check("new category gets a free id", newCat.id > catCount.n - 1, `(id ${newCat.id})`);
const [newState] = await db.insert(states).values({ name: "परीक्षण राज्य", slug: "seq-state" }).returning();
check("new state gets a free id", newState.id > 36, `(id ${newState.id})`);
await db.delete(categories).where(eq(categories.id, newCat.id));
await db.delete(states).where(eq(states.id, newState.id));

console.log("\n6. demo articles");
await pg.exec(await read("db/demo.sql"));
const [artCount] = await db.select({ n: sql`count(*)::int` }).from(articles);
check("demo articles inserted", artCount.n > 20, `(got ${artCount.n})`);

console.log("\n7. timestamps survive the bigint round trip");
const [one] = await db.select().from(articles).orderBy(desc(articles.publishedAt)).limit(1);
check("publishedAt is a number", typeof one.publishedAt === "number", `(got ${typeof one.publishedAt}: ${one.publishedAt})`);
check("publishedAt is epoch-ms, not seconds", one.publishedAt > 1e12, `(got ${one.publishedAt})`);
check("createdAt default is epoch-ms", one.createdAt > 1e12, `(got ${one.createdAt})`);
check("booleans are real booleans", typeof one.isBreaking === "boolean", `(got ${typeof one.isBreaking})`);

console.log("\n8. public listing query (9 joins, the article page shape)");
const cat = alias(categories, "cat");
const img = alias(media, "img");
const sub = alias(categories, "sub");
const og = alias(media, "og");
const vid = alias(media, "vid");
const publicWhere = () => and(isNull(articles.deletedAt), inArray(articles.status, ["published", "scheduled"]), lte(articles.publishedAt, Date.now()));
const cards = await db
  .select({ id: articles.id, slug: articles.slug, title: articles.title, categorySlug: cat.slug, imageKey: img.storageKey, cityName: cities.name })
  .from(articles)
  .leftJoin(cat, eq(cat.id, articles.categoryId))
  .leftJoin(img, eq(img.id, articles.featuredMediaId))
  .leftJoin(cities, eq(cities.id, articles.cityId))
  .where(publicWhere())
  .orderBy(desc(articles.publishedAt), desc(articles.id))
  .limit(12);
check("listing returns cards", cards.length === 12, `(got ${cards.length})`);
check("category joined", cards.every((c) => c.categorySlug), "(a card has no category)");

const full = await db
  .select({ a: articles, categorySlug: cat.slug, subSlug: sub.slug, stateSlug: states.slug, districtSlug: districts.slug, citySlug: cities.slug, authorName: users.name, imageKey: img.storageKey, ogKey: og.storageKey, videoKey: vid.storageKey })
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
  .where(and(eq(articles.slug, "demo-1"), publicWhere()))
  .limit(1)
  .then((r) => r[0]);
check("single article with every join", !!full && full.a.slug === "demo-1");

console.log("\n9. Hindi search is case-insensitive (ILIKE)");
const q = "%मेट्रो%";
const hits = await db.select({ id: articles.id }).from(articles)
  .where(and(publicWhere(), sql`(${articles.title} ILIKE ${q} OR ${articles.summary} ILIKE ${q} OR ${articles.keywords} ILIKE ${q})`));
check("Hindi ILIKE search matches", hits.length > 0, `(got ${hits.length})`);
const mixed = await db.select({ id: media.id }).from(media).where(ilike(media.filename, "%X%"));
check("ilike() helper runs", Array.isArray(mixed));

console.log("\n10. trending: correlated sum subquery");
const istDay = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
const since = istDay(Date.now() - 2 * 86400000);
const views = sql`coalesce((SELECT sum(views)::int FROM ${articleViews} v WHERE v.article_id = ${articles.id} AND v.day >= ${since}), 0)`;
const trend = await db.select({ id: articles.id, title: articles.title }).from(articles)
  .where(and(publicWhere(), sql`${articles.publishedAt} > ${Date.now() - 7 * 86400000}`))
  .orderBy(desc(articles.isTrending), desc(views), desc(articles.publishedAt))
  .limit(8);
check("trending query runs", trend.length > 0, `(got ${trend.length})`);

console.log("\n11. recordView: upsert inside a transaction");
const target = cards[0].id;
const day = istDay();
for (let i = 0; i < 2; i++) {
  await db.transaction(async (tx) => {
    await tx.insert(articleViews).values({ articleId: target, day, views: 1 }).onConflictDoUpdate({
      target: [articleViews.articleId, articleViews.day],
      set: { views: sql`${articleViews.views} + 1` },
    });
    await tx.update(articles).set({ viewCount: sql`${articles.viewCount} + 1` }).where(eq(articles.id, target));
  });
}
const [vrow] = await db.select().from(articleViews).where(and(eq(articleViews.articleId, target), eq(articleViews.day, day)));
check("upsert counted both views", vrow.views === 2, `(got ${vrow.views})`);
const [vart] = await db.select({ v: articles.viewCount }).from(articles).where(eq(articles.id, target));
check("article view counter incremented", vart.v === 2, `(got ${vart.v})`);

console.log("\n12. dashboard: IST day bucketing (replaces SQLite strftime)");
const daily = await db
  .select({ day: sql`to_char(to_timestamp(${articles.publishedAt} / 1000.0) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`, n: sql`count(*)::int` })
  .from(articles)
  .where(and(isNull(articles.deletedAt), eq(articles.status, "published"), gte(articles.publishedAt, Date.now() - 29 * 86400000)))
  .groupBy(sql`1`);
check("day buckets produced", daily.length > 0, `(got ${daily.length})`);
check("day looks like YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(daily[0].day), `(got ${daily[0].day})`);
check("bucket count is a number", typeof daily[0].n === "number", `(got ${typeof daily[0].n})`);

console.log("\n13. news table: CASE status + GROUP BY ordinal");
const counts = await db.select({
  status: sql`CASE WHEN ${articles.deletedAt} IS NOT NULL THEN 'trash' WHEN ${articles.status} = 'scheduled' AND ${articles.publishedAt} <= ${Date.now()} THEN 'published' ELSE ${articles.status} END`,
  n: sql`count(*)::int`,
}).from(articles).groupBy(sql`1`);
check("status buckets produced", counts.length > 0, `(got ${counts.length})`);
check("bucket totals are numbers", counts.every((c) => typeof c.n === "number"));

console.log("\n14. category/state statistics with ordinal ORDER BY");
const byCat = await db.select({ label: categories.name, n: sql`count(${articles.id})::int` }).from(categories)
  .leftJoin(articles, and(or(eq(articles.categoryId, categories.id), eq(articles.subcategoryId, categories.id)), isNull(articles.deletedAt), eq(articles.status, "published")))
  .where(isNull(categories.parentId)).groupBy(categories.id).orderBy(desc(sql`2`));
check("category stats run", byCat.length > 0, `(got ${byCat.length})`);
const byState = await db.select({ label: states.name, n: sql`count(${articles.id})::int` }).from(articles)
  .innerJoin(states, eq(states.id, articles.stateId)).where(and(isNull(articles.deletedAt), eq(articles.status, "published")))
  .groupBy(states.id).orderBy(desc(sql`2`)).limit(12);
check("state stats run", Array.isArray(byState));

console.log("\n15. sitemap: max() epoch comes back as a number");
const sm = await db.select({ n: sql`count(*)::int`, last: sql`max(${articles.updatedAt})::float8` }).from(articles).where(publicWhere()).limit(1).then((r) => r[0]);
check("max(updatedAt) is a number", typeof sm.last === "number", `(got ${typeof sm.last}: ${sm.last})`);
check("max(updatedAt) is a valid date", !Number.isNaN(new Date(sm.last).getTime()) && new Date(sm.last).getFullYear() > 2020, `(got ${new Date(sm.last).toISOString()})`);

console.log("\n16. auth: session join and login throttle counter");
const [role] = await db.select().from(roles).where(eq(roles.key, "super_admin")).limit(1);
const [u] = await db.insert(users).values({ name: "Test Admin", email: "t@example.com", username: "testadmin", passwordHash: "x", roleId: role.id }).returning();
await db.insert(sessions).values({ id: "a".repeat(64), userId: u.id, expiresAt: Date.now() + 86400000 });
const sess = await db.select({ id: users.id, name: users.name, roleKey: roles.key, roleRank: roles.rank })
  .from(sessions).innerJoin(users, eq(users.id, sessions.userId)).innerJoin(roles, eq(roles.id, users.roleId))
  .where(and(eq(sessions.id, "a".repeat(64)), sql`${sessions.expiresAt} > ${Date.now()}`)).limit(1).then((r) => r[0]);
check("session resolves to a user", sess?.id === u.id && sess?.name === "Test Admin" && sess?.roleKey === "super_admin");
check("role rank is a number", typeof sess.roleRank === "number");
const perms = await db.select({ k: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleId, role.id));
check("super admin has all 21 permissions", perms.length === 21, `(got ${perms.length})`);
await db.insert(loginAttempts).values([
  { identifier: "t@example.com", ip: "1.2.3.4", success: false },
  { identifier: "t@example.com", ip: "1.2.3.4", success: false },
]);
const fails = await db.select({ n: sql`count(*)::int` }).from(loginAttempts)
  .where(and(eq(loginAttempts.identifier, "t@example.com"), eq(loginAttempts.success, false), sql`${loginAttempts.createdAt} > ${Date.now() - 900000}`))
  .limit(1).then((r) => r[0]);
check("failed-login counter is a number", fails.n === 2, `(got ${fails.n} as ${typeof fails.n})`);
const byIdent = await db.select().from(users).where(sql`${users.email} = ${"t@example.com"} OR ${users.username} = ${"t@example.com"}`).limit(1).then((r) => r[0]);
check("login lookup by email or username", byIdent?.id === u.id);

console.log("\n17. settings JSON and poll upsert");
const [site] = await db.select().from(settings).where(eq(settings.key, "site")).limit(1);
check("site settings stored as JSON text", JSON.parse(site.value).name === "NewsPort Express");
for (let i = 0; i < 3; i++) {
  await db.insert(pollVotes).values({ pollId: "poll-1", optionIndex: 0, votes: 1 })
    .onConflictDoUpdate({ target: [pollVotes.pollId, pollVotes.optionIndex], set: { votes: sql`${pollVotes.votes} + 1` } });
}
const [pv] = await db.select().from(pollVotes).where(eq(pollVotes.pollId, "poll-1"));
check("poll votes accumulate", pv.votes === 3, `(got ${pv.votes})`);

console.log("\n18. audit log and cascade deletes");
await db.insert(auditLogs).values({ userId: u.id, userName: "Test Admin", action: "test.run", entity: "test", entityId: "1", ip: "1.2.3.4" });
const [al] = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(1);
check("audit row written with epoch-ms", al.createdAt > 1e12);
await db.delete(users).where(eq(users.id, u.id));
const leftover = await db.select({ n: sql`count(*)::int` }).from(sessions).where(eq(sessions.userId, u.id)).limit(1).then((r) => r[0]);
check("sessions cascade on user delete", leftover.n === 0, `(got ${leftover.n})`);

console.log("\n19. location hierarchy pages");
const sw = await db.select({ id: states.id, name: states.name, n: sql`count(${articles.id})::int` }).from(states)
  .leftJoin(articles, and(eq(articles.stateId, states.id), publicWhere())).where(eq(states.isActive, true))
  .groupBy(states.id).orderBy(asc(states.sortOrder));
check("statesWithNews runs", sw.length === 36, `(got ${sw.length})`);
const fc = await db.select({ name: cities.name, districtSlug: districts.slug, stateSlug: states.slug }).from(cities)
  .innerJoin(districts, eq(districts.id, cities.districtId)).innerJoin(states, eq(states.id, districts.stateId))
  .where(eq(cities.isFeatured, true)).orderBy(asc(states.sortOrder), asc(cities.sortOrder));
check("featured cities resolve full path", fc.length > 0 && !!fc[0].stateSlug, `(got ${fc.length})`);

await pg.close();
console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
