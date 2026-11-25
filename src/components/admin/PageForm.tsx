"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import RichText from "./RichText";
import { savePage } from "@/app/admin/(panel)/pages/actions";

type P = { id: number; title: string; slug: string; content: string; metaDescription: string; isPublished: boolean; showInFooter: boolean; sortOrder: number };

export default function PageForm({ p }: { p: P | null }) {
  const [state, action, pending] = useFormAction(savePage);
  return (
    <form onSubmit={action} className="card form">
      {state?.error ? <div className="alert err">{state.error}</div> : null}
      {state?.ok ? <div className="alert ok">{state.message}</div> : null}
      <input type="hidden" name="id" value={p?.id ?? ""} />
      <div className="grid g2">
        <label>Title<input type="text" name="title" defaultValue={p?.title} required maxLength={120} /></label>
        <label>Slug <small>/page/slug</small><input type="text" name="slug" defaultValue={p?.slug} maxLength={60} /></label>
      </div>
      <label>Meta description<input type="text" name="metaDescription" defaultValue={p?.metaDescription} maxLength={300} /></label>
      <div><b style={{ fontSize: 14 }}>Content</b><RichText name="content" initial={p?.content ?? ""} /></div>
      <div className="row">
        <label className="check"><input type="checkbox" name="isPublished" defaultChecked={p?.isPublished ?? true} />Published</label>
        <label className="check"><input type="checkbox" name="showInFooter" defaultChecked={p?.showInFooter ?? true} />Show in footer</label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>Order<input type="number" name="sortOrder" defaultValue={p?.sortOrder ?? 0} style={{ width: 80 }} /></label>
        <span style={{ flex: 1 }} />
        <button className="btn" disabled={pending}>Save page</button>
      </div>
    </form>
  );
}
