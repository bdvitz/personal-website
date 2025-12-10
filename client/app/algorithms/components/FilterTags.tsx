'use client'

interface FilterTagsProps {
  selectedCategory: string
  onCategoryChange: (category: string) => void
}

export default function FilterTags({ selectedCategory, onCategoryChange }: FilterTagsProps) {
  const categories = [
    { value: 'all', label: 'All' },
    { value: 'leetcode', label: 'LeetCode' },
    { value: 'project-euler', label: 'Project Euler' },
    { value: 'puzzles', label: 'Puzzles' },
    { value: 'math', label: 'Math' }
  ]

  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {categories.map((category) => (
        <button
          key={category.value}
          onClick={() => onCategoryChange(category.value)}
          className={`
            px-6 py-2.5 rounded-xl font-semibold transition-all duration-300
            ${selectedCategory === category.value
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg scale-105'
              : 'bg-white/5 text-purple-200 border border-white/10 hover:bg-white/10 hover:text-white hover:border-green-500/30 hover:scale-105'
            }
          `}
        >
          {category.label}
        </button>
      ))}
    </div>
  )
}
