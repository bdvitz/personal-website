import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

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

export default apiClient
