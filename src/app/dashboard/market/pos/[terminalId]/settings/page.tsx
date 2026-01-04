'use client'

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react'
import { motion } from 'framer-motion'
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
  ToggleLeft,
  ToggleRight
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

// Error Boundary para capturar errores de renderizado
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('POS Settings Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-red-500 mb-2">Error en la página</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-center max-w-md">
              {this.state.error?.message || 'Ocurrió un error inesperado'}
            </p>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-xs max-w-lg overflow-auto mb-4">
              {this.state.error?.stack?.slice(0, 500)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Recargar página
            </button>
          </div>
        </DashboardLayout>
      )
    }

    return this.props.children
  }
}

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
  firstname: string
  lastname: string
  email: string
  role: string
}

interface Warehouse {
  id: number
  name: string
  code: string
}

const CURRENCIES = [
  { id: 'USD', label: 'Dólar (USD)', symbol: '$' },
  { id: 'CUP', label: 'Peso Cubano (CUP)', symbol: '$' },
  { id: 'MLC', label: 'MLC (EUR)', symbol: '€' }
]

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', icon: Banknote, description: 'Pagos en efectivo' },
  { id: 'card', label: 'Tarjeta', icon: CreditCard, description: 'Pagos con tarjeta' },
  { id: 'transfer', label: 'Transferencia', icon: Smartphone, description: 'Transferencias bancarias' },
  { id: 'credit', label: 'Crédito', icon: FileText, description: 'Ventas a crédito' }
]

