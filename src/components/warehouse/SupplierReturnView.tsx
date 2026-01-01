'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Search,
  Loader2,
  X,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  DollarSign,
  Layers,
  Building2
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface SupplierReturnViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
  onComplete: (data: { totalUnits: number; supplierName: string }) => void
}

interface Supplier {
  id: number
  code: string
  name: string
  totalStock: number
  totalValue: number
}

interface ProductLot {
  lotInventoryId: number
  lotNumber: string
  expirationDate: string | null
  quantityAvailable: number
  unitCost: number
  receivedAt: string
  orderLineId: number
  orderId: number
  orderNumber: string
}

interface ProductWithLots {
  productId: number
  productName: string
  sku: string
  barcode: string
  lots: ProductLot[]
}

interface ReturnLine {
  id: number
  productId: number
  productName: string
  sku: string
  barcode: string
  lotInventoryId: number
  lotNumber: string
  expirationDate: string | null
  unitCost: number
  quantityAvailable: number
  quantityToReturn: number
}

const RETURN_REASONS = [
  { id: 'not_sold', label: 'Producto no vendido' },
  { id: 'damaged', label: 'Producto dañado' },
  { id: 'expired', label: 'Producto próximo a vencer' },
  { id: 'agreement', label: 'Acuerdo con proveedor' },
  { id: 'other', label: 'Otro motivo' }
]

