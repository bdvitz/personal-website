'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Loader2, RotateCcw, Tv } from 'lucide-react'
import Balloon from '@/components/icons/Balloon'
import { checkServerHealth, createPartyRoom, getPartyRoom } from '@/lib/api'
import { CURRENT_HOST_ROOM_KEY, hostTokenKey, storage } from '@/lib/party/usePartySocket'

const CODE_PATTERN = /^[A-Z]{4}$/

export default function PartyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [hosting, setHosting] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Live room this browser is hosting (e.g. the TV tab was closed or refreshed)
  const [hostedRoom, setHostedRoom] = useState<string | null>(null)

  useEffect(() => {
    // QR codes link to /party?code=XXXX
    const fromUrl = new URLSearchParams(window.location.search).get('code')
    if (fromUrl) setCode(fromUrl.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))
    // Wake a sleeping server before anyone taps a button
    checkServerHealth(15000)

    const current = storage.get(CURRENT_HOST_ROOM_KEY)
    if (current && storage.get(hostTokenKey(current))) {
      getPartyRoom(current)
        .then((room) => {
          if (room) {
            setHostedRoom(current)
          } else {
            storage.remove(CURRENT_HOST_ROOM_KEY)
            storage.remove(hostTokenKey(current))
          }
        })
        .catch(() => { /* server asleep; the button appears on a later visit */ })
    }
  }, [])

  const hostRoom = async () => {
    if (hostedRoom && !confirm(`This closes room ${hostedRoom} for everyone in it. Start a new room?`)) return
    setHosting(true)
    setError(null)
    try {
      // Always send the previous room (if any) so the server closes it: one room per host browser
      const previousCode = storage.get(CURRENT_HOST_ROOM_KEY)
      const previousHostToken = previousCode ? storage.get(hostTokenKey(previousCode)) : null
      const room = await createPartyRoom(
        previousCode && previousHostToken ? { previousCode, previousHostToken } : undefined
      )
      if (previousCode) storage.remove(hostTokenKey(previousCode))
      storage.set(hostTokenKey(room.code), room.hostToken)
      storage.set(CURRENT_HOST_ROOM_KEY, room.code)
      router.push(`/party/host/${room.code}`)
    } catch (e: any) {
      setError(e.message)
      setHosting(false)
    }
  }

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!CODE_PATTERN.test(code)) {
      setError('Room codes are 4 letters.')
      return
    }
    if (!trimmed) {
      setError('Enter your name.')
      return
    }
    setJoining(true)
    setError(null)
    try {
      const room = await getPartyRoom(code)
      if (!room) {
        setError('No room with that code. Check the code on the TV.')
        setJoining(false)
        return
      }
      router.push(`/party/play/${code}?name=${encodeURIComponent(trimmed)}`)
    } catch (err: any) {
      setError(err.message)
      setJoining(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="flex items-center justify-center gap-3 text-4xl font-bold text-white">
          <Balloon className="h-9 w-9 text-pink-300" />
          <span className="text-gradient-primary">Party Games</span>
        </h1>
        <p className="mt-2 text-purple-200">Join from your phone with the code on the TV.</p>
      </div>

      <form onSubmit={joinRoom} className="card space-y-4">
        <div>
          <label htmlFor="party-code" className="mb-1 block text-sm font-semibold text-purple-200">Room code</label>
          <input
            id="party-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABCD"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-3xl font-bold uppercase tracking-[0.4em] text-white placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <div>
          <label htmlFor="party-name" className="mb-1 block text-sm font-semibold text-purple-200">Your name</label>
          <input
            id="party-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            autoComplete="nickname"
            placeholder="Name"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xl text-white placeholder:text-purple-300/40 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <button type="submit" disabled={joining} className="btn-primary flex w-full items-center justify-center gap-2 text-lg disabled:opacity-60">
          {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          Join
        </button>
      </form>

      {error && <p className="rounded-lg border border-red-400/40 bg-red-500/20 px-4 py-3 text-center text-red-100">{error}</p>}

      <div className="card space-y-3 text-center">
        {hostedRoom ? (
          <>
            <p className="text-purple-200">
              You're hosting room <span className="font-bold tracking-widest text-white">{hostedRoom}</span> from this browser.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/party/host/${hostedRoom}`)}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              <RotateCcw className="h-5 w-5" />
              Return to room {hostedRoom}
            </button>
          </>
        ) : (
          <p className="text-purple-200">Hosting? Open this on the TV or laptop everyone can see.</p>
        )}
        <button
          type="button"
          onClick={hostRoom}
          disabled={hosting}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-60"
        >
          {hosting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Tv className="h-5 w-5" />}
          {hostedRoom ? 'Host a new room instead' : 'Host a room'}
        </button>
        <p className="text-xs text-purple-300/70">The first request can take a few seconds if the server is waking up.</p>
      </div>
    </div>
  )
}
