import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Listing from "@/components/site/Listing";
import { districtsOf, getStateBySlug } from "@/lib/news";
import { pageNum } from "@/lib/page";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ state: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const s = await getStateBySlug((await params).state);
  return s ? { title: `${s.name} समाचार – ${s.nameEn ?? ""} News in Hindi`, description: `${s.name} की ताज़ा खबरें, ज़िलेवार और शहरवार।`, alternates: { canonical: `/state/${s.slug}` } } : {};
}

export default async function StatePage({ params, searchParams }: P) {
  const s = await getStateBySlug((await params).state);
  if (!s) notFound();
  const ds = await districtsOf(s.id);
  return (
    <Listing
      title={`${s.name} की खबरें`} crumbs={[{ name: "राज्य", href: "/state" }]} filter={{ stateId: s.id }}
      page={pageNum((await searchParams).page)} base={`/state/${s.slug}`} showCity
      extra={ds.length ? <div className="chips">{ds.map((d) => <Link key={d.id} href={`/state/${s.slug}/${d.slug}`}>{d.name}</Link>)}</div> : null}
    />
  );
}
