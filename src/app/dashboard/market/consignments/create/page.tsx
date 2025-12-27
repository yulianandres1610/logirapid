'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Package,
  FileText,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Trash2,
  Loader2,
  X,
  Warehouse,
  Calendar,
  Barcode,
  DollarSign,
  Printer,
  CheckCircle,
  Building2,
  Phone,
  Mail
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'supplier' | 'products' | 'review' | 'confirmation'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'supplier', title: 'Proveedor', description: 'Seleccionar', icon: Users },
  { id: 'products', title: 'Productos', description: 'Agregar lineas', icon: Package },
  { id: 'review', title: 'Revision', description: 'Verificar orden', icon: FileText },
  { id: 'confirmation', title: 'Confirmacion', description: 'Finalizar', icon: Check }
]

interface Supplier {
  id: number
  code: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
}

interface WarehouseInfo {
  id: number
  code: string
  name: string
}

interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
  costPrice: number
  sellingPrice: number
  currency: string
  quantityOnHand: number
}

interface OrderLine {
  productId: number
  product: Product
  quantity: number
  unitCost: number
  unitPrice: number
  totalCost: number
}

interface CreatedOrder {
  id: number
  orderNumber: string
  totalItems: number
  totalUnits: number
  totalCost: number
}

export default function CreateConsignmentOrderPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('supplier')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Step 1: Supplier & Warehouse
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseInfo | null>(null)
  const [consignmentDate, setConsignmentDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [supplierSearch, setSupplierSearch] = useState('')

  // Step 2: Products
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')

  // Step 4: Confirmation
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Load suppliers and warehouses
  useEffect(() => {
    const fetchData = async () => {
      setLoadingSuppliers(true)
      try {
        const [suppliersRes, warehousesRes] = await Promise.all([
          fetch('/api/consignments/suppliers?limit=100'),
          fetch('/api/market/warehouses')
        ])

        if (suppliersRes.ok) {
          const data = await suppliersRes.json()
          if (data.success) setSuppliers(data.data.suppliers)
        }

        if (warehousesRes.ok) {
          const data = await warehousesRes.json()
          if (data.success) setWarehouses(data.data.warehouses || data.data)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoadingSuppliers(false)
      }
    }
    fetchData()
  }, [])

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProductResults([])
      return
    }
    setSearchingProducts(true)
    try {
      const response = await fetch(`/api/market/products?search=${encodeURIComponent(query)}&limit=20`)
      const data = await response.json()
      if (data.success) {
        setProductResults(data.data.products || [])
      }
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setSearchingProducts(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch) searchProducts(productSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, searchProducts])

  // Handle barcode scan
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeInput.trim()) return

    setSearchingProducts(true)
    try {
      const response = await fetch(`/api/market/products?search=${encodeURIComponent(barcodeInput)}&limit=1`)
      const data = await response.json()
      if (data.success && data.data.products?.length > 0) {
        addProductToOrder(data.data.products[0])
      } else {
        setErrors({ barcode: 'Producto no encontrado' })
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setSearchingProducts(false)
      setBarcodeInput('')
    }
  }

  // Add product to order
  const addProductToOrder = (product: Product) => {
    const existing = orderLines.find(l => l.productId === product.id)
    if (existing) {
      setOrderLines(prev => prev.map(l =>
        l.productId === product.id
          ? { ...l, quantity: l.quantity + 1, totalCost: (l.quantity + 1) * l.unitCost }
          : l
      ))
    } else {
      setOrderLines(prev => [...prev, {
        productId: product.id,
        product,
        quantity: 1,
        unitCost: product.costPrice,
        unitPrice: product.sellingPrice,
        totalCost: product.costPrice
      }])
    }
    setProductSearch('')
    setProductResults([])
    setErrors({})
  }

  // Update line
  const updateLine = (productId: number, field: 'quantity' | 'unitCost' | 'unitPrice', value: number) => {
    if (value < 0) return
    if (field === 'quantity' && value < 1) return

    setOrderLines(prev => prev.map(l => {
      if (l.productId !== productId) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'unitCost') {
        updated.totalCost = updated.quantity * updated.unitCost
      }
      return updated
    }))
  }

  // Remove line
  const removeLine = (productId: number) => {
    setOrderLines(prev => prev.filter(l => l.productId !== productId))
  }

  // Calculate totals
  const totalItems = orderLines.length
  const totalUnits = orderLines.reduce((sum, l) => sum + l.quantity, 0)
  const totalCost = orderLines.reduce((sum, l) => sum + l.totalCost, 0)

  // Validate step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}
    switch (step) {
      case 'supplier':
        if (!selectedSupplier) newErrors.supplier = 'Selecciona un proveedor'
        if (!selectedWarehouse) newErrors.warehouse = 'Selecciona un almacen'
        break
      case 'products':
        if (orderLines.length === 0) newErrors.products = 'Agrega al menos un producto'
        break
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Navigate steps
  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id)
  }

  // Submit order
  const handleSubmitOrder = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/consignments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier?.id,
          warehouseId: selectedWarehouse?.id,
          consignmentDate,
          notes: notes || null,
          lines: orderLines.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            unitPrice: l.unitPrice
          }))
        })
      })

      const data = await response.json()
      if (data.success) {
        setCreatedOrder(data.data)
        setCurrentStep('confirmation')
      } else {
        setErrors({ submit: data.error || 'Error al crear orden' })
      }
    } catch (error) {
      console.error('Error:', error)
      setErrors({ submit: 'Error de conexion' })
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Link href="/dashboard/market/consignments">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>Nueva Orden de Consignacion</h1>
                <p className="text-sm text-gray-500">Registra mercancia en consignacion de proveedor externo</p>
              </div>
            </div>

            {/* Step Indicator */}
            <div className={cn(
              'p-4 rounded-2xl mb-6 border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => {
                  const isActive = step.id === currentStep
                  const isComplete = index < currentStepIndex
                  const StepIcon = step.icon

                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                          isComplete
                            ? 'bg-emerald-500 text-white'
                            : isActive
                              ? theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                              : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400'
                        )}>
                          {isComplete ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <StepIcon className="w-5 h-5" />
                          )}
                        </div>
                        <div className="hidden sm:block">
                          <p className={cn(
                            'text-sm font-medium',
                            isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500'
                          )}>{step.title}</p>
                          <p className="text-xs text-gray-400">{step.description}</p>
                        </div>
                      </div>
                      {index < STEPS.length - 1 && (
                        <div className={cn(
                          'flex-1 h-0.5 mx-4',
                          isComplete
                            ? 'bg-emerald-500'
                            : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className={cn(
              'rounded-2xl border p-6',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <AnimatePresence mode="wait">
                {/* Step 1: Supplier */}
                {currentStep === 'supplier' && (
                  <motion.div
                    key="supplier"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Seleccionar Proveedor y Almacen
                    </h2>

                    {/* Supplier Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Proveedor *
                      </label>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          placeholder="Buscar proveedor..."
                          className={cn(
                            'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>

                      {loadingSuppliers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                          {filteredSuppliers.map(supplier => (
                            <motion.button
                              key={supplier.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setSelectedSupplier(supplier)}
                              className={cn(
                                'p-4 rounded-xl border text-left transition-all',
                                selectedSupplier?.id === supplier.id
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  : theme === 'dark'
                                    ? 'border-gray-700 hover:border-gray-600'
                                    : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                                  selectedSupplier?.id === supplier.id
                                    ? 'bg-blue-500 text-white'
                                    : theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                )}>
                                  {supplier.code}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">{supplier.name}</p>
                                  {supplier.contactName && (
                                    <p className="text-xs text-gray-500">{supplier.contactName}</p>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          ))}
                          {filteredSuppliers.length === 0 && (
                            <div className="col-span-2 text-center py-8">
                              <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-gray-500">No hay proveedores</p>
                              <Link href="/dashboard/market/consignments/suppliers">
                                <button className="mt-2 text-sm text-blue-500 hover:text-blue-600">
                                  Crear proveedor
                                </button>
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                      {errors.supplier && (
                        <p className="text-sm text-red-500 mt-2">{errors.supplier}</p>
                      )}
                    </div>

                    {/* Warehouse Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Almacen Destino *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {warehouses.map(warehouse => (
                          <motion.button
                            key={warehouse.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedWarehouse(warehouse)}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all flex items-center gap-3',
                              selectedWarehouse?.id === warehouse.id
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : theme === 'dark'
                                  ? 'border-gray-700 hover:border-gray-600'
                                  : 'border-gray-200 hover:border-gray-300'
                            )}
                          >
                            <Warehouse className={cn(
                              'w-5 h-5',
                              selectedWarehouse?.id === warehouse.id ? 'text-blue-500' : 'text-gray-400'
                            )} />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{warehouse.name}</p>
                              <p className="text-xs text-gray-500">{warehouse.code}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      {errors.warehouse && (
                        <p className="text-sm text-red-500 mt-2">{errors.warehouse}</p>
                      )}
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha de Consignacion
                      </label>
                      <div className="relative max-w-xs">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="date"
                          value={consignmentDate}
                          onChange={(e) => setConsignmentDate(e.target.value)}
                          className={cn(
                            'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Products */}
                {currentStep === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Agregar Productos
                    </h2>

                    {/* Barcode Scanner */}
                    <form onSubmit={handleBarcodeSubmit} className="flex gap-3">
                      <div className="flex-1 relative">
                        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          placeholder="Escanear codigo de barras..."
                          autoFocus
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-emerald-500'
                              : 'bg-gray-50 border-gray-200 focus:border-emerald-500'
                          )}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={searchingProducts}
                        className="px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      >
                        {searchingProducts ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      </motion.button>
                    </form>
                    {errors.barcode && (
                      <p className="text-sm text-red-500">{errors.barcode}</p>
                    )}

                    {/* Product Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar por nombre o SKU..."
                        className={cn(
                          'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                            : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                        )}
                      />

                      {/* Search Results */}
                      {productResults.length > 0 && (
                        <div className={cn(
                          'absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl z-10 max-h-64 overflow-y-auto',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}>
                          {productResults.map(product => (
                            <button
                              key={product.id}
                              onClick={() => addProductToOrder(product)}
                              className={cn(
                                'w-full p-3 flex items-center gap-3 text-left transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                              )}
                            >
                              <Package className="w-5 h-5 text-gray-400" />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                                <p className="text-xs text-gray-500">SKU: {product.sku} | Costo: {formatCurrency(product.costPrice)}</p>
                              </div>
                              <Plus className="w-5 h-5 text-emerald-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Order Lines */}
                    <div className="space-y-3">
                      {orderLines.length === 0 ? (
                        <div className={cn(
                          'text-center py-12 rounded-xl border-2 border-dashed',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500">No hay productos agregados</p>
                          <p className="text-sm text-gray-400">Escanea o busca productos para agregar</p>
                        </div>
                      ) : (
                        orderLines.map((line, index) => (
                          <motion.div
                            key={line.productId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              'p-4 rounded-xl border',
                              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">{line.product.name}</p>
                                <p className="text-xs text-gray-500">SKU: {line.product.sku}</p>
                              </div>

                              <div className="flex items-center gap-4">
                                {/* Quantity */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                                  <input
                                    type="number"
                                    value={line.quantity}
                                    onChange={(e) => updateLine(line.productId, 'quantity', parseInt(e.target.value) || 1)}
                                    min={1}
                                    className={cn(
                                      'w-20 px-3 py-1.5 rounded-lg border text-center',
                                      theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>

                                {/* Unit Cost */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Costo</label>
                                  <input
                                    type="number"
                                    value={line.unitCost}
                                    onChange={(e) => updateLine(line.productId, 'unitCost', parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    min={0}
                                    className={cn(
                                      'w-24 px-3 py-1.5 rounded-lg border text-right',
                                      theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>

                                {/* Unit Price */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">P. Venta</label>
                                  <input
                                    type="number"
                                    value={line.unitPrice}
                                    onChange={(e) => updateLine(line.productId, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    min={0}
                                    className={cn(
                                      'w-24 px-3 py-1.5 rounded-lg border text-right',
                                      theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>

                                {/* Total */}
                                <div className="text-right min-w-[80px]">
                                  <label className="block text-xs text-gray-500 mb-1">Total</label>
                                  <p className="font-bold text-emerald-600">{formatCurrency(line.totalCost)}</p>
                                </div>

                                {/* Remove */}
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => removeLine(line.productId)}
                                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>

                    {errors.products && (
                      <p className="text-sm text-red-500">{errors.products}</p>
                    )}

                    {/* Summary */}
                    {orderLines.length > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                      )}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Productos:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{totalItems}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Unidades:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{totalUnits}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-600">
                          <span className="text-gray-900 dark:text-white">Total Costo:</span>
                          <span className="text-emerald-600">{formatCurrency(totalCost)}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Review */}
                {currentStep === 'review' && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Revisar Orden
                    </h2>

                    {/* Order Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}>
                        <h3 className="text-sm font-medium text-gray-500 mb-3">Proveedor</h3>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                            theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                          )}>
                            {selectedSupplier?.code}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedSupplier?.name}</p>
                            {selectedSupplier?.contactName && (
                              <p className="text-xs text-gray-500">{selectedSupplier.contactName}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}>
                        <h3 className="text-sm font-medium text-gray-500 mb-3">Almacen Destino</h3>
                        <div className="flex items-center gap-3">
                          <Warehouse className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{selectedWarehouse?.name}</p>
                            <p className="text-xs text-gray-500">{selectedWarehouse?.code}</p>
                          </div>
                        </div>
                      </div>

                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}>
                        <h3 className="text-sm font-medium text-gray-500 mb-3">Fecha</h3>
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-gray-400" />
                          <p className="font-medium text-gray-900 dark:text-white">
                            {new Date(consignmentDate).toLocaleDateString('es-ES', {
                              day: '2-digit', month: 'long', year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}>
                        <h3 className="text-sm font-medium text-gray-500 mb-3">Resumen</h3>
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalItems}</p>
                            <p className="text-xs text-gray-500">productos</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUnits}</p>
                            <p className="text-xs text-gray-500">unidades</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCost)}</p>
                            <p className="text-xs text-gray-500">total costo</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div className={cn(
                      'rounded-xl border overflow-hidden',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <table className="w-full">
                        <thead className={cn(
                          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                        )}>
                          <tr>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Cant.</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Costo</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">P. Venta</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {orderLines.map(line => (
                            <tr key={line.productId}>
                              <td className="py-3 px-4">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">{line.product.name}</p>
                                <p className="text-xs text-gray-500">SKU: {line.product.sku}</p>
                              </td>
                              <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">{line.quantity}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(line.unitCost)}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(line.unitPrice)}</td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(line.totalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className={cn(
                          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                        )}>
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white">
                              Total:
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600 text-lg">
                              {formatCurrency(totalCost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notas (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Agregar notas u observaciones..."
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                            : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                        )}
                      />
                    </div>

                    {errors.submit && (
                      <div className={cn(
                        'p-4 rounded-xl flex items-center gap-3',
                        theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
                      )}>
                        <X className="w-5 h-5" />
                        {errors.submit}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 4: Confirmation */}
                {currentStep === 'confirmation' && createdOrder && (
                  <motion.div
                    key="confirmation"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                      className="w-20 h-20 mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"
                    >
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Orden Creada Exitosamente
                    </h2>
                    <p className="text-gray-500 mb-6">
                      La orden de consignacion ha sido registrada
                    </p>

                    <div className={cn(
                      'inline-block p-6 rounded-2xl mb-6',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-sm text-gray-500 mb-1">Numero de Orden</p>
                      <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                        {createdOrder.orderNumber}
                      </p>
                      <div className="flex justify-center gap-6 mt-4">
                        <div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{createdOrder.totalItems}</p>
                          <p className="text-xs text-gray-500">productos</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{createdOrder.totalUnits}</p>
                          <p className="text-xs text-gray-500">unidades</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(createdOrder.totalCost)}</p>
                          <p className="text-xs text-gray-500">total</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.print()}
                        className={cn(
                          'flex items-center gap-2 px-6 py-3 rounded-xl transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-700 text-white hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        <Printer className="w-5 h-5" />
                        Imprimir
                      </motion.button>

                      <Link href="/dashboard/market/consignments">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                        >
                          Ver Ordenes
                          <ArrowRight className="w-5 h-5" />
                        </motion.button>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              {currentStep !== 'confirmation' && (
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={currentStepIndex === 0 ? () => setShowCancelModal(true) : goToPrevStep}
                    className={cn(
                      'flex items-center gap-2 px-6 py-2.5 rounded-xl transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                    {currentStepIndex === 0 ? 'Cancelar' : 'Anterior'}
                  </motion.button>

                  {currentStep === 'review' ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSubmitOrder}
                      disabled={submitting}
                      className={cn(
                        'flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all',
                        'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25',
                        submitting ? 'opacity-70 cursor-not-allowed' : 'hover:from-emerald-600 hover:to-emerald-700'
                      )}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Crear Orden
                        </>
                      )}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={goToNextStep}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                    >
                      Siguiente
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Cancel Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={cn(
                  'w-full max-w-md rounded-2xl p-6 shadow-2xl',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                )}
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Cancelar Orden
                </h3>
                <p className="text-gray-500 mb-6">
                  ¿Estas seguro de que deseas cancelar? Se perderan los datos ingresados.
                </p>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCancelModal(false)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    Continuar editando
                  </motion.button>
                  <Link href="/dashboard/market/consignments">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-6 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                    >
                      Cancelar
                    </motion.button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
