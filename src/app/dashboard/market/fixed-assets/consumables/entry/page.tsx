'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  Search,
  Package,
  ClipboardList,
  FileText,
  Hash,
  DollarSign,
  Truck,
  StickyNote
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface ConsumableItem {
  id: number
  name: string
  code: string
  category: string | null
  unit: string
  currentStock: number
  minStock: number
  warehouseName: string | null
  status: string
}

const STEPS = [
  { id: 1, title: 'Seleccionar Producto', icon: Package },
  { id: 2, title: 'Datos de Entrada', icon: ClipboardList }
]

export default function ConsumableStockEntryPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Step 1 state
  const [searchTerm, setSearchTerm] = useState('')
  const [items, setItems] = useState<ConsumableItem[]>([])
  const [selectedItem, setSelectedItem] = useState<ConsumableItem | null>(null)

  // Step 2 form state
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const [notes, setNotes] = useState('')

  // Fetch consumable items
  const fetchItems = useCallback(async (search: string) => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({ limit: '50' })
      if (search.trim()) {
        queryParams.set('search', search.trim())
      }
      const res = await fetch(`/api/market/consumables?${queryParams.toString()}`)
      const data = await res.json()
      if (data.success && data.data) {
        setItems(data.data.items || [])
      }
    } catch {
      console.error('Error fetching consumables')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchItems('')
  }, [fetchItems])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, fetchItems])

  const handleSubmit = async () => {
    if (!selectedItem) return
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) {
      showNotification('error', 'Error', 'La cantidad debe ser mayor a 0')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/market/consumables/${selectedItem.id}/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: qty,
          unitCost: unitCost ? parseFloat(unitCost) : null,
          supplierName: supplierName.trim() || null,
          invoiceRef: invoiceRef.trim() || null,
          notes: notes.trim() || null
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification(
          'success',
          'Entrada registrada',
          `Se registraron ${qty} ${selectedItem.unit}(s) de ${selectedItem.name}. Stock: ${data.data.stockBefore} -> ${data.data.stockAfter}`
        )
        router.push('/dashboard/market/fixed-assets/consumables')
      } else {
        showNotification('error', 'Error', data.error || 'Error al registrar entrada de stock')
      }
    } catch {
      showNotification('error', 'Error de conexion', 'No se pudo registrar la entrada')
    } finally {
      setSubmitting(false)
    }
  }

  const parsedQuantity = parseFloat(quantity) || 0
  const newStock = selectedItem ? selectedItem.currentStock + parsedQuantity : 0

  const inputClass = cn(
    'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
    theme === 'dark'
      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
  )

  const labelClass = cn(
    'block text-sm font-medium mb-2',
    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Back link */}
            <Link
              href="/dashboard/market/fixed-assets/consumables"
              className={cn(
                'inline-flex items-center gap-2 text-sm transition-colors',
                theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a Consumibles
            </Link>

            {/* Header */}
            <div>
              <h1 className={cn(
                'text-2xl sm:text-3xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Entrada de Stock
              </h1>
              <p className={cn(
                'text-sm mt-1',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Registrar una compra o ingreso de consumibles al inventario
              </p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-0">
              {STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300',
                        currentStep === step.id
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                          : currentStep > step.id
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25'
                            : theme === 'dark'
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-gray-200 text-gray-400'
                      )}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className={cn(
                      'text-sm font-medium hidden sm:block',
                      currentStep === step.id
                        ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        : currentStep > step.id
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                          : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      {step.title}
                    </span>
                  </div>

                  {index < STEPS.length - 1 && (
                    <div className="w-16 sm:w-24 mx-3 h-0.5 relative">
                      <div className={cn(
                        'absolute inset-0 rounded-full',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )} />
                      <motion.div
                        initial={false}
                        animate={{ scaleX: currentStep > step.id ? 1 : 0 }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                        className="h-full origin-left rounded-full bg-gradient-to-r from-green-500 to-green-600"
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Search */}
                  <div className={cn(
                    'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                  )}>
                    <h2 className={cn(
                      'text-lg font-bold flex items-center gap-3 mb-4',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Search className="w-4 h-4 text-white" />
                      </div>
                      Buscar Consumible
                    </h2>

                    <div className="relative">
                      <Search className={cn(
                        'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5',
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )} />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por nombre o codigo..."
                        className={cn(inputClass, 'pl-10')}
                      />
                    </div>
                  </div>

                  {/* Items Grid */}
                  <div className={cn(
                    'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                  )}>
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className={cn(
                          'ml-3',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          Cargando consumibles...
                        </span>
                      </div>
                    ) : items.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className={cn(
                          'w-12 h-12 mx-auto mb-3',
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                        )} />
                        <p className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          No se encontraron consumibles
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.map((item) => (
                          <motion.div
                            key={item.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedItem(item)}
                            className={cn(
                              'relative p-4 rounded-xl border-2 cursor-pointer transition-all',
                              selectedItem?.id === item.id
                                ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10'
                                : theme === 'dark'
                                  ? 'border-gray-700 hover:border-gray-600'
                                  : 'border-gray-200 hover:border-gray-300',
                              theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'
                            )}
                          >
                            {selectedItem?.id === item.id && (
                              <div className="absolute top-2 right-2">
                                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <div>
                                <p className={cn(
                                  'text-xs font-mono',
                                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                )}>
                                  {item.code}
                                </p>
                                <p className={cn(
                                  'font-semibold text-sm line-clamp-2',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {item.name}
                                </p>
                              </div>

                              {item.category && (
                                <span className={cn(
                                  'inline-block text-xs px-2 py-0.5 rounded-full',
                                  theme === 'dark'
                                    ? 'bg-gray-700 text-gray-300'
                                    : 'bg-gray-100 text-gray-600'
                                )}>
                                  {item.category}
                                </span>
                              )}

                              <div className="flex items-center justify-between pt-1">
                                <div>
                                  <p className={cn(
                                    'text-xs',
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )}>
                                    Stock actual
                                  </p>
                                  <p className={cn(
                                    'text-sm font-bold',
                                    item.currentStock <= item.minStock
                                      ? 'text-red-500'
                                      : theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {item.currentStock} {item.unit}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-end">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (!selectedItem) {
                          showNotification('error', 'Error', 'Selecciona un consumible para continuar')
                          return
                        }
                        setCurrentStep(2)
                      }}
                      disabled={!selectedItem}
                      className={cn(
                        'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25'
                      )}
                    >
                      Siguiente
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && selectedItem && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Selected Product Info */}
                  <div className={cn(
                    'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                  )}>
                    <h2 className={cn(
                      'text-lg font-bold flex items-center gap-3 mb-4',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <Package className="w-4 h-4 text-white" />
                      </div>
                      Producto Seleccionado
                    </h2>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-mono',
                        theme === 'dark'
                          ? 'bg-blue-900/30 text-blue-400'
                          : 'bg-blue-50 text-blue-600'
                      )}>
                        {selectedItem.code}
                      </div>
                      <p className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {selectedItem.name}
                      </p>
                      <div className={cn(
                        'px-3 py-1.5 rounded-lg text-sm',
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-gray-100 text-gray-600'
                      )}>
                        Stock actual: <span className="font-bold">{selectedItem.currentStock} {selectedItem.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Entry Form */}
                  <div className={cn(
                    'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                  )}>
                    <h2 className={cn(
                      'text-lg font-bold flex items-center gap-3 mb-6',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <ClipboardList className="w-4 h-4 text-white" />
                      </div>
                      Datos de Entrada
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Cantidad */}
                      <div>
                        <label className={labelClass}>
                          <span className="flex items-center gap-2">
                            <Hash className="w-4 h-4" />
                            Cantidad *
                          </span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="Ej: 50"
                          className={inputClass}
                        />
                      </div>

                      {/* Costo Unitario */}
                      <div>
                        <label className={labelClass}>
                          <span className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Costo Unitario
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={unitCost}
                          onChange={(e) => setUnitCost(e.target.value)}
                          placeholder="0.00"
                          className={inputClass}
                        />
                      </div>

                      {/* Proveedor */}
                      <div>
                        <label className={labelClass}>
                          <span className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            Proveedor
                          </span>
                        </label>
                        <input
                          type="text"
                          value={supplierName}
                          onChange={(e) => setSupplierName(e.target.value)}
                          placeholder="Nombre del proveedor"
                          className={inputClass}
                        />
                      </div>

                      {/* Referencia de Factura */}
                      <div>
                        <label className={labelClass}>
                          <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Referencia de Factura
                          </span>
                        </label>
                        <input
                          type="text"
                          value={invoiceRef}
                          onChange={(e) => setInvoiceRef(e.target.value)}
                          placeholder="Ej: FAC-2026-001"
                          className={inputClass}
                        />
                      </div>

                      {/* Notas */}
                      <div className="md:col-span-2">
                        <label className={labelClass}>
                          <span className="flex items-center gap-2">
                            <StickyNote className="w-4 h-4" />
                            Notas
                          </span>
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Notas adicionales sobre esta entrada..."
                          rows={3}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Stock Preview */}
                    {parsedQuantity > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'mt-6 p-4 rounded-xl border',
                          theme === 'dark'
                            ? 'bg-green-900/20 border-green-800'
                            : 'bg-green-50 border-green-200'
                        )}
                      >
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-green-400' : 'text-green-700'
                        )}>
                          Stock actual: <span className="font-bold">{selectedItem.currentStock}</span>
                          {' '}&rarr;{' '}
                          Nuevo stock: <span className="font-bold">{selectedItem.currentStock}</span>
                          {' + '}
                          <span className="font-bold">{parsedQuantity}</span>
                          {' = '}
                          <span className="font-bold text-lg">{newStock} {selectedItem.unit}</span>
                        </p>
                      </motion.div>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between items-center gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentStep(1)}
                      className={cn(
                        'flex items-center gap-2 px-6 py-3 rounded-xl transition-all',
                        theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      )}
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Atras
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSubmit}
                      disabled={submitting || !quantity || parsedQuantity <= 0}
                      className={cn(
                        'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25'
                      )}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Registrando...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Confirmar Entrada
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
