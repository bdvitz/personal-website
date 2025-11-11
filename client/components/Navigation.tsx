'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Code, BookOpen, Trophy, Home } from 'lucide-react'

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Home', icon: Home, gradient: 'from-purple-500 to-purple-600' },
    { href: '/leetcode', label: 'LeetCode', icon: Code, gradient: 'from-green-500 to-green-600' },
    { href: '/project-euler', label: 'Project Euler', icon: BookOpen, gradient: 'from-blue-500 to-blue-600' },
    { href: '/chess', label: 'Chess', icon: Trophy, gradient: 'from-yellow-500 to-yellow-600' },
  ]

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/10 backdrop-blur-lg border-b border-white/20 animate-fade-in">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-2xl">
                <span className="text-white font-bold text-2xl">B</span>
              </div>
              <span className="text-2xl font-bold text-white group-hover:text-purple-300 transition-colors duration-200">
                bdvitz
              </span>
            </Link>

            {/* Skip home link, show only main sections */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full lg:w-auto">
              {navItems.slice(1).map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center justify-center space-x-3 px-8 py-4 rounded-2xl
                      transition-all duration-300 font-semibold text-lg
                      min-w-[200px] lg:min-w-[180px]
                      ${isActive
                        ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg transform scale-105 hover:shadow-2xl`
                        : 'text-purple-200 hover:bg-white/15 hover:text-white hover:scale-105 hover:shadow-xl bg-white/5 border border-white/10'
                      }
                    `}
                  >
                    <Icon className={`w-6 h-6 ${isActive ? '' : 'group-hover:scale-110'} transition-transform duration-200`} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.6s ease-in-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  )
}
