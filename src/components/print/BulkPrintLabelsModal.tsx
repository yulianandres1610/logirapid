'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Printer,
  X,
  Loader2,
  Minus,
  Plus,
  DollarSign,
  Tag,
  CheckSquare,
  Square,
  Package,
  Search
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'
import { cn } from '@/lib/utils'

interface BulkProduct {
  id: number
  name: string
  sku: string
  barcode: string
  sellingPrice: number
  currency: string
  unitOfMeasure?: string
  category?: string
  imageUrl?: string | null
}

interface BulkPrintLabelsModalProps {
  isOpen: boolean
  onClose: () => void
  onPrintSuccess?: (totalJobs: number) => void
}

export function BulkPrintLabelsModal({ isOpen, onClose, onPrintSuccess }: BulkPrintLabelsModalProps) {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const exchangeRates = useMarketExchangeRates()
  const USD_CUP = exchangeRates?.USD_CUP || 411

  const [loadingProducts, setLoadingProducts] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const [products, setProducts] = useState<BulkProduct[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [productCopies, setProductCopies] = useState<Record<number, number>>({})
  const [searchTerm, setSearchTerm] = useState('')

  // Filter products by search
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate totals
  const totalSelectedProducts = selectedProducts.size
  const totalCopies = Array.from(selectedProducts).reduce((sum, id) => sum + (productCopies[id] || 1), 0)

  useEffect(() => {
    if (isOpen) {
      fetchAllProducts()
    } else {
      // Reset state when closed
      setSelectedProducts(new Set())
      setProductCopies({})
      setSearchTerm('')
      setProgress({ current: 0, total: 0 })
    }
  }, [isOpen])

  const fetchAllProducts = async () => {
    setLoadingProducts(true)
    try {
      // Fetch all products (no pagination limit)
      const response = await fetch('/api/market/products?limit=1000', { credentials: 'include' })
      const data = await response.json()

      if (data.success && data.data?.products) {
        // Only include products with barcodes
        const productsWithBarcodes = data.data.products.filter((p: BulkProduct) => p.barcode)
        setProducts(productsWithBarcodes)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoadingProducts(false)
    }
  }

  const toggleProduct = (productId: number) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
      if (!productCopies[productId]) {
        setProductCopies(prev => ({ ...prev, [productId]: 1 }))
      }
    }
    setSelectedProducts(newSelected)
  }

  const selectAll = () => {
    const allIds = new Set(filteredProducts.map(p => p.id))
    setSelectedProducts(allIds)
    const newCopies: Record<number, number> = {}
    filteredProducts.forEach(p => {
      newCopies[p.id] = productCopies[p.id] || 1
    })
    setProductCopies(prev => ({ ...prev, ...newCopies }))
  }

  const deselectAll = () => {
    setSelectedProducts(new Set())
  }

  const updateCopies = (productId: number, delta: number) => {
    setProductCopies(prev => ({
      ...prev,
      [productId]: Math.max(1, Math.min(100, (prev[productId] || 1) + delta))
    }))
  }

  const setAllCopies = (copies: number) => {
    const newCopies: Record<number, number> = {}
    selectedProducts.forEach(id => {
      newCopies[id] = copies
    })
    setProductCopies(prev => ({ ...prev, ...newCopies }))
  }

  const detectBarcodeType = (barcode: string): string => {
    if (!barcode) return 'code128'
    const cleanBarcode = barcode.replace(/\D/g, '')
    if (cleanBarcode.length === 13) return 'ean13'
    if (cleanBarcode.length === 12) return 'upc'
    if (cleanBarcode.length === 8) return 'ean8'
    return 'code128'
  }

  const handlePrint = async (includePrice: boolean) => {
    if (totalSelectedProducts === 0) {
      showNotification('error', 'Error', 'Seleccione al menos un producto')
      return
    }

    setPrinting(true)
    setProgress({ current: 0, total: 1 }) // Single job

    try {
      // Build items array for bulk printing in a single job
      const items = Array.from(selectedProducts).map(productId => {
        const product = products.find(p => p.id === productId)
        if (!product) return null

        const copies = productCopies[productId] || 1
        const priceCUP = includePrice
          ? Math.round((product.sellingPrice || 0) * USD_CUP)
          : undefined

        return {
          productName: product.name,
          sku: product.sku || '',
          barcode: product.barcode,
          barcodeType: detectBarcodeType(product.barcode),
          priceCUP,
          currency: 'CUP',
          copies
        }
      }).filter(Boolean)

      // Send single job with all items
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          documentType: 'product_label',
          documentData: {
            includePrice,
            items, // All labels in one job
            labelSize: 'medium'
          },
          copies: 1, // Copies per item are in the items array
          sourceType: 'bulk_inventory',
          priority: 1
        })
      })

      const data = await response.json()

      setProgress({ current: 1, total: 1 })

      const priceInfo = includePrice ? 'con precio' : 'sin precio'
      if (response.ok && data.success) {
        showNotification(
          'success',
          'Impresión enviada',
          `${totalCopies} etiquetas ${priceInfo} enviadas a imprimir`
        )

        if (onPrintSuccess) {
          onPrintSuccess(totalSelectedProducts)
        }

        onClose()
      } else {
        showNotification(
          'error',
          'Error de impresión',
          data.error || 'Error al enviar trabajo de impresión'
        )
      }
    } catch (err) {
      console.error('Bulk print error:', err)
      showNotification('error', 'Error', 'Error al imprimir etiquetas')
    } finally {
      setPrinting(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  if (!isOpen) return null

  const isLoading = loadingProducts

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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          {/* Header */}
          <div className={cn(
            'px-6 py-4 border-b flex items-center justify-between flex-shrink-0',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600">
                <Printer className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Imprimir Etiquetas en Masa</h3>
                <p className="text-sm text-gray-500">
                  {totalSelectedProducts > 0
                    ? `${totalSelectedProducts} productos seleccionados (${totalCopies} etiquetas)`
                    : 'Seleccione los productos a imprimir'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={printing}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-3" />
                <p className="text-gray-500">Cargando...</p>
              </div>
            ) : (
              <>
                {/* Quick copies */}
                {totalSelectedProducts > 0 && (
                  <div className={cn(
                    'flex-shrink-0 px-4 py-3 border-b',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Copias por producto:
                      </p>
                      <div className="flex gap-2">
                        {[1, 2, 5, 10].map(n => (
                          <button
                            key={n}
                            onClick={() => setAllCopies(n)}
                            disabled={printing}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                              theme === 'dark'
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Products */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Search and select all */}
                  <div className={cn(
                    'p-4 border-b flex items-center gap-3',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={printing}
                        className={cn(
                          'w-full pl-9 pr-4 py-2 rounded-lg border text-sm',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        )}
                      />
                    </div>
                    <button
                      onClick={selectedProducts.size === filteredProducts.length ? deselectAll : selectAll}
                      disabled={printing}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                        theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      )}
                    >
                      {selectedProducts.size === filteredProducts.length ? (
                        <>
                          <CheckSquare className="w-4 h-4" />
                          Deseleccionar
                        </>
                      ) : (
                        <>
                          <Square className="w-4 h-4" />
                          Seleccionar Todos
                        </>
                      )}
                    </button>
                  </div>

                  {/* Products list */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                      {filteredProducts.length === 0 ? (
                        <div className="text-center py-12">
                          <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500">
                            {searchTerm ? 'No se encontraron productos' : 'No hay productos con código de barras'}
                          </p>
                        </div>
                      ) : (
                        filteredProducts.map(product => {
                          const isSelected = selectedProducts.has(product.id)
                          const copies = productCopies[product.id] || 1

                          return (
                            <div
                              key={product.id}
                              className={cn(
                                'p-3 rounded-xl border transition-all',
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                  : theme === 'dark'
                                    ? 'border-gray-700 hover:border-gray-600'
                                    : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                {/* Checkbox */}
                                <button
                                  onClick={() => toggleProduct(product.id)}
                                  disabled={printing}
                                  className="flex-shrink-0"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-emerald-500" />
                                  ) : (
                                    <Square className="w-5 h-5 text-gray-400" />
                                  )}
                                </button>

                                {/* Product info */}
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    'text-sm font-medium truncate',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {product.name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-500 font-mono">
                                      {product.barcode}
                                    </span>
                                    {product.sku && (
                                      <>
                                        <span className="text-gray-300 dark:text-gray-600">|</span>
                                        <span className="text-xs text-gray-500">
                                          SKU: {product.sku}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Price */}
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-bold text-emerald-600">
                                    ${Math.round(product.sellingPrice * USD_CUP).toLocaleString()} CUP
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    ${product.sellingPrice.toFixed(2)} USD
                                  </p>
                                </div>

                                {/* Copies */}
                                {isSelected && (
                                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                    <button
                                      onClick={() => updateCopies(product.id, -1)}
                                      disabled={printing}
                                      className="w-7 h-7 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="w-8 text-center font-bold text-sm">
                                      {copies}
                                    </span>
                                    <button
                                      onClick={() => updateCopies(product.id, 1)}
                                      disabled={printing}
                                      className="w-7 h-7 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Progress bar when printing */}
          {printing && progress.total > 0 && (
            <div className={cn(
              'px-6 py-3 border-t',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Imprimiendo...</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          {!isLoading && (
            <div className={cn(
              'px-6 py-4 border-t flex items-center justify-between',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <p className="text-sm text-gray-500">
                {products.length} productos con código de barras
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handlePrint(true)}
                  disabled={printing || totalSelectedProducts === 0}
                  className={cn(
                    'px-6 py-2.5 rounded-xl font-medium flex items-center gap-2',
                    'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
                    'hover:from-emerald-600 hover:to-emerald-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {printing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <DollarSign className="w-4 h-4" />
                  )}
                  Con Precio ({totalCopies})
                </button>
                <button
                  onClick={() => handlePrint(false)}
                  disabled={printing || totalSelectedProducts === 0}
                  className={cn(
                    'px-6 py-2.5 rounded-xl font-medium flex items-center gap-2',
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {printing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Tag className="w-4 h-4" />
                  )}
                  Sin Precio ({totalCopies})
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
