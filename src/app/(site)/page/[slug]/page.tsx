import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/news";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = await getPage((await params).slug);
  return p ? { title: p.title, description: p.metaDescription || undefined, alternates: { canonical: `/page/${p.slug}` } } : {};
}

export default async function StaticPage({ params }: P) {
  const p = await getPage((await params).slug);
  if (!p) notFound();
  return (
    <article className="article static">
      <nav className="crumbs"><Link href="/">होम</Link>›<span>{p.title}</span></nav>
      <h1>{p.title}</h1>
      <div className="body" dangerouslySetInnerHTML={{ __html: p.content }} />
    </article>
  );
}
