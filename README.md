# Bookshelf Exchange · تبادل الكتب

A readers' exchange library — اعرض نُسختك، اعثر على ضالّتك، وتبادَل مع قارئ آخر.

## Prerequisites

- Node.js **>= 22** (`.nvmrc` pins 22)
- Docker (PostgreSQL 17 runs via `docker-compose.yml` on host port `5433`)

## Quickstart

```bash
docker compose up -d
npm install
npx prisma@7 migrate dev
npm run dev
```

Open http://localhost:3000 — the Arabic home page is served at `/ar`, English at `/en`.

## House rules

- **npm only.** Prisma is pinned to v7: use `npx prisma@7 …` for one-off shell calls.
- `.env` is local-only (copy `.env.example`); it is never committed.
- Arabic is the default locale and RTL is set on the server.

## Docs

- `PLAN.md` — architecture, data model, milestones.
- `DESIGN.md` — paper/ink/leather design system, typography, RTL law.
