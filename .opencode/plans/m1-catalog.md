# M1 — Book catalog, add-by-ISBN, book page (m1-catalog)

Status: ready to execute · Branch: `feat/m1-catalog` · PRs OFF (orchestrator merges locally)
Source: PLAN.md §1/§5/§8/§9/§10/§12 · DESIGN.md §2–§5/§7–§12 · M0 contract (`m0-scaffold.md`) · loop-state.md
Required reading before coding: `PLAN.md`, `DESIGN.md`, `auth.config.ts`, `auth.ts`, `lib/prisma.ts`, `lib/rate-limit.ts`, `lib/utils.ts`, `scripts/check-i18n.mjs`, `next.config.ts`, `app/globals.css`, `app/[locale]/layout.tsx`, `components/site-header.tsx`, `components/site-footer.tsx`, both `messages/*.json`, `tests/smoke.test.ts`.
Dispatch decisions below **supersede** PLAN.md where they differ; everything else in PLAN/DESIGN stands unchanged.

---

## Goal

A reader can open the catalog and see shelves of real books with covers, open any book's page and get the full catalogue record — authors, large 2:3 cover (or typographic fallback), description, metadata ledger, and a live rating histogram with average — write one honest review (editable, spoiler-flagged), rank it 1–5, read and join threaded discussion (likes, soft-delete tombstones), and from a signed-in account add a missing book by ISBN with Open Library autofill and full manual fallback. All of it Arabic-first RTL with English parity, on the M0 foundations, leaving the app buildable, lint-clean and runnable.

---

## Files to create/modify

All paths relative to `books-project/` unless noted. Create new files; modify listed M0 files additively only.

### New — library code

