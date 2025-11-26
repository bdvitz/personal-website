'use client'

import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, RefreshCw, Target, Zap, Clock, User, Search, Calendar } from 'lucide-react'
import RatingChart from '@/components/RatingChart'
import StatsCard from '@/components/StatsCard'
import WinLossChart from '@/components/WinLossChart'
import { getChessStats, getGuestStats, refreshChessStats, getMonthHistory, fetchMonthHistory, verifyChessComUser, loadStoredUserSnapshot, checkServerHealth } from '@/lib/api'

interface ChessStats {
  username: string
  rapidRating: number | null
  blitzRating: number | null
  bulletRating: number | null
  puzzleRating: number | null
  totalGames: number
  wins: number
  losses: number
  draws: number
  lastUpdated: string
}

interface ChessDailyRating {
  id?: number
  username: string
  date: string
  rapidRating: number | null
  blitzRating: number | null
  bulletRating: number | null
}

export default function ChessPage() {
  const DEFAULT_USERNAME = 'shia_justdoit'

  const [stats, setStats] = useState<ChessStats | null>(null)
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeOption, setTimeOption] = useState('30') // '7', '30', '90', '365', 'all', 'custom'

  // Custom range state
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [customStartYear, setCustomStartYear] = useState(2010)
  const [customStartMonth, setCustomStartMonth] = useState(1)
  const [customEndYear, setCustomEndYear] = useState(currentYear)
  const [customEndMonth, setCustomEndMonth] = useState(currentMonth)

  // User mode: 'stored' for default user, 'guest' for custom lookups
  const [userMode, setUserMode] = useState<'stored' | 'guest'>('stored')
  const [guestUsername, setGuestUsername] = useState('')
  const [searchUsername, setSearchUsername] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [userVerified, setUserVerified] = useState(false)
  const [userJoinDate, setUserJoinDate] = useState<Date | null>(null)
  const [chartUsername, setChartUsername] = useState<string>('')

  // Client-side cache for fetched data
  const [cachedData, setCachedData] = useState<{
    username: string
    fullData: Map<string, any> // Map of date -> rating data
    fetchedRange: { startYear: number; startMonth: number; endYear: number; endMonth: number } | null
  } | null>(null)

  // Rating visibility toggles
  const [showRapid, setShowRapid] = useState(true)
  const [showBlitz, setShowBlitz] = useState(true)
  const [showBullet, setShowBullet] = useState(true)

  // Graph options
  const [connectNulls, setConnectNulls] = useState(false)

  // Progress tracking for month-by-month fetching
  const [fetchProgress, setFetchProgress] = useState<{
    current: number
    total: number
    currentMonth: string
  } | null>(null)

  // Server health status for stored user
  const [serverOnline, setServerOnline] = useState<boolean | null>(null) // null = checking, true = online, false = offline
  const [usingSnapshot, setUsingSnapshot] = useState(false)

  // Helper function to calculate date range based on time option
  const calculateDateRange = (option: string, customStart?: { year: number; month: number }, customEnd?: { year: number; month: number }): { startDate: Date; endDate: Date } => {
    let endDate = new Date()
    let startDate = new Date()

    if (option === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart.year, customStart.month - 1, 1)
      endDate = new Date(customEnd.year, customEnd.month, 0) // Last day of month
    } else if (option === 'all') {
      // For stored user, use June 9, 2020 as the start date
      // For guest users, use their join date if available, otherwise default to 2010
      if (userMode === 'stored') {
        startDate = new Date('2020-06-09')
      } else {
        startDate = userJoinDate ? new Date(userJoinDate) : new Date('2010-01-01')
      }
    } else {
      const days = Number(option)
      startDate.setDate(startDate.getDate() - days)
    }

    return { startDate, endDate }
  }

  // Helper function to filter datasets based on visibility toggles
  const filterDatasets = (datasets: any[]): any[] => {
    return datasets.filter((dataset: any) => {
      if (dataset.label === 'Rapid') return showRapid
      if (dataset.label === 'Blitz') return showBlitz
      if (dataset.label === 'Bullet') return showBullet
      return true
    })
  }

  // Helper function to generate list of months in a date range
  const generateMonthList = (startDate: Date, endDate: Date): { year: number; month: number }[] => {
    const months: { year: number; month: number }[] = []
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

    while (current <= end) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1
      })
      current.setMonth(current.getMonth() + 1)
    }

    return months
  }

  // Helper function to fetch a single month with retry logic
  const fetchMonthWithRetry = async (
    username: string,
    year: number,
    month: number,
    isStoredUser: boolean,
    maxRetries: number = 3
  ): Promise<ChessDailyRating[]> => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use getMonthHistory for stored users, fetchMonthHistory for guest users
        const monthData = isStoredUser
          ? await getMonthHistory(username, year, month)
          : await fetchMonthHistory(username, year, month)
        return monthData
      } catch (error: any) {
        lastError = error
        console.warn(`Attempt ${attempt}/${maxRetries} failed for ${year}-${month.toString().padStart(2, '0')}: ${error.message}`)

        if (attempt < maxRetries) {
          const delayMs = 500 * Math.pow(2, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }

    throw lastError || new Error(`Failed to fetch data for ${year}-${month}`)
  }

  // Helper function to format chart data from ChessDailyRating list
  const formatChartDataFromRatings = (ratings: ChessDailyRating[], startDate: Date, endDate: Date) => {
    const labels: string[] = []
    const rapidRatings: (number | null)[] = []
    const blitzRatings: (number | null)[] = []
    const bulletRatings: (number | null)[] = []

    // Create a map for quick lookup
    const ratingsMap = new Map<string, ChessDailyRating>()
    ratings.forEach(rating => {
      ratingsMap.set(rating.date, rating)
    })

    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      labels.push(dateKey)

      const rating = ratingsMap.get(dateKey)
      rapidRatings.push(rating?.rapidRating || null)
      blitzRatings.push(rating?.blitzRating || null)
      bulletRatings.push(rating?.bulletRating || null)

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return {
      labels,
      datasets: [
        { label: 'Rapid', data: rapidRatings, borderColor: '#22c55e', backgroundColor: '#22c55e33' },
        { label: 'Blitz', data: blitzRatings, borderColor: '#3b82f6', backgroundColor: '#3b82f633' },
        { label: 'Bullet', data: bulletRatings, borderColor: '#ef4444', backgroundColor: '#ef444433' }
      ]
    }
  }

  // Helper function to format chart data from cached data
  const formatChartDataFromCache = (startDate: Date, endDate: Date) => {
    if (!cachedData || !cachedData.fullData) return null

    const labels: string[] = []
    const rapidRatings: (number | null)[] = []
    const blitzRatings: (number | null)[] = []
    const bulletRatings: (number | null)[] = []

    let currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0]
      labels.push(dateKey)

      const dayData = cachedData.fullData.get(dateKey)
      rapidRatings.push(dayData?.rapid || null)
      blitzRatings.push(dayData?.blitz || null)
      bulletRatings.push(dayData?.bullet || null)

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return {
      labels,
      datasets: [
        { label: 'Rapid', data: rapidRatings, borderColor: '#22c55e', backgroundColor: '#22c55e33' },
        { label: 'Blitz', data: blitzRatings, borderColor: '#3b82f6', backgroundColor: '#3b82f633' },
        { label: 'Bullet', data: bulletRatings, borderColor: '#ef4444', backgroundColor: '#ef444433' }
      ]
    }
  }

  // Fetch historical chart data
  const fetchData = async (forceRefresh = false) => {
    try {
      setError(null)
      const username = userMode === 'stored' ? DEFAULT_USERNAME : guestUsername
      const isStoredUser = userMode === 'stored'

      // Calculate date range
      const { startDate, endDate } = calculateDateRange(
        timeOption,
        { year: customStartYear, month: customStartMonth },
        { year: customEndYear, month: customEndMonth }
      )

      // Check if we can use cached data (only for guest users)
      if (!isStoredUser && !forceRefresh && cachedData && cachedData.username === username && cachedData.fetchedRange) {
        const cached = cachedData.fetchedRange
        const cachedStart = new Date(cached.startYear, cached.startMonth - 1, 1)
        const cachedEnd = new Date(cached.endYear, cached.endMonth, 0)

        if (startDate >= cachedStart && endDate <= cachedEnd) {
          const chartData = formatChartDataFromCache(startDate, endDate)
          if (chartData) {
            chartData.datasets = filterDatasets(chartData.datasets)
            setChartData(chartData)
            return
          }
        }
      }

      // Fetch month-by-month
      const months = generateMonthList(startDate, endDate)
      const allRatings: ChessDailyRating[] = []

      for (let i = 0; i < months.length; i++) {
        const { year, month } = months[i]
        const monthStr = `${year}-${month.toString().padStart(2, '0')}`

        // Add delay between requests (except first request)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }

        // Update progress
        setFetchProgress({
          current: i + 1,
          total: months.length,
          currentMonth: monthStr
        })

        try {
          const monthRatings = await fetchMonthWithRetry(username, year, month, isStoredUser)
          allRatings.push(...monthRatings)
        } catch (error: any) {
          console.error(`Failed to fetch ${monthStr}:`, error.message)
        }
      }

      setFetchProgress(null)

      // Cache data for guest users
      if (!isStoredUser) {
        const dataMap = new Map<string, any>()
        allRatings.forEach(rating => {
          dataMap.set(rating.date, {
            rapid: rating.rapidRating,
            blitz: rating.blitzRating,
            bullet: rating.bulletRating
          })
        })

        setCachedData({
          username,
          fullData: dataMap,
          fetchedRange: {
            startYear: startDate.getFullYear(),
            startMonth: startDate.getMonth() + 1,
            endYear: endDate.getFullYear(),
            endMonth: endDate.getMonth() + 1
          }
        })
      }

      // Format chart data
      let ratingsData = formatChartDataFromRatings(allRatings, startDate, endDate)
      ratingsData.datasets = filterDatasets(ratingsData.datasets)
      setChartData(ratingsData)
      setChartUsername(username)
    } catch (err: any) {
      setError(err.message || 'Failed to load chess statistics')
      console.error('Error fetching chess data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Handle guest user verification
  const handleGuestSearch = async () => {
    if (!searchUsername.trim()) {
      setError('Please enter a username')
      return
    }

    setVerifying(true)
    setError(null)
    try {
      const result = await verifyChessComUser(searchUsername.trim())

      if (!result.exists) {
        setError(result.message || 'User not found on Chess.com')
        setUserVerified(false)
        return
      }

      setGuestUsername(searchUsername.trim())
      setUserMode('guest')
      setUserVerified(true)
      setCachedData(null)

      if (result.data && result.data.joined) {
        const joinDate = new Date(result.data.joined * 1000)
        setUserJoinDate(joinDate)
        console.log('User joined Chess.com on:', joinDate.toLocaleDateString())
      }

      // Fetch current stats for guest user
      try {
        const statsData = await getGuestStats(searchUsername.trim())
        setStats(statsData)
      } catch (err: any) {
        console.error('Could not fetch guest stats:', err)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify user')
      setUserVerified(false)
    } finally {
      setVerifying(false)
    }
  }

  // Refresh current stats
  const handleRefreshStats = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const username = userMode === 'stored' ? DEFAULT_USERNAME : guestUsername
      const statsData = userMode === 'stored'
        ? await refreshChessStats(username)
        : await getGuestStats(username)
      setStats(statsData)

      // If successful and stored user, mark server as online and not using snapshot
      if (userMode === 'stored') {
        setServerOnline(true)
        setUsingSnapshot(false)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh stats')

      // If failed and stored user, mark server as potentially offline
      if (userMode === 'stored') {
        setServerOnline(false)
      }
    } finally {
      setRefreshing(false)
    }
  }

  // Refresh historical data
  const handleRefresh = async () => {
    setRefreshing(true)

    // Check server health before fetching
    if (userMode === 'stored') {
      const isOnline = await checkServerHealth(5000)
      setServerOnline(isOnline)

      if (!isOnline) {
        setError('Server is offline. Please wait and try again.')
        setRefreshing(false)
        return
      }
    }

    await fetchData(true)

    // Mark that we're using live data if successful
    if (userMode === 'stored') {
      setUsingSnapshot(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (userMode === 'stored') {
      const loadInitialStats = async () => {
        try {
          // First, try to load snapshot data (instant)
          try {
            const snapshot = await loadStoredUserSnapshot()
            if (snapshot && snapshot.currentStats) {
              setStats(snapshot.currentStats)
              setUsingSnapshot(true)
              setLoading(false)
              console.log('Loaded snapshot data:', snapshot.generatedAt)
            }
          } catch (snapshotErr) {
            console.warn('Snapshot not available, will try server')
          }

          // Then check server health in background
          const isOnline = await checkServerHealth(5000)
          setServerOnline(isOnline)

          if (isOnline) {
            // Server is online, fetch fresh data
            try {
              const statsData = await getChessStats(DEFAULT_USERNAME)
              setStats(statsData)
              setUsingSnapshot(false)
              setLoading(false)
            } catch (err: any) {
              // Server responded but failed, keep snapshot data if available
              if (!usingSnapshot) {
                setError(err.message || 'Failed to load stats')
              }
              setLoading(false)
            }
          } else {
            // Server offline, rely on snapshot
            if (!usingSnapshot) {
              setError('Server is offline. Please try again later.')
            }
            setLoading(false)
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load stats')
          setLoading(false)
        }
      }
      loadInitialStats()
    } else {
      setLoading(false)
    }
  }, [])

  // Re-render chart when time period or visibility toggles change (only if data already exists)
  useEffect(() => {
    // Only update chart from cache if data has already been loaded
    if (userMode === 'guest' && guestUsername && cachedData && cachedData.username === guestUsername) {
      const { startDate, endDate } = calculateDateRange(
        timeOption,
        { year: customStartYear, month: customStartMonth },
        { year: customEndYear, month: customEndMonth }
      )

      const chartData = formatChartDataFromCache(startDate, endDate)
      if (chartData) {
        chartData.datasets = filterDatasets(chartData.datasets)
        setChartData(chartData)
      }
    } else if (userMode === 'stored' && chartData && chartUsername === DEFAULT_USERNAME) {
      // For stored users, only re-filter existing chart data when visibility toggles change
      // Don't fetch new data
      const filteredData = { ...chartData }
      filteredData.datasets = filterDatasets(chartData.datasets)
      setChartData(filteredData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeOption, customStartYear, customStartMonth, customEndYear, customEndMonth, showRapid, showBlitz, showBullet])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-200 text-lg">Loading chess statistics...</p>
        </div>
      </div>
    )
  }

  const winRate = stats ? ((stats.wins / stats.totalGames) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-3 flex items-center justify-center">
          <Trophy className="w-12 h-12 text-yellow-400 mr-4" />
          Chess Statistics
        </h1>
        <p className="text-xl text-purple-200">
          {userMode === 'stored'
            ? 'Track my Chess.com progress and ratings over time'
            : `Viewing stats for: ${guestUsername}`}
        </p>
      </div>

      {/* User Mode Toggle */}
      <div className="card bg-purple-900/40">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setUserMode('stored')
                setGuestUsername('')
                setSearchUsername('')
                setUserVerified(false)
                setUserJoinDate(null)
                setChartUsername('')
                setChartData(null) // Clear chart on tab switch
                setCachedData(null) // Clear cache on tab switch

                try {
                  const statsData = await getChessStats(DEFAULT_USERNAME)
                  setStats(statsData)
                } catch (err: any) {
                  console.error('Failed to refresh stats:', err)
                }
              }}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
                userMode === 'stored'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                  : 'bg-purple-800/30 text-purple-300 hover:bg-purple-800/50'
              }`}
            >
              <User className="w-4 h-4 inline mr-2" />
              My Stats
            </button>
            <button
              onClick={() => {
                setUserMode('guest')
                setChartData(null) // Clear chart on tab switch
                setCachedData(null) // Clear cache on tab switch
                setChartUsername('')
              }}
              className={`px-6 py-2 rounded-lg font-semibold transition-all duration-200 ${
                userMode === 'guest'
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                  : 'bg-purple-800/30 text-purple-300 hover:bg-purple-800/50'
              }`}
            >
              <Search className="w-4 h-4 inline mr-2" />
              Search User
            </button>
          </div>

          {userMode === 'guest' && (
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="Enter Chess.com username"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleGuestSearch()}
                className="flex-1 md:w-64 bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200"
              />
              <button
                onClick={handleGuestSearch}
                disabled={verifying}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100"
              >
                {verifying ? 'Verifying...' : 'Verify User'}
              </button>
            </div>
          )}
        </div>

        {userMode === 'guest' && (
          <div className="mt-4 text-sm text-purple-300 bg-purple-800/30 rounded-lg p-3">
            <p className="font-semibold mb-2">How it works:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mb-3">
              <li>First, verify your Chess.com username using the button above</li>
              <li>Select your desired time range below</li>
              <li>Click "Retrieve Historical Data" to fetch chess history</li>
              <li>Data will be cached so you can switch between smaller time ranges without re-fetching</li>
            </ul>
            <p className="text-xs text-purple-200 italic">Note: This takes about 5 to 10 seconds per year of data to respect Chess.com's API rate limiting</p>
          </div>
        )}

        {userMode === 'guest' && error && (
          <div className="mt-4 bg-red-500/20 border border-red-400/50 rounded-lg p-4">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {userMode === 'guest' && userVerified && guestUsername && (
          <div className="mt-4 bg-green-500/20 border border-green-400/50 rounded-lg p-4">
            <p className="text-green-200">
              ✓ User <strong>{guestUsername}</strong> verified successfully!
              {userJoinDate && (
                <span className="ml-1">
                  (Joined: {userJoinDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })})
                </span>
              )}
            </p>
            <p className="text-green-200 text-sm mt-1">
              You can now retrieve their chess statistics.
            </p>
          </div>
        )}

        {/* Server Status Notice for Stored User */}
        {userMode === 'stored' && serverOnline === false && (
          <div className="mt-4 bg-yellow-500/20 border border-yellow-400/50 rounded-lg p-4">
            <p className="text-yellow-200 font-semibold mb-2">⚠️ Server Status: Waking Up</p>
            <p className="text-yellow-100 text-sm">
              The backend server is currently sleeping and may take <strong>up to 2 minutes</strong> to come online.
              {usingSnapshot && ' You are currently viewing cached data from the last snapshot.'}
            </p>
            <p className="text-yellow-100 text-sm mt-2">
              Click "Refresh Stats" or "Retrieve Historical Data" to fetch live data once the server is online.
            </p>
          </div>
        )}

        {userMode === 'stored' && usingSnapshot && serverOnline === true && (
          <div className="mt-4 bg-blue-500/20 border border-blue-400/50 rounded-lg p-4">
            <p className="text-blue-200 font-semibold mb-1">📸 Viewing Cached Data</p>
            <p className="text-blue-100 text-sm">
              You're viewing snapshot data. Click "Refresh Stats" to fetch the latest data from the server.
            </p>
          </div>
        )}

        {userMode === 'stored' && serverOnline === true && !usingSnapshot && (
          <div className="mt-4 bg-green-500/20 border border-green-400/50 rounded-lg p-4">
            <p className="text-green-200">
              ✓ Server online - Showing live data
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <label className="text-purple-200 font-medium">Time Period:</label>
            <select
              value={timeOption}
              onChange={(e) => setTimeOption(e.target.value)}
              className="bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last Year</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRefreshStats}
              disabled={refreshing || (userMode === 'guest' && !userVerified)}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Stats</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing || (userMode === 'guest' && !userVerified)}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Retrieving...' : 'Retrieve Historical Data'}</span>
            </button>
          </div>
        </div>

        {/* Rating Type Toggles */}
        <div className="flex flex-wrap items-center gap-6 bg-purple-900/30 rounded-lg p-4">
          <span className="text-purple-200 font-medium">Graph Options:</span>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showRapid}
              onChange={(e) => setShowRapid(e.target.checked)}
              className="w-4 h-4 rounded border-green-500 bg-purple-800/50 text-green-500 focus:ring-green-400 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-green-400 font-medium">Rapid</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showBlitz}
              onChange={(e) => setShowBlitz(e.target.checked)}
              className="w-4 h-4 rounded border-blue-500 bg-purple-800/50 text-blue-500 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-blue-400 font-medium">Blitz</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showBullet}
              onChange={(e) => setShowBullet(e.target.checked)}
              className="w-4 h-4 rounded border-red-500 bg-purple-800/50 text-red-500 focus:ring-red-400 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-red-400 font-medium">Bullet</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={connectNulls}
              onChange={(e) => setConnectNulls(e.target.checked)}
              className="w-4 h-4 rounded border-purple-500 bg-purple-800/50 text-purple-500 focus:ring-purple-400 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-purple-200 font-medium">Connect gaps with lines</span>
          </label>
        </div>

        {/* Custom Date Range Picker */}
        {timeOption === 'custom' && (
          <div className="card bg-purple-900/30">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center text-purple-200 font-medium">
                  <Calendar className="w-4 h-4 mr-2" />
                  Start Date
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-purple-300 text-sm mb-1 block">Year</label>
                    <select
                      value={customStartYear}
                      onChange={(e) => setCustomStartYear(Number(e.target.value))}
                      disabled={refreshing}
                      className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    >
                      {Array.from({ length: currentYear - 2010 + 1 }, (_, i) => 2010 + i).map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-300 text-sm mb-1 block">Month</label>
                    <select
                      value={customStartMonth}
                      onChange={(e) => setCustomStartMonth(Number(e.target.value))}
                      disabled={refreshing}
                      className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                        <option key={idx + 1} value={idx + 1}>{month}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center text-purple-200 font-medium">
                  <Calendar className="w-4 h-4 mr-2" />
                  End Date
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-purple-300 text-sm mb-1 block">Year</label>
                    <select
                      value={customEndYear}
                      onChange={(e) => setCustomEndYear(Number(e.target.value))}
                      disabled={refreshing}
                      className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    >
                      {Array.from({ length: currentYear - 2010 + 1 }, (_, i) => 2010 + i).map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-300 text-sm mb-1 block">Month</label>
                    <select
                      value={customEndMonth}
                      onChange={(e) => setCustomEndMonth(Number(e.target.value))}
                      disabled={refreshing}
                      className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                        <option key={idx + 1} value={idx + 1}>{month}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress Indicator */}
      {fetchProgress && (
        <div className="card bg-blue-900/30 border border-blue-500/50">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <div className="flex-1">
              <h3 className="text-blue-200 font-semibold text-lg mb-1">
                Loading chess history...
              </h3>
              <p className="text-blue-300 text-sm">
                Processing month {fetchProgress.current} of {fetchProgress.total} ({fetchProgress.currentMonth})
              </p>
              <div className="mt-3 w-full bg-blue-900/50 rounded-full h-2.5">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(fetchProgress.current / fetchProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error messages for stored users */}
      {userMode === 'stored' && error && !stats && (
        <div className="card max-w-2xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Server Connection Error</h2>
            <p className="text-red-200 mb-6">{error}</p>
            <button
              onClick={() => fetchData()}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      {userMode === 'stored' && error && stats && (
        <div className="bg-yellow-500/20 border border-yellow-400/50 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-yellow-200 font-semibold">Connection Issue. Server may be offline.</p>
              <p className="text-yellow-200 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current Ratings */}
      {stats && (userMode === 'stored' || (userMode === 'guest' && userVerified)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Rapid"
            value={stats?.rapidRating || 'N/A'}
            icon={Target}
            color="green"
          />
          <StatsCard
            title="Blitz"
            value={stats?.blitzRating || 'N/A'}
            icon={Zap}
            color="blue"
          />
          <StatsCard
            title="Bullet"
            value={stats?.bulletRating || 'N/A'}
            icon={Clock}
            color="red"
          />
          <StatsCard
            title="Highest Puzzle Rating"
            value={stats?.puzzleRating || 'N/A'}
            icon={Trophy}
            color="purple"
          />
        </div>
      )}

      {/* Rating Chart */}
      <div className="card">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          <TrendingUp className="w-6 h-6 text-purple-400 mr-2" />
          Rating Progression for {userMode === 'stored' ? 'Bryan Vitz' : chartUsername || 'User'}
        </h2>
        {chartData && chartData.labels.length > 0 ? (
          <RatingChart data={chartData} connectNulls={connectNulls} />
        ) : (
          <div className="text-center py-12">
            <p className="text-purple-200">
              {userMode === 'guest' && guestUsername
                ? 'Select a time range above and click "Retrieve Historical Data" to fetch chess history.'
                : userMode === 'guest'
                ? 'Enter a Chess.com username above to get started.'
                : 'No historical data available yet. Data will appear after the first scheduled update.'}
            </p>
          </div>
        )}
      </div>

      {/* Game Statistics - Show for both stored and guest users */}
      {stats && (userMode === 'stored' || (userMode === 'guest' && userVerified)) && (
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Win/Loss/Draw */}
          <div className="card">
            <h2 className="text-2xl font-bold text-white mb-6">Game Results</h2>
            <WinLossChart stats={stats} />
          </div>

          {/* Overall Stats */}
          <div className="card">
            <h2 className="text-2xl font-bold text-white mb-6">Overall Statistics</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
                <span className="text-purple-200 font-medium">Total Games</span>
                <span className="text-white font-bold text-2xl">{stats?.totalGames || 0}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
                <span className="text-purple-200 font-medium">Wins</span>
                <span className="text-green-400 font-bold text-2xl">{stats?.wins || 0}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
                <span className="text-purple-200 font-medium">Losses</span>
                <span className="text-red-400 font-bold text-2xl">{stats?.losses || 0}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
                <span className="text-purple-200 font-medium">Draws</span>
                <span className="text-blue-400 font-bold text-2xl">{stats?.draws || 0}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-400/30">
                <span className="text-white font-semibold">Win Rate</span>
                <span className="text-white font-bold text-2xl">{winRate}%</span>
              </div>
            </div>
            {stats?.lastUpdated && (
              <p className="text-purple-300 text-sm mt-6 text-center">
                Last updated: {new Date(stats.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
