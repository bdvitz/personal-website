'use client'

import { useState } from 'react'
import { Anchor, Check, Crown, Crosshair, Pause, Play, RotateCw, Shuffle, Ship, Undo2, UserRoundCog, Vote } from 'lucide-react'
import Countdown from '@/components/party/Countdown'
import PlayerPicker from '@/components/party/PlayerPicker'
import Standings from '@/components/party/Standings'
import type { HostViewProps, PlayerViewProps, SendControl } from '@/lib/party/types'
import Board, { BoardLegend, TEAM_STYLE, cellName, type CellRef, type ShotView, type TeamColor } from './Board'

// Shapes come from server/.../party/game/BuoyantBattleGame.java (hostView/playerView).
// Host/VIP control actions: closeVote, endPlacement, pause, resume. Next skips the result popup.

interface Ref {
  playerId: string
  name: string
  connected?: boolean
}

interface ShipView {
  length: number
  cells: CellRef[]
}

interface TeamView {
  name: string
  color: TeamColor
  players: Ref[]
  leaderId?: string
  shipsLeft: number
  shots: ShotView[]
  sunk: CellRef[][]
  votedIds?: string[]
  ready?: boolean
  confirmed?: boolean
  ships?: ShipView[] // FINAL only
}

const SHIP_LENGTHS = [3, 2, 2]
const SHIP_NAMES = ['Battleship (3)', 'Destroyer (2)', 'Destroyer (2)']

const leaderName = (t: TeamView) => t.players.find((p) => p.playerId === t.leaderId)?.name

function TeamName({ team, className = '' }: { team: TeamView; className?: string }) {
  return <span className={`font-bold ${TEAM_STYLE[team.color].text} ${className}`}>Team {team.name}</span>
}

function Clock({ game, clockOffset, large }: { game: any; clockOffset: number; large?: boolean }) {
  if (game.paused) {
    return (
      <span className={`inline-flex items-center gap-2 font-bold text-yellow-200 ${large ? 'text-3xl' : 'text-lg'}`}>
        <Pause className={large ? 'h-8 w-8' : 'h-5 w-5'} /> Paused
      </span>
    )
  }
  return <Countdown deadline={game.deadline} clockOffset={clockOffset} large={large} />
}

