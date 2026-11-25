import Link from "next/link";
import { asc } from "drizzle-orm";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { pages } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pages" };

export default async function PagesList() {
  await requirePage("pages.manage");
  const rows = await getDb().select().from(pages).orderBy(asc(pages.sortOrder)).all();
  return (
    <>
      <div className="head">
        <div><h1>Pages</h1><p>About, contact, editorial policy and other fixed pages. Google News expects clear About, Contact and editorial-policy pages.</p></div>
        <Link className="btn" href="/admin/pages/new">＋ Add page</Link>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Title</th><th>URL</th><th>Status</th><th>Footer</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}>
              <td><Link className="t" href={`/admin/pages/${p.id}`}>{p.title}</Link></td>
              <td><a href={`/page/${p.slug}`} target="_blank" rel="noopener">/page/{p.slug} ↗</a></td>
              <td><span className={`badge ${p.isPublished ? "b-on" : "b-off"}`}>{p.isPublished ? "Published" : "Hidden"}</span></td>
              <td>{p.showInFooter ? "Yes" : "No"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
