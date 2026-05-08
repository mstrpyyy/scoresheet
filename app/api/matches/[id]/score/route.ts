import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis, scoreLimiter } from '@/lib/redis'
import { pusherServer } from '@/lib/pusher'
import { getEngine } from '@/lib/scoring/engine'
import type { MatchState, Identity } from '@/types'

const STATE_TTL = 3600

function stateKey(id: string) { return `match:${id}:state` }
function prevKey(id: string) { return `match:${id}:prev` }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const identity = JSON.parse(req.headers.get('x-identity') ?? '{}') as Identity
    if (!identity.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit by identity sub
    const { success } = await scoreLimiter.limit(identity.sub)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json() as { team: unknown }
    if (body.team !== 0 && body.team !== 1) {
      return NextResponse.json({ error: 'team must be 0 or 1' }, { status: 400 })
    }
    const team = body.team as 0 | 1

    // Load match — need creatorSub for auth check
    const match = await prisma.match.findUnique({
      where: { id },
      select: { id: true, sport: true, status: true, creatorSub: true },
    })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Match is not active' }, { status: 409 })
    }
    if (match.creatorSub && match.creatorSub !== identity.sub) {
      return NextResponse.json({ error: 'Only the scorer can add points' }, { status: 403 })
    }

    // Get current state (Redis → Postgres fallback)
    const cached = await redis.get<MatchState>(stateKey(id))
    let state: MatchState
    if (cached) {
      state = cached
    } else {
      const fullMatch = await prisma.match.findUnique({ where: { id }, select: { state: true } })
      if (!fullMatch) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
      state = fullMatch.state as unknown as MatchState
    }

    const engine = getEngine(match.sport)
    const newState = engine.applyPoint(state, team)

    // Persist: prev → current in Redis, update Postgres
    await Promise.all([
      redis.set(prevKey(id), JSON.stringify(state), { ex: STATE_TTL }),
      redis.set(stateKey(id), JSON.stringify(newState), { ex: STATE_TTL }),
    ])

    const eventCount = await prisma.scoreEvent.count({ where: { matchId: id } })
    await prisma.scoreEvent.create({
      data: { matchId: id, team, sequence: eventCount },
    })

    if (newState.status !== state.status || newState.sets !== state.sets) {
      await prisma.match.update({
        where: { id },
        data: {
          status: newState.status,
          state: JSON.parse(JSON.stringify(newState)),
        },
      })
    }

    const isMatchOver = engine.isMatchOver(newState)
    await pusherServer.trigger(`match-${id}`, 'score:update', { state: newState })
    if (isMatchOver) {
      await pusherServer.trigger(`match-${id}`, 'match:complete', { state: newState })
    }

    return NextResponse.json({ state: newState })
  } catch (error) {
    console.error('[POST /api/matches/:id/score]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
