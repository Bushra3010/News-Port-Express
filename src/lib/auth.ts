import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb, siteUrl } from "./db";
import { loginAttempts, rolePermissions, roles, sessions, userCategories, users, userStates } from "./schema";
import { randomToken, sha256, verifyPassword } from "./password";
import type { Permission } from "./permissions";

const SESSION_DAYS = 7;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  roleId: number;
  roleKey: string;
  roleName: string;
  roleRank: number;
  canPublish: boolean;
  mustChangePassword: boolean;
  perms: Set<string>;
  /** null = all categories / states */
  categoryScope: number[] | null;
  stateScope: number[] | null;
};

function cookieName() {
  return siteUrl().startsWith("https://") ? "__Host-np_session" : "np_session";
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

/** Loads the signed-in user once per request. Every permission check runs on the server from this. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const db = getDb();
  const id = await sha256(token);
  const row = await db
    .select({
      id: users.id, name: users.name, email: users.email, username: users.username, isActive: users.isActive,
      canPublish: users.canPublish, mustChangePassword: users.mustChangePassword,
      roleId: roles.id, roleKey: roles.key, roleName: roles.name, roleRank: roles.rank,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, Date.now())))
    .get();
  if (!row || !row.isActive) return null;

  const [perms, cats, sts] = await Promise.all([
    db.select({ k: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleId, row.roleId)).all(),
    db.select({ id: userCategories.categoryId }).from(userCategories).where(eq(userCategories.userId, row.id)).all(),
    db.select({ id: userStates.stateId }).from(userStates).where(eq(userStates.userId, row.id)).all(),
  ]);
  const set = new Set(perms.map((p) => p.k));
  // Editors (or anyone) flagged "can publish" get publishing rights on top of their role.
  if (row.canPublish) {
    set.add("articles.publish");
    set.add("articles.unpublish");
  }
  const isSuper = row.roleKey === "super_admin";
  return {
    id: row.id, name: row.name, email: row.email, username: row.username,
    roleId: row.roleId, roleKey: row.roleKey, roleName: row.roleName, roleRank: row.roleRank,
    canPublish: row.canPublish || isSuper, mustChangePassword: row.mustChangePassword,
    perms: set,
    categoryScope: isSuper || cats.length === 0 ? null : cats.map((c) => c.id),
    stateScope: isSuper || sts.length === 0 ? null : sts.map((s) => s.id),
  };
});

export function can(user: AuthUser | null, perm: Permission): boolean {
  if (!user) return false;
  return user.roleKey === "super_admin" || user.perms.has(perm);
}

/** For pages and server actions: redirects to login if signed out, throws if a permission is missing. */
export async function requireUser(perm?: Permission, opts: { allowPasswordChange?: boolean } = {}): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  // Accounts with a temporary password can do nothing else until they set their own.
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/admin/profile?first=1");
  if (perm && !can(user, perm)) throw new ForbiddenError(perm);
  return user;
}

/** For pages: like requireUser, but a missing permission renders the 403 "Access denied" page. */
export async function requirePage(perm?: Permission, opts: { any?: Permission[] } = {}): Promise<AuthUser> {
  const user = await requireUser();
  if (perm && !can(user, perm)) forbidden();
  if (opts.any && !opts.any.some((p) => can(user, p))) forbidden();
  return user;
}

export class ForbiddenError extends Error {
  constructor(perm: string) {
    super(`You do not have permission for this action (${perm}).`);
    this.name = "ForbiddenError";
  }
}

async function isLockedOut(identifier: string, ip: string | null) {
  const db = getDb();
  const since = Date.now() - LOCK_MINUTES * 60_000;
  const r = await db
    .select({ n: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.identifier, identifier), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)))
    .get();
  if ((r?.n ?? 0) >= MAX_FAILS) return true;
  if (ip) {
    const r2 = await db
      .select({ n: sql<number>`count(*)` })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)))
      .get();
    if ((r2?.n ?? 0) >= MAX_FAILS * 4) return true;
  }
  return false;
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(identifierRaw: string, password: string): Promise<LoginResult> {
  const identifier = identifierRaw.trim().toLowerCase();
  const ip = await clientIp();
  if (!identifier || !password) return { ok: false, error: "Enter your login ID and password." };
  if (await isLockedOut(identifier, ip)) {
    return { ok: false, error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` };
  }
  const db = getDb();
  const user = await db
    .select()
    .from(users)
    .where(sql`${users.email} = ${identifier} OR ${users.username} = ${identifier}`)
    .get();
  const ok = !!user && (await verifyPassword(password, user.passwordHash));
  await db.insert(loginAttempts).values({ identifier, ip, success: ok && !!user?.isActive });
  if (!ok || !user) return { ok: false, error: "Login ID or password is incorrect." };
  if (!user.isActive) return { ok: false, error: "This account is deactivated. Contact your administrator." };

  await startSession(user.id);
  await db.update(users).set({ lastLoginAt: Date.now() }).where(eq(users.id, user.id));
  // Housekeeping: drop expired sessions and old login attempts.
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, Date.now() - 30 * 86_400_000));
  return { ok: true };
}

export async function startSession(userId: number) {
  const token = randomToken();
  const expiresAt = Date.now() + SESSION_DAYS * 86_400_000;
  const h = await headers();
  await getDb().insert(sessions).values({
    id: await sha256(token), userId, expiresAt,
    ip: await clientIp(), userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  (await cookies()).set(cookieName(), token, {
    httpOnly: true, sameSite: "lax", path: "/",
    secure: siteUrl().startsWith("https://"),
    expires: new Date(expiresAt),
  });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, await sha256(token)));
  jar.delete(cookieName());
}

/** Signs a user out everywhere (used after password reset, deactivation or deletion). */
export async function revokeSessions(userId: number) {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}
