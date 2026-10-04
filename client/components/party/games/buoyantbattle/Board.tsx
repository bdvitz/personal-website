'use client'

import { Crosshair, X } from 'lucide-react'

// One 5x5 Buoyant Battle grid: columns A-E across the top, rows 1-5 down the side.
// Rows/cols are 0-based, as sent by server/.../party/game/BuoyantBattleGame.java.

export interface CellRef {
  row: number
  col: number
}

export interface ShotView extends CellRef {
  hit: boolean
}

export type TeamColor = 'cyan' | 'violet'

// Static class names so Tailwind keeps them. Hits (red) and misses (gray) never use a team color.
export const TEAM_STYLE: Record<TeamColor, { text: string; ship: string; ring: string; border: string; bg: string; solid: string }> = {
  cyan: {
    text: 'text-cyan-300',
    ship: 'bg-cyan-400/70',
    ring: 'ring-cyan-300',
    border: 'border-cyan-400/60',
    bg: 'bg-cyan-500/15',
    solid: 'bg-cyan-500',
  },
  violet: {
    text: 'text-violet-300',
    ship: 'bg-violet-400/70',
    ring: 'ring-violet-300',
    border: 'border-violet-400/60',
    bg: 'bg-violet-500/15',
    solid: 'bg-violet-500',
  },
}

export const COLS = 'ABCDE'
export const cellName = (c: CellRef) => `${COLS[c.col]}${c.row + 1}`

const key = (c: CellRef) => `${c.row},${c.col}`
const SIZE = 5

interface BoardProps {
  shots: ShotView[]
  sunk?: CellRef[][]
  ships?: CellRef[][] // own fleet while placing, or both fleets at the end
  shipColor?: TeamColor
  target?: CellRef
  targetColor?: TeamColor
  onCellClick?: (cell: CellRef) => void
  canClick?: (cell: CellRef, bombed: boolean) => boolean
  size?: 'sm' | 'md' | 'lg'
}

const WIDTH = { sm: 'max-w-[11rem]', md: 'max-w-xs', lg: 'max-w-md' }

export default function Board({ shots, sunk = [], ships = [], shipColor, target, targetColor, onCellClick, canClick, size = 'md' }: BoardProps) {
  const shotAt = new Map(shots.map((s) => [key(s), s]))
  const sunkCells = new Set(sunk.flat().map(key))
  const shipCells = new Set(ships.flat().map(key))
  const shipStyle = shipColor ? TEAM_STYLE[shipColor] : undefined
  const targetStyle = targetColor ? TEAM_STYLE[targetColor] : undefined
  const label = size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-base'
  const icon = size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-5 w-5' : 'h-8 w-8'

  return (
    <div className={`mx-auto grid w-full grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1 ${WIDTH[size]}`}>
      <span />
      {COLS.split('').map((c) => (
        <span key={c} className={`text-center font-bold text-purple-200 ${label}`}>
          {c}
        </span>
      ))}
      {Array.from({ length: SIZE }, (_, row) => (
        <Row key={row} row={row} label={label}>
          {Array.from({ length: SIZE }, (_, col) => {
            const cell = { row, col }
            const k = key(cell)
            const shot = shotAt.get(k)
            const isShip = shipCells.has(k)
            const isSunk = sunkCells.has(k)
            const isTarget = target?.row === row && target?.col === col
            const clickable = !!onCellClick && (canClick ? canClick(cell, !!shot) : !shot)

            let bg = 'bg-sky-950/70 border-white/10'
            if (shot?.hit) bg = isSunk ? 'bg-red-900 border-red-400' : 'bg-red-600 border-red-300'
            else if (isShip && shipStyle) bg = `${shipStyle.ship} border-white/30`
            else if (shot) bg = 'bg-slate-800/80 border-white/10'

            return (
              <button
                key={col}
                type="button"
                disabled={!clickable}
                onClick={() => onCellClick?.(cell)}
                aria-label={`${cellName(cell)}${shot ? (shot.hit ? ' hit' : ' miss') : ''}`}
                className={`relative flex aspect-square items-center justify-center rounded-md border transition-transform ${bg} ${
                  clickable ? 'cursor-pointer hover:brightness-150 active:scale-95' : 'cursor-default'
                } ${isShip && shot?.hit && shipStyle ? `ring-2 ring-inset ${shipStyle.ring}` : ''} ${
                  isTarget && targetStyle ? `z-10 animate-pulse ring-4 ${targetStyle.ring}` : ''
                }`}
              >
                {shot?.hit && <X className={`${icon} text-white`} strokeWidth={3} />}
                {shot && !shot.hit && <span className="h-1/3 w-1/3 rounded-full bg-slate-400" />}
                {!shot && isTarget && <Crosshair className={`${icon} text-white`} />}
              </button>
            )
          })}
        </Row>
      ))}
    </div>
  )
}

function Row({ row, label, children }: { row: number; label: string; children: React.ReactNode }) {
  return (
    <>
      <span className={`flex items-center justify-end pr-1 font-bold text-purple-200 ${label}`}>{row + 1}</span>
      {children}
    </>
  )
}

export function BoardLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-purple-200">
      <span className="flex items-center gap-1">
        <span className="flex h-4 w-4 items-center justify-center rounded bg-red-600">
          <X className="h-3 w-3 text-white" strokeWidth={3} />
        </span>
        Hit
      </span>
      <span className="flex items-center gap-1">
        <span className="flex h-4 w-4 items-center justify-center rounded bg-slate-800">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        </span>
        Miss
      </span>
      <span className="flex items-center gap-1">
        <span className="h-4 w-4 rounded border border-red-400 bg-red-900" />
        Sunk
      </span>
    </div>
  )
}
