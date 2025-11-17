'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  Send,
  X,
  Check,
  AlertCircle,
  PackageCheck,
  TrendingUp,
  Loader2,
  Trash2,
  CheckCircle2,
  Building2
} from 'lucide-react'

interface EnvioBultosTabProps {
  warehouse: any
  onRefresh?: () => void
}

interface ScannedBulto {
  code: string
  status: 'validating' | 'valid' | 'invalid' | 'sent'
  data?: any
  errorMessage?: string
}

export default function EnvioBultosTab({ warehouse, onRefresh }: EnvioBultosTabProps) {
  const { showNotification } = useNotifications()
  const [scanCode, setScanCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [scannedBultos, setScannedBultos] = useState<ScannedBulto[]>([])
  const [duplicateError, setDuplicateError] = useState<string>('')
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [destinoWarehouseId, setDestinoWarehouseId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const CODE_LENGTH = 18

  // Cargar warehouses disponibles (excepto el actual)
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/warehouses?activeOnly=true')
        if (response.ok) {
          const data = await response.json()
          // La respuesta puede venir como data.warehouses o directamente como array
          const warehousesList = data.warehouses || data.data || data || []
          // Filtrar el warehouse actual (asegurar comparación correcta de IDs)
          const otherWarehouses = warehousesList.filter((w: any) => Number(w.id) !== Number(warehouse.id))
          setWarehouses(otherWarehouses)
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error)
      }
    }

    fetchWarehouses()
  }, [warehouse.id])

  // Limpiar error de duplicado después de 3 segundos
  useEffect(() => {
    if (duplicateError) {
      const timer = setTimeout(() => setDuplicateError(''), 3000)
      return () => clearTimeout(timer)
    }
  }, [duplicateError])

  // Auto-submit cuando se completa el código
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setScanCode(value)

    if (value.length === CODE_LENGTH) {
      handleAddCode(value)
    }
  }

  // Agregar código
  const handleAddCode = async (code: string) => {
    const trimmedCode = code.trim()

    if (trimmedCode.length !== CODE_LENGTH) {
      return
    }

    // Verificar si ya existe
    if (scannedBultos.some(b => b.code === trimmedCode)) {
      setDuplicateError(`El código ${trimmedCode} ya fue escaneado`)
      setScanCode('')
      return
    }

    // Agregar con estado "validating"
    const newBulto: ScannedBulto = {
      code: trimmedCode,
      status: 'validating'
    }

    setScannedBultos(prev => [newBulto, ...prev])
    setScanCode('')

    // Validar en background
    try {
      const response = await fetch(`/api/empaques?codigo=${encodeURIComponent(trimmedCode)}`)

      if (response.ok) {
        const data = await response.json()

        if (data.empaques && data.empaques.length > 0) {
          const bulto = data.empaques[0]

          // Validar que el empaque esté en estado 'en_almacen' del warehouse actual
          let status: 'valid' | 'invalid' | 'sent' = 'invalid'
          let errorMessage = ''

          if (bulto.warehouse_id !== warehouse.id) {
            status = 'invalid'
            errorMessage = `Este bulto no está en ${warehouse.name}. Ubicación actual: ${bulto.warehouse_name || 'Desconocida'}`
          } else if (bulto.estado !== 'en_almacen') {
            status = 'invalid'
            errorMessage = `Estado inválido: ${bulto.estado}. Debe estar en estado 'en_almacen' para enviarlo.`
          } else if (!bulto.order_number) {
            status = 'invalid'
            errorMessage = 'Empaque no está asignado a ninguna orden'
          } else {
            status = 'valid'
          }

          setScannedBultos(prev =>
            prev.map(b =>
              b.code === trimmedCode
                ? { ...b, status, data: bulto, errorMessage }
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
            ? { ...b, status: 'invalid', errorMessage: 'Error al validar' }
            : b
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
    setScannedBultos(prev => prev.filter(b => b.code !== code))
  }

  // Limpiar todos
  const handleClearAll = () => {
    setScannedBultos([])
    setScanCode('')
    inputRef.current?.focus()
  }

  // Procesar envío
  const handleSendAll = async () => {
    if (!destinoWarehouseId) {
      showNotification('warning', 'Almacén destino requerido', 'Debes seleccionar un almacén destino')
      return
    }

    const bultosToSend = scannedBultos.filter(
      b => b.status === 'valid' && b.data
    )

    if (bultosToSend.length === 0) {
      showNotification('warning', 'Sin bultos para enviar', 'No hay bultos válidos para enviar')
      return
    }

    const destinoWarehouse = warehouses.find(w => w.id === destinoWarehouseId)

    try {
      setLoading(true)
      let successCount = 0
      let errorCount = 0

      for (const bulto of bultosToSend) {
        try {
          const response = await fetch(`/api/empaques/${bulto.data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estado: 'en_transito',
              usuarioId: 1,
              usuarioNombre: 'Admin',
              accion: 'envio_a_almacen',
              ubicacion: `${warehouse.name} → ${destinoWarehouse.name}`,
              notas: `Enviado desde ${warehouse.name} hacia ${destinoWarehouse.name} (ID: ${destinoWarehouseId})`
            })
          })

          if (response.ok) {
            successCount++
            // Actualizar estado a "sent"
            setScannedBultos(prev =>
              prev.map(b =>
                b.code === bulto.code
                  ? { ...b, status: 'sent' }
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
          'Envío completado',
          `${successCount} bulto${successCount !== 1 ? 's' : ''} enviado${successCount !== 1 ? 's' : ''} a ${destinoWarehouse.name} ${errorCount > 0 ? `(${errorCount} error(es))` : ''}`
        )

        // Refrescar datos del almacén para actualizar inventario
        if (onRefresh) {
          onRefresh()
        }
      }

      if (errorCount > 0 && successCount === 0) {
        showNotification('error', 'Error', 'No se pudieron enviar los bultos')
      }
    } catch (error) {
      console.error('Error sending bultos:', error)
      showNotification('error', 'Error', 'Ocurrió un error al procesar el envío')
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
    sent: scannedBultos.filter(b => b.status === 'sent').length,
    invalid: scannedBultos.filter(b => b.status === 'invalid').length,
    validating: scannedBultos.filter(b => b.status === 'validating').length
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Envío de Bultos
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Selecciona almacén destino y escanea bultos desde {warehouse.name}
          </p>
        </div>
      </div>

      {/* Selector de almacén destino */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-r from-[#cc0a46] to-[#a00838] rounded-lg">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Almacén Destino
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Selecciona el almacén al que se enviarán los bultos
            </p>
          </div>
        </div>

        <select
          value={destinoWarehouseId || ''}
          onChange={(e) => setDestinoWarehouseId(Number(e.target.value))}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#cc0a46] focus:border-transparent"
        >
          <option value="">Selecciona un almacén destino...</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} - {w.address}
            </option>
          ))}
        </select>
      </div>

      {/* Scanner Input Card - Solo mostrar si hay almacén destino seleccionado */}
      {destinoWarehouseId && (
        <>
          <div className="rounded-xl shadow-xl p-8" style={{ background: 'linear-gradient(to right, #cc0a46, #a00838)' }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/20 rounded-lg">
                <Send className="h-8 w-8 text-white" />
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
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Para Enviar</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{stats.valid}</p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-blue-200 dark:border-blue-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Enviados</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{stats.sent}</p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <CheckCircle2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Códigos Escaneados ({stats.total})
                </h3>
                {stats.valid > 0 && (
                  <button
                    onClick={handleSendAll}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(to right, #cc0a46, #a00838)' }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Enviar {stats.valid} Bulto{stats.valid !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
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
                          : bulto.status === 'sent'
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-700'
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
                            {bulto.status === 'sent' && (
                              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                            {bulto.status === 'invalid' && (
                              <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                            )}
                            <span className={`
                              text-xs font-semibold uppercase tracking-wide
                              ${bulto.status === 'valid' ? 'text-green-700 dark:text-green-400' : ''}
                              ${bulto.status === 'sent' ? 'text-blue-700 dark:text-blue-400' : ''}
                              ${bulto.status === 'invalid' ? 'text-red-700 dark:text-red-400' : ''}
                            `}
                            style={bulto.status === 'validating' ? { color: '#cc0a46' } : {}}>
                              {bulto.status === 'valid' && 'Listo'}
                              {bulto.status === 'sent' && 'Enviado'}
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
            </div>
          )}
        </>
      )}

      {!destinoWarehouseId && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-3" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
            Selecciona un almacén destino para comenzar a escanear bultos
          </p>
        </div>
      )}
    </div>
  )
}
