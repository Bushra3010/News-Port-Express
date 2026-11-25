import Link from "next/link";
import { and, desc, like, sql, type SQL } from "drizzle-orm";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/schema";
import { cleanText } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit Log" };
const PER = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePage("audit.view");
  const sp = await searchParams;
  const q = cleanText(sp.q, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const conds: SQL[] = [];
  if (q) conds.push(sql`(${auditLogs.action} LIKE ${`%${q}%`} OR ${auditLogs.userName} LIKE ${`%${q}%`} OR ${auditLogs.details} LIKE ${`%${q}%`} OR ${auditLogs.entityId} = ${q})`);
  const where = conds.length ? and(...conds) : undefined;
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(PER).offset((page - 1) * PER).all(),
    db.select({ n: sql<number>`count(*)` }).from(auditLogs).where(where).get(),
  ]);
  const pages = Math.ceil((total?.n ?? 0) / PER);
  const link = (e: string, id: string | null) => (id && e === "article" ? `/admin/news/${id}` : id && e === "user" ? `/admin/users/${id}` : null);
  void like;
  return (
    <>
      <div className="head"><div><h1>Audit Log</h1><p>Every sign-in setup, content change, permission change and deletion, with who did it and from which IP.</p></div></div>
      <form className="row card" style={{ padding: 12 }}><input type="search" name="q" defaultValue={q} placeholder="Search action, user or details" style={{ flex: 1 }} /><button className="btn ghost">Search</button></form>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>When (IST)</th><th>User</th><th>Action</th><th>Item</th><th className="hide-m">Details</th><th className="hide-m">IP</th></tr></thead>
          <tbody>{rows.map((r) => {
            const href = link(r.entity, r.entityId);
            return (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}>{new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(r.createdAt)}</td>
                <td>{r.userName ?? "—"}</td>
                <td><code>{r.action}</code></td>
                <td>{href ? <Link href={href}>{r.entity} #{r.entityId}</Link> : `${r.entity}${r.entityId ? ` #${r.entityId}` : ""}`}</td>
                <td className="hide-m"><span className="sub" style={{ wordBreak: "break-word" }}>{r.details?.slice(0, 200)}</span></td>
                <td className="hide-m"><span className="sub">{r.ip ?? ""}</span></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="pager">
          {page > 1 ? <Link href={`/admin/audit?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>‹ Newer</Link> : null}
          <span className="cur">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/admin/audit?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}>Older ›</Link> : null}
        </div>
      ) : null}
    </>
  );
}
