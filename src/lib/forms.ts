export type FormState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** One-time value (e.g. a generated password) shown to the admin once and never stored in plain text. */
  secret?: string;
  id?: number;
  /** New updatedAt after a save, for edit-conflict detection. */
  version?: number;
} | null;

export const fstr = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const fbool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1" || fd.get(k) === "true";
export const fints = (fd: FormData, k: string) =>
  fd.getAll(k).map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);

export function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
  const msg = e instanceof Error ? e.message : String(e);
  if (/UNIQUE constraint failed: (\w+)\.(\w+)/.test(msg)) {
    const field = msg.match(/UNIQUE constraint failed: \w+\.(\w+)/)?.[1];
    return `That ${field?.replace(/_/g, " ") ?? "value"} is already in use.`;
  }
  if (/FOREIGN KEY/.test(msg)) return "This item is still in use and cannot be removed.";
  if (e instanceof Error && (e.name === "ForbiddenError" || e.name === "ValidationError")) return msg;
  console.error(e);
  return "Something went wrong. Please try again.";
}

export class ValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ValidationError";
  }
}
