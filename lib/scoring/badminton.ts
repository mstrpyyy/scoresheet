import type { MatchState, MatchFormat } from '@/types'
import type { ScoringEngine } from './engine'

const GAME_WIN = 21
const GAME_CAP = 30

function gameOver(s: [number, number]): boolean {
  return (Math.max(s[0], s[1]) >= GAME_WIN && Math.abs(s[0] - s[1]) >= 2)
    || Math.max(s[0], s[1]) >= GAME_CAP
}

function gameWinner(s: [number, number]): 0 | 1 | null {
  if (!gameOver(s)) return null
  return s[0] > s[1] ? 0 : 1
}

export const badmintonEngine: ScoringEngine = {
  sport: 'BADMINTON',

  initialState(format: MatchFormat): MatchState {
    return {
      sport: 'BADMINTON',
      status: 'ACTIVE',
      format,
      sets: [[0, 0]],
      currentSet: 0,
      winner: null,
      totalPoints: [0, 0],
    }
  },

  applyPoint(state: MatchState, team: 0 | 1): MatchState {
    if (state.status !== 'ACTIVE') return state

    const sets = state.sets.map(s => [s[0], s[1]] as [number, number])
    sets[state.currentSet][team]++

    const totalPoints: [number, number] = [
      state.totalPoints[0] + (team === 0 ? 1 : 0),
      state.totalPoints[1] + (team === 1 ? 1 : 0),
    ]

    if (!gameOver(sets[state.currentSet])) {
      return { ...state, sets, totalPoints }
    }

    // Count games won across all games played so far
    const gamesWon: [number, number] = [0, 0]
    for (const s of sets) {
      const w = gameWinner(s)
      if (w !== null) gamesWon[w]++
    }

    const bestOf = state.format.bestOf ?? 3
    const target = Math.ceil(bestOf / 2)

    if (gamesWon[0] >= target) {
      return { ...state, sets, totalPoints, status: 'COMPLETE', winner: 0 }
    }
    if (gamesWon[1] >= target) {
      return { ...state, sets, totalPoints, status: 'COMPLETE', winner: 1 }
    }

    return {
      ...state,
      sets: [...sets, [0, 0]],
      currentSet: state.currentSet + 1,
      totalPoints,
    }
  },

  isMatchOver(state: MatchState): boolean {
    return state.status === 'COMPLETE'
  },

  winner(state: MatchState): 0 | 1 | null {
    return state.winner
  },

  displayScore(state: MatchState): string {
    return state.sets.map(s => `${s[0]}-${s[1]}`).join(', ')
  },
}
