# PLAN — Bookshelf Exchange (تبادل الكتب)

Working name: **Bookshelf Exchange** kept as the public English name; Arabic display name
**تبادل الكتب** (Tabādul al-Kutub). Package name `bookshelf-exchange`. Repo:
`github.com/Ahmadkhayatt/books-project`. Final naming decision lives here and is restated
in the M0 contract.

## 1. Architecture

```
Browser ──► proxy.ts (locale detection, ar default)
        ──► App Router (RSC) app/[locale]/{page,…}
        ──► Server Actions / Route Handlers
              ├─ Auth.js v5 (Credentials + optional Google) ─► JWT session (httpOnly cookie)
              ├─ Prisma 7 Client (driver adapter @prisma/adapter-pg, NO Rust engine)
              │     └─► PostgreSQL 17 (docker-compose, host 127.0.0.1:5433)
              ├─ Open Library (server-side fetch, cached, jscmd=data)
              └─ ImageStore (LocalDisk in dev · S3-compatible later)
```

- **Framework:** Next.js **16.4.3** (exact pin, LTS as of 2026-10) · React 19.2 · App Router ·
  TypeScript **^5.9** (strict) · Node **>= 22** (`.nvmrc` = 22, `engines` in package.json).
- **Package manager: npm only.** pnpm excluded (Windows store/caching failures). `package-lock.json` committed.
- **Styling:** Tailwind **v4** (CSS-first: `@import "tailwindcss"` + `@theme` in `globals.css`; no `tailwind.config.js`).
- **DB:** PostgreSQL **17** via docker-compose (§6). Prisma **7** (§3).
- **i18n:** **next-intl v4** (§8). Locales `ar` (default), `en`. `localePrefix: 'always'`.
- **Fonts:** `next/font/google` (§ DESIGNS.md §3). No runtime font CDNs.
- **Testing:** Vitest (§11). **Rate limiting:** sliding-window log in Postgres (§12).
- **Deployment target (v1):** single Node host (or Docker) + managed Postgres; images local disk → S3-compatible later.

### Why these choices (brief)

| Concern | Choice | Why |
|---|---|---|
| Next 16 | LTS, monthly security patches, Turbopack default, App Router/RSC first | Current supported line; v15 EOL Oct 2026 |
| Prisma 7 | Current major; **no Rust query engine** → kills the Windows `ECONNRESET` postinstall trap | v6 rejected: engine binaries + EOL trajectory; migration unavoidable later |
| next-auth v5 (beta.32, pinned) | Mission mandates Auth.js; v5 = App Router-native; beta.32 carries the July 2026 GHSA-8fpg-xm3f-6cx3 fail-open fix | v4 (`latest` 4.24.15) is LTS but not App-Router-first; **never auto-upgrade the beta tag** — bumps are deliberate, with advisory review |
| next-intl | App-Router-native, RSC support, built-in locale routing/detection, ICU, ~9M weekly DL, maintained v4.14.9 | Alternatives (next-i18next, lingui, paraglide): heavier or weaker RSC/routing story |
| Tailwind v4 | Ships with create-next-app 16; CSS-first tokens fit the DESIGN.md palette | — |

## 2. Data model (Prisma schema v1 — complete, shipped in M0)

M0 creates **the full v1 schema in one migration** (`prisma/schema.prisma` + initial
migration). Rationale: later milestones then add features, not tables; the reviewer sees
the whole data model once; avoids mid-loop drift. Cost: larger initial file — accepted.

Conventions: `cuid()` ids; `createdAt/updatedAt`; tables mapped to snake_case plurals via
`@@map`; Auth.js model names kept canonical (`User`/`Account`/`Session`/`VerificationToken`).
Relations use explicit `onDelete` behavior. Indexes listed per model. `CHECK` constraints
(ratings 1–5, non-negative prices) are appended to the generated init migration SQL before
first apply (Prisma schema cannot express them; this is legitimate pre-apply editing).

### Enums

`Role { MEMBER, ADMIN }` · `UserStatus { ACTIVE, SUSPENDED, BANNED }` ·
`ListingType { SELL, SWAP, FREE }` · `BookCondition { NEW, LIKE_NEW, GOOD, ACCEPTABLE, WORN }` ·
`ListingStatus { ACTIVE, RESERVED, COMPLETED, CANCELLED }` ·
`ListVisibility { PUBLIC, PRIVATE, UNLISTED }` ·
`ActivityType { LISTING_CREATED, LISTING_COMPLETED, REVIEW_POSTED, BOOK_SHELVED, FOLLOWED_USER, WISHLIST_ADDED, EXCHANGE_COMPLETED }` ·
`ExchangeStatus { PROPOSED, ACCEPTED, DECLINED, CANCELLED, COMPLETED }` ·
`ReportTarget { USER, LISTING, REVIEW, COMMENT, MESSAGE }` ·
`ReportReason { SPAM, INAPPROPRIATE, SCAM, HARASSMENT, COPYRIGHT, OTHER }` ·
`ReportStatus { OPEN, REVIEWING, RESOLVED, DISMISSED }` ·
`ReadingProgress { WANT, READING, READ }` — used on ReadingListItem for per-user progress.

### Models (27)

