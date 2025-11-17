'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  ScanLine,
  X,
  Check,
  AlertCircle,
  Package,
  TrendingUp,
  Clock,
  Loader2,
  Trash2,
  CheckCircle2
} from 'lucide-react'

interface RecepcionTabProps {
  warehouse: any
}

interface ScannedEmpaque {
  code: string
  status: 'validating' | 'valid' | 'invalid' | 'already-here'
  data?: any
}

export default function RecepcionTab({ warehouse }: RecepcionTabProps) {
  const { showNotification } = useNotifications()
  const [scanCode, setScanCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [scannedEmpaques, setScannedEmpaques] = useState<ScannedEmpaque[]>([])
  const [duplicateError, setDuplicateError] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  const CODE_LENGTH = 18 // EMP + 3 + 5 + 7 = 18 caracteres

  // Limpiar error de duplicado después de 3 segundos
  useEffect(() => {
    if (duplicateError) {
      const timer = setTimeout(() => {
        setDuplicateError('')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [duplicateError])

  // Auto-agregar código cuando alcanza la longitud correcta
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setScanCode(value)

    if (value.length === CODE_LENGTH) {
      await handleAddCode(value)
    }
  }

  // Agregar código a la lista
  const handleAddCode = async (code: string) => {
    const trimmedCode = code.trim()

    // Validaciones
    if (!trimmedCode) return
    if (scannedEmpaques.find(e => e.code === trimmedCode)) {
      setDuplicateError(`El código ${trimmedCode} ya fue escaneado`)
      setScanCode('')
      return
    }

    // Agregar como "validating"
    const newEmpaque: ScannedEmpaque = {
      code: trimmedCode,
      status: 'validating'
    }
    setScannedEmpaques(prev => [newEmpaque, ...prev])
    setScanCode('')

    // Validar en background
    try {
      const response = await fetch(`/api/empaques?codigo=${encodeURIComponent(trimmedCode)}`)

      if (response.ok) {
        const data = await response.json()

        if (data.empaques && data.empaques.length > 0) {
          const empaque = data.empaques[0]
          const status = empaque.warehouse_id === warehouse.id ? 'already-here' : 'valid'

          setScannedEmpaques(prev =>
            prev.map(e =>
              e.code === trimmedCode
                ? { ...e, status, data: empaque }
                : e
            )
          )
        } else {
          setScannedEmpaques(prev =>
            prev.map(e =>
              e.code === trimmedCode
                ? { ...e, status: 'invalid' }
                : e
            )
          )
        }
      }
    } catch (error) {
      console.error('Error validating code:', error)
      setScannedEmpaques(prev =>
        prev.map(e =>
          e.code === trimmedCode
            ? { ...e, status: 'invalid' }
            : e
        )
      )
    }

    // Refocus input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 100)
  }

  // Eliminar código
  const handleRemoveCode = (code: string) => {
    setScannedEmpaques(prev => prev.filter(e => e.code !== code))
  }

  // Limpiar todos
  const handleClearAll = () => {
    setScannedEmpaques([])
    setScanCode('')
    inputRef.current?.focus()
  }

  // Procesar recepción
  const handleReceiveAll = async () => {
    const cajasToTransfer = scannedEmpaques.filter(
      e => e.status === 'valid' && e.data
    )

    if (cajasToTransfer.length === 0) {
      showNotification('warning', 'Sin cajas para transferir', 'No hay cajas válidas para recibir')
      return
    }

    try {
      setLoading(true)
      let successCount = 0
      let errorCount = 0

      for (const empaque of cajasToTransfer) {
        try {
          const response = await fetch(`/api/empaques/${empaque.data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              warehouseId: warehouse.id,
              warehouseName: warehouse.name,
              usuarioId: 1,
              usuarioNombre: 'Admin',
              accion: 'transferencia',
              ubicacion: warehouse.name,
              notas: `Transferencia masiva desde ${empaque.data.warehouse_name} - Recepción`
            })
          })

          if (response.ok) {
            successCount++
            // Actualizar estado a "already-here"
            setScannedEmpaques(prev =>
              prev.map(e =>
                e.code === empaque.code
                  ? { ...e, status: 'already-here', data: { ...e.data, warehouse_id: warehouse.id, warehouse_name: warehouse.name } }
                  : e
              )
            )
          } else {
            errorCount++
          }
        } catch (error) {
          errorCount++
        }
      }

      if (successCount > 0) {
        showNotification(
          'success',
          'Recepción completada',
          `${successCount} caja${successCount !== 1 ? 's' : ''} recibida${successCount !== 1 ? 's' : ''} ${errorCount > 0 ? `(${errorCount} error(es))` : ''}`
        )
      }

      if (errorCount > 0 && successCount === 0) {
        showNotification('error', 'Error', 'No se pudieron transferir las cajas')
      }
    } catch (error) {
      console.error('Error receiving empaques:', error)
      showNotification('error', 'Error', 'Ocurrió un error al procesar la recepción')
    } finally {
      setLoading(false)
    }
  }

  // Manejar Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && scanCode.trim()) {
      handleAddCode(scanCode)
    }
  }

  // Estadísticas
  const stats = {
    total: scannedEmpaques.length,
    valid: scannedEmpaques.filter(e => e.status === 'valid').length,
    alreadyHere: scannedEmpaques.filter(e => e.status === 'already-here').length,
    invalid: scannedEmpaques.filter(e => e.status === 'invalid').length,
    validating: scannedEmpaques.filter(e => e.status === 'validating').length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Recepción de Cajas
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Escanea múltiples códigos para recibir cajas en {warehouse.name}
          </p>
        </div>
      </div>

      {/* Scanner Input Card */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl shadow-xl p-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 rounded-lg">
            <ScanLine className="h-8 w-8 text-white" />
          </div>
          <div className="text-white">
            <h3 className="text-xl font-bold">Escanear Código</h3>
            <p className="text-blue-100 text-sm">
              {scanCode.length}/{CODE_LENGTH} caracteres
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={scanCode}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Escanea o ingresa el código de la caja..."
          maxLength={CODE_LENGTH}
          className="w-full px-6 py-4 text-2xl font-mono rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-transparent focus:border-white dark:focus:border-blue-400 focus:outline-none transition-colors"
          autoFocus
          disabled={loading}
        />

        {/* Mensaje de error de duplicado */}
        {duplicateError && (
          <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-white/95 dark:bg-gray-800/95 rounded-lg shadow-lg animate-pulse">
            <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#cc0a46' }} />
            <p className="text-sm font-semibold" style={{ color: '#cc0a46' }}>
              {duplicateError}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-white text-sm">
          <span>Los códigos se agregarán automáticamente al completar {CODE_LENGTH} caracteres</span>
          {stats.total > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar todo
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.total}</p>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Package className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-green-200 dark:border-green-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Para Transferir</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.valid}</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-yellow-200 dark:border-yellow-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Ya están aquí</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">{stats.alreadyHere}</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-red-200 dark:border-red-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Inválidas</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">{stats.invalid}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanned Codes List */}
      {stats.total > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Códigos Escaneados ({stats.total})
            </h3>
          </div>

          <div className="p-6 max-h-[500px] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scannedEmpaques.map((empaque) => (
                <div
                  key={empaque.code}
                  className={`
                    relative group p-4 rounded-lg border-2 transition-all
                    ${empaque.status === 'valid'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-700'
                      : empaque.status === 'already-here'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 dark:border-yellow-700'
                      : empaque.status === 'invalid'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-700'
                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-700'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {empaque.status === 'validating' && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                        )}
                        {empaque.status === 'valid' && (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                        {empaque.status === 'already-here' && (
                          <CheckCircle2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        )}
                        {empaque.status === 'invalid' && (
                          <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                        <span className={`
                          text-xs font-semibold uppercase tracking-wide
                          ${empaque.status === 'valid' ? 'text-green-700 dark:text-green-400' : ''}
                          ${empaque.status === 'already-here' ? 'text-yellow-700 dark:text-yellow-400' : ''}
                          ${empaque.status === 'invalid' ? 'text-red-700 dark:text-red-400' : ''}
                          ${empaque.status === 'validating' ? 'text-blue-700 dark:text-blue-400' : ''}
                        `}>
                          {empaque.status === 'valid' && 'Listo'}
                          {empaque.status === 'already-here' && 'Ya está aquí'}
                          {empaque.status === 'invalid' && 'No encontrado'}
                          {empaque.status === 'validating' && 'Validando...'}
                        </span>
                      </div>

                      <p className="font-mono text-sm font-bold text-gray-900 dark:text-white mb-1">
                        {empaque.code}
                      </p>

                      {empaque.data && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <p>Tamaño: {empaque.data.package_size_name || 'N/A'}</p>
                          <p>Origen: {empaque.data.warehouse_name}</p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveCode(empaque.code)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          {stats.valid > 0 && (
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={handleReceiveAll}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Procesando transferencias...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Recibir {stats.valid} Caja{stats.valid !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {stats.total === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          <div className="inline-flex items-center justify-center p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
            <ScanLine className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Listo para escanear
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Usa el campo de arriba para comenzar a escanear los códigos de las cajas que quieres recibir en este almacén
          </p>
        </div>
      )}
    </div>
  )
}
