"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { can, requireUser, revokeSessions, startSession, type AuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories, roles, states, userCategories, users, userStates } from "@/lib/schema";
import { assignableRoleRank } from "@/lib/permissions";
import { generatePassword, hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { audit } from "@/lib/audit";
import { errMessage, fbool, fints, fstr, ValidationError, type FormState } from "@/lib/forms";
import { cleanText, toInt } from "@/lib/util";

async function manager() {
  const u = await requireUser();
  if (!can(u, "users.manage") && !can(u, "users.manage_all")) throw new ValidationError("You do not have permission to manage users.");
  return u;
}

/** Can `actor` manage `target`? Super admins manage all; admins only lower-ranked users they created. */
async function mayManage(actor: AuthUser, targetId: number) {
  const db = getDb();
  const t = await db.select({ u: users, rank: roles.rank, key: roles.key }).from(users).innerJoin(roles, eq(roles.id, users.roleId)).where(eq(users.id, targetId)).limit(1).then((r) => r[0]);
  if (!t) throw new ValidationError("User not found.");
  if (can(actor, "users.manage_all")) return t;
  if (t.rank >= actor.roleRank || t.u.createdBy !== actor.id) throw new ValidationError("You can only manage editors and reporters you created.");
  return t;
}

async function checkRole(actor: AuthUser, roleId: number | null) {
  if (!roleId) throw new ValidationError("Choose a role.");
  const r = await getDb().select().from(roles).where(eq(roles.id, roleId)).limit(1).then((r) => r[0]);
  if (!r) throw new ValidationError("Choose a valid role.");
  if (r.rank > assignableRoleRank(actor)) throw new ValidationError(`You cannot assign the ${r.name} role.`);
  return r;
}

async function readUser(fd: FormData) {
  const name = cleanText(fd.get("name"), 80);
  const email = fstr(fd, "email").toLowerCase();
  const username = fstr(fd, "username").toLowerCase();
  if (!name) throw new ValidationError("Enter the user's name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) throw new ValidationError("Enter a valid email address.");
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new ValidationError("Login ID (username): 3–32 letters, numbers, dot, dash or underscore.");
  return {
    name, email, username,
    phone: cleanText(fd.get("phone"), 20) || null,
    bio: cleanText(fd.get("bio"), 600) || null,
    canPublish: fbool(fd, "canPublish"),
    isActive: fbool(fd, "isActive"),
  };
}

/** Scope: admins can only hand out categories/states inside their own scope. */
async function saveScope(actor: AuthUser, userId: number, fd: FormData) {
  const db = getDb();
  let cats = fints(fd, "scopeCategories");
  let sts = fints(fd, "scopeStates");
  if (actor.categoryScope) cats = cats.filter((c) => actor.categoryScope!.includes(c));
  if (actor.stateScope) sts = sts.filter((s) => actor.stateScope!.includes(s));
  if (cats.length) cats = (await db.select({ id: categories.id }).from(categories).where(sql`${categories.id} IN (${sql.join(cats.map((c) => sql`${c}`), sql`, `)}) AND ${categories.parentId} IS NULL`)).map((r) => r.id);
  if (sts.length) sts = (await db.select({ id: states.id }).from(states).where(sql`${states.id} IN (${sql.join(sts.map((s) => sql`${s}`), sql`, `)})`)).map((r) => r.id);
  // A scoped admin's new users inherit the admin's scope when none is chosen.
  if (!cats.length && actor.categoryScope) cats = actor.categoryScope;
  if (!sts.length && actor.stateScope) sts = actor.stateScope;
  await db.delete(userCategories).where(eq(userCategories.userId, userId));
  await db.delete(userStates).where(eq(userStates.userId, userId));
  if (cats.length) await db.insert(userCategories).values(cats.map((categoryId) => ({ userId, categoryId })));
  if (sts.length) await db.insert(userStates).values(sts.map((stateId) => ({ userId, stateId })));
}

export async function createUser(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await manager();
    const v = await readUser(fd);
    const role = await checkRole(actor, toInt(fd.get("roleId")));
    const typed = String(fd.get("password") ?? "");
    const password = typed || generatePassword();
    if (typed) { const p = passwordProblem(typed); if (p) return { error: p }; }
    const db = getDb();
    const [u] = await db.insert(users).values({
      ...v, roleId: role.id, passwordHash: await hashPassword(password), mustChangePassword: true, createdBy: actor.id,
      canPublish: role.key === "editor" || role.key === "reporter" ? v.canPublish : false,
    }).returning({ id: users.id });
    await saveScope(actor, u.id, fd);
    await audit(actor, "user.create", "user", u.id, { username: v.username, role: role.key });
    revalidatePath("/admin/users");
    return {
      ok: true, id: u.id,
      message: `Account created. Login ID: ${v.username} (or ${v.email}). Share the temporary password privately — it is shown only once, and they must change it at first sign-in.`,
      secret: password,
    };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

export async function updateUser(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await manager();
    const id = toInt(fd.get("id"));
    if (!id) return { error: "Missing user." };
    const t = await mayManage(actor, id);
    const v = await readUser(fd);
    const role = await checkRole(actor, toInt(fd.get("roleId")));
    const db = getDb();
    if (id === actor.id && (!v.isActive || role.id !== t.u.roleId)) return { error: "You cannot deactivate yourself or change your own role." };
    if (t.key === "super_admin" && (role.key !== "super_admin" || !v.isActive)) {
      const others = await db.select({ n: sql<number>`count(*)::int` }).from(users).innerJoin(roles, eq(roles.id, users.roleId))
        .where(and(eq(roles.key, "super_admin"), eq(users.isActive, true), ne(users.id, id))).limit(1).then((r) => r[0]);
      if (!others?.n) return { error: "This is the only active Super Admin. Make someone else Super Admin first." };
    }
    await db.update(users).set({ ...v, roleId: role.id, canPublish: role.key === "editor" || role.key === "reporter" ? v.canPublish : false, updatedAt: Date.now() }).where(eq(users.id, id));
    await saveScope(actor, id, fd);
    if (!v.isActive) await revokeSessions(id);
    await audit(actor, "user.update", "user", id, { username: v.username, role: role.key, active: v.isActive });
    revalidatePath("/admin/users");
    return { ok: true, message: "User updated." };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await manager();
    const id = toInt(fd.get("id"));
    if (!id) return { error: "Missing user." };
    if (id === actor.id) return { error: "Change your own password from My Profile." };
    const t = await mayManage(actor, id);
    const password = generatePassword();
    await getDb().update(users).set({ passwordHash: await hashPassword(password), mustChangePassword: true, updatedAt: Date.now() }).where(eq(users.id, id));
    await revokeSessions(id);
    await audit(actor, "user.reset_password", "user", id, { username: t.u.username });
    return { ok: true, message: `New temporary password for ${t.u.username}. Share it privately; it is shown only once. They have been signed out everywhere.`, secret: password };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

export async function setActive(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await manager();
    const id = toInt(fd.get("id"));
    const active = fstr(fd, "active") === "1";
    if (!id) return { error: "Missing user." };
    if (id === actor.id) return { error: "You cannot deactivate yourself." };
    const t = await mayManage(actor, id);
    if (!active && t.key === "super_admin") {
      const others = await getDb().select({ n: sql<number>`count(*)::int` }).from(users).innerJoin(roles, eq(roles.id, users.roleId))
        .where(and(eq(roles.key, "super_admin"), eq(users.isActive, true), ne(users.id, id))).limit(1).then((r) => r[0]);
      if (!others?.n) return { error: "This is the only active Super Admin." };
    }
    await getDb().update(users).set({ isActive: active, updatedAt: Date.now() }).where(eq(users.id, id));
    if (!active) await revokeSessions(id);
    await audit(actor, active ? "user.activate" : "user.deactivate", "user", id, { username: t.u.username });
    revalidatePath("/admin/users");
    return { ok: true, message: active ? "Account activated." : "Account deactivated and signed out." };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

export async function deleteUser(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await manager();
    const id = toInt(fd.get("id"));
    if (!id) return { error: "Missing user." };
    if (id === actor.id) return { error: "You cannot delete your own account." };
    const t = await mayManage(actor, id);
    if (t.key === "super_admin") {
      const others = await getDb().select({ n: sql<number>`count(*)::int` }).from(users).innerJoin(roles, eq(roles.id, users.roleId))
        .where(and(eq(roles.key, "super_admin"), ne(users.id, id))).limit(1).then((r) => r[0]);
      if (!others?.n) return { error: "You cannot delete the only Super Admin." };
    }
    // Their articles stay; author is cleared and the byline keeps the name.
    await getDb().execute(sql`UPDATE articles SET byline = coalesce(byline, ${t.u.name}) WHERE author_id = ${id}`);
    await getDb().delete(users).where(eq(users.id, id));
    await audit(actor, "user.delete", "user", id, { username: t.u.username, name: t.u.name });
    revalidatePath("/admin/users");
  } catch (e) {
    return { error: errMessage(e) };
  }
  redirect("/admin/users?msg=User%20deleted.");
}

/* ── Own profile ── */

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await requireUser(undefined, { allowPasswordChange: true });
    const name = cleanText(fd.get("name"), 80);
    if (!name) return { error: "Enter your name." };
    await getDb().update(users).set({ name, phone: cleanText(fd.get("phone"), 20) || null, bio: cleanText(fd.get("bio"), 600) || null, updatedAt: Date.now() }).where(eq(users.id, me.id));
    await audit(me, "profile.update", "user", me.id);
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return { error: errMessage(e) };
  }
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const me = await requireUser(undefined, { allowPasswordChange: true });
    const db = getDb();
    const row = await db.select().from(users).where(eq(users.id, me.id)).limit(1).then((r) => r[0]);
    if (!row || !(await verifyPassword(String(fd.get("current") ?? ""), row.passwordHash))) return { error: "Current password is incorrect." };
    const next = String(fd.get("next") ?? "");
    const p = passwordProblem(next);
    if (p) return { error: p };
    if (next !== String(fd.get("confirm") ?? "")) return { error: "New passwords do not match." };
    if (await verifyPassword(next, row.passwordHash)) return { error: "Choose a password different from the current one." };
    await db.update(users).set({ passwordHash: await hashPassword(next), mustChangePassword: false, updatedAt: Date.now() }).where(eq(users.id, me.id));
    await revokeSessions(me.id);
    await startSession(me.id);
    await audit(me, "profile.change_password", "user", me.id);
  } catch (e) {
    return { error: errMessage(e) };
  }
  redirect("/admin?msg=Password%20changed");
}
