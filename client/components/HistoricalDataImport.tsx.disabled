'use client'

import { useState } from 'react'
import { Database, Calendar, PlayCircle, CheckCircle, AlertCircle } from 'lucide-react'
import { importHistoricalData } from '@/lib/api'

interface ImportResult {
  monthsProcessed: number
  gamesProcessed: number
  ratingsRecorded: number
  status: string
}

export default function HistoricalDataImport() {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [startYear, setStartYear] = useState(2020)
  const [startMonth, setStartMonth] = useState(1)
  const [endYear, setEndYear] = useState(currentYear)
  const [endMonth, setEndMonth] = useState(currentMonth)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const handleImport = async () => {
    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const importResult = await importHistoricalData(
        'shia_justdoit',
        startYear,
        startMonth,
        endYear,
        endMonth
      )
      setResult(importResult)
    } catch (err: any) {
      setError(err.message || 'Failed to import historical data')
    } finally {
      setImporting(false)
    }
  }

  const yearOptions = []
  for (let year = 2020; year <= currentYear; year++) {
    yearOptions.push(year)
  }

  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Database className="w-6 h-6 text-purple-400 mr-2" />
          Import Historical Data
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-purple-300 hover:text-purple-100 text-sm font-medium transition-colors"
        >
          {showForm ? 'Hide' : 'Show'}
        </button>
      </div>

      {showForm && (
        <>
          <p className="text-purple-200 mb-6">
            Import your complete game history from Chess.com to populate historical rating data for detailed analysis.
          </p>

          <div className="space-y-6">
            {/* Date Range Selection */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Start Date */}
              <div className="space-y-3">
                <label className="flex items-center text-purple-200 font-medium">
                  <Calendar className="w-4 h-4 mr-2" />
                  Start Date
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-purple-300 text-sm mb-1 block">Year</label>
                    <select
                      value={startYear}
                      onChange={(e) => setStartYear(Number(e.target.value))}
                      disabled={importing}
                      className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-300 text-sm mb-1 block">Month</label>
                    <select
                      value={startMonth}
                      onChange={(e) => setStartMonth(Number(e.target.value))}
                      disabled={importing}
                      className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    >
                      {monthOptions.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* End Date */}
              <div className="space-y-3">
                <label className="flex items-center text-purple-200 font-medium">
                  <Calendar className="w-4 h-4 mr-2" />
                  End Date
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-purple-300 text-sm mb-1 block">Year</label>
                    <select
                      value={endYear}
                      onChange={(e) => setEndYear(Number(e.target.value))}
                      disabled={importing}
                      className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    >
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-300 text-sm mb-1 block">Month</label>
                    <select
                      value={endMonth}
                      onChange={(e) => setEndMonth(Number(e.target.value))}
                      disabled={importing}
                      className="w-full bg-purple-800/50 text-white px-4 py-2 rounded-lg border border-purple-600/30 focus:border-purple-400 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    >
                      {monthOptions.map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Import Button */}
            <div className="flex justify-center">
              <button
                onClick={handleImport}
                disabled={importing}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 text-white px-8 py-3 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:scale-100 flex items-center space-x-2"
              >
                <PlayCircle className={`w-5 h-5 ${importing ? 'animate-pulse' : ''}`} />
                <span>{importing ? 'Importing...' : 'Start Import'}</span>
              </button>
            </div>

            {/* Progress/Status */}
            {importing && (
              <div className="bg-blue-500/20 border border-blue-400/50 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-6 h-6 border-3 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-blue-200 font-medium">Processing your game history...</p>
                </div>
                <p className="text-blue-300 text-sm">
                  This may take several minutes depending on the date range. Please do not close this page.
                </p>
              </div>
            )}

            {/* Success Result */}
            {result && !importing && (
              <div className="bg-green-500/20 border border-green-400/50 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <h3 className="text-green-200 font-bold text-lg">Import Complete!</h3>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-green-300 text-sm mb-1">Months Processed</p>
                    <p className="text-white font-bold text-2xl">{result.monthsProcessed}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-green-300 text-sm mb-1">Games Processed</p>
                    <p className="text-white font-bold text-2xl">{result.gamesProcessed}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-green-300 text-sm mb-1">Ratings Recorded</p>
                    <p className="text-white font-bold text-2xl">{result.ratingsRecorded}</p>
                  </div>
                </div>
                <p className="text-green-300 text-sm mt-4 text-center">
                  Refresh the page to see your updated rating history in the charts above.
                </p>
              </div>
            )}

            {/* Error */}
            {error && !importing && (
              <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <h3 className="text-red-200 font-bold">Import Failed</h3>
                </div>
                <p className="text-red-300">{error}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