export default function SupplierReturnView({
  warehouseId,
  warehouseName,
  onBack,
  onComplete
}: SupplierReturnViewProps) {
  // State
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  const [scanValue, setScanValue] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [productWithLots, setProductWithLots] = useState<ProductWithLots | null>(null)
  const [showLotSelector, setShowLotSelector] = useState(false)

  const [returnLines, setReturnLines] = useState<ReturnLine[]>([])
  const [selectedReason, setSelectedReason] = useState<string>('not_sold')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch suppliers with available stock
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await fetch(`/api/market/warehouses/${warehouseId}/supplier-returns/suppliers`)
        const data = await response.json()
        if (data.success) {
          setSuppliers(data.data.suppliers)
        } else {
          setError(data.error)
        }
      } catch {
        setError('Error al cargar proveedores')
      } finally {
        setLoadingSuppliers(false)
      }
    }

    fetchSuppliers()
  }, [warehouseId])

  // Focus input when supplier is selected
  useEffect(() => {
    if (selectedSupplier && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedSupplier])

  // Handle barcode scan
  const handleScan = useCallback(async () => {
    if (!scanValue.trim() || !selectedSupplier || scanning) return

    setScanning(true)
    setScanError(null)

    try {
      const response = await fetch(
        `/api/market/warehouses/${warehouseId}/supplier-returns/lots?` +
        `supplierId=${selectedSupplier.id}&search=${encodeURIComponent(scanValue.trim())}`
      )
      const data = await response.json()

      if (data.success) {
        if (data.data.lots.length === 0) {
          setScanError('Producto no encontrado o sin stock disponible para este proveedor')
        } else {
          setProductWithLots({
            productId: data.data.productId,
            productName: data.data.productName,
            sku: data.data.sku,
            barcode: data.data.barcode,
            lots: data.data.lots
          })

          // If only one lot, add directly
          if (data.data.lots.length === 1) {
            addReturnLineFromLot(
              data.data.productId,
              data.data.productName,
              data.data.sku,
              data.data.barcode,
              data.data.lots[0]
            )
          } else {
            setShowLotSelector(true)
          }
        }
      } else {
        setScanError(data.error || 'Error al buscar producto')
      }
    } catch {
      setScanError('Error de conexión')
    } finally {
      setScanning(false)
      setScanValue('')
    }
  }, [scanValue, selectedSupplier, warehouseId, scanning])

  // Add return line from lot
  const addReturnLineFromLot = (
    productId: number,
    productName: string,
    sku: string,
    barcode: string,
    lot: ProductLot
  ) => {
    // Check if this lot is already in the list
    const existingIndex = returnLines.findIndex(l => l.lotInventoryId === lot.lotInventoryId)

    if (existingIndex >= 0) {
      // Increment quantity
      setReturnLines(prev => prev.map((line, index) => {
        if (index === existingIndex) {
          const newQty = Math.min(line.quantityToReturn + 1, line.quantityAvailable)
          return { ...line, quantityToReturn: newQty }
        }
        return line
      }))
    } else {
      // Add new line
      const newLine: ReturnLine = {
        id: Date.now(),
        productId,
        productName,
        sku,
        barcode,
        lotInventoryId: lot.lotInventoryId,
        lotNumber: lot.lotNumber,
        expirationDate: lot.expirationDate,
        unitCost: lot.unitCost,
        quantityAvailable: lot.quantityAvailable,
        quantityToReturn: 1
      }
      setReturnLines(prev => [...prev, newLine])
    }

    setShowLotSelector(false)
    setProductWithLots(null)
  }

  // Update quantity
  const updateQuantity = (lineId: number, delta: number) => {
    setReturnLines(prev => prev.map(line => {
      if (line.id === lineId) {
        const newQty = Math.max(1, Math.min(line.quantityToReturn + delta, line.quantityAvailable))
        return { ...line, quantityToReturn: newQty }
      }
      return line
    }))
  }

  // Remove line
  const removeLine = (lineId: number) => {
    setReturnLines(prev => prev.filter(l => l.id !== lineId))
  }

  // Calculate totals
  const totalUnits = returnLines.reduce((sum, l) => sum + l.quantityToReturn, 0)
  const totalValue = returnLines.reduce((sum, l) => sum + (l.quantityToReturn * l.unitCost), 0)

  // Handle submit
  const handleSubmit = async () => {
    if (returnLines.length === 0 || !selectedSupplier || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/supplier-returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier.id,
          reason: selectedReason,
          notes: notes || undefined,
          lines: returnLines.map(l => ({
            productId: l.productId,
            lotInventoryId: l.lotInventoryId,
            quantity: l.quantityToReturn
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        onComplete({
          totalUnits,
          supplierName: selectedSupplier.name
        })
      } else {
        setError(data.error || 'Error al procesar devolución')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle keyboard for scan
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan()
    }
  }

  return (
    <div className="flex flex-col min-h-[60vh] w-full">
      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 1: Select Supplier */}
      {!selectedSupplier ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" />
            Seleccionar Proveedor
          </h3>

          {loadingSuppliers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay proveedores con stock de consignación disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map(supplier => (
                <motion.button
                  key={supplier.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedSupplier(supplier)}
                  className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-left hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{supplier.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{supplier.code}</p>
                    </div>
                    <Package className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600 dark:text-gray-300">
                      <strong>{supplier.totalStock}</strong> uds
                    </span>
                    <span className="text-green-600 dark:text-green-400">
                      ${supplier.totalValue.toFixed(2)}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Step 2: Scan Products */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Scanner and Products */}
          <div className="lg:col-span-2 space-y-4">
            {/* Supplier Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">Proveedor seleccionado</p>
                  <p className="text-xl font-bold">{selectedSupplier.name}</p>
                  <p className="text-sm text-white/80">{selectedSupplier.code}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedSupplier(null)
                    setReturnLines([])
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scanner */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={scanValue}
                    onChange={(e) => setScanValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escanear código de barras o SKU..."
                    disabled={scanning}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleScan}
                  disabled={!scanValue.trim() || scanning}
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-xl font-medium flex items-center gap-2 transition-colors"
                >
                  {scanning ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                  Buscar
                </motion.button>
              </div>

              {scanError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 text-sm text-red-500"
                >
                  {scanError}
                </motion.p>
              )}
            </div>

            {/* Products List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Productos a Devolver
                {returnLines.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-sm">
                    {returnLines.length}
                  </span>
                )}
              </h3>

              {returnLines.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Escanea productos para agregar a la devolución</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  <AnimatePresence>
                    {returnLines.map((line) => (
                      <motion.div
                        key={line.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{line.productName}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {line.sku}</p>
                          </div>
                          <button
                            onClick={() => removeLine(line.id)}
                            className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            {line.lotNumber}
                          </span>
                          {line.expirationDate && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {format(new Date(line.expirationDate), 'dd/MM/yyyy', { locale: es })}
                            </span>
                          )}
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" />
                            {line.unitCost.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Disponible: {line.quantityAvailable}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(line.id, -1)}
                              disabled={line.quantityToReturn <= 1}
                              className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-12 text-center text-lg font-bold text-gray-900 dark:text-white">
                              {line.quantityToReturn}
                            </span>
                            <button
                              onClick={() => updateQuantity(line.id, 1)}
                              disabled={line.quantityToReturn >= line.quantityAvailable}
                              className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Right: Summary and Actions */}
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Resumen</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Productos</span>
                  <span className="font-medium text-gray-900 dark:text-white">{returnLines.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total unidades</span>
                  <span className="font-medium text-gray-900 dark:text-white">{totalUnits}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Valor a devolver</span>
                    <span className="font-bold text-lg text-green-600 dark:text-green-400">${totalValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Motivo de Devolución</h3>
              <div className="space-y-2">
                {RETURN_REASONS.map(reason => (
                  <label
                    key={reason.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedReason === reason.id
                        ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={reason.id}
                      checked={selectedReason === reason.id}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedReason === reason.id
                        ? 'border-orange-500 bg-orange-500'
                        : 'border-gray-400'
                    }`}>
                      {selectedReason === reason.id && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{reason.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar notas sobre esta devolución..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onBack}
                disabled={submitting}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={returnLines.length === 0 || submitting}
                className={`flex-1 px-4 py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all ${
                  returnLines.length > 0 && !submitting
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'
                    : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                }`}
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

      {/* Lot Selector Modal */}
      <AnimatePresence>
        {showLotSelector && productWithLots && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              setShowLotSelector(false)
              setProductWithLots(null)
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Seleccionar Lote</h3>
                  <button
                    onClick={() => {
                      setShowLotSelector(false)
                      setProductWithLots(null)
                    }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {productWithLots.productName} - SKU: {productWithLots.sku}
                </p>
              </div>

              <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                {productWithLots.lots.map((lot) => (
                  <motion.button
                    key={lot.lotInventoryId}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => addReturnLineFromLot(
                      productWithLots.productId,
                      productWithLots.productName,
                      productWithLots.sku,
                      productWithLots.barcode,
                      lot
                    )}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-orange-50 dark:hover:bg-orange-900/20 border border-gray-200 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-700 rounded-xl text-left transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-500" />
                          {lot.lotNumber}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Orden: {lot.orderNumber}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium">
                        ${lot.unitCost.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        <strong>Disponible:</strong> {lot.quantityAvailable}
                      </span>
                      {lot.expirationDate && (
                        <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Vence: {format(new Date(lot.expirationDate), 'dd/MM/yyyy', { locale: es })}
                        </span>
                      )}
                      <span className="text-gray-500 dark:text-gray-400">
                        Recibido: {format(new Date(lot.receivedAt), 'dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
