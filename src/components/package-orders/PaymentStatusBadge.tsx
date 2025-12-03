'use client'

import { DollarSign, Clock, CheckCircle, AlertCircle, CreditCard, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaymentStatusBadgeProps {
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
  icon: typeof DollarSign
  pulse?: boolean
}> = {
  pending_payment: {
    label: 'Pendiente',
    gradient: 'bg-gradient-to-r from-amber-400 to-orange-500',
    darkGradient: 'dark:from-amber-500 dark:to-orange-600',
    borderColor: 'border-amber-300',
    darkBorderColor: 'dark:border-amber-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-amber-200/50 dark:shadow-amber-900/30',
    icon: Clock,
    pulse: true
  },
  paid: {
    label: 'Pagado',
    gradient: 'bg-gradient-to-r from-emerald-400 to-green-500',
    darkGradient: 'dark:from-emerald-500 dark:to-green-600',
    borderColor: 'border-emerald-300',
    darkBorderColor: 'dark:border-emerald-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-emerald-200/50 dark:shadow-emerald-900/30',
    icon: CheckCircle
  },
  partial: {
    label: 'Parcial',
    gradient: 'bg-gradient-to-r from-blue-400 to-indigo-500',
    darkGradient: 'dark:from-blue-500 dark:to-indigo-600',
    borderColor: 'border-blue-300',
    darkBorderColor: 'dark:border-blue-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-blue-200/50 dark:shadow-blue-900/30',
    icon: CreditCard
  },
  refunded: {
    label: 'Reembolsado',
    gradient: 'bg-gradient-to-r from-gray-400 to-slate-500',
    darkGradient: 'dark:from-gray-500 dark:to-slate-600',
    borderColor: 'border-gray-300',
    darkBorderColor: 'dark:border-gray-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-gray-200/50 dark:shadow-gray-900/30',
    icon: AlertCircle
  },
  cod: {
    label: 'COD',
    gradient: 'bg-gradient-to-r from-violet-400 to-purple-500',
    darkGradient: 'dark:from-violet-500 dark:to-purple-600',
    borderColor: 'border-violet-300',
    darkBorderColor: 'dark:border-violet-600',
    textColor: 'text-white',
    darkTextColor: 'dark:text-white',
    shadowColor: 'shadow-violet-200/50 dark:shadow-violet-900/30',
    icon: Banknote
  }
}

export default function PaymentStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  animated = true
}: PaymentStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending_payment
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
