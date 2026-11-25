import type { Metadata } from "next";
import Link from "next/link";
import { statesWithNews } from "@/lib/news";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "राज्यों की खबरें", description: "हर राज्य, ज़िले और शहर की ताज़ा खबरें।", alternates: { canonical: "/state" } };

export default async function States() {
  const list = await statesWithNews();
  return (
    <>
      <section className="ph">
        <div className="crumbs"><Link href="/">होम</Link>›<span>राज्य</span></div>
        <div className="sec-h" style={{ marginBottom: 0 }}><h1>राज्यों की खबरें</h1></div>
        <p>अपना राज्य चुनें और वहां के ज़िलों और शहरों की खबरें पढ़ें।</p>
      </section>
      <div className="state-grid">
        {list.map((s) => <Link key={s.id} href={`/state/${s.slug}`}>{s.name}<small>{s.n}</small></Link>)}
      </div>
    </>
  );
}
