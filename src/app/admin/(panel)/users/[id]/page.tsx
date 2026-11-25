import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { can, requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { roles, userCategories, users, userStates } from "@/lib/schema";
import { toInt } from "@/lib/util";
import UserForm from "@/components/admin/UserForm";
import { userFormOptions } from "../options";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit user" };

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePage(undefined, { any: ["users.manage", "users.manage_all"] });
  const id = toInt((await params).id);
  const db = getDb();
  const row = id ? await db.select({ u: users, rank: roles.rank }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).where(eq(users.id, id)).get() : undefined;
  if (!row) notFound();
  const isSelf = row.u.id === me.id;
  if (!can(me, "users.manage_all") && !isSelf && (row.u.createdBy !== me.id || row.rank >= me.roleRank)) forbidden();
  if (isSelf && !can(me, "users.manage_all")) {
    return <div className="alert info">Edit your own details from <Link href="/admin/profile">My Profile</Link>.</div>;
  }
  const [o, cats, sts] = await Promise.all([
    userFormOptions(me),
    db.select({ id: userCategories.categoryId }).from(userCategories).where(eq(userCategories.userId, row.u.id)).all(),
    db.select({ id: userStates.stateId }).from(userStates).where(eq(userStates.userId, row.u.id)).all(),
  ]);
  const u = row.u;
  return (
    <>
      <div className="head"><div><h1>{u.name}</h1><p><Link href="/admin/users">‹ All users</Link> · <Link href={`/admin/news?author=${u.id}`}>View their articles</Link></p></div></div>
      <UserForm isSelf={isSelf} roles={o.roles} categories={o.categories} states={o.states}
        data={{ id: u.id, name: u.name, email: u.email, username: u.username, roleId: u.roleId, phone: u.phone ?? "", bio: u.bio ?? "", canPublish: u.canPublish, isActive: u.isActive, scopeCategories: cats.map((c) => c.id), scopeStates: sts.map((s) => s.id) }} />
    </>
  );
}
