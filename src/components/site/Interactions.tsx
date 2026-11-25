"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Site-wide behaviour from the original page, kept as one delegated click handler:
 * drawer, mobile search, dark/light toggle and toasts. Elements opt in with data-* attributes.
 */
export default function Interactions() {
  const pathname = usePathname();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const drawer = document.getElementById("drawer");
    const bg = document.getElementById("drawerBg");
    const setDrawer = (open: boolean) => {
      if (!drawer || !bg) return;
      drawer.classList.toggle("open", open);
      drawer.inert = !open;
      drawer.setAttribute("aria-hidden", String(!open));
      bg.hidden = !open;
      document.body.style.overflow = open ? "hidden" : "";
      if (open) (drawer.querySelector("[data-close-drawer]") as HTMLElement | null)?.focus();
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target === bg) return setDrawer(false);
      const t = target.closest<HTMLElement>("[data-menu],[data-close-drawer],[data-act],[data-toast],#searchBtn");
      if (!t) return;
      if (t.id === "searchBtn") {
        const f = document.getElementById("msearch") as HTMLFormElement | null;
        if (!f) return;
        f.hidden = !f.hidden;
        t.setAttribute("aria-expanded", String(!f.hidden));
        if (!f.hidden) (f.querySelector("input") as HTMLInputElement | null)?.focus();
        return;
      }
      if (t.dataset.menu !== undefined) return setDrawer(true);
      if (t.dataset.closeDrawer !== undefined) return setDrawer(false);
      if (t.dataset.act === "theme") {
        const r = document.documentElement;
        const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
        r.dataset.theme = dark ? "light" : "dark";
        try { localStorage.setItem("np-theme", r.dataset.theme); } catch { /* storage unavailable */ }
        return;
      }
      if (t.dataset.toast) {
        e.preventDefault();
        setToast(t.dataset.toast);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setToast(null), 2400);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  // Close the drawer and mobile search after navigating.
  useEffect(() => {
    const drawer = document.getElementById("drawer");
    if (drawer?.classList.contains("open")) {
      drawer.classList.remove("open");
      drawer.inert = true;
      drawer.setAttribute("aria-hidden", "true");
      const bg = document.getElementById("drawerBg");
      if (bg) bg.hidden = true;
      document.body.style.overflow = "";
    }
    const f = document.getElementById("msearch") as HTMLFormElement | null;
    if (f) f.hidden = true;
    // Highlight the active nav item.
    document.querySelectorAll<HTMLAnchorElement>("#nav a, .bbar a, #dcats a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const on = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const on = document.querySelector<HTMLElement>("#nav a.on");
    const nav = document.getElementById("nav");
    if (on && nav) nav.scrollTo({ left: on.offsetLeft - nav.clientWidth / 2 + on.clientWidth / 2, behavior: "smooth" });
  }, [pathname]);

  return toast ? <div className="toast" role="status">{toast}</div> : null;
}

export function CitySelect({ cities, current }: { cities: { name: string; href: string }[]; current?: string }) {
  const router = useRouter();
  return (
    <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
      शहर चुनें
      <select defaultValue={current ?? ""} onChange={(e) => e.target.value && router.push(e.target.value)} aria-label="शहर चुनें">
        <option value="">—</option>
        {cities.map((c) => <option key={c.href} value={c.href}>{c.name}</option>)}
      </select>
    </label>
  );
}
