'use client'

import { useState, useEffect } from 'react'
import { X, Package, DollarSign, Ruler, Weight, Tag, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

export interface ProductData {
  id?: number
  code: string
  name: string
  description: string
  service_category: 'paqueteria' | 'remesa' | 'recarga' | 'mercado'
  product_type: string
  mi_costo: number
  precio_mayorista: number
  precio_publico: number
  dimensions: string
  weight_capacity: string
  unit_type: string
  is_active: boolean
  display_order: number
}

interface ProductModalProps {
  isOpen: boolean
  product?: ProductData | null // null = crear nuevo
  onClose: () => void
  onSave: (product: ProductData) => Promise<void>
}

const CATEGORIES = [
  { value: 'paqueteria', label: 'Paquetería' },
  { value: 'remesa', label: 'Remesa' },
  { value: 'recarga', label: 'Recarga' },
  { value: 'mercado', label: 'Mercado' }
]

const PRODUCT_TYPES = {
  paqueteria: ['box', 'envelope', 'fragile', 'service'],
  remesa: ['transfer', 'deposit'],
  recarga: ['mobile', 'nauta', 'data'],
  mercado: ['product', 'combo']
}

const generateCode = (category: string): string => {
  const prefixes: Record<string, string> = {
    paqueteria: 'PKG',
    remesa: 'REM',
    recarga: 'REC',
    mercado: 'MKT'
  }
  const prefix = prefixes[category] || 'PRD'
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${random}`
}

export default function ProductModal({
  isOpen,
  product,
  onClose,
  onSave
}: ProductModalProps) {
  const { theme } = useTheme()
  const isEditing = !!product?.id

  const [formData, setFormData] = useState<ProductData>({
    code: '',
    name: '',
    description: '',
    service_category: 'paqueteria',
    product_type: 'box',
    mi_costo: 0,
    precio_mayorista: 0,
    precio_publico: 0,
    dimensions: '',
    weight_capacity: '',
    unit_type: 'unit',
    is_active: true,
    display_order: 0
  })

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when modal opens/product changes
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setFormData({
          ...product,
          mi_costo: product.mi_costo || 0,
          precio_mayorista: product.precio_mayorista || 0,
          precio_publico: product.precio_publico || 0
        })
      } else {
        setFormData({
          code: generateCode('paqueteria'),
          name: '',
          description: '',
          service_category: 'paqueteria',
          product_type: 'box',
          mi_costo: 0,
          precio_mayorista: 0,
          precio_publico: 0,
          dimensions: '',
          weight_capacity: '',
          unit_type: 'unit',
          is_active: true,
          display_order: 0
        })
      }
      setErrors({})
    }
  }, [isOpen, product])

  // Auto-generate code when category changes (only for new products)
  useEffect(() => {
    if (!isEditing && isOpen) {
      setFormData(prev => ({
        ...prev,
        code: generateCode(prev.service_category)
      }))
    }
  }, [formData.service_category, isEditing, isOpen])

  const handleChange = (field: keyof ProductData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when field changes
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.code.trim()) {
      newErrors.code = 'El código es requerido'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    }

    if (formData.mi_costo < 0) {
      newErrors.mi_costo = 'El costo no puede ser negativo'
    }

    if (formData.precio_mayorista < 0) {
      newErrors.precio_mayorista = 'El precio mayorista no puede ser negativo'
    }

    if (formData.precio_publico < 0) {
      newErrors.precio_publico = 'El precio público no puede ser negativo'
    }

    if (formData.precio_mayorista < formData.mi_costo) {
      newErrors.precio_mayorista = 'El precio mayorista debe ser mayor o igual al costo'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    try {
      setLoading(true)
      await onSave(formData)
      onClose()
    } catch (error: any) {
      setErrors({ submit: error.message || 'Error al guardar producto' })
    } finally {
      setLoading(false)
    }
  }

  // Calculate margins
  const margenMayorista = formData.precio_mayorista - formData.mi_costo
  const margenPublico = formData.precio_publico - formData.mi_costo
  const margenPorcentaje = formData.mi_costo > 0
    ? ((margenMayorista / formData.mi_costo) * 100).toFixed(1)
    : '0'

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl",
          theme === 'dark' ? "bg-gray-800" : "bg-white"
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          "sticky top-0 flex items-center justify-between px-6 py-4 border-b",
          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-3">
            <Package className={cn(
              "w-5 h-5",
              theme === 'dark' ? "text-blue-400" : "text-blue-600"
            )} />
            <h2 className={cn(
              "text-lg font-semibold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              theme === 'dark' ? "hover:bg-gray-700" : "hover:bg-gray-100"
            )}
          >
            <X className={cn(
              "w-5 h-5",
              theme === 'dark' ? "text-gray-400" : "text-gray-500"
            )} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error general */}
          {errors.submit && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
              {errors.submit}
            </div>
          )}

          {/* Información básica */}
          <div className="grid grid-cols-2 gap-4">
            {/* Código */}
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1.5",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Código *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={e => handleChange('code', e.target.value.toUpperCase())}
                disabled={isEditing}
                placeholder="PKG-XXXX"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:ring-blue-500"
                    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-blue-500",
                  isEditing && "opacity-50 cursor-not-allowed",
                  errors.code && "border-red-500"
                )}
              />
              {errors.code && (
                <p className="mt-1 text-xs text-red-500">{errors.code}</p>
              )}
            </div>

            {/* Nombre */}
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1.5",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Nombre *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="Ej: Caja 12x12x12"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:ring-blue-500"
                    : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-blue-500",
                  errors.name && "border-red-500"
                )}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500">{errors.name}</p>
              )}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className={cn(
              "block text-sm font-medium mb-1.5",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={2}
              placeholder="Descripción del producto..."
              className={cn(
                "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 resize-none",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:ring-blue-500"
                  : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-blue-500"
              )}
            />
          </div>

          {/* Categoría y Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1.5",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Categoría *
              </label>
              <select
                value={formData.service_category}
                onChange={e => {
                  const category = e.target.value as ProductData['service_category']
                  handleChange('service_category', category)
                  // Reset product type to first option of new category
                  handleChange('product_type', PRODUCT_TYPES[category][0])
                }}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white focus:ring-blue-500"
                    : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500"
                )}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-1.5",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Tipo de Producto *
              </label>
              <select
                value={formData.product_type}
                onChange={e => handleChange('product_type', e.target.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white focus:ring-blue-500"
                    : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500"
                )}
              >
                {PRODUCT_TYPES[formData.service_category].map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Precios */}
          <div className={cn(
            "p-4 rounded-lg border",
            theme === 'dark' ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className={cn(
                "w-4 h-4",
                theme === 'dark' ? "text-green-400" : "text-green-600"
              )} />
              <span className={cn(
                "text-sm font-medium",
                theme === 'dark' ? "text-gray-200" : "text-gray-700"
              )}>
                Precios
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Mi Costo */}
              <div>
                <label className={cn(
                  "block text-xs font-medium mb-1.5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Mi Costo
                </label>
                <div className="relative">
                  <span className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.mi_costo}
                    onChange={e => handleChange('mi_costo', parseFloat(e.target.value) || 0)}
                    className={cn(
                      "w-full pl-7 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2",
                      theme === 'dark'
                        ? "bg-gray-600 border-gray-500 text-white focus:ring-blue-500"
                        : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500",
                      errors.mi_costo && "border-red-500"
                    )}
                  />
                </div>
                {errors.mi_costo && (
                  <p className="mt-1 text-xs text-red-500">{errors.mi_costo}</p>
                )}
              </div>

              {/* Precio Mayorista */}
              <div>
                <label className={cn(
                  "block text-xs font-medium mb-1.5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Precio Mayorista
                </label>
                <div className="relative">
                  <span className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio_mayorista}
                    onChange={e => handleChange('precio_mayorista', parseFloat(e.target.value) || 0)}
                    className={cn(
                      "w-full pl-7 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2",
                      theme === 'dark'
                        ? "bg-gray-600 border-gray-500 text-white focus:ring-blue-500"
                        : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500",
                      errors.precio_mayorista && "border-red-500"
                    )}
                  />
                </div>
                {errors.precio_mayorista && (
                  <p className="mt-1 text-xs text-red-500">{errors.precio_mayorista}</p>
                )}
              </div>

              {/* Precio Público */}
              <div>
                <label className={cn(
                  "block text-xs font-medium mb-1.5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Precio Público
                </label>
                <div className="relative">
                  <span className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precio_publico}
                    onChange={e => handleChange('precio_publico', parseFloat(e.target.value) || 0)}
                    className={cn(
                      "w-full pl-7 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2",
                      theme === 'dark'
                        ? "bg-gray-600 border-gray-500 text-white focus:ring-blue-500"
                        : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500",
                      errors.precio_publico && "border-red-500"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Márgenes */}
            <div className={cn(
              "mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center",
              theme === 'dark' ? "border-gray-600" : "border-gray-200"
            )}>
              <div>
                <div className={cn(
                  "text-xs",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>Margen Mayorista</div>
                <div className={cn(
                  "text-lg font-semibold",
                  margenMayorista >= 0
                    ? (theme === 'dark' ? "text-green-400" : "text-green-600")
                    : (theme === 'dark' ? "text-red-400" : "text-red-600")
                )}>
                  ${margenMayorista.toFixed(2)}
                </div>
              </div>
              <div>
                <div className={cn(
                  "text-xs",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>Margen Público</div>
                <div className={cn(
                  "text-lg font-semibold",
                  margenPublico >= 0
                    ? (theme === 'dark' ? "text-green-400" : "text-green-600")
                    : (theme === 'dark' ? "text-red-400" : "text-red-600")
                )}>
                  ${margenPublico.toFixed(2)}
                </div>
              </div>
              <div>
                <div className={cn(
                  "text-xs",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>% Margen</div>
                <div className={cn(
                  "text-lg font-semibold",
                  theme === 'dark' ? "text-blue-400" : "text-blue-600"
                )}>
                  {margenPorcentaje}%
                </div>
              </div>
            </div>
          </div>

          {/* Características físicas (solo para paquetería) */}
          {formData.service_category === 'paqueteria' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn(
                  "flex items-center gap-2 text-sm font-medium mb-1.5",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <Ruler className="w-4 h-4" />
                  Dimensiones
                </label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={e => handleChange('dimensions', e.target.value)}
                  placeholder="Ej: 12x12x12 in"
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2",
                    theme === 'dark'
                      ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:ring-blue-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-blue-500"
                  )}
                />
              </div>

              <div>
                <label className={cn(
                  "flex items-center gap-2 text-sm font-medium mb-1.5",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <Weight className="w-4 h-4" />
                  Peso Máximo
                </label>
                <input
                  type="text"
                  value={formData.weight_capacity}
                  onChange={e => handleChange('weight_capacity', e.target.value)}
                  placeholder="Ej: 50 lbs"
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2",
                    theme === 'dark'
                      ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-500 focus:ring-blue-500"
                      : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:ring-blue-500"
                  )}
                />
              </div>
            </div>
          )}

          {/* Estado y Orden */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={e => handleChange('is_active', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Producto activo
              </span>
            </label>

            <div className="flex items-center gap-2">
              <label className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Orden:
              </label>
              <input
                type="number"
                min="0"
                value={formData.display_order}
                onChange={e => handleChange('display_order', parseInt(e.target.value) || 0)}
                className={cn(
                  "w-20 px-3 py-1.5 rounded-lg border text-sm text-center focus:outline-none focus:ring-2",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white focus:ring-blue-500"
                    : "bg-white border-gray-300 text-gray-900 focus:ring-blue-500"
                )}
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                theme === 'dark'
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                isEditing ? 'Guardar Cambios' : 'Crear Producto'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
