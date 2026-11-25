"use client";

import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useState } from "react";
import { MediaPicker } from "./MediaLibrary";

/** Article body editor. The HTML it produces is sanitized again on the server before saving. */
export default function RichText({ name, initial, onChange }: { name: string; initial: string; onChange?: (html: string) => void }) {
  const [html, setHtml] = useState(initial);
  const [picker, setPicker] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } } }),
      Image.configure({ HTMLAttributes: { loading: "lazy" } }),
    ],
    content: initial,
    onUpdate: ({ editor }) => {
      const v = editor.getHTML();
      setHtml(v);
      onChange?.(v);
    },
    editorProps: { attributes: { "aria-label": "News content", lang: "hi" } },
  });

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? {
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }), bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"), quote: e.isActive("blockquote"), link: e.isActive("link"),
    } : null),
  });

  if (!editor) return <div className="rte"><div className="bar" /><div className="ProseMirror" /><input type="hidden" name={name} value={html} /></div>;
  const c = () => editor.chain().focus();
  const B = ({ on, label, title, run }: { on?: boolean; label: string; title: string; run: () => void }) => (
    <button type="button" className={on ? "on" : ""} title={title} aria-label={title} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={run}>{label}</button>
  );
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = prompt("Link URL (leave empty to remove)", prev ?? "https://");
    if (url === null) return;
    if (!url || url === "https://") return c().extendMarkRange("link").unsetLink().run();
    if (!/^(https?:\/\/|\/|mailto:)/i.test(url)) return alert("Links must start with https://, / or mailto:");
    c().extendMarkRange("link").setLink({ href: url, target: /^https?:/i.test(url) ? "_blank" : null }).run();
  };

  return (
    <div className="rte">
      <div className="bar" role="toolbar" aria-label="Formatting">
        <B on={s?.bold} label="B" title="Bold" run={() => c().toggleBold().run()} />
        <B on={s?.italic} label="I" title="Italic" run={() => c().toggleItalic().run()} />
        <B on={s?.underline} label="U" title="Underline" run={() => c().toggleUnderline().run()} />
        <B on={s?.strike} label="S" title="Strikethrough" run={() => c().toggleStrike().run()} />
        <span className="sep" />
        <B on={s?.h2} label="H2" title="Heading" run={() => c().toggleHeading({ level: 2 }).run()} />
        <B on={s?.h3} label="H3" title="Subheading" run={() => c().toggleHeading({ level: 3 }).run()} />
        <B on={s?.bullet} label="• List" title="Bulleted list" run={() => c().toggleBulletList().run()} />
        <B on={s?.ordered} label="1. List" title="Numbered list" run={() => c().toggleOrderedList().run()} />
        <B on={s?.quote} label="❝" title="Quote" run={() => c().toggleBlockquote().run()} />
        <span className="sep" />
        <B on={s?.link} label="🔗" title="Add or remove link" run={setLink} />
        <B label="🖼 Image" title="Insert image from Media Library" run={() => setPicker(true)} />
        <B label="―" title="Divider" run={() => c().setHorizontalRule().run()} />
        <span className="sep" />
        <B label="↶" title="Undo" run={() => c().undo().run()} />
        <B label="↷" title="Redo" run={() => c().redo().run()} />
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
      <MediaPicker open={picker} onClose={() => setPicker(false)} title="Insert image into article"
        onPick={(items) => items.forEach((m) => c().setImage({ src: m.url, alt: m.alt ?? "", title: m.title ?? undefined }).run())} />
    </div>
  );
}
