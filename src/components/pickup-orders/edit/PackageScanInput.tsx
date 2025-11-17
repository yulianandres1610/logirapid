'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, Scan, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface PackageScanInputProps {
  orderId: number
  orderNumber: string
  onPackageAdded: () => void
}

export default function PackageScanInput({ orderId, orderNumber, onPackageAdded }: PackageScanInputProps) {
  const { theme } = useTheme()
  const [codigo, setCodigo] = useState('')
  const [pesoLb, setPesoLb] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount and after successful scan
  useEffect(() => {
    if (status === 'idle' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [status])

  const handleScan = async () => {
    if (!codigo.trim()) {
      setStatus('error')
      setMessage('Debe ingresar un código de empaque')
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 2000)
      return
    }

    const peso = pesoLb.trim() ? parseFloat(pesoLb) : undefined

    if (pesoLb.trim() && (isNaN(peso!) || peso! <= 0)) {
      setStatus('error')
      setMessage('El peso debe ser un número válido mayor a 0')
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 2000)
      return
    }

    setIsScanning(true)
    setStatus('idle')
    setMessage('')

    try {
      const response = await fetch(`/api/pickup-orders/${orderId}/empaques`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: codigo.trim(),
          peso_lb: peso
        })
      })

      const data = await response.json()

      if (data.success) {
        setStatus('success')
        setMessage(`Empaque ${codigo} asociado exitosamente`)
        setCodigo('')
        setPesoLb('')
        onPackageAdded()

        // Reset status after 2 seconds
        setTimeout(() => {
          setStatus('idle')
          setMessage('')
          inputRef.current?.focus()
        }, 2000)
      } else {
        setStatus('error')
        setMessage(data.error || 'Error al asociar empaque')
        setTimeout(() => {
          setStatus('idle')
          setMessage('')
        }, 3000)
      }
    } catch (error) {
      console.error('Error scanning package:', error)
      setStatus('error')
      setMessage('Error de conexión al servidor')
      setTimeout(() => {
        setStatus('idle')
        setMessage('')
      }, 3000)
    } finally {
      setIsScanning(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-6 shadow-lg',
        theme === 'dark'
          ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
          : 'bg-white border-gray-200'
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-blue-600 to-blue-700'
          )}
        >
          <Package className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className={cn(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Asociar Empaques
          </h3>
          <p className={cn(
            'text-sm',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Escanea o escribe el código del empaque
          </p>
        </div>
      </div>

      {/* Input Fields */}
      <div className="space-y-4">
        {/* Código Input */}
        <div>
          <label className={cn(
            'block text-sm font-medium mb-2',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            Código de Empaque *
          </label>
          <input
            ref={inputRef}
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escanea o escribe el código"
            disabled={isScanning}
            className={cn(
              'w-full px-4 py-3 rounded-xl border font-mono text-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all',
              theme === 'dark'
                ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
              isScanning && 'opacity-50 cursor-not-allowed',
              status === 'success' && 'border-green-500',
              status === 'error' && 'border-red-500'
            )}
          />
        </div>

        {/* Peso Input (Optional) */}
        <div>
          <label className={cn(
            'block text-sm font-medium mb-2',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            Peso (lb) - Opcional
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={pesoLb}
            onChange={(e) => setPesoLb(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ej: 5.5"
            disabled={isScanning}
            className={cn(
              'w-full px-4 py-3 rounded-xl border text-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all',
              theme === 'dark'
                ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
              isScanning && 'opacity-50 cursor-not-allowed'
            )}
          />
        </div>

        {/* Scan Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleScan}
          disabled={isScanning || !codigo.trim()}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-white',
            'flex items-center justify-center gap-2',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            status === 'success' && 'bg-green-600 hover:bg-green-700',
            status === 'error' && 'bg-red-600 hover:bg-red-700',
            status === 'idle' && 'bg-blue-600 hover:bg-blue-700'
          )}
        >
          {isScanning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Procesando...
            </>
          ) : status === 'success' ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Asociado
            </>
          ) : status === 'error' ? (
            <>
              <XCircle className="w-5 h-5" />
              Error
            </>
          ) : (
            <>
              <Scan className="w-5 h-5" />
              Asociar Empaque
            </>
          )}
        </motion.button>

        {/* Status Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-3 rounded-xl text-sm font-medium text-center',
              status === 'success' && (theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'),
              status === 'error' && (theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700')
            )}
          >
            {message}
          </motion.div>
        )}

        {/* Helper Text */}
        <p className={cn(
          'text-xs text-center',
          theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
        )}>
          Presiona Enter o haz clic en el botón para asociar
        </p>
      </div>
    </motion.div>
  )
}
