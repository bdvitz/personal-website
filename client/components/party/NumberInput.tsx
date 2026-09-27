'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

interface NumberInputProps {
  submitted?: number
  disabled?: boolean
  maxDigits?: number
  onSubmit: (value: string) => void
}

// Digits only (non-negative integers); sent as a string and range-checked by the server
export default function NumberInput({ submitted, disabled = false, maxDigits = 7, onSubmit }: NumberInputProps) {
  const [value, setValue] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.length > 0) onSubmit(value)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-3">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, maxDigits))}
          placeholder="Enter a number"
          className="min-w-0 flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-4 text-3xl font-bold text-white
            tabular-nums placeholder:text-base placeholder:font-normal placeholder:text-purple-300/60
            focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <button
          type="submit"
          disabled={disabled || value.length === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
        >
          <Send className="w-5 h-5" />
          Send
        </button>
      </div>
      {submitted !== undefined && (
        <p className="text-purple-200">
          Locked in: <span className="font-bold text-white tabular-nums">{submitted.toLocaleString()}</span>
          <span className="text-purple-300/70"> (you can change it until time runs out)</span>
        </p>
      )}
    </form>
  )
}
