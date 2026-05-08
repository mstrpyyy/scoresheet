import type { MatchState, MatchFormat, Sport } from '@/types'
import { badmintonEngine } from './badminton'
import { tennisEngine } from './tennis'
import { padelEngine } from './padel'

export interface ScoringEngine {
  sport: Sport
  initialState(format: MatchFormat): MatchState
  applyPoint(state: MatchState, team: 0 | 1): MatchState
  isMatchOver(state: MatchState): boolean
  winner(state: MatchState): 0 | 1 | null
  // Human-readable score string, e.g. "21-18, 18-21, 15-10"
  displayScore(state: MatchState): string
}

const engines: Record<Sport, ScoringEngine> = {
  BADMINTON: badmintonEngine,
  TENNIS: tennisEngine,
  PADEL: padelEngine,
}

export function getEngine(sport: Sport): ScoringEngine {
  return engines[sport]
}
