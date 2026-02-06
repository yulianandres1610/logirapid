'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle,
  RefreshCw,
  Package,
  Warehouse,
  AlertTriangle,
  Save
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface WarehouseStock {
  warehouseId: number
  warehouseName: string
  warehouseCode: string
  stockId: number
  currentStock: number
  reserved: number
}

interface ProductInfo {
  id: number
  name: string
  sku: string
  barcode: string
  totalStock: number
}

export default function FixStockPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseStock[]>([])
  const [newStocks, setNewStocks] = useState<Record<number, string>>({})

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/market/products/${productId}/fix-stock`)
      const result = await response.json()

      if (result.success) {
        setProduct(result.data.product)
        setWarehouses(result.data.warehouses)

        // Initialize new stocks with current values
        const initial: Record<number, string> = {}
        for (const wh of result.data.warehouses) {
          initial[wh.warehouseId] = wh.currentStock.toString()
        }
        setNewStocks(initial)
      } else {
        setError(result.error || 'Error al cargar datos')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productId) {
      fetchData()
    }
  }, [productId])

  const handleStockChange = (warehouseId: number, value: string) => {
    // Only allow numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setNewStocks(prev => ({ ...prev, [warehouseId]: value }))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const corrections = warehouses
        .filter(wh => {
          const newStock = parseFloat(newStocks[wh.warehouseId] || '0')
          return newStock !== wh.currentStock
        })
        .map(wh => ({
          warehouseId: wh.warehouseId,
          newStock: parseFloat(newStocks[wh.warehouseId] || '0'),
          reason: 'Correccion manual desde UI'
        }))

      if (corrections.length === 0) {
        setError('No hay cambios para guardar')
        setSaving(false)
        return
      }

      const response = await fetch(`/api/market/products/${productId}/fix-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections })
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(`Stock corregido: ${result.data.corrections.map((c: any) =>
          `${c.warehouseName}: ${c.before} -> ${c.after}`
        ).join(', ')}`)

        // Reload data
        await fetchData()
      } else {
        setError(result.error || 'Error al guardar')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  const getTotalNewStock = () => {
    return warehouses.reduce((sum, wh) => {
      return sum + (parseFloat(newStocks[wh.warehouseId] || '0') || 0)
    }, 0)
  }

  const hasChanges = () => {
    return warehouses.some(wh => {
      const newStock = parseFloat(newStocks[wh.warehouseId] || '0')
      return newStock !== wh.currentStock
    })
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN']}>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Link
                href={`/dashboard/market/inventory/${productId}`}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Corregir Stock
                </h1>
                <p className="text-gray-500 text-sm">
                  Ajusta el inventario a los valores fisicos reales
                </p>
              </div>
              <button
                onClick={fetchData}
                disabled={loading}
                className={cn(
                  'ml-auto p-2 rounded-lg transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                )}
              >
                <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
              </button>
            </div>

            {/* Messages */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'mb-6 p-4 rounded-xl flex items-center gap-3',
                  theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50 border border-red-200'
                )}
              >
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <p className="text-red-600">{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'mb-6 p-4 rounded-xl flex items-center gap-3',
                  theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50 border border-emerald-200'
                )}
              >
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <p className="text-emerald-600">{success}</p>
              </motion.div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : product ? (
              <div className="space-y-6">
                {/* Product Info */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'p-6 rounded-xl',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm border'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-orange-100'
                    )}>
                      <Package className="w-7 h-7 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <h2 className={cn(
                        'text-xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {product.name}
                      </h2>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span>SKU: {product.sku}</span>
                        {product.barcode && <span>Codigo: {product.barcode}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Stock Sistema</p>
                      <p className={cn(
                        'text-2xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {product.totalStock}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Stock by Warehouse */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    'p-6 rounded-xl',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm border'
                  )}
                >
                  <h3 className={cn(
                    'text-lg font-bold mb-4 flex items-center gap-2',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    <Warehouse className="w-5 h-5 text-orange-500" />
                    Stock por Almacen
                  </h3>

                  <div className="space-y-4">
                    {warehouses.map((wh) => {
                      const newStock = parseFloat(newStocks[wh.warehouseId] || '0')
                      const difference = newStock - wh.currentStock
                      const hasChange = difference !== 0

                      return (
                        <div
                          key={wh.warehouseId}
                          className={cn(
                            'p-4 rounded-xl transition-all',
                            hasChange
                              ? theme === 'dark' ? 'bg-orange-900/30 border border-orange-500/50' : 'bg-orange-50 border border-orange-200'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {wh.warehouseName}
                              </p>
                              <p className="text-xs text-gray-500">
                                Codigo: {wh.warehouseCode}
                              </p>
                            </div>

                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">Actual</p>
                              <p className={cn(
                                'text-lg font-bold',
                                wh.currentStock > 0 ? 'text-emerald-500' : 'text-gray-500'
                              )}>
                                {wh.currentStock}
                              </p>
                            </div>

                            <div className="text-center">
                              <span className="text-gray-400 text-xl">→</span>
                            </div>

                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">Nuevo</p>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={newStocks[wh.warehouseId] || ''}
                                onChange={(e) => handleStockChange(wh.warehouseId, e.target.value)}
                                className={cn(
                                  'w-24 px-3 py-2 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500',
                                  theme === 'dark'
                                    ? 'bg-gray-600 text-white'
                                    : 'bg-white border text-gray-900'
                                )}
                              />
                            </div>

                            {hasChange && (
                              <div className="text-center min-w-[60px]">
                                <p className="text-xs text-gray-500 mb-1">Cambio</p>
                                <p className={cn(
                                  'text-lg font-bold',
                                  difference > 0 ? 'text-emerald-500' : 'text-red-500'
                                )}>
                                  {difference > 0 ? '+' : ''}{difference}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Total */}
                  <div className={cn(
                    'mt-6 p-4 rounded-xl flex items-center justify-between',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                  )}>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Nuevo Total:
                    </span>
                    <span className={cn(
                      'text-2xl font-bold',
                      getTotalNewStock() !== product.totalStock
                        ? 'text-orange-500'
                        : theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {getTotalNewStock()}
                    </span>
                  </div>
                </motion.div>

                {/* Save Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges()}
                    className={cn(
                      'w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all',
                      hasChanges()
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Guardar Correcciones
                      </>
                    )}
                  </button>
                </motion.div>

                {/* Link to debug */}
                <div className="text-center">
                  <Link
                    href={`/dashboard/market/inventory/${productId}/debug`}
                    className="text-sm text-orange-500 hover:underline"
                  >
                    Ver diagnostico completo de movimientos
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
