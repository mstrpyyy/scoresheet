# Architecture

Match Point is a Next.js monolith. One app handles everything — UI, API, authentication, and real-time event triggering. External services (Pusher, Neon, Upstash) handle the infrastructure concerns that don't belong in a serverless app.

---

## High-level overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser / Client                  │
│                                                      │
│   Next.js pages + components (React)                 │
│   Pusher JS client (real-time subscription)          │
└────────────┬─────────────────────────┬───────────────┘
             │ HTTP / Server Actions    │ WebSocket
             ▼                         ▼
┌────────────────────────┐    ┌─────────────────────┐
│   Vercel (Next.js)     │    │   Pusher Channels   │
│                        │    │                     │
│   App Router (UI)      │    │  match-{id} channel │
│   Route Handlers (API) │───▶│  score:update event │
│   Server Actions       │    │  presence tracking  │
│   Middleware (auth)    │    └─────────────────────┘
└────────┬───────────────┘
         │
         ├──────────────────────────────────┐
         ▼                                  ▼
┌─────────────────────┐          ┌─────────────────────┐
│   Neon (Postgres)   │          │   Upstash (Redis)   │
│                     │          │                     │
│   Persistent data   │          │   Active match state│
│   Match history     │          │   Rate limiting     │
│   Player profiles   │          │   (3600s TTL)       │
│   Score events      │          └─────────────────────┘
└─────────────────────┘
```

---

## UI/UX workflow

Design and code live in the same repository. There is no handoff step.

### Pencil.dev

[Pencil.dev](https://pencil.dev) is an agent-driven design platform embedded directly into VS Code. Designs are saved as `.pen` files — an open JSON-based format that is versioned, branched, and merged alongside code in Git.

The MCP integration means Claude Code can read the canvas and write React/Tailwind components directly from the design. When spacing or layout changes in the canvas, Claude Code syncs the component. Design and implementation stay in sync without manual translation.

### Design file structure

```
designs/
├── scoreboard.pen       # Core scoring screen (portrait + landscape)
├── matchmaking.pen      # Team generation flow
├── session.pen          # Session overview, match list
├── profile.pen          # Player profile, stats
├── group.pen            # Group dashboard
└── components.pen       # Shared component library (buttons, cards, badges)
```

### Workflow loop

```
1. Sketch screen in Pencil canvas (VS Code)
         │
         ▼
2. Prompt Claude Code:
   "Look at scoreboard.pen and generate the
    React component using Tailwind and shadcn/ui"
         │
         ▼
3. Claude Code reads canvas via MCP → writes component
         │
         ▼
4. Review in browser, adjust in canvas
         │
         ▼
5. Prompt Claude Code to sync changes
         │
         ▼
6. Commit .pen file + component together
```

Both the `.pen` design file and the generated component are committed in the same PR. Design history and code history are unified.

### Design conventions

**Portrait-first.** The scoreboard is used courtside on phones, often one-handed. All screens are designed for portrait mobile first, then adapted for tablet/desktop.

**shadcn/ui as the component base.** Components in `components/ui/` come from shadcn. Custom sport-specific components (scoreboard, score button, match card) are built on top. Pencil's canvas reflects this — shadcn primitives are the atoms, custom components are the molecules.

**Dark mode from day one.** Courts are often outdoors. Dark mode reduces glare and is easier to read in bright sunlight. All designs have both light and dark variants.

---

## Request flow

### Scoring a point (the core action)

This is the most frequent and most latency-sensitive operation in the app. It needs to feel instant.

```
1. Player taps score button
      │
      ▼
2. Optimistic UI update (client-side, immediate)
      │
      ▼
3. POST /api/matches/[id]/score  (Route Handler)
      │
      ├─ Read current state from Upstash Redis
      ├─ Apply scoring logic (sport engine)
      ├─ Write new state to Redis (fast, replaces DB read on next tap)
      ├─ Write ScoreEvent to Neon Postgres (async, persistent log)
      └─ Trigger Pusher event → match-{id} channel
              │
              ▼
