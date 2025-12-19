'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Warehouse,
  TrendingUp,
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
  History,
  Calendar,
  Archive,
  Globe,
  ExternalLink,
  Tag,
  Scale,
  Trash2,
  Edit3
} from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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

interface ProductCreationDetails {
  name: string
  category: string | null
  costPrice: number
  sellingPrice: number
  currency: string
  sku: string
  barcode: string
  unitOfMeasure: string
  supplierName: string | null
  minimumStock: number
}

interface ChangeLog {
  id: number
  action: string
  actionLabel: string
  fieldName: string | null
  fieldLabel: string | null
  oldValue: string | null
  newValue: string | null
  productDetails: ProductCreationDetails | null
  notes: string | null
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

interface ProductLot {
  id: number
  lotNumber: string
  expirationDate: string | null
  manufacturingDate: string | null
  quantity: number
  quantityAvailable: number
  notes: string | null
  purchaseNumber: string | null
  purchaseDate: string | null
  supplierName: string | null
  isActive: boolean
  createdAt: string
}

type TabType = 'overview' | 'stock' | 'lots' | 'suppliers' | 'history'

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Resumen', icon: TrendingUp },
  { id: 'stock', label: 'Stock por Almacén', icon: Warehouse },
  { id: 'lots', label: 'Lotes', icon: Archive },
  { id: 'suppliers', label: 'Proveedores', icon: Truck },
  { id: 'history', label: 'Historial', icon: History }
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
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
  const [lots, setLots] = useState<ProductLot[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)

  useEffect(() => {
    fetchProduct()
  }, [productId])

