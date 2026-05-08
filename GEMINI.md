# GEMINI.md

This file is read by Gemini Code at the start of every session. Keep it up to date as the project evolves.

---

## What this project is

Match Point is a Next.js monolith for tracking scores, history, and matchmaking in racket sports (badminton, tennis, padel). Users can score matches without an account. Registered users get persistent history, groups, and stats. Live scoreboards are shared via a single URL and sync in real time via Pusher.

Full context: `README.md`, `ARCHITECTURE.md`, `TECHSTACK.md`, `ROADMAP.md`.

---

## Stack — quick reference

| Concern | Tool |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Hosting | Vercel |
| Real-time | Pusher Channels |
| Database | Neon (Postgres) via Prisma |
| Cache | Upstash Redis |
| Auth | JWT via `jose` (guest + registered) |
| Design | Pencil.dev (`.pen` files in `designs/`) |

---

## Project structure

```
match-point/
├── app/
│   ├── (guest)/            # No auth required
│   ├── (auth)/             # Login required
│   ├── match/[id]/         # Live scoreboard
│   ├── group/[id]/         # Group dashboard
│   └── api/                # All Route Handlers (backend)
├── components/
│   ├── ui/                 # shadcn/ui — do not edit manually
│   ├── scoreboard/
│   ├── matchmaking/
│   └── stats/
├── designs/                # Pencil.dev .pen files
├── lib/
│   ├── prisma.ts           # Prisma singleton — always import from here
│   ├── pusher.ts           # Pusher server + client
│   ├── redis.ts            # Upstash client
│   ├── auth.ts             # JWT helpers
│   └── scoring/            # Sport engines
│       ├── engine.ts       # ScoringEngine interface
│       ├── badminton.ts
│       ├── tennis.ts
│       └── padel.ts
├── prisma/
│   └── schema.prisma
├── types/                  # Shared TypeScript types
├── middleware.ts            # Auth + guest identity
├── GEMINI.md               # This file
└── designs/                # Pencil.dev .pen files — read before building UI
```

---

## Conventions

### General
- All files in TypeScript. No `.js` files.
- Use `async/await` — no `.then()` chains.
- Prefer `const` over `let`. Never use `var`.
- No `any` types. Use `unknown` and narrow, or define a proper type in `types/`.
- Export types from `types/` — not inline in component files.

### Components
- All UI components use **shadcn/ui** as the base. Check `components/ui/` before building something from scratch.
- Custom components go in `components/{domain}/` (e.g. `components/scoreboard/ScoreButton.tsx`).
- Use Tailwind for all styling. No inline styles. No CSS modules.
- Dark mode is supported from day one — always use semantic Tailwind classes (`bg-background`, `text-foreground`) not hardcoded colors (`bg-white`, `text-black`).
- Component files are PascalCase. Utility/hook files are camelCase.

### API routes
- All backend logic lives in `app/api/` as Route Handlers.
- No Express. No separate backend server.
- Every Route Handler follows this structure:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // logic here
    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- Extract identity from request headers (set by middleware):

```ts
const identity = JSON.parse(req.headers.get('x-identity') ?? '{}')
```

### Database
- Always import Prisma from `@/lib/prisma` — never instantiate `new PrismaClient()` directly.
- Never write raw SQL unless there is a clear performance reason. Use Prisma query API.
- All schema changes go through `prisma/schema.prisma` + `npx prisma migrate dev`.
- Never mutate the database directly in a Server Component — use Route Handlers or Server Actions.

### Redis
- Import from `@/lib/redis`.
- Match state key pattern: `match:{id}:state` — TTL 3600s.
- Rate limit key pattern: `ratelimit:{ip}:{route}` — TTL 60s.
- Redis is always a cache. Postgres is always the source of truth. Never store data in Redis that doesn't also exist in Postgres.

