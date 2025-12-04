'use client'

import { memo, useMemo, useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface RatingChartProps {
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: (number | null)[]
      borderColor: string
      backgroundColor: string
    }>
  }
}

const RatingChart = memo(function RatingChart({ data }: RatingChartProps) {
  // Track screen size for responsive design
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  // Rating visibility toggles (internal state)
  const [showRapid, setShowRapid] = useState(true)
  const [showBlitz, setShowBlitz] = useState(true)
  const [showBullet, setShowBullet] = useState(true)
  const [connectNulls, setConnectNulls] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640)
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Filter datasets based on visibility toggles
  const filteredDatasets = useMemo(() => {
    return data.datasets.filter(dataset => {
      if (dataset.label === 'Rapid') return showRapid
      if (dataset.label === 'Blitz') return showBlitz
      if (dataset.label === 'Bullet') return showBullet
      return true
    })
  }, [data.datasets, showRapid, showBlitz, showBullet])

  // Transform backend data to Recharts format - memoized to prevent recalculation
  const chartData = useMemo(() => {
    return data.labels.map((label, index) => {
      const dataPoint: any = { date: label }
      filteredDatasets.forEach(dataset => {
        dataPoint[dataset.label] = dataset.data[index]
      })
      return dataPoint
    })
  }, [data.labels, filteredDatasets])

  // Calculate min and max values across filtered datasets - memoized
  const { yAxisMin, yAxisMax } = useMemo(() => {
    const allValues = filteredDatasets.flatMap(dataset => dataset.data).filter(val => val != null)
    if (allValues.length === 0) {
      return { yAxisMin: 0, yAxisMax: 100 }
    }
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)

    // Add padding above and below the actual data range
    return {
      yAxisMin: Math.floor(minValue),
      yAxisMax: Math.ceil(maxValue)
    }
  }, [filteredDatasets])

  // Determine date range and format accordingly - memoized
  const formatDate = useMemo(() => {
    if (data.labels.length === 0) return (value: string) => value

    const firstDate = new Date(data.labels[0])
    const lastDate = new Date(data.labels[data.labels.length - 1])
    const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
    const yearsDiff = daysDiff / 365

    // For ranges > 2 years, show month and year (e.g., "Jan '24")
    if (yearsDiff > 2) {
      return (value: string) => {
        const date = new Date(value)
        const month = date.toLocaleString('en-US', { month: 'short' })
        const year = date.getFullYear().toString().slice(-2)
        return `${month} '${year}`
      }
    }

    // For ranges > 90 days (but <= 2 years), show month and day (e.g., "Jan 15")
    if (daysDiff > 90) {
      return (value: string) => {
        const date = new Date(value)
        const month = date.toLocaleString('en-US', { month: 'short' })
        const day = date.getDate()
        return `${month} ${day}`
      }
    }

    // For shorter ranges (<= 90 days), show month, day, and year (e.g., "Jan 15 '24")
    return (value: string) => {
      const date = new Date(value)
      const month = date.toLocaleString('en-US', { month: 'short' })
      const day = date.getDate()
      const year = date.getFullYear().toString().slice(-2)
      return `${month} ${day} '${year}`
    }
  }, [data.labels])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null

    return (
      <div className={`bg-gray-900/95 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl ${
        isMobile ? 'p-2' : 'p-4'
      }`}>
        <p className={`text-white font-semibold mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className={isMobile ? 'text-xs' : 'text-sm'} style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    )
  }

  // Responsive configuration based on screen size
  const chartConfig = useMemo(() => {
    if (isMobile) {
      return {
        height: 300,
        margin: { top: 5, right: 5, left: 0, bottom: 40 },
        fontSize: 10,
        tickAngle: -45,
        xAxisHeight: 60,
        strokeWidth: 1.5,
        dotRadius: 2,
        activeDotRadius: 4,
        legendFontSize: 11
      }
    } else if (isTablet) {
      return {
        height: 350,
        margin: { top: 5, right: 15, left: 5, bottom: 50 },
        fontSize: 11,
        tickAngle: -45,
        xAxisHeight: 70,
        strokeWidth: 2,
        dotRadius: 2.5,
        activeDotRadius: 5,
        legendFontSize: 12
      }
    } else {
      // Desktop - original settings (no font size override, let Recharts use defaults)
      return {
        height: 400,
        margin: { top: 5, right: 30, left: 20, bottom: 60 },
        fontSize: undefined, // Use Recharts default (larger)
        tickAngle: -45,
        xAxisHeight: 80,
        strokeWidth: 2,
        dotRadius: 3,
        activeDotRadius: 6,
        legendFontSize: undefined // Use default (larger)
      }
    }
  }, [isMobile, isTablet])

  return (
    <div>
      {/* Rating Visibility Toggles */}
      <div className="flex flex-wrap items-center gap-6 bg-purple-900/30 rounded-lg p-4 mb-6">
        <span className="text-purple-200 font-medium">Graph Options:</span>
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
            checked={connectNulls}
            onChange={(e) => setConnectNulls(e.target.checked)}
            className="w-4 h-4 rounded border-purple-500 bg-purple-800/50 text-purple-500 focus:ring-purple-400 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-purple-200 font-medium">Connect gaps with lines</span>
        </label>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={chartConfig.height}>
        <LineChart data={chartData} margin={chartConfig.margin}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.5)"
            tick={{ fill: 'rgba(255,255,255,0.7)', ...(chartConfig.fontSize && { fontSize: chartConfig.fontSize }) } as any}
            angle={chartConfig.tickAngle}
            textAnchor="end"
            height={chartConfig.xAxisHeight}
            tickFormatter={formatDate}
            interval={isMobile ? 'preserveStartEnd' : 'preserveEnd'}
          />
          <YAxis
            stroke="rgba(255,255,255,0.5)"
            tick={{ fill: 'rgba(255,255,255,0.7)', ...(chartConfig.fontSize && { fontSize: chartConfig.fontSize }) }}
            domain={[yAxisMin, yAxisMax]}
            width={isMobile ? 40 : 60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: 'white', ...(chartConfig.legendFontSize && { fontSize: chartConfig.legendFontSize }) }}
            iconType="line"
            iconSize={isMobile ? 12 : 14}
          />
          {filteredDatasets.map((dataset, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={dataset.label}
              stroke={dataset.borderColor}
              strokeWidth={chartConfig.strokeWidth}
              dot={{ r: chartConfig.dotRadius }}
              activeDot={{ r: chartConfig.activeDotRadius }}
              connectNulls={connectNulls}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})

export default RatingChart