**Auth (canonical, Auth.js Prisma adapter)**
1. `User` — `id`, `name?`, `email @unique`, `emailVerified?`, `image?`, `username @unique`
   (citext-like: normalized lowercase app-side), `passwordHash?` (null for OAuth-only),
   `role Role @default(MEMBER)`, `status UserStatus @default(ACTIVE)`, `createdAt`, `updatedAt`.
   Indexes: `@@index([status])`. Relations: accounts, sessions, profile, listings, reviews…
2. `Account` — Auth.js canonical. `userId` FK → User, `onDelete: Cascade`.
   `@@unique([provider, providerAccountId])`, `@@index([userId])`.
3. `Session` — Auth.js canonical (unused under JWT strategy; kept for adapter compatibility).
   `sessionToken @unique`, FK → User cascade, `@@index([userId])`.
4. `VerificationToken` — Auth.js canonical. `@@unique([identifier, token])`.

**Profile & social**
5. `Profile` — `id`, `userId @unique` FK → User cascade, `displayName?`, `bio?`,
   `location?`, `website?`, `locale String @default("ar")` (preferred locale),
   `reputationScore Int @default(0)` (denormalized 0–100, recomputed from ExchangeRating
   transactionally), `createdAt`, `updatedAt`.
6. `Follow` — `followerId`, `followingId` FKs → User cascade.
   `@@unique([followerId, followingId])`; `@@index([followingId, createdAt])`;
   self-follow rejected app-side + noted for DB CHECK (appended to init migration).
7. `ActivityEvent` — `id`, `actorId` FK → User cascade, `type ActivityType`,
   `entityType? String`, `entityId? String`, `createdAt`.
   `@@index([actorId, createdAt(sort: Desc)])`, `@@index([createdAt(sort: Desc)])`.
   Feed = recent events from followed actors + own; no fanout table in v1.

