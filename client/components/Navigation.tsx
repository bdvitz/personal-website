'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Code, Blocks, Trophy, Home, Menu, X } from 'lucide-react'

export default function Navigation() {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navItems = [
    { href: '/', label: 'Home', icon: Home, gradient: 'from-purple-500 to-purple-600' },
    { href: '/algorithms', label: 'Algorithms', icon: Code, gradient: 'from-green-500 to-green-600' },
    { href: '/chess', label: 'Chess', icon: Trophy, gradient: 'from-yellow-500 to-yellow-600' },
    { href: '/cubing', label: "Cubing", icon: Blocks, gradient: 'from-red-500 to-red-600' }
  ]

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/10 backdrop-blur-lg border-b border-white/20 animate-fade-in">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo - Always visible */}
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-2xl">
                <span className="text-white font-bold text-2xl">BV</span>
              </div>
              <span className="text-2xl font-bold text-white group-hover:text-purple-300 transition-colors duration-200">
                Home
              </span>
            </Link>

            {/* Hamburger Menu Button - Mobile Only */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Desktop Navigation - Hidden on Mobile */}
            <div className="hidden lg:flex items-center gap-3">
              {navItems.slice(1).map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center justify-center space-x-3 px-6 py-3 rounded-2xl
                      transition-all duration-300 font-semibold text-base
                      ${isActive
                        ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg transform scale-105 hover:shadow-2xl`
                        : 'text-purple-200 hover:bg-white/15 hover:text-white hover:scale-105 hover:shadow-xl bg-white/5 border border-white/10'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMenuOpen && (
            <div className="lg:hidden mt-4 space-y-2 animate-slide-down">
              {navItems.slice(1).map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`
                      flex items-center space-x-3 px-4 py-3 rounded-xl
                      transition-all duration-300 font-semibold text-base
                      ${isActive
                        ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                        : 'text-purple-200 hover:bg-white/15 hover:text-white bg-white/5 border border-white/10'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.6s ease-in-out;
        }

        .animate-slide-down {
          animation: slideDown 0.3s ease-out;
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

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
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
