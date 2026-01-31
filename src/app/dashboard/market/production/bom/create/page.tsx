'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Settings,
  Boxes,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
  AlertCircle,
  X,
  Plus,
  Trash2,
  Check,
  Percent,
  Calculator,
  Sparkles
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  costPrice: number
  sellingPrice: number
  imageUrl: string | null
  unitOfMeasure: string
  hasVariants: boolean
  variants?: ProductVariant[]
}

interface ProductVariant {
  id: number
  variantName: string
  sku: string
  costPrice: number
  sellingPrice: number
}

interface BOMLine {
  id: string
  productId: number | null
  variantId: number | null
  productName: string
  productSku: string
  productImage: string | null
  productCostPrice: number
  quantityRequired: number
  unit: string
  isPrimary: boolean
  lineCost: number
}

const STEPS = [
  { id: 'product', title: 'Producto', icon: Package },
  { id: 'details', title: 'Configuración', icon: Settings },
  { id: 'materials', title: 'Materiales', icon: Boxes },
  { id: 'confirm', title: 'Confirmación', icon: CheckCircle }
]

const UNITS = [
  { value: 'unidad', label: 'Unidad', abbr: 'ud' },
  { value: 'kg', label: 'Kilogramo', abbr: 'kg' },
  { value: 'g', label: 'Gramo', abbr: 'g' },
  { value: 'lb', label: 'Libra', abbr: 'lb' },
  { value: 'lt', label: 'Litro', abbr: 'lt' },
  { value: 'ml', label: 'Mililitro', abbr: 'ml' }
]

