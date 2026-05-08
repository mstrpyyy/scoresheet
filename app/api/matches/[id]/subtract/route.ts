import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { pusherServer } from '@/lib/pusher'
import { getEngine } from '@/lib/scoring/engine'
import type { MatchState, MatchFormat, Identity } from '@/types'

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

    const body = await req.json() as { team: unknown }
    if (body.team !== 0 && body.team !== 1) {
      return NextResponse.json({ error: 'team must be 0 or 1' }, { status: 400 })
    }
    const team = body.team as 0 | 1

    const match = await prisma.match.findUnique({
      where: { id },
      select: { id: true, sport: true, creatorSub: true, format: true },
    })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.creatorSub && match.creatorSub !== identity.sub) {
      return NextResponse.json({ error: 'Only the scorer can subtract points' }, { status: 403 })
    }

    const lastTeamEvent = await prisma.scoreEvent.findFirst({
      where: { matchId: id, team },
      orderBy: { sequence: 'desc' },
    })
    if (!lastTeamEvent) {
      return NextResponse.json({ error: 'No points to subtract for that team' }, { status: 409 })
    }

    await prisma.scoreEvent.delete({ where: { id: lastTeamEvent.id } })

    const events = await prisma.scoreEvent.findMany({
      where: { matchId: id },
      orderBy: { sequence: 'asc' },
    })

    const engine = getEngine(match.sport)
    const format = match.format as unknown as MatchFormat
    let newState: MatchState = engine.initialState(format)
    for (const ev of events) {
      newState = engine.applyPoint(newState, ev.team as 0 | 1)
    }

    await Promise.all([
      redis.set(stateKey(id), JSON.stringify(newState), { ex: STATE_TTL }),
      redis.del(prevKey(id)),
    ])

    await prisma.match.update({
      where: { id },
      data: {
        status: newState.status,
        state: JSON.parse(JSON.stringify(newState)),
      },
    })

    await pusherServer.trigger(`match-${id}`, 'score:update', { state: newState })

    return NextResponse.json({ state: newState })
  } catch (error) {
    console.error('[POST /api/matches/:id/subtract]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
