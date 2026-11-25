import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Listing from "@/components/site/Listing";
import { citiesOf, getDistrict, getStateBySlug } from "@/lib/news";
import { pageNum } from "@/lib/page";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ state: string; district: string }>; searchParams: Promise<{ page?: string }> };

async function load(params: P["params"]) {
  const { state, district } = await params;
  const s = await getStateBySlug(state);
  const d = s ? await getDistrict(s.id, district) : undefined;
  return s && d ? { s, d } : null;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const r = await load(params);
  return r ? { title: `${r.d.name} समाचार, ${r.s.name}`, description: `${r.d.name} ज़िले (${r.s.name}) की ताज़ा खबरें।`, alternates: { canonical: `/state/${r.s.slug}/${r.d.slug}` } } : {};
}

export default async function DistrictPage({ params, searchParams }: P) {
  const r = await load(params);
  if (!r) notFound();
  const { s, d } = r;
  const cs = await citiesOf(d.id);
  return (
    <Listing
      title={`${d.name} की खबरें`} crumbs={[{ name: "राज्य", href: "/state" }, { name: s.name, href: `/state/${s.slug}` }]}
      filter={{ districtId: d.id }} page={pageNum((await searchParams).page)} base={`/state/${s.slug}/${d.slug}`} showCity
      extra={cs.length > 1 ? <div className="chips">{cs.map((c) => <Link key={c.id} href={`/state/${s.slug}/${d.slug}/${c.slug}`}>{c.name}</Link>)}</div> : null}
    />
  );
}
