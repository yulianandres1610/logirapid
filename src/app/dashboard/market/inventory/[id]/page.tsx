'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Edit,
  Printer,
  TrendingUp,
  TrendingDown,
  Warehouse,
  Truck,
  History,
  BarChart3,
  Calendar,
  DollarSign,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Barcode,
  Image as ImageIcon,
  Tag,
  Scale,
  ChevronRight
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Product {
  id: number
  name: string
  description: string | null
  imageUrl: string | null
  category: string | null
  costPrice: number
  sellingPrice: number
  currency: string
  sku: string | null
  barcode: string | null
  supplierName: string | null
  supplierContact: string | null
  supplierReference: string | null
  quantityOnHand: number
  minimumStock: number
  isActive: boolean
  unitOfMeasure: string
  createdAt: string
  updatedAt: string
}

interface SalesData {
  week: { total: number; quantity: number; trend: number }
  month: { total: number; quantity: number; trend: number }
  year: { total: number; quantity: number; trend: number }
  chartData: { date: string; quantity: number; revenue: number }[]
}

interface WarehouseStock {
  warehouseId: number
  warehouseName: string
  warehouseCode: string
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  lastMovementAt: string | null
}

interface SupplierPrice {
  supplierId: number
  supplierName: string
  supplierContact: string | null
  price: number
  currency: string
  lastPurchaseDate: string | null
  minOrderQuantity: number
  leadTimeDays: number
}

interface ChangeLog {
  id: number
  action: string
  field: string
  oldValue: string | null
  newValue: string | null
  userId: number
  userName: string
  createdAt: string
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

const UNITS_OF_MEASURE: Record<string, string> = {
  unidad: 'Unidad',
  kg: 'Kilogramo',
  lb: 'Libra',
  g: 'Gramo',
  oz: 'Onza',
  lt: 'Litro',
  gal: 'Galón',
  ml: 'Mililitro',
  docena: 'Docena',
  caja: 'Caja',
  paquete: 'Paquete',
  par: 'Par',
  metro: 'Metro',
  yarda: 'Yarda'
}

export default function ProductDetailPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<Product | null>(null)
  const [salesData, setSalesData] = useState<SalesData | null>(null)
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[]>([])
  const [suppliers, setSuppliers] = useState<SupplierPrice[]>([])
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'stock' | 'suppliers' | 'history'>('overview')

  useEffect(() => {
    fetchProductDetails()
  }, [productId])

