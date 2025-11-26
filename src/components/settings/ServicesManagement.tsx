'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  DollarSign,
  Search,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Service {
  id: number
  name: string
  code: string
  description: string | null
  serviceType: string
  pricingModel: string
  basePrice: number
  pricePerUnit: number
  unitType: string | null
  requiresBoxCode: boolean
  requiresDimensions: boolean
  requiresWeight: boolean
  requiresRecipient: boolean
  requiresContentType: boolean
  boxType: string | null
  active: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

interface PackageSize {
  id: number
  name: string
  dimensions: string
  weight: number
  price: number
  description: string | null
  isdefault: boolean
  status: string
}

export default function ServicesManagement() {
  const { theme } = useTheme()
  const [services, setServices] = useState<Service[]>([])
  const [packageSizes, setPackageSizes] = useState<PackageSize[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const [serviceForm, setServiceForm] = useState({
    name: '',
    code: '',
    description: '',
    serviceType: 'caja',
    pricingModel: 'fixed',
    basePrice: 0,
    pricePerUnit: 0,
    unitType: 'unit',
    requiresBoxCode: false,
    requiresDimensions: false,
    requiresWeight: false,
    requiresRecipient: true,
    requiresContentType: false,
    boxType: '',
    active: true,
    displayOrder: 0
  })

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services?limit=100')
      const data = await response.json()
      if (data.success) {
        setServices(data.data)
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPackageSizes = async () => {
    try {
      const response = await fetch('/api/package-sizes?status=active')
      const data = await response.json()
      if (data.success) {
        setPackageSizes(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching package sizes:', error)
    }
  }

  useEffect(() => {
    fetchServices()
    fetchPackageSizes()
  }, [])

  const handleSaveService = async () => {
    setSaving(true)
    try {
      const url = '/api/services'
      const method = editingService ? 'PUT' : 'POST'

      const body = editingService
        ? { id: editingService.id, ...serviceForm }
        : serviceForm

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        await fetchServices()
        setShowServiceModal(false)
        setEditingService(null)
        resetServiceForm()
      } else {
        alert(data.error || 'Error al guardar servicio')
      }
    } catch (error) {
      console.error('Error saving service:', error)
      alert('Error al guardar servicio')
    } finally {
      setSaving(false)
    }
  }

  // Abre el modal de confirmación (no bloquea la UI)
  const confirmDeleteService = (id: number) => {
    setDeleteConfirm(id)
  }

  // Ejecuta la eliminación cuando el usuario confirma
  const handleDeleteService = async () => {
    if (!deleteConfirm) return

    const id = deleteConfirm
    setDeleteConfirm(null)
    setDeleting(id)

    try {
      const response = await fetch(`/api/services?id=${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setServices(prev => prev.filter(s => s.id !== id))
      } else {
        alert(data.error || 'Error al desactivar servicio')
      }
    } catch (error) {
      console.error('Error deleting service:', error)
      alert('Error al desactivar servicio')
    } finally {
      setDeleting(null)
    }
  }

  const resetServiceForm = () => {
    setServiceForm({
      name: '',
      code: '',
      description: '',
      serviceType: 'caja',
      pricingModel: 'fixed',
      basePrice: 0,
      pricePerUnit: 0,
      unitType: 'unit',
      requiresBoxCode: false,
      requiresDimensions: false,
      requiresWeight: false,
      requiresRecipient: true,
      requiresContentType: false,
      boxType: '',
      active: true,
      displayOrder: 0
    })
  }

  const openEditService = (service: Service) => {
    setEditingService(service)
    setServiceForm({
      name: service.name,
      code: service.code,
      description: service.description || '',
      serviceType: service.serviceType || 'caja',
      pricingModel: service.pricingModel || 'fixed',
      basePrice: service.basePrice || 0,
      pricePerUnit: service.pricePerUnit || 0,
      unitType: service.unitType || 'unit',
      requiresBoxCode: service.requiresBoxCode || false,
      requiresDimensions: service.requiresDimensions || false,
      requiresWeight: service.requiresWeight || false,
      requiresRecipient: service.requiresRecipient !== false,
      requiresContentType: service.requiresContentType || false,
      boxType: service.boxType || '',
      active: service.active !== false,
      displayOrder: service.displayOrder || 0
    })
    setShowServiceModal(true)
  }

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-exa-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Add */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )} />
          <Input
            placeholder="Buscar servicios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "pl-10",
              theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'
            )}
          />
        </div>
        <Button
          onClick={() => {
            resetServiceForm()
            setEditingService(null)
            setShowServiceModal(true)
          }}
          className={cn(
            "flex items-center gap-2",
            theme === 'dark'
              ? 'bg-exa-secondary hover:bg-exa-secondary/90'
              : 'bg-exa-primary hover:bg-exa-primary/90',
            'text-white'
          )}
        >
          <Plus className="w-4 h-4" />
          Nuevo Servicio
        </Button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((service) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-xl border",
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className={cn(
                  "w-5 h-5",
                  service.active
                    ? theme === 'dark' ? 'text-exa-secondary' : 'text-exa-primary'
                    : 'text-gray-400'
                )} />
                <h3 className={cn(
                  "font-semibold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {service.name}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {service.active ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>

            <div className={cn(
              "text-xs font-mono mb-2 px-2 py-1 rounded inline-block",
              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
            )}>
              {service.code}
            </div>

            {service.description && (
              <p className={cn(
                "text-sm mb-3",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {service.description}
              </p>
            )}

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  Tipo:
                </span>
                <span className={cn(
                  "font-medium",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {service.serviceType || 'caja'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                  Precio:
                </span>
                <span className={cn(
                  "font-medium flex items-center gap-1",
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                )}>
                  {service.pricingModel === 'free' ? (
                    'Gratis'
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4" />
                      {Number(service.basePrice) > 0 ? `${Number(service.basePrice).toFixed(2)}` : '0.00'}
                      {Number(service.pricePerUnit) > 0 && ` + ${Number(service.pricePerUnit).toFixed(2)}/${service.unitType}`}
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => openEditService(service)}
                size="sm"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                )}
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </Button>
              <Button
                onClick={() => confirmDeleteService(service.id)}
                size="sm"
                disabled={deleting === service.id}
                className="bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
              >
                {deleting === service.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Service Modal */}
      <AnimatePresence>
        {showServiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !saving && setShowServiceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-6",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
                </h2>
                <Button
                  onClick={() => setShowServiceModal(false)}
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Nombre del Servicio *
                    </label>
                    <Input
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                      placeholder="Ej: Envío de Caja Grande"
                      className={theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}
                    />
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Código *
                    </label>
                    <Input
                      value={serviceForm.code}
                      onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value.toUpperCase() })}
                      placeholder="CAJA_GRANDE"
                      className={theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}
                    />
                  </div>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Descripción
                  </label>
                  <textarea
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                    placeholder="Descripción detallada del servicio..."
                    rows={3}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border",
                      theme === 'dark'
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-white border-gray-300'
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Tipo de Servicio *
                    </label>
                    <select
                      value={serviceForm.serviceType}
                      onChange={(e) => setServiceForm({ ...serviceForm, serviceType: e.target.value })}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border",
                        theme === 'dark'
                          ? 'bg-gray-700 text-white border-gray-600'
                          : 'bg-white border-gray-300'
                      )}
                    >
                      <option value="recogida_caja">Recogida Caja</option>
                      <option value="entrega_caja">Entrega Caja</option>
                      <option value="caja_confeccion">Caja + Confección</option>
                      <option value="duradero">Duradero</option>
                      <option value="lb">Por Libra</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Modelo de Precio *
                    </label>
                    <select
                      value={serviceForm.pricingModel}
                      onChange={(e) => {
                        const newModel = e.target.value
                        if (newModel === 'free') {
                          setServiceForm({ ...serviceForm, pricingModel: newModel, basePrice: 0, pricePerUnit: 0 })
                        } else {
                          setServiceForm({ ...serviceForm, pricingModel: newModel })
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border",
                        theme === 'dark'
                          ? 'bg-gray-700 text-white border-gray-600'
                          : 'bg-white border-gray-300'
                      )}
                    >
                      <option value="free">Gratis</option>
                      <option value="fixed">Precio Fijo</option>
                      <option value="by_weight">Por Peso</option>
                      <option value="by_volume">Por Volumen</option>
                      <option value="fixed_plus_weight">Fijo + Peso</option>
                      <option value="fixed_plus_volume">Fijo + Volumen</option>
                    </select>
                  </div>
                </div>

                {/* Campos de precio - solo mostrar si no es gratis */}
                {serviceForm.pricingModel !== 'free' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Precio Base ($)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={serviceForm.basePrice}
                        onChange={(e) => setServiceForm({ ...serviceForm, basePrice: parseFloat(e.target.value) || 0 })}
                        className={theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}
                      />
                    </div>
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Precio por Unidad ($)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={serviceForm.pricePerUnit}
                        onChange={(e) => setServiceForm({ ...serviceForm, pricePerUnit: parseFloat(e.target.value) || 0 })}
                        className={theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}
                      />
                    </div>
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Tipo de Unidad
                      </label>
                      <select
                        value={serviceForm.unitType}
                        onChange={(e) => setServiceForm({ ...serviceForm, unitType: e.target.value })}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border",
                          theme === 'dark'
                            ? 'bg-gray-700 text-white border-gray-600'
                            : 'bg-white border-gray-300'
                        )}
                      >
                        <option value="unit">Unidad</option>
                        <option value="lb">Libra</option>
                        <option value="kg">Kilogramo</option>
                        <option value="m3">Metro Cúbico</option>
                        <option value="ft3">Pie Cúbico</option>
                      </select>
                    </div>
                  </div>
                )}

                {(serviceForm.serviceType === 'recogida_caja' || serviceForm.serviceType === 'entrega_caja') && (
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Tamaño de Empaque
                    </label>
                    <select
                      value={serviceForm.boxType}
                      onChange={(e) => setServiceForm({ ...serviceForm, boxType: e.target.value })}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border",
                        theme === 'dark'
                          ? 'bg-gray-700 text-white border-gray-600'
                          : 'bg-white border-gray-300'
                      )}
                    >
                      <option value="">Seleccionar tamaño...</option>
                      {packageSizes.map((size) => (
                        <option key={size.id} value={size.name}>
                          {size.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={cn(
                  "border-t pt-4",
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <h3 className={cn(
                    "font-semibold mb-3",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Requisitos
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'requiresBoxCode', label: 'Código de Caja' },
                      { key: 'requiresWeight', label: 'Peso' },
                      { key: 'requiresRecipient', label: 'Destinatario' },
                      { key: 'requiresContentType', label: 'Tipo de Contenido' }
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={serviceForm[key as keyof typeof serviceForm] as boolean}
                          onChange={(e) => setServiceForm({ ...serviceForm, [key]: e.target.checked })}
                          className="w-4 h-4 rounded"
                        />
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={serviceForm.active}
                      onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      Servicio Activo
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setShowServiceModal(false)}
                    disabled={saving}
                    className={cn(
                      "flex-1",
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    )}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveService}
                    disabled={saving || !serviceForm.name || !serviceForm.code}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2",
                      theme === 'dark'
                        ? 'bg-exa-secondary hover:bg-exa-secondary/90'
                        : 'bg-exa-primary hover:bg-exa-primary/90',
                      'text-white'
                    )}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Guardar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "p-6 rounded-xl max-w-md w-full mx-4",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <h3 className={cn(
                "text-lg font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Confirmar desactivación
              </h3>
              <p className={cn(
                "mb-6",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                ¿Está seguro de desactivar este servicio?
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={() => setDeleteConfirm(null)}
                  className={cn(
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  )}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeleteService}
                  className="bg-red-500 hover:bg-red-600 text-white"
                >
                  Desactivar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
