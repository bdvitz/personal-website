import axios from 'axios'

// Trailing slashes stripped: axios tolerates "host/" + "/path", but the WebSocket URL
// would become "host//ws/party", which the server answers with 404
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, '')

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// All chess data is read from the database; the server refreshes it from Chess.com nightly.
// Removed Chess.com passthrough calls are documented in docs/removed-chess-guest-lookup.md.

export const SERVER_OFFLINE_MESSAGE = 'Server is offline or starting up. Please wait a moment and try again.'

// Error with a user-safe message. Server error text is never shown to visitors.
export class ApiError extends Error {
  offline: boolean
  constructor(message: string, offline: boolean) {
    super(message)
    this.offline = offline
  }
}

const toApiError = (error: any, fallback: string): ApiError => {
  if (!error.response) {
    // Network error or timeout: the server is asleep, deploying, or unreachable
    return new ApiError(SERVER_OFFLINE_MESSAGE, true)
  }
  if (error.response.status === 404) {
    return new ApiError('No stored chess data is available yet.', false)
  }
  return new ApiError(fallback, false)
}

// Fetch stored chess stats
export const getChessStats = async (username: string) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/current`, { params: { username } })
    return response.data
  } catch (error: any) {
    throw toApiError(error, 'Could not load chess statistics. Please try again later.')
  }
}

// Get stored rating history for a single month
export const getMonthHistory = async (username: string, year: number, month: number) => {
  try {
    const response = await apiClient.get(`/api/chess/history/month`, {
      params: { username, year, month }
    })
    return response.data
  } catch (error: any) {
    throw toApiError(error, 'Could not load rating history. Please try again later.')
  }
}

// Load stored user snapshot from static JSON file
export const loadStoredUserSnapshot = async () => {
  try {
    const response = await fetch('/data/stored-user-snapshot.json')
    if (!response.ok) {
      throw new Error('Snapshot file not found')
    }
    return await response.json()
  } catch (error: any) {
    console.error('Failed to load snapshot:', error)
    throw new Error('Failed to load cached data')
  }
}

// Check server health with timeout
export const checkServerHealth = async (timeoutMs: number = 5000): Promise<boolean> => {
  try {
    const response = await apiClient.get('/api/chess/stats/health', { timeout: timeoutMs })
    return response.status === 200
  } catch (error: any) {
    console.warn('Server health check failed:', error.message)
    return false
  }
}

// ---- Party games (room create/lookup over REST; gameplay over the WebSocket) ----

export const PARTY_WS_URL = API_BASE_URL.replace(/^http/, 'ws') + '/ws/party'

const partyError = (error: any, fallback: string): ApiError => {
  if (!error.response) {
    return new ApiError(SERVER_OFFLINE_MESSAGE, true)
  }
  // Party errors are written for players (room full, rate limited...), so show them
  return new ApiError(error.response.data?.error || fallback, false)
}

// Passing this browser's previous room closes it first (one room per host browser)
export const createPartyRoom = async (
  previous?: { previousCode: string; previousHostToken: string }
): Promise<{ code: string; hostToken: string }> => {
  try {
    const response = await apiClient.post('/api/party/rooms', previous ?? {})
    return response.data
  } catch (error: any) {
    throw partyError(error, 'Could not create a room. Please try again.')
  }
}

// Returns null when no room has that code
export const getPartyRoom = async (code: string): Promise<{ code: string; status: string; playerCount: number; maxPlayers: number } | null> => {
  try {
    const response = await apiClient.get(`/api/party/rooms/${encodeURIComponent(code)}`)
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) return null
    throw partyError(error, 'Could not look up that room. Please try again.')
  }
}

export default apiClient
