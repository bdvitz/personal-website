'use client'

import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, RefreshCw, Target, Zap, Clock, User, Search, Database, Calendar } from 'lucide-react'
import RatingChart from '@/components/RatingChart'
import StatsCard from '@/components/StatsCard'
import WinLossChart from '@/components/WinLossChart'
import { getChessStats, getGuestStats, refreshChessStats, getRatingsOverTime, getRatingsByDateRange, fetchGuestHistory, importHistoricalData, verifyChessComUser } from '@/lib/api'

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

export default function ChessPage() {
  const DEFAULT_USERNAME = 'shia_justdoit'

  const [stats, setStats] = useState<ChessStats | null>(null)
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeOption, setTimeOption] = useState('30') // '7', '30', '90', '365', 'all', 'custom'

  // Custom range state - using year/month instead of date strings
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [customStartYear, setCustomStartYear] = useState(2020)
  const [customStartMonth, setCustomStartMonth] = useState(1)
  const [customEndYear, setCustomEndYear] = useState(currentYear)
  const [customEndMonth, setCustomEndMonth] = useState(currentMonth)

  // User mode: 'stored' for default user, 'guest' for custom lookups
  const [userMode, setUserMode] = useState<'stored' | 'guest'>('stored')
  const [guestUsername, setGuestUsername] = useState('')
  const [searchUsername, setSearchUsername] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [userVerified, setUserVerified] = useState(false)
  const [userJoinDate, setUserJoinDate] = useState<Date | null>(null) // Store user's Chess.com join date
  const [chartUsername, setChartUsername] = useState<string>('') // Track which username the chart data belongs to

  // Client-side cache for fetched data
  const [cachedData, setCachedData] = useState<{
    username: string;
    fullData: Map<string, any>; // Map of date -> rating data
    fetchedRange: { startYear: number; startMonth: number; endYear: number; endMonth: number } | null;
  } | null>(null)

  // Rating visibility toggles
  const [showRapid, setShowRapid] = useState(true)
  const [showBlitz, setShowBlitz] = useState(true)
  const [showBullet, setShowBullet] = useState(true)
  const [showPuzzle, setShowPuzzle] = useState(false)

  // Graph options
  const [connectNulls, setConnectNulls] = useState(false)

  // Helper function to calculate date range based on time option
  const calculateDateRange = (option: string, customStart?: { year: number; month: number }, customEnd?: { year: number; month: number }): { startDate: Date; endDate: Date } => {
    let endDate = new Date()
    let startDate = new Date()

    if (option === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart.year, customStart.month - 1, 1)
      endDate = new Date(customEnd.year, customEnd.month, 0) // Last day of month
    } else if (option === 'all') {
      // Use user's join date if available, otherwise default to 2010
      startDate = userJoinDate ? new Date(userJoinDate) : new Date('2010-01-01')
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
      if (dataset.label === 'Puzzle') return showPuzzle && userMode === 'stored' // Puzzle only for stored users
      return true
    })
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
      if (dayData) {
        rapidRatings.push(dayData.rapid || null)
        blitzRatings.push(dayData.blitz || null)
        bulletRatings.push(dayData.bullet || null)
      } else {
        rapidRatings.push(null)
        blitzRatings.push(null)
        bulletRatings.push(null)
      }

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

  // Fetch historical chart data only (stats are fetched separately)
  const fetchData = async (forceRefresh = false) => {
    try {
      setError(null)

      let ratingsData: any
      const username = userMode === 'stored' ? DEFAULT_USERNAME : guestUsername

      // For stored user, fetch historical ratings from database
      if (userMode === 'stored') {
        // Fetch ratings based on selected time option
        if (timeOption === 'custom') {
          // Convert year/month to date strings for the API
          const startDate = `${customStartYear}-${String(customStartMonth).padStart(2, '0')}-01`
          const endDate = new Date(customEndYear, customEndMonth, 0).toISOString().split('T')[0] // Last day of month
          ratingsData = await getRatingsByDateRange(username, startDate, endDate)
        } else if (timeOption === 'all') {
          ratingsData = await getRatingsOverTime(username, 10000)
        } else {
          ratingsData = await getRatingsOverTime(username, Number(timeOption))
        }
      } else {
        // For guest users, use cached data if available and not forcing refresh

        // Calculate date range based on time option
        const { startDate, endDate } = calculateDateRange(
          timeOption,
          { year: customStartYear, month: customStartMonth },
          { year: customEndYear, month: customEndMonth }
        )

        // Check if we can use cached data
        if (!forceRefresh && cachedData && cachedData.username === username && cachedData.fetchedRange) {
          const cached = cachedData.fetchedRange
          const cachedStart = new Date(cached.startYear, cached.startMonth - 1, 1)
          const cachedEnd = new Date(cached.endYear, cached.endMonth, 0) // Last day of month

          // If requested range is within cached range, use cache
          if (startDate >= cachedStart && endDate <= cachedEnd) {
            ratingsData = formatChartDataFromCache(startDate, endDate)
          } else {
            // Requested range extends beyond cache, show what we have with nulls
            const displayStart = new Date(Math.min(startDate.getTime(), cachedStart.getTime()))
            const displayEnd = new Date(Math.max(endDate.getTime(), cachedEnd.getTime()))
            ratingsData = formatChartDataFromCache(displayStart, displayEnd)
          }
        }

        // Only fetch if we don't have cached data or forcing refresh
        if (!ratingsData || forceRefresh) {
          ratingsData = await fetchGuestHistory(
            username,
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            endDate.getFullYear(),
            endDate.getMonth() + 1
          )

          // Store in cache
          if (ratingsData && ratingsData.labels && ratingsData.datasets) {
            const dataMap = new Map<string, any>()
            ratingsData.labels.forEach((label: string, idx: number) => {
              const dayData: any = {}
              ratingsData.datasets.forEach((dataset: any) => {
                if (dataset.label === 'Rapid') dayData.rapid = dataset.data[idx]
                if (dataset.label === 'Blitz') dayData.blitz = dataset.data[idx]
                if (dataset.label === 'Bullet') dayData.bullet = dataset.data[idx]
              })
              dataMap.set(label, dayData)
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
        }
      }

      // Filter datasets based on visibility toggles
      if (ratingsData && ratingsData.datasets) {
        ratingsData.datasets = filterDatasets(ratingsData.datasets)
      }

      setChartData(ratingsData)
      // Set the chart username to track which user's data is being displayed
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

      // User exists, set as guest user and fetch their current stats
      setGuestUsername(searchUsername.trim())
      setUserMode('guest')
      setUserVerified(true)
      setCachedData(null) // Clear cache when switching users

      // Extract and store join date from verification result
      if (result.data && result.data.joined) {
        // Chess.com API returns Unix timestamp in seconds
        const joinDate = new Date(result.data.joined * 1000)
        setUserJoinDate(joinDate)
        console.log('User joined Chess.com on:', joinDate.toLocaleDateString())
      }

      // Fetch current stats for the guest user (without storing in database)
      try {
        const statsData = await getGuestStats(searchUsername.trim())
        setStats(statsData)
      } catch (err: any) {
        console.error('Could not fetch guest stats:', err)
        // Don't set error here, stats are optional for guests
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify user')
      setUserVerified(false)
    } finally {
      setVerifying(false)
    }
  }

  // Refresh current stats from Chess.com
  const handleRefreshStats = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const username = userMode === 'stored' ? DEFAULT_USERNAME : guestUsername
      // Use different endpoints based on user mode
      const statsData = userMode === 'stored'
        ? await refreshChessStats(username)  // Stores in database
        : await getGuestStats(username)      // Doesn't store in database
      setStats(statsData)
    } catch (err: any) {
      setError(err.message || 'Failed to refresh stats. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  // Refresh historical game data or import historical data
  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const username = userMode === 'stored' ? DEFAULT_USERNAME : guestUsername

      if (userMode === 'stored' && timeOption === 'custom') {
        // Import historical data for custom range
        await importHistoricalData(
          username,
          customStartYear,
          customStartMonth,
          customEndYear,
          customEndMonth
        )
        // After import, fetch the data
        await fetchData(true)
      } else {
        // Fetch/refresh historical game data
        await fetchData(true)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process request. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  // Initial load: fetch stats for stored users
  useEffect(() => {
    if (userMode === 'stored') {
      const loadInitialStats = async () => {
        try {
          const statsData = await getChessStats(DEFAULT_USERNAME)
          setStats(statsData)
          setLoading(false)
        } catch (err: any) {
          setError(err.message || 'Failed to load stats')
          setLoading(false)
        }
      }
      loadInitialStats()
    } else {
      setLoading(false)
    }
  }, []) // Run only once on mount

  // Re-fetch data when time period or visibility toggles change
  useEffect(() => {
    if (userMode === 'stored') {
      // Stored users: auto-fetch data when settings change
      fetchData()
    } else if (userMode === 'guest' && guestUsername && cachedData && cachedData.username === guestUsername) {
      // Guest users: only update chart from cache if data is already loaded
      // Don't fetch new data - just re-render the existing cache with new filters
      const { startDate, endDate } = calculateDateRange(
        timeOption,
        { year: customStartYear, month: customStartMonth },
        { year: customEndYear, month: customEndMonth }
      )

      const chartData = formatChartDataFromCache(startDate, endDate)
      if (chartData) {
        // Filter datasets based on visibility toggles
        chartData.datasets = filterDatasets(chartData.datasets)
        setChartData(chartData)
        // Chart username should remain the same when updating from cache (already set from initial fetch)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeOption, customStartYear, customStartMonth, customEndYear, customEndMonth, showRapid, showBlitz, showBullet, showPuzzle, userMode])

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

  if (error && !stats) {
    return (
      <div className="card max-w-2xl mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Error Loading Stats</h2>
          <p className="text-red-200 mb-6">{error}</p>
          <button
            onClick={() => fetchData()}
            className="btn-primary"
          >
            Try Again
          </button>
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

                // Refresh stats when switching back to stored user mode
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
              onClick={() => setUserMode('guest')}
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
            <p className="text-xs text-purple-200 italic">Note: This takes about 4 seconds per year of data to respect Chess.com's API rate limiting</p>
          </div>
        )}

        {/* User verification status messages - Only for guest mode */}
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
      </div>

      {/* Info Card - For all users
      <div className="card bg-blue-900/20 border border-blue-500/30">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-blue-200 font-semibold mb-1">
              {userMode === 'stored' ? 'Historical Data Import' : 'Chess History Lookup'}
            </h3>
            <p className="text-blue-300/80 text-sm">
              {userMode === 'stored'
                ? 'Import your complete game history from Chess.com to populate historical rating data for detailed analysis. Use the "Custom Range" option below to select a date range and click "Import Historical Data" to begin.'
                : 'View chess statistics and rating history for any Chess.com user. First verify the username, then select a time range and retrieve their historical game data.'}
            </p>
          </div>
        </div>
      </div> */}

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
              <span>
                {refreshing
                  ? (timeOption === 'custom' && userMode === 'stored' ? 'Importing...' : 'Retrieving...')
                  : (timeOption === 'custom' && userMode === 'stored' ? 'Import Historical Data' : 'Refresh Historical Data')}
              </span>
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
          {/* <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPuzzle}
              onChange={(e) => setShowPuzzle(e.target.checked)}
              className="w-4 h-4 rounded border-purple-500 bg-purple-800/50 text-purple-500 focus:ring-purple-400 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-purple-400 font-medium">Puzzle</span>
          </label> */}
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
              {/* Start Date */}
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
                      {Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i).map((year) => (
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

              {/* End Date */}
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
                      {Array.from({ length: currentYear - 2019 }, (_, i) => 2020 + i).map((year) => (
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

      {/* Error messages for stored users only (guest errors shown above) */}
      {userMode === 'stored' && error && (
        <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Current Ratings - For stored user and verified guest users */}
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
                ? 'Select a time range above and click "Retrieve Data" to fetch chess history.'
                : userMode === 'guest'
                ? 'Enter a Chess.com username above to get started.'
                : 'No historical data available yet. Data will appear after the first scheduled update.'}
            </p>
          </div>
        )}
      </div>

      {/* Game Statistics - Only for stored user */}
      {userMode === 'stored' && stats && (
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
