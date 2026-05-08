import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import type { MatchState, Identity } from '@/types'

const STATE_TTL = 3600

function stateKey(id: string) { return `match:${id}:state` }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const identity = JSON.parse(req.headers.get('x-identity') ?? '{}') as Identity

    // Try Redis first
    const cached = await redis.get<string>(stateKey(id))
    let state: MatchState | null = cached ? JSON.parse(cached as string) : null

    const match = await prisma.match.findUnique({
      where: { id },
      include: { players: true },
    })

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Warm the cache if it was empty
    if (!state) {
      state = match.state as unknown as MatchState
      await redis.set(stateKey(id), JSON.stringify(state), { ex: STATE_TTL })
    }

    const isScorer = !!identity.sub && identity.sub === match.creatorSub

    return NextResponse.json({
      id: match.id,
      sport: match.sport,
      status: match.status,
      state,
      players: match.players.map(p => ({ id: p.id, name: p.name, team: p.team })),
      isScorer,
    })
  } catch (error) {
    console.error('[GET /api/matches/:id]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