export default function CreateBOMPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const outputSearchRef = useRef<HTMLDivElement>(null)
  const materialSearchRef = useRef<HTMLDivElement>(null)

  const [currentStep, setCurrentStep] = useState<string>('product')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Form state
  const [bomName, setBomName] = useState('')
  const [outputProduct, setOutputProduct] = useState<Product | null>(null)
  const [outputVariant, setOutputVariant] = useState<ProductVariant | null>(null)
  const [outputQuantity, setOutputQuantity] = useState<number>(1)
  const [outputUnit, setOutputUnit] = useState('unidad')
  const [expectedWastePercent, setExpectedWastePercent] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<BOMLine[]>([])

  // Search state
  const [productSearchOutput, setProductSearchOutput] = useState('')
  const [productSearchLine, setProductSearchLine] = useState('')
  const [searchResultsOutput, setSearchResultsOutput] = useState<Product[]>([])
  const [searchResultsLine, setSearchResultsLine] = useState<Product[]>([])
  const [searchingOutput, setSearchingOutput] = useState(false)
  const [searchingLine, setSearchingLine] = useState(false)
  const [showOutputDropdown, setShowOutputDropdown] = useState(false)
  const [showLineDropdown, setShowLineDropdown] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Calculate totals
  const totalMaterialCost = lines.reduce((sum, line) => sum + line.lineCost, 0)
  const unitCost = outputQuantity > 0 ? totalMaterialCost / outputQuantity : 0
  const wasteAmount = (totalMaterialCost * expectedWastePercent) / 100
  const effectiveUnitCost = outputQuantity > 0 ? (totalMaterialCost + wasteAmount) / outputQuantity : 0

  // Search products
  const searchProducts = async (term: string, forOutput: boolean) => {
    if (term.length < 2) {
      if (forOutput) setSearchResultsOutput([])
      else setSearchResultsLine([])
      return
    }

    try {
      if (forOutput) setSearchingOutput(true)
      else setSearchingLine(true)

      const response = await fetch(`/api/market/products?search=${encodeURIComponent(term)}&limit=10`)
      const data = await response.json()

      if (data.success) {
        const products = (data.data.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          costPrice: p.costPrice || 0,
          sellingPrice: p.sellingPrice || 0,
          imageUrl: p.imageUrl,
          unitOfMeasure: p.unitOfMeasure || 'unidad',
          hasVariants: p.hasVariants || false,
          variants: p.variants?.map((v: any) => ({
            id: v.id,
            variantName: v.name,
            sku: v.sku,
            costPrice: v.costPrice || 0,
            sellingPrice: v.price || 0
          }))
        }))

        if (forOutput) setSearchResultsOutput(products)
        else setSearchResultsLine(products)
      }
    } catch (err) {
      console.error('Error searching products:', err)
    } finally {
      if (forOutput) setSearchingOutput(false)
      else setSearchingLine(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearchOutput) searchProducts(productSearchOutput, true)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearchOutput])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearchLine) searchProducts(productSearchLine, false)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearchLine])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (outputSearchRef.current && !outputSearchRef.current.contains(e.target as Node)) {
        setShowOutputDropdown(false)
      }
      if (materialSearchRef.current && !materialSearchRef.current.contains(e.target as Node)) {
        setShowLineDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectOutputProduct = (product: Product, variant?: ProductVariant) => {
    setOutputProduct(product)
    setOutputVariant(variant || null)
    setOutputUnit(product.unitOfMeasure || 'unidad')
    setProductSearchOutput('')
    setSearchResultsOutput([])
    setShowOutputDropdown(false)

    if (!bomName) {
      setBomName(`Producción de ${variant?.variantName || product.name}`)
    }
  }

  const addMaterialLine = (product: Product, variant?: ProductVariant) => {
    const costPrice = variant?.costPrice || product.costPrice || 0
    const newLine: BOMLine = {
      id: `line-${Date.now()}`,
      productId: product.id,
      variantId: variant?.id || null,
      productName: variant ? `${product.name} - ${variant.variantName}` : product.name,
      productSku: variant?.sku || product.sku,
      productImage: product.imageUrl,
      productCostPrice: costPrice,
      quantityRequired: 1,
      unit: product.unitOfMeasure || 'unidad',
      isPrimary: lines.length === 0,
      lineCost: costPrice
    }

    setLines([...lines, newLine])
    setProductSearchLine('')
    setSearchResultsLine([])
    setShowLineDropdown(false)
  }

  const updateLine = (index: number, field: keyof BOMLine, value: any) => {
    const updatedLines = [...lines]
    updatedLines[index] = { ...updatedLines[index], [field]: value }

    if (field === 'quantityRequired') {
      updatedLines[index].lineCost = updatedLines[index].productCostPrice * value
    }

    setLines(updatedLines)
  }

  const removeLine = (index: number) => {
    const updatedLines = lines.filter((_, i) => i !== index)
    if (lines[index].isPrimary && updatedLines.length > 0) {
      updatedLines[0].isPrimary = true
    }
    setLines(updatedLines)
  }

  const setPrimaryLine = (index: number) => {
    const updatedLines = lines.map((line, i) => ({ ...line, isPrimary: i === index }))
    setLines(updatedLines)
  }

  const validateStep = (step: string): boolean => {
    setError('')

    switch (step) {
      case 'product':
        if (!outputProduct) {
          setError('Selecciona el producto que vas a fabricar')
          return false
        }
        return true

      case 'details':
        if (!bomName.trim()) {
          setError('Ingresa un nombre para la receta')
          return false
        }
        if (outputQuantity <= 0) {
          setError('La cantidad producida debe ser mayor a 0')
          return false
        }
        return true

      case 'materials':
        if (lines.length === 0) {
          setError('Agrega al menos una materia prima')
          return false
        }
        return true

      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) {
        setCurrentStep(STEPS[nextIndex].id)
      }
    }
  }

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
    setError('')
  }

  const saveRecipe = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/market/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: outputProduct!.id,
          variantId: outputVariant?.id || null,
          bomName: bomName.trim(),
          outputQuantity,
          outputUnit,
          expectedWastePercent,
          notes: notes.trim() || null,
          lines: lines.map(line => ({
            productId: line.productId,
            variantId: line.variantId,
            quantityRequired: line.quantityRequired,
            unit: line.unit,
            isPrimary: line.isPrimary
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push('/dashboard/market/production/bom')
      } else {
        setError(data.error || 'Error al crear receta')
      }
    } catch (err) {
      console.error('Error creating BOM:', err)
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount)
  }

  return (
    <div className={cn(
      "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 relative">
        {/* Close Button */}
        <motion.button
          onClick={() => setShowCancelModal(true)}
          className={cn(
            "absolute -top-2 right-0 sm:right-0 p-2 rounded-full transition-colors z-10",
            theme === 'dark'
              ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              : 'bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-100 shadow-sm'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Header */}
        <div className="text-center">
          <h1 className={cn(
            "text-2xl sm:text-3xl lg:text-4xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Nueva Receta de Fabricación
          </h1>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Define los materiales necesarios para fabricar un producto
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStepIndex > index

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className="relative w-14 h-14">
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-purple-500"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0, 0.5]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}
                    <motion.div
                      className={cn(
                        "relative w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-purple-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-500'
                              : 'bg-gray-200 text-gray-500'
                      )}
                      animate={{
                        scale: isActive ? 1 : 0.9,
                        backgroundColor: isCompleted
                          ? '#22c55e'
                          : isActive
                            ? '#9333ea'
                            : theme === 'dark'
                              ? '#1f2937'
                              : '#e5e7eb'
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </motion.div>
                  </div>
                  <span className={cn(
                    "text-xs mt-2 hidden sm:block text-center font-medium",
                    isActive
                      ? 'text-purple-600'
                      : isCompleted
                        ? 'text-green-600'
                        : theme === 'dark'
                          ? 'text-gray-500'
                          : 'text-gray-400'
                  )}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="relative w-8 sm:w-16 lg:w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: currentStepIndex > index ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content */}
        <div className={cn(
          "rounded-2xl shadow-lg p-6",
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}>
          <AnimatePresence mode="wait">
            {/* Step 1: Product Selection */}
            {currentStep === 'product' && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className={cn(
                  "text-xl font-bold mb-6",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Seleccionar Producto a Fabricar
                </h2>

                {outputProduct ? (
                  <div className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border-2 border-purple-500/50",
                    theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'
                  )}>
                    {outputProduct.imageUrl ? (
                      <img src={outputProduct.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover" />
                    ) : (
                      <div className={cn(
                        "w-20 h-20 rounded-xl flex items-center justify-center",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        <Package className="w-10 h-10 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-semibold text-lg truncate",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {outputVariant ? `${outputProduct.name} - ${outputVariant.variantName}` : outputProduct.name}
                      </p>
                      <p className="text-sm text-gray-500">SKU: {outputVariant?.sku || outputProduct.sku}</p>
                      <p className="text-sm text-purple-500 font-medium">
                        {formatCurrency(outputVariant?.costPrice || outputProduct.costPrice)} costo actual
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOutputProduct(null)
                        setOutputVariant(null)
                      }}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div ref={outputSearchRef} className="relative">
                    <div className="relative">
                      <Search className={cn(
                        "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )} />
                      <input
                        type="text"
                        value={productSearchOutput}
                        onChange={(e) => {
                          setProductSearchOutput(e.target.value)
                          setShowOutputDropdown(true)
                        }}
                        onFocus={() => setShowOutputDropdown(true)}
                        placeholder="Buscar producto por nombre o SKU..."
                        className={cn(
                          "w-full pl-12 pr-4 py-4 rounded-xl border-2 transition-all text-lg",
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500 focus:border-purple-500'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500'
                        )}
                      />
                      {searchingOutput && (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-purple-500" />
                      )}
                    </div>

                    <AnimatePresence>
                      {showOutputDropdown && searchResultsOutput.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className={cn(
                            "absolute z-50 w-full mt-2 max-h-80 overflow-auto rounded-xl border shadow-2xl",
                            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                          )}
                        >
                          {searchResultsOutput.map((product) => (
                            <div key={product.id}>
                              {product.hasVariants && product.variants ? (
                                product.variants.map((variant) => (
                                  <button
                                    key={variant.id}
                                    type="button"
                                    onClick={() => selectOutputProduct(product, variant)}
                                    className={cn(
                                      "w-full flex items-center gap-4 p-4 text-left transition-colors",
                                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                    )}
                                  >
                                    {product.imageUrl ? (
                                      <img src={product.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                    ) : (
                                      <div className={cn(
                                        "w-12 h-12 rounded-lg flex items-center justify-center",
                                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                      )}>
                                        <Package className="w-6 h-6 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="flex-1">
                                      <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                        {product.name} - {variant.variantName}
                                      </p>
                                      <p className="text-sm text-gray-500">{variant.sku} &bull; {formatCurrency(variant.costPrice)}</p>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => selectOutputProduct(product)}
                                  className={cn(
                                    "w-full flex items-center gap-4 p-4 text-left transition-colors",
                                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                  )}
                                >
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                  ) : (
                                    <div className={cn(
                                      "w-12 h-12 rounded-lg flex items-center justify-center",
                                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                    )}>
                                      <Package className="w-6 h-6 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                      {product.name}
                                    </p>
                                    <p className="text-sm text-gray-500">{product.sku} &bull; {formatCurrency(product.costPrice)}</p>
                                  </div>
                                </button>
                              )}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )}>
                  Busca y selecciona el producto terminado que resultará de esta receta de fabricación.
                </p>
              </motion.div>
            )}

            {/* Step 2: Recipe Details */}
            {currentStep === 'details' && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className={cn(
                  "text-xl font-bold mb-6",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Configuración de la Receta
                </h2>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Nombre de la receta *
                  </label>
                  <input
                    type="text"
                    value={bomName}
                    onChange={(e) => setBomName(e.target.value)}
                    placeholder="Ej: Empaque de Frijoles 3kg"
                    className={cn(
                      "w-full px-4 py-3 border rounded-xl",
                      theme === 'dark'
                        ? 'border-gray-700 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-900'
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Cantidad que produce *
                    </label>
                    <input
                      type="number"
                      value={outputQuantity}
                      onChange={(e) => setOutputQuantity(parseFloat(e.target.value) || 0)}
                      min="0.001"
                      step="0.001"
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl text-lg font-bold text-center",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    />
                    <p className={cn(
                      "text-xs mt-1",
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      Cuántas unidades produce esta receta
                    </p>
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Unidad de medida
                    </label>
                    <select
                      value={outputUnit}
                      onChange={(e) => setOutputUnit(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    >
                      {UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={cn(
                    "flex items-center gap-2 text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    <Percent className="w-4 h-4" />
                    Merma esperada (%)
                  </label>
                  <input
                    type="number"
                    value={expectedWastePercent}
                    onChange={(e) => setExpectedWastePercent(parseFloat(e.target.value) || 0)}
                    min="0"
                    max="100"
                    step="0.1"
                    className={cn(
                      "w-full px-4 py-3 border rounded-xl",
                      theme === 'dark'
                        ? 'border-gray-700 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-900'
                    )}
                  />
                  <p className={cn(
                    "text-xs mt-1",
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    Porcentaje de pérdida esperada en el proceso
                  </p>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Notas (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Instrucciones o notas adicionales..."
                    className={cn(
                      "w-full px-4 py-3 border rounded-xl resize-none",
                      theme === 'dark'
                        ? 'border-gray-700 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-900'
                    )}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3: Materials */}
            {currentStep === 'materials' && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Materias Primas
                  </h2>
                  <span className={cn(
                    "text-sm font-medium px-3 py-1 rounded-full",
                    lines.length > 0
                      ? 'bg-purple-500/20 text-purple-500'
                      : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                  )}>
                    {lines.length} material{lines.length !== 1 ? 'es' : ''}
                  </span>
                </div>

                {/* Add Material Search */}
                <div ref={materialSearchRef} className="relative">
                  <div className="relative">
                    <Plus className={cn(
                      "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )} />
                    <input
                      type="text"
                      value={productSearchLine}
                      onChange={(e) => {
                        setProductSearchLine(e.target.value)
                        setShowLineDropdown(true)
                      }}
                      onFocus={() => setShowLineDropdown(true)}
                      placeholder="Agregar materia prima..."
                      className={cn(
                        "w-full pl-12 pr-4 py-3 rounded-xl border-2 border-dashed transition-all",
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white placeholder-gray-500 focus:border-purple-500 focus:bg-gray-900'
                          : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:bg-white'
                      )}
                    />
                    {searchingLine && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-purple-500" />
                    )}
                  </div>

                  <AnimatePresence>
                    {showLineDropdown && searchResultsLine.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                          "absolute z-50 w-full mt-2 max-h-64 overflow-auto rounded-xl border shadow-2xl",
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        {searchResultsLine.map((product) => (
                          <div key={product.id}>
                            {product.hasVariants && product.variants ? (
                              product.variants.map((variant) => (
                                <button
                                  key={variant.id}
                                  type="button"
                                  onClick={() => addMaterialLine(product, variant)}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-3 text-left transition-colors",
                                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                  )}
                                >
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn("font-medium truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                      {product.name} - {variant.variantName}
                                    </p>
                                    <p className="text-xs text-gray-500">{formatCurrency(variant.costPrice)}</p>
                                  </div>
                                  <Plus className="w-5 h-5 text-purple-500" />
                                </button>
                              ))
                            ) : (
                              <button
                                type="button"
                                onClick={() => addMaterialLine(product)}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 text-left transition-colors",
                                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                )}
                              >
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                ) : (
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={cn("font-medium truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-gray-500">{formatCurrency(product.costPrice)}</p>
                                </div>
                                <Plus className="w-5 h-5 text-purple-500" />
                              </button>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Materials List */}
                {lines.length === 0 ? (
                  <div className={cn(
                    "text-center py-12 border-2 border-dashed rounded-xl",
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <Boxes className={cn("w-12 h-12 mx-auto mb-3", theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
                    <p className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                      Busca y agrega las materias primas necesarias
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {lines.map((line, index) => (
                        <motion.div
                          key={line.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl transition-all",
                            line.isPrimary
                              ? theme === 'dark'
                                ? 'bg-purple-900/30 border border-purple-700/50'
                                : 'bg-purple-50 border border-purple-200'
                              : theme === 'dark'
                                ? 'bg-gray-900/50 border border-gray-700'
                                : 'bg-gray-50 border border-gray-200'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setPrimaryLine(index)}
                            className={cn(
                              "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                              line.isPrimary
                                ? 'border-purple-500 bg-purple-500 text-white'
                                : theme === 'dark'
                                  ? 'border-gray-600 hover:border-purple-500'
                                  : 'border-gray-300 hover:border-purple-500'
                            )}
                            title={line.isPrimary ? 'Material principal' : 'Marcar como principal'}
                          >
                            {line.isPrimary && <Check className="w-3 h-3" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className={cn("font-medium text-sm truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {line.productName}
                            </p>
                            <p className="text-xs text-gray-500">{formatCurrency(line.productCostPrice)} / {line.unit}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={line.quantityRequired}
                              onChange={(e) => updateLine(index, 'quantityRequired', parseFloat(e.target.value) || 0)}
                              min="0.001"
                              step="0.001"
                              className={cn(
                                "w-20 px-2 py-1.5 rounded-lg border text-sm text-center font-medium",
                                theme === 'dark'
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              )}
                            />
                            <select
                              value={line.unit}
                              onChange={(e) => updateLine(index, 'unit', e.target.value)}
                              className={cn(
                                "px-2 py-1.5 rounded-lg border text-sm",
                                theme === 'dark'
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              )}
                            >
                              {UNITS.map((u) => (
                                <option key={u.value} value={u.value}>{u.abbr}</option>
                              ))}
                            </select>
                          </div>

                          <div className="w-24 text-right">
                            <p className={cn("font-bold text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {formatCurrency(line.lineCost)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="flex-shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Confirmation */}
            {currentStep === 'confirm' && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className={cn(
                  "text-xl font-bold mb-6",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Confirmar Receta
                </h2>

                {/* Product Summary */}
                <div className={cn("rounded-xl p-4", theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50')}>
                  <h3 className={cn("font-medium mb-3 flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <Package className="w-5 h-5 text-purple-600" />
                    Producto a Fabricar
                  </h3>
                  <div className="flex items-center gap-4">
                    {outputProduct?.imageUrl ? (
                      <img src={outputProduct.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className={cn("w-16 h-16 rounded-lg flex items-center justify-center", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {outputVariant ? `${outputProduct?.name} - ${outputVariant.variantName}` : outputProduct?.name}
                      </p>
                      <p className="text-sm text-gray-500">Receta: {bomName}</p>
                      <p className="text-sm text-gray-500">Produce: {outputQuantity} {UNITS.find(u => u.value === outputUnit)?.label}</p>
                    </div>
                  </div>
                </div>

                {/* Materials Summary */}
                <div className={cn("rounded-xl p-4", theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50')}>
                  <h3 className={cn("font-medium mb-3 flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <Boxes className="w-5 h-5 text-purple-600" />
                    Materiales ({lines.length})
                  </h3>
                  <div className="space-y-2">
                    {lines.map((line) => (
                      <div key={line.id} className="flex items-center justify-between text-sm">
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                          {line.productName}
                        </span>
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                          {line.quantityRequired} {line.unit} = {formatCurrency(line.lineCost)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cost Summary */}
                <div className={cn(
                  "rounded-xl p-4 border-2",
                  theme === 'dark' ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
                )}>
                  <h3 className={cn("font-medium mb-3 flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <Calculator className="w-5 h-5 text-emerald-600" />
                    Resumen de Costos
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Total materiales</p>
                      <p className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(totalMaterialCost)}
                      </p>
                    </div>
                    {expectedWastePercent > 0 && (
                      <div>
                        <p className="text-amber-600">Merma ({expectedWastePercent}%)</p>
                        <p className="text-lg font-bold text-amber-600">+{formatCurrency(wasteAmount)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500">Producción</p>
                      <p className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {outputQuantity} {UNITS.find(u => u.value === outputUnit)?.abbr}
                      </p>
                    </div>
                    <div>
                      <p className="text-emerald-600 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Costo unitario
                      </p>
                      <p className="text-xl font-bold text-emerald-600">
                        {formatCurrency(expectedWastePercent > 0 ? effectiveUnitCost : unitCost)}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className={cn(
            "flex items-center justify-between mt-8 pt-6 border-t",
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <motion.button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors",
                currentStepIndex === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-600 hover:bg-gray-100'
              )}
              whileHover={currentStepIndex > 0 ? { scale: 1.02 } : {}}
              whileTap={currentStepIndex > 0 ? { scale: 0.98 } : {}}
            >
              <ArrowLeft className="w-5 h-5" />
              Anterior
            </motion.button>

            {currentStepIndex < STEPS.length - 1 ? (
              <motion.button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Siguiente
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button
                onClick={saveRecipe}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                whileHover={!saving ? { scale: 1.02 } : {}}
                whileTap={!saving ? { scale: 0.98 } : {}}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Crear Receta
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-2xl p-6 max-w-md w-full shadow-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={cn("text-lg font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                ¿Cancelar creación?
              </h3>
              <p className={cn("mb-6", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Perderás todos los datos ingresados. ¿Estás seguro?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Continuar editando
                </button>
                <button
                  onClick={() => router.push('/dashboard/market/production/bom')}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                >
                  Sí, cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
