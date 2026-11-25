"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { useState } from "react";
import { deleteCategory, saveCategory } from "@/app/admin/(panel)/categories/actions";
import { MediaPicker } from "./MediaLibrary";
import type { FormState } from "@/lib/forms";

type Cat = {
  id: number; parentId: number | null; name: string; nameEn: string | null; slug: string; description: string | null; seoTitle: string | null;
  seoDescription: string | null; imageMediaId: number | null; imageUrl: string | null; sortOrder: number; showInNav: boolean; isActive: boolean; articleCount: number;
};

function CatForm({ c, parents, onDone }: { c?: Cat; parents: Cat[]; onDone?: () => void }) {
  const [state, action, pending] = useFormAction(async (p, fd) => {
    const r = await saveCategory(p, fd);
    if (r?.ok) onDone?.();
    return r;
  }, null);
  const [img, setImg] = useState<{ id: number; url: string } | null>(c?.imageMediaId && c.imageUrl ? { id: c.imageMediaId, url: c.imageUrl } : null);
  const [pick, setPick] = useState(false);
  return (
    <form onSubmit={action} className="form">
      {state?.error ? <div className="alert err">{state.error}</div> : null}
      {state?.ok ? <div className="alert ok">{state.message}</div> : null}
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <div className="grid g3">
        <label>Name (Hindi)<input type="text" name="name" defaultValue={c?.name} required maxLength={80} /></label>
        <label>Name (English)<input type="text" name="nameEn" defaultValue={c?.nameEn ?? ""} maxLength={80} /></label>
        <label>Slug <small>URL: /slug</small><input type="text" name="slug" defaultValue={c?.slug} maxLength={60} placeholder="auto from English name" /></label>
      </div>
      <div className="grid g3">
        <label>Parent<select name="parentId" defaultValue={c?.parentId ?? ""}><option value="">— Main category —</option>{parents.filter((p) => p.id !== c?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Order<input type="number" name="sortOrder" defaultValue={c?.sortOrder ?? 0} /></label>
        <div className="grid" style={{ gap: 6, alignContent: "end" }}>
          <label className="check"><input type="checkbox" name="showInNav" defaultChecked={c?.showInNav ?? true} />Show in menu</label>
          <label className="check"><input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} />Active</label>
        </div>
      </div>
      <label>Description<textarea name="description" defaultValue={c?.description ?? ""} rows={2} maxLength={500} /></label>
      <div className="grid g2">
        <label>SEO title<input type="text" name="seoTitle" defaultValue={c?.seoTitle ?? ""} maxLength={120} /></label>
        <label>SEO description<input type="text" name="seoDescription" defaultValue={c?.seoDescription ?? ""} maxLength={300} /></label>
      </div>
      <div className="row">
        {img ? <img src={img.url} alt="" style={{ height: 60, borderRadius: 6 }} /> : null}
        <button type="button" className="btn ghost sm" onClick={() => setPick(true)}>{img ? "Change image" : "Add category image"}</button>
        {img ? <button type="button" className="link-btn danger" onClick={() => setImg(null)}>Remove</button> : null}
        <input type="hidden" name="imageMediaId" value={img?.id ?? ""} />
        <span style={{ flex: 1 }} />
        <button className="btn" disabled={pending}>{c ? "Save category" : "Add category"}</button>
      </div>
      <MediaPicker open={pick} onClose={() => setPick(false)} onPick={(m) => m[0] && setImg({ id: m[0].id, url: m[0].url })} title="Category image" />
    </form>
  );
}

function DeleteForm({ c, all }: { c: Cat; all: Cat[] }) {
  const [state, action, pending] = useFormAction(deleteCategory);
  return (
    <form className="inline-form" onSubmit={(e) => { if (!confirm(`Delete “${c.name}”?`)) { e.preventDefault(); return; } action(e); }}>
      <input type="hidden" name="id" value={c.id} />
      {c.articleCount ? (
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 400 }}>Move its {c.articleCount} article(s) to
          <select name="moveTo" required defaultValue=""><option value="" disabled>choose…</option>{all.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.parentId ? "— " : ""}{x.name}</option>)}</select>
        </label>
      ) : null}
      <button className="btn red sm" disabled={pending}>Delete</button>
      {state?.error ? <span style={{ color: "var(--bad)", fontWeight: 600 }}>{state.error}</span> : null}
    </form>
  );
}

export default function CategoryManager({ list }: { list: Cat[] }) {
  const [adding, setAdding] = useState(false);
  const parents = list.filter((c) => !c.parentId);
  return (
    <>
      <div className="card">
        {adding ? <><h2>New category</h2><CatForm parents={parents} onDone={() => setAdding(false)} /></> : <button className="btn" onClick={() => setAdding(true)}>＋ Add category or subcategory</button>}
      </div>
      <div className="tree">
        {parents.map((p) => (
          <details key={p.id}>
            <summary>
              {p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 36, height: 24, objectFit: "cover", borderRadius: 3 }} /> : null}
              {p.name} <span className="hint">/{p.slug} · {p.articleCount} articles</span>
              {!p.isActive ? <span className="badge b-off">Inactive</span> : null}
              {!p.showInNav ? <span className="badge">Hidden from menu</span> : null}
              <span style={{ marginLeft: "auto" }} className="hint">{list.filter((c) => c.parentId === p.id).length} subcategories</span>
            </summary>
            <div className="inner">
              <CatForm c={p} parents={parents} />
              <DeleteForm c={p} all={list} />
              {list.filter((c) => c.parentId === p.id).map((s) => (
                <details key={s.id}>
                  <summary>↳ {s.name} <span className="hint">/{p.slug}/{s.slug} · {s.articleCount} articles</span></summary>
                  <div className="inner"><CatForm c={s} parents={parents} /><DeleteForm c={s} all={list} /></div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
