# Handoff — Resume Point (2026-11-05)

## Blocker (why we stopped)

**Free-model usage limit reached** (`Free usage limit reached. Free models work
in OpenCode; subscribe to OpenCode Go to keep going: https://opencode.ai/go`).
Both the orchestrator's M1 builder dispatch and the resume dispatch died
immediately. Retry later — no other blockers exist.

## Current git state

- Repo: `books-project/` → GitHub `Ahmadkhayatt/books-project`
- `main` @ `aa99dcf` — **pushed** (matches origin/main). M0 DONE + verified.
- `feat/m1-catalog` @ `67c89b7` — **pushed** ("milestone 1 (m1) wip: interrupted
  builder state (unverified, partial)") — **worktree CLEAN**, nothing left
  uncommitted on the branch.
- Working branch: `feat/m1-catalog` (checked out). `main` and `feat/m0-scaffold`
  also at `aa99dcf`.
- Quota window unknown (5 min – 24 h). No DB/DB-service involvement in the halt.

## What's in the M1 commit (24 files, +3666 lines)

New files (untracked→committed):
- `app/[locale]/books/new/actions.ts` (ISBN add flow server actions)
- `components/{add-book-form,book-cover,catalog-card,comment-item,empty-state,like-form,notice-banner,rating-input,rating-summary,review-card,submit-button}.tsx`
- `lib/{books,isbn,openlibrary-map,openlibrary}.ts`
- `tests/{isbn,openlibrary-map}.test.ts`
- `PR_BODY.md` (M0 leftover, untracked→committed as part of this WIP file set)

Modified:
- `app/globals.css`, `components/icons.tsx`, `lib/utils.ts`
- `messages/ar.json` + `messages/en.json` (new M1 keys — unverified count/parity)

**IMPORTANT — this is PARTIAL, unverified work.** It was produced by a builder
that died mid-implementation on a quota crash; it has NOT been run through
verify/review/merge. Treat it as a draft skeleton, not a milestone.

## M1 remaining (contract: .opencode/plans/m1-catalog.md)

1. Read the existing code on `feat/m1-catalog` (the committed draft above)
   against the contract; complete missing pieces and fix violations.
2. Cover: `/[locale]/books` (browse + paginated), `/[locale]/books/[id]`
   (detail + ratings + reviews + comments + likes), `/[locale]/books/new`
   (ISBN → Open Library autofill → create). Zero migrations allowed.
3. Verify (in repo): `npm install`, `npm run i18n:check` (ar==en, >76 keys),
   `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
   (incl. once with Postgres DOWN), dev-server 200s both locales, psql
   checks (dedupe, upsert, zero activity_events), ISBN round-trip, idempotency,
   tombstone checks, screenshots.
4. Reviewer pass on `main...feat/m1-catalog`; fix criticals/majors (cap 4
   fix-cycles per milestone) until `VERDICT: CLEAN`.
5. Merge locally to `main` + push `origin main` (orchestrator does this ONLY
   after Verify + Reviewer gates pass). Then proceed M2→M6 in order
   (PLAN.md §5) — PRs are OFF (user decision 2026-11-05); `gh` is not used;
   do not stop on gh auth.

## Boundaries & infra to honor on resume

- Hard boundary: only `books-project/**` (+ `.opencode/plans/**` state).
  Never `site/`, never system/user folders, no global installs.
- Postgres: Docker container `bookshelf_exchange_pg` / volume
  `bookshelf_exchange_pgdata`, local-only on 127.0.0.1:5433→5432. Accepted as
  the sole outside-workspace runtime effect.
- `.env` is gitignored (confirm before any commit). Prisma 7 pinned
  (`npx prisma@7`), Next 16.4.3, Auth.js v5 JWT split.
- Branching: `feat/<slug>` per milestone, small commits
  "milestone N (mN) <scope>: <summary>", push branch, orchestrator merges
  after gates. Never push `main` directly from builder.

## Loop state

See `.opencode/plans/loop-state.md` (milestones M0 DONE, M1–M6 PENDING,
environment facts, blocker log, M0 verification table).
