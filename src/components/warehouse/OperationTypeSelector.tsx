'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRightLeft, Trash2, Scale, PackageOpen, Package, RotateCcw } from 'lucide-react'

export type OperationType = 'transfer' | 'scrap' | 'adjustment' | 'receive_transfer' | 'order_reception' | 'return'

interface OperationTypeSelectorProps {
  onSelect: (type: OperationType) => void
  currentWarehouse: { id: number; name: string }
}

const operationTypes = [
  {
    id: 'transfer' as OperationType,
    name: 'Transferencia',
    description: 'Mover stock - Entre almacenes',
    icon: ArrowRightLeft,
    gradient: 'from-blue-500 to-cyan-600',
    hoverGradient: 'from-blue-600 to-cyan-700',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600'
  },
  {
    id: 'scrap' as OperationType,
    name: 'Scrap',
    description: 'Dar de baja - Mermas y desperdicios',
    icon: Trash2,
    gradient: 'from-red-500 to-rose-600',
    hoverGradient: 'from-red-600 to-rose-700',
    bgLight: 'bg-red-50',
    textColor: 'text-red-600'
  },
  {
    id: 'adjustment' as OperationType,
    name: 'Ajuste',
    description: 'Corregir stock - Diferencias de inventario',
    icon: Scale,
    gradient: 'from-amber-500 to-yellow-600',
    hoverGradient: 'from-amber-600 to-yellow-700',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600'
  },
  {
    id: 'receive_transfer' as OperationType,
    name: 'Recibir',
    description: 'Validar transferencias entrantes',
    icon: PackageOpen,
    gradient: 'from-purple-500 to-indigo-600',
    hoverGradient: 'from-purple-600 to-indigo-700',
    bgLight: 'bg-purple-50',
    textColor: 'text-purple-600'
  },
  {
    id: 'order_reception' as OperationType,
    name: 'Recibir Orden',
    description: 'Consignaciones y compras',
    icon: Package,
    gradient: 'from-teal-500 to-cyan-600',
    hoverGradient: 'from-teal-600 to-cyan-700',
    bgLight: 'bg-teal-50',
    textColor: 'text-teal-600'
  },
  {
    id: 'return' as OperationType,
    name: 'Devolucion',
    description: 'Devolver a proveedor o recibir POS',
    icon: RotateCcw,
    gradient: 'from-orange-500 to-red-600',
    hoverGradient: 'from-orange-600 to-red-700',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-600'
  }
]

export default function OperationTypeSelector({ onSelect, currentWarehouse }: OperationTypeSelectorProps) {
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingConsignments, setPendingConsignments] = useState(0)

  // Fetch pending transfers count
  useEffect(() => {
    const fetchPendingCounts = async () => {
      try {
        // Fetch pending transfers
        const transfersResponse = await fetch(`/api/market/warehouses/${currentWarehouse.id}/pending-transfers`)
        const transfersData = await transfersResponse.json()
        if (transfersData.success) {
          setPendingCount(transfersData.data.pendingCount)
        }

        // Fetch pending consignments
        const consignmentsResponse = await fetch(`/api/market/warehouses/${currentWarehouse.id}/consignments?status=pending`)
        const consignmentsData = await consignmentsResponse.json()
        if (consignmentsData.success) {
          setPendingConsignments(consignmentsData.data.count)
        }
      } catch (error) {
        console.error('Error fetching pending counts:', error)
      }
    }

    fetchPendingCounts()
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCounts, 30000)
    return () => clearInterval(interval)
  }, [currentWarehouse.id])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-5 max-w-7xl mx-auto">
        {operationTypes.map((op, index) => {
          const Icon = op.icon
          const showBadge = (op.id === 'receive_transfer' && pendingCount > 0) || (op.id === 'order_reception' && pendingConsignments > 0)
            const badgeCount = op.id === 'receive_transfer' ? pendingCount : pendingConsignments
          return (
            <motion.button
              key={op.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(op.id)}
              className={`
                relative flex flex-col items-center p-6 lg:p-8 rounded-2xl
                bg-gradient-to-br ${op.gradient}
                text-white shadow-lg
                hover:shadow-xl transition-all duration-200
                group overflow-hidden
                min-h-[180px] lg:min-h-[220px]
              `}
            >
              {/* Badge for pending operations */}
              {showBadge && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 z-20 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg"
                >
                  <span className={`text-sm font-bold ${op.id === 'order_reception' ? 'text-teal-600' : 'text-purple-600'}`}>{badgeCount}</span>
                </motion.div>
              )}

              {/* Icon container */}
              <div className="relative z-10 w-16 h-16 lg:w-20 lg:h-20 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/30 transition-colors">
                <Icon className="w-8 h-8 lg:w-10 lg:h-10" />
              </div>

              {/* Text */}
              <h3 className="relative z-10 text-lg lg:text-xl font-bold mb-2">{op.name}</h3>
              <p className="relative z-10 text-sm lg:text-base text-white/80 text-center leading-tight">
                {op.description}
              </p>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
