import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/schema";
import ProfileForms from "@/components/admin/ProfileForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Profile" };

export default async function Profile() {
  const me = await requireUser(undefined, { allowPasswordChange: true });
  const u = (await getDb().select().from(users).where(eq(users.id, me.id)).get())!;
  return (
    <>
      <div className="head"><div><h1>My Profile</h1><p>{u.username} · {u.email} · {me.roleName}</p></div></div>
      {me.mustChangePassword ? <div className="alert warn">You are using a temporary password. Choose your own password to continue.</div> : null}
      <ProfileForms name={u.name} phone={u.phone ?? ""} bio={u.bio ?? ""} mustChange={me.mustChangePassword} />
    </>
  );
}
