'use client'

import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, RefreshCw, Target, Zap, Clock } from 'lucide-react'
import RatingChart from '@/components/RatingChart'
import StatsCard from '@/components/StatsCard'
import WinLossChart from '@/components/WinLossChart'
import HistoricalDataImport from '@/components/HistoricalDataImport'
import { getChessStats, refreshChessStats, getRatingsOverTime, getRatingsByDateRange } from '@/lib/api'

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
  const [stats, setStats] = useState<ChessStats | null>(null)
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeOption, setTimeOption] = useState('30') // '7', '30', '90', '365', 'all', 'custom'
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Rating visibility toggles
  const [showRapid, setShowRapid] = useState(true)
  const [showBlitz, setShowBlitz] = useState(true)
  const [showBullet, setShowBullet] = useState(true)
  const [showPuzzle, setShowPuzzle] = useState(true)

  // Fetch both current stats and historical chart data
  const fetchData = async () => {
    try {
      setError(null)

      let ratingsData

      // Fetch stats data
      const statsData = await getChessStats('shia_justdoit')

      // Fetch ratings based on selected time option
      if (timeOption === 'custom') {
        if (customStartDate && customEndDate) {
          ratingsData = await getRatingsByDateRange('shia_justdoit', customStartDate, customEndDate)
        } else {
          setError('Please select both start and end dates for custom range')
          ratingsData = await getRatingsOverTime('shia_justdoit', 30)
        }
      } else if (timeOption === 'all') {
        ratingsData = await getRatingsOverTime('shia_justdoit', 10000) // Large number for "all time"
      } else {
        ratingsData = await getRatingsOverTime('shia_justdoit', Number(timeOption))
      }

      // Filter datasets based on visibility toggles
      if (ratingsData && ratingsData.datasets) {
        ratingsData.datasets = ratingsData.datasets.filter((dataset: any) => {
          if (dataset.label === 'Rapid') return showRapid
          if (dataset.label === 'Blitz') return showBlitz
          if (dataset.label === 'Bullet') return showBullet
          if (dataset.label === 'Puzzle') return showPuzzle
          return true
        })
      }

      setStats(statsData)
      setChartData(ratingsData)
    } catch (err: any) {
      setError(err.message || 'Failed to load chess statistics')
      console.error('Error fetching chess data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Force refresh from Chess.com API
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshChessStats('shia_justdoit')
      await fetchData()
    } catch (err: any) {
      setError('Failed to refresh stats. Please try again.')
    } finally {
      setRefreshing(false)
    }
  }

  // Re-fetch data when time period or visibility toggles change
  useEffect(() => {
    fetchData()
  }, [timeOption, customStartDate, customEndDate, showRapid, showBlitz, showBullet, showPuzzle])

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
            onClick={fetchData}
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
          Track my Chess.com progress and ratings over time
        </p>
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
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-6 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>

        {/* Rating Type Toggles */}
        <div className="flex flex-wrap items-center gap-6 bg-purple-900/30 rounded-lg p-4">
          <span className="text-purple-200 font-medium">Show Ratings:</span>
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
              checked={showPuzzle}
              onChange={(e) => setShowPuzzle(e.target.checked)}
              className="w-4 h-4 rounded border-purple-500 bg-purple-800/50 text-purple-500 focus:ring-purple-400 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-purple-400 font-medium">Puzzle</span>
          </label>
        </div>

        {/* Custom Date Range Picker */}
        {timeOption === 'custom' && (
          <div className="card bg-purple-900/30">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-purple-200 font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-purple-200 font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Historical Data Import */}
      <HistoricalDataImport />

      {/* Current Ratings */}
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
          title="Puzzle"
          value={stats?.puzzleRating || 'N/A'}
          icon={Trophy}
          color="purple"
        />
      </div>

      {/* Rating Chart */}
      <div className="card">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          <TrendingUp className="w-6 h-6 text-purple-400 mr-2" />
          Rating Progression
        </h2>
        {chartData && chartData.labels.length > 0 ? (
          <RatingChart data={chartData} />
        ) : (
          <div className="text-center py-12">
            <p className="text-purple-200">No historical data available yet. Data will appear after the first scheduled update.</p>
          </div>
        )}
      </div>

      {/* Game Statistics */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Win/Loss/Draw */}
        <div className="card">
          <h2 className="text-2xl font-bold text-white mb-6">Game Results</h2>
          {stats && <WinLossChart stats={stats} />}
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
    </div>
  )
}
