import type { Metadata } from "next";
import Listing from "@/components/site/Listing";
import { pageNum } from "@/lib/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ताज़ा खबरें – Latest News in Hindi", description: "देश-दुनिया की सबसे ताज़ा खबरें, सबसे पहले।", alternates: { canonical: "/latest" } };

export default async function Latest({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  return <Listing title="ताज़ा खबरें" filter={{}} page={pageNum((await searchParams).page)} base="/latest" />;
}
