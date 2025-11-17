'use client'

import React from 'react'
import { Package, Warehouse, Truck, MapPin, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface PackageStatusBadgeProps {
  status: 'disponible' | 'asignado' | 'recogida' | 'en_almacen' | 'enviado' | 'recibido_destino' | 'en_reparto' | 'entregado'
  className?: string
  showIcon?: boolean
}

const STATUS_CONFIG = {
  disponible: {
    label: 'Disponible',
    icon: Package,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    iconColor: 'text-gray-500'
  },
  asignado: {
    label: 'Asignado',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    iconColor: 'text-yellow-600'
  },
  recogida: {
    label: 'Recogida',
    icon: Package,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    iconColor: 'text-purple-600'
  },
  en_almacen: {
    label: 'En Almacén',
    icon: Warehouse,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    iconColor: 'text-blue-600'
  },
  enviado: {
    label: 'Enviado',
    icon: Truck,
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    iconColor: 'text-indigo-600'
  },
  recibido_destino: {
    label: 'Recibido Destino',
    icon: MapPin,
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    iconColor: 'text-cyan-600'
  },
  en_reparto: {
    label: 'En Reparto',
    icon: Truck,
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    iconColor: 'text-orange-600'
  },
  entregado: {
    label: 'Entregado',
    icon: CheckCircle,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    iconColor: 'text-green-600'
  }
}

export default function PackageStatusBadge({
  status,
  className,
  showIcon = true
}: PackageStatusBadgeProps) {
  const { theme } = useTheme()
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.disponible
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
        config.color,
        className
      )}
    >
      {showIcon && <Icon className={cn('w-3.5 h-3.5', config.iconColor)} />}
      {config.label}
    </span>
  )
}
