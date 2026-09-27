'use client'

import { Check } from 'lucide-react'

interface PlayerPickerProps {
  candidates: { playerId: string; name: string }[]
  youId: string
  selected?: string
  onPick: (playerId: string) => void
}

// Buttons for the "target another player" input. Hides yourself unless you're the only candidate.
export default function PlayerPicker({ candidates, youId, selected, onPick }: PlayerPickerProps) {
  const others = candidates.length > 1 ? candidates.filter((c) => c.playerId !== youId) : candidates

  return (
    <div className="grid grid-cols-2 gap-3">
      {others.map((c) => {
        const isSelected = c.playerId === selected
        return (
          <button
            key={c.playerId}
            type="button"
            onClick={() => onPick(c.playerId)}
            className={`relative min-h-[4rem] truncate rounded-2xl border px-3 py-4 text-lg font-bold text-white transition-all duration-150 active:scale-95 ${
              isSelected
                ? 'border-white bg-purple-500/60 ring-4 ring-white'
                : selected !== undefined
                  ? 'border-white/10 bg-white/5 opacity-60'
                  : 'border-white/20 bg-white/10 hover:bg-white/20'
            }`}
          >
            {isSelected && <Check className="absolute top-2 right-2 h-5 w-5" />}
            {c.name}
          </button>
        )
      })}
    </div>
  )
}
