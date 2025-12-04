import { useState } from 'react'
import { ChessDailyRating } from '@/types/chess'

export interface FetchedRange {
  startYear: number
  startMonth: number
  endYear: number
  endMonth: number
}

export interface UseCachedChessDataReturn {
  cachedData: ChessDailyRating[]
  fetchedRange: FetchedRange | null

  isCached: (startDate: Date, endDate: Date) => boolean
  getCachedDataForRange: (startDate: Date, endDate: Date) => ChessDailyRating[] | null
  storeCachedData: (data: ChessDailyRating[], startDate: Date, endDate: Date) => void
  clearCache: () => void
  getLastCachedMonth: () => { year: number, month: number } | null
  getCachedDataBeforeMonth: (year: number, month: number) => ChessDailyRating[]
  mergeAndStoreCachedData: (
    newData: ChessDailyRating[],
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
    overwriteFromYear: number,
    overwriteFromMonth: number
  ) => void
}

/**
 * Custom hook for managing cached chess rating data
 *
 * Features:
 * - List-based storage (data is already sorted by date)
 * - Range checking to avoid re-fetching
 * - Filtering cached data to requested date range
 * - Clear cache functionality
 */
export function useCachedChessData(): UseCachedChessDataReturn {
  const [cachedData, setCachedData] = useState<ChessDailyRating[]>([])
  const [fetchedRange, setFetchedRange] = useState<FetchedRange | null>(null)

  /**
   * Check if the requested date range is within the cached range
   */
  const isCached = (startDate: Date, endDate: Date): boolean => {
    if (!fetchedRange || cachedData.length === 0) {
      return false
    }

    const cachedStart = new Date(fetchedRange.startYear, fetchedRange.startMonth - 1, 1)
    const cachedEnd = new Date(fetchedRange.endYear, fetchedRange.endMonth, 0) // Last day of month

    return startDate >= cachedStart && endDate <= cachedEnd
  }

  /**
   * Get cached data filtered to the requested date range
   * Returns null if the range is not fully cached
   */
  const getCachedDataForRange = (startDate: Date, endDate: Date): ChessDailyRating[] | null => {
    if (!isCached(startDate, endDate)) {
      return null
    }

    // Filter cached data to the requested range
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    return cachedData.filter(rating => {
      return rating.date >= startDateStr && rating.date <= endDateStr
    })
  }

  /**
   * Store new data in the cache with range metadata
   * Data should be sorted by date
   */
  const storeCachedData = (data: ChessDailyRating[], startDate: Date, endDate: Date): void => {
    setCachedData(data)
    setFetchedRange({
      startYear: startDate.getFullYear(),
      startMonth: startDate.getMonth() + 1,
      endYear: endDate.getFullYear(),
      endMonth: endDate.getMonth() + 1
    })
  }

  /**
   * Clear all cached data and range metadata
   */
  const clearCache = (): void => {
    setCachedData([])
    setFetchedRange(null)
  }

  /**
   * Get the year and month of the last (most recent) data point in the cache
   * Returns null if cache is empty
   */
  const getLastCachedMonth = (): { year: number, month: number } | null => {
    if (cachedData.length === 0) {
      return null
    }

    // Get the last item (data is sorted by date)
    const lastRating = cachedData[cachedData.length - 1]
    const lastDate = new Date(lastRating.date)

    return {
      year: lastDate.getFullYear(),
      month: lastDate.getMonth() + 1 // Convert from 0-indexed to 1-indexed
    }
  }

  /**
   * Get all cached data before a specific month (exclusive)
   * Used to keep historical data when merging with fresh data
   */
  const getCachedDataBeforeMonth = (year: number, month: number): ChessDailyRating[] => {
    if (cachedData.length === 0) {
      return []
    }

    // Create cutoff date (first day of the specified month)
    const cutoffDate = new Date(year, month - 1, 1)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    return cachedData.filter(rating => rating.date < cutoffDateStr)
  }

  /**
   * Merge new data with existing cache, overwriting from a specific month onwards
   * This is used for hybrid caching where we keep old data and only fetch recent months
   *
   * @param newData - New data fetched from server
   * @param startYear - Start year of the full range
   * @param startMonth - Start month of the full range (1-indexed)
   * @param endYear - End year of the full range
   * @param endMonth - End month of the full range (1-indexed)
   * @param overwriteFromYear - Year to start overwriting from
   * @param overwriteFromMonth - Month to start overwriting from (1-indexed)
   */
  const mergeAndStoreCachedData = (
    newData: ChessDailyRating[],
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
    overwriteFromYear: number,
    overwriteFromMonth: number
  ): void => {
    // Get cached data before the overwrite point
    const oldData = getCachedDataBeforeMonth(overwriteFromYear, overwriteFromMonth)

    // Combine old data with new data
    const mergedData = [...oldData, ...newData]

    // Sort by date to ensure correct order
    mergedData.sort((a, b) => a.date.localeCompare(b.date))

    // Update cache with merged data and full range
    setCachedData(mergedData)
    setFetchedRange({
      startYear,
      startMonth,
      endYear,
      endMonth
    })
  }

  return {
    cachedData,
    fetchedRange,
    isCached,
    getCachedDataForRange,
    storeCachedData,
    clearCache,
    getLastCachedMonth,
    getCachedDataBeforeMonth,
    mergeAndStoreCachedData
  }
}
