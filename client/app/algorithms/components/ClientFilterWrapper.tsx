'use client'

import { useState } from 'react'
import AlgorithmCard from './AlgorithmCard'
import FilterTags from './FilterTags'

interface AlgorithmPost {
  slug: string
  title: string
  difficulty: string
  tags: string[]
  date: string
  excerpt: string
  category: string
}

interface ClientFilterWrapperProps {
  posts: AlgorithmPost[]
}

export default function ClientFilterWrapper({ posts }: ClientFilterWrapperProps) {
  const [selectedCategory, setSelectedCategory] = useState('all')

  const filteredPosts = selectedCategory === 'all'
    ? posts
    : posts.filter(post => post.category === selectedCategory)

  return (
    <>
      {/* Filter Tags */}
      <div className="card">
        <FilterTags
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>

      {/* Posts Grid */}
      {filteredPosts.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => (
            <AlgorithmCard key={post.slug} {...post} />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-purple-200 text-lg">
            No articles found in this category yet. Check back soon!
          </p>
        </div>
      )}
    </>
  )
}
