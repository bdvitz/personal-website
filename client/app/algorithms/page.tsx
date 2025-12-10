import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { Code } from 'lucide-react'
import AlgorithmCard from './components/AlgorithmCard'
import ClientFilterWrapper from './components/ClientFilterWrapper'

interface AlgorithmPost {
  slug: string
  title: string
  difficulty: string
  tags: string[]
  date: string
  excerpt: string
  category: string
}

function getAlgorithmPosts(): AlgorithmPost[] {
  const contentDir = path.join(process.cwd(), 'content', 'algorithms')
  const fileNames = fs.readdirSync(contentDir)

  const posts = fileNames
    .filter(fileName => {
      // Only include .md files, exclude README and HOW_TO files
      return fileName.endsWith('.md') &&
             !fileName.startsWith('README') &&
             !fileName.startsWith('HOW_TO')
    })
    .map(fileName => {
      const slug = fileName.replace(/\.md$/, '')
      const filePath = path.join(contentDir, fileName)
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const { data } = matter(fileContent)

      return {
        slug,
        title: data.title,
        difficulty: data.difficulty,
        tags: data.tags || [],
        date: data.date,
        excerpt: data.excerpt,
        category: data.category
      }
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return posts
}

export default function AlgorithmsPage() {
  const posts = getAlgorithmPosts()

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Code className="w-20 h-20 text-green-400" />
        </div>
        <h1 className="text-5xl font-bold mb-4 text-gradient-primary">
          Algorithms
        </h1>
        <p className="text-xl text-purple-200 max-w-3xl mx-auto leading-relaxed">
          A collection of algorithm solutions from LeetCode, Project Euler, and interesting coding puzzles.
          Each solution includes detailed explanations, complexity analysis, and optimizations.
        </p>
      </div>

      {/* Client-side Filter and Posts */}
      <ClientFilterWrapper posts={posts} />

      {/* Stats Footer */}
      <div className="card text-center">
        <p className="text-purple-200">
          <span className="text-white font-semibold text-2xl">{posts.length}</span> algorithm solutions and counting
        </p>
      </div>
    </div>
  )
}
