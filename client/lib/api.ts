import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Fetch current chess stats, auto-refresh if not found
export const getChessStats = async (username: string) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/current`, { params: { username } })
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      return await refreshChessStats(username)
    }
    throw new Error(error.response?.data?.error || 'Failed to fetch chess statistics')
  }
}

// Force refresh stats from Chess.com API
export const refreshChessStats = async (username: string) => {
  try {
    const response = await apiClient.post(`/api/chess/stats/refresh`, null, { params: { username } })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to refresh chess statistics')
  }
}

// Get rating history for a single month (checks DB first for stored users, falls back to API)
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

// Fetch rating history for a single month from Chess.com API (guest users)
export const fetchMonthHistory = async (username: string, year: number, month: number) => {
  try {
    const response = await apiClient.get(`/api/chess/history/guest-month`, {
      params: { username, year, month },
      timeout: 30000, // 30 second timeout
    })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch guest month history')
  }
}

// Fetch and update rating history from Chess.com API to database (stored users)
export const refreshMonthHistory = async (username: string, year: number, month: number) => {
  try {
    const response = await apiClient.post(`/api/chess/history/refresh`, null, {
      params: { username, year, month },
      timeout: 30000, // 30 second timeout for API fetch
    })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to refresh month history from Chess.com')
  }
}

// Verify Chess.com user exists via server endpoint
export const verifyChessComUser = async (username: string) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/verify`, { params: { username } })
    return {
      exists: response.data.exists,
      username: response.data.username,
      joinedTimestamp: response.data.joinedTimestamp,
      message: response.data.message
    }
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to verify user')
  }
}

// Fetch current stats for guest user without storing in database
export const getGuestStats = async (username: string) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/guest-current`, { params: { username } })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch guest statistics. Unable to connect to server and make api requests.')
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
