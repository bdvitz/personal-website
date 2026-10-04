'use client'

import { useEffect, useState } from 'react'
import { Crown, Flag, Handshake, Play, Skull } from 'lucide-react'
import PlayingCard, { cardName, type CardFace } from '@/components/party/PlayingCard'
import Standings from '@/components/party/Standings'
import type { HostViewProps, PlayerViewProps, SendControl } from '@/lib/party/types'

// Shapes come from server/.../party/game/CardConundrumGame.java (hostView/playerView).
// Host/VIP drive it with control actions: startRound, eliminate{playerId?}, endGame. Every action asks for confirmation.

interface Ref {
  playerId: string
  name: string
}

interface Group {
  card: CardFace
  players: Ref[]
}

function BigCountdown({ deadline, clockOffset }: { deadline?: number; clockOffset: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [])
  const remaining = deadline ? Math.max(1, Math.ceil((deadline - (now + clockOffset)) / 1000)) : 5
  return (
    <div className="space-y-4 py-6 text-center">
      <p className="text-2xl font-semibold text-purple-200">Pointers ready...</p>
      <p key={remaining} className="animate-scale-in text-[10rem] font-extrabold leading-none tabular-nums text-white">
        {remaining}
      </p>
    </div>
  )
}

function Announcement({ game }: { game: any }) {
  const out: Ref | undefined = game.lastResult?.eliminated
  return (
    <div className="space-y-2 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-purple-300">Round {game.lastResult?.round}</p>
      {out ? (
        <p className="flex items-center justify-center gap-3 text-4xl font-extrabold text-red-300 md:text-5xl">
          <Skull className="h-10 w-10" /> {out.name} is out!
        </p>
      ) : (
        <p className="flex items-center justify-center gap-3 text-4xl font-extrabold text-white md:text-5xl">
          <Handshake className="h-10 w-10" /> Nobody eliminated
        </p>
      )}
    </div>
  )
}

