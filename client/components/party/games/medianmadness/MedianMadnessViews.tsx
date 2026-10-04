'use client'

import { PartyPopper, Trophy } from 'lucide-react'
import Countdown from '@/components/party/Countdown'
import NumberInput from '@/components/party/NumberInput'
import type { HostViewProps, PlayerViewProps } from '@/lib/party/types'

// Shapes come from server/.../party/game/MedianMadnessGame.java (hostView/playerView).
// Reveal steps: SORTED -> DUPES (red) -> ELIMINATED (grey) -> PLACING (places fill in, rows never move) -> FINAL.

interface ResultRow {
  playerId: string
  name: string
  value?: number // missing = no answer
  status: 'unique' | 'duplicate' | 'none'
  place?: number // only once revealed
  points?: number // only at FINAL
}

const STEPS = ['SUBMIT', 'SORTED', 'DUPES', 'ELIMINATED', 'PLACING', 'FINAL']
const reached = (phase: string, step: string) => STEPS.indexOf(phase) >= STEPS.indexOf(step)

function ordinal(n: number) {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

const CAPTIONS: Record<string, string> = {
  SORTED: "Here's what everyone picked",
  DUPES: 'Duplicates are knocked out!',
  ELIMINATED: 'Duplicates are knocked out!',
  PLACING: 'Placing from the middle out...',
  FINAL: 'Median Madness results',
}

function ResultsTable({ game, highlightId, compact = false }: { game: any; highlightId?: string; compact?: boolean }) {
  const phase: string = game.phase
  const rows: ResultRow[] = game.rows ?? []
  const final = phase === 'FINAL'
  const text = compact ? 'text-lg' : 'text-2xl'

  return (
    <div className="space-y-2">
      <div className={`grid items-center gap-3 px-4 text-xs font-semibold uppercase tracking-widest text-purple-300 ${
        final ? 'grid-cols-[1fr_4rem_4.5rem_4rem]' : 'grid-cols-[1fr_4rem_4.5rem]'
      }`}>
        <span>Player</span>
        <span className="text-right">Pick</span>
        <span className="text-center">Place</span>
        {final && <span className="text-right">Pts</span>}
      </div>
      {rows.map((row) => {
        const out = row.status !== 'unique'
        const flagged = row.status === 'duplicate' && phase === 'DUPES'
        const greyed = out && reached(phase, 'ELIMINATED')
        const latest = phase === 'PLACING' && row.place !== undefined && row.place === game.revealedPlaces
        return (
          <div
            key={row.playerId}
            className={`grid items-center gap-3 rounded-xl border px-4 transition-all duration-700 ${compact ? 'py-2' : 'py-3'} ${
              final ? 'grid-cols-[1fr_4rem_4.5rem_4rem]' : 'grid-cols-[1fr_4rem_4.5rem]'
            } ${
              flagged
                ? 'animate-pulse border-red-400 bg-red-500/30 ring-2 ring-red-400/70'
                : greyed
                  ? 'border-white/5 bg-white/[0.03] opacity-40 grayscale'
                  : latest
                    ? 'border-yellow-300/70 bg-yellow-400/15 ring-2 ring-yellow-300/60'
                    : row.playerId === highlightId
                      ? 'border-purple-300/50 bg-purple-500/30'
                      : 'border-white/10 bg-white/5'
            }`}
          >
            <span className={`truncate font-semibold text-white ${text}`}>
              {row.name}
              {row.status === 'none' && <span className="ml-2 text-sm font-normal text-purple-300">no answer</span>}
            </span>
            <span className={`text-right font-extrabold tabular-nums ${text} ${
              flagged ? 'text-red-200' : 'text-white'
            } ${greyed ? 'line-through' : ''}`}>
              {row.value ?? '–'}
            </span>
            <span className="flex justify-center">
              {row.place !== undefined && (
                <span className={`inline-flex animate-scale-in items-center gap-1 rounded-full px-3 py-1 font-bold tabular-nums ${
                  row.place === 1 ? 'bg-yellow-400/25 text-yellow-200' : 'bg-purple-500/30 text-purple-100'
                } ${compact ? 'text-sm' : 'text-lg'}`}>
                  {row.place === 1 && <Trophy className="h-4 w-4" />}
                  {ordinal(row.place)}
                </span>
              )}
            </span>
            {final && (
              <span className={`text-right font-bold tabular-nums ${text} ${row.points ? 'text-green-300' : 'text-purple-300/60'}`}>
                {row.points ? `+${row.points}` : '0'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function MedianMadnessHostView({ game, clockOffset }: HostViewProps) {
  if (game.phase === 'SUBMIT') {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold uppercase tracking-widest text-purple-300">Median Madness</p>
          <Countdown deadline={game.deadline} clockOffset={clockOffset} large />
        </div>
        <div className="space-y-3 text-center">
          <h2 className="text-4xl font-bold text-white md:text-5xl">Pick a number from 1 to 100!</h2>
          <p className="mx-auto max-w-2xl text-lg text-purple-200">
            Duplicates are knocked out. The remaining numbers are placed from the middle out: the median wins, then
            the next closest above and below. 1st place earns {game.playerCount} points.
          </p>
        </div>
        <p className="text-center text-6xl font-extrabold tabular-nums text-white">
          {game.answeredCount}<span className="text-purple-300">/{game.playerCount}</span>
          <span className="mt-2 block text-lg font-normal text-purple-200">locked in</span>
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h2 className="flex items-center justify-center gap-3 text-center text-3xl font-bold text-white md:text-4xl">
        {game.phase === 'FINAL' && <PartyPopper className="h-9 w-9 text-pink-300" />}
        {CAPTIONS[game.phase]}
      </h2>
      {game.phase === 'FINAL' && game.placeCount === 0 && (
        <p className="text-center text-xl text-purple-200">Everyone was knocked out. Nobody scores!</p>
      )}
      <ResultsTable game={game} />
    </div>
  )
}

export function MedianMadnessPlayerView({ game, you, clockOffset, sendInput }: PlayerViewProps) {
  if (game.phase === 'SUBMIT') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-white">Pick 1 to 100</p>
          <Countdown deadline={game.deadline} clockOffset={clockOffset} large />
        </div>
        <NumberInput
          maxDigits={3}
          submitted={game.yourPick}
          onSubmit={(value) => sendInput({ kind: 'number', value })}
        />
        <p className="text-sm text-purple-300">
          Duplicates are knocked out. Closest to the middle of the remaining numbers wins.
        </p>
      </div>
    )
  }

  const rows: ResultRow[] = game.rows ?? []
  const mine = rows.find((r) => r.playerId === you.playerId)
  let headline: React.ReactNode = <p className="text-xl font-semibold text-purple-100">{CAPTIONS[game.phase]}</p>
  if (mine && mine.status !== 'unique' && reached(game.phase, 'DUPES')) {
    headline = (
      <p className="text-2xl font-bold text-red-300">
        {mine.status === 'none' ? 'No answer: 0 points' : `Knocked out! Someone else picked ${mine.value}`}
      </p>
    )
  } else if (mine?.place !== undefined) {
    headline = (
      <p className="text-3xl font-extrabold text-white">
        You placed {ordinal(mine.place)}
        {mine.points !== undefined && <span className="block text-xl font-semibold text-green-300">+{mine.points} points</span>}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-center">{headline}</div>
      <ResultsTable game={game} highlightId={you.playerId} compact />
    </div>
  )
}
