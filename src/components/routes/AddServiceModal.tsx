'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Loader2,
  Package,
  DollarSign,
  Hash,
  Scale,
  AlertCircle
} from 'lucide-react'

interface Service {
  id: number
  name: string
  code: string
  serviceType: string
  pricingModel: string // 'free' | 'fixed' | 'by_weight' | 'fixed_plus_weight'
  basePrice: number
  pricePerUnit: number
  unitType: string | null // 'lb', 'kg'
  requiresWeight: boolean
  requiresBoxCode: boolean
  requiresDimensions: boolean
  active: boolean
}

interface AddServiceModalProps {
  orderId: number
  orderNumber: string
  companyId?: string
  onClose: () => void
  onSuccess: () => void
}

export default function AddServiceModal({
  orderId,
  orderNumber,
  companyId,
  onClose,
  onSuccess
}: AddServiceModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingServices, setLoadingServices] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  const [formData, setFormData] = useState({
    serviceId: 0,
    quantity: 1,
    weight: '',
    customPrice: ''
  })

  // Cargar servicios desde la BD
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoadingServices(true)
        const headers: HeadersInit = {}
        if (companyId) {
          headers['x-company-id'] = companyId
        }

        const response = await fetch('/api/services?activeOnly=true', { headers })
        const data = await response.json()

        if (data.success && data.data) {
          setServices(data.data)
          // Seleccionar el primer servicio por defecto
          if (data.data.length > 0) {
            const firstService = data.data[0]
            setSelectedService(firstService)
            setFormData(prev => ({
              ...prev,
              serviceId: firstService.id,
              customPrice: firstService.basePrice?.toString() || '0'
            }))
          }
        }
      } catch (err) {
        console.error('Error loading services:', err)
        setError('Error al cargar los servicios')
      } finally {
        setLoadingServices(false)
      }
    }

    fetchServices()
  }, [companyId])

  // Actualizar cuando cambia el servicio seleccionado
  const handleServiceChange = (serviceId: number) => {
    const service = services.find(s => s.id === serviceId)
    if (service) {
      setSelectedService(service)
      setFormData(prev => ({
        ...prev,
        serviceId,
        weight: '',
        customPrice: service.basePrice?.toString() || '0'
      }))
    }
  }

  // Calcular precio total
  const calculateTotalPrice = (): number => {
    if (!selectedService) return 0

    const basePrice = parseFloat(formData.customPrice) || selectedService.basePrice || 0
    const weight = parseFloat(formData.weight) || 0
    const quantity = formData.quantity || 1

    let unitPrice = basePrice

    // Si el servicio es por peso, agregar el costo por peso
    if (selectedService.pricingModel === 'by_weight' || selectedService.pricingModel === 'fixed_plus_weight') {
      if (weight > 0 && selectedService.pricePerUnit) {
        unitPrice = basePrice + (weight * selectedService.pricePerUnit)
      }
    }

    return unitPrice * quantity
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!selectedService) {
      setError('Debe seleccionar un servicio')
      setLoading(false)
      return
    }

    // El peso es opcional en este modal (no es obligatorio)

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      if (companyId) {
        headers['x-company-id'] = companyId
      }

      const totalPrice = calculateTotalPrice()
      const weight = parseFloat(formData.weight) || 0

      const response = await fetch(`/api/package-orders/${orderId}/services`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          serviceId: selectedService.id,
          type: selectedService.serviceType || selectedService.code,
          name: selectedService.name,
          quantity: formData.quantity,
          price: totalPrice / formData.quantity, // Precio unitario
          weight: selectedService.requiresWeight ? weight : null,
          basePrice: selectedService.basePrice,
          pricePerUnit: selectedService.pricePerUnit,
          pricingModel: selectedService.pricingModel
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al agregar servicio')
      }

      onSuccess()

    } catch (err) {
      console.error('Error adding service:', err)
      setError(err instanceof Error ? err.message : 'Error al agregar servicio')
    } finally {
      setLoading(false)
    }
  }

  // Formatear precio de modelo de precios
  const getPricingLabel = (service: Service): string => {
    const basePrice = parseFloat(String(service.basePrice)) || 0
    const pricePerUnit = parseFloat(String(service.pricePerUnit)) || 0

    switch (service.pricingModel) {
      case 'free':
        return 'Gratis'
      case 'fixed':
        return `$${basePrice.toFixed(2)}`
      case 'by_weight':
        return `$${pricePerUnit.toFixed(2)}/${service.unitType || 'lb'}`
      case 'fixed_plus_weight':
        return `$${basePrice.toFixed(2)} + $${pricePerUnit.toFixed(2)}/${service.unitType || 'lb'}`
      default:
        return `$${basePrice.toFixed(2)}`
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Agregar Servicio
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Orden: {orderNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loadingServices ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <div className="p-6 text-center">
              <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No hay servicios configurados.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Configure los servicios en Ajustes → Paquetería
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Selector de servicio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Package className="w-4 h-4 inline mr-1" />
                  Servicio
                </label>
                <select
                  value={formData.serviceId}
                  onChange={(e) => handleServiceChange(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {getPricingLabel(service)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Info del servicio seleccionado */}
              {selectedService && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-700 dark:text-blue-300">Tipo:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      {selectedService.serviceType || selectedService.code}
                    </span>
                  </div>
                  {selectedService.requiresWeight && (
                    <div className="flex items-center gap-1 mt-1 text-blue-600 dark:text-blue-400">
                      <Scale className="w-3 h-3" />
                      <span>Requiere peso</span>
                    </div>
                  )}
                </div>
              )}

              {/* Cantidad */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Hash className="w-4 h-4 inline mr-1" />
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Campo de peso (solo si el servicio lo soporta) */}
              {selectedService?.requiresWeight && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Scale className="w-4 h-4 inline mr-1" />
                    Peso ({selectedService.unitType || 'lb'}) <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`Ingrese peso en ${selectedService.unitType || 'libras'}`}
                  />
                  {parseFloat(String(selectedService.pricePerUnit)) > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Precio por {selectedService.unitType || 'lb'}: ${parseFloat(String(selectedService.pricePerUnit)).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {/* Precio personalizado (solo si NO es gratis) */}
              {selectedService?.pricingModel !== 'free' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Precio Base ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.customPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, customPrice: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Resumen de precio */}
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                {selectedService?.requiresWeight && parseFloat(formData.weight) > 0 && parseFloat(String(selectedService.pricePerUnit)) > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Precio base:</span>
                      <span className="text-gray-900 dark:text-white">
                        ${parseFloat(formData.customPrice || '0').toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Peso ({formData.weight} {selectedService.unitType || 'lb'} × ${parseFloat(String(selectedService.pricePerUnit)).toFixed(2)}):
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        ${(parseFloat(formData.weight) * parseFloat(String(selectedService.pricePerUnit))).toFixed(2)}
                      </span>
                    </div>
                    {formData.quantity > 1 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Cantidad:</span>
                        <span className="text-gray-900 dark:text-white">× {formData.quantity}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2"></div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
                  <span className={`font-bold text-lg ${selectedService?.pricingModel === 'free' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                    {selectedService?.pricingModel === 'free' ? 'Gratis' : `$${calculateTotalPrice().toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  disabled={loading || !selectedService}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Agregar Servicio
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
