'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { PackagePlus } from 'lucide-react'

interface RecogidaCajasTabProps {
  order: any
  services: string[]
  onUpdate: () => void
}

export default function RecogidaCajasTab({ order, services, onUpdate }: RecogidaCajasTabProps) {
  const { theme } = useTheme()

  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <PackagePlus className={cn(
          'h-16 w-16 mx-auto mb-4',
          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
        )} />
        <h3 className={cn(
          'text-lg font-semibold mb-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Sin Servicios de Recogida
        </h3>
        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Esta orden no tiene servicios de recogida de cajas
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <PackagePlus className="h-16 w-16 mx-auto mb-4 text-orange-600" />
        <h3 className={cn(
          'text-lg font-semibold mb-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Recogida de Cajas
        </h3>
        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Scanner para asociar bultos recogidos
        </p>
      </div>
    </div>
  )
}
