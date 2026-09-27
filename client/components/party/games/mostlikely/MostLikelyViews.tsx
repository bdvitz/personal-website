'use client'

import { PartyPopper, Star } from 'lucide-react'
import Countdown from '@/components/party/Countdown'
import PlayerPicker from '@/components/party/PlayerPicker'
import Standings from '@/components/party/Standings'
import type { HostViewProps, PlayerViewProps } from '@/lib/party/types'

// Shapes come from server/.../party/game/MostLikelyGame.java (baseView/hostView/playerView)

interface ResultRow {
  playerId: string
  name: string
  votes: number
  top: boolean
}

function RoundLabel({ game }: { game: any }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-widest text-purple-300">
      Round {game.round} of {game.rounds}
    </p>
  )
}

function Results({ results }: { results: ResultRow[] }) {
  const max = Math.max(1, ...results.map((r) => r.votes))
  return (
    <div className="space-y-2">
      {results.map((r) => (
        <div key={r.playerId} className="flex items-center gap-3">
          <div className="flex w-32 shrink-0 items-center justify-end gap-1 truncate text-right font-semibold text-white sm:w-44">
            {r.top && <Star className="h-4 w-4 shrink-0 text-yellow-300" />}
            <span className="truncate">{r.name}</span>
          </div>
          <div className="h-8 flex-1 overflow-hidden rounded-lg bg-white/10">
            <div
              className={`flex h-full items-center justify-end px-3 font-bold text-white transition-all duration-700 ${
                r.top ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-white/20'
              }`}
              style={{ width: `${Math.max(6, (r.votes / max) * 100)}%` }}
            >
              {r.votes}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function MostLikelyHostView({ game, clockOffset }: HostViewProps) {
  switch (game.phase) {
    case 'VOTE':
      return (
        <div className="space-y-6 text-center">
          <RoundLabel game={game} />
          <h2 className="text-3xl font-bold text-white md:text-5xl">{game.prompt}</h2>
          <p className="text-purple-200">Vote on your phone. Pick the room's favorite for 1 point.</p>
          <div className="flex items-center justify-center gap-8">
            <Countdown deadline={game.deadline} clockOffset={clockOffset} large />
            <span className="text-2xl font-semibold text-purple-100">
              {game.answeredIds?.length ?? 0}/{game.participantIds?.length ?? 0} voted
            </span>
          </div>
        </div>
      )
    case 'REVEAL':
      return (
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="text-center">
            <RoundLabel game={game} />
            <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">{game.prompt}</h2>
          </div>
          <Results results={game.results} />
          <p className="text-center text-purple-300">{game.lastRound ? 'Next: final scores' : 'Next: another round'}</p>
        </div>
      )
    case 'FINAL':
      return (
        <div className="mx-auto max-w-2xl space-y-6">
          <h2 className="flex items-center justify-center gap-3 text-center text-4xl font-bold text-white">
            <PartyPopper className="h-9 w-9 text-pink-300" /> Final scores
          </h2>
          <Standings standings={game.standings} />
        </div>
      )
    default:
      return null
  }
}

export function MostLikelyPlayerView({ game, you, clockOffset, sendInput }: PlayerViewProps) {
  switch (game.phase) {
    case 'VOTE':
      return (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <RoundLabel game={game} />
              <h2 className="mt-1 text-2xl font-bold text-white">{game.prompt}</h2>
            </div>
            <Countdown deadline={game.deadline} clockOffset={clockOffset} />
          </div>
          <PlayerPicker
            candidates={game.candidates}
            youId={you.playerId}
            selected={game.yourVote}
            onPick={(playerId) => sendInput({ kind: 'target', playerId })}
          />
        </div>
      )
    case 'REVEAL': {
      const top = (game.results as ResultRow[]).filter((r) => r.top).map((r) => r.name)
      return (
        <div className="space-y-4 text-center">
          <p className={`text-3xl font-extrabold ${game.youScored ? 'text-green-300' : 'text-purple-200'}`}>
            {game.youScored ? '+1 point!' : game.yourVote === undefined ? 'No vote this time' : 'No points this round'}
          </p>
          {top.length > 0 && (
            <p className="text-lg text-purple-100">
              The room picked <span className="font-bold text-white">{top.join(' & ')}</span>
            </p>
          )}
          <p className="text-purple-300">Look at the TV!</p>
        </div>
      )
    }
    case 'FINAL':
      return (
        <div className="space-y-4">
          <h2 className="text-center text-2xl font-bold text-white">Final scores</h2>
          <Standings standings={game.standings} highlightId={you.playerId} />
        </div>
      )
    default:
      return null
  }
}
