'use client'

import { useEffect, useState, use } from 'react'
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
  Clock,
  Layers,
  Edit,
  Eye,
  Calendar,
  BarChart3
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
}

export default function FormulaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { theme } = useTheme()

  // Mode
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form state
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

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Product search state
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

    if (!name.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (!targetProductId) {
      setError('Selecciona el producto final')
      return
    }
    if (lines.length === 0) {
      setError('Agrega al menos una materia prima')
      return
    }
    if (yieldQuantity <= 0) {
      setError('El rendimiento debe ser mayor a 0')
      return
    }

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
      month: 'short',
      year: 'numeric'
    })
  }

  const totals = calculateTotals()

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!formula) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p className="text-gray-500">Fórmula no encontrada</p>
            <Link
              href="/dashboard/market/production/formulas"
              className="text-purple-600 hover:underline"
            >
              Volver a Fórmulas
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/market/production/formulas"
                className={cn(
                  "p-2 rounded-lg border transition-colors",
                  "border-gray-200 dark:border-gray-700",
                  "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FlaskConical className="w-7 h-7 text-purple-600" />
                  {formula.code}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {formula.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                    "bg-purple-600 hover:bg-purple-700 text-white"
                  )}
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
              ) : (
                <>
                  <button
                    onClick={cancelEdit}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                      "border border-gray-200 dark:border-gray-700",
                      "hover:bg-gray-100 dark:hover:bg-gray-700",
                      "text-gray-700 dark:text-gray-300"
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                      "bg-purple-600 hover:bg-purple-700 text-white",
                      saving && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {saving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Guardar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-700 dark:text-red-300">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Usage Stats */}
          {formula.usageStats && !isEditing && (
            <div className={cn(
              "mb-6 p-4 rounded-xl border grid grid-cols-4 gap-4",
              "bg-white dark:bg-gray-800",
              "border-gray-200 dark:border-gray-700"
            )}>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formula.usageStats.totalPlans}
                </p>
                <p className="text-sm text-gray-500">Planes Totales</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formula.usageStats.completedPlans}
                </p>
                <p className="text-sm text-gray-500">Completados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {formula.usageStats.totalProduced}
                </p>
                <p className="text-sm text-gray-500">Unidades Producidas</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(formula.usageStats.lastUsed)}
                </p>
                <p className="text-sm text-gray-500">Último Uso</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Basic Info */}
                <div className={cn(
                  "p-6 rounded-xl border",
                  "bg-white dark:bg-gray-800",
                  "border-gray-200 dark:border-gray-700"
                )}>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Información Básica
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre de la Fórmula *
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ej: Pintura Blanca Mate 1GL"
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border",
                            "bg-white dark:bg-gray-900",
                            "border-gray-200 dark:border-gray-700",
                            "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          )}
                        />
                      ) : (
                        <p className="text-gray-900 dark:text-white font-medium">{name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Producto Final *
                      </label>
                      {targetProduct && (
                        <div className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border",
                          "bg-purple-50 dark:bg-purple-900/20",
                          "border-purple-200 dark:border-purple-800"
                        )}>
                          {targetProduct.imageUrl ? (
                            <img
                              src={targetProduct.imageUrl}
                              alt={targetProduct.name}
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">{targetProduct.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {targetProduct.sku && `SKU: ${targetProduct.sku} • `}
                              {targetProduct.unitOfMeasure} • {formatCurrency(targetProduct.sellingPrice)}
                            </p>
                          </div>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => {
                                setTargetProductId(null)
                                setTargetProduct(null)
                              }}
                              className="p-2 hover:bg-purple-100 dark:hover:bg-purple-800 rounded-lg"
                            >
                              <X className="w-4 h-4 text-purple-600" />
                            </button>
                          )}
                        </div>
                      )}
                      {isEditing && !targetProduct && (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            value={showProductSearch === 'target' ? productSearch : ''}
                            onChange={(e) => setProductSearch(e.target.value)}
                            onFocus={() => setShowProductSearch('target')}
                            placeholder="Buscar producto final..."
                            className={cn(
                              "w-full pl-10 pr-4 py-2 rounded-lg border",
                              "bg-white dark:bg-gray-900",
                              "border-gray-200 dark:border-gray-700",
                              "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            )}
                          />
                          {showProductSearch === 'target' && products.length > 0 && (
                            <div className={cn(
                              "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-lg border shadow-lg",
                              "bg-white dark:bg-gray-800",
                              "border-gray-200 dark:border-gray-700"
                            )}>
                              {products.map(product => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => selectTargetProduct(product)}
                                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                                >
                                  {product.imageUrl ? (
                                    <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded object-cover" />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                      <Package className="w-5 h-5 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                                    <p className="text-sm text-gray-500 truncate">
                                      {product.sku || product.barcode || 'Sin código'} • {product.unitOfMeasure}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Rendimiento por Lote *
                        </label>
                        {isEditing ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={yieldQuantity}
                              onChange={(e) => setYieldQuantity(parseFloat(e.target.value) || 0)}
                              min="0.001"
                              step="0.001"
                              className={cn(
                                "flex-1 px-4 py-2 rounded-lg border",
                                "bg-white dark:bg-gray-900",
                                "border-gray-200 dark:border-gray-700",
                                "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              )}
                            />
                            <input
                              type="text"
                              value={yieldUnit}
                              onChange={(e) => setYieldUnit(e.target.value)}
                              className={cn(
                                "w-24 px-4 py-2 rounded-lg border",
                                "bg-white dark:bg-gray-900",
                                "border-gray-200 dark:border-gray-700",
                                "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              )}
                            />
                          </div>
                        ) : (
                          <p className="text-gray-900 dark:text-white font-medium">
                            {yieldQuantity} {yieldUnit}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Costo de Mano de Obra
                        </label>
                        {isEditing ? (
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="number"
                              value={laborCostPerBatch}
                              onChange={(e) => setLaborCostPerBatch(parseFloat(e.target.value) || 0)}
                              min="0"
                              step="0.01"
                              className={cn(
                                "w-full pl-10 pr-4 py-2 rounded-lg border",
                                "bg-white dark:bg-gray-900",
                                "border-gray-200 dark:border-gray-700",
                                "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              )}
                            />
                          </div>
                        ) : (
                          <p className="text-gray-900 dark:text-white font-medium">
                            {formatCurrency(laborCostPerBatch)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Notas
                      </label>
                      {isEditing ? (
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          placeholder="Instrucciones o notas adicionales..."
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border resize-none",
                            "bg-white dark:bg-gray-900",
                            "border-gray-200 dark:border-gray-700",
                            "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          )}
                        />
                      ) : (
                        <p className="text-gray-600 dark:text-gray-400">
                          {notes || 'Sin notas'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Materials */}
                <div className={cn(
                  "p-6 rounded-xl border",
                  "bg-white dark:bg-gray-800",
                  "border-gray-200 dark:border-gray-700"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-purple-600" />
                      Materias Primas
                    </h2>
                    <span className="text-sm text-gray-500">{lines.length} material(es)</span>
                  </div>

                  {/* Add Material Search (only in edit mode) */}
                  {isEditing && (
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={showProductSearch === 'material' ? productSearch : ''}
                        onChange={(e) => setProductSearch(e.target.value)}
                        onFocus={() => setShowProductSearch('material')}
                        placeholder="Buscar materia prima para agregar..."
                        className={cn(
                          "w-full pl-10 pr-4 py-2 rounded-lg border",
                          "bg-white dark:bg-gray-900",
                          "border-gray-200 dark:border-gray-700",
                          "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        )}
                      />
                      {showProductSearch === 'material' && products.length > 0 && (
                        <div className={cn(
                          "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-lg border shadow-lg",
                          "bg-white dark:bg-gray-800",
                          "border-gray-200 dark:border-gray-700"
                        )}>
                          {products.filter(p => p.id !== targetProductId).map(product => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => addMaterial(product)}
                              disabled={lines.some(l => l.rawMaterialId === product.id)}
                              className={cn(
                                "w-full flex items-center gap-3 p-3 text-left",
                                lines.some(l => l.rawMaterialId === product.id)
                                  ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-700"
                                  : "hover:bg-gray-50 dark:hover:bg-gray-700"
                              )}
                            >
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                                <p className="text-sm text-gray-500 truncate">
                                  {product.unitOfMeasure} • {formatCurrency(product.costPrice)} • Stock: {product.quantityOnHand}
                                </p>
                              </div>
                              <Plus className="w-5 h-5 text-purple-600" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Materials Table */}
                  {lines.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No hay materias primas</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 text-sm font-medium text-gray-600 dark:text-gray-400">Material</th>
                            <th className="text-center py-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-24">Unidad</th>
                            <th className="text-center py-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-28">Cantidad</th>
                            <th className="text-right py-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-24">Costo</th>
                            <th className="text-right py-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-24">Subtotal</th>
                            {isEditing && <th className="w-10"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {lines.map((line, index) => (
                            <tr key={line.rawMaterialId}>
                              <td className="py-3">
                                <p className="font-medium text-gray-900 dark:text-white">{line.materialName}</p>
                                {line.materialSku && (
                                  <p className="text-xs text-gray-500">{line.materialSku}</p>
                                )}
                              </td>
                              <td className="py-3 text-center text-sm text-gray-600 dark:text-gray-400">
                                {line.materialUnit}
                              </td>
                              <td className="py-3">
                                {isEditing ? (
                                  <input
                                    type="number"
                                    value={line.quantity}
                                    onChange={(e) => updateLineQuantity(index, parseFloat(e.target.value) || 0)}
                                    min="0.0001"
                                    step="0.0001"
                                    className={cn(
                                      "w-full px-2 py-1 rounded border text-center",
                                      "bg-white dark:bg-gray-900",
                                      "border-gray-200 dark:border-gray-700",
                                      "focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    )}
                                  />
                                ) : (
                                  <p className="text-center text-gray-900 dark:text-white">{line.quantity}</p>
                                )}
                              </td>
                              <td className="py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                                {formatCurrency(line.materialCost)}
                              </td>
                              <td className="py-3 text-right font-medium text-gray-900 dark:text-white">
                                {formatCurrency(line.quantity * line.materialCost)}
                              </td>
                              {isEditing && (
                                <td className="py-3">
                                  <button
                                    type="button"
                                    onClick={() => removeLine(index)}
                                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Sidebar */}
              <div className="lg:col-span-1">
                <div className={cn(
                  "p-6 rounded-xl border sticky top-6",
                  "bg-white dark:bg-gray-800",
                  "border-gray-200 dark:border-gray-700"
                )}>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Resumen de Costos
                  </h2>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Materias primas:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(totals.materialsCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Mano de obra:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(laborCostPerBatch)}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Total por lote:</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(totals.totalCost)}
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      "p-3 rounded-lg",
                      "bg-purple-50 dark:bg-purple-900/20"
                    )}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-purple-700 dark:text-purple-300">Costo por unidad:</span>
                        <span className="text-xl font-bold text-purple-600">
                          {formatCurrency(totals.costPerUnit)}
                        </span>
                      </div>
                      {targetProduct && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          Precio venta: {formatCurrency(targetProduct.sellingPrice)} •
                          Margen: {((targetProduct.sellingPrice - totals.costPerUnit) / targetProduct.sellingPrice * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {!isEditing && (
                    <div className="mt-6 space-y-3">
                      <Link
                        href={`/dashboard/market/production/planning/create?formulaId=${formula.id}`}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors",
                          "bg-green-600 hover:bg-green-700 text-white"
                        )}
                      >
                        <Calendar className="w-5 h-5" />
                        Planificar Producción
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

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
    </ProtectedRoute>
  )
}
