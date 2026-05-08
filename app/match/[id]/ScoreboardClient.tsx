'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/GuestAuthProvider'
import { Scoreboard } from '@/components/scoreboard/Scoreboard'
import { getEngine } from '@/lib/scoring/engine'
import { getPusherClient } from '@/lib/pusher'
import type { MatchState, Sport } from '@/types'

interface Player {
  id: string
  name: string
  team: 0 | 1
}

interface Props {
  matchId: string
  sport: Sport
  initialState: MatchState
  players: Player[]
  isScorer: boolean
}

export function ScoreboardClient({ matchId, sport, initialState, players, isScorer }: Props) {
  const router = useRouter()
  const { apiFetch } = useAuth()
  const [state, setState] = useState<MatchState>(initialState)
  const stateRef = useRef<MatchState>(initialState)
  const queueRef = useRef<Array<{ type: 'add' | 'subtract'; team: 0 | 1 }>>([])
  const processingRef = useRef(false)

  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(`match-${matchId}`)

    channel.bind('score:update', (data: { state: MatchState }) => {
      if (queueRef.current.length === 0 && !processingRef.current) {
        stateRef.current = data.state
        setState(data.state)
      }
    })
    channel.bind('match:complete', (data: { state: MatchState }) => {
      stateRef.current = data.state
      setState(data.state)
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`match-${matchId}`)
    }
  }, [matchId])

  async function drainQueue() {
    if (processingRef.current) return
    processingRef.current = true
    while (queueRef.current.length > 0) {
      const entry = queueRef.current.shift()!
      try {
        if (entry.type === 'add') {
          await apiFetch(`/api/matches/${matchId}/score`, {
            method: 'POST',
            body: JSON.stringify({ team: entry.team }),
          })
        } else {
          await apiFetch(`/api/matches/${matchId}/subtract`, {
            method: 'POST',
            body: JSON.stringify({ team: entry.team }),
          })
        }
      } catch {
        // Pusher will resync if needed
      }
    }
    processingRef.current = false
  }

  function handlePoint(team: 0 | 1) {
    const engine = getEngine(sport)
    const newState = engine.applyPoint(stateRef.current, team)
    stateRef.current = newState
    setState(newState)
    queueRef.current.push({ type: 'add', team })
    drainQueue()
  }

  function handleSubtract(team: 0 | 1) {
    const sets = stateRef.current.sets.map(s => [...s] as [number, number])
    sets[stateRef.current.currentSet][team] = Math.max(0, sets[stateRef.current.currentSet][team] - 1)
    const optimistic: MatchState = { ...stateRef.current, sets }
    stateRef.current = optimistic
    setState(optimistic)
    queueRef.current.push({ type: 'subtract', team })
    drainQueue()
  }

  async function handleEndMatch() {
    if (!confirm('End this match?')) return
    try {
      await apiFetch(`/api/matches/${matchId}/end`, { method: 'POST' })
    } finally {
      router.push('/')
    }
  }

  return (
    <Scoreboard
      sport={sport}
      state={state}
      players={players}
      isScorer={isScorer}
      onPoint={handlePoint}
      onSubtract={handleSubtract}
      onEndMatch={handleEndMatch}
    />
  )
}
