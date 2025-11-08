'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Package, Plus, X, User, Phone, Mail, MapPin, Trash2, Edit2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Customer {
  id: number
  firstName: string
  lastName: string
  phone: string
  email?: string
  address?: {
    street: string
    apartment: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  notes?: string
}

interface BoxItem {
  id: string
  size: 'pequeno' | 'mediano' | 'grande'
  quantity: number
  recipient: Customer | null
  recipientSearchTerm: string
  isNewRecipient: boolean
  newRecipientData: {
    firstName: string
    lastName: string
    phone: string
    email: string
  } | null
  packageCodes: string[]
  needsConstruction: boolean
}

interface BoxRecipientManagerProps {
  boxes: BoxItem[]
  onBoxesChange: (boxes: BoxItem[]) => void
  selectedServices: string[]
  onServicesChange: (services: string[]) => void
  theme?: string
}

const BOX_SIZES = [
  { value: 'pequeno', label: 'Pequeño', price: 45, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300', icon: '📦' },
  { value: 'mediano', label: 'Mediano', price: 55, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300', icon: '📋' },
  { value: 'grande', label: 'Grande', price: 65, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300', icon: '📚' }
]

const SERVICE_TYPES = [
  { id: 'entrega-caja', name: 'Entrega de Caja Vacía', icon: '📤', description: 'Entregamos caja vacía en tu domicilio para que la prepares' },
  { id: 'recogida-caja', name: 'Recogida de Caja Llena', icon: '📥', description: 'Recogemos tu caja completamente llena' },
  { id: 'recogida-duradero', name: 'Recogida de Duradero', icon: '🏠', description: 'Recogemos tus artículos duraderos' }
]

const CONSTRUCTION_COST = 5

export function BoxRecipientManager({ boxes, onBoxesChange, selectedServices, onServicesChange, theme = 'light' }: BoxRecipientManagerProps) {
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null)
  const [searchingRecipient, setSearchingRecipient] = useState<{ [boxId: string]: boolean }>({})
  const [recipientSearchResults, setRecipientSearchResults] = useState<{ [boxId: string]: Customer[] }>({})

  const toggleService = (serviceName: string) => {
    if (selectedServices.includes(serviceName)) {
      onServicesChange(selectedServices.filter(s => s !== serviceName))
    } else {
      onServicesChange([...selectedServices, serviceName])
    }
  }

  const addNewBox = () => {
    const newBox: BoxItem = {
      id: `box-${Date.now()}`,
      size: 'mediano',
      quantity: 1,
      recipient: null,
      recipientSearchTerm: '',
      isNewRecipient: false,
      newRecipientData: null,
      packageCodes: [],
      needsConstruction: false
    }
    onBoxesChange([...boxes, newBox])
    setExpandedBoxId(newBox.id)
  }

  const removeBox = (boxId: string) => {
    onBoxesChange(boxes.filter(b => b.id !== boxId))
    if (expandedBoxId === boxId) {
      setExpandedBoxId(null)
    }
  }

  const updateBox = (boxId: string, updates: Partial<BoxItem>) => {
    onBoxesChange(boxes.map(b => b.id === boxId ? { ...b, ...updates } : b))
  }

  const searchRecipient = async (boxId: string, searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 3) {
      setRecipientSearchResults({ ...recipientSearchResults, [boxId]: [] })
      return
    }

    setSearchingRecipient({ ...searchingRecipient, [boxId]: true })

    try {
      const response = await fetch(`/api/customers?phone=${encodeURIComponent(searchTerm)}`)
      const data = await response.json()

      if (data.success && data.data) {
        setRecipientSearchResults({ ...recipientSearchResults, [boxId]: data.data })
      } else {
        setRecipientSearchResults({ ...recipientSearchResults, [boxId]: [] })
      }
    } catch (error) {
      console.error('Error searching recipient:', error)
      setRecipientSearchResults({ ...recipientSearchResults, [boxId]: [] })
    } finally {
      setSearchingRecipient({ ...searchingRecipient, [boxId]: false })
    }
  }

  const selectExistingRecipient = (boxId: string, customer: Customer) => {
    updateBox(boxId, {
      recipient: customer,
      recipientSearchTerm: `${customer.firstName} ${customer.lastName} - ${customer.phone}`,
      isNewRecipient: false,
      newRecipientData: null
    })
    setRecipientSearchResults({ ...recipientSearchResults, [boxId]: [] })
  }

  const selectNewRecipient = (boxId: string) => {
    const box = boxes.find(b => b.id === boxId)
    if (!box) return

    updateBox(boxId, {
      recipient: null,
      isNewRecipient: true,
      newRecipientData: {
        firstName: '',
        lastName: '',
        phone: box.recipientSearchTerm,
        email: ''
      }
    })
    setRecipientSearchResults({ ...recipientSearchResults, [boxId]: [] })
  }

  const updateNewRecipient = (boxId: string, field: string, value: string) => {
    const box = boxes.find(b => b.id === boxId)
    if (!box || !box.newRecipientData) return

    updateBox(boxId, {
      newRecipientData: {
        ...box.newRecipientData,
        [field]: value
      }
    })
  }

  const calculateBoxPrice = (box: BoxItem) => {
    const sizeInfo = BOX_SIZES.find(s => s.value === box.size)
    const basePrice = sizeInfo?.price || 55
    const constructionFee = box.needsConstruction ? CONSTRUCTION_COST : 0
    return (basePrice + constructionFee) * box.quantity
  }

  const calculateTotal = () => {
    return boxes.reduce((total, box) => total + calculateBoxPrice(box), 0)
  }

  return (
    <div className="space-y-6">
      {/* Service Selection Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Seleccionar Servicios
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Elige los servicios que necesitas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SERVICE_TYPES.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => toggleService(service.name)}
              className={cn(
                "p-6 rounded-lg border-2 transition-all text-left",
                "bg-gray-800 hover:bg-gray-700",
                selectedServices.includes(service.name)
                  ? "border-blue-500 ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900"
                  : "border-gray-600 hover:border-gray-500"
              )}
            >
              <div className="flex flex-col items-center text-center">
                <span className="text-4xl mb-3">{service.icon}</span>
                <h4 className="font-semibold text-white mb-2">
                  {service.name}
                </h4>
                <p className="text-sm text-gray-400">
                  {service.description}
                </p>
                {selectedServices.includes(service.name) && (
                  <div className="mt-3">
                    <Check className="w-5 h-5 text-blue-400 mx-auto" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Boxes Section */}
      <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Cajas para Enviar
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Agregue cajas individuales con su tamaño y destinatario
            </p>
          </div>
          <Button
            type="button"
            onClick={addNewBox}
            className={cn(
              "text-white",
              theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
            )}
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Caja
          </Button>
        </div>

      {/* Boxes List */}
      {boxes.length === 0 && (
        <Card className={cn(
          "border-2 border-dashed",
          theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'
        )}>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-12 h-12 text-gray-400 mb-3" />
            <p className="text-gray-600 dark:text-gray-400 text-center">
              No hay cajas agregadas<br />
              <span className="text-sm">Haga clic en "Agregar Caja" para comenzar</span>
            </p>
          </CardContent>
        </Card>
      )}

      {boxes.map((box, index) => {
        const sizeInfo = BOX_SIZES.find(s => s.value === box.size)
        const isExpanded = expandedBoxId === box.id
        const boxPrice = calculateBoxPrice(box)
        const searchResults = recipientSearchResults[box.id] || []
        const isSearching = searchingRecipient[box.id] || false

        return (
          <Card key={box.id} className={cn(
            "border-2 transition-all",
            isExpanded
              ? theme === 'dark' ? 'border-blue-600 bg-gray-800' : 'border-red-600 bg-red-50'
              : theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{sizeInfo?.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        Caja #{index + 1}
                      </h4>
                      <Badge className={sizeInfo?.color}>
                        {sizeInfo?.label}
                      </Badge>
                      {box.needsConstruction && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          Con confección
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {box.recipient ? (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {box.recipient.firstName} {box.recipient.lastName}
                        </span>
                      ) : box.isNewRecipient && box.newRecipientData ? (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <Plus className="w-3 h-3" />
                          Nuevo: {box.newRecipientData.firstName} {box.newRecipientData.lastName}
                        </span>
                      ) : (
                        <span className="text-yellow-600 dark:text-yellow-400">Sin destinatario</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    ${boxPrice.toFixed(2)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedBoxId(isExpanded ? null : box.id)}
                    className="text-gray-600 dark:text-gray-400"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBox(box.id)}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                {/* Size Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tamaño de la Caja
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {BOX_SIZES.map((size) => (
                      <Button
                        key={size.value}
                        type="button"
                        variant={box.size === size.value ? "default" : "outline"}
                        onClick={() => updateBox(box.id, { size: size.value as any })}
                        className={cn(
                          "flex flex-col h-auto py-3",
                          box.size === size.value
                            ? theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        )}
                      >
                        <span className="text-lg mb-1">{size.icon}</span>
                        <span className="text-xs font-medium">{size.label}</span>
                        <span className="text-xs opacity-75">${size.price}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cantidad
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateBox(box.id, { quantity: Math.max(1, box.quantity - 1) })}
                      className="h-8 w-8 p-0"
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={box.quantity}
                      onChange={(e) => updateBox(box.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-20 h-8 text-center"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateBox(box.id, { quantity: box.quantity + 1 })}
                      className="h-8 w-8 p-0"
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Construction */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={box.needsConstruction}
                      onChange={(e) => updateBox(box.id, { needsConstruction: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Requiere confección (+${CONSTRUCTION_COST.toFixed(2)})
                    </span>
                  </label>
                </div>

                {/* Recipient Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Destinatario
                  </label>

                  {!box.recipient && !box.isNewRecipient && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Buscar por teléfono..."
                          value={box.recipientSearchTerm}
                          onChange={(e) => {
                            updateBox(box.id, { recipientSearchTerm: e.target.value })
                            searchRecipient(box.id, e.target.value)
                          }}
                          className="pl-10"
                        />
                      </div>

                      {isSearching && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <AlertCircle className="w-4 h-4 animate-spin" />
                          Buscando...
                        </div>
                      )}

                      {searchResults.length > 0 && (
                        <div className="border border-gray-300 dark:border-gray-600 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                          {searchResults.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => selectExistingRecipient(box.id, customer)}
                              className="w-full text-left p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              <div className="font-medium text-gray-900 dark:text-white">
                                {customer.firstName} {customer.lastName}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {customer.phone}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {box.recipientSearchTerm && searchResults.length === 0 && !isSearching && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => selectNewRecipient(box.id)}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Crear nuevo destinatario
                        </Button>
                      )}
                    </div>
                  )}

                  {/* New Recipient Form */}
                  {box.isNewRecipient && box.newRecipientData && (
                    <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-800 dark:text-green-300">
                          Nuevo Destinatario
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateBox(box.id, { isNewRecipient: false, newRecipientData: null, recipientSearchTerm: '' })}
                          className="text-gray-600 dark:text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          placeholder="Nombre"
                          value={box.newRecipientData.firstName}
                          onChange={(e) => updateNewRecipient(box.id, 'firstName', e.target.value)}
                        />
                        <Input
                          placeholder="Apellido"
                          value={box.newRecipientData.lastName}
                          onChange={(e) => updateNewRecipient(box.id, 'lastName', e.target.value)}
                        />
                      </div>
                      <Input
                        placeholder="Teléfono"
                        value={box.newRecipientData.phone}
                        onChange={(e) => updateNewRecipient(box.id, 'phone', e.target.value)}
                      />
                      <Input
                        placeholder="Email (opcional)"
                        type="email"
                        value={box.newRecipientData.email}
                        onChange={(e) => updateNewRecipient(box.id, 'email', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Selected Recipient Display */}
                  {box.recipient && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                          Destinatario Seleccionado
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateBox(box.id, { recipient: null, recipientSearchTerm: '' })}
                          className="text-gray-600 dark:text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                          <User className="w-4 h-4" />
                          <span className="font-medium">
                            {box.recipient.firstName} {box.recipient.lastName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Phone className="w-4 h-4" />
                          {box.recipient.phone}
                        </div>
                        {box.recipient.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <Mail className="w-4 h-4" />
                            {box.recipient.email}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

        {/* Total Summary */}
        {boxes.length > 0 && (
          <Card className={cn(
            "border-2",
            theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
          )}>
            <CardContent className="py-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {boxes.length} caja{boxes.length !== 1 ? 's' : ''} • {boxes.reduce((sum, b) => sum + b.quantity, 0)} unidad{boxes.reduce((sum, b) => sum + b.quantity, 0) !== 1 ? 'es' : ''}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    *Tamaños: Pequeña $45, Mediana $55, Grande $65 (+$5 confección)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? 'text-blue-400' : 'text-red-600'
                  )}>
                    ${calculateTotal().toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
