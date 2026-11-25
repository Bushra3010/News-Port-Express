import { Fragment } from "react";
import { asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { permissions, rolePermissions, roles } from "@/lib/schema";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Roles & Permissions" };

async function savePermissions(fd: FormData) {
  "use server";
  const me = await requirePage("users.manage_all");
  const db = getDb();
  const [roleRows, permRows] = await Promise.all([db.select().from(roles).all(), db.select().from(permissions).all()]);
  const valid = new Set(permRows.map((p) => p.key));
  const changes: Record<string, string[]> = {};
  for (const r of roleRows) {
    if (r.key === "super_admin") continue; // always has everything
    const keys = fd.getAll(`r${r.id}`).map(String).filter((k) => valid.has(k));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, r.id));
    if (keys.length) await db.insert(rolePermissions).values(keys.map((permissionKey) => ({ roleId: r.id, permissionKey })));
    changes[r.key] = keys;
  }
  await audit(me, "roles.update_permissions", "role", null, changes);
  revalidatePath("/admin/roles");
  redirect("/admin/roles?saved=1");
}

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requirePage("users.manage_all");
  const db = getDb();
  const [roleRows, permRows, rp] = await Promise.all([
    db.select().from(roles).orderBy(desc(roles.rank)).all(),
    db.select().from(permissions).orderBy(asc(permissions.groupName)).all(),
    db.select().from(rolePermissions).all(),
  ]);
  const has = (roleId: number, k: string) => rp.some((x) => x.roleId === roleId && x.permissionKey === k);
  const groups = [...new Set(permRows.map((p) => p.groupName))];
  return (
    <>
      <div className="head"><div><h1>Roles &amp; Permissions</h1><p>Every permission is enforced on the server. Super Admin always has full access. “Can publish” on an individual editor/reporter adds publishing rights on top of their role.</p></div></div>
      {(await searchParams).saved ? <div className="alert ok">Permissions saved. They apply on each user’s next page load.</div> : null}
      <form action={savePermissions} className="grid">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Permission</th>{roleRows.map((r) => <th key={r.id} style={{ textAlign: "center" }}>{r.name}</th>)}</tr></thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr><td colSpan={roleRows.length + 1} style={{ background: "var(--soft)", fontWeight: 800 }}>{g}</td></tr>
                  {permRows.filter((p) => p.groupName === g).map((p) => (
                    <tr key={p.key}>
                      <td>{p.label}<div className="sub"><code>{p.key}</code></div></td>
                      {roleRows.map((r) => (
                        <td key={r.id} style={{ textAlign: "center" }}>
                          <input type="checkbox" name={`r${r.id}`} value={p.key} defaultChecked={r.key === "super_admin" || has(r.id, p.key)} disabled={r.key === "super_admin"} aria-label={`${r.name}: ${p.label}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn">Save permissions</button></div>
      </form>
      <div className="card">
        <h2>Role summary</h2>
        <ul className="list">{roleRows.map((r) => <li key={r.id}><b>{r.name}</b><span className="hint">{r.description}</span></li>)}</ul>
      </div>
    </>
  );
}
