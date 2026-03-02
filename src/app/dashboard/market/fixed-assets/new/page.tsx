'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  Camera,
  Upload,
  Smartphone,
  X,
  Image as ImageIcon,
  Trash2,
  Receipt
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { PhoneUploadModal } from '@/components/uploads/PhoneUploadModal'

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

type Step = 'basic' | 'photo' | 'location' | 'financial' | 'technical'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'basic', title: 'Básico', description: 'Nombre y tipo', icon: Box },
  { id: 'photo', title: 'Foto', description: 'Imagen del activo', icon: Camera },
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

export default function NewFixedAssetPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const invoiceFileInputRef = useRef<HTMLInputElement>(null)

  const [currentStep, setCurrentStep] = useState<Step>('basic')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Photo state
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [showPhoneUpload, setShowPhoneUpload] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Invoice image state
  const [uploadingInvoice, setUploadingInvoice] = useState(false)
  const [invoiceImagePreview, setInvoiceImagePreview] = useState<string | null>(null)
  const [showPhoneUploadInvoice, setShowPhoneUploadInvoice] = useState(false)
  const [dragOverInvoice, setDragOverInvoice] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    assetType: '',
    warehouseId: '',
    locationCode: '',
    responsibleEmployeeId: '',
    acquisitionDate: new Date().toISOString().split('T')[0],
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
    invoiceImageUrl: ''
  })

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Fetch data for dropdowns
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, whRes, empRes, supRes] = await Promise.all([
          fetch('/api/market/fixed-assets/categories?flat=true'),
          fetch('/api/market/warehouses'),
          fetch('/api/market/accounting/employees'),
          fetch('/api/market/suppliers')
        ])

        const [catData, whData, empData, supData] = await Promise.all([
          catRes.json(),
          whRes.json(),
          empRes.json(),
          supRes.json()
        ])

        if (catData.success) setCategories(catData.data)
        if (whData.success) setWarehouses(whData.data.warehouses || whData.data || [])
        if (empData.success) setEmployees(empData.data.employees || empData.data || [])
        if (supData.success) setSuppliers(supData.data.suppliers || supData.data || [])
      } catch {
        console.error('Error fetching form data')
      }
    }
    fetchData()
  }, [])

  // Upload image file
  const handleFileUpload = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showNotification('error', 'Formato no válido', 'Solo se permiten imágenes JPG, PNG y WebP')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotification('error', 'Archivo muy grande', 'La imagen no puede superar los 10MB')
      return
    }

    setUploading(true)
    try {
      // Show preview immediately
      const reader = new FileReader()
      reader.onload = (e) => setImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)

      const formData = new FormData()
      formData.append('image', file)
      if (form.imageUrl) {
        formData.append('oldImageUrl', form.imageUrl)
      }

      const res = await fetch('/api/market/fixed-assets/upload-image', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (data.success) {
        setForm(prev => ({ ...prev, imageUrl: data.data.imageUrl }))
        showNotification('success', 'Imagen subida', 'La foto del activo se guardó correctamente')
      } else {
        setImagePreview(null)
        showNotification('error', 'Error', data.error || 'Error al subir la imagen')
      }
    } catch {
      setImagePreview(null)
      showNotification('error', 'Error de conexión', 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileUpload(file)
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  const handlePhoneUploadComplete = (fileUrl: string) => {
    setForm(prev => ({ ...prev, imageUrl: fileUrl }))
    setImagePreview(fileUrl)
    showNotification('success', 'Foto recibida', 'La foto del activo se subió desde el teléfono')
  }

  const removeImage = () => {
    setForm(prev => ({ ...prev, imageUrl: '' }))
    setImagePreview(null)
  }

  // Upload invoice image file
  const handleInvoiceFileUpload = async (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showNotification('error', 'Formato no válido', 'Solo se permiten imágenes JPG, PNG y WebP')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showNotification('error', 'Archivo muy grande', 'La imagen no puede superar los 10MB')
      return
    }

    setUploadingInvoice(true)
    try {
      const reader = new FileReader()
      reader.onload = (e) => setInvoiceImagePreview(e.target?.result as string)
      reader.readAsDataURL(file)

      const formData = new FormData()
      formData.append('image', file)
      if (form.invoiceImageUrl) {
        formData.append('oldImageUrl', form.invoiceImageUrl)
      }

      const res = await fetch('/api/market/fixed-assets/upload-image', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (data.success) {
        setForm(prev => ({ ...prev, invoiceImageUrl: data.data.imageUrl }))
        showNotification('success', 'Imagen subida', 'La foto de la factura se guardó correctamente')
      } else {
        setInvoiceImagePreview(null)
        showNotification('error', 'Error', data.error || 'Error al subir la imagen')
      }
    } catch {
      setInvoiceImagePreview(null)
      showNotification('error', 'Error de conexión', 'No se pudo subir la imagen')
    } finally {
      setUploadingInvoice(false)
    }
  }

  const handleInvoiceFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleInvoiceFileUpload(file)
    if (invoiceFileInputRef.current) invoiceFileInputRef.current.value = ''
  }

  const handleInvoiceDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverInvoice(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleInvoiceFileUpload(file)
  }

  const handlePhoneUploadInvoiceComplete = (fileUrl: string) => {
    setForm(prev => ({ ...prev, invoiceImageUrl: fileUrl }))
    setInvoiceImagePreview(fileUrl)
    showNotification('success', 'Foto recibida', 'La foto de la factura se subió desde el teléfono')
  }

  const removeInvoiceImage = () => {
    setForm(prev => ({ ...prev, invoiceImageUrl: '' }))
    setInvoiceImagePreview(null)
  }

  // Validate step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}
    switch (step) {
      case 'basic':
        if (!form.name.trim()) newErrors.name = 'El nombre del activo es requerido'
        break
      case 'photo':
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

  const handleSubmit = async () => {
    if (!validateStep('technical')) return
    if (!form.name.trim()) {
      showNotification('error', 'Error', 'El nombre del activo es requerido')
      setCurrentStep('basic')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/market/fixed-assets', {
        method: 'POST',
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
          invoiceImageUrl: form.invoiceImageUrl || null
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Activo creado', `Se ha creado el activo ${data.data.assetCode}`)
        router.push(`/dashboard/market/fixed-assets/${data.data.id}`)
      } else {
        showNotification('error', 'Error', data.error || 'Error al crear el activo')
      }
    } catch {
      showNotification('error', 'Error de conexión', 'No se pudo crear el activo')
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
                href="/dashboard/market/fixed-assets"
                className={cn(
                  "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a activos fijos
              </Link>
              <h1 className={cn(
                "text-2xl sm:text-3xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nuevo Activo Fijo
              </h1>
              <p className={cn(
                "text-sm mt-1",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Registrar un nuevo activo en el inventario
              </p>
            </div>

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div className="relative w-12 h-12 sm:w-14 sm:h-14">
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
                          transition={{
                            scale: { duration: 0.3 },
                            backgroundColor: { duration: 0.3 }
                          }}
                          whileHover={{ scale: currentStepIndex >= index ? 1.15 : 1.05 }}
                          className={cn(
                            "w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center relative z-10",
                            "transition-shadow duration-300",
                            currentStep === step.id && (
                              theme === 'dark'
                                ? 'shadow-lg shadow-blue-500/50'
                                : 'shadow-lg shadow-blue-400/50'
                            ),
                            currentStepIndex > index && (
                              theme === 'dark'
                                ? 'shadow-md shadow-green-500/30'
                                : 'shadow-md shadow-green-400/30'
                            )
                          )}
                        >
                          {currentStepIndex > index ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            >
                              <Check className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                            </motion.div>
                          ) : (
                            <step.icon className={cn(
                              "w-6 h-6 sm:w-7 sm:h-7",
                              currentStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )} />
                          )}
                        </motion.div>
                      </div>

                      <div className="mt-3 text-center">
                        <p className={cn(
                          "text-[10px] sm:text-sm font-semibold",
                          currentStep === step.id
                            ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            : currentStepIndex > index
                              ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
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
                      <div className="flex-1 h-0.5 mx-1 sm:mx-3 mb-8 sm:mb-10 relative">
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {/* Step 1: Basic Info */}
                {currentStep === 'basic' && (
                  <motion.div
                    key="basic"
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
                        <Box className="w-5 h-5 text-white" />
                      </div>
                      Información Básica
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={labelClass}>
                          Nombre del Activo *
                        </label>
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

                {/* Step 2: Photo */}
                {currentStep === 'photo' && (
                  <motion.div
                    key="photo"
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                      Foto del Activo
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Sube una foto del activo desde tu computadora o toma una con tu teléfono. Este paso es opcional.
                    </p>

                    {/* Current image preview */}
                    {(imagePreview || form.imageUrl) ? (
                      <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative"
                      >
                        <div className={cn(
                          'rounded-2xl overflow-hidden border-2',
                          theme === 'dark' ? 'border-indigo-600 bg-gray-800' : 'border-indigo-400 bg-gray-50'
                        )}>
                          <img
                            src={imagePreview || form.imageUrl}
                            alt="Preview del activo"
                            className="w-full max-h-80 object-contain mx-auto"
                          />
                        </div>
                        <div className="flex items-center justify-center gap-3 mt-4">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                              theme === 'dark'
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            )}
                          >
                            <Upload className="w-4 h-4" />
                            Cambiar foto
                          </button>
                          <button
                            type="button"
                            onClick={removeImage}
                            className={cn(
                              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                              theme === 'dark'
                                ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Drag & Drop / File Upload */}
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={handleDrop}
                          onClick={() => !uploading && fileInputRef.current?.click()}
                          className={cn(
                            'p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center',
                            dragOver
                              ? theme === 'dark'
                                ? 'border-indigo-500 bg-indigo-900/20'
                                : 'border-indigo-500 bg-indigo-50'
                              : theme === 'dark'
                                ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
                                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
                            uploading && 'pointer-events-none opacity-70'
                          )}
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-12 h-12 mx-auto mb-3 text-indigo-500 animate-spin" />
                              <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                Subiendo imagen...
                              </p>
                            </>
                          ) : (
                            <>
                              <Upload className={cn(
                                'w-12 h-12 mx-auto mb-3',
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              )} />
                              <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                Arrastra una imagen aquí
                              </p>
                              <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                o haz clic para seleccionar
                              </p>
                              <p className={cn('text-xs mt-3', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                JPG, PNG o WebP hasta 10MB
                              </p>
                            </>
                          )}
                        </div>

                        {/* Phone Upload */}
                        <div
                          onClick={() => setShowPhoneUpload(true)}
                          className={cn(
                            'p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center',
                            theme === 'dark'
                              ? 'border-gray-600 hover:border-blue-500 hover:bg-blue-900/10'
                              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                          )}
                        >
                          <Smartphone className={cn(
                            'w-12 h-12 mx-auto mb-3',
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Tomar foto con el teléfono
                          </p>
                          <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            Escanea un código QR
                          </p>
                          <p className={cn('text-xs mt-3', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                            Abre la cámara del celular
                          </p>
                        </div>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />

                    {/* Divider */}
                    <div className={cn(
                      "border-t pt-6 mt-6",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <h3 className={cn(
                        "text-lg font-bold flex items-center gap-3 mb-2",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-white" />
                        </div>
                        Imagen de Factura Original
                      </h3>
                      <p className={cn(
                        "text-sm mb-4",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Sube una foto de la factura o recibo de compra del activo. Este paso es opcional.
                      </p>

                      {/* Invoice image preview */}
                      {(invoiceImagePreview || form.invoiceImageUrl) ? (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="relative"
                        >
                          <div className={cn(
                            'rounded-2xl overflow-hidden border-2',
                            theme === 'dark' ? 'border-amber-600 bg-gray-800' : 'border-amber-400 bg-gray-50'
                          )}>
                            <img
                              src={invoiceImagePreview || form.invoiceImageUrl}
                              alt="Preview factura"
                              className="w-full max-h-80 object-contain mx-auto"
                            />
                          </div>
                          <div className="flex items-center justify-center gap-3 mt-4">
                            <button
                              type="button"
                              onClick={() => invoiceFileInputRef.current?.click()}
                              className={cn(
                                'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                                theme === 'dark'
                                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              )}
                            >
                              <Upload className="w-4 h-4" />
                              Cambiar foto
                            </button>
                            <button
                              type="button"
                              onClick={removeInvoiceImage}
                              className={cn(
                                'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors',
                                theme === 'dark'
                                  ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
                                  : 'bg-red-100 text-red-600 hover:bg-red-200'
                              )}
                            >
                              <Trash2 className="w-4 h-4" />
                              Eliminar
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Drag & Drop / File Upload for Invoice */}
                          <div
                            onDragOver={(e) => { e.preventDefault(); setDragOverInvoice(true) }}
                            onDragLeave={() => setDragOverInvoice(false)}
                            onDrop={handleInvoiceDrop}
                            onClick={() => !uploadingInvoice && invoiceFileInputRef.current?.click()}
                            className={cn(
                              'p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center',
                              dragOverInvoice
                                ? theme === 'dark'
                                  ? 'border-amber-500 bg-amber-900/20'
                                  : 'border-amber-500 bg-amber-50'
                                : theme === 'dark'
                                  ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
                                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
                              uploadingInvoice && 'pointer-events-none opacity-70'
                            )}
                          >
                            {uploadingInvoice ? (
                              <>
                                <Loader2 className="w-12 h-12 mx-auto mb-3 text-amber-500 animate-spin" />
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  Subiendo imagen...
                                </p>
                              </>
                            ) : (
                              <>
                                <Receipt className={cn(
                                  'w-12 h-12 mx-auto mb-3',
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                )} />
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  Arrastra la factura aquí
                                </p>
                                <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                  o haz clic para seleccionar
                                </p>
                                <p className={cn('text-xs mt-3', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                  JPG, PNG o WebP hasta 10MB
                                </p>
                              </>
                            )}
                          </div>

                          {/* Phone Upload for Invoice */}
                          <div
                            onClick={() => setShowPhoneUploadInvoice(true)}
                            className={cn(
                              'p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center',
                              theme === 'dark'
                                ? 'border-gray-600 hover:border-amber-500 hover:bg-amber-900/10'
                                : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50'
                            )}
                          >
                            <Smartphone className={cn(
                              'w-12 h-12 mx-auto mb-3',
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )} />
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              Tomar foto con el teléfono
                            </p>
                            <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              Escanea un código QR
                            </p>
                            <p className={cn('text-xs mt-3', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                              Abre la cámara del celular
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <input
                      ref={invoiceFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleInvoiceFileInputChange}
                      className="hidden"
                    />
                  </motion.div>
                )}

                {/* Step 3: Location */}
                {currentStep === 'location' && (
                  <motion.div
                    key="location"
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

                {/* Step 4: Financial */}
                {currentStep === 'financial' && (
                  <motion.div
                    key="financial"
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
                          placeholder="Dejar vacío para usar costo de adquisición"
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

                {/* Step 5: Technical + Review */}
                {currentStep === 'technical' && (
                  <motion.div
                    key="technical"
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
                        Resumen del Activo
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Image thumbnails in summary */}
                        {((imagePreview || form.imageUrl) || (invoiceImagePreview || form.invoiceImageUrl)) && (
                          <div className="md:col-span-2 flex flex-wrap items-center gap-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                            {(imagePreview || form.imageUrl) && (
                              <div className="flex items-center gap-3">
                                <img
                                  src={imagePreview || form.imageUrl}
                                  alt="Activo"
                                  className="w-20 h-20 rounded-xl object-cover"
                                />
                                <div>
                                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    Foto del Activo
                                  </p>
                                  <p className="font-medium text-green-600 flex items-center gap-1">
                                    <Check className="w-4 h-4" />
                                    Adjuntada
                                  </p>
                                </div>
                              </div>
                            )}
                            {(invoiceImagePreview || form.invoiceImageUrl) && (
                              <div className="flex items-center gap-3">
                                <img
                                  src={invoiceImagePreview || form.invoiceImageUrl}
                                  alt="Factura"
                                  className="w-20 h-20 rounded-xl object-cover"
                                />
                                <div>
                                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    Factura Original
                                  </p>
                                  <p className="font-medium text-green-600 flex items-center gap-1">
                                    <Check className="w-4 h-4" />
                                    Adjuntada
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            Nombre
                          </p>
                          <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {form.name || '-'}
                          </p>
                        </div>

                        {summary.assetType && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              Tipo
                            </p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {summary.assetType}
                            </p>
                          </div>
                        )}

                        {summary.category && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              Categoría
                            </p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {summary.category}
                            </p>
                          </div>
                        )}

                        {summary.warehouse && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              Ubicación
                            </p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {summary.warehouse}
                              {form.locationCode && ` - ${form.locationCode}`}
                            </p>
                          </div>
                        )}

                        {summary.employee && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              Responsable
                            </p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {summary.employee}
                            </p>
                          </div>
                        )}

                        {form.acquisitionCost && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              Costo de Adquisición
                            </p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {parseFloat(form.acquisitionCost).toLocaleString('en-US', {
                                style: 'currency',
                                currency: form.currency
                              })}
                            </p>
                          </div>
                        )}

                        {form.serialNumber && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              Número de Serie
                            </p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {form.serialNumber}
                            </p>
                          </div>
                        )}

                        {(form.brand || form.model) && (
                          <div>
                            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              Marca / Modelo
                            </p>
                            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {[form.brand, form.model].filter(Boolean).join(' - ') || '-'}
                            </p>
                          </div>
                        )}

                        <div>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            Condición
                          </p>
                          <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {summary.condition}
                          </p>
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
                    ? 'bg-gray-700 hover:bg-gray-600 text-white shadow-lg'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900 shadow-md'
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
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-400/30',
                    'text-white'
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Crear Activo
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
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                      : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/30',
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

        {/* Phone Upload Modal - Asset Photo */}
        <PhoneUploadModal
          isOpen={showPhoneUpload}
          onClose={() => setShowPhoneUpload(false)}
          purpose="fixed_asset_image"
          onUploadComplete={handlePhoneUploadComplete}
        />

        {/* Phone Upload Modal - Invoice Photo */}
        <PhoneUploadModal
          isOpen={showPhoneUploadInvoice}
          onClose={() => setShowPhoneUploadInvoice(false)}
          purpose="fixed_asset_image"
          onUploadComplete={handlePhoneUploadInvoiceComplete}
        />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
