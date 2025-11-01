'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Users,
  Building2,
  CreditCard,
  Settings,
  BarChart3,
  Wallet,
  Car,
  Ticket,
  ShoppingCart,
  Menu,
  X,
  LogOut,
  Bell,
  Search,
  User,
  BookOpen,
  HelpCircle,
  Smartphone,
  Package,
  RefreshCw,
  Send,
  FileText,
  DollarSign,
  ShoppingBag,
  UserCheck,
  Warehouse,
  Route,
  Box
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'

interface SidebarItemProps {
  icon: any
  label: string
  href?: string
  isActive?: boolean
  isCollapsed?: boolean
  hasSubmenu?: boolean
  submenuItems?: Array<{ icon: any; label: string; href: string }>
  isSubmenuOpen?: boolean
  onToggleSubmenu?: () => void
}

const SidebarItem = ({
  icon: Icon,
  label,
  href,
  isActive,
  isCollapsed,
  hasSubmenu,
  submenuItems,
  isSubmenuOpen,
  onToggleSubmenu
}: SidebarItemProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const { theme } = useTheme()

  const handleClick = () => {
    if (hasSubmenu && onToggleSubmenu) {
      onToggleSubmenu()
    } else if (href) {
      router.push(href)
    }
  }

  return (
    <>
    <motion.button
      onClick={handleClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden group",
        isActive
          ? theme === 'dark'
            ? `bg-exa-secondary/20 text-exa-secondary border border-exa-secondary/30`
            : `bg-exa-primary/20 text-exa-primary border border-exa-primary/30`
          : theme === 'dark'
            ? "text-gray-400 hover:text-white hover:bg-white/5"
            : "text-gray-600 hover:text-gray-900 hover:bg-exa-primary/5"
      )}
      whileHover={{ scale: 1.02, x: isActive ? 0 : 5 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Background glow effect for active item */}
      {isActive && (
        <motion.div
          className={cn(
            "absolute inset-0 rounded-xl",
            theme === 'dark' ? "bg-exa-secondary/10" : "bg-exa-primary/10"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Icon with animation */}
      <motion.div
        className="relative z-10"
        whileHover={{ rotate: [0, -10, 10, 0] }}
        transition={{ duration: 0.5 }}
      >
        <Icon className={cn(
          "w-5 h-5",
          isActive
            ? theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
            : theme === 'dark'
              ? "text-gray-400 group-hover:text-white"
              : "text-gray-600 group-hover:text-gray-900"
        )} />
      </motion.div>

      {/* Label */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="relative z-10 text-sm font-medium flex-1 text-left"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Submenu indicator */}
      {hasSubmenu && !isCollapsed && (
        <motion.div
          animate={{ rotate: isSubmenuOpen ? 90 : 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "relative z-10",
            theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </motion.div>
      )}

      {/* Hover indicator */}
      {!isActive && (
        <motion.div
          className={cn(
            "absolute right-2 w-1 h-8 rounded-full opacity-0 group-hover:opacity-100",
            theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
          )}
          initial={{ opacity: 0, scaleY: 0 }}
          whileHover={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.button>

    {/* Submenu items */}
    {hasSubmenu && submenuItems && !isCollapsed && (
      <AnimatePresence>
        {isSubmenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="ml-4 space-y-1 overflow-hidden"
          >
            {submenuItems.map((subItem, index) => (
              <motion.button
                key={subItem.href}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => router.push(subItem.href)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 relative group",
                  pathname === subItem.href
                    ? theme === 'dark'
                      ? "text-exa-secondary"
                      : "text-exa-primary"
                    : theme === 'dark'
                      ? "text-gray-400 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                )}
                whileHover={{ scale: 1.02, x: pathname === subItem.href ? 0 : 3 }}
                whileTap={{ scale: 0.98 }}
              >
                <subItem.icon className={cn(
                  "w-4 h-4",
                  pathname === subItem.href
                    ? theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                    : theme === 'dark'
                      ? "text-gray-400 group-hover:text-white"
                      : "text-gray-600 group-hover:text-gray-900"
                )} />
                <span className="text-sm">{subItem.label}</span>
                {pathname === subItem.href && (
                  <motion.div
                    className={cn(
                      "absolute right-2 w-1 h-6 rounded-full",
                      theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                    )}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    )}
    </>
  )
}

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { theme } = useTheme()
  const { user } = useAuth()
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>({})

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Auto-expand submenu based on current path
  useEffect(() => {
    if (pathname.includes('/package-orders') ||
        pathname.includes('/orders') ||
        pathname.includes('/warehouses') ||
        pathname.includes('/vehicles') ||
        pathname.includes('/routes')) {
      setOpenSubmenus(prev => ({
        ...prev,
        'Paquetería': true
      }))
    }
  }, [pathname])

  // Menu items para SUPER_ADMIN (acceso completo a todo el sistema)
  const superAdminMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/admin" },
    { icon: BarChart3, label: "Tasa de Cambio", href: "/dashboard/admin/exchange-rate" },
    { icon: Users, label: "Usuarios", href: "/dashboard/admin/users" },
    { icon: Building2, label: "Empresas", href: "/dashboard/admin/companies" },
    { icon: UserCheck, label: "CRM", href: "/dashboard/admin/crm" },
    { icon: Wallet, label: "Wallet", href: "/dashboard/admin/wallets" },
    { icon: Send, label: "Remesa", href: "/dashboard/admin/remittance" },
    { icon: Smartphone, label: "Recarga", href: "/dashboard/admin/recharge" },
    { icon: Package, label: "Rastreador", href: "/dashboard/admin/tracker" },
    { icon: ShoppingCart, label: "Mercado", href: "/dashboard/admin/marketplace" },
    {
      icon: ShoppingBag,
      label: "Paquetería",
      href: "/dashboard/admin/package-orders",
      hasSubmenu: true,
      submenuItems: [
        { icon: Package, label: "Órdenes", href: "/dashboard/admin/package-orders" },
        { icon: Warehouse, label: "Almacenes", href: "/dashboard/admin/warehouses" },
        { icon: Car, label: "Vehículos", href: "/dashboard/admin/vehicles" },
        { icon: Route, label: "Rutas", href: "/dashboard/admin/routes" },
        { icon: Box, label: "Empaque", href: "/dashboard/admin/package-route" }
      ]
    },
    { icon: Settings, label: "Configuración", href: "/dashboard/admin/settings" },
  ]

  // Menu items para ADMIN (puede hacer todo en su empresa)
  const adminMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/agency-admin" },
    { icon: Users, label: "Usuarios", href: "/dashboard/agency-admin/users" },
    { icon: Building2, label: "Sucursales", href: "/dashboard/agency-admin/companies" },
    { icon: UserCheck, label: "CRM", href: "/dashboard/agency-admin/crm" },
    { icon: Wallet, label: "Wallet", href: "/dashboard/agency-admin/wallet" },
    { icon: Send, label: "Remesas", href: "/dashboard/agency-admin/remittance" },
    { icon: Smartphone, label: "Recargas", href: "/dashboard/agency-admin/recargas" },
    { icon: BarChart3, label: "Tasa de Cambio", href: "/dashboard/agency-admin/exchange-rate" },
    { icon: ShoppingCart, label: "Mercado", href: "/dashboard/agency-admin/marketplace" },
    {
      icon: ShoppingBag,
      label: "Paquetería",
      href: "/dashboard/agency-admin/orders",
      hasSubmenu: true,
      submenuItems: [
        { icon: Package, label: "Órdenes", href: "/dashboard/agency-admin/orders" },
        { icon: Warehouse, label: "Almacenes", href: "/dashboard/agency-admin/warehouses" },
        { icon: Car, label: "Vehículos", href: "/dashboard/agency-admin/vehicles" },
        { icon: Route, label: "Rutas", href: "/dashboard/agency-admin/routes" },
        { icon: Box, label: "Empaque", href: "/dashboard/agency-admin/package-route" }
      ]
    },
    { icon: Settings, label: "Configuración", href: "/dashboard/agency-admin/white-label" },
  ]

  // Menu items para MANAGER (puede crear usuarios y recargar wallet, pero no empresas ni transferencias)
  const managerMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/manager" },
    { icon: Users, label: "Usuarios", href: "/dashboard/manager/users" },
    { icon: UserCheck, label: "CRM", href: "/dashboard/manager/crm" },
    { icon: Wallet, label: "Recargar Wallet", href: "/dashboard/manager/wallet" },
    { icon: BarChart3, label: "Tasa de Cambio", href: "/dashboard/manager/exchange-rate" },
    { icon: ShoppingCart, label: "Mercado", href: "/dashboard/manager/marketplace" },
    {
      icon: FileText,
      label: "Paquetería",
      href: "/dashboard/manager/orders",
      hasSubmenu: true,
      submenuItems: [
        { icon: Package, label: "Órdenes", href: "/dashboard/manager/orders" },
        { icon: Warehouse, label: "Almacenes", href: "/dashboard/manager/warehouses" },
        { icon: Car, label: "Vehículos", href: "/dashboard/manager/vehicles" },
        { icon: Route, label: "Rutas", href: "/dashboard/manager/routes" },
        { icon: Box, label: "Empaque", href: "/dashboard/manager/package-route" }
      ]
    },
    { icon: Settings, label: "Configuración", href: "/dashboard/manager/white-label" },
  ]

  // Menu items para USER (solo puede vender servicios)
  const userMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/user" },
    { icon: Send, label: "Vender Remesa", href: "/dashboard/user/remittance" },
    { icon: Smartphone, label: "Recargar Móvil", href: "/dashboard/user/recharge" },
    { icon: Package, label: "Paquetes", href: "/dashboard/user/packages" },
    { icon: UserCheck, label: "CRM", href: "/dashboard/user/crm" },
    { icon: BarChart3, label: "Tasa de Cambio", href: "/dashboard/user/exchange-rate" },
    { icon: ShoppingCart, label: "Mercado", href: "/dashboard/user/marketplace" },
    {
      icon: ShoppingBag,
      label: "Paquetería",
      href: "/dashboard/user/orders",
      hasSubmenu: true,
      submenuItems: [
        { icon: Package, label: "Mis Órdenes", href: "/dashboard/user/orders" },
        { icon: BarChart3, label: "Mis Ventas", href: "/dashboard/user/sales" },
        { icon: DollarSign, label: "Comisiones", href: "/dashboard/user/commissions" }
      ]
    },
  ]

  // Seleccionar el menú adecuado según el rol del usuario
  const menuItems = user?.role === 'SUPER_ADMIN' ? superAdminMenuItems :
                   user?.role === 'ADMIN' ? adminMenuItems :
                   user?.role === 'MANAGER' ? managerMenuItems :
                   user?.role === 'USER' ? userMenuItems :
                   []

  return (
    <motion.div
      className={cn(
        "border-r flex flex-col h-screen relative overflow-hidden",
        theme === 'dark'
          ? "bg-gray-900 border-gray-800"
          : "bg-white border-gray-200",
        isCollapsed ? "w-[82px]" : "w-72"
      )}
      initial={false}
      animate={{ width: isCollapsed ? 82 : 288 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {/* Background gradient overlay */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-b",
        theme === 'dark'
          ? "from-gray-900 via-gray-900/95 to-gray-900"
          : "from-white via-white to-white"
      )} />

      {/* Animated background lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {theme === 'light' ? (
          <>
            <motion.div
              className="absolute top-10 right-10 w-40 h-40 bg-gradient-to-br from-exa-primary/15 to-exa-secondary/10 rounded-full filter blur-3xl"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute bottom-20 left-10 w-32 h-32 bg-gradient-to-tr from-exa-secondary/15 to-exa-primary/10 rounded-full filter blur-3xl"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 2
              }}
            />
            <motion.div
              className="absolute top-1/2 left-1/4 w-28 h-28 bg-gradient-to-r from-exa-primary/10 to-transparent rounded-full filter blur-2xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            />
          </>
        ) : (
          <>
            <motion.div
              className={cn(
                "absolute top-10 right-10 w-32 h-32 rounded-full filter blur-2xl",
                theme === 'dark' ? "bg-exa-secondary/10" : "bg-exa-primary/10"
              )}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div
              className="absolute bottom-20 left-10 w-24 h-24 bg-exa-secondary/10 rounded-full filter blur-2xl"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
            />
          </>
        )}
      </div>

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className={cn(
          "border-b",
          theme === 'dark' ? "border-gray-800" : "border-gray-200"
        )}>
          <div className={cn(
            "flex items-center justify-between h-[82px]",
            isCollapsed ? "px-3 py-6 w-[82px]" : "px-6 py-6"
          )}>
            {/* Logo */}
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center justify-start w-full"
                >
                  <img
                    src={theme === 'light' ? "/images/logocolor.png" : "/images/logoheader.png"}
                    alt="CUBARAPID"
                    className={cn(
                      "h-14 object-contain transition-all duration-300",
                      "w-full max-w-[200px] drop-shadow-lg"
                    )}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toggle button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className={cn(
                "relative z-10 hover:bg-white/10",
                theme === 'dark'
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <motion.div
                animate={{ rotate: isCollapsed ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {isCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </motion.div>
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 space-y-2 overflow-y-auto",
          isCollapsed ? "px-3 py-2" : "px-4 py-4"
        )}>
          {menuItems.map((item, index) => (
            <motion.div
              key={item.href || item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              {/* When collapsed and has submenu, show submenu items as individual items */}
              {isCollapsed && item.hasSubmenu && item.submenuItems ? (
                <>
                  {item.submenuItems.map((subItem, subIndex) => (
                    <motion.div
                      key={subItem.href}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (index * 0.02) + (subIndex * 0.01), duration: 0.2 }}
                    >
                      <SidebarItem
                        icon={subItem.icon}
                        label={subItem.label}
                        href={subItem.href}
                        isActive={pathname === subItem.href}
                        isCollapsed={isCollapsed}
                        hasSubmenu={false}
                      />
                    </motion.div>
                  ))}
                </>
              ) : (
                <SidebarItem
                  {...item}
                  isActive={pathname === item.href || (item.submenuItems && item.submenuItems.some(subItem => pathname === subItem.href))}
                  isCollapsed={isCollapsed}
                  isSubmenuOpen={openSubmenus[item.label]}
                  onToggleSubmenu={() => toggleSubmenu(item.label)}
                />
              )}
            </motion.div>
          ))}
        </nav>

        {/* Bottom section - Support & Documentation */}
        <div className={cn(
          "border-t space-y-2",
          theme === 'dark' ? "border-gray-800" : "border-gray-200",
          isCollapsed ? "px-3 py-2" : "px-4 py-4"
        )}>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="ghost"
              onClick={() => console.log('🚀 Sidebar - Documentación solicitada')}
              className={cn(
                "w-full justify-start gap-3 hover:bg-exa-primary/10",
                theme === 'dark'
                  ? "text-gray-400 hover:text-exa-secondary"
                  : "text-gray-600 hover:text-exa-primary",
                isCollapsed && "justify-center px-3"
              )}
            >
              <BookOpen className="w-5 h-5" />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium"
                  >
                    Documentación
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="ghost"
              onClick={() => console.log('🚀 Sidebar - Soporte técnico solicitado')}
              className={cn(
                "w-full justify-start gap-3 hover:bg-exa-primary/10",
                theme === 'dark'
                  ? "text-gray-400 hover:text-exa-secondary"
                  : "text-gray-600 hover:text-exa-primary",
                isCollapsed && "justify-center px-3"
              )}
            >
              <HelpCircle className="w-5 h-5" />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium"
                  >
                    Soporte Técnico
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}