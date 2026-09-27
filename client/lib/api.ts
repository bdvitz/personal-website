import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// All chess data is read from the database; the server refreshes it from Chess.com nightly.
// Removed Chess.com passthrough calls are documented in docs/removed-chess-guest-lookup.md.

// Fetch stored chess stats
export const getChessStats = async (username: string) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/current`, { params: { username } })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch chess statistics')
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
    throw new Error(error.response?.data?.error || 'Failed to fetch month history')
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
