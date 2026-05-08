import { describe, it, expect } from 'vitest'
import { padelEngine as eng } from '../padel'
import type { MatchFormat } from '@/types'

const std: MatchFormat = { sport: 'PADEL', goldenPoint: true }
const noGolden: MatchFormat = { sport: 'PADEL', goldenPoint: false }

function scoreN(state: ReturnType<typeof eng.initialState>, team: 0 | 1, n: number) {
  for (let i = 0; i < n; i++) state = eng.applyPoint(state, team)
  return state
}

function winGame(state: ReturnType<typeof eng.initialState>, team: 0 | 1) {
  return scoreN(state, team, 4)
}

function winSet(state: ReturnType<typeof eng.initialState>, team: 0 | 1) {
  for (let i = 0; i < 6; i++) state = winGame(state, team)
  return state
}

describe('padel — golden point', () => {
  it('wins game on next point after deuce (golden point)', () => {
    let s = eng.initialState(std)
    s = scoreN(s, 0, 3)
    s = scoreN(s, 1, 3)
    expect(s.deuceState).toBe('deuce')
    s = eng.applyPoint(s, 0)
    expect(s.sets[0]).toEqual([1, 0])
  })

  it('without golden point, enters deuce/advantage cycle', () => {
    let s = eng.initialState(noGolden)
    s = scoreN(s, 0, 3)
    s = scoreN(s, 1, 3)
    s = eng.applyPoint(s, 0)
    expect(s.deuceState).toBe('advantage_0')
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

describe('padel — super tiebreak at 6-6', () => {
  it('starts super tiebreak (not normal tiebreak) at 6-6', () => {
    const s = reach66(eng.initialState(std))
    expect(s.sets[0]).toEqual([6, 6])
    expect(s.superTiebreak).toBe(true)
    expect(s.tiebreak).toBe(false)
  })

  it('wins super tiebreak at 10 points', () => {
    let s = reach66(eng.initialState(std))
    s = scoreN(s, 0, 10)
    expect(s.sets[0]).toEqual([7, 6])
    expect(s.superTiebreak).toBe(false)
    expect(s.currentSet).toBe(1)
  })

  it('does not win super tiebreak at 10-9 (needs win by 2)', () => {
    let s = reach66(eng.initialState(std))
    s = scoreN(s, 0, 9)
    s = scoreN(s, 1, 9)
    s = eng.applyPoint(s, 0) // 10-9, not won
    expect(s.superTiebreak).toBe(true)
    s = eng.applyPoint(s, 0) // 11-9, won
    expect(s.sets[0]).toEqual([7, 6])
  })
})

describe('padel — match', () => {
  it('wins match at 2 sets', () => {
    let s = eng.initialState(std)
    s = winSet(s, 0)
    s = winSet(s, 0)
    expect(s.status).toBe('COMPLETE')
    expect(s.winner).toBe(0)
  })

  it('plays 3 sets when split 1-1', () => {
    let s = eng.initialState(std)
    s = winSet(s, 0)
    s = winSet(s, 1)
    expect(s.status).toBe('ACTIVE')
    s = winSet(s, 1)
    expect(s.status).toBe('COMPLETE')
    expect(s.winner).toBe(1)
  })
})
