'use client'

import { Crown, X } from 'lucide-react'
import type { RoomView } from '@/lib/party/types'

interface PlayerListProps {
  room: RoomView
  highlightIds?: string[] // e.g. who has answered this phase
  onKick?: (playerId: string) => void
  onMakeVip?: (playerId: string) => void
  showScores?: boolean
}

export default function PlayerList({ room, highlightIds, onKick, onMakeVip, showScores = true }: PlayerListProps) {
  const row = (p: RoomView['players'][number], waiting: boolean) => {
    const highlighted = highlightIds?.includes(p.id)
    return (
      <li
        key={p.id}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
          highlighted ? 'bg-green-500/25 border border-green-400/40' : 'bg-white/5 border border-white/10'
        }`}
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.connected ? 'bg-green-400' : 'bg-gray-500'}`}
          title={p.connected ? 'Connected' : 'Disconnected'}
        />
        <span className={`truncate font-semibold ${p.connected ? 'text-white' : 'text-gray-400'}`}>{p.name}</span>
        {p.id === room.vipPlayerId && <Crown className="h-4 w-4 shrink-0 text-yellow-300" aria-label="VIP" />}
        {waiting && <span className="text-xs text-purple-300">next game</span>}
        <span className="ml-auto flex items-center gap-2">
          {showScores && !waiting && p.score !== undefined && <span className="tabular-nums text-purple-200">{p.score}</span>}
          {onMakeVip && p.id !== room.vipPlayerId && (
            <button
              type="button"
              onClick={() => onMakeVip(p.id)}
              className="rounded p-1 text-purple-300 hover:bg-white/10 hover:text-yellow-300"
              title={`Make ${p.name} the VIP`}
              aria-label={`Make ${p.name} the VIP`}
            >
              <Crown className="h-4 w-4" />
            </button>
          )}
          {onKick && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Remove ${p.name} from the room?`)) onKick(p.id)
              }}
              className="rounded p-1 text-purple-300 hover:bg-white/10 hover:text-white"
              aria-label={`Remove ${p.name}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </span>
      </li>
    )
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-purple-300">
        Players ({room.players.length + room.waiting.length}/{room.maxPlayers})
      </h3>
      {room.players.length + room.waiting.length === 0 ? (
        <p className="text-purple-300/70">Nobody yet. Scan the code to join!</p>
      ) : (
        <ul className="space-y-2">
          {room.players.map((p) => row(p, false))}
          {room.waiting.map((p) => row(p, true))}
        </ul>
      )}
    </div>
  )
}
