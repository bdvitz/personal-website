# CLAUDE.md

Personal website monorepo (Bryan Vitz). Next.js frontend on Vercel + Spring Boot backend on Railway (free tier) + Railway Postgres. Both auto-deploy from `main`.

## Layout
```
client/                      Next.js 16 App Router, TS (strict off), Tailwind, `@/*` -> client/*
  app/page.tsx               Home
  app/algorithms/            Markdown articles from client/content/algorithms/*.md (gray-matter, KaTeX)
  app/chess/                 Chess stats page (see skill: chess-stats)
  app/cubing/, cubing/mosaic Rubik's cube mosaic tool (client-only; logic in lib/mosaic/)
  components/Navigation.tsx  Nav items array - add new top-level pages here
  lib/api.ts                 All backend calls (axios, NEXT_PUBLIC_API_URL)
  types/chess.ts
server/                      Spring Boot 3.2, Java 21, package com.bdvitz.codingstats
  controller/ service/ repository/ model/ scheduler/ config/
scripts/update-snapshot.sh   Regenerates client/public/data/stored-user-snapshot.json
```

## Skills (load on demand instead of re-exploring)
- `chess-stats` - chess subsystem: endpoints, tables, scheduler, snapshot, client page flow
- `party-games` - planned multiplayer phone games: architecture decisions + free-tier constraints

## Token hygiene
- NEVER read: `client/public/data/stored-user-snapshot.json` (~190 KB), `client/package-lock.json`, `node_modules/`, `client/public/**` images.
- `client/app/chess/page.tsx` is ~880 lines; read by line range when possible.
- Older docs (README, ARCHITECTURE, docs/*, QUICKSTART, DEPLOYMENT, SNAPSHOT_SYSTEM, server/RAILWAY_MEMORY_OPTIMIZATION) are partly stale. Only open when a task needs deploy/setup specifics; trust code over docs.

## Commands
- Client: `cd client && npm run build` (best type/compile check), `npm run dev`, `npm run lint`
- Server: `cd server && mvn -q clean compile` (compile check), `mvn spring-boot:run -Dspring-boot.run.profiles=local`
- There are no automated tests in either app; verify with build/compile.
- Local secrets: `server/src/main/resources/application-local.properties`, `client/.env.local` (both gitignored - never commit).

## Constraints that shape design
- Railway free tier, 500 MB RAM. application.properties caps: Hikari pool 3, Tomcat `threads.max=20`, `max-connections=20`, `lazy-initialization=true`. Anything long-lived (WebSockets) must account for these.
- Server may cold-start/sleep; frontend is designed to render from static snapshot first.
- JPA `ddl-auto=update` - adding entity fields alters tables automatically; no migrations.
- No auth anywhere. Any public endpoint is callable by anyone; don't expose endpoints that trigger outbound API calls or heavy work.

## Conventions
- Java: constructor injection in services (some controllers still use field `@Autowired`), SLF4J logging, controllers return `ResponseEntity<?>` with `Map.of("error", msg)` on failure.
- UI: purple/glass-morphism Tailwind style (`card`, `btn-primary` classes in globals.css), lucide-react icons, mobile-friendly.

## Current initiative (2026-09)
1. Chess: DONE on branch `chess-db-only`. Clients read DB/snapshot only, and the nightly/startup job refreshes stats + daily history. Deferred: automating snapshot regeneration.
2. Party games for Bryan's 30th birthday, added to this same deployment under `/party`. Details in `party-games` skill.
