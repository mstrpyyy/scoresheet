import { describe, it, expect } from 'vitest'
import { badmintonEngine as eng } from '../badminton'
import type { MatchFormat } from '@/types'

const bo3: MatchFormat = { sport: 'BADMINTON', bestOf: 3 }
const bo1: MatchFormat = { sport: 'BADMINTON', bestOf: 1 }

function scoreN(state: ReturnType<typeof eng.initialState>, team: 0 | 1, n: number) {
  for (let i = 0; i < n; i++) state = eng.applyPoint(state, team)
  return state
}

describe('badminton — basic scoring', () => {
  it('increments the current game score', () => {
    let s = eng.initialState(bo3)
    s = eng.applyPoint(s, 0)
    expect(s.sets[0]).toEqual([1, 0])
    s = eng.applyPoint(s, 1)
    expect(s.sets[0]).toEqual([1, 1])
  })
})

describe('badminton — game win', () => {
  it('wins a game at 21 with 2-point lead', () => {
    let s = eng.initialState(bo3)
    s = scoreN(s, 0, 21)
    expect(s.sets[0]).toEqual([21, 0])
    expect(s.currentSet).toBe(1) // new game started
  })

  it('does not win at 21-20 (needs 2-point lead)', () => {
    let s = eng.initialState(bo3)
    s = scoreN(s, 0, 20)
    s = scoreN(s, 1, 20)
    s = eng.applyPoint(s, 0) // 21-20
    expect(s.currentSet).toBe(0) // still in game 1
    expect(s.sets[0]).toEqual([21, 20])
  })

  it('wins at 22-20 when tied at 20-20', () => {
    let s = eng.initialState(bo3)
    s = scoreN(s, 0, 20)
    s = scoreN(s, 1, 20)
    s = scoreN(s, 0, 2) // 22-20
    expect(s.currentSet).toBe(1)
    expect(s.sets[0]).toEqual([22, 20])
  })

  it('wins at 30-29 (hard cap)', () => {
    let s = eng.initialState(bo3)
    s = scoreN(s, 0, 20)
    s = scoreN(s, 1, 20) // 20-20
    // Alternate to stay tied through 21-21 … 29-29
    for (let i = 0; i < 9; i++) {
      s = eng.applyPoint(s, 0)
      s = eng.applyPoint(s, 1)
    }
    s = eng.applyPoint(s, 0) // 30-29 → cap reached
    expect(s.currentSet).toBe(1)
    expect(s.sets[0]).toEqual([30, 29])
  })

  it('wins at 29-30 cap (team 1)', () => {
    let s = eng.initialState(bo3)
    s = scoreN(s, 0, 20)
    s = scoreN(s, 1, 20) // 20-20
    for (let i = 0; i < 9; i++) {
      s = eng.applyPoint(s, 0)
      s = eng.applyPoint(s, 1)
    }
    s = eng.applyPoint(s, 1) // 29-30 → cap reached
    expect(s.currentSet).toBe(1)
    expect(s.sets[0]).toEqual([29, 30])
  })
})

describe('badminton — match (best of 3)', () => {
  it('completes match when one team wins 2 games', () => {
    let s = eng.initialState(bo3)
    // Team 0 wins game 1
    s = scoreN(s, 0, 21)
    expect(s.status).toBe('ACTIVE')
    // Team 0 wins game 2
    s = scoreN(s, 0, 21)
    expect(s.status).toBe('COMPLETE')
    expect(s.winner).toBe(0)
  })

  it('plays 3 games when split 1-1', () => {
    let s = eng.initialState(bo3)
    s = scoreN(s, 0, 21) // team 0 wins game 1
    s = scoreN(s, 1, 21) // team 1 wins game 2
    expect(s.currentSet).toBe(2)
    expect(s.status).toBe('ACTIVE')
    s = scoreN(s, 1, 21) // team 1 wins game 3
    expect(s.status).toBe('COMPLETE')
    expect(s.winner).toBe(1)
  })
})

describe('badminton — match (best of 1)', () => {
  it('completes after 1 game', () => {
    let s = eng.initialState(bo1)
    s = scoreN(s, 0, 21)
    expect(s.status).toBe('COMPLETE')
    expect(s.winner).toBe(0)
  })
})

describe('badminton — frozen state', () => {
  it('does not mutate state after match is over', () => {
    let s = eng.initialState(bo1)
    s = scoreN(s, 0, 21)
    const frozen = s
    s = eng.applyPoint(s, 1)
    expect(s).toBe(frozen)
  })
})
