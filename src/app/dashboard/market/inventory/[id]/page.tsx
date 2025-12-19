'use client'

import { useEffect, useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Warehouse,
  TrendingUp,
  Users,
  Clock,
  Edit,
  Barcode,
  Printer,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  RefreshCw,
  Truck,
  History
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  name: string
  description: string
  imageUrl: string | null
  category: string | null
  costPrice: number
  sellingPrice: number
  currency: string
  sku: string
  barcode: string
  supplierName: string | null
  supplierContact: string | null
  supplierReference: string | null
  quantityOnHand: number
  quantityExpected: number
  minimumStock: number
  isActive: boolean
  unitOfMeasure: string
  createdAt: string
  updatedAt: string
}

interface SalesData {
  period: string
  quantity: number
  revenue: number
  orders: number
}

interface WarehouseStock {
  warehouseId: number
  warehouseName: string
  warehouseCode: string
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  location?: string
}

interface Supplier {
  supplierName: string
  supplierContact: string
  avgPrice: number
  minPrice: number
  maxPrice: number
  lastPrice: number
  totalPurchased: number
  lastPurchaseDate: string
}

interface ChangeLog {
  id: number
  action: string
  actionLabel: string
  fieldName: string | null
  fieldLabel: string | null
  oldValue: string | null
  newValue: string | null
  userName: string | null
  userEmail: string | null
  createdAt: string
}

interface InventoryMovement {
  id: number
  type: string
  typeLabel: string
  quantity: number
  quantityBefore: number
  quantityAfter: number
  notes: string | null
  userName: string | null
  createdAt: string
}

