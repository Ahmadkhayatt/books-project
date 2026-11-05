# M0 — Scaffold & foundation (m0-scaffold)

Status: ready to execute · Branch: `feat/m0-scaffold` · PR title: `Milestone M0: Scaffold`
Source: PLAN.md (all §) · DESIGN.md (tokens/components) · dispatch supersedes PLAN.md §4 on Google env naming (see note below).

---

## Goal

A clean, reproducible, **buildable** skeleton of Bookshelf Exchange (تبادل الكتب):
git hygiene on a fresh repo → Docker-compose Postgres 17 (host `5433`) →
Next.js 16.4.3 + TypeScript strict + Tailwind v4 with `[locale]` routing
(Arabic default, server-side RTL, hreflang) → self-hosted next/font with the
locked pairing → Auth.js v5 (split config, JWT sessions, Credentials + optional
env-driven Google) → **full Prisma v1 schema (27 models, 12 enums) + hand-
augmented init migration** → `.env.example`/`.gitignore` → both-locale home
shell, sign-in/sign-up that actually round-trip against compose Postgres →
`/api/health` → PR open from `feat/m0-scaffold`. No app features beyond the
shell; every later milestone builds on this contract.

## Environment facts (verified 2026-11-05)

- Repo `books-project/` has **no commits**; branch `main` is unborn; remote `origin = https://github.com/Ahmadkhayatt/books-project.git`; `git config core.ignoreCase=true` (default Windows) — see Regressions.
- gh 2.96.0 authenticated; git identity `khayat / khayyat2003@gmail.com`; Docker 29.2.0; **no psql** → all DB work via `docker compose` + `npx prisma@7`.
- npm is the package manager (PLAN decision); registry reachable; **Prisma 8 is now `latest` (RC line) — `latest`/`npm i prisma` would install v8, which cannot read `schema.prisma`. Pin v7 everywhere and always call `npx prisma@7`.**
- Version pins confirmed on npm 2026-11-05: `next@16.4.3` (latest, published 2026-10-31), `next-intl@4.14.9`, `next-auth@5.0.0-beta.32`, `@auth/prisma-adapter@2.11.3` (`@auth/core@0.41.3`), Prisma 7 latest = **7.10.1** (`prisma`, `@prisma/client`, `@prisma/adapter-pg`); Prisma 8 GA expected Oct 2026 — **we stay on v7** (below).
- `next/root-params` is default-available in Next ≥ 16.3; target is 16.4.3 → OK. `setRequestLocale` is legacy — do not use. Next 16 proxy = `proxy.ts`, Node.js runtime only, `config.runtime` is **not allowed**.
- **Google env naming:** dispatch mandates `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (Auth.js v5 `AUTH_*` convention, passed explicitly to the provider). This **supersedes PLAN.md §4's `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`**. `.env.example` documents the `AUTH_GOOGLE_*` names only. Flag for the next PLAN.md revision; do not edit PLAN.md inside this milestone.

---

## Files to create/modify

All paths relative to `books-project/` (the repo root). Create everything; nothing pre-exists except `PLAN.md` and `DESIGN.md` (committed as-is).

### Root / git / docker
| File | What |
|---|---|
| `.gitattributes` | `* text=auto eol=lf` (forces LF; kills CRLF drift). UTF-8 no BOM everywhere. |
| `.gitignore` | PLAN §6 list **in this order**: `.env`, `.env.local`, `.env.*`, **then `!.env.example`**, then `node_modules/`, `.next/`, `generated/`, `public/uploads/*`, `!public/uploads/.gitkeep`, `*.tsbuildinfo`, `.DS_Store`, `next-env.d.ts`? — **no**: `next-env.d.ts` stays tracked? CNA ignores it by default; keep it ignored (`next-env.d.ts`) as generated. Also `*.log`, `.vercel`. |
| `docker-compose.yml` | Exactly PLAN §6 (name `bookshelf-exchange`; `postgres:17-alpine`; `container_name: bookshelf_exchange_pg`; env `POSTGRES_USER=bookshelf` / `POSTGRES_PASSWORD=bookshelf` / `POSTGRES_DB=bookshelf_exchange`; ports `"127.0.0.1:5433:5432"`; volume `bookshelf_exchange_pgdata`; healthcheck `pg_isready -U bookshelf -d bookshelf_exchange`, 5s/3s/12; `restart: unless-stopped`; named volume declared). |
| `.env.example` | See **Data & API shapes → env**. Documents every var; `HINT` comments in EN. |
| `.env` | Builder-created local only — **never committed** (verify with `git ls-files`). |
| `package.json` | name `bookshelf-exchange`, `version: 0.1.0`, `private: true`, `engines: { node: ">=22" }`, scripts (below), deps (below). `package-lock.json` committed. |
| `.nvmrc` | `22` |
| `prisma.config.ts` | `import "dotenv/config"; import { defineConfig, env } from "prisma/config"; export default defineConfig({ schema: "prisma/schema.prisma", datasource: { url: env("DATABASE_URL") } });` (v7 does NOT auto-load `.env`; the `dotenv/config` import is mandatory). |
| `next.config.ts` | `createNextIntlPlugin("./i18n/request.ts")(nextConfig)`; `poweredByHeader: false`; `images.remotePatterns` = `covers.openlibrary.org` (https, pathname `/**`) only + comment for S3 base URL later; nothing else. **No** `experimental.rootParams` (default-on in 16.3+). |
| `tsconfig.json` | CNA output + `"strict": true`, `target: ES2022`, `moduleResolution: "bundler"`, paths `@/*` → `./*` (no src dir). `exclude`: `generated`. |
| `eslint.config.mjs` | CNA 16 flat config (`eslint-config-next` + core-web-vitals + typescript). `npm run lint` must be clean; do not relax rules. |
| `README.md` | Stub only (proper README = M6): what it is (1 line ar+en), prereqs (Node 22, Docker), quickstart (`docker compose up -d` → `npm install` → `npx prisma@7 migrate dev` → `npm run dev`), pointer to `PLAN.md`/`DESIGN.md`. |
| `PROMPT-NOTES.md`? | **No.** No scratch files. |

### package.json scripts (exact)
```
dev: next dev
build: next build
start: next start
postinstall: prisma generate      (MUST stay loud — no `|| true`; fails the install on error)
lint: eslint .
lint:fix: eslint . --fix
typecheck: tsc --noEmit
test: vitest run
test:watch: vitest
i18n:check: node scripts/check-i18n.mjs
db:up: docker compose up -d
db:down: docker compose down          (never `-v` without approval — wipes volume)
db:logs: docker compose logs postgres --tail=50
db:validate: prisma@7 validate  → actual: "prisma validate" preceded by npm exec resolution; see note ①
db:generate: prisma generate
db:migrate: prisma migrate dev
db:migrate:deploy: prisma migrate deploy
db:migrate:create: prisma migrate dev --create-only
db:studio: prisma studio
db:seed: tsx prisma/seed.ts
```
① **Prisma-8 hijack rule:** every bare `prisma …` inside package.json scripts is resolved by npm through the **local** `node_modules/.bin`, which is fine once `prisma@7` is a devDependency. For **one-off shell calls** the builder MUST write `npx prisma@7 …` (never bare `npx prisma`). Scripts above stay short; both forms are pinned to v7 by the dependency. `db:validate`/`db:generate` etc. are therefore safe as written. **Do not** install `prisma@8`/`@prisma/client@8` anywhere, and never run `npm update` on the auth/prisma lines.

### Dependencies (install via npm; lock committed)
**deps:** `next@16.4.3` (exact) · `react@^19.2.0` `react-dom@^19.2.0` · `next-intl@4.14.9` ·
`next-auth@5.0.0-beta.32` (exact) · `@auth/prisma-adapter@2.11.3` (exact) ·
`bcryptjs@^3.0.2` · `zod@^4.1.8` · `@prisma/client@^7.10.1` · `@prisma/adapter-pg@^7.10.1` ·
`pg@^8.16.3` · `dotenv@^17` · `server-only@^0.0.1` · `tsx@^4` · `sharp`? — **no** (M2).
**devDeps:** `prisma@^7.10.1` · `@types/node@^22` · `@types/pg@^8` · `@types/bcryptjs`? (v3 ships types — omit) · `typescript@^5.9` · `tailwindcss@^4` `@tailwindcss/postcss@^4` (as generated by CNA 16) · `eslint@^9` + `eslint-config-next@16.4.3` · `vitest@^3` · `@vitejs/plugin-react`? — not needed for node-env smoke test; omit.

### App code (create-next-app 16 scaffold, then modified — **no `--git`**, see Verification §3)
| File | What |
|---|---|
| `app/[locale]/layout.tsx` | `const { locale } = await params` (Next 16 async APIs); `if (!hasLocale(routing.locales, locale)) notFound()`; `generateStaticParams()` → `[{locale:'ar'},{locale:'en'}]`; `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={fontVars}>`; `NextIntlClientProvider`; metadata via `generateMetadata` (alternates: `languages: { ar: '/ar', en: '/en', 'x-default': '/ar' }`, title template `%s — تبادل الكتب`/`%s — Bookshelf Exchange`). Font classNames composed on `<html>`. |
| `app/[locale]/page.tsx` | Home shell per DESIGN.md §6 (kicker mono `TABĀDUL — ٢٠٢٦`, Amiri/Fraunces H1 «كلُّ كتابٍ يستحقُّ قارئًا ثانيًا» / "Every book deserves a second reader", lede, primary+ghost CTA → `/sign-up`, `/sign-in`; double rule; **three ledger rows** ٠١ اعرض نُسختك / ٠٢ اعثر على ضالّتك / ٠٣ تبادَل واكسب سمعة with one-line glosses; colophon strip). All copy from `messages/*.json`. Zero DB calls. |
| `app/[locale]/loading.tsx` | Skeleton: ledger-row bars (`.skeleton`), `aria-busy`, sr-only «جارٍ التحميل…». |
| `app/[locale]/error.tsx` | `'use client'`; stamp motif (broken-spine SVG); «انكسر الرفّ» / "The shelf gave way"; shows `error.digest` in mono if present; «حاول مرة أخرى»/"Try again" (reset boundary) + ghost home link. |
| `app/[locale]/not-found.tsx` | «№ 404 — هذه الصفحة غير موجودة» / "№ 404 — Not on our shelves"; ghost home. |
| `app/[locale]/sign-in/page.tsx` · `app/[locale]/sign-in/actions.ts` | Server component form; `signInWithCredentials` server action: zod-validate, rate-limit (below), `signIn('credentials', { email, password, redirectTo: \`/\${locale}\` })`; inline field errors via `useActionState`? — **keep simple: `searchParams` error + `aria-invalid`**; wrong credentials → same generic message «البريد أو كلمة المرور غير صحيحة»; rate-limited → «عدد كبير من المحاولات — حاول بعد دقائق». |
| `app/[locale]/sign-up/page.tsx` · `app/[locale]/sign-up/actions.ts` | `signUp` action: zod (email; `username` 3–24 `^[a-z0-9_]+$`; `password` ≥ 8, **must contain a letter and a digit**; `displayName` 1–80); email+username lowercased; `bcrypt.hash(pw, 12)`; **transaction**: `user.create` + `profile.create` (`locale` from current locale, defaults `ar`); `P2002` → field error (email/username taken → 409-style inline); rate-limit; then `signIn('credentials', …, redirectTo: '/{locale}')`. zod v4 (`z.email()`, `z.string().regex`). |
| `app/api/auth/[...nextauth]/route.ts` | `import { handlers } from '@/auth'; export const { GET, POST } = handlers;` |
| `app/api/health/route.ts` | `export const dynamic = 'force-dynamic'`; `GET` → `{ ok: true, db: 'up' \| 'down', version }` via `` prisma.$queryRaw`SELECT 1` ``; DB failure → HTTP 503 `{ ok: false, db: 'down' }`; `version` = `process.env.npm_package_version ?? '0.1.0'`. No internals, no stack traces. |
| `auth.config.ts` | Edge/proxy-safe: `{ pages: { signIn: '/sign-in' }, session: { strategy: 'jwt', maxAge: 30*24*60*60 }, callbacks: { authorized({ auth }) — M0: return true; keep shape for M5 hardening }, providers: [] }`. **MUST NOT import Prisma/bcrypt/auth.ts.** |
| `auth.ts` | `NextAuth({ adapter: PrismaAdapter(prisma), session: spread from auth.config, providers: [Credentials({ credentials: { email, password }, authorize }), ...googleIfConfigured], callbacks: jwt+session (below) })`. `authorize()`: `email = String(credentials.email ?? '').trim().toLowerCase()`; rate-limit key `signin:email:<email>` (5 / 5 min); `prisma.user.findUnique({ where: { email }, omit: { passwordHash: false } })` (client-wide omit is on — see lib/prisma.ts); `!user?.passwordHash` → null; `bcrypt.compare`; `status === 'ACTIVE'` required; return `{ id, email, name, image, role }`. `jwt` callback: on `trigger === 'signIn'` copy `user.id`/`user.role` into token; `session` callback: expose `session.user.id`/`role`. `authorize` returns null on any failure (never throws internally-leaking errors). Google provider: included **only if both** `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set (explicit `clientId`/`clientSecret`), else omitted entirely (no dead button); Google users get `passwordHash: null`. |
| `auth.d.ts` (types) | `declare module 'next-auth' { interface Session { user: { id: string; role: Role } & DefaultSession['user'] } }` and `interface JWT { id?: string; role?: Role }` — import `Role` from `@/generated/prisma/enums`. |
| `proxy.ts` | **Root** (not `src/`). `import createMiddleware from 'next-intl/middleware'`; `import NextAuth from 'next-auth'`; `import authConfig from './auth.config'`; `const intl = createMiddleware(routing)`; `export default NextAuth(authConfig).auth((req) => intl(req))` — authorized() from auth.config gates first. `export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] }` (covers `/` → `/ar`, and all locale paths; excludes api/_next/files). **No** `middleware.ts` anywhere; **no** `config.runtime`. |
| `i18n/routing.ts` | `defineRouting({ locales: ['ar','en'], defaultLocale: 'ar', localePrefix: 'always' })` |
| `i18n/request.ts` | next-intl v4.14 pattern with **next/root-params** (default in 16.3+, we're on 16.4.3): `import * as rootParams from 'next/root-params'`; `getRequestConfig(async ({ locale }) => { if (!locale) { const v = await rootParams.locale(); if (hasLocale(routing.locales, v)) locale = v; else notFound(); } return { locale, messages: (await import(\`../messages/\${locale}.json\`)).default } })` with `hasLocale` guard; unknown → `notFound()`. |
| `messages/ar.json` · `messages/en.json` | **Real MSA + real English**, key-for-key. Namespaces: `meta`, `nav`, `hero`, `home.principles0{1..3}`(+`title`,`body`), `auth.{signIn*,signUp*,errors.*}`, `common.{skipToContent,loading,tryAgain,backHome}`, `notFound`, `error`, `footer.{tagline,guide,language,rights,edition}`, `localeSwitch`. No lorem; warm bookish Arabic; see DESIGN.md §7 process. |
| `scripts/check-i18n.mjs` | Node script (no deps): read both JSONs, flatten, assert identical key sets, non-empty string values, and flag **bidi-dangerous keys** (`/(isbn\|url\|email\|username\|handle\|website\|link)/i`) lacking documented `<bdi dir="ltr">` handling (print list; exit 1 on key-set mismatch or empty values; exit 0 otherwise with counts printed). |
| `lib/prisma.ts` | `import 'server-only'`; globalThis-cached `PrismaClient`; `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }), omit: { user: { passwordHash: true } } })`. |
| `lib/rate-limit.ts` | `checkRateLimit(key, { limit, windowSeconds })` per PLAN §12 steps: (1) 1-in-50 opportunistic prune (`DELETE … createdAt < now()-48h`); (2) `count` inside window; (3) ≥ limit → `{ ok: false, retryAfter }` (no insert); else `create` event, `{ ok: true, remaining }`. Constants: `signinIp: 5/300s`, `signinEmail: 5/300s`, `signupIp: 5/3600s`, plus exported keys used later (`msgSend 30/60s`, `reportCreate 10/3600s`, `listingCreate 20/86400s`, `reviewCreate 30/86400s`, `isbnLookup 60/60s`). No Redis; comment points to §12. |
| `lib/utils.ts` | `cn()` (tiny clsx-style join) — used by components; nothing else. |
| `lib/fonts.ts` | next/font/google definitions per DESIGN.md §3 (Fraunces/Newsreader variable+axes; Amiri 400/700; Noto_Sans_Arabic variable; all `display: 'swap'`; export `fontVariables` class string; each Arabic face declares `subsets: ['arabic']`). |
| `components/site-header.tsx` | Per DESIGN.md §5.1: skip link, masthead hairline + (md+) `3px double` bottom rule, wordmark (Amiri 700 تبادل الكتب / Fraunces WONK Bookshelf Exchange), nav (Home · Sign in/Account + Sign out when authed — read session via `auth()` server-side; **no client session**), locale switcher, sign-up CTA hidden when authed, mobile menu button (SVG, `aria-expanded`/`aria-controls`, Escape closes, focus returns). |
| `components/site-footer.tsx` | DESIGN.md §5.2: ink bg, wordmark+tagline, «الدليل/Guide» (**existing routes only**: الرئيسية/Home, تسجيل الدخول, إنشاء حساب), locale switcher + availability line, bottom bar `© ٢٠٢٦ / 2026` · edition · GitHub link (`rel="noreferrer"`, no icon flip). |
| `components/locale-switcher.tsx` | `'use client'`; segmented العربية/English; `usePathname()`; `router.replace(path-with-other-locale)`; `aria-pressed`; 44px targets. |
| `components/sign-out-button.tsx` | `'use client'` thin wrapper form → `signOut({ redirectTo: '/' })` action (server action in `lib/actions/auth.ts`). |
| `app/[locale]/layout.tsx` uses | header/footer around `{children}`; `<main id="content">`. |
| `prisma/schema.prisma` | **Full v1 — §Data & API shapes.** |
| `prisma/seed.ts` | Stub: `console.log('[db:seed] Deferred to milestone M6 (PLAN.md §14) — nothing seeded.'); process.exit(0)` |
| `prisma/migrations/<ts>_init/migration.sql` | From `migrate dev --create-only`, **then hand-appended** (§Data & API shapes). Committed. |
| `prisma/migrations/migration_lock.toml` | `provider = "postgresql"` (generated). |
| `public/uploads/.gitkeep` | Empty file; uploads ignored. |
| `tests/smoke.test.ts` | `import { describe, it, expect } from 'vitest'`; asserts `check-i18n` parity fixture? No DB: assert `routing.locales` deep-equals `['ar','en']` and defaultLocale `'ar'`, plus `cn()` davranış (2–3 assertions). `vitest.config.ts` — `environment: 'node'`, include `tests/**/*.test.ts`. |
| `vitest.config.ts` | as above; passWithNoTests not needed (1 file exists). |

**Folder structure after M0 must match PLAN.md §13** (app/ at repo root — **no `src/`**).

---

## Data & API shapes

### Prisma schema v1 (full — source of truth PLAN.md §2; restated for the builder)

`generator client { provider = "prisma-client" output = "../generated/prisma" }`
`datasource db { provider = "postgresql" }` — **no `url`** (v7 moves it to `prisma.config.ts`).
Conventions: `cuid()` ids; `createdAt`/`updatedAt` via `@default(now())`/`@updatedAt`;
**every table `@@map`** to snake_case plurals: `users accounts sessions verification_tokens profiles follows activity_events books authors book_authors listings wishlist_items ratings reviews comments review_likes comment_likes reading_lists reading_list_items conversations conversation_participants messages exchanges exchange_ratings reports admin_actions rate_limit_events`.
Columns stay **camelCase, quoted by Postgres** (hand-written SQL must use `"camelCase"`).

**Enums (12):** `Role{MEMBER,ADMIN}` · `UserStatus{ACTIVE,SUSPENDED,BANNED}` · `ListingType{SELL,SWAP,FREE}` · `BookCondition{NEW,LIKE_NEW,GOOD,ACCEPTABLE,WORN}` · `ListingStatus{ACTIVE,RESERVED,COMPLETED,CANCELLED}` · `ListVisibility{PUBLIC,PRIVATE,UNLISTED}` · `ActivityType{LISTING_CREATED,LISTING_COMPLETED,REVIEW_POSTED,BOOK_SHELVED,FOLLOWED_USER,WISHLIST_ADDED,EXCHANGE_COMPLETED}` · `ExchangeStatus{PROPOSED,ACCEPTED,DECLINED,CANCELLED,COMPLETED}` · `ReportTarget{USER,LISTING,REVIEW,COMMENT,MESSAGE}` · `ReportReason{SPAM,INAPPROPRIATE,SCAM,HARASSMENT,COPYRIGHT,OTHER}` · `ReportStatus{OPEN,REVIEWING,RESOLVED,DISMISSED}` · `ReadingProgress{WANT,READING,READ}`.

**Models (27) — fields/indexes/relations exactly per PLAN §2 list** (User + `passwordHash?`,
Account/Session/VerificationToken canonical → User cascade; Profile 1:1 `reputationScore Int @default(0)`;
Follow unique `[followerId, followingId]`; ActivityEvent; Book (`isbn13? @unique`,
`openLibraryKey? @unique`, `subjects String[] @default([])`, `titleAr?`); Author; BookAuthor
M2M `order Int @default(0)`; Listing (`priceCents Int?`, currency default `"EGP"`,
`images String[] @default([])`, 4 indexes); WishlistItem; Rating (`value Int`);
Review (unique `[userId, bookId]`, spoiler flag); Comment (`reviewId?`, `parentId?` self-FK,
`deletedAt?` soft-delete); ReviewLike/CommentLike (separate tables); ReadingList(+Item,
`progress ReadingProgress @default(WANT)`); Conversation/ConversationParticipant/Message
(`lastMessageAt?`, `lastReadAt?`); Exchange (`listingId @unique`); ExchangeRating
(`@@unique([exchangeId, raterId])`); Report (polymorphic `targetId String`, no FK by design);
AdminAction; RateLimitEvent.
Full field-level spec = PLAN.md lines 68–174; **copy it verbatim into the schema** — do not
"improve" names; reviewers diff against PLAN.

- Global password omission: `omit: { user: { passwordHash: true } }` (lib/prisma.ts) — and the one deliberate override in `auth.ts authorize()` (`omit: { passwordHash: false }`).
- `Report.targetId` has **no** FK — intentional (target may be deleted); admin UI resolves by `targetType`.
- Import path for everything Prisma: `@/generated/prisma/client` and `@/generated/prisma/enums` (generated, gitignored — never committed).

### Init migration — hand-augmented (exact procedure)
1. `docker compose up -d` → wait healthy.
2. `npx prisma@7 migrate dev --create-only --name init` — generates `prisma/migrations/<timestamp>_init/migration.sql`; **does not apply**.
3. Append to the generated SQL (before first apply):
```sql
-- Bookshelf Exchange v1 integrity additions (PLAN.md §2)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX books_title_trgm_idx ON books USING gin (lower("title") gin_trgm_ops);

