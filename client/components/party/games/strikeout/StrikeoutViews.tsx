'use client'

import { useEffect, useState } from 'react'
import { PartyPopper, X } from 'lucide-react'
import Countdown from '@/components/party/Countdown'
import Standings from '@/components/party/Standings'
import type { HostViewProps, PlayerViewProps } from '@/lib/party/types'

// Shapes come from server/.../party/game/StrikeoutGame.java (hostView/playerView).
// Counts are republished by the server about once a second; your own picks highlight instantly.

interface StrikeRow {
  playerId: string
  name: string
  strikes: number
}

// How long a tap's local state wins before we fall back to the server's yourPicks
const OVERRIDE_MS = 3000

function byName(rows: StrikeRow[]) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name))
}

function StrikeCount({ strikes, large = false }: { strikes: number; large?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${large ? 'text-3xl' : 'text-xl'} ${strikes > 0 ? 'text-rose-300' : 'text-purple-300'}`}>
      <X className={large ? 'h-7 w-7' : 'h-5 w-5'} strokeWidth={3} />
      {strikes}
    </span>
  )
}

export function StrikeoutHostView({ game, clockOffset }: HostViewProps) {
  if (game.phase === 'FINAL') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h2 className="flex items-center justify-center gap-3 text-center text-4xl font-bold text-white">
          <PartyPopper className="h-9 w-9 text-pink-300" /> Strikeout results
        </h2>
        <p className="text-center text-purple-200">Each strike cost 1 point.</p>
        <Standings standings={game.standings} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold uppercase tracking-widest text-purple-300">Strikeout</p>
        <Countdown deadline={game.deadline} clockOffset={clockOffset} large />
      </div>
      <h2 className="text-center text-3xl font-bold text-white md:text-4xl">Hand out your strikes!</h2>
      <p className="text-center text-purple-200">
        Up to {game.maxStrikes}, one per player. Unused strikes are lost. Each strike you end with costs a point.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {byName(game.players).map((row) => (
          <div key={row.playerId} className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3">
            <span className="truncate text-xl font-semibold text-white">{row.name}</span>
            <StrikeCount strikes={row.strikes} large />
          </div>
        ))}
      </div>
    </div>
  )
}

export function StrikeoutPlayerView({ game, you, clockOffset, sendInput }: PlayerViewProps) {
  // Optimistic picks: playerId -> {on, at}. Dropped once the server agrees or after OVERRIDE_MS
  // (e.g. the server rejected the tap), so the box always ends up matching the server.
  const [overrides, setOverrides] = useState<Record<string, { on: boolean; at: number }>>({})
  const serverPicks: string[] = game.yourPicks ?? []

  useEffect(() => {
    const prune = () =>
      setOverrides((prev) => {
        const now = Date.now()
        const next: typeof prev = {}
        for (const [id, o] of Object.entries(prev)) {
          if (o.on !== serverPicks.includes(id) && now - o.at < OVERRIDE_MS) next[id] = o
        }
        return Object.keys(next).length === Object.keys(prev).length ? prev : next
      })
    prune()
    const timer = setInterval(prune, 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPicks.join(',')])

  if (game.phase === 'FINAL') {
    const mine = game.yourStrikes ?? 0
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-purple-200">You ended with</p>
          <p className={`text-6xl font-extrabold tabular-nums ${mine > 0 ? 'text-rose-300' : 'text-green-300'}`}>
            {mine} strike{mine === 1 ? '' : 's'}
          </p>
          <p className="text-lg text-purple-200">{mine > 0 ? `-${mine} points` : 'No points lost!'}</p>
        </div>
        <Standings standings={game.standings} highlightId={you.playerId} />
      </div>
    )
  }

  const isPicked = (id: string) => overrides[id]?.on ?? serverPicks.includes(id)
  const rows: StrikeRow[] = byName(game.players)
  const used = rows.filter((r) => r.playerId !== you.playerId && isPicked(r.playerId)).length
  const remaining = Math.max(0, game.maxStrikes - used)

  const tap = (id: string) => {
    const on = !isPicked(id)
    if (on && remaining <= 0) return
    setOverrides((prev) => ({ ...prev, [id]: { on, at: Date.now() } }))
    sendInput({ kind: 'strike', playerId: id, on })
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-purple-950/80 px-4 py-2 backdrop-blur">
        <span className="flex items-center gap-2 text-lg font-semibold text-white">
          Strikes left
          <span className={`text-2xl font-extrabold tabular-nums ${remaining > 0 ? 'text-rose-300' : 'text-purple-300'}`}>{remaining}</span>
        </span>
        <Countdown deadline={game.deadline} clockOffset={clockOffset} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => {
          const self = row.playerId === you.playerId
          const picked = !self && isPicked(row.playerId)
          const blocked = self || (!picked && remaining <= 0)
          return (
            <button
              key={row.playerId}
              type="button"
              aria-pressed={picked}
              disabled={self}
              onClick={() => !blocked && tap(row.playerId)}
              className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-3 transition-all duration-150 ${
                self
                  ? 'cursor-not-allowed border-white/10 bg-white/5 opacity-40 grayscale'
                  : picked
                    ? 'scale-[1.02] border-rose-300 bg-rose-500/30 ring-4 ring-rose-400/70 active:scale-95'
                    : blocked
                      ? 'border-white/10 bg-white/5 opacity-60'
                      : 'border-white/20 bg-white/10 active:scale-95'
              }`}
            >
              <span className="w-full truncate text-center text-lg font-semibold text-white">
                {row.name}
                {self && <span className="text-sm font-normal text-purple-300"> (you)</span>}
              </span>
              <StrikeCount strikes={row.strikes} />
            </button>
          )
        })}
      </div>
      <p className="text-center text-sm text-purple-300">
        Tap a name to give them a strike, tap again to take it back. Unused strikes are lost when the timer hits 0.
      </p>
    </div>
  )
}
