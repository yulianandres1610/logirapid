'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Factory,
  Package,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  X,
  Warehouse,
  Calendar,
  Check,
  AlertTriangle,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface BOM {
  id: number
  bomCode: string
  bomName: string
  productId: number
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

const STEPS = [
  { id: 'recipe', title: 'Receta', icon: BookOpen },
  { id: 'details', title: 'Producción', icon: Factory },
  { id: 'materials', title: 'Materiales', icon: Package },
  { id: 'confirm', title: 'Confirmación', icon: CheckCircle }
]

export default function CreateProductionOrderPage() {
  const router = useRouter()
  const { theme } = useTheme()

  const [currentStep, setCurrentStep] = useState<string>('recipe')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)

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

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)
  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)
  const hasInsufficientStock = materialRequirements.some(m => !m.hasStock)

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
      } catch (err) {
        console.error('Error loading data:', err)
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
        available: 0,
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
    } catch (err) {
      console.error('Error checking stock:', err)
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

  const handleBomSelect = (bom: BOM) => {
    setSelectedBom(bom)
    setQuantityToProduce(bom.outputQuantity)
  }

  const validateStep = (step: string): boolean => {
    setError('')

    switch (step) {
      case 'recipe':
        if (!selectedBom) {
          setError('Selecciona una receta de fabricación')
          return false
        }
        return true

      case 'details':
        if (!selectedWarehouseId) {
          setError('Selecciona un almacén de producción')
          return false
        }
        if (quantityToProduce <= 0) {
          setError('La cantidad a producir debe ser mayor a 0')
          return false
        }
        return true

      case 'materials':
        if (hasInsufficientStock) {
          setError('No hay stock suficiente de algunos materiales')
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

  const createOrder = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/market/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bomId: selectedBom!.id,
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
          setError(`Stock insuficiente:\n${data.data.insufficientMaterials.map((m: any) =>
            `- ${m.productName}: necesita ${m.required}, disponible ${m.available}`
          ).join('\n')}`)
        } else {
          setError(data.error || 'Error al crear orden de producción')
        }
      }
    } catch (err) {
      console.error('Error creating production order:', err)
      setError('Error de conexión')
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

  if (loading) {
    return (
      <div className={cn(
        "min-h-screen pt-16 pb-20 px-4 flex items-center justify-center",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Cargando datos...
          </p>
        </div>
      </div>
    )
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
            Nueva Orden de Producción
          </h1>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Programa la fabricación de productos usando una receta
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
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-400 whitespace-pre-line">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content */}
        <div className={cn(
          "rounded-2xl shadow-lg p-6",
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}>
          <AnimatePresence mode="wait">
            {/* Step 1: Recipe Selection */}
            {currentStep === 'recipe' && (
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
                  Seleccionar Receta
                </h2>

                {boms.length === 0 ? (
                  <div className={cn(
                    "text-center py-12 border-2 border-dashed rounded-xl",
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <BookOpen className={cn("w-12 h-12 mx-auto mb-3", theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
                    <p className={cn("text-sm mb-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                      No hay recetas disponibles
                    </p>
                    <Link href="/dashboard/market/production/bom/create" className="text-purple-500 hover:underline text-sm">
                      Crear una receta primero
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {boms.map(bom => (
                      <div
                        key={bom.id}
                        onClick={() => handleBomSelect(bom)}
                        className={cn(
                          "p-4 border-2 rounded-xl cursor-pointer transition-all",
                          selectedBom?.id === bom.id
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {bom.productImage ? (
                            <img src={bom.productImage} alt="" className="w-14 h-14 rounded-lg object-cover" />
                          ) : (
                            <div className={cn(
                              "w-14 h-14 rounded-lg flex items-center justify-center",
                              selectedBom?.id === bom.id
                                ? 'bg-purple-100 dark:bg-purple-800'
                                : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            )}>
                              <Package className={cn(
                                "w-7 h-7",
                                selectedBom?.id === bom.id ? 'text-purple-600' : 'text-gray-400'
                              )} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className={cn("font-medium truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {bom.bomName}
                            </h4>
                            <p className={cn("text-xs truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {bom.productName}
                            </p>
                            <p className={cn("text-xs", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>
                              Produce: {bom.outputQuantity} {bom.outputUnit} | {formatCurrency(bom.unitCost)}/ud
                            </p>
                          </div>
                          {selectedBom?.id === bom.id && (
                            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Production Details */}
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
                  Detalles de Producción
                </h2>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-3",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-4 h-4" />
                      Almacén de producción *
                    </div>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {warehouses.map(w => (
                      <div
                        key={w.id}
                        onClick={() => setSelectedWarehouseId(w.id)}
                        className={cn(
                          "p-4 border-2 rounded-xl cursor-pointer transition-all",
                          selectedWarehouseId === w.id
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            selectedWarehouseId === w.id
                              ? 'bg-purple-100 dark:bg-purple-800'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                          )}>
                            <Warehouse className={cn(
                              "w-5 h-5",
                              selectedWarehouseId === w.id ? 'text-purple-600' : 'text-gray-400'
                            )} />
                          </div>
                          <div>
                            <h4 className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {w.name}
                            </h4>
                            <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {w.code} {w.isCentral && '- Central'}
                            </p>
                          </div>
                          {selectedWarehouseId === w.id && (
                            <div className="ml-auto w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
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
                          "flex-1 px-4 py-3 border rounded-xl text-lg font-bold text-center",
                          theme === 'dark'
                            ? 'border-gray-700 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-900'
                        )}
                      />
                      <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {selectedBom?.outputUnit || 'unidades'}
                      </span>
                    </div>
                    {selectedBom && quantityToProduce > 0 && (
                      <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                        = {(quantityToProduce / selectedBom.outputQuantity).toFixed(2)} lotes de la receta
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={cn(
                      "flex items-center gap-2 text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      <Calendar className="w-4 h-4" />
                      Fecha programada
                    </label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl",
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    />
                  </div>
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

            {/* Step 3: Materials Check */}
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
                    Verificación de Materiales
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
                    "flex items-center gap-2 p-4 rounded-xl",
                    theme === 'dark' ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-700'
                  )}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">
                      Algunos materiales no tienen stock suficiente en el almacén seleccionado
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  {materialRequirements.map((material, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border",
                        !material.hasStock
                          ? theme === 'dark' ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'
                          : theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {material.hasStock ? (
                          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Check className="w-4 h-4 text-green-500" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                            <X className="w-4 h-4 text-red-500" />
                          </div>
                        )}
                        <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {material.productName}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Necesita: {material.required.toFixed(2)} {material.unit}
                        </p>
                        <p className={cn(
                          "text-xs",
                          material.hasStock
                            ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                            : theme === 'dark' ? 'text-red-400' : 'text-red-600'
                        )}>
                          Disponible: {material.available.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
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
                  Confirmar Orden
                </h2>

                {/* Recipe Summary */}
                <div className={cn("rounded-xl p-4", theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50')}>
                  <h3 className={cn("font-medium mb-3 flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <BookOpen className="w-5 h-5 text-purple-600" />
                    Receta
                  </h3>
                  <div className="flex items-center gap-4">
                    {selectedBom?.productImage ? (
                      <img src={selectedBom.productImage} alt="" className="w-16 h-16 rounded-lg object-cover" />
                    ) : (
                      <div className={cn("w-16 h-16 rounded-lg flex items-center justify-center", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedBom?.bomName}
                      </p>
                      <p className="text-sm text-gray-500">{selectedBom?.productName}</p>
                    </div>
                  </div>
                </div>

                {/* Production Summary */}
                <div className={cn("rounded-xl p-4", theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50')}>
                  <h3 className={cn("font-medium mb-3 flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <Factory className="w-5 h-5 text-purple-600" />
                    Producción
                  </h3>
                  <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Almacén</dt>
                      <dd className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedWarehouse?.name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Cantidad</dt>
                      <dd className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {quantityToProduce} {selectedBom?.outputUnit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Lotes</dt>
                      <dd className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {selectedBom ? (quantityToProduce / selectedBom.outputQuantity).toFixed(2) : 0}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Fecha</dt>
                      <dd className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {scheduledDate ? new Date(scheduledDate).toLocaleDateString('es-ES') : 'Sin programar'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Cost Summary */}
                <div className={cn(
                  "rounded-xl p-4 border-2",
                  theme === 'dark' ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'
                )}>
                  <h3 className={cn("font-medium mb-3 flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Costos Estimados
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Costo total materiales</p>
                      <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(totalMaterialCost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-emerald-600">Costo por unidad</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(unitCost)}
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
                onClick={createOrder}
                disabled={saving || hasInsufficientStock}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-colors",
                  hasInsufficientStock
                    ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                )}
                whileHover={!saving && !hasInsufficientStock ? { scale: 1.02 } : {}}
                whileTap={!saving && !hasInsufficientStock ? { scale: 0.98 } : {}}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Crear Orden
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
                  onClick={() => router.push('/dashboard/market/production')}
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
