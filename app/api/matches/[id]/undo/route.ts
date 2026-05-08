import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { pusherServer } from '@/lib/pusher'
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

    const match = await prisma.match.findUnique({
      where: { id },
      select: { id: true, status: true, creatorSub: true },
    })
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.creatorSub && match.creatorSub !== identity.sub) {
      return NextResponse.json({ error: 'Only the scorer can undo' }, { status: 403 })
    }

    const prevCached = await redis.get<string>(prevKey(id))
    if (!prevCached) {
      return NextResponse.json({ error: 'Nothing to undo' }, { status: 409 })
    }
    const prevState: MatchState = JSON.parse(prevCached as string)

    // Restore previous state; clear the prev slot
    await Promise.all([
      redis.set(stateKey(id), JSON.stringify(prevState), { ex: STATE_TTL }),
      redis.del(prevKey(id)),
    ])

    // Remove the latest score event from Postgres
    const latest = await prisma.scoreEvent.findFirst({
      where: { matchId: id },
      orderBy: { sequence: 'desc' },
    })
    if (latest) {
      await prisma.scoreEvent.delete({ where: { id: latest.id } })
    }

    // Restore match status and state in Postgres
    await prisma.match.update({
      where: { id },
      data: {
        status: prevState.status,
        state: JSON.parse(JSON.stringify(prevState)),
      },
    })

    await pusherServer.trigger(`match-${id}`, 'match:undo', { state: prevState })

    return NextResponse.json({ state: prevState })
  } catch (error) {
    console.error('[POST /api/matches/:id/undo]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
