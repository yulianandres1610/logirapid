'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical,
  ArrowLeft,
  Package,
  Plus,
  Trash2,
  Search,
  X,
  Save,
  RefreshCw,
  AlertCircle,
  DollarSign,
  Layers,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Target,
  Calculator,
  FileCheck,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  imageUrl: string | null
  unitOfMeasure: string
  costPrice: number
  sellingPrice: number
  quantityOnHand: number
  category: string | null
}

interface FormulaLine {
  rawMaterialId: number
  materialName: string
  materialSku: string | null
  materialUnit: string
  materialCost: number
  materialStock: number
  quantity: number
  isCritical: boolean
  notes: string
}

type Step = 'product' | 'materials' | 'costs' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'product', title: 'Producto', description: 'Producto final', icon: Target },
  { id: 'materials', title: 'Materiales', description: 'Materias primas', icon: Layers },
  { id: 'costs', title: 'Costos', description: 'Rendimiento', icon: Calculator },
  { id: 'review', title: 'Revisar', description: 'Confirmar', icon: FileCheck }
]

export default function CreateFormulaPage() {
  const router = useRouter()
  const { theme } = useTheme()

  const [currentStep, setCurrentStep] = useState<Step>('product')
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const [name, setName] = useState('')
  const [targetProductId, setTargetProductId] = useState<number | null>(null)
  const [targetProduct, setTargetProduct] = useState<Product | null>(null)
  const [yieldQuantity, setYieldQuantity] = useState<number>(1)
  const [yieldUnit, setYieldUnit] = useState('unidad')
  const [laborCostPerBatch, setLaborCostPerBatch] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<FormulaLine[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (productSearch.length >= 2) {
        searchProducts()
      } else {
        setProducts([])
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [productSearch])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  const searchProducts = async () => {
    setLoadingProducts(true)
    try {
      const response = await fetch(`/api/market/products?search=${encodeURIComponent(productSearch)}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setProducts(data.data.products || [])
        }
      }
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const selectTargetProduct = (product: Product) => {
    setTargetProductId(product.id)
    setTargetProduct(product)
    setYieldUnit(product.unitOfMeasure || 'unidad')
    if (!name) setName(`Fórmula - ${product.name}`)
    setProductSearch('')
    setProducts([])
  }

  const addMaterial = (product: Product) => {
    if (lines.some(l => l.rawMaterialId === product.id)) {
      setError('Este material ya está en la fórmula')
      setTimeout(() => setError(null), 3000)
      return
    }
    if (product.id === targetProductId) {
      setError('No puedes agregar el producto final como materia prima')
      setTimeout(() => setError(null), 3000)
      return
    }
    setLines([...lines, {
      rawMaterialId: product.id,
      materialName: product.name,
      materialSku: product.sku,
      materialUnit: product.unitOfMeasure || 'unidad',
      materialCost: product.costPrice,
      materialStock: product.quantityOnHand,
      quantity: 1,
      isCritical: true,
      notes: ''
    }])
    setProductSearch('')
    setProducts([])
    setSuccess('Material agregado')
  }

  const updateLineQuantity = (index: number, quantity: number) => {
    const newLines = [...lines]
    newLines[index].quantity = quantity
    setLines(newLines)
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    const materialsCost = lines.reduce((sum, line) => sum + (line.quantity * line.materialCost), 0)
    const totalCost = materialsCost + laborCostPerBatch
    const costPerUnit = yieldQuantity > 0 ? totalCost / yieldQuantity : 0
    return { materialsCost, totalCost, costPerUnit }
  }

  const validateStep = (step: Step): boolean => {
    setError(null)
    switch (step) {
      case 'product':
        if (!targetProductId || !targetProduct) { setError('Selecciona el producto final'); return false }
        if (!name.trim()) { setError('Ingresa un nombre para la fórmula'); return false }
        return true
      case 'materials':
        if (lines.length === 0) { setError('Agrega al menos una materia prima'); return false }
        return true
      case 'costs':
        if (yieldQuantity <= 0) { setError('El rendimiento debe ser mayor a 0'); return false }
        return true
      default:
        return true
    }
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id)
  }

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) { setCurrentStep(STEPS[prevIndex].id); setError(null) }
  }

  const handleSubmit = async () => {
    if (!validateStep('review')) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/market/production/formulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          targetProductId,
          yieldQuantity,
          yieldUnit,
          laborCostPerBatch,
          notes: notes.trim() || null,
          lines: lines.map(l => ({
            rawMaterialId: l.rawMaterialId,
            quantity: l.quantity,
            isCritical: l.isCritical,
            notes: l.notes || null
          }))
        })
      })
      const data = await response.json()
      if (data.success) {
        router.push('/dashboard/market/production/formulas')
      } else {
        setError(data.error || 'Error al crear la fórmula')
      }
    } catch (error) {
      console.error('Error creating formula:', error)
      setError('Error al crear la fórmula')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)
  }

  const totals = calculateTotals()
  const margin = targetProduct && targetProduct.sellingPrice > 0
    ? ((targetProduct.sellingPrice - totals.costPerUnit) / targetProduct.sellingPrice * 100) : 0

  // Step Indicator
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStep
        const isCompleted = index < currentStepIndex
        const StepIcon = step.icon

        return (
          <div key={step.id} className="flex items-center">
            <div
              className="flex flex-col items-center cursor-pointer"
              onClick={() => {
                if (isCompleted || index <= currentStepIndex) setCurrentStep(step.id)
              }}
            >
              <motion.div
                initial={false}
                animate={{ scale: isActive ? 1.1 : 1 }}
                className={cn(
                  'w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all',
                  isCompleted && 'border-purple-600 bg-purple-600',
                  isActive && 'border-purple-600 bg-purple-600',
                  !isCompleted && !isActive && (theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-white')
                )}
              >
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                ) : (
                  <StepIcon className={cn('w-4 h-4 sm:w-5 sm:h-5', isActive ? 'text-white' : 'text-gray-400')} />
                )}
              </motion.div>
              <span className={cn(
                'text-[10px] sm:text-xs mt-2 font-medium text-center',
                isActive ? 'text-purple-600' : 'text-gray-500'
              )}>
                {step.title}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <div className={cn(
                'w-8 sm:w-12 h-0.5 mx-1 sm:mx-2 -mt-5',
                index < currentStepIndex ? 'bg-purple-600' : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )

  // Step 1: Product Selection
  const ProductStep = () => (
    <motion.div
      key="step-product"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
          theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
        )}>
          <Target className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Selecciona el Producto Final
        </h2>
        <p className="text-gray-500 mt-2">
          El producto que se fabricará con esta fórmula
        </p>
      </div>

      {targetProduct ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'p-6 rounded-2xl border-2 border-purple-500',
            theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'
          )}
        >
          <div className="flex items-center gap-4">
            {targetProduct.imageUrl ? (
              <img src={targetProduct.imageUrl} alt={targetProduct.name} className="w-20 h-20 rounded-xl object-cover" />
            ) : (
              <div className={cn('w-20 h-20 rounded-xl flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                <Package className="w-10 h-10 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {targetProduct.name}
              </h3>
              <p className="text-gray-500 text-sm">
                {targetProduct.sku && `SKU: ${targetProduct.sku}`}
              </p>
              <div className="flex gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                <span>Unidad: {targetProduct.unitOfMeasure}</span>
                <span>Precio: {formatCurrency(targetProduct.sellingPrice)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setTargetProductId(null); setTargetProduct(null) }}
              className="p-2 hover:bg-purple-100 dark:hover:bg-purple-800 rounded-xl shrink-0"
            >
              <X className="w-5 h-5 text-purple-600" />
            </button>
          </div>
        </motion.div>
      ) : (
        <div className={cn(
          'p-6 rounded-2xl border-2 border-dashed',
          theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
        )}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar producto por nombre, SKU o código..."
              autoFocus
              className={cn(
                'w-full pl-12 pr-4 py-4 rounded-xl border text-lg',
                theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200',
                'focus:ring-2 focus:ring-purple-500 focus:border-transparent'
              )}
            />
            {loadingProducts && (
              <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
            )}
          </div>

          {products.length > 0 && (
            <div className={cn(
              'mt-4 max-h-64 overflow-auto rounded-xl border',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              {products.map(product => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => selectTargetProduct(product)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 text-left border-b last:border-0',
                    theme === 'dark' ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'
                  )}
                >
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{product.name}</p>
                    <p className="text-sm text-gray-500">
                      {product.sku || product.barcode || 'Sin código'} &middot; {product.unitOfMeasure}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {targetProduct && (
        <div className="space-y-2">
          <label className={cn('block text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            Nombre de la Fórmula *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Pintura Blanca Mate 1GL"
            className={cn(
              'w-full px-4 py-3 rounded-xl border text-lg',
              theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200',
              'focus:ring-2 focus:ring-purple-500 focus:border-transparent'
            )}
          />
        </div>
      )}
    </motion.div>
  )

  // Step 2: Materials
  const MaterialsStep = () => (
    <motion.div
      key="step-materials"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
          theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
        )}>
          <Layers className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Materias Primas
        </h2>
        <p className="text-gray-500 mt-2">
          Agrega los materiales necesarios para producir <span className="font-medium">{targetProduct?.name}</span>
        </p>
      </div>

      {/* Search */}
      <div className={cn(
        'p-4 rounded-2xl border',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Buscar materia prima..."
            className={cn(
              'w-full pl-12 pr-4 py-3 rounded-xl border',
              theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
              'focus:ring-2 focus:ring-purple-500 focus:border-transparent'
            )}
          />
        </div>

        {products.length > 0 && (
          <div className={cn(
            'mt-3 max-h-48 overflow-auto rounded-xl border',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            {products.filter(p => p.id !== targetProductId).map(product => (
              <button
                key={product.id}
                type="button"
                onClick={() => addMaterial(product)}
                disabled={lines.some(l => l.rawMaterialId === product.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 text-left border-b last:border-0',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-100',
                  lines.some(l => l.rawMaterialId === product.id)
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                )}
              >
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{product.name}</p>
                  <p className="text-sm text-gray-500 truncate">
                    {product.unitOfMeasure} &middot; {formatCurrency(product.costPrice)} &middot; Stock: {product.quantityOnHand}
                  </p>
                </div>
                <Plus className="w-5 h-5 text-purple-600 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Materials List */}
      {lines.length === 0 ? (
        <div className={cn(
          'p-8 rounded-2xl border-2 border-dashed text-center',
          theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
        )}>
          <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className={cn('font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No hay materiales agregados</p>
          <p className="text-sm text-gray-400 mt-1">Busca y agrega los materiales necesarios</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {lines.map((line, index) => (
              <motion.div
                key={line.rawMaterialId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className={cn(
                  'p-4 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                {/* Desktop layout */}
                <div className="hidden sm:flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-medium truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {line.materialName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {line.materialUnit} &middot; {formatCurrency(line.materialCost)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLineQuantity(index, parseFloat(e.target.value) || 0)}
                      min="0.0001"
                      step="0.0001"
                      className={cn(
                        'w-24 px-3 py-2 rounded-lg border text-center font-medium',
                        theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                        'focus:ring-2 focus:ring-purple-500'
                      )}
                    />
                    <span className="text-sm text-gray-500 w-12 truncate">{line.materialUnit}</span>
                  </div>
                  <div className="text-right w-24">
                    <p className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {formatCurrency(line.quantity * line.materialCost)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 shrink-0"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile layout */}
                <div className="sm:hidden space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn('font-medium truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {line.materialName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {line.materialUnit} &middot; {formatCurrency(line.materialCost)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLineQuantity(index, parseFloat(e.target.value) || 0)}
                        min="0.0001"
                        step="0.0001"
                        className={cn(
                          'w-20 px-2 py-1.5 rounded-lg border text-center font-medium text-sm',
                          theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                          'focus:ring-2 focus:ring-purple-500'
                        )}
                      />
                      <span className="text-xs text-gray-500">{line.materialUnit}</span>
                    </div>
                    <p className={cn('font-bold text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {formatCurrency(line.quantity * line.materialCost)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className={cn('p-4 rounded-xl', theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50')}>
            <div className="flex justify-between items-center">
              <span className={cn('font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Total materiales ({lines.length})
              </span>
              <span className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {formatCurrency(totals.materialsCost)}
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )

  // Step 3: Costs
  const CostsStep = () => (
    <motion.div
      key="step-costs"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
          theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
        )}>
          <Calculator className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Rendimiento y Costos
        </h2>
        <p className="text-gray-500 mt-2">
          Define cuánto produce la fórmula y costos adicionales
        </p>
      </div>

      <div className={cn(
        'p-6 rounded-2xl border',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Rendimiento por Lote *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={yieldQuantity}
                onChange={(e) => setYieldQuantity(parseFloat(e.target.value) || 0)}
                min="0.001"
                step="0.001"
                className={cn(
                  'flex-1 px-4 py-3 rounded-xl border text-lg font-medium',
                  theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                  'focus:ring-2 focus:ring-purple-500'
                )}
              />
              <input
                type="text"
                value={yieldUnit}
                onChange={(e) => setYieldUnit(e.target.value)}
                className={cn(
                  'w-28 px-4 py-3 rounded-xl border',
                  theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                  'focus:ring-2 focus:ring-purple-500'
                )}
              />
            </div>
            <p className="text-xs text-gray-500">
              Cantidad de {targetProduct?.name} que produce esta fórmula
            </p>
          </div>

          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Costo de Mano de Obra
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="number"
                value={laborCostPerBatch}
                onChange={(e) => setLaborCostPerBatch(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className={cn(
                  'w-full pl-12 pr-4 py-3 rounded-xl border text-lg font-medium',
                  theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                  'focus:ring-2 focus:ring-purple-500'
                )}
              />
            </div>
            <p className="text-xs text-gray-500">
              Costo adicional por cada lote producido
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <label className={cn('block text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Instrucciones o notas adicionales..."
            className={cn(
              'w-full px-4 py-3 rounded-xl border resize-none',
              theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
              'focus:ring-2 focus:ring-purple-500'
            )}
          />
        </div>
      </div>

      {/* Cost Summary */}
      <div className={cn(
        'p-6 rounded-2xl border',
        theme === 'dark' ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-50 border-purple-200'
      )}>
        <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-purple-100' : 'text-purple-900')}>
          Resumen de Costos
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className={cn(theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>Materias primas:</span>
            <span className={cn('font-medium', theme === 'dark' ? 'text-purple-100' : 'text-purple-900')}>
              {formatCurrency(totals.materialsCost)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={cn(theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>Mano de obra:</span>
            <span className={cn('font-medium', theme === 'dark' ? 'text-purple-100' : 'text-purple-900')}>
              {formatCurrency(laborCostPerBatch)}
            </span>
          </div>
          <div className={cn('border-t pt-3', theme === 'dark' ? 'border-purple-700' : 'border-purple-200')}>
            <div className="flex justify-between">
              <span className={cn('font-medium', theme === 'dark' ? 'text-purple-100' : 'text-purple-900')}>Total por lote:</span>
              <span className={cn('font-bold', theme === 'dark' ? 'text-purple-100' : 'text-purple-900')}>
                {formatCurrency(totals.totalCost)}
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className={cn('text-lg font-medium', theme === 'dark' ? 'text-purple-100' : 'text-purple-900')}>
              Costo por unidad:
            </span>
            <span className="text-2xl font-bold text-purple-600">
              {formatCurrency(totals.costPerUnit)}
            </span>
          </div>
          {targetProduct && (
            <div className="text-sm text-purple-600 dark:text-purple-400 text-right">
              Precio venta: {formatCurrency(targetProduct.sellingPrice)} &middot;
              Margen: {margin.toFixed(1)}%
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )

  // Step 4: Review
  const ReviewStep = () => (
    <motion.div
      key="step-review"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
          theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
        )}>
          <FileCheck className="w-8 h-8 text-green-600" />
        </div>
        <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Revisar Fórmula
        </h2>
        <p className="text-gray-500 mt-2">
          Verifica los datos antes de guardar
        </p>
      </div>

      {/* Formula Info */}
      <div className={cn(
        'p-6 rounded-2xl border',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Información de la Fórmula
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Nombre</p>
            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Producto Final</p>
            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{targetProduct?.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Rendimiento</p>
            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{yieldQuantity} {yieldUnit}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Mano de Obra</p>
            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatCurrency(laborCostPerBatch)}</p>
          </div>
        </div>
        {notes && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">Notas</p>
            <p className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{notes}</p>
          </div>
        )}
      </div>

      {/* Materials Summary */}
      <div className={cn(
        'p-6 rounded-2xl border',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Materiales ({lines.length})
        </h3>
        <div className="space-y-2">
          {lines.map(line => (
            <div key={line.rawMaterialId} className={cn(
              'flex justify-between py-2 border-b last:border-0',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
            )}>
              <div>
                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{line.materialName}</p>
                <p className="text-sm text-gray-500">{line.quantity} {line.materialUnit}</p>
              </div>
              <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {formatCurrency(line.quantity * line.materialCost)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Final Cost Summary */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600">
        <div className="grid grid-cols-3 gap-4 text-center text-white">
          <div>
            <p className="text-purple-200 text-sm">Costo Total</p>
            <p className="text-xl sm:text-2xl font-bold">{formatCurrency(totals.totalCost)}</p>
          </div>
          <div>
            <p className="text-purple-200 text-sm">Costo/Unidad</p>
            <p className="text-xl sm:text-2xl font-bold">{formatCurrency(totals.costPerUnit)}</p>
          </div>
          <div>
            <p className="text-purple-200 text-sm">Margen Est.</p>
            <p className="text-xl sm:text-2xl font-bold">
              {targetProduct ? `${margin.toFixed(0)}%` : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )

  const renderStep = () => {
    switch (currentStep) {
      case 'product': return ProductStep()
      case 'materials': return MaterialsStep()
      case 'costs': return CostsStep()
      case 'review': return ReviewStep()
      default: return null
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/dashboard/market/production/formulas"
              className={cn(
                'p-2 rounded-xl border transition-colors',
                theme === 'dark' ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-100'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className={cn('text-2xl font-bold flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <FlaskConical className="w-7 h-7 text-purple-600" />
                Nueva Fórmula
              </h1>
            </div>
          </div>

          {/* Step Indicator */}
          {StepIndicator()}

          {/* Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-red-700 dark:text-red-300">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-center gap-3"
              >
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <p className="text-green-700 dark:text-green-300">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>

          {/* Navigation */}
          <div className={cn(
            'flex justify-between mt-8 pt-6 border-t',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={currentStepIndex === 0}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                currentStepIndex === 0
                  ? 'opacity-50 cursor-not-allowed text-gray-400'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-800'
                    : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
              Anterior
            </button>

            {currentStep === 'review' ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className={cn(
                  'flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all',
                  'bg-green-600 hover:bg-green-700 text-white',
                  saving && 'opacity-50 cursor-not-allowed'
                )}
              >
                {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? 'Guardando...' : 'Guardar Fórmula'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goToNextStep}
                className="flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all bg-purple-600 hover:bg-purple-700 text-white"
              >
                Siguiente
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
