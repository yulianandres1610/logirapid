'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Image as ImageIcon,
  DollarSign,
  Check,
  ArrowLeft,
  Upload,
  X,
  Loader2,
  Barcode,
  Tag,
  Truck,
  Scale,
  Trash2,
  Save,
  Printer
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { PrintLabelModal } from '@/components/print/PrintLabelModal'

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

const UNITS_OF_MEASURE = [
  { id: 'unidad', name: 'Unidad', abbr: 'u' },
  { id: 'kg', name: 'Kilogramo', abbr: 'kg' },
  { id: 'lb', name: 'Libra', abbr: 'lb' },
  { id: 'g', name: 'Gramo', abbr: 'g' },
  { id: 'oz', name: 'Onza', abbr: 'oz' },
  { id: 'lt', name: 'Litro', abbr: 'lt' },
  { id: 'gal', name: 'Galón', abbr: 'gal' },
  { id: 'ml', name: 'Mililitro', abbr: 'ml' },
  { id: 'docena', name: 'Docena', abbr: 'doc' },
  { id: 'caja', name: 'Caja', abbr: 'cj' },
  { id: 'paquete', name: 'Paquete', abbr: 'paq' },
  { id: 'par', name: 'Par', abbr: 'par' },
  { id: 'metro', name: 'Metro', abbr: 'm' },
  { id: 'yarda', name: 'Yarda', abbr: 'yd' }
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

interface Product {
  id: number
  name: string
  description: string | null
  imageUrl: string | null
  category: string | null
  costPrice: number
  sellingPrice: number
  currency: string
  sku: string | null
  barcode: string | null
  supplierName: string | null
  supplierContact: string | null
  supplierReference: string | null
  quantityOnHand: number
  minimumStock: number
  isActive: boolean
  unitOfMeasure: string
}

export default function EditProductPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    unitOfMeasure: 'unidad',
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
    minimumStock: '5',
    isActive: true
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProduct()
  }, [productId])

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/market/products/${productId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const p = data.data as Product
          setFormData({
            name: p.name || '',
            description: p.description || '',
            category: p.category || '',
            unitOfMeasure: p.unitOfMeasure || 'unidad',
            imageUrl: p.imageUrl || '',
            imageFile: null,
            costPrice: p.costPrice?.toString() || '',
            sellingPrice: p.sellingPrice?.toString() || '',
            currency: p.currency || 'USD',
            sku: p.sku || '',
            barcode: p.barcode || '',
            supplierName: p.supplierName || '',
            supplierContact: p.supplierContact || '',
            supplierReference: p.supplierReference || '',
            minimumStock: p.minimumStock?.toString() || '5',
            isActive: p.isActive !== false
          })
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      setErrors({ fetch: 'Error al cargar el producto' })
    } finally {
      setLoading(false)
    }
  }

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
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
    if (!formData.costPrice) newErrors.costPrice = 'El precio de costo es requerido'
    if (!formData.sellingPrice) newErrors.sellingPrice = 'El precio de venta es requerido'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    try {
      let imageUrl = formData.imageUrl
      if (formData.imageFile) {
        const uploadedUrl = await uploadImage()
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        }
      }

      const response = await fetch(`/api/market/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          category: formData.category || null,
          unitOfMeasure: formData.unitOfMeasure,
          imageUrl: imageUrl || null,
          costPrice: parseFloat(formData.costPrice),
          sellingPrice: parseFloat(formData.sellingPrice),
          currency: formData.currency,
          sku: formData.sku || null,
          barcode: formData.barcode || null,
          supplierName: formData.supplierName || null,
          supplierContact: formData.supplierContact || null,
          supplierReference: formData.supplierReference || null,
          minimumStock: parseInt(formData.minimumStock) || 5,
          isActive: formData.isActive
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al actualizar producto')
      }

      router.push('/dashboard/market/inventory')
    } catch (error) {
      console.error('Error updating product:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Error al actualizar producto' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/market/products/${productId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al eliminar producto')
      }

      router.push('/dashboard/market/inventory')
    } catch (error) {
      console.error('Error deleting product:', error)
      setErrors({ delete: error instanceof Error ? error.message : 'Error al eliminar' })
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const getMargin = () => {
    const cost = parseFloat(formData.costPrice) || 0
    const sell = parseFloat(formData.sellingPrice) || 0
    if (cost === 0) return 0
    return Math.round(((sell - cost) / cost) * 100)
  }

  const symbol = CURRENCY_SYMBOLS[formData.currency] || '$'

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen py-8 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <Link
                  href="/dashboard/market/inventory"
                  className={cn(
                    "inline-flex items-center gap-2 text-sm mb-2 transition-colors",
                    theme === 'dark'
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inventario
                </Link>
                <h1 className={cn(
                  "text-2xl sm:text-3xl font-bold flex items-center gap-3",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Package className="w-8 h-8 text-emerald-500" />
                  Editar Producto
                </h1>
              </div>
              <div className="flex items-center gap-3">
                {formData.barcode && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowPrintModal(true)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <Printer className="w-5 h-5" />
                    Imprimir Etiqueta
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                  Eliminar
                </motion.button>
              </div>
            </div>

            {errors.fetch && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-red-600 text-sm">{errors.fetch}</p>
              </div>
            )}

            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-2xl border p-6 shadow-lg space-y-8",
                theme === 'dark'
                  ? 'bg-gray-800/95 border-gray-700/50'
                  : 'bg-white border-gray-200'
              )}
            >
              {/* Basic Info Section */}
              <div>
                <h2 className={cn(
                  "text-lg font-bold flex items-center gap-2 mb-4",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Package className="w-5 h-5 text-blue-500" />
                  Información Básica
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        errors.name
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                          : theme === 'dark'
                            ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Descripción
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Categoría
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
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
                    <label className={cn(
                      "block text-sm font-medium mb-2 flex items-center gap-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      <Scale className="w-4 h-4" />
                      Unidad de Medida
                    </label>
                    <select
                      value={formData.unitOfMeasure}
                      onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      {UNITS_OF_MEASURE.map(unit => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name} ({unit.abbr})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2 flex items-center gap-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      <Tag className="w-4 h-4" />
                      SKU
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2 flex items-center gap-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      <Barcode className="w-4 h-4" />
                      Código de Barras EAN-13
                    </label>
                    <input
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      maxLength={13}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Stock Mínimo de Alerta
                    </label>
                    <input
                      type="number"
                      value={formData.minimumStock}
                      onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                      min="0"
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className={cn(
                      "text-sm font-medium",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Estado:
                    </label>
                    <button
                      onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                        formData.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {formData.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Image Section */}
              <div>
                <h2 className={cn(
                  "text-lg font-bold flex items-center gap-2 mb-4",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <ImageIcon className="w-5 h-5 text-purple-500" />
                  Imagen del Producto
                </h2>

                <motion.div
                  onClick={() => fileInputRef.current?.click()}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={cn(
                    'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                    theme === 'dark'
                      ? 'border-gray-600 hover:border-purple-500/50 hover:bg-purple-500/5'
                      : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
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
                        alt={formData.name}
                        className="max-w-xs max-h-48 rounded-xl mx-auto object-contain shadow-lg"
                      />
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setFormData({ ...formData, imageUrl: '', imageFile: null })
                        }}
                        className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className={cn(
                        "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Upload className="w-8 h-8 text-gray-400" />
                      </div>
                      <div>
                        <p className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Haz clic para seleccionar una imagen
                        </p>
                        <p className="text-sm text-gray-500">PNG, JPG o WEBP hasta 5MB</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Pricing Section */}
              <div>
                <h2 className={cn(
                  "text-lg font-bold flex items-center gap-2 mb-4",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  Precios y Costos
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Moneda
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="USD">USD - Dólar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="CUP">CUP - Peso Cubano</option>
                      <option value="MLC">MLC</option>
                    </select>
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Precio de Costo *
                    </label>
                    <div className="relative">
                      <span className={cn(
                        "absolute left-4 top-1/2 -translate-y-1/2",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>{symbol}</span>
                      <input
                        type="number"
                        value={formData.costPrice}
                        onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                        step="0.01"
                        min="0"
                        className={cn(
                          'w-full pl-8 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          errors.costPrice
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                            : theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                    {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice}</p>}
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Precio de Venta *
                    </label>
                    <div className="relative">
                      <span className={cn(
                        "absolute left-4 top-1/2 -translate-y-1/2",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>{symbol}</span>
                      <input
                        type="number"
                        value={formData.sellingPrice}
                        onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                        step="0.01"
                        min="0"
                        className={cn(
                          'w-full pl-8 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          errors.sellingPrice
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                            : theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                    {errors.sellingPrice && <p className="text-red-500 text-xs mt-1">{errors.sellingPrice}</p>}
                  </div>
                </div>

                {/* Margin Preview */}
                {formData.costPrice && formData.sellingPrice && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'mt-4 p-4 rounded-xl border',
                      getMargin() >= 30
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : getMargin() >= 15
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Margen de Ganancia</span>
                        <p className="text-xs text-gray-500">
                          Ganancia: {symbol}{(parseFloat(formData.sellingPrice) - parseFloat(formData.costPrice)).toFixed(2)}
                        </p>
                      </div>
                      <span className={cn(
                        'text-3xl font-bold',
                        getMargin() >= 30 ? 'text-green-600' : getMargin() >= 15 ? 'text-amber-600' : 'text-red-600'
                      )}>
                        {getMargin()}%
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Supplier Section */}
              <div>
                <h2 className={cn(
                  "text-lg font-bold flex items-center gap-2 mb-4",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Truck className="w-5 h-5 text-amber-500" />
                  Proveedor
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Nombre del Proveedor
                    </label>
                    <input
                      type="text"
                      value={formData.supplierName}
                      onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Contacto
                    </label>
                    <input
                      type="text"
                      value={formData.supplierContact}
                      onChange={(e) => setFormData({ ...formData, supplierContact: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Referencia
                    </label>
                    <input
                      type="text"
                      value={formData.supplierReference}
                      onChange={(e) => setFormData({ ...formData, supplierReference: e.target.value })}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-red-600 text-sm">{errors.submit}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link href="/dashboard/market/inventory">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "px-6 py-3 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    )}
                  >
                    Cancelar
                  </motion.button>
                </Link>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={saving || uploadingImage}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25"
                  )}
                >
                  {(saving || uploadingImage) ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Guardar Cambios
                </motion.button>
              </div>
            </motion.div>
          </div>

          {/* Delete Modal */}
          <AnimatePresence>
            {showDeleteModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowDeleteModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border p-6",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                        theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                      )}>
                        <Trash2 className="w-6 h-6 text-red-500" />
                      </div>
                      <div>
                        <h3 className={cn(
                          "text-xl font-bold mb-2",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          Eliminar Producto
                        </h3>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Esta acción no se puede deshacer. El producto y todas sus variantes serán eliminados permanentemente.
                        </p>
                      </div>
                    </div>

                    {errors.delete && (
                      <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-red-600 text-sm">{errors.delete}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowDeleteModal(false)}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        )}
                      >
                        Cancelar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50"
                      >
                        {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Eliminar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Print Label Modal */}
        <PrintLabelModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          productData={{
            productName: formData.name,
            sku: formData.sku,
            barcode: formData.barcode,
            price: parseFloat(formData.sellingPrice) || 0,
            currency: formData.currency,
            unitOfMeasure: formData.unitOfMeasure,
            category: formData.category || undefined,
            description: formData.description || undefined
          }}
          onPrintSuccess={(jobNumber) => {
            console.log('Print job created:', jobNumber)
          }}
        />
      </DashboardLayout>
    </ProtectedRoute>
  )
}
