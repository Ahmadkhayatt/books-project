# Milestone 2 (M2) — Listings + Wishlist + Search/Filters — Contract

Source: `PLAN.md` §5 (M2 row), §7 (images), §9 (page map), §10 (milestones).
Depends on: M1 (DONE, merged to `main`).

## Goal

A signed-in reader lists a copy they finished (sell / swap / free) with photos, condition,
price-if-selling, city, meetup options and notes; another reader reserves it
(ACTIVE → RESERVED); owners edit or delist (→ CANCELLED); readers browse/filter/search
offers (`/listings`), keep a wishlist, and the book page's offers section links into it.

## Files to create/modify

New:

- `app/[locale]/listings/page.tsx` — GET browse: search + filters + sort + pagination;
  supports `?bookId={id}` deep-link (book page overflow). Server component,
  `export const dynamic = "force-dynamic"`. Cover-centric rows (ledger rows), NOT generic
  catalog cards (DESIGN §4.8).
- `app/[locale]/listings/[id]/page.tsx` — listing detail (ACTIVE / RESERVED view); owner
  actions vs viewer reserve CTA; `notFound()` when missing or CANCELLED.
- `app/[locale]/listings/[id]/actions.ts` — `"use server"`: `createListing`, `updateListing`,
  `cancelListing`, `reserveListing` (+ wishlist toggle lives in `lib/wishlist.ts`).
- `app/[locale]/listings/new/page.tsx` — create-listing gate + form (auth).
- `app/[locale]/listings/[id]/edit/page.tsx` — edit-listing (owner, ACTIVE only).
- `app/[locale]/wishlist/page.tsx` — my wishlist (auth) + remove toggle.

Modified:

- `app/[locale]/books/[id]/page.tsx` — replace M1 placeholder listings section with real
  ACTIVE rows (H1–H10): `getBookListings(bookId, viewerId, take 4, newest)` ledger rows; overflow
  → `/${locale}/listings?bookId={id}` (key `book.viewAllOffers`); reserved → status flow.
- `lib/books.ts` — replace `getBookById` stub (`listingsCount: 0`) with real ACTIVE count + add
  `getBookListings(bookId, viewerId, limit)`.
- `lib/listings.ts` — NEW server-only read/write layer.
- `lib/wishlist.ts` — NEW server-only wishlist toggle/read.
- `lib/search.ts` — NEW catalog+listing search helper (title/author/ISBN; `books_title_trgm_idx`).
- `lib/images.ts` — NEW `ImageStore` interface + `LocalDiskImageStore` + `S3ImageStore`.
- `lib/rate-limit.ts` — no change needed (`listingCreate` already present); use it with key
  `listing:create:<uid>`.
- `components/notice-banner.tsx` + `messages/ar.json` + `messages/en.json` — extend notice kinds/codes
  for listing + wishlist lifecycle.
- `components/site-header.tsx`, `components/mobile-nav.tsx`, `components/site-footer.tsx` — nav/footer
  links (`nav.listings`, `footer.listings`).
- `components/icons.tsx` — add only needed icons (search, bookmark, map-pin, swap) if absent.

Not modified: `prisma/schema.prisma` (zero migrations by design).

## Data & API shapes

- Prisma diff: **NONE** — Listing, WishlistItem (`@@unique([userId, bookId])`), ActivityEvent
  (LISTING_CREATED / LISTING_COMPLETED / WISHLIST_ADDED …) all pre-exist in the M0 v1 schema and the
  `20261105103722_init` migration (incl. `listings_price_cents_check`, `listings_currency_format_check`,
  `books_title_trgm_idx`). Do NOT run `prisma migrate dev`; `prisma validate` must stay clean. If a
  change is truly unavoidable, stop and re-plan — never hand-write migrations.
