import "server-only";
import { getDb } from "./db";
import { auditLogs } from "./schema";
import { clientIp, type AuthUser } from "./auth";

export async function audit(user: Pick<AuthUser, "id" | "name"> | null, action: string, entity: string, entityId?: string | number | null, details?: unknown) {
  try {
    await getDb().insert(auditLogs).values({
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      details: details == null ? null : JSON.stringify(details).slice(0, 4000),
      ip: await clientIp(),
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
