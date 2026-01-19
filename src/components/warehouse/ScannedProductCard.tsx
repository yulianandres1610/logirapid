'use client'

import { motion } from 'framer-motion'
import { Minus, Plus, Trash2, Package, AlertTriangle } from 'lucide-react'
import Image from 'next/image'

export interface ScannedProduct {
  id: number
  productId: number
  variantId?: number | null
  variantName?: string | null
  name: string
  sku: string
  barcode: string
  imageUrl: string | null
  unit: string
  quantity: number
  currentStock: number
  expectedQuantity?: number
  realStock?: number
  costPrice: number
  sellingPrice: number
}

interface ScannedProductCardProps {
  product: ScannedProduct
  onQuantityChange: (quantity: number) => void
  onRemove: () => void
  showStock?: boolean
  showRealStock?: boolean
  onRealStockChange?: (realStock: number) => void
  maxQuantity?: number
}

export default function ScannedProductCard({
  product,
  onQuantityChange,
  onRemove,
  showStock = false,
  showRealStock = false,
  onRealStockChange,
  maxQuantity
}: ScannedProductCardProps) {
  const hasInsufficientStock = showStock && product.quantity > product.currentStock

  const handleIncrement = () => {
    if (!maxQuantity || product.quantity < maxQuantity) {
      onQuantityChange(product.quantity + 1)
    }
  }

  const handleDecrement = () => {
    if (product.quantity > 1) {
      onQuantityChange(product.quantity - 1)
    }
  }

  const handleQuantityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0
    if (value >= 0) {
      if (maxQuantity && value > maxQuantity) {
        onQuantityChange(maxQuantity)
      } else {
        onQuantityChange(value)
      }
    }
  }

  const handleRealStockInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0
    if (value >= 0 && onRealStockChange) {
      onRealStockChange(value)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`
        flex items-center gap-3 p-3 rounded-xl
        bg-white dark:bg-gray-800
        border ${hasInsufficientStock ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}
        shadow-sm hover:shadow-md transition-shadow
      `}
    >
      {/* Product image */}
      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 dark:text-white truncate">
          {product.name}
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          SKU: {product.sku}
        </p>
        {showStock && (
          <div className={`text-sm flex items-center gap-1 ${hasInsufficientStock ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
            {hasInsufficientStock && <AlertTriangle className="w-3.5 h-3.5" />}
            Stock: {product.currentStock} {product.unit}
          </div>
        )}
      </div>

      {/* Quantity controls */}
      <div className="flex flex-col items-end gap-2">
        {showRealStock ? (
          // Adjustment mode: show current vs real stock
          <div className="flex items-center gap-2">
            <div className="text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 block">Sistema</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{product.currentStock}</span>
            </div>
            <span className="text-gray-400">→</span>
            <div className="text-center">
              <span className="text-xs text-gray-500 dark:text-gray-400 block">Real</span>
              <input
                type="number"
                value={product.realStock ?? ''}
                onChange={handleRealStockInput}
                min="0"
                className="w-16 text-center text-sm font-medium bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
              />
            </div>
            {product.realStock !== undefined && (
              <div className={`text-sm font-medium ${product.realStock - product.currentStock >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {product.realStock - product.currentStock >= 0 ? '+' : ''}{product.realStock - product.currentStock}
              </div>
            )}
          </div>
        ) : (
          // Normal mode: quantity controls
          <div className="flex items-center gap-1">
            <button
              onClick={handleDecrement}
              disabled={product.quantity <= 1}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>

            <input
              type="number"
              value={product.quantity}
              onChange={handleQuantityInput}
              min="1"
              max={maxQuantity}
              className="w-14 text-center text-lg font-bold bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-purple-500 outline-none text-gray-900 dark:text-white"
            />

            <button
              onClick={handleIncrement}
              disabled={maxQuantity !== undefined && product.quantity >= maxQuantity}
              className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        )}

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}