// Shared by the TV and the VIP phone
function Controls({ game, sendControl }: { game: any; sendControl: SendControl }) {
  const phase: string = game.phase
  const nextRound = phase === 'READY' ? game.round : game.round + 1

  if (phase === 'READY' || phase === 'RESULT') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => confirm(`Start round ${nextRound}?`) && sendControl({ action: 'startRound' })}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Play className="h-5 w-5" /> Start round {nextRound}
        </button>
        <button
          type="button"
          onClick={() => confirm('End Card Conundrum now? Points earned so far are kept.') && sendControl({ action: 'endGame' })}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/20"
        >
          <Flag className="h-5 w-5" /> End game
        </button>
      </div>
    )
  }

  if (phase === 'CARDS') {
    const alive: Ref[] = [...game.alive].sort((a, b) => a.name.localeCompare(b.name))
    return (
      <div className="space-y-3">
        <p className="text-center font-semibold text-purple-200">Who touched their card last?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {alive.map((p) => (
            <button
              key={p.playerId}
              type="button"
              onClick={() => confirm(`Eliminate ${p.name}?`) && sendControl({ action: 'eliminate', playerId: p.playerId })}
              className="truncate rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-3 font-semibold text-white hover:bg-red-500/30"
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => confirm('Call it a tie and eliminate nobody?') && sendControl({ action: 'eliminate' })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/20"
        >
          <Handshake className="h-5 w-5" /> No elimination (tie)
        </button>
      </div>
    )
  }

  return null
}

function GroupGrid({ groups, size, highlight }: { groups: Group[]; size: 'sm' | 'md'; highlight?: number }) {
  return (
    <div className={`grid gap-4 ${size === 'sm' ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-3'}`}>
      {groups.map((g, i) => (
        <div
          key={`${g.card.rank}${g.card.suit}`}
          className={`space-y-2 rounded-2xl p-3 ${i === highlight ? 'bg-purple-500/30 ring-2 ring-purple-300' : 'bg-white/5'}`}
        >
          <PlayingCard card={g.card} size={size} />
          <p className={`text-center font-semibold text-white ${size === 'sm' ? 'text-xs' : 'text-lg'}`}>
            {g.players.map((p) => p.name).join(', ')}
          </p>
        </div>
      ))}
    </div>
  )
}

function Final({ game, highlightId }: { game: any; highlightId?: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {game.lastResult?.eliminated && (
        <p className="text-center text-lg text-purple-200">{game.lastResult.eliminated.name} was out in round {game.lastResult.round}.</p>
      )}
      {game.winner ? (
        <p className="flex items-center justify-center gap-3 text-center text-4xl font-extrabold text-yellow-200 md:text-5xl">
          <Crown className="h-10 w-10" /> {game.winner.name} wins!
        </p>
      ) : (
        <p className="text-center text-3xl font-bold text-white">Game over</p>
      )}
      <Standings standings={game.standings} highlightId={highlightId} />
    </div>
  )
}

export function CardConundrumHostView({ game, clockOffset, sendControl }: HostViewProps) {
  const phase: string = game.phase
  if (phase === 'FINAL') return <Final game={game} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold uppercase tracking-widest text-purple-300">Card Conundrum</p>
        <p className="text-purple-200">Round {game.round} · {game.alive.length} left</p>
      </div>

      {phase === 'READY' && (
        <div className="space-y-3 text-center">
          <h2 className="text-4xl font-bold text-white">Grab your pointers!</h2>
          <p className="mx-auto max-w-2xl text-lg text-purple-200">
            Each round you're put in a group of up to 3. Your group gets a card. Touch it on the table as fast as you
            can. The last player to touch their card is out.
          </p>
        </div>
      )}
      {phase === 'COUNTDOWN' && <BigCountdown deadline={game.deadline} clockOffset={clockOffset} />}
      {phase === 'CARDS' && <GroupGrid groups={game.groups} size="md" />}
      {phase === 'RESULT' && <Announcement game={game} />}

      <div className="mx-auto max-w-2xl">
        <Controls game={game} sendControl={sendControl} />
      </div>
    </div>
  )
}

export function CardConundrumPlayerView({ game, you, clockOffset, sendControl }: PlayerViewProps) {
  const phase: string = game.phase
  if (phase === 'FINAL') return <Final game={game} highlightId={you.playerId} />

  const groups: Group[] = game.groups ?? []
  const mine: Group | undefined = game.yourGroupIndex !== undefined ? groups[game.yourGroupIndex] : undefined
  const outRow: (Ref & { round: number }) | undefined = game.eliminated.find((e: Ref) => e.playerId === you.playerId)

  let body: React.ReactNode = null
  if (phase === 'READY') {
    body = <p className="py-6 text-center text-xl text-purple-100">Grab your pointer! Round 1 starts soon.</p>
  } else if (phase === 'COUNTDOWN') {
    body = <BigCountdown deadline={game.deadline} clockOffset={clockOffset} />
  } else if (phase === 'CARDS' && mine) {
    const others = mine.players.filter((p) => p.playerId !== you.playerId)
    body = (
      <div className="space-y-4">
        <PlayingCard card={mine.card} size="lg" />
        <p className="text-center text-2xl font-bold text-white">{cardName(mine.card)}</p>
        <p className="text-center text-purple-200">
          {others.length ? `Racing: ${others.map((p) => p.name).join(', ')}` : 'This card is all yours'}
        </p>
      </div>
    )
  } else if (phase === 'CARDS') {
    body = <GroupGrid groups={groups} size="sm" />
  } else if (phase === 'RESULT') {
    body = <Announcement game={game} />
  }

  return (
    <div className="space-y-5">
      {game.out && (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-center font-semibold text-red-200">
          <Skull className="h-5 w-5" /> You're out{outRow ? ` (round ${outRow.round})` : ''}. Watch the rest!
        </p>
      )}
      {body}
      {you.vip && (
        <div className="border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-300">VIP controls</p>
          <Controls game={game} sendControl={sendControl} />
        </div>
      )}
    </div>
  )
}
