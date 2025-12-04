export interface ChessStats {
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

export interface ChessDailyRating {
  id?: number
  username: string
  date: string
  rapidRating: number | null
  blitzRating: number | null
  bulletRating: number | null
}

export interface ChartDataset {
  label: string
  data: (number | null)[]
  borderColor: string
  backgroundColor: string
}

export interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}

export interface SnapshotData {
  username: string
  generatedAt: number
  currentStats: ChessStats
  historicalData: ChessDailyRating[]
}

export interface CachedData {
  username: string
  fullData: Map<string, {
    rapid: number | null
    blitz: number | null
    bullet: number | null
  }>
  fetchedRange: {
    startYear: number
    startMonth: number
    endYear: number
    endMonth: number
  } | null
}

export interface UserVerificationResponse {
  exists: boolean
  username?: string
  joinedTimestamp?: number
  message?: string
}
