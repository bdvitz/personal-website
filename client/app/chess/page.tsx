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
import { getChessStats, checkServerHealth, ApiError, SERVER_OFFLINE_MESSAGE } from '@/lib/api'
import { ChessStats, ChessDailyRating } from '@/types/chess'

// All data comes from the snapshot file or the database (refreshed nightly by the server).
// The former guest "Search User" mode is documented in docs/removed-chess-guest-lookup.md.
export default function ChessPage() {
  const DEFAULT_USERNAME = 'shia_justdoit'
  const JOIN_DATE = '2020-06-09'
  const FIRST_YEAR = 2020

  const cacheHook = useCachedChessData()
  const { isCached, getCachedDataForRange, storeCachedData } = cacheHook

  const [stats, setStats] = useState<ChessStats | null>(null)
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeOption, setTimeOption] = useState('all') // '7', '30', '90', '365', 'all', 'custom'

  // Custom range state
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const [customStartYear, setCustomStartYear] = useState(FIRST_YEAR)
  const [customStartMonth, setCustomStartMonth] = useState(6)
  const [customEndYear, setCustomEndYear] = useState(currentYear)
  const [customEndMonth, setCustomEndMonth] = useState(currentMonth)

  // Fetching state for HistoricalDataFetcher component
  const [isFetching, setIsFetching] = useState(false)
  const [checkingServer, setCheckingServer] = useState(false) // health check before a history load
  const [fetchParams, setFetchParams] = useState<{
    username: string
    startDate: Date
    endDate: Date
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
      startDate = new Date(JOIN_DATE)
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

  // Load snapshot data on mount, then replace stats with the database copy if the server is up
  const loadSnapshotOnMount = async () => {
    try {
      const snapshot = await loadSnapshotData(timeOption)
      if (snapshot) {
        setStats(snapshot.stats)
        setChartData(snapshot.chartData)
        setUsingSnapshot(true)

        // Populate cache with snapshot data
        const { startDate, endDate } = calculateDateRange(timeOption)
        storeCachedData(snapshot.historicalData, startDate, endDate)

        console.log('Loaded snapshot data from', new Date(snapshot.generatedAt).toLocaleString())
      }
    } catch (err) {
      console.error('Snapshot load failed:', err)
    }

    const isOnline = await checkServerHealth(5000)
    setServerOnline(isOnline)

    if (isOnline) {
      try {
        const statsData = await getChessStats(DEFAULT_USERNAME)
        setStats(statsData)
        setUsingSnapshot(false)
      } catch (err: any) {
        console.error('Failed to fetch stored stats:', err)
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

  // Re-read current stats from the database
  const handleRefreshStats = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const statsData = await getChessStats(DEFAULT_USERNAME)
      setStats(statsData)
      setServerOnline(true)
      setUsingSnapshot(false)
    } catch (err: any) {
      const offline = !(err instanceof ApiError) || err.offline
      setError(offline ? SERVER_OFFLINE_MESSAGE : err.message)
      if (offline) setServerOnline(false)
    } finally {
      setRefreshing(false)
    }
  }

  // Load historical data from database
  const handleLoadFromDatabase = async () => {
    setCheckingServer(true)
    setError(null)
    try {
      // Reading the stats doubles as the server check, so offline is reported the same way as Refresh Stats
      const statsData = await getChessStats(DEFAULT_USERNAME)
      setStats(statsData)
      setServerOnline(true)
      setUsingSnapshot(false)
    } catch (err: any) {
      if (!(err instanceof ApiError) || err.offline) {
        // Leave the chart alone: it already shows the cached data, and re-rendering it is expensive
        setError(SERVER_OFFLINE_MESSAGE)
        setServerOnline(false)
        return
      }
      // Server is up but stats could not be read; still try the history
    } finally {
      setCheckingServer(false)
    }

    const { startDate, endDate } = calculateDateRange(
      timeOption,
      { year: customStartYear, month: customStartMonth },
      { year: customEndYear, month: customEndMonth }
    )
    setIsFetching(true)
    setFetchParams({ username: DEFAULT_USERNAME, startDate, endDate })
  }

  // Initial load
  useEffect(() => {
    loadSnapshotOnMount()
  }, [])

  // Re-render chart when time period changes (use cache if available)
  useEffect(() => {
    if (!chartData) return // No chart yet

    // Try to refresh from cache
    refreshChartFromCache(timeOption)

    // If not in cache, user needs to click "Load Rating from Database"
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
          Track my Chess.com progress and ratings over time
        </p>
      </div>

      {/* User Mode Toggle (Search User is disabled) */}
      <div className="card bg-purple-900/40">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex gap-2">
            <button
              className="px-6 py-2 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg"
            >
              <User className="w-4 h-4 inline mr-2" />
              My Stats
            </button>
            <button
              disabled
              title="User search is currently unavailable"
              className="px-6 py-2 rounded-lg font-semibold bg-gray-600/40 text-gray-400 cursor-not-allowed"
            >
              <Search className="w-4 h-4 inline mr-2" />
              Search User
            </button>
          </div>
        </div>

        {/* Server Health Status */}
        <div className="mt-4">
          <ServerHealthIndicator
            serverOnline={serverOnline}
            usingSnapshot={usingSnapshot}
            lastUpdated={stats?.lastUpdated}
          />
        </div>
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
              disabled={refreshing}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Stats</span>
            </button>
            <button
              onClick={handleLoadFromDatabase}
              disabled={isFetching || checkingServer}
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching || checkingServer ? 'animate-spin' : ''}`} />
              <span>{isFetching || checkingServer ? 'Loading...' : 'Load Rating from Database'}</span>
            </button>
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
                      {Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i).map((year) => (
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
                      {Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i).map((year) => (
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
        useHybridFetch
        cacheHook={cacheHook}
        onDataFetched={(data) => {
          const { startDate, endDate } = fetchParams!
          const newChartData = formatChartDataFromRatings(data, startDate, endDate)
          setChartData(newChartData)
          setIsFetching(false)
          setUsingSnapshot(false)
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

      {/* Error messages */}
      {error && !stats && (
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
      {error && stats && (
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
      {stats && (
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
          Rating Progression for Bryan Vitz
        </h2>
        {chartData && chartData.labels.length > 0 ? (
          <RatingChart data={chartData} />
        ) : (
          <div className="text-center py-12">
            <p className="text-purple-200">
              No historical data loaded yet. Click "Load Rating from Database" to load chess history.
            </p>
          </div>
        )}
      </div>

      {/* Game Statistics */}
      {stats && (
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
