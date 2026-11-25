"use server";

import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles, cities, districts, states } from "@/lib/schema";
import { audit } from "@/lib/audit";
import { errMessage, fbool, fstr } from "@/lib/forms";
import { cleanText, isValidSlug, slugify, toInt } from "@/lib/util";

type Kind = "state" | "district" | "city";
const back = (msg: string, err = false, open?: number | null) =>
  redirect(`/admin/locations?${err ? "err" : "msg"}=${encodeURIComponent(msg)}${open ? `&open=${open}` : ""}`);

export async function saveLocation(fd: FormData) {
  const user = await requireUser("locations.manage");
  const kind = fstr(fd, "kind") as Kind;
  const id = toInt(fd.get("id"));
  const name = cleanText(fd.get("name"), 80);
  const nameEn = cleanText(fd.get("nameEn"), 80) || null;
  const slug = fstr(fd, "slug").toLowerCase() || slugify(nameEn || name, 60);
  const sortOrder = Number(fd.get("sortOrder")) || 0;
  const parent = toInt(fd.get("parentId"));
  const openState = toInt(fd.get("openState"));
  let msg = "";
  try {
    if (!name) throw new Error("Enter a name.");
    if (!isValidSlug(slug)) throw new Error("Slug may contain only letters, numbers and hyphens.");
    const db = getDb();
    if (kind === "state") {
      const v = { name, nameEn, slug, sortOrder, isActive: fbool(fd, "isActive") };
      if (await db.select({ id: states.id }).from(states).where(id ? and(eq(states.slug, slug), ne(states.id, id)) : eq(states.slug, slug)).limit(1).then((r) => r[0])) throw new Error(`Slug “${slug}” is already used by another state.`);
      if (id) await db.update(states).set(v).where(eq(states.id, id));
      else await db.insert(states).values(v);
    } else if (kind === "district") {
      if (!parent) throw new Error("Choose a state.");
      const v = { name, nameEn, slug, sortOrder, stateId: parent };
      if (await db.select({ id: districts.id }).from(districts).where(and(eq(districts.stateId, parent), eq(districts.slug, slug), id ? ne(districts.id, id) : undefined)).limit(1).then((r) => r[0])) throw new Error(`This state already has a district with slug “${slug}”.`);
      if (id) await db.update(districts).set(v).where(eq(districts.id, id));
      else await db.insert(districts).values(v);
    } else if (kind === "city") {
      if (!parent) throw new Error("Choose a district.");
      const v = { name, nameEn, slug, sortOrder, districtId: parent, isFeatured: fbool(fd, "isFeatured") };
      if (await db.select({ id: cities.id }).from(cities).where(and(eq(cities.districtId, parent), eq(cities.slug, slug), id ? ne(cities.id, id) : undefined)).limit(1).then((r) => r[0])) throw new Error(`This district already has a city with slug “${slug}”.`);
      if (id) await db.update(cities).set(v).where(eq(cities.id, id));
      else await db.insert(cities).values(v);
    } else throw new Error("Unknown item.");
    await audit(user, `${kind}.${id ? "update" : "create"}`, kind, id, { name, slug });
    msg = `${kind[0].toUpperCase() + kind.slice(1)} “${name}” ${id ? "updated" : "added"}.`;
  } catch (e) {
    back(e instanceof Error && !("digest" in e) ? e.message : errMessage(e), true, openState);
  }
  back(msg, false, openState);
}

export async function deleteLocation(fd: FormData) {
  const user = await requireUser("locations.manage");
  const kind = fstr(fd, "kind") as Kind;
  const id = toInt(fd.get("id"));
  const openState = toInt(fd.get("openState"));
  if (!id) back("Missing item.", true);
  const db = getDb();
  const col = kind === "state" ? articles.stateId : kind === "district" ? articles.districtId : articles.cityId;
  const used = await db.select({ n: sql<number>`count(*)::int` }).from(articles).where(eq(col, id!)).limit(1).then((r) => r[0]);
  if (used?.n) back(`${used.n} article(s) are tagged with this ${kind}. Re-tag them before deleting.`, true, openState);
  if (kind === "state") {
    const n = await db.select({ n: sql<number>`count(*)::int` }).from(districts).where(eq(districts.stateId, id!)).limit(1).then((r) => r[0]);
    if (n?.n) back("Delete its districts first.", true, openState);
    await db.delete(states).where(eq(states.id, id!));
  } else if (kind === "district") {
    const n = await db.select({ n: sql<number>`count(*)::int` }).from(cities).where(eq(cities.districtId, id!)).limit(1).then((r) => r[0]);
    if (n?.n) back("Delete its cities first.", true, openState);
    await db.delete(districts).where(eq(districts.id, id!));
  } else {
    await db.delete(cities).where(eq(cities.id, id!));
  }
  await audit(user, `${kind}.delete`, kind, id);
  back("Deleted.", false, openState);
}
