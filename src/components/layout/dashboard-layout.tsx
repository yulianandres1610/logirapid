'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import SupportChat from '@/components/support/SupportChat'
import { ChatNotificationListener } from '@/components/chat/ChatNotificationListener'

interface DashboardLayoutProps {
  children: React.ReactNode
  hideSidebar?: boolean // Used for POS mode to prevent navigation escape
  noPadding?: boolean // Used for full-screen layouts like POS close
}

export function DashboardLayout({ children, hideSidebar = false, noPadding = false }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed')
      return saved === 'true'
    }
    return false
  })
  // Mobile sidebar state (separate from desktop collapsed state)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [supportChatOpen, setSupportChatOpen] = useState(false)
  const { theme } = useTheme()
  const { user } = useAuth()

  // Persistir estado del sidebar en localStorage (solo para desktop)
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [])

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && !hideSidebar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop: Fixed | Mobile: Slide-in overlay */}
      {!hideSidebar && (
        <>
          {/* Desktop Sidebar */}
          <div className="hidden md:block fixed left-0 top-0 h-full z-50">
            <Sidebar
              isCollapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </div>

          {/* Mobile Sidebar */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="md:hidden fixed left-0 top-0 h-full z-50"
              >
                <Sidebar
                  isCollapsed={false}
                  onToggle={() => setMobileMenuOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Main content - Fixed header and scrollable content */}
      <div className={cn(
        "flex flex-col flex-1 relative z-10 transition-all duration-300",
        hideSidebar
          ? "ml-0"
          : cn(
              "ml-0", // Mobile: no margin
              "md:ml-20", // Desktop collapsed: 80px
              !sidebarCollapsed && "md:ml-72" // Desktop expanded: 288px
            )
      )}>
        {/* Header - Fixed (hidden in POS mode) */}
        {!hideSidebar && (
          <div className={cn(
            "fixed top-0 right-0 z-40 transition-all duration-300",
            "left-0", // Mobile: full width
            "md:left-20", // Desktop collapsed
            !sidebarCollapsed && "md:left-72" // Desktop expanded
          )}>
            <Header
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
              onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
              sidebarCollapsed={sidebarCollapsed}
              mobileMenuOpen={mobileMenuOpen}
              onOpenAssistant={() => setSupportChatOpen(true)}
            />
          </div>
        )}

        {/* Page content - Scrollable */}
        <div className={cn(
          "flex-1 overflow-auto",
          hideSidebar ? "mt-0" : "mt-16"
        )}>
          {noPadding ? (
            children
          ) : (
            <motion.main
              className="p-3 md:p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {children}
            </motion.main>
          )}
        </div>
      </div>

      {/* Support Chat Widget */}
      {user && (
        <SupportChat
          userContext={{
            userId: parseInt(user.id) || 0,
            role: user.role || 'user',
            companyType: user.companyType || 'agency',
            companyId: parseInt(user.companyId || '0') || 0,
            companyName: user.name || 'Usuario'
          }}
          isOpen={supportChatOpen}
          onClose={() => setSupportChatOpen(false)}
        />
      )}

      {/* Global Chat Notification Listener */}
      {user && <ChatNotificationListener />}
    </div>
  )
}