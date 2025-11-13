'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, Package } from 'lucide-react'

interface PackageSize {
  id: number
  codigo: string
  tamano: 'pequeno' | 'mediano' | 'grande'
  tipo: string
  descripcion: string
}

interface PackageSizeSelectorProps {
  serviceName: string
  selectedSize: string
  selectedPackage: PackageSize | null
  onSizeChange: (size: string) => void
  onPackageSelect: (pack: PackageSize | null) => void
}

const SIZES = [
  { value: 'pequeno', label: 'Pequeño', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { value: 'mediano', label: 'Mediano', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'grande', label: 'Grande', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' }
]

export function PackageSizeSelector({
  serviceName,
  selectedSize,
  selectedPackage,
  onSizeChange,
  onPackageSelect
}: PackageSizeSelectorProps) {
  const [availablePackages, setAvailablePackages] = useState<PackageSize[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPackageSelector, setShowPackageSelector] = useState(false)

  // Cargar empaques disponibles cuando cambia el tamaño seleccionado
  useEffect(() => {
    if (selectedSize) {
      loadAvailablePackages(selectedSize)
    } else {
      setAvailablePackages([])
      onPackageSelect(null)
    }
  }, [selectedSize])

  const loadAvailablePackages = async (size: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/empaques?tamano=${size}&disponibilidad=disponible`)
      const data = await response.json()

      if (data.success) {
        setAvailablePackages(data.data)
        // Si no hay empaques disponibles, limpiar la selección
        if (data.data.length === 0) {
          onPackageSelect(null)
        }
      }
    } catch (error) {
      console.error('Error al cargar empaques:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredPackages = availablePackages.filter(pack =>
    pack.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pack.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getSizeColor = (size: string) => {
    const sizeConfig = SIZES.find(s => s.value === size)
    return sizeConfig?.color || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tamaño del empaque - {serviceName}
          </label>
          <Select
            value={selectedSize}
            onValueChange={onSizeChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar tamaño" />
            </SelectTrigger>
            <SelectContent>
              {SIZES.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {size.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedSize && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Empaque específico
            </label>
            <Badge className={getSizeColor(selectedSize)}>
              {SIZES.find(s => s.value === selectedSize)?.label}
            </Badge>
          </div>

          {selectedPackage ? (
            <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-green-900 dark:text-green-100">
                    {selectedPackage.codigo}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    {selectedPackage.descripcion}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPackageSelector(true)
                  }}
                >
                  Cambiar
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <div className="text-center">
                {availablePackages.length > 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowPackageSelector(true)}
                    className="w-full"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Seleccionar empaque disponible
                  </Button>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">
                    {isLoading ? 'Cargando...' : 'No hay empaques disponibles de este tamaño'}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Modal de selección de empaque */}
      {showPackageSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[80vh] overflow-hidden">
            <CardHeader>
              <h3 className="text-lg font-semibold">Seleccionar Empaque</h3>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={getSizeColor(selectedSize)}>
                  {SIZES.find(s => s.value === selectedSize)?.label}
                </Badge>
                <span className="text-sm text-gray-500">
                  {availablePackages.length} disponibles
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por código o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredPackages.length > 0 ? (
                  filteredPackages.map((pack) => (
                    <div
                      key={pack.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      onClick={() => {
                        onPackageSelect(pack)
                        setShowPackageSelector(false)
                        setSearchTerm('')
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{pack.codigo}</div>
                          <div className="text-sm text-gray-500">{pack.descripcion}</div>
                        </div>
                        <Package className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    No se encontraron empaques
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPackageSelector(false)
                  setSearchTerm('')
                }}
              >
                Cancelar
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}