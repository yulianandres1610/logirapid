'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Boxes,
  Scale,
  ClipboardCheck,
  Search,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Warehouse,
  Calculator
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'source' | 'materials' | 'target' | 'summary'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 'source', title: 'Fuente', description: 'Materia prima', icon: Package },
  { id: 'materials', title: 'Materiales', description: 'Bolsas, etiquetas', icon: Boxes },
  { id: 'target', title: 'Producto', description: 'Producto final', icon: Scale },
  { id: 'summary', title: 'Resumen', description: 'Confirmar orden', icon: ClipboardCheck }
]

interface Product {
  id: number
  name: string
  sku: string | null
  imageUrl: string | null
  costPrice: number
  sellingPrice: number
  unitOfMeasure: string
  quantityOnHand: number
}

interface WarehouseOption {
  id: number
  code: string
  name: string
  city: string | null
}

interface Material {
  productId: number
  productName: string
  productSku: string | null
  productImage: string | null
  variantId: number | null
  warehouseId: number
  warehouseName: string
  quantity: number
  unitCost: number
  totalCost: number
  availableQty: number
}

interface FormData {
  // Step 1: Source
  sourceProductId: number | null
  sourceProduct: Product | null
  sourceVariantId: number | null
  sourceWarehouseId: number | null
  sourceWarehouseName: string
  sourceWeightKg: number
  sourceCostPerKg: number

  // Step 2: Materials
  materials: Material[]

  // Step 3: Target
  targetProductId: number | null
  targetProduct: Product | null
  targetVariantId: number | null
  targetWarehouseId: number | null
  targetWarehouseName: string
  targetPortionWeightKg: number
  targetQuantity: number

  // Step 4: Summary
  laborCost: number
  notes: string
}

