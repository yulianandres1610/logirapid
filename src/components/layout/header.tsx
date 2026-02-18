'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  Wallet,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  Users,
  Box,
  Loader2,
  ArrowRight,
  LayoutDashboard,
  CreditCard,
  MapPin,
  BarChart3,
  Bot,
  MessageSquare
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { useBrandSafe } from '@/contexts/brand-context'

// Navigation pages for quick search
interface NavPage {
  name: string
  path: string
  icon: React.ElementType
  keywords: string[]
}

const NAV_PAGES: NavPage[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, keywords: ['inicio', 'home', 'principal'] },
  { name: 'Inventario', path: '/dashboard/market/inventory', icon: Box, keywords: ['productos', 'stock', 'almacen'] },
  { name: 'Crear Producto', path: '/dashboard/market/inventory/create', icon: Box, keywords: ['nuevo producto', 'agregar producto'] },
  { name: 'Almacenes', path: '/dashboard/market/warehouses', icon: MapPin, keywords: ['bodega', 'deposito', 'ubicacion'] },
  { name: 'Marketplace', path: '/dashboard/market/marketplace', icon: ShoppingCart, keywords: ['tienda', 'catalogo', 'vender'] },
  { name: 'Compras', path: '/dashboard/market/purchases', icon: ShoppingCart, keywords: ['ordenes compra', 'proveedores'] },
  { name: 'Nueva Compra', path: '/dashboard/market/purchases/create', icon: ShoppingCart, keywords: ['crear compra', 'agregar compra'] },
  { name: 'Consignaciones', path: '/dashboard/market/consignments', icon: Package, keywords: ['ordenes consignacion'] },
  { name: 'Nueva Consignacion', path: '/dashboard/market/consignments/create', icon: Package, keywords: ['crear consignacion'] },
  { name: 'Proveedores', path: '/dashboard/market/consignments/suppliers', icon: Truck, keywords: ['supplier', 'proveedor'] },
  { name: 'Punto de Venta', path: '/dashboard/market/pos', icon: CreditCard, keywords: ['pos', 'caja', 'ventas'] },
  { name: 'Ordenes Pickup', path: '/dashboard/agency/orders', icon: Truck, keywords: ['paquetes', 'envios', 'pickup'] },
  { name: 'Ordenes Oficina', path: '/dashboard/agency/office-orders', icon: FileText, keywords: ['oficina', 'envios'] },
  { name: 'Clientes', path: '/dashboard/agency/clients', icon: Users, keywords: ['crm', 'contactos'] },
  { name: 'Rutas', path: '/dashboard/agency/routes', icon: MapPin, keywords: ['entregas', 'drivers'] },
  { name: 'Wallet', path: '/dashboard/wallet', icon: Wallet, keywords: ['billetera', 'saldo', 'dinero'] },
  { name: 'Reportes', path: '/dashboard/reports', icon: BarChart3, keywords: ['estadisticas', 'graficos', 'informes'] },
  { name: 'Configuracion', path: '/dashboard/settings', icon: Settings, keywords: ['ajustes', 'preferencias'] },
  { name: 'Soporte', path: '/dashboard/support', icon: HelpCircle, keywords: ['ayuda', 'chat', 'asistencia'] }
]

interface SearchResult {
  id: number | string
  type: string
  title: string
  subtitle: string
  status?: string
  url: string
}

interface HeaderProps {
  onToggleSidebar: () => void
  onToggleMobileMenu?: () => void
  sidebarCollapsed: boolean
  mobileMenuOpen?: boolean
  onOpenAssistant?: () => void
}

