"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles, categories, media } from "@/lib/schema";
import { audit } from "@/lib/audit";
import { errMessage, fbool, fstr, type FormState } from "@/lib/forms";
import { cleanText, isValidSlug, RESERVED_SLUGS, slugify, toInt } from "@/lib/util";

export async function saveCategory(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requireUser("categories.manage");
    const db = getDb();
    const id = toInt(fd.get("id"));
    const name = cleanText(fd.get("name"), 80);
    if (!name) return { error: "Enter a category name." };
    const nameEn = cleanText(fd.get("nameEn"), 80) || null;
    const slug = (fstr(fd, "slug").toLowerCase() || slugify(nameEn || name, 60));
    if (!isValidSlug(slug)) return { error: "Slug may contain only letters, numbers and hyphens." };
    if (RESERVED_SLUGS.has(slug)) return { error: `“${slug}” is reserved by the website. Choose another slug.` };
    const clash = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, slug)).limit(1).then((r) => r[0]);
    if (clash) return { error: `An article already uses the slug “${slug}”.` };
    const parentId = toInt(fd.get("parentId"));
    if (parentId) {
      const p = await db.select().from(categories).where(eq(categories.id, parentId)).limit(1).then((r) => r[0]);
      if (!p || p.parentId) return { error: "Subcategories can only be added under a main category." };
      if (id && parentId === id) return { error: "A category cannot be its own parent." };
      if (id) {
        const kids = await db.select({ n: sql<number>`count(*)::int` }).from(categories).where(eq(categories.parentId, id)).limit(1).then((r) => r[0]);
        if (kids?.n) return { error: "This category has subcategories, so it cannot become a subcategory itself." };
      }
    }
    const imageMediaId = toInt(fd.get("imageMediaId"));
    if (imageMediaId && !(await db.select({ id: media.id }).from(media).where(eq(media.id, imageMediaId)).limit(1).then((r) => r[0]))) return { error: "Selected image no longer exists." };
    const values = {
      name, nameEn, slug, parentId,
      description: cleanText(fd.get("description"), 500) || null,
      seoTitle: cleanText(fd.get("seoTitle"), 120) || null,
      seoDescription: cleanText(fd.get("seoDescription"), 300) || null,
      imageMediaId,
      sortOrder: Number(fd.get("sortOrder")) || 0,
      showInNav: fbool(fd, "showInNav"),
      isActive: fbool(fd, "isActive"),
      updatedAt: Date.now(),
    };
    if (id) {
      await db.update(categories).set(values).where(eq(categories.id, id));
      await audit(user, "category.update", "category", id, { name, slug });
    } else {
      const [r] = await db.insert(categories).values(values).returning({ id: categories.id });
      await audit(user, "category.create", "category", r.id, { name, slug });
    }
    revalidatePath("/admin/categories");
    return { ok: true, message: id ? "Category updated." : "Category added." };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

export async function deleteCategory(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await requireUser("categories.manage");
    const db = getDb();
    const id = toInt(fd.get("id"));
    if (!id) return { error: "Missing category." };
    const kids = await db.select({ n: sql<number>`count(*)::int` }).from(categories).where(eq(categories.parentId, id)).limit(1).then((r) => r[0]);
    if (kids?.n) return { error: "Delete or move its subcategories first." };
    const used = await db.select({ n: sql<number>`count(*)::int` }).from(articles).where(or(eq(articles.categoryId, id), eq(articles.subcategoryId, id))).limit(1).then((r) => r[0]);
    const moveTo = toInt(fd.get("moveTo"));
    if (used?.n) {
      if (!moveTo || moveTo === id) return { error: `${used.n} article(s) use this category. Choose a category to move them to.` };
      const target = await db.select().from(categories).where(and(eq(categories.id, moveTo), ne(categories.id, id))).limit(1).then((r) => r[0]);
      if (!target) return { error: "Choose a valid category to move articles to." };
      if (target.parentId) {
        await db.update(articles).set({ categoryId: target.parentId, subcategoryId: target.id }).where(or(eq(articles.categoryId, id), eq(articles.subcategoryId, id)));
      } else {
        await db.update(articles).set({ categoryId: target.id, subcategoryId: null }).where(or(eq(articles.categoryId, id), eq(articles.subcategoryId, id)));
      }
    }
    const c = await db.select().from(categories).where(eq(categories.id, id)).limit(1).then((r) => r[0]);
    await db.delete(categories).where(eq(categories.id, id));
    await audit(user, "category.delete", "category", id, { name: c?.name, movedArticles: used?.n ?? 0, moveTo });
    revalidatePath("/admin/categories");
    return { ok: true, message: "Category deleted." };
  } catch (e) {
    return { error: errMessage(e) };
  }
}
