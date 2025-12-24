'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Warehouse,
  Loader2,
  Package,
  CheckCircle2,
  X,
  AlertTriangle,
  FileText
} from 'lucide-react'

import OperationTypeSelector, { type OperationType } from '@/components/warehouse/OperationTypeSelector'
import WarehouseScanner, { type ScannedProductData } from '@/components/warehouse/WarehouseScanner'
import ScannedProductCard, { type ScannedProduct } from '@/components/warehouse/ScannedProductCard'
import WarehouseNumpad from '@/components/warehouse/WarehouseNumpad'
import DestinationWarehouseSelector from '@/components/warehouse/DestinationWarehouseSelector'
import ScrapReasonSelector, { type ScrapReason } from '@/components/warehouse/ScrapReasonSelector'
import AdjustmentReasonSelector, { type AdjustmentReason } from '@/components/warehouse/AdjustmentReasonSelector'
import ReferenceOrderSelector, { type ReferenceType } from '@/components/warehouse/ReferenceOrderSelector'

interface WarehouseData {
  id: number
  name: string
  code: string
  allowNegativeStock: boolean
}

interface OperationState {
  operationType: OperationType | null
  destinationWarehouseId: number | null
  referenceType: ReferenceType
  referenceId: number | null
  referenceOrderNumber: string | null
  scrapReason: ScrapReason | null
  adjustmentReason: AdjustmentReason | null
  products: ScannedProduct[]
  notes: string
}

const initialOperationState: OperationState = {
  operationType: null,
  destinationWarehouseId: null,
  referenceType: 'none',
  referenceId: null,
  referenceOrderNumber: null,
  scrapReason: null,
  adjustmentReason: null,
  products: [],
  notes: ''
}

