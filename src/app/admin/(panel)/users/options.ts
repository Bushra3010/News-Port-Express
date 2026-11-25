import "server-only";
import { asc, isNull, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categories, roles, states } from "@/lib/schema";
import { assignableRoleRank } from "@/lib/permissions";
import type { AuthUser } from "@/lib/auth";

export async function userFormOptions(actor: AuthUser) {
  const db = getDb();
  const [r, c, s] = await Promise.all([
    db.select({ id: roles.id, name: roles.name, key: roles.key, description: roles.description }).from(roles).where(lte(roles.rank, assignableRoleRank(actor))).orderBy(asc(roles.rank)).all(),
    db.select({ id: categories.id, name: categories.name }).from(categories).where(isNull(categories.parentId)).orderBy(asc(categories.sortOrder)).all(),
    db.select({ id: states.id, name: states.name }).from(states).orderBy(asc(states.sortOrder)).all(),
  ]);
  return {
    roles: r.reverse(),
    categories: actor.categoryScope ? c.filter((x) => actor.categoryScope!.includes(x.id)) : c,
    states: actor.stateScope ? s.filter((x) => actor.stateScope!.includes(x.id)) : s,
  };
}