  useEffect(() => {
    if (product) {
      if (activeTab === 'overview') {
        fetchSalesData()
      } else if (activeTab === 'stock') {
        fetchWarehouseStock()
      } else if (activeTab === 'lots') {
        fetchLots()
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

  const fetchLots = async () => {
    setLotsLoading(true)
    try {
      const response = await fetch(`/api/market/products/${productId}/lots`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setLots(data.data.lots || [])
        }
      }
    } catch (error) {
      console.error('Error fetching lots:', error)
    } finally {
      setLotsLoading(false)
    }
  }

  const getDaysUntilExpiration = (expirationDate: string | null) => {
    if (!expirationDate) return null
    const exp = new Date(expirationDate)
    const today = new Date()
    const diffTime = exp.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getLotExpirationStatus = (expirationDate: string | null) => {
    const days = getDaysUntilExpiration(expirationDate)
    if (days === null) return { status: 'unknown', color: 'gray', label: 'Sin fecha' }
    if (days < 0) return { status: 'expired', color: 'red', label: 'Vencido' }
    if (days <= 7) return { status: 'critical', color: 'orange', label: 'Crítico' }
    if (days <= 30) return { status: 'warning', color: 'amber', label: 'Próximo' }
    return { status: 'good', color: 'green', label: 'Vigente' }
  }

  const getActiveLots = () => lots.filter(l => l.isActive && l.quantityAvailable > 0)
  const getExpiredLots = () => lots.filter(l => {
    const days = getDaysUntilExpiration(l.expirationDate)
    return days !== null && days < 0
  })
  const getCriticalLots = () => lots.filter(l => {
    const days = getDaysUntilExpiration(l.expirationDate)
    return days !== null && days >= 0 && days <= 7
  })

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
    const printWindow = window.open('', '_blank', 'width=400,height=200')
    if (!printWindow) return
    const symbol = CURRENCY_SYMBOLS[p.currency] || '$'
    const priceWhole = Math.floor(p.sellingPrice)
    const priceDecimal = Math.round((p.sellingPrice - priceWhole) * 100).toString().padStart(2, '0')

    // Label size: 3.54" x 1.57" = 90mm x 40mm (optimized for thermal printers)
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta - ${p.name}</title>
        <style>
          @page {
            size: 90mm 40mm;
            margin: 0;
          }
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Libre+Barcode+EAN13+Text&display=swap');

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: 'Inter', Arial, sans-serif;
            width: 90mm;
            height: 40mm;
            background: #ffffff;
            position: relative;
            overflow: hidden;
          }

          .label-container {
            width: 100%;
            height: 100%;
            padding: 2mm;
            display: flex;
            flex-direction: column;
          }

          /* Top section - Name, SKU and Price */
          .top-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 2mm;
            flex: 1;
          }

          /* Left - Product info */
          .info-section {
            flex: 1;
            min-width: 0;
          }

          /* Product name */
          .product-name {
            font-size: 11pt;
            font-weight: 800;
            color: #000000;
            text-align: left;
            line-height: 1.1;
            max-height: 9mm;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            text-transform: uppercase;
            letter-spacing: -0.02em;
          }

          /* SKU line */
          .sku-line {
            font-size: 7pt;
            font-weight: 600;
            color: #6b7280;
            font-family: 'Courier New', monospace;
            letter-spacing: 0.03em;
            margin-top: 1mm;
          }

          /* Right - Price box */
          .price-box {
            background: #000000;
            border-radius: 1.5mm;
            padding: 1.5mm 3mm;
            text-align: center;
            min-width: 22mm;
          }

          .price-main {
            display: flex;
            align-items: flex-start;
            justify-content: center;
          }

          .currency-symbol {
            font-size: 10pt;
            font-weight: 700;
            color: #ffffff;
            margin-right: 0.3mm;
          }

          .price-whole {
            font-size: 18pt;
            font-weight: 900;
            color: #ffffff;
            line-height: 1;
            letter-spacing: -0.03em;
          }

          .price-decimal {
            font-size: 9pt;
            font-weight: 800;
            color: #ffffff;
            margin-top: 0.5mm;
          }

          .unit-label {
            font-size: 5pt;
            color: #9ca3af;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 0.5mm;
          }

          /* Bottom - Barcode spanning full width */
          .barcode-section {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-top: 0.3mm solid #e5e7eb;
            padding-top: 1.5mm;
            margin-top: 1mm;
          }

          .barcode {
            font-family: 'Libre Barcode EAN13 Text', monospace;
            font-size: 36pt;
            letter-spacing: 0;
            color: #000000;
            line-height: 0.85;
            width: 100%;
            text-align: center;
          }

          .barcode-number {
            font-size: 7pt;
            font-family: 'Courier New', monospace;
            color: #374151;
            letter-spacing: 0.25em;
            font-weight: 600;
            text-align: center;
          }

          /* Thermal printer optimizations */
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .price-box {
              background: #000000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="label-container">
          <div class="top-section">
            <div class="info-section">
              <div class="product-name">${p.name}</div>
              <div class="sku-line">SKU: ${p.sku}</div>
            </div>

            <div class="price-box">
              <div class="price-main">
                <span class="currency-symbol">${symbol}</span>
                <span class="price-whole">${priceWhole}</span>
                <span class="price-decimal">.${priceDecimal}</span>
              </div>
              <div class="unit-label">${p.unitOfMeasure || 'UNIDAD'}</div>
            </div>
          </div>

          <div class="barcode-section">
            ${p.barcode
              ? `<div class="barcode">${p.barcode}</div>
                 <div class="barcode-number">${p.barcode}</div>`
              : `<div class="barcode-number">SIN CÓDIGO DE BARRAS</div>`
            }
          </div>
        </div>
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
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{symbol}{Number(product.costPrice).toFixed(2)}</p>
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
                    <p className="text-lg font-bold text-emerald-600">{symbol}{Number(product.sellingPrice).toFixed(2)}</p>
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

            {/* Web Preview Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className={cn(
                'px-6 py-4 flex items-center justify-between border-b',
                theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              )}>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Vista Previa Web</h3>
                </div>
                <span className="text-xs text-gray-500">Así se verá en la tienda online</span>
              </div>
              <div className="p-6">
                <div className="max-w-md mx-auto">
                  {/* Product Card Preview */}
                  <div className={cn(
                    'rounded-2xl border overflow-hidden transition-transform hover:scale-[1.02]',
                    theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200 shadow-lg'
                  )}>
                    {/* Product Image */}
                    <div className="aspect-square relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-20 h-20 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                      {/* Category Badge */}
                      {product.category && (
                        <span className={cn(
                          'absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm',
                          theme === 'dark'
                            ? 'bg-gray-900/70 text-gray-200 border border-gray-700'
                            : 'bg-white/80 text-gray-700 border border-gray-200'
                        )}>
                          <Tag className="w-3 h-3 inline mr-1" />
                          {product.category}
                        </span>
                      )}
                      {/* Stock Badge */}
                      <span className={cn(
                        'absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium',
                        status.color === 'green' && 'bg-green-500 text-white',
                        status.color === 'amber' && 'bg-amber-500 text-white',
                        status.color === 'red' && 'bg-red-500 text-white'
                      )}>
                        {status.label}
                      </span>
                    </div>

                    {/* Product Info */}
                    <div className="p-5 space-y-4">
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2">
                          {product.name}
                        </h4>
                        {product.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                      </div>

                      {/* Price & Unit */}
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-emerald-600">
                              {symbol}{Number(product.sellingPrice).toFixed(2)}
                            </span>
                            <span className="text-sm text-gray-400">/ {product.unitOfMeasure}</span>
                          </div>
                          {product.costPrice > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400 line-through">
                                {symbol}{(Number(product.sellingPrice) * 1.15).toFixed(2)}
                              </span>
                              <span className="text-xs font-medium text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                                -15%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Scale className="w-4 h-4" />
                          {product.quantityOnHand} disponibles
                        </div>
                      </div>

                      {/* Add to Cart Button (Preview) */}
                      <button className={cn(
                        'w-full py-3 px-4 rounded-xl font-semibold text-white transition-all',
                        status.color === 'red'
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25'
                      )} disabled={status.color === 'red'}>
                        {status.color === 'red' ? 'Sin Stock' : 'Añadir al Carrito'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

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
                              <p className="text-2xl font-bold text-emerald-600">{symbol}{Number(getTotalRevenue()).toFixed(2)}</p>
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
                                    <td className="py-3 px-4 text-sm text-right font-medium text-emerald-600">{symbol}{Number(sale.revenue).toFixed(2)}</td>
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

                  {/* Lots Tab */}
                  {activeTab === 'lots' && (
                    <motion.div
                      key="lots"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Lotes y Fechas de Vencimiento</h3>
                        {lots.length > 0 && (
                          <div className="flex items-center gap-3">
                            {getActiveLots().length > 0 && (
                              <div className={cn(
                                'px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm',
                                theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                              )}>
                                <CheckCircle className="w-4 h-4" />
                                {getActiveLots().length} activos
                              </div>
                            )}
                            {getCriticalLots().length > 0 && (
                              <div className={cn(
                                'px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm',
                                theme === 'dark' ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-700'
                              )}>
                                <AlertTriangle className="w-4 h-4" />
                                {getCriticalLots().length} por vencer
                              </div>
                            )}
                            {getExpiredLots().length > 0 && (
                              <div className={cn(
                                'px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm',
                                theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                              )}>
                                <AlertCircle className="w-4 h-4" />
                                {getExpiredLots().length} vencidos
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {lotsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : lots.length === 0 ? (
                        <div className="text-center py-12">
                          <Archive className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 font-medium">No hay lotes registrados</p>
                          <p className="text-sm text-gray-400 mt-1">Los lotes se crean al recibir compras de proveedores</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {lots.map((lot, idx) => {
                            const expStatus = getLotExpirationStatus(lot.expirationDate)
                            const daysLeft = getDaysUntilExpiration(lot.expirationDate)

                            return (
                              <motion.div
                                key={lot.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className={cn(
                                  'p-4 rounded-xl border relative overflow-hidden',
                                  theme === 'dark'
                                    ? 'bg-gray-700/50 border-gray-600'
                                    : 'bg-white border-gray-200 shadow-sm'
                                )}
                              >
                                {/* Status bar */}
                                <div className={cn(
                                  'absolute left-0 top-0 bottom-0 w-1',
                                  expStatus.color === 'green' && 'bg-green-500',
                                  expStatus.color === 'amber' && 'bg-amber-500',
                                  expStatus.color === 'orange' && 'bg-orange-500',
                                  expStatus.color === 'red' && 'bg-red-500',
                                  expStatus.color === 'gray' && (theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300')
                                )} />

                                <div className="pl-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                                    {/* Número de lote */}
                                    <div>
                                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Lote</p>
                                      <p className="font-mono font-bold text-gray-900 dark:text-white">{lot.lotNumber}</p>
                                    </div>

                                    {/* Fecha de vencimiento */}
                                    <div>
                                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vencimiento</p>
                                      <div className="flex items-center gap-2">
                                        <p className={cn(
                                          'font-medium',
                                          expStatus.color === 'green' && 'text-green-600',
                                          expStatus.color === 'amber' && 'text-amber-600',
                                          expStatus.color === 'orange' && 'text-orange-600',
                                          expStatus.color === 'red' && 'text-red-600',
                                          expStatus.color === 'gray' && 'text-gray-500'
                                        )}>
                                          {lot.expirationDate
                                            ? new Date(lot.expirationDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                                            : 'Sin fecha'
                                          }
                                        </p>
                                        {expStatus.status === 'expired' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                        {expStatus.status === 'critical' && <Clock className="w-4 h-4 text-orange-500 animate-pulse" />}
                                      </div>
                                      {daysLeft !== null && (
                                        <p className={cn(
                                          'text-xs mt-0.5',
                                          daysLeft < 0 ? 'text-red-500' :
                                          daysLeft <= 7 ? 'text-orange-500' :
                                          daysLeft <= 30 ? 'text-amber-500' :
                                          'text-gray-400'
                                        )}>
                                          {daysLeft < 0
                                            ? `Vencido hace ${Math.abs(daysLeft)} días`
                                            : daysLeft === 0
                                              ? 'Vence hoy'
                                              : `${daysLeft} días restantes`
                                          }
                                        </p>
                                      )}
                                    </div>

                                    {/* Cantidad */}
                                    <div>
                                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cantidad</p>
                                      <p className="font-bold text-gray-900 dark:text-white">
                                        {lot.quantityAvailable} <span className="font-normal text-gray-500">/ {lot.quantity}</span>
                                      </p>
                                      <p className="text-xs text-gray-400">{product?.unitOfMeasure || 'unidad'}</p>
                                    </div>

                                    {/* Proveedor */}
                                    <div>
                                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Proveedor</p>
                                      {lot.supplierName ? (
                                        <p className="font-medium text-gray-900 dark:text-white">{lot.supplierName}</p>
                                      ) : (
                                        <p className="text-gray-400 italic">—</p>
                                      )}
                                      {lot.purchaseNumber && (
                                        <p className="text-xs text-gray-400">#{lot.purchaseNumber}</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Estado */}
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      'px-3 py-1.5 rounded-full text-xs font-medium',
                                      expStatus.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                      expStatus.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                      expStatus.color === 'orange' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                                      expStatus.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                      expStatus.color === 'gray' && 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                    )}>
                                      {expStatus.label}
                                    </span>
                                  </div>
                                </div>

                                {/* Notas y fechas adicionales */}
                                {(lot.notes || lot.manufacturingDate) && (
                                  <div className="pl-4 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                      {lot.manufacturingDate && (
                                        <span>Fabricación: {new Date(lot.manufacturingDate).toLocaleDateString('es-ES')}</span>
                                      )}
                                      {lot.purchaseDate && (
                                        <span>Compra: {new Date(lot.purchaseDate).toLocaleDateString('es-ES')}</span>
                                      )}
                                    </div>
                                    {lot.notes && (
                                      <p className="text-sm text-gray-500 italic mt-1">{lot.notes}</p>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            )
                          })}
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
                                  <p className="text-xl font-bold text-emerald-600">{symbol}{Number(supplier.lastPrice).toFixed(2)}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                  <p className="text-xs text-gray-500">Precio Promedio</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{symbol}{Number(supplier.avgPrice).toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Precio Mínimo</p>
                                  <p className="font-medium text-green-600">{symbol}{Number(supplier.minPrice).toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Precio Máximo</p>
                                  <p className="font-medium text-red-600">{symbol}{Number(supplier.maxPrice).toFixed(2)}</p>
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
                              <div className="space-y-4">
                                {changeLogs.map((log) => (
                                  <div
                                    key={log.id}
                                    className={cn(
                                      'rounded-2xl border overflow-hidden',
                                      log.action === 'created'
                                        ? (theme === 'dark' ? 'bg-emerald-900/20 border-emerald-800' : 'bg-emerald-50 border-emerald-200')
                                        : (theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')
                                    )}
                                  >
                                    {/* Header with user and date - PROMINENT */}
                                    <div className={cn(
                                      'px-4 py-3 border-b flex items-center justify-between',
                                      log.action === 'created'
                                        ? (theme === 'dark' ? 'bg-emerald-900/30 border-emerald-700' : 'bg-emerald-100/50 border-emerald-200')
                                        : (theme === 'dark' ? 'bg-gray-800/50 border-gray-600' : 'bg-gray-100/50 border-gray-200')
                                    )}>
                                      <div className="flex items-center gap-3">
                                        {/* User Avatar */}
                                        <div className={cn(
                                          'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm',
                                          log.action === 'created'
                                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                                            : 'bg-gradient-to-br from-blue-500 to-blue-600'
                                        )}>
                                          {log.userName ? log.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'US'}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-gray-900 dark:text-white">
                                            {log.userName || 'Usuario desconocido'}
                                          </p>
                                          <p className="text-xs text-gray-500">{log.userEmail || ''}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                          {formatDate(log.createdAt)}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Action Content */}
                                    <div className="p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        {log.action === 'created' && (
                                          <div className={cn(
                                            'p-2 rounded-lg',
                                            theme === 'dark' ? 'bg-emerald-900/50' : 'bg-emerald-100'
                                          )}>
                                            <Package className="w-5 h-5 text-emerald-600" />
                                          </div>
                                        )}
                                        {log.action === 'updated' && (
                                          <div className={cn(
                                            'p-2 rounded-lg',
                                            theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                                          )}>
                                            <Edit3 className="w-5 h-5 text-blue-600" />
                                          </div>
                                        )}
                                        {log.action === 'deleted' && (
                                          <div className={cn(
                                            'p-2 rounded-lg',
                                            theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
                                          )}>
                                            <Trash2 className="w-5 h-5 text-red-600" />
                                          </div>
                                        )}
                                        <div>
                                          <p className={cn(
                                            'font-bold text-lg',
                                            log.action === 'created'
                                              ? 'text-emerald-700 dark:text-emerald-400'
                                              : log.action === 'deleted'
                                              ? 'text-red-700 dark:text-red-400'
                                              : 'text-gray-900 dark:text-white'
                                          )}>
                                            {log.actionLabel}
                                          </p>
                                        </div>
                                      </div>

                                      {/* Show creation details */}
                                      {log.action === 'created' && log.productDetails && (
                                        <div className={cn(
                                          'p-4 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 text-sm',
                                          theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/80 border border-gray-100'
                                        )}>
                                          <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">SKU</p>
                                            <p className="font-mono font-semibold text-gray-900 dark:text-white">{log.productDetails.sku}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Categoría</p>
                                            <p className="font-semibold text-gray-900 dark:text-white">{log.productDetails.category || '—'}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Precio Costo</p>
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                              {CURRENCY_SYMBOLS[log.productDetails.currency] || '$'}{Number(log.productDetails.costPrice).toFixed(2)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Precio Venta</p>
                                            <p className="font-bold text-emerald-600 text-lg">
                                              {CURRENCY_SYMBOLS[log.productDetails.currency] || '$'}{Number(log.productDetails.sellingPrice).toFixed(2)}
                                            </p>
                                          </div>
                                          {log.productDetails.supplierName && (
                                            <div className="col-span-2">
                                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Proveedor</p>
                                              <p className="font-semibold text-gray-900 dark:text-white">{log.productDetails.supplierName}</p>
                                            </div>
                                          )}
                                          <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Unidad</p>
                                            <p className="font-semibold text-gray-900 dark:text-white">{log.productDetails.unitOfMeasure}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Stock Mín.</p>
                                            <p className="font-semibold text-gray-900 dark:text-white">{log.productDetails.minimumStock}</p>
                                          </div>
                                        </div>
                                      )}

                                      {/* Show notes for creation */}
                                      {log.notes && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 italic">
                                          {log.notes}
                                        </p>
                                      )}

                                      {/* Show field changes for updates */}
                                      {log.action !== 'created' && log.fieldLabel && (
                                        <div className="mt-2">
                                          <p className="text-sm text-gray-500">
                                            Campo modificado: <span className="font-semibold text-gray-900 dark:text-white">{log.fieldLabel}</span>
                                          </p>
                                        </div>
                                      )}
                                      {log.action !== 'created' && log.oldValue && log.newValue && (
                                        <div className="mt-2 flex items-center gap-2">
                                          <span className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm line-through">
                                            {log.oldValue}
                                          </span>
                                          <span className="text-gray-400">→</span>
                                          <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium">
                                            {log.newValue}
                                          </span>
                                        </div>
                                      )}
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
