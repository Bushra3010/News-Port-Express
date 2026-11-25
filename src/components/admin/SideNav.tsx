"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type NavItem = { group: string } | { href: string; label: string; icon: string; badge?: number; external?: boolean };

export default function SideNav({
  items, user, logout, children, mustChangePassword,
}: { items: NavItem[]; user: { name: string; role: string }; logout: () => Promise<void>; children: React.ReactNode; mustChangePassword: boolean }) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path, sp]);
  useEffect(() => {
    if (mustChangePassword && path !== "/admin/profile") router.replace("/admin/profile?first=1");
  }, [mustChangePassword, path, router]);

  const isOn = (href: string) => {
    const [p, q] = href.split("?");
    if (q) return path === p && sp.toString() === q;
    if (p === "/admin") return path === "/admin";
    if (p === "/admin/news") return (path === "/admin/news" && !sp.get("status")) || /^\/admin\/news\/\d+/.test(path);
    return path === p || path.startsWith(p + "/");
  };
  const current = items.find((i): i is Extract<NavItem, { href: string }> => "href" in i && isOn(i.href));

  return (
    <div className="shell">
      <aside className={`side${open ? " open" : ""}`}>
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-np.jpg" alt="NewsPort Express" width={640} height={296} />
          <small>Admin Panel</small>
        </div>
        <nav aria-label="Admin">
          {items.map((it, i) =>
            "group" in it ? (
              <div key={i} className="grp">{it.group}</div>
            ) : it.external ? (
              <a key={it.href} href={it.href} target="_blank" rel="noopener"><span aria-hidden="true">{it.icon}</span>{it.label}</a>
            ) : (
              <Link key={it.href} href={it.href} className={isOn(it.href) ? "on" : ""} aria-current={isOn(it.href) ? "page" : undefined}>
                <span aria-hidden="true">{it.icon}</span>{it.label}{it.badge ? <span className="n">{it.badge}</span> : null}
              </Link>
            ),
          )}
        </nav>
        <div className="me">
          <b>{user.name}</b>{user.role} · <form action={logout}><button>Sign out</button></form>
        </div>
      </aside>
      <div>
        <div className="top">
          <button className="menu" onClick={() => setOpen((o) => !o)} aria-label="Open menu">☰</button>
          <span className="crumb">{current?.label ?? "Admin"}</span>
          <span className="sp" />
          <a className="btn ghost sm" href="/" target="_blank" rel="noopener">View site ↗</a>
        </div>
        <main className="content">{children}</main>
      </div>
      {open ? <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 50 }} /> : null}
    </div>
  );
}