4. All connected clients receive score:update
      │
      ▼
5. UI updates across all devices simultaneously
```

Redis sits in front of Postgres for match state so each tap doesn't do a full DB round-trip. Postgres still gets every event — it's the source of truth for history and stats — but it's written to asynchronously and doesn't block the response.

---

### Joining a live match (via shared link)

```
1. Player opens match URL: /match/[id]
      │
      ▼
2. Next.js Server Component fetches match state
      │
      ├─ Check Redis for active state (cache hit → fast)
      └─ Fallback to Postgres if Redis miss (cold start / TTL expired)
      │
      ▼
3. Page renders with current score
      │
      ▼
4. Pusher JS client subscribes to match-{id} channel
      │
      ▼
5. All subsequent score updates arrive via Pusher (no polling)
```

No login required to view or follow a match. The match URL is the access token for spectators.

---

### Authentication flow

```
Guest visit (first time)
      │
      ▼
Middleware generates anonymous guest JWT
      │
      ├─ Stored in localStorage
      └─ Attached to all API requests as Bearer token
      │
      ▼
Guest can: start matches, score, view their device's history

      ──────────────────────────────

Guest signs up
      │
      ▼
POST /api/auth/register
      │
      ├─ Create Player record in Postgres
      ├─ Link all guest matches (by guest token ID) to new account
      └─ Issue user JWT → httpOnly cookie
      │
      ▼
