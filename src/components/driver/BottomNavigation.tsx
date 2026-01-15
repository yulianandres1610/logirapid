'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Route, Package } from 'lucide-react'
import { motion } from 'framer-motion'

interface NavItem {
  id: string
  label: string
  icon: typeof Route
  path: string
  matchPaths: string[]
}

const navItems: NavItem[] = [
  {
    id: 'routes',
    label: 'Rutas',
    icon: Route,
    path: '/driver/routes',
    matchPaths: ['/driver/routes', '/driver']
  },
  {
    id: 'orders',
    label: 'Ordenes',
    icon: Package,
    path: '/driver/orders',
    matchPaths: ['/driver/orders']
  }
]

export function BottomNavigation() {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (item: NavItem) => {
    return item.matchPaths.some(path => {
      if (path === '/driver') {
        return pathname === '/driver'
      }
      return pathname.startsWith(path)
    })
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {navItems.map((item) => {
          const active = isActive(item)
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => router.push(item.path)}
              className={`
                flex flex-col items-center justify-center flex-1 h-full
                transition-all duration-200 relative
                ${active ? 'text-exa-primary' : 'text-gray-400 hover:text-gray-200'}
              `}
            >
              {/* Active indicator */}
              {active && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-exa-primary rounded-b-full"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              {/* Icon with animation */}
              <motion.div
                animate={active ? { scale: 1.1, y: -2 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Icon className={`w-6 h-6 ${active ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
              </motion.div>

              {/* Label */}
              <span className={`text-xs mt-1 font-medium ${active ? 'text-exa-primary' : ''}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
