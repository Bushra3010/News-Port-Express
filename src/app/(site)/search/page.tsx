import type { Metadata } from "next";
import Listing from "@/components/site/Listing";
import { pageNum } from "@/lib/page";
import { cleanText } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "खोज", robots: { index: false, follow: true } };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = cleanText(sp.q, 80);
  if (!q) {
    return (
      <section className="ph">
        <div className="sec-h"><h1>खबरें खोजें</h1></div>
        <form action="/search" className="search" style={{ marginLeft: 0, maxWidth: 520 }}><input name="q" placeholder="जैसे मेट्रो, सेंसेक्स…" aria-label="खोजें" /><button>खोजें</button></form>
      </section>
    );
  }
  return (
    <Listing title={`"${q}" के लिए नतीजे`} filter={{ q }} page={pageNum(sp.page)} base={`/search?q=${encodeURIComponent(q)}`}
      emptyText={`"${q}" से जुड़ी कोई खबर नहीं मिली। कोई और शब्द आज़माएं।`} />
  );
}
