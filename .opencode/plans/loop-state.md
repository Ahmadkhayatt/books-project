# Loop State — Bookshelf Exchange

Mission: build Bookshelf Exchange in `books-project/` (GitHub `Ahmadkhayatt/books-project`).
Target: Next.js + TypeScript, PostgreSQL + Prisma, Auth.js, Tailwind, Arabic-first RTL + English.

| # | Milestone | Status | Branch | PR | Fix-cycles |
|---|-----------|--------|--------|----|------------|
| M0 | Scaffold (git, docker-compose, Next.js, Prisma v1, Auth.js, i18n+RTL, DESIGN.md) | DONE | main @ aa99dcf (pushed) | n/a (PRs off) | 0 |
| M1 | Catalog + ISBN add + book page (ratings/reviews/comments/likes) | IN PROGRESS — builder complete & verified locally (lint/typecheck/test 27-27/build/dev 200s all PASS, DB checks deferred per no-docker instruction); reviewer 1 MAJOR + 6 MINOR; fix-cycle 1 applied, committed @6653906 pushed, UNVERIFIED after quota crash — needs re-verify + re-review before merge | feat/m1-catalog @ 6653906 | n/a | 1 |
| M2 | Listings + wishlist + search/filters | PENDING | — | — | 0 |
| M3 | Profiles, follows, reading lists, activity feed | PENDING | — | — | 0 |
| M4 | Messaging + exchange complete + mutual ratings + reputation | PENDING | — | — | 0 |
| M5 | Reports + admin panel + rate limiting | PENDING | — | — | 0 |
| M6 | Seed data + tests + empty/loading/error states + README + bilingual/mobile QA | PENDING | — | — | 0 |

## PRs off (user decision 2026-11-05)

The pipeline no longer uses GitHub PRs. `gh` is not authenticated and must not
be used; do NOT block on `gh` auth again. Merges happen locally: builder works
on a `feat/<slug>` branch (or directly on `main` for trivial work), commits in
small steps, and the orchestrator merges/pushes to `main` ONLY after its own
Verify + the Reviewer's `CRITICAL/MAJOR=0` gate passes. Main remains the
`origin/main` remote branch (verified present and pushed).

- gh CLI 2.96.0 present; git identity `khayat / khayyat2003@gmail.com`.
- No raw psql on PATH → PostgreSQL runs via Docker (dev only). Accepted runtime
  exception outside the workspace: local docker container `bookshelf_exchange_pg`
  + volume `bookshelf_exchange_pgdata`, local-only port.
- Repo `books-project/` cloned from `https://github.com/Ahmadkhayatt/books-project.git`,
  empty on `main` (no commits yet).
- Hard boundary: builder may only touch `books-project/**` (+ orchestrator state
  in `.opencode/plans/**`). `site/` scaffold is out of scope for this loop.

## Open blockers (impossible autonomously — require human)

- **BLOCKED-BY-CREDENTIALS — gh auth**: `gh` is not authenticated
  (`gh auth status` → not logged into any GitHub hosts). Pipeline policy: do NOT
  store credentials.
- **BLOCKED-BY-CREDENTIALS — no `main` on remote**: `git ls-remote --heads origin`
  shows only `refs/heads/feat/m0-scaffold`.

RESOLUTION (per user instruction 2026-11-05 — PRs not needed): `main` created
locally at `aa99dcf` and pushed to `origin/main` (Git remote = `main -> main`).
User directed: merge `feat/m0-scaffold` into `main` locally (done, fast-forward —
`feat/m0-scaffold` deleted, local `main` == `origin/main`), push `main` to GitHub,
and from now on commit per milestone directly to `main` (or a `feat/*` branch
merged locally when verified). **PRs and `gh` auth are NO LONGER part of the
pipeline.** New flow: builder implements on `main`-based branch or directly,
commits, pushes after orchestrator Verify + Reviewer gates pass. `gh` is
not to be used; do not stop on gh auth again.

## M0 verification (builder + orchestrator) — all PASS

| Check | Result |
|---|---|
| npm install | PASS (postinstall warnings only) |
| npm run i18n:check | PASS (ar 76 = en 76) |
| npm run lint | PASS |
| npm run typecheck | PASS |
| npm test | PASS (Vitest 5/5) |
| npm run build | PASS (incl. with Postgres down) |
| prisma migrate status | PASS (1 init migration applied) |
| dev server /ar /en | PASS (200, correct lang/dir) |
| /api/health | PASS (ok:true, db:up) |
| auth round-trip | PASS (sign-up/sign-in/sign-out, no passwordHash leak) |
| screenshots (ar/en × 390/1280) | PASS (committed to branch) |

Branch `feat/m0-scaffold` @ `aa99dcf` pushed to origin. PR_BODY.md at
`books-project/PR_BODY.md` (untracked, ready for PR creation).
