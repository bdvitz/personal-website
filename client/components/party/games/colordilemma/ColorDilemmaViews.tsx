'use client'

import { useEffect, useState } from 'react'
import { Check, Coffee, PartyPopper } from 'lucide-react'
import Countdown from '@/components/party/Countdown'
import Standings from '@/components/party/Standings'
import type { HostViewProps, PlayerViewProps } from '@/lib/party/types'

// Shapes come from server/.../party/game/ColorDilemmaGame.java (hostView/playerView).
// Input index 0 = GREEN, 1 = RED. Scores are private: the TV never gets choices or points mid-game.

type Choice = 'GREEN' | 'RED'

const CHOICES: { value: Choice; index: number; label: string; fill: string }[] = [
  { value: 'GREEN', index: 0, label: 'Green', fill: 'from-emerald-500 to-green-600' },
  { value: 'RED', index: 1, label: 'Red', fill: 'from-rose-500 to-red-600' },
]

function RoundHeader({ game, clockOffset, large = false }: { game: any; clockOffset: number; large?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className={`font-semibold uppercase tracking-widest text-purple-300 ${large ? 'text-lg' : 'text-sm'}`}>
        Round {game.round} of {game.rounds}
      </p>
      <Countdown deadline={game.deadline} clockOffset={clockOffset} large={large} />
    </div>
  )
}

function ColorWord({ choice }: { choice?: Choice }) {
  if (!choice) return null
  return <span className={`font-extrabold ${choice === 'RED' ? 'text-rose-300' : 'text-emerald-300'}`}>{choice}</span>
}

export function ColorDilemmaHostView({ game, clockOffset }: HostViewProps) {
  if (game.phase === 'FINAL') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h2 className="flex items-center justify-center gap-3 text-center text-4xl font-bold text-white">
          <PartyPopper className="h-9 w-9 text-pink-300" /> Final scores
        </h2>
        <Standings standings={game.standings} />
      </div>
    )
  }

  const inResult = game.phase === 'RESULT'
  return (
    <div className="space-y-6">
      <RoundHeader game={game} clockOffset={clockOffset} large />
      <h2 className="text-center text-3xl font-bold text-white md:text-4xl">
        {inResult ? 'Results are on your phones...' : 'Green or red? Decide in secret.'}
      </h2>
      <p className="text-center text-purple-200">
        {inResult ? 'Next round starts soon.' : 'Both green: 3 each · Both red: 1 each · Red beats green: 5 to 0'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {game.pairs.map((pair: any) => (
          <div key={pair.a.id} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center">
            {pair.b ? (
              <p className="text-lg font-semibold text-white">
                {pair.a.name} <span className="text-purple-300">vs</span> {pair.b.name}
              </p>
            ) : (
              <p className="flex items-center justify-center gap-2 text-lg font-semibold text-purple-200">
                <Coffee className="h-5 w-5" /> {pair.a.name}: bye
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ColorDilemmaPlayerView({ game, you, clockOffset, sendInput }: PlayerViewProps) {
  // Optimistic toggle so taps feel instant; resync to the server's value each new round
  const [selected, setSelected] = useState<Choice>(game.yourChoice ?? 'GREEN')
  useEffect(() => {
    if (game.phase === 'ROUND') setSelected(game.yourChoice ?? 'GREEN')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.round, game.phase])

  if (game.phase === 'FINAL') {
    return (
      <div className="space-y-4">
        <h2 className="text-center text-2xl font-bold text-white">Final scores</h2>
        <Standings standings={game.standings} highlightId={you.playerId} />
      </div>
    )
  }

  if (game.phase === 'RESULT') {
    const r = game.lastResult
    return (
      <div className="space-y-4 text-center">
        <RoundHeader game={game} clockOffset={clockOffset} />
        {r?.bye ? (
          <p className="text-xl text-purple-100">You had a bye this round.</p>
        ) : r ? (
          <p className="text-xl text-purple-100">
            {game.opponent?.name ?? 'Your opponent'} picked <ColorWord choice={r.opponentChoice} />
            <br />
            You picked <ColorWord choice={r.yourChoice} />
          </p>
        ) : null}
        {r && (
          <p className={`text-6xl font-extrabold tabular-nums ${r.points >= 3 ? 'text-green-300' : r.points === 0 ? 'text-rose-300' : 'text-purple-100'}`}>
            +{r.points}
          </p>
        )}
        <p className="text-lg text-purple-200">
          Your total: <span className="font-bold text-white tabular-nums">{game.gamePoints}</span>
        </p>
      </div>
    )
  }

  // ROUND
  const pick = (choice: (typeof CHOICES)[number]) => {
    setSelected(choice.value)
    sendInput({ kind: 'choice', index: choice.index })
  }

  return (
    <div className="space-y-4">
      <RoundHeader game={game} clockOffset={clockOffset} />
      {game.bye ? (
        <p className="text-center text-xl text-purple-100">
          Bye this round: <span className="font-bold text-green-300">+{game.byePoints ?? 2}</span> automatically.
        </p>
      ) : (
        <p className="text-center text-2xl text-white">
          You vs <span className="font-extrabold">{game.opponent?.name}</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Your choice">
        {CHOICES.map((choice) => {
          const isSelected = selected === choice.value
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => pick(choice)}
              className={`relative flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br text-2xl font-extrabold text-white shadow-lg transition-all duration-150 active:scale-95 ${choice.fill} ${
                isSelected ? 'scale-[1.03] opacity-100 ring-[6px] ring-white' : 'opacity-35 saturate-50'
              }`}
            >
              {isSelected && <Check className="h-9 w-9" strokeWidth={3} />}
              {choice.label}
              {isSelected && <span className="text-xs font-bold tracking-widest">SELECTED</span>}
            </button>
          )
        })}
      </div>
      <p className="text-center text-sm text-purple-300">
        Switch as often as you like. Your pick locks when the timer hits 0. Your total:{' '}
        <span className="font-semibold text-white tabular-nums">{game.gamePoints}</span>
      </p>
    </div>
  )
}
