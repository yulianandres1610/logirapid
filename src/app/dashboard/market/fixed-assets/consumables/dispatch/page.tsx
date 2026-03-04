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
  User,
  FileText,
  AlertTriangle
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
  category: string
  unit: string
  currentStock: number
  minStock: number
  warehouseName: string
  imageUrl: string | null
  status: string
}

interface Employee {
  id: number
  firstName: string
  lastName: string
  fullName: string
}

const STEPS = [
  { number: 1, title: 'Seleccionar Producto', icon: Package },
  { number: 2, title: 'Datos de Despacho', icon: FileText },
  { number: 3, title: 'Confirmar Despacho', icon: Check }
]

export default function DispatchConsumablePage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Step 1 state
  const [searchTerm, setSearchTerm] = useState('')
  const [items, setItems] = useState<ConsumableItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [selectedItem, setSelectedItem] = useState<ConsumableItem | null>(null)

  // Step 2 state
  const [quantity, setQuantity] = useState<number | ''>('')
  const [employeeId, setEmployeeId] = useState<number | ''>('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [quantityError, setQuantityError] = useState('')

  // Fetch consumable items
  const fetchItems = useCallback(async (search: string) => {
    setLoadingItems(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search) params.set('search', search)
      const res = await fetch(`/api/market/consumables?${params.toString()}`)
      const json = await res.json()
      if (json.success && json.data?.items) {
        setItems(json.data.items.filter((item: ConsumableItem) => item.currentStock > 0))
      }
    } catch (err) {
      console.error('Error fetching consumables:', err)
    } finally {
      setLoadingItems(false)
    }
  }, [])

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    setLoadingEmployees(true)
    try {
      const res = await fetch('/api/market/accounting/employees?status=active')
      const json = await res.json()
      if (json.success && json.data?.employees) {
        setEmployees(json.data.employees)
      }
    } catch (err) {
      console.error('Error fetching employees:', err)
    } finally {
      setLoadingEmployees(false)
    }
  }, [])

  // Load items on mount and when search changes
  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchItems(searchTerm)
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchTerm, fetchItems])

  // Load employees when entering step 2
  useEffect(() => {
    if (currentStep === 2 && employees.length === 0) {
      fetchEmployees()
    }
  }, [currentStep, employees.length, fetchEmployees])

  // Validate quantity
  useEffect(() => {
    if (quantity === '') {
      setQuantityError('')
      return
    }
    if (typeof quantity === 'number' && selectedItem) {
      if (quantity <= 0) {
        setQuantityError('La cantidad debe ser mayor a 0')
      } else if (quantity > selectedItem.currentStock) {
        setQuantityError(`La cantidad no puede exceder el stock disponible (${selectedItem.currentStock} ${selectedItem.unit})`)
      } else {
        setQuantityError('')
      }
    }
  }, [quantity, selectedItem])

  const canProceedStep1 = selectedItem !== null
  const canProceedStep2 =
    typeof quantity === 'number' &&
    quantity > 0 &&
    selectedItem &&
    quantity <= selectedItem.currentStock &&
    employeeId !== ''

  const selectedEmployee = employees.find(e => e.id === employeeId)

  const handleSubmit = async () => {
    if (!selectedItem || !quantity || !employeeId) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/market/consumables/${selectedItem.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity,
          employeeId,
          reason: reason || null,
          notes: notes || null
        })
      })

      const json = await res.json()

      if (json.success) {
        showNotification(
          'success',
          'Despacho registrado',
          `${quantity} ${selectedItem.unit} de ${selectedItem.name}`
        )
        router.push('/dashboard/market/fixed-assets/consumables')
      } else {
        showNotification('error', 'Error', json.error || 'Error al registrar despacho')
      }
    } catch (err) {
      console.error('Error dispatching:', err)
      showNotification('error', 'Error', 'Error al registrar despacho')
    } finally {
      setSubmitting(false)
    }
  }

  const goNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }

  const goBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Back link */}
          <Link
            href="/dashboard/market/fixed-assets/consumables"
            className={cn(
              'inline-flex items-center gap-2 text-sm font-medium mb-6 transition-colors',
              theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Consumibles
          </Link>

          {/* Title */}
          <h1 className={cn(
            'text-2xl font-bold mb-8',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Despachar Consumible
          </h1>

          {/* Step indicator */}
          <div className="flex items-center justify-center mb-10">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                      currentStep > step.number
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white'
                        : currentStep === step.number
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                          : theme === 'dark'
                            ? 'bg-gray-700 text-gray-400'
                            : 'bg-gray-200 text-gray-400'
                    )}
                  >
                    {currentStep > step.number ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span className={cn(
                    'text-sm font-medium hidden sm:block',
                    currentStep === step.number
                      ? theme === 'dark' ? 'text-white' : 'text-gray-900'
                      : currentStep > step.number
                        ? 'text-emerald-500'
                        : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-16 sm:w-24 h-0.5 mx-2',
                      currentStep > step.number
                        ? 'bg-emerald-500'
                        : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            {/* Step 1 - Select Product */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}>
                  <h2 className={cn(
                    'text-lg font-semibold mb-4',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Seleccionar Producto
                  </h2>

                  {/* Search */}
                  <div className="relative mb-6">
                    <Search className={cn(
                      'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )} />
                    <input
                      type="text"
                      placeholder="Buscar por nombre o codigo..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className={cn(
                        'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* Items grid */}
                  {loadingItems ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                  ) : items.length === 0 ? (
                    <div className={cn(
                      'text-center py-12',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No se encontraron consumibles con stock disponible</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-1">
                      {items.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className={cn(
                            'text-left p-4 rounded-xl border-2 transition-all',
                            selectedItem?.id === item.id
                              ? 'border-blue-500 ring-2 ring-blue-500/20'
                              : theme === 'dark'
                                ? 'border-gray-700 hover:border-gray-600'
                                : 'border-gray-200 hover:border-gray-300',
                            theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'
                          )}
                        >
                          <div className={cn(
                            'text-xs font-mono mb-1',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            {item.code}
                          </div>
                          <div className={cn(
                            'font-semibold text-sm mb-2',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {item.name}
                          </div>
                          <div className={cn(
                            'text-xs mb-1',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            {item.category}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className={cn(
                              'text-xs',
                              item.currentStock <= item.minStock
                                ? 'text-amber-500 font-medium'
                                : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            )}>
                              Stock: {item.currentStock} {item.unit}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-end mt-6">
                    <button
                      type="button"
                      disabled={!canProceedStep1}
                      onClick={goNext}
                      className={cn(
                        'px-6 py-3 rounded-xl text-white font-medium flex items-center gap-2 transition-all',
                        canProceedStep1
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25'
                          : 'bg-gray-400 cursor-not-allowed opacity-50'
                      )}
                    >
                      Siguiente
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2 - Dispatch Data */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}>
                  <h2 className={cn(
                    'text-lg font-semibold mb-4',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Datos de Despacho
                  </h2>

                  {/* Selected product summary */}
                  {selectedItem && (
                    <div className={cn(
                      'p-4 rounded-xl mb-6 border',
                      theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className={cn(
                            'font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {selectedItem.name}
                          </p>
                          <p className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            {selectedItem.code} &middot; Stock disponible: {selectedItem.currentStock} {selectedItem.unit}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="space-y-5">
                    {/* Cantidad */}
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-1.5',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Cantidad <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={selectedItem?.currentStock || 1}
                        step={1}
                        value={quantity}
                        onChange={e => {
                          const val = e.target.value
                          setQuantity(val === '' ? '' : parseInt(val))
                        }}
                        placeholder={`Max: ${selectedItem?.currentStock || 0} ${selectedItem?.unit || ''}`}
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          quantityError
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                            : theme === 'dark'
                              ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                      {quantityError && (
                        <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {quantityError}
                        </p>
                      )}
                    </div>

                    {/* Empleado */}
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-1.5',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Empleado <span className="text-red-500">*</span>
                      </label>
                      {loadingEmployees ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          <span className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Cargando empleados...
                          </span>
                        </div>
                      ) : (
                        <select
                          value={employeeId}
                          onChange={e => setEmployeeId(e.target.value ? parseInt(e.target.value) : '')}
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        >
                          <option value="">Seleccionar empleado...</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.fullName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Motivo */}
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-1.5',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Motivo / Razon <span className={cn(
                          'text-xs',
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>(recomendado)</span>
                      </label>
                      <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={2}
                        placeholder="Ej: Reposicion de material de oficina..."
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>

                    {/* Notas adicionales */}
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-1.5',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Notas adicionales <span className={cn(
                          'text-xs',
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>(opcional)</span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Notas internas..."
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between mt-6">
                    <button
                      type="button"
                      onClick={goBack}
                      className={cn(
                        'px-6 py-3 rounded-xl transition-all font-medium flex items-center gap-2',
                        theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      )}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Atras
                    </button>
                    <button
                      type="button"
                      disabled={!canProceedStep2}
                      onClick={goNext}
                      className={cn(
                        'px-6 py-3 rounded-xl text-white font-medium flex items-center gap-2 transition-all',
                        canProceedStep2
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25'
                          : 'bg-gray-400 cursor-not-allowed opacity-50'
                      )}
                    >
                      Siguiente
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3 - Confirm */}
            {currentStep === 3 && selectedItem && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl p-6',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}>
                  <h2 className={cn(
                    'text-lg font-semibold mb-6',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Confirmar Despacho
                  </h2>

                  {/* Summary card */}
                  <div className={cn(
                    'rounded-xl border p-5 space-y-4',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                  )}>
                    {/* Producto */}
                    <div className="flex items-start justify-between">
                      <span className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Producto
                      </span>
                      <span className={cn(
                        'text-sm font-semibold text-right',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {selectedItem.name} <span className={cn(
                          'font-mono text-xs',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>({selectedItem.code})</span>
                      </span>
                    </div>

                    <div className={cn('h-px', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />

                    {/* Cantidad */}
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Cantidad
                      </span>
                      <span className={cn(
                        'text-sm font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {quantity} {selectedItem.unit}
                      </span>
                    </div>

                    <div className={cn('h-px', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />

                    {/* Empleado */}
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Empleado
                      </span>
                      <span className={cn(
                        'text-sm font-semibold flex items-center gap-1.5',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <User className="w-3.5 h-3.5" />
                        {selectedEmployee?.fullName || '-'}
                      </span>
                    </div>

                    <div className={cn('h-px', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />

                    {/* Motivo */}
                    <div className="flex items-start justify-between">
                      <span className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Motivo
                      </span>
                      <span className={cn(
                        'text-sm text-right max-w-[60%]',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {reason || 'No especificado'}
                      </span>
                    </div>

                    {notes && (
                      <>
                        <div className={cn('h-px', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />
                        <div className="flex items-start justify-between">
                          <span className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Notas
                          </span>
                          <span className={cn(
                            'text-sm text-right max-w-[60%]',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            {notes}
                          </span>
                        </div>
                      </>
                    )}

                    <div className={cn('h-px', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')} />

                    {/* Stock change */}
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Stock actual
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm font-semibold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {selectedItem.currentStock}
                        </span>
                        <ArrowRight className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-bold text-emerald-500">
                          Nuevo stock: {selectedItem.currentStock - (typeof quantity === 'number' ? quantity : 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between mt-6">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={submitting}
                      className={cn(
                        'px-6 py-3 rounded-xl transition-all font-medium flex items-center gap-2',
                        theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      )}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Atras
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className={cn(
                        'px-6 py-3 rounded-xl text-white font-medium flex items-center gap-2 transition-all',
                        submitting
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-lg shadow-emerald-500/25'
                      )}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Confirmar Despacho
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
