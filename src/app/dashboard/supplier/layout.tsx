'use client'

import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Package, DollarSign, User, LogOut } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { id: 'home', label: 'Inicio', icon: Home, href: '/dashboard/supplier' },
  { id: 'orders', label: 'Ordenes', icon: Package, href: '/dashboard/supplier/orders' },
  { id: 'payments', label: 'Pagos', icon: DollarSign, href: '/dashboard/supplier/payments' },
  { id: 'profile', label: 'Perfil', icon: User, href: '/dashboard/supplier/profile' },
]

export default function SupplierDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      // Call logout API
      await fetch('/api/supplier/auth', { method: 'DELETE' })

      // Clear client-side cookies
      if (typeof window !== 'undefined') {
        const cookiesToClear = [
          'supplier-token', 'supplier-id', 'supplier-code', 'supplier-name'
        ]
        cookiesToClear.forEach(cookie => {
          document.cookie = `${cookie}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        })
      }

      // Redirect to login
      window.location.href = '/supplier/login'
    } catch {
      console.error('Error during logout')
      window.location.href = '/supplier/login'
    }
  }

  const isActive = (href: string) => {
    if (href === '/dashboard/supplier') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-0">
      {/* Main Content */}
      <main className="min-h-screen">
        {children}
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 md:hidden z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] relative touch-manipulation ${
                  active
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-teal-500 rounded-b-full"
                  />
                )}
                <Icon className={`w-6 h-6 ${active ? 'text-teal-600 dark:text-teal-400' : ''}`} />
                <span className={`text-[10px] mt-1 font-medium ${active ? 'text-teal-600 dark:text-teal-400' : ''}`}>
                  {item.label}
                </span>
              </button>
            )
          })}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex flex-col items-center justify-center flex-1 h-full min-w-[64px] text-gray-500 dark:text-gray-400 touch-manipulation"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">
              {loggingOut ? '...' : 'Salir'}
            </span>
          </button>
        </div>
      </nav>

      {/* Desktop Sidebar - Hidden on Mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col z-40">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center lg:justify-start px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="hidden lg:block ml-3 font-bold text-gray-900 dark:text-white">
            Portal Proveedor
          </span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center justify-center lg:justify-start px-4 py-3 mb-1 transition-colors ${
                  active
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-r-4 border-teal-500'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden lg:block ml-3 font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Logout Button - Desktop */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center lg:justify-start px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden lg:block ml-3 font-medium">
              {loggingOut ? 'Saliendo...' : 'Cerrar Sesion'}
            </span>
          </button>
        </div>
      </aside>

      {/* Content Offset for Desktop Sidebar */}
      <style jsx global>{`
        @media (min-width: 768px) {
          .min-h-screen {
            margin-left: 5rem;
          }
        }
        @media (min-width: 1024px) {
          .min-h-screen {
            margin-left: 16rem;
          }
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  )
}
