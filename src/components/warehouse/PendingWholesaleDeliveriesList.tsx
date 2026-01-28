'use client'

import { motion } from 'framer-motion'
import { Package, User, FileText, Clock, ArrowRight, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export interface PendingWholesaleDelivery {
  id: number
  operationNumber: string
  invoiceNumber: string
  invoiceId: number
  customer: {
    id: number
    name: string
    code: string
  }
  status: string
  validationStatus: string
  notes: string | null
  createdAt: string
  createdBy: string | null
  totalProducts: number
  totalUnits: number
  lines: Array<{
    lineId: number
    productId: number
    variantId: number | null
    productName: string
    variantName: string | null
    sku: string
    barcode: string | null
    quantityExpected: number
    quantityValidated: number
  }>
}

interface PendingWholesaleDeliveriesListProps {
  deliveries: PendingWholesaleDelivery[]
  loading: boolean
  onSelectDelivery: (delivery: PendingWholesaleDelivery) => void
}

export default function PendingWholesaleDeliveriesList({
  deliveries,
  loading,
  onSelectDelivery
}: PendingWholesaleDeliveriesListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Cargando entregas...</span>
      </div>
    )
  }

  if (deliveries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No hay entregas pendientes
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Las facturas confirmadas aparecerán aquí para su entrega
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Entregas Mayoristas Pendientes
        </h3>
        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
          {deliveries.length} pendiente{deliveries.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {deliveries.map((delivery, index) => (
          <motion.div
            key={delivery.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectDelivery(delivery)}
            className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 cursor-pointer hover:border-green-500 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-mono font-semibold text-gray-900 dark:text-white">
                    {delivery.operationNumber}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <FileText className="w-3 h-3" />
                    <span>{delivery.invoiceNumber}</span>
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </div>

            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {delivery.customer.name}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {delivery.customer.code}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                  {delivery.totalProducts} producto{delivery.totalProducts !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {delivery.totalUnits} unidades
                </span>
              </div>
              <div className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                <Clock className="w-4 h-4" />
                <span className="text-xs">
                  {format(new Date(delivery.createdAt), 'dd MMM HH:mm', { locale: es })}
                </span>
              </div>
            </div>

            {/* Preview of products */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-600">
              <div className="flex flex-wrap gap-1">
                {delivery.lines.slice(0, 3).map(line => (
                  <span
                    key={line.lineId}
                    className="text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded"
                  >
                    {line.productName.substring(0, 20)}{line.productName.length > 20 ? '...' : ''} ({line.quantityExpected})
                  </span>
                ))}
                {delivery.lines.length > 3 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">
                    +{delivery.lines.length - 3} más
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
