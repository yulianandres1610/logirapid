'use client'

import { Package, Truck, CheckCircle, AlertCircle, Clock, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderStatusBadgeProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  animated?: boolean
}

const statusConfig: Record<string, {
  label: string
  gradient: string
  darkGradient: string
  borderColor: string
  darkBorderColor: string
  textColor: string
  darkTextColor: string
  shadowColor: string
  icon: typeof Package
  pulse?: boolean
}> = {
  pending: {
    label: 'Pendiente',
    gradient: 'bg-gradient-to-r from-amber-400 to-yellow-500',
    darkGradient: 'dark:from-amber-500 dark:to-yellow-600',
    borderColor: 'border-amber-300',
    darkBorderColor: 'dark:border-amber-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-amber-200/50 dark:shadow-amber-900/30',
    icon: Clock,
    pulse: true
  },
  reprogrammed: {
    label: 'Reprogramado',
    gradient: 'bg-gradient-to-r from-orange-400 to-red-500',
    darkGradient: 'dark:from-orange-500 dark:to-red-600',
    borderColor: 'border-orange-300',
    darkBorderColor: 'dark:border-orange-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-orange-200/50 dark:shadow-orange-900/30',
    icon: RotateCcw,
    pulse: true
  },
  picked_up: {
    label: 'Recogido',
    gradient: 'bg-gradient-to-r from-purple-400 to-violet-500',
    darkGradient: 'dark:from-purple-500 dark:to-violet-600',
    borderColor: 'border-purple-300',
    darkBorderColor: 'dark:border-purple-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-purple-200/50 dark:shadow-purple-900/30',
    icon: Package
  },
  in_transit: {
    label: 'Enviado',
    gradient: 'bg-gradient-to-r from-blue-400 to-indigo-500',
    darkGradient: 'dark:from-blue-500 dark:to-indigo-600',
    borderColor: 'border-blue-300',
    darkBorderColor: 'dark:border-blue-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-blue-200/50 dark:shadow-blue-900/30',
    icon: Package
  },
  in_route: {
    label: 'En Reparto',
    gradient: 'bg-gradient-to-r from-indigo-400 to-purple-500',
    darkGradient: 'dark:from-indigo-500 dark:to-purple-600',
    borderColor: 'border-indigo-300',
    darkBorderColor: 'dark:border-indigo-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-indigo-200/50 dark:shadow-indigo-900/30',
    icon: Truck
  },
  delivered: {
    label: 'Entregado',
    gradient: 'bg-gradient-to-r from-emerald-400 to-green-500',
    darkGradient: 'dark:from-emerald-500 dark:to-green-600',
    borderColor: 'border-emerald-300',
    darkBorderColor: 'dark:border-emerald-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-emerald-200/50 dark:shadow-emerald-900/30',
    icon: CheckCircle
  },
  cancelled: {
    label: 'Cancelado',
    gradient: 'bg-gradient-to-r from-gray-400 to-slate-500',
    darkGradient: 'dark:from-gray-500 dark:to-slate-600',
    borderColor: 'border-gray-300',
    darkBorderColor: 'dark:border-gray-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-gray-200/50 dark:shadow-gray-900/30',
    icon: AlertCircle
  }
}

export default function OrderStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  animated = true
}: OrderStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending
  const Icon = config.icon

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2'
  }

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        'border shadow-sm transition-all duration-200',
        'hover:shadow-md hover:scale-105',
        config.gradient,
        config.darkGradient,
        config.borderColor,
        config.darkBorderColor,
        config.textColor,
        config.darkTextColor,
        config.shadowColor,
        sizeClasses[size],
        animated && config.pulse && 'animate-pulse'
      )}
    >
      {showIcon && (
        <Icon
          size={iconSizes[size]}
          className={cn(
            'flex-shrink-0',
            animated && config.pulse && 'animate-spin-slow'
          )}
          strokeWidth={2.5}
        />
      )}
      <span className="whitespace-nowrap">{config.label}</span>
    </span>
  )
}
