import { Code, BookOpen, Trophy } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="space-y-12 animate-fade-in">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-6xl font-bold mb-6 text-gradient-primary">
          Welcome to Coding Stats
        </h1>
        <p className="text-2xl text-purple-200 max-w-3xl mx-auto leading-relaxed">
          Explore my journey through coding challenges, mathematical problems, and chess improvements
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* LeetCode Card */}
        <Link href="/leetcode">
          <div className="card card-hover group cursor-pointer">
            <Code className="w-16 h-16 text-green-400 mb-4 group-hover:scale-110 transition-transform duration-300" />
            <h2 className="text-3xl font-bold text-white mb-3">LeetCode</h2>
            <p className="text-purple-200 leading-relaxed">
              Detailed solutions to coding problems with explanations, complexity analysis, and multiple approaches
            </p>
            <div className="mt-6 inline-flex items-center text-green-400 font-semibold group-hover:translate-x-2 transition-transform duration-200">
              View Solutions →
            </div>
          </div>
        </Link>

        {/* Project Euler Card */}
        <Link href="/project-euler">
          <div className="card card-hover group cursor-pointer">
            <BookOpen className="w-16 h-16 text-blue-400 mb-4 group-hover:scale-110 transition-transform duration-300" />
            <h2 className="text-3xl font-bold text-white mb-3">Project Euler</h2>
            <p className="text-purple-200 leading-relaxed">
              Mathematical programming challenges solved with elegant algorithms and clear LaTeX formulas
            </p>
            <div className="mt-6 inline-flex items-center text-blue-400 font-semibold group-hover:translate-x-2 transition-transform duration-200">
              View Problems →
            </div>
          </div>
        </Link>

        {/* Chess Stats Card */}
        <Link href="/chess">
          <div className="card card-hover group cursor-pointer">
            <Trophy className="w-16 h-16 text-yellow-400 mb-4 group-hover:scale-110 transition-transform duration-300" />
            <h2 className="text-3xl font-bold text-white mb-3">Chess Stats</h2>
            <p className="text-purple-200 leading-relaxed">
              Live tracking of my Chess.com ratings with beautiful visualizations and progress over time
            </p>
            <div className="mt-6 inline-flex items-center text-yellow-400 font-semibold group-hover:translate-x-2 transition-transform duration-200">
              View Dashboard →
            </div>
          </div>
        </Link>
      </div>

      {/* About Section */}
      <div className="card max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-white mb-4">About This Project</h2>
        <div className="space-y-4 text-purple-100 leading-relaxed">
          <p>
            This website is a personal collection of my programming journey, featuring:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Comprehensive LeetCode problem solutions with detailed explanations</li>
            <li>Project Euler mathematical challenges with LaTeX-formatted proofs</li>
            <li>Real-time Chess.com statistics tracking with historical data visualization</li>
          </ul>
          <p>
            Built with <span className="font-semibold text-white">Next.js</span>, <span className="font-semibold text-white">Spring Boot</span>, and <span className="font-semibold text-white">PostgreSQL</span>.
          </p>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="card max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-white mb-4">Tech Stack</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xl font-semibold text-purple-300 mb-3">Frontend</h3>
            <ul className="space-y-2 text-purple-100">
              <li>• Next.js 14 (React)</li>
              <li>• Tailwind CSS</li>
              <li>• React Markdown + KaTeX</li>
              <li>• Recharts</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-purple-300 mb-3">Backend</h3>
            <ul className="space-y-2 text-purple-100">
              <li>• Spring Boot 3</li>
              <li>• PostgreSQL</li>
              <li>• Chess.com API</li>
              <li>• Railway Hosting</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
