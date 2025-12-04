'use client'

import { useState } from 'react'
import { Package, Truck, Settings, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProviderCheckboxProps {
  isProvider: boolean
  providerType: 'products' | 'services' | 'both' | null
  providerCategories: string[]
  onProviderChange: (isProvider: boolean) => void
  onProviderTypeChange: (type: 'products' | 'services' | 'both') => void
  onCategoriesChange: (categories: string[]) => void
}

const PROVIDER_TYPES = [
  {
    id: 'products' as const,
    name: 'Productos Fisicos',
    description: 'Cajas, empaques, materiales',
    icon: Package
  },
  {
    id: 'services' as const,
    name: 'Servicios de Envio',
    description: 'Transporte, courier, entregas',
    icon: Truck
  },
  {
    id: 'both' as const,
    name: 'Ambos',
    description: 'Productos y servicios',
    icon: Settings
  }
]

const SERVICE_CATEGORIES = [
  { id: 'paqueteria', name: 'Paqueteria', description: 'Cajas y envios' },
  { id: 'remesa', name: 'Remesa', description: 'Transferencias de dinero' },
  { id: 'recarga', name: 'Recarga', description: 'Recargas moviles' },
  { id: 'mercado', name: 'Mercado', description: 'Marketplace' }
]

export default function ProviderCheckbox({
  isProvider,
  providerType,
  providerCategories,
  onProviderChange,
  onProviderTypeChange,
  onCategoriesChange
}: ProviderCheckboxProps) {
  const handleCategoryToggle = (categoryId: string) => {
    if (providerCategories.includes(categoryId)) {
      onCategoriesChange(providerCategories.filter(c => c !== categoryId))
    } else {
      onCategoriesChange([...providerCategories, categoryId])
    }
  }

  return (
    <div className="space-y-4">
      {/* Main checkbox */}
      <label className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
        <input
          type="checkbox"
          checked={isProvider}
          onChange={(e) => onProviderChange(e.target.checked)}
          className="mt-1 w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
        />
        <div>
          <div className="font-medium text-amber-900 dark:text-amber-100">
            Esta empresa es PROVEEDOR de servicios
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Los proveedores suministran productos o servicios a LogiRapid y otras empresas de la plataforma.
          </p>
        </div>
      </label>

      {/* Provider configuration - only if isProvider */}
      {isProvider && (
        <div className="ml-8 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Provider Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de proveedor
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PROVIDER_TYPES.map(type => {
                const Icon = type.icon
                const isSelected = providerType === type.id

                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => onProviderTypeChange(type.id)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                      isSelected
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      isSelected
                        ? "bg-amber-500 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "font-medium text-sm",
                        isSelected
                          ? "text-amber-900 dark:text-amber-100"
                          : "text-gray-900 dark:text-white"
                      )}>
                        {type.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {type.description}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-5 h-5 text-amber-500" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Categorias que provee
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {SERVICE_CATEGORIES.map(category => {
                const isSelected = providerCategories.includes(category.id)

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => handleCategoryToggle(category.id)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border text-left transition-all",
                      isSelected
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700"
                    )}
                  >
                    <div>
                      <div className={cn(
                        "font-medium text-sm",
                        isSelected
                          ? "text-amber-900 dark:text-amber-100"
                          : "text-gray-900 dark:text-white"
                      )}>
                        {category.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {category.description}
                      </div>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      isSelected
                        ? "border-amber-500 bg-amber-500"
                        : "border-gray-300 dark:border-gray-600"
                    )}>
                      {isSelected && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            {providerCategories.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Seleccione al menos una categoria
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
