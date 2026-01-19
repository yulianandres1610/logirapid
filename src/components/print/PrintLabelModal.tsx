'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Printer, X, Loader2, CheckCircle, AlertCircle, Wifi, WifiOff, Minus, Plus, DollarSign, Tag } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'
import { cn } from '@/lib/utils'

interface PrintService {
  id: number
  serviceCode: string
  serviceName: string
  status: string
  printers: PrinterInfo[]
}

interface PrinterInfo {
  id: number
  printerName: string
  printerId: string
  printerType: string
  isOnline: boolean
  isDefault: boolean
}

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
  onPrintSuccess?: (jobNumber: string) => void
}

export function PrintLabelModal({ isOpen, onClose, productData, onPrintSuccess }: PrintLabelModalProps) {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const exchangeRates = useMarketExchangeRates()
  const USD_CUP_BCC = exchangeRates?.USD_CUP_BCC || 411 // Tasa BCC para etiquetas con fallback

  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [services, setServices] = useState<PrintService[]>([])
  const [selectedService, setSelectedService] = useState<PrintService | null>(null)
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterInfo | null>(null)
  const [copies, setCopies] = useState(1)
  const [variantCopies, setVariantCopies] = useState<Record<number, number>>({})
  const [error, setError] = useState<string | null>(null)

  // Debug log para ver los datos recibidos
  useEffect(() => {
    if (isOpen) {
      console.log('[PrintLabelModal] Datos recibidos:', {
        productName: productData?.productName,
        sku: productData?.sku,
        barcode: productData?.barcode,
        price: productData?.price,
        currency: productData?.currency,
        hasVariants: !!productData?.variants,
        variantsCount: productData?.variants?.length || 0
      })
    }
  }, [isOpen, productData])

  // Validate productData
  if (!productData) {
    console.error('[PrintLabelModal] productData is null or undefined')
    return null
  }

  // Calculate total copies with safe fallbacks
  const hasVariants = productData.variants && Array.isArray(productData.variants) && productData.variants.length > 0
  const totalCopies = copies + Object.values(variantCopies).reduce((a, b) => a + (b || 0), 0)

  const updateVariantCopies = (variantId: number, delta: number) => {
    setVariantCopies(prev => ({
      ...prev,
      [variantId]: Math.max(0, Math.min(50, (prev[variantId] || 0) + delta))
    }))
  }

  useEffect(() => {
    if (isOpen) {
      fetchPrintServices()
    }
  }, [isOpen])

  const fetchPrintServices = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/print/services?includeOffline=false', {
        credentials: 'include'
      })
      const data = await response.json()

      // Check for API errors first
      if (!data.success) {
        setError(data.error || 'Error al cargar servicios de impresión')
        return
      }

      if (data.data?.services && data.data.services.length > 0) {
        // Filter to only active services with printers
        const activeServices = data.data.services.filter(
          (s: PrintService) => s.status === 'active' && s.printers?.length > 0
        )
        setServices(activeServices)

        // Auto-select first service and default label printer
        if (activeServices.length > 0) {
          const firstService = activeServices[0]
          setSelectedService(firstService)

          // Filter to only label printers
          const labelPrinters = firstService.printers.filter((p: PrinterInfo) =>
            p.printerType === 'label_barcode' ||
            p.printerType === 'label_4x6' ||
            p.printerName.toLowerCase().includes('label') ||
            p.printerName.toLowerCase().includes('barcode') ||
            p.printerName.toLowerCase().includes('etiqueta')
          )

          // Find default or first online label printer
          const defaultPrinter = labelPrinters.find((p: PrinterInfo) => p.isDefault && p.isOnline)
            || labelPrinters.find((p: PrinterInfo) => p.isOnline)
            || labelPrinters[0]

          setSelectedPrinter(defaultPrinter || null)
        } else {
          setError('No hay servicios de impresión activos con impresoras configuradas')
        }
      } else {
        setError('No se encontraron servicios de impresión. Configure un servicio en la aplicación de escritorio.')
      }
    } catch (err) {
      console.error('Error fetching print services:', err)
      setError('Error al cargar los servicios de impresión')
    } finally {
      setLoading(false)
    }
  }

  // includePrice: true = con precio CUP, false = solo nombre y codigo
  const handlePrint = async (includePrice: boolean) => {
    if (!selectedService || !selectedPrinter) {
      showNotification('error', 'Error', 'Seleccione una impresora')
      return
    }

    if (totalCopies === 0) {
      showNotification('error', 'Error', 'Seleccione al menos una etiqueta para imprimir')
      return
    }

    setPrinting(true)
    try {
      const jobs: { documentType: string; documentData: Record<string, unknown>; copies: number }[] = []

      // Calculate price in CUP using BCC rate
      const calculatePriceCUP = (priceUSD: number) => {
        if (!includePrice) return undefined
        const rate = USD_CUP_BCC || 411
        const price = Number(priceUSD) || 0
        if (rate <= 0 || price <= 0) return undefined
        return Math.round(price * rate)
      }

      // Add base product job if copies > 0
      if (copies > 0) {
        jobs.push({
          documentType: 'product_label',
          documentData: {
            productName: productData.productName || 'Producto',
            sku: productData.sku || '',
            barcode: productData.barcode || '',
            barcodeType: detectBarcodeType(productData.barcode || ''),
            includePrice,
            priceCUP: calculatePriceCUP(productData.price || 0),
            currency: 'CUP',
            unitOfMeasure: productData.unitOfMeasure,
            category: productData.category,
            description: productData.description,
            labelSize: 'medium'
          },
          copies
        })
      }

      // Add variant jobs
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
                currency: 'CUP',
                unitOfMeasure: productData.unitOfMeasure,
                category: productData.category,
                labelSize: 'medium'
              },
              copies: qty
            })
          }
        }
      }

      // Send all jobs
      const jobNumbers: string[] = []
      for (const job of jobs) {
        const response = await fetch('/api/print/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...job,
            printServiceId: selectedService.id,
            printerId: selectedPrinter.id,
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
        `${jobNumbers.length} trabajo(s) ${priceInfo} enviado(s) a ${selectedPrinter.printerName} (${totalCopies} etiquetas)`
      )
      onPrintSuccess?.(jobNumbers[0])
      onClose()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      showNotification('error', 'Error de impresión', errorMessage)
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
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-full max-w-md rounded-2xl shadow-2xl overflow-hidden',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          {/* Header */}
          <div className={cn(
            'px-6 py-4 border-b flex items-center justify-between',
            theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          )}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Printer className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Imprimir Etiqueta</h3>
                <p className="text-xs text-gray-500 truncate max-w-[200px]">{productData.productName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
                <p className="text-sm text-gray-500">Buscando impresoras...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
                <p className="text-gray-600 dark:text-gray-300 text-center">{error}</p>
                <button
                  onClick={fetchPrintServices}
                  className="mt-4 text-sm text-emerald-600 hover:text-emerald-700"
                >
                  Reintentar
                </button>
              </div>
            ) : services.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
                <p className="text-gray-600 dark:text-gray-300 text-center font-medium">
                  No hay servicios de impresión disponibles
                </p>
                <p className="text-sm text-gray-500 text-center mt-1">
                  Instala y configura LogiRapid Print Service
                </p>
              </div>
            ) : (
              <>
                {/* Service Selector (if multiple) */}
                {services.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Servicio de Impresión
                    </label>
                    <select
                      value={selectedService?.id || ''}
                      onChange={(e) => {
                        const service = services.find(s => s.id === parseInt(e.target.value))
                        setSelectedService(service || null)
                        if (service) {
                          // Filter to only label printers
                          const labelPrinters = service.printers.filter(p =>
                            p.printerType === 'label_barcode' ||
                            p.printerType === 'label_4x6' ||
                            p.printerName.toLowerCase().includes('label') ||
                            p.printerName.toLowerCase().includes('barcode') ||
                            p.printerName.toLowerCase().includes('etiqueta')
                          )
                          const defaultPrinter = labelPrinters.find(p => p.isDefault && p.isOnline)
                            || labelPrinters.find(p => p.isOnline)
                            || labelPrinters[0]
                          setSelectedPrinter(defaultPrinter || null)
                        }
                      }}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border transition-colors',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-200 text-gray-900'
                      )}
                    >
                      {services.map(service => (
                        <option key={service.id} value={service.id}>
                          {service.serviceName} ({service.serviceCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Printer Selector - Only show label printers for product labels */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Impresora de Etiquetas
                  </label>
                  <div className="space-y-2">
                    {selectedService?.printers
                      .filter(printer =>
                        printer.printerType === 'label_barcode' ||
                        printer.printerType === 'label_4x6' ||
                        printer.printerName.toLowerCase().includes('label') ||
                        printer.printerName.toLowerCase().includes('barcode') ||
                        printer.printerName.toLowerCase().includes('etiqueta')
                      )
                      .map(printer => (
                      <button
                        key={printer.id}
                        onClick={() => setSelectedPrinter(printer)}
                        className={cn(
                          'w-full p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between',
                          selectedPrinter?.id === printer.id
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                            : theme === 'dark'
                              ? 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Printer className={cn(
                            'w-5 h-5',
                            selectedPrinter?.id === printer.id ? 'text-emerald-600' : 'text-gray-400'
                          )} />
                          <div>
                            <p className={cn(
                              'font-medium',
                              selectedPrinter?.id === printer.id
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-gray-900 dark:text-white'
                            )}>
                              {printer.printerName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {printer.printerType === 'thermal_80mm' ? 'Térmica 80mm' :
                               printer.printerType === 'label_4x6' ? 'Etiquetas 4x6' :
                               printer.printerType === 'label_barcode' ? 'Código de barras' :
                               'Estándar'}
                              {printer.isDefault && ' • Predeterminada'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {printer.isOnline ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <Wifi className="w-4 h-4" />
                              <span className="text-xs">Online</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400">
                              <WifiOff className="w-4 h-4" />
                              <span className="text-xs">Offline</span>
                            </div>
                          )}
                          {selectedPrinter?.id === printer.id && (
                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product and Variants Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Seleccionar etiquetas a imprimir
                  </label>

                  {/* Base Product */}
                  <div className={cn(
                    'p-4 rounded-xl border-2',
                    copies > 0
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : theme === 'dark'
                        ? 'border-gray-600 bg-gray-700/50'
                        : 'border-gray-200 bg-gray-50'
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-semibold truncate',
                          copies > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                        )}>
                          {productData.productName}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {productData.barcode || productData.sku}
                        </p>
                        <p className="text-sm font-medium text-emerald-600">
                          {productData.currency === 'USD' ? '$' : productData.currency}
                          {(Number(productData.price) || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => setCopies(Math.max(0, copies - 1))}
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-600 hover:bg-gray-500 text-white'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                          )}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <div className={cn(
                          'w-12 h-8 rounded-lg flex items-center justify-center text-lg font-bold',
                          theme === 'dark' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-900'
                        )}>
                          {copies}
                        </div>
                        <button
                          onClick={() => setCopies(Math.min(50, copies + 1))}
                          className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-600 hover:bg-gray-500 text-white'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                          )}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Variants */}
                  {hasVariants && (
                    <>
                      <p className="text-xs text-gray-500 uppercase tracking-wide pt-2">
                        Variantes ({productData.variants?.length})
                      </p>
                      {productData.variants?.map(variant => {
                        const qty = variantCopies[variant.id] || 0
                        return (
                          <div
                            key={variant.id}
                            className={cn(
                              'p-4 rounded-xl border-2',
                              qty > 0
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                : theme === 'dark'
                                  ? 'border-gray-600 bg-gray-700/50'
                                  : 'border-gray-200 bg-gray-50'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  'font-semibold truncate',
                                  qty > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                                )}>
                                  {variant.name}
                                </p>
                                <p className="text-xs text-gray-500 font-mono">
                                  {variant.barcode || variant.sku || 'Sin codigo'}
                                </p>
                                <p className="text-sm font-medium text-emerald-600">
                                  {productData.currency === 'USD' ? '$' : productData.currency}
                                  {(Number(variant.price) || Number(productData.price) || 0).toFixed(2)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <button
                                  onClick={() => updateVariantCopies(variant.id, -1)}
                                  className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                                    theme === 'dark'
                                      ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                  )}
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <div className={cn(
                                  'w-12 h-8 rounded-lg flex items-center justify-center text-lg font-bold',
                                  theme === 'dark' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-900'
                                )}>
                                  {qty}
                                </div>
                                <button
                                  onClick={() => updateVariantCopies(variant.id, 1)}
                                  className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                                    theme === 'dark'
                                      ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                  )}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* Total */}
                  <div className={cn(
                    'p-3 rounded-xl text-center',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                  )}>
                    <p className="text-sm text-gray-500">Total de etiquetas</p>
                    <p className="text-2xl font-bold text-emerald-600">{totalCopies}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!loading && services.length > 0 && (
            <div className={cn(
              'px-6 py-4 border-t',
              theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
            )}>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => handlePrint(true)}
                  disabled={printing || !selectedPrinter || totalCopies === 0}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors',
                    'bg-gradient-to-r from-green-500 to-green-600 text-white',
                    'hover:from-green-600 hover:to-green-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {printing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <DollarSign className="w-5 h-5" />
                  )}
                  Con Precio (CUP)
                </button>
                <button
                  onClick={() => handlePrint(false)}
                  disabled={printing || !selectedPrinter || totalCopies === 0}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  )}
                >
                  {printing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Tag className="w-5 h-5" />
                  )}
                  Sin Precio
                </button>
              </div>
              <button
                onClick={onClose}
                className={cn(
                  'w-full py-2 rounded-xl font-medium transition-colors text-sm',
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-300'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                Cancelar
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PrintLabelModal
