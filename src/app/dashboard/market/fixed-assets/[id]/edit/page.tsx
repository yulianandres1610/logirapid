'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Check,
  Box,
  MapPin,
  DollarSign,
  Barcode,
  AlertTriangle,
  Save
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface Category {
  id: number
  name: string
  code: string
}

interface Warehouse {
  id: number
  name: string
}

interface Employee {
  id: number
  firstName: string
  lastName: string
  fullName: string
  role: string
  email: string
}

interface Supplier {
  id: number
  name: string
}

type Step = 'basic' | 'location' | 'financial' | 'technical'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'basic', title: 'Básico', description: 'Nombre y tipo', icon: Box },
  { id: 'location', title: 'Ubicación', description: 'Almacén y responsable', icon: MapPin },
  { id: 'financial', title: 'Financiero', description: 'Costos y fechas', icon: DollarSign },
  { id: 'technical', title: 'Técnico', description: 'Detalles y revisión', icon: Barcode }
]

const ASSET_TYPES = [
  { value: 'hardware', label: 'Hardware/Equipos de Cómputo' },
  { value: 'furniture', label: 'Mobiliario' },
  { value: 'equipment', label: 'Equipamiento' },
  { value: 'vehicle', label: 'Vehículo' },
  { value: 'other', label: 'Otro' }
]

const CONDITIONS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'good', label: 'Bueno' },
  { value: 'fair', label: 'Regular' },
  { value: 'poor', label: 'Malo' }
]

