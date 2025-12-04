'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { fetchMonthHistory, getMonthHistory, refreshMonthHistory } from '@/lib/api'
import { ChessDailyRating } from '@/types/chess'
import type { UseCachedChessDataReturn } from './hooks/useCachedChessData'

interface HistoricalDataFetcherProps {
  username: string | null
  startDate: Date | null
  endDate: Date | null
  isActive: boolean
  dataSource?: 'database' | 'update' | 'guest' // 'database' = read from DB, 'update' = fetch from API & update DB, 'guest' = fetch from API only
  useHybridFetch?: boolean // If true, use cached data and only fetch from last cached month onwards
  cacheHook: UseCachedChessDataReturn
  onDataFetched: (data: ChessDailyRating[]) => void
  onError: (error: string) => void
  onCancel: () => void
}

export default function HistoricalDataFetcher({
  username,
  startDate,
  endDate,
  isActive,
  dataSource = 'guest',
  useHybridFetch = false,
  cacheHook,
  onDataFetched,
  onError,
  onCancel
}: HistoricalDataFetcherProps) {
  const [fetchProgress, setFetchProgress] = useState<{
    current: number
    total: number
    currentMonth: string
  } | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Generate list of months in a date range
  const generateMonthList = (start: Date, end: Date): { year: number; month: number }[] => {
    const months: { year: number; month: number }[] = []
    const current = new Date(start.getFullYear(), start.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

    while (current <= endMonth) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1
      })
      current.setMonth(current.getMonth() + 1)
    }

    return months
  }

  // Fetch a single month with retry logic
  const fetchMonthWithRetry = async (
    user: string,
    year: number,
    month: number,
    maxRetries: number = 3
  ): Promise<ChessDailyRating[]> => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let monthData: ChessDailyRating[]

        // Choose API function based on dataSource
        switch (dataSource) {
          case 'database':
            monthData = await getMonthHistory(user, year, month)
            break
          case 'update':
            monthData = await refreshMonthHistory(user, year, month)
            break
          case 'guest':
          default:
            monthData = await fetchMonthHistory(user, year, month)
            break
        }

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

  // Main fetch logic
  useEffect(() => {
    if (!isActive || !username || !startDate || !endDate) {
      setFetchProgress(null)
      return
    }

    const fetchData = async () => {
      // Guest users: use all-or-nothing cache
      if (!useHybridFetch) {
        // Check cache first
        if (cacheHook.isCached(startDate, endDate)) {
          const cachedRatings = cacheHook.getCachedDataForRange(startDate, endDate)
          if (cachedRatings) {
            console.log('Using cached data for range')
            onDataFetched(cachedRatings)
            setFetchProgress(null)
            return
          }
        }
      }

      // Stored users with hybrid fetch: determine what to fetch
      let fetchStartDate = startDate
      let fetchEndDate = endDate
      let overwriteFromYear: number | null = null
      let overwriteFromMonth: number | null = null
      let shouldMerge = false

      if (useHybridFetch) {
        const lastCached = cacheHook.getLastCachedMonth()

        if (lastCached) {
          // We have cached data - only fetch from last cached month onwards
          fetchStartDate = new Date(lastCached.year, lastCached.month - 1, 1)
          overwriteFromYear = lastCached.year
          overwriteFromMonth = lastCached.month
          shouldMerge = true
          console.log(`Hybrid fetch: Using cache up to ${lastCached.year}-${lastCached.month}, fetching from there onwards`)
        } else {
          // No cache - fetch everything
          console.log('No cache available, fetching full range')
        }
      }

      // Create abort controller
      abortControllerRef.current = new AbortController()

      try {
        const months = generateMonthList(fetchStartDate, fetchEndDate)
        const allRatings: ChessDailyRating[] = []

        for (let i = 0; i < months.length; i++) {
          // Check if cancelled
          if (abortControllerRef.current?.signal.aborted) {
            console.log('Fetch cancelled by user')
            setFetchProgress(null)
            return
          }

          const { year, month } = months[i]
          const monthStr = `${year}-${month.toString().padStart(2, '0')}`

          // Add delay between requests (except first)
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
            const monthRatings = await fetchMonthWithRetry(username, year, month)
            allRatings.push(...monthRatings)
          } catch (error: any) {
            console.error(`Failed to fetch ${monthStr}:`, error.message)
            // Continue with other months
          }
        }

        setFetchProgress(null)

        // Store in cache (merge if hybrid, replace if not)
        if (shouldMerge && overwriteFromYear !== null && overwriteFromMonth !== null) {
          // Hybrid: merge new data with existing cache
          cacheHook.mergeAndStoreCachedData(
            allRatings,
            startDate.getFullYear(),
            startDate.getMonth() + 1,
            endDate.getFullYear(),
            endDate.getMonth() + 1,
            overwriteFromYear,
            overwriteFromMonth
          )

          // Get the merged data to return
          const mergedData = cacheHook.getCachedDataForRange(startDate, endDate)
          if (mergedData) {
            onDataFetched(mergedData)
          } else {
            // Fallback: return just the fetched data
            onDataFetched(allRatings)
          }
        } else {
          // Normal: replace cache entirely
          cacheHook.storeCachedData(allRatings, startDate, endDate)
          onDataFetched(allRatings)
        }
      } catch (error: any) {
        setFetchProgress(null)
        onError(error.message || 'Failed to fetch chess history')
      } finally {
        abortControllerRef.current = null
      }
    }

    fetchData()
  }, [isActive, username, startDate, endDate])

  // Cancel fetch
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setFetchProgress(null)
      onCancel()
    }
  }

  if (!fetchProgress) {
    return null
  }

  // Determine loading message based on data source
  const getLoadingMessage = () => {
    switch (dataSource) {
      case 'database':
        return 'Loading from database...'
      case 'update':
        return 'Updating from Chess.com API...'
      case 'guest':
      default:
        return 'Loading chess history...'
    }
  }

  return (
    <div className="card bg-blue-900/30 border border-blue-500/50">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <div className="flex-1">
          <h3 className="text-blue-200 font-semibold text-lg mb-1">
            {getLoadingMessage()}
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
        <button
          onClick={handleCancel}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl flex items-center space-x-2"
        >
          <X className="w-4 h-4" />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  )
}
