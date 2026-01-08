'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Save,
  Loader2,
  Building2,
  Users,
  RotateCcw,
  Check,
  AlertCircle,
  Package
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useBranchPricing, BranchProduct, Branch } from '@/hooks/useBranchPricing'

interface BranchPricingModalProps {
  isOpen: boolean
  onClose: () => void
  matrixCompanyId: number
  matrixCompanyName: string
}

export function BranchPricingModal({
  isOpen,
  onClose,
  matrixCompanyId,
  matrixCompanyName
}: BranchPricingModalProps) {
  const { theme } = useTheme()
  const {
    data,
    branches,
    products,
    loading,
    saving,
    error,
    updateBranchPrices,
    removeBranchPrice,
    getSummary
  } = useBranchPricing(matrixCompanyId)

  // Local state for editing
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({})
  const [activeCategory, setActiveCategory] = useState<string>('all')

  // Reset edited prices when modal opens/closes or data changes
  useEffect(() => {
    if (!isOpen) {
      setEditedPrices({})
    }
  }, [isOpen])

  // Get unique categories
  const categories = Array.from(new Set(products.map(p => p.serviceCategory)))

  // Filter products by category
  const filteredProducts = activeCategory === 'all'
    ? products
    : products.filter(p => p.serviceCategory === activeCategory)

  // Handle price change
  const handlePriceChange = (productId: number, branchId: number, value: string) => {
    const key = `${productId}-${branchId}`
    const numValue = parseFloat(value)

    if (!isNaN(numValue) && numValue >= 0) {
      setEditedPrices(prev => ({
        ...prev,
        [key]: numValue
      }))
    } else if (value === '') {
      // Allow empty to clear
      const newPrices = { ...editedPrices }
      delete newPrices[key]
      setEditedPrices(newPrices)
    }
  }

  // Get display value for a cell
  const getCellValue = (product: BranchProduct, branchId: number): string => {
    const key = `${product.productId}-${branchId}`

    if (key in editedPrices) {
      return editedPrices[key].toString()
    }

    const branchPrice = product.branchPrices[branchId]
    return branchPrice?.precio?.toString() || product.defaultPrice?.toString() || ''
  }

  // Check if a cell has been edited
  const isCellEdited = (productId: number, branchId: number): boolean => {
    const key = `${productId}-${branchId}`
    return key in editedPrices
  }

  // Check if a cell has a custom price (from DB)
  const isCellCustom = (product: BranchProduct, branchId: number): boolean => {
    return product.branchPrices[branchId]?.isCustom || false
  }

  // Count changes
  const changesCount = Object.keys(editedPrices).length

  // Save all changes
  const handleSaveAll = async () => {
    if (changesCount === 0) return

    const updates = Object.entries(editedPrices).map(([key, precio]) => {
      const [productId, branchId] = key.split('-').map(Number)
      return {
        productId,
        branchId,
        precioSucursal: precio
      }
    })

    try {
      await updateBranchPrices(updates, 'Actualizacion masiva desde modal')
      setEditedPrices({})
    } catch (err) {
      // Error is handled by the hook
    }
  }

  // Reset a specific price to default
  const handleResetToDefault = async (productId: number, branchId: number) => {
    try {
      await removeBranchPrice(branchId, productId)
      // Clear from local edits if present
      const key = `${productId}-${branchId}`
      if (key in editedPrices) {
        const newPrices = { ...editedPrices }
        delete newPrices[key]
        setEditedPrices(newPrices)
      }
    } catch (err) {
      // Error is handled by the hook
    }
  }

  const summary = getSummary()

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={cn(
            "relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl",
            theme === 'dark' ? "bg-gray-900" : "bg-white"
          )}
        >
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between p-6 border-b",
            theme === 'dark' ? "border-gray-800" : "border-gray-200"
          )}>
            <div>
              <h2 className={cn(
                "text-xl font-semibold flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Users className="w-5 h-5 text-blue-500" />
                Precios por Sucursal
              </h2>
              <p className={cn(
                "text-sm mt-1",
                theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )}>
                {matrixCompanyName} - Configura precios diferentes para cada sucursal
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Summary badge */}
              {summary && (
                <div className={cn(
                  "px-3 py-1.5 rounded-lg text-sm",
                  theme === 'dark' ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-600"
                )}>
                  {summary.totalCustomPrices} precio(s) personalizados
                </div>
              )}

              {/* Save button */}
              {changesCount > 0 && (
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                    "transition-colors",
                    saving
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  )}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar ({changesCount})
                </button>
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  theme === 'dark'
                    ? "hover:bg-gray-800 text-gray-400"
                    : "hover:bg-gray-100 text-gray-500"
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Category tabs */}
          <div className={cn(
            "flex items-center gap-2 p-4 border-b overflow-x-auto",
            theme === 'dark' ? "border-gray-800 bg-gray-900/50" : "border-gray-200 bg-gray-50"
          )}>
            <button
              onClick={() => setActiveCategory('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                activeCategory === 'all'
                  ? "bg-blue-600 text-white"
                  : theme === 'dark'
                    ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    : "bg-white text-gray-600 hover:bg-gray-100"
              )}
            >
              Todos ({products.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors capitalize",
                  activeCategory === cat
                    ? "bg-blue-600 text-white"
                    : theme === 'dark'
                      ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      : "bg-white text-gray-600 hover:bg-gray-100"
                )}
              >
                {cat} ({products.filter(p => p.serviceCategory === cat).length})
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-auto max-h-[calc(90vh-200px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-500">Cargando precios...</span>
              </div>
            ) : error ? (
              <div className={cn(
                "m-4 p-4 rounded-lg border",
                theme === 'dark'
                  ? "bg-red-900/20 border-red-800 text-red-400"
                  : "bg-red-50 border-red-200 text-red-600"
              )}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{error}</span>
                </div>
              </div>
            ) : branches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className={cn(
                  "w-12 h-12 mb-4",
                  theme === 'dark' ? "text-gray-600" : "text-gray-400"
                )} />
                <h3 className={cn(
                  "font-medium mb-1",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  Sin sucursales
                </h3>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-500" : "text-gray-400"
                )}>
                  Esta empresa no tiene sucursales registradas
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className={cn(
                  "sticky top-0 z-10",
                  theme === 'dark' ? "bg-gray-900" : "bg-white"
                )}>
                  <tr className={cn(
                    "text-left text-xs uppercase tracking-wider border-b",
                    theme === 'dark'
                      ? "text-gray-400 border-gray-800"
                      : "text-gray-500 border-gray-200"
                  )}>
                    <th className="px-4 py-3 w-48 sticky left-0 z-20 bg-inherit">Producto</th>
                    <th className="px-4 py-3 w-28 text-center">
                      <div className="flex flex-col items-center">
                        <span>P. Default</span>
                        <span className="text-[10px] font-normal opacity-60">(precio_sucursales)</span>
                      </div>
                    </th>
                    {branches.map(branch => (
                      <th key={branch.id} className="px-4 py-3 w-32 text-center">
                        <div className="flex flex-col items-center">
                          <span className="truncate max-w-[100px]" title={branch.name}>
                            {branch.name}
                          </span>
                          <span className={cn(
                            "text-[10px] font-normal px-1.5 py-0.5 rounded mt-0.5",
                            branch.status === 'active'
                              ? "bg-green-500/20 text-green-500"
                              : "bg-gray-500/20 text-gray-500"
                          )}>
                            {branch.status}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={cn(
                  "divide-y",
                  theme === 'dark' ? "divide-gray-800" : "divide-gray-200"
                )}>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.productId}
                      className={cn(
                        "transition-colors",
                        theme === 'dark' ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                      )}
                    >
                      {/* Product name */}
                      <td className={cn(
                        "px-4 py-3 sticky left-0 z-10",
                        theme === 'dark' ? "bg-gray-900" : "bg-white"
                      )}>
                        <div>
                          <div className={cn(
                            "font-medium text-sm",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            {product.name}
                          </div>
                          <div className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-500" : "text-gray-400"
                          )}>
                            {product.code}
                          </div>
                        </div>
                      </td>

                      {/* Default price */}
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "text-sm font-medium",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          ${product.defaultPrice?.toFixed(2) || '0.00'}
                        </span>
                      </td>

                      {/* Branch prices */}
                      {branches.map(branch => {
                        const isEdited = isCellEdited(product.productId, branch.id)
                        const isCustom = isCellCustom(product, branch.id)
                        const value = getCellValue(product, branch.id)

                        return (
                          <td key={branch.id} className="px-4 py-3 text-center">
                            <div className="relative group">
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={value}
                                onChange={(e) => handlePriceChange(
                                  product.productId,
                                  branch.id,
                                  e.target.value
                                )}
                                className={cn(
                                  "w-24 px-2 py-1.5 text-center rounded border text-sm",
                                  "transition-all focus:outline-none focus:ring-2 focus:ring-blue-500",
                                  isEdited
                                    ? theme === 'dark'
                                      ? "bg-blue-900/30 border-blue-600 text-blue-300"
                                      : "bg-blue-50 border-blue-300 text-blue-700"
                                    : isCustom
                                      ? theme === 'dark'
                                        ? "bg-amber-900/20 border-amber-600/50 text-amber-300"
                                        : "bg-amber-50 border-amber-300 text-amber-700"
                                      : theme === 'dark'
                                        ? "bg-gray-800 border-gray-700 text-gray-300"
                                        : "bg-white border-gray-200 text-gray-700"
                                )}
                              />

                              {/* Custom indicator */}
                              {isCustom && !isEdited && (
                                <div className="absolute -top-1 -right-1">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full",
                                    theme === 'dark' ? "bg-amber-500" : "bg-amber-400"
                                  )} title="Precio personalizado" />
                                </div>
                              )}

                              {/* Edit indicator */}
                              {isEdited && (
                                <div className="absolute -top-1 -right-1">
                                  <div className="w-2 h-2 rounded-full bg-blue-500" title="Editado" />
                                </div>
                              )}

                              {/* Reset button (only for custom prices) */}
                              {isCustom && !isEdited && (
                                <button
                                  onClick={() => handleResetToDefault(product.productId, branch.id)}
                                  className={cn(
                                    "absolute -bottom-6 left-1/2 -translate-x-1/2",
                                    "opacity-0 group-hover:opacity-100 transition-opacity",
                                    "flex items-center gap-1 px-2 py-0.5 rounded text-[10px]",
                                    theme === 'dark'
                                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                  )}
                                  title="Volver al precio default"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Reset
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer legend */}
          <div className={cn(
            "flex items-center justify-between p-4 border-t",
            theme === 'dark' ? "border-gray-800 bg-gray-900/50" : "border-gray-200 bg-gray-50"
          )}>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded border",
                  theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                )} />
                <span className={theme === 'dark' ? "text-gray-400" : "text-gray-500"}>
                  Usa precio default
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded border relative",
                  theme === 'dark' ? "bg-amber-900/20 border-amber-600/50" : "bg-amber-50 border-amber-300"
                )}>
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                </div>
                <span className={theme === 'dark' ? "text-gray-400" : "text-gray-500"}>
                  Precio personalizado (guardado)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded border relative",
                  theme === 'dark' ? "bg-blue-900/30 border-blue-600" : "bg-blue-50 border-blue-300"
                )}>
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                </div>
                <span className={theme === 'dark' ? "text-gray-400" : "text-gray-500"}>
                  Editado (sin guardar)
                </span>
              </div>
            </div>

            <div className={cn(
              "text-xs",
              theme === 'dark' ? "text-gray-500" : "text-gray-400"
            )}>
              Los precios personalizados sobreescriben el precio default para cada sucursal
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
