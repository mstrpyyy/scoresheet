import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { getEngine } from '@/lib/scoring/engine'
import type { Identity, MatchFormat, Sport } from '@/types'

const VALID_SPORTS: Sport[] = ['BADMINTON', 'TENNIS', 'PADEL']
const STATE_TTL = 3600

function stateKey(id: string) { return `match:${id}:state` }

export async function POST(req: NextRequest) {
  try {
    const identity = JSON.parse(req.headers.get('x-identity') ?? '{}') as Identity
    if (!identity.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      sport: Sport
      format: MatchFormat
      players: { name: string; team: 0 | 1 }[]
    }

    const { sport, format, players } = body

    if (!VALID_SPORTS.includes(sport)) {
      return NextResponse.json({ error: 'Invalid sport' }, { status: 400 })
    }
    if (!players || players.length < 2) {
      return NextResponse.json({ error: 'At least 2 players required' }, { status: 400 })
    }
    const teams = new Set(players.map(p => p.team))
    if (!teams.has(0) || !teams.has(1)) {
      return NextResponse.json({ error: 'Players must be on both teams (0 and 1)' }, { status: 400 })
    }
    if (players.some(p => !p.name?.trim())) {
      return NextResponse.json({ error: 'All players must have a name' }, { status: 400 })
    }

    const engine = getEngine(sport)
    const state = engine.initialState({ ...format, sport })

    const match = await prisma.match.create({
      data: {
        sport,
        status: 'ACTIVE',
        creatorSub: identity.sub,
        state: JSON.parse(JSON.stringify(state)),
        format: JSON.parse(JSON.stringify(format)),
        players: {
          create: players.map(p => ({ name: p.name.trim(), team: p.team })),
        },
      },
      include: { players: true },
    })

    await redis.set(stateKey(match.id), JSON.stringify(state), { ex: STATE_TTL })

    return NextResponse.json({
      id: match.id,
      state,
      players: match.players.map(p => ({ id: p.id, name: p.name, team: p.team })),
    }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/matches]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
