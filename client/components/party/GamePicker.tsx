'use client'

import { Play } from 'lucide-react'
import { GAME_ORDER, PARTY_GAMES } from './games/registry'

// Game choice lives on the server (room.selectedGameId) so the TV and VIP phone always agree
export default function GamePicker({ selectedId, onSelect, onStart, label = 'Start game' }: {
  selectedId?: string
  onSelect: (gameId: string) => void
  onStart: () => void
  label?: string
}) {
  const current = selectedId && PARTY_GAMES[selectedId] ? selectedId : GAME_ORDER[0]

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {GAME_ORDER.map((id) => {
          const game = PARTY_GAMES[id]
          const selected = id === current
          return (
            <button
              key={id}
              type="button"
              onClick={() => !selected && onSelect(id)}
              aria-pressed={selected}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                selected ? 'border-purple-400 bg-purple-500/25' : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="font-bold text-white">{game.name}</div>
              <div className="text-sm text-purple-200">{game.description}</div>
            </button>
          )
        })}
      </div>
      <button type="button" onClick={onStart} className="btn-primary flex w-full items-center justify-center gap-2">
        <Play className="h-5 w-5" />
        {label}: {PARTY_GAMES[current].name}
      </button>
    </div>
  )
}
