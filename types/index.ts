export type Sport = 'BADMINTON' | 'TENNIS' | 'PADEL'
export type MatchStatus = 'ACTIVE' | 'COMPLETE' | 'ABANDONED'
export type SessionStatus = 'ACTIVE' | 'COMPLETE'

// ─── Scoring ───────────────────────────────────────────────────────────────

export interface MatchState {
  sport: Sport
  status: MatchStatus
  format: MatchFormat
  // Badminton: points per game. Tennis/Padel: games per set.
  sets: [number, number][]
  currentSet: number
  winner: 0 | 1 | null
  totalPoints: [number, number]
  // Tennis/Padel: raw point count within the current game
  gameScore?: [number, number]
  // Tennis/Padel: deuce/advantage tracking
  deuceState?: 'deuce' | 'advantage_0' | 'advantage_1' | null
  // Tennis: true when the current game is a 7-point tiebreak
  tiebreak?: boolean
  // Padel: true when the current set is a 10-point super tiebreak
  superTiebreak?: boolean
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
