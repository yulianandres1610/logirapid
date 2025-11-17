'use client'

import React from 'react'
import { ArrowLeft, Printer, FileText, Receipt } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'

interface OrderHeaderProps {
  orderNumber: string
  status: string
  createdAt: string
  onPrintLabels: () => void
  onPrintInvoice: () => void
  onPrintReceipt: () => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  picked_up: { label: 'Recogida', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  in_transit: { label: 'En Tránsito', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  delivered: { label: 'Entregada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  completed: { label: 'Completada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export default function OrderHeader({
  orderNumber,
  status,
  createdAt,
  onPrintLabels,
  onPrintInvoice,
  onPrintReceipt
}: OrderHeaderProps) {
  const { theme } = useTheme()
  const router = useRouter()

  const statusConfig = STATUS_CONFIG[status] || {
    label: status,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-6 shadow-lg mb-6',
        theme === 'dark'
          ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
          : 'bg-white border-gray-200'
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left Side - Order Info */}
        <div className="flex items-start gap-4">
          <Button
            onClick={() => router.back()}
            className={cn(
              'rounded-xl shadow-md',
              'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
              'text-white'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className={cn(
                'text-3xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {orderNumber}
              </h1>
              <span className={cn(
                'px-3 py-1 rounded-full text-sm font-semibold',
                statusConfig.color
              )}>
                {statusConfig.label}
              </span>
            </div>
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Creada el {formatDate(createdAt)}
            </p>
          </div>
        </div>

        {/* Right Side - Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={onPrintLabels}
              className={cn(
                'flex items-center gap-2 rounded-xl shadow-md',
                'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
                'text-white'
              )}
            >
              <Printer className="w-4 h-4" />
              Etiquetas
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={onPrintInvoice}
              className={cn(
                'flex items-center gap-2 rounded-xl shadow-md',
                'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800',
                'text-white'
              )}
            >
              <FileText className="w-4 h-4" />
              Factura
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={onPrintReceipt}
              className={cn(
                'flex items-center gap-2 rounded-xl shadow-md',
                'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800',
                'text-white'
              )}
            >
              <Receipt className="w-4 h-4" />
              Recibo
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
