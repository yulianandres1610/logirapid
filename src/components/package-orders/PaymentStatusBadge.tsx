'use client'

import { DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react'

interface PaymentStatusBadgeProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

const statusConfig: Record<string, {
  label: string
  bgColor: string
  textColor: string
  icon: typeof DollarSign
}> = {
  pending_payment: {
    label: 'Pendiente Pago',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    icon: Clock
  },
  paid: {
    label: 'Pagado',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    icon: CheckCircle
  },
  partial: {
    label: 'Pago Parcial',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    icon: DollarSign
  },
  refunded: {
    label: 'Reembolsado',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    icon: AlertCircle
  }
}

export default function PaymentStatusBadge({
  status,
  size = 'md',
  showIcon = true
}: PaymentStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending_payment
  const Icon = config.icon

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${config.bgColor} ${config.textColor} ${sizeClasses[size]}
      `}
    >
      {showIcon && <Icon size={iconSizes[size]} />}
      {config.label}
    </span>
  )
}