User can: everything guest can + persistent profile, groups, stats
```

The guest-to-user promotion is non-destructive. Match history is never lost on signup.

---

## Layers

### Routing layer (`app/`)

Next.js App Router owns all routing. Route groups separate concerns:

| Route group | Auth required | Purpose |
|---|---|---|
| `(guest)` | No | Landing, start match, join match |
| `(auth)` | Yes | Profile, history, groups, stats |
| `match/[id]` | No | Live scoreboard (view + score) |
| `group/[id]` | Yes | Group dashboard |
| `api/*` | Varies | All backend endpoints |

### API layer (`app/api/`)

Route Handlers replace a traditional Express server. Each endpoint is a standalone async function — no shared server state, no persistent process.

```
api/
├── auth/
│   ├── register/     POST — create account, promote guest
│   ├── login/        POST — issue user JWT
│   └── logout/       POST — clear cookie
├── matches/
│   ├── route.ts      GET (list), POST (create)
│   └── [id]/
│       ├── route.ts      GET (match detail)
│       └── score/
│           └── route.ts  POST (score a point) ← hot path
├── players/
│   └── [id]/         GET (profile + stats)
├── groups/
│   ├── route.ts      GET, POST
│   └── [id]/         GET, PATCH, DELETE
├── matchmaking/
│   └── route.ts      POST (generate teams)
└── pusher/
    └── auth/         POST (Pusher channel auth)
```

### Business logic layer (`lib/`)

Pure TypeScript — no framework dependencies. Importable by both Route Handlers and Server Components.

```
lib/
├── scoring/          Sport-specific scoring engines
│   ├── engine.ts     Shared ScoringEngine interface
│   ├── badminton.ts
│   ├── tennis.ts
│   └── padel.ts
├── matchmaking.ts    Team balancing algorithm
├── stats.ts          Win rate, pair chemistry calculations
├── auth.ts           JWT sign/verify, middleware
├── prisma.ts         Prisma client singleton
├── pusher.ts         Pusher server + client instances
└── redis.ts          Upstash client + helpers
```

### Data layer

Two stores, different roles:

| Store | What lives here | TTL |
|---|---|---|
| Neon Postgres | Everything persistent — players, matches, score events, groups | Forever |
| Upstash Redis | Active match state, rate limit counters | 1 hour (match state), 1 min (rate limits) |

Redis is always a cache — Postgres is always the source of truth. If Redis is empty, the app falls back to Postgres. No data is Redis-only.

---

## Scoring engine

Each sport implements a shared interface so the API layer never needs to know which sport it's scoring:

```ts
interface ScoringEngine {
  sport: 'badminton' | 'tennis' | 'padel'
  initialState(): MatchState
  applyPoint(state: MatchState, team: 0 | 1): MatchState
  isMatchOver(state: MatchState): boolean
  winner(state: MatchState): 0 | 1 | null
  displayScore(state: MatchState): string  // e.g. "21-18, 18-21, 15-10"
}
```

Adding a new sport means creating one new file in `lib/scoring/`. No changes anywhere else.

---

## Real-time design

Pusher channels map directly to matches:

| Channel | Type | Who subscribes |
|---|---|---|
| `match-{id}` | Public | Anyone with the match link |
| `private-match-{id}` | Private (auth required) | Scorers only |
| `presence-match-{id}` | Presence | Shows who's currently watching |

Events on `match-{id}`:

| Event | Payload | Triggered by |
|---|---|---|
| `score:update` | Full match state | POST /api/matches/[id]/score |
| `match:complete` | Winner, final score | Same endpoint when match ends |
| `match:undo` | Previous match state | POST /api/matches/[id]/undo |

Clients never mutate state directly — they send an HTTP request to the API, which updates state and broadcasts via Pusher. The Pusher event is the notification, not the source of truth.

---

## Middleware

Next.js middleware runs on every request before the route handler. It handles:

1. **Token extraction** — reads JWT from cookie (users) or Authorization header (guests)
2. **Identity injection** — attaches decoded identity to request headers for downstream handlers
3. **Route protection** — redirects unauthenticated requests away from `(auth)` routes

```ts
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
               ?? request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token && isProtectedRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const identity = token ? verifyToken(token) : generateGuestIdentity()
  const response = NextResponse.next()
  response.headers.set('x-identity', JSON.stringify(identity))
  return response
}
```

---

## Project structure

```
match-point/
├── app/                    # Next.js App Router
│   ├── (guest)/
│   ├── (auth)/
│   ├── match/[id]/
│   ├── group/[id]/
│   └── api/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── scoreboard/
│   ├── matchmaking/
│   └── stats/
├── designs/                # Pencil.dev design files
│   ├── scoreboard.pen
│   ├── matchmaking.pen
│   ├── session.pen
│   ├── profile.pen
│   ├── group.pen
│   └── components.pen
├── lib/
│   ├── prisma.ts
│   ├── pusher.ts
│   ├── redis.ts
│   ├── auth.ts
│   └── scoring/
│       ├── engine.ts
│       ├── badminton.ts
│       ├── tennis.ts
│       └── padel.ts
├── prisma/
│   └── schema.prisma
├── types/
└── middleware.ts
```

---

## Key design decisions

**Optimistic UI on score taps.** The scoreboard updates immediately on tap — the API call happens in the background. If it fails, the UI rolls back. This makes scoring feel instant even on a slow connection.

**Redis as a write-through cache.** Every score write goes to both Redis and Postgres. Redis serves reads during a live session. Postgres is the permanent record. The two are never out of sync for more than the duration of a single API call.

**Pusher auth endpoint.** Private and presence channels require the client to authenticate with Pusher via `/api/pusher/auth`. This endpoint verifies the user's JWT before issuing a Pusher auth token — so only legitimate scorers can join private channels.

**No polling.** Clients never poll the API for score updates. Everything live comes through Pusher. This keeps Vercel function invocations low (stays within free tier) and makes the experience feel real-time rather than near-real-time.

**Guest identity is generated server-side.** The middleware generates the guest JWT on first visit and sets it in the response. The client stores it in localStorage for subsequent requests. This means guests always have an identity, even before they've done anything — no "create guest session" step.

**Design and code in the same commit.** `.pen` files are committed alongside the components they describe. A PR that changes the scoreboard layout includes both `designs/scoreboard.pen` and `components/scoreboard/Scoreboard.tsx`. Design history and implementation history are never separated.
