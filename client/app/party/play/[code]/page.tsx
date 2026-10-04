'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Crown, Home, Hourglass, LogIn, SkipForward, Undo2, WifiOff } from 'lucide-react'
import { usePartySocket } from '@/lib/party/usePartySocket'
import { PARTY_GAMES } from '@/components/party/games/registry'
import GamePicker from '@/components/party/GamePicker'
import PlayerList from '@/components/party/PlayerList'
import ConnectingNotice from '@/components/party/ConnectingNotice'

export default function PartyPlayPage() {
  const code = String(useParams().code ?? '').toUpperCase()
  const { status, state, error, endedReason, needsName, clockOffset, unreachable, send, join, sendInput } = usePartySocket(code, 'player')
  const [name, setName] = useState('')
  const autoJoined = useRef(false)

  // Coming from the /party form: join once with the name from the URL
  useEffect(() => {
    if (!needsName || autoJoined.current) return
    autoJoined.current = true
    const fromUrl = new URLSearchParams(window.location.search).get('name')
    if (fromUrl) {
      setName(fromUrl)
      join(fromUrl)
    }
  }, [needsName, join])

  if (status === 'ended') {
    return (
      <div className="card mx-auto max-w-md space-y-4 text-center">
        <p className="text-xl text-white">{endedReason}</p>
        <Link href="/party" className="btn-primary inline-flex items-center gap-2">
          <Home className="h-5 w-5" /> Back to party page
        </Link>
      </div>
    )
  }

  const banner = (
    <>
      {status === 'reconnecting' && (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-yellow-500/20 px-4 py-2 text-yellow-100">
          <WifiOff className="h-4 w-4" /> {unreachable ? "Can't reach the game server. Still trying..." : 'Reconnecting...'}
        </div>
      )}
      {error && <div className="rounded-lg bg-red-500/20 px-4 py-2 text-center text-red-100">{error}</div>}
    </>
  )

  if (needsName) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        {banner}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) join(name.trim())
          }}
          className="card space-y-4"
        >
          <h1 className="text-2xl font-bold text-white">Join room {code}</h1>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            autoComplete="nickname"
            placeholder="Your name"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xl text-white placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2">
            <LogIn className="h-5 w-5" /> Join
          </button>
        </form>
      </div>
    )
  }

  if (!state?.you) {
    return <ConnectingNotice code={code} unreachable={unreachable} />
  }

  const { room, you, game } = state
  const definition = room.gameId ? PARTY_GAMES[room.gameId] : undefined
  const upNext = room.selectedGameId ? PARTY_GAMES[room.selectedGameId] : undefined
  const picker = (
    <GamePicker
      selectedId={room.selectedGameId}
      options={room.gameOptions}
      label={room.status === 'GAME_OVER' && room.selectedGameId === room.gameId ? 'Play again' : 'Start'}
      onSelect={(gameId) => send({ type: 'selectGame', gameId })}
      onOption={(key, value) => send({ type: 'setGameOption', key, value })}
      onStart={() => send({ type: 'start' })}
    />
  )

  let body: React.ReactNode
  if (you.waiting) {
    body = (
      <div className="space-y-3 py-6 text-center">
        <Hourglass className="mx-auto h-10 w-10 text-purple-300" />
        <p className="text-2xl font-bold text-white">Game in progress</p>
        <p className="text-purple-200">You're in! You'll join when the next game starts.</p>
      </div>
    )
  } else if (room.status === 'LOBBY') {
    body = you.vip ? (
      <div className="space-y-4">
        <p className="text-purple-200">You're the VIP. Start a game when everyone's in.</p>
        {picker}
      </div>
    ) : (
      <div className="space-y-2 py-6 text-center">
        <p className="text-xl text-purple-100">You're in! Waiting for the host to start...</p>
        {upNext && <p className="text-purple-300">Up next: <span className="font-semibold text-white">{upNext.name}</span></p>}
      </div>
    )
  } else if (definition && game) {
    body = <definition.PlayerView game={game} room={room} you={you} clockOffset={clockOffset} sendInput={sendInput} sendControl={(action) => send({ type: 'control', action })} />
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      {banner}

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2">
        <span className="flex items-center gap-2 font-semibold text-white">
          {you.vip && <Crown className="h-4 w-4 text-yellow-300" />}
          {you.name}
        </span>
        <span className="text-sm text-purple-200">
          {room.code}{you.score !== undefined ? ` · ${you.score} pts` : ''}
        </span>
      </div>

      <div className="card">{body}</div>

      {you.vip && room.status === 'IN_GAME' && !definition?.automatic && (
        <button type="button" onClick={() => send({ type: 'advance' })} className="btn-primary flex w-full items-center justify-center gap-2">
          <SkipForward className="h-5 w-5" /> Next (VIP)
        </button>
      )}
      {you.vip && room.status === 'GAME_OVER' && (
        <div className="card space-y-4">
          {picker}
          <button
            type="button"
            onClick={() => send({ type: 'backToLobby' })}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/20"
          >
            <Undo2 className="h-5 w-5" /> Back to lobby
          </button>
        </div>
      )}

      {(room.status === 'LOBBY' || you.waiting) && (
        <div className="card">
          <PlayerList room={room} showScores={false} />
        </div>
      )}
    </div>
  )
}
