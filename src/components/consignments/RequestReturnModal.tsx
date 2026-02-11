'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Package,
  Loader2,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Warehouse,
  Info
} from 'lucide-react'
import Image from 'next/image'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ProductInfo {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
}

interface OrderLine {
  id: number
  product: ProductInfo
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  quantityOrdered: number
  quantityReceived: number
  quantitySold: number
  quantityReturned: number
  unitCost: number
  unitPrice: number
  lotNumber: string | null
  expirationDate: string | null
}

interface SupplierInfo {
  id: number
  code: string
  name: string
}

interface WarehouseInfo {
  id: number
  code: string
  name: string
}

interface RequestReturnModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (data: { returnId: number; returnNumber: string; totalUnits: number; totalValue: number }) => void
  orderId: number
  orderNumber: string
  supplier: SupplierInfo
  warehouse: WarehouseInfo
  lines: OrderLine[]
}

interface ReturnLine {
  orderLineId: number
  quantity: number
  available: number
  productName: string
  variantName: string | null
  unitCost: number
}

const RETURN_REASONS = [
  { id: 'not_sold', label: 'Producto no vendido', description: 'Mercancía sin demanda' },
  { id: 'damaged', label: 'Producto dañado', description: 'Mercancía con daños físicos' },
  { id: 'expired', label: 'Producto próximo a vencer', description: 'Fecha de vencimiento cercana' },
  { id: 'agreement', label: 'Acuerdo con proveedor', description: 'Acordado previamente' },
  { id: 'other', label: 'Otro motivo', description: 'Especificar en notas' }
]

