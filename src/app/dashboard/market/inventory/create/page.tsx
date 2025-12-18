'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Image as ImageIcon,
  DollarSign,
  Truck,
  Check,
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  Loader2,
  Barcode,
  Tag
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'info' | 'image' | 'pricing' | 'supplier' | 'review'

const STEPS: { id: Step; title: string; icon: any }[] = [
  { id: 'info', title: 'Información', icon: Package },
  { id: 'image', title: 'Imagen', icon: ImageIcon },
  { id: 'pricing', title: 'Precios', icon: DollarSign },
  { id: 'supplier', title: 'Proveedor', icon: Truck },
  { id: 'review', title: 'Revisión', icon: Check }
]

const CATEGORIES = [
  'Alimentos',
  'Bebidas',
  'Carnes y Embutidos',
  'Lácteos',
  'Frutas y Verduras',
  'Panadería',
  'Limpieza',
  'Higiene Personal',
  'Electrodomésticos',
  'Electrónica',
  'Ropa',
  'Hogar',
  'Otros'
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

export default function CreateProductPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    imageUrl: '',
    imageFile: null as File | null,
    costPrice: '',
    sellingPrice: '',
    currency: 'USD',
    sku: '',
    barcode: '',
    supplierName: '',
    supplierContact: '',
    supplierReference: '',
    minimumStock: '5'
  })

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ ...errors, image: 'El archivo es muy grande (máx. 5MB)' })
        return
      }
      setFormData(prev => ({
        ...prev,
        imageFile: file,
        imageUrl: URL.createObjectURL(file)
      }))
      setErrors({ ...errors, image: '' })
    }
  }

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'info') {
      if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
    }

    if (step === 'pricing') {
      if (!formData.costPrice) newErrors.costPrice = 'El precio de costo es requerido'
      if (!formData.sellingPrice) newErrors.sellingPrice = 'El precio de venta es requerido'
      if (parseFloat(formData.sellingPrice) < parseFloat(formData.costPrice)) {
        newErrors.sellingPrice = 'El precio de venta debe ser mayor al costo'
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
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const uploadImage = async (): Promise<string | null> => {
    if (!formData.imageFile) return null

    setUploadingImage(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', formData.imageFile)
      uploadFormData.append('folder', 'market-products')

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: uploadFormData
      })

      if (!response.ok) {
        throw new Error('Error uploading image')
      }

      const data = await response.json()
      return data.url || null
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep('review')) return

    setLoading(true)
    try {
      // Upload image if provided
      let imageUrl = formData.imageUrl
      if (formData.imageFile) {
        const uploadedUrl = await uploadImage()
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        }
      }

      const response = await fetch('/api/market/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          category: formData.category,
          imageUrl: imageUrl || null,
          costPrice: parseFloat(formData.costPrice),
          sellingPrice: parseFloat(formData.sellingPrice),
          currency: formData.currency,
          sku: formData.sku || undefined,
          barcode: formData.barcode || undefined,
          supplierName: formData.supplierName || undefined,
          supplierContact: formData.supplierContact || undefined,
          supplierReference: formData.supplierReference || undefined,
          minimumStock: parseInt(formData.minimumStock) || 5
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al crear producto')
      }

      router.push('/dashboard/market/inventory')
    } catch (error) {
      console.error('Error creating product:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Error al crear producto' })
    } finally {
      setLoading(false)
    }
  }

  const getMargin = () => {
    const cost = parseFloat(formData.costPrice) || 0
    const sell = parseFloat(formData.sellingPrice) || 0
    if (cost === 0) return 0
    return Math.round(((sell - cost) / cost) * 100)
  }

  const symbol = CURRENCY_SYMBOLS[formData.currency] || '$'

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Link href="/dashboard/market/inventory" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Volver al inventario
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Nuevo Producto
            </h1>
          </motion.div>

          {/* Progress Steps */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const isActive = step.id === currentStep
                const isCompleted = index < currentStepIndex

                return (
                  <div key={step.id} className="flex-1 flex items-center">
                    <div className="flex flex-col items-center relative">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                        isActive
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                          : isCompleted
                            ? 'bg-green-500 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-gray-200 text-gray-500'
                      )}>
                        {isCompleted ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                      </div>
                      <span className={cn(
                        'mt-2 text-xs font-medium absolute -bottom-6 whitespace-nowrap',
                        isActive ? 'text-blue-500' : 'text-gray-500'
                      )}>
                        {step.title}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={cn(
                        'flex-1 h-1 mx-2 rounded-full transition-all',
                        isCompleted
                          ? 'bg-green-500'
                          : theme === 'dark'
                            ? 'bg-gray-700'
                            : 'bg-gray-200'
                      )} />
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Form Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              'rounded-2xl border p-6 mt-10',
              theme === 'dark'
                ? 'bg-[#1e1e2f] border-gray-700/50'
                : 'bg-white border-gray-200'
            )}
          >
            <AnimatePresence mode="wait">
              {/* Step 1: Information */}
              {currentStep === 'info' && (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Package className="w-6 h-6 text-blue-500" />
                    Información del Producto
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: Arroz Premium 5kg"
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        errors.name
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe el producto..."
                      rows={3}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Categoría
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="">Seleccionar categoría</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Stock Mínimo
                    </label>
                    <input
                      type="number"
                      value={formData.minimumStock}
                      onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                      placeholder="5"
                      min="0"
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                    <p className="text-xs text-gray-500 mt-1">Se te alertará cuando el stock baje de esta cantidad</p>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Image */}
              {currentStep === 'image' && (
                <motion.div
                  key="image"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ImageIcon className="w-6 h-6 text-blue-500" />
                    Imagen del Producto
                  </h2>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                      theme === 'dark'
                        ? 'border-gray-700 hover:border-gray-600'
                        : 'border-gray-300 hover:border-gray-400'
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {formData.imageUrl ? (
                      <div className="relative inline-block">
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          className="max-w-xs max-h-48 rounded-lg mx-auto object-contain"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setFormData({ ...formData, imageUrl: '', imageFile: null })
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="w-12 h-12 mx-auto text-gray-400" />
                        <div>
                          <p className="text-gray-700 dark:text-gray-300 font-medium">
                            Haz clic para seleccionar una imagen
                          </p>
                          <p className="text-sm text-gray-500">PNG, JPG o WEBP hasta 5MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {errors.image && <p className="text-red-500 text-xs mt-1 text-center">{errors.image}</p>}

                  <p className="text-sm text-gray-500 text-center">
                    Este paso es opcional. Puedes agregar la imagen después.
                  </p>
                </motion.div>
              )}

              {/* Step 3: Pricing */}
              {currentStep === 'pricing' && (
                <motion.div
                  key="pricing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-blue-500" />
                    Precios
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Moneda
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="USD">USD - Dólar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="CUP">CUP - Peso Cubano</option>
                      <option value="MLC">MLC</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Precio de Costo *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{symbol}</span>
                        <input
                          type="number"
                          value={formData.costPrice}
                          onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className={cn(
                            'w-full pl-8 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            errors.costPrice
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>
                      {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Precio de Venta *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{symbol}</span>
                        <input
                          type="number"
                          value={formData.sellingPrice}
                          onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className={cn(
                            'w-full pl-8 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            errors.sellingPrice
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>
                      {errors.sellingPrice && <p className="text-red-500 text-xs mt-1">{errors.sellingPrice}</p>}
                    </div>
                  </div>

                  {/* Margin Preview */}
                  {formData.costPrice && formData.sellingPrice && (
                    <div className={cn(
                      'p-4 rounded-xl',
                      getMargin() >= 30
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : getMargin() >= 15
                          ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    )}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Margen de Ganancia</span>
                        <span className={cn(
                          'text-2xl font-bold',
                          getMargin() >= 30 ? 'text-green-600' : getMargin() >= 15 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {getMargin()}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Ganancia: {symbol}{(parseFloat(formData.sellingPrice) - parseFloat(formData.costPrice)).toFixed(2)} por unidad
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 4: Supplier */}
              {currentStep === 'supplier' && (
                <motion.div
                  key="supplier"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-6 h-6 text-blue-500" />
                    Datos del Proveedor
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Tag className="w-4 h-4 inline mr-1" />
                        Referencia Interna (SKU)
                      </label>
                      <input
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                        placeholder="Se generará automáticamente"
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Barcode className="w-4 h-4 inline mr-1" />
                        Código de Barras
                      </label>
                      <input
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="Se generará automáticamente"
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre del Proveedor
                    </label>
                    <input
                      type="text"
                      value={formData.supplierName}
                      onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                      placeholder="Ej: Distribuidora XYZ"
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contacto del Proveedor
                    </label>
                    <input
                      type="text"
                      value={formData.supplierContact}
                      onChange={(e) => setFormData({ ...formData, supplierContact: e.target.value })}
                      placeholder="Teléfono o email"
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Referencia del Proveedor
                    </label>
                    <input
                      type="text"
                      value={formData.supplierReference}
                      onChange={(e) => setFormData({ ...formData, supplierReference: e.target.value })}
                      placeholder="Código del producto en el proveedor"
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <p className="text-sm text-gray-500 text-center">
                    Todos los campos de esta sección son opcionales.
                  </p>
                </motion.div>
              )}

              {/* Step 5: Review */}
              {currentStep === 'review' && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Check className="w-6 h-6 text-green-500" />
                    Revisión del Producto
                  </h2>

                  <div className={cn(
                    'rounded-xl p-6',
                    theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                  )}>
                    <div className="flex gap-6">
                      {/* Image */}
                      <div className={cn(
                        'w-32 h-32 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        {formData.imageUrl ? (
                          <img
                            src={formData.imageUrl}
                            alt={formData.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-gray-400" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 space-y-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{formData.name || 'Sin nombre'}</h3>
                          {formData.category && (
                            <span className="text-sm text-blue-500">{formData.category}</span>
                          )}
                          {formData.description && (
                            <p className="text-sm text-gray-500 mt-1">{formData.description}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Precio de Costo</p>
                            <p className="font-bold text-gray-900 dark:text-white">
                              {symbol}{parseFloat(formData.costPrice || '0').toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Precio de Venta</p>
                            <p className="font-bold text-green-600">
                              {symbol}{parseFloat(formData.sellingPrice || '0').toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Margen</p>
                            <p className={cn(
                              'font-bold',
                              getMargin() >= 30 ? 'text-green-600' : getMargin() >= 15 ? 'text-amber-600' : 'text-red-600'
                            )}>
                              {getMargin()}%
                            </p>
                          </div>
                        </div>

                        {formData.supplierName && (
                          <div>
                            <p className="text-xs text-gray-500">Proveedor</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{formData.supplierName}</p>
                          </div>
                        )}

                        <div>
                          <p className="text-xs text-gray-500">Stock Mínimo de Alerta</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{formData.minimumStock} unidades</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {errors.submit && (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-red-600 text-sm">{errors.submit}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              {currentStepIndex > 0 ? (
                <button
                  onClick={goToPrevStep}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all',
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Anterior
                </button>
              ) : (
                <div />
              )}

              {currentStep === 'review' ? (
                <button
                  onClick={handleSubmit}
                  disabled={loading || uploadingImage}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/25"
                >
                  {(loading || uploadingImage) && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Check className="w-4 h-4" />
                  Crear Producto
                </button>
              ) : (
                <button
                  onClick={goToNextStep}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
