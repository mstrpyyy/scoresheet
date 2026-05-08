# 🏸 Match Point

> A frictionless scoreboard and matchmaking app for racket sports — so players can focus on playing, not organizing.

---

## The Problem

Tracking scores during a badminton, tennis, or padel session should be simple. But if you want to keep match history, share live scores with your crew, or figure out fair team pairings — it turns into spreadsheets, WhatsApp threads, and awkward "who plays next?" moments.

Match Point fixes that.

---

## Features

### ⚡ Live Scoreboard
- Start a match in seconds — no account needed
- Tap to score, tap to undo
- Supports badminton (rally scoring, 21 pts), tennis (deuce/advantage), and padel (golden point option)
- Pluggable scoring engine — adding new sports is straightforward

### 🔗 Shared Live Session
- One shareable link — everyone sees the same score in real time
- Read-only spectator view for coaches, sideliners, or on-court displays
- No login required to view or follow along

### 📊 Match History & Stats
- Every match is auto-saved (account holders get persistent history)
- Guest sessions saved under anonymous device identity — claimable after signup
- Per-player stats: win rate, points scored, games played
- Pair/team chemistry: how well you perform with or against specific players

### 🤝 Smart Matchmaking
- Generate balanced teams by skill level, history, or random
- Avoids repeated pairings within the same session
- Manual seed input (1–5) or auto-derived from win rate
- Round-robin and bracket schedule generation for longer sessions

### 👥 Player Groups
- Create a persistent group (e.g. "Tuesday Crew") with a shared roster
- Stats accumulate across sessions
- Members join via invite link — no friction

### 🃏 Match Recap Card
- Auto-generated shareable summary card after each match
- Scores, players, duration — ready to drop into a group chat

---

## Tech Stack

### Frontend
- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Socket.io client** for real-time score sync

### Backend
- **Express.js** + **TypeScript**
- **Prisma ORM** with **PostgreSQL**
- **Socket.io** for WebSocket connections
- **JWT** for auth (guest tokens + registered users)

### Infrastructure
- PostgreSQL (primary database)
- Redis (session state, real-time presence)
- S3-compatible storage (recap card image generation)

---

## Project Structure

```
match-point/
├── apps/
│   ├── web/                   # Next.js frontend
│   │   ├── app/
│   │   │   ├── (guest)/       # No-auth routes (scoreboard, view)
│   │   │   ├── (auth)/        # Authenticated routes (stats, history)
│   │   │   ├── match/[id]/    # Live match view
│   │   │   └── group/[id]/    # Group dashboard
│   │   ├── components/
│   │   │   ├── scoreboard/
│   │   │   ├── matchmaking/
│   │   │   └── stats/
│   │   └── lib/
│   │       ├── socket.ts
│   │       └── scoring/       # Sport-specific scoring engines
│   │           ├── badminton.ts
│   │           ├── tennis.ts
│   │           └── padel.ts
│   └── api/                   # Express backend
│       ├── routes/
│       │   ├── matches.ts
│       │   ├── players.ts
│       │   ├── groups.ts
│       │   └── matchmaking.ts
│       ├── sockets/
│       │   └── scoreHandler.ts
│       ├── prisma/
│       │   └── schema.prisma
│       └── lib/
│           ├── auth.ts
│           └── scoring/
└── packages/
    └── types/                 # Shared TypeScript types
```

---

## Data Model (Overview)

```
Player          — profile, seed, anonymous or registered
Group           — roster of players, persistent across sessions
Session         — a block of play (e.g. Tuesday night)
Match           — a single game within a session
MatchPlayer     — join table: player ↔ match, with team assignment
ScoreEvent      — point-by-point log with timestamps
```

Full Prisma schema in `apps/api/prisma/schema.prisma`.

---

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Install

```bash
git clone https://github.com/yourname/match-point
cd match-point
npm install
```

### Environment

```bash
# apps/api/.env
DATABASE_URL="postgresql://user:password@localhost:5432/matchpoint"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-here"
PORT=4000

# apps/web/.env.local
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_WS_URL="ws://localhost:4000"
```

### Run (development)

```bash
# Run both frontend and backend
npm run dev

# Or individually
npm run dev --workspace=apps/web
npm run dev --workspace=apps/api
```

### Database setup

```bash
cd apps/api
npx prisma migrate dev
npx prisma db seed
```

---

## Scoring Engines

Each sport implements a shared interface:

```typescript
interface ScoringEngine {
  sport: Sport
  initialState(): MatchState
  applyPoint(state: MatchState, team: 0 | 1): MatchState
  isMatchOver(state: MatchState): boolean
  winner(state: MatchState): 0 | 1 | null
}
```

Adding a new sport means creating a new file in `lib/scoring/` — no changes to the core match logic.

---

## Matchmaking Algorithm

Team generation uses a weighted scoring approach:

1. **Balanced mode** — minimize total skill gap between teams, using player seed or derived win rate
2. **History-aware** — penalizes pairings that appeared in recent sessions (so you don't always end up with the same partner)
3. **Random mode** — fully random, with optional "exclude last session's pairs" toggle

---

## Roadmap

- [x] Core scoreboard (badminton, tennis, padel)
- [x] Shareable live session link
- [x] Guest anonymous identity
- [ ] Doubles (2v2) support with serving rotation
- [ ] Player accounts & persistent history
- [ ] Smart matchmaking
- [ ] Player groups
- [ ] Match recap card generator
- [ ] Session scheduler / round-robin
- [ ] Mobile PWA (offline score entry)
- [ ] Squash, pickleball support

---

## Contributing

PRs welcome. Open an issue first for anything beyond a small fix — especially new sport engines or matchmaking changes.

---

## License

MIT