// 3s popup on every screen; it never blocks taps
function ResultPopup({ game }: { game: any }) {
  if (game.phase !== 'RESULT' || !game.lastResult) return null
  const teams: TeamView[] = game.teams
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-scale-in w-full max-w-md space-y-3 rounded-2xl border border-white/20 bg-slate-950/95 p-6 shadow-2xl">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-purple-300">Round {game.lastResult.round}</p>
        {game.lastResult.shots.map((s: any) => (
          <div key={s.team} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
            <span>
              <TeamName team={teams[s.team]} /> <span className="text-purple-200">fired at</span>{' '}
              <span className="font-bold text-white">{cellName(s)}</span>
            </span>
            <span className={`text-right text-xl font-extrabold ${s.hit ? 'text-red-400' : 'text-slate-300'}`}>
              {s.hit ? 'HIT!' : 'Miss'}
              {s.sunk && <span className="block text-sm text-red-300">Ship sunk!</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Shared by the TV and the VIP phone
function Controls({ game, sendControl }: { game: any; sendControl: SendControl }) {
  const phase: string = game.phase
  const secondary =
    'flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/20'
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {phase === 'ELECTION' && (
        <button
          type="button"
          onClick={() => confirm('Close voting now? Ties are broken at random.') && sendControl({ action: 'closeVote' })}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Vote className="h-5 w-5" /> Close voting
        </button>
      )}
      {phase === 'PLACE' && (
        <button
          type="button"
          onClick={() => confirm('End ship placement now? Unplaced ships are placed at random.') && sendControl({ action: 'endPlacement' })}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Ship className="h-5 w-5" /> End placement
        </button>
      )}
      {game.paused ? (
        <button type="button" onClick={() => sendControl({ action: 'resume' })} className="btn-primary flex items-center justify-center gap-2">
          <Play className="h-5 w-5" /> Resume
        </button>
      ) : (
        <button type="button" onClick={() => confirm('Pause the game?') && sendControl({ action: 'pause' })} className={secondary}>
          <Pause className="h-5 w-5" /> Pause
        </button>
      )}
    </div>
  )
}

function TeamCard({ team, children }: { team: TeamView; children: React.ReactNode }) {
  const style = TEAM_STYLE[team.color]
  return <div className={`space-y-3 rounded-2xl border p-4 ${style.border} ${style.bg}`}>{children}</div>
}

function BoardPanel({ team, size, ships }: { team: TeamView; size: 'sm' | 'md' | 'lg'; ships?: CellRef[][] }) {
  return (
    <TeamCard team={team}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-lg">
          <TeamName team={team} /> <span className="text-purple-200">waters</span>
        </span>
        <span className="text-sm text-purple-200">
          <Ship className="mr-1 inline h-4 w-4" />
          {team.shipsLeft}/3 afloat
        </span>
      </div>
      <Board shots={team.shots} sunk={team.sunk} ships={ships} shipColor={team.color} size={size} />
    </TeamCard>
  )
}

function Final({ game, highlightId }: { game: any; highlightId?: string }) {
  const teams: TeamView[] = game.teams
  const winners: number[] = game.winners ?? []
  return (
    <div className="space-y-6">
      {winners.length === 1 ? (
        <p className="flex items-center justify-center gap-3 text-center text-4xl font-extrabold md:text-5xl">
          <Crown className="h-10 w-10 text-yellow-300" /> <TeamName team={teams[winners[0]]} /> <span className="text-white">wins!</span>
        </p>
      ) : (
        <p className="text-center text-4xl font-extrabold text-white md:text-5xl">Draw! Both fleets sank together.</p>
      )}
      <p className="text-center text-purple-200">Every winner gets +{game.pointsEach} points.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((t) => (
          <BoardPanel key={t.name} team={t} size="md" ships={(t.ships ?? []).map((s) => s.cells)} />
        ))}
      </div>
      <BoardLegend />
      <div className="mx-auto max-w-2xl">
        <Standings standings={game.standings} highlightId={highlightId} />
      </div>
    </div>
  )
}

// ---------------- TV ----------------

export function BuoyantBattleHostView({ game, clockOffset, sendControl }: HostViewProps) {
  const phase: string = game.phase
  const teams: TeamView[] = game.teams
  if (phase === 'FINAL') return <Final game={game} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-lg font-semibold uppercase tracking-widest text-purple-300">
          <Anchor className="h-5 w-5" /> Buoyant Battle{game.round > 0 && ` · Round ${game.round}`}
        </p>
        <Clock game={game} clockOffset={clockOffset} large />
      </div>

      {phase === 'ELECTION' && (
        <>
          <h2 className="text-center text-3xl font-bold text-white">Vote for your team leader on your phone</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((t) => (
              <TeamCard key={t.name} team={t}>
                <TeamName team={t} className="text-2xl" />
                <ul className="grid grid-cols-2 gap-2">
                  {t.players.map((p) => (
                    <li key={p.playerId} className="flex items-center gap-2 truncate rounded-lg bg-white/5 px-3 py-2 text-white">
                      {(t.votedIds ?? []).includes(p.playerId) || t.leaderId === p.playerId ? (
                        <Check className="h-4 w-4 shrink-0 text-green-300" />
                      ) : (
                        <span className="h-4 w-4 shrink-0" />
                      )}
                      {p.name}
                    </li>
                  ))}
                </ul>
                {t.leaderId && <p className="text-sm text-purple-200">Leader: {leaderName(t)}</p>}
              </TeamCard>
            ))}
          </div>
        </>
      )}

      {phase === 'PLACE' && (
        <>
          <h2 className="text-center text-3xl font-bold text-white">Leaders are hiding their fleets...</h2>
          <p className="text-center text-purple-200">3 ships each: one 3 long and two 2 long.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((t) => (
              <TeamCard key={t.name} team={t}>
                <TeamName team={t} className="text-2xl" />
                <p className="flex items-center gap-2 text-lg text-white">
                  <Crown className="h-5 w-5 text-yellow-300" /> {leaderName(t)}
                </p>
                <p className={`text-lg font-semibold ${t.ready ? 'text-green-300' : 'text-purple-200'}`}>
                  {t.ready ? 'Ready!' : 'Placing ships...'}
                </p>
              </TeamCard>
            ))}
          </div>
        </>
      )}

      {(phase === 'BOMB' || phase === 'RESULT') && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((t) => (
              <div key={t.name} className="space-y-2">
                <BoardPanel team={t} size="lg" />
                <p className="text-center text-purple-200">
                  Leader <span className="font-semibold text-white">{leaderName(t)}</span>
                  {phase === 'BOMB' && (t.confirmed ? ' · locked in' : ' · aiming...')}
                </p>
              </div>
            ))}
          </div>
          <BoardLegend />
        </>
      )}

      <div className="mx-auto max-w-2xl">
        <Controls game={game} sendControl={sendControl} />
      </div>
      <ResultPopup game={game} />
    </div>
  )
}

