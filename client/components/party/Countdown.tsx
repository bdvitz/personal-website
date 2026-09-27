'use client'

import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'

// Server deadlines are epoch ms on the server clock; clockOffset = serverTime - Date.now()
export default function Countdown({ deadline, clockOffset, large = false }: { deadline?: number; clockOffset: number; large?: boolean }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  if (!deadline) return null
  const remaining = Math.max(0, Math.ceil((deadline - (now + clockOffset)) / 1000))
  const urgent = remaining <= 5

  return (
    <span
      className={`inline-flex items-center gap-2 font-bold tabular-nums ${large ? 'text-4xl' : 'text-xl'} ${
        urgent ? 'text-red-300' : 'text-purple-200'
      }`}
    >
      <Timer className={large ? 'w-9 h-9' : 'w-5 h-5'} />
      {remaining}s
    </span>
  )
}
