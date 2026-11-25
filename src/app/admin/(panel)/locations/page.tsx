import { asc, sql } from "drizzle-orm";
import { requirePage } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles, cities, districts, states } from "@/lib/schema";
import { deleteLocation, saveLocation } from "./actions";
import { toInt } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata = { title: "States & Cities" };

type Kind = "state" | "district" | "city";

function Row({ kind, item, parentId, openState, extra }: { kind: Kind; item?: { id: number; name: string; nameEn: string | null; slug: string; sortOrder: number }; parentId?: number; openState?: number; extra?: React.ReactNode }) {
  return (
    <div className="inline-form" style={{ alignItems: "center" }}>
      <form action={saveLocation} className="inline-form" style={{ flex: 1 }}>
        <input type="hidden" name="kind" value={kind} />
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
        {openState ? <input type="hidden" name="openState" value={openState} /> : null}
        <input type="text" name="name" defaultValue={item?.name} placeholder={`${kind} name (Hindi)`} required aria-label="Name" />
        <input type="text" name="nameEn" defaultValue={item?.nameEn ?? ""} placeholder="English name" aria-label="English name" />
        <input type="text" name="slug" defaultValue={item?.slug} placeholder="slug (auto)" aria-label="Slug" style={{ maxWidth: 150 }} />
        <input type="number" name="sortOrder" defaultValue={item?.sortOrder ?? 0} aria-label="Order" style={{ maxWidth: 70 }} />
        {extra}
        <button className={`btn sm${item ? " ghost" : ""}`}>{item ? "Save" : `＋ Add ${kind}`}</button>
      </form>
      {item ? (
        <form action={deleteLocation}>
          <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={item.id} />
          {openState ? <input type="hidden" name="openState" value={openState} /> : null}
          <button className="link-btn danger">Delete</button>
        </form>
      ) : null}
    </div>
  );
}

export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string; open?: string }> }) {
  await requirePage("locations.manage");
  const sp = await searchParams;
  const open = toInt(sp.open);
  const db = getDb();
  const [st, ds, cs, counts] = await Promise.all([
    db.select().from(states).orderBy(asc(states.sortOrder), asc(states.name)).all(),
    db.select().from(districts).orderBy(asc(districts.sortOrder), asc(districts.name)).all(),
    db.select().from(cities).orderBy(asc(cities.sortOrder), asc(cities.name)).all(),
    db.select({ stateId: articles.stateId, n: sql<number>`count(*)` }).from(articles).groupBy(articles.stateId).all(),
  ]);
  return (
    <>
      <div className="head"><div><h1>States, Districts &amp; Cities</h1><p>Each state, district and city gets its own news page automatically (/state/…). Tick “Featured” on a city to show it in the “मेरा शहर” tabs.</p></div></div>
      {sp.msg ? <div className="alert ok">{sp.msg.slice(0, 200)}</div> : null}
      {sp.err ? <div className="alert err">{sp.err.slice(0, 300)}</div> : null}
      <div className="card"><h2>Add a state or union territory</h2>
        <Row kind="state" extra={<label className="check"><input type="checkbox" name="isActive" defaultChecked />Active</label>} />
      </div>
      <div className="tree">
        {st.map((s) => {
          const sd = ds.filter((d) => d.stateId === s.id);
          return (
            <details key={s.id} open={open === s.id}>
              <summary>{s.name} <span className="hint">{s.nameEn} · /state/{s.slug} · {sd.length} districts · {counts.find((c) => c.stateId === s.id)?.n ?? 0} articles</span>{!s.isActive ? <span className="badge b-off">Inactive</span> : null}</summary>
              <div className="inner">
                <Row kind="state" item={s} openState={s.id} extra={<label className="check"><input type="checkbox" name="isActive" defaultChecked={s.isActive} />Active</label>} />
                <b style={{ marginTop: 8 }}>Districts</b>
                {sd.map((d) => (
                  <details key={d.id}>
                    <summary>{d.name} <span className="hint">{cs.filter((c) => c.districtId === d.id).length} cities</span></summary>
                    <div className="inner">
                      <Row kind="district" item={d} parentId={s.id} openState={s.id} />
                      <b>Cities</b>
                      {cs.filter((c) => c.districtId === d.id).map((c) => (
                        <Row key={c.id} kind="city" item={c} parentId={d.id} openState={s.id} extra={<label className="check"><input type="checkbox" name="isFeatured" defaultChecked={c.isFeatured} />Featured</label>} />
                      ))}
                      <Row kind="city" parentId={d.id} openState={s.id} extra={<label className="check"><input type="checkbox" name="isFeatured" />Featured</label>} />
                    </div>
                  </details>
                ))}
                <Row kind="district" parentId={s.id} openState={s.id} />
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
