'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Edit2, Trash2, Loader2, Package, DollarSign, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

export interface ProductService {
  id?: number
  serviceCode?: string
  serviceName: string
  serviceDescription?: string
  costPrice: number
  sellPrice: number
  margin?: number
  marginPercentage?: number
  isRequired: boolean
  isDefaultSelected: boolean
  isTaxable: boolean
  commissionEnabled: boolean
  commissionType?: string
  commissionValue: number
  maxCommission?: number
  displayOrder: number
  iconName?: string
  colorCode?: string
  isActive: boolean
}

interface ProductInfo {
  id: number
  code: string
  name: string
  category: string
  type: string
}

interface ProductPricing {
  costPrice: number
  sellPrice: number
  margin: number
}

interface ServicesSummary {
  totalServices: number
  requiredServices: number
  optionalServices: number
  totalServicesCost: number
  totalServicesSell: number
  totalServicesMargin: number
  requiredServicesCost: number
  requiredServicesSell: number
  requiredServicesMargin: number
  totalCost: number
  totalSell: number
  totalMargin: number
}

interface ProductServicesModalProps {
  isOpen: boolean
  companyId: number
  productId: number
  productName: string
  onClose: () => void
  onUpdate?: () => void
}

export default function ProductServicesModal({
  isOpen,
  companyId,
  productId,
  productName,
  onClose,
  onUpdate
}: ProductServicesModalProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [services, setServices] = useState<ProductService[]>([])
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [productPricing, setProductPricing] = useState<ProductPricing | null>(null)
  const [summary, setSummary] = useState<ServicesSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state for new/edit service
  const [editingService, setEditingService] = useState<ProductService | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Partial<ProductService>>({
    serviceName: '',
    serviceDescription: '',
    costPrice: 0,
    sellPrice: 0,
    isRequired: false,
    isDefaultSelected: false,
    isTaxable: true,
    commissionEnabled: false,
    commissionValue: 0,
    displayOrder: 0,
    isActive: true
  })

  // Fetch services
  const fetchServices = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/companies/${companyId}/products/${productId}/services`)
      const data = await response.json()

      if (data.success) {
        setServices(data.data.services || [])
        setProduct(data.data.product)
        setProductPricing(data.data.productPricing)
        setSummary(data.data.summary)
      } else {
        setError(data.error || 'Error al cargar servicios')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && companyId && productId) {
      fetchServices()
    }
  }, [isOpen, companyId, productId])

  // Reset form
  const resetForm = () => {
    setFormData({
      serviceName: '',
      serviceDescription: '',
      costPrice: 0,
      sellPrice: 0,
      isRequired: false,
      isDefaultSelected: false,
      isTaxable: true,
      commissionEnabled: false,
      commissionValue: 0,
      displayOrder: services.length,
      isActive: true
    })
    setEditingService(null)
    setShowForm(false)
  }

  // Handle edit
  const handleEdit = (service: ProductService) => {
    setEditingService(service)
    setFormData({
      serviceName: service.serviceName,
      serviceDescription: service.serviceDescription || '',
      costPrice: service.costPrice,
      sellPrice: service.sellPrice,
      isRequired: service.isRequired,
      isDefaultSelected: service.isDefaultSelected,
      isTaxable: service.isTaxable,
      commissionEnabled: service.commissionEnabled,
      commissionValue: service.commissionValue,
      displayOrder: service.displayOrder,
      isActive: service.isActive
    })
    setShowForm(true)
  }

  // Handle save
  const handleSave = async () => {
    if (!formData.serviceName?.trim()) {
      setError('El nombre del servicio es requerido')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const isEditing = !!editingService?.id
      const url = `/api/companies/${companyId}/products/${productId}/services`

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEditing ? {
          serviceId: editingService.id,
          ...formData
        } : formData)
      })

      const data = await response.json()

      if (data.success) {
        await fetchServices()
        resetForm()
        onUpdate?.()
      } else {
        setError(data.error || 'Error al guardar servicio')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  // Handle delete
  const handleDelete = async (service: ProductService) => {
    if (!service.id) return

    if (!confirm(`Eliminar servicio "${service.serviceName}"?`)) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/companies/${companyId}/products/${productId}/services`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: service.id })
      })

      const data = await response.json()

      if (data.success) {
        await fetchServices()
        onUpdate?.()
      } else {
        setError(data.error || 'Error al eliminar servicio')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  // Calculate margin preview
  const calculatedMargin = (formData.sellPrice || 0) - (formData.costPrice || 0)
  const calculatedMarginPct = formData.costPrice && formData.costPrice > 0
    ? ((calculatedMargin / formData.costPrice) * 100).toFixed(1)
    : '0'

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={cn(
            "w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl",
            theme === 'dark' ? "bg-gray-800" : "bg-white"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn(
            "px-6 py-4 border-b flex items-center justify-between",
            theme === 'dark' ? "border-gray-700" : "border-gray-200"
          )}>
            <div className="flex items-center gap-3">
              <Package className={cn(
                "w-5 h-5",
                theme === 'dark' ? "text-purple-400" : "text-purple-600"
              )} />
              <div>
                <h2 className={cn(
                  "text-lg font-semibold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Servicios para {productName}
                </h2>
                {product && (
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    {product.code} - {product.category}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className={cn(
                "p-2 rounded-lg transition-colors",
                theme === 'dark'
                  ? "hover:bg-gray-700 text-gray-400"
                  : "hover:bg-gray-100 text-gray-500"
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : (
              <>
                {/* Error */}
                {error && (
                  <div className={cn(
                    "mb-4 p-3 rounded-lg text-sm",
                    theme === 'dark'
                      ? "bg-red-900/30 text-red-400 border border-red-800"
                      : "bg-red-50 text-red-600 border border-red-200"
                  )}>
                    {error}
                  </div>
                )}

                {/* Summary Card */}
                {summary && productPricing && (
                  <div className={cn(
                    "mb-6 p-4 rounded-lg",
                    theme === 'dark' ? "bg-gray-700/50" : "bg-gray-50"
                  )}>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className={cn(
                          "text-xs uppercase tracking-wide mb-1",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Margen Producto
                        </p>
                        <p className={cn(
                          "text-lg font-semibold",
                          theme === 'dark' ? "text-green-400" : "text-green-600"
                        )}>
                          ${productPricing.margin.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className={cn(
                          "text-xs uppercase tracking-wide mb-1",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Margen Servicios
                        </p>
                        <p className={cn(
                          "text-lg font-semibold",
                          theme === 'dark' ? "text-blue-400" : "text-blue-600"
                        )}>
                          ${summary.requiredServicesMargin.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className={cn(
                          "text-xs uppercase tracking-wide mb-1",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Margen Total
                        </p>
                        <p className={cn(
                          "text-lg font-bold",
                          theme === 'dark' ? "text-purple-400" : "text-purple-600"
                        )}>
                          ${summary.totalMargin.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Service Button */}
                {!showForm && (
                  <button
                    onClick={() => {
                      resetForm()
                      setShowForm(true)
                    }}
                    className={cn(
                      "w-full mb-4 py-3 rounded-lg border-2 border-dashed flex items-center justify-center gap-2 transition-colors",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-400 hover:border-purple-500 hover:text-purple-400"
                        : "border-gray-300 text-gray-500 hover:border-purple-500 hover:text-purple-600"
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    Agregar Servicio
                  </button>
                )}

                {/* Service Form */}
                {showForm && (
                  <div className={cn(
                    "mb-4 p-4 rounded-lg border",
                    theme === 'dark'
                      ? "bg-gray-700 border-gray-600"
                      : "bg-gray-50 border-gray-200"
                  )}>
                    <h3 className={cn(
                      "text-sm font-medium mb-4",
                      theme === 'dark' ? "text-gray-200" : "text-gray-700"
                    )}>
                      {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Service Name */}
                      <div className="col-span-2">
                        <label className={cn(
                          "block text-xs font-medium mb-1",
                          theme === 'dark' ? "text-gray-300" : "text-gray-600"
                        )}>
                          Nombre del Servicio *
                        </label>
                        <input
                          type="text"
                          value={formData.serviceName || ''}
                          onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                          placeholder="Ej: Recogida a Domicilio"
                          className={cn(
                            "w-full px-3 py-2 rounded-lg border text-sm",
                            theme === 'dark'
                              ? "bg-gray-800 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                        />
                      </div>

                      {/* Description */}
                      <div className="col-span-2">
                        <label className={cn(
                          "block text-xs font-medium mb-1",
                          theme === 'dark' ? "text-gray-300" : "text-gray-600"
                        )}>
                          Descripcion
                        </label>
                        <input
                          type="text"
                          value={formData.serviceDescription || ''}
                          onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
                          placeholder="Descripcion opcional"
                          className={cn(
                            "w-full px-3 py-2 rounded-lg border text-sm",
                            theme === 'dark'
                              ? "bg-gray-800 border-gray-600 text-white"
                              : "bg-white border-gray-300 text-gray-900"
                          )}
                        />
                      </div>

                      {/* Cost Price */}
                      <div>
                        <label className={cn(
                          "block text-xs font-medium mb-1",
                          theme === 'dark' ? "text-gray-300" : "text-gray-600"
                        )}>
                          Costo ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.costPrice || 0}
                          onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg border text-sm",
                            theme === 'dark'
                              ? "bg-gray-800 border-gray-600 text-amber-400"
                              : "bg-white border-gray-300 text-amber-600"
                          )}
                        />
                      </div>

                      {/* Sell Price */}
                      <div>
                        <label className={cn(
                          "block text-xs font-medium mb-1",
                          theme === 'dark' ? "text-gray-300" : "text-gray-600"
                        )}>
                          Precio Venta ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.sellPrice || 0}
                          onChange={(e) => setFormData({ ...formData, sellPrice: parseFloat(e.target.value) || 0 })}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg border text-sm",
                            theme === 'dark'
                              ? "bg-gray-800 border-gray-600 text-green-400"
                              : "bg-white border-gray-300 text-green-600"
                          )}
                        />
                      </div>

                      {/* Margin Preview */}
                      <div className="col-span-2">
                        <div className={cn(
                          "p-2 rounded text-center text-sm",
                          calculatedMargin >= 0
                            ? (theme === 'dark' ? "bg-green-900/30 text-green-400" : "bg-green-50 text-green-600")
                            : (theme === 'dark' ? "bg-red-900/30 text-red-400" : "bg-red-50 text-red-600")
                        )}>
                          Margen: ${calculatedMargin.toFixed(2)} ({calculatedMarginPct}%)
                        </div>
                      </div>

                      {/* Checkboxes */}
                      <div className="col-span-2 flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.isRequired || false}
                            onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                            className="rounded"
                          />
                          <span className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-600"
                          )}>
                            Obligatorio
                          </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.isDefaultSelected || false}
                            onChange={(e) => setFormData({ ...formData, isDefaultSelected: e.target.checked })}
                            className="rounded"
                          />
                          <span className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-600"
                          )}>
                            Pre-seleccionado
                          </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.isTaxable !== false}
                            onChange={(e) => setFormData({ ...formData, isTaxable: e.target.checked })}
                            className="rounded"
                          />
                          <span className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-600"
                          )}>
                            Con impuesto
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        onClick={resetForm}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                          theme === 'dark'
                            ? "bg-gray-600 text-gray-200 hover:bg-gray-500"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        )}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                          "bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                        )}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {editingService ? 'Actualizar' : 'Crear'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Services List */}
                <div className="space-y-2">
                  {services.length === 0 ? (
                    <div className={cn(
                      "text-center py-8",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      No hay servicios configurados para este producto
                    </div>
                  ) : (
                    services.map((service) => (
                      <div
                        key={service.id}
                        className={cn(
                          "p-4 rounded-lg border flex items-center justify-between",
                          !service.isActive && "opacity-50",
                          theme === 'dark'
                            ? "bg-gray-700/30 border-gray-700"
                            : "bg-white border-gray-200"
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {service.serviceName}
                            </span>
                            {service.isRequired && (
                              <span className={cn(
                                "px-2 py-0.5 text-xs rounded-full",
                                theme === 'dark'
                                  ? "bg-purple-900/50 text-purple-300"
                                  : "bg-purple-100 text-purple-700"
                              )}>
                                Obligatorio
                              </span>
                            )}
                          </div>
                          {service.serviceDescription && (
                            <p className={cn(
                              "text-sm mt-0.5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-500"
                            )}>
                              {service.serviceDescription}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className={theme === 'dark' ? "text-amber-400" : "text-amber-600"}>
                              Costo: ${service.costPrice.toFixed(2)}
                            </span>
                            <span className={theme === 'dark' ? "text-green-400" : "text-green-600"}>
                              Venta: ${service.sellPrice.toFixed(2)}
                            </span>
                            <span className={cn(
                              "font-medium",
                              service.margin && service.margin >= 0
                                ? (theme === 'dark' ? "text-blue-400" : "text-blue-600")
                                : (theme === 'dark' ? "text-red-400" : "text-red-600")
                            )}>
                              Margen: ${(service.margin || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={() => handleEdit(service)}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              theme === 'dark'
                                ? "hover:bg-gray-600 text-gray-400 hover:text-blue-400"
                                : "hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                            )}
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(service)}
                            className={cn(
                              "p-2 rounded-lg transition-colors",
                              theme === 'dark'
                                ? "hover:bg-gray-600 text-gray-400 hover:text-red-400"
                                : "hover:bg-gray-100 text-gray-500 hover:text-red-600"
                            )}
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className={cn(
            "px-6 py-4 border-t flex justify-end",
            theme === 'dark' ? "border-gray-700" : "border-gray-200"
          )}>
            <button
              onClick={onClose}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                theme === 'dark'
                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
