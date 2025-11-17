'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, Plus, Minus, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext?: () => void
}

interface PackageSize {
  id: number
  name: string
  dimensions: string
  price: number
  description?: string
  weight?: number
}

interface EmpaqueSelection {
  package_size_id: number
  package_size_name: string
  quantity: number
  dimensions: string
  price: number
}

export default function EmpaqueSelectionStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [packageSizes, setPackageSizes] = useState<PackageSize[]>([])
  const [loadingSizes, setLoadingSizes] = useState(true)
  const [selectedEmpaques, setSelectedEmpaques] = useState<EmpaqueSelection[]>(wizardData.selectedEmpaques || [])

  // Load package sizes from configuration
  useEffect(() => {
    const fetchPackageSizes = async () => {
      setLoadingSizes(true)
      try {
        const response = await fetch('/api/package-sizes')
        const result = await response.json()

        if (result.success && result.data) {
          setPackageSizes(result.data)
        }
      } catch (error) {
        console.error('Error fetching package sizes:', error)
      } finally {
        setLoadingSizes(false)
      }
    }

    fetchPackageSizes()
  }, [])

  // Validate and update canProceed
  useEffect(() => {
    const hasEmpaques = selectedEmpaques.length > 0 && selectedEmpaques.some(e => e.quantity > 0)
    setCanProceed(hasEmpaques)
  }, [selectedEmpaques, setCanProceed])

  // Update wizard data when empaques change
  useEffect(() => {
    updateWizardData('selectedEmpaques', selectedEmpaques)
  }, [selectedEmpaques])

  const handleQuantityChange = (packageSizeId: number, delta: number) => {
    const packageSize = packageSizes.find(item => item.id === packageSizeId)
    if (!packageSize) return

    const currentEmpaque = selectedEmpaques.find(e => e.package_size_id === packageSizeId)
    const currentQuantity = currentEmpaque?.quantity || 0
    const newQuantity = Math.max(0, currentQuantity + delta)

    setSelectedEmpaques(prev => {
      const filtered = prev.filter(e => e.package_size_id !== packageSizeId)

      if (newQuantity === 0) {
        return filtered
      }

      return [
        ...filtered,
        {
          package_size_id: packageSizeId,
          package_size_name: packageSize.name,
          quantity: newQuantity,
          dimensions: packageSize.dimensions,
          price: Number(packageSize.price || 0)
        }
      ]
    })
  }

  const getTotalEmpaques = () => {
    return selectedEmpaques.reduce((sum, e) => sum + e.quantity, 0)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center",
            theme === 'dark'
              ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20'
              : 'bg-gradient-to-br from-purple-100 to-pink-100'
          )}
        >
          <Package className={cn(
            "w-10 h-10",
            theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
          )} />
        </motion.div>

        <div>
          <h2 className={cn(
            "text-2xl sm:text-3xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Seleccionar Empaques
          </h2>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Elige los empaques vacíos a entregar
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loadingSizes && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className={cn(
            'w-12 h-12 animate-spin',
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          )} />
        </div>
      )}

      {/* No Package Sizes */}
      {!loadingSizes && packageSizes.length === 0 && (
        <div className={cn(
          'text-center p-12 rounded-xl border',
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        )}>
          <Package className={cn(
            'w-16 h-16 mx-auto mb-4',
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          )} />
          <p className={cn(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            No hay tamaños configurados
          </p>
          <p className={cn(
            'text-sm mt-2',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Configure los tamaños de empaques en Configuración
          </p>
        </div>
      )}

      {/* Package Sizes List */}
      {!loadingSizes && packageSizes.length > 0 && (
        <div className="space-y-4">
          <h3 className={cn(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Tamaños de Empaques Disponibles
          </h3>

          <div className="grid gap-4">
            {packageSizes.map((item) => {
              const empaque = selectedEmpaques.find(e => e.package_size_id === item.id)
              const isSelected = empaque && empaque.quantity > 0

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all duration-200',
                    isSelected
                      ? theme === 'dark'
                        ? 'bg-blue-500/10 border-blue-500'
                        : 'bg-blue-50 border-blue-500'
                      : theme === 'dark'
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className={cn(
                          'w-5 h-5',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )} />
                        <h4 className={cn(
                          'font-semibold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {item.name}
                        </h4>
                      </div>
                      <p className={cn(
                        'text-sm',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Dimensiones: {item.dimensions}
                      </p>
                      {item.description && (
                        <p className={cn(
                          'text-xs mt-2',
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, -1)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        disabled={!empaque || empaque.quantity === 0}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-30'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:opacity-30'
                        )}
                      >
                        <Minus className="w-4 h-4" />
                      </motion.button>

                      <div className={cn(
                        'w-12 h-8 rounded-lg flex items-center justify-center font-bold',
                        theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                      )}>
                        {empaque?.quantity || 0}
                      </div>

                      <motion.button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, 1)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                        )}
                      >
                        <Plus className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      {getTotalEmpaques() > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-4 rounded-xl border-2',
            theme === 'dark'
              ? 'bg-blue-900/20 border-blue-500/50'
              : 'bg-blue-50 border-blue-200'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className={cn(
                'font-semibold',
                theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
              )}>
                Total de Empaques
              </h3>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                {getTotalEmpaques()} empaque{getTotalEmpaques() !== 1 ? 's' : ''} seleccionado{getTotalEmpaques() !== 1 ? 's' : ''}
              </p>
            </div>
            <CheckCircle className={cn(
              'w-8 h-8',
              theme === 'dark' ? 'text-green-400' : 'text-green-600'
            )} />
          </div>
        </motion.div>
      )}
    </div>
  )
}
