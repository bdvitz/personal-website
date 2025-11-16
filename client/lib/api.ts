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

// Get historical rating data
export const getRatingHistory = async (username: string, days: number = 30) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/history`, { params: { username, days } })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch rating history')
  }
}

// Get ratings formatted for chart display
export const getRatingsOverTime = async (username: string, days: number = 90) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/ratings-over-time`, { params: { username, days } })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch ratings over time')
  }
}

// Get ratings for a custom date range
export const getRatingsByDateRange = async (username: string, startDate: string, endDate: string) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/ratings-by-date-range`, {
      params: { username, startDate, endDate }
    })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch ratings by date range')
  }
}

// Import historical game data from Chess.com
export const importHistoricalData = async (
  username: string,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
) => {
  try {
    const params: any = {
      username,
      startYear,
      startMonth,
      endYear,
      endMonth
    }

    const response = await apiClient.post(`/api/chess/stats/import-history`, null, {
      params,
      timeout: 600000, // 10 minute timeout for long imports
    })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to import historical data')
  }
}

// Fetch guest user historical data without storing in database
export const fetchGuestHistory = async (
  username: string,
  startYear: number,
  startMonth: number,
  endYear?: number,
  endMonth?: number
) => {
  try {
    const params: any = {
      username,
      startYear,
      startMonth
    }

    if (endYear !== undefined) params.endYear = endYear
    if (endMonth !== undefined) params.endMonth = endMonth

    const response = await apiClient.get(`/api/chess/stats/guest-history`, {
      params,
      timeout: 600000, // 10 minute timeout for long fetches
    })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch guest history')
  }
}

export default apiClient
