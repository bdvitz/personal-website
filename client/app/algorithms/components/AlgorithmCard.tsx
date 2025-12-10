import Link from 'next/link'
import { Calendar, Tag } from 'lucide-react'

interface AlgorithmCardProps {
  slug: string
  title: string
  difficulty: string
  tags: string[]
  date: string
  excerpt: string
  category: string
}

export default function AlgorithmCard({
  slug,
  title,
  difficulty,
  tags,
  date,
  excerpt,
  category
}: AlgorithmCardProps) {
  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'easy':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'hard':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    }
  }

  const getCategoryLabel = (cat: string) => {
    const labels: { [key: string]: string } = {
      'leetcode': 'LeetCode',
      'project-euler': 'Project Euler',
      'puzzles': 'Puzzles',
      'math': 'Math'
    }
    return labels[cat] || cat
  }

  return (
    <Link href={`/algorithms/${slug}`}>
      <div className="card card-hover group cursor-pointer h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${getDifficultyColor(difficulty)}`}>
            {difficulty}
          </span>
          <span className="text-xs text-purple-300 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20">
            {getCategoryLabel(category)}
          </span>
        </div>

        <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-green-400 transition-colors duration-200">
          {title}
        </h3>

        <p className="text-purple-200 leading-relaxed mb-4 flex-grow">
          {excerpt}
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-purple-300">
            <Calendar className="w-4 h-4" />
            <span>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>

          {tags.length > 0 && (
            <div className="flex items-start gap-2">
              <Tag className="w-4 h-4 text-purple-300 mt-1 flex-shrink-0" />
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded border border-purple-500/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="inline-flex items-center text-green-400 font-semibold group-hover:translate-x-2 transition-transform duration-200 pt-2">
            Read More →
          </div>
        </div>
      </div>
    </Link>
  )
}
