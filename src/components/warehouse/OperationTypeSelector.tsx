'use client'

import { motion } from 'framer-motion'
import { PackageCheck, ArrowRightLeft, Trash2, Scale } from 'lucide-react'

export type OperationType = 'reception' | 'transfer' | 'scrap' | 'adjustment'

interface OperationTypeSelectorProps {
  onSelect: (type: OperationType) => void
  currentWarehouse: { id: number; name: string }
}

const operationTypes = [
  {
    id: 'reception' as OperationType,
    name: 'Recepcion',
    description: 'Ingresar stock - Compras y consignaciones',
    icon: PackageCheck,
    gradient: 'from-green-500 to-emerald-600',
    hoverGradient: 'from-green-600 to-emerald-700',
    bgLight: 'bg-green-50',
    textColor: 'text-green-600'
  },
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
  }
]

export default function OperationTypeSelector({ onSelect }: OperationTypeSelectorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-6xl w-full">
        {operationTypes.map((op, index) => {
          const Icon = op.icon
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
              {/* Background decoration */}
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />

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
