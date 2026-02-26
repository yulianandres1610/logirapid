'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  ArrowLeft,
  FlaskConical,
  Warehouse,
  Save,
  RefreshCw,
  AlertCircle,
  X,
  Package,
  DollarSign,
  Layers,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Formula {
  id: number
  code: string
  name: string
  targetProductName: string
  targetProductImage: string | null
  yieldQuantity: number
  yieldUnit: string
  laborCostPerBatch: number
  materialCount: number
  estimatedMaterialsCost: number
}

interface WarehouseOption {
  id: number
  code: string
  name: string
}

interface Material {
  materialName: string
  materialUnit: string
  quantityRequired: number
  availableStock: number
  isAvailable: boolean
}

export default function CreatePlanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()

  // Form state
  const [formulaId, setFormulaId] = useState<number | null>(null)
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null)
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
  const [targetWarehouseId, setTargetWarehouseId] = useState<number | null>(null)
  const [plannedDate, setPlannedDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0])
  const [plannedQuantity, setPlannedQuantity] = useState<number>(0)
  const [batches, setBatches] = useState<number>(1)
  const [notes, setNotes] = useState('')

  // Data state
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [calculatedMaterials, setCalculatedMaterials] = useState<Material[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingStock, setCheckingStock] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (formulaId && warehouseId && plannedQuantity > 0) {
      checkMaterialAvailability()
    } else {
      setCalculatedMaterials([])
    }
  }, [formulaId, warehouseId, plannedQuantity])

  const fetchInitialData = async () => {
    try {
      const [formulasRes, warehousesRes] = await Promise.all([
        fetch('/api/market/production/formulas?isActive=true&limit=100'),
        fetch('/api/market/warehouses')
      ])

      if (formulasRes.ok) {
        const data = await formulasRes.json()
        if (data.success) {
          setFormulas(data.data.formulas)
        }
      }

      if (warehousesRes.ok) {
        const data = await warehousesRes.json()
        if (data.success) {
          setWarehouses(data.data.warehouses || [])
          // Auto-select first warehouse if only one
          if (data.data.warehouses?.length === 1) {
            setWarehouseId(data.data.warehouses[0].id)
            setTargetWarehouseId(data.data.warehouses[0].id)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkMaterialAvailability = async () => {
    if (!formulaId || !warehouseId || plannedQuantity <= 0) return

    setCheckingStock(true)
    try {
      // Get formula details with materials
      const response = await fetch(`/api/market/production/formulas/${formulaId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.lines) {
          const yieldQty = data.data.yieldQuantity || 1
          const multiplier = plannedQuantity / yieldQty

          // Get stock for each material
          const materials: Material[] = []
          for (const line of data.data.lines) {
            const stockRes = await fetch(`/api/market/warehouses/${warehouseId}/stock?productId=${line.rawMaterialId}`)
            let availableStock = 0
            if (stockRes.ok) {
              const stockData = await stockRes.json()
              availableStock = stockData.data?.quantityOnHand || 0
            }

            const quantityRequired = line.quantity * multiplier
            materials.push({
              materialName: line.materialName,
              materialUnit: line.materialUnit,
              quantityRequired,
              availableStock,
              isAvailable: availableStock >= quantityRequired
            })
          }
          setCalculatedMaterials(materials)
        }
      }
    } catch (error) {
      console.error('Error checking stock:', error)
    } finally {
      setCheckingStock(false)
    }
  }

  const selectFormula = (formula: Formula) => {
    setFormulaId(formula.id)
    setSelectedFormula(formula)
    // Set default quantity to formula yield
    if (plannedQuantity === 0) {
      setPlannedQuantity(formula.yieldQuantity)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!formulaId) {
      setError('Selecciona una fórmula')
      return
    }
    if (!warehouseId) {
      setError('Selecciona el almacén de materiales')
      return
    }
    if (!plannedDate) {
      setError('Selecciona la fecha planificada')
      return
    }
    if (plannedQuantity <= 0) {
      setError('La cantidad debe ser mayor a 0')
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/market/production/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formulaId,
          warehouseId,
          targetWarehouseId: targetWarehouseId || warehouseId,
          plannedDate,
          plannedQuantity,
          batches,
          notes: notes.trim() || null
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push('/dashboard/market/production/planning')
      } else {
        setError(data.error || 'Error al crear el plan')
      }
    } catch (error) {
      console.error('Error creating plan:', error)
      setError('Error al crear el plan')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  // Calculate costs
  const calculateCosts = () => {
    if (!selectedFormula || plannedQuantity <= 0) {
      return { materialsCost: 0, laborCost: 0, totalCost: 0, costPerUnit: 0 }
    }

    const multiplier = plannedQuantity / selectedFormula.yieldQuantity
    const materialsCost = selectedFormula.estimatedMaterialsCost * multiplier
    const laborCost = selectedFormula.laborCostPerBatch * batches
    const totalCost = materialsCost + laborCost
    const costPerUnit = totalCost / plannedQuantity

    return { materialsCost, laborCost, totalCost, costPerUnit }
  }

  const costs = calculateCosts()
  const allMaterialsAvailable = calculatedMaterials.every(m => m.isAvailable)
  const shortageCount = calculatedMaterials.filter(m => !m.isAvailable).length

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/dashboard/market/production/planning"
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
                <Calendar className="w-7 h-7 text-blue-600" />
                Nueva Planificación
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Programa una producción para una fecha específica
              </p>
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

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Formula Selection */}
                  <div className={cn(
                    "p-6 rounded-xl border",
                    "bg-white dark:bg-gray-800",
                    "border-gray-200 dark:border-gray-700"
                  )}>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FlaskConical className="w-5 h-5 text-purple-600" />
                      Seleccionar Fórmula
                    </h2>

                    {formulas.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        <FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No hay fórmulas activas</p>
                        <Link
                          href="/dashboard/market/production/formulas/create"
                          className="text-purple-600 hover:underline mt-2 inline-block"
                        >
                          Crear primera fórmula
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {formulas.map(formula => (
                          <button
                            key={formula.id}
                            type="button"
                            onClick={() => selectFormula(formula)}
                            className={cn(
                              "p-4 rounded-lg border text-left transition-all",
                              formulaId === formula.id
                                ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-500"
                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              {formula.targetProductImage ? (
                                <img
                                  src={formula.targetProductImage}
                                  alt={formula.targetProductName}
                                  className="w-12 h-12 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">
                                  {formula.name}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                  {formula.code} • {formula.yieldQuantity} {formula.yieldUnit}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {formula.materialCount} materiales • {formatCurrency(formula.estimatedMaterialsCost + formula.laborCostPerBatch)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Plan Details */}
                  <div className={cn(
                    "p-6 rounded-xl border",
                    "bg-white dark:bg-gray-800",
                    "border-gray-200 dark:border-gray-700"
                  )}>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Detalles del Plan
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Fecha Planificada *
                        </label>
                        <input
                          type="date"
                          value={plannedDate}
                          onChange={(e) => setPlannedDate(e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border",
                            "bg-white dark:bg-gray-900",
                            "border-gray-200 dark:border-gray-700",
                            "focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Cantidad a Producir *
                        </label>
                        <input
                          type="number"
                          value={plannedQuantity}
                          onChange={(e) => setPlannedQuantity(parseFloat(e.target.value) || 0)}
                          min="0.001"
                          step="0.001"
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border",
                            "bg-white dark:bg-gray-900",
                            "border-gray-200 dark:border-gray-700",
                            "focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Almacén de Materiales *
                        </label>
                        <select
                          value={warehouseId || ''}
                          onChange={(e) => setWarehouseId(parseInt(e.target.value) || null)}
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border",
                            "bg-white dark:bg-gray-900",
                            "border-gray-200 dark:border-gray-700",
                            "focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          )}
                        >
                          <option value="">Seleccionar almacén</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Almacén Destino
                        </label>
                        <select
                          value={targetWarehouseId || warehouseId || ''}
                          onChange={(e) => setTargetWarehouseId(parseInt(e.target.value) || null)}
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border",
                            "bg-white dark:bg-gray-900",
                            "border-gray-200 dark:border-gray-700",
                            "focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          )}
                        >
                          <option value="">Mismo almacén</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Notas (opcional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          placeholder="Instrucciones o notas adicionales..."
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border resize-none",
                            "bg-white dark:bg-gray-900",
                            "border-gray-200 dark:border-gray-700",
                            "focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Materials Preview */}
                  {calculatedMaterials.length > 0 && (
                    <div className={cn(
                      "p-6 rounded-xl border",
                      "bg-white dark:bg-gray-800",
                      "border-gray-200 dark:border-gray-700"
                    )}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Layers className="w-5 h-5 text-blue-600" />
                          Materiales Requeridos
                        </h2>
                        {checkingStock ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                        ) : allMaterialsAvailable ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Stock disponible
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {shortageCount} material(es) con faltante
                          </span>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 text-sm font-medium text-gray-600 dark:text-gray-400">Material</th>
                              <th className="text-center py-2 text-sm font-medium text-gray-600 dark:text-gray-400">Requerido</th>
                              <th className="text-center py-2 text-sm font-medium text-gray-600 dark:text-gray-400">Disponible</th>
                              <th className="text-center py-2 text-sm font-medium text-gray-600 dark:text-gray-400">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {calculatedMaterials.map((mat, index) => (
                              <tr key={index}>
                                <td className="py-2 text-sm text-gray-900 dark:text-white">
                                  {mat.materialName}
                                </td>
                                <td className="py-2 text-center text-sm text-gray-600 dark:text-gray-400">
                                  {mat.quantityRequired.toFixed(2)} {mat.materialUnit}
                                </td>
                                <td className="py-2 text-center text-sm text-gray-600 dark:text-gray-400">
                                  {mat.availableStock.toFixed(2)} {mat.materialUnit}
                                </td>
                                <td className="py-2 text-center">
                                  {mat.isAvailable ? (
                                    <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-amber-600 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary Sidebar */}
                <div className="lg:col-span-1">
                  <div className={cn(
                    "p-6 rounded-xl border sticky top-6",
                    "bg-white dark:bg-gray-800",
                    "border-gray-200 dark:border-gray-700"
                  )}>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Resumen del Plan
                    </h2>

                    {selectedFormula ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                          {selectedFormula.targetProductImage ? (
                            <img
                              src={selectedFormula.targetProductImage}
                              alt={selectedFormula.targetProductName}
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {selectedFormula.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {selectedFormula.targetProductName}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Cantidad:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {plannedQuantity} unidades
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Costo materiales:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatCurrency(costs.materialsCost)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Mano de obra:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {formatCurrency(costs.laborCost)}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <div className="flex justify-between mb-2">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {formatCurrency(costs.totalCost)}
                            </span>
                          </div>
                          <div className={cn(
                            "p-3 rounded-lg",
                            "bg-blue-50 dark:bg-blue-900/20"
                          )}>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-blue-700 dark:text-blue-300">Costo/unidad:</span>
                              <span className="text-xl font-bold text-blue-600">
                                {formatCurrency(costs.costPerUnit)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {!allMaterialsAvailable && calculatedMaterials.length > 0 && (
                          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div className="text-sm text-amber-700 dark:text-amber-300">
                                <p className="font-medium">Stock insuficiente</p>
                                <p className="text-xs mt-1">
                                  Puedes crear el plan, pero deberás reabastecer antes de la entrega de materiales.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>Selecciona una fórmula</p>
                      </div>
                    )}

                    <div className="mt-6 space-y-3">
                      <button
                        type="submit"
                        disabled={saving || !formulaId}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors",
                          "bg-blue-600 hover:bg-blue-700 text-white",
                          (saving || !formulaId) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {saving ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <Save className="w-5 h-5" />
                        )}
                        {saving ? 'Creando...' : 'Crear Plan'}
                      </button>
                      <Link
                        href="/dashboard/market/production/planning"
                        className={cn(
                          "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors",
                          "border border-gray-200 dark:border-gray-700",
                          "hover:bg-gray-100 dark:hover:bg-gray-700",
                          "text-gray-700 dark:text-gray-300"
                        )}
                      >
                        Cancelar
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