export function Header({ onToggleSidebar, onToggleMobileMenu, sidebarCollapsed, mobileMenuOpen, onOpenAssistant }: HeaderProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { brand } = useBrandSafe()
  const { notifications, markAsRead, getUnreadCount } = useNotifications()
  const {
    companyBalance,
    userBalance,
    prevCompanyBalance,
    prevUserBalance,
    companyBalanceChange,
    userBalanceChange,
    loading: walletLoading
  } = useWalletBalance()
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Filter navigation pages based on search query
  const filteredPages = searchQuery.length > 0
    ? NAV_PAGES.filter(page => {
        const query = searchQuery.toLowerCase()
        return page.name.toLowerCase().includes(query) ||
               page.keywords.some(k => k.toLowerCase().includes(query))
      }).slice(0, 5)
    : []

  // Debounced search for documents
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=5`)
        const data = await response.json()
        if (data.success) {
          setSearchResults(data.data.results || [])
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.length >= 2) {
      router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery)}`)
      setShowSearchDropdown(false)
      setSearchQuery('')
    }
  }

  const handleSearchFocus = () => {
    setSearchFocused(true)
    setShowSearchDropdown(true)
  }

  const handleSearchBlur = () => {
    setSearchFocused(false)
    // Delay hiding dropdown to allow clicking on results
    setTimeout(() => {
      if (!searchRef.current?.contains(document.activeElement)) {
        setShowSearchDropdown(false)
      }
    }, 200)
  }

  const handleNavigate = (path: string) => {
    router.push(path)
    setShowSearchDropdown(false)
    setSearchQuery('')
  }

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'consignment': return Package
      case 'purchase': return ShoppingCart
      case 'pickup_order': return Truck
      case 'office_order': return FileText
      case 'product': return Box
      case 'customer': return Users
      default: return FileText
    }
  }

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
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-emerald-500" />
      default:
        return <Info className="w-4 h-4 text-gray-500" />
    }
  }

  // Navigate to company wallet page based on user role
  const handleWalletClick = () => {
    if (user?.role === 'SUPER_ADMIN') {
      router.push('/dashboard/admin/wallet')
    } else {
      // ADMIN, MANAGER, USER - go to company wallet
      router.push('/dashboard/admin/company-wallet')
    }
  }

  // Navigate to personal wallet (Mi Wallet) based on user role
  const handleMyWalletClick = () => {
    const roleMap: Record<string, string> = {
      'SUPER_ADMIN': '/dashboard/admin/my-wallet',
      'ADMIN': '/dashboard/admin/my-wallet',
      'AGENCY_ADMIN': '/dashboard/agency-admin/my-wallet',
      'MANAGER': '/dashboard/manager/my-wallet',
      'USER': '/dashboard/user/my-wallet',
      'DRIVER': '/dashboard/driver/my-wallet'
    }
    const path = roleMap[user?.role || 'USER'] || '/dashboard/user/my-wallet'
    router.push(path)
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
              className="absolute top-0 right-1/4 w-72 h-72 bg-gradient-to-br from-brand-primary/10 to-brand-secondary/8 rounded-full filter blur-3xl"
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
              className="absolute bottom-0 left-1/3 w-56 h-56 bg-gradient-to-tr from-brand-secondary/10 to-brand-primary/8 rounded-full filter blur-3xl"
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
              className="absolute top-0 right-1/4 w-64 h-64 bg-brand-primary/5 rounded-full filter blur-3xl"
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
              className="absolute bottom-0 left-1/3 w-48 h-48 bg-brand-secondary/5 rounded-full filter blur-3xl"
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

      <div className="relative z-10 px-3 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          {/* Left section */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile menu toggle button */}
            {onToggleMobileMenu && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMobileMenu}
                className={cn(
                  "md:hidden flex-shrink-0 rounded-xl transition-all duration-200",
                  theme === 'dark'
                    ? "text-gray-400 hover:text-white hover:bg-gray-800"
                    : "text-gray-600 hover:text-brand-primary hover:bg-gray-100"
                )}
              >
                <Menu className="w-6 h-6" />
              </Button>
            )}
            {/* Search bar */}
            <div ref={searchRef} className="relative">
              <form onSubmit={handleSearchSubmit}>
                <motion.div
                  className={cn(
                    "relative flex items-center border rounded-xl md:rounded-2xl transition-all duration-300",
                    "w-[180px] md:w-[280px]",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-white/80 border-gray-200 shadow-sm backdrop-blur-sm",
                    searchFocused
                      ? `ring-2 ${
                          theme === 'dark'
                            ? 'border-brand-secondary ring-brand-secondary/30 bg-gray-800/70'
                            : 'border-brand-primary ring-brand-primary/20 bg-white shadow-md'
                        } w-[220px] md:w-[380px]`
                      : theme === 'dark'
                        ? "hover:border-gray-600"
                        : "hover:border-brand-primary/40 hover:shadow-md"
                  )}
                >
                  <Search className={cn(
                    "absolute left-3 md:left-4 w-4 md:w-5 h-4 md:h-5 transition-all duration-300",
                    searchFocused
                      ? theme === 'dark' ? "text-brand-secondary scale-110" : "text-brand-primary scale-110"
                      : theme === 'dark'
                        ? "text-gray-400"
                        : "text-gray-500"
                  )} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                    placeholder="Buscar..."
                    className={cn(
                      "w-full pl-9 md:pl-12 pr-3 md:pr-4 py-2 md:py-3 bg-transparent rounded-xl md:rounded-2xl focus:outline-none transition-all duration-300 text-sm md:text-base",
                      theme === 'dark'
                        ? "text-white placeholder-gray-400"
                        : "text-black placeholder-gray-500"
                    )}
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-4 w-4 h-4 animate-spin text-gray-400" />
                  )}
                </motion.div>
              </form>

              {/* Search Dropdown */}
              <AnimatePresence>
                {showSearchDropdown && (searchQuery.length > 0 || searchFocused) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className={cn(
                      "absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-2xl overflow-hidden z-50",
                      theme === 'dark'
                        ? "bg-gray-900 border-gray-700"
                        : "bg-white border-gray-200"
                    )}
                  >
                    {/* Navigation Pages */}
                    {filteredPages.length > 0 && (
                      <div className={cn(
                        "p-2 border-b",
                        theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
                      )}>
                        <p className={cn(
                          "text-xs font-medium px-3 py-1.5",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          Ir a...
                        </p>
                        {filteredPages.map((page) => {
                          const Icon = page.icon
                          return (
                            <button
                              key={page.path}
                              onClick={() => handleNavigate(page.path)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left",
                                theme === 'dark'
                                  ? 'hover:bg-gray-800 text-gray-300'
                                  : 'hover:bg-gray-100 text-gray-700'
                              )}
                            >
                              <Icon className="w-4 h-4 text-blue-500" />
                              <span className="font-medium">{page.name}</span>
                              <ArrowRight className="w-4 h-4 ml-auto opacity-50" />
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="p-2">
                        <p className={cn(
                          "text-xs font-medium px-3 py-1.5",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          Documentos
                        </p>
                        {searchResults.map((result) => {
                          const Icon = getResultIcon(result.type)
                          return (
                            <button
                              key={`${result.type}-${result.id}`}
                              onClick={() => handleNavigate(result.url)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left",
                                theme === 'dark'
                                  ? 'hover:bg-gray-800'
                                  : 'hover:bg-gray-100'
                              )}
                            >
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                              )}>
                                <Icon className="w-4 h-4 text-gray-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "font-medium truncate text-sm",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {result.title}
                                </p>
                                <p className={cn(
                                  "text-xs truncate",
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                )}>
                                  {result.subtitle}
                                </p>
                              </div>
                              {result.status && (
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  theme === 'dark'
                                    ? 'bg-gray-800 text-gray-400'
                                    : 'bg-gray-100 text-gray-500'
                                )}>
                                  {result.status}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* View All Results */}
                    {searchQuery.length >= 2 && (
                      <div className={cn(
                        "p-2 border-t",
                        theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
                      )}>
                        <button
                          onClick={() => handleNavigate(`/dashboard/search?q=${encodeURIComponent(searchQuery)}`)}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors",
                            theme === 'dark'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          )}
                        >
                          <Search className="w-4 h-4" />
                          Ver todos los resultados
                        </button>
                      </div>
                    )}

                    {/* Empty State */}
                    {searchQuery.length > 0 && filteredPages.length === 0 && searchResults.length === 0 && !searchLoading && (
                      <div className="p-8 text-center">
                        <Search className="w-8 h-8 mx-auto mb-2 text-gray-400 opacity-50" />
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          {searchQuery.length < 2 ? 'Escribe al menos 2 caracteres' : 'No se encontraron resultados'}
                        </p>
                      </div>
                    )}

                    {/* Initial State */}
                    {searchQuery.length === 0 && (
                      <div className="p-4 text-center">
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          Busca ordenes, productos, clientes o navega a una vista
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-1.5 md:gap-3">

            {/* Company Wallet Balance - Hidden for MARKET companies and on mobile */}
            {user?.companyType !== 'market' && !user?.role?.startsWith('MARKET_') && (
              <motion.div
                onClick={handleWalletClick}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "hidden sm:flex items-center gap-2 px-2 md:px-3 py-1.5 md:py-2 rounded-lg md:rounded-xl border transition-all duration-300 cursor-pointer",
                  theme === 'dark'
                    ? "bg-green-500/10 border-green-500/20 hover:bg-green-500/15"
                    : "bg-green-50 border-green-200 hover:bg-green-100"
                )}
                title="Billetera de Empresa"
              >
                <Wallet className={cn(
                  "w-4 h-4",
                  theme === 'dark' ? "text-green-400" : "text-green-600"
                )} />
                {walletLoading ? (
                  <span className={cn(
                    "text-xs md:text-sm font-semibold",
                    theme === 'dark' ? "text-green-400" : "text-green-600"
                  )}>
                    $...
                  </span>
                ) : (
                  <AnimatedCounter
                    value={companyBalance}
                    previousValue={prevCompanyBalance}
                    changeDirection={companyBalanceChange}
                    prefix="$"
                    decimals={2}
                    className={cn(
                      "text-xs md:text-sm font-semibold",
                      theme === 'dark' ? "text-green-400" : "text-green-600"
                    )}
                    showChangeIndicator={true}
                  />
                )}
              </motion.div>
            )}

            {/* Theme toggle - Hidden on very small screens */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={cn(
                "hidden sm:flex relative hover:bg-white/10 transition-all duration-300 rounded-lg md:rounded-xl w-9 h-9 md:w-10 md:h-10",
                theme === 'dark'
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-600 hover:text-brand-primary hover:bg-brand-primary/5"
              )}
            >
              <motion.div
                animate={{ rotate: theme === 'light' ? 180 : 0 }}
                transition={{ duration: 0.5 }}
              >
                {theme === 'dark' ? (
                  <Moon className="w-4 md:w-5 h-4 md:h-5" />
                ) : (
                  <Sun className="w-4 md:w-5 h-4 md:h-5" />
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
                  "relative hover:bg-white/10 transition-all duration-300 rounded-lg md:rounded-xl border border-transparent w-9 h-9 md:w-10 md:h-10",
                  theme === 'dark'
                    ? "text-gray-400 hover:text-white hover:border-brand-secondary/30"
                    : "text-gray-600 hover:text-brand-primary hover:bg-brand-primary/5 hover:border-brand-primary/30"
                )}
              >
                <Bell className="w-4 md:w-5 h-4 md:h-5" />
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
                        ? "bg-gray-800 border-brand-secondary/20"
                        : "bg-white/95 backdrop-blur-xl border-brand-primary/20 shadow-xl"
                    )}
                  >
                    <div className={cn(
                      "p-5 border-b",
                      theme === 'dark' ? "border-gray-700" : "border-gray-100 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full animate-pulse",
                            unreadCount > 0
                              ? "bg-red-500"
                              : theme === 'dark' ? "bg-brand-secondary" : "bg-brand-primary"
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
                              // Call onClick handler if exists (for chat notifications)
                              if (notification.onClick) {
                                notification.onClick()
                              }
                            }}
                            className={cn(
                              "p-4 border-b cursor-pointer transition-all duration-200",
                              !notification.read && (
                                theme === 'dark'
                                  ? "bg-gray-700/20 border-l-2 border-l-brand-secondary"
                                  : "bg-brand-primary/5 border-l-2 border-l-brand-primary"
                              ),
                              theme === 'dark'
                                ? "border-gray-700/50 hover:bg-gray-700/30"
                                : "border-gray-50 hover:bg-gradient-to-r hover:from-brand-primary/5 hover:to-brand-secondary/5"
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
                                  theme === 'dark' ? "bg-brand-secondary" : "bg-brand-primary"
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

            {/* AI Assistant */}
            {onOpenAssistant && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenAssistant}
                className={cn(
                  "relative hover:bg-white/10 transition-all duration-300 rounded-lg md:rounded-xl w-9 h-9 md:w-10 md:h-10",
                  theme === 'dark'
                    ? "text-gray-400 hover:text-white hover:border-blue-500/30"
                    : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                )}
                title="Asistente IA"
              >
                <Bot className="w-4 md:w-5 h-4 md:h-5" />
                <span className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-30" />
              </Button>
            )}

            {/* User menu */}
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={cn(
                  "flex items-center gap-2 md:gap-3 px-2 md:px-4 py-1.5 md:py-2.5 rounded-xl md:rounded-2xl hover:bg-white/10 transition-all duration-300",
                  theme === 'dark'
                    ? "text-gray-400 hover:text-white border border-transparent hover:border-brand-secondary/20"
                    : "text-gray-700 hover:text-brand-primary hover:bg-brand-primary/5 border border-transparent hover:border-brand-primary/20"
                )}
              >
                <div className="relative">
                  <div className={cn(
                    "w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center",
                    theme === 'dark' ? "bg-gradient-exa" : "bg-brand-primary"
                  )}>
                    <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                  </div>
                  <motion.div
                    className={cn(
                      "absolute bottom-0 right-0 w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full border",
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
                        ? "bg-gray-800 border-brand-secondary/20"
                        : "bg-white/95 backdrop-blur-xl border-brand-primary/20 shadow-xl"
                    )}
                  >
                    {/* User Profile Header */}
                    <div className={cn(
                      "p-5 border-b",
                      theme === 'dark' ? "border-gray-700" : "border-gray-100 bg-gradient-to-br from-brand-primary/8 to-brand-secondary/8"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shadow-lg",
                          theme === 'dark' ? "bg-gradient-exa" : "bg-brand-primary"
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
                          )}>{user?.email || 'usuario@logirapid.com'}</p>
                        </div>
                      </div>
                    </div>
                    {/* User Wallet Balance - Separate section below user info */}
                    <div
                      onClick={() => {
                        setShowUserMenu(false)
                        handleMyWalletClick()
                      }}
                      className={cn(
                        "flex items-center gap-3 mx-5 my-3 p-3 cursor-pointer rounded-xl transition-colors",
                        theme === 'dark'
                          ? "bg-gray-700/50 hover:bg-gray-700"
                          : "bg-gray-50 hover:bg-gray-100"
                      )}
                      title="Ir a Mi Wallet Personal"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        theme === 'dark' ? "bg-green-500/20" : "bg-green-100"
                      )}>
                        <Wallet className={cn(
                          "w-5 h-5",
                          theme === 'dark' ? "text-green-400" : "text-green-600"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-xs font-medium",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>Mi Saldo Personal</p>
                        {walletLoading ? (
                          <p className={cn(
                            "text-lg font-bold",
                            theme === 'dark' ? "text-green-400" : "text-green-600"
                          )}>
                            $...
                          </p>
                        ) : (
                          <AnimatedCounter
                            value={userBalance}
                            previousValue={prevUserBalance}
                            changeDirection={userBalanceChange}
                            prefix="$"
                            decimals={2}
                            className={cn(
                              "text-lg font-bold",
                              theme === 'dark' ? "text-green-400" : "text-green-600"
                            )}
                            showChangeIndicator={true}
                          />
                        )}
                      </div>
                    </div>
                    <div className="p-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowUserMenu(false)
                          router.push('/dashboard/profile')
                        }}
                        className={cn(
                          "w-full justify-start gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-all duration-200",
                          theme === 'dark'
                            ? "text-gray-400 hover:text-white"
                            : "text-gray-700 hover:text-brand-primary hover:bg-brand-primary/5"
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
                            : "text-gray-700 hover:text-brand-primary hover:bg-brand-primary/5"
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

                            // Determine domain for production - support both brands
                            const hostname = window.location.hostname
                            let cookieDomain: string | undefined
                            if (hostname.includes('servisumic.com')) {
                              cookieDomain = '.servisumic.com'
                            } else if (hostname.includes('logirapid.com')) {
                              cookieDomain = '.logirapid.com'
                            }

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