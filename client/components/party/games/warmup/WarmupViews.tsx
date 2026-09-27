'use client'

import { PartyPopper, Star } from 'lucide-react'
import ChoiceButtons, { CHOICE_COLORS } from '@/components/party/ChoiceButtons'
import Countdown from '@/components/party/Countdown'
import NumberInput from '@/components/party/NumberInput'
import Standings from '@/components/party/Standings'
import type { HostViewProps, PlayerViewProps } from '@/lib/party/types'

// Shapes come from server/.../party/game/WarmupGame.java (baseView/hostView/playerView)

function Tally({ options, tally }: { options: string[]; tally: number[] }) {
  const max = Math.max(1, ...tally)
  const top = Math.max(...tally)
  return (
    <div className="space-y-2">
      {options.map((option, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-32 shrink-0 truncate text-right font-semibold text-white sm:w-44">{option}</div>
          <div className="h-9 flex-1 overflow-hidden rounded-lg bg-white/10">
            <div
              className={`flex h-full items-center justify-end bg-gradient-to-r px-3 font-bold text-white transition-all duration-700 ${CHOICE_COLORS[i % CHOICE_COLORS.length]} ${
                tally[i] === top && top > 0 ? 'ring-2 ring-white' : ''
              }`}
              style={{ width: `${Math.max(8, (tally[i] / max) * 100)}%` }}
            >
              {tally[i]}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function WarmupHostView({ game, clockOffset }: HostViewProps) {
  const answered = game.answeredIds?.length ?? 0
  const total = game.participantIds?.length ?? 0

  switch (game.phase) {
    case 'POLL':
    case 'GUESS':
      return (
        <div className="space-y-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-purple-300">
            {game.phase === 'POLL' ? 'Round 1: Poll (side with the crowd for 1 pt)' : 'Round 2: Closest guess wins 2 pts'}
          </p>
          <h2 className="text-3xl font-bold text-white md:text-5xl">{game.prompt}</h2>
          {game.phase === 'POLL' && (
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3">
              {game.options.map((o: string, i: number) => (
                <div key={i} className={`rounded-xl bg-gradient-to-br px-4 py-5 text-xl font-bold text-white ${CHOICE_COLORS[i % CHOICE_COLORS.length]}`}>
                  {o}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-8">
            <Countdown deadline={game.deadline} clockOffset={clockOffset} large />
            <span className="text-2xl font-semibold text-purple-100">{answered}/{total} answered</span>
          </div>
        </div>
      )
    case 'POLL_REVEAL':
      return (
        <div className="mx-auto max-w-3xl space-y-6">
          <h2 className="text-center text-3xl font-bold text-white md:text-4xl">{game.prompt}</h2>
          <Tally options={game.options} tally={game.tally} />
        </div>
      )
    case 'GUESS_REVEAL':
      return (
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">{game.prompt}</h2>
          <p className="text-6xl font-extrabold tabular-nums text-gradient-primary">{Number(game.answer).toLocaleString()}</p>
          {game.guesses.length === 0 ? (
            <p className="text-purple-200">Nobody guessed!</p>
          ) : (
            <ul className="space-y-2 text-left">
              {game.guesses.map((g: any) => (
                <li key={g.playerId} className={`flex items-center gap-3 rounded-lg px-4 py-2 ${g.winner ? 'bg-green-500/25' : 'bg-white/5'}`}>
                  {g.winner && <Star className="h-5 w-5 text-yellow-300" />}
                  <span className="font-semibold text-white">{g.name}</span>
                  <span className="ml-auto tabular-nums text-purple-100">{Number(g.guess).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
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

export function WarmupPlayerView({ game, you, clockOffset, sendInput }: PlayerViewProps) {
  switch (game.phase) {
    case 'POLL':
      return (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-bold text-white">{game.prompt}</h2>
            <Countdown deadline={game.deadline} clockOffset={clockOffset} />
          </div>
          <ChoiceButtons options={game.options} selected={game.yourChoice} onSelect={(index) => sendInput({ kind: 'choice', index })} />
        </div>
      )
    case 'GUESS':
      return (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-bold text-white">{game.prompt}</h2>
            <Countdown deadline={game.deadline} clockOffset={clockOffset} />
          </div>
          <NumberInput submitted={game.yourGuess} onSubmit={(value) => sendInput({ kind: 'number', value })} />
        </div>
      )
    case 'POLL_REVEAL':
    case 'GUESS_REVEAL':
      return (
        <div className="space-y-4 text-center">
          <p className={`text-3xl font-extrabold ${game.youScored ? 'text-green-300' : 'text-purple-200'}`}>
            {game.youScored
              ? `+${game.phase === 'POLL_REVEAL' ? 1 : 2} point${game.phase === 'POLL_REVEAL' ? '' : 's'}!`
              : game.phase === 'POLL_REVEAL' && game.yourChoice === undefined
                ? 'No answer this time'
                : game.phase === 'GUESS_REVEAL' && game.yourGuess === undefined
                  ? 'No guess this time'
                  : 'No points this round'}
          </p>
          {game.phase === 'GUESS_REVEAL' && (
            <p className="text-lg text-purple-100">
              Answer: <span className="font-bold text-white">{Number(game.answer).toLocaleString()}</span>
              {game.yourGuess !== undefined && <> · You guessed <span className="font-bold text-white">{Number(game.yourGuess).toLocaleString()}</span></>}
            </p>
          )}
          <p className="text-purple-300">Look at the TV!</p>
        </div>
      )
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