ALTER TABLE ratings          ADD CONSTRAINT ratings_value_check          CHECK ("value" BETWEEN 1 AND 5);
ALTER TABLE exchange_ratings ADD CONSTRAINT exchange_ratings_score_check CHECK ("score" BETWEEN 1 AND 5);
ALTER TABLE listings         ADD CONSTRAINT listings_price_cents_check   CHECK ("priceCents" IS NULL OR "priceCents" >= 0);
ALTER TABLE listings         ADD CONSTRAINT listings_currency_format_check CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE follows          ADD CONSTRAINT follows_no_self_check        CHECK ("followerId" <> "followingId");
```
   (Column names are camelCase → **quoted**; table names are the mapped snake_case, unquoted OK.)
4. `npx prisma@7 migrate dev` — applies; clean on empty DB. (`migrate dev` needs a shadow DB — the compose `bookshelf` superuser can create it. Do **not** downgrade to `db push`.)
5. Commit `prisma/migrations/`.

### Env vars (`.env.example` — every var documented; `.env` stays local)
| Var | Example/default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://bookshelf:bookshelf@localhost:5433/bookshelf_exchange?schema=public` | **5433 host-side.** Same network ⇒ `postgres:5432` (not used in dev). |
| `AUTH_SECRET` | `# generate: npx auth secret` | Required in all envs; v5 cookie encryption. |
| `AUTH_TRUST_HOST` | `true`? — **omit** (v5 auto in dev); document optional | Only if deploying behind proxies. |
| `AUTH_GOOGLE_ID` | _(commented out)_ | Both-or-none with below; when both set → Google button appears for sign-in/up. **Dispatch naming; supersedes PLAN §4.** |
| `AUTH_GOOGLE_SECRET` | _(commented out)_ | Google Cloud console; authorized redirect `${APP_URL}/api/auth/callback/google`. |
| `IMAGE_STORE` | `local` | Documented for M2 (`s3` later with `S3_*` vars — list them commented). |
| `PRISMA_ENGINES_MIRROR` | _(commented)_ `https://registry.npmmirror.com/-/binary/prisma` | Windows ECONNRESET fallback for the **schema engine** binary (migrations). |
| `PRISMA_BINARIES_MIRROR` | _(commented)_ same value | Legacy name kept for older CLIs; harmless. |
| `NODE_ENV` | `development` | informational |
| `DEFAULT_CURRENCY` | _(commented)_ `EGP` | M2 concern; documented now per PLAN §16. |

