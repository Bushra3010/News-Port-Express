# NewsPort Express

Hindi news portal with a multi-user admin panel. Built with Next.js 16 (App Router) and deployed to Cloudflare Workers with the OpenNext adapter. Content lives in Supabase Postgres and uploaded media in Supabase Storage.

The original static site is kept in `site/` and in the git tag `static-site-backup`. The earlier Cloudflare D1 implementation is kept in the git tag `d1-cloudflare-version`.

## Stack

| Part | Choice |
| --- | --- |
| Framework | Next.js 16, React 19, TypeScript |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Supabase Postgres, accessed through Drizzle ORM (`src/lib/schema.ts`) |
| Driver | postgres.js, over the Supavisor transaction pooler |
| Media | Supabase Storage (private bucket), served at `/media/...` with year-long caching |
| Auth | Own implementation: PBKDF2-SHA256 password hashes, server-side sessions in Postgres, httpOnly cookie |
| Editor | TipTap; all HTML is sanitized on the server before saving |

Node 22+ is required (Wrangler needs it). On this Mac it is installed at `~/.local/node22`; prefix commands with `PATH=~/.local/node22/bin:$PATH`.

### How the Worker reaches Postgres

Workers cannot open an ordinary Node TCP socket, so three things have to line up:

1. **The transaction pooler.** `DATABASE_URL` must be Supabase's Supavisor
   *transaction* pooler on port **6543**, not the direct database host. Prepared
   statements are therefore disabled (`prepare: false` in `src/lib/db.ts`),
   because transaction pooling can route each statement to a different backend.
2. **The workerd build of postgres.js.** postgres.js ships a separate build that
   dials `cloudflare:sockets`. `next.config.ts` lists `postgres` in
   `serverExternalPackages` so Next does not inline its Node build (which would
   pull in `node:net` / `node:tls`); OpenNext then resolves it with the
   `workerd` condition. If that entry is removed, the Worker builds but cannot
   connect.
3. **`nodejs_compat`.** Kept in `wrangler.jsonc` for the driver's remaining
   Node built-ins.

Migrations are different: they run from your machine, not from the Worker, and
DDL does not belong on a transaction pooler. Set `MIGRATION_DATABASE_URL` to a
*session* connection (port 5432) and the database scripts will prefer it.

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill in the Supabase values
npm run db:setup                 # migrate + RLS + seed
npm run dev
```

Open http://localhost:3000/admin. The first visit shows the one-time setup page where you create the Super Admin account.

Optional sample stories for local testing only (never run against production):

```bash
python3 db/build_demo.py
node --env-file=.dev.vars db/run-sql.mjs db/demo.sql
```

To test the real Worker build on the Cloudflare runtime: `npm run preview`.

### Running against a local Postgres

`npm run db:local` starts a real Postgres on `127.0.0.1:54329`, backed by PGlite
and speaking the wire protocol over TCP, with data in `.local-pg/`. Point
`DATABASE_URL` and `MIGRATION_DATABASE_URL` at it and the whole application runs
against it exactly as it would against Supabase, minus TLS (`src/lib/db.ts`
skips TLS only for loopback addresses).

It drops idle connections readily, which makes it a good stand-in for the
failure below.

### Surviving a dropped connection

A Worker isolate is reused between requests and may be frozen in between, so its
timers never fire and postgres.js cannot notice that the pooler has long since
closed the connection. The next query then fails on a dead socket, and a reader
gets a 500 after any quiet spell — the quieter the site, the likelier it is.

`src/lib/retry.ts` wraps the client so a query whose connection died is retried,
backing off 25ms, 150ms and 500ms. Retrying in the same tick is not enough:
postgres.js has not yet discarded the dead socket, so the second attempt fails
identically. Only connection errors are retried; a syntax error or a unique
violation is a real bug and is raised at once.

`npm run db:verify-retry` measures this against the local server (start it
first). A representative run: 9 of 18 requests failed without the retry, 0 with
it.

### Checking the database layer without a database

`npm run db:verify` runs the real schema, RLS, seed and demo SQL against PGlite
(Postgres compiled to WebAssembly) and then executes the application's query
shapes against it — joins, the IST day bucketing, the view-count upsert inside a
transaction, Hindi `ILIKE` search, sequence recovery and the aggregate casts. It
needs no network and no credentials, so it can run in CI.

## Deploy to Cloudflare

One-time setup:

```bash
npx wrangler login
npx wrangler secret put DATABASE_URL               # Supavisor transaction pooler URI, port 6543
npx wrangler secret put SUPABASE_URL               # https://<project-ref>.supabase.co
npx wrangler secret put SUPABASE_SECRET_KEY        # sb_secret_... ; server-side only
npx wrangler secret put SETUP_TOKEN                # any long random value; needed once at /admin/setup
```

In Supabase, create a **private** Storage bucket named `media` (or set
`SUPABASE_MEDIA_BUCKET` to whatever you called it). It must stay private: every
read goes through the `/media` route, which authenticates with the secret key.

`SUPABASE_SECRET_KEY` is Supabase's current server-side key (`sb_secret_...`).
Projects still on the old scheme can set `SUPABASE_SERVICE_ROLE_KEY` with the
legacy `service_role` JWT instead; the code accepts either.

A single upload is capped at **50 MB** on the Supabase free plan, which is what
`MAX_VIDEO` in `src/app/admin/api/media/route.ts` enforces. Raising the bucket's
file size limit on a paid plan means raising that constant too.

Set `SITE_URL` in `wrangler.jsonc` to the real domain (for example `https://www.example.com`), then:

