import { asc, eq } from "drizzle-orm";
import { apiUser } from "@/lib/admin-api";
import { getDb } from "@/lib/db";
import { cities, districts } from "@/lib/schema";
import { toInt } from "@/lib/util";

/** Districts of a state (?state=) or cities of a district (?district=), for the article editor. */
export async function GET(req: Request) {
  const user = await apiUser(req);
  if (user instanceof Response) return user;
  const u = new URL(req.url);
  const db = getDb();
  const state = toInt(u.searchParams.get("state"));
  const district = toInt(u.searchParams.get("district"));
  if (state) {
    const rows = await db.select({ id: districts.id, name: districts.name }).from(districts).where(eq(districts.stateId, state)).orderBy(asc(districts.sortOrder), asc(districts.name)).all();
    return Response.json({ items: rows });
  }
  if (district) {
    const rows = await db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.districtId, district)).orderBy(asc(cities.sortOrder), asc(cities.name)).all();
    return Response.json({ items: rows });
  }
  return Response.json({ items: [] });
}