  const fetchProductDetails = async () => {
    setLoading(true)
    try {
      // Fetch product basic info
      const productRes = await fetch(`/api/market/products/${productId}`)
      if (productRes.ok) {
        const productData = await productRes.json()
        if (productData.success) {
          setProduct(productData.data)
        }
      }

      // Fetch sales data
      const salesRes = await fetch(`/api/market/products/${productId}/sales`)
      if (salesRes.ok) {
        const salesDataRes = await salesRes.json()
        if (salesDataRes.success) {
          setSalesData(salesDataRes.data)
        }
      }

      // Fetch warehouse stock
      const stockRes = await fetch(`/api/market/products/${productId}/stock`)
      if (stockRes.ok) {
        const stockData = await stockRes.json()
        if (stockData.success) {
          setWarehouseStock(stockData.data)
        }
      }

      // Fetch suppliers
      const suppliersRes = await fetch(`/api/market/products/${productId}/suppliers`)
      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json()
        if (suppliersData.success) {
          setSuppliers(suppliersData.data)
        }
      }

      // Fetch change logs
      const logsRes = await fetch(`/api/market/products/${productId}/logs`)
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        if (logsData.success) {
          setChangeLogs(logsData.data)
        }
      }
    } catch (error) {
      console.error('Error fetching product details:', error)
    } finally {
      setLoading(false)
    }
  }

  const printBarcodeLabel = () => {
    if (!product) return
    const printWindow = window.open('', '_blank', 'width=400,height=300')
    if (!printWindow) return

    const symbol = CURRENCY_SYMBOLS[product.currency] || '$'

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta - ${product.name}</title>
        <style>
          @page { size: 50mm 30mm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; width: 50mm; height: 30mm; padding: 2mm; display: flex; flex-direction: column; justify-content: space-between; }
          .product-name { font-size: 8pt; font-weight: bold; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .barcode-container { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .barcode { font-family: 'Libre Barcode EAN13 Text', monospace; font-size: 24pt; }
          .barcode-number { font-size: 7pt; font-family: monospace; margin-top: 1mm; }
          .price { font-size: 10pt; font-weight: bold; text-align: center; }
          .sku { font-size: 6pt; text-align: center; color: #666; }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+EAN13+Text&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="product-name">${product.name}</div>
        <div class="barcode-container">
          ${product.barcode ? `<div class="barcode">${product.barcode}</div><div class="barcode-number">${product.barcode}</div>` : `<div class="sku">SKU: ${product.sku}</div>`}
        </div>
        <div class="price">${symbol}${product.sellingPrice.toFixed(2)}</div>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }

  const getMargin = () => {
    if (!product || product.costPrice === 0) return 0
    return Math.round(((product.sellingPrice - product.costPrice) / product.costPrice) * 100)
  }

  const getTotalStock = () => {
    return warehouseStock.reduce((sum, w) => sum + w.quantityOnHand, 0)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!product) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Producto no encontrado</h2>
              <Link href="/dashboard/market/inventory" className="text-emerald-500 hover:underline mt-2 inline-block">
                Volver al inventario
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const symbol = CURRENCY_SYMBOLS[product.currency] || '$'
  const margin = getMargin()

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen py-6 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <Link
                  href="/dashboard/market/inventory"
                  className={cn(
                    "p-2 rounded-xl transition-colors mt-1",
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-5 h-5 text-gray-500" />
                </Link>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg border',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
                    <div className="flex items-center gap-3 mt-1">
                      {product.category && (
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                        )}>
                          {product.category}
                        </span>
                      )}
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        product.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        SKU: {product.sku || 'N/A'}
                      </span>
                      {product.barcode && (
                        <span className="flex items-center gap-1">
                          <Barcode className="w-4 h-4" />
                          {product.barcode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={printBarcodeLabel}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                  )}
                >
                  <Printer className="w-5 h-5" />
                  Imprimir Etiqueta
                </motion.button>
                <Link href={`/dashboard/market/inventory/${product.id}/edit`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    <Edit className="w-5 h-5" />
                    Editar
                  </motion.button>
                </Link>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Precio de Venta */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-5 rounded-2xl border shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'p-2 rounded-lg',
                    theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50'
                  )}>
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="text-sm text-gray-500">Precio Venta</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {symbol}{product.sellingPrice.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Costo: {symbol}{product.costPrice.toFixed(2)}
                </p>
              </motion.div>

              {/* Margen */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'p-5 rounded-2xl border shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'p-2 rounded-lg',
                    margin >= 30 ? 'bg-green-100 dark:bg-green-900/30' : margin >= 15 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'
                  )}>
                    <TrendingUp className={cn(
                      'w-5 h-5',
                      margin >= 30 ? 'text-green-500' : margin >= 15 ? 'text-amber-500' : 'text-red-500'
                    )} />
                  </div>
                  <span className="text-sm text-gray-500">Margen</span>
                </div>
                <p className={cn(
                  'text-2xl font-bold',
                  margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'
                )}>
                  {margin}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Ganancia: {symbol}{(product.sellingPrice - product.costPrice).toFixed(2)}
                </p>
              </motion.div>

              {/* Stock Total */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-5 rounded-2xl border shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'p-2 rounded-lg',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                  )}>
                    <Package className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-sm text-gray-500">Stock Total</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {product.quantityOnHand} {UNITS_OF_MEASURE[product.unitOfMeasure]?.toLowerCase() || product.unitOfMeasure}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo: {product.minimumStock}
                </p>
              </motion.div>

              {/* Almacenes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-5 rounded-2xl border shadow-lg',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn(
                    'p-2 rounded-lg',
                    theme === 'dark' ? 'bg-violet-900/30' : 'bg-violet-50'
                  )}>
                    <Warehouse className="w-5 h-5 text-violet-500" />
                  </div>
                  <span className="text-sm text-gray-500">Almacenes</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {warehouseStock.length}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  con stock disponible
                </p>
              </motion.div>
            </div>

            {/* Tabs */}
            <div className={cn(
              'flex gap-1 p-1 rounded-xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              {[
                { id: 'overview', label: 'Resumen', icon: BarChart3 },
                { id: 'stock', label: 'Stock por Almacén', icon: Warehouse },
                { id: 'suppliers', label: 'Proveedores', icon: Truck },
                { id: 'history', label: 'Historial', icon: History }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                    activeTab === tab.id
                      ? theme === 'dark'
                        ? 'bg-gray-700 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border shadow-lg p-6',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    Ritmo de Ventas
                  </h3>

                  {salesData ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Esta Semana */}
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">Esta Semana</span>
                          <div className={cn(
                            'flex items-center gap-1 text-xs font-medium',
                            salesData.week.trend >= 0 ? 'text-green-500' : 'text-red-500'
                          )}>
                            {salesData.week.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(salesData.week.trend)}%
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {salesData.week.quantity} uds
                        </p>
                        <p className="text-sm text-gray-500">{symbol}{salesData.week.total.toFixed(2)}</p>
                      </div>

                      {/* Este Mes */}
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">Este Mes</span>
                          <div className={cn(
                            'flex items-center gap-1 text-xs font-medium',
                            salesData.month.trend >= 0 ? 'text-green-500' : 'text-red-500'
                          )}>
                            {salesData.month.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(salesData.month.trend)}%
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {salesData.month.quantity} uds
                        </p>
                        <p className="text-sm text-gray-500">{symbol}{salesData.month.total.toFixed(2)}</p>
                      </div>

                      {/* Este Año */}
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">Este Año</span>
                          <div className={cn(
                            'flex items-center gap-1 text-xs font-medium',
                            salesData.year.trend >= 0 ? 'text-green-500' : 'text-red-500'
                          )}>
                            {salesData.year.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(salesData.year.trend)}%
                          </div>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {salesData.year.quantity} uds
                        </p>
                        <p className="text-sm text-gray-500">{symbol}{salesData.year.total.toFixed(2)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay datos de ventas disponibles</p>
                    </div>
                  )}

                  {/* Product Description */}
                  {product.description && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Descripción</h4>
                      <p className="text-gray-700 dark:text-gray-300">{product.description}</p>
                    </div>
                  )}

                  {/* Supplier Info */}
                  {product.supplierName && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Proveedor Principal</h4>
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <p className="font-medium text-gray-900 dark:text-white">{product.supplierName}</p>
                        {product.supplierContact && (
                          <p className="text-sm text-gray-500 mt-1">{product.supplierContact}</p>
                        )}
                        {product.supplierReference && (
                          <p className="text-xs text-gray-400 mt-1">Ref: {product.supplierReference}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stock Tab */}
              {activeTab === 'stock' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-violet-500" />
                    Stock por Almacén
                  </h3>

                  {warehouseStock.length > 0 ? (
                    <div className="space-y-3">
                      {warehouseStock.map(warehouse => (
                        <div
                          key={warehouse.warehouseId}
                          className={cn(
                            'p-4 rounded-xl border flex items-center justify-between',
                            theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              'p-3 rounded-xl',
                              theme === 'dark' ? 'bg-violet-900/30' : 'bg-violet-50'
                            )}>
                              <Warehouse className="w-6 h-6 text-violet-500" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{warehouse.warehouseName}</p>
                              <p className="text-sm text-gray-500">Código: {warehouse.warehouseCode}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                              {warehouse.quantityOnHand}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-green-500">Disponible: {warehouse.quantityAvailable}</span>
                              {warehouse.quantityReserved > 0 && (
                                <span className="text-amber-500">Reservado: {warehouse.quantityReserved}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay stock registrado en almacenes</p>
                      <p className="text-sm mt-1">El stock actual del producto es: {product.quantityOnHand}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Suppliers Tab */}
              {activeTab === 'suppliers' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-5 h-5 text-amber-500" />
                    Proveedores
                  </h3>

                  {suppliers.length > 0 ? (
                    <div className="space-y-3">
                      {suppliers.map(supplier => (
                        <div
                          key={supplier.supplierId}
                          className={cn(
                            'p-4 rounded-xl border',
                            theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                'p-3 rounded-xl',
                                theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50'
                              )}>
                                <Truck className="w-6 h-6 text-amber-500" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{supplier.supplierName}</p>
                                {supplier.supplierContact && (
                                  <p className="text-sm text-gray-500">{supplier.supplierContact}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-emerald-600">
                                {CURRENCY_SYMBOLS[supplier.currency] || '$'}{supplier.price.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">por unidad</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                            <span>Min. orden: {supplier.minOrderQuantity} uds</span>
                            <span>Tiempo entrega: {supplier.leadTimeDays} días</span>
                            {supplier.lastPurchaseDate && (
                              <span>Última compra: {format(new Date(supplier.lastPurchaseDate), 'dd/MM/yyyy', { locale: es })}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay proveedores registrados para este producto</p>
                      {product.supplierName && (
                        <p className="text-sm mt-2">
                          Proveedor principal: <span className="font-medium">{product.supplierName}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-500" />
                    Historial de Cambios
                  </h3>

                  {changeLogs.length > 0 ? (
                    <div className="space-y-3">
                      {changeLogs.map((log, index) => (
                        <div
                          key={log.id}
                          className={cn(
                            'flex gap-4',
                            index !== changeLogs.length - 1 && 'pb-4 border-b border-gray-200 dark:border-gray-700'
                          )}
                        >
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                            log.action === 'create' ? 'bg-green-100 dark:bg-green-900/30' :
                            log.action === 'update' ? 'bg-blue-100 dark:bg-blue-900/30' :
                            'bg-red-100 dark:bg-red-900/30'
                          )}>
                            {log.action === 'create' ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : log.action === 'update' ? (
                              <Edit className="w-5 h-5 text-blue-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {log.action === 'create' ? 'Producto creado' :
                                 log.action === 'update' ? `Campo "${log.field}" actualizado` :
                                 'Producto eliminado'}
                              </p>
                              <span className="text-xs text-gray-500">
                                {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                              </span>
                            </div>
                            {log.action === 'update' && (
                              <div className="mt-1 text-sm">
                                <span className="text-gray-500">De:</span>
                                <span className="mx-1 text-red-500 line-through">{log.oldValue || 'vacío'}</span>
                                <span className="text-gray-500">A:</span>
                                <span className="mx-1 text-green-500">{log.newValue || 'vacío'}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                              <User className="w-3 h-3" />
                              {log.userName}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay historial de cambios disponible</p>
                      <div className="mt-4 text-sm">
                        <p>Creado: {format(new Date(product.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                        <p>Última actualización: {format(new Date(product.updatedAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
