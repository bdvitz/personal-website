'use client'

import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, RefreshCw, Target, Zap, Clock, User, Search, Calendar } from 'lucide-react'
import RatingChart from './components/RatingChart'
import StatsCard from './components/StatsCard'
import WinLossChart from './components/WinLossChart'
import ServerHealthIndicator from './components/ServerHealthIndicator'
import HistoricalDataFetcher from './components/HistoricalDataFetcher'
import { useCachedChessData } from './components/hooks/useCachedChessData'
import { loadSnapshotData } from './components/SnapshotLoader'
import { getGuestStats, verifyChessComUser, checkServerHealth } from '@/lib/api'
import { ChessStats, ChessDailyRating } from '@/types/chess'

export default function ChessPage() {
  const DEFAULT_USERNAME = 'shia_justdoit'

  // Pure helper: Get current date defaults
  const getCurrentDateDefaults = () => {
    const now = new Date()
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    }
  }

  // Pure helper: Get stored user initial state
  const getStoredUserInitialState = () => {
    const { year, month } = getCurrentDateDefaults()
    return {
      timeOption: 'all' as const,
      customStartYear: 2020,
      customStartMonth: 6,  // June 9, 2020 is the stored user's join date
      customEndYear: year,
      customEndMonth: month,
      guestUsername: '',
      searchUsername: '',
      userVerified: false,
      userJoinDate: null
    }
  }

  // Pure helper: Get guest user initial state
  const getGuestUserInitialState = () => {
    const { year, month } = getCurrentDateDefaults()
    return {
      timeOption: 'all' as const,
      customStartYear: 2010,
      customStartMonth: 1,
      customEndYear: year,
      customEndMonth: month
    }
  }

  // Cache hook (ACTIVE - not commented out)
  const cacheHook = useCachedChessData()
  const { isCached, getCachedDataForRange, storeCachedData, clearCache } = cacheHook

  const [stats, setStats] = useState<ChessStats | null>(null)
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeOption, setTimeOption] = useState('all') // '7', '30', '90', '365', 'all', 'custom'

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

  // Fetching state for HistoricalDataFetcher component
  const [isFetching, setIsFetching] = useState(false)
  const [fetchParams, setFetchParams] = useState<{
    username: string
    startDate: Date
    endDate: Date
    dataSource: 'database' | 'update' | 'guest'
  } | null>(null)

  // Server health status
  const [serverOnline, setServerOnline] = useState<boolean | null>(null) // null = checking, true = online, false = offline
  const [usingSnapshot, setUsingSnapshot] = useState(false)

  // Helper function to calculate date range based on time option
  const calculateDateRange = (
    option: string,
    customStart?: { year: number; month: number },
    customEnd?: { year: number; month: number }
  ): { startDate: Date; endDate: Date } => {
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

  // Load snapshot data on mount for stored user
  const loadSnapshotOnMount = async () => {
    try {
      const snapshot = await loadSnapshotData(timeOption)
      if (snapshot) {
        setStats(snapshot.stats)
        setChartData(snapshot.chartData)
        setChartUsername(DEFAULT_USERNAME)
        setUsingSnapshot(true)

        // Populate cache with snapshot data
        const { startDate, endDate } = calculateDateRange(timeOption)
        storeCachedData(snapshot.historicalData, startDate, endDate)

        console.log('Loaded snapshot data from', new Date(snapshot.generatedAt).toLocaleString())
      }
    } catch (err) {
      console.error('Snapshot load failed:', err)
    }

    // Then check server health and update if online
    const isOnline = await checkServerHealth(5000)
    setServerOnline(isOnline)

    if (isOnline) {
      // Fetch fresh stats (don't wait for historical data)
      try {
        const statsData = await getGuestStats(DEFAULT_USERNAME)
        setStats(statsData)
        setUsingSnapshot(false)
      } catch (err: any) {
        console.error('Failed to fetch live stats:', err)
      }
    }

    setLoading(false)
  }

  // Refresh chart from cache when time period changes
  const refreshChartFromCache = (newTimeOption: string) => {
    const { startDate, endDate } = calculateDateRange(
      newTimeOption,
      { year: customStartYear, month: customStartMonth },
      { year: customEndYear, month: customEndMonth }
    )

    // Check if we have cached data for this range
    if (isCached(startDate, endDate)) {
      const cachedRatings = getCachedDataForRange(startDate, endDate)
      if (cachedRatings) {
        const newChartData = formatChartDataFromRatings(cachedRatings, startDate, endDate)
        setChartData(newChartData)
        return true // Successfully used cache
      }
    }

    // Not cached - create empty chart with correct x-axis range (all null values)
    // This ensures the x-axis adjusts to show the selected time period
    const emptyChartData = formatChartDataFromRatings([], startDate, endDate)
    setChartData(emptyChartData)
    return true // Chart updated with empty data to show correct time range
  }

  // Clear user data when switching modes
  const clearUserData = () => {
    setChartData(null)
    setStats(null)
    clearCache()
    setChartUsername('')
    setError(null)
    setIsFetching(false)
    setFetchParams(null)
  }

  // Switch to stored user mode
  const switchToStoredUser = async () => {
    clearUserData()

    // Apply stored user defaults
    const defaults = getStoredUserInitialState()
    setUserMode('stored')
    setTimeOption(defaults.timeOption)
    setCustomStartYear(defaults.customStartYear)
    setCustomStartMonth(defaults.customStartMonth)
    setCustomEndYear(defaults.customEndYear)
    setCustomEndMonth(defaults.customEndMonth)
    setGuestUsername(defaults.guestUsername)
    setSearchUsername(defaults.searchUsername)
    setUserVerified(defaults.userVerified)
    setUserJoinDate(defaults.userJoinDate)

    // Load snapshot immediately
    setLoading(true)
    await loadSnapshotOnMount()
  }

  // Switch to guest user mode
  const switchToGuestUser = () => {
    clearUserData()

    // Apply guest user defaults
    const defaults = getGuestUserInitialState()
    setUserMode('guest')
    setTimeOption(defaults.timeOption)
    setCustomStartYear(defaults.customStartYear)
    setCustomStartMonth(defaults.customStartMonth)
    setCustomEndYear(defaults.customEndYear)
    setCustomEndMonth(defaults.customEndMonth)
    setStats(null)
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
        setUserJoinDate(null)
        return
      }

      setGuestUsername(searchUsername.trim())
      setUserMode('guest')
      setUserVerified(true)

      // Set the user's join date from the verification response
      if (result.joinedTimestamp) {
        const joinDate = new Date(result.joinedTimestamp * 1000) // Convert Unix timestamp (seconds) to milliseconds
        setUserJoinDate(joinDate)
        console.log('User joined Chess.com on:', joinDate.toLocaleDateString())
      } else {
        setUserJoinDate(null)
      }

      // Fetch current stats for guest user using guest-current endpoint
      try {
        const statsData = await getGuestStats(searchUsername.trim())
        setStats(statsData)
      } catch (err: any) {
        console.error('Could not fetch guest stats:', err)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify user')
      setUserVerified(false)
      setUserJoinDate(null)
    } finally {
      setVerifying(false)
    }
  }

  // Refresh current stats (same logic for both user types)
  const handleRefreshStats = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const username = userMode === 'stored' ? DEFAULT_USERNAME : guestUsername

      // Use guest-current endpoint for both user types
      const statsData = await getGuestStats(username)
      setStats(statsData)

      // If successful and stored user, mark server as online
      if (userMode === 'stored') {
        setServerOnline(true)
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

  // Load historical data from database (stored users only)
  const handleLoadFromDatabase = async () => {
    // Check server health before fetching
    const isOnline = await checkServerHealth(5000)
    setServerOnline(isOnline)

    const username = DEFAULT_USERNAME
    const { startDate, endDate } = calculateDateRange(
      timeOption,
      { year: customStartYear, month: customStartMonth },
      { year: customEndYear, month: customEndMonth }
    )

    if (!isOnline) {
      // Try to use cache if available
      if (isCached(startDate, endDate)) {
        const success = refreshChartFromCache(timeOption)
        if (success) {
          setError('Server is offline. Please wait and try again.')
          return
        }
      }
      // No cache available
      setError('Server is offline. Please wait and try again.')
      return
    }

    // Server online - trigger hybrid fetch
    setIsFetching(true)
    setFetchParams({ username, startDate, endDate, dataSource: 'database' })
  }

  // Update database from Chess.com API (stored users only)
  const handleUpdateFromApi = async () => {
    // Check server health before fetching
    const isOnline = await checkServerHealth(5000)
    setServerOnline(isOnline)

    if (!isOnline) {
      setError('Server is offline. Please wait and try again.')
      return
    }

    const username = DEFAULT_USERNAME
    const { startDate, endDate } = calculateDateRange(
      timeOption,
      { year: customStartYear, month: customStartMonth },
      { year: customEndYear, month: customEndMonth }
    )

    // Trigger fetch from Chess.com API and update database
    setIsFetching(true)
    setFetchParams({ username, startDate, endDate, dataSource: 'update' })
  }

  // Trigger historical data fetch for guest users
  const handleRefresh = async () => {
    // Check server health before fetching
    if (userMode === 'stored') {
      const isOnline = await checkServerHealth(5000)
      setServerOnline(isOnline)

      if (!isOnline) {
        setError('Server is offline. Please wait and try again.')
        return
      }
    }

    const username = userMode === 'stored' ? DEFAULT_USERNAME : guestUsername
    const { startDate, endDate } = calculateDateRange(
      timeOption,
      { year: customStartYear, month: customStartMonth },
      { year: customEndYear, month: customEndMonth }
    )

    // Check cache first
    if (isCached(startDate, endDate)) {
      const success = refreshChartFromCache(timeOption)
      if (success) {
        console.log('Using cached data for this range')
        return
      }
    }

    // Not cached, trigger fetch (guest mode)
    setIsFetching(true)
    setFetchParams({ username, startDate, endDate, dataSource: 'guest' })
  }

  // Initial load
  useEffect(() => {
    if (userMode === 'stored') {
      loadSnapshotOnMount()
    } else {
      setLoading(false)
    }
  }, [])

  // Re-render chart when time period changes (use cache if available)
  useEffect(() => {
    if (!chartData) return // No chart yet

    // Try to refresh from cache
    refreshChartFromCache(timeOption)

    // If not in cache, user needs to click "Retrieve Historical Data"
  }, [timeOption, customStartYear, customStartMonth, customEndYear, customEndMonth])

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
              onClick={switchToStoredUser}
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
              onClick={switchToGuestUser}
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
                onKeyDown={(e) => e.key === 'Enter' && handleGuestSearch()}
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

        {/* Server Health Status */}
        {userMode === 'stored' && (
          <div className="mt-4">
            <ServerHealthIndicator
              serverOnline={serverOnline}
              usingSnapshot={usingSnapshot}
              userMode={userMode}
              lastUpdated={stats?.lastUpdated}
            />
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

            {/* Stored user: Two buttons for database operations */}
            {userMode === 'stored' ? (
              <>
                <button
                  onClick={handleLoadFromDatabase}
                  disabled={isFetching}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 flex items-center space-x-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching && fetchParams?.dataSource === 'database' ? 'animate-spin' : ''}`} />
                  <span>{isFetching && fetchParams?.dataSource === 'database' ? 'Loading...' : 'Load Rating from Database'}</span>
                </button>
                <button
                  onClick={handleUpdateFromApi}
                  disabled={isFetching}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 flex items-center space-x-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching && fetchParams?.dataSource === 'update' ? 'animate-spin' : ''}`} />
                  <span>{isFetching && fetchParams?.dataSource === 'update' ? 'Updating...' : 'Update Rating from Chess.com'}</span>
                </button>
              </>
            ) : (
              /* Guest user: Single button for API fetch */
              <button
                onClick={handleRefresh}
                disabled={isFetching || !userVerified}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                <span>{isFetching ? 'Updating...' : 'Update Rating from Chess.com'}</span>
              </button>
            )}
          </div>
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
                      disabled={refreshing || isFetching}
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
                      disabled={refreshing || isFetching}
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
                      disabled={refreshing || isFetching}
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
                      disabled={refreshing || isFetching}
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

      {/* Historical Data Fetcher Component */}
      <HistoricalDataFetcher
        username={fetchParams?.username || null}
        startDate={fetchParams?.startDate || null}
        endDate={fetchParams?.endDate || null}
        isActive={isFetching}
        dataSource={fetchParams?.dataSource || 'guest'}
        useHybridFetch={userMode === 'stored'}
        cacheHook={cacheHook}
        onDataFetched={(data) => {
          const { startDate, endDate } = fetchParams!
          const newChartData = formatChartDataFromRatings(data, startDate, endDate)
          setChartData(newChartData)
          setChartUsername(fetchParams!.username)
          setIsFetching(false)
          if (userMode === 'stored') {
            setUsingSnapshot(false)
          }
        }}
        onError={(err) => {
          setError(err)
          setIsFetching(false)
        }}
        onCancel={() => {
          setIsFetching(false)
          setFetchParams(null)
        }}
      />

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
              onClick={() => handleRefreshStats()}
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
          <RatingChart data={chartData} />
        ) : (
          <div className="text-center py-12">
            <p className="text-purple-200">
              {userMode === 'guest' && guestUsername
                ? 'Select a time range above and click "Retrieve Historical Data" to fetch chess history.'
                : userMode === 'guest'
                ? 'Enter a Chess.com username above to get started.'
                : 'No historical data available yet. Click "Retrieve Historical Data" to fetch chess history.'}
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