- Env vars: `IMAGE_STORE` (`local` default | `s3`), `DEFAULT_CURRENCY` (default `EGP`), plus the S3 block
  (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_PUBLIC_BASE_URL`, `S3_FORCE_PATH_STYLE`) — already documented in `.env.example`.
- Deps: `npm install sharp @aws-sdk/client-s3` (local store + S3 store). `next/image`: remotePatterns
  `covers.openlibrary.org` + S3 public base; local `/uploads/*` needs no config; never `images.domains`.
- Actions/routes: no new REST routes (server actions only, M0/M1 pattern).
- Listing create/edit server action fields (zod-validated server-side): `bookId, locale, type, condition,
  priceCents, currency, description, location, meetupOptions, images[]`; `status` only via server defaults
  (ACTIVE) / transitions (`RESERVED`, `CANCELLED`).
- Listing read payload: `Listing` + `book { authors{author} }` + `seller { id username name profile displayName status }`.
- Wishlist toggle returns `{ wished: boolean }`; catch `P2002` → `{ wished: false }` (no-op).
- URL filter params: `q, type, condition, priceMin, priceMax, city, genre, sort, page, bookId`.

## Invariants

- Every listing action re-checks `ACTIVE` (owner ops) / ownership; suspended users blocked via the
  `activeUserId()` pattern; self-reserve blocked; reserve only on ACTIVE.
- i18n: ar == en key sets; new keys mirrored; `npm run i18n:check` PASS; key count > 187.
- RTL: logical CSS only; Arabic line-height ≥ 1.8; no letter-spacing on Arabic; `:lang(ar) body{font-size:1.08em}`;
  ISBNs Latin `dir="ltr"` + `font-mono` + `<bdi>`; mixed strings `dir="auto"`.
- DESIGN.md: no gradient/glass/glow/emoji; radius ≤ 3 (chips excepted); flat paper-raised + 1px rule, no
  shadow at rest, hover hard `4px 4px 0 var(--color-rule-strong)`; cover-centric; ledger rows; max one chip
  per card; buttons min-height 44px; focus-visible 2px outline + 2px offset; status chips carry text labels.
- Minimal client islands: server components + server actions only; no new client components unless the
  existing `SubmitButton` covers it.
- Build with DB down PASS.

## Regressions to avoid

- Prisma migration for M2 (zero by design); no hand-written migrations.
- `images.domains` (deprecated) — use `remotePatterns`.
- next-intl v4 → `proxy.ts` (not `middleware.ts`); Next 16 async params.
- M1 traps to not reintroduce: authors >120 chars silently dropped, `callbackUrl` backslash
  open-redirect, unbounded `getBookDiscussion`, ratings empty state not using `EmptyState`, review-card
  chip count, `parseAuthors` dedupe.
- Wishlist `P2002` no-op; rate-limit key `listing:create:<uid>`; per-user upload quota (60 files)
  enforced in the action.

## Verification

No Docker. Builder must show passing:

- `npm run i18n:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build` (incl. once with Postgres DOWN)
- Manual dev-server checks (both locales): `/ar`, `/en`, `/ar/books`, `/en/books`, `/ar/books/<id>`,
  `/en/books/<id>`, `/ar/listings`, `/en/listings`, `/ar/listings/new` (auth gate → sign-in),
  `/ar/wishlist` (auth gate), `/api/health`.
- DB-backed lifecycle checks deferred until Docker is re-enabled (user restriction).

## Closing

- Branch: `feat/m2-listings`.
- Commit shape: `milestone 2 (m2) listings: CRUD, reservation, wishlist, search` (small commits before it).
- Builder checklist (≤6):

  - Work on branch `feat/m2-listings`; do NOT merge or push `main` (orchestrator merges).
  - Zero Prisma migrations; build with DB down must pass.
  - i18n ar==en + >187 keys green; Arabic-first RTL logical CSS; DESIGN.md laws respected.
  - Listing lifecycle ACTIVE→RESERVED→(COMPLETED in M4); CANCELLED on delist; every action re-checks status.
  - Wishlist unique (userId, bookId) → `P2002` no-op.
  - Verify gates green: i18n:check, lint, typecheck, test, build (DB down) + dev 200s both locales.
