'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  Monitor,
  Users,
  CreditCard,
  Warehouse,
  DollarSign,
  Percent,
  Save,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  User,
  Shield,
  Banknote,
  Smartphone,
  FileText,
  Check,
  X,
  Building2,
  Zap,
  Lock,
  Unlock
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

interface Terminal {
  id: number
  code: string
  name: string
  warehouseId: number | null
  warehouseName: string | null
  pricelistId: number | null
  pricelistName: string | null
  allowPriceEdit: boolean
  allowDiscount: boolean
  maxDiscountPercent: number
  requireCustomer: boolean
  defaultCurrency: string
  acceptedCurrencies: string[]
  isActive: boolean
  users: TerminalUser[]
  stats?: {
    openSessions: number
    closedSessions: number
    totalSales: number
    totalOrders: number
  }
}

interface TerminalUser {
  userId: number
  name: string
  email: string
  role: string
  permissions: {
    canOpenSession: boolean
    canCloseSession: boolean
    canVoidOrders: boolean
    canGiveDiscount: boolean
    canRefund: boolean
  }
}

interface CompanyUser {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
}

interface WarehouseOption {
  id: number
  name: string
  code: string
}

const CURRENCIES = [
  { id: 'USD', label: 'Dólar', symbol: '$', flag: '🇺🇸' },
  { id: 'CUP', label: 'Peso Cubano', symbol: '$', flag: '🇨🇺' },
  { id: 'MLC', label: 'MLC', symbol: '€', flag: '💳' }
]

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', icon: Banknote, color: 'green' },
  { id: 'card', label: 'Tarjeta', icon: CreditCard, color: 'blue' },
  { id: 'transfer', label: 'Transferencia', icon: Smartphone, color: 'purple' },
  { id: 'credit', label: 'Crédito', icon: FileText, color: 'amber' }
]

