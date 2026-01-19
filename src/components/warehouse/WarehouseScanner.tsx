'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Barcode, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'

interface WarehouseScannerProps {
  warehouseId: number
  onProductScanned: (product: ScannedProductData) => void
  onError: (error: string) => void
  disabled?: boolean
}

export interface ProductVariant {
  id: number
  name: string
  sku: string
  barcode: string | null
  price: number
  costPrice: number
  imageUrl: string | null
  stock: number
}

export interface ScannedProductData {
  product: {
    id: number
    name: string
    description: string | null
    sku: string
    barcode: string
    category: string | null
    unit: string
    costPrice: number
    sellingPrice: number
    imageUrl: string | null
    hasVariants?: boolean
  }
  variant?: {
    id: number
    name: string
    sku: string
    barcode: string | null
    price: number
    costPrice: number
    imageUrl: string | null
  }
  variants?: ProductVariant[]
  stock: {
    warehouseId: number
    warehouseName: string
    quantityOnHand: number
    quantityReserved: number
    quantityAvailable: number
    allowNegative: boolean
  }
}

type ScanStatus = 'idle' | 'scanning' | 'success' | 'error'

export default function WarehouseScanner({
  warehouseId,
  onProductScanned,
  onError,
  disabled = false
}: WarehouseScannerProps) {
  const [searchValue, setSearchValue] = useState('')
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [lastScannedName, setLastScannedName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const successSoundRef = useRef<HTMLAudioElement | null>(null)
  const errorSoundRef = useRef<HTMLAudioElement | null>(null)

  // Initialize sounds
  useEffect(() => {
    successSoundRef.current = new Audio('/sounds/beep-success.mp3')
    errorSoundRef.current = new Audio('/sounds/beep-error.mp3')
    successSoundRef.current.volume = 0.3
    errorSoundRef.current.volume = 0.3
  }, [])

  const playSound = (type: 'success' | 'error') => {
    try {
      if (type === 'success' && successSoundRef.current) {
        successSoundRef.current.currentTime = 0
        successSoundRef.current.play().catch(() => {})
      } else if (type === 'error' && errorSoundRef.current) {
        errorSoundRef.current.currentTime = 0
        errorSoundRef.current.play().catch(() => {})
      }
    } catch {}
  }

  const handleScan = async (barcode: string) => {
    if (disabled) return

    setScanStatus('scanning')
    setSearchValue(barcode)

    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/scan-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode })
      })

      const data = await response.json()

      if (data.success) {
        setScanStatus('success')
        setLastScannedName(data.data.product.name)
        playSound('success')
        onProductScanned(data.data)

        // Reset after showing success
        setTimeout(() => {
          setSearchValue('')
          setScanStatus('idle')
          inputRef.current?.focus()
        }, 500)
      } else {
        setScanStatus('error')
        playSound('error')
        onError(data.error || 'Producto no encontrado')

        // Reset after showing error
        setTimeout(() => {
          setSearchValue('')
          setScanStatus('idle')
          inputRef.current?.focus()
        }, 1500)
      }
    } catch (error) {
      setScanStatus('error')
      playSound('error')
      onError('Error de conexion')

      setTimeout(() => {
        setSearchValue('')
        setScanStatus('idle')
        inputRef.current?.focus()
      }, 1500)
    }
  }

  // Use barcode scan hook
  useBarcodeScan({
    onScan: handleScan,
    onError: (err) => {
      setScanStatus('error')
      onError(err)
    },
    enabled: !disabled,
    minLength: 3
  })

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim().length >= 3) {
      handleScan(searchValue.trim())
    }
  }

  const getStatusStyles = () => {
    switch (scanStatus) {
      case 'scanning':
        return 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
      case 'success':
        return 'border-green-500 ring-2 ring-green-200 dark:ring-green-800'
      case 'error':
        return 'border-red-500 ring-2 ring-red-200 dark:ring-red-800'
      default:
        return 'border-gray-300 dark:border-gray-600 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-200 dark:focus-within:ring-purple-800'
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleManualSubmit} className="relative">
        <motion.div
          animate={{
            scale: scanStatus === 'scanning' ? [1, 1.01, 1] : 1
          }}
          transition={{ repeat: scanStatus === 'scanning' ? Infinity : 0, duration: 0.5 }}
          className={`
            flex items-center gap-3 px-4 py-3
            bg-white dark:bg-gray-800
            border-2 rounded-xl
            transition-all duration-200
            ${getStatusStyles()}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <AnimatePresence mode="wait">
            {scanStatus === 'scanning' ? (
              <motion.div
                key="scanning"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ rotate: { repeat: Infinity, duration: 1, ease: 'linear' } }}
              >
                <Loader2 className="w-6 h-6 text-blue-500" />
              </motion.div>
            ) : scanStatus === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
              >
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </motion.div>
            ) : scanStatus === 'error' ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
              >
                <XCircle className="w-6 h-6 text-red-500" />
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Barcode className="w-6 h-6 text-gray-400" />
              </motion.div>
            )}
          </AnimatePresence>

          <input
            ref={inputRef}
            type="text"
            value={scanStatus === 'success' ? lastScannedName : searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Escanear codigo de barras o buscar producto..."
            disabled={disabled || scanStatus === 'scanning'}
            className={`
              flex-1 bg-transparent outline-none
              text-gray-900 dark:text-white
              placeholder-gray-400 dark:placeholder-gray-500
              text-lg
              ${disabled ? 'cursor-not-allowed' : ''}
              ${scanStatus === 'success' ? 'text-green-600 dark:text-green-400 font-medium' : ''}
              ${scanStatus === 'error' ? 'text-red-600 dark:text-red-400' : ''}
            `}
            autoComplete="off"
            autoFocus
          />

          <button
            type="submit"
            disabled={disabled || searchValue.trim().length < 3 || scanStatus === 'scanning'}
            className={`
              p-2 rounded-lg transition-colors
              ${disabled || searchValue.trim().length < 3
                ? 'text-gray-300 dark:text-gray-600'
                : 'text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30'}
            `}
          >
            <Search className="w-5 h-5" />
          </button>
        </motion.div>
      </form>

      {/* Scanner instruction */}
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
        Usa el lector de codigos de barras o escribe el SKU/codigo manualmente
      </p>
    </div>
  )
}
