'use client'

import { memo, useMemo, useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface RatingChartProps {
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      borderColor: string
      backgroundColor: string
    }>
  }
  connectNulls?: boolean
}

const RatingChart = memo(function RatingChart({ data, connectNulls = false }: RatingChartProps) {
  // Track screen size for responsive design
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640)
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Transform backend data to Recharts format - memoized to prevent recalculation
  const chartData = useMemo(() => {
    return data.labels.map((label, index) => {
      const dataPoint: any = { date: label }
      data.datasets.forEach(dataset => {
        dataPoint[dataset.label] = dataset.data[index]
      })
      return dataPoint
    })
  }, [data.labels, data.datasets])

  // Calculate min and max values across all datasets - memoized
  const { yAxisMin, yAxisMax } = useMemo(() => {
    const allValues = data.datasets.flatMap(dataset => dataset.data).filter(val => val != null)
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)

    // Add 50 point padding above and below the actual data range
    return {
      yAxisMin: Math.floor(minValue),
      yAxisMax: Math.ceil(maxValue)
    }
  }, [data.datasets])

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
        {data.datasets.map((dataset, index) => (
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
  )
})

export default RatingChart
