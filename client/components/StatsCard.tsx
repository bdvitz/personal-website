import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  color: 'green' | 'blue' | 'red' | 'purple' | 'yellow'
}

const colorClasses = {
  green: 'from-green-500 to-green-600',
  blue: 'from-blue-500 to-blue-600',
  red: 'from-red-500 to-red-600',
  purple: 'from-purple-500 to-purple-600',
  yellow: 'from-yellow-500 to-yellow-600',
}

const iconColorClasses = {
  green: 'text-green-400',
  blue: 'text-blue-400',
  red: 'text-red-400',
  purple: 'text-purple-400',
  yellow: 'text-yellow-400',
}

export default function StatsCard({ title, value, icon: Icon, color }: StatsCardProps) {
  return (
    <div className="card card-hover">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-purple-200">{title}</h3>
        <Icon className={`w-8 h-8 ${iconColorClasses[color]}`} />
      </div>
      <div className={`text-4xl font-bold bg-gradient-to-r ${colorClasses[color]} bg-clip-text text-transparent`}>
        {value}
      </div>
    </div>
  )
}
