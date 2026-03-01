'use client'

import { useEffect, useState, Suspense } from 'react'
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
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  FileCheck,
  ClipboardList,
  Search,
  StickyNote,
  ArrowRightLeft
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
  unitCost: number
}

type Step = 'formula' | 'details' | 'materials' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'formula', title: 'Fórmula', description: 'Qué producir', icon: FlaskConical },
  { id: 'details', title: 'Detalles', description: 'Cuándo y cuánto', icon: ClipboardList },
  { id: 'materials', title: 'Materiales', description: 'Disponibilidad', icon: Layers },
  { id: 'review', title: 'Confirmar', description: 'Revisar y crear', icon: FileCheck }
]

function CreatePlanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()

  const [currentStep, setCurrentStep] = useState<Step>('formula')
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

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
  const [formulaSearch, setFormulaSearch] = useState('')

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingStock, setCheckingStock] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

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
      const response = await fetch(`/api/market/production/formulas/${formulaId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.lines) {
          const yieldQty = data.data.yieldQuantity || 1
          const multiplier = plannedQuantity / yieldQty

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
              isAvailable: availableStock >= quantityRequired,
              unitCost: line.unitCost || 0
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
    if (plannedQuantity === 0) {
      setPlannedQuantity(formula.yieldQuantity)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

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
  const allMaterialsAvailable = calculatedMaterials.length > 0 && calculatedMaterials.every(m => m.isAvailable)
  const shortageCount = calculatedMaterials.filter(m => !m.isAvailable).length

  const validateStep = (step: Step): boolean => {
    setError(null)
    switch (step) {
      case 'formula':
        if (!formulaId || !selectedFormula) { setError('Selecciona una fórmula de producción'); return false }
        return true
      case 'details':
        if (!plannedDate) { setError('Selecciona la fecha planificada'); return false }
        if (plannedQuantity <= 0) { setError('La cantidad debe ser mayor a 0'); return false }
        if (!warehouseId) { setError('Selecciona el almacén de materiales'); return false }
        return true
      case 'materials':
        return true
      default:
        return true
    }
  }

  const goToNextStep = async () => {
    if (!validateStep(currentStep)) return
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      const nextStep = STEPS[nextIndex].id
      if (nextStep === 'materials') {
        await checkMaterialAvailability()
      }
      setCurrentStep(nextStep)
    }
  }

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) { setCurrentStep(STEPS[prevIndex].id); setError(null) }
  }

  const handleSubmit = async () => {
    setError(null)
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

  // Filter formulas by search
  const filteredFormulas = formulaSearch.trim()
    ? formulas.filter(f =>
      f.name.toLowerCase().includes(formulaSearch.toLowerCase()) ||
      f.code.toLowerCase().includes(formulaSearch.toLowerCase()) ||
      f.targetProductName.toLowerCase().includes(formulaSearch.toLowerCase())
    )
    : formulas

  const selectedWarehouse = warehouses.find(w => w.id === warehouseId)
  const selectedTargetWarehouse = warehouses.find(w => w.id === targetWarehouseId)

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
                if (isCompleted || index <= currentStepIndex) {
                  setError(null)
                  setCurrentStep(step.id)
                }
              }}
            >
              <motion.div
                initial={false}
                animate={{ scale: isActive ? 1.1 : 1 }}
                className={cn(
                  'w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all',
                  isCompleted && 'border-blue-600 bg-blue-600',
                  isActive && 'border-blue-600 bg-blue-600',
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
                isActive ? 'text-blue-600' : 'text-gray-500'
              )}>
                {step.title}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <div className={cn(
                'w-8 sm:w-12 h-0.5 mx-1 sm:mx-2 -mt-5',
                index < currentStepIndex ? 'bg-blue-600' : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )

  // Step 1: Formula Selection
  const FormulaStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
        )}>
          <FlaskConical className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Selecciona la Fórmula
        </h2>
        <p className="text-gray-500 mt-2">
          Elige qué producto vas a fabricar
        </p>
      </div>

      {selectedFormula ? (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'p-6 rounded-2xl border-2 border-blue-500',
            theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
          )}
        >
          <div className="flex items-center gap-4">
            {selectedFormula.targetProductImage ? (
              <img
                src={selectedFormula.targetProductImage}
                alt={selectedFormula.targetProductName}
                className="w-20 h-20 rounded-xl object-cover"
              />
            ) : (
              <div className={cn('w-20 h-20 rounded-xl flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                <Package className="w-10 h-10 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {selectedFormula.name}
              </h3>
              <p className="text-gray-500 text-sm">
                {selectedFormula.code} &middot; Produce {selectedFormula.yieldQuantity} {selectedFormula.yieldUnit}
              </p>
              <div className="flex gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                <span>{selectedFormula.materialCount} materiales</span>
                <span>Costo est.: {formatCurrency(selectedFormula.estimatedMaterialsCost + selectedFormula.laborCostPerBatch)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormulaId(null)
                setSelectedFormula(null)
                setPlannedQuantity(0)
                setCalculatedMaterials([])
              }}
              className="p-2 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-xl shrink-0"
            >
              <X className="w-5 h-5 text-blue-600" />
            </button>
          </div>
        </motion.div>
      ) : formulas.length === 0 ? (
        <div className={cn(
          'p-8 rounded-2xl border-2 border-dashed text-center',
          theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
        )}>
          <FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className={cn('font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            No hay fórmulas activas
          </p>
          <Link
            href="/dashboard/market/production/formulas/create"
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            Crear primera fórmula
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={formulaSearch}
              onChange={(e) => setFormulaSearch(e.target.value)}
              placeholder="Buscar fórmula por nombre, código o producto..."
              autoFocus
              className={cn(
                'w-full pl-12 pr-4 py-4 rounded-xl border text-lg',
                theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200',
                'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              )}
            />
            {formulaSearch && (
              <button
                type="button"
                onClick={() => setFormulaSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Formula Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-auto pr-1">
            {filteredFormulas.map(formula => (
              <motion.button
                key={formula.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => selectFormula(formula)}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 hover:border-blue-500'
                    : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md'
                )}
              >
                <div className="flex items-start gap-3">
                  {formula.targetProductImage ? (
                    <img
                      src={formula.targetProductImage}
                      alt={formula.targetProductName}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className={cn(
                      'w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Package className="w-7 h-7 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn('font-semibold truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {formula.name}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {formula.targetProductName}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        {formula.code}
                      </span>
                      <span>{formula.yieldQuantity} {formula.yieldUnit}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 mt-1" />
                </div>
              </motion.button>
            ))}
          </div>

          {filteredFormulas.length === 0 && formulaSearch && (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No se encontraron fórmulas para "{formulaSearch}"</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )

  // Step 2: Details
  const DetailsStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
        )}>
          <ClipboardList className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Detalles del Plan
        </h2>
        <p className="text-gray-500 mt-2">
          Define cuándo, cuánto y dónde se producirá <span className="font-medium">{selectedFormula?.targetProductName}</span>
        </p>
      </div>

      <div className={cn(
        'p-6 rounded-2xl border',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date */}
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              <Calendar className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Fecha Planificada *
            </label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-xl border text-lg',
                theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              )}
            />
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              <Package className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Cantidad a Producir *
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={plannedQuantity}
                onChange={(e) => setPlannedQuantity(parseFloat(e.target.value) || 0)}
                min="0.001"
                step="0.001"
                className={cn(
                  'flex-1 px-4 py-3 rounded-xl border text-lg font-medium',
                  theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                  'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                )}
              />
              <span className={cn(
                'text-sm px-3 py-3 rounded-xl border',
                theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'
              )}>
                {selectedFormula?.yieldUnit || 'unidades'}
              </span>
            </div>
            {selectedFormula && (
              <p className="text-xs text-gray-500">
                1 lote produce {selectedFormula.yieldQuantity} {selectedFormula.yieldUnit}
                {plannedQuantity > 0 && selectedFormula.yieldQuantity > 0 && (
                  <span className="ml-1">
                    &middot; ~{(plannedQuantity / selectedFormula.yieldQuantity).toFixed(1)} lotes
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Source Warehouse */}
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              <Warehouse className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Almacén de Materiales *
            </label>
            <select
              value={warehouseId || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value) || null
                setWarehouseId(val)
                if (!targetWarehouseId) setTargetWarehouseId(val)
              }}
              className={cn(
                'w-full px-4 py-3 rounded-xl border text-lg',
                theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              )}
            >
              <option value="">Seleccionar almacén</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">De dónde se tomarán las materias primas</p>
          </div>

          {/* Target Warehouse */}
          <div className="space-y-2">
            <label className={cn('block text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              <ArrowRightLeft className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Almacén Destino
            </label>
            <select
              value={targetWarehouseId || warehouseId || ''}
              onChange={(e) => setTargetWarehouseId(parseInt(e.target.value) || null)}
              className={cn(
                'w-full px-4 py-3 rounded-xl border text-lg',
                theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
                'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              )}
            >
              <option value="">Mismo almacén</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Dónde se almacenará el producto terminado</p>
          </div>
        </div>

        {/* Notes */}
        <div className="mt-6 space-y-2">
          <label className={cn('block text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            <StickyNote className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Instrucciones especiales, prioridad, o notas para el equipo de producción..."
            className={cn(
              'w-full px-4 py-3 rounded-xl border resize-none',
              theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200',
              'focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            )}
          />
        </div>
      </div>

      {/* Quick cost preview */}
      {selectedFormula && plannedQuantity > 0 && (
        <div className={cn(
          'p-4 rounded-xl',
          theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
        )}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                Costo estimado:
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={cn(theme === 'dark' ? 'text-blue-200' : 'text-blue-800')}>
                Total: <span className="font-bold">{formatCurrency(costs.totalCost)}</span>
              </span>
              <span className={cn(theme === 'dark' ? 'text-blue-200' : 'text-blue-800')}>
                Por unidad: <span className="font-bold">{formatCurrency(costs.costPerUnit)}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )

  // Step 3: Materials Availability
  const MaterialsStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
        )}>
          <Layers className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Disponibilidad de Materiales
        </h2>
        <p className="text-gray-500 mt-2">
          Verificación del stock necesario para producir {plannedQuantity} {selectedFormula?.yieldUnit}
        </p>
      </div>

      {checkingStock ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-gray-500">Verificando disponibilidad de materiales...</p>
        </div>
      ) : calculatedMaterials.length === 0 ? (
        <div className={cn(
          'p-8 rounded-2xl border-2 border-dashed text-center',
          theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
        )}>
          <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className={cn('font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            No se pudieron verificar los materiales
          </p>
          <button
            type="button"
            onClick={checkMaterialAvailability}
            className="text-blue-600 hover:underline mt-2 inline-flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {/* Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-4 rounded-xl border flex items-center gap-3',
              allMaterialsAvailable
                ? theme === 'dark' ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
                : theme === 'dark' ? 'bg-amber-900/20 border-amber-800' : 'bg-amber-50 border-amber-200'
            )}
          >
            {allMaterialsAvailable ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className={cn('font-semibold', theme === 'dark' ? 'text-green-300' : 'text-green-800')}>
                    Todo el stock disponible
                  </p>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                    Todos los materiales tienen stock suficiente para esta producción
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <p className={cn('font-semibold', theme === 'dark' ? 'text-amber-300' : 'text-amber-800')}>
                    {shortageCount} material(es) con stock insuficiente
                  </p>
                  <p className={cn('text-sm', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')}>
                    Puedes crear el plan, pero deberás reabastecer antes de iniciar producción
                  </p>
                </div>
              </>
            )}
          </motion.div>

          {/* Materials Table */}
          <div className={cn(
            'rounded-2xl border overflow-hidden',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}>
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn(
                    'border-b',
                    theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                  )}>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Material</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Requerido</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Disponible</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Faltante</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Estado</th>
                  </tr>
                </thead>
                <tbody className={cn('divide-y', theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100')}>
                  {calculatedMaterials.map((mat, index) => (
                    <tr key={index} className={cn(
                      !mat.isAvailable && (theme === 'dark' ? 'bg-amber-900/10' : 'bg-amber-50/50')
                    )}>
                      <td className={cn('py-3 px-4 font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {mat.materialName}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-500">
                        {mat.quantityRequired.toFixed(2)} {mat.materialUnit}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-500">
                        {mat.availableStock.toFixed(2)} {mat.materialUnit}
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {mat.isAvailable ? (
                          <span className="text-green-600">-</span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            {(mat.quantityRequired - mat.availableStock).toFixed(2)} {mat.materialUnit}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {mat.isAvailable ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3.5 h-3.5" />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Faltante
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {calculatedMaterials.map((mat, index) => (
                <div
                  key={index}
                  className={cn(
                    'p-4',
                    !mat.isAvailable && (theme === 'dark' ? 'bg-amber-900/10' : 'bg-amber-50/50')
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {mat.materialName}
                    </p>
                    {mat.isAvailable ? (
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Requerido: </span>
                      <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        {mat.quantityRequired.toFixed(2)} {mat.materialUnit}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Disponible: </span>
                      <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        {mat.availableStock.toFixed(2)} {mat.materialUnit}
                      </span>
                    </div>
                    {!mat.isAvailable && (
                      <div className="col-span-2">
                        <span className="text-red-600 font-medium">
                          Faltante: {(mat.quantityRequired - mat.availableStock).toFixed(2)} {mat.materialUnit}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Refresh */}
          <div className="text-center">
            <button
              type="button"
              onClick={checkMaterialAvailability}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar disponibilidad
            </button>
          </div>
        </>
      )}
    </motion.div>
  )

  // Step 4: Review & Confirm
  const ReviewStep = () => (
    <motion.div
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
          Revisar Plan de Producción
        </h2>
        <p className="text-gray-500 mt-2">
          Verifica los datos antes de crear el plan
        </p>
      </div>

      {/* Product Info */}
      <div className={cn(
        'p-6 rounded-2xl border',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <h3 className={cn('font-semibold mb-4 flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          <FlaskConical className="w-5 h-5 text-blue-600" />
          Fórmula y Producto
        </h3>
        <div className="flex items-center gap-4 mb-4">
          {selectedFormula?.targetProductImage ? (
            <img
              src={selectedFormula.targetProductImage}
              alt={selectedFormula.targetProductName}
              className="w-16 h-16 rounded-xl object-cover"
            />
          ) : (
            <div className={cn('w-16 h-16 rounded-xl flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div>
            <p className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {selectedFormula?.name}
            </p>
            <p className="text-gray-500">
              {selectedFormula?.code} &middot; {selectedFormula?.targetProductName}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Fecha</p>
            <p className={cn('font-medium mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {new Date(plannedDate + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Cantidad</p>
            <p className={cn('font-medium mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {plannedQuantity} {selectedFormula?.yieldUnit}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Almacén Materiales</p>
            <p className={cn('font-medium mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {selectedWarehouse?.name || '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Almacén Destino</p>
            <p className={cn('font-medium mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {selectedTargetWarehouse?.name || selectedWarehouse?.name || '-'}
            </p>
          </div>
        </div>

        {notes && (
          <div className={cn(
            'mt-4 p-3 rounded-xl',
            theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
          )}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notas</p>
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{notes}</p>
          </div>
        )}
      </div>

      {/* Materials Summary */}
      {calculatedMaterials.length > 0 && (
        <div className={cn(
          'p-6 rounded-2xl border',
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        )}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn('font-semibold flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Layers className="w-5 h-5 text-blue-600" />
              Materiales ({calculatedMaterials.length})
            </h3>
            {allMaterialsAvailable ? (
              <span className="inline-flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                Stock OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                {shortageCount} faltante(s)
              </span>
            )}
          </div>
          <div className="space-y-2">
            {calculatedMaterials.map((mat, index) => (
              <div key={index} className={cn(
                'flex items-center justify-between py-2 border-b last:border-0',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
              )}>
                <div className="flex items-center gap-2">
                  {mat.isAvailable ? (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {mat.materialName}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {mat.quantityRequired.toFixed(2)} {mat.materialUnit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Summary */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-white">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-wide">Materiales</p>
            <p className="text-lg sm:text-xl font-bold mt-1">{formatCurrency(costs.materialsCost)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-wide">Mano de Obra</p>
            <p className="text-lg sm:text-xl font-bold mt-1">{formatCurrency(costs.laborCost)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-wide">Total</p>
            <p className="text-lg sm:text-xl font-bold mt-1">{formatCurrency(costs.totalCost)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-wide">Costo/Unidad</p>
            <p className="text-lg sm:text-xl font-bold mt-1">{formatCurrency(costs.costPerUnit)}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )

  const renderStep = () => {
    switch (currentStep) {
      case 'formula': return <FormulaStep />
      case 'details': return <DetailsStep />
      case 'materials': return <MaterialsStep />
      case 'review': return <ReviewStep />
      default: return null
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/dashboard/market/production/planning"
              className={cn(
                'p-2 rounded-xl border transition-colors',
                theme === 'dark' ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-100'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className={cn('text-2xl font-bold flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Calendar className="w-7 h-7 text-blue-600" />
                Nueva Planificación
              </h1>
            </div>
          </div>

          {/* Step Indicator */}
          <StepIndicator />

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
                {saving ? 'Creando...' : 'Crear Plan de Producción'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goToNextStep}
                className="flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all bg-blue-600 hover:bg-blue-700 text-white"
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

export default function CreatePlanPage() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    }>
      <CreatePlanContent />
    </Suspense>
  )
}
