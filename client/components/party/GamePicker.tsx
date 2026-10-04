'use client'

import { Play } from 'lucide-react'
import { GAME_ORDER, PARTY_GAMES } from './games/registry'

// Game choice lives on the server (room.selectedGameId) so the TV and VIP phone always agree
// Lobby options (e.g. a time limit) live there too, as room.gameOptions for the selected game
export default function GamePicker({ selectedId, options, onSelect, onOption, onStart, label = 'Start game' }: {
  selectedId?: string
  options?: Record<string, number>
  onSelect: (gameId: string) => void
  onOption: (key: string, value: number) => void
  onStart: () => void
  label?: string
}) {
  const current = selectedId && PARTY_GAMES[selectedId] ? selectedId : GAME_ORDER[0]
  const gameOptions = PARTY_GAMES[current].options ?? []

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
      {gameOptions.map((option) => (
        <div key={option.key} className="flex items-center justify-between gap-3">
          <span className="font-semibold text-purple-200">{option.label}</span>
          <div className="flex overflow-hidden rounded-lg border border-white/15" role="group" aria-label={option.label}>
            {option.choices.map((choice) => {
              const selected = options?.[option.key] === choice.value
              return (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => !selected && onOption(option.key, choice.value)}
                  className={`px-4 py-2 font-semibold transition-colors ${
                    selected ? 'bg-purple-500/60 text-white' : 'bg-white/5 text-purple-200 hover:bg-white/10'
                  }`}
                >
                  {choice.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button type="button" onClick={onStart} className="btn-primary flex w-full items-center justify-center gap-2">
        <Play className="h-5 w-5" />
        {label}: {PARTY_GAMES[current].name}
      </button>
    </div>
  )
}
