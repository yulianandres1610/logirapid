'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Factory,
  ArrowLeft,
  Save,
  Search,
  Package,
  Loader2,
  DollarSign,
  AlertCircle,
  Check,
  X,
  Warehouse,
  Calendar,
  BookOpen,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface BOM {
  id: number
  bomCode: string
  bomName: string
  productName: string
  productImage: string | null
  outputQuantity: number
  outputUnit: string
  totalMaterialCost: number
  unitCost: number
  lines: BOMLine[]
}

interface BOMLine {
  productId: number
  variantId: number | null
  productName: string
  quantityRequired: number
  unit: string
  productCostPrice: number
  lineCost: number
}

interface WarehouseOption {
  id: number
  code: string
  name: string
  isCentral: boolean
}

interface MaterialRequirement {
  productName: string
  required: number
  available: number
  hasStock: boolean
  unit: string
}

export default function CreateProductionOrderPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form state
  const [boms, setBoms] = useState<BOM[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [selectedBom, setSelectedBom] = useState<BOM | null>(null)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null)
  const [quantityToProduce, setQuantityToProduce] = useState<number>(0)
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')

  // Calculated values
  const [materialRequirements, setMaterialRequirements] = useState<MaterialRequirement[]>([])
  const [totalMaterialCost, setTotalMaterialCost] = useState(0)
  const [unitCost, setUnitCost] = useState(0)
  const [checkingStock, setCheckingStock] = useState(false)

  // Load BOMs and warehouses
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [bomsRes, warehousesRes] = await Promise.all([
          fetch('/api/market/bom?isActive=true&limit=100'),
          fetch('/api/market/warehouses')
        ])

        const bomsData = await bomsRes.json()
        const warehousesData = await warehousesRes.json()

        if (bomsData.success) {
          setBoms(bomsData.data.boms || [])
        }
        if (warehousesData.success) {
          setWarehouses(warehousesData.data.warehouses || [])
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Calculate requirements when BOM or quantity changes
  useEffect(() => {
    if (!selectedBom || quantityToProduce <= 0) {
      setMaterialRequirements([])
      setTotalMaterialCost(0)
      setUnitCost(0)
      return
    }

    const batchMultiplier = quantityToProduce / selectedBom.outputQuantity
    let totalCost = 0

    const requirements = selectedBom.lines.map(line => {
      const required = line.quantityRequired * batchMultiplier
      const lineCost = line.productCostPrice * required
      totalCost += lineCost

      return {
        productName: line.productName,
        required,
        available: 0, // Will be filled when checking stock
        hasStock: true,
        unit: line.unit
      }
    })

    setMaterialRequirements(requirements)
    setTotalMaterialCost(totalCost)
    setUnitCost(totalCost / quantityToProduce)
  }, [selectedBom, quantityToProduce])

  // Check stock availability
  const checkStockAvailability = useCallback(async () => {
    if (!selectedBom || !selectedWarehouseId || quantityToProduce <= 0) return

    try {
      setCheckingStock(true)
      const batchMultiplier = quantityToProduce / selectedBom.outputQuantity

      const updatedRequirements = await Promise.all(
        selectedBom.lines.map(async (line) => {
          const required = line.quantityRequired * batchMultiplier

          // Get stock for this product in selected warehouse
          const response = await fetch(
            `/api/market/warehouses/${selectedWarehouseId}/stock?productId=${line.productId}${line.variantId ? `&variantId=${line.variantId}` : ''}`
          )
          const data = await response.json()
          const available = data.success ? (data.data?.quantityAvailable || 0) : 0

          return {
            productName: line.productName,
            required,
            available,
            hasStock: available >= required,
            unit: line.unit
          }
        })
      )

      setMaterialRequirements(updatedRequirements)
    } catch (error) {
      console.error('Error checking stock:', error)
    } finally {
      setCheckingStock(false)
    }
  }, [selectedBom, selectedWarehouseId, quantityToProduce])

  // Check stock when warehouse changes
  useEffect(() => {
    if (selectedWarehouseId && selectedBom && quantityToProduce > 0) {
      checkStockAvailability()
    }
  }, [selectedWarehouseId, checkStockAvailability])

  const handleBomChange = (bomId: number) => {
    const bom = boms.find(b => b.id === bomId)
    setSelectedBom(bom || null)
    if (bom) {
      setQuantityToProduce(bom.outputQuantity)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedBom) {
      alert('Seleccione una receta')
      return
    }

    if (!selectedWarehouseId) {
      alert('Seleccione un almacén')
      return
    }

    if (quantityToProduce <= 0) {
      alert('La cantidad a producir debe ser mayor a 0')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/market/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bomId: selectedBom.id,
          warehouseId: selectedWarehouseId,
          quantityToProduce,
          scheduledDate: scheduledDate || null,
          notes: notes.trim() || null
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/dashboard/market/production/orders/${data.data.id}`)
      } else {
        if (data.data?.insufficientMaterials) {
          alert(`Stock insuficiente:\n${data.data.insufficientMaterials.map((m: any) =>
            `- ${m.productName}: necesita ${m.required}, disponible ${m.available}`
          ).join('\n')}`)
        } else {
          alert(data.error || 'Error al crear orden de producción')
        }
      }
    } catch (error) {
      console.error('Error creating production order:', error)
      alert('Error al crear orden de producción')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const hasInsufficientStock = materialRequirements.some(m => !m.hasStock)

  if (loading) {
    return (
      <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL', 'MARKET_ALMACENERO']}>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL', 'MARKET_ALMACENERO']}>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-6",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/dashboard/market/production"
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className={cn(
                "text-2xl font-bold flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Factory className="w-7 h-7 text-purple-500" />
                Nueva Orden de Producción
              </h1>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Programa la fabricación de productos
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Recipe Selection */}
                <div className={cn(
                  "p-6 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
                )}>
                  <h2 className={cn(
                    "font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <BookOpen className="w-5 h-5 text-purple-500" />
                    Seleccionar Receta
                  </h2>

                  {boms.length === 0 ? (
                    <div className={cn(
                      "text-center py-8 border-2 border-dashed rounded-lg",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <BookOpen className={cn(
                        "w-12 h-12 mx-auto mb-2",
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                      )} />
                      <p className={cn(
                        "text-sm mb-2",
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                      )}>
                        No hay recetas disponibles
                      </p>
                      <Link
                        href="/dashboard/market/production/bom/create"
                        className="text-purple-500 hover:underline text-sm"
                      >
                        Crear una receta primero
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <select
                        value={selectedBom?.id || ''}
                        onChange={(e) => handleBomChange(parseInt(e.target.value))}
                        className={cn(
                          "w-full px-4 py-2 rounded-lg border transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                        required
                      >
                        <option value="">Seleccionar receta...</option>
                        {boms.map((bom) => (
                          <option key={bom.id} value={bom.id}>
                            {bom.bomName} ({bom.bomCode}) - {bom.productName}
                          </option>
                        ))}
                      </select>

                      {selectedBom && (
                        <div className={cn(
                          "p-4 rounded-lg border",
                          theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                        )}>
                          <div className="flex items-center gap-4">
                            {selectedBom.productImage ? (
                              <img src={selectedBom.productImage} alt="" className="w-16 h-16 rounded-lg object-cover" />
                            ) : (
                              <div className={cn(
                                "w-16 h-16 rounded-lg flex items-center justify-center",
                                theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                              )}>
                                <Package className="w-8 h-8 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className={cn(
                                "font-medium",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {selectedBom.productName}
                              </p>
                              <p className={cn(
                                "text-sm",
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              )}>
                                Produce: {selectedBom.outputQuantity} {selectedBom.outputUnit} por lote
                              </p>
                              <p className={cn(
                                "text-sm",
                                theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                              )}>
                                Costo por {selectedBom.outputUnit}: {formatCurrency(selectedBom.unitCost)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Production Details */}
                <div className={cn(
                  "p-6 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
                )}>
                  <h2 className={cn(
                    "font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <Factory className="w-5 h-5 text-purple-500" />
                    Detalles de Producción
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Almacén de producción *
                      </label>
                      <select
                        value={selectedWarehouseId || ''}
                        onChange={(e) => setSelectedWarehouseId(parseInt(e.target.value) || null)}
                        className={cn(
                          "w-full px-4 py-2 rounded-lg border transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                        required
                      >
                        <option value="">Seleccionar almacén...</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.code}) {w.isCentral && '- Central'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-1",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Cantidad a producir *
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={quantityToProduce}
                            onChange={(e) => setQuantityToProduce(parseFloat(e.target.value) || 0)}
                            min="0.001"
                            step="0.001"
                            className={cn(
                              "flex-1 px-4 py-2 rounded-lg border transition-all",
                              theme === 'dark'
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-gray-50 border-gray-200 text-gray-900'
                            )}
                            required
                          />
                          <span className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            {selectedBom?.outputUnit || 'unidades'}
                          </span>
                        </div>
                        {selectedBom && quantityToProduce > 0 && (
                          <p className={cn(
                            "text-xs mt-1",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          )}>
                            = {(quantityToProduce / selectedBom.outputQuantity).toFixed(2)} lotes de la receta
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-1",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Fecha programada
                        </label>
                        <input
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border transition-all",
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-900'
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Notas
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Notas o instrucciones adicionales..."
                        className={cn(
                          "w-full px-4 py-2 rounded-lg border transition-all resize-none",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Material Requirements */}
                {materialRequirements.length > 0 && (
                  <div className={cn(
                    "p-6 rounded-xl",
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={cn(
                        "font-semibold flex items-center gap-2",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Package className="w-5 h-5 text-purple-500" />
                        Materiales necesarios
                      </h2>
                      {checkingStock && (
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verificando stock...
                        </span>
                      )}
                    </div>

                    {hasInsufficientStock && (
                      <div className={cn(
                        "flex items-center gap-2 p-3 rounded-lg mb-4",
                        theme === 'dark' ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'
                      )}>
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm">
                          Algunos materiales no tienen stock suficiente
                        </span>
                      </div>
                    )}

                    <div className="space-y-2">
                      {materialRequirements.map((material, index) => (
                        <div
                          key={index}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg",
                            !material.hasStock
                              ? theme === 'dark' ? 'bg-red-900/20 border border-red-700' : 'bg-red-50 border border-red-200'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {material.hasStock ? (
                              <Check className="w-5 h-5 text-green-500" />
                            ) : (
                              <X className="w-5 h-5 text-red-500" />
                            )}
                            <span className={cn(
                              "font-medium",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {material.productName}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {material.required.toFixed(2)} {material.unit}
                            </p>
                            {selectedWarehouseId && (
                              <p className={cn(
                                "text-xs",
                                material.hasStock
                                  ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                                  : theme === 'dark' ? 'text-red-400' : 'text-red-600'
                              )}>
                                Stock: {material.available.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Sidebar */}
              <div className="space-y-6">
                <div className={cn(
                  "p-6 rounded-xl sticky top-6",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
                )}>
                  <h2 className={cn(
                    "font-semibold mb-4",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Resumen
                  </h2>

                  <div className="space-y-4">
                    <div className={cn(
                      "p-4 rounded-lg",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}>
                      <p className={cn(
                        "text-sm mb-1",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        A producir
                      </p>
                      <p className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {quantityToProduce} {selectedBom?.outputUnit || 'unidades'}
                      </p>
                    </div>

                    <div className={cn(
                      "p-4 rounded-lg",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}>
                      <p className={cn(
                        "text-sm mb-1",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Costo total estimado
                      </p>
                      <p className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {formatCurrency(totalMaterialCost)}
                      </p>
                    </div>

                    <div className={cn(
                      "p-4 rounded-lg",
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50'
                    )}>
                      <p className={cn(
                        "text-sm mb-1",
                        theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                      )}>
                        Costo por unidad
                      </p>
                      <p className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                      )}>
                        {formatCurrency(unitCost)}
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={saving || !selectedBom || !selectedWarehouseId || quantityToProduce <= 0 || hasInsufficientStock}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
                        saving || !selectedBom || !selectedWarehouseId || quantityToProduce <= 0 || hasInsufficientStock
                          ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                          : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white'
                      )}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Crear Orden
                        </>
                      )}
                    </button>

                    {hasInsufficientStock && (
                      <p className="text-xs text-center text-red-500">
                        No se puede crear la orden sin stock suficiente
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
