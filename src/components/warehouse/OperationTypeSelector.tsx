'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRightLeft, Trash2, Scale, PackageOpen, Package, RotateCcw, Printer, BarChart3, History, Truck } from 'lucide-react'

export type OperationType = 'transfer' | 'scrap' | 'adjustment' | 'receive_transfer' | 'order_reception' | 'return' | 'print_labels' | 'stock_report' | 'transfer_history' | 'adjustments_history' | 'wholesale_delivery'

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
    id: 'wholesale_delivery' as OperationType,
    name: 'Mayoreo',
    description: 'Entregas ventas mayoristas',
    icon: Truck,
    gradient: 'from-green-500 to-emerald-600',
    hoverGradient: 'from-green-600 to-emerald-700',
    bgLight: 'bg-green-50',
    textColor: 'text-green-600'
  },
  {
    id: 'transfer_history' as OperationType,
    name: 'Historial',
    description: 'Ver historial de transferencias',
    icon: History,
    gradient: 'from-slate-500 to-gray-600',
    hoverGradient: 'from-slate-600 to-gray-700',
    bgLight: 'bg-slate-50',
    textColor: 'text-slate-600'
  },
  {
    id: 'adjustments_history' as OperationType,
    name: 'Hist. Ajustes',
    description: 'Ver historial de ajustes y scrap',
    icon: Scale,
    gradient: 'from-amber-500 to-orange-600',
    hoverGradient: 'from-amber-600 to-orange-700',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600'
  },
  {
    id: 'order_reception' as OperationType,
    name: 'Ordenes',
    description: 'Recibir o entregar ordenes',
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
  },
  {
    id: 'print_labels' as OperationType,
    name: 'Etiquetas',
    description: 'Imprimir etiquetas de productos',
    icon: Printer,
    gradient: 'from-emerald-500 to-green-600',
    hoverGradient: 'from-emerald-600 to-green-700',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-600'
  },
  {
    id: 'stock_report' as OperationType,
    name: 'Reporte',
    description: 'Ver stock y valoración',
    icon: BarChart3,
    gradient: 'from-indigo-500 to-purple-600',
    hoverGradient: 'from-indigo-600 to-purple-700',
    bgLight: 'bg-indigo-50',
    textColor: 'text-indigo-600'
  }
]

export default function OperationTypeSelector({ onSelect, currentWarehouse }: OperationTypeSelectorProps) {
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingConsignments, setPendingConsignments] = useState(0)
  const [pendingWholesale, setPendingWholesale] = useState(0)

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

        // Fetch pending wholesale deliveries
        const wholesaleResponse = await fetch(`/api/market/warehouses/${currentWarehouse.id}/pending-wholesale-deliveries`)
        const wholesaleData = await wholesaleResponse.json()
        if (wholesaleData.success) {
          setPendingWholesale(wholesaleData.data.pendingCount)
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

  // Separar en filas para el layout: 5 arriba, 5 abajo
  const topRow = operationTypes.slice(0, 5)
  const bottomRow = operationTypes.slice(5)

  const renderCard = (op: typeof operationTypes[0], index: number) => {
    const Icon = op.icon
    const showBadge = (op.id === 'receive_transfer' && pendingCount > 0) ||
                      (op.id === 'order_reception' && pendingConsignments > 0) ||
                      (op.id === 'wholesale_delivery' && pendingWholesale > 0)
    const badgeCount = op.id === 'receive_transfer' ? pendingCount :
                       op.id === 'wholesale_delivery' ? pendingWholesale : pendingConsignments

    return (
      <motion.button
        key={op.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.08, type: 'spring', stiffness: 200 }}
        whileHover={{ scale: 1.05, y: -4 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelect(op.id)}
        className={`
          relative flex flex-col items-center justify-center
          w-[120px] h-[120px] sm:w-[130px] sm:h-[130px] md:w-[140px] md:h-[140px]
          rounded-2xl
          bg-gradient-to-br ${op.gradient}
          text-white shadow-lg
          hover:shadow-xl transition-all duration-200
          group overflow-hidden
        `}
      >
        {/* Badge for pending operations */}
        {showBadge && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2 z-20 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg"
          >
            <span className={`text-xs font-bold ${op.id === 'order_reception' ? 'text-teal-600' : op.id === 'wholesale_delivery' ? 'text-green-600' : 'text-purple-600'}`}>
              {badgeCount}
            </span>
          </motion.div>
        )}

        {/* Icon container */}
        <div className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-xl flex items-center justify-center mb-2 group-hover:bg-white/30 transition-colors">
          <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>

        {/* Text */}
        <h3 className="relative z-10 text-sm sm:text-base font-bold text-center leading-tight px-2">
          {op.name}
        </h3>
      </motion.button>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4 w-full">
      <div className="flex flex-col items-center gap-4">
        {/* Fila superior: 5 elementos */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {topRow.map((op, index) => renderCard(op, index))}
        </div>

        {/* Fila inferior: 4 elementos centrados */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {bottomRow.map((op, index) => renderCard(op, index + 5))}
        </div>
      </div>
    </div>
  )
}
