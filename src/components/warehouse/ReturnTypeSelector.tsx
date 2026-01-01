'use client'

import { motion } from 'framer-motion'
import { Package, ShoppingCart } from 'lucide-react'

export type ReturnType = 'supplier' | 'pos'

interface ReturnTypeSelectorProps {
  onSelect: (type: ReturnType) => void
  onBack: () => void
  currentWarehouse: { id: number; name: string }
}

const returnTypes = [
  {
    id: 'supplier' as ReturnType,
    name: 'Devolución a Proveedor',
    description: 'Devolver productos de consignación al proveedor',
    icon: Package,
    gradient: 'from-orange-500 to-amber-600',
    hoverGradient: 'from-orange-600 to-amber-700',
  },
  {
    id: 'pos' as ReturnType,
    name: 'Devolución desde POS',
    description: 'Recibir productos devueltos por clientes',
    icon: ShoppingCart,
    gradient: 'from-red-500 to-rose-600',
    hoverGradient: 'from-red-600 to-rose-700',
  }
]

export default function ReturnTypeSelector({ onSelect, onBack, currentWarehouse }: ReturnTypeSelectorProps) {
  return (
    <div className="flex flex-col min-h-[60vh] p-4 w-full">
      {/* Options */}
      <div className="flex items-center justify-center flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {returnTypes.map((type, index) => {
            const Icon = type.icon
            return (
              <motion.button
                key={type.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(type.id)}
                className={`
                  relative flex flex-col items-center p-8 rounded-2xl
                  bg-gradient-to-br ${type.gradient}
                  text-white shadow-lg
                  hover:shadow-xl transition-all duration-200
                  group overflow-hidden
                  min-h-[220px] min-w-[280px]
                `}
              >
                {/* Icon container */}
                <div className="relative z-10 w-20 h-20 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/30 transition-colors">
                  <Icon className="w-10 h-10" />
                </div>

                {/* Text */}
                <h3 className="relative z-10 text-xl font-bold mb-2 text-center">{type.name}</h3>
                <p className="relative z-10 text-base text-white/80 text-center leading-tight">
                  {type.description}
                </p>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
