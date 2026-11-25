"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { uploadFile, type MediaItem } from "./upload";

const fmtSize = (n: number) => (n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Browsable, searchable media grid with drag-and-drop upload. Used as a page and inside the picker modal. */
export function MediaBrowser({
  kind, multiple = false, onPick, selectable = false, canManageAll = false, userId,
}: { kind?: "image" | "video"; multiple?: boolean; onPick?: (items: MediaItem[]) => void; selectable?: boolean; canManageAll?: boolean; userId?: number }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<MediaItem[]>([]);
  const [uploads, setUploads] = useState<{ name: string; pct: number; error?: string }[]>([]);
  const [over, setOver] = useState(false);
  const [edit, setEdit] = useState<MediaItem | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (p = 1, query = q) => {
    setLoading(true);
    const u = new URLSearchParams({ page: String(p) });
    if (query) u.set("q", query);
    if (kind) u.set("kind", kind);
    const r = await fetch(`/admin/api/media?${u}`).then((r) => r.json() as Promise<{ items: MediaItem[]; pages: number; total: number }>).catch(() => ({ items: [], pages: 1, total: 0 }));
    setItems(r.items);
    setPages(Math.max(1, r.pages));
    setTotal(r.total);
    setPage(p);
    setLoading(false);
  }, [q, kind]);

  useEffect(() => { load(1, ""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFiles = async (files: FileList | File[]) => {
    const list = [...files];
    for (const f of list) {
      const idx = list.indexOf(f);
      setUploads((u) => [...u, { name: f.name, pct: 0 }]);
      try {
        const item = await uploadFile(f, { alt: f.name.replace(/\.\w+$/, "").replace(/[-_]+/g, " ") }, (pct) =>
          setUploads((u) => u.map((x) => (x.name === f.name ? { ...x, pct } : x))),
        );
        setItems((cur) => [item, ...cur]);
        setTotal((t) => t + 1);
        if (selectable) setSel((s) => (multiple ? [...s, item] : [item]));
        setUploads((u) => u.filter((x) => x.name !== f.name));
      } catch (e) {
        setUploads((u) => u.map((x) => (x.name === f.name ? { ...x, error: (e as Error).message } : x)));
      }
      void idx;
    }
  };

  const toggle = (m: MediaItem) => {
    if (!selectable) return setEdit(m);
    setSel((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : multiple ? [...s, m] : [m]));
  };

  const accept = kind === "video" ? "video/mp4,video/webm" : kind === "image" ? "image/jpeg,image/png,image/webp,image/gif,image/avif" : "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm";

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div
        className={`drop${over ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <b>Drag files here</b> or <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>choose from your computer</button>
        <div className="hint">Images: JPG, PNG, WebP, GIF up to 8 MB (large photos are resized automatically). Videos: MP4/WebM up to 95 MB.</div>
        <input ref={inputRef} type="file" accept={accept} multiple hidden onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>
      {uploads.map((u) => (
        <div key={u.name} className="grid" style={{ gap: 4 }}>
          <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}><span>{u.name}</span><span>{u.error ? <span style={{ color: "var(--bad)" }}>{u.error}</span> : `${u.pct}%`}</span></div>
          {!u.error ? <div className="progress"><i style={{ width: `${u.pct}%` }} /></div> : null}
        </div>
      ))}
      {msg ? <div className="alert info">{msg}</div> : null}
      <div className="row" role="search">
        <input type="search" placeholder="Search by file name, alt text or title…" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); load(1, q); } }} style={{ flex: 1 }} aria-label="Search media" />
        <button type="button" className="btn ghost" onClick={() => load(1, q)}>Search</button>
        <span className="hint">{total} files</span>
      </div>
      {loading ? <p className="hint">Loading…</p> : null}
      <div className="mgrid">
        {items.map((m) => (
          <button type="button" key={m.id} className={`mitem${sel.some((s) => s.id === m.id) ? " sel" : ""}`} onClick={() => toggle(m)} title={m.filename}>
            <span className="im">
              {m.kind === "image" ? <img src={m.url} alt={m.alt ?? ""} loading="lazy" /> : <span>▶ VIDEO</span>}
            </span>
            <span className="cap">{m.title || m.filename}<br /><span className="hint">{fmtSize(m.size)}{m.width ? ` · ${m.width}×${m.height}` : ""}</span></span>
          </button>
        ))}
      </div>
      {!items.length && !loading ? <p className="hint">No files yet.</p> : null}
      {pages > 1 ? (
        <div className="pager">
          <button className="btn ghost sm" disabled={page <= 1} onClick={() => load(page - 1)}>‹ Prev</button>
          <span>Page {page} of {pages}</span>
          <button className="btn ghost sm" disabled={page >= pages} onClick={() => load(page + 1)}>Next ›</button>
        </div>
      ) : null}
      {selectable && onPick ? (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          {sel.length && sel.length === 1 ? <button type="button" className="btn ghost" onClick={() => setEdit(sel[0])}>Edit details</button> : null}
          <button type="button" className="btn" disabled={!sel.length} onClick={() => onPick(sel)}>Use {sel.length > 1 ? `${sel.length} files` : "selected"}</button>
        </div>
      ) : null}
      {edit ? (
        <MediaEdit item={edit} canDelete={canManageAll || edit.uploadedBy === userId} onClose={() => setEdit(null)}
          onSaved={(m) => { setItems((cur) => cur.map((x) => (x.id === m.id ? { ...x, ...m } : x))); setSel((s) => s.map((x) => (x.id === m.id ? { ...x, ...m } : x))); setEdit(null); setMsg("Details saved."); }}
          onDeleted={(id) => { setItems((cur) => cur.filter((x) => x.id !== id)); setSel((s) => s.filter((x) => x.id !== id)); setEdit(null); setMsg("File deleted."); }} />
      ) : null}
    </div>
  );
}

function MediaEdit({ item, onClose, onSaved, onDeleted, canDelete }: { item: MediaItem & { uploadedBy?: number | null }; onClose: () => void; onSaved: (m: MediaItem) => void; onDeleted: (id: number) => void; canDelete: boolean }) {
  const [alt, setAlt] = useState(item.alt ?? "");
  const [title, setTitle] = useState(item.title ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const r = await fetch(`/admin/api/media/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ alt, title, description }) });
    const d = (await r.json()) as { item?: MediaItem; error?: string };
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Could not save.");
    onSaved({ ...item, alt, title, description });
  };
  const del = async (force = false) => {
    if (!force && !confirm("Delete this file permanently? This cannot be undone.")) return;
    setBusy(true);
    const r = await fetch(`/admin/api/media/${item.id}${force ? "?force=1" : ""}`, { method: "DELETE" });
    const d = (await r.json()) as { error?: string; inUse?: number };
    setBusy(false);
    if (r.status === 409 && d.inUse) {
      if (confirm(`${d.error}\nArticles using it will show no image.`)) return del(true);
      return;
    }
    if (!r.ok) return setErr(d.error ?? "Could not delete.");
    onDeleted(item.id);
  };
  return createPortal(
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: "min(760px,100%)" }} role="dialog" aria-label="Media details">
        <header><h2 style={{ flex: 1 }}>Media details</h2><button type="button" className="btn ghost sm" onClick={onClose}>Close</button></header>
        <div className="body grid g2">
          <div>
            {item.kind === "image" ? <img src={item.url} alt={item.alt ?? ""} style={{ width: "100%", borderRadius: 6 }} /> : <video src={item.url} controls style={{ width: "100%" }} />}
            <p className="hint">{item.filename} · {item.mime} · {fmtSize(item.size)}{item.width ? ` · ${item.width}×${item.height}px` : ""}<br />Uploaded by {item.uploader ?? "—"} · {new Date(item.createdAt).toLocaleString("en-IN")}</p>
            <input readOnly value={item.url} onFocus={(e) => e.target.select()} aria-label="File URL" />
          </div>
          <div className="form">
            {err ? <div className="alert err">{err}</div> : null}
            <label>Alt text <small>Describe the image for screen readers and Google Images.</small><input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={250} /></label>
            <label>Title / caption<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></label>
            <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></label>
          </div>
        </div>
        <footer>
          {canDelete ? <button type="button" className="btn red" style={{ marginRight: "auto" }} disabled={busy} onClick={() => del()}>Delete file</button> : null}
          <button type="button" className="btn" disabled={busy} onClick={save}>Save details</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Modal wrapper used by the article editor and category form. */
export function MediaPicker({ open, onClose, onPick, kind = "image", multiple = false, title = "Choose media" }: {
  open: boolean; onClose: () => void; onPick: (items: MediaItem[]) => void; kind?: "image" | "video"; multiple?: boolean; title?: string;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <header><h2 style={{ flex: 1 }}>{title}</h2><button type="button" className="btn ghost sm" onClick={onClose}>Close</button></header>
        <div className="body"><MediaBrowser kind={kind} multiple={multiple} selectable onPick={(items) => { onPick(items); onClose(); }} /></div>
        <footer><span className="hint" style={{ marginRight: "auto" }}>Click to select{multiple ? " (several allowed)" : ""}, then press “Use”.</span></footer>
      </div>
    </div>,
    document.body,
  );
}
