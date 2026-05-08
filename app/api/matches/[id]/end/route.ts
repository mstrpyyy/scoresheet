import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'
import type { Identity } from '@/types'

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
    if (match.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Match is already ended' }, { status: 409 })
    }
    if (match.creatorSub && match.creatorSub !== identity.sub) {
      return NextResponse.json({ error: 'Only the scorer can end the match' }, { status: 403 })
    }

    await prisma.match.update({
      where: { id },
      data: { status: 'ABANDONED' },
    })

    await pusherServer.trigger(`match-${id}`, 'match:complete', { status: 'ABANDONED' })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/matches/:id/end]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
