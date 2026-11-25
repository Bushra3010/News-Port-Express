"use client";

import { useFormAction } from "@/components/admin/useFormAction";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RichText from "./RichText";
import { MediaPicker } from "./MediaLibrary";
import type { MediaItem } from "./upload";
import { articleBulk, saveArticle } from "@/app/admin/(panel)/news/actions";
import type { FormState } from "@/lib/forms";

type Opt = { id: number; name: string };
type Img = { id: number; url: string; caption?: string | null; kind?: string };

export type ArticleFormData = {
  id?: number; type: string; title: string; subtitle: string; summary: string; content: string; slug: string;
  categoryId: number | null; subcategoryId: number | null; stateId: number | null; districtId: number | null; cityId: number | null;
  authorId: number | null; byline: string; tags: string; keywords: string; videoUrl: string;
  featured: Img | null; og: Img | null; video: Img | null; gallery: Img[];
  seoTitle: string; metaDescription: string; focusKeyword: string; canonicalUrl: string; ogTitle: string; ogDescription: string;
  isBreaking: boolean; isTrending: boolean; isFeatured: boolean; isSpecial: boolean;
  status: string; scheduledAt: string; reviewNote: string; updatedAt?: number; deleted: boolean; categorySlug: string | null;
};

export type Caps = {
  edit: boolean; submit: boolean; approve: boolean; reject: boolean; publish: boolean; unpublish: boolean; archive: boolean;
  trash: boolean; restore: boolean; flags: boolean; chooseAuthor: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", pending: "Pending Approval", approved: "Approved", published: "Published", scheduled: "Scheduled", rejected: "Rejected", archived: "Archived",
};

function Counter({ v, max }: { v: string; max: number }) {
  return <div className={`counter${v.length > max ? " over" : ""}`}>{v.length}/{max}</div>;
}

function ImageSlot({ label, value, onChange, kind = "image", hint }: { label: string; value: Img | null; onChange: (v: Img | null) => void; kind?: "image" | "video"; hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="media-pick">
      <b style={{ fontSize: 14 }}>{label}</b>
      <button type="button" className="preview" onClick={() => setOpen(true)} style={{ cursor: "pointer" }}>
        {value ? (kind === "image" ? <img src={value.url} alt="" /> : <video src={value.url} muted style={{ width: "100%", height: "100%" }} />) : <span>+ Choose {kind}</span>}
      </button>
      {hint ? <span className="hint">{hint}</span> : null}
      {value ? <button type="button" className="link-btn danger" onClick={() => onChange(null)}>Remove</button> : null}
      <MediaPicker open={open} kind={kind} onClose={() => setOpen(false)} title={label} onPick={(items: MediaItem[]) => items[0] && onChange({ id: items[0].id, url: items[0].url })} />
    </div>
  );
}

