'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  UserPlus,
  UserMinus,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  Search,
  Shield,
  X
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

interface Cashier {
  employeeId: number
  employeeCode: string
  userId: number
  email: string
  firstName: string | null
  lastName: string | null
  fullName: string
  role: string
  permissions: {
    canOpenSession: boolean
    canCloseSession: boolean
    canVoidOrders: boolean
    canGiveDiscount: boolean
    canRefund: boolean
    maxDiscountPercent: number
  }
  assignedAt: string
}

interface AvailableEmployee {
  employeeId: number
  employeeCode: string
  email: string
  firstName: string | null
  lastName: string | null
  fullName: string
  role: string
}

interface Terminal {
  id: number
  name: string
}

export default function TerminalCashiersPage() {
  const router = useRouter()
  const params = useParams()
  const terminalId = params.terminalId as string
  const { theme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [availableEmployees, setAvailableEmployees] = useState<AvailableEmployee[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState<Cashier | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchCashiers()
  }, [terminalId])

  const fetchCashiers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/market/pos/terminals/${terminalId}/cashiers`)
      const result = await response.json()

      if (result.success) {
        setTerminal(result.data.terminal)
        setCashiers(result.data.cashiers)
        setAvailableEmployees(result.data.availableEmployees)
      } else {
        setError(result.error || 'Error al cargar cajeros')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const addCashier = async (employee: AvailableEmployee) => {
    try {
      setSaving(true)
      setError('')

      const response = await fetch(`/api/market/pos/terminals/${terminalId}/cashiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: employee.employeeId,
          canOpenSession: true,
          canCloseSession: true,
          canVoidOrders: false,
          canGiveDiscount: false,
          canRefund: false,
          maxDiscountPercent: 0
        })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('Cajero agregado exitosamente')
        setShowAddModal(false)
        fetchCashiers()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(result.error || 'Error al agregar cajero')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const removeCashier = async (cashier: Cashier) => {
    try {
      setSaving(true)
      setError('')

      const response = await fetch(
        `/api/market/pos/terminals/${terminalId}/cashiers?employeeId=${cashier.employeeId}`,
        { method: 'DELETE' }
      )

      const result = await response.json()

      if (result.success) {
        setSuccess('Cajero removido exitosamente')
        setShowRemoveModal(null)
        fetchCashiers()
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError(result.error || 'Error al remover cajero')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const filteredEmployees = availableEmployees.filter(emp =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen p-4 sm:p-6 lg:p-8",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <motion.button
              onClick={() => router.back()}
              className={cn(
                "p-2 rounded-xl transition-colors",
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                  : 'bg-white hover:bg-gray-100 text-gray-600 shadow-sm'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
            <div>
              <h1 className={cn(
                "text-2xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Gestionar Cajeros
              </h1>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Terminal: {terminal?.name || 'Cargando...'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700 dark:text-red-400">{error}</span>
                <button onClick={() => setError('')} className="ml-auto">
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3"
              >
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-green-700 dark:text-green-400">{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Cashier Button */}
          <motion.button
            onClick={() => setShowAddModal(true)}
            className="w-full p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <UserPlus className="w-5 h-5" />
            Agregar Cajero
          </motion.button>

          {/* Cashiers List */}
          <div className={cn(
            "rounded-2xl shadow-sm overflow-hidden",
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className={cn(
                "font-semibold flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Users className="w-5 h-5 text-purple-600" />
                Cajeros Asignados ({cashiers.length})
              </h2>
            </div>

            {cashiers.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  No hay cajeros asignados a este terminal
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {cashiers.map((cashier) => (
                  <div
                    key={cashier.employeeId}
                    className={cn(
                      "p-4 flex items-center justify-between",
                      theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-medium",
                        theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'
                      )}>
                        {cashier.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {cashier.fullName}
                        </p>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          {cashier.email} • {cashier.employeeCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Permissions badges */}
                      <div className="hidden sm:flex items-center gap-1">
                        {cashier.permissions.canOpenSession && (
                          <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                            Abrir
                          </span>
                        )}
                        {cashier.permissions.canCloseSession && (
                          <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                            Cerrar
                          </span>
                        )}
                        {cashier.permissions.canGiveDiscount && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                            Desc.
                          </span>
                        )}
                      </div>
                      <motion.button
                        onClick={() => setShowRemoveModal(cashier)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark'
                            ? 'text-red-400 hover:bg-red-900/30'
                            : 'text-red-600 hover:bg-red-50'
                        )}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <UserMinus className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Cashier Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-hidden flex flex-col",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn(
                  "text-lg font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Agregar Cajero
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className={cn(
                    "p-1 rounded-lg",
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar empleado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 rounded-xl border",
                    theme === 'dark'
                      ? 'bg-gray-900 border-gray-700 text-white'
                      : 'bg-white border-gray-200'
                  )}
                />
              </div>

              {/* Employee List */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {filteredEmployees.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      {availableEmployees.length === 0
                        ? 'No hay empleados disponibles'
                        : 'No se encontraron resultados'
                      }
                    </p>
                  </div>
                ) : (
                  filteredEmployees.map((emp) => (
                    <motion.button
                      key={emp.employeeId}
                      onClick={() => addCashier(emp)}
                      disabled={saving}
                      className={cn(
                        "w-full p-3 rounded-xl text-left flex items-center gap-3 transition-colors",
                        theme === 'dark'
                          ? 'bg-gray-700/50 hover:bg-gray-700'
                          : 'bg-gray-50 hover:bg-gray-100',
                        saving && 'opacity-50 cursor-not-allowed'
                      )}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-medium",
                        theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                      )}>
                        {emp.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium truncate",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {emp.fullName}
                        </p>
                        <p className={cn(
                          "text-sm truncate",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          {emp.email}
                        </p>
                      </div>
                      <UserPlus className="w-5 h-5 text-purple-500 flex-shrink-0" />
                    </motion.button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remove Confirmation Modal */}
      <AnimatePresence>
        {showRemoveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRemoveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-2xl p-6 max-w-sm w-full shadow-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UserMinus className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className={cn(
                  "text-lg font-bold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Remover Cajero
                </h3>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  ¿Estás seguro que deseas remover a <strong>{showRemoveModal.fullName}</strong> de este terminal?
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowRemoveModal(null)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => removeCashier(showRemoveModal)}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Remover'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}