### Real-time (Pusher)
- Import server instance from `@/lib/pusher` as `pusherServer`.
- Import client instance from `@/lib/pusher` as `pusherClient`.
- Channel naming: `match-{id}` (public), `private-match-{id}` (scorers), `presence-match-{id}` (presence).
- Events: `score:update`, `match:complete`, `match:undo`.
- Trigger Pusher **after** writing to Redis and Postgres — never before.

```ts
await pusherServer.trigger(`match-${matchId}`, 'score:update', newState)
```

### Auth
- Guest token: JWT stored in localStorage, sent as `Authorization: Bearer {token}`.
- User token: JWT stored in `httpOnly` cookie named `token`.
- Both are decoded by middleware and injected as `x-identity` header.
- Never check auth manually in a Route Handler — read from `x-identity`.
- Guest-to-user promotion: on register, link all matches where `guestId` matches the guest token's `sub`.

---

## Scoring engine

Every sport implements `ScoringEngine` from `lib/scoring/engine.ts`:

```ts
interface ScoringEngine {
  sport: 'badminton' | 'tennis' | 'padel'
  initialState(): MatchState
  applyPoint(state: MatchState, team: 0 | 1): MatchState
  isMatchOver(state: MatchState): boolean
  winner(state: MatchState): 0 | 1 | null
  displayScore(state: MatchState): string
}
```

**To add a new sport:**
1. Create `lib/scoring/{sport}.ts` implementing `ScoringEngine`
2. Add the sport to the `Sport` union type in `types/`
3. Register it in `lib/scoring/engine.ts` engine map
4. Add format options to the match creation UI
5. That's it — no changes to API routes or the scoreboard component

Never hardcode sport-specific logic outside of `lib/scoring/`.

---

## Design workflow

1. Check `designs/` for a `.pen` file before building any screen or component.
2. If a `.pen` file exists: read it and generate the component from the canvas.
3. If no `.pen` file exists: ask before building — the screen may not be designed yet.
4. All designs are portrait-first (mobile). Every screen ships both a dark and a light mode variant in the same `.pen` file.
5. After generating a component, note any design decisions that deviated from the canvas.
6. `.pen` files and their generated components are committed together in the same PR.

---

## Environment variables

```bash
# Database
DATABASE_URL=                  # Neon Postgres connection string

# Redis
UPSTASH_REDIS_REST_URL=        # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=      # Upstash Redis REST token

# Pusher
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
NEXT_PUBLIC_PUSHER_KEY=        # Public — safe to expose to client
NEXT_PUBLIC_PUSHER_CLUSTER=    # Public — safe to expose to client

# Auth
JWT_SECRET=                    # Long random string, never expose
```

All variables prefixed `NEXT_PUBLIC_` are exposed to the browser. Everything else is server-only.

---

## Do not

- Do not install Socket.io — Pusher handles real-time.
- Do not create an Express server — Route Handlers handle the API.
- Do not instantiate `new PrismaClient()` — import from `@/lib/prisma`.
- Do not use `any` types.
- Do not hardcode sport rules outside `lib/scoring/`.
- Do not add UI components without checking `components/ui/` first.
- Do not write to Redis without also writing to Postgres.
- Do not build a screen without checking `designs/` first.
- Do not use `localStorage` in a Server Component — it doesn't exist server-side.
- Do not use hardcoded colors in Tailwind (`bg-white`) — use semantic tokens (`bg-background`).

---

## Common tasks

**Add a new API route**
Create `app/api/{resource}/route.ts`. Follow the Route Handler structure above. Add auth check via `x-identity` header if needed.

**Add a new sport**
See scoring engine section above. One file, no other changes.

**Add a new shadcn component**
```bash
npx shadcn@latest add {component}
```
This adds to `components/ui/` — do not edit those files manually.

**Run database migration**
```bash
npx prisma migrate dev --name {description}
```

**Open Prisma Studio (local DB browser)**
```bash
npx prisma studio
```

**Deploy**
Push to `main`. Vercel auto-deploys. Check the Vercel dashboard for build logs.
