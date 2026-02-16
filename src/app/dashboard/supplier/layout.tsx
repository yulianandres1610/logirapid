'use client'

import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Package, DollarSign, User, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useBrandSafe } from '@/contexts/brand-context'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { brand } = useBrandSafe()

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/supplier/auth', { method: 'DELETE' })

      if (typeof window !== 'undefined') {
        const cookiesToClear = [
          'supplier-token', 'supplier-id', 'supplier-code', 'supplier-name'
        ]
        cookiesToClear.forEach(cookie => {
          document.cookie = `${cookie}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        })
      }

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col z-40">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="ml-3 font-bold text-lg text-gray-900 dark:text-white">
            Portal Proveedor
          </span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-6 px-3">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            return (
              <motion.button
                key={item.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center px-4 py-3 mb-2 rounded-xl transition-all ${
                  active
                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="ml-3 font-medium">{item.label}</span>
              </motion.button>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="ml-3 font-medium">
              {loggingOut ? 'Saliendo...' : 'Cerrar Sesion'}
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-white">Portal Proveedor</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide Menu */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: mobileMenuOpen ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="md:hidden fixed right-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 z-50 shadow-2xl"
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          <span className="font-bold text-gray-900 dark:text-white">Menu</span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            return (
              <button
                key={item.id}
                onClick={() => {
                  router.push(item.href)
                  setMobileMenuOpen(false)
                }}
                className={`w-full flex items-center px-4 py-4 mb-2 rounded-xl transition-all ${
                  active
                    ? 'bg-brand-primary text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="ml-3 font-medium">{item.label}</span>
              </button>
            )
          })}

          <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center px-4 py-4 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="ml-3 font-medium">
                {loggingOut ? 'Saliendo...' : 'Cerrar Sesion'}
              </span>
            </button>
          </div>
        </nav>
      </motion.div>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 md:hidden z-30">
        <div className="flex items-center justify-around h-16 pb-safe">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center justify-center flex-1 h-full min-w-[64px] relative ${
                  active
                    ? 'text-brand-primary'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-brand-primary rounded-b-full"
                  />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="md:ml-64 pt-16 md:pt-0 pb-20 md:pb-0 min-h-screen">
        {children}
      </main>

      <style jsx global>{`
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  )
}
