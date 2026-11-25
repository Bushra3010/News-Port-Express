import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// All timestamps are Unix epoch milliseconds (UTC).
const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;
const createdAt = () => integer("created_at").notNull().default(now);
const updatedAt = () => integer("updated_at").notNull().default(now);

/* ───────────── Access control ───────────── */

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(), // super_admin | admin | editor | reporter
  name: text("name").notNull(),
  description: text("description"),
  rank: integer("rank").notNull(), // higher = more privileged
  createdAt: createdAt(),
});

export const permissions = sqliteTable("permissions", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  groupName: text("group_name").notNull(),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key").notNull().references(() => permissions.key, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionKey] })],
);

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    roleId: integer("role_id").notNull().references(() => roles.id),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    canPublish: integer("can_publish", { mode: "boolean" }).notNull().default(false),
    mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
    phone: text("phone"),
    bio: text("bio"),
    createdBy: integer("created_by"),
    lastLoginAt: integer("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), uniqueIndex("users_username_uq").on(t.username), index("users_role_idx").on(t.roleId)],
);

// Admin/editor scope: when a user has rows here they only work on those categories / states.
export const userCategories = sqliteTable(
  "user_categories",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.categoryId] })],
);

export const userStates = sqliteTable(
  "user_states",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stateId: integer("state_id").notNull().references(() => states.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.stateId] })],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // SHA-256 of the cookie token; the raw token is never stored
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    identifier: text("identifier").notNull(),
    ip: text("ip"),
    success: integer("success", { mode: "boolean" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_lookup_idx").on(t.identifier, t.createdAt), index("login_attempts_ip_idx").on(t.ip, t.createdAt)],
);

/* ───────────── Taxonomy ───────────── */

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    parentId: integer("parent_id"),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    slug: text("slug").notNull(),
    description: text("description"),
    imageMediaId: integer("image_media_id"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    sortOrder: integer("sort_order").notNull().default(0),
    showInNav: integer("show_in_nav", { mode: "boolean" }).notNull().default(true),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug), index("categories_parent_idx").on(t.parentId)],
);

export const states = sqliteTable(
  "states",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("states_slug_uq").on(t.slug)],
);

export const districts = sqliteTable(
  "districts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    stateId: integer("state_id").notNull().references(() => states.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("districts_state_slug_uq").on(t.stateId, t.slug)],
);

export const cities = sqliteTable(
  "cities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    districtId: integer("district_id").notNull().references(() => districts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameEn: text("name_en"),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("cities_district_slug_uq").on(t.districtId, t.slug)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tags_slug_uq").on(t.slug)],
);

/* ───────────── Media ───────────── */

export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storageKey: text("storage_key").notNull(),
    kind: text("kind").notNull(), // image | video
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt"),
    title: text("title"),
    description: text("description"),
    uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("media_key_uq").on(t.storageKey), index("media_created_idx").on(t.createdAt), index("media_kind_idx").on(t.kind)],
);

/* ───────────── Articles ───────────── */

export const ARTICLE_STATUSES = ["draft", "pending", "approved", "published", "scheduled", "rejected", "archived"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
export const ARTICLE_TYPES = ["news", "video", "gallery"] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const articles = sqliteTable(
  "articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    type: text("type").$type<ArticleType>().notNull().default("news"),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    summary: text("summary"),
    content: text("content").notNull().default(""),
    featuredMediaId: integer("featured_media_id").references(() => media.id, { onDelete: "set null" }),
    videoUrl: text("video_url"),
    videoMediaId: integer("video_media_id").references(() => media.id, { onDelete: "set null" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    subcategoryId: integer("subcategory_id").references(() => categories.id, { onDelete: "set null" }),
    stateId: integer("state_id").references(() => states.id, { onDelete: "set null" }),
    districtId: integer("district_id").references(() => districts.id, { onDelete: "set null" }),
    cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    byline: text("byline"),
    status: text("status").$type<ArticleStatus>().notNull().default("draft"),
    isBreaking: integer("is_breaking", { mode: "boolean" }).notNull().default(false),
    isTrending: integer("is_trending", { mode: "boolean" }).notNull().default(false),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    isSpecial: integer("is_special", { mode: "boolean" }).notNull().default(false),
    seoTitle: text("seo_title"),
    metaDescription: text("meta_description"),
    focusKeyword: text("focus_keyword"),
    keywords: text("keywords"),
    canonicalUrl: text("canonical_url"),
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogMediaId: integer("og_media_id").references(() => media.id, { onDelete: "set null" }),
    publishedAt: integer("published_at"), // also the scheduled time when status = scheduled
    submittedAt: integer("submitted_at"),
    reviewedBy: integer("reviewed_by"),
    reviewNote: text("review_note"),
    viewCount: integer("view_count").notNull().default(0),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by"),
    deletedAt: integer("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("articles_slug_uq").on(t.slug),
    index("articles_public_idx").on(t.deletedAt, t.status, t.publishedAt),
    index("articles_category_idx").on(t.categoryId, t.publishedAt),
    index("articles_subcategory_idx").on(t.subcategoryId, t.publishedAt),
    index("articles_state_idx").on(t.stateId, t.publishedAt),
    index("articles_district_idx").on(t.districtId, t.publishedAt),
    index("articles_city_idx").on(t.cityId, t.publishedAt),
    index("articles_author_idx").on(t.authorId),
    index("articles_created_by_idx").on(t.createdBy),
    index("articles_type_idx").on(t.type, t.publishedAt),
    index("articles_updated_idx").on(t.updatedAt),
  ],
);

export const articleTags = sqliteTable(
  "article_tags",
  {
    articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
    tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.tagId] }), index("article_tags_tag_idx").on(t.tagId)],
);

export const articleMedia = sqliteTable(
  "article_media",
  {
    articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
    mediaId: integer("media_id").notNull().references(() => media.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    caption: text("caption"),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.mediaId] })],
);

export const articleViews = sqliteTable(
  "article_views",
  {
    articleId: integer("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD (IST)
    views: integer("views").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.day] }), index("article_views_day_idx").on(t.day)],
);

/* ───────────── Site ───────────── */

export const pages = sqliteTable(
  "pages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    metaDescription: text("meta_description"),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
    showInFooter: integer("show_in_footer", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedBy: integer("updated_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("pages_slug_uq").on(t.slug)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updatedBy: integer("updated_by"),
  updatedAt: updatedAt(),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"),
    userName: text("user_name"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: text("details"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_entity_idx").on(t.entity, t.entityId), index("audit_user_idx").on(t.userId)],
);

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    pollId: text("poll_id").notNull(),
    optionIndex: integer("option_index").notNull(),
    votes: integer("votes").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.optionIndex] })],
);
