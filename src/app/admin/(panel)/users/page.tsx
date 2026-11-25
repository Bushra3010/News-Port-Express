import Link from "next/link";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { can, requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles, roles, users } from "@/lib/schema";
import { cleanText, toInt } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

const fmt = (ms: number | null) => (ms ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(ms) : "Never");

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; msg?: string }> }) {
  const me = await requirePage(undefined, { any: ["users.manage", "users.manage_all"] });
  const sp = await searchParams;
  const q = cleanText(sp.q, 60);
  const role = toInt(sp.role);
  const db = getDb();
  const creator = alias(users, "creator");
  const conds: SQL[] = [];
  if (!can(me, "users.manage_all")) conds.push(sql`(${users.createdBy} = ${me.id} OR ${users.id} = ${me.id})`);
  if (q) conds.push(sql`(${users.name} ILIKE ${`%${q}%`} OR ${users.email} ILIKE ${`%${q}%`} OR ${users.username} ILIKE ${`%${q}%`})`);
  if (role) conds.push(eq(users.roleId, role));
  const [rows, roleList] = await Promise.all([
    db.select({
      u: users, roleName: roles.name, roleKey: roles.key, creator: creator.name,
      n: sql<number>`(SELECT count(*)::int FROM ${articles} a WHERE a.author_id = ${users.id} AND a.deleted_at IS NULL)`,
    }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).leftJoin(creator, eq(creator.id, users.createdBy))
      .where(conds.length ? and(...conds) : undefined).orderBy(desc(roles.rank), asc(users.name)),
    db.select().from(roles).orderBy(desc(roles.rank)),
  ]);
  return (
    <>
      <div className="head">
        <div><h1>Users</h1><p>{can(me, "users.manage_all") ? "All admin panel accounts." : "Editors and reporters you manage."}</p></div>
        <Link className="btn" href="/admin/users/new">＋ Add user</Link>
      </div>
      {sp.msg ? <div className="alert ok">{sp.msg.slice(0, 120)}</div> : null}
      <form className="row card" style={{ padding: 12 }}>
        <input type="search" name="q" defaultValue={q} placeholder="Search name, email or login ID" style={{ flex: 1 }} />
        <select name="role" defaultValue={role ?? ""} style={{ width: "auto" }}><option value="">All roles</option>{roleList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <button className="btn ghost">Filter</button>
      </form>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Login ID</th><th>Role</th><th>Status</th><th className="hide-m">Articles</th><th className="hide-m">Last sign-in</th><th className="hide-m">Created by</th></tr></thead>
          <tbody>
            {rows.map(({ u, roleName, roleKey, creator: by, n }) => (
              <tr key={u.id}>
                <td><Link className="t" href={`/admin/users/${u.id}`}>{u.name}</Link><span className="sub">{u.email}</span></td>
                <td><code>{u.username}</code></td>
                <td>{roleName}{u.canPublish && (roleKey === "editor" || roleKey === "reporter") ? <div className="sub">can publish</div> : null}</td>
                <td><span className={`badge ${u.isActive ? "b-on" : "b-off"}`}>{u.isActive ? "Active" : "Inactive"}</span>{u.mustChangePassword ? <div className="sub">temp. password</div> : null}</td>
                <td className="hide-m">{n}</td>
                <td className="hide-m">{fmt(u.lastLoginAt)}</td>
                <td className="hide-m">{by ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
