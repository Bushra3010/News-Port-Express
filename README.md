# NewsPort Express

Hindi news portal with a multi-user admin panel. Built with Next.js 16 (App Router) and deployed to Cloudflare Workers with the OpenNext adapter. Content lives in Cloudflare D1 (SQLite) and uploaded media in Cloudflare R2.

The original static site is kept in `site/` and in the git tag `static-site-backup`.

## Stack

| Part | Choice |
| --- | --- |
| Framework | Next.js 16, React 19, TypeScript |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1, accessed through Drizzle ORM (`src/lib/schema.ts`) |
| Media | Cloudflare R2 bucket, served at `/media/...` with year-long caching |
| Auth | Own implementation: PBKDF2-SHA256 password hashes, server-side sessions in D1, httpOnly cookie |
| Editor | TipTap; all HTML is sanitized on the server before saving |

Node 22+ is required (Wrangler needs it). On this Mac it is installed at `~/.local/node22`; prefix commands with `PATH=~/.local/node22/bin:$PATH`.

## Run locally

```bash
npm install
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Open http://localhost:3000/admin. The first visit shows the one-time setup page where you create the Super Admin account.

Optional sample stories for local testing only (never run against production):

```bash
python3 db/build_demo.py && npx wrangler d1 execute DB --local --file=db/demo.sql
```

To test the real Worker build on the Cloudflare runtime: `npm run preview`.

## Deploy to Cloudflare

One-time setup (needs your Cloudflare account):

```bash
npx wrangler login
npx wrangler d1 create newsport-db          # copy the database_id into wrangler.jsonc
npx wrangler r2 bucket create newsport-media
npm run db:migrate:remote
npm run db:seed:remote
npx wrangler secret put SETUP_TOKEN        # any long random value; needed once at /admin/setup
```

Set `SITE_URL` in `wrangler.jsonc` to the real domain (for example `https://www.example.com`), then:

```bash
npm run deploy
```

Attach the domain under Workers & Pages → newsport-express → Settings → Domains & Routes (the domain's DNS must be on Cloudflare). SSL is issued automatically.

After deploying, open `/admin/setup`, enter the `SETUP_TOKEN` and create the Super Admin. The setup page switches itself off once an account exists.

### Database changes

Edit `src/lib/schema.ts`, then:

```bash
npm run db:generate        # writes a new SQL file in db/migrations
npm run db:migrate:local
npm run db:migrate:remote
```

### Backups

D1 keeps 30 days of point-in-time history (Time Travel). To restore: `npx wrangler d1 time-travel restore newsport-db --timestamp=<ISO time>`. For an offsite copy: `npx wrangler d1 export newsport-db --remote --output=backup.sql`. R2 objects are never overwritten (every upload gets a new key).

## Roles

| Role | Can do |
| --- | --- |
| Super Admin | Everything: users, roles and permissions, categories, locations, pages, settings, audit log, all news |
| Admin | Approve/reject, publish, unpublish, trash; edit any news within assigned categories/states; manage editors and reporters they created |
| Editor | Create, edit and review news; submit for approval; publish only if “Allowed to publish” is ticked on their account |
| Reporter | Create news, edit own unpublished news, upload media, submit for approval and track status |

Permissions are stored in D1 and can be changed per role in Admin → Roles & Permissions. Every check runs on the server (`src/lib/permissions.ts`, `src/lib/auth.ts`); the UI only hides what the server would refuse anyway. Assigning categories or states to an Admin or Editor restricts them to that scope.

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
src/app/media/         serves R2 files
src/lib/               database, auth, permissions, queries, sanitizing, SEO helpers
src/components/        site and admin components
db/                    migrations, seed generator (build_seed.py → seed.sql)
site/                  the original static site (backup)
```
