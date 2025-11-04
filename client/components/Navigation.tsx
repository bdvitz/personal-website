'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Code, BookOpen, Trophy, Home } from 'lucide-react'

export default function Navigation() {
  const pathname = usePathname()
  
  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/leetcode', label: 'LeetCode', icon: Code },
    { href: '/project-euler', label: 'Project Euler', icon: BookOpen },
    { href: '/chess', label: 'Chess', icon: Trophy },
  ]
  
  return (
    <nav className="sticky top-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
              <span className="text-white font-bold text-xl">B</span>
            </div>
            <span className="text-xl font-bold text-white hidden sm:block">bdvitz</span>
          </Link>
          
          {/* Navigation Links */}
          <div className="flex items-center space-x-1 md:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || 
                             (item.href !== '/' && pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center space-x-2 px-3 md:px-4 py-2 rounded-lg
                    transition-all duration-200 font-medium
                    ${isActive 
                      ? 'bg-white/20 text-white shadow-lg' 
                      : 'text-purple-200 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