function POSSettingsPageContent() {
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
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  // Active tab
  const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'users' | 'advanced'>('general')

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
        // Ensure acceptedCurrencies is always an array
        const currencies = t.acceptedCurrencies
        setAcceptedCurrencies(Array.isArray(currencies) ? currencies : ['USD', 'CUP', 'MLC'])
        setIsActive(t.isActive ?? true)
        // Ensure users is always an array
        setAssignedUsers(Array.isArray(t.users) ? t.users : [])

        // Fetch warehouses
        const warehousesRes = await fetch('/api/market/warehouses')
        const warehousesData = await warehousesRes.json()
        if (warehousesData.success) {
          const wh = warehousesData.data
          setWarehouses(Array.isArray(wh) ? wh : [])
        }

        // Fetch company users
        const usersRes = await fetch('/api/users')
        const usersData = await usersRes.json()
        if (usersData.success) {
          const users = usersData.data
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
          acceptedCurrencies,
          isActive,
          users: assignedUsers.map(u => ({
            userId: u.userId,
            permissions: u.permissions
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Configuración guardada exitosamente')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        throw new Error(data.error || 'Error al guardar')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  // Add user
  const addUser = () => {
    if (!selectedUserId) return

    const user = companyUsers.find(u => u.id === selectedUserId)
    if (!user) return

    // Check if already assigned
    if (assignedUsers.some(u => u.userId === selectedUserId)) {
      setError('Este usuario ya está asignado')
      return
    }

    setAssignedUsers([...assignedUsers, {
      userId: user.id,
      name: [user.firstname, user.lastname].filter(Boolean).join(' ') || user.email,
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (!terminal) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-red-500">{error || 'Terminal no encontrado'}</p>
          <button
            onClick={() => router.push('/dashboard/market/pos')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Volver
          </button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/market/pos')}
              className={cn(
                'p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Configuración del Terminal
              </h1>
              <p className="text-gray-500">{terminal.code} - {terminal.name}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'px-6 py-2 rounded-lg font-medium flex items-center gap-2',
              saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            )}
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Guardar Cambios
          </button>
        </div>

        {/* Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-lg bg-red-100 text-red-700 flex items-center gap-2"
          >
            <AlertCircle className="w-5 h-5" />
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-lg bg-green-100 text-green-700 flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {success}
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className={cn(
            'p-4 rounded-xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
          )}>
            <p className="text-sm text-gray-500">Sesiones Abiertas</p>
            <p className="text-2xl font-bold">{terminal.stats?.openSessions ?? 0}</p>
          </div>
          <div className={cn(
            'p-4 rounded-xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
          )}>
            <p className="text-sm text-gray-500">Sesiones Cerradas</p>
            <p className="text-2xl font-bold">{terminal.stats?.closedSessions ?? 0}</p>
          </div>
          <div className={cn(
            'p-4 rounded-xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
          )}>
            <p className="text-sm text-gray-500">Ventas Totales</p>
            <p className="text-2xl font-bold">${(terminal.stats?.totalSales ?? 0).toFixed(2)}</p>
          </div>
          <div className={cn(
            'p-4 rounded-xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
          )}>
            <p className="text-sm text-gray-500">Órdenes Totales</p>
            <p className="text-2xl font-bold">{terminal.stats?.totalOrders ?? 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'general', label: 'General', icon: Monitor },
            { id: 'payments', label: 'Pagos', icon: CreditCard },
            { id: 'users', label: 'Cajeros', icon: Users },
            { id: 'advanced', label: 'Avanzado', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all',
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700'
                    : 'bg-gray-100 hover:bg-gray-200'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className={cn(
          'rounded-xl p-6',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
        )}>
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Nombre del Terminal</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(
                    'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500',
                    theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Almacén</label>
                <select
                  value={warehouseId || ''}
                  onChange={(e) => setWarehouseId(e.target.value ? parseInt(e.target.value) : null)}
                  className={cn(
                    'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500',
                    theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  )}
                >
                  <option value="">Sin almacén</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">El almacén determina de dónde se descuenta el inventario</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                <div>
                  <p className="font-medium">Terminal Activo</p>
                  <p className="text-sm text-gray-500">Desactiva el terminal para evitar que se use</p>
                </div>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={cn(
                    'p-2 rounded-lg',
                    isActive ? 'text-green-500' : 'text-gray-400'
                  )}
                >
                  {isActive ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Default Currency */}
              <div>
                <label className="block text-sm font-medium mb-2">Moneda Predeterminada</label>
                <div className="grid grid-cols-3 gap-2">
                  {CURRENCIES.map(currency => (
                    <button
                      key={currency.id}
                      onClick={() => setDefaultCurrency(currency.id)}
                      disabled={!acceptedCurrencies.includes(currency.id)}
                      className={cn(
                        'p-3 rounded-lg border-2 transition-all',
                        defaultCurrency === currency.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600',
                        !acceptedCurrencies.includes(currency.id) && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <p className="font-bold text-lg">{currency.symbol}</p>
                      <p className="text-sm">{currency.id}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accepted Currencies */}
              <div>
                <label className="block text-sm font-medium mb-2">Monedas Aceptadas</label>
                <div className="space-y-2">
                  {CURRENCIES.map(currency => (
                    <div
                      key={currency.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium">{currency.label}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleCurrency(currency.id)}
                        className={cn(
                          'p-2 rounded-lg',
                          acceptedCurrencies.includes(currency.id) ? 'text-green-500' : 'text-gray-400'
                        )}
                      >
                        {acceptedCurrencies.includes(currency.id) ? (
                          <ToggleRight className="w-8 h-8" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-sm font-medium mb-2">Métodos de Pago</label>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map(method => {
                    const Icon = method.icon
                    return (
                      <div
                        key={method.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{method.label}</p>
                            <p className="text-sm text-gray-500">{method.description}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => togglePaymentMethod(method.id)}
                          className={cn(
                            'p-2 rounded-lg',
                            acceptedPaymentMethods.includes(method.id) ? 'text-green-500' : 'text-gray-400'
                          )}
                        >
                          {acceptedPaymentMethods.includes(method.id) ? (
                            <ToggleRight className="w-8 h-8" />
                          ) : (
                            <ToggleLeft className="w-8 h-8" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Cajeros Asignados</h3>
                  <p className="text-sm text-gray-500">Usuarios que pueden operar este terminal</p>
                </div>
                <button
                  onClick={() => setShowAddUser(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Cajero
                </button>
              </div>

              {/* Add User Modal */}
              {showAddUser && (
                <div className={cn(
                  'p-4 rounded-lg border-2 border-dashed',
                  theme === 'dark' ? 'border-gray-600 bg-gray-700/50' : 'border-gray-300 bg-gray-50'
                )}>
                  <div className="flex gap-4">
                    <select
                      value={selectedUserId || ''}
                      onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500',
                        theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                      )}
                    >
                      <option value="">Seleccionar usuario...</option>
                      {companyUsers
                        .filter(u => !assignedUsers.some(au => au.userId === u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>
                            {[u.firstname, u.lastname].filter(Boolean).join(' ') || u.email} ({u.role})
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={addUser}
                      disabled={!selectedUserId}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Agregar
                    </button>
                    <button
                      onClick={() => setShowAddUser(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Users List */}
              {assignedUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay cajeros asignados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assignedUsers.map(user => (
                    <div
                      key={user.userId}
                      className={cn(
                        'p-4 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                          )}>
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                          <span className={cn(
                            'px-2 py-1 rounded text-xs font-medium',
                            user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                          )}>
                            {user.role}
                          </span>
                        </div>
                        <button
                          onClick={() => removeUser(user.userId)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Permissions */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {[
                          { key: 'canOpenSession', label: 'Abrir Caja' },
                          { key: 'canCloseSession', label: 'Cerrar Caja' },
                          { key: 'canGiveDiscount', label: 'Dar Descuento' },
                          { key: 'canVoidOrders', label: 'Anular Ventas' },
                          { key: 'canRefund', label: 'Reembolsos' }
                        ].map(perm => (
                          <button
                            key={perm.key}
                            onClick={() => togglePermission(user.userId, perm.key as keyof TerminalUser['permissions'])}
                            className={cn(
                              'px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-all',
                              user.permissions[perm.key as keyof TerminalUser['permissions']]
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-400 dark:bg-gray-600 dark:text-gray-400'
                            )}
                          >
                            <Shield className="w-3 h-3" />
                            {perm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                <div>
                  <p className="font-medium">Permitir Edición de Precios</p>
                  <p className="text-sm text-gray-500">Los cajeros pueden modificar precios durante la venta</p>
                </div>
                <button
                  onClick={() => setAllowPriceEdit(!allowPriceEdit)}
                  className={cn(
                    'p-2 rounded-lg',
                    allowPriceEdit ? 'text-green-500' : 'text-gray-400'
                  )}
                >
                  {allowPriceEdit ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                <div>
                  <p className="font-medium">Permitir Descuentos</p>
                  <p className="text-sm text-gray-500">Los cajeros pueden aplicar descuentos</p>
                </div>
                <button
                  onClick={() => setAllowDiscount(!allowDiscount)}
                  className={cn(
                    'p-2 rounded-lg',
                    allowDiscount ? 'text-green-500' : 'text-gray-400'
                  )}
                >
                  {allowDiscount ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>

              {allowDiscount && (
                <div>
                  <label className="block text-sm font-medium mb-2">Descuento Máximo (%)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={maxDiscountPercent}
                      onChange={(e) => setMaxDiscountPercent(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1 w-20">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={maxDiscountPercent}
                        onChange={(e) => setMaxDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                        className={cn(
                          'w-16 px-2 py-1 rounded border text-center',
                          theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                        )}
                      />
                      <Percent className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
                <div>
                  <p className="font-medium">Requerir Cliente</p>
                  <p className="text-sm text-gray-500">Obligar a seleccionar un cliente para cada venta</p>
                </div>
                <button
                  onClick={() => setRequireCustomer(!requireCustomer)}
                  className={cn(
                    'p-2 rounded-lg',
                    requireCustomer ? 'text-green-500' : 'text-gray-400'
                  )}
                >
                  {requireCustomer ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

// Wrapper con ErrorBoundary
export default function POSSettingsPage() {
  return (
    <ErrorBoundary>
      <POSSettingsPageContent />
    </ErrorBoundary>
  )
}
