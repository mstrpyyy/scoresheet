'use client'
import { useState } from 'react'
import { CaretLeftIcon, CheckIcon, LinkIcon, FlagIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { MatchState, Sport } from '@/types'
import Link from 'next/link'

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={copy}
      className="size-8 sm:size-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      title={copied ? 'Copied!' : 'Copy link'}
    >
      {copied ? <CheckIcon size={18} weight="bold" className="sm:hidden" /> : <LinkIcon size={18} className="sm:hidden" />}
      {copied ? <CheckIcon size={22} weight="bold" className="hidden sm:block" /> : <LinkIcon size={22} className="hidden sm:block" />}
    </button>
  )
}

interface Player {
  id: string
  name: string
  team: 0 | 1
}

interface ScoreboardProps {
  sport: Sport
  state: MatchState
  players: Player[]
  isScorer: boolean
  onPoint: (team: 0 | 1) => void
  onSubtract: (team: 0 | 1) => void
  onEndMatch: () => void
}

function GameDots({ won, total }: { won: number; total: number }) {
  return (
    <div className="flex gap-1.5 sm:gap-2 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn('size-2 sm:size-2.5 md:size-3 rounded-full', i < won ? 'bg-score-btn' : 'bg-border')}
        />
      ))}
    </div>
  )
}

function teamName(players: Player[], team: 0 | 1) {
  return players.filter(p => p.team === team).map(p => p.name).join(' / ')
}

function gamesWon(state: MatchState, team: 0 | 1): number {
  return state.sets
    .slice(0, state.currentSet)
    .filter(s => s[team] > s[team === 0 ? 1 : 0]).length
}

function statusLabel(sport: Sport, state: MatchState): string {
  const n = state.currentSet + 1
  return sport === 'BADMINTON' ? `GAME ${n}` : `SET ${n}`
}

function secondaryScore(state: MatchState): string | null {
  if (state.sport === 'BADMINTON') return null
  const gs = state.gameScore ?? [0, 0]
  const ds = state.deuceState ?? null
  if (state.tiebreak || state.superTiebreak) return `${gs[0]} – ${gs[1]}`
  if (ds === 'deuce') return 'Deuce'
  if (ds === 'advantage_0') return 'Ad – 40'
  if (ds === 'advantage_1') return '40 – Ad'
  const MAP = ['0', '15', '30', '40']
  const a = MAP[gs[0]] ?? String(gs[0])
  const b = MAP[gs[1]] ?? String(gs[1])
  if (a === '0' && b === '0') return null
  return `${a} – ${b}`
}