### Route handlers & server actions (M0)
- `GET /api/auth/*` `POST /api/auth/*` — Auth.js (`handlers`). `pages.signIn = '/sign-in'`; proxy prefixes locale; unauthenticated redirect to `/{locale}/sign-in?callbackUrl=…`.
- `GET /api/health` — `{ ok, db, version }` (200 / 503). `force-dynamic` so build never touches DB.
- Server actions: `signInWithCredentials(prevState, formData)` (sign-in), `signUp(prevState, formData)` (sign-up), `signOutAction()` (header). Actions are POST-only, zod-validated, rate-limited, return field errors (no thrown digests to the client).
- Rate limits wired in M0: `signin:email:<email>` (5/5 min, in `authorize`), `signin:ip:<ip>` and `signup:ip:<ip>` best-effort via `headers()` (x-forwarded-for, else `'unknown'`) inside the actions. Exceeding → inline message, never account enumeration (same message for unknown email vs wrong password).
- Root `/` → proxy/next-intl redirect → `/ar` (permanent? `307` default from next-intl is fine; PLAN says permanent → next-intl handles; do not hand-roll).
- hreflang on all pages via `generateMetadata` alternates; `x-default → /ar`.

### i18n message namespaces (minimum keys — extend, never rename)
`meta.{title,description}` · `nav.{home,signIn,signUp,signOut,account}` ·
`hero.{kicker,title,lede,ctaPrimary,ctaSecondary}` · `home.{p01t,p01b,p02t,p02b,p03t,p03b,colophon}` ·
`auth.{email,password,displayName,username,createAccount,haveAccount,noAccount,signingIn,submitting,errors.{invalidCredentials,rateLimited,emailTaken,usernameTaken,passwordWeak,generic}}` ·
`common.{skipToContent,loading,tryAgain,backHome}` · `notFound.{title,body,cta}` · `error.{title,body,retry}` ·
`footer.{tagline,guide,home,signIn,signUp,language,rights,edition}` · `localeSwitch.{ar,en,label}`.
AR copy = MSA warm bookish; EN = idiomatic mirror. Both files committed; parity enforced by `npm run i18n:check`.