// ---------------- Phone ----------------

function ElectionView({ team, you, game, sendInput }: { team: TeamView; you: PlayerViewProps['you']; game: any; sendInput: PlayerViewProps['sendInput'] }) {
  if (team.leaderId) {
    return <p className="py-4 text-center text-lg text-purple-100">You're your team's leader. Waiting for the other team to vote...</p>
  }
  return (
    <div className="space-y-3">
      <p className="text-center text-lg font-semibold text-white">Vote for your team leader</p>
      <p className="text-center text-sm text-purple-200">The leader does everything for the team. You can vote for yourself.</p>
      <div className="grid grid-cols-2 gap-3">
        {team.players.map((p) => {
          const picked = game.yourVote === p.playerId
          return (
            <button
              key={p.playerId}
              type="button"
              onClick={() => sendInput({ kind: 'target', playerId: p.playerId })}
              className={`relative min-h-[3.5rem] truncate rounded-2xl border px-3 py-3 text-lg font-bold text-white transition-all active:scale-95 ${
                picked ? 'border-white bg-purple-500/60 ring-4 ring-white' : 'border-white/20 bg-white/10 hover:bg-white/20'
              }`}
            >
              {picked && <Check className="absolute right-2 top-2 h-5 w-5" />}
              {p.name}
              {p.playerId === you.playerId && <span className="block text-xs font-normal text-purple-200">(you)</span>}
            </button>
          )
        })}
      </div>
      <p className="text-center text-sm text-purple-300">
        {(team.votedIds ?? []).length}/{team.players.length} voted
      </p>
    </div>
  )
}

