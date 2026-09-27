'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import QRCode from 'react-qr-code'
import { DoorClosed, Home, Loader2, SkipForward, Square, WifiOff } from 'lucide-react'
import { usePartySocket } from '@/lib/party/usePartySocket'
import { PARTY_GAMES } from '@/components/party/games/registry'
import GamePicker from '@/components/party/GamePicker'
import PlayerList from '@/components/party/PlayerList'

export default function PartyHostPage() {
  const code = String(useParams().code ?? '').toUpperCase()
  const { status, state, error, endedReason, clockOffset, send } = usePartySocket(code, 'host')
  const [joinUrl, setJoinUrl] = useState('')

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/party?code=${code}`)
  }, [code])

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

  if (!state) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-purple-200">
        <Loader2 className="h-6 w-6 animate-spin" /> Connecting to room {code}...
      </div>
    )
  }

  const { room, game } = state
  const definition = room.gameId ? PARTY_GAMES[room.gameId] : undefined
  const inLobby = room.status === 'LOBBY'
  const displayHost = joinUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, '')
  const picker = (
    <GamePicker
      selectedId={room.selectedGameId}
      label={room.status === 'GAME_OVER' && room.selectedGameId === room.gameId ? 'Play again' : 'Start'}
      onSelect={(gameId) => send({ type: 'selectGame', gameId })}
      onStart={() => send({ type: 'start' })}
    />
  )

  return (
    <div className="space-y-4">
      {status === 'reconnecting' && (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-yellow-500/20 px-4 py-2 text-yellow-100">
          <WifiOff className="h-4 w-4" /> Reconnecting...
        </div>
      )}
      {error && <div className="rounded-lg bg-red-500/20 px-4 py-2 text-center text-red-100">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <main className="card min-h-[60vh]">
          {inLobby ? (
            <div className="space-y-8">
              <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-center md:text-left">
                <div className="rounded-2xl bg-white p-4">
                  {joinUrl && <QRCode value={joinUrl} size={220} />}
                </div>
                <div className="space-y-2">
                  <p className="text-lg text-purple-200">Join at <span className="font-semibold text-white">{displayHost}</span> with code</p>
                  <p className="text-7xl font-extrabold tracking-[0.2em] text-white md:text-8xl">{room.code}</p>
                  <p className="text-purple-300">Up to {room.maxPlayers} players. First to join is the VIP and can start games too.</p>
                </div>
              </div>
              <div className="mx-auto w-full max-w-xl">
                <h2 className="mb-3 text-xl font-bold text-white">Choose a game</h2>
                {picker}
              </div>
            </div>
          ) : definition ? (
            <definition.HostView game={game} room={room} clockOffset={clockOffset} />
          ) : null}
        </main>

        <aside className="space-y-4">
          {!inLobby && (
            <div className="card py-4 text-center">
              <p className="text-sm text-purple-300">Room code</p>
              <p className="text-4xl font-extrabold tracking-[0.2em] text-white">{room.code}</p>
            </div>
          )}

          {room.status === 'IN_GAME' && (
            <div className="card grid grid-cols-2 gap-2">
              <button type="button" onClick={() => send({ type: 'advance' })} className="btn-primary flex items-center justify-center gap-2">
                <SkipForward className="h-5 w-5" /> Next
              </button>
              <button
                type="button"
                onClick={() => confirm('End this game and return to the lobby?') && send({ type: 'backToLobby' })}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 font-semibold text-white hover:bg-white/20"
              >
                <Square className="h-4 w-4" /> End game
              </button>
            </div>
          )}
          {room.status === 'GAME_OVER' && (
            <div className="card space-y-4">
              {picker}
              <button
                type="button"
                onClick={() => send({ type: 'backToLobby' })}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/20"
              >
                Back to lobby (show QR)
              </button>
            </div>
          )}

          <div className="card">
            <PlayerList
              room={room}
              highlightIds={game?.answeredIds}
              onKick={(playerId) => send({ type: 'kick', playerId })}
              onMakeVip={(playerId) => send({ type: 'setVip', playerId })}
            />
          </div>

          <div className="space-y-2 text-center">
            <button
              type="button"
              onClick={() => confirm('Close this room for everyone?') && send({ type: 'closeRoom' })}
              className="inline-flex items-center gap-2 text-sm text-purple-300 hover:text-white"
            >
              <DoorClosed className="h-4 w-4" /> Close room
            </button>
            <p className="text-xs text-purple-300/60">Rooms close after 10 minutes with no activity.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