export default function ArticleForm({
  data, caps, categories, states, initialDistricts, initialCities, authors, siteUrl, flash,
}: {
  data: ArticleFormData; caps: Caps; categories: (Opt & { parentId: number | null })[]; states: Opt[];
  initialDistricts: Opt[]; initialCities: Opt[]; authors: Opt[]; siteUrl: string; flash?: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useFormAction(saveArticle, flash ? { ok: true, message: flash } : null);
  const [bulkState, bulkAction, bulkPending] = useFormAction(articleBulk);
  const [version, setVersion] = useState(data.updatedAt);
  const [dirty, setDirty] = useState(false);

  const [type, setType] = useState(data.type);
  const [title, setTitle] = useState(data.title);
  const [summary, setSummary] = useState(data.summary);
  const [content, setContent] = useState(data.content);
  const [slug, setSlug] = useState(data.slug);
  const [categoryId, setCategoryId] = useState(data.categoryId);
  const [stateId, setStateId] = useState(data.stateId);
  const [districtId, setDistrictId] = useState(data.districtId);
  const [districts, setDistricts] = useState(initialDistricts);
  const [cities, setCities] = useState(initialCities);
  const [featured, setFeatured] = useState(data.featured);
  const [og, setOg] = useState(data.og);
  const [video, setVideo] = useState(data.video);
  const [gallery, setGallery] = useState<Img[]>(data.gallery);
  const [galPick, setGalPick] = useState(false);
  const [seoTitle, setSeoTitle] = useState(data.seoTitle);
  const [metaDescription, setMetaDescription] = useState(data.metaDescription);
  const [focus, setFocus] = useState(data.focusKeyword);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.version) { setVersion(state.version); setDirty(false); router.refresh(); }
  }, [state, router]);
  useEffect(() => { if (bulkState?.ok) router.refresh(); }, [bulkState, router]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const loadDistricts = async (sid: number | null) => {
    setStateId(sid); setDistrictId(null); setCities([]);
    setDistricts(sid ? ((await fetch(`/admin/api/locations?state=${sid}`).then((r) => r.json())) as { items: Opt[] }).items : []);
  };
  const loadCities = async (did: number | null) => {
    setDistrictId(did);
    setCities(did ? ((await fetch(`/admin/api/locations?district=${did}`).then((r) => r.json())) as { items: Opt[] }).items : []);
  };

  const mains = categories.filter((c) => !c.parentId);
  const subs = categories.filter((c) => c.parentId && c.parentId === categoryId);
  const cat = categories.find((c) => c.id === categoryId);
  const ro = !caps.edit;
  const st = data.status;
  const live = st === "published" || st === "scheduled";

  const plain = useMemo(() => content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), [content]);
  const words = plain ? plain.split(" ").length : 0;
  const fk = focus.trim().toLowerCase();
  const effTitle = seoTitle || title;
  const effDesc = metaDescription || summary || plain.slice(0, 160);
  const checks: [boolean, string][] = [
    [effTitle.length >= 20 && effTitle.length <= 65, `SEO title length ${effTitle.length} (aim 20–65)`],
    [effDesc.length >= 70 && effDesc.length <= 160, `Meta description length ${effDesc.length} (aim 70–160)`],
    [!!featured, "Featured image added (Google News prefers 1200px+ wide)"],
    [words >= 150 || type !== "news", `Article length ${words} words (aim 150+)`],
    [!!categoryId, "Category chosen"],
    ...(fk
      ? ([
          [effTitle.toLowerCase().includes(fk), "Focus keyword in SEO title"],
          [effDesc.toLowerCase().includes(fk), "Focus keyword in meta description"],
          [plain.slice(0, 400).toLowerCase().includes(fk), "Focus keyword in the opening paragraph"],
        ] as [boolean, string][])
      : ([[false, "Set a focus keyword"]] as [boolean, string][])),
  ];

  const previewHref = data.id ? `/${data.categorySlug ?? "news"}/${data.slug}?preview=1` : null;

  return (
    <>
      <div className="head">
        <div>
          <h1>{data.id ? "Edit News" : "Add News"}</h1>
          <p>
            {data.id ? <>Status: <span className={`badge b-${data.deleted ? "trash" : st}`}>{data.deleted ? "In Trash" : STATUS_LABEL[st] ?? st}</span></> : "Fill in the details, then save as draft, submit for approval or publish."}
            {dirty ? <span className="hint"> · Unsaved changes</span> : null}
          </p>
        </div>
        <div className="row">
          {previewHref && !data.deleted ? <a className="btn ghost" href={previewHref} target="_blank" rel="noopener">Preview ↗</a> : null}
          {data.id && live && data.categorySlug ? <a className="btn ghost" href={`/${data.categorySlug}/${data.slug}`} target="_blank" rel="noopener">View live ↗</a> : null}
        </div>
      </div>

      {state?.error ? <div className="alert err" role="alert">{state.error}</div> : null}
      {state?.ok && state.message ? <div className="alert ok" role="status">{state.message}</div> : null}
      {bulkState?.error ? <div className="alert err">{bulkState.error}</div> : null}
      {bulkState?.ok ? <div className="alert ok">{bulkState.message}</div> : null}
      {data.reviewNote && (st === "rejected" || st === "approved") ? <div className={`alert ${st === "rejected" ? "warn" : "info"}`}><b>Reviewer note:</b> {data.reviewNote}</div> : null}
      {ro && !data.deleted ? <div className="alert info">You can view this article but not edit it in its current status.</div> : null}
      {data.deleted ? <div className="alert warn">This article is in the Trash. Restore it to edit or publish.</div> : null}

      <form ref={formRef} onSubmit={action} className="editor-grid" onChange={() => setDirty(true)}>
        <input type="hidden" name="id" value={data.id ?? ""} />
        <input type="hidden" name="updatedAt" value={version ?? ""} />
        <fieldset disabled={ro || pending} style={{ border: 0, padding: 0, display: "grid", gap: 14, minWidth: 0 }}>
          <div className="card form">
            <div className="row">
              {(["news", "video", "gallery"] as const).map((t) => (
                <label key={t} className="check"><input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} />{t === "news" ? "News article" : t === "video" ? "Video news" : "Photo gallery"}</label>
              ))}
            </div>
            <label>News Title / Headline<input className="title-input" type="text" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={220} lang="hi" /></label>
            <label>Subtitle <small>Optional deck line shown under the headline</small><input type="text" name="subtitle" defaultValue={data.subtitle} maxLength={300} lang="hi" /></label>
            <label>Short Description <small>Shown on cards and as the article intro</small><textarea name="summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={600} rows={3} lang="hi" /></label>
            <Counter v={summary} max={300} />
            <div><b style={{ fontSize: 14 }}>Full News Content</b><RichText name="content" initial={data.content} onChange={(v) => { setContent(v); setDirty(true); }} /></div>
            <div className="hint">{words} words · about {Math.max(1, Math.round(words / 200))} min read</div>
          </div>

          {type !== "news" || data.videoUrl || video ? (
            <div className="card form">
              <h2>Video</h2>
              <label>Video URL <small>YouTube or Vimeo link</small><input type="url" name="videoUrl" defaultValue={data.videoUrl} placeholder="https://www.youtube.com/watch?v=…" /></label>
              <ImageSlot label="…or upload a video file" kind="video" value={video} onChange={(v) => { setVideo(v); setDirty(true); }} hint="MP4/WebM up to 95 MB" />
              <input type="hidden" name="videoMediaId" value={video?.id ?? ""} />
            </div>
          ) : <input type="hidden" name="videoUrl" value="" />}

          <div className="card form">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Additional Images {type === "gallery" ? "(gallery)" : ""}</h2>
              <button type="button" className="btn ghost sm" onClick={() => setGalPick(true)}>+ Add images</button>
            </div>
            {gallery.length ? (
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
                {gallery.map((g, i) => (
                  <div key={g.id} className="grid" style={{ gap: 4 }}>
                    <div className="gal-list" style={{ gridTemplateColumns: "1fr" }}><div>
                      <img src={g.url} alt="" />
                      <button type="button" aria-label="Remove image" onClick={() => { setGallery((x) => x.filter((y) => y.id !== g.id)); setDirty(true); }}>×</button>
                    </div></div>
                    <input type="hidden" name="galleryIds" value={g.id} />
                    <input type="text" name="galleryCaptions" placeholder="Caption" defaultValue={g.caption ?? ""} maxLength={200} />
                    <div className="row" style={{ gap: 4 }}>
                      <button type="button" className="btn ghost sm" disabled={i === 0} onClick={() => setGallery((x) => { const c = [...x]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })}>←</button>
                      <button type="button" className="btn ghost sm" disabled={i === gallery.length - 1} onClick={() => setGallery((x) => { const c = [...x]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c; })}>→</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="hint" style={{ margin: 0 }}>No additional images.{type === "gallery" ? " A gallery needs at least 2." : ""}</p>}
            <MediaPicker open={galPick} multiple onClose={() => setGalPick(false)} title="Add images"
              onPick={(items) => { setGallery((g) => [...g, ...items.filter((m) => !g.some((x) => x.id === m.id)).map((m) => ({ id: m.id, url: m.url, caption: m.title }))]); setDirty(true); }} />
          </div>

          <div className="card form">
            <h2>SEO</h2>
            <div className="serp" aria-label="Google preview">
              <div className="u">{siteUrl}/{cat && !cat.parentId ? (data.categorySlug ?? "…") : "…"}/{slug || "…"}</div>
              <div className="tt">{effTitle || "Headline"}</div>
              <div className="d">{effDesc.slice(0, 160) || "Meta description…"}</div>
            </div>
            <div className="grid g2">
              <div><label>SEO Title<input type="text" name="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={120} placeholder={title} /></label><Counter v={effTitle} max={65} /></div>
              <label>Focus Keyword<input type="text" name="focusKeyword" value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={80} /></label>
            </div>
            <div><label>Meta Description<textarea name="metaDescription" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} maxLength={300} placeholder={summary} /></label><Counter v={effDesc} max={160} /></div>
            <div className="grid g2">
              <label>URL Slug <small>Leave blank to create from the headline</small><input type="text" name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={120} /></label>
              <label>Canonical URL <small>Only if this story first appeared elsewhere</small><input type="url" name="canonicalUrl" defaultValue={data.canonicalUrl} /></label>
            </div>
            <div className="grid g2">
              <label>Open Graph Title<input type="text" name="ogTitle" defaultValue={data.ogTitle} maxLength={150} placeholder="Defaults to SEO title" /></label>
              <label>Open Graph Description<input type="text" name="ogDescription" defaultValue={data.ogDescription} maxLength={300} placeholder="Defaults to meta description" /></label>
            </div>
            <label>Keywords <small>Comma-separated</small><input type="text" name="keywords" defaultValue={data.keywords} maxLength={400} /></label>
            <ul className="checks">{checks.map(([ok, t]) => <li key={t} className={ok ? "ok" : ""}>{t}</li>)}</ul>
          </div>
        </fieldset>

        <div className="editor-side">
          <div className="card form">
            <h2>Publish</h2>
            {caps.publish || st === "scheduled" ? (
              <label>Schedule for (IST)<input type="datetime-local" name="scheduledAt" defaultValue={data.scheduledAt} /></label>
            ) : null}
            {caps.approve || caps.reject ? (
              <label>Review note <small>Required when rejecting; shown to the author</small><textarea name="reviewNote" rows={2} maxLength={1000} /></label>
            ) : null}
            <div className="grid" style={{ gap: 8 }}>
              {caps.edit && !live && st !== "archived" && st !== "approved" ? <button className="btn ghost" name="intent" value={st === "pending" ? "save" : "draft"} disabled={pending}>{st === "pending" ? "Save changes" : "Save as Draft"}</button> : null}
              {caps.edit && (live || st === "approved" || st === "archived") ? <button className="btn ghost" name="intent" value="save" disabled={pending}>{st === "published" ? "Update" : "Save changes"}</button> : null}
              {caps.submit ? <button className="btn" name="intent" value="submit" disabled={pending}>Submit for Approval</button> : null}
              {caps.approve ? <button className="btn green" name="intent" value="approve" disabled={pending}>Approve</button> : null}
              {caps.reject ? <button className="btn red" name="intent" value="reject" disabled={pending}>Reject</button> : null}
              {caps.publish && st !== "published" ? <button className="btn green" name="intent" value="publish" disabled={pending}>{st === "archived" ? "Publish again" : "Publish Now"}</button> : null}
              {caps.publish && st !== "published" ? <button className="btn ghost" name="intent" value="schedule" disabled={pending}>{st === "scheduled" ? "Reschedule" : "Schedule"}</button> : null}
              {pending ? <span className="hint">Saving…</span> : null}
            </div>
          </div>

          <fieldset disabled={ro || pending} className="card form" style={{ padding: 18 }}>
            <h2>Category &amp; Location</h2>
            <label>Category<select name="categoryId" value={categoryId ?? ""} onChange={(e) => setCategoryId(Number(e.target.value) || null)}>
              <option value="">— Choose —</option>{mains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
            {subs.length ? (
              <label>Subcategory<select name="subcategoryId" defaultValue={data.subcategoryId ?? ""} key={categoryId}>
                <option value="">— None —</option>{subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            ) : <input type="hidden" name="subcategoryId" value="" />}
            <label>State<select name="stateId" value={stateId ?? ""} onChange={(e) => loadDistricts(Number(e.target.value) || null)}>
              <option value="">— None (national/international) —</option>{states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            {districts.length ? (
              <label>District<select name="districtId" value={districtId ?? ""} onChange={(e) => loadCities(Number(e.target.value) || null)}>
                <option value="">— None —</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></label>
            ) : null}
            {cities.length ? (
              <label>City<select name="cityId" defaultValue={data.cityId ?? ""} key={districtId}>
                <option value="">— None —</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
            ) : null}
          </fieldset>

          <fieldset disabled={ro || pending} className="card form" style={{ padding: 18 }}>
            <h2>Images</h2>
            <ImageSlot label="Featured Image" value={featured} onChange={(v) => { setFeatured(v); setDirty(true); }} hint="Shown on cards and at the top. Use 1200×675 or larger." />
            <input type="hidden" name="featuredMediaId" value={featured?.id ?? ""} />
            <ImageSlot label="Social Sharing Image (optional)" value={og} onChange={(v) => { setOg(v); setDirty(true); }} hint="Defaults to the featured image." />
            <input type="hidden" name="ogMediaId" value={og?.id ?? ""} />
          </fieldset>

          <fieldset disabled={ro || pending} className="card form" style={{ padding: 18 }}>
            <h2>Author &amp; Tags</h2>
            {caps.chooseAuthor ? (
              <label>Reporter / Author<select name="authorId" defaultValue={data.authorId ?? ""}>
                {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></label>
            ) : null}
            <label>Byline override <small>e.g. “NewsPort Express डेस्क” or a guest writer</small><input type="text" name="byline" defaultValue={data.byline} maxLength={120} /></label>
            <label>Tags <small>Comma-separated</small><input type="text" name="tags" defaultValue={data.tags} placeholder="लखनऊ, मेट्रो, यातायात" /></label>
          </fieldset>

          {caps.flags ? (
            <fieldset disabled={ro || pending} className="card form" style={{ padding: 18 }}>
              <h2>Placement</h2>
              <label className="check"><input type="checkbox" name="isBreaking" defaultChecked={data.isBreaking} />Breaking news (ticker)</label>
              <label className="check"><input type="checkbox" name="isFeatured" defaultChecked={data.isFeatured} />Featured (homepage lead)</label>
              <label className="check"><input type="checkbox" name="isTrending" defaultChecked={data.isTrending} />Pin to Trending</label>
              <label className="check"><input type="checkbox" name="isSpecial" defaultChecked={data.isSpecial} />Special report</label>
            </fieldset>
          ) : null}
        </div>
      </form>

      {data.id && (caps.unpublish || caps.archive || caps.trash || caps.restore) ? (
        <form onSubmit={bulkAction} className="card row" style={{ justifyContent: "flex-end" }}>
          <input type="hidden" name="ids" value={data.id} />
          <span className="hint" style={{ marginRight: "auto" }}>More actions</span>
          {caps.unpublish ? <button className="btn ghost" name="op" value="unpublish" disabled={bulkPending}>{st === "scheduled" ? "Cancel schedule" : "Unpublish"}</button> : null}
          {caps.archive ? <button className="btn ghost" name="op" value="archive" disabled={bulkPending}>Archive</button> : null}
          {caps.trash ? <button className="btn red" name="op" value="trash" disabled={bulkPending} onClick={(e) => { if (!confirm("Move this article to Trash?")) e.preventDefault(); }}>Move to Trash</button> : null}
          {caps.restore ? <button className="btn green" name="op" value="restore" disabled={bulkPending}>Restore from Trash</button> : null}
        </form>
      ) : null}
    </>
  );
}
