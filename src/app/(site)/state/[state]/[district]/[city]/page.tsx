import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Listing from "@/components/site/Listing";
import { getCity, getDistrict, getStateBySlug } from "@/lib/news";
import { pageNum } from "@/lib/page";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ state: string; district: string; city: string }>; searchParams: Promise<{ page?: string }> };

async function load(params: P["params"]) {
  const { state, district, city } = await params;
  const s = await getStateBySlug(state);
  const d = s ? await getDistrict(s.id, district) : undefined;
  const c = d ? await getCity(d.id, city) : undefined;
  return s && d && c ? { s, d, c } : null;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const r = await load(params);
  return r ? { title: `${r.c.name} समाचार – ${r.c.nameEn ?? ""} News`, description: `${r.c.name}, ${r.s.name} की ताज़ा खबरें।`, alternates: { canonical: `/state/${r.s.slug}/${r.d.slug}/${r.c.slug}` } } : {};
}

export default async function CityPage({ params, searchParams }: P) {
  const r = await load(params);
  if (!r) notFound();
  const { s, d, c } = r;
  return (
    <Listing
      title={`${c.name} की खबरें`}
      crumbs={[{ name: "राज्य", href: "/state" }, { name: s.name, href: `/state/${s.slug}` }, ...(d.name !== c.name ? [{ name: d.name, href: `/state/${s.slug}/${d.slug}` }] : [])]}
      filter={{ cityId: c.id }} page={pageNum((await searchParams).page)} base={`/state/${s.slug}/${d.slug}/${c.slug}`}
    />
  );
}
