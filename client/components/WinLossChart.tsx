'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface WinLossChartProps {
  stats: {
    wins: number
    losses: number
    draws: number
  }
}

const COLORS = ['#22c55e', '#ef4444', '#3b82f6'] // Green, Red, Blue

export default function WinLossChart({ stats }: WinLossChartProps) {
  const data = [
    { name: 'Wins', value: stats.wins },
    { name: 'Losses', value: stats.losses },
    { name: 'Draws', value: stats.draws },
  ]

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null

    const total = stats.wins + stats.losses + stats.draws
    const percentage = ((payload[0].value / total) * 100).toFixed(1)

    return (
      <div className="bg-gray-900/95 backdrop-blur-lg border border-white/20 rounded-lg p-4 shadow-xl">
        <p className="text-white font-semibold">{payload[0].name}</p>
        <p className="text-sm text-purple-200">
          {payload[0].value} games ({percentage}%)
        </p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={100}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ color: 'white' }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  )
}
