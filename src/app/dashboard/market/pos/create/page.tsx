'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Monitor,
  ChevronLeft,
  Warehouse,
  Users,
  DollarSign,
  Settings,
  CheckCircle,
  Loader2,
  AlertCircle,
  Plus,
  X,
  Tag
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface WarehouseOption {
  id: number
  name: string
  code: string
}

interface PricelistOption {
  id: number
  name: string
}

interface UserOption {
  id: number
  email: string
  firstname: string
  lastname: string
  role: string
}

export default function CreatePOSTerminalPage() {
  const { theme } = useTheme()
  const router = useRouter()

  // Form state
  const [name, setName] = useState('')
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
  const [pricelistId, setPricelistId] = useState<number | null>(null)
  const [allowPriceEdit, setAllowPriceEdit] = useState(false)
  const [allowDiscount, setAllowDiscount] = useState(true)
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(100)
  const [requireCustomer, setRequireCustomer] = useState(false)
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [acceptedCurrencies, setAcceptedCurrencies] = useState(['USD', 'CUP', 'MLC'])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])

  // Options state
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [pricelists, setPricelists] = useState<PricelistOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        // Fetch warehouses
        const whRes = await fetch('/api/market/warehouses')
        const whData = await whRes.json()
        if (whData.success) {
          setWarehouses(whData.data.warehouses)
        }

        // Fetch pricelists
        const plRes = await fetch('/api/market/pricelists')
        const plData = await plRes.json()
        if (plData.success) {
          setPricelists(plData.data.pricelists || [])
        }

        // Fetch users (company users)
        const usersRes = await fetch('/api/users')
        const usersData = await usersRes.json()
        if (usersData.success) {
          setUsers(usersData.data.users || usersData.data || [])
        }
      } catch (err) {
        console.error('Error fetching options:', err)
      } finally {
        setLoadingOptions(false)
      }
    }

    fetchOptions()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('El nombre es requerido')
      return
    }

    if (!warehouseId) {
      setError('Debe seleccionar un almacén')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/market/pos/terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          warehouseId,
          pricelistId,
          allowPriceEdit,
          allowDiscount,
          maxDiscountPercent,
          requireCustomer,
          defaultCurrency,
          acceptedCurrencies,
          userIds: selectedUsers
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push('/dashboard/market/pos')
      } else {
        setError(data.error || 'Error al crear terminal')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleCurrency = (currency: string) => {
    if (currency === defaultCurrency) return // Can't remove default

    setAcceptedCurrencies(prev =>
      prev.includes(currency)
        ? prev.filter(c => c !== currency)
        : [...prev, currency]
    )
  }

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => router.back()}
                className={cn(
                  'p-2 rounded-lg',
                  theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Nuevo Terminal POS
                </h1>
                <p className="text-gray-500">Configurar punto de venta</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className={cn(
                'rounded-2xl border shadow-xl p-6',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Información Básica
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Nombre del Terminal *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Caja Principal, POS Tienda 1"
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Almacén *
                    </label>
                    <select
                      value={warehouseId || ''}
                      onChange={(e) => setWarehouseId(e.target.value ? parseInt(e.target.value) : null)}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="">Seleccionar almacén...</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name} ({wh.code})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      El inventario se descontará de este almacén
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Lista de Precios
                    </label>
                    <select
                      value={pricelistId || ''}
                      onChange={(e) => setPricelistId(e.target.value ? parseInt(e.target.value) : null)}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="">Precios por defecto</option>
                      {pricelists.map(pl => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Currency Settings */}
              <div className={cn(
                'rounded-2xl border shadow-xl p-6',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Configuración de Monedas
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Moneda por Defecto
                    </label>
                    <div className="flex gap-2">
                      {['USD', 'CUP', 'MLC'].map(currency => (
                        <button
                          key={currency}
                          type="button"
                          onClick={() => {
                            setDefaultCurrency(currency)
                            if (!acceptedCurrencies.includes(currency)) {
                              setAcceptedCurrencies(prev => [...prev, currency])
                            }
                          }}
                          className={cn(
                            'flex-1 py-3 rounded-xl font-medium transition-all',
                            defaultCurrency === currency
                              ? 'bg-blue-500 text-white'
                              : theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600'
                              : 'bg-gray-100 hover:bg-gray-200'
                          )}
                        >
                          {currency}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Monedas Aceptadas
                    </label>
                    <div className="flex gap-2">
                      {['USD', 'CUP', 'MLC'].map(currency => (
                        <button
                          key={currency}
                          type="button"
                          onClick={() => toggleCurrency(currency)}
                          disabled={currency === defaultCurrency}
                          className={cn(
                            'flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                            acceptedCurrencies.includes(currency)
                              ? 'bg-green-500 text-white'
                              : theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600'
                              : 'bg-gray-100 hover:bg-gray-200',
                            currency === defaultCurrency && 'opacity-70 cursor-not-allowed'
                          )}
                        >
                          {acceptedCurrencies.includes(currency) && <CheckCircle className="w-4 h-4" />}
                          {currency}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className={cn(
                'rounded-2xl border shadow-xl p-6',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuración de Permisos
                </h2>

                <div className="space-y-4">
                  <label className={cn(
                    'flex items-center justify-between p-4 rounded-xl cursor-pointer',
                    theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                  )}>
                    <div>
                      <p className="font-medium">Permitir editar precios</p>
                      <p className="text-sm text-gray-500">Los cajeros pueden modificar el precio de venta</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowPriceEdit}
                      onChange={(e) => setAllowPriceEdit(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                  </label>

                  <label className={cn(
                    'flex items-center justify-between p-4 rounded-xl cursor-pointer',
                    theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                  )}>
                    <div>
                      <p className="font-medium">Permitir descuentos</p>
                      <p className="text-sm text-gray-500">Los cajeros pueden aplicar descuentos</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowDiscount}
                      onChange={(e) => setAllowDiscount(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                  </label>

                  {allowDiscount && (
                    <div className="pl-4">
                      <label className="block text-sm font-medium mb-2">
                        Descuento máximo permitido (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={maxDiscountPercent}
                        onChange={(e) => setMaxDiscountPercent(parseInt(e.target.value) || 0)}
                        className={cn(
                          'w-32 px-4 py-2 rounded-xl border focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                  )}

                  <label className={cn(
                    'flex items-center justify-between p-4 rounded-xl cursor-pointer',
                    theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                  )}>
                    <div>
                      <p className="font-medium">Requerir cliente</p>
                      <p className="text-sm text-gray-500">Obligatorio seleccionar cliente para cada venta</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={requireCustomer}
                      onChange={(e) => setRequireCustomer(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Users */}
              <div className={cn(
                'rounded-2xl border shadow-xl p-6',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Usuarios Asignados
                </h2>

                <p className="text-sm text-gray-500 mb-4">
                  Selecciona los usuarios que tendrán acceso a este terminal
                </p>

                {loadingOptions ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay usuarios disponibles
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {users.map(user => (
                      <label
                        key={user.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all',
                          selectedUsers.includes(user.id)
                            ? theme === 'dark' ? 'bg-blue-900/30 border border-blue-500' : 'bg-blue-50 border border-blue-500'
                            : theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUser(user.id)}
                          className="w-4 h-4 rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium">
                            {user.firstname && user.lastname
                              ? `${user.firstname} ${user.lastname}`
                              : user.email}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <span className={cn(
                          'text-xs px-2 py-1 rounded-full',
                          user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        )}>
                          {user.role}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {selectedUsers.length > 0 && (
                  <p className="text-sm text-blue-500 mt-3">
                    {selectedUsers.length} usuario(s) seleccionado(s)
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className={cn(
                  'p-4 rounded-xl flex items-center gap-2',
                  theme === 'dark'
                    ? 'bg-red-900/30 text-red-300 border border-red-800'
                    : 'bg-red-50 text-red-600 border border-red-200'
                )}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  disabled={submitting}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium',
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim() || !warehouseId}
                  className={cn(
                    'flex-[2] py-3 rounded-xl font-bold flex items-center justify-center gap-2',
                    'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25',
                    (submitting || !name.trim() || !warehouseId)
                      ? 'opacity-70 cursor-not-allowed'
                      : 'hover:from-blue-600 hover:to-blue-700'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Crear Terminal
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
