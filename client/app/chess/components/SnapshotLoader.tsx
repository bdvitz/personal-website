/**
 * SnapshotLoader Component and Utility Functions
 *
 * This module provides snapshot loading functionality for instant initial load
 * of chess data for the stored user.
 *
 * EXPORTED FUNCTIONS:
 * - loadSnapshotData(): Load and process snapshot for direct use in page.tsx
 * - Snapshot component (not currently used, but available as reference)
 */

'use client'

import { loadStoredUserSnapshot } from '@/lib/api'
import { buildCachedDataFromSnapshot, buildChartDataFromMap } from '@/lib/chessUtils'
import { ChessStats, ChessDailyRating, ChartData } from '@/types/chess'

const DEFAULT_USERNAME = 'shia_justdoit'

export interface SnapshotResult {
  stats: ChessStats
  historicalData: ChessDailyRating[]
  chartData: ChartData
  generatedAt: number
}

/**
 * Calculates date range based on time option
 */
function calculateDateRange(
  timeOption: string,
  customStart?: { year: number; month: number },
  customEnd?: { year: number; month: number }
): { startDate: Date; endDate: Date } {
  let endDate = new Date()
  let startDate = new Date()

  if (timeOption === 'custom' && customStart && customEnd) {
    startDate = new Date(customStart.year, customStart.month - 1, 1)
    endDate = new Date(customEnd.year, customEnd.month, 0) // Last day of month
  } else if (timeOption === 'all') {
    // For stored user, use June 9, 2020 as the start date
    startDate = new Date('2020-06-09')
  } else {
    const days = Number(timeOption)
    startDate.setDate(startDate.getDate() - days)
  }

  return { startDate, endDate }
}

/**
 * Load and process snapshot data from static JSON file
 * Returns processed data ready for display
 *
 * USAGE IN PAGE.TSX:
 * ```tsx
 * import { loadSnapshotData } from './components/SnapshotLoader'
 *
 * const snapshot = await loadSnapshotData('all')
 * if (snapshot) {
 *   setStats(snapshot.stats)
 *   setChartData(snapshot.chartData)
 *   storeCachedData(snapshot.historicalData, startDate, endDate)
 * }
 * ```
 */
export async function loadSnapshotData(timeOption: string): Promise<SnapshotResult | null> {
  try {
    const snapshot = await loadStoredUserSnapshot()
    if (!snapshot?.currentStats || !snapshot.historicalData?.length) {
      return null
    }

    const cachedData = buildCachedDataFromSnapshot(DEFAULT_USERNAME, snapshot)
    const { startDate, endDate } = calculateDateRange(timeOption)
    const chartData = buildChartDataFromMap(cachedData.fullData, startDate, endDate)

    return {
      stats: snapshot.currentStats,
      historicalData: snapshot.historicalData,
      chartData,
      generatedAt: snapshot.generatedAt
    }
  } catch (error) {
    console.error('Failed to load snapshot:', error)
    return null
  }
}

/**
 * Example of how to switch back to stored user mode with snapshot
 * (Reference function - not currently used)
 */
export async function switchToStoredUserWithSnapshot(
  timeOption: string,
  filterDatasets: (datasets: any[]) => any[]
): Promise<{
  stats: ChessStats | null
  chartData: ChartData | null
  historicalData: ChessDailyRating[]
  usingSnapshot: boolean
}> {
  try {
    const snapshotData = await loadSnapshotData(timeOption)
    if (snapshotData) {
      const filteredChartData = {
        ...snapshotData.chartData,
        datasets: filterDatasets(snapshotData.chartData.datasets)
      }

      return {
        stats: snapshotData.stats,
        chartData: filteredChartData,
        historicalData: snapshotData.historicalData,
        usingSnapshot: true
      }
    }
  } catch (err) {
    console.error('Failed to load snapshot:', err)
  }

  return {
    stats: null,
    chartData: null,
    historicalData: [],
    usingSnapshot: false
  }
}

// Default export (reference component - not currently used)
const SnapshotLoader = {
  loadSnapshotData,
  switchToStoredUserWithSnapshot,
  calculateDateRange,
  DEFAULT_USERNAME
}

export default SnapshotLoader
