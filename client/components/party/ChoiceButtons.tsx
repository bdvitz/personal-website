'use client'

import { Check } from 'lucide-react'

export const CHOICE_COLORS = [
  'from-rose-500 to-pink-600',
  'from-sky-500 to-blue-600',
  'from-amber-400 to-orange-500',
  'from-emerald-500 to-green-600',
]

interface ChoiceButtonsProps {
  options: string[]
  selected?: number
  disabled?: boolean
  onSelect: (index: number) => void
}

// 2-4 big tap targets; the selection can be changed until the phase ends
export default function ChoiceButtons({ options, selected, disabled = false, onSelect }: ChoiceButtonsProps) {
  return (
    <div className={`grid gap-3 ${options.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {options.map((option, index) => {
        const isSelected = selected === index
        return (
          <button
            key={index}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(index)}
            className={`relative min-h-[5.5rem] rounded-2xl px-4 py-5 text-lg font-bold text-white shadow-lg
              bg-gradient-to-br ${CHOICE_COLORS[index % CHOICE_COLORS.length]}
              transition-all duration-150 active:scale-95 disabled:opacity-50
              ${isSelected ? 'ring-4 ring-white scale-[1.02]' : selected !== undefined ? 'opacity-60' : ''}`}
          >
            {isSelected && <Check className="absolute top-2 right-2 w-6 h-6" />}
            {option}
          </button>
        )
      })}
    </div>
  )
}
