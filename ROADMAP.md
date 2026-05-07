# Roadmap

This roadmap is organized by phase, not by date. Each phase ships something real and usable before the next one begins. No phase is started until the previous one is stable.

---

## Phase 0 — Foundation
*Set up the project. Nothing user-facing yet.*

- [x] Initialize Next.js 15 project with TypeScript
- [x] Configure Tailwind CSS and shadcn/ui
- [x] Set up Neon Postgres and connect via Prisma
- [x] Set up Upstash Redis client
- [x] Set up Pusher account and configure server + client instances
- [x] Write Prisma schema (Player, Match, ScoreEvent, Group, Session)
- [x] Run initial migration
- [x] Configure Vercel deployment from GitHub
- [x] Set up environment variables across local and Vercel
- [x] Set up `designs/` folder and install Pencil.dev extension in VS Code

**Done when:** `npm run dev` works locally, Vercel deploys on push, database is reachable.

---

## Phase 1 — Scoreboard MVP
*The core product. A working scoreboard anyone can use without an account.*

### Auth (guest)
- [ ] Middleware that generates a guest JWT on first visit
- [ ] Guest token stored in localStorage, attached to API requests
- [ ] No login wall on any scoreboard feature

### Match creation
- [ ] `POST /api/matches` — create a match with sport, player names, format
- [ ] Sport selector: Badminton, Tennis, Padel
- [ ] Player/team name input (free text, no account needed)
- [ ] Match format options per sport:
  - Badminton: best of 1 / best of 3 (21 pts, rally scoring)
  - Tennis: sets (with deuce/advantage or no-ad)
  - Padel: sets (with golden point option)

### Scoring engine
- [ ] `ScoringEngine` interface in `lib/scoring/engine.ts`
- [ ] Badminton engine
- [ ] Tennis engine
- [ ] Padel engine
- [ ] Unit tests for each engine (edge cases: deuce, match point, set win)

### Live scoreboard
- [ ] `GET /api/matches/[id]` — fetch match state (Redis → Postgres fallback)
- [ ] `POST /api/matches/[id]/score` — score a point, trigger Pusher event
- [ ] `POST /api/matches/[id]/undo` — undo last point
- [ ] Pusher real-time sync on `match-{id}` channel
- [ ] Optimistic UI on score tap (instant feedback, rollback on failure)
- [ ] Match complete detection + winner display

### Shareable link
- [ ] `/match/[id]` page accessible without login
- [ ] Copy link button on scoreboard
- [ ] Read-only spectator view (no score buttons) for non-scorers

### Design (Pencil.dev)
- [ ] Design `scoreboard.pen` — portrait-first, dark and light mode variants, one-handed tap targets
- [ ] Generate `Scoreboard` component from canvas via Claude Code
- [ ] Design `components.pen` — shared button, card, badge components

**Done when:** Two people can open the same match link on their phones and see scores update in real time.

---

## Phase 2 — Accounts & History
*Give players a reason to come back.*

### Auth (registered users)
- [ ] `POST /api/auth/register` — create account, promote guest history
- [ ] `POST /api/auth/login` — issue user JWT via httpOnly cookie
- [ ] `POST /api/auth/logout`
- [ ] Guest match history claimed on signup (link by guest token ID)
- [ ] Protected route middleware for `(auth)` route group

### Match history
- [ ] ScoreEvent written to Postgres on every point (async)
- [ ] `GET /api/players/[id]` — profile + match history
- [ ] `/profile` page — list of past matches, results, sports played
- [ ] Match detail page — point-by-point timeline

### Basic stats
- [ ] Win rate per player
- [ ] Matches played, points scored
- [ ] Per-sport breakdown
- [ ] Stats visible on player profile

### Design
- [ ] Design `profile.pen` — stats overview, match history list
- [ ] Generate profile components via Claude Code

**Done when:** A registered player can log in and see their full match history and win rate.

---

## Phase 3 — Groups & Sessions
*Make it social. Give regular playing groups a home.*

### Groups
- [ ] `POST /api/groups` — create a group, get an invite link
- [ ] `GET /api/groups/[id]` — group dashboard
- [ ] Join group via invite link (guest or registered)
- [ ] Group roster management (add, remove players)
- [ ] Group-level stats: leaderboard, most active players

### Sessions
- [ ] Session concept: a block of play with multiple matches (e.g. Tuesday night)
- [ ] Start a session within a group
- [ ] All matches in a session linked to that session
- [ ] Session summary on completion: results, standings, MVP

### Design
- [ ] Design `group.pen` — roster, leaderboard, session history
- [ ] Design `session.pen` — active session, match list, live standings

**Done when:** A group of friends can create a group, run a Tuesday night session, and see a summary at the end.

---

## Phase 4 — Matchmaking
*Fair teams without the awkwardness.*

### Smart team generator
- [ ] Manual seed input (1–5) per player
- [ ] Auto-seed derived from win rate if no manual seed set
- [ ] Balanced mode: minimize skill gap between teams
- [ ] Random mode: fully random with optional "avoid last session's pairs" toggle
- [ ] History-aware mode: penalize repeated pairings from recent sessions
- [ ] `POST /api/matchmaking` — accepts roster, returns suggested teams

### Session scheduler
- [ ] Round-robin schedule generation from a roster
- [ ] Bracket generation (single elimination)
- [ ] "Who plays next" view during a session

### Design
- [ ] Design `matchmaking.pen` — team generator UI, mode selector, result display

**Done when:** An organizer can input a group roster and get fair, history-aware team suggestions in one tap.

---

## Phase 5 — Polish & Growth
*Make it shareable. Make it sticky.*

### Match recap card
- [ ] Auto-generated summary card on match completion
- [ ] Shows: sport, players, final score, duration, winner
- [ ] Shareable as an image (downloadable, copy-to-clipboard)
- [ ] Optimized for dropping into WhatsApp / group chats

### Pair chemistry stats
- [ ] Win rate when playing *with* specific partners
- [ ] Win rate when playing *against* specific opponents
- [ ] Visible on player profile and group dashboard

### PWA (Progressive Web App)
- [ ] Add to home screen on iOS and Android
- [ ] Offline score entry (queue syncs when connection returns)
- [ ] App icon, splash screen

### Notifications (optional)
- [ ] Push notification when a match you're in starts
- [ ] Session recap notification at end of session

**Done when:** Players are sharing recap cards in their group chats and adding the app to their home screens.

---

## Backlog (unscheduled)

Features that are valuable but not prioritized yet:

- **Squash support** — scoring engine + format options
- **Pickleball support**
- **Table tennis support**
- **Tournament mode** — full bracket with multiple rounds
- **Coach / admin role** — view-only access to group stats without playing
- **Elo rating system** — auto-calculated skill rating based on match history
- **Export data** — download match history as CSV
- **Embed scoreboard** — iframe-embeddable live scoreboard for streaming setups

---

## Principles

**Ship phases, not features.** Each phase ends with something a real user can use end-to-end. Half-built features don't ship.

**Scoreboard first, everything else second.** If the core scoring experience isn't fast and reliable, nothing else matters. Phase 1 gets the most attention.

**Free tier forever (for now).** No feature gets built that requires paid infrastructure until the app has real users.

**Design before code.** Each phase starts with the Pencil canvas before any component is written. Claude Code generates from the design, not the other way around.
