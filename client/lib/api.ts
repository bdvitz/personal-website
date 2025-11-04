import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Chess.com Stats API
export const getChessStats = async (username: string) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/current`, {
      params: { username },
    })
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      // If no stats exist, try to fetch them
      return await refreshChessStats(username)
    }
    throw new Error(error.response?.data?.error || 'Failed to fetch chess statistics')
  }
}

export const refreshChessStats = async (username: string) => {
  try {
    const response = await apiClient.post(`/api/chess/stats/refresh`, null, {
      params: { username },
    })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to refresh chess statistics')
  }
}

export const getRatingHistory = async (username: string, days: number = 30) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/history`, {
      params: { username, days },
    })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch rating history')
  }
}

export const getRatingsOverTime = async (username: string, days: number = 90) => {
  try {
    const response = await apiClient.get(`/api/chess/stats/ratings-over-time`, {
      params: { username, days },
    })
    return response.data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch ratings over time')
  }
}

export default apiClient
