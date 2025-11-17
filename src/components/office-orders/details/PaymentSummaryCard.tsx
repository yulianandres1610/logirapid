'use client'

import React from 'react'
import { DollarSign, CreditCard, Banknote } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Payment {
  method: 'cash' | 'zelle' | 'card'
  amount: number
  reference?: string
  cashReceived?: number
}

interface ServiceBreakdown {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

interface PaymentSummaryCardProps {
  serviceBreakdown: ServiceBreakdown[]
  payments: Payment[]
  totalAmount: number
}

export default function PaymentSummaryCard({
  serviceBreakdown,
  payments,
  totalAmount
}: PaymentSummaryCardProps) {
  const { theme } = useTheme()

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Banknote className="w-5 h-5 text-green-500" />
      case 'zelle':
        return <DollarSign className="w-5 h-5 text-blue-500" />
      case 'card':
        return <CreditCard className="w-5 h-5 text-purple-500" />
      default:
        return <DollarSign className="w-5 h-5 text-gray-500" />
    }
  }

  const getPaymentMethodName = (method: string) => {
    switch (method) {
      case 'cash':
        return 'Efectivo'
      case 'zelle':
        return 'Zelle'
      case 'card':
        return 'Tarjeta'
      default:
        return method
    }
  }

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const change = payments.reduce((sum, payment) => {
    if (payment.method === 'cash' && payment.cashReceived) {
      return sum + (payment.cashReceived - payment.amount)
    }
    return sum
  }, 0)

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
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shadow-md',
          'bg-gradient-to-br from-green-500 to-green-600'
        )}>
          <DollarSign className="w-6 h-6 text-white" />
        </div>
        <h3 className={cn(
          'text-xl font-bold',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Información de Pago
        </h3>
      </div>

      {/* Service Breakdown */}
      <div className="mb-6">
        <h4 className={cn(
          'text-sm font-semibold mb-3',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Desglose de Servicios:
        </h4>
        <div className="space-y-2">
          {serviceBreakdown.map((service, index) => (
            <div
              key={index}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  {service.name}
                </span>
                {service.quantity > 1 && (
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-400'
                      : 'bg-gray-100 text-gray-600'
                  )}>
                    × {service.quantity}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-sm font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                ${service.total.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Methods */}
      <div className="mb-6">
        <h4 className={cn(
          'text-sm font-semibold mb-3',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Métodos de Pago:
        </h4>
        <div className="space-y-3">
          {payments.map((payment, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg',
                theme === 'dark'
                  ? 'bg-gray-700/50'
                  : 'bg-gray-50'
              )}
            >
              <div className="flex items-center gap-3">
                {getPaymentIcon(payment.method)}
                <div>
                  <p className={cn(
                    'text-sm font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {getPaymentMethodName(payment.method)}
                  </p>
                  {payment.reference && (
                    <p className={cn(
                      'text-xs mt-0.5',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Ref: {payment.reference}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className={cn(
                  'text-sm font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  ${payment.amount.toFixed(2)}
                </p>
                {payment.cashReceived && payment.cashReceived > payment.amount && (
                  <p className={cn(
                    'text-xs',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Recibido: ${payment.cashReceived.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className={cn(
        'pt-4 border-t space-y-2',
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      )}>
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-base font-semibold',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            Total:
          </span>
          <span className={cn(
            'text-base font-bold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            ${totalAmount.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-base font-semibold',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            Pagado:
          </span>
          <span className={cn(
            'text-base font-bold text-green-500'
          )}>
            ${totalPaid.toFixed(2)}
          </span>
        </div>
        {change > 0 && (
          <div className="flex items-center justify-between">
            <span className={cn(
              'text-base font-semibold',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Cambio Entregado:
            </span>
            <span className={cn(
              'text-base font-bold text-blue-500'
            )}>
              ${change.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
