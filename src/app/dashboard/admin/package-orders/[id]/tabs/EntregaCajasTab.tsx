'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { PackageCheck } from 'lucide-react'

interface EntregaCajasTabProps {
  order: any
  services: string[]
  onUpdate: () => void
}

export default function EntregaCajasTab({ order, services, onUpdate }: EntregaCajasTabProps) {
  const { theme } = useTheme()

  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <PackageCheck className={cn(
          'h-16 w-16 mx-auto mb-4',
          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
        )} />
        <h3 className={cn(
          'text-lg font-semibold mb-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Sin Servicios de Entrega
        </h3>
        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Esta orden no tiene servicios de entrega de cajas
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <PackageCheck className={cn(
          'h-16 w-16 mx-auto mb-4',
          theme === 'dark' ? 'text-blue-600' : 'text-blue-500'
        )} />
        <h3 className={cn(
          'text-lg font-semibold mb-2',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Entrega de Cajas
        </h3>
        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Scanner para asociar cajas entregadas
        </p>
      </div>
    </div>
  )
}
