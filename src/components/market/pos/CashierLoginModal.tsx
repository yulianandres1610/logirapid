'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Loader2,
  AlertCircle,
  ChevronDown,
  Delete,
  LogIn,
  Lock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Employee {
  employeeId: number
  employeeCode: string
  userId: number
  fullName: string
  email: string
  hasPin: boolean
  permissions: {
    canOpenSession: boolean
    canCloseSession: boolean
    canVoidOrders: boolean
    canGiveDiscount: boolean
    canRefund: boolean
    maxDiscountPercent: number
  }
}

export interface AuthenticatedEmployee {
  employeeId: number
  employeeCode: string
  userId: number
  fullName: string
  permissions: {
    canOpenSession: boolean
    canCloseSession: boolean
    canVoidOrders: boolean
    canGiveDiscount: boolean
    canRefund: boolean
    maxDiscountPercent: number
  }
}

interface CashierLoginModalProps {
  terminalId: number
  terminalName: string
  onAuthenticated: (employee: AuthenticatedEmployee) => void
  onCancel?: () => void
}

export function CashierLoginModal({
  terminalId,
  terminalName,
  onAuthenticated,
  onCancel
}: CashierLoginModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [pin, setPin] = useState('')
  const [authenticating, setAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Fetch employees on mount
  useEffect(() => {
    fetchEmployees()
  }, [terminalId])

  const fetchEmployees = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/market/pos/terminals/${terminalId}/employees`)
      const data = await response.json()

      if (data.success) {
        setEmployees(data.data.employees)
        // If only one employee, auto-select
        if (data.data.employees.length === 1) {
          setSelectedEmployee(data.data.employees[0])
        }
      } else {
        setError(data.error || 'Error al cargar empleados')
      }
    } catch (err) {
      console.error('[CashierLogin] Error:', err)
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handlePinInput = useCallback((digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit)
      setAuthError(null)
    }
  }, [pin])

  const handlePinDelete = useCallback(() => {
    setPin(prev => prev.slice(0, -1))
    setAuthError(null)
  }, [])

  const handlePinClear = useCallback(() => {
    setPin('')
    setAuthError(null)
  }, [])

  const handleAuthenticate = async () => {
    if (!selectedEmployee) {
      setAuthError('Selecciona un cajero')
      return
    }

    if (!selectedEmployee.hasPin) {
      setAuthError('Este empleado no tiene PIN configurado')
      return
    }

    if (pin.length !== 4) {
      setAuthError('El PIN debe tener 4 dígitos')
      return
    }

    setAuthenticating(true)
    setAuthError(null)

    try {
      const response = await fetch('/api/market/pos/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminalId,
          pin
        })
      })

      const data = await response.json()

      if (data.success) {
        // Verify the authenticated employee matches the selected one
        if (data.data.employeeId !== selectedEmployee.employeeId) {
          setAuthError('PIN no corresponde al cajero seleccionado')
          setPin('')
          return
        }

        onAuthenticated({
          employeeId: data.data.employeeId,
          employeeCode: data.data.employeeCode,
          userId: data.data.userId,
          fullName: data.data.fullName,
          permissions: data.data.permissions
        })
      } else {
        setAuthError(data.error || 'PIN incorrecto')
        setPin('')
      }
    } catch (err) {
      console.error('[CashierLogin] Auth error:', err)
      setAuthError('Error de autenticación')
      setPin('')
    } finally {
      setAuthenticating(false)
    }
  }

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinInput(e.key)
      } else if (e.key === 'Backspace') {
        handlePinDelete()
      } else if (e.key === 'Escape') {
        handlePinClear()
      } else if (e.key === 'Enter' && pin.length === 4) {
        handleAuthenticate()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePinInput, handlePinDelete, handlePinClear, pin, handleAuthenticate])

  const numpadButtons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    'C', '0', 'DEL'
  ]

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center max-w-md p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={fetchEmployees}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              Reintentar
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center max-w-md p-8">
          <User className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sin Cajeros Asignados</h2>
          <p className="text-gray-400 mb-6">
            No hay empleados asignados a este terminal. Contacta al administrador para configurar el acceso.
          </p>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-gray-700 text-white rounded-xl hover:bg-gray-600 transition-colors"
            >
              Volver
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Iniciar Sesión</h1>
          <p className="text-gray-400">{terminalName}</p>
        </div>

        {/* Employee Selector */}
        <div className="mb-6 relative">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Seleccionar Cajero
          </label>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={cn(
              "w-full p-4 rounded-xl border-2 text-left flex items-center justify-between transition-colors",
              showDropdown
                ? "border-blue-500 bg-gray-800"
                : "border-gray-700 bg-gray-800 hover:border-gray-600"
            )}
          >
            {selectedEmployee ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold">
                    {selectedEmployee.fullName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{selectedEmployee.fullName}</p>
                  <p className="text-sm text-gray-400">{selectedEmployee.employeeCode}</p>
                </div>
              </div>
            ) : (
              <span className="text-gray-500">Seleccionar cajero...</span>
            )}
            <ChevronDown className={cn(
              "w-5 h-5 text-gray-400 transition-transform",
              showDropdown && "rotate-180"
            )} />
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border-2 border-gray-700 rounded-xl overflow-hidden shadow-2xl z-10 max-h-60 overflow-y-auto"
              >
                {employees.map(emp => (
                  <button
                    key={emp.employeeId}
                    onClick={() => {
                      setSelectedEmployee(emp)
                      setShowDropdown(false)
                      setPin('')
                      setAuthError(null)
                    }}
                    className={cn(
                      "w-full p-4 flex items-center gap-3 hover:bg-gray-700 transition-colors text-left",
                      selectedEmployee?.employeeId === emp.employeeId && "bg-gray-700"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-white font-bold">
                        {emp.fullName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{emp.fullName}</p>
                      <p className="text-sm text-gray-400">{emp.employeeCode}</p>
                    </div>
                    {!emp.hasPin && (
                      <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded">
                        Sin PIN
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* PIN Display */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Ingresa tu PIN
          </label>
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={cn(
                  "w-14 h-16 rounded-xl border-2 flex items-center justify-center transition-all",
                  i < pin.length
                    ? "border-blue-500 bg-blue-500/20"
                    : "border-gray-700 bg-gray-800"
                )}
              >
                {i < pin.length && (
                  <div className="w-4 h-4 rounded-full bg-blue-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {authError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-2 text-red-400"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{authError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {numpadButtons.map(btn => (
            <button
              key={btn}
              onClick={() => {
                if (btn === 'DEL') handlePinDelete()
                else if (btn === 'C') handlePinClear()
                else handlePinInput(btn)
              }}
              disabled={authenticating}
              className={cn(
                "h-16 rounded-xl font-bold text-xl transition-all",
                btn === 'DEL'
                  ? "bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30"
                  : btn === 'C'
                  ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                  : "bg-gray-800 text-white hover:bg-gray-700 border border-gray-700",
                authenticating && "opacity-50 cursor-not-allowed"
              )}
            >
              {btn === 'DEL' ? <Delete className="w-6 h-6 mx-auto" /> : btn}
            </button>
          ))}
        </div>

        {/* Login Button */}
        <button
          onClick={handleAuthenticate}
          disabled={!selectedEmployee || pin.length !== 4 || authenticating}
          className={cn(
            "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all",
            !selectedEmployee || pin.length !== 4 || authenticating
              ? "bg-gray-700 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-500/25"
          )}
        >
          {authenticating ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <LogIn className="w-6 h-6" />
              Iniciar Sesión
            </>
          )}
        </button>

        {/* Cancel Button */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full mt-4 py-3 text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        )}
      </motion.div>
    </div>
  )
}
