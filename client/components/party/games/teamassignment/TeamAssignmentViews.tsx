'use client'

import { DoorOpen, Ruler, Shuffle } from 'lucide-react'
import type { HostViewProps, PlayerViewProps, SendControl } from '@/lib/party/types'

// Shapes come from server/.../party/game/TeamAssignmentGame.java (hostView/playerView).
// Host/VIP drive it with control actions: assign{k}, reroll, changeSize, exit. Exit returns straight to the lobby.

interface Ref {
  playerId: string
  name: string
}

interface Team {
  letter: string
  players: Ref[]
}

// At most 8 teams (16 players, k >= 2). Full class strings so Tailwind keeps them.
const TEAM_STYLE: { text: string; box: string }[] = [
  { text: 'text-cyan-300', box: 'border-cyan-300/40 bg-cyan-500/15' },
  { text: 'text-amber-300', box: 'border-amber-300/40 bg-amber-500/15' },
  { text: 'text-pink-300', box: 'border-pink-300/40 bg-pink-500/15' },
  { text: 'text-lime-300', box: 'border-lime-300/40 bg-lime-500/15' },
  { text: 'text-violet-300', box: 'border-violet-300/40 bg-violet-500/15' },
  { text: 'text-orange-300', box: 'border-orange-300/40 bg-orange-500/15' },
  { text: 'text-sky-300', box: 'border-sky-300/40 bg-sky-500/15' },
  { text: 'text-emerald-300', box: 'border-emerald-300/40 bg-emerald-500/15' },
]

// Keyed by letter so a team keeps its color after a kick drops an earlier team
function teamStyle(letter: string) {
  return TEAM_STYLE[(letter.charCodeAt(0) - 65) % TEAM_STYLE.length]
}

function teamCount(n: number, k: number) {
  return Math.floor((n + k - 1) / k)
}

const secondaryButton =
  'flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/20'

// Shared by the TV and the VIP phone
function Controls({ game, sendControl }: { game: any; sendControl: SendControl }) {
  const exit = (
    <button
      type="button"
      onClick={() => confirm('Exit Team Assignment and return to the lobby?') && sendControl({ action: 'exit' })}
      className={secondaryButton}
    >
      <DoorOpen className="h-5 w-5" /> Exit
    </button>
  )

  if (game.phase === 'PICK') {
    const n: number = game.playerCount
    const sizes: number[] = []
    for (let k = game.minK; k <= game.maxK; k++) sizes.push(k)
    return (
      <div className="space-y-3">
        <p className="text-center font-semibold text-purple-200">Max players per team</p>
        <div className="grid grid-cols-4 gap-2">
          {sizes.map((k) => {
            const teams = teamCount(n, k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => sendControl({ action: 'assign', k })}
                className={`rounded-xl border px-2 py-3 text-white hover:bg-purple-500/30 ${
                  k === game.k ? 'border-purple-300 bg-purple-500/25' : 'border-white/20 bg-white/10'
                }`}
              >
                <span className="block text-2xl font-extrabold">{k}</span>
                <span className="block text-xs text-purple-200">{teams} team{teams === 1 ? '' : 's'}</span>
              </button>
            )
          })}
        </div>
        {exit}
      </div>
    )
  }

  if (game.phase === 'TEAMS') {
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => confirm('Reshuffle everyone into new teams?') && sendControl({ action: 'reroll' })}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Shuffle className="h-5 w-5" /> Reroll
        </button>
        <button
          type="button"
          onClick={() => confirm('Pick a different team size?') && sendControl({ action: 'changeSize' })}
          className={secondaryButton}
        >
          <Ruler className="h-5 w-5" /> Change size
        </button>
        {exit}
      </div>
    )
  }

  return null
}

function TeamGrid({ teams }: { teams: Team[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {teams.map((t) => {
        const style = teamStyle(t.letter)
        return (
          <div key={t.letter} className={`space-y-2 rounded-2xl border p-4 ${style.box}`}>
            <p className={`text-5xl font-extrabold ${style.text}`}>{t.letter}</p>
            <ul className="space-y-1">
              {t.players.map((p) => (
                <li key={p.playerId} className="truncate text-xl font-semibold text-white">{p.name}</li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export function TeamAssignmentHostView({ game, sendControl }: HostViewProps) {
  const teams: Team[] = game.teams ?? []
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold uppercase tracking-widest text-purple-300">Team Assignment</p>
        <p className="text-purple-200">
          {game.playerCount} players{game.phase === 'TEAMS' ? ` · ${teams.length} teams of up to ${game.k}` : ''}
        </p>
      </div>

      {game.phase === 'PICK' && (
        <h2 className="text-center text-4xl font-bold text-white">How big should the teams be?</h2>
      )}
      {game.phase === 'TEAMS' && <TeamGrid teams={teams} />}

      <div className="mx-auto max-w-2xl">
        <Controls game={game} sendControl={sendControl} />
      </div>
    </div>
  )
}

export function TeamAssignmentPlayerView({ game, you, sendControl }: PlayerViewProps) {
  const teams: Team[] = game.teams ?? []
  const mine: Team | undefined = game.yourTeamIndex !== undefined ? teams[game.yourTeamIndex] : undefined

  let body: React.ReactNode
  if (game.phase === 'TEAMS' && mine) {
    const style = teamStyle(mine.letter)
    const mates = mine.players.filter((p) => p.playerId !== you.playerId)
    body = (
      <div className={`space-y-3 rounded-2xl border p-5 text-center ${style.box}`}>
        <p className="text-sm font-semibold uppercase tracking-widest text-purple-200">Your team</p>
        <p className={`text-[8rem] font-extrabold leading-none ${style.text}`}>{mine.letter}</p>
        {mates.length ? (
          <ul className="space-y-1">
            {mates.map((p) => (
              <li key={p.playerId} className="text-xl font-semibold text-white">{p.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-purple-200">Just you on this one</p>
        )}
      </div>
    )
  } else {
    body = <p className="py-6 text-center text-xl text-purple-100">Waiting for the host to pick team sizes...</p>
  }

  return (
    <div className="space-y-5">
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