**Books catalog**
8. `Book` — `id`, `isbn13? @unique`, `isbn10?`, `title`, `titleAr?`, `subtitle?`,
   `description? @db.Text`, `publisher?`, `publishedYear Int?`, `language String @default("ar")`
   (ISO 639-1), `pageCount Int?`, `coverUrl?`, `openLibraryKey? @unique`,
   `subjects String[] @default([])`, `createdById?` FK → User setNull, `createdAt`, `updatedAt`.
   Indexes: `@@index([title])`, plus `pg_trgm` GIN index on `title` appended to init
   migration for M2 search (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`).
9. `Author` — `id`, `name`, `nameAr?`, `openLibraryKey? @unique`, `createdAt`. `@@index([name])`.
10. `BookAuthor` — `bookId`, `authorId`, `order Int @default(0)`;
    `@@unique([bookId, authorId])`, `@@index([authorId])`. M2M Book↔Author.

**Listings & wishlist**
11. `Listing` — `id`, `bookId` FK → Book cascade, `sellerId` FK → User cascade,
    `type ListingType`, `condition BookCondition`, `priceCents Int?` (SELL only — app +
    CHECK validates non-null when SELL), `currency String @default("EGP")`
    (default Egyptian pound; per-listing override; no FX in v1), `status ListingStatus @default(ACTIVE)`,
    `description? @db.Text`, `images String[] @default([])` (ImageStore URLs, max 6),
    `location?`, `meetupOptions?`, `createdAt`, `updatedAt`, `completedAt?`.
    Indexes: `@@index([bookId, status])`, `@@index([sellerId, status, createdAt(sort: Desc)])`,
    `@@index([status, createdAt(sort: Desc)])`, `@@index([type, status])`.
12. `WishlistItem` — `userId`, `bookId`; `@@unique([userId, bookId])`, `@@index([bookId])`.

**Reviews & engagement**
13. `Rating` — `userId`, `bookId`, `value Int` (1–5, CHECK in migration),
    `@@unique([userId, bookId])`, `@@index([bookId])`.
14. `Review` — `id`, `userId`, `bookId`, `title?`, `body @db.Text`,
    `containsSpoiler Boolean @default(false)`, `language String?`,
    `createdAt`, `updatedAt`; `@@unique([userId, bookId])`;
    `@@index([bookId, createdAt(sort: Desc)])`, `@@index([userId, createdAt(sort: Desc)])`.
15. `Comment` — `id`, `userId` FK cascade, `bookId` FK → Book cascade (always set),
    `reviewId?` FK → Review cascade (attachment to a review thread on the same page),
    `parentId?` self-FK (thread), `body @db.Text`, `containsSpoiler Boolean @default(false)`,
    `deletedAt?` (soft delete; keeps thread shape), `createdAt`, `updatedAt`.
    Indexes: `@@index([bookId, createdAt])`, `@@index([reviewId, createdAt])`, `@@index([parentId])`.
16. `ReviewLike` — `userId`, `reviewId`; `@@unique([userId, reviewId])`, `@@index([reviewId])`.
17. `CommentLike` — `userId`, `commentId`; `@@unique([userId, commentId])`, `@@index([commentId])`.
    (Separate tables instead of polymorphic likes → real FKs + cascades.)

**Reading lists**
18. `ReadingList` — `id`, `userId` FK cascade, `title`, `description? @db.Text`,
    `visibility ListVisibility @default(PUBLIC)`, `isDefault Boolean @default(false)`,
    `createdAt`, `updatedAt`. `@@index([userId])`, `@@index([visibility, createdAt(sort: Desc)])`.
19. `ReadingListItem` — `id`, `listId` FK → ReadingList cascade, `bookId` FK → Book cascade,
    `note?`, `order Int @default(0)`, `progress ReadingProgress @default(WANT)`.
    `@@unique([listId, bookId])`, `@@index([bookId])`.

**Messaging & exchanges**
20. `Conversation` — `id`, `listingId?` FK → Listing setNull (when started from a listing),
    `subject?`, `lastMessageAt?` (denormalized for inbox ordering), `createdAt`.
    `@@index([lastMessageAt(sort: Desc)])`.
21. `ConversationParticipant` — `conversationId` FK → Conversation cascade, `userId` FK cascade,
    `lastReadAt?` (unread = messages after this), `joinedAt`.
    `@@unique([conversationId, userId])`, `@@index([userId])`.
22. `Message` — `id`, `conversationId` FK cascade, `senderId` FK → User cascade,
    `body @db.Text`, `attachments String[] @default([])`, `createdAt`.
    `@@index([conversationId, createdAt])`, `@@index([senderId])`.
23. `Exchange` — `id`, `listingId @unique` FK → Listing (one exchange per listing in v1),
    `initiatorId` (buyer/requester) FK → User, `counterpartId` (seller) FK → User,
    `status ExchangeStatus @default(PROPOSED)`, `agreedTerms? @db.Text`,
    `createdAt`, `updatedAt`, `completedAt?`.
    `@@index([initiatorId, status])`, `@@index([counterpartId, status])`, `@@index([status, updatedAt])`.
    Completing an Exchange flips Listing → COMPLETED and writes ActivityEvent(s) + both ExchangeRating rows.
24. `ExchangeRating` — `id`, `exchangeId` FK → Exchange cascade, `raterId` FK → User,
    `ratedUserId` FK → User, `score Int` (1–5, CHECK), `tags String[] @default([])`
    (e.g. `punctual`, `accurate_description`, `friendly`), `comment?`, `createdAt`.
    `@@unique([exchangeId, raterId])` (mutual = two rows), `@@index([ratedUserId])`.
    `Profile.reputationScore` recomputed (avg of score ×10 → 0–50… — formula: `round(avg*20)` → 0–100)
    inside the same transaction.

**Reports & admin**
25. `Report` — `id`, `reporterId` FK → User, `targetType ReportTarget`, `targetId String`
    (polymorphic, no FK by design — target may be deleted; admin UI resolves by type),
    `reason ReportReason`, `details? @db.Text`, `status ReportStatus @default(OPEN)`,
    `resolvedById?` FK → User setNull, `resolution?`, `createdAt`, `updatedAt`, `resolvedAt?`.
    `@@index([status, createdAt])`, `@@index([targetType, targetId])`, `@@index([reporterId])`.
26. `AdminAction` — `id`, `adminId` FK → User, `action String` (e.g. `resolve_report`,
    `suspend_user`, `remove_listing`), `targetType String?`, `targetId String?`,
    `meta Json?`, `createdAt`. `@@index([adminId, createdAt(sort: Desc)])`, `@@index([createdAt(sort: Desc)])`.
    Audit trail for moderation accountability.
27. `RateLimitEvent` — `id`, `key String` (scoped, e.g. `signin:ip:203.0.113.7`,
    `signin:email:a@b.c`, `msg:send:<userId>`, `report:create:<userId>`,
    `listing:create:<userId>`, `review:create:<userId>`), `createdAt`.
    `@@index([key, createdAt])`. Sliding-window log — see §12.

### Integrity notes

- Checks appended to init migration: `ratings.value BETWEEN 1 AND 5`,
  `exchange_ratings.score BETWEEN 1 AND 5`, `listings.price_cents IS NULL OR >= 0`,
  `listings.currency ~ '^[A-Z]{3}$'`, `follows` no self-follow (`follower_id <> following_id`).
- `pg_trgm` extension + GIN index on lower(`books.title`) for M2 search.
- Global password omission: Prisma client `omit: { user: { passwordHash: true } }` in `lib/prisma.ts`.
- Cascades: user deletion cascades to owned content (listings, reviews…) — v1 hard delete is
  admin-only and rare; soft semantics for comments via `deletedAt`.

## 3. Prisma 7 — pinned setup (read before touching the schema)

- Target **Prisma v7 only**. `prisma@^7` + `@prisma/client@^7` + `@prisma/adapter-pg@^7` +
  `pg` + `dotenv`. Never install v6/v5. Never mix.
- v7 changes that bite (all encoded in M0):
  - Generator: `generator client { provider = "prisma-client" output = "../generated/prisma" }`
    (explicit output REQUIRED). Import from `@/generated/prisma/client`
    (NOT `@prisma/client`). `generated/` is gitignored; `postinstall` runs `prisma generate`.
  - **Driver adapter required**: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`.
    No adapter → `PrismaClientInitializationError: engine type "client" requires adapter`.
    No Rust query engine → the classic Windows postinstall `ECONNRESET` engine-download trap is gone,
    but the **schema engine** (migrations) is still a native binary → keep the mirror fallback (§15).
  - `prisma.config.ts` at repo root: `import "dotenv/config"; import { defineConfig, env } from "prisma/config";
    export default defineConfig({ schema: "prisma/schema.prisma", datasource: { url: env("DATABASE_URL") } });`
    v7 does **not** auto-load `.env` → the `dotenv/config` import is mandatory.
  - ESM-first packages; Node ≥ 20.19 (we require ≥ 22). TS 5.4+ (we use 5.9.x).
  - Seed is NOT wired via `prisma db seed`; use `npm run db:seed` → `tsx prisma/seed.ts`.
  - CLI: `npx prisma migrate dev --name init` (dev), `npx prisma migrate deploy` (prod/CI).
- If any Prisma answer in this repo contradicts v7 docs, **v7 docs win** — flag to architect.

## 4. Auth strategy (Auth.js v5)

- Packages (exact): `next-auth@5.0.0-beta.32`, `@auth/prisma-adapter@2.11.3`
  (pins fixed `@auth/core@0.41.3`, July 2026). `bcryptjs` (pure JS — no native build on Windows).
- **Split config (mandatory):**
  - `auth.config.ts` — edge/proxy-safe: `pages`, `callbacks.authorized({ auth, request })`,
    `session: { strategy: "jwt", maxAge: 30d }`, `providers: []`. **No Prisma import here.**
  - `auth.ts` — full: `adapter: PrismaAdapter(prisma)`, Credentials provider (+ Google if env set), spreads `auth.config.ts`.
  - `proxy.ts` imports only `auth.config.ts` (via a lazy `NextAuth(authConfig).auth`) — keeps the locale proxy free of DB.
    (In Next 16 **the proxy file replaces middleware.ts**; runtime is `nodejs`, filename `proxy.ts`, export named `proxy` or default. `middleware.ts` is deprecated.)
- **JWT session strategy is REQUIRED** — the Credentials provider does not support database
  sessions. `Session` table stays for adapter compat only. This is the #1 Auth.js v5 breakage;
  the contract lists it as an invariant.
- **Credentials**: `authorize()` lowercases email → `prisma.user.findUnique({ where: { email } })`
  → `bcrypt.compare` → require `status === 'ACTIVE'` → return `{ id, email, name, image, role }`.
  Sign-in/register rate-limited: 5 attempts / 5 min per (IP) and per (email) — sliding window (§12).
- **Google (optional, env-driven)**: included in `auth.ts` only when both
  `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; otherwise the provider is omitted
  entirely (no dead button). Google sign-ups create User+Profile via adapter; `passwordHash` stays null.
- `session`/`jwt` callbacks: put `user.id` and `user.role` in the token (first call only,
  `trigger === "signIn"`), expose them on `session.user`. `AUTH_SECRET` required (`.env.example`);
  generate with `npx auth secret`.
- Route handler: `app/api/auth/[...nextauth]/route.ts` → `export const { GET, POST } = handlers`.
- Pages: `/[locale]/sign-in`, `/[locale]/sign-up` (server action `signUp` + `signIn`).
  `pages: { signIn: "/sign-in" }` — proxy prefixes with locale. Unauthenticated hits to
  protected pages redirect to `/sign-in?callbackUrl=…`.
- Register rules: zod-validated (`email`, `username` 3–24 `[a-z0-9_]`, `password` ≥ 8 with
  letter+number, `displayName`), bcrypt cost **12**, unique email/username → 409-style inline error;
  creates `User` + `Profile` in one transaction; seeds email-verified out of scope (no mailer in v1;
  OAuth covers verified emails; password users verified lazily — documented).
- Never expose `passwordHash`: Prisma `omit` (§2) + `server-only` import in auth modules.
- CSRF: Auth.js built-in on its routes; server actions validate origin implicitly (Next) — keep actions POST-only.
- **Risk register**: Auth.js v5 is beta; maintenance moved to Better Auth (Sept 2025), Vercel
  acquired Better Auth (July 2026); July 2026 advisory fixed in beta.32. Mitigations: exact pins,
  no blind upgrades, advisory check before any bump, reassess at M6 (migrate vs stay). Pinning is
  deliberate — do NOT `npm update` the auth line.

## 5. Open Library (ISBN lookup) — server-side only

- Endpoint: `https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&jscmd=data&format=json`
  — **`jscmd=data` (NOT `viewapi`, which omits title/authors)**. Response `ISBN:<isbn>` key →
  `{ title, subtitle, authors[], publishers[], publish_date, number_of_pages, cover, subjects[], url }`.
- Covers: `https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg?default=false` — `?default=false`
  returns **404 when missing** (vs. a blank 1×1 GIF), letting us fall back to a CSS-drawn cover.
  Use `-M.jpg` for list grids, `-L.jpg` for book pages.
- Rules: server-only module (`lib/openlibrary.ts`, `import 'server-only'`); `User-Agent:
  BookshelfExchange/1.0 (github.com/Ahmadkhayatt/books-project)`; `AbortController` 5 s timeout;
  **never** call OL from the client; on 429 → single 2 s back-off retry → graceful manual-entry path;
  on 404/timeout → "book not found — enter details manually".
- **Caching**: fetches use `next: { revalidate: 2592000 }` (30 d); fields are persisted onto the
  `Book` row at creation (ISBN dedupe via unique `isbn13`) so OL is not re-hit for existing books.
  In-flight request memoization (`Map`) prevents parallel stampedes for the same ISBN.
- Rate limits: Open Library enforces unspecified throttling (shared infrastructure) — treat as
  "low": cache aggressively, batch nothing, no crawling. Documented in code comments.
- ISBN hygiene: `lib/isbn.ts` strips hyphens/spaces, validates ISBN-10 & ISBN-13 checksums,
  prefers ISBN-13, stores both when derivable. Used by seed + add-book flow.

## 6. docker-compose (PostgreSQL) — exact contract

```yaml
name: bookshelf-exchange
services:
  postgres:
    image: postgres:17-alpine
    container_name: bookshelf_exchange_pg
    environment:
      POSTGRES_USER: bookshelf
      POSTGRES_PASSWORD: bookshelf        # dev-only; documented in .env.example
      POSTGRES_DB: bookshelf_exchange
    ports:
      - "127.0.0.1:5433:5432"             # host 5433 → hijack-proof; container stays 5432
    volumes:
      - bookshelf_exchange_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bookshelf -d bookshelf_exchange"]
      interval: 5s
      timeout: 3s
      retries: 12
    restart: unless-stopped
volumes:
  bookshelf_exchange_pgdata:
```

- Host-side `DATABASE_URL` (in `.env`): `postgresql://bookshelf:bookshelf@localhost:5433/bookshelf_exchange?schema=public`
- If the app itself is containerized later, it uses `postgres:5432` (same network) — documented, not used in dev.
- **Migrations are never in docker build steps** — DB lifecycle is host-side npm scripts.
- `.env.example` documents every variable (see contract §Data & API shapes). `.gitignore` covers
  `.env`, `.env.local`, `.env.*` **with `!.env.example` after them**, `node_modules`, `.next`,
  `generated/`, `public/uploads/*` (keep `.gitkeep`), `*.tsbuildinfo`, `.DS_Store`.
- Volume lifecycle: `docker compose down` keeps data; `docker compose down -v` wipes it
  (compose down removes nothing else; volume is named exactly `bookshelf_exchange_pgdata`).
- Native Windows PostgreSQL service hijacking 5432 is **irrelevant** — we use 5433; do not
  "fix" compose to 5432. If 5433 is also busy: change host side only, never container side.

## 7. Image uploads — S3-compatible shape, local first

- `lib/images/store.ts`: `interface ImageStore { put(buf, meta): Promise<{ key, url }>; delete(key): Promise<void>; }`
- `lib/images/local.ts` — `LocalDiskImageStore` (dev default, `IMAGE_STORE=local`):
  writes `public/uploads/<yyyy>/<mm>/<uuid>.webp`; `sharp` → max 1600 px longest edge, re-encode
  WebP q80 (strips EXIF), returns `/uploads/...` URL. `public/uploads/` gitignored except `.gitkeep`.
- `lib/images/s3.ts` — `S3ImageStore` (lands in M2 with listing photos): S3-compatible
  (AWS S3 / Cloudflare R2 / MinIO) via `@aws-sdk/client-s3`; env: `IMAGE_STORE=s3`,
  `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE`.
- Upload rules (all milestones): magic-byte sniff (JPEG/PNG/WebP only), ≤ 5 MB, ≤ 1600 px after
  resize, random keys (no user filenames), auth required, per-user quota (60 files) enforced
  in the action, EXIF stripped. `next/image` remotePatterns: `covers.openlibrary.org` (books),
  S3 public base URL (uploads in prod) — never `images.domains` (deprecated); local `/uploads/*`
  needs no config.

## 8. i18n / RTL strategy — Arabic first, server-side RTL

- **next-intl v4.14.9** (chosen, justified §1). Config:
  - `i18n/routing.ts` — `defineRouting({ locales: ['ar', 'en'], defaultLocale: 'ar', localePrefix: 'always' })`
  - `i18n/request.ts` — `getRequestConfig` loads `messages/<locale>.json`
  - `proxy.ts` (root) — next-intl middleware: locale detection (cookie `NEXT_LOCALE` →
    `Accept-Language` → default `ar`), sets no caching headers; matcher excludes
    `api|_next|_vercel|.*\\..*` (per v4 guidance). In Next 16 this file is `proxy.ts`;
    **do not** create `middleware.ts`.
  - `app/[locale]/layout.tsx` — `const { locale } = await params` (Next 16 async APIs!);
    `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>` — **dir is set server-side in the
    root layout, never client-side**; `generateStaticParams()` returns ar/en; `setRequestLocale`/
    static rendering per next-intl docs.
- **RTL from day one (not a flip pass at the end):**
  - Logical CSS properties only: `margin-inline-*`, `padding-inline-*`, `inset-inline-*`,
    `border-inline-*`, `text-align: start/end`, `start`/`end` in flex/grid. **No `left`/`right` in CSS.**
    Tailwind: use `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `rounded-s-*`.
  - Swapped-direction strings: wrap ISBNs, URLs, emails, Latin usernames, `@handles`, and mixed
    Arabic+Latin in `<bdi>` or `dir="auto"`; standalone Latin data uses `dir="ltr"`.
  - Icons: directional icons flip automatically under RTL via `[dir="rtl"] .icon-flip { transform: scaleX(-1) }`
    — flip: arrows, chevrons, back/forward, reply, undo, "next/previous", external-link is NOT flipped.
    Never flip: logo/wordmark, book/star/heart/bookmark/search/menu/close/check, cover art.
  - Numbers/dates: `Intl.NumberFormat('ar')` → Eastern Arabic-Indic digits (٠١٢٣…) in Arabic prose;
    ISBNs/catalog IDs always Latin digits inside `dir="ltr"`. Dates: `Intl.DateTimeFormat('ar', …)`.
  - Arabic typesetting: **never** `letter-spacing` on Arabic; Arabic body gets `line-height ≥ 1.8`;
    `:lang(ar) body { font-size: 1.08em }` (Arabic glyphs sit smaller at equal px size).
- **Real Arabic copy, always** — `messages/ar.json` is written in Modern Standard Arabic
  (warm, bookish tone, e.g. hero: «حيثُ تجدُ القِصّةُ قارئَها التالي»), `messages/en.json` its
  mirror. No lorem/placeholder. CI runs `npm run i18n:check` (scripts/check-i18n.mjs): asserts
  identical key sets + non-empty values + `dir="auto"` audit for known-dangerous keys.
  Missing keys throw at build (next-intl) — never silent.
- **Layout/icon/spacing feel native in RTL**: paddings symmetric via logical props; covers keep
  2:3 geometry; ledger rows align `text-align: start`; stamps/seals rotate the same in both
  directions; wordmark renders `تبادل الكتب` / `Bookshelf Exchange` per locale.
- hreflang: `alternates.languages` metadata (`/ar`, `/en`, `x-default` → `/ar`) on all pages.
- Root `/` → permanent redirect to `/ar` (via proxy matcher covering `/`).
- Arabic QA: every milestone's checklist includes an `/ar` screenshot pass; no LTR-only screens merged.

## 9. Page map (v1) & milestone delivery

All URLs are locale-prefixed. Legend: auth = sign-in required.

| URL | Purpose | Milestone |
|---|---|---|
| `/` → `/ar` (redirect) | locale redirect | M0 |
| `/[locale]` | Home shell: typographic hero, "shelved recently" index, CTA | M0 |
| `/[locale]/sign-in` · `/sign-up` | Auth | M0 |
| `/[locale]/books` | Catalog browse + search/filter sidebar | M1 → filters M2 |
| `/[locale]/books/[id]` | Book page: cover, buy/swap listings summary, rating breakdown, reviews, comments, wishlist btn | M1 |
| `/[locale]/books/new` | Add by ISBN (OL lookup) or manual | M1 |
| `/[locale]/listings` | All listings (sell/swap/free), filter/search | M2 |
| `/[locale]/listings/[id]` | Listing detail + "message seller" | M2 (detail) / M4 (conversation) |
| `/[locale]/listings/new` · `/[locale]/listings/[id]/edit` | Listing CRUD, photos | M2 |
| `/[locale]/wishlist` | My wishlist (auth) | M2 |
| `/[locale]/u/[username]` | Public profile: shelves, reputation, listings, follow btn | M3 |
| `/[locale]/settings` | Profile, password, locale pref, delete/suspend self-request | M3 |
| `/[locale]/lists` · `/[locale]/lists/[id]` | My reading lists; list detail + items + progress | M3 |
| `/[locale]/feed` | Activity feed (followed actors) | M3 |
| `/[locale]/messages` · `/[locale]/messages/[conversationId]` | Inbox; thread (polling 5 s in v1, no sockets) | M4 |
| `/[locale]/exchanges` · `/[locale]/exchanges/[id]` | My exchanges; exchange detail → complete → mutual ratings | M4 |
| `/[locale]/admin` · `/[locale]/admin/reports` · `/[locale]/admin/users` | Admin dashboard, report queue, user actions | M5 |
| `/[locale]/about` | Colophon/about (design statement) | M6 |
| `/api/auth/[...nextauth]` | Auth.js | M0 |
| `/api/health` | `{ ok, db, version }` | M0 |
| report flow | "Report" affordance on listing/review/comment/user → dialog | M5 |

Not-found: `app/[locale]/not-found.tsx` (bilingual per locale). Error: `app/[locale]/error.tsx`,
`loading.tsx` at segment level — skeleton bars per DESIGN.md.

## 10. Milestones (order fixed; each leaves app buildable + lint-clean)

| # | Milestone — summary | Exit criteria (all must pass) |
|---|---|---|
| **M0** | **Scaffold & foundation** — git hygiene, compose Postgres, Next 16+TS+Tailwind v4, `[locale]` routing (ar default, server-side RTL), fonts, Auth.js v5 (split config, JWT, Credentials+Google env), Prisma v1 full schema + init migration, `.env.example`/`.gitignore`, home shell in both locales | `docker compose ps` healthy; `migrate dev` clean on empty DB; build green; `/ar` renders `dir=rtl lang=ar`, `/en` `dir=ltr lang=en`; sign-up→sign-in round-trip works against compose PG; `npm run lint`/`test` clean; PR open from `feat/m0-scaffold` |
| **M1** | **Catalog & book page** — add-book via ISBN (OL, cached, graceful manual fallback), catalog browse, book detail page: rating breakdown (1–5 histogram), one review per user (spoiler toggle), threaded comments (soft delete), likes | Add real ISBN → record persisted with OL data + cover; review/comment/like round-trip; aggregates (avg, count, breakdown) consistent; empty/loading/error states on book page; `/ar` + `/en` both screenshot-clean |
| **M2** | **Listings & wishlist & search** — sell/swap/free listings w/ photos (LocalDisk), condition, list/detail/CRUD, wishlist toggle + page, search + filters (q, type, condition, price, sort), trigram title search | Photos upload (magic bytes, EXIF stripped, ≤5 MB); filters+search O(indexed); wishlist persists; listing lifecycle ACTIVE→RESERVED→COMPLETED wired (completion itself in M4); images survive restart (volume or public/ gitkeep strategy) |
| **M3** | **Profiles, follows, reading lists, activity feed** — public profile (reputation display), follow/unfollow, lists CRUD + items + progress, activity events on actions, feed page | Follow updates feed immediately; lists reorder; private lists 404 for strangers; profile shows listing history + reputation; RTL pass |
| **M4** | **Messaging & exchanges** — conversation from listing (both participants, lastReadAt unread badges), 5 s polling thread (no WebSockets), exchange lifecycle PROPOSED→ACCEPTED→(COMPLETED/DECLINED/CANCELLED), listing flips COMPLETED, mutual `ExchangeRating`, `Profile.reputationScore` recompute in same transaction | Full E2E manually: buyer messages seller → accepts → completes → both rate → reputation updates atomically; no orphan messages on declined exchange; unread badge correct; concurrency-safe completion (transaction + status guard) |
| **M5** | **Reports, admin panel, rate-limit hardening** — report dialog (all targets), admin queue (open/review/resolve), suspend/ban users, remove content, `AdminAction` audit rows, rate limits on auth/messages/reports/listings/reviews enforced | Admin-only guard (role check server-side + proxy); report→resolve flow end-to-end; rate-limit returns 429 + `Retry-After`; suspended user blocked at sign-in & action layer; audit rows written |
| **M6** | **Seed, tests, README, bilingual/mobile QA** — full realistic seed (ar+en, §14), Vitest suite green, all empty/loading/error states audited, README (setup, compose, scripts, deploy note), SEO/hreflang/sitemap, a11y audit, perf pass, final `/ar`+`/en` mobile QA both locales | `npm run db:seed` idempotent (2 runs = same counts); `npm test` green; every page has purposeful empty/loading/error; README clone→run works on clean machine (documented); Lighthouse a11y ≥ 95; PR merged or ready |

Dependency note: M2 depends on M1 (books), M3 on M0/M1, M4 on M2 (listings), M5 on all, M6 closes.

## 11. Testing strategy — **Vitest** (chosen)

- **Vitest** with `environment: 'node'` for units; `jsdom` + `@testing-library/react` for the
  few component tests (header, cover, states). Justification: native ESM + TS, zero-config with
  Next 16's TS setup, fast watch, compatible API with Jest (low learning curve), excellent CI
  ergonomics; `node:test` lacks watch/assertion ergonomics and RTL support; Playwright is E2E
  (browsers + flake + CI weight) — **deferred past v1** unless M6 has slack, then smoke only.
- Coverage targets (M6): `lib/isbn.ts`, `lib/rate-limit.ts`, Open Library mappers,
  reputation recompute, action validators (zod schemas) — 80%+ on `lib/`; no DB in unit tests
  (Prisma mocked/faked at module boundary); seed idempotency verified by double-run.
- `npm test` = `vitest run`; `npm run test:watch`. CI: `.github/workflows/ci.yml` —
  Node 22, `npm ci`, `prisma generate`, `lint`, `test`, `build` (no DB needed for build;
  pages are dynamic or font-fetch only).

## 12. Rate limiting — sliding window in Postgres

- Model `RateLimitEvent { key, createdAt }` (§2 #27). No Redis in v1 — single-node dev/prod,
  correctness first; swap path documented (Upstash/Redis behind the same `checkRateLimit()` signature).
- `lib/rate-limit.ts` → `checkRateLimit(key, { limit, windowSeconds })`:
  1. `DELETE … WHERE key = ? AND createdAt < now() - interval '48 hours'` (opportunistic prune, 1-in-50 calls);
  2. `SELECT count(*) … WHERE key = ? AND createdAt > now() - window`;
  3. if ≥ limit → `{ ok: false, retryAfter }` (no insert); else `INSERT` event, return remaining.
  Transactional (`Serializable` not needed; single round of count+insert under default isolation is acceptable for v1 — documented).
- Keys: `signin:ip:<ip>`, `signin:email:<email>`, `signup:ip:<ip>`, `msg:send:<userId>` (30/min),
  `report:create:<userId>` (10/h), `listing:create:<userId>` (20/day), `review:create:<userId>` (30/day),
  `isbn:lookup:<userId>` (60/min, protects OL). Limits in `lib/rate-limit.ts` constants.
- Enforcement: M0 → sign-in/sign-up; M1 → isbn lookup; M2 → listings; M4 → messages; M5 → full audit + 429 UX.

## 13. Folder structure (target after M0)

```
books-project/
  app/[locale]/{layout,page,loading,error,not-found}.tsx
  app/[locale]/{sign-in,sign-up}/page.tsx
  app/api/auth/[...nextauth]/route.ts   app/api/health/route.ts
  auth.ts  auth.config.ts  proxy.ts     next.config.ts  next-env.d.ts (generated)
  components/{site-header,site-footer,locale-switcher,book-cover,leader-row}.tsx
  i18n/{routing,request}.ts             messages/{ar,en}.json
  lib/{prisma,rate-limit,utils}.ts  lib/images/{store,local}.ts
  prisma/{schema.prisma, seed.ts, migrations/0000_init/}
  generated/prisma/                     (gitignored)
  public/uploads/.gitkeep               (uploads gitignored)
  scripts/check-i18n.mjs                docker-compose.yml
  .env.example  .gitignore  .gitattributes  eslint.config.mjs  package.json …
```

## 14. Seed strategy — `npm run db:seed` (idempotent, no network)

`tsx prisma/seed.ts`; upserts keyed by stable natural keys (`username`, `isbn13`); run twice →
same counts (verified by assertions printed at end). Content (Arabic + English, realistic,
no real private data):
- **24 books**: real public-domain/classic editions (Arabic: Mahfouz, Taha Hussein, Gibran;
  English: Austen, Orwell, Fitzgerald, Melville, Dostoevsky, One Hundred Years…) + 6 modern
  fiction/nonfiction. ISBNs are checksum-valid (hand-fixed); OL links may 404 — **seed never
  requires network**. Mixed `language`: ar/en. Some with `titleAr` both ways.
- **8 authors** (نجيب محفوظ, طه حسين, جبران خليل جبران, Jane Austen, George Orwell, F. Scott Fitzgerald,
  Herman Melville, Gabriel García Márquez).
- **6 users** (Arabic display names + latin usernames): `ahmad`, `sara`, `layla`, `omar`, `yusuf`, `mariam`;
  password `demo1234` (documented dev-only); 1 ADMIN (`admin`) for M5.
- **Listings** (~30): mixed SELL/SWAP/FREE, all conditions/statuses, prices in EGP; Arabic descriptions.
- **Ratings/reviews** (~40 ratings, ~18 reviews, ar+en bodies), **comments** (~30, 2 threads), **likes** (~60).
- **Wishlists** (~20), **reading lists** (`أقرأ الآن`, `Read next`, private list), **activity events** (~50).
- **Messaging** (2 conversations w/ realistic Arabic dialog), **1 completed exchange + 2 mutual
  ExchangeRatings** (reputation 40/45 → profiles show it), **2 OPEN reports** for M5.
- Image URLs: CSS-drawn covers (no external deps) — `coverUrl = null` for all seeded books;
  OL cover fetched on first real add in M1.
- Guards: refuses to run when `DATABASE_URL` lacks `localhost`/`127.0.0.1` unless
  `ALLOW_SEED_REMOTE=1`; wipes only rows it owns (upsert-by-key style), never `TRUNCATE` blindly.

## 15. Risks & decisions log

| # | Risk / decision | Mitigation |
|---|---|---|
| R1 | Auth.js v5 beta instability; ownership moved to Better Auth; **async request APIs** in Next 16 (`params` is a Promise — `await params` everywhere) | Exact pins; advisory review on bump; reassess M6; contract lists "await params" as invariant |
| R2 | Prisma 7 newness / thin StackOverflow corpus | v7-only docs; pinned; engine mirror fallback below; no experimental flags |
| R3 | Windows dev box: engine `ECONNRESET`, port 5432 hijack, `ignorecase=true` git | `PRISMA_ENGINES_MIRROR`/`PRISMA_BINARIES_MIRROR` (e.g. `https://registry.npmmirror.com/-/binary/prisma`) + retry; port **5433**; lowercase-hyphenated filenames; `git ls-files` case-collision check pre-commit; `.gitattributes` `* text=auto eol=lf`; UTF-8 no BOM |
| R4 | Open Library outages/limits | Server-side cache 30 d, timeout+degrade, DB persistence, manual entry path, per-user lookup cap |
| R5 | OL cover licensing (user-contributed) | Show-for-identification + takedown via report flow; CSS cover fallback always available |
| R6 | Messaging scope creep (typing indicators, read receipts, push) | v1: polling + unread badges only; no WS; revisit post-v1 |
| R7 | RTL regressions slipping in | `rtl:` screenshot checklist per PR; logical properties enforced by reviewer; `check-i18n.mjs` in CI |
| R8 | Seed produces identical rows on re-run | Upsert by natural keys; double-run assertion; guard against non-local DB |
| R9 | `.env` leakage | `.gitignore` `!.env.example` ordering verified; secret scan in review; `.env` documented local-only |
| R10 | Single Postgres node — search perf at scale | Trigram index M2; OK to ~10⁵ books; revisit (tsvector/meilisearch) post-v1 |
| R11 | Next 16 `proxy.ts` (ex-middleware) — team muscle memory writes `middleware.ts` | Contract calls it out; reviewer rejects `middleware.ts` |
| R12 | EGP default currency surprises non-Egyptian users | Per-listing `currency` override; documented; no FX pretending |

**Decisions locked**: Next 16.4.3 · Prisma 7 + adapter-pg (no v6) · next-intl · Tailwind v4 ·
npm only · Postgres 17 @ 5433 (`bookshelf_exchange_pg` / `bookshelf_exchange_pgdata`) ·
Vitest · sliding-window DB rate limit · JWT sessions · local images → S3-compatible later ·
naming **Bookshelf Exchange / تبادل الكتب**.

## 16. Open questions (non-blocking; resolve in review)

1. Default currency per-deployment env (`DEFAULT_CURRENCY`, falls back EGP) — M2.
2. Email verification enforcement timing — proposal: soft (banner) now, hard requirement before
   listing creation at M5/M6.
3. `exchange_count` denormalization on Profile — currently computed; add column only if M6 perf says so.
