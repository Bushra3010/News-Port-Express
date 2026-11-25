export type MediaItem = {
  id: number; storageKey: string; kind: "image" | "video"; filename: string; mime: string; size: number;
  width: number | null; height: number | null; alt: string | null; title: string | null; description: string | null;
  url: string; uploader?: string | null; uploadedBy?: number | null; createdAt: number;
};

const MAX_EDGE = 1920;

/** Downscales large photos in the browser (max 1920px, WebP) before upload, so pages load fast. */
async function prepareImage(file: File): Promise<{ blob: Blob; name: string; width: number; height: number }> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return { blob: file, name: file.name, width: 0, height: 0 };
  const { width, height } = bmp;
  const skip = file.type === "image/gif" || (width <= MAX_EDGE && height <= MAX_EDGE && file.size < 600_000);
  if (skip) {
    bmp.close();
    return { blob: file, name: file.name, width, height };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
  if (!blob || blob.size >= file.size) return { blob: file, name: file.name, width, height };
  return { blob, name: file.name.replace(/\.\w+$/, "") + ".webp", width: w, height: h };
}

export function uploadFile(file: File, meta: { alt?: string; title?: string } = {}, onProgress?: (pct: number) => void): Promise<MediaItem> {
  return (async () => {
    const isImage = file.type.startsWith("image/");
    const prepared = isImage ? await prepareImage(file) : { blob: file, name: file.name, width: 0, height: 0 };
    const fd = new FormData();
    fd.append("file", new File([prepared.blob], prepared.name, { type: prepared.blob.type || file.type }));
    fd.append("filename", file.name);
    if (prepared.width) fd.append("width", String(prepared.width));
    if (prepared.height) fd.append("height", String(prepared.height));
    if (meta.alt) fd.append("alt", meta.alt);
    if (meta.title) fd.append("title", meta.title);
    return new Promise<MediaItem>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/admin/api/media");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let body: { item?: MediaItem; error?: string } = {};
        try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
        if (xhr.status >= 200 && xhr.status < 300 && body.item) resolve(body.item);
        else reject(new Error(body.error || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Network error during upload."));
      xhr.send(fd);
    });
  })();
}
