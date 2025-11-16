'use client'

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

export default function RatingChart({ data, connectNulls = false }: RatingChartProps) {
  // Transform backend data to Recharts format
  const chartData = data.labels.map((label, index) => {
    const dataPoint: any = { date: label }
    data.datasets.forEach(dataset => {
      dataPoint[dataset.label] = dataset.data[index]
    })
    return dataPoint
  })

  // Calculate min and max values across all datasets
  const allValues = data.datasets.flatMap(dataset => dataset.data).filter(val => val != null)
  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)

  // Add 50 point padding above and below the actual data range
  const yAxisMin = Math.floor(minValue - 50)
  const yAxisMax = Math.ceil(maxValue + 50)

  // Determine date range and format accordingly
  const getDateFormat = () => {
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
  }

  const formatDate = getDateFormat()

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null

    return (
      <div className="bg-gray-900/95 backdrop-blur-lg border border-white/20 rounded-lg p-4 shadow-xl">
        <p className="text-white font-semibold mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis
          dataKey="date"
          stroke="rgba(255,255,255,0.5)"
          tick={{ fill: 'rgba(255,255,255,0.7)', angle: -45, textAnchor: 'end' }}
          height={80}
          tickFormatter={formatDate}
        />
        <YAxis
          stroke="rgba(255,255,255,0.5)"
          tick={{ fill: 'rgba(255,255,255,0.7)' }}
          domain={[yAxisMin, yAxisMax]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ color: 'white' }} iconType="line" />
        {data.datasets.map((dataset, index) => (
          <Line
            key={index}
            type="monotone"
            dataKey={dataset.label}
            stroke={dataset.borderColor}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            connectNulls={connectNulls}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