export default function EditFixedAssetPage() {
  const router = useRouter()
  const params = useParams()
  const assetId = params.id as string
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [currentStep, setCurrentStep] = useState<Step>('basic')
  const [loading, setLoading] = useState(false)
  const [loadingAsset, setLoadingAsset] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [assetCode, setAssetCode] = useState('')
  const [movementReason, setMovementReason] = useState('')

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    assetType: '',
    warehouseId: '',
    locationCode: '',
    responsibleEmployeeId: '',
    acquisitionDate: '',
    acquisitionCost: '',
    currency: 'USD',
    currentValue: '',
    supplierId: '',
    invoiceNumber: '',
    serialNumber: '',
    brand: '',
    model: '',
    condition: 'good',
    notes: '',
    imageUrl: '',
    status: 'active'
  })

  // Original values to detect changes
  const [originalForm, setOriginalForm] = useState(form)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Fetch data for dropdowns and asset
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, whRes, empRes, supRes, assetRes] = await Promise.all([
          fetch('/api/market/fixed-assets/categories?flat=true'),
          fetch('/api/market/warehouses'),
          fetch('/api/market/accounting/employees'),
          fetch('/api/market/suppliers'),
          fetch(`/api/market/fixed-assets/${assetId}`)
        ])

        const [catData, whData, empData, supData, assetData] = await Promise.all([
          catRes.json(),
          whRes.json(),
          empRes.json(),
          supRes.json(),
          assetRes.json()
        ])

        if (catData.success) setCategories(catData.data)
        if (whData.success) setWarehouses(whData.data.warehouses || whData.data || [])
        if (empData.success) setEmployees(empData.data.employees || empData.data || [])
        if (supData.success) setSuppliers(supData.data.suppliers || supData.data || [])

        if (assetData.success && assetData.data?.asset) {
          const asset = assetData.data.asset
          setAssetCode(asset.assetCode)
          const formData = {
            name: asset.name || '',
            description: asset.description || '',
            categoryId: asset.categoryId?.toString() || '',
            assetType: asset.assetType || '',
            warehouseId: asset.warehouseId?.toString() || '',
            locationCode: asset.locationCode || '',
            responsibleEmployeeId: asset.responsibleEmployeeId?.toString() || '',
            acquisitionDate: asset.acquisitionDate ? asset.acquisitionDate.split('T')[0] : '',
            acquisitionCost: asset.acquisitionCost?.toString() || '',
            currency: asset.currency || 'USD',
            currentValue: asset.currentValue?.toString() || '',
            supplierId: asset.supplierId?.toString() || '',
            invoiceNumber: asset.invoiceNumber || '',
            serialNumber: asset.serialNumber || '',
            brand: asset.brand || '',
            model: asset.model || '',
            condition: asset.condition || 'good',
            notes: asset.notes || '',
            imageUrl: asset.imageUrl || '',
            status: asset.status || 'active'
          }
          setForm(formData)
          setOriginalForm(formData)
        } else {
          showNotification('error', 'Error', 'No se pudo cargar el activo')
          router.push('/dashboard/market/fixed-assets')
        }
      } catch {
        console.error('Error fetching data')
        showNotification('error', 'Error', 'Error al cargar los datos')
      } finally {
        setLoadingAsset(false)
      }
    }
    fetchData()
  }, [assetId, router, showNotification])

  // Validate step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}
    switch (step) {
      case 'basic':
        if (!form.name.trim()) newErrors.name = 'El nombre del activo es requerido'
        break
      case 'location':
      case 'financial':
      case 'technical':
        break
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Navigate steps
  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id)
  }

  // Check what changed
  const getChanges = () => {
    const changes: string[] = []
    if (form.warehouseId !== originalForm.warehouseId || form.locationCode !== originalForm.locationCode) {
      changes.push('ubicación')
    }
    if (form.responsibleEmployeeId !== originalForm.responsibleEmployeeId) {
      changes.push('responsable')
    }
    if (form.status !== originalForm.status) {
      changes.push('estado')
    }
    if (form.name !== originalForm.name) changes.push('nombre')
    if (form.categoryId !== originalForm.categoryId) changes.push('categoría')
    if (form.condition !== originalForm.condition) changes.push('condición')
    return changes
  }

  const handleSubmit = async () => {
    if (!validateStep('technical')) return
    if (!form.name.trim()) {
      showNotification('error', 'Error', 'El nombre del activo es requerido')
      setCurrentStep('basic')
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/market/fixed-assets/${assetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          categoryId: form.categoryId ? parseInt(form.categoryId) : null,
          assetType: form.assetType || null,
          warehouseId: form.warehouseId ? parseInt(form.warehouseId) : null,
          locationCode: form.locationCode || null,
          responsibleEmployeeId: form.responsibleEmployeeId ? parseInt(form.responsibleEmployeeId) : null,
          acquisitionDate: form.acquisitionDate || null,
          acquisitionCost: form.acquisitionCost ? parseFloat(form.acquisitionCost) : null,
          currency: form.currency,
          currentValue: form.currentValue ? parseFloat(form.currentValue) : null,
          supplierId: form.supplierId ? parseInt(form.supplierId) : null,
          invoiceNumber: form.invoiceNumber || null,
          serialNumber: form.serialNumber || null,
          brand: form.brand || null,
          model: form.model || null,
          condition: form.condition,
          notes: form.notes || null,
          imageUrl: form.imageUrl || null,
          status: form.status,
          movementReason: movementReason || `Edición de activo: ${getChanges().join(', ') || 'datos actualizados'}`
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Activo actualizado', `Se ha actualizado el activo ${assetCode}`)
        router.push(`/dashboard/market/fixed-assets/${assetId}`)
      } else {
        showNotification('error', 'Error', data.error || 'Error al actualizar el activo')
      }
    } catch {
      showNotification('error', 'Error de conexión', 'No se pudo actualizar el activo')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = cn(
    "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all",
    theme === 'dark'
      ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  )

  const labelClass = cn(
    "block text-sm font-medium mb-2",
    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
  )

  // Summary data for final step
  const getSummary = () => {
    const category = categories.find(c => c.id === parseInt(form.categoryId))
    const warehouse = warehouses.find(w => w.id === parseInt(form.warehouseId))
    const employee = employees.find(e => e.id === parseInt(form.responsibleEmployeeId))
    const supplier = suppliers.find(s => s.id === parseInt(form.supplierId))
    const assetType = ASSET_TYPES.find(t => t.value === form.assetType)
    const condition = CONDITIONS.find(c => c.value === form.condition)

    return {
      category: category ? `${category.code ? `[${category.code}] ` : ''}${category.name}` : null,
      warehouse: warehouse?.name,
      employee: employee ? (employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email) : null,
      supplier: supplier?.name,
      assetType: assetType?.label,
      condition: condition?.label
    }
  }

  const summary = getSummary()

  if (loadingAsset) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <Loader2 className={cn("w-12 h-12 animate-spin mx-auto mb-4", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Cargando activo...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="text-center mb-4">
              <Link
                href={`/dashboard/market/fixed-assets/${assetId}`}
                className={cn(
                  "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al activo
              </Link>
              <h1 className={cn(
                "text-2xl sm:text-3xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Editar Activo Fijo
              </h1>
              <p className={cn(
                "text-sm mt-1 font-mono",
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              )}>
                {assetCode}
              </p>
            </div>

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div className="relative w-14 h-14">
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
                                ? 'rgba(59, 130, 246, 0.5)'
                                : 'rgba(37, 99, 235, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#3B82F6' : '#2563EB'
                              : currentStepIndex > index
                                ? theme === 'dark' ? '#10B981' : '#059669'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                          }}
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                            "transition-shadow duration-300",
                            currentStep === step.id && (
                              theme === 'dark'
                                ? 'shadow-lg shadow-blue-500/50'
                                : 'shadow-lg shadow-blue-400/50'
                            )
                          )}
                        >
                          {currentStepIndex > index ? (
                            <Check className="w-7 h-7 text-white" />
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
                            ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            : currentStepIndex > index
                              ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                              : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {step.title}
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
                          animate={{ scaleX: currentStepIndex > index ? 1 : 0 }}
                          className={cn(
                            "h-full origin-left rounded-full",
                            theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
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
            >
              <AnimatePresence mode="wait">
                {/* Step 1: Basic Info */}
                {currentStep === 'basic' && (
                  <motion.div
                    key="basic"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Box className="w-5 h-5 text-white" />
                      </div>
                      Información Básica
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={labelClass}>Nombre del Activo *</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="Ej: Servidor Dell PowerEdge R740"
                          className={cn(inputClass, errors.name && 'border-red-500')}
                        />
                        {errors.name && (
                          <p className="text-red-500 text-sm mt-1 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            {errors.name}
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <label className={labelClass}>Descripción</label>
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          placeholder="Descripción detallada del activo..."
                          rows={3}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Categoría</label>
                        <select
                          value={form.categoryId}
                          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Seleccionar categoría</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.code ? `[${cat.code}] ` : ''}{cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={labelClass}>Tipo de Activo</label>
                        <select
                          value={form.assetType}
                          onChange={(e) => setForm({ ...form, assetType: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Seleccionar tipo</option>
                          {ASSET_TYPES.map(type => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Location */}
                {currentStep === 'location' && (
                  <motion.div
                    key="location"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      Ubicación y Responsable
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={labelClass}>Almacén/Ubicación</label>
                        <select
                          value={form.warehouseId}
                          onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Seleccionar ubicación</option>
                          {warehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={labelClass}>Código de Ubicación</label>
                        <input
                          type="text"
                          value={form.locationCode}
                          onChange={(e) => setForm({ ...form, locationCode: e.target.value })}
                          placeholder="Ej: Oficina 201, Rack A3"
                          className={inputClass}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className={labelClass}>Responsable</label>
                        <select
                          value={form.responsibleEmployeeId}
                          onChange={(e) => setForm({ ...form, responsibleEmployeeId: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Seleccionar responsable</option>
                          {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Financial */}
                {currentStep === 'financial' && (
                  <motion.div
                    key="financial"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                      Información Financiera
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={labelClass}>Fecha de Adquisición</label>
                        <input
                          type="date"
                          value={form.acquisitionDate}
                          onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Costo de Adquisición</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={form.acquisitionCost}
                            onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })}
                            placeholder="0.00"
                            className={cn(inputClass, "flex-1")}
                          />
                          <select
                            value={form.currency}
                            onChange={(e) => setForm({ ...form, currency: e.target.value })}
                            className={cn(inputClass, "w-24")}
                          >
                            <option value="USD">USD</option>
                            <option value="CUP">CUP</option>
                            <option value="EUR">EUR</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Valor Actual</label>
                        <input
                          type="number"
                          step="0.01"
                          value={form.currentValue}
                          onChange={(e) => setForm({ ...form, currentValue: e.target.value })}
                          placeholder="Valor actual del activo"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Proveedor</label>
                        <select
                          value={form.supplierId}
                          onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">Seleccionar proveedor</option>
                          {suppliers.map(sup => (
                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className={labelClass}>Número de Factura</label>
                        <input
                          type="text"
                          value={form.invoiceNumber}
                          onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                          placeholder="Ej: FAC-2025-001"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Technical + Review */}
                {currentStep === 'technical' && (
                  <motion.div
                    key="technical"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <Barcode className="w-5 h-5 text-white" />
                      </div>
                      Información Técnica
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={labelClass}>Número de Serie</label>
                        <input
                          type="text"
                          value={form.serialNumber}
                          onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                          placeholder="Ej: SN123456789"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Marca</label>
                        <input
                          type="text"
                          value={form.brand}
                          onChange={(e) => setForm({ ...form, brand: e.target.value })}
                          placeholder="Ej: Dell, HP, Lenovo"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Modelo</label>
                        <input
                          type="text"
                          value={form.model}
                          onChange={(e) => setForm({ ...form, model: e.target.value })}
                          placeholder="Ej: PowerEdge R740"
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>Condición</label>
                        <select
                          value={form.condition}
                          onChange={(e) => setForm({ ...form, condition: e.target.value })}
                          className={inputClass}
                        >
                          {CONDITIONS.map(cond => (
                            <option key={cond.value} value={cond.value}>{cond.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className={labelClass}>Notas</label>
                        <textarea
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          placeholder="Notas adicionales..."
                          rows={3}
                          className={inputClass}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className={labelClass}>Razón del cambio (opcional)</label>
                        <input
                          type="text"
                          value={movementReason}
                          onChange={(e) => setMovementReason(e.target.value)}
                          placeholder="Ej: Actualización de datos, corrección de información..."
                          className={inputClass}
                        />
                        <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                          Esta razón se registrará en el historial de movimientos del activo
                        </p>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className={cn(
                      "mt-8 p-6 rounded-xl",
                      theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'
                    )}>
                      <h3 className={cn(
                        "text-lg font-semibold mb-4 flex items-center gap-2",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Check className="w-5 h-5 text-green-500" />
                        Resumen de Cambios
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Nombre</p>
                          <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{form.name || '-'}</p>
                        </div>

                        {summary.category && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Categoría</p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{summary.category}</p>
                          </div>
                        )}

                        {summary.warehouse && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Ubicación</p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {summary.warehouse}{form.locationCode && ` - ${form.locationCode}`}
                            </p>
                          </div>
                        )}

                        {summary.employee && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Responsable</p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{summary.employee}</p>
                          </div>
                        )}

                        <div>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Condición</p>
                          <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{summary.condition}</p>
                        </div>
                      </div>
                    </div>
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
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </motion.button>

              {currentStep === 'technical' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={loading}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
                    'text-white shadow-lg'
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Guardar Cambios
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
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-blue-500 hover:bg-blue-600',
                    'text-white'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