| File | What |
|---|---|
| `lib/isbn.ts` | Pure ISBN-10/13 normalize + checksum validate + convert (`isbn10To13`, `isbn13To10` (978-prefix only)). `normalizeIsbn` strips spaces/hyphens, uppercases `X`; `parseIsbn(input)` → `{ kind: 'isbn13' \| 'isbn10', value }` or null; `isValidIsbn`. No `server-only` (unit-tested). |
| `lib/openlibrary-map.ts` | Pure mapper: raw OL `jscmd=data` payload → `OpenLibraryBook` DTO (shape in Data & API). Handles subjects as `[{name}]` **or** strings, `publish_date` year regex `(1[0-9]{3}\|20[0-9]{2}\|21[0-9]{2})`, `number_of_pages` string→int, languages `/languages/xxx` → ISO mapping table (eng→en, ara→ar, fra→fr, deu→de, spa→es, ita→it, por→pt, tur→tr, fas→fa, urd→ur, hin→hi, rus→ru, jpn→ja, zho→zh), cover only when payload has `cover.large` **or** `covers[0]` numeric id (constructed `https://covers.openlibrary.org/b/id/{id}-L.jpg?default=false`), host allowlist enforced (`covers.openlibrary.org` only), `key` stored raw (e.g. `/books/OL7353617M`). No `server-only` (unit-tested). |
| `lib/openlibrary.ts` | `import 'server-only'`. `lookupBookByIsbn(isbn13)` → `LookupResult` (below). UA header `BookshelfExchange/1.0 (github.com/Ahmadkhayatt/books-project)`; `AbortController` 5 s; `fetch(url, { next: { revalidate: 2592000 }, headers })`; on 429 → 2 s wait → single retry → else `{kind:'unavailable'}`; 404/empty/missing `ISBN:<isbn>` key → `{kind:'not-found'}`; invalid input → `{kind:'invalid'}`; network/timeout/5xx → `{kind:'unavailable'}`. In-flight `Map<string, Promise>` memoization. Never called from the client; never exposed to the browser. |
| `lib/books.ts` | `import 'server-only'`. Query layer: `getCatalogPage({page,pageSize})` (orderBy `createdAt desc`, take+count, clamps page ≥1), `getBookById(id)` (authors ordered by `BookAuthor.order`, includes listings-count stub = 0 for now), `getRatingAggregates(bookId)` (`aggregate` + `groupBy` value), `getRelatedBooks(book, limit=6)` (same-author OR `subjects hasSome`, scored in JS by shared-author×2 + shared-subject, take 6; section hidden when 0), `findBookByIsbn(isbn13, isbn10?)` (dedupe). |
| `app/[locale]/books/page.tsx` | Catalog browse: `export const dynamic = 'force-dynamic'`; `searchParams.page` sanitized (`parseInt`, NaN→1, clamped to `totalPages`); grid `repeat(auto-fill,minmax(150px,1fr))` (≥1024px 170px); catalog-cards; pagination prev/next (chevrons, `.icon-flip`, `aria-label`s, `aria-disabled` spans at ends) + «الصفحة {current} من {total}»; header row with section-label `٠١ — فهرس المكتبة` / `01 — Catalogue` (reuse `formatIndex`), h1 `catalog.title`, ICU plural count line, primary «أضف كتابًا» link → `/books/new` (works for everyone; anonymous is gated at destination). Zero client JS. |
| `app/[locale]/books/loading.tsx` · `app/[locale]/books/[id]/loading.tsx` · `app/[locale]/books/new/loading.tsx` | `.skeleton` cover-shaped 2:3 blocks (catalog), two-column skeleton (book page), form-bar skeleton (new); `aria-busy="true"` + sr-only loading text (`common.loading`). No spinners. |
| `app/[locale]/books/new/page.tsx` | `force-dynamic`. Auth check via `auth()`; anonymous → inline gate panel («سجّل الدخول لإضافة كتاب» + link to `/{locale}/sign-in?callbackUrl=/{locale}/books/new` validated rel path). `searchParams.isbn`: valid → server `lookupBookByIsbn` (cached, no rate-limit consumed on render) → render prefilled form + optional notice (not-found/unavailable → manual form with notice, **never an error page**); invalid → search form + inline error; absent → ISBN search form only. Also renders full-manual mode via `?manual=1` link («أدخل التفاصيل يدويًا»). |
| `app/[locale]/books/new/actions.ts` | `"use server"` — `lookupIsbn(formData)` and `createBook(prevState, formData)` (signatures in Data & API shapes). |
| `app/[locale]/books/[id]/page.tsx` | `force-dynamic`. `notFound()` on unknown id. 12-col grid: cover mat → main column. `generateMetadata` (title, description ≤160 chars, `alternates.languages` ar/en/x-default). Sections: record header (section-label `book.recordKicker`, h1 displayTitle, authors line, notice banner via `?notice=`/`?error=`), metadata ledger (`.ledger-row` + `.leader`: publisher, year, pages, language via `Intl.DisplayNames(locale,{type:'language'})`, ISBN in `<bdi dir="ltr">` mono, subjects as chips — max one chip per *card* rule doesn't apply to ledger), «عن الكتاب» prose, ratings block (big average + stars + ICU count + 5→1 histogram bars, `paper-deep` track / `leather` fill, flat, no gradient), rating input (signed-in; else sign-in prompt), reviews (latest 20, «اكتب مراجعتك»/«عدّل مراجعتك» single dual-mode form + delete with native `confirm`), discussion (page-level comments, latest 20), related books strip (hidden when 0), **listings placeholder** (see Data & API shapes, hook points H1–H10 — nothing else). |
| `app/[locale]/books/[id]/actions.ts` | `"use server"` — `rateBook`, `saveReview`, `deleteReview`, `createComment`, `deleteComment`, `toggleReviewLike`, `toggleCommentLike` (signatures below). Every action: `auth()` → load `user.status` → must be `ACTIVE` → zod-validate → mutate → `revalidatePath(`/${locale}/books/${bookId}`)`. |
| `app/[locale]/books/[id]/not-found.tsx` | **Not used** — unknown id reuses `app/[locale]/not-found.tsx` via `notFound()`. Do not create a segment-level one. |

### New — components

| File | What |
|---|---|
| `components/book-cover.tsx` | Server component. Props: `{ coverUrl: string\|null, title, authorLine?, alt, sizes, className? }`. `coverUrl` → `<Image>` (fill in `aspect-[2/3]` wrapper, `sizes` set per call-site). `null` → typographic fallback: `paper-deep` field, guilloche double border (`outline` + inner hairline), title large (Fraunces/Newsreader; Amiri if Arabic), author below, publisher colophon at foot — field variant picked by `hash(isbn13 ?? id) % 4` ∈ {`leather`,`cloth`,`stamp`,`ink`} flat fills, rotated stamp-free. Wrapper `role="img" aria-label={alt}`. Never stretched; covers stay 2:3 everywhere. |
| `components/catalog-card.tsx` | Server. Stretched-link `<Link>` to book; hairline, `paper-raised`, radius 3px, **no rest shadow**; hover (pointer:fine) `translateY(-2px)` + hard `4px 4px 0 var(--color-rule-strong)` plate, `focus-within` identical; title 2-line clamp (Newsreader 560/Noto Sans Arabic 600); author line `ink-soft`; footer row: publishedYear via `Intl.NumberFormat(locale)` (`useGrouping: false`). **No № in M1** (see "Documented deviations"). Year only; digits come from Intl (Arabic-Indic in ar, Latin in en); the mono/`dir="ltr"` rule does not apply to Intl digits. |
| `components/rating-summary.tsx` | Server. `average` (Intl, 1 fraction max, e.g. «٤٫٣»/"4.3"), 5 SVG stars (`gild-deep` fill; empty = `rule` stroke), filled count = `Math.round(avg)`, sr-only «{average} من ٥»/"{average} of 5"; `count` via ICU plural (`book.ratingCount`); histogram 5→1 rows: label digit (`Intl`), track `paper-deep`, fill `leather`, count ink-soft tabular; bars `aria-hidden`, visually-redundant text always present. |
| `components/rating-input.tsx` | **"use client"** — only client input. Radios `sr-only` + star SVG labels (fill ≤ selected), order 5→1 inline-start→end (RTL-mirrored by flex), change requires explicit «ثبِّت التقييم»/"Save rating" button (`useTransition`, disabled while pending, `aria-live` polite status «سُجّل تقييمك»/"Rating saved"). Props: `bookId`, `currentValue`, labels from parent. |
| `components/review-card.tsx` | Server. Monogram (first letter of `displayName ?? name ?? username`, `paper-deep` disc, ink letter), display name (fallback chain) + `@username` in `<bdi dir="ltr">` ink-faint, Intl date, `«مراجعتك»`/"Your review" chip (cloth tint) when own; spoiler → body wrapped in `<details><summary>{book.spoilerReveal}</summary>…` (content **is** in the DOM — spoiler hiding is courtesy-level, not security; never render soft-deleted **comment** bodies anywhere); footer: helpful-form (heart SVG, outline→filled `leather`/`stamp`? — use `leather` fill; `aria-pressed`, count, `dir` ok), "edit" scrolls to the dual-mode form anchor (`href="#review-form"`), delete inline in the form only. |
| `components/comment-item.tsx` | Server, recursive. Props `{ comment, depth, bookId, viewerId, locale }`. `deletedAt` → tombstone row «حُذف هذا التعليق»/"This comment was deleted", no body, **no** like/reply actions, children still render. Else: body, meta (monogram, names, Intl time), actions: like form (as review), «ردّ»/"Reply" inside `<details>` composer when `depth < 3` (no reply at depth ≥ 3 — anti-sprawl; deeper bodies still render), «احذف»/"Delete" (own only, soft). Replies nested in `<ol>` with `padding-inline-start: 1rem; border-inline-start: 1px solid var(--color-rule)`. Reply context enforcement: creating a reply inherits `reviewId` when set; cross-thread replies rejected server-side. |
| `components/like-form.tsx` | Server. `<form action={toggle….bind(null, targetId)}>` + submit-button: heart SVG (`stroke: currentColor`, filled path when `liked`) + count (Intl); `aria-pressed`, `aria-label={t('book.likeLabel')}`; ≥44px hit area. Works without JS (form POST + revalidate). Anonymous clicker → redirect to sign-in with `callbackUrl`. |
| `components/empty-state.tsx` | Server. DESIGN §5.5: `№ 0000` mono above, stamp-ring SVG (80px, `stamp`/`cloth` stroke, −8°, glyph inside — `aria-hidden`), headline (Newsreader italic 560 / Amiri 700), one ink-soft line, optional single CTA slot. Used by catalog empty, reviews/comments/ratings empty, listings placeholder. |
| `components/notice-banner.tsx` | Server. Props `{ kind: 'created'\|'exists'\|'reviewDeleted'\|'error', code?, dismissHref }`. `role="status"` (notices, cloth tint) / `role="alert"` (errors, stamp tint), hairline, radius 3px, one ghost «إخفاء»/"Dismiss" link dropping the param. Unknown codes → renders nothing. |
| `components/submit-button.tsx` | **"use client"** — `useFormStatus().pending`; `btn--primary`; pending label via prop («جارٍ الحفظ…»/"Saving…"); aria-disabled + no double submit. |
| `components/add-book-form.tsx` | **"use client"** — the only big client island on `/books/new`. `useActionState(createBook, initialState)`; fields: title (req), titleAr, subtitle, publisher, publishedYear, pageCount, language (select: 14 codes from Data & API), subjects (single input, split on `, ،` trim dedupe ≤12), description (textarea ≤5000), cover radio: «استخدم الغلاف المقترح»/"Use the suggested cover" (default checked, only if OL cover) vs typographic fallback note (no free-text URL input — rejected by design), hidden `isbn13`/`isbn10`/`openLibraryKey`/`coverUrl` (re-validated server-side, never trusted), authors editor: 1–10 rows (name + optional OL key carried hidden), «أضف مؤلفًا»/"Add author", per-row remove (min 1). Inline `role="alert"` summary on error + `aria-invalid` per bad field (`aria-describedby` wired). Layout: label-above fields, `dir="ltr"` on ISBN/year/pages/email-like inputs, ledger grouping, `.field`/`.form-card` classes, no placeholder-only fields. |

### Modify — M0 files (additive only)

| File | Change |
|---|---|
| `messages/ar.json` · `messages/en.json` | **Add** `nav.catalog`, `footer.catalog`, and namespaces `catalog.*`, `book.*`, `notice.*`, `addBook.*` (key list in Data & API shapes). **Never rename/remove existing keys.** Key-for-key parity; all values real MSA / real English; Arabic counts via ICU plurals with all six ar categories (zero/one/two/few/many/other); no Latin punctuation inside Arabic prose; ISBNs/URLs never hard-coded in copy. Gate must end > 76 (expect ≈ 180; builder reports actual). |
| `components/icons.tsx` | Additive: `HeartIcon` (outline + filled state via class, never flips), `StarIcon` (fillable, never flips), `ChevronLeftIcon`/`ChevronRightIcon` (pagination, rendered with `.icon-flip`). Existing Menu/Close/External/Alert untouched; stroke 1.5, round caps. |
| `components/site-header.tsx` | Add Catalog link (`nav.catalog`) to desktop nav **and** mobile panel (first item after Home). |
| `components/site-footer.tsx` | Guide list gains Catalog link (`footer.catalog`) — now a real route. |
| `app/globals.css` | Append `@layer components`: `.catalog-card` (+`.catalog-card:hover`, `:focus-within`, `pointer:fine` media-guard, no shadow at rest, hard plate hover), `.typo-cover` + 4 field variants (`.typo-cover--leather|cloth|stamp|ink`), `.cover-mat` (detail-page mat frame + hairline), `.notice`/`.notice--status|alert`, `.histogram-track`/`.histogram-fill`, `.review-card`, `.comment-reply` (border-inline-start indent), `.monogram`, `.empty-state(__stamp,__title,__body)`, `.like-button` (≥44px, `[aria-pressed="true"]` filled heart), `.listings-empty` (row used by placeholder), `.book-alt-title` (subdued other-script title line). All logical properties; **zero** `left|right|text-left|text-right|ml-|mr-|pl-|pr-` anywhere. |
| `app/[locale]/sign-in/actions.ts` · `app/[locale]/sign-in/page.tsx` · `app/[locale]/sign-up/actions.ts` · `app/[locale]/sign-up/page.tsx` | Honor `callbackUrl`: actions read hidden `callbackUrl` from formData; **validate** `startsWith('/') && !startsWith('//')` (else fall back to `/${locale}`); pages pass through sanitized `searchParams.callbackUrl`. Nothing else in the auth flow changes (rate limits, generic errors, JWT, split config all untouched). Required so `/books/new?…` round-trip lands users back where they were. |
| `lib/utils.ts` | Add pure helpers: `displayTitle({title, titleAr}, locale)` (ar → `titleAr ?? title`; en → `title`), `formatCount(locale, n)` (cached `Intl.NumberFormat(locale)`), `formatYear(locale, y)` (same, `useGrouping:false`). Existing `cn`, `formatIndex` untouched. |
| `lib/actions/auth.ts` | **Unchanged.** |
| `next.config.ts` | **Unchanged** (`covers.openlibrary.org` remotePattern already present; `sharp ^0.35.5` arrives via `next` optionalDependencies — optimizer works, add nothing). |
| `proxy.ts` · `i18n/*` · `auth.config.ts` · `auth.ts` · `auth.d.ts` · `prisma/*` · `generated/*` | **Untouched.** |

### New — tests

| File | What |
|---|---|
| `tests/isbn.test.ts` | Checksums both formats; normalization (hyphens/spaces/lowercase x); invalid checksums; `978`-only ISBN-10↔13 both directions; `979` → 13-only; edge strings. No network, no DB. |
| `tests/openlibrary-map.test.ts` | Fixture payload → DTO: subjects objects→names (and string passthrough), first publisher, year extracted from `"October 2004"`/`"2004-10-01"`/`"2004"`, pages string→int, `eng→en`, `ara→ar`, unknown→`null`, missing cover → `coverUrl: null`, cover host allowlist (drop non-OL hosts), missing `ISBN:` key handled upstream (mapper not reached). No network, no DB. |

No other files. No new dependencies (npm). No edits to `PLAN.md`, `DESIGN.md`, `AGENTS.md`, `PR_BODY.md`.

---

## Data & API shapes

### Prisma — **migration: NONE**

`Book`, `Author`, `BookAuthor`, `Rating`, `Review`, `Comment`, `ReviewLike`, `CommentLike`, `ActivityEvent` in the M0 schema (shipped in `20261105103722_init`, incl. `ratings_value_check`, `@@unique([userId, bookId])` on Rating/Review, unique like tables, `comments.deletedAt`, `pg_trgm` index) cover every M1 write. `Listing`/`WishlistItem` exist but are **not read or written in M1**. If the builder believes a schema change is required → STOP, flag the architect; do not edit `schema.prisma`, do not create a migration, do not `db push`.

Relied-on columns: `Book.isbn13? @unique`, `isbn10?`, `titleAr?`, `subjects String[]`, `coverUrl?`, `openLibraryKey? @unique`, `createdById?` (`SetNull` on user delete), `language` default `'ar'`. Aggregates (avg, count, histogram) are **derived at read time** (`aggregate` + `groupBy`) — never stored; no counter drift possible.

### Routes (all locale-prefixed; both locales)

| URL | Purpose |
|---|---|
| `/[locale]/books?page=N` | Catalog browse. `page` sanitized/clamped; 24/page; `createdAt desc`. Empty → `empty-state` with working CTA to `/books/new`. |
| `/[locale]/books/new` · `?isbn=<13-digit>` · `?manual=1` | ISBN search → prefilled form → create. Anonymous → inline gate (no redirect loop; `callbackUrl` honored after sign-in). |
| `/[locale]/books/[id]` | Book page. Unknown id → `notFound()`. |
| Server actions (in `app/[locale]/books/new/actions.ts`) | `lookupIsbn(formData): Promise<void>` — validate → auth → DB dedupe → `redirect('/{locale}/books/{id}?notice=exists')` if found → `checkRateLimit('isbn:lookup:'+uid, RATE_LIMITS.isbnLookup)` (60/min; fail → `/books/new?error=rateLimited`) → `lookupBookByIsbn` → `redirect('/{locale}/books/new?isbn=…')`. |
| | `createBook(prevState: BookFormState, formData): Promise<BookFormState>` — re-validate everything (never trust hidden fields); ISBN supplied → DB dedupe (`isbn13` **or** `isbn10` **or** `openLibraryKey` match) → `redirect('…?notice=exists')`; else `$transaction`: upsert authors (by `openLibraryKey` if present, else exact trimmed name `findFirst`, else `create`; `order` = array index; ≤10 authors, each ≤120 chars) + `book.create` (`createdById` = session uid, subjects array, both ISBNs when derivable via `lib/isbn.ts`). Catch `P2002` → `findUnique` winner → `redirect('…?notice=exists')`. Success → `revalidatePath` catalog + book → `redirect('/{locale}/books/{id}?notice=created')`. Validation fail → `{ ok:false, fieldErrors, message? }` → inline `role="alert"`. |
| Server actions (in `app/[locale]/books/[id]/actions.ts`) | `rateBook(bookId: string, value: number): Promise<{ok:boolean}>` — ACTIVE member; value int 1–5; **upsert** Rating `[userId, bookId]`; revalidate. |
| | `saveReview(prevState, formData): Promise<ReviewFormState>` — ACTIVE member; zod (`title?` ≤150, `body` 3–5000, `containsSpoiler` bool, `language` = current locale); **upsert** Review `[userId, bookId]` (one per user per book; edit replaces); revalidate. `?error=reviewInvalid` redirect on fail. |
| | `deleteReview(): Promise<void>` — own review only (hard delete; its comments cascade) → `?notice=reviewDeleted`. |
| | `createComment(prevState, formData): Promise<CommentFormState>` — ACTIVE member; zod (`body` 1–2000, `containsSpoiler` bool); resolves `bookId` + optional `reviewId` + optional `parentId`; **enforce**: `review.bookId === body.bookId`, `parent.bookId === body.bookId`, `(parent.reviewId ?? null) === (reviewId ?? null)` — no cross-thread replies; `reviewId` always matches the review being commented; `bookId` always set. |
| | `deleteComment(formData): Promise<void>` — **owner only**; sets `deletedAt = now()`; body never rendered again. (Admin removal = M5.) |
| | `toggleReviewLike(reviewId: string): Promise<void>` · `toggleCommentLike(commentId: string): Promise<void>` — ACTIVE member; **transaction**: `deleteMany({userId, <id>})`; if count === 0 → `create` (catch `P2002` → no-op). Idempotent by construction + DB unique. Revalidate. |

All actions are POST-only, `revalidatePath` the book page, never return raw DB errors; failures redirect with `?error=` codes mapped to `notice.error*` keys (unknown → silent no-op UX, logged server-side via `console.error`).

### Open Library — caching, limits, covers

- Endpoint (exactly): `https://openlibrary.org/api/books?bibkeys=ISBN:{isbn13}&jscmd=data&format=json` — **`jscmd=data`, never `viewapi`** (it omits title/authors).
- `User-Agent: BookshelfExchange/1.0 (github.com/Ahmadkhayatt/books-project)`; 5 s `AbortController`; `next: { revalidate: 2592000 }` (30 days) — repeat lookups across requests/instances served from Next's fetch cache; in-flight `Map` collapses concurrent same-ISBN stampedes per process.
- `429` → wait 2 000 ms → **one** retry → `{kind:'unavailable'}`. `404` / empty body / missing `ISBN:<key>` / timeout / 5xx / DNS → `{kind:'not-found'}` or `{kind:'unavailable'}` — both render the manual-entry form with a notice; **never** a dead end, never an HTTP 500 from `/books/new`.
- Rate limit: `isbnLookup` (60/min per user, `RATE_LIMITS.isbnLookup` already in `lib/rate-limit.ts`) enforced in the **action** before any network call; passive page renders don't consume quota (OL calls behind cache). `reviewCreate` limit deliberately **not** wired until M5 (PLAN §12).
- Derived data on create: `title, subtitle, authors[] {name, openLibraryKey}, publisher (first), publishedYear (regex from publish_date), pageCount (parseInt), subjects (≤12, ≤60 chars each, deduped), language (map or null → form defaults to current locale), openLibraryKey (raw `key`), coverUrl`.
- **Uniqueness / dedupe rules**: normalize → validate checksum → prefer ISBN-13 (ISBN-10 inputs converted; both stored when derivable). Pre-check `isbn13` OR `isbn10` OR `openLibraryKey` → existing row wins; user is redirected to it with `notice=exists` («هذا الكتاب مسجَّل لدينا»/"This book is already on our shelves") — **no duplicate rows, ever**. Create race → `P2002` → same redirect. Work-level merge (same work, different editions) is **out of scope v1**; title/author fuzzy match deferred to M2 search; edition-level identity only.
- **Cover strategy (decided): hot-link through `next/image`, no local copy.** `Book.coverUrl` stores the absolute OL URL only; hosts validated (`covers.openlibrary.org`) at write time (zod refine). Browsers never call OL — every display goes through `/_next/image` (server-fetched, resized, cached). We **do not** download OL covers into `public/uploads` — that store is reserved for user uploads (listing photos, M2, EXIF/quota/magic-byte rules). Reasons: OL covers are catalogue data, not user content (PLAN §5/§7, R5 — takedown via reports = M5); copying duplicates bytes and orphans files on book deletion; next/image already proxies/optimizes; missing covers → `coverUrl = null` → typographic fallback (DESIGN §4.8), so zero broken images. `-L` URL stored; optimizer serves all sizes. If OL later 404s a stored cover (rare), the `<Image>` fails — residual risk accepted for M1 (M6 may add an `onError` swap to the typographic fallback via a tiny client wrapper).
- `?default=false` semantics preserved: covers constructed/used with `?default=false` so missing covers 404 rather than serve blank GIFs; we store null unless the OL payload reports a cover at all.

### M2 hook points (build M1 to these — do NOT implement listing UI now)

The book page ships a listings placeholder; M2 fills it **without redesign**:

- **H1** — `<section aria-labelledby="listings-heading">` with heading `book.listingsHeading` («عروض متاحة»/"Live offers") is already in place; M2 replaces only the inner HTML. Keep the id stable.
- **H2** — Data hook (documented, not executed in M1): `prisma.listing.findMany({ where: { bookId, status: 'ACTIVE' }, take: 4, orderBy: { createdAt: 'desc' }, include: { seller: { select: { username: true, profile: { select: { displayName: true } } } } } })` — `passwordHash` is globally omitted (`lib/prisma.ts`) and this projection never selects secrets regardless.
- **H3** — Render as **ledger rows (`.ledger-row`), NOT cards** (print thesis, DESIGN §4/§5.8; listing cards belong to the `/listings` grid in M2). Row: type chip (SELL=leather tint / SWAP=cloth tint / FREE=ink tint — **text labels always**, never color alone), condition label (`listing.condition.*` added by M2), price via `Intl.NumberFormat(locale, { style:'currency', currency })` in `<bdi dir="ltr">` or «مجاني»/"FREE", seller `@username` in `<bdi dir="ltr">`, `createdAt` relative Intl. Row links whole to `/[locale]/listings/[id]`.
- **H4** — Overflow: when > 4, rows + ghost link «عرض كل العروض (N)»/"View all offers (N)" → **`/[locale]/listings?bookId={id}`** — `bookId` is the **reserved filter param** on `/listings` in M2 (documented here so M2 implements it day one).
- **H5** — Empty state (`№ 0000`, mono) copy reserved as `book.listingsEmpty*` **namespace added by M2**, not now; M1 renders its own static empty markup inside the section with the same `empty-state` atoms.
- **H6** — M2 listing create/update/cancel actions call `revalidatePath('/{locale}/books/{id}')`; M1's detail page is `force-dynamic` so no stale cache issues.
- **H7** — Wishlist CTA belongs to M2 as well: it inserts a toggle button in the book page's action row (above the metadata ledger, after the authors line). M1 leaves that row present but empty of actions besides «فهرس المكتبة» back-link; do not build wishlist UI.
- **H8** — Listing photos, LocalDisk store, `IMAGE_STORE=local` wiring: untouched in M1.
- **H9** — No schema change needed for any of the above (Listing already carries `bookId`, `status`, `priceCents`, `currency`, indexes `@@index([bookId, status])`).
- **H10** — Both `?notice=` param and `notice-banner` component are reusable by M2/M5 (listing created, etc.) — keep them generic.

### Activity events — **M1 writes ZERO `ActivityEvent` rows**

Explicit decision: `ActivityType.REVIEW_POSTED` / `BOOK_SHELVED` / etc. are wired in **M3** together with the follow-graph feed and its privacy rules (feed = events from followed actors + own). Emitting them now would pre-empt M3's design and pollute a table with rows nobody can yet read. If you find yourself writing `activityEvent.create` in M1 → that is a review finding, not a feature.

### Permissions matrix (M1)

| Action | Anonymous | Signed-in MEMBER (ACTIVE) | ADMIN |
|---|---|---|---|
| Read catalog / book page | ✓ | ✓ | ✓ |
| Add book (ISBN/manual) | ✗ (gate → sign-in) | ✓ (`createdById` recorded; **creator gets no edit rights**) | ✓ |
| Edit book catalog fields | ✗ | ✗ (**no edit UI anywhere in M1**; server actions reject catalog writes) | ✗ in M1 — admin catalog edit/remove lands with M5 tooling; until then fix via controlled DB ops |
| Rate 1–5 | ✗ | ✓ upsert own | ✓ |
| Write / edit review (1 per book) | ✗ | ✓ upsert own | ✓ |
| Delete own review | ✗ | ✓ (hard delete; comments cascade) | ✓ (own only in M1) |
| Comment (book or review thread) | ✗ | ✓ | ✓ |
| Soft-delete **own** comment | ✗ | ✓ (`deletedAt`; body never re-rendered) | ✓ own; any comment removal = M5 |
| Like review/comment (toggle) | ✗ | ✓ idempotent | ✓ |
| Suspended/banned user | n/a | ✗ blocked at sign-in (M0) **and** re-checked in every action | — |

### Deleted / removed user content

- **Hard user delete** (admin-only, rare, M5 tooling; direct DB intervention aside): schema cascades — listings, reviews, comments, ratings, likes, follows, reading lists all go with the user; `Book.createdById → SetNull` (catalog records survive; attribution honestly disappears).
- **Soft-deleted comments** (`deletedAt`): row kept to preserve thread shape; UI renders tombstone text only; body excluded from every query/render path; likes/reply/edit affordances removed; children unaffected.
- **Suspended (not deleted) users**: content stays visible (no silent censorship); they cannot sign in (M0) or act (M1 action-layer `status` check); takedown of their content = M5 report flow.
- **Orphaned likes/comments**: impossible (FK + cascade). Empty display name → monogram falls back to username initial; never blank.

### Publish draft vs live (decided)

**v1 has no draft state anywhere.** `Book`, `Listing`, `Review`, `Comment` publish on write. There is nothing to "stage": the add-book flow creates only on explicit submit (no autosave); review/comment forms post directly; the **only** gated visibility is the spoiler toggle (`<details>` reveal; courtesy-level hiding — content is in the DOM; do not claim security). Catalogue unpublish/hide = M5 admin action (future). Listings created in M2 are born `ACTIVE` — same rule. Any "Save as draft" affordance is out of scope; do not add one.

### i18n keys to add (both files; key-for-key)

`nav.catalog` · `footer.catalog` · `catalog.{title, count (ICU plural, all 6 ar categories), recentlyShelved, emptyTitle, emptyBody, emptyCta, pageOf (ICU: «الصفحة {current} من {total}»), prevPage, nextPage}` · `book.{recordKicker, altTitle (visible subdued line in the other script), coverAlt (ICU «غلاف كتاب «{title}»»), publisher, year, pages, language, isbn, subjects, about, ratingLabel, averageOfFive (sr-only), ratingCount (ICU), noRatings, yourRating, saveRating, ratingSaved, starLabel (ICU «قيّم بـ {value} من ٥»), signInToRate, reviews, yourReviewBadge, writeReview, editReview, reviewTitle, reviewBody, containsSpoiler, saveReview, deleteReview, deleteReviewConfirm, spoilerReveal, spoilerChip, commentDeleted, commentPlaceholder, postComment, reply, discussion, commentSignInPrompt, reviewSignInPrompt, backToCatalog, likeLabel («أعجبني»/"Helpful"), listingsHeading, listingsEmpty, listingsEmptyBody, relatedHeading}` · `notice.{created, exists, reviewDeleted, errorInvalid, errorReview, errorComment, errorRateLimited, dismiss}` · `addBook.{title, lede, isbnLabel, isbnHint, searchAction, manualToggle, invalidIsbn, rateLimited, notFoundTitle, notFoundBody, unavailableTitle, unavailableBody, formTitle, titleLabel, titleArLabel, subtitleLabel, authorsLabel, authorLabel, addAuthor, removeAuthor, publisherLabel, yearLabel, pagesLabel, languageLabel, subjectsLabel, subjectsHint, descriptionLabel, coverLabel, useSuggestedCover, coverFallbackNote, createCta, creatingPending, cancel}`.

≈ 105–115 keys per locale (→ total ≈ 181–191). **Required: `i18n:check` green with ar == en > 76**; builder reports exact final counts. Arabic copy is written in MSA first; numerals in prose via ICU/`Intl` (Arabic-Indic in ar); `№`/ISBN/mono stay Latin digits; any key matching `/isbn|url|email|username|link/i` is flagged by the bidi audit — keep those **values** free of embedded URLs/emails and wrap every usage at the render site in `<bdi dir="ltr">` (audit is print-only, exit 0).

### Documented deviations from DESIGN.md (explicit, not waivers of the constitution)

1. **No catalogue accession `№` on cards/ledgers in M1.** No source exists (`createdAt` row-numbers renumber on delete — rejected; fake hashes rejected). Card footer shows the year (Intl digits) only. `№` remains on empty states/404/labels (static strings) and elsewhere DESIGN uses it. A future milestone may add a stored `accession Int @unique @default(autoincrement())` if wanted — **not in M1, do not improvise one**.
2. **Listings placeholder = ledger rows, not cards** (DESIGN §5.8 print thesis); full listing cards ship with `/listings` in M2.
3. **Spoiler reveal is courtesy-level** (`<details>`), documented as such; soft-deleted **comment** bodies are never rendered.
4. Book page is `force-dynamic` (in line with `/api/health` precedent) so the build never needs Postgres up.

---

## Invariants

1. **RTL parity, always**: every new surface ships correct in `/ar` (rtl) **and** `/en` (ltr); logical properties only (`ms/me/ps/pe/start/end/border-s|e/text-start|end/rounded-s|e`); **zero** `left/right` declarations or Tailwind `ml-*mr-*pl-*pr-*/text-left|right/`; `.icon-flip` flips chevrons/arrows only (never search/star/heart/book/close/check/plus); ISBNs, `@usernames`, URLs, Latin digits-in-prose wrapped in `<bdi dir="ltr">` or `dir="ltr"` blocks; Arabic prose numerals via `Intl.NumberFormat('ar')`/ICU (Eastern Arabic-Indic); no `letter-spacing` on Arabic; `text-align: justify` banned; Arabic body line-height ≥ 1.8 (existing globals) untouched.
2. **DESIGN.md constitution**: palette = existing tokens only (paper/ink/leather/cloth/stamp/gild + tints via `color-mix` 12–14%); **no** new hues, purple/blue gradients, glassmorphism, glow, pure `#fff`/`#000`; radius ≤ 3px (chips 999px); **no soft shadows** — only hard `4px 4px 0 var(--color-rule-strong)` on cover/card hover (pointer:fine only); gild never text on paper; leather = the one primary CTA; stamp = destructive/seal only; chips carry **text**; one chip max per card; covers 2:3 never stretched; hairline rules + double rules do the separating; focus-visible ink outline everywhere; targets ≥ 44×44px; `prefers-reduced-motion` honored.
3. **i18n gate**: all user-facing strings via `messages/*.json`; key parity; non-empty values; `npm run i18n:check` green; **total > 76**; no hardcoded Arabic/English in JSX/TS (mono `TABĀDUL`/`EST.`-style art direction excepted only if already used in M0 patterns).
4. **M0 untouched except the listed additive edits**: `auth.config.ts` stays Prisma-free/edge-safe; JWT strategy; split config; `passwordHash` global omit (and the single override in `authorize()`) intact; proxy.ts (not middleware.ts) and next-intl matcher unchanged; `/` → `/ar` redirect intact; layout `dir` server-side from locale param; unknown locale → `notFound()`; `await params` everywhere (Next 16 async APIs); hreflang (`ar/en/x-default → /ar`) on all new pages via `generateMetadata`.
5. **DB law**: Prisma via `@/generated/prisma/client` only (never `@prisma/client`, never `require`); import paths with `@/`; `lib/prisma.ts` unchanged; **zero migrations**; CHECK/unique constraints are the final arbiters — app upserts mirror them.
6. **One review per user per book** — enforced in DB (`reviews_userId_bookId_key`) **and** app (upsert). Duplicate POST = replace, never a second row.
7. **Likes idempotent** — `@@unique([userId, reviewId|commentId])`; toggle = delete-or-create in one transaction; double-click safe.
8. **Comments**: `bookId` always set; threads ≥ 2 levels (top → reply → reply; reply composer capped at depth 3); soft-delete keeps shape; deleted bodies never rendered; cross-thread replies rejected server-side.
9. **ActivityEvent**: **zero writes in M1** (M3 owns); no code path may import `prisma.activityEvent`.
10. **No new npm dependencies; npm only**; `sharp` already rides with `next`; lockfile churn limited to formatting (it should not change at all).
11. **Build never touches the DB**: DB pages are `force-dynamic`; `npm run build` stays green with Postgres stopped (verify once, then restart compose).
12. **Covers**: only `covers.openlibrary.org` via next/image `remotePatterns`; write-time host validation; missing → typographic fallback; never a broken `<img>`; cover alt text via `book.coverAlt` (ICU, both locales).
13. **AuthZ in actions, not UI**: every mutation re-checks session **and** `user.status === 'ACTIVE'` server-side; hiding buttons is never the guard; anonymous action calls → redirect to sign-in with validated `callbackUrl`.
14. **Deleted content law**: soft-deleted comment bodies never rendered; hard-cascade on user delete trusted (no app-level orphan sweeps); `Book.createdById` survives as `null`.
15. **Error hygiene**: no internals/digests leaked except `error.tsx` pattern (digest only); action failures → `?error=` codes → friendly copy; `console.error` server-side only.
16. **Not in scope, explicitly**: ActivityEvent rows; listing/wishlist UI or keys; `/listings`; profiles/follows/lists/feed (M3); reports/admin (M5); rate limits other than `isbnLookup`; seed data (M6); search/filters/sort (M2); accession №; S3 store.
17. **Repo hygiene**: no committed `.env`; `generated/` gitignored; all text UTF-8 no BOM, LF endings (`.gitattributes`); no case-colliding filenames; no `console.log` in committed code paths (server `console.error` allowed).
18. **M0 regressions**: home, sign-in/up round-trip, 404/error/loading, health endpoint, header/footer, locale switcher — all still pass M0's checklist after the two additive header/footer link edits and the `callbackUrl` change.

---

## Regressions to avoid

- **`left`/`right` leaking** into CSS or Tailwind classes (RTL break) — grep must come back clean: `rg 'left|right' app components lib` (ignore `.next/`, `node_modules/`, and the word "copyright"/"leftover" false positives by eye).
- **Hardcoded strings** bypassing `messages/*.json` (esp. button labels, empty states, `alt` text) — i18n gate catches parity, not presence; reviewer greps for stray Arabic in TSX.
- **i18n unmirrored keys** (add to ar, forget en) — red `npm run i18n:check`.
- **`await params` forgotten** → Next 16 runtime crash on dynamic routes; every page/action reads `params`/`searchParams` as Promises.
- **Importing `@prisma/client`** or anything from `generated/` into client components; `lib/openlibrary.ts` imported client-side; `server-only` missing on OL/prisma modules.
- **Build-time DB access**: any `generateStaticParams` on `/books*`, or static rendering with a DB query → build fails when PG is down. All three new dynamic routes are `force-dynamic`; **no DB in `generateStaticParams`** (it returns only locale params in the root layout as today).
- **Broken images**: `next/image` with non-allowlisted host (runtime 400/500); storing non-OL `coverUrl` (blocked by zod refine — keep it); `coverUrl` saved when OL reported no cover (typographic fallback exists — use it, don't hot-guess URLs).
- **P2002 → 500**: every create/like path catches unique-violation and degrades to `notice=exists` / no-op — never an error page for a normal race.
- **Duplicate review on double submit**: Rating/Review are upserts; forms disable while pending (`SubmitButton`); hidden `id` fields are never trusted for ownership — always `auth()`.
- **Cross-thread comment injection**: reply inherits/validates `reviewId` equality server-side; `parent.bookId` must equal `body.bookId`; both enforced before insert.
- **Spoiler false safety**: do not claim spoilers are "hidden" from view-source (they're in `<details>`); and never ship soft-deleted **comment** bodies in any payload/markup.
- **`?page=` NaN/0/negative/999999** → clamp to `[1, totalPages]`; `abc` → 1. Total 0 books → show empty state, don't render page "1 of 0".
- **ISBN rendered bare** (RTL bidi soup) — always `<bdi dir="ltr">`/`dir="ltr"`; same for `@username`, URLs, Latin publisher names; mixed-script publisher strings may use `dir="auto"`.
- **Arabic copy in Latin plural patterns** («5 كتب» wrong case): counts via ICU with ar categories or invariant nouns; numerals Latin in `№`/mono, Arabic-Indic in prose.
- **`text-align: justify`, `letter-spacing` on Arabic, kashida stretching** — banned outright.
- **Hero + 3 cards / purple gradients / glass / glow / soft shadow soup / emoji glyphs as icons** — instant design review fail; icons are inline SVGs, stroke 1.5, round caps (extend `components/icons.tsx` with `HeartIcon`, `StarIcon`, `ChevronLeftIcon/RightIcon` if missing — heart is never-flip; chevrons **are** `.icon-flip`).
- **Card grid centered / max-width soup** — catalog is a start-aligned auto-fill grid; container is `container-page`; section spacing per DESIGN (3–5rem).
- **Layout shift on covers**: width/height or `fill` + 2:3 wrapper always; `sizes` explicit; `priority` only on the book-page cover (LCP), never on grid cards.
- **Redirect with unvalidated `callbackUrl`** (open redirect) — both sign-in and sign-up must reject anything not starting with `/` (and `//` explicitly rejected).
- **Touching `generated/`**, renaming mapped tables/columns, hand-editing applied migrations — never.
- **`middleware.ts` created by reflex** — Next 16 uses `proxy.ts`; creating the former yields two competing runtimes.
- **Committing secrets/`.env`**, `public/uploads/*` junk, or screenshots outside `docs/screenshots/m1/`.
- **`npm update` on anything**; package-lock churn; installing deps to "make it work".
- **Claiming spoiler/comment privacy you don't have** in copy (e.g. «محمي») — honest wording only.
- **Committing to/pushing `main`** — work on `feat/m1-catalog` only; orchestrator merges.

---

## Verification (builder must show all of this passing)

**Commands (exact):**

```bash
npm run i18n:check    # ar == en, total > 76, bidi audit prints, exit 0
npm run lint          # 0 errors, 0 warnings
npm run typecheck     # tsc --noEmit, clean
npm test              # vitest run — existing 5 + new isbn/openlibrary-map tests green
npm run build         # next build — green (then ALSO once with: docker compose stop postgres → build → docker compose start postgres)
```

**DB checks (compose Postgres up on 5433; use the approved container, no host psql):**

```bash
docker exec bookshelf_exchange_pg psql -U bookshelf -d bookshelf_exchange -c \
  "SELECT \"isbn13\", \"title\", \"createdById\" IS NOT NULL AS by_user FROM books;"
# Expect exactly ONE row for the test ISBN after both add attempts (dedupe).
docker exec bookshelf_exchange_pg psql -U bookshelf -d bookshelf_exchange -c \
  "SELECT userId, count(*) FROM reviews GROUP BY 1; SELECT count(*) FROM ratings;"
# Expect reviews/ratings NOT duplicated after double-submit (upsert proof).
docker exec bookshelf_exchange_pg psql -U bookshelf -d bookshelf_exchange -c \
  "SELECT type, count(*) FROM activity_events GROUP BY 1;"
# Expect ZERO rows (M1 writes none).
```

**Dev-server checks (`npm run dev`, then restart clean):**

- `GET /ar/books` · `/en/books` → 200, RTL/LTR correct (`dir` attr), grid renders; with empty DB: full empty state (№ 0000) + working «أضف كتابًا» CTA; `/ar/books?page=abc` → page 1, no crash; `/ar/books?page=9999` → clamped last page.
- `GET /ar/books/new` · `/en/books/new` → 200; anonymous sees gate + sign-in link with `callbackUrl`; signed-in sees ISBN form.
- **ISBN autofill round-trip (real OL)**: sign in → `/books/new` → enter a real, checksum-valid ISBN known to exist on Open Library (e.g. `9780141439518` — Penguin *Pride and Prejudice*) → submit → lands on prefilled form (title/authors/year/pages/cover) → adjust nothing → create → redirected to book page with «أضيف الكتاب» banner → row persisted with OL cover URL (`SELECT`) → add same ISBN again → redirected with `notice=exists`, **no second row**. Also verify the not-found path (valid checksum, absent from OL — builder picks one and records it) → manual form + «لم نعثر…» notice, book creatable manually.
  - If the build/dev network cannot reach openlibrary.org: implement + unit-test the mapper fully, verify not-found/unavailable paths via fixture-mocked fetch, and **state the OL blocker explicitly** in the final report — orchestrator re-verifies on a networked machine. Do not fake the pass.
- **Review/comment/like idempotency**: post a review → re-save edited review → still exactly one row per user/book; set rating 5 → re-rate 3 → one rating row, histogram/average consistent; like a review → like again (toggle off) → like count returns to prior; double-click like → no duplicate error; post reply to a reply (2 levels) → renders nested; delete your comment → tombstone shown, thread shape kept; attempt (devtools) to like the same review twice via replayed POST → no duplicate `review_likes` row.
- `GET /ar/books/<id>` · `/en/books/<id>` → 200; cover renders (next/image, 2:3); metadata ledger correct; histogram matches DB ground truth; signed-out view shows sign-in prompts instead of composers; unknown id → bilingual 404; `generateMetadata` emits alternates ar/en/x-default.
- `GET /ar/books/…?notice=created|exists|reviewDeleted` → banners render; `?error=bogus` → nothing reflected.
- M0 smoke re-run: sign-up → sign-out → sign-in round-trip green; `/api/health` 200; home 200 both locales.
- **Screenshot pass** (both locales × 390/1280): `/books`, `/books/new`, `/books/[id]` → save to `docs/screenshots/m1/` (or, if no capture tool exists in this environment, declare it and do a strict manual pass with both directions at both widths — do not invent files). Commit screenshots on the branch.

**PR expectations (PRs OFF)**

- Branch `feat/m1-catalog` off `main` @ `aa99dcf`; small commits; **do not merge or push `main`** — orchestrator merges after its own Verify + Reviewer gates (`CRITICAL/MAJOR = 0`).
- Commit message shape: `milestone 1 (m1) <scope>: <imperative summary>` — e.g. `milestone 1 (m1) catalog: browse grid, catalog-card, pagination` · `milestone 1 (m1) books: ISBN add flow + Open Library autofill` · `milestone 1 (m1) engage: ratings, reviews, comments, likes` · `milestone 1 (m1) i18n: bilingual copy for catalog/reviews`.
- `git status` clean at hand-off (no stray/generated files); `.env` never staged; `generated/` never staged.

---

## Builder checklist

- [ ] Work on branch `feat/m1-catalog` only — **do NOT merge or push `main`**; small scoped commits, shape `milestone 1 (m1) <scope>: …`; orchestrator merges.
- [ ] No Prisma migration, no schema edits, no `db push` — if tempted, stop and flag the architect; no new npm dependencies.
- [ ] Every string via `messages/ar.json` + `en.json` (key-for-key, parity, > 76 keys, ICU Arabic plurals); `npm run i18n:check` green; logical CSS props only; `/ar` and `/en` both verified, screenshots or explicit manual pass.
- [ ] All mutations auth-gated server-side (session + `status === 'ACTIVE'`); ISBN paths deduped (DB pre-check + P2002 catch → `notice=exists`); likes/ratings/reviews upsert-idempotent; soft-delete respected.
- [ ] ActivityEvent writes: **none**; listing/wishlist UI: **none** (ledger placeholder + H1–H10 hooks only); listings placeholder uses hairline ledger rows, not cards.
- [ ] Show green: `i18n:check`, `lint`, `typecheck`, `test`, `build` (incl. once with Postgres stopped) + 200s for the six dev-server routes (both locales) + ISBN round-trip notes; leave tree clean for the orchestrator.
