'use client'

import { motion } from 'framer-motion'
import { Package, ArrowRight, Clock, User, ChevronRight } from 'lucide-react'

interface TransferLine {
  lineId: number
  productId: number
  productName: string
  sku: string
  quantityExpected: number
  quantityValidated: number
}

interface PendingTransfer {
  id: number
  operationNumber: string
  sourceWarehouse: {
    id: number
    name: string
    code: string
  }
  status: string
  validationStatus: string
  notes?: string
  createdAt: string
  createdBy?: string
  totalProducts: number
  totalUnits: number
  lines: TransferLine[]
}

interface PendingTransfersListProps {
  transfers: PendingTransfer[]
  onSelectTransfer: (transfer: PendingTransfer) => void
  loading?: boolean
}

export default function PendingTransfersList({
  transfers,
  onSelectTransfer,
  loading = false
}: PendingTransfersListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600">Cargando transferencias...</span>
      </div>
    )
  }

  if (transfers.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No hay transferencias pendientes</h3>
        <p className="text-gray-500">
          Las transferencias enviadas desde otros almacenes aparecerán aquí para validación.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Transferencias Pendientes
        </h2>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
          {transfers.length} pendiente{transfers.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {transfers.map((transfer, index) => (
          <motion.button
            key={transfer.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectTransfer(transfer)}
            className="w-full bg-white border border-gray-200 rounded-xl p-4 hover:border-purple-300 hover:shadow-md transition-all duration-200 text-left group"
          >
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{transfer.operationNumber}</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    Pendiente
                  </span>
                </div>

                {/* Source Warehouse */}
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <span className="font-medium">{transfer.sourceWarehouse.name}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span className="text-purple-600 font-medium">Este almacén</span>
                </div>

                {/* Details */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Package className="w-4 h-4" />
                    {transfer.totalProducts} productos
                  </span>
                  <span className="font-medium text-gray-700">
                    {transfer.totalUnits} unidades
                  </span>
                  {transfer.createdBy && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {transfer.createdBy}
                    </span>
                  )}
                </div>

                {/* Time */}
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(transfer.createdAt)}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0">
                <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-purple-600 transition-colors" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `hace ${diffMins} min`
    } else if (diffHours < 24) {
      return `hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`
    } else if (diffDays < 7) {
      return `hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`
    } else {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    }
  } catch {
    return isoString
  }
}

export type { PendingTransfer, TransferLine }
