"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { setupNeedsToken, setupToken, userCount } from "@/lib/setup";
import { login, logout, startSession } from "@/lib/auth";
import { hashPassword, passwordProblem } from "@/lib/password";
import { roles, users } from "@/lib/schema";
import { audit } from "@/lib/audit";
import { fstr, type FormState } from "@/lib/forms";
import { cleanText } from "@/lib/util";

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const r = await login(fstr(fd, "login"), String(fd.get("password") ?? ""));
  if (!r.ok) return { error: r.error };
  const next = fstr(fd, "next");
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin/login");
}

export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  if ((await userCount()) > 0) return { error: "Setup is already complete. Sign in instead." };
  if (await setupNeedsToken()) {
    const t = setupToken();
    if (!t) return { error: "SETUP_TOKEN secret is not configured on the server." };
    if (fstr(fd, "token") !== t) return { error: "Setup token is incorrect." };
  }
  const name = cleanText(fd.get("name"), 80);
  const email = fstr(fd, "email").toLowerCase();
  const username = fstr(fd, "username").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!name) return { error: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) return { error: "Username: 3–32 characters, letters, numbers, dot, dash or underscore." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "Passwords do not match." };

  const db = getDb();
  const role = await db.select().from(roles).where(eq(roles.key, "super_admin")).limit(1).then((r) => r[0]);
  if (!role) return { error: "Roles are missing. Run the database seed first." };
  const [u] = await db.insert(users).values({ name, email, username, passwordHash: await hashPassword(password), roleId: role.id }).returning({ id: users.id });
  await audit({ id: u.id, name }, "setup", "user", u.id, { role: "super_admin" });
  await startSession(u.id);
  redirect("/admin");
}
