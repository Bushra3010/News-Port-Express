import type { Metadata } from "next";
import Link from "next/link";
import { Grid, SectionHead } from "@/components/site/cards";
import { cityHref, featuredCities, listArticles } from "@/lib/news";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "मेरा शहर – शहरों की खबरें", description: "अपने शहर की ताज़ा खबरें पढ़ें।", alternates: { canonical: "/my-city" } };

export default async function MyCity() {
  const list = await featuredCities();
  const data = await Promise.all(list.map(async (c) => ({ c, items: await listArticles({ cityId: c.id }, 4) })));
  return (
    <>
      <section className="ph">
        <div className="crumbs"><Link href="/">होम</Link>›<span>मेरा शहर</span></div>
        <div className="sec-h" style={{ marginBottom: 0 }}><h1>मेरा शहर</h1></div>
        <div className="chips">{list.map((c) => <Link key={c.id} href={cityHref(c)}>{c.name}</Link>)}<Link href="/state">सभी राज्य ›</Link></div>
      </section>
      {data.filter((x) => x.items.length).map(({ c, items }) => (
        <section key={c.id}><SectionHead title={c.name} href={cityHref(c)} /><Grid cards={items} /></section>
      ))}
      {!data.some((x) => x.items.length) ? <p className="empty">अभी शहरों की कोई खबर प्रकाशित नहीं हुई है।</p> : null}
    </>
  );
}
