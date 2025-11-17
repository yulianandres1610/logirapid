'use client'

import React, { useState, useEffect } from 'react'
import { Package, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

export default function ServiceSelectionStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [services, setServices] = useState<any[]>([])
  const [selectedServices, setSelectedServices] = useState<any[]>(wizardData.selectedServices || [])

  useEffect(() => {
    fetchServices()
  }, [])

  useEffect(() => {
    setCanProceed(selectedServices.length > 0)
    updateWizardData('selectedServices', selectedServices)
  }, [selectedServices])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services?activeOnly=true')
      const data = await response.json()
      if (data.success) {
        setServices(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }

  const toggleService = (service: any) => {
    const isSelected = selectedServices.find(s => s.id === service.id)
    if (isSelected) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id))
    } else {
      setSelectedServices([...selectedServices, service])
    }
  }

  return (
    <div className="space-y-8">
      {/* Centered Icon Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center shadow-lg",
            theme === 'dark'
              ? 'bg-gradient-to-br from-purple-600 to-purple-700 shadow-purple-500/30'
              : 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-400/30'
          )}
        >
          <Package className="w-10 h-10 text-white" />
        </motion.div>
        <div>
          <h2 className={cn(
            "text-3xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Seleccionar Servicios
          </h2>
          <p className={cn(
            "text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Selecciona uno o más servicios para esta orden
          </p>
        </div>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service, index) => {
          const isSelected = selectedServices.find(s => s.id === service.id)
          return (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleService(service)}
              className={cn(
                "p-5 rounded-xl border cursor-pointer transition-all relative shadow-md",
                isSelected
                  ? theme === 'dark'
                    ? 'bg-blue-900/30 border-blue-600 shadow-blue-500/20'
                    : 'bg-blue-50 border-blue-500 shadow-blue-400/20'
                  : theme === 'dark'
                    ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700 hover:shadow-lg'
                    : 'bg-white border-gray-200 hover:bg-gray-50 hover:shadow-lg'
              )}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </motion.div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <Package className={cn(
                  "w-7 h-7",
                  isSelected ? 'text-blue-600' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )} />
                <h3 className={cn(
                  "font-bold text-lg",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {service.name}
                </h3>
              </div>
              {service.description && (
                <p className={cn(
                  "text-sm mb-3",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  {service.description}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs px-3 py-1.5 rounded-full font-medium",
                  theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-100 text-gray-600'
                )}>
                  {service.serviceType}
                </span>
                <span className={cn(
                  "font-bold text-lg",
                  isSelected ? 'text-blue-600' : theme === 'dark' ? 'text-green-400' : 'text-green-600'
                )}>
                  ${typeof service.basePrice === 'number' && service.basePrice > 0
                    ? service.basePrice.toFixed(2)
                    : parseFloat(service.basePrice) > 0
                      ? parseFloat(service.basePrice).toFixed(2)
                      : 'Variable'}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Selected Services Summary */}
      {selectedServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-6 rounded-2xl border shadow-lg",
            theme === 'dark' ? 'bg-blue-900/20 border-blue-700 backdrop-blur-sm' : 'bg-blue-50 border-blue-200'
          )}
        >
          <p className={cn(
            "font-bold text-lg mb-3",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Servicios Seleccionados: {selectedServices.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((service, index) => (
              <motion.span
                key={service.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium shadow-sm",
                  theme === 'dark' ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'
                )}
              >
                {service.name}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
