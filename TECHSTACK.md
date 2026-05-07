# Tech Stack

Match Point is built as a **Next.js monolith** — one app, one deployment, zero cold starts. All API logic lives in Next.js Route Handlers. Real-time is handled by Pusher instead of Socket.io, since Vercel's serverless runtime doesn't support persistent WebSocket connections.

Everything here runs on free-tier services. Total monthly cost: $0.

---

## Architecture decision: monolith vs two apps

We chose a **single Next.js app** over a separate Express backend for these reasons:

- One deployment, one repo, one set of environment variables
- No Render cold starts
- Route Handlers cover 100% of our REST API needs
- Pusher's free tier is generous enough for a sports app at launch
- Simpler to build and maintain solo

The only trade-off is giving up Socket.io in favour of Pusher. For our use case — broadcasting score updates to a small group of players — Pusher is more than sufficient and actually easier to integrate.

**Migrate path if needed:** If real-time volume ever outgrows Pusher's free tier, the Route Handlers can be extracted into a standalone Express app with minimal changes. The Prisma schema and business logic stay the same.

---

## Application

### Next.js 15 (App Router) + TypeScript
The entire application — frontend and backend — lives here. App Router enables clean separation between guest and authenticated routes using route groups.

```
app/
├── (guest)/            # Scoreboard, live view — no login needed
├── (auth)/             # Profile, history, stats — login required
├── match/[id]/         # Live match page (both guest and auth)
├── group/[id]/         # Group dashboard
└── api/                # All backend logic as Route Handlers
    ├── matches/
    ├── players/
    ├── groups/
    ├── matchmaking/
    └── pusher/
        └── auth/       # Pusher channel auth endpoint
```

Server Actions handle form submissions and mutations. Route Handlers handle REST endpoints and the Pusher auth webhook.

### Tailwind CSS + shadcn/ui
Tailwind for utility-first styling. shadcn/ui for accessible, copy-paste components — no npm package, no version lock-in. Components live in `components/ui/` and are fully customizable.

### Vercel
Deploys the Next.js app. Connects directly to GitHub — every push to `main` triggers a production deploy. Preview deployments on every PR.

**Free tier limits:** 100GB bandwidth/month, unlimited projects, custom domain included.

---

## Real-time

### Pusher (Channels)
Handles the live shared scoreboard. When a score is tapped, a Route Handler writes the new state to the database and triggers a Pusher event:

```ts
await pusher.trigger(`match-${matchId}`, 'score:update', newState)
```

The client subscribes to that channel and updates the UI instantly. No persistent server process needed — Pusher manages the WebSocket infrastructure.

**Free tier limits:** 200,000 messages/day, 100 concurrent connections. A typical session (10 players, 5 concurrent matches, 30-point games) uses well under 1,000 messages. The free tier easily covers hundreds of sessions per day.

**Sign up at:** https://pusher.com — no credit card required for the Sandbox plan.

**Why not Socket.io:** Socket.io requires a persistent server process. Vercel is serverless — connections are terminated after the function returns. Pusher is purpose-built for this constraint.

---

## Database

### Neon (PostgreSQL)
Serverless Postgres. The primary database for all persistent data — players, matches, groups, score events.

Works natively with Prisma. Uses `@neondatabase/serverless` for connection pooling, which is required in a serverless (Vercel) environment where each function invocation may open a new connection.

```ts
// lib/prisma.ts — singleton to avoid connection exhaustion
import { PrismaClient } from '@prisma/client'
const globalForPrisma = global as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Free tier limits:** 0.5 GB storage, 1 project, 10 branches. Sufficient for launch and early growth.

**Sign up at:** https://neon.tech — no credit card required.

### Prisma ORM
Type-safe database client. Handles migrations, schema management, and query building. Schema lives in `prisma/schema.prisma` at the root of the project.

---

## Cache

### Upstash (Redis)
Serverless Redis for active match state. When a score is tapped, the updated match state is written to Redis so subsequent reads (e.g. a player joining mid-match) don't hit Postgres on every request.

```ts
await redis.set(`match:${matchId}:state`, JSON.stringify(state), { ex: 3600 })
```

Also used for rate limiting API routes (e.g. prevent score spam) via Upstash's `@upstash/ratelimit` library.

**Free tier limits:** 10,000 commands/day. Each score tap costs ~3–5 commands — covers roughly 2,000–3,000 scored points per day.

**Sign up at:** https://upstash.com — no credit card required.

---

## Auth

### JWT (self-hosted)
No third-party auth service. Two token types, same middleware:

| Token type | Stored | Permissions |
|---|---|---|
| Guest token | `localStorage` | Score a match, view history for that device |
| User token | `httpOnly` cookie | Full profile, persistent history, groups |

Guests get an anonymous identity on first visit. If they sign up later, their guest match history is claimed under their new account — same pattern Figma uses for guest editing.

Libraries: `jose` for JWT (edge-compatible, works in Next.js middleware), `bcryptjs` for password hashing.

---

## Project structure

Single Next.js app — no monorepo needed.

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
├── lib/
│   ├── prisma.ts           # Prisma client singleton
│   ├── pusher.ts           # Pusher server + client instances
│   ├── redis.ts            # Upstash client
│   ├── auth.ts             # JWT helpers
│   └── scoring/            # Sport-specific scoring engines
│       ├── badminton.ts
│       ├── tennis.ts
│       └── padel.ts
├── prisma/
│   └── schema.prisma
└── types/                  # Shared TypeScript types
```

### GitHub
Source control. Vercel connects directly to GitHub and auto-deploys on push to `main`. PR previews deploy automatically.

---

## Summary

| Layer | Tool | Provider | Free limit |
|---|---|---|---|
| Framework | Next.js 15 + TypeScript | — | Open source |
| UI | Tailwind + shadcn/ui | — | Open source |
| Hosting | Vercel | Vercel | 100 GB/mo bandwidth |
| Real-time | Pusher Channels | Pusher | 200k messages/day |
| ORM | Prisma | — | Open source |
| Database | PostgreSQL | Neon | 0.5 GB storage |
| Cache / rate limit | Redis | Upstash | 10k commands/day |
| Auth | JWT via `jose` | — | No dependency |
| Version control | GitHub | GitHub | Unlimited repos |

**Total monthly cost: $0**

---

## Upgrade path

When free tiers become a constraint:

- **Pusher** → $49/mo (10M messages/day, 500 concurrent connections) — or self-host Soketi on a $5 VPS for full Socket.io compatibility
- **Neon** → $19/mo for more storage and staging branches
- **Upstash** → pay-per-use, very affordable at scale
- **Vercel** → Pro at $20/mo for team features and higher limits

None of these are needed until the app has real traction.