export default function CreateProductionOrderPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState<Step>('source')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Data for selectors
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [materialProducts, setMaterialProducts] = useState<Product[]>([])
  const [materialSearch, setMaterialSearch] = useState('')

  const [formData, setFormData] = useState<FormData>({
    sourceProductId: null,
    sourceProduct: null,
    sourceVariantId: null,
    sourceWarehouseId: null,
    sourceWarehouseName: '',
    sourceWeightKg: 0,
    sourceCostPerKg: 0,
    materials: [],
    targetProductId: null,
    targetProduct: null,
    targetVariantId: null,
    targetWarehouseId: null,
    targetWarehouseName: '',
    targetPortionWeightKg: 0,
    targetQuantity: 0,
    laborCost: 0,
    notes: ''
  })

  // Fetch initial data
  useEffect(() => {
    fetchWarehouses()
    fetchProducts()
  }, [])

  // Filter products based on search
  useEffect(() => {
    if (productSearch) {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
      )
      setFilteredProducts(filtered.slice(0, 10))
    } else {
      setFilteredProducts([])
    }
  }, [productSearch, products])

  // Filter material products
  useEffect(() => {
    if (materialSearch) {
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(materialSearch.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(materialSearch.toLowerCase()))
      )
      setMaterialProducts(filtered.slice(0, 10))
    } else {
      setMaterialProducts([])
    }
  }, [materialSearch, products])

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/market/warehouses?limit=100')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setWarehouses(data.data.warehouses || data.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/market/products?limit=1000&isActive=true')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setProducts(data.data.products || data.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const selectSourceProduct = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      sourceProductId: product.id,
      sourceProduct: product,
      sourceCostPerKg: product.costPrice
    }))
    setProductSearch('')
    setFilteredProducts([])
  }

  const selectTargetProduct = (product: Product) => {
    setFormData(prev => ({
      ...prev,
      targetProductId: product.id,
      targetProduct: product
    }))
    setProductSearch('')
    setFilteredProducts([])
  }

  const addMaterial = (product: Product) => {
    const existingIndex = formData.materials.findIndex(m => m.productId === product.id)
    if (existingIndex >= 0) {
      // Increment quantity
      const newMaterials = [...formData.materials]
      newMaterials[existingIndex].quantity += 1
      newMaterials[existingIndex].totalCost = newMaterials[existingIndex].quantity * newMaterials[existingIndex].unitCost
      setFormData(prev => ({ ...prev, materials: newMaterials }))
    } else {
      // Add new material
      const newMaterial: Material = {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productImage: product.imageUrl,
        variantId: null,
        warehouseId: formData.sourceWarehouseId || warehouses[0]?.id || 0,
        warehouseName: formData.sourceWarehouseName || warehouses[0]?.name || '',
        quantity: 1,
        unitCost: product.costPrice,
        totalCost: product.costPrice,
        availableQty: product.quantityOnHand
      }
      setFormData(prev => ({ ...prev, materials: [...prev.materials, newMaterial] }))
    }
    setMaterialSearch('')
    setMaterialProducts([])
  }

  const updateMaterialQuantity = (index: number, delta: number) => {
    const newMaterials = [...formData.materials]
    newMaterials[index].quantity = Math.max(1, newMaterials[index].quantity + delta)
    newMaterials[index].totalCost = newMaterials[index].quantity * newMaterials[index].unitCost
    setFormData(prev => ({ ...prev, materials: newMaterials }))
  }

  const removeMaterial = (index: number) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index)
    }))
  }

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'source') {
      if (!formData.sourceProductId) newErrors.sourceProduct = 'Seleccione un producto fuente'
      if (!formData.sourceWarehouseId) newErrors.sourceWarehouse = 'Seleccione un almacén'
      if (formData.sourceWeightKg <= 0) newErrors.sourceWeight = 'Ingrese un peso válido'
    }

    if (step === 'target') {
      if (!formData.targetProductId) newErrors.targetProduct = 'Seleccione un producto final'
      if (!formData.targetWarehouseId) newErrors.targetWarehouse = 'Seleccione un almacén destino'
      if (formData.targetPortionWeightKg <= 0) newErrors.targetPortionWeight = 'Ingrese un peso por porción válido'
      if (formData.targetQuantity <= 0) newErrors.targetQuantity = 'Ingrese una cantidad válida'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return

    const stepIndex = STEPS.findIndex(s => s.id === currentStep)
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].id)
    }
  }

  const goToPrevStep = () => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep)
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep('target')) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/market/production/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProductId: formData.sourceProductId,
          sourceVariantId: formData.sourceVariantId,
          sourceWarehouseId: formData.sourceWarehouseId,
          sourceWeightKg: formData.sourceWeightKg,
          targetProductId: formData.targetProductId,
          targetVariantId: formData.targetVariantId,
          targetWarehouseId: formData.targetWarehouseId,
          targetPortionWeightKg: formData.targetPortionWeightKg,
          targetQuantity: formData.targetQuantity,
          materials: formData.materials.map(m => ({
            productId: m.productId,
            variantId: m.variantId,
            warehouseId: m.warehouseId,
            quantity: m.quantity
          })),
          laborCost: formData.laborCost,
          notes: formData.notes
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/dashboard/market/production/dosification/${data.data.orderId}`)
      } else {
        setErrors({ submit: data.error || 'Error al crear la orden' })
      }
    } catch (error) {
      console.error('Error creating order:', error)
      setErrors({ submit: 'Error al crear la orden de producción' })
    } finally {
      setSubmitting(false)
    }
  }

  // Calculations
  const expectedTotalWeight = formData.targetPortionWeightKg * formData.targetQuantity
  const wasteSurplusKg = formData.sourceWeightKg - expectedTotalWeight
  const wasteSurplusType = wasteSurplusKg > 0.001 ? 'surplus' : wasteSurplusKg < -0.001 ? 'waste' : 'exact'
  const wasteSurplusPercent = formData.sourceWeightKg > 0 ? (Math.abs(wasteSurplusKg) / formData.sourceWeightKg * 100) : 0

  const rawMaterialCost = formData.sourceWeightKg * formData.sourceCostPerKg
  const materialsCost = formData.materials.reduce((sum, m) => sum + m.totalCost, 0)
  const totalCost = rawMaterialCost + materialsCost + formData.laborCost
  const costPerUnit = formData.targetQuantity > 0 ? totalCost / formData.targetQuantity : 0

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen">
          {/* Header */}
          <div className={cn(
            'sticky top-0 z-10 border-b backdrop-blur-lg',
            theme === 'dark'
              ? 'bg-gray-900/80 border-gray-800'
              : 'bg-white/80 border-gray-200'
          )}>
            <div className="max-w-6xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => router.back()}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      theme === 'dark'
                        ? 'hover:bg-gray-800 text-gray-400'
                        : 'hover:bg-gray-100 text-gray-600'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className={cn(
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Nueva Orden de Producción
                    </h1>
                    <p className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Paso {currentStepIndex + 1} de {STEPS.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step indicators */}
              <div className="flex items-center justify-center mt-6 gap-2">
                {STEPS.map((step, index) => {
                  const StepIcon = step.icon
                  const isActive = step.id === currentStep
                  const isCompleted = index < currentStepIndex

                  return (
                    <div key={step.id} className="flex items-center">
                      <motion.div
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
                          isActive
                            ? theme === 'dark'
                              ? 'bg-emerald-900/50 border border-emerald-700'
                              : 'bg-emerald-100 border border-emerald-300'
                            : isCompleted
                              ? theme === 'dark'
                                ? 'bg-emerald-900/30'
                                : 'bg-emerald-50'
                              : theme === 'dark'
                                ? 'bg-gray-800'
                                : 'bg-gray-100'
                        )}
                        animate={{ scale: isActive ? 1.05 : 1 }}
                      >
                        <StepIcon className={cn(
                          'w-5 h-5',
                          isActive || isCompleted
                            ? 'text-emerald-600'
                            : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )} />
                        <span className={cn(
                          'text-sm font-medium hidden sm:inline',
                          isActive || isCompleted
                            ? 'text-emerald-600'
                            : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {step.title}
                        </span>
                      </motion.div>
                      {index < STEPS.length - 1 && (
                        <div className={cn(
                          'w-8 h-0.5 mx-1',
                          index < currentStepIndex
                            ? 'bg-emerald-500'
                            : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto px-6 py-8">
            <AnimatePresence mode="wait">
              {/* Step 1: Source Product */}
              {currentStep === 'source' && (
                <motion.div
                  key="source"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      'text-lg font-semibold mb-4',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Seleccionar Producto Fuente (Materia Prima)
                    </h2>

                    {/* Warehouse Selection */}
                    <div className="mb-6">
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Almacén de Origen
                      </label>
                      <select
                        value={formData.sourceWarehouseId || ''}
                        onChange={(e) => {
                          const warehouse = warehouses.find(w => w.id === parseInt(e.target.value))
                          setFormData(prev => ({
                            ...prev,
                            sourceWarehouseId: warehouse?.id || null,
                            sourceWarehouseName: warehouse?.name || ''
                          }))
                        }}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20',
                          errors.sourceWarehouse && 'border-red-500'
                        )}
                      >
                        <option value="">Seleccionar almacén...</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                        ))}
                      </select>
                      {errors.sourceWarehouse && (
                        <p className="text-red-500 text-sm mt-1">{errors.sourceWarehouse}</p>
                      )}
                    </div>

                    {/* Product Search */}
                    <div className="mb-6">
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Buscar Producto
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre o SKU..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      {/* Search Results */}
                      {filteredProducts.length > 0 && (
                        <div className={cn(
                          'mt-2 rounded-xl border max-h-60 overflow-y-auto',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700'
                            : 'bg-white border-gray-200'
                        )}>
                          {filteredProducts.map(product => (
                            <button
                              key={product.id}
                              onClick={() => selectSourceProduct(product)}
                              className={cn(
                                'w-full flex items-center gap-3 p-3 transition-colors text-left',
                                theme === 'dark'
                                  ? 'hover:bg-gray-700'
                                  : 'hover:bg-gray-50'
                              )}
                            >
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className={cn(
                                  'w-10 h-10 rounded-lg flex items-center justify-center',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                )}>
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{product.name}</p>
                                <p className="text-sm text-gray-500">
                                  {product.sku} | {formatCurrency(product.costPrice)}/kg
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Product */}
                    {formData.sourceProduct && (
                      <div className={cn(
                        'p-4 rounded-xl border mb-6',
                        theme === 'dark'
                          ? 'bg-emerald-900/20 border-emerald-800'
                          : 'bg-emerald-50 border-emerald-200'
                      )}>
                        <div className="flex items-center gap-4">
                          {formData.sourceProduct.imageUrl ? (
                            <img
                              src={formData.sourceProduct.imageUrl}
                              alt={formData.sourceProduct.name}
                              className="w-16 h-16 rounded-xl object-cover"
                            />
                          ) : (
                            <div className={cn(
                              'w-16 h-16 rounded-xl flex items-center justify-center',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            )}>
                              <Package className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className={cn(
                              'font-semibold text-lg',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {formData.sourceProduct.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              SKU: {formData.sourceProduct.sku || 'N/A'} | Costo: {formatCurrency(formData.sourceProduct.costPrice)}/kg
                            </p>
                          </div>
                          <button
                            onClick={() => setFormData(prev => ({ ...prev, sourceProductId: null, sourceProduct: null }))}
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {errors.sourceProduct && (
                      <p className="text-red-500 text-sm mb-4">{errors.sourceProduct}</p>
                    )}

                    {/* Weight Input */}
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Peso del Producto (kg)
                      </label>
                      <div className="relative">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="Ej: 40.320"
                          value={formData.sourceWeightKg || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            sourceWeightKg: parseFloat(e.target.value) || 0
                          }))}
                          className={cn(
                            'w-full pl-10 pr-4 py-4 rounded-xl border text-2xl font-bold focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20',
                            errors.sourceWeight && 'border-red-500'
                          )}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                          kg
                        </span>
                      </div>
                      {errors.sourceWeight && (
                        <p className="text-red-500 text-sm mt-1">{errors.sourceWeight}</p>
                      )}
                      {formData.sourceWeightKg > 0 && formData.sourceCostPerKg > 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                          Costo estimado: {formatCurrency(formData.sourceWeightKg * formData.sourceCostPerKg)}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Materials */}
              {currentStep === 'materials' && (
                <motion.div
                  key="materials"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      'text-lg font-semibold mb-4',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Materiales (Bolsas, Etiquetas, etc.)
                    </h2>
                    <p className={cn(
                      'text-sm mb-6',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Opcional: agregue los materiales necesarios para el empaque.
                    </p>

                    {/* Material Search */}
                    <div className="mb-6">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar materiales (bolsas, etiquetas...)..."
                          value={materialSearch}
                          onChange={(e) => setMaterialSearch(e.target.value)}
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      {/* Search Results */}
                      {materialProducts.length > 0 && (
                        <div className={cn(
                          'mt-2 rounded-xl border max-h-48 overflow-y-auto',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700'
                            : 'bg-white border-gray-200'
                        )}>
                          {materialProducts.map(product => (
                            <button
                              key={product.id}
                              onClick={() => addMaterial(product)}
                              className={cn(
                                'w-full flex items-center gap-3 p-3 transition-colors text-left',
                                theme === 'dark'
                                  ? 'hover:bg-gray-700'
                                  : 'hover:bg-gray-50'
                              )}
                            >
                              <Plus className="w-5 h-5 text-emerald-500" />
                              <div className="flex-1">
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{product.name}</p>
                                <p className="text-sm text-gray-500">
                                  {formatCurrency(product.costPrice)} / {product.unitOfMeasure}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Materials List */}
                    {formData.materials.length > 0 ? (
                      <div className="space-y-3">
                        {formData.materials.map((material, index) => (
                          <div
                            key={index}
                            className={cn(
                              'flex items-center gap-4 p-4 rounded-xl border',
                              theme === 'dark'
                                ? 'bg-gray-700/50 border-gray-600'
                                : 'bg-gray-50 border-gray-200'
                            )}
                          >
                            <div className="flex-1">
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{material.productName}</p>
                              <p className="text-sm text-gray-500">
                                {formatCurrency(material.unitCost)} c/u
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateMaterialQuantity(index, -1)}
                                className={cn(
                                  'p-2 rounded-lg transition-colors',
                                  theme === 'dark'
                                    ? 'hover:bg-gray-600'
                                    : 'hover:bg-gray-200'
                                )}
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className={cn(
                                'w-12 text-center font-bold',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {material.quantity}
                              </span>
                              <button
                                onClick={() => updateMaterialQuantity(index, 1)}
                                className={cn(
                                  'p-2 rounded-lg transition-colors',
                                  theme === 'dark'
                                    ? 'hover:bg-gray-600'
                                    : 'hover:bg-gray-200'
                                )}
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <p className={cn(
                              'font-bold w-24 text-right',
                              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                            )}>
                              {formatCurrency(material.totalCost)}
                            </p>
                            <button
                              onClick={() => removeMaterial(index)}
                              className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}

                        {/* Total Materials Cost */}
                        <div className={cn(
                          'flex items-center justify-between p-4 rounded-xl',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}>
                          <span className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Total Materiales:
                          </span>
                          <span className={cn(
                            'text-xl font-bold',
                            theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                          )}>
                            {formatCurrency(materialsCost)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className={cn(
                        'text-center py-8 rounded-xl border-2 border-dashed',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <Boxes className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-gray-500">No se han agregado materiales</p>
                        <p className="text-sm text-gray-400">Busque y agregue bolsas, etiquetas u otros materiales</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 3: Target Product */}
              {currentStep === 'target' && (
                <motion.div
                  key="target"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      'text-lg font-semibold mb-4',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Producto Final a Manufacturar
                    </h2>

                    {/* Warehouse Selection */}
                    <div className="mb-6">
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Almacén Destino
                      </label>
                      <select
                        value={formData.targetWarehouseId || ''}
                        onChange={(e) => {
                          const warehouse = warehouses.find(w => w.id === parseInt(e.target.value))
                          setFormData(prev => ({
                            ...prev,
                            targetWarehouseId: warehouse?.id || null,
                            targetWarehouseName: warehouse?.name || ''
                          }))
                        }}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20',
                          errors.targetWarehouse && 'border-red-500'
                        )}
                      >
                        <option value="">Seleccionar almacén...</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                        ))}
                      </select>
                      {errors.targetWarehouse && (
                        <p className="text-red-500 text-sm mt-1">{errors.targetWarehouse}</p>
                      )}
                    </div>

                    {/* Product Search */}
                    <div className="mb-6">
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Buscar Producto Final
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre o SKU..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      {filteredProducts.length > 0 && (
                        <div className={cn(
                          'mt-2 rounded-xl border max-h-48 overflow-y-auto',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700'
                            : 'bg-white border-gray-200'
                        )}>
                          {filteredProducts.map(product => (
                            <button
                              key={product.id}
                              onClick={() => selectTargetProduct(product)}
                              className={cn(
                                'w-full flex items-center gap-3 p-3 transition-colors text-left',
                                theme === 'dark'
                                  ? 'hover:bg-gray-700'
                                  : 'hover:bg-gray-50'
                              )}
                            >
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className={cn(
                                  'w-10 h-10 rounded-lg flex items-center justify-center',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                )}>
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{product.name}</p>
                                <p className="text-sm text-gray-500">{product.sku}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Target Product */}
                    {formData.targetProduct && (
                      <div className={cn(
                        'p-4 rounded-xl border mb-6',
                        theme === 'dark'
                          ? 'bg-emerald-900/20 border-emerald-800'
                          : 'bg-emerald-50 border-emerald-200'
                      )}>
                        <div className="flex items-center gap-4">
                          {formData.targetProduct.imageUrl ? (
                            <img
                              src={formData.targetProduct.imageUrl}
                              alt={formData.targetProduct.name}
                              className="w-16 h-16 rounded-xl object-cover"
                            />
                          ) : (
                            <div className={cn(
                              'w-16 h-16 rounded-xl flex items-center justify-center',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            )}>
                              <Package className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className={cn(
                              'font-semibold text-lg',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {formData.targetProduct.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              SKU: {formData.targetProduct.sku || 'N/A'}
                            </p>
                          </div>
                          <button
                            onClick={() => setFormData(prev => ({ ...prev, targetProductId: null, targetProduct: null }))}
                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {errors.targetProduct && (
                      <p className="text-red-500 text-sm mb-4">{errors.targetProduct}</p>
                    )}

                    {/* Portion Weight & Quantity */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className={cn(
                          'block text-sm font-medium mb-2',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Peso por Porción (kg)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="Ej: 2.000"
                          value={formData.targetPortionWeightKg || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            targetPortionWeightKg: parseFloat(e.target.value) || 0
                          }))}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20',
                            errors.targetPortionWeight && 'border-red-500'
                          )}
                        />
                        {errors.targetPortionWeight && (
                          <p className="text-red-500 text-sm mt-1">{errors.targetPortionWeight}</p>
                        )}
                      </div>
                      <div>
                        <label className={cn(
                          'block text-sm font-medium mb-2',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Cantidad de Porciones
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Ej: 20"
                          value={formData.targetQuantity || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            targetQuantity: parseInt(e.target.value) || 0
                          }))}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20',
                            errors.targetQuantity && 'border-red-500'
                          )}
                        />
                        {errors.targetQuantity && (
                          <p className="text-red-500 text-sm mt-1">{errors.targetQuantity}</p>
                        )}
                      </div>
                    </div>

                    {/* Calculation Preview */}
                    {formData.sourceWeightKg > 0 && formData.targetPortionWeightKg > 0 && formData.targetQuantity > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl border',
                        wasteSurplusType === 'waste'
                          ? theme === 'dark'
                            ? 'bg-red-900/20 border-red-800'
                            : 'bg-red-50 border-red-200'
                          : wasteSurplusType === 'surplus'
                            ? theme === 'dark'
                              ? 'bg-green-900/20 border-green-800'
                              : 'bg-green-50 border-green-200'
                            : theme === 'dark'
                              ? 'bg-gray-700 border-gray-600'
                              : 'bg-gray-50 border-gray-200'
                      )}>
                        <h3 className={cn(
                          'font-semibold mb-3',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          <Calculator className="w-5 h-5 inline mr-2" />
                          Cálculo de Producción
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Peso fuente:</span>
                            <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                              {formData.sourceWeightKg.toFixed(3)} kg
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Porciones:</span>
                            <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                              {formData.targetQuantity} × {formData.targetPortionWeightKg.toFixed(3)} kg = {expectedTotalWeight.toFixed(3)} kg
                            </span>
                          </div>
                          <div className={cn(
                            'flex justify-between pt-2 border-t font-bold',
                            theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                          )}>
                            <span className={
                              wasteSurplusType === 'waste' ? 'text-red-600' :
                              wasteSurplusType === 'surplus' ? 'text-green-600' :
                              'text-gray-600'
                            }>
                              {wasteSurplusType === 'waste' ? 'MERMA:' :
                               wasteSurplusType === 'surplus' ? 'SOBRANTE:' : 'EXACTO:'}
                            </span>
                            <span className={cn(
                              'flex items-center gap-2',
                              wasteSurplusType === 'waste' ? 'text-red-600' :
                              wasteSurplusType === 'surplus' ? 'text-green-600' :
                              'text-gray-600'
                            )}>
                              {wasteSurplusType === 'waste' && <AlertTriangle className="w-4 h-4" />}
                              {wasteSurplusType === 'surplus' && <CheckCircle className="w-4 h-4" />}
                              {wasteSurplusType === 'waste' ? '-' : wasteSurplusType === 'surplus' ? '+' : ''}
                              {Math.abs(wasteSurplusKg).toFixed(3)} kg ({wasteSurplusPercent.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Summary */}
              {currentStep === 'summary' && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Order Summary */}
                  <div className={cn(
                    'p-6 rounded-2xl border',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      'text-lg font-semibold mb-6',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Resumen de la Orden
                    </h2>

                    {/* Source → Target */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className={cn(
                        'flex-1 p-4 rounded-xl border',
                        theme === 'dark'
                          ? 'bg-gray-700/50 border-gray-600'
                          : 'bg-gray-50 border-gray-200'
                      )}>
                        <p className="text-xs text-gray-500 mb-1">PRODUCTO FUENTE</p>
                        <p className={cn(
                          'font-semibold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formData.sourceProduct?.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formData.sourceWeightKg.toFixed(3)} kg
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          <Warehouse className="w-3 h-3 inline mr-1" />
                          {formData.sourceWarehouseName}
                        </p>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400" />
                      <div className={cn(
                        'flex-1 p-4 rounded-xl border',
                        theme === 'dark'
                          ? 'bg-emerald-900/20 border-emerald-800'
                          : 'bg-emerald-50 border-emerald-200'
                      )}>
                        <p className="text-xs text-emerald-600 mb-1">PRODUCTO FINAL</p>
                        <p className={cn(
                          'font-semibold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formData.targetProduct?.name}
                        </p>
                        <p className="text-sm text-emerald-600">
                          {formData.targetQuantity} × {formData.targetPortionWeightKg.toFixed(3)} kg
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          <Warehouse className="w-3 h-3 inline mr-1" />
                          {formData.targetWarehouseName}
                        </p>
                      </div>
                    </div>

                    {/* Waste/Surplus indicator */}
                    <div className={cn(
                      'p-4 rounded-xl mb-6',
                      wasteSurplusType === 'waste'
                        ? theme === 'dark'
                          ? 'bg-red-900/20 border border-red-800'
                          : 'bg-red-50 border border-red-200'
                        : wasteSurplusType === 'surplus'
                          ? theme === 'dark'
                            ? 'bg-green-900/20 border border-green-800'
                            : 'bg-green-50 border border-green-200'
                          : theme === 'dark'
                            ? 'bg-gray-700 border border-gray-600'
                            : 'bg-gray-50 border border-gray-200'
                    )}>
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'font-medium',
                          wasteSurplusType === 'waste' ? 'text-red-600' :
                          wasteSurplusType === 'surplus' ? 'text-green-600' :
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          {wasteSurplusType === 'waste' ? 'Merma esperada' :
                           wasteSurplusType === 'surplus' ? 'Sobrante esperado' : 'Sin diferencia'}
                        </span>
                        <span className={cn(
                          'text-xl font-bold flex items-center gap-2',
                          wasteSurplusType === 'waste' ? 'text-red-600' :
                          wasteSurplusType === 'surplus' ? 'text-green-600' :
                          'text-gray-600'
                        )}>
                          {wasteSurplusType === 'waste' && <AlertTriangle className="w-5 h-5" />}
                          {wasteSurplusType === 'surplus' && <CheckCircle className="w-5 h-5" />}
                          {wasteSurplusType !== 'exact' && (
                            <>
                              {wasteSurplusType === 'waste' ? '-' : '+'}
                              {Math.abs(wasteSurplusKg).toFixed(3)} kg
                            </>
                          )}
                          {wasteSurplusType === 'exact' && '0.000 kg'}
                        </span>
                      </div>
                    </div>

                    {/* Materials */}
                    {formData.materials.length > 0 && (
                      <div className="mb-6">
                        <p className="text-xs text-gray-500 mb-2">MATERIALES</p>
                        <div className="space-y-2">
                          {formData.materials.map((m, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                                {m.quantity} × {m.productName}
                              </span>
                              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                {formatCurrency(m.totalCost)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cost Breakdown */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark'
                        ? 'bg-gray-700/50 border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                    )}>
                      <p className="text-xs text-gray-500 mb-3">DESGLOSE DE COSTOS</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                            Materia prima ({formData.sourceWeightKg.toFixed(3)} kg × {formatCurrency(formData.sourceCostPerKg)})
                          </span>
                          <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                            {formatCurrency(rawMaterialCost)}
                          </span>
                        </div>
                        {materialsCost > 0 && (
                          <div className="flex justify-between">
                            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                              Materiales
                            </span>
                            <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                              {formatCurrency(materialsCost)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                            Mano de obra
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.laborCost || ''}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              laborCost: parseFloat(e.target.value) || 0
                            }))}
                            placeholder="0.00"
                            className={cn(
                              'w-24 px-2 py-1 text-right rounded border focus:outline-none focus:ring-1',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-600 text-white'
                                : 'bg-white border-gray-200 text-gray-900'
                            )}
                          />
                        </div>
                        <div className={cn(
                          'flex justify-between pt-2 border-t font-bold text-base',
                          theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                        )}>
                          <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                            COSTO TOTAL
                          </span>
                          <span className="text-emerald-600">
                            {formatCurrency(totalCost)}
                          </span>
                        </div>
                        <div className="flex justify-between text-lg font-bold">
                          <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                            COSTO POR UNIDAD
                          </span>
                          <span className="text-emerald-600">
                            {formatCurrency(costPerUnit)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="mt-6">
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Notas (opcional)
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Notas adicionales para la orden..."
                        rows={3}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20'
                        )}
                      />
                    </div>
                  </div>

                  {errors.submit && (
                    <div className="p-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                      <p className="text-red-600 text-sm">{errors.submit}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl transition-all',
                  currentStepIndex === 0
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'hover:bg-gray-800 text-gray-300'
                      : 'hover:bg-gray-100 text-gray-600'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </button>

              {currentStep === 'summary' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={cn(
                    'flex items-center gap-2 px-8 py-3 rounded-xl font-semibold transition-all',
                    'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
                    'hover:from-emerald-600 hover:to-emerald-700',
                    'shadow-lg shadow-emerald-500/25',
                    submitting && 'opacity-75 cursor-not-allowed'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Crear Orden de Producción
                    </>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextStep}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                    'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
                    'hover:from-emerald-600 hover:to-emerald-700'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
