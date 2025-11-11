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
}

export default function RatingChart({ data }: RatingChartProps) {
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
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.7)' }} />
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
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