export default function POSSettingsPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const terminalId = params.terminalId as string

  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
  const [allowPriceEdit, setAllowPriceEdit] = useState(false)
  const [allowDiscount, setAllowDiscount] = useState(true)
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(100)
  const [requireCustomer, setRequireCustomer] = useState(false)
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [acceptedCurrencies, setAcceptedCurrencies] = useState<string[]>(['USD', 'CUP', 'MLC'])
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<string[]>(['cash', 'card', 'transfer', 'credit'])
  const [isActive, setIsActive] = useState(true)
  const [assignedUsers, setAssignedUsers] = useState<TerminalUser[]>([])

  // Available data
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  // Fetch terminal data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch terminal
        const terminalRes = await fetch(`/api/market/pos/terminals/${terminalId}`)
        const terminalData = await terminalRes.json()

        if (!terminalData.success) {
          throw new Error(terminalData.error || 'Error al cargar terminal')
        }

        const t = terminalData.data
        setTerminal(t)
        setName(t.name || '')
        setWarehouseId(t.warehouseId)
        setAllowPriceEdit(t.allowPriceEdit ?? false)
        setAllowDiscount(t.allowDiscount ?? true)
        setMaxDiscountPercent(t.maxDiscountPercent ?? 100)
        setRequireCustomer(t.requireCustomer ?? false)
        setDefaultCurrency(t.defaultCurrency || 'USD')
        const currencies = t.acceptedCurrencies
        setAcceptedCurrencies(Array.isArray(currencies) ? currencies : ['USD', 'CUP', 'MLC'])
        setIsActive(t.isActive ?? true)
        setAssignedUsers(Array.isArray(t.users) ? t.users : [])

        // Fetch warehouses
        const warehousesRes = await fetch('/api/market/warehouses')
        const warehousesData = await warehousesRes.json()
        if (warehousesData.success) {
          const wh = warehousesData.data?.warehouses || warehousesData.data
          setWarehouses(Array.isArray(wh) ? wh : [])
        }

        // Fetch company users
        const usersRes = await fetch('/api/users')
        const usersData = await usersRes.json()
        if (usersData.success) {
          const users = usersData.data?.users || usersData.data
          setCompanyUsers(Array.isArray(users) ? users : [])
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar configuración')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [terminalId])

  // Save settings
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/market/pos/terminals/${terminalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          warehouseId,
          allowPriceEdit,
          allowDiscount,
          maxDiscountPercent,
          requireCustomer,
          defaultCurrency,
          acceptedCurrencies: JSON.stringify(acceptedCurrencies), // Convertir a JSON string
          isActive,
          users: assignedUsers.map(u => ({
            userId: u.userId,
            permissions: u.permissions
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Configuracion guardada exitosamente')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        throw new Error(data.error || 'Error al guardar')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar configuracion')
    } finally {
      setSaving(false)
    }
  }

  // Add user
  const addUser = () => {
    if (!selectedUserId) return

    const user = companyUsers.find(u => u.id === selectedUserId)
    if (!user) return

    if (assignedUsers.some(u => u.userId === selectedUserId)) {
      setError('Este usuario ya esta asignado')
      return
    }

    setAssignedUsers([...assignedUsers, {
      userId: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      email: user.email,
      role: user.role,
      permissions: {
        canOpenSession: true,
        canCloseSession: true,
        canVoidOrders: false,
        canGiveDiscount: true,
        canRefund: false
      }
    }])

    setSelectedUserId(null)
    setShowAddUser(false)
  }

  // Remove user
  const removeUser = (userId: number) => {
    setAssignedUsers(assignedUsers.filter(u => u.userId !== userId))
  }

  // Toggle user permission
  const togglePermission = (userId: number, permission: keyof TerminalUser['permissions']) => {
    setAssignedUsers(assignedUsers.map(u => {
      if (u.userId === userId) {
        return {
          ...u,
          permissions: {
            ...u.permissions,
            [permission]: !u.permissions[permission]
          }
        }
      }
      return u
    }))
  }

  // Toggle currency
  const toggleCurrency = (currency: string) => {
    if (acceptedCurrencies.includes(currency)) {
      if (acceptedCurrencies.length > 1) {
        setAcceptedCurrencies(acceptedCurrencies.filter(c => c !== currency))
        if (defaultCurrency === currency) {
          setDefaultCurrency(acceptedCurrencies.find(c => c !== currency) || 'USD')
        }
      }
    } else {
      setAcceptedCurrencies([...acceptedCurrencies, currency])
    }
  }

  // Toggle payment method
  const togglePaymentMethod = (method: string) => {
    if (acceptedPaymentMethods.includes(method)) {
      if (acceptedPaymentMethods.length > 1) {
        setAcceptedPaymentMethods(acceptedPaymentMethods.filter(m => m !== method))
      }
    } else {
      setAcceptedPaymentMethods([...acceptedPaymentMethods, method])
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-500">Cargando configuracion...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!terminal) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Terminal no encontrado</h2>
          <p className="text-gray-500 mb-6">{error || 'No se pudo cargar el terminal'}</p>
          <button
            onClick={() => router.push('/dashboard/market/pos')}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600"
          >
            Volver a Terminales
          </button>
        </div>
      </DashboardLayout>
    )
  }

  const selectedWarehouse = warehouses.find(w => w.id === warehouseId)

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        {/* Notifications */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 left-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5" />
              {error}
              <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 left-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5" />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/market/pos')}
              className={cn(
                'p-3 rounded-xl transition-all',
                theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100 shadow-sm'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl',
                  theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                )}>
                  <Monitor className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Configuracion del Terminal</h1>
                  <p className="text-gray-500">{terminal.code} - {terminal.name}</p>
                </div>
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg',
              saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
            )}
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </motion.button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Sesiones Abiertas', value: terminal.stats?.openSessions ?? 0, icon: Zap, color: 'green' },
            { label: 'Sesiones Cerradas', value: terminal.stats?.closedSessions ?? 0, icon: Lock, color: 'gray' },
            { label: 'Ventas Totales', value: `$${(terminal.stats?.totalSales ?? 0).toFixed(2)}`, icon: DollarSign, color: 'blue' },
            { label: 'Ordenes', value: terminal.stats?.totalOrders ?? 0, icon: FileText, color: 'purple' }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                'p-4 rounded-2xl',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-2 rounded-lg',
                  stat.color === 'green' && 'bg-green-100 dark:bg-green-900/30',
                  stat.color === 'gray' && 'bg-gray-100 dark:bg-gray-700',
                  stat.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30',
                  stat.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30'
                )}>
                  <stat.icon className={cn(
                    'w-5 h-5',
                    stat.color === 'green' && 'text-green-600',
                    stat.color === 'gray' && 'text-gray-600',
                    stat.color === 'blue' && 'text-blue-600',
                    stat.color === 'purple' && 'text-purple-600'
                  )} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-2xl p-6',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
            )}
          >
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-500" />
              Configuracion General
            </h2>

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Nombre del Terminal
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Caja Principal"
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-0',
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                  )}
                />
              </div>

              {/* Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Almacen de Inventario
                </label>
                <div className="relative">
                  <Warehouse className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={warehouseId || ''}
                    onChange={(e) => setWarehouseId(e.target.value ? parseInt(e.target.value) : null)}
                    className={cn(
                      'w-full pl-12 pr-4 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-0 appearance-none',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 focus:border-blue-500'
                        : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                    )}
                  >
                    <option value="">Sin almacen asignado</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedWarehouse && (
                  <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Inventario vinculado a: {selectedWarehouse.name}
                  </p>
                )}
              </div>

              {/* Status Toggle */}
              <div className={cn(
                'flex items-center justify-between p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              )}>
                <div className="flex items-center gap-3">
                  {isActive ? (
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Unlock className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <Lock className="w-5 h-5 text-red-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">Estado del Terminal</p>
                    <p className="text-sm text-gray-500">
                      {isActive ? 'Activo y operativo' : 'Desactivado'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={cn(
                    'relative w-14 h-8 rounded-full transition-colors',
                    isActive ? 'bg-green-500' : 'bg-gray-400'
                  )}
                >
                  <motion.div
                    animate={{ x: isActive ? 24 : 4 }}
                    className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Currency & Payments */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'rounded-2xl p-6',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
            )}
          >
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Monedas y Pagos
            </h2>

            {/* Currencies */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-500 mb-3">
                Monedas Aceptadas
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CURRENCIES.map(currency => {
                  const isEnabled = acceptedCurrencies.includes(currency.id)
                  const isDefault = defaultCurrency === currency.id
                  return (
                    <button
                      key={currency.id}
                      onClick={() => toggleCurrency(currency.id)}
                      className={cn(
                        'relative p-4 rounded-xl border-2 transition-all text-center',
                        isEnabled
                          ? isDefault
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 opacity-50'
                      )}
                    >
                      <span className="text-2xl mb-1 block">{currency.flag}</span>
                      <p className="font-bold">{currency.id}</p>
                      <p className="text-xs text-gray-500">{currency.label}</p>
                      {isDefault && (
                        <span className="absolute top-2 right-2 text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                      {isEnabled && !isDefault && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDefaultCurrency(currency.id)
                          }}
                          className="absolute top-2 right-2 text-[10px] bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded hover:bg-blue-500 hover:text-white"
                        >
                          Set
                        </button>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-3">
                Metodos de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(method => {
                  const isEnabled = acceptedPaymentMethods.includes(method.id)
                  const Icon = method.icon
                  return (
                    <button
                      key={method.id}
                      onClick={() => togglePaymentMethod(method.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                        isEnabled
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-600 opacity-50'
                      )}
                    >
                      <div className={cn(
                        'p-2 rounded-lg',
                        method.color === 'green' && 'bg-green-100 dark:bg-green-900/50',
                        method.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/50',
                        method.color === 'purple' && 'bg-purple-100 dark:bg-purple-900/50',
                        method.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/50'
                      )}>
                        <Icon className={cn(
                          'w-4 h-4',
                          method.color === 'green' && 'text-green-600',
                          method.color === 'blue' && 'text-blue-600',
                          method.color === 'purple' && 'text-purple-600',
                          method.color === 'amber' && 'text-amber-600'
                        )} />
                      </div>
                      <span className="font-medium">{method.label}</span>
                      {isEnabled && (
                        <Check className="w-4 h-4 text-green-500 ml-auto" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>

          {/* Permissions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              'rounded-2xl p-6',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
            )}
          >
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-500" />
              Permisos del Terminal
            </h2>

            <div className="space-y-3">
              {/* Allow Price Edit */}
              <div className={cn(
                'flex items-center justify-between p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              )}>
                <div>
                  <p className="font-medium">Editar Precios</p>
                  <p className="text-sm text-gray-500">Permitir modificar precios en venta</p>
                </div>
                <button
                  onClick={() => setAllowPriceEdit(!allowPriceEdit)}
                  className={cn(
                    'relative w-12 h-7 rounded-full transition-colors',
                    allowPriceEdit ? 'bg-purple-500' : 'bg-gray-400'
                  )}
                >
                  <motion.div
                    animate={{ x: allowPriceEdit ? 22 : 4 }}
                    className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              {/* Allow Discount */}
              <div className={cn(
                'flex items-center justify-between p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              )}>
                <div>
                  <p className="font-medium">Aplicar Descuentos</p>
                  <p className="text-sm text-gray-500">Permitir descuentos en productos</p>
                </div>
                <button
                  onClick={() => setAllowDiscount(!allowDiscount)}
                  className={cn(
                    'relative w-12 h-7 rounded-full transition-colors',
                    allowDiscount ? 'bg-purple-500' : 'bg-gray-400'
                  )}
                >
                  <motion.div
                    animate={{ x: allowDiscount ? 22 : 4 }}
                    className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>

              {/* Max Discount */}
              {allowDiscount && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={cn(
                    'p-4 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Descuento Maximo</p>
                    <span className="text-2xl font-bold text-purple-500">{maxDiscountPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={maxDiscountPercent}
                    onChange={(e) => setMaxDiscountPercent(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </motion.div>
              )}

              {/* Require Customer */}
              <div className={cn(
                'flex items-center justify-between p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
              )}>
                <div>
                  <p className="font-medium">Requerir Cliente</p>
                  <p className="text-sm text-gray-500">Obligar seleccion de cliente</p>
                </div>
                <button
                  onClick={() => setRequireCustomer(!requireCustomer)}
                  className={cn(
                    'relative w-12 h-7 rounded-full transition-colors',
                    requireCustomer ? 'bg-purple-500' : 'bg-gray-400'
                  )}
                >
                  <motion.div
                    animate={{ x: requireCustomer ? 22 : 4 }}
                    className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                  />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Users */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              'rounded-2xl p-6',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
            )}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                Cajeros Asignados
              </h2>
              <button
                onClick={() => setShowAddUser(true)}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-amber-600"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>

            {/* Add User Modal */}
            <AnimatePresence>
              {showAddUser && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    'mb-4 p-4 rounded-xl border-2 border-dashed',
                    theme === 'dark' ? 'border-gray-600 bg-gray-700/50' : 'border-gray-300 bg-gray-50'
                  )}
                >
                  <p className="text-sm font-medium mb-3">Seleccionar Usuario</p>
                  <div className="flex gap-2">
                    <select
                      value={selectedUserId || ''}
                      onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-xl border-2',
                        theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                      )}
                    >
                      <option value="">Seleccionar...</option>
                      {companyUsers
                        .filter(u => !assignedUsers.some(au => au.userId === u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={addUser}
                      disabled={!selectedUserId}
                      className="px-4 py-2 bg-green-500 text-white rounded-xl disabled:opacity-50"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setShowAddUser(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-xl"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Users List */}
            {assignedUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500">No hay cajeros asignados</p>
                <p className="text-sm text-gray-400">Agrega usuarios para que puedan operar este terminal</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedUsers.map(user => (
                  <div
                    key={user.userId}
                    className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center font-bold',
                          theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                        )}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeUser(user.userId)}
                        className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Permission Pills */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'canOpenSession', label: 'Abrir' },
                        { key: 'canCloseSession', label: 'Cerrar' },
                        { key: 'canGiveDiscount', label: 'Descuento' },
                        { key: 'canVoidOrders', label: 'Anular' },
                        { key: 'canRefund', label: 'Reembolso' }
                      ].map(perm => (
                        <button
                          key={perm.key}
                          onClick={() => togglePermission(user.userId, perm.key as keyof TerminalUser['permissions'])}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                            user.permissions[perm.key as keyof TerminalUser['permissions']]
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-200 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                          )}
                        >
                          {perm.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  )
}