```bash
npm run deploy
```

Attach the domain under Workers & Pages → newsport-express → Settings → Domains & Routes (the domain's DNS must be on Cloudflare). SSL is issued automatically.

After deploying, open `/admin/setup`, enter the `SETUP_TOKEN` and create the Super Admin. The setup page switches itself off once an account exists.

### Database changes

Edit `src/lib/schema.ts`, then:

```bash
npm run db:generate   # writes a new SQL file in db/migrations
npm run db:migrate    # applies it
npm run db:rls        # re-run so new tables get RLS too
```

`db/rls.sql` is idempotent. It enables row level security on every table and
removes the `anon` / `authenticated` grants, so the project's public API keys can
read nothing even if the auto-generated REST API is switched on. The application
connects as the table owner and is unaffected. Re-run it after adding tables.

### Backups

Supabase takes daily backups on every paid plan (Point-in-Time Recovery is a
paid add-on); on the free plan take your own dumps. For an offsite copy:

```bash
pg_dump "$MIGRATION_DATABASE_URL" --no-owner --no-privileges -f backup.sql
```

Storage objects are never overwritten — every upload gets a new key — so media
only needs a periodic bucket copy.

## Roles

| Role | Can do |
| --- | --- |
| Super Admin | Everything: users, roles and permissions, categories, locations, pages, settings, audit log, all news |
| Admin | Approve/reject, publish, unpublish, trash; edit any news within assigned categories/states; manage editors and reporters they created |
| Editor | Create, edit and review news; submit for approval; publish only if “Allowed to publish” is ticked on their account |
| Reporter | Create news, edit own unpublished news, upload media, submit for approval and track status |

Permissions are stored in Postgres and can be changed per role in Admin → Roles & Permissions. Every check runs on the server (`src/lib/permissions.ts`, `src/lib/auth.ts`); the UI only hides what the server would refuse anyway. Assigning categories or states to an Admin or Editor restricts them to that scope.

News statuses: Draft → Pending Approval → Approved → Published / Scheduled, plus Rejected, Archived and Trash (restorable).

## SEO

- Per-article SEO title, meta description, focus keyword, slug, canonical URL, Open Graph title/description/image
- JSON-LD: NewsArticle (or VideoObject), BreadcrumbList, NewsMediaOrganization, WebSite with search
- `/sitemap.xml` (index), `/sitemaps/*.xml`, `/news-sitemap.xml` (last 48 hours, Google News format), `/feed.xml` (RSS), `/robots.txt`
- Admin pages and previews are `noindex`

Being listed in Google News still requires applying through Google Publisher Center and meeting Google's content policies; nothing here grants inclusion automatically.

## Project layout

```
src/app/(site)/        public website (own root layout, original design in site.css)
src/app/admin/         admin panel (own root layout); (panel)/ requires sign-in
src/app/admin/api/     JSON endpoints for media upload and location lookups
src/app/media/         serves files from Supabase Storage
src/lib/               database, auth, permissions, queries, storage, sanitizing, SEO helpers
src/components/        site and admin components
db/                    migrations, RLS, seed generator (build_seed.py → seed.sql), verify.mjs
site/                  the original static site (backup)
```
