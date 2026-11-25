import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Listing from "@/components/site/Listing";
import { getTagBySlug } from "@/lib/news";
import { pageNum } from "@/lib/page";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ tag: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const t = await getTagBySlug(decodeURIComponent((await params).tag));
  return t ? { title: `${t.name} – ताज़ा खबरें`, description: `${t.name} से जुड़ी सभी खबरें।`, alternates: { canonical: `/tag/${encodeURIComponent(t.slug)}` } } : {};
}

export default async function TagPage({ params, searchParams }: P) {
  const t = await getTagBySlug(decodeURIComponent((await params).tag));
  if (!t) notFound();
  return <Listing title={`#${t.name}`} filter={{ tagId: t.id }} page={pageNum((await searchParams).page)} base={`/tag/${encodeURIComponent(t.slug)}`} />;
}
