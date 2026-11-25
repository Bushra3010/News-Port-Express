"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { pages } from "@/lib/schema";
import { audit } from "@/lib/audit";
import { errMessage, fbool, fstr, type FormState } from "@/lib/forms";
import { cleanText, isValidSlug, sanitizeHtml, slugify, toInt } from "@/lib/util";

export async function savePage(_: FormState, fd: FormData): Promise<FormState> {
  let newId: number | null = null;
  try {
    const me = await requireUser("pages.manage");
    const db = getDb();
    const id = toInt(fd.get("id"));
    const title = cleanText(fd.get("title"), 120);
    if (!title) return { error: "Enter a title." };
    const slug = fstr(fd, "slug").toLowerCase() || slugify(title, 60);
    if (!isValidSlug(slug)) return { error: "Slug may contain only letters, numbers and hyphens." };
    if (await db.select({ id: pages.id }).from(pages).where(id ? and(eq(pages.slug, slug), ne(pages.id, id)) : eq(pages.slug, slug)).limit(1).then((r) => r[0])) return { error: "Another page already uses this slug." };
    const v = {
      title, slug, content: sanitizeHtml(String(fd.get("content") ?? "")), metaDescription: cleanText(fd.get("metaDescription"), 300) || null,
      isPublished: fbool(fd, "isPublished"), showInFooter: fbool(fd, "showInFooter"), sortOrder: Number(fd.get("sortOrder")) || 0,
      updatedBy: me.id, updatedAt: Date.now(),
    };
    if (id) {
      await db.update(pages).set(v).where(eq(pages.id, id));
      await audit(me, "page.update", "page", id, { slug });
    } else {
      const [r] = await db.insert(pages).values(v).returning({ id: pages.id });
      newId = r.id;
      await audit(me, "page.create", "page", r.id, { slug });
    }
    revalidatePath("/admin/pages");
    if (!newId) return { ok: true, message: "Page saved." };
  } catch (e) {
    return { error: errMessage(e) };
  }
  redirect(`/admin/pages/${newId}`);
}

export async function deletePage(fd: FormData) {
  const me = await requireUser("pages.manage");
  const id = toInt(fd.get("id"));
  if (id) {
    await getDb().delete(pages).where(eq(pages.id, id));
    await audit(me, "page.delete", "page", id);
  }
  redirect("/admin/pages");
}
