import type { MatchState, MatchFormat, Sport } from '@/types'

export interface ScoringEngine {
  sport: Sport
  initialState(format: MatchFormat): MatchState
  applyPoint(state: MatchState, team: 0 | 1): MatchState
  isMatchOver(state: MatchState): boolean
  winner(state: MatchState): 0 | 1 | null
  // Human-readable score string, e.g. "21-18, 18-21, 15-10"
  displayScore(state: MatchState): string
}
