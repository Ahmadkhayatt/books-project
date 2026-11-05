# DESIGN — Bookshelf Exchange (تبادل الكتب)

Design system for **Bookshelf Exchange / تبادل الكتب**. Visual heart: the book cover.
Everything here serves covers, catalogue records and the quiet dignity of print.
Applies to all milestones. M0 ships: tokens, fonts, globals.css, header, footer,
buttons, inputs, empty/loading/error states, home shell, not-found page.
Source of truth for the loop; PLAN.md stays the data/architecture truth.

---

## 1. Direction & rationale

**Thesis: the private lending library / the card catalogue.**
Bookshelf Exchange is not a storefront and not a social feed. It is a *card
catalogue that learned to trade* — print logic (hairline rules, accession
numbers, double rules, date-due stamps, dotted leaders) applied to a warm,
modern exchange. Tactile, editorial, Arabic-first, unmistakably not-a-template.

**Precedents we borrow from (and what, exactly):**

| Precedent | What we take |
|---|---|
| **Stripe Press** (Stripe's book imprint) | Cover-forward grids; serif typography set with care; the catalogue-as-artifact; generous margins; no chrome competing with the object |
| **bookshop.org** | Warm, human independent-bookshop commerce; covers doing the selling; earnest copy over growth-speak; community credit as a design surface |
| **Open Library / Internet Archive** | The utilitarian catalogue record: dense metadata, plain rows, ISBNs as first-class citizens, covers via `covers.openlibrary.org`, honest "not found" states |
| **Library card catalogues / date-due slips / ex-libris bookplates** | Index-numbering (`№ 0142`), dotted leaders, double rules, round inked stamps, shelf-mark typography, card-stock backgrounds |

**Why this direction for this product:** readers browse *incidental* inventory
(second-hand, Arabic+English, conditions vary). Trust is established by
looking like a system of record, not like an ad marketplace. Print grammar
also solves RTL gracefully — ledgers and rules are direction-agnostic if built
with logical properties.

**What we explicitly reject (and why):**

- Purple/blue gradients, glows, glassmorphism → decoration without information; reads "SaaS demo", kills print credibility.
- Hero + three feature cards → the generic landing cliche; our home is an index, not a pitch deck.
- Emoji as icons → rendering varies by platform; unacceptable next to Arabic type. Use inline SVG glyphs only.
- Identical rounded cards with soft shadows everywhere → identical corners make everything weightless; we use hairlines, radius ≤ 3px (chips excepted), flat fills.
- One font everywhere → a single sans reads corporate; a single serif reads wedding invitation. We pair display serif + text serif + two Arabic faces (§3).
- Stock handshake photos, blob illustrations, floating 3D mockups → nothing in this product is abstract; it is objects (books) and records (catalogue).

**Mood words:** paper, card-stock, ink, brass, cloth binding, saddle leather,
stamp pad, card catalogue, marginalia. **Not:** gradient, glass, neon, "AI", "clean/
minimal-tech", dashboard-blue.

---

## 2. Color tokens (paper / ink / leather / cloth)

All tokens are CSS custom properties in `globals.css` **and** Tailwind v4
`@theme` entries (`--color-*`). Never hard-code hex outside `globals.css`.

| Token | Hex | Role | Contrast on paper |
|---|---|---|---|
| `--color-paper` | `#F7F3EA` | App background (uncoated paper, warm off-white) | — |
| `--color-paper-deep` | `#EDE7D8` | Inset wells, skeletons, shelf strips, hover fills | ink on it ≈ 13:1 ✓ |
| `--color-paper-raised` | `#FCFAF2` | Raised surfaces: cards, inputs, dialogs | ink on it ≈ 16:1 ✓ |
| `--color-ink` | `#1E1A16` | Primary text, wordmark, double rules | ≈ 15.6:1 ✓ |
| `--color-ink-soft` | `#4A443C` | Secondary text, author lines, ledger keys | ≈ 8.7:1 ✓ |
| `--color-ink-faint` | `#655E52` | Muted text (captions, hints) — AA normal text ✓ | ≈ 5.8:1 ✓ |
| `--color-rule` | `#D8D2C4` | Hairline rules, dotted leaders — **decorative only** | n/a |
| `--color-rule-strong` | `#C5BFB0` | Card border/hover shadow plate | n/a |
| `--color-leather` | `#7A4A2B` | Primary action (saddle leather), links emphasis, section labels | ≈ 6.7:1 ✓ |
| `--color-leather-deep` | `#5A3418` | Primary hover/pressed; leather on leather text | ≈ 10:1 ✓ (on paper) |
| `--color-cloth` | `#3E5C50` | Cloth-binding green: SWAP semantics, secondary accent, focus on ink | ≈ 6.6:1 ✓ |
| `--color-cloth-deep` | `#2C443A` | Cloth hover/pressed | ≈ 9:1 ✓ |
| `--color-stamp` | `#A63A2B` | Library-stamp vermilion: destructive actions, urgent flags, seals | ≈ 5.8:1 ✓ |
| `--color-stamp-deep` | `#7E2B1F` | Stamp hover/pressed, danger text | ≈ 8.3:1 ✓ |
| `--color-gild` | `#B98A2F` | Gilding — **graphics only** (ornament, open-book seal strokes) | ≈ 2.8:1 ✗ text |
| `--color-gild-deep` | `#7A5B14` | Stars/ratings as text or icon, focus on ink surfaces | ≈ 5.7:1 ✓ |
| `--color-focus` | = `ink` | Focus ring on light surfaces (2px outline + 2px offset) | 15.6:1 ✓ |
| (on ink surfaces) | = `paper` | Focus ring on footer/stamps | 15.6:1 ✓ |

**Usage rules**

- Paper is the maximum lightness; `#FFFFFF` pure white is **banned**, pure `#000000` is **banned**.
- Exactly one brand primary for actions: `leather`. `cloth` = swap/borrow semantics and secondary. `stamp` = destructive or "seal of urgency" only — never a generic CTA color. `gild` never carries text on paper.
- Tints: status chips & banners use `color-mix(in srgb, <token> 12%, var(--color-paper-raised))` — flat, never gradients.
- Status semantics (all with **text labels**, never color-alone): ACTIVE/متوفر = cloth tint · RESERVED/محجوز = gild-deep tint at 14% · COMPLETED/مكتمل = ink tint at 10% · CANCELLED/ملغى = stamp tint at 10%.
- Dark surfaces: footer and seals only (`ink` background, `paper` text). No dark mode in v1 — the metaphor is print, not OLED.

**Do / Don't**

- DO set long Arabic/English prose in `ink` on `paper`; keep ledger keys `ink-soft`.
- DO use `stamp` for date-due-style seals (e.g. "تم التبادل / COMPLETED EXCHANGE" stamp on exchange detail, M4) and destructive buttons.
- DON'T introduce new hues (no blue links — links are `ink` with `2px underline leather offset 3px`, hover turns `leather`).
- DON'T use `gild` for borders/text on paper; DON'T tint `rule` darker to fake text contrast; DON'T add drop shadows (only the hard `4px 4px 0 var(--color-rule-strong)` plate on cover hover, zero blur).

---

## 3. Typography

**Pairing (locked):** Fraunces + Newsreader (Latin) · Amiri + Noto Sans Arabic (Arabic).
Rationale: one "reading room" voice without sameness — Fraunces' wonky
high-contrast serif for display moments, Newsreader's text-cut serif for
continuous reading and dense ledgers, Amiri's classical Naskh for Arabic
display (Bulaq-press heritage, honest with the material), Noto Sans Arabic as
the workhorse UI face (full wght range, superlative small-size legibility).

**Rejected:** Playfair Display (fashion, not books), Cormorant Garamond
(wedding), Lora (generic), Inter/IBM Plex on this app (tech-neutral, breaks the
print thesis for Arabic too), Cairo (the default Arabic UI face — every Arabic
app uses it; our type must not be invisible), Amiri-as-UI (Naskh illegible at
13–15px and no true bold at text sizes), Noto Kufi Arabic (good, but geometric
monolinearity fights Fraunces' contrast; reserve-listed for nothing — we use
Noto Sans Arabic instead).

| Face | Role | Axes / weights | Subsets (next/font/google) | CSS var |
|---|---|---|---|---|
| **Fraunces** (variable) | Display: wordmark, headlines, book titles in hero, section № numerals | `opsz` 9–144, `SOFT` 0–100, `WONK` 0–1, `wght` 100–900, + italic | `latin`, `latin-ext` | `--font-fraunces` |
| **Newsreader** (variable) | Body/text: lede, review bodies, listing descriptions, ledger values, buttons, inputs, captions | `opsz` 6–72, `wght` 200–800, italic | `latin`, `latin-ext` | `--font-newsreader` |
| **Amiri** (static) | Arabic display only: hero H1, تبادل الكتب wordmark, Arabic section display lines (≥ 28px) | `400`, `700` (not variable) | `arabic` | `--font-amiri` |
| **Noto Sans Arabic** (variable) | All Arabic UI/body: nav, buttons, inputs, labels, ledger rows, captions, Arabic body prose | `wght` 100–900 | `arabic` | `--font-noto-sans-arabic` |

**next/font/google (spec — builder implements in `app/fonts.ts`):**

```ts
const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], axes: ['opsz', 'SOFT', 'WONK'], variable: '--font-fraunces', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin', 'latin-ext'], axes: ['opsz'], style: ['normal', 'italic'], variable: '--font-newsreader', display: 'swap' });
const amiri = Amiri({ weight: ['400', '700'], subsets: ['arabic'], variable: '--font-amiri', display: 'swap' });
const notoSansArabic = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-noto-sans-arabic', display: 'swap' });
```

Non-`wght` variable axes go in `axes:` — do **not** pass `weight` for variable
faces. Every Arabic face MUST declare `subsets: ['arabic']`; Arabic glyphs must
never fall back to system fonts. Fonts are self-hosted via next/font — no
runtime Google CDN, no `<link>` tags.

- Stacks: `--font-display: var(--font-fraunces), Georgia, 'Times New Roman', serif;` `--font-text: var(--font-newsreader), Georgia, serif;` `--font-ar-display: var(--font-amiri), 'Noto Naskh Arabic', serif;` `--font-ar-ui: var(--font-noto-sans-arabic), 'Noto Kufi Arabic', Tahoma, sans-serif;`
- Latin wordmark: Fraunces, `fontVariationSettings: '"opsz" 144, "SOFT" 50, "WONK" 1'`, weight 640ish (use `font-variation-settings`, not synthetic bold).
- Arabic wordmark: Amiri 700; tagline in Noto Sans Arabic 400.
- Mono (catalog №, ISBN, accession): system stack only — `ui-monospace, 'Cascadia Mono', Consolas, monospace`, `dir="ltr"`. **No webfont.**

**Type scale** (rem, 1rem = 16px; Arabic ×1.08 per §7)

| Token | Size / leading | Use |
|---|---|---|
| `xs` | 0.75 / 1.45 | captions, № markers, legal |
| `sm` | 0.875 / 1.5 | ledgers, hints, chips |
| `base` | 1.0 / 1.6 (ar 1.8) | body |
| `lg` | 1.125 / 1.6 | lede, card book title |
| `xl` | 1.375 / 1.35 | subheads |
| `2xl` | 1.75 / 1.3 | section heads (Newsreader 560 / Noto Sans Arabic 700) |
| `3xl` | 2.25 / 1.25 | page titles |
| `display` | `clamp(2.5rem, 6vw + 1rem, 4.25rem)` / 1.15 | home hero only (Fraunces WONK / Amiri 700) |

**Arabic typesetting law**

- **Never** `letter-spacing` on Arabic — not on one element, ever.
- Arabic body line-height ≥ **1.8**; Arabic UI ≥ 1.6.
- `:lang(ar) { font-size: 1.08em }` on the root body wrapper — Arabic glyphs read small at equal px.
- No full justification (`text-align: justify`) — ragged-right (start) only; no kashida stretching.
- Arabic punctuation: « » for quotes, ، ؛ ؟ — never Latin , ; ? inside Arabic prose.
- Latin digits inside Arabic prose for ISBNs/catalog № only, wrapped `<bdi dir="ltr">`; prose numerals via `Intl.NumberFormat('ar')` (Arabic-Indic ٠١٢٣).

---

## 4. Layout grammar

**Container:** `max-width: 75rem` (1200px), inline padding `clamp(1rem, 4vw, 2.5rem)`, margin-inline auto.
**Grid:** 12-col; catalog grid `repeat(auto-fill, minmax(150px, 1fr))` mobile → minmax(170px…) ≥ 1024px; cover art is always **2:3**.
**Spacing:** 4px base; section block spacing 3–5rem; ledger row min-height 3.5rem.

**Signature motifs (use deliberately, sparingly):**

1. **Hairline rules** — `1px solid var(--color-rule)`; every ledger row and card internal divider.
2. **Double rule** — footer top + masthead underline: `border-top: 1px solid var(--color-ink); box-shadow` no — use literal `border-block-start: 3px double var(--color-ink)` (CSS double border) or stacked 2px+1px pseudo rules. One per region, never two.
3. **Section labels** — small-caps/tracked Latin or leather Arabic bold + leading index: `03 — RECENTLY SHELVED` / `٠٣ — حديثًا على الرف`. Latin: `letter-spacing: .08em; text-transform: uppercase; font: 700 var(--fs-xs) Fraunces`; Arabic: Noto Sans Arabic 700, letter-spacing 0, leather.
4. **Index numbering** — catalogue accession style `№ 0142` in mono, `dir="ltr"`, ink-faint; used in ledger rows, empty states ("№ 0000 — لا نتائج"), section labels.
5. **Dotted leaders** (TOC-style) — label ····· value: flex baseline row, `.leader { flex:1; border-bottom: 2px dotted var(--color-rule); transform: translateY(-0.25em) }`. Book page metadata, settings summaries.
6. **Date-due stamps** — circular inked stamp (`stamp` or `cloth` stroke, rotated −8°, `mix-blend-multiply` on paper): empty states, exchange-completed moment. Max **one stamp per viewport**.
7. **Spine rail** (M3 profile shelves) — horizontal snap-scroll; spine = `writing-mode: vertical-rl`, solid `leather|cloth|stamp|ink` fields with blind double rules (`box-shadow: inset 0 0 0 1px paper, inset 0 .5rem 0 -0.35rem gild`), title legible bottom-to-top. Never use spines as primary navigation or on catalog cards.
8. **Cover fallback ("typographic cover")** — when `coverUrl` is null (all seeded books): `paper-deep` field, guilloche double border (`outline` + inner hairline), title in Fraunces/Newsreader set large, author below, publisher colophon at foot, cloth/leather/stamp field variants rotated deterministically by ISBN hash. Always 2:3, never stretched.

**Catalog card (canonical "catalog-card", spec — used M1+, shell preview in M0):**

```
┌─────────────────────────┐
│        COVER 2:3        │  paper-deep fallback if no image; next/image fill
│  (or typographic cover) │
├─────────────────────────┤
│ TITLE (Newsreader 560)  │  2 lines max, -webkit-line-clamp:2
│ Author (ink-soft)       │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤  hairline
│ № 0142   ٢٠١٩   (chip)  │  mono ltr + Intl digits; chip optional
└─────────────────────────┘
```

- Flat `paper-raised` + `1px var(--color-rule)` + `radius: 3px`; **no shadow at rest**.
- Hover (pointer:fine only): `transform: translateY(-2px)`; `box-shadow: 4px 4px 0 var(--color-rule-strong)` (hard plate, blur 0); focus-within identical. Active: translateY(0).
- Whole card is one `<a>` (stretched-link), title is the accessible name; images need real `alt="غلاف كتاب «title» — author" / alt="Cover of …"`.
- **Don't:** rounded-2xl, soft blur shadows, gradient borders, hover scale transforms, badge soup (max one chip per card).

**Do / Don't**

- DO left-align (start) everything; numerals tabular in ledgers; ISBNs always ltr.
- DO let whitespace and rules do the separating work — "less ink, more margin".
- DON'T center-stack catalog grids; DON'T full-width hero banners with background images; DON'T use `border-radius > 6px` except chips/avatars (999px).
- DON'T fake depth: only the hard hover plate and stamps are "elevated".

---

## 5. Component patterns (M0 scope)

All icons: inline SVG, 24×24 grid, `stroke: currentColor; stroke-width: 1.5; fill: none; stroke-linecap: round; stroke-linejoin: round`. Filled glyphs allowed only for star/bookmark states. **No emoji, ever.** Directional icons get `.icon-flip`; static icons (search, menu, close, check, star, bookmark, book, scale) do not.

### 5.1 Header / masthead
- Skip link first in DOM: «انتقل إلى المحتوى» / "Skip to content" — visually hidden until focused (ink on paper pill).
- Bar: paper bg, `border-block-end: 1px solid var(--color-ink)` + `3px double` on ≥md (masthead); height 4rem; container as §4.
- Start side: wordmark → home: **تبادل الكتب** (Amiri 700, 1.5rem) with mono `EST. ٢٠٢٦` sup in ltr? No ex-sup in v1 — wordmark only. Latin locale: **Bookshelf Exchange** (Fraunces WONK, SOFT 50, 640 weight, 1.25rem).
- Nav (desktop, inline end): الرئيسية/Home · sign-in OR (signed-in): حسابي/Account + تسجيل الخروج/Sign out. No dead links — Catalog link ships M1 with the page.
- Locale switcher (`locale-switcher`): two-option segmented control (العربية | English), `aria-pressed`, keeps current path via `usePathname`/router replace with opposite locale; keyboard reachable; ≥44px tall.
- End: primary small button «أنشئ حسابًا» / "Sign up" (leather) — hidden once authenticated (then Account + Sign out instead).
- Mobile: menu button (SVG burger → X morph via opacity, not rotation tricks), `aria-expanded`, `aria-controls="site-nav-panel"`, Escape closes; panel drops below bar with hairline top rule, links stacked, 44px rows; focus returns to button on close.
- `position: sticky; top: 0; z-index: 40;` with solid paper (no blur/transparency).

### 5.2 Footer / colophon
- `ink` background, `paper` text; top: `3px double var(--color-gild)`? No — gild on ink is fine for rule: `3px double rgba(247,243,234,.35)`.
- Grid: 3 cols desktop / stacked mobile: (1) wordmark + tagline «كلُّ كتابٍ يستحقُّ قارئًا ثانيًا» / *Every book deserves a second reader* + one-line colophon; (2) «الدليل / Guide`: الرئيسية، تسجيل الدخول، إنشاء حساب (existing routes only); (3) «اللغة / Language»: locale switcher repeat + availability note.
- Bottom row: hairline, then `© ٢٠٢٦ تبادل الكتب` (Intl digits) · «الطبعة الأولى — First Edition» · `github.com/Ahmadkhayatt/books-project` (external, `rel="noreferrer"`, icon does NOT flip).
- All links paper, hover → `gild`; focus-visible outline paper.

### 5.3 Buttons
`.btn` base: inline-flex, gap .5rem, align center, `min-height: 2.75rem` (44px — touch law), padding-inline 1.125rem, radius 3px, font Newsreader 560 / Noto Sans Arabic 600, `letter-spacing: 0` (Arabic) / `.01em` (Latin), transition 120ms flat.

| Variant | Rest | Hover | Pressed | Focus |
|---|---|---|---|---|
| `btn--primary` | leather bg / paper text | leather-deep | translateY(1px) | ink outline 2px + 2px offset |
| `btn--secondary` | transparent / ink text, 1px ink border | ink bg / paper text | translateY(1px) | same |
| `btn--ghost` | transparent / ink; underline offset 3px | leather text | — | same |
| `btn--danger` | stamp bg / paper text | stamp-deep | translateY(1px) | ink outline |
| disabled | paper-deep bg, ink-faint text, `aria-disabled`, no pointer | — | — | — |

Sizes: `sm` 2.5rem only inside dense toolbars (still ≥40px, warn <44 on mobile via review) · `md` 2.75rem · `lg` 3rem (hero CTAs). Icon-only buttons: square 2.75rem, `aria-label` mandatory.

### 5.4 Inputs & forms
- Label **always visible** above field (`text-sm`, ink-soft); required shown as «(مطلوب)» / "(required)" text, never bare asterisk.
- Field: `paper-raised` bg, `1px var(--color-rule)` border, radius 3px, min-height 2.75rem, padding .625rem .75rem; `font: base`; ltr direction for email/username/password/ISBN (`dir="ltr"` on those inputs).
- Focus: border-ink + `outline: 2px solid var(--color-focus); outline-offset: 2px`.
- Error: border stamp + `background: color-mix(in srgb, var(--color-stamp) 7%, var(--color-paper-raised))`; message below with `role="alert"`, stamp-deep, `aria-describedby` wired; icon = small SVG triangle-alert (not emoji).
- Hint: ink-faint `text-xs`; success: cloth check SVG + cloth-deep text (e.g. username available, M3+).
- Fieldsets grouped by ledger rows; forms never placeholder-only.

### 5.5 Empty / loading / error states
- **Empty**: centered column, max 26rem; stamp-ring SVG (80px, stroke stamp or cloth, rotated −8°, contains glyph); headline (Newsreader italic 560 / Amiri 700, xl size); one line of body (ink-soft); single CTA (primary or ghost). Copy examples: catalog empty → «لا نتائج لـ «…»» / "Nothing on this shelf yet"; wishlist empty → «لم تحفظ شيئًا بعد — ابدأ برفٍّ صغير» / "Nothing saved yet — start a small shelf". Index № `№ 0000` mono above headline.
- **Loading**: skeleton bars `paper-deep` blocks, `border-radius: 2px`, pulse via `@keyframes pulse { 50% { opacity: .55 } }` 1.6s ease-in-out infinite (opacity only — **no shimmer/gradient**); `aria-busy="true"` + visually-hidden «جارٍ التحميل…» / "Loading…". Cover-shaped skeletons (2:3) in catalog grids.
- **Error** (`error.tsx`): same stamp motif (broken-spine glyph); headline «انكسر الرفّ — حدث خطأ» / "The shelf gave way — something broke"; mono error code from digest when present; body one line + «حاول مرة أخرى» / "Try again" (secondary btn, resets boundary) + ghost link home. Never a bare stack trace, never apologetic hedging.
- **Not found** (`not-found.tsx`): «№ 404 — هذه الصفحة غير موجودة» / "№ 404 — This page is not on our shelves"; ghost CTA back home.

### 5.6 Chips / badges
Pill 999px, `text-xs`, padding .125rem .625rem, flat tint bg + matching deep text (§2 status semantics), 1px transparent border; max one per card; dot (8px SVG circle) before label optional — never color-dot alone.

### 5.7 Wordmark & seal
- Wordmark lockup (footer/home): تبادل الكتب over hairline over "BOOKSHELF EXCHANGE" (latin locales keep Amiri wordmark? No — locale-matched: AR shows Amiri line + latin small mono `TABĀDUL AL-KUTUB`? Keep: AR locale → Amiri تبادل الكتب only; EN → Fraunces Bookshelf Exchange).
- Seal (about/404/exchange-completed): 88px ring, double stroke, `stamp` color, text on circle path «تبادل الكتب • EST. ٢٠٢٦ •» / "BOOKSHELF EXCHANGE • EST. 2026 •" (SVG `<textPath>`), center open-book glyph. Rotated −8°, `mix-blend-multiply`, decorative `aria-hidden="true"` (meaning conveyed by adjacent text).

### 5.8 Ledger row
`.ledger-row { display: flex; align-items: baseline; gap: 1rem; padding-block: .625rem; border-block-end: 1px solid var(--color-rule); }` label `ink-soft text-sm` · `.leader` (§4.5) · value `ink, tabular-nums, dir=ltr for numerals/ISBN, text-align: end`. Row hover (when link): bg paper-deep 40%.

---

## 6. Home shell (M0) layout spec
Asymmetric editorial index, **not** hero+3-cards:
- Masthead (§5.1) → hero: grid 12-col; col-span 7/12: kicker mono `TABĀDUL — ٢٠٢٦` + H1 Amiri 700/d: «كلُّ كتابٍ يستحقُّ قارئًا ثانيًا» (EN: Fraunces WONK «Every book deserves a second reader») + lede (Newsreader 1.125) + CTA row (primary «أنشئ حسابًا، مجانًا» / "Create a free account" + ghost «تسجيل الدخول» / "Sign in"). col 8/12 right edge (RTL: mirrored): vertical ornament — oversized mono `№ ٠٠١` watermark? No watermark (ink noise) — instead a single typographic-cover collage? M0 has no images: use the **seal** (§5.7) at 160px, rotated, plus vertical mono `EST. ٢٠٢٦`. Quiet, not loud.
- Below: double rule, then **ledger of principles** — three hairline-separated rows (not cards): `٠١ اعرض نُسختك` / `٠٢ اعثر على ضالّتك` / `٠٣ تبادَل واكسب سمعة` each with one-line gloss (see messages/*.json) — numbers Fraunces WONK 3xl leather, text ink; rows reveal on load (opacity/translate 300ms, stagger 80ms, disabled under reduced-motion).
- Then colophon strip: ink-soft xs: «تبادل الكتب — مكتبة تبادل القرّاء، مفتوحة للجميع» + locale note. Footer.
- `/en` mirrors exactly (copy in en.json, layout unchanged, `dir=ltr`).

---

## 7. RTL (Arabic-first, server-side `dir`)

- `<html dir>` is set **server-side** in `app/[locale]/layout.tsx` from the locale param (`ar→rtl`, `en→ltr`); never client-side, never a class toggle. Unknown locale → `notFound()`.
- **Logical properties only** in all CSS: `margin-inline-*`, `padding-inline-*`, `inset-inline-*`, `border-inline-*`, `text-align: start|end`. **Zero `left`/`right` declarations.** Tailwind: `ms-* me-* ps-* pe-* start-0 end-0 text-start text-end rounded-s-* rounded-e-* border-s border-e` — never `ml/mr/pl/pr/left/right/text-left/text-right`.
- Flex/grid with `start/end`; auto-placement mirrors naturally.
- **Icon flip law**: `[dir="rtl"] .icon-flip { transform: scaleX(-1) }` — flip: arrows (→←), chevrons, back/forward, reply, undo/redo, pagination prev/next, outdent/indent, "external link"? NO — external-link never flips. Never flip: logo/wordmark, seal, book, star, bookmark, heart, search, menu, close, check, plus, trash, user, tag.
- **Bidi isolation**: ISBNs, URLs, emails, Latin usernames/@handles, prices with Latin digits, code → `<bdi dir="ltr">` or `dir="auto"` on mixed strings; standalone Latin blocks `dir="ltr"`. Numbers in Arabic prose via `Intl.NumberFormat('ar')` (Eastern Arabic-Indic digits ٠١٢…); catalog №/ISBN/accession always Latin digits inside `dir="ltr"`.
- Dates: `Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', …)`.
- `:lang(ar)` size bump ×1.08 and body line-height 1.8 (§3); no letter-spacing (§3 law).
- `text-align: justify` banned both locales; `start` only.
- **Arabic copy proofing process** (every milestone): (1) copy is written in MSA first in `messages/ar.json` (warm, bookish register — e.g. «حيثُ تجدُ القصّةُ قارئَها التالي»), never lorem/English-first-then-"translate"; (2) `messages/en.json` mirrors it key-for-key, idiomatic English — translator mindset, not word-for-word; (3) `npm run i18n:check` (scripts/check-i18n.mjs) — key parity, non-empty values, bidi-dangerous-key audit (`*isbn*`, `*url*`, `*email*`, `*username*`, keys containing digits/Latin) asserts a `dir="ltr"`/`<bdi>` wrapper is documented; (4) native-speaker pass (or back-translation review) on all new copy before merge — reviewer reads the Arabic aloud; (5) `/ar` screenshot pass at mobile+desktop per PR; layout is checked in **both** directions every PR, not "LTR now, RTL later".
- Common Arabic traps the reviewer rejects: literal SV-order translations; Latin punctuation inside Arabic sentences; mixed-direction strings without isolation; acronyms in Arabic (use «ISBN» bare, it's a proper term); Western digits in Arabic prose; kashida abuse; "translationese" (استخدم instead of استعن in literary contexts).

---

## 8. Accessibility targets

- **WCAG 2.2 AA** overall; text contrast ≥ 4.5:1 (≥ 3:1 large text ≥ 24px/18.66px bold); non-text UI ≥ 3:1; §2 table already complies — do not add text colors below those ratios.
- `:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px }` everywhere; **never** `outline: none` without replacement; focus order = visual order; focus ring switches to `paper` on ink surfaces (footer).
- Touch targets ≥ **44×44px** (buttons, nav rows, switcher segments, chips-as-buttons); spacing between adjacent targets ≥ 8px.
- Skip link; landmarks (`header/nav/main/footer`); `h1–h6` hierarchy never skipped; `main` gets `id="content"`.
- Every interactive element keyboard-operable; no hover-only affordances (hover styles are enhancements); `prefers-reduced-motion`: disable skeleton pulse, hover lifts, hero row stagger.
- Icon-only buttons: `aria-label` (Arabic when AR locale). Star rating displays: visual stars + `<span class="sr-only">٤ من ٥</span>`. Decorative SVGs `aria-hidden="true"`.
- Forms: label association, `aria-describedby` hints/errors, `aria-invalid`, `role="alert"` errors announced on submit; success via `role="status"` polite.
- Color never sole signal: chips carry text; rating stars also numeric; error fields carry icon+text.
- `dir="rtl"` correct on `<html>`; lang switcher updates `<html lang>`; zoom 200% reflows without loss (no fixed px heights on text containers; catalog grid collapses to 2-col at 320px).
- Screen-reader smoke: NVDA + Firefox for `/ar` once per milestone; VoiceOver optional.

---

## 9. Imagery & iconography
- Photography: none in v1 (no stock). Books provide the imagery.
- Seeded books: `coverUrl = null` → typographic covers (§4.8). Real covers via Open Library `?default=false` 404 → same fallback.
- Icons: §5 set (stroke 1.5, round caps). Allowed glyphs: arrow, chevron, search, menu, close, check, bookmark, star (fill), book, scale, user, tag, alert-triangle, info, plus, trash? (destructive = stamp), external (no flip). **Emoji are never icons.**
- Illustrations: the seal (§5.7) and stamp motifs only; no blobs, no isometric people, no "undraw".

---

## 10. Tailwind v4 mapping (spec for globals.css)

```css
@import "tailwindcss";
@theme {
  --color-paper: #F7F3EA;  --color-paper-deep: #EDE7D8;  --color-paper-raised: #FCFAF2;
  --color-ink: #1E1A16;    --color-ink-soft: #4A443C;    --color-ink-faint: #655E52;
  --color-rule: #D8D2C4;   --color-rule-strong: #C5BFB0;
  --color-leather: #7A4A2B; --color-leather-deep: #5A3418;
  --color-cloth: #3E5C50;   --color-cloth-deep: #2C443A;
  --color-stamp: #A63A2B;   --color-stamp-deep: #7E2B1F;
  --color-gild: #B98A2F;    --color-gild-deep: #7A5B14;
  --font-display: var(--font-fraunces), Georgia, serif;
  --font-text: var(--font-newsreader), Georgia, serif;
  --font-ar-display: var(--font-amiri), serif;
  --font-ar-ui: var(--font-noto-sans-arabic), Tahoma, sans-serif;
  --radius-card: 3px; --radius-input: 3px;
}
:lang(ar) { font-size: 1.08em; }
[dir="rtl"] .icon-flip { transform: scaleX(-1); }
```

Utility classes defined once in `globals.css` (not inline spaghetti):
`.double-rule`, `.ledger-row`, `.leader`, `.section-label` (+`.section-label__index`),
`.chip`, `.stamp` (rotation −8°, multiply), `.skeleton` (pulse), `.skip-link`.
**No** `tailwind.config.js` — CSS-first only.

---

## 11. Design review checklist (per PR)
1. Both locales screenshotted (mobile 390px + desktop 1280px) — `/ar` RTL mirrors correctly, no left/right leaks, numerals correct.
2. Contrast holds for any new text/icon (AA); focus-visible visible on every new interactive element; tab order sane.
3. No gradients/glass/glow/emoji/pure-white/pure-black introduced; radius ≤ 3px (chips excepted); no soft shadows.
4. Arabic copy is real MSA (not translated-English); `i18n:check` passes; bdi/`dir=ltr` wraps on ISBNs/URLs/usernames; no letter-spacing on Arabic.
5. Covers remain 2:3; card rests flat; hover plate only; one chip max per card.
6. Empty/loading/error states exist for any new async surface — flat skeleton, no spinners-on-blank, no "Oops".
7. Touch targets ≥ 44px; reduced-motion respected; headings hierarchical.

## 12. One-line summary
**Paper, ink and one leather-bound CTA: a card catalogue that trades books — set in Fraunces & Amiri, laid on ledgers, flipped honestly for Arabic.**
