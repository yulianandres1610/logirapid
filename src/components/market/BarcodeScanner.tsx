'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScanBarcode,
  Check,
  X,
  AlertCircle,
  Loader2,
  Package,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ScannedProduct {
  id: number
  name: string
  sku: string
  barcode: string
  imageUrl?: string
  quantityOnHand: number
}

interface BarcodeScannerProps {
  onScan: (product: ScannedProduct) => void
  onError?: (error: string) => void
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  className?: string
  soundEnabled?: boolean
}

export function BarcodeScanner({
  onScan,
  onError,
  placeholder = 'Escanear código de barras o SKU...',
  autoFocus = true,
  disabled = false,
  className,
  soundEnabled: initialSoundEnabled = true
}: BarcodeScannerProps) {
  const { theme } = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState<ScannedProduct | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled)

  // Sound effects
  const playSound = useCallback((type: 'success' | 'error') => {
    if (!soundEnabled) return

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      if (type === 'success') {
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1)
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.2)
      } else {
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.1)
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
      }
    } catch (e) {
      // Audio not available, ignore
    }
  }, [soundEnabled])

  // Auto focus
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus()
    }
  }, [autoFocus, disabled])

  // Clear success/error after delay
  useEffect(() => {
    if (lastScanned || error) {
      const timer = setTimeout(() => {
        setLastScanned(null)
        setError(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [lastScanned, error])

  const handleScan = async (code: string) => {
    if (!code.trim() || isScanning) return

    setIsScanning(true)
    setError(null)
    setLastScanned(null)

    try {
      const response = await fetch('/api/market/products/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Producto no encontrado')
      }

      const product: ScannedProduct = data.data
      setLastScanned(product)
      playSound('success')
      onScan(product)
      setValue('')

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al buscar producto'
      setError(errorMessage)
      playSound('error')
      onError?.(errorMessage)
    } finally {
      setIsScanning(false)
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleScan(value)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')
    if (pastedText) {
      e.preventDefault()
      setValue(pastedText)
      // Auto scan after paste
      setTimeout(() => handleScan(pastedText), 100)
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        {/* Icon */}
        <div className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 z-10",
          isScanning ? 'animate-pulse' : ''
        )}>
          {isScanning ? (
            <Loader2 className={cn(
              "w-5 h-5 animate-spin",
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            )} />
          ) : (
            <ScanBarcode className={cn(
              "w-5 h-5 transition-colors",
              value
                ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )} />
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled || isScanning}
          className={cn(
            'w-full pl-11 pr-24 py-3 rounded-xl border-2 focus:outline-none focus:ring-2 transition-all',
            'font-mono text-sm',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            theme === 'dark'
              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20 placeholder:text-gray-500'
              : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20',
            isScanning && 'animate-pulse'
          )}
        />

        {/* Action buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Sound toggle */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              theme === 'dark'
                ? 'hover:bg-gray-700'
                : 'hover:bg-gray-100'
            )}
            title={soundEnabled ? 'Desactivar sonido' : 'Activar sonido'}
          >
            {soundEnabled ? (
              <Volume2 className={cn(
                "w-4 h-4",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )} />
            ) : (
              <VolumeX className={cn(
                "w-4 h-4",
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )} />
            )}
          </motion.button>

          {/* Scan button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleScan(value)}
            disabled={!value.trim() || isScanning || disabled}
            className={cn(
              "px-3 py-1.5 rounded-lg font-medium text-xs transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            )}
          >
            Buscar
          </motion.button>
        </div>
      </div>

      {/* Feedback Messages */}
      <AnimatePresence mode="wait">
        {lastScanned && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className={cn(
              "p-3 rounded-xl flex items-center gap-3",
              theme === 'dark' ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100'
            )}>
              {lastScanned.imageUrl ? (
                <img src={lastScanned.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <Package className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                )} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Check className={cn(
                  "w-4 h-4",
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                )} />
                <p className={cn(
                  "font-medium text-sm truncate",
                  theme === 'dark' ? 'text-green-300' : 'text-green-800'
                )}>
                  {lastScanned.name}
                </p>
              </div>
              <p className={cn(
                "text-xs mt-0.5",
                theme === 'dark' ? 'text-green-400' : 'text-green-600'
              )}>
                SKU: {lastScanned.sku} • Stock: {lastScanned.quantityOnHand}
              </p>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className={cn(
              "p-3 rounded-xl flex items-center gap-3",
              theme === 'dark' ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
            )}>
              <AlertCircle className={cn(
                "w-5 h-5",
                theme === 'dark' ? 'text-red-400' : 'text-red-600'
              )} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <X className={cn(
                  "w-4 h-4",
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                )} />
                <p className={cn(
                  "font-medium text-sm",
                  theme === 'dark' ? 'text-red-300' : 'text-red-800'
                )}>
                  No encontrado
                </p>
              </div>
              <p className={cn(
                "text-xs mt-0.5",
                theme === 'dark' ? 'text-red-400' : 'text-red-600'
              )}>
                {error}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Usage hint */}
      <p className={cn(
        "text-xs",
        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
      )}>
        💡 Escanea un código de barras o escribe el SKU y presiona Enter
      </p>
    </div>
  )
}

// Compact version for inline use
export function BarcodeScannerCompact({
  onScan,
  onError,
  placeholder = 'Escanear...',
  disabled = false,
  className
}: Omit<BarcodeScannerProps, 'autoFocus' | 'soundEnabled'>) {
  const { theme } = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  const handleScan = async (code: string) => {
    if (!code.trim() || isScanning) return

    setIsScanning(true)

    try {
      const response = await fetch('/api/market/products/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Producto no encontrado')
      }

      onScan(data.data)
      setValue('')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al buscar producto'
      onError?.(errorMessage)
    } finally {
      setIsScanning(false)
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleScan(value)
    }
  }

  return (
    <div className={cn("relative", className)}>
      <ScanBarcode className={cn(
        "absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4",
        theme === 'dark' ? 'text-gray-500' : 'text-gray-400',
        isScanning && 'animate-pulse'
      )} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isScanning}
        className={cn(
          'w-full pl-8 pr-3 py-2 rounded-lg border text-xs font-mono',
          'focus:outline-none focus:ring-2 transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          theme === 'dark'
            ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
            : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
        )}
      />
      {isScanning && (
        <Loader2 className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin",
          theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
        )} />
      )}
    </div>
  )
}
