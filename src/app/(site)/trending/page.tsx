import type { Metadata } from "next";
import Link from "next/link";
import { Grid } from "@/components/site/cards";
import { trending } from "@/lib/news";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ट्रेंडिंग खबरें", description: "सबसे ज़्यादा पढ़ी जा रही खबरें।", alternates: { canonical: "/trending" } };

export default async function Trending() {
  const cards = await trending(24);
  return (
    <>
      <section className="ph">
        <div className="crumbs"><Link href="/">होम</Link>›<span>ट्रेंडिंग</span></div>
        <div className="sec-h" style={{ marginBottom: 0 }}><h1>ट्रेंडिंग खबरें</h1></div>
        <p>पिछले 48 घंटों में सबसे ज़्यादा पढ़ी गई खबरें।</p>
      </section>
      {cards.length ? <Grid cards={cards} /> : <p className="empty">अभी कोई ट्रेंडिंग खबर नहीं है।</p>}
    </>
  );
}
