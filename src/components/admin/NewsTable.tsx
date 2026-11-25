"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { articleBulk } from "@/app/admin/(panel)/news/actions";
import type { FormState } from "@/lib/forms";

export type Row = {
  id: number; title: string; slug: string; status: string; type: string; publishedAt: number | null; updatedAt: number; createdAt: number;
  deletedAt: number | null; isBreaking: boolean; isFeatured: boolean; viewCount: number; categoryName: string | null; categorySlug: string | null;
  stateName: string | null; authorName: string | null; byline: string | null; thumb: string | null;
};

const LABEL: Record<string, string> = { draft: "Draft", pending: "Pending", approved: "Approved", published: "Published", scheduled: "Scheduled", rejected: "Rejected", archived: "Archived" };
const fmt = (ms: number | null) => (ms ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(ms) : "—");

export default function NewsTable({ rows, sort, dir, sortHref, trashView, canDelete, bulkOps }: {
  rows: Row[]; sort: string; dir: string; sortHref: Record<string, string>; trashView: boolean; canDelete: boolean;
  bulkOps: { publish: boolean; unpublish: boolean; approve: boolean; submit: boolean; trash: boolean; archive: boolean };
}) {
  const [sel, setSel] = useState<number[]>([]);
  const [state, action, pending] = useFormAction(articleBulk);
  const router = useRouter();
  useEffect(() => { if (state?.ok) { setSel([]); router.refresh(); } }, [state, router]);
  const all = rows.length > 0 && sel.length === rows.length;
  const S = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <Link href={sortHref[k]}>{children}{sort === k ? (dir === "asc" ? " ▲" : " ▼") : ""}</Link>
  );
  const now = Date.now();

  return (
    <form onSubmit={action} className="grid" style={{ gap: 10 }}>
      {state?.error ? <div className="alert err">{state.error}</div> : null}
      {state?.ok ? <div className="alert ok">{state.message}</div> : null}
      {sel.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
      <div className="bulk">
        <b>{sel.length} selected</b>
        {trashView ? (
          <>
            <button className="btn sm green" name="op" value="restore" disabled={!sel.length || pending}>Restore</button>
            {canDelete ? <button className="btn sm red" name="op" value="delete" disabled={!sel.length || pending} onClick={(e) => { if (!confirm("Permanently delete the selected articles? This cannot be undone.")) e.preventDefault(); }}>Delete permanently</button> : null}
          </>
        ) : (
          <>
            {bulkOps.publish ? <button className="btn sm green" name="op" value="publish" disabled={!sel.length || pending}>Publish</button> : null}
            {bulkOps.approve ? <button className="btn sm" name="op" value="approve" disabled={!sel.length || pending}>Approve</button> : null}
            {bulkOps.submit ? <button className="btn sm ghost" name="op" value="submit" disabled={!sel.length || pending}>Submit for approval</button> : null}
            {bulkOps.unpublish ? <button className="btn sm ghost" name="op" value="unpublish" disabled={!sel.length || pending}>Unpublish</button> : null}
            {bulkOps.archive ? <button className="btn sm ghost" name="op" value="archive" disabled={!sel.length || pending}>Archive</button> : null}
            <button className="btn sm red" name="op" value="trash" disabled={!sel.length || pending} onClick={(e) => { if (!confirm("Move the selected articles to Trash?")) e.preventDefault(); }}>Move to Trash</button>
          </>
        )}
        <span className="hint">Each article is checked against your permissions.</span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? [] : rows.map((r) => r.id))} /></th>
              <th className="hide-m"></th>
              <th><S k="title">Headline</S></th>
              <th>Status</th>
              <th className="hide-m">Category / State</th>
              <th className="hide-m">Author</th>
              <th><S k="published">Published</S></th>
              <th className="hide-m"><S k="updated">Updated</S></th>
              <th className="hide-m"><S k="views">Views</S></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const eff = r.status === "scheduled" && r.publishedAt && r.publishedAt <= now ? "published" : r.status;
              return (
                <tr key={r.id}>
                  <td><input type="checkbox" aria-label={`Select ${r.title}`} checked={sel.includes(r.id)} onChange={() => setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} /></td>
                  <td className="hide-m">{r.thumb ? <img className="thumb" src={`/media/${r.thumb}`} alt="" loading="lazy" /> : <span className="thumb" />}</td>
                  <td>
                    <Link className="t" href={`/admin/news/${r.id}`}>{r.isBreaking ? <span className="flag">BREAKING</span> : null}{r.isFeatured ? <span className="flag" style={{ background: "var(--blue)" }}>LEAD</span> : null}{r.title}</Link>
                    <div className="acts">
                      <span className="sub">#{r.id} · {r.type}</span>
                      <Link href={`/admin/news/${r.id}`}>Edit</Link>
                      {eff === "published" ? <a href={`/${r.categorySlug ?? "news"}/${r.slug}`} target="_blank" rel="noopener">View ↗</a> : <a href={`/${r.categorySlug ?? "news"}/${r.slug}?preview=1`} target="_blank" rel="noopener">Preview ↗</a>}
                    </div>
                  </td>
                  <td><span className={`badge b-${r.deletedAt ? "trash" : eff}`}>{r.deletedAt ? "Trash" : LABEL[eff] ?? eff}</span></td>
                  <td className="hide-m">{r.categoryName ?? "—"}<div className="sub">{r.stateName ?? ""}</div></td>
                  <td className="hide-m">{r.byline || r.authorName || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmt(r.publishedAt)}</td>
                  <td className="hide-m" style={{ whiteSpace: "nowrap" }}>{fmt(r.updatedAt)}</td>
                  <td className="hide-m" style={{ textAlign: "right" }}>{r.viewCount.toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
            {!rows.length ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>No articles match these filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </form>
  );
}