function PlacementView({ game, team, isLeader, sendInput }: { game: any; team: TeamView; isLeader: boolean; sendInput: PlayerViewProps['sendInput'] }) {
  const [selected, setSelected] = useState(0)
  const [vertical, setVertical] = useState(false)
  const placement: ShipView[] = game.placement ?? []
  const allPlaced = placement.length === 3 && placement.every((s) => s.cells.length > 0)

  const onCell = (cell: CellRef) => {
    const len = SHIP_LENGTHS[selected]
    // Tapped square is the top/left end; nudge it back onto the board if it would hang off
    const row = vertical ? Math.min(cell.row, 5 - len) : cell.row
    const col = vertical ? cell.col : Math.min(cell.col, 5 - len)
    sendInput({ kind: 'place', ship: selected, row, col, vertical })
    const next = [1, 2, 0].map((d) => (selected + d) % 3).find((i) => i !== selected && !placement[i]?.cells.length)
    if (next !== undefined) setSelected(next)
  }

  if (!isLeader) {
    return (
      <div className="space-y-3">
        <p className="text-center text-purple-100">
          <span className="font-semibold text-white">{leaderName(team)}</span> is placing your fleet. Help them out loud!
        </p>
        <Board shots={[]} ships={placement.map((s) => s.cells)} shipColor={team.color} size="md" />
        <p className={`text-center font-semibold ${team.ready ? 'text-green-300' : 'text-purple-200'}`}>{team.ready ? 'Ready!' : 'Placing...'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-purple-200">Pick a ship, then tap its top/left square.</p>
      <div className="grid grid-cols-3 gap-2">
        {SHIP_NAMES.map((name, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelected(i)}
            className={`rounded-xl border px-2 py-2 text-sm font-semibold text-white ${
              selected === i ? 'border-white bg-purple-500/60 ring-2 ring-white' : 'border-white/20 bg-white/10'
            }`}
          >
            {name}
            {placement[i]?.cells.length > 0 && <Check className="mx-auto mt-1 h-4 w-4 text-green-300" />}
          </button>
        ))}
      </div>
      <Board shots={[]} ships={placement.map((s) => s.cells)} shipColor={team.color} onCellClick={onCell} canClick={() => true} size="md" />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setVertical((v) => !v)}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white"
        >
          <RotateCw className="h-4 w-4" /> {vertical ? 'Vertical' : 'Horizontal'}
        </button>
        <button
          type="button"
          onClick={() => sendInput({ kind: 'randomize' })}
          className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white"
        >
          <Shuffle className="h-4 w-4" /> Randomize
        </button>
      </div>
      <button
        type="button"
        disabled={!allPlaced}
        onClick={() => sendInput({ kind: 'confirm', on: !team.ready })}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-lg font-bold text-white disabled:opacity-40 ${
          team.ready ? 'border border-green-300/50 bg-green-600/40' : 'btn-primary'
        }`}
      >
        {team.ready ? (
          <>
            <Check className="h-5 w-5" /> Ready (tap to undo)
          </>
        ) : (
          'Ready'
        )}
      </button>
    </div>
  )
}

function BombView({ game, team, enemy, isLeader, sendInput }: { game: any; team: TeamView; enemy: TeamView; isLeader: boolean; sendInput: PlayerViewProps['sendInput'] }) {
  const target: CellRef | undefined = game.target
  const bombing = game.phase === 'BOMB'
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="flex items-baseline justify-between text-lg">
          <span>
            <span className="text-purple-200">Enemy waters:</span> <TeamName team={enemy} />
          </span>
          <span className="text-sm text-purple-200">{enemy.shipsLeft}/3 afloat</span>
        </p>
        <Board
          shots={enemy.shots}
          sunk={enemy.sunk}
          target={bombing ? target : undefined}
          targetColor={team.color}
          onCellClick={isLeader && bombing ? (cell) => sendInput({ kind: 'cell', row: cell.row, col: cell.col }) : undefined}
          size="md"
        />
      </div>

      {bombing &&
        (isLeader ? (
          <button
            type="button"
            disabled={!target}
            onClick={() => sendInput({ kind: 'confirm', on: !team.confirmed })}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-lg font-bold text-white disabled:opacity-40 ${
              team.confirmed ? 'border border-green-300/50 bg-green-600/40' : 'btn-primary'
            }`}
          >
            {team.confirmed ? (
              <>
                <Undo2 className="h-5 w-5" /> Locked in on {target && cellName(target)} (tap to change)
              </>
            ) : (
              <>
                <Crosshair className="h-5 w-5" /> {target ? `Fire at ${cellName(target)}` : 'Tap a square to aim'}
              </>
            )}
          </button>
        ) : (
          <p className="text-center text-purple-100">
            <span className="font-semibold text-white">{leaderName(team)}</span>{' '}
            {team.confirmed ? `locked in on ${target ? cellName(target) : '...'}` : target ? `is aiming at ${cellName(target)}` : 'is aiming...'}
          </p>
        ))}
      {bombing && <p className="text-center text-sm text-purple-300">{enemy.confirmed ? `Team ${enemy.name} has locked in.` : `Team ${enemy.name} is aiming...`}</p>}

      <div className="space-y-2 border-t border-white/10 pt-3">
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-purple-200">
            Your waters (<TeamName team={team} />)
          </span>
          <span className="text-purple-200">{team.shipsLeft}/3 afloat</span>
        </p>
        <Board shots={team.shots} sunk={team.sunk} size="sm" />
      </div>
      <BoardLegend />
    </div>
  )
}

