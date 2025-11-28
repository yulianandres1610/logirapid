'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  PackagePlus,
  X,
  Check,
  AlertCircle,
  PackageCheck,
  TrendingUp,
  Loader2,
  Trash2,
  CheckCircle2,
  Truck
} from 'lucide-react'

interface RecepcionBultosTabProps {
  driver: any
  onRefresh?: () => void
}

interface ScannedBulto {
  code: string
  status: 'validating' | 'valid' | 'invalid' | 'already-assigned'
  data?: any
  errorMessage?: string
}

export default function RecepcionBultosTab({ driver, onRefresh }: RecepcionBultosTabProps) {
  const { showNotification } = useNotifications()
  const [scanCode, setScanCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [scannedBultos, setScannedBultos] = useState<ScannedBulto[]>([])
  const [duplicateError, setDuplicateError] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Preload empaques data for faster validation
  const [empaquesMap, setEmpaquesMap] = useState<Map<string, any>>(new Map())
  const [isLoadingEmpaques, setIsLoadingEmpaques] = useState(true)

  const CODE_LENGTH = 18 // Formato similar a empaques

  // Preload all empaques with orders (any estado except disponible/entregado)
  useEffect(() => {
    const loadEmpaques = async () => {
      try {
        setIsLoadingEmpaques(true)
        // Load all empaques that have an order assigned, regardless of estado
        const response = await fetch('/api/empaques?hasOrder=true&limit=10000')

        if (response.ok) {
          const data = await response.json()
          const empaques = data.empaques || []

          // Create a Map for O(1) lookup by codigo
          const map = new Map()
          empaques.forEach((empaque: any) => {
            map.set(empaque.codigo, empaque)
          })

          setEmpaquesMap(map)
          console.log(`Loaded ${empaques.length} empaques for fast validation`)
        }
      } catch (error) {
        console.error('Error preloading empaques:', error)
        showNotification('warning', 'Advertencia', 'No se pudieron precargar los empaques. La validación será más lenta.')
      } finally {
        setIsLoadingEmpaques(false)
      }
    }

    loadEmpaques()
  }, [driver.id])

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

  // Agregar código a la lista (optimized with preloaded data)
  const handleAddCode = async (code: string) => {
    const trimmedCode = code.trim()

    // Validaciones
    if (!trimmedCode) return
    if (scannedBultos.find(b => b.code === trimmedCode)) {
      setDuplicateError(`El código ${trimmedCode} ya fue escaneado`)
      setScanCode('')
      return
    }

    // Check in preloaded data first (instant validation)
    const bulto = empaquesMap.get(trimmedCode)

    if (bulto) {
      // Validar estado: permitir asignar cualquier estado excepto 'disponible' y 'entregado'
      let status: 'valid' | 'invalid' | 'already-assigned' = 'invalid'
      let errorMessage = ''

      // Ya está asignado a este driver
      if (bulto.driver_id === driver.id) {
        status = 'already-assigned'
      }
      // No se puede asignar si está disponible o ya fue entregado
      else if (bulto.estado === 'disponible' || bulto.estado === 'entregado') {
        status = 'invalid'
        errorMessage = `Estado inválido: ${bulto.estado}. No se puede asignar bultos ${bulto.estado}.`
      }
      // Debe tener orden asignada
      else if (!bulto.order_number) {
        status = 'invalid'
        errorMessage = 'Bulto no está asignado a ninguna orden'
      }
      // Válido para asignar (asignado, recogida, en_transito, en_almacen, etc.)
      else {
        status = 'valid'
      }

      // Add immediately with status (no "validating" state needed)
      const newBulto: ScannedBulto = {
        code: trimmedCode,
        status,
        data: bulto,
        errorMessage
      }
      setScannedBultos(prev => [newBulto, ...prev])
      setScanCode('')
    } else {
      // Not in preloaded data - try API as fallback
      const newBulto: ScannedBulto = {
        code: trimmedCode,
        status: 'validating'
      }
      setScannedBultos(prev => [newBulto, ...prev])
      setScanCode('')

      try {
        const response = await fetch(`/api/empaques?codigo=${encodeURIComponent(trimmedCode)}`)

        if (response.ok) {
          const data = await response.json()

          if (data.empaques && data.empaques.length > 0) {
            const empaque = data.empaques[0]

            // Validar estado: permitir asignar cualquier estado excepto 'disponible' y 'entregado'
            let status: 'valid' | 'invalid' | 'already-assigned' = 'invalid'
            let errorMessage = ''

            // Ya está asignado a este driver
            if (empaque.driver_id === driver.id) {
              status = 'already-assigned'
            }
            // No se puede asignar si está disponible o ya fue entregado
            else if (empaque.estado === 'disponible' || empaque.estado === 'entregado') {
              status = 'invalid'
              errorMessage = `Estado inválido: ${empaque.estado}. No se puede asignar bultos ${empaque.estado}.`
            }
            // Debe tener orden asignada
            else if (!empaque.order_number) {
              status = 'invalid'
              errorMessage = 'Bulto no está asignado a ninguna orden'
            }
            // Válido para asignar (asignado, recogida, en_transito, en_almacen, etc.)
            else {
              status = 'valid'
            }

            setScannedBultos(prev =>
              prev.map(b =>
                b.code === trimmedCode
                  ? { ...b, status, data: empaque, errorMessage }
                  : b
              )
            )
          } else {
            setScannedBultos(prev =>
              prev.map(b =>
                b.code === trimmedCode
                  ? { ...b, status: 'invalid', errorMessage: 'Código no encontrado' }
                  : b
              )
            )
          }
        }
      } catch (error) {
        console.error('Error validating code:', error)
        setScannedBultos(prev =>
          prev.map(b =>
            b.code === trimmedCode
              ? { ...b, status: 'invalid', errorMessage: 'Error de conexión' }
              : b
          )
        )
      }
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
    setScannedBultos(prev => prev.filter(b => b.code !== code))
  }

  // Limpiar todos
  const handleClearAll = () => {
    setScannedBultos([])
    setScanCode('')
    inputRef.current?.focus()
  }

  // Procesar asignación al driver
  const handleAssignAll = async () => {
    const bultosToAssign = scannedBultos.filter(
      b => b.status === 'valid' && b.data
    )

    if (bultosToAssign.length === 0) {
      showNotification('warning', 'Sin bultos para asignar', 'No hay bultos válidos para asignar al driver')
      return
    }

    try {
      setLoading(true)
      let successCount = 0
      let errorCount = 0

      for (const bulto of bultosToAssign) {
        try {
          const response = await fetch(`/api/empaques/${bulto.data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driverId: driver.id,
              driverName: `${driver.firstName} ${driver.lastName}`,
              usuarioId: 1,
              usuarioNombre: 'Admin',
              accion: 'asignacion_driver',
              ubicacion: `Driver: ${driver.firstName} ${driver.lastName}`,
              notas: `Asignación de bulto al driver ${driver.firstName} ${driver.lastName}`
            })
          })

          if (response.ok) {
            successCount++
            // Actualizar estado a "already-assigned"
            setScannedBultos(prev =>
              prev.map(b =>
                b.code === bulto.code
                  ? { ...b, status: 'already-assigned', data: { ...b.data, driver_id: driver.id, driver_name: `${driver.firstName} ${driver.lastName}` } }
                  : b
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
          'Asignación completada',
          `${successCount} bulto${successCount !== 1 ? 's' : ''} asignado${successCount !== 1 ? 's' : ''} ${errorCount > 0 ? `(${errorCount} error(es))` : ''}`
        )

        // Refrescar datos del driver para actualizar inventario
        if (onRefresh) {
          onRefresh()
        }
      }

      if (errorCount > 0 && successCount === 0) {
        showNotification('error', 'Error', 'No se pudieron asignar los bultos')
      }
    } catch (error) {
      console.error('Error assigning bultos:', error)
      showNotification('error', 'Error', 'Ocurrió un error al procesar la asignación')
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
    total: scannedBultos.length,
    valid: scannedBultos.filter(b => b.status === 'valid').length,
    alreadyAssigned: scannedBultos.filter(b => b.status === 'already-assigned').length,
    invalid: scannedBultos.filter(b => b.status === 'invalid').length,
    validating: scannedBultos.filter(b => b.status === 'validating').length
  }

  return (
    <div className="space-y-6">
      {/* Scanner Input Card */}
      <div className="rounded-xl shadow-xl p-8" style={{ background: 'linear-gradient(to right, #cc0a46, #a00838)' }}>
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 rounded-lg">
            <PackagePlus className="h-8 w-8 text-white" />
          </div>
          <div className="text-white">
            <h3 className="text-xl font-bold">Escanear Código de Bulto</h3>
            <p className="text-white/90 text-sm">
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
          placeholder="Escanea o ingresa el código del bulto..."
          maxLength={CODE_LENGTH}
          className="w-full px-6 py-4 text-2xl font-mono rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-transparent focus:border-white focus:outline-none transition-colors"
          style={{ boxShadow: 'none' }}
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
                <PackageCheck className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-green-200 dark:border-green-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Para Asignar</p>
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
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Ya asignados</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">{stats.alreadyAssigned}</p>
              </div>
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-red-200 dark:border-red-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Inválidos</p>
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
              {scannedBultos.map((bulto) => (
                <div
                  key={bulto.code}
                  className={`
                    relative group p-4 rounded-lg border-2 transition-all
                    ${bulto.status === 'valid'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-700'
                      : bulto.status === 'already-assigned'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 dark:border-yellow-700'
                      : bulto.status === 'invalid'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-700'
                      : ''
                    }
                  `}
                  style={bulto.status === 'validating' ? {
                    backgroundColor: 'rgba(204, 10, 70, 0.1)',
                    borderColor: '#cc0a46'
                  } : {}}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {bulto.status === 'validating' && (
                          <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#cc0a46' }} />
                        )}
                        {bulto.status === 'valid' && (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                        {bulto.status === 'already-assigned' && (
                          <CheckCircle2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        )}
                        {bulto.status === 'invalid' && (
                          <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                        <span className={`
                          text-xs font-semibold uppercase tracking-wide
                          ${bulto.status === 'valid' ? 'text-green-700 dark:text-green-400' : ''}
                          ${bulto.status === 'already-assigned' ? 'text-yellow-700 dark:text-yellow-400' : ''}
                          ${bulto.status === 'invalid' ? 'text-red-700 dark:text-red-400' : ''}
                        `}
                        style={bulto.status === 'validating' ? { color: '#cc0a46' } : {}}>
                          {bulto.status === 'valid' && 'Listo'}
                          {bulto.status === 'already-assigned' && 'Ya asignado'}
                          {bulto.status === 'invalid' && 'Inválido'}
                          {bulto.status === 'validating' && 'Validando...'}
                        </span>
                      </div>

                      <p className="font-mono text-sm font-bold text-gray-900 dark:text-white mb-1">
                        {bulto.code}
                      </p>

                      {bulto.status === 'invalid' && bulto.errorMessage && (
                        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded border border-red-300 dark:border-red-700">
                          <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                            {bulto.errorMessage}
                          </p>
                        </div>
                      )}

                      {bulto.data && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-2">
                          <p className="font-semibold">Tipo: {bulto.data.tipo || 'N/A'}</p>
                          {bulto.data.order_number && (
                            <p>Orden: {bulto.data.order_number}</p>
                          )}
                          {bulto.data.service_name && (
                            <p>Servicio: {bulto.data.service_name}</p>
                          )}
                          {bulto.data.recipient_name && (
                            <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                              <p className="font-semibold text-gray-700 dark:text-gray-300">Destinatario:</p>
                              <p>{bulto.data.recipient_name}</p>
                              {bulto.data.recipient_city && bulto.data.recipient_state && (
                                <p>{bulto.data.recipient_city}, {bulto.data.recipient_state}</p>
                              )}
                            </div>
                          )}
                          {bulto.data.weight_lb && (
                            <p className="mt-1">Peso: {bulto.data.weight_lb} lb ({bulto.data.weight_kg} kg)</p>
                          )}
                          <p className="mt-1">Ubicación: {bulto.data.warehouse_name || bulto.data.driver_name || 'N/A'}</p>
                          <p className="text-xs italic">Estado: {bulto.data.estado}</p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveCode(bulto.code)}
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
                onClick={handleAssignAll}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 text-white font-semibold rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: loading ? '#cc0a46' : '#cc0a46',
                  opacity: loading ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#a00838'
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = '#cc0a46'
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Procesando asignaciones...
                  </>
                ) : (
                  <>
                    <Truck className="h-5 w-5" />
                    Asignar {stats.valid} Bulto{stats.valid !== 1 ? 's' : ''} al Driver
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
          <div
            className="inline-flex items-center justify-center p-4 rounded-full mb-4"
            style={{ backgroundColor: 'rgba(204, 10, 70, 0.1)' }}
          >
            <PackagePlus className="h-12 w-12" style={{ color: '#cc0a46' }} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Listo para escanear
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Usa el campo de arriba para comenzar a escanear los códigos de los bultos que quieres asignar a este driver
          </p>
        </div>
      )}
    </div>
  )
}
