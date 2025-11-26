'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Clock, Calendar, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface PickupScheduleCardProps {
  scheduledDate?: string | null
  timeSlot?: string | null
  pickupInstructions?: string | null
  status: string
}

export default function PickupScheduleCard({
  scheduledDate,
  timeSlot,
  pickupInstructions,
  status
}: PickupScheduleCardProps) {
  const { theme } = useTheme()

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
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
              ? 'from-blue-600 to-blue-700'
              : 'from-blue-500 to-blue-600'
          )}
        >
          <Clock className="w-6 h-6 text-white" />
        </div>
        <h3 className={cn(
          'text-lg font-semibold',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Programación de Orden
        </h3>
      </div>

      <div className="space-y-4">
        {/* Scheduled Date */}
        {scheduledDate && (
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-xl',
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-blue-50'
          )}>
            <Calendar className={cn(
              'w-5 h-5 mt-0.5',
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            )} />
            <div className="flex-1">
              <p className={cn(
                'text-xs font-medium mb-1',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Fecha Programada
              </p>
              <p className={cn(
                'text-sm font-semibold capitalize',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {formatDate(scheduledDate)}
              </p>
            </div>
          </div>
        )}

        {/* Time Slot */}
        {timeSlot && (
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-xl',
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-blue-50'
          )}>
            <Clock className={cn(
              'w-5 h-5 mt-0.5',
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            )} />
            <div className="flex-1">
              <p className={cn(
                'text-xs font-medium mb-1',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Franja Horaria
              </p>
              <p className={cn(
                'text-sm font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {timeSlot}
              </p>
            </div>
          </div>
        )}

        {/* Pickup Instructions */}
        {pickupInstructions && (
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-xl',
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-amber-50'
          )}>
            <FileText className={cn(
              'w-5 h-5 mt-0.5',
              theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
            )} />
            <div className="flex-1">
              <p className={cn(
                'text-xs font-medium mb-1',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Instrucciones Especiales
              </p>
              <p className={cn(
                'text-sm whitespace-pre-wrap',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                {pickupInstructions}
              </p>
            </div>
          </div>
        )}

        {/* Status Indicator */}
        <div className={cn(
          'pt-4 border-t',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          <div className="flex items-center justify-between">
            <p className={cn(
              'text-xs font-medium',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Estado de Orden:
            </p>
            <span className={cn(
              'px-2 py-1 rounded-full text-xs font-semibold',
              status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
              status === 'in_transit' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
              status === 'delivered' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
              status === 'completed' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
              status === 'cancelled' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              status === 'reprogrammed' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
              !['pending', 'in_transit', 'delivered', 'completed', 'cancelled', 'reprogrammed'].includes(status) && 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
            )}>
              {status === 'pending' && 'Pendiente'}
              {status === 'in_transit' && 'En Ruta'}
              {status === 'delivered' && 'Entregado'}
              {status === 'completed' && 'Completado'}
              {status === 'cancelled' && 'Cancelado'}
              {status === 'reprogrammed' && 'Reprogramado'}
              {!['pending', 'in_transit', 'delivered', 'completed', 'cancelled', 'reprogrammed'].includes(status) && status}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
