'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, Package, Plus, X, Check, AlertCircle, Trash2, Edit2 } from 'lucide-react'

interface BoxConfiguration {
  tamano: 'pequeno' | 'mediano' | 'grande'
  cantidad: number
  codigos: string[]
}

interface ServiceConfiguration {
  serviceName: string
  cajas: BoxConfiguration[]
}

interface AdvancedServicePackageManagerProps {
  services: string[]
  serviceConfigurations: { [serviceName: string]: ServiceConfiguration }
  onServicesChange: (services: string[]) => void
  onServiceConfigurationsChange: (configurations: { [serviceName: string]: ServiceConfiguration }) => void
}

const SERVICES_LIST = [
  'Recoger Caja',
  'Entregar Caja',
  'Recoger Duradero',
  'Confeccionar caja'
]

const BOX_SIZES = [
  { value: 'pequeno', label: 'Pequeño', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { value: 'mediano', label: 'Mediano', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'grande', label: 'Grande', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' }
]

export function AdvancedServicePackageManager({
  services,
  serviceConfigurations,
  onServicesChange,
  onServiceConfigurationsChange
}: AdvancedServicePackageManagerProps) {
  const [availablePackages, setAvailablePackages] = useState<any[]>([])
  const [scannedCode, setScannedCode] = useState('')
  const [codeValidation, setCodeValidation] = useState<'valid' | 'invalid' | 'checking' | null>(null)
  const [selectedSizeForScanning, setSelectedSizeForScanning] = useState<string>('')
  const [selectedServiceForScanning, setSelectedServiceForScanning] = useState<string>('')

  // Cargar empaques disponibles
  useEffect(() => {
    loadAvailablePackages()
  }, [])

  const loadAvailablePackages = async () => {
    try {
      const response = await fetch('/api/empaques?disponibilidad=disponible')
      const data = await response.json()
      if (data.success) {
        setAvailablePackages(data.data)
      }
    } catch (error) {
      console.error('Error al cargar empaques:', error)
    }
  }

  const validateCode = async (code: string, size: string) => {
    if (!code.trim() || !size) {
      setCodeValidation(null)
      return
    }

    setCodeValidation('checking')

    try {
      const response = await fetch(`/api/empaques?codigo=${code}`)
      const data = await response.json()

      if (data.success && data.data.length > 0) {
        const pack = data.data[0]
        if (pack.estado === 'disponible' && pack.tamano === size) {
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

  const toggleService = (service: string) => {
    try {
      const updatedServices = services.includes(service)
        ? services.filter(s => s !== service)
        : [...services, service]

      onServicesChange(updatedServices)

      // Si se elimina un servicio, eliminar su configuración
      if (!updatedServices.includes(service)) {
        const updatedConfigurations = { ...serviceConfigurations }
        delete updatedConfigurations[service]
        onServiceConfigurationsChange(updatedConfigurations)
      } else {
        // Si se agrega un servicio, inicializar su configuración
        const updatedConfigurations = {
          ...serviceConfigurations,
          [service]: {
            serviceName: service,
            cajas: []
          }
        }
        onServiceConfigurationsChange(updatedConfigurations)
      }
    } catch (error) {
      console.error('Error toggling service:', error)
      // No dejar que el error se propague y cierre la vista
    }
  }

  const addBoxToService = (serviceName: string, size: 'pequeno' | 'mediano' | 'grande') => {
    try {
      const currentConfig = serviceConfigurations[serviceName] || { serviceName, cajas: [] }

      // Verificar si ya existe una configuración para este tamaño
      const existingBoxIndex = currentConfig.cajas.findIndex(box => box.tamano === size)

      if (existingBoxIndex >= 0) {
        // Si existe, incrementar la cantidad
        const updatedBoxes = [...currentConfig.cajas]
        updatedBoxes[existingBoxIndex].cantidad += 1
        currentConfig.cajas = updatedBoxes
      } else {
        // Si no existe, agregar nueva configuración
        currentConfig.cajas.push({
          tamano: size,
          cantidad: 1,
          codigos: []
        })
      }

      const updatedConfigurations = {
        ...serviceConfigurations,
        [serviceName]: currentConfig
      }
      onServiceConfigurationsChange(updatedConfigurations)
    } catch (error) {
      console.error('Error adding box to service:', error)
    }
  }

  const updateBoxQuantity = (serviceName: string, size: string, quantity: number) => {
    try {
      if (quantity <= 0) {
        removeBoxFromService(serviceName, size)
        return
      }

      const currentConfig = serviceConfigurations[serviceName]
      const boxIndex = currentConfig.cajas.findIndex(box => box.tamano === size)

      if (boxIndex >= 0) {
        currentConfig.cajas[boxIndex].cantidad = quantity
        const updatedConfigurations = { ...serviceConfigurations }
        updatedConfigurations[serviceName] = currentConfig
        onServiceConfigurationsChange(updatedConfigurations)
      }
    } catch (error) {
      console.error('Error updating box quantity:', error)
    }
  }

  const removeBoxFromService = (serviceName: string, size: string) => {
    try {
      const currentConfig = serviceConfigurations[serviceName]
      currentConfig.cajas = currentConfig.cajas.filter(box => box.tamano !== size)

      const updatedConfigurations = { ...serviceConfigurations }
      updatedConfigurations[serviceName] = currentConfig
      onServiceConfigurationsChange(updatedConfigurations)
    } catch (error) {
      console.error('Error removing box from service:', error)
    }
  }

  const startScanningForBox = (serviceName: string, size: string) => {
    setSelectedServiceForScanning(serviceName)
    setSelectedSizeForScanning(size)
    setScannedCode('')
    setCodeValidation(null)
  }

  const handleScanCode = () => {
    if (scannedCode.trim() && codeValidation === 'valid' && selectedServiceForScanning && selectedSizeForScanning) {
      const currentConfig = serviceConfigurations[selectedServiceForScanning]
      const boxIndex = currentConfig.cajas.findIndex(box => box.tamano === selectedSizeForScanning)

      if (boxIndex >= 0) {
        const currentCodes = currentConfig.cajas[boxIndex].codigos || []
        if (!currentCodes.includes(scannedCode.trim())) {
          currentConfig.cajas[boxIndex].codigos.push(scannedCode.trim())

          const updatedConfigurations = { ...serviceConfigurations }
          updatedConfigurations[selectedServiceForScanning] = currentConfig
          onServiceConfigurationsChange(updatedConfigurations)
        }
      }

      // Reset scanning state
      setScannedCode('')
      setCodeValidation(null)
      setSelectedServiceForScanning('')
      setSelectedSizeForScanning('')
    }
  }

  const removeCodeFromBox = (serviceName: string, size: string, code: string) => {
    try {
      const currentConfig = serviceConfigurations[serviceName]
      const boxIndex = currentConfig.cajas.findIndex(box => box.tamano === size)

      if (boxIndex >= 0) {
        currentConfig.cajas[boxIndex].codigos = currentConfig.cajas[boxIndex].codigos.filter(c => c !== code)

        const updatedConfigurations = { ...serviceConfigurations }
        updatedConfigurations[serviceName] = currentConfig
        onServiceConfigurationsChange(updatedConfigurations)
      }
    } catch (error) {
      console.error('Error removing code from box:', error)
    }
  }

  const getSizeColor = (size: string) => {
    const sizeConfig = BOX_SIZES.find(s => s.value === size)
    return sizeConfig?.color || 'bg-gray-100 text-gray-800'
  }

  const getTotalBoxes = (serviceName: string) => {
    const config = serviceConfigurations[serviceName]
    if (!config) return 0
    return config.cajas.reduce((total, box) => total + box.cantidad, 0)
  }

  const getTotalCodes = (serviceName: string) => {
    const config = serviceConfigurations[serviceName]
    if (!config) return 0
    return config.cajas.reduce((total, box) => total + (box.codigos?.length || 0), 0)
  }

  return (
    <Card className="w-full bg-gray-800 border-gray-700 text-white">
      <CardHeader className="border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">Gestión Avanzada de Empaques</h3>
        <p className="text-sm text-gray-400">Configura múltiples tamaños y cantidades de cajas por servicio</p>
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
                type="button"
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

        {/* Configuración por Servicio */}
        {services.length > 0 && (
          <div className="space-y-4">
            {services.map((serviceName) => {
              const config = serviceConfigurations[serviceName] || { serviceName, cajas: [] }

              return (
                <Card key={serviceName} className="bg-gray-700 border-gray-600">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white">{serviceName}</h4>
                        <div className="flex gap-4 mt-1">
                          <span className="text-xs text-gray-400">
                            {getTotalBoxes(serviceName)} cajas totales
                          </span>
                          <span className="text-xs text-blue-400">
                            {getTotalCodes(serviceName)} códigos asignados
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleService(serviceName)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">

                    {/* Agregar Cajas por Tamaño */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400">
                        Agregar Cajas por Tamaño
                      </label>
                      <div className="flex gap-2">
                        {BOX_SIZES.map((size) => (
                          <Button
                            key={size.value}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addBoxToService(serviceName, size.value as any)}
                            className="bg-gray-600 border-gray-500 text-gray-200 hover:bg-gray-500"
                          >
                            <Package className="w-3 h-3 mr-1" />
                            {size.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Lista de Cajas Configuradas */}
                    {config.cajas.length > 0 && (
                      <div className="space-y-3">
                        {config.cajas.map((box, index) => (
                          <div key={index} className="bg-gray-600 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge className={getSizeColor(box.tamano)}>
                                  {BOX_SIZES.find(s => s.value === box.tamano)?.label}
                                </Badge>
                                <span className="text-white font-medium">
                                  Cantidad:
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateBoxQuantity(serviceName, box.tamano, box.cantidad - 1)}
                                    className="h-6 w-6 p-0 bg-gray-500 border-gray-400 text-white hover:bg-gray-400"
                                  >
                                    -
                                  </Button>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={box.cantidad}
                                    onChange={(e) => updateBoxQuantity(serviceName, box.tamano, parseInt(e.target.value) || 0)}
                                    className="w-16 h-8 text-center bg-gray-500 border-gray-400 text-white"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateBoxQuantity(serviceName, box.tamano, box.cantidad + 1)}
                                    className="h-6 w-6 p-0 bg-gray-500 border-gray-400 text-white hover:bg-gray-400"
                                  >
                                    +
                                  </Button>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startScanningForBox(serviceName, box.tamano)}
                                  className="bg-green-600 border-green-500 text-white hover:bg-green-700"
                                  disabled={box.cantidad === 0}
                                >
                                  <Search className="w-3 h-3 mr-1" />
                                  Escanear
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeBoxFromService(serviceName, box.tamano)}
                                  className="bg-red-600 border-red-500 text-white hover:bg-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Códigos Asignados */}
                            {box.codigos && box.codigos.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-gray-400 mb-1">
                                  Códigos asignados ({box.codigos.length}/{box.cantidad}):
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {box.codigos.map((code) => (
                                    <Badge
                                      key={code}
                                      variant="secondary"
                                      className="bg-green-800 text-green-100 border-green-600 text-xs"
                                    >
                                      {code}
                                      <button
                                        onClick={() => removeCodeFromBox(serviceName, box.tamano, code)}
                                        className="ml-1 hover:text-red-300"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </Badge>
                                  ))}
                                </div>
                                {box.codigos.length < box.cantidad && (
                                  <p className="text-xs text-yellow-400 mt-1">
                                    Faltan {box.cantidad - box.codigos.length} códigos
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Modal de Escaneo */}
                            {selectedServiceForScanning === serviceName && selectedSizeForScanning === box.tamano && (
                              <div className="mt-3 p-3 bg-gray-500 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                  <Search className="w-4 h-4 text-green-400" />
                                  <span className="text-sm font-medium text-white">
                                    Escanear Código - {BOX_SIZES.find(s => s.value === box.tamano)?.label}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedServiceForScanning('')
                                      setSelectedSizeForScanning('')
                                      setScannedCode('')
                                      setCodeValidation(null)
                                    }}
                                    className="ml-auto text-gray-400 hover:text-white"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <Input
                                      placeholder="Ingrese o escanee el código..."
                                      value={scannedCode}
                                      onChange={(e) => {
                                        setScannedCode(e.target.value)
                                        validateCode(e.target.value, selectedSizeForScanning)
                                      }}
                                      className={`pr-10 bg-gray-400 border-gray-300 text-white text-sm ${
                                        codeValidation === 'valid' ? 'border-green-500 bg-green-900/30' :
                                        codeValidation === 'invalid' ? 'border-red-500 bg-red-900/30' :
                                        codeValidation === 'checking' ? 'border-yellow-500 bg-yellow-900/30' :
                                        ''
                                      }`}
                                    />
                                    {codeValidation && (
                                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        {codeValidation === 'valid' && <Check className="w-4 h-4 text-green-400" />}
                                        {codeValidation === 'invalid' && <X className="w-4 h-4 text-red-400" />}
                                        {codeValidation === 'checking' && <AlertCircle className="w-4 h-4 text-yellow-400" />}
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    onClick={handleScanCode}
                                    disabled={codeValidation !== 'valid'}
                                    className="bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600 disabled:text-gray-400"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                                {codeValidation === 'invalid' && (
                                  <p className="text-xs text-red-400 mt-1">Código no válido o no disponible</p>
                                )}
                                {codeValidation === 'valid' && (
                                  <p className="text-xs text-green-400 mt-1">Código válido y disponible</p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {services.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Selecciona al menos un servicio para configurar los empaques</p>
          </div>
        )}

      </CardContent>
    </Card>
  )
}