'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Bell,
  Moon,
  Sun,
  HelpCircle,
  Menu,
  BookOpen,
  Headphones,
  User,
  LogOut,
  Settings,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Wallet
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { useWalletBalance } from '@/hooks/useWalletBalance'

interface HeaderProps {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

export function Header({ onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { notifications, markAsRead, getUnreadCount } = useNotifications()
  const { companyBalance, userBalance, loading: walletLoading } = useWalletBalance()
  const [searchFocused, setSearchFocused] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const unreadCount = getUnreadCount()

  const formatNotificationTime = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return "ahora mismo"
    if (minutes < 60) return `hace ${minutes} min`
    if (hours < 24) return `hace ${hours} hora${hours > 1 ? 's' : ''}`
    return `hace ${days} día${days > 1 ? 's' : ''}`
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />
      default:
        return <Info className="w-4 h-4 text-gray-500" />
    }
  }

  // Navigate to wallet page based on user role
  const handleWalletClick = () => {
    if (user?.role === 'SUPER_ADMIN') {
      router.push('/dashboard/admin/wallet')
    } else {
      // ADMIN, MANAGER, USER - go to company wallet
      router.push('/dashboard/admin/company-wallet')
    }
  }

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-40 backdrop-blur-xl border-b transition-all duration-300",
        theme === 'dark'
          ? "bg-gray-900/80 border-gray-800"
          : "bg-white border-gray-200 shadow-sm"
      )}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Animated background lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {theme === 'light' ? (
          <>
            <motion.div
              className="absolute top-0 right-1/4 w-72 h-72 bg-gradient-to-br from-exa-primary/10 to-exa-secondary/8 rounded-full filter blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.12, 0.25, 0.12],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute bottom-0 left-1/3 w-56 h-56 bg-gradient-to-tr from-exa-secondary/10 to-exa-primary/8 rounded-full filter blur-3xl"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.1, 0.2, 0.1],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 3
              }}
            />
          </>
        ) : (
          <>
            <motion.div
              className="absolute top-0 right-1/4 w-64 h-64 bg-exa-primary/5 rounded-full filter blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.2, 0.1],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute bottom-0 left-1/3 w-48 h-48 bg-exa-secondary/5 rounded-full filter blur-3xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.08, 0.15, 0.08],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2
              }}
            />
          </>
        )}
      </div>

      <div className="relative z-10 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left section */}
          <div className="flex items-center gap-4">
            {/* Search bar */}
            <motion.div
              className={cn(
                "relative flex items-center border rounded-2xl transition-all duration-300",
                theme === 'dark'
                  ? "bg-gray-800/50 border-gray-700"
                  : "bg-white/80 border-gray-200 shadow-sm backdrop-blur-sm",
                searchFocused
                  ? `ring-2 ${
                      theme === 'dark'
                        ? 'border-exa-secondary ring-exa-secondary/30 bg-gray-800/70'
                        : 'border-exa-primary ring-exa-primary/20 bg-white shadow-md'
                    }`
                  : theme === 'dark'
                    ? "hover:border-gray-600"
                    : "hover:border-exa-primary/40 hover:shadow-md"
              )}
              animate={{ width: searchFocused ? 340 : 300 }}
              transition={{ duration: 0.3 }}
            >
              <Search className={cn(
                "absolute left-4 w-5 h-5 transition-all duration-300",
                searchFocused
                  ? theme === 'dark' ? "text-exa-secondary scale-110" : "text-exa-primary scale-110"
                  : theme === 'dark'
                    ? "text-gray-400"
                    : "text-gray-500"
              )} />
              <input
                type="text"
                placeholder="Buscar..."
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className={cn(
                  "w-full pl-12 pr-4 py-3 bg-transparent rounded-2xl focus:outline-none transition-all duration-300",
                  theme === 'dark'
                    ? "text-white placeholder-gray-400"
                    : "text-black placeholder-gray-500"
                )}
              />
              {searchFocused && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "absolute right-2 w-1 h-1 rounded-full",
                    theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                  )}
                />
              )}
            </motion.div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-3">

            {/* Company Wallet Balance - Clickable to navigate to wallet */}
            <motion.div
              onClick={handleWalletClick}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-300 cursor-pointer",
                theme === 'dark'
                  ? "bg-green-500/10 border-green-500/20 hover:bg-green-500/15"
                  : "bg-green-50 border-green-200 hover:bg-green-100"
              )}
            >
              <Wallet className={cn(
                "w-4 h-4",
                theme === 'dark' ? "text-green-400" : "text-green-600"
              )} />
              <span className={cn(
                "text-sm font-semibold",
                theme === 'dark' ? "text-green-400" : "text-green-600"
              )}>
                ${walletLoading ? '...' : companyBalance.toFixed(2)}
              </span>
            </motion.div>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={cn(
                "relative hover:bg-white/10 transition-all duration-300 rounded-xl",
                theme === 'dark'
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-600 hover:text-exa-primary hover:bg-exa-primary/5"
              )}
            >
              <motion.div
                animate={{ rotate: theme === 'light' ? 180 : 0 }}
                transition={{ duration: 0.5 }}
              >
                {theme === 'dark' ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </motion.div>
            </Button>

            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(!showNotifications)}
                className={cn(
                  "relative hover:bg-white/10 transition-all duration-300 rounded-xl border border-transparent",
                  theme === 'dark'
                    ? "text-gray-400 hover:text-white hover:border-exa-secondary/30"
                    : "text-gray-600 hover:text-exa-primary hover:bg-exa-primary/5 hover:border-exa-primary/30"
                )}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <motion.div
                    className={cn(
                      "absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full flex items-center justify-center text-xs font-bold",
                      theme === 'dark'
                        ? "bg-red-500 text-white"
                        : "bg-red-500 text-white"
                    )}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </motion.div>
                )}
              </Button>

              {/* Notifications dropdown */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className={cn(
                      "absolute right-0 mt-3 w-80 border rounded-2xl shadow-2xl overflow-hidden",
                      theme === 'dark'
                        ? "bg-gray-800 border-exa-secondary/20"
                        : "bg-white/95 backdrop-blur-xl border-exa-primary/20 shadow-xl"
                    )}
                  >
                    <div className={cn(
                      "p-5 border-b",
                      theme === 'dark' ? "border-gray-700" : "border-gray-100 bg-gradient-to-r from-exa-primary/5 to-exa-secondary/5"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full animate-pulse",
                            unreadCount > 0
                              ? "bg-red-500"
                              : theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                          )}></div>
                          <h3 className={cn(
                            "font-semibold text-lg",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>Notificaciones</h3>
                        </div>
                        {notifications.length > 0 && (
                          <motion.button
                            onClick={() => {
                              notifications.forEach(n => !n.read && markAsRead(n.id))
                              setShowNotifications(false)
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "text-xs px-2 py-1.5 rounded-md font-medium transition-all duration-200 shadow-sm hover:shadow-md whitespace-nowrap flex-shrink-0",
                              theme === 'dark'
                                ? "bg-gray-700/60 text-gray-300 hover:bg-gray-600/80 hover:text-white border border-gray-600/40 hover:border-gray-500/60"
                                : "bg-gray-100/90 text-gray-600 hover:bg-gray-200/95 hover:text-gray-800 border border-gray-200/60 hover:border-gray-300/80"
                            )}
                          >
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 flex-shrink-0" />
                              <span className="hidden sm:inline">Marcar leídas</span>
                              <span className="sm:hidden">Leídas</span>
                            </span>
                          </motion.button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className={cn(
                          "p-8 text-center",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-sm">No tienes notificaciones</p>
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((notification) => (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => {
                              markAsRead(notification.id)
                              setShowNotifications(false)
                            }}
                            className={cn(
                              "p-4 border-b cursor-pointer transition-all duration-200",
                              !notification.read && (
                                theme === 'dark'
                                  ? "bg-gray-700/20 border-l-2 border-l-exa-secondary"
                                  : "bg-exa-primary/5 border-l-2 border-l-exa-primary"
                              ),
                              theme === 'dark'
                                ? "border-gray-700/50 hover:bg-gray-700/30"
                                : "border-gray-50 hover:bg-gradient-to-r hover:from-exa-primary/5 hover:to-exa-secondary/5"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-sm font-medium truncate",
                                  !notification.read && "font-semibold",
                                  theme === 'dark' ? "text-white" : "text-black"
                                )}>
                                  {notification.title}
                                </p>
                                <p className={cn(
                                  "text-xs mt-1 line-clamp-2",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {notification.message}
                                </p>
                                <p className={cn(
                                  "text-xs mt-2",
                                  theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                )}>
                                  {formatNotificationTime(notification.timestamp)}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className={cn(
                                  "w-2 h-2 rounded-full flex-shrink-0 mt-2",
                                  theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                                )} />
                              )}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User menu */}
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-2xl hover:bg-white/10 transition-all duration-300",
                  theme === 'dark'
                    ? "text-gray-400 hover:text-white border border-transparent hover:border-exa-secondary/20"
                    : "text-gray-700 hover:text-exa-primary hover:bg-exa-primary/5 border border-transparent hover:border-exa-primary/20"
                )}
              >
                <div className="relative">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    theme === 'dark' ? "bg-gradient-exa" : "bg-exa-primary"
                  )}>
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <motion.div
                    className={cn(
                      "absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border",
                      theme === 'dark' ? "border-gray-900" : "border-white"
                    )}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div className="hidden md:block text-left">
                  <p className={cn(
                    "text-sm font-medium",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>{user?.name || 'Admin User'}</p>
                  <p className={cn(
                    "text-xs",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>{user?.role || 'Super Admin'}</p>
                </div>
              </Button>

              {/* User menu dropdown */}
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className={cn(
                      "absolute right-0 mt-3 w-64 border rounded-2xl shadow-2xl overflow-hidden",
                      theme === 'dark'
                        ? "bg-gray-800 border-exa-secondary/20"
                        : "bg-white/95 backdrop-blur-xl border-exa-primary/20 shadow-xl"
                    )}
                  >
                    <div className={cn(
                      "p-5 border-b",
                      theme === 'dark' ? "border-gray-700" : "border-gray-100 bg-gradient-to-br from-exa-primary/8 to-exa-secondary/8"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shadow-lg",
                          theme === 'dark' ? "bg-gradient-exa" : "bg-exa-primary"
                        )}>
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className={cn(
                            "font-semibold text-base",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>{user?.name || 'Admin User'}</p>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>{user?.email || 'admin@cubarapid.com'}</p>
                        </div>
                      </div>
                      {/* User Wallet Balance */}
                      <div className={cn(
                        "flex items-center gap-3 mt-3 pt-3 border-t",
                        theme === 'dark' ? "border-gray-700" : "border-gray-200"
                      )}>
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          theme === 'dark' ? "bg-green-500/20" : "bg-green-100"
                        )}>
                          <Wallet className={cn(
                            "w-4 h-4",
                            theme === 'dark' ? "text-green-400" : "text-green-600"
                          )} />
                        </div>
                        <div>
                          <p className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )}>Mi Saldo</p>
                          <p className={cn(
                            "text-sm font-bold",
                            theme === 'dark' ? "text-green-400" : "text-green-600"
                          )}>
                            ${walletLoading ? '...' : userBalance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-200",
                          theme === 'dark'
                            ? "text-gray-400 hover:text-white"
                            : "text-gray-700 hover:text-exa-primary hover:bg-exa-primary/5"
                        )}
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm font-medium">Mi Perfil</span>
                      </Button>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-200",
                          theme === 'dark'
                            ? "text-gray-400 hover:text-white"
                            : "text-gray-700 hover:text-exa-primary hover:bg-exa-primary/5"
                        )}
                      >
                        <Settings className="w-4 h-4" />
                        <span className="text-sm font-medium">Configuración</span>
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          console.log('🚪 Header - Cerrando sesión')
                          if (typeof window !== 'undefined') {
                            // Clear localStorage
                            localStorage.removeItem('user')
                            localStorage.removeItem('auth-token')

                            // Clear all auth cookies
                            const cookiesToClear = [
                              'auth-token',
                              'user-id',
                              'user-name',
                              'user-email',
                              'user-role',
                              'user-company-id',
                              'user-company-name',
                            ]

                            // Determine domain for production
                            const cookieDomain = window.location.hostname.includes('logirapid.com')
                              ? '.logirapid.com'
                              : undefined

                            cookiesToClear.forEach(cookie => {
                              // Clear with domain if applicable (production)
                              if (cookieDomain) {
                                document.cookie = `${cookie}=; path=/; domain=${cookieDomain}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
                              }
                              // Also clear without domain (localhost and fallback)
                              document.cookie = `${cookie}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
                            })

                            // Redirect to login
                            window.location.href = '/login'
                          }
                        }}
                        className={cn(
                          "w-full justify-start gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                          theme === 'dark'
                            ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            : "text-red-600 hover:text-red-700 hover:bg-red-50"
                        )}
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Cerrar Sesión</span>
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  )
}