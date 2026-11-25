import Link from "next/link";
import { requirePage } from "@/lib/auth";
import UserForm from "@/components/admin/UserForm";
import { userFormOptions } from "../options";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add user" };

export default async function NewUser() {
  const me = await requirePage(undefined, { any: ["users.manage", "users.manage_all"] });
  const o = await userFormOptions(me);
  return (
    <>
      <div className="head"><div><h1>Add user</h1><p><Link href="/admin/users">‹ All users</Link></p></div></div>
      <UserForm isSelf={false} roles={o.roles} categories={o.categories} states={o.states}
        data={{ name: "", email: "", username: "", roleId: o.roles[o.roles.length - 1]?.id ?? null, phone: "", bio: "", canPublish: false, isActive: true, scopeCategories: [], scopeStates: [] }} />
    </>
  );
}
