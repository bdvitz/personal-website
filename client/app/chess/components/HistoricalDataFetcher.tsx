'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { getMonthHistory, ApiError } from '@/lib/api'
import { ChessDailyRating } from '@/types/chess'
import type { UseCachedChessDataReturn } from './hooks/useCachedChessData'

interface HistoricalDataFetcherProps {
  username: string | null
  startDate: Date | null
  endDate: Date | null
  isActive: boolean
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
        return await getMonthHistory(user, year, month)
      } catch (error: any) {
        lastError = error
        console.warn(`Attempt ${attempt}/${maxRetries} failed for ${year}-${month.toString().padStart(2, '0')}`)

        // Server unreachable: retrying every month would just stack timeouts
        if (error instanceof ApiError && error.offline) {
          throw error
        }

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

      // Hybrid fetch: keep cached months and only fetch from the last cached month onwards.
      // Only valid when the cache already covers the start of the requested range.
      let fetchStartDate = startDate
      const range = cacheHook.fetchedRange
      const lastCached = cacheHook.getLastCachedMonth()
      const cacheCoversStart = range !== null &&
        range.startYear * 12 + range.startMonth <= startDate.getFullYear() * 12 + startDate.getMonth() + 1

      if (useHybridFetch && lastCached && cacheCoversStart) {
        const lastCachedStart = new Date(lastCached.year, lastCached.month - 1, 1)
        if (lastCachedStart > fetchStartDate) {
          fetchStartDate = lastCachedStart
        }
        console.log(`Hybrid fetch: using cache up to ${lastCached.year}-${lastCached.month}, fetching from there onwards`)
      }

      // Create abort controller
      abortControllerRef.current = new AbortController()

      try {
        const months = generateMonthList(fetchStartDate, endDate)
        const fetchedRatings: ChessDailyRating[] = []
        const fetchedMonths: string[] = []
        let failedCount = 0

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
            fetchedRatings.push(...monthRatings)
            fetchedMonths.push(monthStr)
          } catch (error: any) {
            // Offline: stop now and leave the cache untouched
            if (error instanceof ApiError && error.offline) {
              throw error
            }
            console.error(`Failed to fetch ${monthStr}`)
            failedCount++
          }
        }

        setFetchProgress(null)

        if (fetchedMonths.length === 0) {
          onError('Could not load rating history. Please try again later.')
          return
        }

        // Replace only the months that loaded; failed months keep their cached data
        const mergedData = cacheHook.mergeAndStoreCachedData(fetchedRatings, fetchedMonths, startDate, endDate)
        const startStr = startDate.toISOString().split('T')[0]
        const endStr = endDate.toISOString().split('T')[0]
        onDataFetched(mergedData.filter(rating => rating.date >= startStr && rating.date <= endStr))

        if (failedCount > 0) {
          onError(`${failedCount} month(s) could not be loaded. Please try again later.`)
        }
      } catch (error: any) {
        setFetchProgress(null)
        onError(error instanceof ApiError ? error.message : 'Could not load rating history. Please try again later.')
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

  return (
    <div className="card bg-blue-900/30 border border-blue-500/50">
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <div className="flex-1">
          <h3 className="text-blue-200 font-semibold text-lg mb-1">
            Loading from database...
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
