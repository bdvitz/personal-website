import { ChessDailyRating, ChartData, SnapshotData } from '@/types/chess'

/**
 * Build a data map from snapshot historical data
 */
export function buildDataMapFromSnapshot(historicalData: any[]): Map<string, any> {
  const dataMap = new Map<string, any>()
  historicalData.forEach((rating: any) => {
    dataMap.set(rating.date, {
      rapid: rating.rapidRating,
      blitz: rating.blitzRating,
      bullet: rating.bulletRating
    })
  })
  return dataMap
}

/**
 * Calculate date range from snapshot data
 */
export function calculateSnapshotDateRange(historicalData: any[]) {
  const dates = historicalData.map((r: any) => new Date(r.date))
  const minDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())))

  return {
    startYear: minDate.getFullYear(),
    startMonth: minDate.getMonth() + 1,
    endYear: maxDate.getFullYear(),
    endMonth: maxDate.getMonth() + 1
  }
}

/**
 * Build chart data from a data map (used for both snapshot and cached data)
 */
export function buildChartDataFromMap(
  dataMap: Map<string, any>,
  startDate: Date,
  endDate: Date
): ChartData {
  const labels: string[] = []
  const rapidRatings: (number | null)[] = []
  const blitzRatings: (number | null)[] = []
  const bulletRatings: (number | null)[] = []

  let currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0]
    labels.push(dateKey)

    const dayData = dataMap.get(dateKey)
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

/**
 * Build cached data structure from snapshot
 */
export function buildCachedDataFromSnapshot(
  username: string,
  snapshot: SnapshotData
) {
  const dataMap = buildDataMapFromSnapshot(snapshot.historicalData)
  const dateRange = calculateSnapshotDateRange(snapshot.historicalData)

  return {
    username,
    fullData: dataMap,
    fetchedRange: dateRange
  }
}

/**
 * Load snapshot data and prepare chart
 */
export async function loadSnapshotAndPrepareChart(
  loadStoredUserSnapshot: () => Promise<SnapshotData>,
  username: string,
  timeOption: string,
  calculateDateRange: (option: string) => { startDate: Date; endDate: Date }
) {
  const snapshot = await loadStoredUserSnapshot()
  if (!snapshot || !snapshot.currentStats || !snapshot.historicalData?.length) {
    return null
  }

  const dataMap = buildDataMapFromSnapshot(snapshot.historicalData)
  const dateRange = calculateSnapshotDateRange(snapshot.historicalData)
  const { startDate, endDate } = calculateDateRange(timeOption)
  const chartData = buildChartDataFromMap(dataMap, startDate, endDate)

  return {
    stats: snapshot.currentStats,
    cachedData: {
      username,
      fullData: dataMap,
      fetchedRange: dateRange
    },
    chartData,
    generatedAt: snapshot.generatedAt
  }
}
