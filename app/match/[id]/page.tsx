import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { ScoreboardClient } from './ScoreboardClient'
import type { Identity, MatchState } from '@/types'

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hdrs = await headers()
  const identity = JSON.parse(hdrs.get('x-identity') ?? '{}') as Partial<Identity>

  const match = await prisma.match.findUnique({
    where: { id },
    include: { players: true },
  })

  if (!match) notFound()

  const cached = await redis.get<MatchState>(`match:${id}:state`)
  const state: MatchState = cached ?? (match.state as unknown as MatchState)

  const isScorer = !!(identity.sub && identity.sub === match.creatorSub)

  return (
    <ScoreboardClient
      matchId={id}
      sport={match.sport}
      initialState={state}
      players={match.players.map(p => ({
        id: p.id,
        name: p.name,
        team: p.team as 0 | 1,
      }))}
      isScorer={isScorer}
    />
  )
}
