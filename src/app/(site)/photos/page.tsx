import type { Metadata } from "next";
import Listing from "@/components/site/Listing";
import { pageNum } from "@/lib/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "फोटो गैलरी", description: "तस्वीरों में देखें दिन की बड़ी खबरें।", alternates: { canonical: "/photos" } };

export default async function Photos({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  return <Listing title="फोटो गैलरी" filter={{ type: "gallery" }} page={pageNum((await searchParams).page)} base="/photos" emptyText="अभी कोई फोटो गैलरी प्रकाशित नहीं हुई है।" />;
}
