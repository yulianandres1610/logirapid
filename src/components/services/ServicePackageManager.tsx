'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, Package, Plus, X, Check, AlertCircle } from 'lucide-react'

interface ServicePackageManagerProps {
  services: string[]
  serviceQuantities: { [serviceName: string]: number }
  servicePackages: { [serviceName: string]: string[] }
  boxSize: string
  boxQuantity: number
  onServicesChange: (services: string[]) => void
  onServiceQuantitiesChange: (quantities: { [serviceName: string]: number }) => void
  onServicePackagesChange: (packages: { [serviceName: string]: string[] }) => void
  onBoxSizeChange: (size: string) => void
  onBoxQuantityChange: (quantity: number) => void
}

const SERVICES_LIST = [
  'Recogida Caja Llena',
  'Recogida Caja Vacía',
  'Entrega Caja Llena',
  'Entrega Caja Vacía',
  'Almacenamiento',
  'Embalaje',
  'Transporte'
]

const BOX_SIZES = [
  { value: 'pequeno', label: 'Pequeño', color: 'bg-green-100 text-green-800' },
  { value: 'mediano', label: 'Mediano', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'grande', label: 'Grande', color: 'bg-red-100 text-red-800' }
]

export function ServicePackageManager({
  services,
  serviceQuantities,
  servicePackages,
  boxSize,
  boxQuantity,
  onServicesChange,
  onServiceQuantitiesChange,
  onServicePackagesChange,
  onBoxSizeChange,
  onBoxQuantityChange
}: ServicePackageManagerProps) {
  const [scannedCode, setScannedCode] = useState('')
  const [codeValidation, setCodeValidation] = useState<'valid' | 'invalid' | 'checking' | null>(null)
  const [availablePackages, setAvailablePackages] = useState<any[]>([])

  // Cargar empaques disponibles cuando cambia el tamaño
  useEffect(() => {
    if (boxSize) {
      loadAvailablePackages()
    }
  }, [boxSize])

  const loadAvailablePackages = async () => {
    try {
      const response = await fetch(`/api/empaques?tamano=${boxSize}&disponibilidad=disponible`)
      const data = await response.json()
      if (data.success) {
        setAvailablePackages(data.data)
      }
    } catch (error) {
      console.error('Error al cargar empaques:', error)
    }
  }

  const validateCode = async (code: string) => {
    if (!code.trim()) {
      setCodeValidation(null)
      return
    }

    setCodeValidation('checking')

    try {
      const response = await fetch(`/api/empaques?codigo=${code}`)
      const data = await response.json()

      if (data.success && data.data.length > 0) {
        const pack = data.data[0]
        if (pack.estado === 'disponible' && pack.tamano === boxSize) {
          setCodeValidation('valid')
        } else {
          setCodeValidation('invalid')
        }
      } else {
        setCodeValidation('invalid')
      }
    } catch (error) {
      setCodeValidation('invalid')
    }
  }

  const handleScanCode = () => {
    if (scannedCode.trim() && codeValidation === 'valid') {
      // Agregar el código a todos los servicios seleccionados
      const updatedPackages = { ...servicePackages }
      services.forEach(service => {
        if (!updatedPackages[service]) {
          updatedPackages[service] = []
        }
        if (!updatedPackages[service].includes(scannedCode.trim())) {
          updatedPackages[service].push(scannedCode.trim())
        }
      })
      onServicePackagesChange(updatedPackages)
      setScannedCode('')
      setCodeValidation(null)
    }
  }

  const removePackageCode = (service: string, code: string) => {
    const updatedPackages = { ...servicePackages }
    if (updatedPackages[service]) {
      updatedPackages[service] = updatedPackages[service].filter(c => c !== code)
    }
    onServicePackagesChange(updatedPackages)
  }

  const toggleService = (service: string) => {
    const updatedServices = services.includes(service)
      ? services.filter(s => s !== service)
      : [...services, service]

    onServicesChange(updatedServices)

    // Limpiar cantidades y paquetes si se deselecciona el servicio
    if (!updatedServices.includes(service)) {
      const updatedQuantities = { ...serviceQuantities }
      const updatedPackages = { ...servicePackages }
      delete updatedQuantities[service]
      delete updatedPackages[service]
      onServiceQuantitiesChange(updatedQuantities)
      onServicePackagesChange(updatedPackages)
    }
  }

  const updateServiceQuantity = (service: string, quantity: number) => {
    const updatedQuantities = { ...serviceQuantities }
    if (quantity > 0) {
      updatedQuantities[service] = quantity
    } else {
      delete updatedQuantities[service]
    }
    onServiceQuantitiesChange(updatedQuantities)
  }

  const getSizeColor = (size: string) => {
    const sizeConfig = BOX_SIZES.find(s => s.value === size)
    return sizeConfig?.color || 'bg-gray-100 text-gray-800'
  }

  return (
    <Card className="w-full bg-gray-800 border-gray-700 text-white">
      <CardHeader className="border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Gestión de Servicios y Empaques</h3>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">

        {/* Selección de Servicios */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Seleccionar Servicios
          </label>
          <div className="flex flex-wrap gap-2">
            {SERVICES_LIST.map((service) => (
              <Button
                key={service}
                variant={services.includes(service) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleService(service)}
                className={`rounded-full transition-colors ${
                  services.includes(service)
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {service}
              </Button>
            ))}
          </div>
        </div>

        {/* Tamaño de Caja */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Tamaño de la Caja
          </label>
          <Select value={boxSize} onValueChange={onBoxSizeChange}>
            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
              <SelectValue placeholder="Seleccionar tamaño" />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600">
              {BOX_SIZES.map((size) => (
                <SelectItem key={size.value} value={size.value} className="text-white">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {size.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {boxSize && (
            <Badge className={getSizeColor(boxSize)}>
              {BOX_SIZES.find(s => s.value === boxSize)?.label}
            </Badge>
          )}
        </div>

        {/* Cantidad de Cajas */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Cantidad de Cajas
          </label>
          <Input
            type="number"
            min="1"
            value={boxQuantity || ''}
            onChange={(e) => onBoxQuantityChange(parseInt(e.target.value) || 0)}
            placeholder="Ingrese la cantidad"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        {/* Escáner de Códigos */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Escanear Código de Caja
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Ingrese o escanee el código..."
                value={scannedCode}
                onChange={(e) => {
                  setScannedCode(e.target.value)
                  validateCode(e.target.value)
                }}
                className={`pr-10 bg-gray-700 border-gray-600 text-white ${
                  codeValidation === 'valid' ? 'border-green-500 bg-green-900/30' :
                  codeValidation === 'invalid' ? 'border-red-500 bg-red-900/30' :
                  codeValidation === 'checking' ? 'border-yellow-500 bg-yellow-900/30' :
                  ''
                }`}
              />
              {codeValidation && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {codeValidation === 'valid' && <Check className="w-5 h-5 text-green-400" />}
                  {codeValidation === 'invalid' && <X className="w-5 h-5 text-red-400" />}
                  {codeValidation === 'checking' && <AlertCircle className="w-5 h-5 text-yellow-400" />}
                </div>
              )}
            </div>
            <Button
              onClick={handleScanCode}
              disabled={codeValidation !== 'valid' || !boxSize}
              className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600 disabled:text-gray-400"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
          {codeValidation === 'invalid' && (
            <p className="text-sm text-red-400">Código no válido o no disponible</p>
          )}
          {codeValidation === 'valid' && (
            <p className="text-sm text-green-400">Código válido y disponible</p>
          )}
        </div>

        {/* Resumen de Servicios Seleccionados */}
        {services.length > 0 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">
              Resumen de Servicios
            </label>
            <div className="space-y-3">
              {services.map((service) => (
                <Card key={service} className="p-4 bg-gray-700 border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{service}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleService(service)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Cantidad
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={serviceQuantities[service] || ''}
                        onChange={(e) => updateServiceQuantity(service, parseInt(e.target.value) || 0)}
                        placeholder="Cantidad"
                        className="w-full bg-gray-600 border-gray-500 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Códigos de Caja Asociados
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {servicePackages[service]?.map((code) => (
                          <Badge
                            key={code}
                            variant="secondary"
                            className="bg-green-800 text-green-100 border-green-600"
                          >
                            {code}
                            <button
                              onClick={() => removePackageCode(service, code)}
                              className="ml-1 hover:text-red-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                        {(!servicePackages[service] || servicePackages[service].length === 0) && (
                          <span className="text-xs text-gray-500">Sin códigos</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  )
}