import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Tag } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface AlgorithmPost {
  slug: string
  title: string
  difficulty: string
  tags: string[]
  date: string
  category: string
  sourceUrl?: string
  content: string
}

function getAlgorithmPost(slug: string): AlgorithmPost | null {
  try {
    const filePath = path.join(process.cwd(), 'content', 'algorithms', `${slug}.md`)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(fileContent)

    return {
      slug,
      title: data.title,
      difficulty: data.difficulty,
      tags: data.tags || [],
      date: data.date,
      category: data.category,
      sourceUrl: data.source_url, // Map snake_case to camelCase
      content
    }
  } catch (error) {
    return null
  }
}

function getAllAlgorithmPosts(): AlgorithmPost[] {
  const contentDir = path.join(process.cwd(), 'content', 'algorithms')
  const fileNames = fs.readdirSync(contentDir)

  const posts = fileNames
    .filter(fileName => {
      return fileName.endsWith('.md') &&
             !fileName.startsWith('README') &&
             !fileName.startsWith('HOW_TO')
    })
    .map(fileName => {
      const slug = fileName.replace(/\.md$/, '')
      return getAlgorithmPost(slug)!
    })
    .filter(post => post !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return posts
}

export async function generateStaticParams() {
  const posts = getAllAlgorithmPosts()
  return posts.map(post => ({ slug: post.slug }))
}

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function AlgorithmArticlePage({ params }: PageProps) {
  const { slug } = await params
  const post = getAlgorithmPost(slug)
  const allPosts = getAllAlgorithmPosts()

  if (!post) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="card text-center py-12">
          <p className="text-purple-200 text-lg">Article not found.</p>
          <Link href="/algorithms" className="inline-block mt-4 text-green-400 hover:text-green-300">
            ← Back to Algorithms
          </Link>
        </div>
      </div>
    )
  }

  // Find previous and next posts
  const currentIndex = allPosts.findIndex(p => p.slug === slug)
  const prevPost = currentIndex > 0 ? { slug: allPosts[currentIndex - 1].slug, title: allPosts[currentIndex - 1].title } : null
  const nextPost = currentIndex < allPosts.length - 1 ? { slug: allPosts[currentIndex + 1].slug, title: allPosts[currentIndex + 1].title } : null

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
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Back Button - Top */}
      <Link
        href="/algorithms"
        className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors duration-200 font-semibold"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Algorithms
      </Link>

      {/* Article Header */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className={`px-3 py-1 rounded-lg text-sm font-semibold border ${getDifficultyColor(post.difficulty)}`}>
            {post.difficulty}
          </span>
          <span className="text-sm text-purple-300 bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20">
            {getCategoryLabel(post.category)}
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-6 text-sm text-purple-300 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>

          {post.tags.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-purple-500/10 text-purple-300 px-2 py-1 rounded border border-purple-500/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {post.sourceUrl && (
          <a
            href={post.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            View Original Problem →
          </a>
        )}
      </div>

      {/* Article Content */}
      <div className="card">
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '')
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
              img({ node, src, alt, title, ...props }: any) {
                // Parse title attribute for width/height (e.g., "w:500", "h:300", "w:full")
                let widthClass = 'max-w-md' // default
                let customStyle: any = {}

                if (title) {
                  const widthMatch = title.match(/w:(\d+|full|100%)/)
                  const heightMatch = title.match(/h:(\d+)/)

                  if (widthMatch) {
                    const width = widthMatch[1]
                    if (width === 'full' || width === '100%') {
                      widthClass = 'max-w-full'
                    } else {
                      customStyle.maxWidth = `${width}px`
                      widthClass = '' // Remove default class when using custom width
                    }
                  }

                  if (heightMatch) {
                    customStyle.height = `${heightMatch[1]}px`
                  }
                }

                return (
                  <span className="block my-6">
                    <img
                      src={src}
                      alt={alt || ''}
                      className={`${widthClass} mx-auto rounded-lg shadow-lg`.trim()}
                      style={Object.keys(customStyle).length > 0 ? customStyle : undefined}
                      {...props}
                    />
                  </span>
                )
              }
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Previous Article */}
          <div className="w-full sm:w-auto">
            {prevPost ? (
              <Link
                href={`/algorithms/${prevPost.slug}`}
                className="flex items-center gap-2 text-purple-200 hover:text-green-400 transition-colors duration-200"
              >
                <ChevronLeft className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-xs text-purple-400">Previous</div>
                  <div className="font-semibold">{prevPost.title}</div>
                </div>
              </Link>
            ) : (
              <div className="invisible">Placeholder</div>
            )}
          </div>

          {/* Next Article */}
          <div className="w-full sm:w-auto">
            {nextPost ? (
              <Link
                href={`/algorithms/${nextPost.slug}`}
                className="flex items-center gap-2 text-purple-200 hover:text-green-400 transition-colors duration-200"
              >
                <div className="text-right">
                  <div className="text-xs text-purple-400">Next</div>
                  <div className="font-semibold">{nextPost.title}</div>
                </div>
                <ChevronRight className="w-5 h-5" />
              </Link>
            ) : (
              <div className="invisible">Placeholder</div>
            )}
          </div>
        </div>
      </div>

      {/* Back Button - Bottom */}
      <div className="text-center">
        <Link
          href="/algorithms"
          className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors duration-200 font-semibold"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Algorithms
        </Link>
      </div>
    </div>
  )
}
