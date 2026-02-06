'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  RefreshCw,
  Package,
  Warehouse,
  ShoppingCart,
  Truck,
  ClipboardCheck,
  Factory,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface DebugData {
  product: {
    id: number
    name: string
    sku: string
    barcode: string
  }
  stockRecords: Array<{
    stockId: number
    warehouseId: number
    warehouseName: string
    warehouseCode: string
    variantId: number | null
    variantName: string | null
    quantityOnHand: number
    quantityReserved: number
    available: number
    locationCode: string | null
    lastMovement: string | null
    createdAt: string
    updatedAt: string
  }>
  stockTotals: {
    totalOnHand: number
    totalReserved: number
    totalAvailable: number
  }
  movements: {
    purchases: { count: number; totalReceived: number; records: any[] }
    posSales: { count: number; totalSold: number; records: any[] }
    wholesaleSales: { count: number; totalDelivered: number; records: any[] }
    transfers: { count: number; records: any[] }
    adjustments: { count: number; netChange: number; records: any[] }
    audits: { count: number; netChange: number; records: any[] }
    production: { countIn: number; countOut: number; totalIn: number; totalOut: number; records: any[] }
  }
  analysis: {
    purchaseTotals: number
    salesTotals: number
    wholesaleTotals: number
    adjustmentTotals: number
    auditTotals: number
    productionInTotals: number
    productionOutTotals: number
    expectedStock: number
    actualStock: number
    discrepancy: number
    discrepancyMessage: string
  }
}

