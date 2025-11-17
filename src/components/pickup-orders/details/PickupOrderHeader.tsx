'use client'

import React from 'react'
import { ArrowLeft, Edit, Printer } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'

interface PickupOrderHeaderProps {
  orderNumber: string
  status: string
  createdAt: string
  orderId: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  reprogrammed: { label: 'Reprogramada', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  picked_up: { label: 'Recogida', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  in_transit: { label: 'En Tránsito', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  in_route: { label: 'En Ruta', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  delivered: { label: 'Entregada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export default function PickupOrderHeader({
  orderNumber,
  status,
  createdAt,
  orderId
}: PickupOrderHeaderProps) {
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

  const handleEdit = () => {
    router.push(`/dashboard/admin/pickup-orders/${orderId}/edit`)
  }

  const handlePrint = () => {
    window.print()
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
            onClick={() => router.push('/dashboard/admin/pickup-orders')}
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

        {/* Right Side - Actions */}
        <div className="flex items-center gap-3">
          {/* Edit Button - Only for pending orders */}
          {status === 'pending' && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={handleEdit}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl shadow-md',
                  'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800',
                  'text-white'
                )}
              >
                <Edit className="w-4 h-4" />
                <span className="font-medium">Editar</span>
              </Button>
            </motion.div>
          )}

          {/* Print Button */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={handlePrint}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl shadow-md',
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              )}
            >
              <Printer className="w-4 h-4" />
              <span className="font-medium">Imprimir</span>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
