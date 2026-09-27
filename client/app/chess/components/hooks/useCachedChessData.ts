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
  mergeAndStoreCachedData: (
    newData: ChessDailyRating[],
    fetchedMonths: string[],
    startDate: Date,
    endDate: Date
  ) => ChessDailyRating[]
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

    // Dates are 'YYYY-MM-DD' strings; parse directly to avoid timezone shifts
    const [year, month] = cachedData[cachedData.length - 1].date.split('-').map(Number)
    return { year, month }
  }

  /**
   * Merge freshly fetched months into the cache and return the merged list.
   * Only months in fetchedMonths ('YYYY-MM') are replaced, so a month that failed
   * to load keeps its cached data. The cached range grows to cover startDate..endDate.
   * Returns the merged data directly because the state update is not visible until the next render.
   */
  const mergeAndStoreCachedData = (
    newData: ChessDailyRating[],
    fetchedMonths: string[],
    startDate: Date,
    endDate: Date
  ): ChessDailyRating[] => {
    const replaced = new Set(fetchedMonths)
    const mergedData = [
      ...cachedData.filter(rating => !replaced.has(rating.date.slice(0, 7))),
      ...newData
    ].sort((a, b) => a.date.localeCompare(b.date))

    const requestedStart = startDate.getFullYear() * 12 + startDate.getMonth()
    const requestedEnd = endDate.getFullYear() * 12 + endDate.getMonth()
    const cachedStart = fetchedRange ? fetchedRange.startYear * 12 + fetchedRange.startMonth - 1 : requestedStart
    const cachedEnd = fetchedRange ? fetchedRange.endYear * 12 + fetchedRange.endMonth - 1 : requestedEnd
    const rangeStart = Math.min(requestedStart, cachedStart)
    const rangeEnd = Math.max(requestedEnd, cachedEnd)

    setCachedData(mergedData)
    setFetchedRange({
      startYear: Math.floor(rangeStart / 12),
      startMonth: (rangeStart % 12) + 1,
      endYear: Math.floor(rangeEnd / 12),
      endMonth: (rangeEnd % 12) + 1
    })

    return mergedData
  }

  return {
    cachedData,
    fetchedRange,
    isCached,
    getCachedDataForRange,
    storeCachedData,
    clearCache,
    getLastCachedMonth,
    mergeAndStoreCachedData
  }
}
