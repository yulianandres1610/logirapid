'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, Package, Truck, Box } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Service {
  name: string
  quantity: number
  price?: number
}

interface SelectedServicesCardProps {
  services: Service[]
}

export default function SelectedServicesCard({ services }: SelectedServicesCardProps) {
  const { theme } = useTheme()

  // Función para obtener el icono según el nombre del servicio
  const getServiceIcon = (serviceName: string) => {
    const name = serviceName.toLowerCase()
    if (name.includes('entrega') && name.includes('caja')) {
      return <Box className="w-5 h-5" />
    }
    if (name.includes('recogida') && name.includes('caja')) {
      return <Package className="w-5 h-5" />
    }
    if (name.includes('envío') || name.includes('envio')) {
      return <Truck className="w-5 h-5" />
    }
    return <ShoppingBag className="w-5 h-5" />
  }

  // Función para obtener el color según el tipo de servicio
  const getServiceColor = (serviceName: string) => {
    const name = serviceName.toLowerCase()
    if (name.includes('entrega')) {
      return theme === 'dark'
        ? 'from-green-600 to-green-700'
        : 'from-green-500 to-green-600'
    }
    if (name.includes('recogida')) {
      return theme === 'dark'
        ? 'from-amber-600 to-amber-700'
        : 'from-amber-500 to-amber-600'
    }
    return theme === 'dark'
      ? 'from-blue-600 to-blue-700'
      : 'from-blue-500 to-blue-600'
  }

  if (!services || services.length === 0) {
    return null
  }

  const totalQuantity = services.reduce((sum, s) => sum + (s.quantity || 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className={cn(
        'rounded-2xl border p-6 shadow-lg',
        theme === 'dark'
          ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
          : 'bg-white border-gray-200'
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            'bg-gradient-to-br',
            theme === 'dark'
              ? 'from-purple-600 to-purple-700'
              : 'from-purple-500 to-purple-600'
          )}
        >
          <ShoppingBag className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className={cn(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Servicios Seleccionados
          </h3>
          <p className={cn(
            'text-xs',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            {services.length} servicio{services.length > 1 ? 's' : ''} • {totalQuantity} unidad{totalQuantity > 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {services.map((service, index) => (
          <div
            key={index}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl',
              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br text-white',
                getServiceColor(service.name)
              )}
            >
              {getServiceIcon(service.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-semibold truncate',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {service.name}
              </p>
              {service.price !== undefined && service.price > 0 && (
                <p className={cn(
                  'text-xs',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  ${service.price.toFixed(2)} c/u
                </p>
              )}
            </div>
            <div className={cn(
              'px-3 py-1.5 rounded-full text-sm font-bold',
              theme === 'dark'
                ? 'bg-purple-900/50 text-purple-300'
                : 'bg-purple-100 text-purple-700'
            )}>
              x{service.quantity}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className={cn(
        'mt-4 pt-4 border-t flex items-center justify-between',
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      )}>
        <p className={cn(
          'text-sm font-medium',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Total de unidades:
        </p>
        <span className={cn(
          'text-lg font-bold',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          {totalQuantity}
        </span>
      </div>
    </motion.div>
  )
}