export function Scoreboard({
  sport,
  state,
  players,
  isScorer,
  onPoint,
  onSubtract,
  onEndMatch,
}: ScoreboardProps) {
  const current = state.sets[state.currentSet] ?? [0, 0]
  const totalGames = state.format.bestOf ?? 3
  const dotsCount = sport === 'BADMINTON' ? totalGames : Math.ceil(totalGames / 2)

  const name0 = teamName(players, 0)
  const name1 = teamName(players, 1)
  const won0 = gamesWon(state, 0)
  const won1 = gamesWon(state, 1)
  const label = statusLabel(sport, state)
  const secondary = secondaryScore(state)
  const isOver = state.status !== 'ACTIVE'

  const scoreColor = (team: 0 | 1) => {
    if (isOver) return state.winner === team ? 'text-score-btn' : 'text-foreground'
    return current[team] > current[team === 0 ? 1 : 0] ? 'text-score-btn' : 'text-foreground'
  }

  const showControls = isScorer && !isOver

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">
      {/* Header */}
      <header className="flex items-center px-5 sm:px-8 md:px-12 pt-5 sm:pt-7 pb-4">
        <Link href="/" className="flex items-center gap-1 text-muted-foreground flex-1">
          <span className="leading-none"><CaretLeftIcon size={16} className="sm:hidden" /><CaretLeftIcon size={20} className="hidden sm:block" /></span>
          <span className="text-sm sm:text-base">Matches</span>
        </Link>
        <span className="rounded-full border border-border px-3 py-1 font-mono text-[11px] sm:text-xs font-semibold tracking-[1.5px] text-foreground">
          {sport}
        </span>
        <div className="flex-1 flex justify-end items-center gap-1">
          <CopyLinkButton />
          {isScorer && !isOver && (
            <button
              onClick={onEndMatch}
              className="size-8 sm:size-10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
              title="End match"
            >
              <FlagIcon size={16} className="sm:hidden" /><FlagIcon size={20} className="hidden sm:block" />
            </button>
          )}
        </div>
      </header>

      {/* Status */}
      <p className="text-center font-mono text-[11px] sm:text-xs md:text-sm font-medium text-muted-foreground tracking-[2px] pb-2 sm:pb-3">
        {label}
        {(state.tiebreak || state.superTiebreak) && ' · TIEBREAK'}
      </p>

      {/* Score area */}
      <div className="flex-1 flex items-center justify-center px-8 sm:px-12 md:px-20">
        <div className="w-full grid grid-cols-[1fr_1px_1fr] gap-6 sm:gap-10 items-center">
          {/* Team 0 */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 md:gap-5">
            <p className="text-base sm:text-lg md:text-xl font-medium text-foreground text-center w-full truncate">{name0}</p>
            <div className="flex landscape:flex-row flex-col-reverse gap-3 sm:gap-4 order-3 landscape:order-2">
              {showControls && (
                <button
                  onClick={() => onSubtract(0)}
                  className="flex w-full landscape:w-10 landscape:self-stretch items-center justify-center text-muted-foreground hover:text-foreground text-[18px] transition-colors active:opacity-70"
                >
                  −
                </button>
              )}
              <p className={cn('text-8xl sm:text-9xl md:text-[10rem] lg:text-[13rem] xl:text-[16rem] font-bold leading-none tabular-nums min-w-[2ch] text-center', scoreColor(0))}>
                {current[0]}
              </p>
              {showControls && (
                <button
                  onClick={() => onPoint(0)}
                  className="flex w-full landscape:w-10 landscape:self-stretch items-center justify-center text-muted-foreground hover:text-foreground text-[18px] transition-colors active:opacity-70"
                >
                  +
                </button>
              )}
            </div>
            <div className="order-2 landscape:order-3"><GameDots won={won0} total={dotsCount} /></div>
            {/* {showControls && (
              <div className="flex gap-5 sm:gap-6 justify-center landscape:hidden">
                <button
                  onClick={() => onSubtract(0)}
                  className="size-13 sm:size-16 rounded-full border border-border flex items-center justify-center text-foreground text-[22px] sm:text-[26px] hover:border-foreground/40 hover:bg-foreground/8 transition-colors active:opacity-70"
                >
                  −
                </button>
                <button
                  onClick={() => onPoint(0)}
                  className="size-13 sm:size-16 rounded-full border border-border flex items-center justify-center text-foreground text-[22px] sm:text-[26px] hover:bg-score-btn hover:border-score-btn hover:text-white transition-colors active:opacity-70"
                >
                  +
                </button>
              </div>
            )} */}
          </div>

          {/* Divider */}
          <div className="h-24 sm:h-32 md:h-40 bg-border" />

          {/* Team 1 */}
          <div className="flex flex-col items-center gap-3 sm:gap-4 md:gap-5">
            <p className="text-base sm:text-lg md:text-xl font-medium text-foreground text-center w-full truncate">{name1}</p>
            <div className="flex landscape:flex-row flex-col-reverse items-center gap-3 sm:gap-4 order-3 landscape:order-2">
              {showControls && (
                <button
                  onClick={() => onSubtract(1)}
                  className="flex w-full landscape:w-10 landscape:self-stretch items-center justify-center text-muted-foreground hover:text-foreground text-[18px] transition-colors active:opacity-70"
                >
                  −
                </button>
              )}
              <p className={cn('text-8xl sm:text-9xl md:text-[10rem] lg:text-[13rem] xl:text-[16rem] font-bold leading-none tabular-nums min-w-[2ch] text-center', scoreColor(1))}>
                {current[1]}
              </p>
              {showControls && (
                <button
                  onClick={() => onPoint(1)}
                  className="flex w-full landscape:w-10 landscape:self-stretch items-center justify-center text-muted-foreground hover:text-foreground text-[18px] transition-colors active:opacity-70"
                >
                  +
                </button>
              )}
            </div>
            <div className="order-2 landscape:order-3"><GameDots won={won1} total={dotsCount} /></div>
            {/* {showControls && (
              <div className="flex gap-5 sm:gap-6 justify-center landscape:hidden">
                <button
                  onClick={() => onSubtract(1)}
                  className="size-13 sm:size-16 rounded-full border border-border flex items-center justify-center text-foreground text-[22px] sm:text-[26px] hover:border-foreground/40 hover:bg-foreground/8 transition-colors active:opacity-70"
                >
                  −
                </button>
                <button
                  onClick={() => onPoint(1)}
                  className="size-13 sm:size-16 rounded-full border border-border flex items-center justify-center text-foreground text-[22px] sm:text-[26px] hover:bg-score-btn hover:border-score-btn hover:text-white transition-colors active:opacity-70"
                >
                  +
                </button>
              </div>
            )} */}
          </div>
        </div>
      </div>

      {/* Secondary score (tennis / padel) */}
      {secondary && (
        <p className="text-center text-sm sm:text-base md:text-lg text-muted-foreground py-3 sm:py-4">{secondary}</p>
      )}

      {/* Winner banner */}
      {isOver && (
        <div className="mx-5 sm:mx-8 md:mx-12 mb-4 rounded-2xl bg-score-btn/10 border border-score-btn/30 px-4 py-3 sm:py-4 text-center">
          <p className="text-score-btn font-semibold sm:text-lg">
            {state.winner !== null ? `${teamName(players, state.winner)} wins!` : 'Match ended'}
          </p>
        </div>
      )}

      {/* Actions */}
      {!isScorer && state.status === 'ACTIVE' && (
        <div className="px-5 pt-4 pb-10">
          <p className="text-center text-xs sm:text-sm text-muted-foreground">Spectator view</p>
        </div>
      )}
    </div>
  )
}