export default function WarehouseOperationsPage() {
  const params = useParams()
  const router = useRouter()
  const warehouseId = parseInt(params.id as string)

  const [warehouse, setWarehouse] = useState<WarehouseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [operation, setOperation] = useState<OperationState>(initialOperationState)
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null)
  const [numpadValue, setNumpadValue] = useState('1')

  // Fetch warehouse data
  useEffect(() => {
    const fetchWarehouse = async () => {
      try {
        const response = await fetch(`/api/market/warehouses/${warehouseId}`)
        const data = await response.json()

        if (data.success) {
          setWarehouse({
            id: data.data.id,
            name: data.data.name,
            code: data.data.code,
            allowNegativeStock: data.data.allowNegativeStock
          })
        } else {
          setError(data.error || 'Error al cargar almacen')
        }
      } catch {
        setError('Error de conexion')
      } finally {
        setLoading(false)
      }
    }

    if (warehouseId) {
      fetchWarehouse()
    }
  }, [warehouseId])

  const handleOperationTypeSelect = (type: OperationType) => {
    setOperation({ ...initialOperationState, operationType: type })
    setSelectedProductIndex(null)
    setNumpadValue('1')
    setError(null)
    setSuccess(null)
  }

  const handleProductScanned = useCallback((data: ScannedProductData) => {
    setOperation(prev => {
      // Check if product already exists
      const existingIndex = prev.products.findIndex(p => p.productId === data.product.id)

      if (existingIndex >= 0) {
        // Increment quantity
        const updated = [...prev.products]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1
        }
        return { ...prev, products: updated }
      }

      // Add new product
      const newProduct: ScannedProduct = {
        id: Date.now(),
        productId: data.product.id,
        name: data.product.name,
        sku: data.product.sku,
        barcode: data.product.barcode,
        imageUrl: data.product.imageUrl,
        unit: data.stock.warehouseName ? data.product.unit : 'unidad',
        quantity: 1,
        currentStock: data.stock.quantityAvailable,
        costPrice: data.product.costPrice,
        sellingPrice: data.product.sellingPrice
      }

      return { ...prev, products: [...prev.products, newProduct] }
    })
    setError(null)
  }, [])

  const handleScanError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setTimeout(() => setError(null), 3000)
  }, [])

  const handleQuantityChange = (productId: number, quantity: number) => {
    setOperation(prev => ({
      ...prev,
      products: prev.products.map(p =>
        p.id === productId ? { ...p, quantity } : p
      )
    }))
  }

  const handleRealStockChange = (productId: number, realStock: number) => {
    setOperation(prev => ({
      ...prev,
      products: prev.products.map(p =>
        p.id === productId ? { ...p, realStock } : p
      )
    }))
  }

  const handleRemoveProduct = (productId: number) => {
    setOperation(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== productId)
    }))
    if (selectedProductIndex !== null) {
      setSelectedProductIndex(null)
    }
  }

  const handleNumpadConfirm = () => {
    if (selectedProductIndex !== null && operation.products[selectedProductIndex]) {
      const quantity = parseInt(numpadValue) || 1
      const productId = operation.products[selectedProductIndex].id

      if (operation.operationType === 'adjustment') {
        handleRealStockChange(productId, quantity)
      } else {
        handleQuantityChange(productId, quantity)
      }

      setSelectedProductIndex(null)
      setNumpadValue('1')
    }
  }

  const getTotalItems = () => operation.products.length
  const getTotalUnits = () => operation.products.reduce((sum, p) => sum + p.quantity, 0)

  const canConfirm = () => {
    if (operation.products.length === 0) return false

    switch (operation.operationType) {
      case 'transfer':
        return operation.destinationWarehouseId !== null
      case 'scrap':
        return operation.scrapReason !== null
      case 'adjustment':
        return operation.adjustmentReason !== null &&
               operation.products.every(p => p.realStock !== undefined)
      default:
        return true
    }
  }

  const handleConfirmOperation = async () => {
    if (!canConfirm() || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const lines = operation.products.map(p => ({
        productId: p.productId,
        quantity: p.quantity,
        realStock: p.realStock,
        scrapReason: operation.scrapReason,
        adjustmentReason: operation.adjustmentReason
      }))

      const response = await fetch(`/api/market/warehouses/${warehouseId}/operations/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationType: operation.operationType,
          destinationWarehouseId: operation.destinationWarehouseId,
          referenceType: operation.referenceType !== 'none' ? operation.referenceType : undefined,
          referenceId: operation.referenceId,
          scrapReason: operation.scrapReason,
          adjustmentReason: operation.adjustmentReason,
          notes: operation.notes || undefined,
          lines
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)
        // Reset after success
        setTimeout(() => {
          setOperation(initialOperationState)
          setSuccess(null)
        }, 2000)
      } else {
        setError(data.error || 'Error al confirmar operacion')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (operation.operationType && operation.products.length > 0) {
      if (confirm('Hay productos escaneados. ¿Desea salir sin guardar?')) {
        setOperation(initialOperationState)
      }
    } else if (operation.operationType) {
      setOperation(initialOperationState)
    } else {
      router.push('/dashboard/market/warehouses')
    }
  }

  const getOperationColor = () => {
    switch (operation.operationType) {
      case 'reception': return 'green'
      case 'transfer': return 'blue'
      case 'scrap': return 'red'
      case 'adjustment': return 'amber'
      default: return 'purple'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!warehouse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-lg text-gray-600 dark:text-gray-300">Almacen no encontrado</p>
        <button
          onClick={() => router.push('/dashboard/market/warehouses')}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Volver a almacenes
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            <div className="flex items-center gap-2">
              <Warehouse className="w-6 h-6 text-purple-600" />
              <div>
                <h1 className="font-bold text-gray-900 dark:text-white">
                  {operation.operationType
                    ? `${operation.operationType === 'reception' ? 'Recepcion' :
                        operation.operationType === 'transfer' ? 'Transferencia' :
                        operation.operationType === 'scrap' ? 'Scrap' : 'Ajuste'}`
                    : 'Operaciones'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{warehouse.name}</p>
              </div>
            </div>
          </div>

          {operation.operationType && operation.products.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">{getTotalItems()} productos</p>
                <p className="font-bold text-gray-900 dark:text-white">{getTotalUnits()} unidades</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            {success}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        {!operation.operationType ? (
          <OperationTypeSelector
            onSelect={handleOperationTypeSelect}
            currentWarehouse={warehouse}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Scanner + Products */}
            <div className="lg:col-span-2 space-y-4">
              {/* Scanner */}
              <WarehouseScanner
                warehouseId={warehouseId}
                onProductScanned={handleProductScanned}
                onError={handleScanError}
                disabled={submitting}
              />

              {/* Products List */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Productos Escaneados
                  </h2>
                  {operation.products.length > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Click en un producto para editar cantidad
                    </span>
                  )}
                </div>

                {operation.products.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Escanea productos para agregarlos</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    <AnimatePresence>
                      {operation.products.map((product, index) => (
                        <div
                          key={product.id}
                          onClick={() => {
                            setSelectedProductIndex(index)
                            setNumpadValue(
                              operation.operationType === 'adjustment'
                                ? String(product.realStock ?? product.currentStock)
                                : String(product.quantity)
                            )
                          }}
                          className={`cursor-pointer ${selectedProductIndex === index ? 'ring-2 ring-purple-500 rounded-xl' : ''}`}
                        >
                          <ScannedProductCard
                            product={product}
                            onQuantityChange={(qty) => handleQuantityChange(product.id, qty)}
                            onRemove={() => handleRemoveProduct(product.id)}
                            showStock={operation.operationType === 'transfer' || operation.operationType === 'scrap'}
                            showRealStock={operation.operationType === 'adjustment'}
                            onRealStockChange={(realStock) => handleRealStockChange(product.id, realStock)}
                            maxQuantity={
                              (operation.operationType === 'transfer' || operation.operationType === 'scrap') && !warehouse.allowNegativeStock
                                ? product.currentStock
                                : undefined
                            }
                          />
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Configuration */}
            <div className="space-y-4">
              {/* Operation specific selectors */}
              {operation.operationType === 'reception' && (
                <ReferenceOrderSelector
                  warehouseId={warehouseId}
                  selectedReference={{
                    type: operation.referenceType,
                    id: operation.referenceId,
                    orderNumber: operation.referenceOrderNumber
                  }}
                  onSelect={(ref) => setOperation(prev => ({
                    ...prev,
                    referenceType: ref.type,
                    referenceId: ref.id,
                    referenceOrderNumber: ref.orderNumber
                  }))}
                  disabled={submitting}
                />
              )}

              {operation.operationType === 'transfer' && (
                <DestinationWarehouseSelector
                  currentWarehouseId={warehouseId}
                  selectedWarehouseId={operation.destinationWarehouseId}
                  onSelect={(id) => setOperation(prev => ({ ...prev, destinationWarehouseId: id }))}
                  disabled={submitting}
                />
              )}

              {operation.operationType === 'scrap' && (
                <ScrapReasonSelector
                  selectedReason={operation.scrapReason}
                  onSelect={(reason) => setOperation(prev => ({ ...prev, scrapReason: reason }))}
                  disabled={submitting}
                />
              )}

              {operation.operationType === 'adjustment' && (
                <AdjustmentReasonSelector
                  selectedReason={operation.adjustmentReason}
                  onSelect={(reason) => setOperation(prev => ({ ...prev, adjustmentReason: reason }))}
                  disabled={submitting}
                />
              )}

              {/* Numpad */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  {selectedProductIndex !== null && operation.products[selectedProductIndex] ? (
                    <>
                      <span>Cantidad para:</span>
                      <span className="text-purple-600">{operation.products[selectedProductIndex].name}</span>
                    </>
                  ) : (
                    'Selecciona un producto'
                  )}
                </h3>

                <WarehouseNumpad
                  value={numpadValue}
                  onChange={setNumpadValue}
                  onConfirm={handleNumpadConfirm}
                  disabled={selectedProductIndex === null || submitting}
                  maxValue={
                    selectedProductIndex !== null &&
                    (operation.operationType === 'transfer' || operation.operationType === 'scrap') &&
                    !warehouse.allowNegativeStock
                      ? operation.products[selectedProductIndex]?.currentStock
                      : undefined
                  }
                />
              </div>

              {/* Notes */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={operation.notes}
                  onChange={(e) => setOperation(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Agregar notas sobre esta operacion..."
                  rows={3}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirmOperation}
                  disabled={!canConfirm() || submitting}
                  className={`
                    flex-1 px-4 py-3 rounded-xl font-medium text-white
                    flex items-center justify-center gap-2
                    transition-all
                    ${canConfirm() && !submitting
                      ? `bg-gradient-to-r from-${getOperationColor()}-500 to-${getOperationColor()}-600 hover:from-${getOperationColor()}-600 hover:to-${getOperationColor()}-700`
                      : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'}
                  `}
                  style={{
                    background: canConfirm() && !submitting
                      ? operation.operationType === 'reception' ? 'linear-gradient(to right, #22c55e, #10b981)' :
                        operation.operationType === 'transfer' ? 'linear-gradient(to right, #3b82f6, #06b6d4)' :
                        operation.operationType === 'scrap' ? 'linear-gradient(to right, #ef4444, #f43f5e)' :
                        'linear-gradient(to right, #f59e0b, #eab308)'
                      : undefined
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Confirmar
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
