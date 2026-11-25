import "server-only";
import { getCurrentUser, type AuthUser } from "./auth";
import { siteUrl } from "./db";

/** Auth + same-origin guard for admin JSON endpoints (route handlers have no built-in CSRF check). */
export async function apiUser(req: Request, mutating = false): Promise<AuthUser | Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (user.mustChangePassword) return Response.json({ error: "Change your password first" }, { status: 403 });
  if (mutating) {
    const origin = req.headers.get("origin");
    const self = new URL(req.url).origin;
    if (!origin || (origin !== self && origin !== siteUrl())) return Response.json({ error: "Bad origin" }, { status: 403 });
  }
  return user;
}

export const deny = (msg = "You do not have permission for this action.") => Response.json({ error: msg }, { status: 403 });
