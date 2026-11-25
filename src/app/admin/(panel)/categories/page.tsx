import { asc, eq, sql } from "drizzle-orm";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles, categories, media } from "@/lib/schema";
import CategoryManager from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requirePage("categories.manage");
  const db = getDb();
  const rows = await db
    .select({
      c: categories, imageKey: media.storageKey,
      n: sql<number>`(SELECT count(*)::int FROM ${articles} a WHERE (a.category_id = ${categories.id} OR a.subcategory_id = ${categories.id}) AND a.deleted_at IS NULL)`,
    })
    .from(categories)
    .leftJoin(media, eq(media.id, categories.imageMediaId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  const list = rows.map((r) => ({ ...r.c, imageUrl: r.imageKey ? `/media/${r.imageKey}` : null, articleCount: r.n }));
  return (
    <>
      <div className="head"><div><h1>Categories</h1><p>Main categories appear in the menu and get their own page. Subcategories appear as chips on their parent’s page.</p></div></div>
      <CategoryManager list={list} />
    </>
  );
}
