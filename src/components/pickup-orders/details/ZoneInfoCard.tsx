'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MapPin, Clock, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface ZoneInfoCardProps {
  zone: {
    name: string
    description?: string
    color: string
    timeSlot?: string
  } | null
  zipCode?: string | null
}

export default function ZoneInfoCard({ zone, zipCode }: ZoneInfoCardProps) {
  const { theme } = useTheme()

  if (!zone) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl border p-6 shadow-lg',
          theme === 'dark'
            ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
            : 'bg-white border-gray-200'
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: theme === 'dark'
                ? 'linear-gradient(135deg, #6B7280, #9CA3AF)'
                : 'linear-gradient(135deg, #D1D5DB, #E5E7EB)'
            }}
          >
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <h3 className={cn(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Zona de Recogida
          </h3>
        </div>

        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          No se ha asignado zona a esta orden
        </p>
        {zipCode && (
          <p className={cn(
            'text-xs mt-2',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
          )}>
            Código Postal: {zipCode}
          </p>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-6 shadow-lg',
        theme === 'dark'
          ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
          : 'bg-white border-gray-200'
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${zone.color}, ${zone.color}dd)`
          }}
        >
          <MapPin className="w-6 h-6 text-white" />
        </div>
        <h3 className={cn(
          'text-lg font-semibold',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Zona de Recogida
        </h3>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: zone.color }}
            />
            <p className={cn(
              'text-xl font-bold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {zone.name}
            </p>
          </div>
          {zone.description && (
            <p className={cn(
              'text-sm ml-5',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              {zone.description}
            </p>
          )}
        </div>

        {zipCode && (
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-lg',
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
          )}>
            <Hash className={cn(
              'w-4 h-4',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )} />
            <div>
              <p className={cn(
                'text-xs font-medium',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Código Postal
              </p>
              <p className={cn(
                'text-sm font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {zipCode}
              </p>
            </div>
          </div>
        )}

        {zone.timeSlot && (
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-lg',
            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
          )}>
            <Clock className={cn(
              'w-4 h-4',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )} />
            <div>
              <p className={cn(
                'text-xs font-medium',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Franja Horaria Preferida
              </p>
              <p className={cn(
                'text-sm font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {zone.timeSlot}
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
