'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Clock,
  Layers,
  Edit,
  Calendar,
  BarChart3,
  TrendingUp,
  Target,
  Loader2,
  CheckCircle,
  Activity,
  Printer,
  History
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { PrintDocumentModal } from '@/components/print/PrintDocumentModal'

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
  id?: number
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

interface Formula {
  id: number
  code: string
  name: string
  targetProductId: number
  targetProductName: string
  targetProductSku: string | null
  targetProductImage: string | null
  targetProductPrice: number
  yieldQuantity: number
  yieldUnit: string
  laborCostPerBatch: number
  estimatedTimeMinutes: number | null
  notes: string | null
  isActive: boolean
  createdAt: string
  usageStats?: {
    totalPlans: number
    completedPlans: number
    totalProduced: number
    lastUsed: string | null
  }
  lines: {
    id: number
    rawMaterialId: number
    materialName: string
    materialSku: string | null
    materialUnit: string
    materialCost: number
    availableStock: number
    quantity: number
    isCritical: boolean
    notes: string | null
  }[]
  history?: { id: number; action: string; changes: any; performedBy: string; performedAt: string }[]
}

export default function FormulaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()

  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true')
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const [formula, setFormula] = useState<Formula | null>(null)
  const [name, setName] = useState('')
  const [targetProductId, setTargetProductId] = useState<number | null>(null)
  const [targetProduct, setTargetProduct] = useState<Product | null>(null)
  const [yieldQuantity, setYieldQuantity] = useState<number>(1)
  const [yieldUnit, setYieldUnit] = useState('unidad')
  const [laborCostPerBatch, setLaborCostPerBatch] = useState<number>(0)
  const [estimatedTimeMinutes, setEstimatedTimeMinutes] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<FormulaLine[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [showProductSearch, setShowProductSearch] = useState<'target' | 'material' | null>(null)

  useEffect(() => {
    fetchFormula()
  }, [resolvedParams.id])

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

  const fetchFormula = async () => {
    try {
      const response = await fetch(`/api/market/production/formulas/${resolvedParams.id}`)
      const data = await response.json()

      if (data.success) {
        const f = data.data
        setFormula(f)
        setName(f.name)
        setTargetProductId(f.targetProductId)
        setTargetProduct({
          id: f.targetProductId,
          name: f.targetProductName,
          sku: f.targetProductSku,
          barcode: null,
          imageUrl: f.targetProductImage,
          unitOfMeasure: f.yieldUnit,
          costPrice: 0,
          sellingPrice: f.targetProductPrice,
          quantityOnHand: 0,
          category: null
        })
        setYieldQuantity(f.yieldQuantity)
        setYieldUnit(f.yieldUnit)
        setLaborCostPerBatch(f.laborCostPerBatch)
        setEstimatedTimeMinutes(f.estimatedTimeMinutes)
        setNotes(f.notes || '')
        setLines(f.lines.map((l: any) => ({
          id: l.id,
          rawMaterialId: l.rawMaterialId,
          materialName: l.materialName,
          materialSku: l.materialSku,
          materialUnit: l.materialUnit,
          materialCost: l.materialCost,
          materialStock: l.availableStock,
          quantity: l.quantity,
          isCritical: l.isCritical,
          notes: l.notes || ''
        })))
      } else {
        setError(data.error || 'Error al cargar la fórmula')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('Error al cargar la fórmula')
    } finally {
      setLoading(false)
    }
  }

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
    setShowProductSearch(null)
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
    setShowProductSearch(null)
    setProductSearch('')
    setProducts([])
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('El nombre es requerido'); return }
    if (!targetProductId) { setError('Selecciona el producto final'); return }
    if (lines.length === 0) { setError('Agrega al menos una materia prima'); return }
    if (yieldQuantity <= 0) { setError('El rendimiento debe ser mayor a 0'); return }

    setSaving(true)
    try {
      const response = await fetch(`/api/market/production/formulas/${resolvedParams.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          targetProductId,
          yieldQuantity,
          yieldUnit,
          laborCostPerBatch,
          estimatedTimeMinutes,
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
        setIsEditing(false)
        fetchFormula()
      } else {
        setError(data.error || 'Error al actualizar la fórmula')
      }
    } catch (error) {
      console.error('Error updating formula:', error)
      setError('Error al actualizar la fórmula')
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    if (formula) {
      setName(formula.name)
      setTargetProductId(formula.targetProductId)
      setTargetProduct({
        id: formula.targetProductId,
        name: formula.targetProductName,
        sku: formula.targetProductSku,
        barcode: null,
        imageUrl: formula.targetProductImage,
        unitOfMeasure: formula.yieldUnit,
        costPrice: 0,
        sellingPrice: formula.targetProductPrice,
        quantityOnHand: 0,
        category: null
      })
      setYieldQuantity(formula.yieldQuantity)
      setYieldUnit(formula.yieldUnit)
      setLaborCostPerBatch(formula.laborCostPerBatch)
      setEstimatedTimeMinutes(formula.estimatedTimeMinutes)
      setNotes(formula.notes || '')
      setLines(formula.lines.map(l => ({
        id: l.id,
        rawMaterialId: l.rawMaterialId,
        materialName: l.materialName,
        materialSku: l.materialSku,
        materialUnit: l.materialUnit,
        materialCost: l.materialCost,
        materialStock: l.availableStock,
        quantity: l.quantity,
        isCritical: l.isCritical,
        notes: l.notes || ''
      })))
    }
    setIsEditing(false)
    setError(null)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const totals = calculateTotals()
  const margin = targetProduct && targetProduct.sellingPrice > 0
    ? ((targetProduct.sellingPrice - totals.costPerUnit) / targetProduct.sellingPrice * 100)
    : 0

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="text-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
              <p className="text-gray-500">Cargando fórmula...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!formula) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6">
            <div className={cn(
              'max-w-xl mx-auto text-center p-8 rounded-2xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-lg'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
              )}>
                <FlaskConical className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Fórmula no encontrada
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de esta fórmula.</p>
              <Link href="/dashboard/market/production/formulas">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver a fórmulas
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header */}
          <div className="max-w-6xl mx-auto mb-8">
            <div className="flex items-center justify-between mb-6">
              <Link href="/dashboard/market/production/formulas">
                <motion.button
                  whileHover={{ scale: 1.02, x: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="font-medium">Volver</span>
                </motion.button>
              </Link>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPrintModal(true)}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-colors',
                    theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Imprimir</span>
                </motion.button>

                {!isEditing ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="hidden sm:inline">Editar</span>
                  </motion.button>
                ) : (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={cancelEdit}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors',
                        theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      Cancelar
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSubmit}
                      disabled={saving}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors',
                        saving && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? 'Guardando...' : 'Guardar'}
                    </motion.button>
                  </>
                )}
              </div>
            </div>

            {/* Hero Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-purple-500 to-violet-600">
                    <FlaskConical className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h1 className={cn(
                        'text-2xl md:text-3xl font-bold font-mono',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {formula.code}
                      </h1>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium',
                        formula.isActive
                          ? theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                          : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                      )}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        {formula.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={cn(
                          'text-sm px-3 py-1.5 rounded-lg border w-full max-w-md mt-1',
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-700 text-white'
                            : 'bg-white border-gray-200 text-gray-900',
                          'focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                        )}
                      />
                    ) : (
                      <p className="text-sm text-gray-500 mb-2">{formula.name}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDate(formula.createdAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4" />
                        {lines.length} materiales
                      </span>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  'p-4 rounded-xl',
                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Costo por Unidad</p>
                  <p className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {formatCurrency(totals.costPerUnit)}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-700 dark:text-red-300">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="max-w-6xl mx-auto space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Materiales',
                  value: lines.length,
                  icon: Layers,
                  color: 'blue',
                  suffix: 'items'
                },
                {
                  label: 'Rendimiento',
                  value: yieldQuantity,
                  icon: Target,
                  color: 'purple',
                  suffix: yieldUnit
                },
                {
                  label: 'Costo Lote',
                  value: formatCurrency(totals.totalCost),
                  icon: DollarSign,
                  color: 'emerald',
                  isFormatted: true
                },
                {
                  label: 'Margen Est.',
                  value: `${margin.toFixed(0)}%`,
                  icon: TrendingUp,
                  color: 'amber',
                  isFormatted: true,
                  highlight: margin >= 30
                }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border relative overflow-hidden group',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm',
                    stat.highlight && 'ring-2 ring-emerald-500/30'
                  )}
                >
                  <div className={cn(
                    'absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 group-hover:opacity-20 transition-opacity',
                    stat.color === 'blue' && 'bg-blue-500',
                    stat.color === 'purple' && 'bg-purple-500',
                    stat.color === 'emerald' && 'bg-emerald-500',
                    stat.color === 'amber' && 'bg-amber-500'
                  )} />
                  <div className="relative">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                      stat.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'),
                      stat.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600'),
                      stat.color === 'emerald' && (theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'),
                      stat.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600')
                    )}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {stat.isFormatted ? stat.value : stat.value}
                      {stat.suffix && !stat.isFormatted && (
                        <span className="text-sm font-normal text-gray-500 ml-1">{stat.suffix}</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Target Product Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <Target className="w-5 h-5 text-purple-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Producto Final</h3>
                </div>

                {targetProduct && !isEditing && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl overflow-hidden shrink-0',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      {targetProduct.imageUrl ? (
                        <img src={targetProduct.imageUrl} alt={targetProduct.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{targetProduct.name}</p>
                      {targetProduct.sku && (
                        <p className="text-xs text-gray-500 font-mono mt-0.5">SKU: {targetProduct.sku}</p>
                      )}
                    </div>
                  </div>
                )}

                {isEditing && targetProduct && (
                  <div className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border mb-4',
                    theme === 'dark' ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-50 border-purple-200'
                  )}>
                    {targetProduct.imageUrl ? (
                      <img src={targetProduct.imageUrl} alt={targetProduct.name} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-medium truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{targetProduct.name}</p>
                      <p className="text-sm text-gray-500">{targetProduct.unitOfMeasure}</p>
                    </div>
                    <button type="button" onClick={() => { setTargetProductId(null); setTargetProduct(null) }} className="p-1.5 hover:bg-purple-100 dark:hover:bg-purple-800 rounded-lg">
                      <X className="w-4 h-4 text-purple-600" />
                    </button>
                  </div>
                )}

                {isEditing && !targetProduct && (
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={showProductSearch === 'target' ? productSearch : ''}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onFocus={() => setShowProductSearch('target')}
                      placeholder="Buscar producto final..."
                      className={cn(
                        'w-full pl-10 pr-4 py-2.5 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                        'focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                      )}
                    />
                    {showProductSearch === 'target' && products.length > 0 && (
                      <div className={cn(
                        'absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-xl border shadow-lg',
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      )}>
                        {products.map(product => (
                          <button key={product.id} type="button" onClick={() => selectTargetProduct(product)}
                            className={cn('w-full flex items-center gap-3 p-3 text-left', theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}>
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn('font-medium truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{product.name}</p>
                              <p className="text-sm text-gray-500 truncate">{product.sku || product.barcode || 'Sin código'} &middot; {product.unitOfMeasure}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className={cn(
                  'pt-4 border-t space-y-2',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Precio de venta:</span>
                    <span className={cn('font-bold text-base', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {formatCurrency(targetProduct?.sellingPrice || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Costo de fabricación:</span>
                    <span className={cn('font-bold text-orange-600')}>
                      {formatCurrency(totals.costPerUnit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Ganancia por {yieldUnit}:</span>
                    <span className={cn('font-bold', (targetProduct?.sellingPrice || 0) - totals.costPerUnit > 0 ? 'text-emerald-600' : 'text-red-500')}>
                      {formatCurrency((targetProduct?.sellingPrice || 0) - totals.costPerUnit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-gray-500">Unidad:</span>
                    <span className="text-gray-600">{yieldUnit}</span>
                  </div>
                </div>
              </motion.div>

              {/* Cost Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                    )}>
                      <DollarSign className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Desglose de Costos</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Materias primas</span>
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {formatCurrency(totals.materialsCost)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Mano de obra</span>
                    {isEditing ? (
                      <div className="relative w-32">
                        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="number" value={laborCostPerBatch} onChange={(e) => setLaborCostPerBatch(parseFloat(e.target.value) || 0)} min="0" step="0.01"
                          className={cn('w-full pl-7 pr-2 py-1.5 rounded-lg border text-sm text-right', theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200', 'focus:ring-2 focus:ring-purple-500')} />
                      </div>
                    ) : (
                      <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(laborCostPerBatch)}
                      </span>
                    )}
                  </div>

                  <div className={cn('pt-3 border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <div className="flex items-center justify-between">
                      <span className={cn('font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Total por lote</span>
                      <span className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(totals.totalCost)}
                      </span>
                    </div>
                  </div>

                  <div className={cn('pt-3 border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Rendimiento</span>
                      {isEditing ? (
                        <div className="flex gap-1.5 w-40">
                          <input type="number" value={yieldQuantity} onChange={(e) => setYieldQuantity(parseFloat(e.target.value) || 0)} min="0.001" step="0.001"
                            className={cn('flex-1 px-2 py-1.5 rounded-lg border text-sm text-right', theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200', 'focus:ring-2 focus:ring-purple-500')} />
                          <input type="text" value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)}
                            className={cn('w-16 px-2 py-1.5 rounded-lg border text-sm', theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200', 'focus:ring-2 focus:ring-purple-500')} />
                        </div>
                      ) : (
                        <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {yieldQuantity} {yieldUnit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Margin visual */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-500">Costo fabricación / {yieldUnit}</span>
                    <span className={cn('text-sm font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>${totals.costPerUnit.toFixed(4)}</span>
                  </div>
                  {targetProduct && targetProduct.sellingPrice > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Precio de venta / {yieldUnit}</span>
                        <span className={cn('text-sm font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>${targetProduct.sellingPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Ganancia / {yieldUnit}</span>
                        <span className={cn('text-sm font-bold', (targetProduct.sellingPrice - totals.costPerUnit) > 0 ? 'text-emerald-600' : 'text-red-500')}>
                          ${(targetProduct.sellingPrice - totals.costPerUnit).toFixed(4)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className={cn(
                    'p-3 rounded-xl mt-2',
                    margin >= 30
                      ? theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
                      : margin >= 15
                        ? theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
                        : theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={cn(
                          'text-sm font-medium',
                          margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'
                        )}>Margen de Fabricación</span>
                        <p className={cn('text-[10px]', margin >= 30 ? 'text-emerald-500' : margin >= 15 ? 'text-amber-500' : 'text-red-400')}>
                          (Precio Venta - Costo Fabricación) / Precio Venta
                        </p>
                      </div>
                      <span className={cn(
                        'text-lg font-bold',
                        margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'
                      )}>{margin.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Usage & Details Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <Activity className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Uso y Estadísticas</h3>
                </div>

                {formula.usageStats ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Planes totales</span>
                      <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formula.usageStats.totalPlans}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Completados</span>
                      <span className="text-sm font-semibold text-emerald-500">{formula.usageStats.completedPlans}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Unidades producidas</span>
                      <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formula.usageStats.totalProduced}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Último uso</span>
                      <span className="text-gray-600">{formatDate(formula.usageStats.lastUsed)}</span>
                    </div>

                    {/* Progress bar */}
                    {formula.usageStats.totalPlans > 0 && (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Tasa de completación</span>
                          <span>{((formula.usageStats.completedPlans / formula.usageStats.totalPlans) * 100).toFixed(0)}%</span>
                        </div>
                        <div className={cn('h-2 rounded-full overflow-hidden', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(formula.usageStats.completedPlans / formula.usageStats.totalPlans) * 100}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">Sin datos de uso aún</p>
                  </div>
                )}

                {/* Quick Action */}
                {!isEditing && (
                  <div className={cn('mt-6 pt-4 border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <Link href={`/dashboard/market/production/planning/create?formulaId=${formula.id}`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white transition-all"
                      >
                        <Calendar className="w-5 h-5" />
                        Planificar Producción
                      </motion.button>
                    </Link>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Materials Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className={cn(
                'px-6 py-4 border-b flex items-center justify-between',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  )}>
                    <Layers className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Materias Primas
                    </h3>
                    <p className="text-sm text-gray-500">{lines.length} materiales en esta fórmula</p>
                  </div>
                </div>
              </div>

              {/* Add Material Search (edit mode) */}
              {isEditing && (
                <div className={cn('px-6 py-3 border-b', theme === 'dark' ? 'border-gray-700 bg-gray-900/30' : 'border-gray-100 bg-gray-50')}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={showProductSearch === 'material' ? productSearch : ''}
                      onChange={(e) => setProductSearch(e.target.value)}
                      onFocus={() => setShowProductSearch('material')}
                      placeholder="Buscar materia prima para agregar..."
                      className={cn(
                        'w-full pl-10 pr-4 py-2.5 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200',
                        'focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                      )}
                    />
                    {showProductSearch === 'material' && products.length > 0 && (
                      <div className={cn(
                        'absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-xl border shadow-lg',
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      )}>
                        {products.filter(p => p.id !== targetProductId).map(product => (
                          <button key={product.id} type="button" onClick={() => addMaterial(product)}
                            disabled={lines.some(l => l.rawMaterialId === product.id)}
                            className={cn(
                              'w-full flex items-center gap-3 p-3 text-left',
                              lines.some(l => l.rawMaterialId === product.id)
                                ? 'opacity-50 cursor-not-allowed'
                                : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                            )}>
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn('font-medium truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{product.name}</p>
                              <p className="text-sm text-gray-500 truncate">{product.unitOfMeasure} &middot; {formatCurrency(product.costPrice)} &middot; Stock: {product.quantityOnHand}</p>
                            </div>
                            <Plus className="w-5 h-5 text-purple-600 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {lines.length === 0 ? (
                <div className="text-center py-12">
                  <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">No hay materias primas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={cn(theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                      <tr>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Material</th>
                        <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unidad</th>
                        <th className="text-center py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cantidad</th>
                        <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Costo Unit.</th>
                        <th className="text-right py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Subtotal</th>
                        {isEditing && <th className="w-12"></th>}
                      </tr>
                    </thead>
                    <tbody className={cn('divide-y', theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100')}>
                      {lines.map((line, idx) => (
                        <motion.tr
                          key={line.rawMaterialId}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * idx }}
                          className={cn('group transition-colors', theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50')}
                        >
                          <td className="py-4 px-6">
                            <div className="min-w-0">
                              <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {line.materialName}
                              </p>
                              {line.materialSku && (
                                <p className="text-xs text-gray-500 font-mono">SKU: {line.materialSku}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="text-sm text-gray-500">{line.materialUnit}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                value={line.quantity}
                                onChange={(e) => updateLineQuantity(idx, parseFloat(e.target.value) || 0)}
                                min="0.0001"
                                step="0.0001"
                                className={cn(
                                  'w-24 mx-auto px-2 py-1.5 rounded-lg border text-center text-sm',
                                  theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                                  'focus:ring-2 focus:ring-purple-500'
                                )}
                              />
                            ) : (
                              <span className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {line.quantity}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className="text-gray-500">{formatCurrency(line.materialCost)}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {formatCurrency(line.quantity * line.materialCost)}
                            </span>
                          </td>
                          {isEditing && (
                            <td className="py-4 px-2">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                type="button"
                                onClick={() => removeLine(idx)}
                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </motion.button>
                            </td>
                          )}
                        </motion.tr>
                      ))}
                    </tbody>
                    <tfoot className={cn('border-t-2', theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-200 bg-gray-50')}>
                      <tr>
                        <td colSpan={4} className="py-4 px-6 text-right font-semibold text-gray-500">
                          Total Materiales:
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {formatCurrency(totals.materialsCost)}
                          </span>
                        </td>
                        {isEditing && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </motion.div>

            {/* Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'p-6 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn('p-2 rounded-xl', theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100')}>
                  <FlaskConical className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Notas e Instrucciones
                </h3>
              </div>
              {isEditing ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Instrucciones de preparación, notas adicionales..."
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border resize-none',
                    theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                    'focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                  )}
                />
              ) : (
                <p className={cn('text-sm leading-relaxed', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                  {notes || 'Sin notas adicionales'}
                </p>
              )}
            </motion.div>
          </div>
        </div>

        {/* History */}
        {!isEditing && formula?.history && formula.history.length > 0 && (
          <div className="space-y-4">
            <h2 className={cn('text-lg font-bold flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <History className="w-5 h-5 text-purple-500" /> Historial de Modificaciones
            </h2>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className={cn('rounded-2xl border shadow-sm p-6', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
              <div className="space-y-4">
                {formula.history.map((h: any, i: number) => (
                  <div key={h.id || i} className={cn('flex items-start gap-3 pb-4', i < formula.history.length - 1 ? 'border-b' : '', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100')}>
                      <Edit className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {h.action === 'updated' ? 'Fórmula modificada' : h.action}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        por <strong>{h.performedBy}</strong> · {new Date(h.performedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {h.changes?.after && (
                        <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                          {h.changes.after.name && h.changes.before?.name !== h.changes.after.name && <p>Nombre: {h.changes.after.name}</p>}
                          {h.changes.after.linesCount !== undefined && <p>Materias primas: {h.changes.after.linesCount} líneas</p>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Click outside to close product search */}
        {showProductSearch && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => {
              setShowProductSearch(null)
              setProductSearch('')
              setProducts([])
            }}
          />
        )}
      </DashboardLayout>

      {formula && (
        <PrintDocumentModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          documentType={'production_formula' as any}
          documentData={{
            formulaCode: formula.code,
            formulaName: formula.name,
            targetProductName: formula.targetProductName,
            targetProductSku: formula.targetProductSku,
            yieldQuantity: formula.yieldQuantity,
            yieldUnit: formula.yieldUnit,
            laborCostPerBatch: formula.laborCostPerBatch,
            lines: formula.lines.map((l: any) => ({
              name: l.materialName,
              sku: l.materialSku || '',
              quantity: l.quantity,
              unitCost: l.materialCost || 0,
              subtotal: l.quantity * (l.materialCost || 0)
            })),
            totalMaterialsCost: formula.lines.reduce((s: number, l: any) => s + l.quantity * (l.materialCost || 0), 0),
            totalCost: formula.lines.reduce((s: number, l: any) => s + l.quantity * (l.materialCost || 0), 0) + (formula.laborCostPerBatch || 0),
            notes: formula.notes,
            createdAt: formula.createdAt
          }}
          documentTitle={`Fórmula ${formula.code}`}
          sourceType="production_formula"
          sourceId={formula.id}
        />
      )}
    </ProtectedRoute>
  )
}