function Leadership({ game, team, you, sendInput }: { game: any; team: TeamView; you: PlayerViewProps['you']; sendInput: PlayerViewProps['sendInput'] }) {
  const [open, setOpen] = useState(false)
  const isLeader: boolean = game.isLeader
  const pending = team.players.find((p) => p.playerId === game.pendingLeaderId)
  const canHandOff = isLeader && team.players.length > 1 && game.phase !== 'ELECTION'

  return (
    <div className="space-y-2">
      {pending && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-yellow-300/30 bg-yellow-500/15 px-3 py-2 text-sm text-yellow-100">
          <span>
            {pending.playerId === you.playerId ? "You'll be the leader" : `${pending.name} takes over as leader`} when the next round starts.
          </span>
          {isLeader && (
            <button type="button" onClick={() => sendInput({ kind: 'handoff' })} className="shrink-0 font-semibold underline">
              Cancel
            </button>
          )}
        </div>
      )}
      {canHandOff && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-2 text-sm text-purple-300 hover:text-white"
          >
            <UserRoundCog className="h-4 w-4" /> {open ? 'Close' : 'Pass leadership'}
          </button>
          {open && (
            <PlayerPicker
              candidates={team.players}
              youId={you.playerId}
              selected={game.pendingLeaderId}
              onPick={(playerId) => {
                sendInput({ kind: 'handoff', playerId })
                setOpen(false)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

export function BuoyantBattlePlayerView({ game, you, clockOffset, sendInput, sendControl }: PlayerViewProps) {
  const phase: string = game.phase
  if (phase === 'FINAL') return <Final game={game} highlightId={you.playerId} />
  const teams: TeamView[] = game.teams
  if (game.yourTeam === undefined) {
    return <p className="py-6 text-center text-purple-100">Watch the battle on the big screen!</p>
  }
  const team = teams[game.yourTeam]
  const enemy = teams[1 - game.yourTeam]
  const isLeader: boolean = game.isLeader
  const style = TEAM_STYLE[team.color]

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${style.border} ${style.bg}`}>
        <div className="min-w-0">
          <TeamName team={team} className="text-lg" />
          <p className="truncate text-xs text-purple-200">
            {isLeader ? (
              <span className="font-semibold text-yellow-200">
                <Crown className="mr-1 inline h-3 w-3" />
                You're the leader
              </span>
            ) : team.leaderId ? (
              `Leader: ${leaderName(team)}`
            ) : (
              team.players.map((p) => p.name).join(', ')
            )}
          </p>
        </div>
        <Clock game={game} clockOffset={clockOffset} />
      </div>

      <Leadership game={game} team={team} you={you} sendInput={sendInput} />

      {phase === 'ELECTION' && <ElectionView team={team} you={you} game={game} sendInput={sendInput} />}
      {phase === 'PLACE' && <PlacementView game={game} team={team} isLeader={isLeader} sendInput={sendInput} />}
      {(phase === 'BOMB' || phase === 'RESULT') && <BombView game={game} team={team} enemy={enemy} isLeader={isLeader} sendInput={sendInput} />}

      {you.vip && (
        <div className="border-t border-white/10 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-300">VIP controls</p>
          <Controls game={game} sendControl={sendControl} />
        </div>
      )}
      <ResultPopup game={game} />
    </div>
  )
}
