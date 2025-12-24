'use client'

import { motion } from 'framer-motion'
import { Check, AlertTriangle, Circle, Plus, Minus } from 'lucide-react'

interface ValidationProductCardProps {
  productName: string
  sku: string
  quantityExpected: number
  quantityValidated: number
  isActive?: boolean
  onIncrement?: () => void
  onDecrement?: () => void
  onSetQuantity?: (quantity: number) => void
}

export default function ValidationProductCard({
  productName,
  sku,
  quantityExpected,
  quantityValidated,
  isActive = false,
  onIncrement,
  onDecrement,
  onSetQuantity
}: ValidationProductCardProps) {
  const isComplete = quantityValidated >= quantityExpected
  const hasExcess = quantityValidated > quantityExpected
  const difference = quantityValidated - quantityExpected

  // Determine status and colors
  let statusIcon = <Circle className="w-5 h-5 text-gray-400" />
  let bgColor = 'bg-white'
  let borderColor = 'border-gray-200'

  if (isComplete && !hasExcess) {
    statusIcon = <Check className="w-5 h-5 text-green-600" />
    bgColor = 'bg-green-50'
    borderColor = 'border-green-300'
  } else if (hasExcess) {
    statusIcon = <AlertTriangle className="w-5 h-5 text-amber-600" />
    bgColor = 'bg-amber-50'
    borderColor = 'border-amber-300'
  } else if (quantityValidated > 0) {
    statusIcon = <Circle className="w-5 h-5 text-blue-500 fill-blue-200" />
    bgColor = 'bg-blue-50'
    borderColor = 'border-blue-300'
  }

  if (isActive) {
    borderColor = 'border-purple-500 ring-2 ring-purple-200'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${bgColor} ${borderColor} border rounded-lg p-4 transition-all duration-200`}
    >
      <div className="flex items-center gap-4">
        {/* Status Icon */}
        <div className="flex-shrink-0">
          {statusIcon}
        </div>

        {/* Product Info */}
        <div className="flex-grow min-w-0">
          <h4 className="font-medium text-gray-900 truncate">{productName}</h4>
          <p className="text-sm text-gray-500">SKU: {sku}</p>
        </div>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2">
          {/* Decrement Button */}
          {onDecrement && quantityValidated > 0 && (
            <button
              onClick={onDecrement}
              className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}

          {/* Quantity Display */}
          <div className="text-center min-w-[80px]">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl font-bold text-gray-900">{quantityValidated}</span>
              <span className="text-lg text-gray-400">/</span>
              <span className="text-lg text-gray-600">{quantityExpected}</span>
            </div>
            {difference !== 0 && (
              <span className={`text-xs font-medium ${difference > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                {difference > 0 ? `+${difference}` : difference}
              </span>
            )}
          </div>

          {/* Increment Button */}
          {onIncrement && (
            <button
              onClick={onIncrement}
              className="w-8 h-8 rounded-full bg-purple-100 hover:bg-purple-200 flex items-center justify-center text-purple-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isComplete && !hasExcess ? 'bg-green-500' :
              hasExcess ? 'bg-amber-500' :
              quantityValidated > 0 ? 'bg-blue-500' : 'bg-gray-300'
            }`}
            style={{ width: `${Math.min(100, (quantityValidated / quantityExpected) * 100)}%` }}
          />
        </div>
      </div>
    </motion.div>
  )
}
