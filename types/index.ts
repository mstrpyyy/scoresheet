export type Sport = 'BADMINTON' | 'TENNIS' | 'PADEL'
export type MatchStatus = 'ACTIVE' | 'COMPLETE' | 'ABANDONED'
export type SessionStatus = 'ACTIVE' | 'COMPLETE'

// ─── Scoring ───────────────────────────────────────────────────────────────

export interface MatchState {
  sport: Sport
  status: MatchStatus
  // Each element is a set. Each set is [team0Score, team1Score].
  sets: [number, number][]
  // Index of the current (live) set.
  currentSet: number
  // Who won: null while in progress.
  winner: 0 | 1 | null
  // Total points scored per team across the entire match.
  totalPoints: [number, number]
}

export interface MatchFormat {
  sport: Sport
  bestOf?: number        // Badminton: 1 or 3
  noAd?: boolean        // Tennis: no-advantage rule
  goldenPoint?: boolean // Padel: golden point instead of deuce
}

// ─── Auth / Identity ───────────────────────────────────────────────────────

export type GuestIdentity = {
  type: 'guest'
  sub: string
}

export type UserIdentity = {
  type: 'user'
  sub: string
  playerId: string
  email: string
}

export type Identity = GuestIdentity | UserIdentity

// ─── API responses ─────────────────────────────────────────────────────────

export interface ApiError {
  error: string
}
