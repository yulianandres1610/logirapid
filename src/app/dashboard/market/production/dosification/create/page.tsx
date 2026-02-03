'use client'

import React, { useState, useEffect } from 'react'
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
  Calculator,
  Check,
  X
} from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'source' | 'materials' | 'target' | 'summary'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
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
  sourceQuantity: number       // Cantidad de unidades del producto fuente (ej: 1 saco)
  sourceUnitCost: number       // Costo por unidad del producto fuente (ej: $50 por saco)
  sourceWeightKg: number       // Peso bruto total (solo para calcular porciones)

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
  const [showCancelModal, setShowCancelModal] = useState(false)

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
    sourceQuantity: 1,
    sourceUnitCost: 0,
    sourceWeightKg: 0,
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
      sourceUnitCost: product.costPrice  // Costo por unidad (no por kg)
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
          sourceQuantity: formData.sourceQuantity,
          sourceUnitCost: formData.sourceUnitCost,
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

  // Costo basado en CANTIDAD (unidades), no en peso
  const rawMaterialCost = formData.sourceQuantity * formData.sourceUnitCost
  const materialsCost = formData.materials.reduce((sum, m) => sum + m.totalCost, 0)
  const totalCost = rawMaterialCost + materialsCost + formData.laborCost
  const costPerUnit = formData.targetQuantity > 0 ? totalCost / formData.targetQuantity : 0

  // Calcular porciones máximas posibles basado en peso
  const maxPortions = formData.targetPortionWeightKg > 0
    ? Math.floor(formData.sourceWeightKg / formData.targetPortionWeightKg)
    : 0

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  return (
    <ProtectedRoute>
      <div className={cn(
        "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
        theme === 'dark' ? 'bg-[#1a2332]' : 'bg-gray-50'
      )}>
        <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 relative">

          {/* Close Button */}
          <motion.button
            onClick={() => setShowCancelModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "absolute -top-14 -right-2 sm:-top-12 sm:right-0 z-10 w-8 h-8 rounded-full flex items-center justify-center",
              "transition-colors duration-200",
              theme === 'dark'
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            )}
          >
            <X className="w-4 h-4" />
          </motion.button>

          {/* Progress Indicator */}
          <div className="mb-8 sm:mb-12">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div className="relative w-14 h-14">
                      {/* Pulsing ring for active step */}
                      {currentStep === step.id && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0, 0.5]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          style={{
                            background: theme === 'dark'
                              ? 'rgba(16, 185, 129, 0.5)'
                              : 'rgba(5, 150, 105, 0.5)'
                          }}
                        />
                      )}

                      <motion.div
                        initial={false}
                        animate={{
                          scale: currentStep === step.id ? 1.1 : 1,
                          backgroundColor: currentStep === step.id
                            ? theme === 'dark' ? '#10B981' : '#059669'
                            : currentStepIndex > index
                              ? theme === 'dark' ? '#10B981' : '#059669'
                              : theme === 'dark' ? '#374151' : '#E5E7EB'
                        }}
                        transition={{
                          scale: { duration: 0.3 },
                          backgroundColor: { duration: 0.3 }
                        }}
                        whileHover={{ scale: currentStepIndex >= index ? 1.15 : 1.05 }}
                        className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                          "transition-shadow duration-300",
                          currentStep === step.id && (
                            theme === 'dark'
                              ? 'shadow-lg shadow-emerald-500/50'
                              : 'shadow-lg shadow-emerald-400/50'
                          ),
                          currentStepIndex > index && (
                            theme === 'dark'
                              ? 'shadow-md shadow-emerald-500/30'
                              : 'shadow-md shadow-emerald-400/30'
                          )
                        )}
                      >
                        {currentStepIndex > index ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                          >
                            <Check className="w-7 h-7 text-white" />
                          </motion.div>
                        ) : (
                          <step.icon className={cn(
                            "w-7 h-7",
                            currentStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                        )}
                      </motion.div>
                    </div>

                    <div className="mt-3 text-center">
                      <p className={cn(
                        "text-xs sm:text-sm font-semibold",
                        currentStep === step.id
                          ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                          : currentStepIndex > index
                            ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                            : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        {step.title}
                      </p>
                      <p className={cn(
                        "text-xs hidden sm:block mt-0.5",
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-500'
                      )}>
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {index < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                      <div className={cn(
                        "absolute inset-0 rounded-full",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )} />
                      <motion.div
                        initial={false}
                        animate={{
                          scaleX: currentStepIndex > index ? 1 : 0
                        }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className={cn(
                          "h-full origin-left rounded-full",
                          theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-600'
                        )}
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <motion.div
            className={cn(
              "rounded-2xl p-6 sm:p-8",
              theme === 'dark'
                ? 'bg-[#1a2332]'
                : 'bg-white border border-gray-200 shadow-lg'
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AnimatePresence mode="wait">
              {/* Step 1: Source Product */}
              {currentStep === 'source' && (
                <motion.div
                  key="source"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <h2 className={cn(
                    "text-xl font-bold flex items-center gap-3",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    Seleccionar Producto Fuente (Materia Prima)
                  </h2>

                  {/* Warehouse Selection */}
                  <div>
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
                  <div>
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
                                {product.sku} | {formatCurrency(product.costPrice)}/{product.unitOfMeasure || 'unidad'}
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
                      'p-4 rounded-xl border',
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
                            SKU: {formData.sourceProduct.sku || 'N/A'} | Costo: {formatCurrency(formData.sourceProduct.costPrice)}/{formData.sourceProduct.unitOfMeasure || 'unidad'}
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
                    <p className="text-red-500 text-sm">{errors.sourceProduct}</p>
                  )}

                  {/* Quantity and Cost Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Cantidad a usar
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder="Ej: 1"
                        value={formData.sourceQuantity || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          sourceQuantity: parseFloat(e.target.value) || 1
                        }))}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20'
                        )}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.sourceProduct?.unitOfMeasure || 'unidades'}
                      </p>
                    </div>
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Costo unitario
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ej: 50.00"
                          value={formData.sourceUnitCost || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            sourceUnitCost: parseFloat(e.target.value) || 0
                          }))}
                          className={cn(
                            'w-full pl-8 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        por {formData.sourceProduct?.unitOfMeasure || 'unidad'}
                      </p>
                    </div>
                  </div>

                  {/* Weight Input - Solo para control de porciones */}
                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-2',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Peso bruto total (kg)
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
                          'w-full pl-10 pr-16 py-4 rounded-xl border text-2xl font-bold focus:outline-none focus:ring-2',
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
                    <p className="text-xs text-gray-500 mt-1">
                      El peso se usa para calcular la cantidad de porciones posibles
                    </p>
                  </div>

                  {/* Cost Summary - basado en CANTIDAD, no peso */}
                  {formData.sourceQuantity > 0 && formData.sourceUnitCost > 0 && (
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <div className="flex justify-between items-center">
                        <span className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Costo materia prima ({formData.sourceQuantity} × {formatCurrency(formData.sourceUnitCost)})
                        </span>
                        <span className={cn(
                          'text-lg font-bold',
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                        )}>
                          {formatCurrency(rawMaterialCost)}
                        </span>
                      </div>
                      {formData.sourceWeightKg > 0 && formData.targetPortionWeightKg > 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          Porciones máximas posibles: {maxPortions} × {formData.targetPortionWeightKg.toFixed(3)} kg
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 2: Materials */}
              {currentStep === 'materials' && (
                <motion.div
                  key="materials"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <h2 className={cn(
                    "text-xl font-bold flex items-center gap-3",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Boxes className="w-5 h-5 text-white" />
                    </div>
                    Materiales a Usar (Opcional)
                  </h2>

                  <p className={cn(
                    'text-sm',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Agregue bolsas, etiquetas u otros materiales necesarios para la producción.
                  </p>

                  {/* Material Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar material por nombre o SKU..."
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

                  {/* Material Search Results */}
                  {materialProducts.length > 0 && (
                    <div className={cn(
                      'rounded-xl border max-h-48 overflow-y-auto',
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
                              {product.sku} | {formatCurrency(product.costPrice)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected Materials */}
                  {formData.materials.length > 0 && (
                    <div className="space-y-3">
                      {formData.materials.map((material, index) => (
                        <div
                          key={material.productId}
                          className={cn(
                            'p-4 rounded-xl border flex items-center gap-4',
                            theme === 'dark'
                              ? 'bg-gray-800/50 border-gray-700'
                              : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          {material.productImage ? (
                            <img
                              src={material.productImage}
                              alt={material.productName}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className={cn(
                              'w-12 h-12 rounded-lg flex items-center justify-center',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                            )}>
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
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
                                'w-8 h-8 rounded-lg flex items-center justify-center',
                                theme === 'dark'
                                  ? 'bg-gray-700 hover:bg-gray-600'
                                  : 'bg-gray-200 hover:bg-gray-300'
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
                                'w-8 h-8 rounded-lg flex items-center justify-center',
                                theme === 'dark'
                                  ? 'bg-gray-700 hover:bg-gray-600'
                                  : 'bg-gray-200 hover:bg-gray-300'
                              )}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <p className={cn(
                            'w-20 text-right font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
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
                        'p-4 rounded-xl border flex justify-between items-center',
                        theme === 'dark'
                          ? 'bg-emerald-900/20 border-emerald-800'
                          : 'bg-emerald-50 border-emerald-200'
                      )}>
                        <span className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                        )}>
                          Total Materiales
                        </span>
                        <span className={cn(
                          'text-xl font-bold',
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                        )}>
                          {formatCurrency(materialsCost)}
                        </span>
                      </div>
                    </div>
                  )}

                  {formData.materials.length === 0 && (
                    <div className={cn(
                      'p-8 rounded-xl border-2 border-dashed text-center',
                      theme === 'dark'
                        ? 'border-gray-700 text-gray-500'
                        : 'border-gray-300 text-gray-400'
                    )}>
                      <Boxes className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay materiales agregados</p>
                      <p className="text-sm">Busca y agrega materiales usando el campo de arriba</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Target Product */}
              {currentStep === 'target' && (
                <motion.div
                  key="target"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <h2 className={cn(
                    "text-xl font-bold flex items-center gap-3",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                      <Scale className="w-5 h-5 text-white" />
                    </div>
                    Producto Final (A Manufacturar)
                  </h2>

                  {/* Target Warehouse Selection */}
                  <div>
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
                  <div>
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
                      'p-4 rounded-xl border',
                      theme === 'dark'
                        ? 'bg-purple-900/20 border-purple-800'
                        : 'bg-purple-50 border-purple-200'
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
                    <p className="text-red-500 text-sm">{errors.targetProduct}</p>
                  )}

                  {/* Portion Weight & Quantity */}
                  <div className="grid grid-cols-2 gap-4">
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
                        'font-semibold mb-3 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Calculator className="w-5 h-5" />
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
                </motion.div>
              )}

              {/* Step 4: Summary */}
              {currentStep === 'summary' && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <h2 className={cn(
                    "text-xl font-bold flex items-center gap-3",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                      <ClipboardCheck className="w-5 h-5 text-white" />
                    </div>
                    Resumen de la Orden
                  </h2>

                  {/* Source → Target */}
                  <div className="flex items-center gap-4">
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
                      <p className={cn(
                        'text-lg font-bold',
                        theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                      )}>
                        {formData.sourceWeightKg.toFixed(3)} kg
                      </p>
                    </div>

                    <ArrowRight className={cn(
                      'w-8 h-8',
                      theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                    )} />

                    <div className={cn(
                      'flex-1 p-4 rounded-xl border',
                      theme === 'dark'
                        ? 'bg-gray-700/50 border-gray-600'
                        : 'bg-gray-50 border-gray-200'
                    )}>
                      <p className="text-xs text-gray-500 mb-1">PRODUCTO FINAL</p>
                      <p className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {formData.targetProduct?.name}
                      </p>
                      <p className={cn(
                        'text-lg font-bold',
                        theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                      )}>
                        {formData.targetQuantity} × {formData.targetPortionWeightKg.toFixed(3)} kg
                      </p>
                    </div>
                  </div>

                  {/* Waste/Surplus Indicator */}
                  <div className={cn(
                    'p-4 rounded-xl border text-center',
                    wasteSurplusType === 'waste'
                      ? theme === 'dark'
                        ? 'bg-red-900/30 border-red-800'
                        : 'bg-red-100 border-red-300'
                      : wasteSurplusType === 'surplus'
                        ? theme === 'dark'
                          ? 'bg-green-900/30 border-green-800'
                          : 'bg-green-100 border-green-300'
                        : theme === 'dark'
                          ? 'bg-gray-700 border-gray-600'
                          : 'bg-gray-100 border-gray-300'
                  )}>
                    <p className={cn(
                      'text-sm font-medium mb-1',
                      wasteSurplusType === 'waste' ? 'text-red-600' :
                      wasteSurplusType === 'surplus' ? 'text-green-600' :
                      'text-gray-600'
                    )}>
                      {wasteSurplusType === 'waste' ? 'MERMA ESPERADA' :
                       wasteSurplusType === 'surplus' ? 'SOBRANTE ESPERADO' : 'PESO EXACTO'}
                    </p>
                    <p className={cn(
                      'text-2xl font-bold flex items-center justify-center gap-2',
                      wasteSurplusType === 'waste' ? 'text-red-600' :
                      wasteSurplusType === 'surplus' ? 'text-green-600' :
                      'text-gray-600'
                    )}>
                      {wasteSurplusType === 'waste' && <AlertTriangle className="w-6 h-6" />}
                      {wasteSurplusType === 'surplus' && <CheckCircle className="w-6 h-6" />}
                      {wasteSurplusType === 'waste' ? '-' : wasteSurplusType === 'surplus' ? '+' : ''}
                      {Math.abs(wasteSurplusKg).toFixed(3)} kg
                    </p>
                  </div>

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
                          Materia prima ({formData.sourceQuantity} {formData.sourceProduct?.unitOfMeasure || 'unidad(es)'} × {formatCurrency(formData.sourceUnitCost)})
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
                      <div className="flex justify-between items-center">
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
                  <div>
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

                  {errors.submit && (
                    <div className="p-4 rounded-xl bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                      <p className="text-red-600 text-sm">{errors.submit}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={goToPrevStep}
              disabled={currentStepIndex === 0}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white shadow-lg'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900 shadow-md'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
              Anterior
            </motion.button>

            {currentStep === 'summary' ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={submitting}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-400/30',
                  'text-white'
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
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  theme === 'dark'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-400/30',
                  'text-white'
                )}
              >
                Siguiente
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Cancel Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCancelModal(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className={cn(
                    "w-full max-w-md rounded-2xl shadow-2xl border",
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                        theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                      )}>
                        <X className={cn(
                          "w-6 h-6",
                          theme === 'dark' ? 'text-red-400' : 'text-red-600'
                        )} />
                      </div>
                      <div className="flex-1">
                        <h3 className={cn(
                          "text-xl font-bold mb-2",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          ¿Cancelar orden?
                        </h3>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Se perdera toda la informacion ingresada y no podras recuperarla.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    "flex gap-3 p-6 pt-4 border-t",
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCancelModal(false)}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                        theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      )}
                    >
                      Continuar editando
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => router.push('/dashboard/market/production/dosification')}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                        theme === 'dark'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-red-500 hover:bg-red-600'
                      )}
                    >
                      Si, cancelar
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </ProtectedRoute>
  )
}
