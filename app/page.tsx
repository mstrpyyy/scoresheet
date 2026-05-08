'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/GuestAuthProvider'
import { cn } from '@/lib/utils'
import type { Sport, MatchFormat } from '@/types'

const SPORTS: { id: Sport; label: string }[] = [
  { id: 'BADMINTON', label: 'Badminton' },
  { id: 'TENNIS', label: 'Tennis' },
  { id: 'PADEL', label: 'Padel' },
]

const FORMAT_OPTIONS: Record<Sport, { label: string; format: Partial<MatchFormat> }[]> = {
  BADMINTON: [
    { label: 'Best of 3', format: { bestOf: 3 } },
    { label: 'Best of 1', format: { bestOf: 1 } },
  ],
  TENNIS: [
    { label: 'Deuce / Advantage', format: { noAd: false } },
    { label: 'No-Ad (sudden death)', format: { noAd: true } },
  ],
  PADEL: [
    { label: 'Golden Point', format: { goldenPoint: true } },
    { label: 'Standard Deuce', format: { goldenPoint: false } },
  ],
}

export default function HomePage() {
  const router = useRouter()
  const { apiFetch } = useAuth()

  const [sport, setSport] = useState<Sport>('BADMINTON')
  const [formatIdx, setFormatIdx] = useState(0)
  const [player0, setPlayer0] = useState('')
  const [player1, setPlayer1] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatOptions = FORMAT_OPTIONS[sport]

  function handleSportChange(s: Sport) {
    setSport(s)
    setFormatIdx(0)
  }

  async function handleCreate() {
    if (!player0.trim() || !player1.trim()) {
      setError('Both player names are required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/matches', {
        method: 'POST',
        body: JSON.stringify({
          sport,
          format: { sport, ...formatOptions[formatIdx].format },
          players: [
            { name: player0.trim(), team: 0 },
            { name: player1.trim(), team: 1 },
          ],
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create match.')
        return
      }
      const { id } = await res.json()
      router.push(`/match/${id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col pt-15 pb-10 px-5 gap-8 mx-auto w-full max-w-md">

      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-normal leading-none tracking-[-0.5px] text-foreground">
          New Match
        </h1>
        <p className="text-sm leading-normal text-silver">
          Set up a scoreboard, share the link, play.
        </p>
      </div>

      {/* Sport */}
      <section className="flex flex-col gap-3">
        <p className="font-mono text-[10px] font-semibold tracking-[2px] text-muted-foreground uppercase">
          Sport
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SPORTS.map(s => (
            <button
              key={s.id}
              onClick={() => handleSportChange(s.id)}
              className={cn(
                'h-11 rounded-xl text-[13px] font-medium transition-colors',
                sport === s.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border text-muted-foreground hover:border-silver hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Players */}
      <section className="flex flex-col gap-3">
        <p className="font-mono text-[10px] font-semibold tracking-[2px] text-muted-foreground uppercase">
          Players
        </p>
        <input
          value={player0}
          onChange={e => setPlayer0(e.target.value)}
          placeholder="Player 1 name"
          maxLength={30}
          className="h-12 rounded-[3px] border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
        />
        <input
          value={player1}
          onChange={e => setPlayer1(e.target.value)}
          placeholder="Player 2 name"
          maxLength={30}
          className="h-12 rounded-[3px] border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-border transition-colors"
        />
      </section>

      {/* Format */}
      <section className="flex flex-col gap-3">
        <p className="font-mono text-[10px] font-semibold tracking-[2px] text-muted-foreground uppercase">
          Format
        </p>
        {formatOptions.map((opt, i) => (
          <button
            key={i}
            onClick={() => setFormatIdx(i)}
            className={cn(
              'flex items-center gap-3 h-12 rounded-xl px-4 text-sm text-left transition-colors',
              formatIdx === i
                ? 'bg-card border border-foreground text-foreground'
                : 'border border-border text-muted-foreground hover:border-silver hover:text-foreground',
            )}
          >
            <span className={cn(
              'size-3.5 rounded-full shrink-0 transition-colors',
              formatIdx === i ? 'bg-primary' : 'border-[1.5px] border-muted-foreground',
            )} />
            {opt.label}
          </button>
        ))}
      </section>

      <div className="flex-1" />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* CTA — bg-score-btn is the explicit coral-red token */}
      <button
        onClick={handleCreate}
        disabled={loading}
        className="h-13 w-full rounded-xl bg-score-btn text-[15px] font-medium text-primary-foreground transition-colors hover:bg-score-btn-hover disabled:opacity-60"
      >
        {loading ? 'Creating…' : 'Start Match'}
      </button>

    </main>
  )
}
