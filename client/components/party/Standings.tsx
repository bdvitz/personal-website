'use client'

import { Trophy } from 'lucide-react'

export interface StandingRow {
  playerId: string
  name: string
  points: number
}

// Final-scores list shared by games (server sends rows sorted by points)
export default function Standings({ standings, highlightId }: { standings: StandingRow[]; highlightId?: string }) {
  return (
    <ol className="space-y-2">
      {standings.map((s, i) => (
        <li
          key={s.playerId}
          className={`flex items-center gap-3 rounded-lg px-4 py-2 ${
            s.playerId === highlightId ? 'bg-purple-500/30 border border-purple-300/50' : 'bg-white/5'
          }`}
        >
          <span className="w-6 text-right font-bold text-purple-300">{i + 1}</span>
          {i === 0 && s.points > 0 && <Trophy className="h-5 w-5 text-yellow-300" />}
          <span className="font-semibold text-white">{s.name}</span>
          <span className="ml-auto font-bold tabular-nums text-white">{s.points} pts</span>
        </li>
      ))}
    </ol>
  )
}
