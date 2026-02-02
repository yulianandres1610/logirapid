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
  Box,
  Store,
  Truck,
  Percent,
  Banknote,
  Globe,
  Monitor,
  Tag,
  ClipboardList,
  Calculator,
  Receipt,
  FileCheck,
  TrendingUp,
  ClipboardCheck,
  MessageCircle,
  History,
  Clock,
  Calendar,
  Fingerprint,
  Briefcase,
  Scale
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useEnabledServices } from '@/hooks/useEnabledServices'

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

interface BrandingData {
  companyId: number
  companyName: string
  subdomain: string
  logoUrl: string | null
  logoUrlLight?: string | null  // Logo para tema claro
  logoUrlDark?: string | null   // Logo para tema oscuro
  primaryColor: string
  secondaryColor: string
}

interface CommissionBalanceData {
  isEmployee: boolean
  balance: number
  commissionRate: number
  thisMonth?: number
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme } = useTheme()
  const { user } = useAuth()
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>({})
  const [branding, setBranding] = useState<BrandingData | null>(null)
  const [isBranch, setIsBranch] = useState<boolean>(false)
  const [commissionBalance, setCommissionBalance] = useState<CommissionBalanceData | null>(null)

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Auto-expand submenu based on current path
  useEffect(() => {
    if (pathname.includes('/purchase-orders') ||
        pathname.includes('/orders') ||
        pathname.includes('/office-orders') ||
        pathname.includes('/warehouses') ||
        pathname.includes('/drivers') ||
        pathname.includes('/vehicles') ||
        pathname.includes('/routes') ||
        pathname.includes('/paqueteria/configuracion')) {
      setOpenSubmenus(prev => ({
        ...prev,
        'Paquetería': true
      }))
    }
    // Auto-expand Brokers submenu
    if (pathname.includes('/admin/brokers')) {
      setOpenSubmenus(prev => ({
        ...prev,
        'Brokers': true
      }))
    }
    // Auto-expand HR submenu
    if (pathname.includes('/market/hr')) {
      setOpenSubmenus(prev => ({
        ...prev,
        'Recursos Humanos': true
      }))
    }
    // Auto-expand Wholesale submenu
    if (pathname.includes('/market/wholesale')) {
      setOpenSubmenus(prev => ({
        ...prev,
        'Mayoreo': true
      }))
    }
  }, [pathname])

  // Fetch branding data for company logo
  useEffect(() => {
    const fetchBranding = async () => {
      const controller = new AbortController()
      try {
        const response = await fetch('/api/branding/current', { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) return
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('application/json')) return
        const data = await response.json()
        if (data?.success) {
          setBranding(data.data)
        }
      } catch {
        // Silently ignore branding errors - it's optional
      }
      return () => controller.abort()
    }

    fetchBranding()
  }, [user?.companyId])

  // Fetch company info to determine if it's a branch
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      if (!user?.companyId) return
      try {
        const response = await fetch(`/api/companies/${user.companyId}`)
        if (!response.ok) return
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('application/json')) return
        const data = await response.json()
        if (data?.success && data.data) {
          setIsBranch(data.data.isBranch === true || data.data.parentCompanyId !== null)
        }
      } catch {
        // Silently ignore - isBranch will just remain false
      }
    }

    fetchCompanyInfo()
  }, [user?.companyId])

  // Fetch commission balance for market employees
  const isMarketEmployee = user?.role?.startsWith('MARKET_') || user?.companyType === 'market'
  useEffect(() => {
    const fetchCommissionBalance = async () => {
      if (!isMarketEmployee) return
      try {
        const response = await fetch('/api/market/my-commission-balance')
        if (!response.ok) return
        const data = await response.json()
        if (data?.success && data.data) {
          setCommissionBalance(data.data)
        }
      } catch (error) {
        console.warn('Error fetching commission balance:', error)
      }
    }

    fetchCommissionBalance()
    // Refresh every 30 seconds to keep balance updated
    const interval = setInterval(fetchCommissionBalance, 30000)
    return () => clearInterval(interval)
  }, [isMarketEmployee])

  // Menu items para SUPER_ADMIN (acceso completo a todo el sistema)
  const superAdminMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/admin" },
    { icon: BarChart3, label: "Tasa de Cambio", href: "/dashboard/admin/exchange-rate" },
    { icon: Users, label: "Usuarios", href: "/dashboard/admin/users" },
    { icon: Building2, label: "Empresas", href: "/dashboard/admin/companies" },
    { icon: Settings, label: "Catálogo Productos", href: "/dashboard/admin/product-config" },
    { icon: UserCheck, label: "CRM", href: "/dashboard/admin/crm" },
    { icon: Wallet, label: "Wallet Manager", href: "/dashboard/admin/wallet" },
    { icon: Send, label: "Cupones Familiares", href: "/dashboard/admin/cupones-familiares" },
    {
      icon: Globe,
      label: "Brokers",
      href: "/dashboard/admin/brokers",
      hasSubmenu: true,
      submenuItems: [
        { icon: Building2, label: "Dashboard", href: "/dashboard/admin/brokers" },
        { icon: Package, label: "Órdenes Cupones", href: "/dashboard/admin/brokers/orders" },
        { icon: Wallet, label: "Wallets", href: "/dashboard/admin/brokers/wallets" },
        { icon: Banknote, label: "Entregas Efectivo", href: "/dashboard/admin/brokers/cash-delivery/list" }
      ]
    },
    { icon: Smartphone, label: "Recargas", href: "/dashboard/admin/recargas" },
    { icon: Package, label: "Rastreador", href: "/dashboard/admin/tracker" },
    { icon: ShoppingCart, label: "Mercado", href: "/dashboard/admin/marketplace" },
    { icon: Store, label: "Aprobaciones Marketplace", href: "/dashboard/admin/marketplace-approvals" },
    {
      icon: ShoppingBag,
      label: "Paquetería",
      href: "/dashboard/admin/pickup-orders",
      hasSubmenu: true,
      submenuItems: [
        { icon: Truck, label: "Órdenes de Recogida", href: "/dashboard/admin/pickup-orders" },
        { icon: Store, label: "Órdenes de Oficina", href: "/dashboard/admin/office-orders" },
        { icon: Warehouse, label: "Almacenes", href: "/dashboard/admin/warehouses" },
        { icon: User, label: "Drivers", href: "/dashboard/admin/drivers" },
        { icon: Car, label: "Vehículos", href: "/dashboard/admin/vehicles" },
        { icon: Route, label: "Rutas", href: "/dashboard/admin/routes" },
        { icon: Box, label: "Empaque", href: "/dashboard/admin/package-route" }
      ]
    },
    { icon: Settings, label: "Configuración", href: "/dashboard/admin/settings" },
  ]

  // Menu items para ADMIN (puede hacer todo en su empresa)
  const adminMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/agency-admin", requiredService: null },
    { icon: Users, label: "Usuarios", href: "/dashboard/agency-admin/users", requiredService: null },
    // Sucursales solo visible para empresas matriz (no sucursales)
    ...(!isBranch ? [{ icon: Building2, label: "Sucursales", href: "/dashboard/agency-admin/sucursales", requiredService: null }] : []),
    { icon: UserCheck, label: "CRM", href: "/dashboard/agency-admin/crm", requiredService: null },
    // Catálogo condicional: empresas matriz usan /catalogo, sucursales usan /catalogo-sucursal
    { icon: Package, label: "Catálogo", href: isBranch ? "/dashboard/agency-admin/catalogo-sucursal" : "/dashboard/agency-admin/catalogo", requiredService: null },
    { icon: Package, label: "Rastreador", href: "/dashboard/agency-admin/tracker", requiredService: 'tracker' },
    { icon: Wallet, label: "Wallet Empresa", href: "/dashboard/admin/company-wallet", requiredService: 'wallet' },
    { icon: Banknote, label: "Cupones Familiares", href: "/dashboard/agency-admin/cupones-familiares", requiredService: 'remittance' },
    { icon: Smartphone, label: "Recargas", href: "/dashboard/agency-admin/recargas", requiredService: 'recharge' },
    { icon: BarChart3, label: "Tasa de Cambio", href: "/dashboard/agency-admin/exchange-rate", requiredService: 'exchange' },
    { icon: ShoppingCart, label: "Mercado", href: "/dashboard/agency-admin/marketplace", requiredService: 'marketplace' },
    {
      icon: ShoppingBag,
      label: "Paquetería",
      href: "/dashboard/agency-admin/orders",
      requiredService: 'paqueteria',
      hasSubmenu: true,
      submenuItems: [
        { icon: Truck, label: "Órdenes Recogida", href: "/dashboard/agency-admin/pickup-orders", requiredSubmodule: 'pickup-orders' },
        { icon: Store, label: "Órdenes Oficina", href: "/dashboard/agency-admin/office-orders", requiredSubmodule: 'office-orders' },
        { icon: Warehouse, label: "Almacenes", href: "/dashboard/agency-admin/warehouses", requiredSubmodule: 'warehouses' },
        { icon: User, label: "Drivers", href: "/dashboard/agency-admin/drivers", requiredSubmodule: 'drivers' },
        { icon: Car, label: "Vehículos", href: "/dashboard/agency-admin/vehicles", requiredSubmodule: 'vehicles' },
        { icon: Route, label: "Rutas", href: "/dashboard/agency-admin/routes", requiredSubmodule: 'routes' },
        { icon: Box, label: "Empaque", href: "/dashboard/agency-admin/package-route", requiredSubmodule: 'package-route' }
      ]
    },
    { icon: Settings, label: "Configuración", href: "/dashboard/agency-admin/settings", requiredService: null },
  ]

  // Menu items para MANAGER (puede crear usuarios y recargar wallet, pero no empresas ni transferencias)
  const managerMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/manager", requiredService: null },
    { icon: Users, label: "Usuarios", href: "/dashboard/manager/users", requiredService: null },
    { icon: UserCheck, label: "CRM", href: "/dashboard/manager/crm", requiredService: null },
    { icon: Wallet, label: "Wallet Empresa", href: "/dashboard/admin/company-wallet", requiredService: 'wallet' },
    { icon: BarChart3, label: "Tasa de Cambio", href: "/dashboard/manager/exchange-rate", requiredService: 'exchange' },
    { icon: ShoppingCart, label: "Mercado", href: "/dashboard/manager/marketplace", requiredService: 'marketplace' },
    {
      icon: FileText,
      label: "Paquetería",
      href: "/dashboard/manager/orders",
      requiredService: 'paqueteria',
      hasSubmenu: true,
      submenuItems: [
        { icon: Truck, label: "Órdenes Recogida", href: "/dashboard/manager/orders", requiredSubmodule: 'pickup-orders' },
        { icon: Store, label: "Órdenes Oficina", href: "/dashboard/manager/office-orders", requiredSubmodule: 'office-orders' },
        { icon: Warehouse, label: "Almacenes", href: "/dashboard/manager/warehouses", requiredSubmodule: 'warehouses' },
        { icon: User, label: "Drivers", href: "/dashboard/manager/drivers", requiredSubmodule: 'drivers' },
        { icon: Car, label: "Vehículos", href: "/dashboard/manager/vehicles", requiredSubmodule: 'vehicles' },
        { icon: Route, label: "Rutas", href: "/dashboard/manager/routes", requiredSubmodule: 'routes' },
        { icon: Box, label: "Empaque", href: "/dashboard/manager/package-route", requiredSubmodule: 'package-route' }
      ]
    },
    { icon: Settings, label: "Configuración", href: "/dashboard/manager/settings", requiredService: null },
  ]

  // Menu items para USER (solo puede vender servicios)
  const userMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/user", requiredService: null },
    { icon: Banknote, label: "Vender Cupón Familiar", href: "/dashboard/agency-admin/cupones-familiares", requiredService: 'remittance' },
    { icon: Smartphone, label: "Recargar Móvil", href: "/dashboard/user/recharge", requiredService: 'recharge' },
    { icon: Package, label: "Paquetes", href: "/dashboard/user/packages", requiredService: 'paqueteria' },
    { icon: UserCheck, label: "CRM", href: "/dashboard/user/crm", requiredService: null },
    { icon: BarChart3, label: "Tasa de Cambio", href: "/dashboard/user/exchange-rate", requiredService: 'exchange' },
    { icon: ShoppingCart, label: "Mercado", href: "/dashboard/user/marketplace", requiredService: 'marketplace' },
    {
      icon: ShoppingBag,
      label: "Paquetería",
      href: "/dashboard/user/orders",
      requiredService: 'paqueteria',
      hasSubmenu: true,
      submenuItems: [
        { icon: Truck, label: "Órdenes Recogida", href: "/dashboard/user/orders" },
        { icon: Store, label: "Órdenes Oficina", href: "/dashboard/user/office-orders" },
        { icon: BarChart3, label: "Mis Ventas", href: "/dashboard/user/sales" },
        { icon: DollarSign, label: "Comisiones", href: "/dashboard/user/commissions" }
      ]
    },
  ]

  // Menu items para BROKER (gestión de entregas y wallet)
  const brokerMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/broker" },
    { icon: Package, label: "Órdenes Cupones", href: "/dashboard/broker/orders" },
    { icon: Banknote, label: "Entregas Efectivo", href: "/dashboard/broker/cash-deliveries" },
    { icon: Wallet, label: "Mi Wallet", href: "/dashboard/broker/wallet" },
    { icon: Settings, label: "Configuración", href: "/dashboard/broker/settings" },
  ]

  // Menu items para MARKET (gestión de inventario, órdenes y entregas)
  const marketMenuItems = [
    { icon: Home, label: "Dashboard", href: "/dashboard/market" },
    { icon: Package, label: "Inventario", href: "/dashboard/market/inventory" },
    {
      icon: Warehouse,
      label: "Almacenes",
      href: "/dashboard/market/warehouses",
      hasSubmenu: true,
      submenuItems: [
        { icon: Warehouse, label: "Lista de Almacenes", href: "/dashboard/market/warehouses" },
        { icon: History, label: "Ajustes y Scrap", href: "/dashboard/market/warehouses/adjustments-history", requiredRoles: ['ADMIN', 'SUPER_ADMIN'] },
      ]
    },
    { icon: FileText, label: "Compras", href: "/dashboard/market/purchases" },
    { icon: Scale, label: "Etiquetas de Peso", href: "/dashboard/market/weight-labels" },
    {
      icon: Briefcase,
      label: "Mayoreo",
      href: "/dashboard/market/wholesale",
      hasSubmenu: true,
      submenuItems: [
        { icon: Users, label: "Clientes", href: "/dashboard/market/wholesale/customers" },
        { icon: FileText, label: "Cotizaciones", href: "/dashboard/market/wholesale/quotes" },
        { icon: Receipt, label: "Facturas", href: "/dashboard/market/wholesale/invoices" },
        { icon: Tag, label: "Listas de Precios", href: "/dashboard/market/pricelists" },
      ]
    },
    { icon: Store, label: "Marketplace", href: "/dashboard/market/marketplace" },
    {
      icon: Package,
      label: "Consignaciones",
      href: "/dashboard/market/consignments",
      hasSubmenu: true,
      submenuItems: [
        { icon: ClipboardList, label: "Órdenes", href: "/dashboard/market/consignments" },
        { icon: Users, label: "Proveedores", href: "/dashboard/market/consignments/suppliers" },
        { icon: Wallet, label: "Pagos", href: "/dashboard/market/consignments/payments" },
        { icon: BarChart3, label: "Reportes", href: "/dashboard/market/consignments/reports" },
      ]
    },
    { icon: ShoppingCart, label: "Órdenes Recibidas", href: "/dashboard/market/orders" },
    {
      icon: Monitor,
      label: "Punto de Venta",
      href: "/dashboard/market/pos",
      hasSubmenu: true,
      submenuItems: [
        { icon: Monitor, label: "Terminales", href: "/dashboard/market/pos" },
        { icon: ClipboardList, label: "Conteos Inventario", href: "/dashboard/market/pos/inventory-counts" },
      ]
    },
    {
      icon: Briefcase,
      label: "Recursos Humanos",
      href: "/dashboard/market/hr",
      hasSubmenu: true,
      submenuItems: [
        { icon: Users, label: "Empleados", href: "/dashboard/market/hr/employees" },
        { icon: FileText, label: "Contratos", href: "/dashboard/market/hr/contracts" },
        { icon: Building2, label: "Departamentos", href: "/dashboard/market/hr/departments" },
        { icon: Clock, label: "Horarios", href: "/dashboard/market/hr/schedules" },
        { icon: Calendar, label: "Asistencia", href: "/dashboard/market/hr/attendance" },
        { icon: Fingerprint, label: "Kioscos", href: "/dashboard/market/hr/kiosks" },
      ]
    },
    { icon: MessageCircle, label: "Conversaciones", href: "/dashboard/market/chat" },
    {
      icon: Calculator,
      label: "Contabilidad",
      href: "/dashboard/market/accounting",
      hasSubmenu: true,
      submenuItems: [
        { icon: BarChart3, label: "Dashboard", href: "/dashboard/market/accounting" },
        { icon: Receipt, label: "Gastos", href: "/dashboard/market/accounting/expenses" },
        { icon: Wallet, label: "Nomina", href: "/dashboard/market/accounting/payroll" },
        { icon: FileCheck, label: "Solicitudes", href: "/dashboard/market/accounting/requests" },
      ]
    },
    {
      icon: BarChart3,
      label: "Reportes",
      href: "/dashboard/market/reports",
      hasSubmenu: true,
      requiredRole: 'MARKET_MANAGER', // Solo visible para managers
      submenuItems: [
        { icon: TrendingUp, label: "Ventas", href: "/dashboard/market/reports/sales" },
        { icon: Percent, label: "Márgenes", href: "/dashboard/market/reports/margins" },
        { icon: Receipt, label: "Gastos", href: "/dashboard/market/reports/expenses" },
        { icon: Package, label: "Inventario", href: "/dashboard/market/reports/inventory" },
        { icon: Monitor, label: "Terminales POS", href: "/dashboard/market/reports/pos-terminals" },
      ]
    },
    { icon: ClipboardCheck, label: "Auditoría", href: "/dashboard/market/audits", requiredRole: 'MARKET_MANAGER' },
    { icon: Wallet, label: "Mi Wallet", href: "/dashboard/market/wallet" },
    { icon: Truck, label: "Entregas", href: "/dashboard/market/deliveries" },
    { icon: DollarSign, label: "Tasa de Cambio", href: "/dashboard/market/settings/exchange-rate", requiredRole: 'MARKET_MANAGER' },
    { icon: Settings, label: "Configuración", href: "/dashboard/market/settings" },
  ]

  // Menu items para MARKET_COMERCIAL (Compras, Marketplace, Inventario, Consignaciones - sin Dashboard)
  // NO tienen acceso a gestión de proveedores, solo pueden seleccionarlos en órdenes
  const marketComercialMenuItems = [
    { icon: FileText, label: "Compras", href: "/dashboard/market/purchases" },
    { icon: Store, label: "Marketplace", href: "/dashboard/market/marketplace" },
    { icon: Package, label: "Inventario", href: "/dashboard/market/inventory" },
    { icon: ClipboardList, label: "Consignaciones", href: "/dashboard/market/consignments" },
    { icon: MessageCircle, label: "Conversaciones", href: "/dashboard/market/chat" },
  ]

  // Menu items para MARKET_ALMACENERO (solo Almacenes - acceso a su almacén asignado)
  const marketAlmaceneroMenuItems = [
    { icon: Warehouse, label: "Almacenes", href: "/dashboard/market/warehouses" },
    { icon: MessageCircle, label: "Conversaciones", href: "/dashboard/market/chat" },
  ]

  // Menu items para MARKET_VENDEDOR (solo POS - acceso a terminales asignados)
  const marketVendedorMenuItems = [
    { icon: Monitor, label: "Punto de Venta", href: "/dashboard/market/pos" },
    { icon: MessageCircle, label: "Conversaciones", href: "/dashboard/market/chat" },
  ]

  // Menu items para MARKET_MANAGER_TIENDA (Almacén asignado + Terminales asignados)
  const marketManagerTiendaMenuItems = [
    { icon: Warehouse, label: "Mi Almacén", href: "/dashboard/market/warehouses" },
    {
      icon: Monitor,
      label: "Punto de Venta",
      href: "/dashboard/market/pos",
      hasSubmenu: true,
      submenuItems: [
        { icon: Monitor, label: "Terminales", href: "/dashboard/market/pos" },
        { icon: ClipboardList, label: "Conteos Inventario", href: "/dashboard/market/pos/inventory-counts" },
      ]
    },
    { icon: MessageCircle, label: "Conversaciones", href: "/dashboard/market/chat" },
  ]

  // Hook para verificar servicios habilitados
  const { hasService, hasSubmodule } = useEnabledServices()

  // Función para filtrar items del menú según servicios habilitados
  const filterMenuByServices = (items: any[]) => {
    return items
      .filter(item => {
        // Si no requiere servicio, siempre se muestra (ej: Dashboard, Usuarios, Configuración)
        if (!item.requiredService) return true

        // Si requiere servicio, verificar que esté habilitado
        return hasService(item.requiredService)
      })
      .map(item => {
        // Si tiene submenu, filtrar los subítems según permisos de submódulo y roles
        if (item.hasSubmenu && item.submenuItems) {
          const filteredSubmenuItems = item.submenuItems.filter((subItem: any) => {
            // Si requiere roles específicos, verificar que el usuario tenga uno de ellos
            if (subItem.requiredRoles && Array.isArray(subItem.requiredRoles)) {
              if (!subItem.requiredRoles.includes(user?.role)) return false
            }
            // Si no requiere submódulo, siempre se muestra
            if (!subItem.requiredSubmodule) return true
            // Verificar si tiene permiso para este submódulo
            return hasSubmodule(subItem.requiredSubmodule)
          })

          // Si no hay submódulos visibles, ocultar el menú padre
          if (filteredSubmenuItems.length === 0) return null

          return {
            ...item,
            submenuItems: filteredSubmenuItems
          }
        }
        return item
      })
      .filter(Boolean) // Eliminar items null (menús padres sin submódulos visibles)
  }

  // Seleccionar el menú adecuado según el rol del usuario y tipo de empresa
  // Si la empresa es de tipo 'broker' o 'market', mostrar menú correspondiente sin importar el rol
  const isBrokerCompany = user?.companyType === 'broker'
  const isMarketCompany = user?.companyType === 'market'

  // Seleccionar menú para empresas MARKET según el rol del empleado
  const getMarketMenu = () => {
    if (user?.role === 'MARKET_COMERCIAL') return marketComercialMenuItems
    if (user?.role === 'MARKET_ALMACENERO') return marketAlmaceneroMenuItems
    if (user?.role === 'MARKET_VENDEDOR') return marketVendedorMenuItems
    if (user?.role === 'MARKET_MANAGER_TIENDA') return marketManagerTiendaMenuItems
    // Filtrar items que requieren rol específico
    // ADMIN y SUPER_ADMIN pueden ver todos los items incluyendo los que requieren MARKET_MANAGER
    const higherRoles = ['ADMIN', 'SUPER_ADMIN', 'MARKET_MANAGER']
    return marketMenuItems.filter(item => {
      if (item.requiredRole) {
        // Si el usuario tiene un rol superior o igual, puede ver el item
        if (higherRoles.includes(user?.role || '')) {
          return true
        }
        // Si no, verificar si tiene el rol exacto
        return user?.role === item.requiredRole
      }
      return true
    })
  }

  let baseMenuItems = user?.role === 'SUPER_ADMIN' ? superAdminMenuItems :
                      isBrokerCompany ? brokerMenuItems :  // Priorizar tipo de empresa broker
                      isMarketCompany ? getMarketMenu() :  // Verificar rol MARKET
                      user?.role === 'ADMIN' ? adminMenuItems :
                      user?.role === 'MANAGER' ? managerMenuItems :
                      user?.role === 'BROKER' ? brokerMenuItems :
                      user?.role === 'USER' ? userMenuItems :
                      []

  // Filtrar menú según servicios habilitados (solo para usuarios de empresa)
  const menuItems = user?.role === 'SUPER_ADMIN' ? baseMenuItems : filterMenuByServices(baseMenuItems)

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
                    src={theme === 'light'
                      ? (branding?.logoUrlLight || branding?.logoUrl || "/images/negro.png")
                      : (branding?.logoUrlDark || branding?.logoUrl || "/images/blanco.png")}
                    alt={branding?.companyName || "LogiRapid"}
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
        <nav
          className={cn(
            "flex-1 space-y-2 overflow-y-auto sidebar-scroll",
            isCollapsed ? "px-3 py-2" : "px-4 py-4"
          )}
          style={{
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none' // IE/Edge
          } as React.CSSProperties}
        >
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

        {/* Mi Saldo Personal - Commission Balance for Market Employees */}
        {isMarketEmployee && commissionBalance?.isEmployee && commissionBalance.balance > 0 && !isCollapsed && (
          <div className={cn(
            "mx-3 my-2 p-3 rounded-xl cursor-pointer transition-all duration-200",
            theme === 'dark'
              ? "bg-gray-800/50 hover:bg-gray-800 border border-gray-700"
              : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
          )}
          onClick={() => router.push('/dashboard/market/my-commissions')}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                theme === 'dark' ? "bg-green-500/20" : "bg-green-100"
              )}>
                <Wallet className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? "text-green-400" : "text-green-600"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>Mi Saldo Personal</p>
                <p className={cn(
                  "text-lg font-bold",
                  theme === 'dark' ? "text-green-400" : "text-green-600"
                )}>
                  ${commissionBalance.balance.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed version - just show icon with balance indicator */}
        {isMarketEmployee && commissionBalance?.isEmployee && commissionBalance.balance > 0 && isCollapsed && (
          <motion.div
            className={cn(
              "mx-3 my-2 p-2 rounded-xl cursor-pointer flex items-center justify-center relative",
              theme === 'dark'
                ? "bg-gray-800/50 hover:bg-gray-800 border border-gray-700"
                : "bg-gray-50 hover:bg-gray-100 border border-gray-200"
            )}
            onClick={() => router.push('/dashboard/market/my-commissions')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Wallet className={cn(
              "w-5 h-5",
              theme === 'dark' ? "text-green-400" : "text-green-600"
            )} />
            {/* Balance indicator dot */}
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </motion.div>
        )}

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
              onClick={() => router.push('/developers')}
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
              onClick={() => router.push('/dashboard/support')}
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
