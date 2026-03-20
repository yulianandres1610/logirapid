'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Printer, X, Loader2, Minus, Plus, DollarSign, Tag, ChevronDown } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'
import { cn } from '@/lib/utils'

interface ProductVariant {
  id: number
  name: string
  barcode: string | null
  sku?: string | null
  price?: number
  imageUrl?: string | null
}

interface ProductLabelData {
  productName: string
  sku: string
  barcode: string
  barcodeType?: 'code128' | 'ean13' | 'upc' | 'ean8'
  price: number
  currency: string
  unitOfMeasure?: string
  category?: string
  description?: string
  variants?: ProductVariant[]
}

interface PrintLabelModalProps {
  isOpen: boolean
  onClose: () => void
  productData: ProductLabelData
  warehouseId?: number
  onPrintSuccess?: (jobNumber: string) => void
}

export function PrintLabelModal({ isOpen, onClose, productData, warehouseId, onPrintSuccess }: PrintLabelModalProps) {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const exchangeRates = useMarketExchangeRates()
  const USD_CUP = exchangeRates?.USD_CUP || 411

  const [printing, setPrinting] = useState(false)
  const [copies, setCopies] = useState(1)
  const [variantCopies, setVariantCopies] = useState<Record<number, number>>({})
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [labelSize, setLabelSize] = useState<'2x1' | '3x2' | '4x6'>('2x1')

  useEffect(() => {
    if (isOpen) {
      // Fetch available print services for product_label
      fetch('/api/print-services/available?documentType=product_label', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data) {
            const online = data.data.filter((s: any) => s.online)
            setAvailableServices(online.length > 0 ? online : data.data)
            // Auto-select first if only one
            if (data.data.length === 1) {
              setSelectedServiceId(data.data[0].id)
            } else {
              setSelectedServiceId(null) // Let user choose or auto
            }
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  if (!productData) {
    console.error('[PrintLabelModal] productData is null or undefined')
    return null
  }

  const hasVariants = productData.variants && Array.isArray(productData.variants) && productData.variants.length > 0
  const totalCopies = copies + Object.values(variantCopies).reduce((a, b) => a + (b || 0), 0)

  const updateVariantCopies = (variantId: number, delta: number) => {
    setVariantCopies(prev => ({
      ...prev,
      [variantId]: Math.max(0, Math.min(50, (prev[variantId] || 0) + delta))
    }))
  }

  const handlePrint = async (includePrice: boolean) => {
    if (totalCopies === 0) {
      showNotification('error', 'Error', 'Seleccione al menos una etiqueta para imprimir')
      return
    }

    setPrinting(true)
    try {
      const jobs: { documentType: string; documentData: Record<string, unknown>; copies: number }[] = []

      const calculatePriceCUP = (priceUSD: number) => {
        if (!includePrice) return undefined
        const rate = USD_CUP || 411
        const price = Number(priceUSD) || 0
        if (rate <= 0 || price <= 0) return undefined
        return Math.round(price * rate)
      }

      if (copies > 0) {
        jobs.push({
          documentType: 'product_label',
          documentData: {
            productName: productData.productName || 'Producto',
            sku: productData.sku || '',
            barcode: productData.barcode || '',
            barcodeType: detectBarcodeType(productData.barcode || ''),
            includePrice,
            priceCUP: calculatePriceCUP(Number(productData.price) || 0),
            priceUSD: Number(productData.price) || 0,
            currency: 'CUP',
            unitOfMeasure: productData.unitOfMeasure,
            category: productData.category,
            description: productData.description,
            labelSize
          },
          copies
        })
      }

      if (productData.variants) {
        for (const variant of productData.variants) {
          const qty = variantCopies[variant.id] || 0
          if (qty > 0) {
            const variantPrice = Number(variant.price) || Number(productData.price) || 0
            jobs.push({
              documentType: 'product_label',
              documentData: {
                productName: `${productData.productName || 'Producto'} - ${variant.name || 'Variante'}`,
                sku: variant.sku || productData.sku || '',
                barcode: variant.barcode || '',
                barcodeType: detectBarcodeType(variant.barcode || ''),
                includePrice,
                priceCUP: calculatePriceCUP(variantPrice),
                priceUSD: variantPrice,
                currency: 'CUP',
                unitOfMeasure: productData.unitOfMeasure,
                category: productData.category,
                description: productData.description,
                labelSize
              },
              copies: qty
            })
          }
        }
      }

      const jobNumbers: string[] = []
      for (const job of jobs) {
        const response = await fetch('/api/print-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...job,
            warehouseId,
            serviceId: selectedServiceId,
            sourceType: 'product',
            priority: 1
          })
        })

        const data = await response.json()
        if (response.ok && data.success) {
          jobNumbers.push(data.data.jobNumber)
        } else {
          throw new Error(data.error || 'Error al enviar trabajo de impresión')
        }
      }

      const priceInfo = includePrice ? 'con precio CUP' : 'sin precio'
      showNotification(
        'success',
        'Imprimiendo',
        `${totalCopies} etiqueta${totalCopies > 1 ? 's' : ''} ${priceInfo} enviada${totalCopies > 1 ? 's' : ''} a imprimir`
      )

      if (onPrintSuccess && jobNumbers.length > 0) {
        onPrintSuccess(jobNumbers.join(', '))
      }

      onClose()
    } catch (err) {
      console.error('Print error:', err)
      showNotification('error', 'Error', err instanceof Error ? err.message : 'Error al imprimir')
    } finally {
      setPrinting(false)
    }
  }

  const detectBarcodeType = (barcode: string): string => {
    if (!barcode) return 'code128'
    const cleanBarcode = barcode.replace(/\D/g, '')
    if (cleanBarcode.length === 13) return 'ean13'
    if (cleanBarcode.length === 12) return 'upc'
    if (cleanBarcode.length === 8) return 'ean8'
    return 'code128'
  }

  if (!isOpen) return null

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
            'w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          {/* Header compacto */}
          <div className={cn(
            'px-4 py-3 border-b flex items-center justify-between',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Imprimir Etiquetas</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
              <div>
                <div className="space-y-3">
                  {/* Printer selector - shown when multiple services available */}
                  {availableServices.length > 1 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                        Impresora
                      </p>
                      <div className="relative">
                        <select
                          value={selectedServiceId || ''}
                          onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : null)}
                          className={cn(
                            'w-full px-3 py-2 pr-8 rounded-lg border text-sm font-medium appearance-none cursor-pointer',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-900'
                          )}
                        >
                          <option value="">Automatico (mejor disponible)</option>
                          {availableServices.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name}{s.printerName ? ` — ${s.printerName.replace(/_/g, ' ')}` : ''}{s.online ? '' : ' (offline)'}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {/* Label size selector */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      Tamano de Etiqueta
                    </p>
                    <div className="flex gap-2">
                      {([
                        { key: '2x1' as const, label: '2x1"', desc: 'Nombre + Codigo' },
                        { key: '3x2' as const, label: '3x2"', desc: 'SKU + Codigo + Precio' },
                        { key: '4x6' as const, label: '4x6"', desc: 'Completa (CUP + USD)' },
                      ]).map(size => (
                        <button
                          key={size.key}
                          onClick={() => setLabelSize(size.key)}
                          className={cn(
                            'flex-1 py-2 px-2 rounded-lg border transition-all text-center',
                            labelSize === size.key
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                              : theme === 'dark' ? 'border-gray-600 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          <p className={cn('text-sm font-bold', labelSize === size.key ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300')}>{size.label}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{size.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Etiquetas ({totalCopies})
                  </p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {/* Producto base */}
                    <div className={cn(
                      'p-2.5 rounded-lg border',
                      copies > 0
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                        : theme === 'dark'
                          ? 'border-gray-600'
                          : 'border-gray-200'
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {productData.productName}
                          </p>
                          <p className="text-xs text-gray-500 font-mono truncate">
                            {productData.barcode || productData.sku}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setCopies(Math.max(0, copies - 1))}
                            className="w-7 h-7 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{copies}</span>
                          <button
                            onClick={() => setCopies(Math.min(50, copies + 1))}
                            className="w-7 h-7 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Variantes */}
                    {hasVariants && productData.variants?.map(variant => {
                      const qty = variantCopies[variant.id] || 0
                      return (
                        <div
                          key={variant.id}
                          className={cn(
                            'p-2.5 rounded-lg border',
                            qty > 0
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                              : theme === 'dark'
                                ? 'border-gray-600'
                                : 'border-gray-200'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {variant.name}
                              </p>
                              <p className="text-xs text-gray-500 font-mono truncate">
                                {variant.barcode || variant.sku || 'Sin código'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => updateVariantCopies(variant.id, -1)}
                                className="w-7 h-7 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center font-bold text-sm">{qty}</span>
                              <button
                                onClick={() => updateVariantCopies(variant.id, 1)}
                                className="w-7 h-7 rounded flex items-center justify-center bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
          </div>

          {/* Footer compacto */}
          <div className={cn(
              'px-4 py-3 border-t flex gap-2',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <button
                onClick={() => handlePrint(true)}
                disabled={printing || totalCopies === 0}
                className={cn(
                  'flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 text-sm',
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
                Con Precio
              </button>
              <button
                onClick={() => handlePrint(false)}
                disabled={printing || totalCopies === 0}
                className={cn(
                  'flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 text-sm',
                  theme === 'dark'
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {printing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Tag className="w-4 h-4" />
                )}
                Sin Precio
              </button>
            </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
