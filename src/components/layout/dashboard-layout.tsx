'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed')
      return saved === 'true'
    }
    return false
  })
  const { theme } = useTheme()

  // Persistir estado del sidebar en localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  return (
    <div className={cn(
      "min-h-screen flex",
      theme === 'dark' ? "bg-gray-900" : "bg-gray-50"
    )}>
      {/* Static background - removed animations to prevent visual shake */}
      <div className="fixed inset-0 pointer-events-none">
        {theme === 'dark' ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
            <div className="absolute top-0 left-0 w-96 h-96 bg-exa-secondary/5 rounded-full filter blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-exa-primary/5 rounded-full filter blur-3xl" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-exa-secondary/3 rounded-full filter blur-2xl" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-exa-primary/5" />
            <div className="absolute top-0 left-0 w-96 h-96 bg-exa-primary/3 rounded-full filter blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-exa-secondary/3 rounded-full filter blur-3xl" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-100/20 rounded-full filter blur-2xl" />
          </>
        )}
      </div>

      {/* Sidebar - Fixed */}
      <div className="fixed left-0 top-0 h-full z-50">
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main content - Fixed header and scrollable content */}
      <div className={cn(
        "flex flex-col flex-1 relative z-10",
        sidebarCollapsed ? "ml-20" : "ml-72"
      )}>
        {/* Header - Fixed */}
        <div className={cn(
          "fixed top-0 right-0 z-40 transition-all duration-300",
          sidebarCollapsed ? "left-20" : "left-72"
        )}>
          <Header
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            sidebarCollapsed={sidebarCollapsed}
          />
        </div>

        {/* Page content - Scrollable */}
        <div className={cn(
          "flex-1 overflow-auto",
          sidebarCollapsed ? "mt-16" : "mt-16"
        )}>
          <motion.main
            className="p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {children}
          </motion.main>
        </div>
      </div>
    </div>
  )
}