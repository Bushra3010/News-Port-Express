import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { pages } from "@/lib/schema";
import { toInt } from "@/lib/util";
import PageForm from "@/components/admin/PageForm";
import { deletePage } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit page" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("pages.manage");
  const raw = (await params).id;
  const isNew = raw === "new";
  const id = toInt(raw);
  const p = id ? await getDb().select().from(pages).where(eq(pages.id, id)).limit(1).then((r) => r[0]) : undefined;
  if (!isNew && !p) notFound();
  return (
    <>
      <div className="head"><div><h1>{p ? p.title : "New page"}</h1><p><Link href="/admin/pages">‹ All pages</Link>{p ? <> · <a href={`/page/${p.slug}`} target="_blank" rel="noopener">View ↗</a></> : null}</p></div></div>
      <PageForm p={p ? { id: p.id, title: p.title, slug: p.slug, content: p.content, metaDescription: p.metaDescription ?? "", isPublished: p.isPublished, showInFooter: p.showInFooter, sortOrder: p.sortOrder } : null} />
      {p ? (
        <form action={deletePage} className="card row" style={{ justifyContent: "flex-end" }}>
          <input type="hidden" name="id" value={p.id} />
          <button className="btn red">Delete page</button>
        </form>
      ) : null}
    </>
  );
}
