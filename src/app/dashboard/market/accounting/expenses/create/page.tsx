'use client'

import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Receipt,
  Camera,
  FileText,
  Check,
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  Loader2,
  Sparkles,
  DollarSign,
  Calendar,
  Building,
  Tag,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'

type Step = 'method' | 'input' | 'review'
type EntryMethod = 'ocr' | 'manual' | null

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 'method', title: 'Metodo', description: 'Selecciona como ingresar', icon: Receipt },
  { id: 'input', title: 'Datos', description: 'Ingresa informacion', icon: FileText },
  { id: 'review', title: 'Confirmar', description: 'Revisa y guarda', icon: Check }
]

interface Category {
  id: number
  name: string
  code: string | null
  accountingType: string | null
}

export default function CreateExpensePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('method')
  const [entryMethod, setEntryMethod] = useState<EntryMethod>(null)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form data
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'USD',
    expenseDate: new Date().toISOString().split('T')[0],
    categoryId: '',
    vendorName: '',
    receiptFile: null as File | null,
    receiptPreview: '' as string
  })

  // AI/OCR states
  const [processingOCR, setProcessingOCR] = useState(false)
  const [ocrResult, setOcrResult] = useState<{
    description?: string
    amount?: number
    vendorName?: string
    date?: string
    confidence?: number
  } | null>(null)
  const [categorizing, setCategorizing] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{
    categoryId: number
    categoryName: string
    confidence: number
  } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadingReceipt, setUploadingReceipt] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Load categories
  React.useEffect(() => {
    if (!categoriesLoaded) {
      fetchCategories()
    }
  }, [categoriesLoaded])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/market/accounting/categories')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setCategories(result.data.categories)
        }
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
    setCategoriesLoaded(true)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setErrors({ ...errors, file: 'El archivo es muy grande (max. 10MB)' })
      return
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      setErrors({ ...errors, file: 'Formato no soportado. Usa JPG, PNG, WebP o PDF' })
      return
    }

    setFormData(prev => ({
      ...prev,
      receiptFile: file,
      receiptPreview: URL.createObjectURL(file)
    }))
    setErrors({ ...errors, file: '' })

    // Auto-process with OCR if we're in OCR mode
    if (entryMethod === 'ocr') {
      await processWithOCR(file)
    }
  }

  const processWithOCR = async (file: File) => {
    setProcessingOCR(true)
    setOcrResult(null)

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      const response = await fetch('/api/market/accounting/expenses/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          setOcrResult(result.data)
          // Auto-fill form with OCR results
          setFormData(prev => ({
            ...prev,
            description: result.data.description || prev.description,
            amount: result.data.amount ? String(result.data.amount) : prev.amount,
            vendorName: result.data.vendorName || prev.vendorName,
            expenseDate: result.data.date || prev.expenseDate
          }))
          // Auto-categorize
          if (result.data.description) {
            await categorizeWithAI(result.data.description, result.data.amount, result.data.vendorName)
          }
        }
      }
    } catch (error) {
      console.error('OCR Error:', error)
      setErrors({ ...errors, ocr: 'Error al procesar el recibo' })
    }
    setProcessingOCR(false)
  }

  const categorizeWithAI = async (description: string, amount?: number, vendorName?: string) => {
    if (!description) return

    setCategorizing(true)
    try {
      const response = await fetch('/api/market/accounting/expenses/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: amount || formData.amount,
          vendorName: vendorName || formData.vendorName
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data.suggestedCategory) {
          setAiSuggestion({
            categoryId: result.data.suggestedCategory.id,
            categoryName: result.data.suggestedCategory.name,
            confidence: result.data.confidence
          })
          setFormData(prev => ({
            ...prev,
            categoryId: String(result.data.suggestedCategory.id)
          }))
        }
      }
    } catch (error) {
      console.error('Categorize error:', error)
    }
    setCategorizing(false)
  }

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'method') {
      if (!entryMethod) {
        newErrors.method = 'Selecciona un metodo de entrada'
      }
    }

    if (step === 'input') {
      if (!formData.description.trim()) {
        newErrors.description = 'La descripcion es requerida'
      }
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        newErrors.amount = 'El monto debe ser mayor a 0'
      }
      if (!formData.expenseDate) {
        newErrors.expenseDate = 'La fecha es requerida'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return

    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    if (currentStep === 'input' && entryMethod) {
      // Go back to method selection
      setCurrentStep('method')
    } else {
      const prevIndex = currentStepIndex - 1
      if (prevIndex >= 0) {
        setCurrentStep(STEPS[prevIndex].id)
      }
    }
  }

  const selectMethod = (method: EntryMethod) => {
    setEntryMethod(method)
    // Automatically advance to next step
    setTimeout(() => {
      setCurrentStep('input')
    }, 300)
  }

  const uploadReceiptToS3 = async (): Promise<string | null> => {
    if (!formData.receiptFile) return null

    setUploadingReceipt(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', formData.receiptFile)
      uploadFormData.append('folder', 'market-expenses')

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: uploadFormData
      })

      if (response.ok) {
        const data = await response.json()
        return data.url || null
      }
    } catch (error) {
      console.error('Error uploading receipt:', error)
    }
    setUploadingReceipt(false)
    return null
  }

  const handleSubmit = async () => {
    if (!validateStep('input')) return

    setLoading(true)
    try {
      // Upload receipt if exists
      let receiptPath: string | null = null
      if (formData.receiptFile) {
        receiptPath = await uploadReceiptToS3()
      }

      const response = await fetch('/api/market/accounting/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: formData.description,
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          expenseDate: formData.expenseDate,
          categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
          vendorName: formData.vendorName || null,
          receiptPath,
          aiSuggestion: aiSuggestion?.categoryName,
          aiConfidence: aiSuggestion?.confidence
        })
      })

      if (response.ok) {
        router.push('/dashboard/market/accounting/expenses')
      } else {
        const data = await response.json()
        setErrors({ submit: data.error || 'Error al guardar gasto' })
      }
    } catch (error) {
      console.error('Error saving expense:', error)
      setErrors({ submit: 'Error al guardar gasto' })
    }
    setLoading(false)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/market/accounting/expenses')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <Receipt className="w-8 h-8 text-orange-600" />
                  Nuevo Gasto
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Registra un nuevo gasto con recibo o manualmente
                </p>
              </div>
            </div>
          </motion.div>

          {/* Step Indicator */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between relative">
              {/* Progress Bar Background */}
              <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 z-0" />
              {/* Progress Bar Fill */}
              <motion.div
                className="absolute left-0 top-1/2 h-1 bg-orange-500 -translate-y-1/2 z-0"
                initial={{ width: '0%' }}
                animate={{ width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%` }}
                transition={{ duration: 0.3 }}
              />

              {STEPS.map((step, idx) => {
                const isActive = currentStep === step.id
                const isCompleted = currentStepIndex > idx
                const Icon = step.icon

                return (
                  <div key={step.id} className="relative z-10 flex flex-col items-center">
                    <motion.div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                        isCompleted
                          ? "bg-orange-500 text-white"
                          : isActive
                          ? "bg-orange-500 text-white ring-4 ring-orange-500/30"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                      )}
                      animate={{ scale: isActive ? 1.1 : 1 }}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </motion.div>
                    <div className="mt-2 text-center">
                      <p className={cn(
                        "text-sm font-medium",
                        isActive ? "text-orange-600 dark:text-orange-400" : "text-gray-500"
                      )}>
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-400 hidden sm:block">{step.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {/* Step 1: Method Selection */}
            {currentStep === 'method' && (
              <motion.div
                key="method"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Como deseas registrar el gasto?
                  </h2>
                  <p className="text-gray-500">
                    Selecciona el metodo que prefieras
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* OCR Option */}
                  <motion.button
                    onClick={() => selectMethod('ocr')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "relative p-8 rounded-2xl border-2 transition-all text-left",
                      entryMethod === 'ocr'
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-orange-300 bg-white dark:bg-gray-800"
                    )}
                  >
                    <div className="absolute top-4 right-4">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                        entryMethod === 'ocr'
                          ? "border-orange-500 bg-orange-500"
                          : "border-gray-300 dark:border-gray-600"
                      )}>
                        {entryMethod === 'ocr' && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>

                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mb-4">
                      <Camera className="w-8 h-8 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      Escanear Recibo
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                      Sube una foto del recibo y la IA extraera automaticamente los datos
                    </p>
                    <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                      <Sparkles className="w-4 h-4" />
                      <span>Usa inteligencia artificial</span>
                    </div>
                  </motion.button>

                  {/* Manual Option */}
                  <motion.button
                    onClick={() => selectMethod('manual')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "relative p-8 rounded-2xl border-2 transition-all text-left",
                      entryMethod === 'manual'
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-orange-300 bg-white dark:bg-gray-800"
                    )}
                  >
                    <div className="absolute top-4 right-4">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                        entryMethod === 'manual'
                          ? "border-orange-500 bg-orange-500"
                          : "border-gray-300 dark:border-gray-600"
                      )}>
                        {entryMethod === 'manual' && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </div>

                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4">
                      <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      Entrada Manual
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                      Ingresa los datos del gasto manualmente usando el formulario
                    </p>
                    <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                      <FileText className="w-4 h-4" />
                      <span>Formulario tradicional</span>
                    </div>
                  </motion.button>
                </div>

                {errors.method && (
                  <p className="text-center text-red-500 text-sm">{errors.method}</p>
                )}
              </motion.div>
            )}

            {/* Step 2: Input Data */}
            {currentStep === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                  {/* OCR Upload Section */}
                  {entryMethod === 'ocr' && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Foto del Recibo *
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          "relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                          formData.receiptPreview
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10"
                            : "border-gray-300 dark:border-gray-600 hover:border-orange-400"
                        )}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        {formData.receiptPreview ? (
                          <div className="space-y-4">
                            <img
                              src={formData.receiptPreview}
                              alt="Receipt preview"
                              className="max-h-48 mx-auto rounded-lg shadow-lg"
                            />
                            {processingOCR && (
                              <div className="flex items-center justify-center gap-2 text-orange-600">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Procesando con IA...</span>
                              </div>
                            )}
                            {ocrResult && (
                              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                Datos extraidos correctamente ({Math.round((ocrResult.confidence || 0) * 100)}% confianza)
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setFormData(prev => ({ ...prev, receiptFile: null, receiptPreview: '' }))
                                setOcrResult(null)
                              }}
                              className="text-red-500 text-sm hover:underline"
                            >
                              Eliminar y subir otra
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto">
                              <Upload className="w-8 h-8 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-gray-900 dark:text-white font-medium">
                                Arrastra una imagen o haz clic para subir
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                JPG, PNG, WebP o PDF (max. 10MB)
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      {errors.file && (
                        <p className="mt-2 text-sm text-red-500">{errors.file}</p>
                      )}
                    </div>
                  )}

                  {/* Manual Upload Section (optional for manual entry) */}
                  {entryMethod === 'manual' && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Recibo (opcional)
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          "relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all",
                          formData.receiptPreview
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10"
                            : "border-gray-300 dark:border-gray-600 hover:border-orange-400"
                        )}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        {formData.receiptPreview ? (
                          <div className="flex items-center gap-4">
                            <img
                              src={formData.receiptPreview}
                              alt="Receipt"
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                            <div className="flex-1 text-left">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {formData.receiptFile?.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {((formData.receiptFile?.size || 0) / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setFormData(prev => ({ ...prev, receiptFile: null, receiptPreview: '' }))
                              }}
                              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                            >
                              <X className="w-5 h-5 text-red-500" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 text-gray-500">
                            <ImageIcon className="w-5 h-5" />
                            <span>Adjuntar recibo (opcional)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Form Fields */}
                  <div className="space-y-4">
                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Descripcion *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          onBlur={() => {
                            if (formData.description && !aiSuggestion) {
                              categorizeWithAI(formData.description)
                            }
                          }}
                          placeholder="Ej: Pago de electricidad del mes"
                          className={cn(
                            "w-full px-4 py-3 border rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orange-500",
                            errors.description ? "border-red-500" : "border-gray-200 dark:border-gray-700"
                          )}
                        />
                        {categorizing && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Sparkles className="w-5 h-5 text-orange-500 animate-pulse" />
                          </div>
                        )}
                      </div>
                      {errors.description && (
                        <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                      )}
                      {aiSuggestion && (
                        <p className="mt-1 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          IA sugiere: {aiSuggestion.categoryName} ({Math.round(aiSuggestion.confidence * 100)}%)
                        </p>
                      )}
                    </div>

                    {/* Amount and Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Monto *
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0.00"
                            className={cn(
                              "w-full pl-10 pr-4 py-3 border rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orange-500",
                              errors.amount ? "border-red-500" : "border-gray-200 dark:border-gray-700"
                            )}
                          />
                        </div>
                        {errors.amount && (
                          <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Fecha *
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="date"
                            value={formData.expenseDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, expenseDate: e.target.value }))}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 border rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orange-500",
                              errors.expenseDate ? "border-red-500" : "border-gray-200 dark:border-gray-700"
                            )}
                          />
                        </div>
                        {errors.expenseDate && (
                          <p className="mt-1 text-sm text-red-500">{errors.expenseDate}</p>
                        )}
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Categoria
                      </label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <select
                          value={formData.categoryId}
                          onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">Seleccionar categoria</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Vendor */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Proveedor/Vendedor
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={formData.vendorName}
                          onChange={(e) => setFormData(prev => ({ ...prev, vendorName: e.target.value }))}
                          placeholder="Nombre del proveedor (opcional)"
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {currentStep === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Confirmar Gasto
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Revisa los datos antes de guardar
                    </p>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Receipt Preview */}
                    {formData.receiptPreview && (
                      <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        <img
                          src={formData.receiptPreview}
                          alt="Receipt"
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                        <div>
                          <p className="text-sm text-gray-500">Recibo adjunto</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formData.receiptFile?.name}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">Descripcion</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formData.description}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">Monto</span>
                        <span className="font-bold text-2xl text-orange-600">
                          ${parseFloat(formData.amount || '0').toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">Fecha</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {new Date(formData.expenseDate).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">Categoria</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {categories.find(c => c.id === parseInt(formData.categoryId))?.name || 'Sin categoria'}
                        </span>
                      </div>
                      {formData.vendorName && (
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-gray-500">Proveedor</span>
                          <span className="font-medium text-gray-900 dark:text-white">{formData.vendorName}</span>
                        </div>
                      )}
                    </div>

                    {errors.submit && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        <span>{errors.submit}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between mt-8"
          >
            <button
              onClick={currentStep === 'method' ? () => router.push('/dashboard/market/accounting/expenses') : goToPrevStep}
              className="flex items-center gap-2 px-6 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              {currentStep === 'method' ? 'Cancelar' : 'Atras'}
            </button>

            {currentStep !== 'method' && (
              <button
                onClick={currentStep === 'review' ? handleSubmit : goToNextStep}
                disabled={loading || processingOCR}
                className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {loading || uploadingReceipt ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {uploadingReceipt ? 'Subiendo recibo...' : 'Guardando...'}
                  </>
                ) : currentStep === 'review' ? (
                  <>
                    <Check className="w-5 h-5" />
                    Guardar Gasto
                  </>
                ) : (
                  <>
                    Siguiente
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
