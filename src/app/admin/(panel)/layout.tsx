import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import { can, getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles } from "@/lib/schema";
import { logoutAction } from "../login/actions";
import SideNav, { type NavItem } from "@/components/admin/SideNav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    const path = (await headers()).get("x-invoke-path") || "";
    redirect(`/admin/login${path.startsWith("/admin") ? `?next=${encodeURIComponent(path)}` : ""}`);
  }

  let pending = 0;
  if (can(user, "articles.approve")) {
    const r = await getDb().select({ n: sql<number>`count(*)` }).from(articles).where(and(eq(articles.status, "pending"), isNull(articles.deletedAt))).get();
    pending = r?.n ?? 0;
  }

  const items: NavItem[] = [
    { group: "Overview" },
    { href: "/admin", label: "Dashboard", icon: "▦" },
    { group: "Newsroom" },
    { href: "/admin/news", label: "All News", icon: "☰" },
    ...(can(user, "articles.create") ? [{ href: "/admin/news/new", label: "Add News", icon: "＋" }] : []),
    ...(can(user, "articles.approve") ? [{ href: "/admin/news?status=pending", label: "Approvals", icon: "✓", badge: pending }] : []),
    ...(can(user, "media.upload") ? [{ href: "/admin/media", label: "Media Library", icon: "▣" }] : []),
    ...(can(user, "categories.manage") || can(user, "locations.manage") || can(user, "pages.manage") ? [{ group: "Structure" }] : []),
    ...(can(user, "categories.manage") ? [{ href: "/admin/categories", label: "Categories", icon: "◧" }] : []),
    ...(can(user, "locations.manage") ? [{ href: "/admin/locations", label: "States & Cities", icon: "⌖" }] : []),
    ...(can(user, "pages.manage") ? [{ href: "/admin/pages", label: "Pages", icon: "▤" }] : []),
    ...(can(user, "users.manage") || can(user, "users.manage_all") || can(user, "settings.manage") || can(user, "audit.view") ? [{ group: "Administration" }] : []),
    ...(can(user, "users.manage") || can(user, "users.manage_all") ? [{ href: "/admin/users", label: "Users", icon: "☺" }] : []),
    ...(can(user, "users.manage_all") ? [{ href: "/admin/roles", label: "Roles & Permissions", icon: "⚿" }] : []),
    ...(can(user, "settings.manage") ? [{ href: "/admin/settings", label: "Website Settings", icon: "⚙" }] : []),
    ...(can(user, "audit.view") ? [{ href: "/admin/audit", label: "Audit Log", icon: "⌚" }] : []),
    { group: "Account" },
    { href: "/admin/profile", label: "My Profile", icon: "◉" },
    { href: "/", label: "View Website ↗", icon: "↗", external: true },
  ];

  return (
    <SideNav items={items} user={{ name: user.name, role: user.roleName }} logout={logoutAction} mustChangePassword={user.mustChangePassword}>
      {children}
    </SideNav>
  );
}
