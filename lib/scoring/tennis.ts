import type { MatchState, MatchFormat } from '@/types'
import type { ScoringEngine } from './engine'

export type DeuceState = 'deuce' | 'advantage_0' | 'advantage_1' | null

export function applyGamePoint(
  gameScore: [number, number],
  deuceState: DeuceState,
  team: 0 | 1,
  noAd: boolean,
  tiebreak: boolean,
  superTiebreak: boolean,
): { gameScore: [number, number]; deuceState: DeuceState; won: boolean } {
  const other = team === 0 ? 1 : 0

  if (tiebreak || superTiebreak) {
    const winTarget = superTiebreak ? 10 : 7
    const newScore: [number, number] = [gameScore[0], gameScore[1]]
    newScore[team]++
    const won = newScore[team] >= winTarget && newScore[team] - newScore[other] >= 2
    return { gameScore: newScore, deuceState: null, won }
  }

  if (deuceState === 'deuce') {
    if (noAd) return { gameScore, deuceState: null, won: true }
    const ad: DeuceState = team === 0 ? 'advantage_0' : 'advantage_1'
    return { gameScore, deuceState: ad, won: false }
  }

  if (deuceState === 'advantage_0') {
    if (team === 0) return { gameScore, deuceState: null, won: true }
    return { gameScore, deuceState: 'deuce', won: false }
  }

  if (deuceState === 'advantage_1') {
    if (team === 1) return { gameScore, deuceState: null, won: true }
    return { gameScore, deuceState: 'deuce', won: false }
  }

  // Normal scoring
  const newScore: [number, number] = [gameScore[0], gameScore[1]]
  newScore[team]++

  if (newScore[team] >= 4 && newScore[team] - newScore[other] >= 2) {
    return { gameScore: newScore, deuceState: null, won: true }
  }
  if (newScore[0] === 3 && newScore[1] === 3) {
    return { gameScore: newScore, deuceState: 'deuce', won: false }
  }

  return { gameScore: newScore, deuceState: null, won: false }
}

export function isSetWon(games: [number, number]): 0 | 1 | null {
  const [a, b] = games
  if (a === 7 && b === 6) return 0
  if (b === 7 && a === 6) return 1
  if (a >= 6 && a - b >= 2) return 0
  if (b >= 6 && b - a >= 2) return 1
  return null
}

const POINT_LABELS = ['0', '15', '30', '40']

export function displayGameScore(
  gameScore: [number, number],
  deuceState: DeuceState,
  tiebreak: boolean,
  superTiebreak: boolean,
): string {
  if (tiebreak || superTiebreak) return `${gameScore[0]}-${gameScore[1]}`
  if (deuceState === 'deuce') return 'Deuce'
  if (deuceState === 'advantage_0') return 'Ad-40'
  if (deuceState === 'advantage_1') return '40-Ad'
  const a = POINT_LABELS[gameScore[0]] ?? String(gameScore[0])
  const b = POINT_LABELS[gameScore[1]] ?? String(gameScore[1])
  return `${a}-${b}`
}

function handleGameWon(
  state: MatchState,
  sets: [number, number][],
  totalPoints: [number, number],
  team: 0 | 1,
  startTiebreak: boolean,
  startSuperTiebreak: boolean,
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
      return { ...base, tiebreak: startTiebreak, superTiebreak: startSuperTiebreak }
    }
    return base
  }

  // Count sets won
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

export const tennisEngine: ScoringEngine = {
  sport: 'TENNIS',

  initialState(format: MatchFormat): MatchState {
    return {
      sport: 'TENNIS',
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

    const noAd = state.format.noAd ?? false
    const gameScore = state.gameScore ?? [0, 0]
    const deuceState = state.deuceState ?? null
    const tiebreak = state.tiebreak ?? false
    const superTiebreak = state.superTiebreak ?? false

    const result = applyGamePoint(gameScore, deuceState, team, noAd, tiebreak, superTiebreak)

    const totalPoints: [number, number] = [
      state.totalPoints[0] + (team === 0 ? 1 : 0),
      state.totalPoints[1] + (team === 1 ? 1 : 0),
    ]

    if (!result.won) {
      return { ...state, gameScore: result.gameScore, deuceState: result.deuceState, totalPoints }
    }

    const sets = state.sets.map(s => [s[0], s[1]] as [number, number])
    return handleGameWon(state, sets, totalPoints, team, true, false)
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
    const tiebreak = state.tiebreak ?? false
    const superTiebreak = state.superTiebreak ?? false

    const parts: string[] = []
    for (let i = 0; i < state.currentSet; i++) {
      parts.push(`${state.sets[i][0]}-${state.sets[i][1]}`)
    }

    const cs = state.sets[state.currentSet]
    parts.push(`${cs[0]}-${cs[1]}`)

    const gameStr = displayGameScore(gameScore, deuceState, tiebreak, superTiebreak)
    if (gameStr !== '0-0') parts.push(`(${gameStr})`)

    return parts.join(', ')
  },
}