export default function RequestReturnModal({
  isOpen,
  onClose,
  onSuccess,
  orderId,
  orderNumber,
  supplier,
  warehouse,
  lines
}: RequestReturnModalProps) {
  const { theme } = useTheme()
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([])
  const [selectedReason, setSelectedReason] = useState<string>('not_sold')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize return lines from available products
  useEffect(() => {
    if (isOpen) {
      const initialLines: ReturnLine[] = lines
        .map(line => {
          const available = line.quantityReceived - line.quantitySold - line.quantityReturned
          return {
            orderLineId: line.id,
            quantity: 0,
            available,
            productName: line.variantName
              ? `${line.product.name} - ${line.variantName}`
              : line.product.name,
            variantName: line.variantName,
            unitCost: line.unitCost
          }
        })
        .filter(line => line.available > 0)

      setReturnLines(initialLines)
      setSelectedReason('not_sold')
      setNotes('')
      setError(null)
    }
  }, [isOpen, lines])

  const updateQuantity = (orderLineId: number, delta: number) => {
    setReturnLines(prev => prev.map(line => {
      if (line.orderLineId === orderLineId) {
        const newQty = Math.max(0, Math.min(line.quantity + delta, line.available))
        return { ...line, quantity: newQty }
      }
      return line
    }))
  }

  const setQuantity = (orderLineId: number, quantity: number) => {
    setReturnLines(prev => prev.map(line => {
      if (line.orderLineId === orderLineId) {
        const newQty = Math.max(0, Math.min(quantity, line.available))
        return { ...line, quantity: newQty }
      }
      return line
    }))
  }

  // Calculate totals
  const selectedLines = returnLines.filter(l => l.quantity > 0)
  const totalProducts = selectedLines.length
  const totalUnits = selectedLines.reduce((sum, l) => sum + l.quantity, 0)
  const totalValue = selectedLines.reduce((sum, l) => sum + (l.quantity * l.unitCost), 0)

  const canSubmit = selectedLines.length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/consignments/orders/${orderId}/request-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: selectedReason,
          notes: notes || undefined,
          lines: selectedLines.map(l => ({
            orderLineId: l.orderLineId,
            quantity: l.quantity
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        onSuccess({
          returnId: data.data.returnId,
          returnNumber: data.data.returnNumber,
          totalUnits: data.data.totalUnits,
          totalValue: data.data.totalValue
        })
        onClose()
      } else {
        setError(data.error || 'Error al crear solicitud')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl shadow-xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          {/* Header */}
          <div className={cn(
            'px-6 py-4 border-b flex items-center justify-between',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-xl',
                theme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'
              )}>
                <Package className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h2 className={cn(
                  'font-bold text-lg',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Solicitar Devolución
                </h2>
                <p className="text-sm text-gray-500">{orderNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Supplier & Warehouse Info */}
            <div className={cn(
              'px-6 py-4 border-b grid grid-cols-2 gap-4',
              theme === 'dark' ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'
            )}>
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Proveedor</p>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{supplier.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Warehouse className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Almacén</p>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{warehouse.name}</p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="px-6 py-3">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                </div>
              </div>
            )}

            {/* Products Table */}
            <div className="px-6 py-4">
              <h3 className={cn(
                'text-sm font-semibold mb-3',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Seleccionar productos a devolver
              </h3>

              {returnLines.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-400 opacity-50" />
                  <p className="text-gray-500">No hay productos disponibles para devolver</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {returnLines.map(line => {
                    const productLine = lines.find(l => l.id === line.orderLineId)
                    return (
                      <div
                        key={line.orderLineId}
                        className={cn(
                          'p-3 rounded-xl border transition-colors',
                          line.quantity > 0
                            ? theme === 'dark'
                              ? 'border-orange-700 bg-orange-900/10'
                              : 'border-orange-300 bg-orange-50'
                            : theme === 'dark'
                              ? 'border-gray-700 bg-gray-800/50'
                              : 'border-gray-200 bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-4">
                          {/* Product Image */}
                          <div className={cn(
                            'w-12 h-12 rounded-lg overflow-hidden shrink-0',
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          )}>
                            {productLine?.product.imageUrl ? (
                              <Image
                                src={productLine.product.imageUrl}
                                alt={line.productName}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'font-medium truncate',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {line.productName}
                            </p>
                            <p className="text-xs text-gray-500">
                              SKU: {productLine?.variantSku || productLine?.product.sku}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs">
                              <span className="text-gray-500">
                                Disponible: <strong>{line.available}</strong>
                              </span>
                              <span className="text-green-600 dark:text-green-400">
                                ${line.unitCost.toFixed(2)}/ud
                              </span>
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(line.orderLineId, -1)}
                              disabled={line.quantity <= 0}
                              className={cn(
                                'p-2 rounded-lg transition-colors',
                                line.quantity > 0
                                  ? theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600'
                                    : 'bg-gray-200 hover:bg-gray-300'
                                  : 'opacity-50 cursor-not-allowed',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}
                            >
                              <Minus className="w-4 h-4" />
                            </button>

                            <input
                              type="number"
                              min="0"
                              max={line.available}
                              value={line.quantity}
                              onChange={(e) => setQuantity(line.orderLineId, parseInt(e.target.value) || 0)}
                              className={cn(
                                'w-16 text-center font-bold text-lg rounded-lg border py-1',
                                theme === 'dark'
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              )}
                            />

                            <button
                              onClick={() => updateQuantity(line.orderLineId, 1)}
                              disabled={line.quantity >= line.available}
                              className={cn(
                                'p-2 rounded-lg transition-colors',
                                line.quantity < line.available
                                  ? theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600'
                                    : 'bg-gray-200 hover:bg-gray-300'
                                  : 'opacity-50 cursor-not-allowed',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Reason Selection */}
            <div className={cn(
              'px-6 py-4 border-t',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <h3 className={cn(
                'text-sm font-semibold mb-3',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Motivo de devolución
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {RETURN_REASONS.map(reason => (
                  <label
                    key={reason.id}
                    className={cn(
                      'p-3 rounded-xl cursor-pointer transition-all border',
                      selectedReason === reason.id
                        ? theme === 'dark'
                          ? 'border-orange-500 bg-orange-900/20'
                          : 'border-orange-500 bg-orange-50'
                        : theme === 'dark'
                          ? 'border-gray-700 hover:border-gray-600'
                          : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.id}
                      checked={selectedReason === reason.id}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="sr-only"
                    />
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {reason.label}
                    </p>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className={cn(
              'px-6 py-4 border-t',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <label className={cn(
                'block text-sm font-semibold mb-2',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar observaciones sobre la devolución..."
                rows={2}
                className={cn(
                  'w-full px-3 py-2 rounded-xl border resize-none',
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
                  'focus:ring-2 focus:ring-orange-500 focus:border-transparent'
                )}
              />
            </div>

            {/* Info Banner */}
            <div className={cn(
              'mx-6 mb-4 p-3 rounded-xl flex items-start gap-3',
              theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
            )}>
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                La devolución quedará <strong>pendiente</strong> hasta que el almacenero la procese desde operaciones de almacén.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className={cn(
            'px-6 py-4 border-t flex items-center justify-between',
            theme === 'dark' ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'
          )}>
            {/* Summary */}
            <div className="flex items-center gap-6 text-sm">
              <span className="text-gray-500">
                <strong className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                  {totalProducts}
                </strong> productos
              </span>
              <span className="text-gray-500">
                <strong className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                  {totalUnits}
                </strong> unidades
              </span>
              <span className="text-green-600 dark:text-green-400 font-semibold">
                ${totalValue.toFixed(2)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className={cn(
                  'px-4 py-2 rounded-xl font-medium transition-colors',
                  theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-700 hover:bg-gray-200'
                )}
              >
                Cancelar
              </button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  'px-6 py-2 rounded-xl font-medium flex items-center gap-2 transition-all',
                  canSubmit
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600'
                    : theme === 'dark'
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Solicitando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Solicitar Devolución
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