---

## Invariants (must remain true — checked in review)

1. **JWT sessions only** — `session.strategy = "jwt"` in auth.config.ts. Credentials provider does not support DB sessions; the `Session` table exists for adapter compat only. (#1 v5 breakage — reviewer rejects `"database"`.)
2. **`proxy.ts`, never `middleware.ts`**; proxy imports `auth.config.ts` only (no Prisma/bcrypt); no `config.runtime` in proxy; Node runtime is implicit.
3. **Arabic default, RTL from the server** — `defaultLocale: 'ar'`, `localePrefix: 'always'`; `<html lang dir>` server-set in `[locale]/layout.tsx`; never client-side; unknown locale → `notFound()`; `/` redirects to `/ar`.
4. **RTL = logical properties** — no `left/right`/`ml-*/mr-*/pl-*/pr-*`/`text-left/right` anywhere; Tailwind `ms/me/ps/pe/start/end/text-start` only; ISBNs/URLs/usernames wrapped `<bdi dir="ltr">`; `[dir="rtl"] .icon-flip` only for directional icons; no `letter-spacing` on Arabic; Arabic body `line-height ≥ 1.8`; `:lang(ar) { font-size: 1.08em }`.
5. **DESIGN.md tokens only** — no off-palette hex; no gradients/glass/glow; radius ≤ 3px (chips 999px); no soft shadows (only hard `4px 4px 0 var(--color-rule-strong)` cover-hover plate); no emoji icons; covers stay 2:3; one chip per card max; wordmark/seal per §5.7.
6. **Auth.js pins frozen** — `next-auth@5.0.0-beta.32`, `@auth/prisma-adapter@2.11.3`; never `npm update`/`npm audit fix` these (or Next/Prisma lines) without an advisory review; Google both-or-none `AUTH_GOOGLE_*`; `AUTH_SECRET` required; `passwordHash` never serialized (client-wide omit + `server-only` + single deliberate override in `authorize()`).
7. **Prisma 7 only** — `prisma@^7.10.1`, `@prisma/client@^7.10.1`, `@prisma/adapter-pg@^7.10.1`; generator `prisma-client` with explicit `output = "../generated/prisma"`; import from `@/generated/prisma/client` (never `@prisma/client`); `prisma.config.ts` with `dotenv/config` first line; **`npx prisma@7`** in shell; `generated/` gitignored; `postinstall: prisma generate` stays loud.
8. **Ports & names** — host **5433** → container **5432**; container `bookshelf_exchange_pg`; volume `bookshelf_exchange_pgdata`; DB/user/pass `bookshelf_exchange`/`bookshelf`/`bookshelf` (dev-only, documented in `.env.example`); native Windows PG on 5432 is irrelevant and must not be "fixed".
9. **Git hygiene** — branch `feat/m0-scaffold` **before first commit** (repo unborn; first commit lands on the branch, never on `main`); never `git init` over `.git`; never force-push; `.gitattributes` LF; filenames lowercase-hyphenated; case-collision check before commit; `.env`/generated never committed; `!.env.example` **after** `.env*` lines in .gitignore; `package-lock.json` committed; **npm only** (no pnpm/yarn, no `--legacy-peer-deps`).
10. **Data integrity** — 27 models exactly as PLAN §2 (names, relations, cascades, indexes, `@@map`); init migration = generated SQL **+** the 6 appended statements (pg_trgm + GIN + 5 CHECKs) **applied once**; `migrate dev` not `db push`; migration files committed.
11. **Build without DB** — `npm run build` must pass with Postgres **down** (home is static, health is `force-dynamic`, fonts self-hosted). CI mirrors this.
12. **i18n integrity** — `npm run i18n:check` green (key parity, non-empty, bidi-audit listed); hreflang + `x-default=/ar`; no English copy in `ar.json` and vice-versa; no lorem.
13. **Accessibility** — skip link; `:focus-visible` 2px ink outline + 2px offset (paper on ink); 44px touch targets; landmarks; hierarchical headings; errors via `role="alert"`; no color-alone signals; reduced-motion respected.
14. **Precedent features preserved** — every PLAN-locked decision holds: npm only; Tailwind v4 CSS-first (**no `tailwind.config.js`**); local images → S3-compatible later; EGP default currency documented; sliding-window Postgres rate limit (no Redis); Open Library never called client-side; `pg_trgm` before GIN index (init SQL order).
15. **Scope honesty** — M0 ships shell only; no catalog/listings/search/feed UI; seed stub stays a stub; all routes link only to existing pages (no `/books` links until M1).

## Regressions to avoid (known traps — builder verifies each)

- **`npx prisma` pulling v8** (since Prisma 8 took `latest`): always `npx prisma@7 …`; scripts rely on local `node_modules/.bin` (v7) — still, never bare `npx prisma` in docs/CI. `prisma validate|migrate|generate` all work as `prisma@7`.
- **Prisma engine ECONNRESET on Windows** (schema engine binary download during `postinstall`/`migrate`): set `PRISMA_ENGINES_MIRROR` (and legacy `PRISMA_BINARIES_MIRROR`) to `https://registry.npmmirror.com/-/binary/prisma` in `.env` or npm config, **delete `node_modules`, reinstall fresh** — never resume silently, never `npm install --force`, never `--ignore-scripts` (breaks `prisma generate`).
- **Port mix-up** — host-side `DATABASE_URL` with `5432` → P1001 unreachable; container-internal `localhost:5433` also wrong (app on host; container sees `postgres:5432`). `docker compose ps` must show `0.0.0.0:5433->5432` bound to **127.0.0.1**.
- **Native Windows PostgreSQL hijacking 5432** — do not "fix" compose to 5432; if 5433 busy, move host side only and update `DATABASE_URL`.
- **Hand-written SQL with unquoted camelCase** (`price_cents`, `follower_id`…) → P3018 / silent constraint on wrong target; use quoted identifiers (§Data & API shapes has the exact block). Run `npx prisma@7 migrate dev` only after the append; verify with `\d+ ratings`? — no psql: verify via `npm run db:studio` or `npx prisma@7 migrate status` + a `$queryRaw` assertion in health? No — verify via **studio UI** or `migrate status` output; do not add psql.
- **`CREATE EXTENSION`/GIN before extension** → `operator class "gin_trgm_ops" does not exist`; order: extension first, then index. Both are in the appended block — keep order.
- **`git` on Windows with `ignoreCase=true`** — two files differing only by case are invisible to git → broken imports on Linux CI. One filename casing everywhere; after staging run `git ls-files | tr 'A-Z' 'a-z' | sort | uniq -d` → must be empty.
- **create-next-app `--git`** — never pass a git-initializing flag inside the existing repo; it would nest a second repo or clobber hooks. First commit must be on `feat/m0-scaffold` (`git checkout -b feat/m0-scaffold` works pre-first-commit on unborn main). CNA may still write its own `.gitignore` — **merge, don't overwrite blindly** (ours carries `!.env.example` ordering). If prompted "directory contains .git", proceed without re-init; do not delete `.git`.
- **`middleware.ts` relapse** — Next 16 errors/warns and deprecates; delete on sight; reviewer rejects it.
- **Auth.js v5 default template drift** — copied tutorials use database sessions/edge runtime/`AUTH_SECRET` missing/v4 API (`getServerSession`) → all rejected patterns; this repo's split-config + JWT is the only accepted shape.
- **Google provider half-configured** (only ID or only SECRET set) → runtime provider crash at sign-in; both-or-none enforced in `auth.ts`.
- **`passwordHash` leaking** — via default include in a query, via `console.log(user)`, via health endpoint, via client component props. Omit covers queries; logs stay minimal; review any new `prisma.user.*` for select/omit.
- **Client-side `dir` / `lang` toggling** → hydration mismatch & FOUC; only the server layout sets it.
- **`left/right` creeping in** (quick fixes in CSS/JSX: `left-0`, `text-left`, `ml-` …) → RTL regressions; grep in review (`git diff | grep -E '(left|right|ml-|mr-|pl-|pr-|text-left|text-right)'` should show nothing outside `.git`).
- **Letter-spacing on Arabic** / Arabic at `< 1.08em` / line-height < 1.8 → unreadable; reviewer rejects.
- **`.env` committed** or `generated/` committed (engine binaries!) → rotate `AUTH_SECRET`, purge from history, force-push only with reviewer approval. Prevention: `.gitignore` ordering + `git ls-files` check.
- **`docker compose down -v`** — wipes `bookshelf_exchange_pgdata`; forbidden without explicit approval.
- **Build-time DB access** — any page/action touched during `next build` that awaits Prisma → build env has no DB; health route `force-dynamic`, pages static or dynamic-by-request only.
- **next/font without `subsets: ['arabic']`** → Arabic falls back to system fonts silently; Amiri must also declare `weight: ['400','700']` (it is not variable); variable faces must NOT pass `weight`.
- **`setRequestLocale` (legacy)** — removed from this codebase; `next/root-params` is the mechanism; don't import it.
- **Missing `hasLocale` guard / unknown `[locale]`** → 500s instead of 404; layout must `notFound()`.
- **i18n drift** — editing one of ar/en JSON without the other → `i18n:check` failure; never "temporarily" skip the script.
- **Blind `npm audit fix`** — bumps `next-auth`/`prisma`/`next` off pins; forbidden (R1/R2).
- **Seed touching DB** — `db:seed` stub must not connect; M6 implements it.
- **CRLF checkout** — `.gitattributes` must land in the **first** commit; mixed endings break diffs and `check-i18n.mjs` parsing of Arabic files.

## Verification (builder must show ALL of these green, in order)

**0. Branch & tree**
```bash
git checkout -b feat/m0-scaffold          # BEFORE any commit; main stays unborn
git status                                 # clean scaffold on branch
git ls-files                               # PLAN.md, DESIGN.md, sources — NO .env, NO generated/
git ls-files | tr 'A-Z' 'a-z' | sort | uniq -d   # → empty
```

**1. Fresh install (never resume a failed one)**
```bash
npm install                              # postinstall → prisma generate (must succeed)
# on ECONNRESET: set PRISMA_ENGINES_MIRROR=...npmmirror... in .env, rm -rf node_modules, retry
```

**2. Postgres up + schema**
```bash
docker compose up -d
docker compose ps                        # bookshelf_exchange_pg → (healthy), 127.0.0.1:5433->5432
npx prisma@7 validate
npx prisma@7 migrate dev --create-only --name init
# append the 6 statements (pg_trgm + GIN + 5 CHECKs) to prisma/migrations/*_init/migration.sql
npx prisma@7 migrate dev                 # applies clean on empty DB; shadow DB OK (superuser)
npx prisma@7 migrate status              # "Database schema is up to date"
```

**3. Static checks**
```bash
npm run i18n:check                       # parity + non-empty + bidi audit list
npm run lint                             # eslint clean, no warnings-as-errors bypassed
npm run typecheck                        # tsc --noEmit clean
npm test                                 # vitest smoke green
```

**4. Build (DB may stay up, but must not be required)**
```bash
npm run build                            # yeşil; home prerendered ar/en; health NOT executed at build
```

**5. Runtime smoke**
```bash
npm run dev                              # port 3000
curl -sL -o /dev/null -w "%{http_code}\n" http://localhost:3000/          # follows redirect → expect 200 (final: /ar)
curl -s http://localhost:3000/ar | grep -E 'lang="ar" dir="rtl"'          # must match
curl -s http://localhost:3000/en | grep -E 'lang="en" dir="ltr"'          # must match
curl -s http://localhost:3000/api/health                                 # {"ok":true,"db":"up","version":"0.1.0"}
```
(Windows: `Invoke-WebRequest` equivalents acceptable if shown.)

**6. Auth round-trip (evidence pasted in PR)**
- Browser: register (`displayName`, `ahmad_test`, email, password `demo1234`) → auto sign-in to `/ar`; sign out; sign-in again OK; wrong password → generic error (no enumeration); direct `GET /ar` shows signed-in header state; `view-source` contains no `passwordHash`; `/api/health` still 200.

**7. RTL/visual pass** — screenshot `/ar` and `/en` at 390px and 1280px; attached (or linked) in PR; officer checks: mirrored masthead, Amiri wordmark, ledger rows aligned `start`, no horizontal scroll, focus ring visible when tabbing.

**8. Commits & PR**
- Commit shape — **every commit** subject line starts with `milestone 0 (m0) ` + `<scope>: <summary>`, ≤ 72 chars, imperative, English; body optional one paragraph. Examples:
  - `milestone 0 (m0) scaffold: compose pg + prisma v7 full v1 schema + init migration`
  - `milestone 0 (m0) auth: split config JWT + credentials + optional google`
  - `milestone 0 (m0) i18n-rtl: ar/en routing, server dir, fonts, home shell`
  - `milestone 0 (m0) tests: vitest smoke + check-i18n parity gate`
- Push: `git push -u origin feat/m0-scaffold`.
- PR: `gh pr create --base main --head feat/m0-scaffold --title "Milestone M0: Scaffold" --body-file <body>` — body: summary · verification outputs (paste) · migration note (hand-augmented init) · env note (`.env.example`; AUTH_GOOGLE_* supersedes PLAN §4) · screenshots. **Do not merge** — reviewer merges.
- After merge: update `.opencode/plans/loop-state.md` M0 → MERGED (orchestrator task, not builder).

## Builder checklist (5 bullets — print before starting)

1. `git checkout -b feat/m0-scaffold` first; never touch `main`, never `git init`; LF `.gitattributes` in the first commit; lowercase-hyphen filenames; case-collision check passes.
2. Compose up on **127.0.0.1:5433→5432** (`bookshelf_exchange_pg` / `bookshelf_exchange_pgdata`); `prisma.config.ts` loads dotenv; always `npx prisma@7`; init migration = generated + **hand-appended** pg_trgm/GIN/CHECKs (quoted camelCase) before first apply; `migrate status` green.
3. Prisma **7.10.1** everywhere (client/adapter/CLI) — never v8 `latest`; `prisma-client` generator, `@/generated/prisma/client` imports, `/generated` ignored, loud postinstall; full **27-model** schema verbatim from PLAN §2 (@@map snake_case; cuid; cascades).
4. Auth.js **v5 split config + JWT** (Credentials → email lowercase → bcrypt(12) → ACTIVE → omit `passwordHash`); Google both-or-none via `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (dispatch; supersedes PLAN §4); proxy.ts (not middleware.ts) = next-intl + `authorized` hook; `/api/auth/[...nextauth]` handlers; health route `force-dynamic`; build green with DB down.
5. Arabic-first SSR RTL: `dir` server-set, logical CSS only, Amiri/Noto Sans Arabic + Fraunces/Newsreader via next/font (`arabic` subset declared), hreflang/`x-default=/ar`, `/`→`/ar`; `i18n:check` green; both locale screenshots attached; commit subjects `milestone 0 (m0) <scope>: …`; PR titled exactly **Milestone M0: Scaffold**.
