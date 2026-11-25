import type { AuthUser } from "./auth";
import type { ArticleStatus } from "./schema";

export type Permission =
  | "dashboard.view" | "analytics.view"
  | "articles.create" | "articles.edit_own" | "articles.edit_any" | "articles.submit" | "articles.approve"
  | "articles.publish" | "articles.unpublish" | "articles.trash" | "articles.delete" | "articles.flags"
  | "media.upload" | "media.manage"
  | "categories.manage" | "locations.manage" | "pages.manage"
  | "users.manage" | "users.manage_all"
  | "settings.manage" | "audit.view";

function has(u: AuthUser, p: Permission) {
  return u.roleKey === "super_admin" || u.perms.has(p);
}

export type ArticleRef = {
  createdBy: number | null;
  authorId: number | null;
  categoryId: number | null;
  stateId: number | null;
  status: ArticleStatus;
  deletedAt: number | null;
};

export const isOwn = (u: AuthUser, a: ArticleRef) => a.createdBy === u.id || a.authorId === u.id;

/** Admins/editors assigned to categories or states only work inside them. */
export function inScope(u: AuthUser, a: Pick<ArticleRef, "categoryId" | "stateId">) {
  if (u.categoryScope && (a.categoryId == null || !u.categoryScope.includes(a.categoryId))) return false;
  if (u.stateScope && (a.stateId == null || !u.stateScope.includes(a.stateId))) return false;
  return true;
}

const LIVE: ArticleStatus[] = ["published", "scheduled"];
const UNPUBLISHED_EDITABLE: ArticleStatus[] = ["draft", "rejected", "pending"];

export function canView(u: AuthUser, a: ArticleRef) {
  if (isOwn(u, a)) return true;
  return (has(u, "articles.edit_any") || has(u, "articles.approve") || has(u, "articles.publish")) && inScope(u, a);
}

export function canEdit(u: AuthUser, a: ArticleRef) {
  if (a.deletedAt) return false;
  if (LIVE.includes(a.status) || a.status === "archived") {
    // Updating live news requires publishing rights.
    return has(u, "articles.publish") && (isOwn(u, a) || inScope(u, a)) && (isOwn(u, a) || has(u, "articles.edit_any") || has(u, "articles.approve"));
  }
  if (a.status === "approved") return (has(u, "articles.approve") || has(u, "articles.publish")) && inScope(u, a);
  if (isOwn(u, a) && has(u, "articles.edit_own") && UNPUBLISHED_EDITABLE.includes(a.status)) return true;
  return has(u, "articles.edit_any") && inScope(u, a);
}

export function canSubmit(u: AuthUser, a: ArticleRef) {
  return !a.deletedAt && has(u, "articles.submit") && ["draft", "rejected"].includes(a.status) && canEdit(u, a);
}

export function canApprove(u: AuthUser, a: ArticleRef) {
  return !a.deletedAt && has(u, "articles.approve") && inScope(u, a) && ["pending"].includes(a.status);
}

export function canReject(u: AuthUser, a: ArticleRef) {
  return !a.deletedAt && has(u, "articles.approve") && inScope(u, a) && ["pending", "approved"].includes(a.status);
}

export function canPublish(u: AuthUser, a: ArticleRef) {
  if (a.deletedAt || !has(u, "articles.publish") || a.status === "published") return false;
  return inScope(u, a) || isOwn(u, a);
}

export function canUnpublish(u: AuthUser, a: ArticleRef) {
  return !a.deletedAt && has(u, "articles.unpublish") && inScope(u, a) && LIVE.includes(a.status);
}

export function canArchive(u: AuthUser, a: ArticleRef) {
  return !a.deletedAt && has(u, "articles.unpublish") && inScope(u, a) && a.status === "published";
}

export function canTrash(u: AuthUser, a: ArticleRef) {
  if (a.deletedAt) return false;
  if (has(u, "articles.trash") && inScope(u, a)) return true;
  // Authors may discard their own drafts.
  return isOwn(u, a) && a.status === "draft";
}

export function canRestore(u: AuthUser, a: ArticleRef) {
  if (!a.deletedAt) return false;
  return (has(u, "articles.trash") && inScope(u, a)) || (isOwn(u, a) && a.status === "draft");
}

export function canDeleteForever(u: AuthUser, a: ArticleRef) {
  return !!a.deletedAt && has(u, "articles.delete");
}

export function canSetFlags(u: AuthUser) {
  return has(u, "articles.flags");
}

/** Which roles a user may assign when creating/editing accounts. */
export function assignableRoleRank(u: AuthUser): number {
  if (has(u, "users.manage_all")) return 100;
  if (has(u, "users.manage")) return 40; // editors and reporters only
  return -1;
}
