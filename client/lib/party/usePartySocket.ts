'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PARTY_WS_URL } from '@/lib/api'
import type { ConnectionStatus, PartyInput, PartyState } from './types'

type Role = 'host' | 'player'

const PING_INTERVAL_MS = 25_000 // keeps Railway's proxy and the server's 90s idle timeout happy
const MAX_BACKOFF_MS = 10_000
const ERROR_DISPLAY_MS = 4_000
const UNREACHABLE_AFTER_ATTEMPTS = 4 // ~15s of failed reconnects (1+2+4+8s)

export const hostTokenKey = (code: string) => `party-host:${code}`
// Code of the room this browser is hosting, for "Return to room" and one-room-per-browser
export const CURRENT_HOST_ROOM_KEY = 'party-host-current'
const playerTokenKey = (code: string) => `party:${code}`

// localStorage can throw (private mode, blocked storage); the game still works without it
export const storage = {
  get(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value) } catch { /* ignore */ }
  },
  remove(key: string) {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  },
}

/**
 * One WebSocket per screen. Reconnects with backoff (phones lock and drop sockets constantly),
 * and re-identifies automatically: the host with its host token, players with their player token.
 */
export function usePartySocket(code: string, role: Role) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [state, setState] = useState<PartyState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [endedReason, setEndedReason] = useState<string | null>(null)
  const [needsName, setNeedsName] = useState(false)
  const [clockOffset, setClockOffset] = useState(0)
  // Several connects in a row failed: show an error instead of an endless spinner (retries continue)
  const [unreachable, setUnreachable] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const endedRef = useRef(false)
  const attemptRef = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
      return true
    }
    return false
  }, [])

  const showError = useCallback((message: string) => {
    setError(message)
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(null), ERROR_DISPLAY_MS)
  }, [])

  const end = useCallback((reason: string) => {
    if (role === 'host' && storage.get(CURRENT_HOST_ROOM_KEY) === code) {
      storage.remove(CURRENT_HOST_ROOM_KEY)
    }
    endedRef.current = true
    setEndedReason(reason)
    setStatus('ended')
    wsRef.current?.close()
  }, [code, role])

  const connect = useCallback(() => {
    if (endedRef.current) return
    const existing = wsRef.current
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return

    const ws = new WebSocket(PARTY_WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      attemptRef.current = 0
      setUnreachable(false)
      setStatus('open')
      if (role === 'host') {
        const hostToken = storage.get(hostTokenKey(code))
        if (!hostToken) {
          end("This browser isn't the host of that room. Join from the party page instead.")
          return
        }
        ws.send(JSON.stringify({ type: 'hostHello', code, hostToken }))
      } else {
        const token = storage.get(playerTokenKey(code))
        if (token) {
          ws.send(JSON.stringify({ type: 'rejoin', code, token }))
        } else {
          setNeedsName(true)
        }
      }
    }

    ws.onmessage = (event) => {
      let msg: any
      try { msg = JSON.parse(event.data) } catch { return }
      switch (msg.type) {
        case 'state':
          setClockOffset(msg.serverTime - Date.now())
          setState(msg)
          break
        case 'joined':
          storage.set(playerTokenKey(code), msg.token)
          setNeedsName(false)
          break
        case 'error':
          if (msg.code === 'UNKNOWN_PLAYER' && role === 'player') {
            storage.remove(playerTokenKey(code))
            setNeedsName(true)
            showError(msg.message)
          } else if (msg.code === 'ROOM_NOT_FOUND' || msg.code === 'BAD_HOST_TOKEN') {
            storage.remove(role === 'host' ? hostTokenKey(code) : playerTokenKey(code))
            end(msg.message)
          } else {
            showError(msg.message)
          }
          break
        case 'closed':
          storage.remove(role === 'host' ? hostTokenKey(code) : playerTokenKey(code))
          end(msg.message)
          break
        case 'kicked':
          storage.remove(playerTokenKey(code))
          end('You were removed from the room.')
          break
        case 'replaced':
          end('This room is open in another tab or window.')
          break
      }
    }

    ws.onclose = () => {
      if (wsRef.current !== ws) return
      wsRef.current = null
      if (endedRef.current) return
      setStatus('reconnecting')
      const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_BACKOFF_MS)
      attemptRef.current += 1
      if (attemptRef.current >= UNREACHABLE_AFTER_ATTEMPTS) setUnreachable(true)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      reconnectTimer.current = setTimeout(connect, delay)
    }
  }, [code, role, end, showError])

  useEffect(() => {
    endedRef.current = false // reset after StrictMode's dev-only unmount/remount
    connect()

    const ping = setInterval(() => send({ type: 'ping' }), PING_INTERVAL_MS)

    // A phone waking from sleep shouldn't wait out the backoff timer
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !endedRef.current) {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
        attemptRef.current = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      endedRef.current = true
      clearInterval(ping)
      document.removeEventListener('visibilitychange', onVisible)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (errorTimer.current) clearTimeout(errorTimer.current)
      const ws = wsRef.current
      wsRef.current = null
      ws?.close()
    }
  }, [connect, send])

  const join = useCallback((name: string) => {
    if (!send({ type: 'join', code, name })) showError('Not connected yet. Try again in a moment.')
  }, [code, send, showError])

  const sendInput = useCallback((input: PartyInput) => {
    if (!send({ type: 'input', input })) showError('Reconnecting... try again in a moment.')
  }, [send, showError])

  return {
    status,
    state,
    error,
    endedReason,
    needsName,
    clockOffset,
    unreachable,
    send,
    join,
    sendInput,
  }
}
