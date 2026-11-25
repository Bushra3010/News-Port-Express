import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Listing from "@/components/site/Listing";
import { getAuthor } from "@/lib/news";
import { pageNum } from "@/lib/page";
import { toInt } from "@/lib/util";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const id = toInt((await params).id);
  const a = id ? await getAuthor(id) : null;
  return a ? { title: `${a.name} की खबरें`, description: a.bio || `${a.name} द्वारा लिखी गई सभी खबरें।`, alternates: { canonical: `/author/${a.id}` } } : {};
}

export default async function AuthorPage({ params, searchParams }: P) {
  const id = toInt((await params).id);
  const a = id ? await getAuthor(id) : null;
  if (!a) notFound();
  return <Listing title={a.name} description={a.bio} filter={{ authorId: a.id }} page={pageNum((await searchParams).page)} base={`/author/${a.id}`} />;
}
