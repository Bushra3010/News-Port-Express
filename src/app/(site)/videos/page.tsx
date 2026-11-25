import type { Metadata } from "next";
import Listing from "@/components/site/Listing";
import { pageNum } from "@/lib/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "वीडियो न्यूज़", description: "ताज़ा खबरों के वीडियो, ग्राउंड रिपोर्ट और इंटरव्यू।", alternates: { canonical: "/videos" } };

export default async function Videos({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  return <Listing title="वीडियो" filter={{ type: "video" }} page={pageNum((await searchParams).page)} base="/videos" emptyText="अभी कोई वीडियो प्रकाशित नहीं हुआ है।" />;
}
