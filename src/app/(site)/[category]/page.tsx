import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingBody } from "@/components/site/cards";
import JsonLd from "@/components/site/JsonLd";
import { countArticles, getCategoryBySlug, listArticles, mediaUrl } from "@/lib/news";
import { siteUrl } from "@/lib/db";
import { pageNum } from "@/lib/page";

export const dynamic = "force-dynamic";
const PER = 21;

type P = { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const c = await getCategoryBySlug(decodeURIComponent((await params).category));
  if (!c) return {};
  const page = pageNum((await searchParams).page);
  const title = c.seoTitle || `${c.name} समाचार`;
  const path = `/${c.slug}${page > 1 ? `?page=${page}` : ""}`;
  return {
    title: page > 1 ? `${title} – पेज ${page}` : title,
    description: c.seoDescription || c.description || `${c.name} की ताज़ा खबरें`,
    alternates: { canonical: path },
    openGraph: { title, url: path, images: c.imageKey ? [mediaUrl(c.imageKey)!] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: P) {
  const c = await getCategoryBySlug(decodeURIComponent((await params).category));
  if (!c) notFound();
  const page = pageNum((await searchParams).page);
  const filter = { categoryId: c.id };
  const [cards, total] = await Promise.all([listArticles(filter, PER, (page - 1) * PER), countArticles(filter)]);
  if (page > 1 && !cards.length) notFound();
  const url = siteUrl();

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "होम", item: url },
          ...(c.parent ? [{ "@type": "ListItem", position: 2, name: c.parent.name, item: `${url}/${c.parent.slug}` }] : []),
          { "@type": "ListItem", position: c.parent ? 3 : 2, name: c.name, item: `${url}/${c.slug}` },
        ],
      }} />
      <section className="ph">
        <div className="crumbs"><Link href="/">होम</Link>›{c.parent ? <><Link href={`/${c.parent.slug}`}>{c.parent.name}</Link>›</> : null}<span>{c.name}</span></div>
        <div className="sec-h" style={{ marginBottom: 0 }}><h1>{c.name}</h1></div>
        {c.description ? <p>{c.description}</p> : null}
        {c.children.length ? (
          <div className="chips">{c.children.map((s) => <Link key={s.id} href={`/${c.slug}/${s.slug}`}>{s.name}</Link>)}</div>
        ) : null}
      </section>
      <ListingBody cards={cards} page={page} total={total} perPage={PER} base={`/${c.slug}`} />
    </>
  );
}