type TabType = 'overview' | 'stock' | 'suppliers' | 'history'

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Resumen', icon: TrendingUp },
  { id: 'stock', label: 'Stock por Almacén', icon: Warehouse },
  { id: 'suppliers', label: 'Proveedores', icon: Truck },
  { id: 'history', label: 'Historial', icon: History }
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const productId = resolvedParams.id
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [salesPeriod, setSalesPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    fetchProduct()
  }, [productId])

  useEffect(() => {
    if (product) {
      if (activeTab === 'overview') {
        fetchSalesData()
      } else if (activeTab === 'stock') {
        fetchWarehouseStock()
      } else if (activeTab === 'suppliers') {
        fetchSuppliers()
      } else if (activeTab === 'history') {
        fetchHistory()
      }
    }
  }, [activeTab, product, salesPeriod])

  const fetchProduct = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/products/${productId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setProduct(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSalesData = async () => {
    setSalesLoading(true)
    try {
      const response = await fetch(`/api/market/products/${productId}/sales?period=${salesPeriod}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSalesData(data.data.sales || [])
        }
      }
    } catch (error) {
      console.error('Error fetching sales data:', error)
    } finally {
      setSalesLoading(false)
    }
  }

  const fetchWarehouseStock = async () => {
    setStockLoading(true)
    try {
      const response = await fetch(`/api/market/products/${productId}/stock`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setWarehouseStock(data.data.warehouses || [])
        }
      }
    } catch (error) {
      console.error('Error fetching warehouse stock:', error)
    } finally {
      setStockLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    setSuppliersLoading(true)
    try {
      const response = await fetch(`/api/market/products/${productId}/suppliers`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSuppliers(data.data.suppliers || [])
        }
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setSuppliersLoading(false)
    }
  }

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`/api/market/products/${productId}/logs`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setChangeLogs(data.data.logs || [])
          setMovements(data.data.movements || [])
        }
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setHistoryLoading(false)
    }
  }

  const getStockStatus = (p: Product) => {
    if (p.quantityOnHand === 0) {
      return { color: 'red', label: 'Sin Stock', icon: AlertCircle }
    }
    if (p.quantityOnHand <= p.minimumStock) {
      return { color: 'amber', label: 'Stock Bajo', icon: AlertTriangle }
    }
    return { color: 'green', label: 'En Stock', icon: CheckCircle }
  }

  const getMargin = (p: Product) => {
    if (p.costPrice === 0) return 0
    return Math.round(((p.sellingPrice - p.costPrice) / p.costPrice) * 100)
  }

  const printBarcodeLabel = (p: Product) => {
    const printWindow = window.open('', '_blank', 'width=400,height=300')
    if (!printWindow) return
    const symbol = CURRENCY_SYMBOLS[p.currency] || '$'
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta - ${p.name}</title>
        <style>
          @page { size: 50mm 30mm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; width: 50mm; height: 30mm; padding: 2mm; display: flex; flex-direction: column; justify-content: space-between; }
          .product-name { font-size: 8pt; font-weight: bold; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
          .barcode-container { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .barcode { font-family: 'Libre Barcode EAN13 Text', monospace; font-size: 24pt; letter-spacing: 0; }
          .barcode-number { font-size: 7pt; font-family: monospace; margin-top: 1mm; }
          .price { font-size: 10pt; font-weight: bold; text-align: center; }
          .sku { font-size: 6pt; text-align: center; color: #666; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+EAN13+Text&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="product-name">${p.name}</div>
        <div class="barcode-container">
          ${p.barcode ? `<div class="barcode">${p.barcode}</div><div class="barcode-number">${p.barcode}</div>` : `<div class="sku">SKU: ${p.sku}</div>`}
        </div>
        <div class="price">${symbol}${p.sellingPrice.toFixed(2)}</div>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 500)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTotalSales = () => {
    return salesData.reduce((acc, d) => acc + d.quantity, 0)
  }

  const getTotalRevenue = () => {
    return salesData.reduce((acc, d) => acc + d.revenue, 0)
  }

  const getTotalOrders = () => {
    return salesData.reduce((acc, d) => acc + d.orders, 0)
  }

  const getTotalWarehouseStock = () => {
    return warehouseStock.reduce((acc, w) => acc + w.quantityOnHand, 0)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!product) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex flex-col items-center justify-center">
            <Package className="w-16 h-16 text-gray-400 mb-4" />
            <h2 className="text-xl font-bold text-gray-600 dark:text-gray-300">Producto no encontrado</h2>
            <Link href="/dashboard/market/inventory">
              <button className="mt-4 text-emerald-500 hover:text-emerald-600">
                Volver al inventario
              </button>
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const status = getStockStatus(product)
  const margin = getMargin(product)
  const symbol = CURRENCY_SYMBOLS[product.currency] || '$'

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <Link href="/dashboard/market/inventory">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-2 rounded-xl transition-colors',
                      theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </motion.button>
                </Link>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center shadow-lg border',
                    theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'
                  )}>
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {product.category && (
                        <span className={cn(
                          'px-3 py-1 rounded-full text-xs font-medium',
                          theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                        )}>
                          {product.category}
                        </span>
                      )}
                      <span className="text-sm text-gray-500 font-mono">SKU: {product.sku}</span>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium',
                        status.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                        status.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                        status.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        <status.icon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => printBarcodeLabel(product)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors',
                    theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Imprimir Etiqueta</span>
                </motion.button>
                <Link href={`/dashboard/market/inventory/${product.id}/edit`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </motion.button>
                </Link>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'p-4 rounded-2xl border shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Precio Costo</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{symbol}{product.costPrice.toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className={cn(
                  'p-4 rounded-2xl border shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                  )}>
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Precio Venta</p>
                    <p className="text-lg font-bold text-emerald-600">{symbol}{product.sellingPrice.toFixed(2)}</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-4 rounded-2xl border shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <TrendingUp className={cn('w-5 h-5', margin >= 20 ? 'text-purple-600' : 'text-red-500')} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Margen</p>
                    <p className={cn('text-lg font-bold', margin >= 20 ? 'text-purple-600' : 'text-red-500')}>{margin}%</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className={cn(
                  'p-4 rounded-2xl border shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    status.color === 'green' && (theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'),
                    status.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'),
                    status.color === 'red' && (theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100')
                  )}>
                    <Package className={cn(
                      'w-5 h-5',
                      status.color === 'green' && 'text-green-600',
                      status.color === 'amber' && 'text-amber-600',
                      status.color === 'red' && 'text-red-600'
                    )} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Stock Actual</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {product.quantityOnHand} <span className="text-xs font-normal text-gray-500">{product.unitOfMeasure}</span>
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Barcode Section */}
            {product.barcode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-4 rounded-2xl border shadow-lg flex items-center justify-between',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-4">
                  <Barcode className="w-8 h-8 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Código de Barras EAN-13</p>
                    <p className="font-mono text-2xl font-bold text-gray-900 dark:text-white tracking-widest">{product.barcode}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tabs */}
            <div className={cn(
              'rounded-2xl border shadow-xl overflow-hidden',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              {/* Tab Header */}
              <div className={cn(
                'flex border-b overflow-x-auto',
                theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              )}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative whitespace-nowrap',
                      activeTab === tab.id
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {/* Overview Tab - Sales Analytics */}
                  {activeTab === 'overview' && (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ritmo de Ventas</h3>
                        <div className="flex items-center gap-2">
                          {(['week', 'month', 'year'] as const).map((period) => (
                            <button
                              key={period}
                              onClick={() => setSalesPeriod(period)}
                              className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                salesPeriod === period
                                  ? 'bg-emerald-500 text-white'
                                  : theme === 'dark'
                                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              )}
                            >
                              {period === 'week' ? 'Semanal' : period === 'month' ? 'Mensual' : 'Anual'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {salesLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : salesData.length === 0 ? (
                        <div className="text-center py-12">
                          <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500">No hay datos de ventas para este período</p>
                        </div>
                      ) : (
                        <>
                          {/* Sales Summary */}
                          <div className="grid grid-cols-3 gap-4">
                            <div className={cn(
                              'p-4 rounded-xl',
                              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                            )}>
                              <p className="text-xs text-gray-500 mb-1">Unidades Vendidas</p>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">{getTotalSales()}</p>
                            </div>
                            <div className={cn(
                              'p-4 rounded-xl',
                              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                            )}>
                              <p className="text-xs text-gray-500 mb-1">Ingresos Totales</p>
                              <p className="text-2xl font-bold text-emerald-600">{symbol}{getTotalRevenue().toFixed(2)}</p>
                            </div>
                            <div className={cn(
                              'p-4 rounded-xl',
                              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                            )}>
                              <p className="text-xs text-gray-500 mb-1">Órdenes</p>
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">{getTotalOrders()}</p>
                            </div>
                          </div>

                          {/* Sales Table */}
                          <div className={cn(
                            'rounded-xl overflow-hidden',
                            theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'
                          )}>
                            <table className="w-full">
                              <thead>
                                <tr className={cn(
                                  'border-b',
                                  theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                                )}>
                                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Período</th>
                                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Ingresos</th>
                                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Órdenes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                {salesData.map((sale, idx) => (
                                  <tr key={idx} className={cn(
                                    'transition-colors',
                                    theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'
                                  )}>
                                    <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{sale.period}</td>
                                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-300">{sale.quantity}</td>
                                    <td className="py-3 px-4 text-sm text-right font-medium text-emerald-600">{symbol}{sale.revenue.toFixed(2)}</td>
                                    <td className="py-3 px-4 text-sm text-right text-gray-600 dark:text-gray-300">{sale.orders}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* Stock by Warehouse Tab */}
                  {activeTab === 'stock' && (
                    <motion.div
                      key="stock"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Stock por Almacén</h3>
                        <div className={cn(
                          'px-4 py-2 rounded-lg',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}>
                          <span className="text-sm text-gray-500">Total: </span>
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{getTotalWarehouseStock()}</span>
                          <span className="text-sm text-gray-500 ml-1">{product.unitOfMeasure}</span>
                        </div>
                      </div>

                      {stockLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : warehouseStock.length === 0 ? (
                        <div className="text-center py-12">
                          <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500">No hay stock en almacenes</p>
                          <p className="text-sm text-gray-400 mt-1">El stock mostrado es general sin distribución por almacén</p>
                        </div>
                      ) : (
                        <div className="grid gap-4">
                          {warehouseStock.map((warehouse) => (
                            <div
                              key={warehouse.warehouseId}
                              className={cn(
                                'p-4 rounded-xl border transition-colors',
                                theme === 'dark'
                                  ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    'p-2 rounded-lg',
                                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                                  )}>
                                    <Warehouse className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{warehouse.warehouseName}</p>
                                    <p className="text-xs text-gray-500">Código: {warehouse.warehouseCode}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-bold text-gray-900 dark:text-white">{warehouse.quantityOnHand}</p>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>Reservado: {warehouse.quantityReserved}</span>
                                    <span>|</span>
                                    <span className="text-emerald-600">Disponible: {warehouse.quantityAvailable}</span>
                                  </div>
                                </div>
                              </div>
                              {warehouse.location && (
                                <p className="mt-2 text-xs text-gray-500">Ubicación: {warehouse.location}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Suppliers Tab */}
                  {activeTab === 'suppliers' && (
                    <motion.div
                      key="suppliers"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Proveedores y Precios</h3>

                      {suppliersLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : suppliers.length === 0 ? (
                        <div className="text-center py-12">
                          <Truck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500">No hay historial de proveedores</p>
                          <p className="text-sm text-gray-400 mt-1">El historial se generará con las compras</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {suppliers.map((supplier, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                'p-4 rounded-xl border',
                                theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                              )}
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div>
                                  <p className="font-bold text-gray-900 dark:text-white">{supplier.supplierName}</p>
                                  {supplier.supplierContact && (
                                    <p className="text-sm text-gray-500">{supplier.supplierContact}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Último precio</p>
                                  <p className="text-xl font-bold text-emerald-600">{symbol}{supplier.lastPrice.toFixed(2)}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500">Precio Promedio</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{symbol}{supplier.avgPrice.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Precio Mínimo</p>
                                  <p className="font-medium text-green-600">{symbol}{supplier.minPrice.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Precio Máximo</p>
                                  <p className="font-medium text-red-600">{symbol}{supplier.maxPrice.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Total Comprado</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{supplier.totalPurchased} unidades</p>
                                </div>
                              </div>
                              {supplier.lastPurchaseDate && (
                                <p className="mt-3 text-xs text-gray-500">
                                  Última compra: {formatDate(supplier.lastPurchaseDate)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* History Tab */}
                  {activeTab === 'history' && (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {historyLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <>
                          {/* Change Logs */}
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Historial de Cambios</h3>
                            {changeLogs.length === 0 ? (
                              <div className="text-center py-8">
                                <Clock className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                                <p className="text-gray-500">No hay cambios registrados</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {changeLogs.map((log) => (
                                  <div
                                    key={log.id}
                                    className={cn(
                                      'p-4 rounded-xl border',
                                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                                    )}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{log.actionLabel}</p>
                                        {log.fieldLabel && (
                                          <p className="text-sm text-gray-500">
                                            Campo: <span className="font-medium">{log.fieldLabel}</span>
                                          </p>
                                        )}
                                        {log.oldValue && log.newValue && (
                                          <p className="text-sm text-gray-500 mt-1">
                                            <span className="text-red-500 line-through">{log.oldValue}</span>
                                            {' → '}
                                            <span className="text-green-500">{log.newValue}</span>
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right text-xs text-gray-500">
                                        <p>{formatDate(log.createdAt)}</p>
                                        {log.userName && <p className="mt-1">Por: {log.userName}</p>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Inventory Movements */}
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Movimientos de Inventario</h3>
                            {movements.length === 0 ? (
                              <div className="text-center py-8">
                                <Package className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                                <p className="text-gray-500">No hay movimientos registrados</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {movements.map((movement) => (
                                  <div
                                    key={movement.id}
                                    className={cn(
                                      'p-4 rounded-xl border flex items-center justify-between',
                                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        'p-2 rounded-lg',
                                        movement.quantity > 0
                                          ? (theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100')
                                          : (theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100')
                                      )}>
                                        {movement.quantity > 0 ? (
                                          <ChevronUp className="w-5 h-5 text-green-600" />
                                        ) : (
                                          <ChevronDown className="w-5 h-5 text-red-600" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{movement.typeLabel}</p>
                                        {movement.notes && (
                                          <p className="text-sm text-gray-500">{movement.notes}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className={cn(
                                        'text-lg font-bold',
                                        movement.quantity > 0 ? 'text-green-600' : 'text-red-600'
                                      )}>
                                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {movement.quantityBefore} → {movement.quantityAfter}
                                      </p>
                                      <p className="text-xs text-gray-400 mt-1">{formatDate(movement.createdAt)}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