export default function InventoryDebugPage() {
  const { theme } = useTheme()
  const params = useParams()
  const productId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DebugData | null>(null)

  const fetchDebugData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/market/products/${productId}/debug-stock`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || 'Error al obtener datos')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productId) {
      fetchDebugData()
    }
  }, [productId])

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN']}>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <div className="max-w-7xl mx-auto">
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
                  Diagnostico de Inventario
                </h1>
                <p className="text-gray-500 text-sm">
                  Producto ID: {productId}
                </p>
              </div>
              <button
                onClick={fetchDebugData}
                disabled={loading}
                className={cn(
                  'ml-auto flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                Actualizar
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : error ? (
              <div className={cn(
                'p-6 rounded-xl text-center',
                theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50'
              )}>
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            ) : data ? (
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
                      'w-16 h-16 rounded-xl flex items-center justify-center',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Package className="w-8 h-8 text-orange-500" />
                    </div>
                    <div>
                      <h2 className={cn(
                        'text-xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {data.product.name}
                      </h2>
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span>SKU: {data.product.sku}</span>
                        {data.product.barcode && <span>Codigo: {data.product.barcode}</span>}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Analysis - Discrepancy Alert */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    'p-6 rounded-xl',
                    data.analysis.discrepancy === 0
                      ? theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50 border border-emerald-200'
                      : theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50 border border-red-200'
                  )}
                >
                  <div className="flex items-start gap-4">
                    {data.analysis.discrepancy === 0 ? (
                      <CheckCircle className="w-8 h-8 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
                    )}
                    <div className="flex-1">
                      <h3 className={cn(
                        'text-lg font-bold',
                        data.analysis.discrepancy === 0 ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {data.analysis.discrepancyMessage}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Stock Actual</p>
                          <p className={cn(
                            'text-2xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {data.analysis.actualStock}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Stock Esperado</p>
                          <p className={cn(
                            'text-2xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {data.analysis.expectedStock}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Discrepancia</p>
                          <p className={cn(
                            'text-2xl font-bold',
                            data.analysis.discrepancy === 0 ? 'text-emerald-500' :
                            data.analysis.discrepancy > 0 ? 'text-blue-500' : 'text-red-500'
                          )}>
                            {data.analysis.discrepancy > 0 ? '+' : ''}{data.analysis.discrepancy}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Total Reservado</p>
                          <p className={cn(
                            'text-2xl font-bold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {data.stockTotals.totalReserved}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Stock by Warehouse */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
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
                    Stock por Almacen ({data.stockRecords.length} registros)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn(
                          'text-left text-xs uppercase tracking-wider',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          <th className="pb-3">Almacen</th>
                          <th className="pb-3">Variante</th>
                          <th className="pb-3 text-right">En Mano</th>
                          <th className="pb-3 text-right">Reservado</th>
                          <th className="pb-3 text-right">Disponible</th>
                          <th className="pb-3">Ultimo Mov.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {data.stockRecords.map((record) => (
                          <tr key={record.stockId}>
                            <td className="py-3">
                              <span className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {record.warehouseName}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">({record.warehouseCode})</span>
                            </td>
                            <td className="py-3 text-sm text-gray-500">
                              {record.variantName || 'Base'}
                            </td>
                            <td className={cn(
                              'py-3 text-right font-bold',
                              record.quantityOnHand > 0 ? 'text-emerald-500' : 'text-red-500'
                            )}>
                              {record.quantityOnHand}
                            </td>
                            <td className="py-3 text-right text-gray-500">
                              {record.quantityReserved}
                            </td>
                            <td className={cn(
                              'py-3 text-right font-medium',
                              record.available > 0 ? 'text-blue-500' : 'text-gray-500'
                            )}>
                              {record.available}
                            </td>
                            <td className="py-3 text-xs text-gray-500">
                              {formatDate(record.lastMovement)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className={cn(
                          'font-bold',
                          theme === 'dark' ? 'text-white bg-gray-700' : 'text-gray-900 bg-gray-100'
                        )}>
                          <td className="py-3 px-2 rounded-l-lg" colSpan={2}>TOTAL</td>
                          <td className="py-3 text-right text-emerald-500">{data.stockTotals.totalOnHand}</td>
                          <td className="py-3 text-right">{data.stockTotals.totalReserved}</td>
                          <td className="py-3 text-right text-blue-500 rounded-r-lg">{data.stockTotals.totalAvailable}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </motion.div>

                {/* Movement Summary */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    'p-6 rounded-xl',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm border'
                  )}
                >
                  <h3 className={cn(
                    'text-lg font-bold mb-4',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Resumen de Movimientos
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Compras */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-emerald-50'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs text-gray-500">Compras</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-500">
                        +{data.analysis.purchaseTotals}
                      </p>
                      <p className="text-xs text-gray-500">{data.movements.purchases.count} ordenes</p>
                    </div>

                    {/* Ventas POS */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-red-50'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-gray-500">Ventas POS</span>
                      </div>
                      <p className="text-2xl font-bold text-red-500">
                        -{data.analysis.salesTotals}
                      </p>
                      <p className="text-xs text-gray-500">{data.movements.posSales.count} ventas</p>
                    </div>

                    {/* Ventas Mayorista */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-orange-50'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Receipt className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-gray-500">Mayorista</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-500">
                        -{data.analysis.wholesaleTotals}
                      </p>
                      <p className="text-xs text-gray-500">{data.movements.wholesaleSales.count} facturas</p>
                    </div>

                    {/* Transferencias */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-blue-50'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="w-4 h-4 text-blue-500" />
                        <span className="text-xs text-gray-500">Transferencias</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-500">
                        {data.movements.transfers.count}
                      </p>
                      <p className="text-xs text-gray-500">movimientos</p>
                    </div>

                    {/* Ajustes */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-purple-50'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <ClipboardCheck className="w-4 h-4 text-purple-500" />
                        <span className="text-xs text-gray-500">Ajustes</span>
                      </div>
                      <p className={cn(
                        'text-2xl font-bold',
                        data.analysis.adjustmentTotals >= 0 ? 'text-purple-500' : 'text-red-500'
                      )}>
                        {data.analysis.adjustmentTotals >= 0 ? '+' : ''}{data.analysis.adjustmentTotals}
                      </p>
                      <p className="text-xs text-gray-500">{data.movements.adjustments.count} operaciones</p>
                    </div>

                    {/* Auditorias */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-yellow-50'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <ClipboardCheck className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs text-gray-500">Auditorias</span>
                      </div>
                      <p className={cn(
                        'text-2xl font-bold',
                        data.analysis.auditTotals >= 0 ? 'text-yellow-500' : 'text-red-500'
                      )}>
                        {data.analysis.auditTotals >= 0 ? '+' : ''}{data.analysis.auditTotals}
                      </p>
                      <p className="text-xs text-gray-500">{data.movements.audits.count} conteos</p>
                    </div>

                    {/* Produccion In */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-teal-50'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Factory className="w-4 h-4 text-teal-500" />
                        <span className="text-xs text-gray-500">Produccion (Entrada)</span>
                      </div>
                      <p className="text-2xl font-bold text-teal-500">
                        +{data.analysis.productionInTotals}
                      </p>
                      <p className="text-xs text-gray-500">{data.movements.production.countIn} ordenes</p>
                    </div>

                    {/* Produccion Out */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowDownRight className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-500">Produccion (Salida)</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-500">
                        -{data.analysis.productionOutTotals}
                      </p>
                      <p className="text-xs text-gray-500">{data.movements.production.countOut} ordenes</p>
                    </div>
                  </div>

                  {/* Calculation */}
                  <div className={cn(
                    'mt-6 p-4 rounded-xl font-mono text-sm',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                  )}>
                    <p className={cn(
                      'mb-2',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Formula: Compras - VentasPOS - VentasMayorista + Ajustes + Auditorias + ProduccionIn - ProduccionOut
                    </p>
                    <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                      {data.analysis.purchaseTotals} - {data.analysis.salesTotals} - {data.analysis.wholesaleTotals} + ({data.analysis.adjustmentTotals}) + ({data.analysis.auditTotals}) + {data.analysis.productionInTotals} - {data.analysis.productionOutTotals} = <span className="text-orange-500 font-bold">{data.analysis.expectedStock}</span>
                    </p>
                  </div>
                </motion.div>

                {/* Recent Movements */}
                {data.movements.purchases.records.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className={cn(
                      'p-6 rounded-xl',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm border'
                    )}
                  >
                    <h3 className={cn(
                      'text-lg font-bold mb-4 flex items-center gap-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                      Ultimas Compras ({data.movements.purchases.count})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={cn(
                            'text-left text-xs uppercase tracking-wider',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            <th className="pb-3">Orden</th>
                            <th className="pb-3">Estado</th>
                            <th className="pb-3 text-right">Cantidad</th>
                            <th className="pb-3 text-right">Recibido</th>
                            <th className="pb-3">Almacen</th>
                            <th className="pb-3">Fecha</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {data.movements.purchases.records.slice(0, 10).map((p: any) => (
                            <tr key={p.id}>
                              <td className={cn(
                                'py-2 font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {p.purchase_number}
                              </td>
                              <td className="py-2">
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs',
                                  p.status === 'recibido' || p.status === 'received' ? 'bg-emerald-500/20 text-emerald-500' :
                                  p.status === 'parcial' ? 'bg-yellow-500/20 text-yellow-500' :
                                  'bg-gray-500/20 text-gray-500'
                                )}>
                                  {p.status}
                                </span>
                              </td>
                              <td className="py-2 text-right text-gray-500">{p.quantity}</td>
                              <td className="py-2 text-right font-bold text-emerald-500">{p.quantity_received || p.quantity}</td>
                              <td className="py-2 text-gray-500">{p.warehouse_name}</td>
                              <td className="py-2 text-xs text-gray-500">{formatDate(p.received_at || p.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* Recent Sales */}
                {data.movements.posSales.records.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className={cn(
                      'p-6 rounded-xl',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm border'
                    )}
                  >
                    <h3 className={cn(
                      'text-lg font-bold mb-4 flex items-center gap-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <ShoppingCart className="w-5 h-5 text-red-500" />
                      Ultimas Ventas POS ({data.movements.posSales.count})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={cn(
                            'text-left text-xs uppercase tracking-wider',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            <th className="pb-3">Orden</th>
                            <th className="pb-3">Estado</th>
                            <th className="pb-3 text-right">Cantidad</th>
                            <th className="pb-3">Almacen</th>
                            <th className="pb-3">Fecha</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {data.movements.posSales.records.slice(0, 10).map((s: any) => (
                            <tr key={s.id}>
                              <td className={cn(
                                'py-2 font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {s.order_number}
                              </td>
                              <td className="py-2">
                                <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-500">
                                  {s.status}
                                </span>
                              </td>
                              <td className="py-2 text-right font-bold text-red-500">-{s.quantity}</td>
                              <td className="py-2 text-gray-500">{s.warehouse_name}</td>
                              <td className="py-2 text-xs text-gray-500">{formatDate(s.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* Adjustments */}
                {data.movements.adjustments.records.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className={cn(
                      'p-6 rounded-xl',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm border'
                    )}
                  >
                    <h3 className={cn(
                      'text-lg font-bold mb-4 flex items-center gap-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <ClipboardCheck className="w-5 h-5 text-purple-500" />
                      Ajustes Manuales ({data.movements.adjustments.count})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={cn(
                            'text-left text-xs uppercase tracking-wider',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            <th className="pb-3">Operacion</th>
                            <th className="pb-3">Tipo</th>
                            <th className="pb-3">Estado</th>
                            <th className="pb-3 text-right">Cantidad</th>
                            <th className="pb-3">Almacen</th>
                            <th className="pb-3">Notas</th>
                            <th className="pb-3">Fecha</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {data.movements.adjustments.records.map((a: any) => (
                            <tr key={a.id}>
                              <td className={cn(
                                'py-2 font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {a.operation_number}
                              </td>
                              <td className="py-2 text-gray-500">{a.operation_type}</td>
                              <td className="py-2">
                                <span className={cn(
                                  'px-2 py-0.5 rounded text-xs',
                                  a.status === 'done' || a.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' :
                                  'bg-gray-500/20 text-gray-500'
                                )}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="py-2 text-right font-bold text-purple-500">
                                {a.quantity_done || a.quantity_planned}
                              </td>
                              <td className="py-2 text-gray-500">{a.warehouse_name}</td>
                              <td className="py-2 text-xs text-gray-500 max-w-[200px] truncate">{a.notes}</td>
                              <td className="py-2 text-xs text-gray-500">{formatDate(a.completed_at || a.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

              </div>
            ) : null}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
