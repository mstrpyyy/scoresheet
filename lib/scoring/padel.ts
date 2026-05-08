import type { MatchState, MatchFormat } from '@/types'
import type { ScoringEngine } from './engine'
import { applyGamePoint, isSetWon, displayGameScore } from './tennis'

function handleGameWon(
  state: MatchState,
  sets: [number, number][],
  totalPoints: [number, number],
  team: 0 | 1,
): MatchState {
  sets[state.currentSet][team]++

  const setWinner = isSetWon(sets[state.currentSet])

  const base: MatchState = {
    ...state,
    sets,
    totalPoints,
    gameScore: [0, 0],
    deuceState: null,
    tiebreak: false,
    superTiebreak: false,
  }

  if (setWinner === null) {
    const [a, b] = sets[state.currentSet]
    if (a === 6 && b === 6) {
      // Padel uses a super tiebreak (10 pts) at 6-6, not a normal tiebreak
      return { ...base, superTiebreak: true }
    }
    return base
  }

  const setsWon: [number, number] = [0, 0]
  for (const s of sets) {
    const w = isSetWon(s)
    if (w !== null) setsWon[w]++
  }

  const target = 2 // best of 3
  if (setsWon[0] >= target) return { ...base, status: 'COMPLETE', winner: 0 }
  if (setsWon[1] >= target) return { ...base, status: 'COMPLETE', winner: 1 }

  return { ...base, sets: [...sets, [0, 0]], currentSet: state.currentSet + 1 }
}

export const padelEngine: ScoringEngine = {
  sport: 'PADEL',

  initialState(format: MatchFormat): MatchState {
    return {
      sport: 'PADEL',
      status: 'ACTIVE',
      format,
      sets: [[0, 0]],
      currentSet: 0,
      winner: null,
      totalPoints: [0, 0],
      gameScore: [0, 0],
      deuceState: null,
      tiebreak: false,
      superTiebreak: false,
    }
  },

  applyPoint(state: MatchState, team: 0 | 1): MatchState {
    if (state.status !== 'ACTIVE') return state

    // Padel uses golden point (goldenPoint flag) which maps to no-ad deuce rule
    const noAd = state.format.goldenPoint ?? false
    const gameScore = state.gameScore ?? [0, 0]
    const deuceState = state.deuceState ?? null
    const superTiebreak = state.superTiebreak ?? false

    // Padel never has a normal 7-point tiebreak; use superTiebreak only
    const result = applyGamePoint(gameScore, deuceState, team, noAd, false, superTiebreak)

    const totalPoints: [number, number] = [
      state.totalPoints[0] + (team === 0 ? 1 : 0),
      state.totalPoints[1] + (team === 1 ? 1 : 0),
    ]

    if (!result.won) {
      return { ...state, gameScore: result.gameScore, deuceState: result.deuceState, totalPoints }
    }

    const sets = state.sets.map(s => [s[0], s[1]] as [number, number])
    return handleGameWon(state, sets, totalPoints, team)
  },

  isMatchOver(state: MatchState): boolean {
    return state.status === 'COMPLETE'
  },

  winner(state: MatchState): 0 | 1 | null {
    return state.winner
  },

  displayScore(state: MatchState): string {
    const gameScore = state.gameScore ?? [0, 0]
    const deuceState = state.deuceState ?? null
    const superTiebreak = state.superTiebreak ?? false

    const parts: string[] = []
    for (let i = 0; i < state.currentSet; i++) {
      parts.push(`${state.sets[i][0]}-${state.sets[i][1]}`)
    }

    const cs = state.sets[state.currentSet]
    parts.push(`${cs[0]}-${cs[1]}`)

    const gameStr = displayGameScore(gameScore, deuceState, false, superTiebreak)
    if (gameStr !== '0-0') parts.push(`(${gameStr})`)

    return parts.join(', ')
  },
}
