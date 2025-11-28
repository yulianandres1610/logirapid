'use client'

import { useState, useRef } from 'react'
import {
  Package,
  QrCode,
  CheckCircle,
  X,
  Loader2,
  Search,
  AlertCircle
} from 'lucide-react'

interface Empaque {
  id: number
  codigo: string
  tipo?: string
  tamano?: string
  estado?: string
}

interface EmpaqueAssignmentProps {
  orderId: number
  orderNumber: string
  serviceName: string
  serviceIndex: number
  quantity: number
  empaques: Empaque[]
  companyId?: string
  onAssigned: () => void
}

export default function EmpaqueAssignment({
  orderId,
  orderNumber,
  serviceName,
  serviceIndex,
  quantity,
  empaques,
  companyId,
  onAssigned
}: EmpaqueAssignmentProps) {
  const [scanning, setScanningSlot] = useState<number | null>(null)
  const [scanInput, setScanInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Crear slots para empaques
  const slots = Array.from({ length: quantity }, (_, i) => {
    const empaque = empaques[i] || null
    return { index: i, empaque }
  })

  const handleStartScan = (slotIndex: number) => {
    setScanningSlot(slotIndex)
    setScanInput('')
    setError(null)
    // Focus en el input después de que se renderice
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleCancelScan = () => {
    setScanningSlot(null)
    setScanInput('')
    setError(null)
  }

  const handleAssignEmpaque = async () => {
    if (!scanInput.trim()) {
      setError('Ingrese un código de empaque')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (companyId) {
        headers['x-company-id'] = companyId
      }

      // Primero validar el empaque
      const validateResponse = await fetch('/api/empaques/validate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          codigo: scanInput.trim()
        })
      })

      const validateData = await validateResponse.json()

      if (!validateData.success) {
        throw new Error(validateData.error || 'Empaque no válido')
      }

      // Si el empaque no está disponible
      if (validateData.data.estado !== 'disponible') {
        throw new Error(`Empaque en estado "${validateData.data.estado}", debe estar disponible`)
      }

      // Asignar el empaque a la orden
      const assignResponse = await fetch('/api/empaques/assign', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          codigo: scanInput.trim(),
          ordenId: orderId,
          ordenNumero: orderNumber,
          servicioNombre: serviceName,
          nuevoEstado: 'recogida'
        })
      })

      const assignData = await assignResponse.json()

      if (!assignData.success) {
        throw new Error(assignData.error || 'Error al asignar empaque')
      }

      // Éxito
      setScanningSlot(null)
      setScanInput('')
      onAssigned()

    } catch (err) {
      console.error('Error assigning empaque:', err)
      setError(err instanceof Error ? err.message : 'Error al asignar empaque')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveEmpaque = async (empaqueId: number, empaqueCodigo: string) => {
    if (!confirm(`¿Desasignar empaque ${empaqueCodigo}?`)) {
      return
    }

    setLoading(true)

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (companyId) {
        headers['x-company-id'] = companyId
      }

      // Liberar el empaque
      const response = await fetch('/api/empaques/release', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          empaqueId,
          codigo: empaqueCodigo
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al liberar empaque')
      }

      onAssigned()

    } catch (err) {
      console.error('Error releasing empaque:', err)
      alert(err instanceof Error ? err.message : 'Error al liberar empaque')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAssignEmpaque()
    } else if (e.key === 'Escape') {
      handleCancelScan()
    }
  }

  return (
    <div className="space-y-2 mt-2">
      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
        <Package className="w-3 h-3" />
        Empaques asignados: {empaques.length}/{quantity}
      </div>

      <div className="flex flex-wrap gap-2">
        {slots.map(({ index, empaque }) => (
          <div key={index}>
            {empaque ? (
              // Slot con empaque asignado
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded text-sm">
                <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                <span className="font-mono text-green-700 dark:text-green-400">
                  {empaque.codigo}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveEmpaque(empaque.id, empaque.codigo)}
                  className="ml-1 p-0.5 text-green-600 hover:text-red-600 dark:text-green-400 dark:hover:text-red-400 transition-colors"
                  title="Desasignar empaque"
                  disabled={loading}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : scanning === index ? (
              // Modo escaneo/búsqueda
              <div className="flex items-center gap-1">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyPress}
                    placeholder="Código..."
                    className="w-32 px-2 py-1 text-sm border border-blue-400 dark:border-blue-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                  {loading && (
                    <Loader2 className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAssignEmpaque}
                  className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                  disabled={loading || !scanInput.trim()}
                  title="Asignar"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelScan}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  disabled={loading}
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              // Slot vacío
              <button
                type="button"
                onClick={() => handleStartScan(index)}
                className="flex items-center gap-1 px-2 py-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors"
                disabled={loading}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Escanear</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </div>
  )
}
