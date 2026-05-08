import { describe, it, expect } from 'vitest'
import { tennisEngine as eng } from '../tennis'
import type { MatchFormat } from '@/types'

const std: MatchFormat = { sport: 'TENNIS' }
const noAd: MatchFormat = { sport: 'TENNIS', noAd: true }

function scoreN(state: ReturnType<typeof eng.initialState>, team: 0 | 1, n: number) {
  for (let i = 0; i < n; i++) state = eng.applyPoint(state, team)
  return state
}

// Win a game: 4 raw points with no deuce involvement
function winGame(state: ReturnType<typeof eng.initialState>, team: 0 | 1) {
  return scoreN(state, team, 4)
}

// Win a set: 6 games to 0
function winSet(state: ReturnType<typeof eng.initialState>, team: 0 | 1) {
  for (let i = 0; i < 6; i++) state = winGame(state, team)
  return state
}

describe('tennis — game scoring', () => {
  it('increments game score through 0/15/30/40', () => {
    let s = eng.initialState(std)
    s = eng.applyPoint(s, 0)
    expect(s.gameScore).toEqual([1, 0])
    s = eng.applyPoint(s, 0)
    expect(s.gameScore).toEqual([2, 0])
    s = eng.applyPoint(s, 0)
    expect(s.gameScore).toEqual([3, 0])
  })

  it('wins game at 4-0 (40-love)', () => {
    let s = eng.initialState(std)
    s = scoreN(s, 0, 4)
    expect(s.sets[0]).toEqual([1, 0])
    expect(s.gameScore).toEqual([0, 0]) // reset
  })

  it('wins game at 4-2', () => {
    let s = eng.initialState(std)
    s = scoreN(s, 0, 3)
    s = scoreN(s, 1, 2)
    s = eng.applyPoint(s, 0) // 4-2
    expect(s.sets[0]).toEqual([1, 0])
  })
})

describe('tennis — deuce and advantage', () => {
  it('reaches deuce at 3-3', () => {
    let s = eng.initialState(std)
    s = scoreN(s, 0, 3)
    s = scoreN(s, 1, 3)
    expect(s.deuceState).toBe('deuce')
  })

  it('gives advantage after deuce', () => {
    let s = eng.initialState(std)
    s = scoreN(s, 0, 3)
    s = scoreN(s, 1, 3)
    s = eng.applyPoint(s, 0)
    expect(s.deuceState).toBe('advantage_0')
  })

  it('wins game from advantage', () => {
    let s = eng.initialState(std)
    s = scoreN(s, 0, 3)
    s = scoreN(s, 1, 3)
    s = eng.applyPoint(s, 0) // advantage_0
    s = eng.applyPoint(s, 0) // win
    expect(s.sets[0]).toEqual([1, 0])
    expect(s.deuceState).toBe(null)
  })

  it('returns to deuce when advantage holder loses point', () => {
    let s = eng.initialState(std)
    s = scoreN(s, 0, 3)
    s = scoreN(s, 1, 3)
    s = eng.applyPoint(s, 0) // advantage_0
    s = eng.applyPoint(s, 1) // back to deuce
    expect(s.deuceState).toBe('deuce')
  })
})

describe('tennis — no-ad', () => {
  it('wins game immediately at deuce (3-3)', () => {
    let s = eng.initialState(noAd)
    s = scoreN(s, 0, 3)
    s = scoreN(s, 1, 3)
    // deuceState should be 'deuce'
    expect(s.deuceState).toBe('deuce')
    s = eng.applyPoint(s, 1) // next point wins
    expect(s.sets[0]).toEqual([0, 1])
  })
})

// Reach a 6-6 set by alternating game wins
function reach66(state: ReturnType<typeof eng.initialState>) {
  for (let i = 0; i < 6; i++) {
    state = winGame(state, 0)
    state = winGame(state, 1)
  }
  return state
}

describe('tennis — set scoring', () => {
  it('wins set 6-0', () => {
    let s = eng.initialState(std)
    s = winSet(s, 0)
    expect(s.sets[0]).toEqual([6, 0])
    expect(s.currentSet).toBe(1)
  })

  it('wins set 7-5', () => {
    let s = eng.initialState(std)
    // Alternate to 5-5, then team 0 wins two straight
    for (let i = 0; i < 5; i++) {
      s = winGame(s, 0)
      s = winGame(s, 1)
    }
    // 5-5
    s = winGame(s, 0) // 6-5
    s = winGame(s, 0) // 7-5 → set won
    expect(s.sets[0]).toEqual([7, 5])
    expect(s.currentSet).toBe(1)
  })

  it('starts tiebreak at 6-6', () => {
    const s = reach66(eng.initialState(std))
    expect(s.sets[0]).toEqual([6, 6])
    expect(s.tiebreak).toBe(true)
  })
})

describe('tennis — tiebreak', () => {
  it('wins tiebreak at 7-0', () => {
    let s = reach66(eng.initialState(std))
    s = scoreN(s, 0, 7)
    expect(s.sets[0]).toEqual([7, 6])
    expect(s.tiebreak).toBe(false)
    expect(s.currentSet).toBe(1)
  })

  it('does not win tiebreak at 7-6 (needs win by 2)', () => {
    let s = reach66(eng.initialState(std))
    s = scoreN(s, 0, 6)
    s = scoreN(s, 1, 6)
    expect(s.tiebreak).toBe(true)
    expect(s.gameScore).toEqual([6, 6])
    s = eng.applyPoint(s, 0) // 7-6 — not won (only 1 ahead)
    expect(s.tiebreak).toBe(true)
    s = eng.applyPoint(s, 0) // 8-6 — won
    expect(s.sets[0]).toEqual([7, 6])
  })
})

describe('tennis — match', () => {
  it('wins match at 2 sets', () => {
    let s = eng.initialState(std)
    s = winSet(s, 0)
    expect(s.status).toBe('ACTIVE')
    s = winSet(s, 0)
    expect(s.status).toBe('COMPLETE')
    expect(s.winner).toBe(0)
  })

  it('plays 3 sets when split 1-1', () => {
    let s = eng.initialState(std)
    s = winSet(s, 0)
    s = winSet(s, 1)
    expect(s.currentSet).toBe(2)
    expect(s.status).toBe('ACTIVE')
    s = winSet(s, 1)
    expect(s.status).toBe('COMPLETE')
    expect(s.winner).toBe(1)
  })
})

describe('tennis — frozen state', () => {
  it('does not mutate state after match is over', () => {
    let s = eng.initialState(std)
    s = winSet(s, 0)
    s = winSet(s, 0)
    const frozen = s
    s = eng.applyPoint(s, 1)
    expect(s).toBe(frozen)
  })
})
