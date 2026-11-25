import Link from "next/link";
import type { ReactNode } from "react";
import { ListingBody } from "./cards";
import { countArticles, listArticles, type ListFilter } from "@/lib/news";

export const PER_PAGE = 21;

/** Shared page shell for every news listing (latest, videos, tags, states, cities …). */
export default async function Listing({
  title, crumbs = [], description, filter, page, base, extra, showCity = false, emptyText,
}: {
  title: string; crumbs?: { name: string; href: string }[]; description?: string | null; filter: ListFilter;
  page: number; base: string; extra?: ReactNode; showCity?: boolean; emptyText?: string;
}) {
  const [cards, total] = await Promise.all([listArticles(filter, PER_PAGE, (page - 1) * PER_PAGE), countArticles(filter)]);
  return (
    <>
      <section className="ph">
        <div className="crumbs">
          <Link href="/">होम</Link>
          {crumbs.map((c) => <span key={c.href} style={{ display: "contents" }}>›<Link href={c.href}>{c.name}</Link></span>)}
          ›<span>{title}</span>
        </div>
        <div className="sec-h" style={{ marginBottom: 0 }}><h1>{title}</h1></div>
        {description ? <p>{description}</p> : null}
        {extra}
      </section>
      {cards.length ? (
        <ListingBody cards={cards} page={page} total={total} perPage={PER_PAGE} base={base} showCity={showCity} />
      ) : (
        <p className="empty">{emptyText ?? "यहां अभी कोई खबर नहीं है।"}</p>
      )}
    </>
  );
}
