'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Package, AlertCircle, Check, Barcode } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'

export interface Variant {
  id: number
  name: string
  sku: string
  barcode: string
  price: number
  costPrice?: number
  stock: number
  imageUrl: string | null
}

interface VariantSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  product: {
    id: number
    name: string
    imageUrl: string | null
    variants: Variant[]
  } | null
  onSelect: (variant: Variant) => void
  mode?: 'sale' | 'purchase' | 'receive' | 'count'
  showOutOfStock?: boolean // Show variants with 0 stock (for purchases/receiving)
  currency?: string
}

export function VariantSelectorModal({
  isOpen,
  onClose,
  product,
  onSelect,
  mode = 'sale',
  showOutOfStock = false,
  currency = 'USD'
}: VariantSelectorModalProps) {
  const { theme } = useTheme()
  const [search, setSearch] = useState('')
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedVariant(null)
    }
  }, [isOpen])

  // Filter variants based on search
  const filteredVariants = product?.variants.filter(variant => {
    const searchLower = search.toLowerCase()
    const matchesSearch =
      variant.name.toLowerCase().includes(searchLower) ||
      variant.sku?.toLowerCase().includes(searchLower) ||
      variant.barcode?.toLowerCase().includes(searchLower)

    // In sale mode, hide out of stock unless explicitly allowed
    if (mode === 'sale' && !showOutOfStock && variant.stock <= 0) {
      return false
    }

    return matchesSearch
  }) || []

  // Handle barcode scan within modal
  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!product) return

    const variant = product.variants.find(v =>
      v.barcode?.toLowerCase() === barcode.toLowerCase() ||
      v.sku?.toLowerCase() === barcode.toLowerCase()
    )

    if (variant) {
      // Check stock in sale mode
      if (mode === 'sale' && variant.stock <= 0 && !showOutOfStock) {
        // Variant found but out of stock
        return
      }
      onSelect(variant)
      onClose()
    }
  }, [product, onSelect, onClose, mode, showOutOfStock])

  useBarcodeScan({
    onScan: handleBarcodeScan,
    enabled: isOpen,
    minLength: 3,
    maxTimeBetweenKeys: 50
  })

  const handleSelect = (variant: Variant) => {
    if (mode === 'sale' && variant.stock <= 0 && !showOutOfStock) {
      return // Can't select out of stock in sale mode
    }
    onSelect(variant)
    onClose()
  }

  const getCurrencySymbol = (curr: string) => {
    const symbols: Record<string, string> = { USD: '$', CUP: '₱', MLC: 'MLC ', EUR: '€' }
    return symbols[curr] || curr + ' '
  }

  const symbol = getCurrencySymbol(currency)

  if (!isOpen || !product) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          {/* Header */}
          <div className={cn(
            'px-6 py-4 border-b flex items-center justify-between flex-shrink-0',
            theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          )}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                'w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              )}>
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  Seleccionar Variante
                </h3>
                <p className="text-sm text-gray-500 truncate">{product.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 py-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar variante o escanear código..."
                className={cn(
                  'w-full pl-12 pr-4 py-3 rounded-xl border transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500/50'
                )}
                autoFocus
              />
              <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>

          {/* Variants Grid */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {filteredVariants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mb-3" />
                <p className="text-gray-500 font-medium">No se encontraron variantes</p>
                <p className="text-sm text-gray-400 mt-1">
                  {search ? 'Intenta con otro término de búsqueda' : 'Este producto no tiene variantes disponibles'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredVariants.map((variant) => {
                  const isOutOfStock = variant.stock <= 0
                  const isDisabled = mode === 'sale' && isOutOfStock && !showOutOfStock

                  return (
                    <motion.button
                      key={variant.id}
                      whileHover={!isDisabled ? { scale: 1.02 } : undefined}
                      whileTap={!isDisabled ? { scale: 0.98 } : undefined}
                      onClick={() => handleSelect(variant)}
                      disabled={isDisabled}
                      className={cn(
                        'relative p-4 rounded-xl border-2 transition-all text-left',
                        isDisabled
                          ? 'opacity-50 cursor-not-allowed border-gray-300 dark:border-gray-600'
                          : selectedVariant?.id === variant.id
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                            : theme === 'dark'
                              ? 'border-gray-700 bg-gray-700/50 hover:border-gray-500'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                      )}
                    >
                      {/* Variant Image */}
                      <div className={cn(
                        'w-full aspect-square rounded-lg overflow-hidden mb-3 flex items-center justify-center',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                      )}>
                        {variant.imageUrl ? (
                          <img
                            src={variant.imageUrl}
                            alt={variant.name}
                            className="w-full h-full object-cover"
                          />
                        ) : product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={variant.name}
                            className="w-full h-full object-cover opacity-50"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-gray-400" />
                        )}
                      </div>

                      {/* Variant Info */}
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                        {variant.name}
                      </h4>
                      <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                        {variant.sku}
                      </p>

                      {/* Price */}
                      <p className="text-lg font-bold text-emerald-600 mt-2">
                        {symbol}{Number(mode === 'purchase' ? (variant.costPrice || variant.price) : variant.price).toFixed(2)}
                      </p>

                      {/* Stock */}
                      <p className={cn(
                        'text-xs mt-1',
                        isOutOfStock ? 'text-red-500 font-medium' :
                        variant.stock <= 5 ? 'text-amber-500' :
                        'text-gray-500'
                      )}>
                        Stock: {variant.stock}
                      </p>

                      {/* Out of stock overlay */}
                      {isOutOfStock && mode === 'sale' && (
                        <div className="absolute inset-0 bg-gray-900/10 rounded-xl flex items-center justify-center">
                          <span className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-full">
                            Sin Stock
                          </span>
                        </div>
                      )}

                      {/* Selected indicator */}
                      {selectedVariant?.id === variant.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer with variant count */}
          <div className={cn(
            'px-6 py-3 border-t flex items-center justify-between text-sm flex-shrink-0',
            theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
          )}>
            <span className="text-gray-500">
              {filteredVariants.length} de {product.variants.length} variantes
            </span>
            <span className="text-gray-400 text-xs">
              Escanea el código para seleccionar rápidamente
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default VariantSelectorModal
