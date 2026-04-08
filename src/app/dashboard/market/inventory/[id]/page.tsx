'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
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
  Tag,
  Scale,
  Edit3,
  User,
  Box,
  Percent,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  Repeat,
  ClipboardCheck,
  ExternalLink,
  Settings,
  Trash2,
  Factory,
  Download,
  Facebook,
  Instagram
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { PrintLabelModal } from '@/components/print/PrintLabelModal'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'
import JsBarcode from 'jsbarcode'

interface VariantOption {
  type: string
  value: string
}

interface Variant {
  id: number
  name: string
  sku: string
  barcode: string
  costPrice: number
  sellingPrice: number
  quantityOnHand: number
  imageUrl: string | null
  isActive: boolean
  options?: VariantOption[]
}

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
  variants?: Variant[]
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

interface VariantStock {
  variantId: number
  variantName: string
  variantSku: string
  variantBarcode: string | null
  totalOnHand: number
  totalReserved: number
  totalAvailable: number
  byWarehouse: Array<{
    warehouseId: number
    warehouseName: string
    quantityOnHand: number
    quantityReserved: number
    quantityAvailable: number
  }>
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
  purchaseId: number | null
  purchaseNumber: string | null
  purchaseDate: string | null
  supplierName: string | null
  warehouseName: string | null
  unitCost: number
  source: 'consignment' | 'purchase' | 'production' | 'manual'
  isActive: boolean
  createdAt: string
}

interface InventoryMovementHistory {
  id: string
  type: string
  typeLabel: string
  date: string
  quantity: number
  direction: 'in' | 'out'
  reference: string
  referenceId: number
  warehouseName: string | null
  sourceWarehouse: string | null
  destWarehouse: string | null
  userName: string | null
  status: string
  notes: string | null
  stockAfter: Record<string, number> | null
}

interface MovementSummary {
  totalIn: number
  totalOut: number
  purchaseCount: number
  saleCount: number
  transferCount: number
  auditCount: number
  adjustmentCount: number
  scrapCount: number
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '$',
  EUR: '€',
  MLC: '$'
}

const STATUS_CONFIG: Record<string, {
  label: string
  color: string
  bgGradient: string
  icon: React.ElementType
}> = {
  in_stock: {
    label: 'En Stock',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-teal-500',
    icon: CheckCircle
  },
  low_stock: {
    label: 'Stock Bajo',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-500',
    icon: AlertTriangle
  },
  out_of_stock: {
    label: 'Sin Stock',
    color: 'red',
    bgGradient: 'from-red-500 to-rose-500',
    icon: AlertCircle
  }
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  const { theme } = useTheme()
  const { USD_CUP, USD_MLC } = useMarketExchangeRates()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [prevProductId, setPrevProductId] = useState<number | null>(null)
  const [nextProductId, setNextProductId] = useState<number | null>(null)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [totalProducts, setTotalProducts] = useState<number>(0)
  const [navLoading, setNavLoading] = useState(false)
  const [salesPeriod, setSalesPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [salesSummary, setSalesSummary] = useState<{
    totalQuantity: number
    totalRevenue: number
    totalOrders: number
    salesVelocity: number
    avgOrderValue: number
  } | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[]>([])
  const [variantStock, setVariantStock] = useState<VariantStock[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(false)
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [lots, setLots] = useState<ProductLot[]>([])
  const [lotsLoading, setLotsLoading] = useState(false)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printVariant, setPrintVariant] = useState<Variant | null>(null)
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovementHistory[]>([])
  const [movementSummary, setMovementSummary] = useState<MovementSummary | null>(null)
  const [currentWarehouseStock, setCurrentWarehouseStock] = useState<Record<string, { onHand: number; reserved: number }>>({})
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [generatingImage, setGeneratingImage] = useState<string | null>(null)

  const [showImageModal, setShowImageModal] = useState(false)
  const [imageProgress, setImageProgress] = useState(0)
  const [imageProgressText, setImageProgressText] = useState('')

  const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise(resolve => {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })
  }

  const generateSocialImage = async (platform: 'facebook' | 'instagram') => {
    if (!product) return
    setGeneratingImage(platform)
    setShowImageModal(true)
    setImageProgress(0)
    setImageProgressText('Preparando diseño...')

    const price = Number(product.sellingPrice) || 0
    const priceCUP = Math.round(price * USD_CUP)
    const w = platform === 'facebook' ? 940 : 1080
    const h = platform === 'facebook' ? 788 : 1350
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    const isFB = platform === 'facebook'
    const cx = w / 2

    // ── Load template image as background ──
    const templateUrl = isFB ? '/images/template-facebook.png' : '/images/template-instagram.png'
    const templateImg = await loadImage(templateUrl)
    if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, w, h)
    } else {
      // White fallback if template not found
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }

    setImageProgress(20)
    setImageProgressText('Cargando producto...')

    // ── Product image (centered in white area of template) ──
    const footH = isFB ? 65 : 80
    const topArea = isFB ? 160 : 280
    const availH = h - footH - topArea
    const imgS = Math.min(isFB ? 320 : 420, availH * 0.55)
    const imgX = (w - imgS) / 2
    const imgCenterY = topArea + availH * 0.35
    const imgY = imgCenterY - imgS / 2

    if (product.imageUrl) {
      const img = await loadImage(product.imageUrl)
      if (img) {
        const sc = Math.min(imgS / img.naturalWidth, imgS / img.naturalHeight)
        const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc
        ctx.drawImage(img, imgX + (imgS - dw) / 2, imgY + (imgS - dh) / 2, dw, dh)
      }
    }

    setImageProgress(50)
    setImageProgressText('Agregando precios...')

    // ── Product name ──
    let ty = imgY + imgS + (isFB ? 20 : 30)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#111827'
    const fs = isFB ? 28 : 36
    ctx.font = `bold ${fs}px Arial, sans-serif`
    const nameWords = product.name.split(' ')
    let ln = ''
    for (const wd of nameWords) {
      const test = ln + wd + ' '
      if (ctx.measureText(test).width > w - 200 && ln) {
        ctx.fillText(ln.trim(), cx, ty); ty += fs + 6; ln = wd + ' '
      } else ln = test
    }
    ctx.fillText(ln.trim(), cx, ty)
    ty += isFB ? 40 : 55

    // ── CUP Price (big) ──
    ctx.fillStyle = '#f97316'
    ctx.font = `bold ${isFB ? 58 : 72}px Arial, sans-serif`
    ctx.fillText(`${priceCUP.toLocaleString('es-ES')} CUP`, cx, ty)
    ty += isFB ? 38 : 50

    // ── USD Price ──
    ctx.fillStyle = '#6b7280'
    ctx.font = `${isFB ? 24 : 30}px Arial, sans-serif`
    ctx.fillText(`$${price.toFixed(2)} USD`, cx, ty)

    setImageProgress(90)
    setImageProgressText('Finalizando...')
    ctx.textAlign = 'left'

    setImageProgress(100)
    setImageProgressText('Descargando...')

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${product.name.replace(/[^a-zA-Z0-9]/g, '-')}-${platform}.png`
      a.click()
      URL.revokeObjectURL(url)
      setTimeout(() => { setGeneratingImage(null); setShowImageModal(false); setImageProgress(0) }, 500)
    }, 'image/png')
  }

  // Collapsible sections
  const [showVariants, setShowVariants] = useState(true)
  const [showStock, setShowStock] = useState(true)
  const [showLots, setShowLots] = useState(true)
  const [showSuppliers, setShowSuppliers] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [showMovements, setShowMovements] = useState(true)

  useEffect(() => {
    fetchProduct()
    fetchAdjacentProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  // Fetch all data when product loads
  useEffect(() => {
    if (product) {
      fetchSalesData()
      fetchWarehouseStock()
      fetchLots()
      fetchSuppliers()
      fetchHistory()
      fetchInventoryMovements()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, salesPeriod])

  const fetchAdjacentProducts = async () => {
    try {
      const response = await fetch(`/api/market/products/${productId}/adjacent`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPrevProductId(data.data.prevId)
          setNextProductId(data.data.nextId)
          setCurrentIndex(data.data.currentIndex || 0)
          setTotalProducts(data.data.total || 0)
        }
      }
    } catch (error) {
      console.error('Error fetching adjacent products:', error)
    }
  }

  const navigateToProduct = (id: number | null) => {
    if (id) {
      setNavLoading(true)
      router.push(`/dashboard/market/inventory/${id}`)
    }
  }

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
          setSalesSummary(data.data.summary || null)
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
          setVariantStock(data.data.variantStock || [])
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

  const fetchInventoryMovements = async () => {
    setMovementsLoading(true)
    try {
      const response = await fetch(`/api/market/products/${productId}/movements`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setInventoryMovements(data.data.movements || [])
          setMovementSummary(data.data.summary || null)
          setCurrentWarehouseStock(data.data.currentStock || {})
        }
      }
    } catch (error) {
      console.error('Error fetching inventory movements:', error)
    } finally {
      setMovementsLoading(false)
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
      return 'out_of_stock'
    }
    if (p.quantityOnHand <= p.minimumStock) {
      return 'low_stock'
    }
    return 'in_stock'
  }

  const getMargin = (p: Product) => {
    if (p.costPrice === 0) return 0
    return Math.round(((Number(p.sellingPrice) - Number(p.costPrice)) / Number(p.costPrice)) * 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTotalSales = () => salesData.reduce((acc, d) => acc + d.quantity, 0)
  const getTotalRevenue = () => salesData.reduce((acc, d) => acc + d.revenue, 0)
  const getTotalOrders = () => salesData.reduce((acc, d) => acc + d.orders, 0)
  const getTotalWarehouseStock = () => warehouseStock.reduce((acc, w) => acc + w.quantityOnHand, 0)

  const formatNumber = (num: number) => {
    return Number(num) % 1 === 0 ? num : Number(num).toFixed(2)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="text-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
              <p className="text-gray-500">Cargando detalles del producto...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!product) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6">
            <div className={cn(
              'max-w-xl mx-auto text-center p-8 rounded-2xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-lg'
            )}>
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
              )}>
                <Package className="w-8 h-8 text-red-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Producto no encontrado
              </h2>
              <p className="text-gray-500 mb-6">No pudimos cargar los detalles de este producto.</p>
              <Link href="/dashboard/market/inventory">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inventario
                </motion.button>
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const stockStatus = getStockStatus(product)
  const statusConfig = STATUS_CONFIG[stockStatus]
  const StatusIcon = statusConfig.icon
  const margin = getMargin(product)
  const symbol = CURRENCY_SYMBOLS[product.currency] || '$'

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {/* Header Section */}
          <div className="max-w-6xl mx-auto mb-8">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Link href="/dashboard/market/inventory">
                  <motion.button
                    whileHover={{ scale: 1.02, x: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="font-medium">Volver</span>
                  </motion.button>
                </Link>

                {/* Navigation buttons */}
                <div className="flex items-center gap-1">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigateToProduct(prevProductId)}
                    disabled={!prevProductId || navLoading}
                    className={cn(
                      'flex items-center gap-1 px-3 py-2 rounded-xl transition-colors',
                      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600',
                      prevProductId && !navLoading
                        ? (theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200')
                        : 'opacity-50 cursor-not-allowed'
                    )}
                    title="Producto anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </motion.button>

                  {totalProducts > 0 && (
                    <span className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium',
                      theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                    )}>
                      {currentIndex} / {totalProducts}
                    </span>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigateToProduct(nextProductId)}
                    disabled={!nextProductId || navLoading}
                    className={cn(
                      'flex items-center gap-1 px-3 py-2 rounded-xl transition-colors',
                      theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600',
                      nextProductId && !navLoading
                        ? (theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200')
                        : 'opacity-50 cursor-not-allowed'
                    )}
                    title="Producto siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPrintModal(true)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Printer className="w-4 h-4" />
                  <span className="font-medium hidden sm:inline">Imprimir</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => generateSocialImage('facebook')}
                  disabled={generatingImage === 'facebook'}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  )}
                  title="Descargar imagen para Facebook (940x788)"
                >
                  {generatingImage === 'facebook' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Facebook className="w-4 h-4" />}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => generateSocialImage('instagram')}
                  disabled={generatingImage === 'instagram'}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-pink-900/30 text-pink-400 hover:bg-pink-900/50'
                      : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
                  )}
                  title="Descargar imagen para Instagram (1080x1350)"
                >
                  {generatingImage === 'instagram' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
                </motion.button>
                <Link href={`/dashboard/market/inventory/${product.id}/edit`}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25 font-medium"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="hidden sm:inline">Editar</span>
                  </motion.button>
                </Link>
              </div>
            </div>

            {/* Product Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3">
                {/* Product Image - Large Square */}
                <div className={cn(
                  'aspect-square lg:aspect-auto lg:h-full relative overflow-hidden',
                  `bg-gradient-to-br ${statusConfig.bgGradient}`
                )}>
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center min-h-[280px]">
                      <Package className="w-24 h-24 text-white/80" />
                    </div>
                  )}
                  {/* Status Badge on Image */}
                  <span className={cn(
                    'absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg',
                    statusConfig.color === 'emerald' && 'bg-emerald-500 text-white',
                    statusConfig.color === 'amber' && 'bg-amber-500 text-white',
                    statusConfig.color === 'red' && 'bg-red-500 text-white'
                  )}>
                    <StatusIcon className="w-4 h-4" />
                    {statusConfig.label}
                  </span>
                  {/* Category Badge */}
                  {product.category && (
                    <span className={cn(
                      'absolute top-4 right-4 px-3 py-1.5 rounded-lg text-sm font-medium backdrop-blur-sm shadow-lg',
                      theme === 'dark' ? 'bg-black/50 text-white' : 'bg-white/90 text-gray-700'
                    )}>
                      {product.category}
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="lg:col-span-2 p-6 flex flex-col">
                  {/* Title and Description */}
                  <div className="mb-4">
                    <h1 className={cn(
                      'text-2xl md:text-3xl font-bold mb-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {product.name}
                    </h1>
                    {product.description && (
                      <p className="text-gray-500 line-clamp-2">{product.description}</p>
                    )}
                  </div>

                  {/* SKU and Barcode */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap mb-4">
                    <span className={cn(
                      'flex items-center gap-1.5 font-mono px-3 py-1.5 rounded-lg',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Barcode className="w-4 h-4" />
                      SKU: {product.sku}
                    </span>
                    {product.barcode && (
                      <span className={cn(
                        'flex items-center gap-1.5 font-mono px-3 py-1.5 rounded-lg',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        {product.barcode}
                      </span>
                    )}
                    <span className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Scale className="w-4 h-4" />
                      {product.unitOfMeasure}
                    </span>
                  </div>

                  {/* Visual Barcode */}
                  {product.barcode && (
                    <div className={cn(
                      'mb-6 inline-flex items-center rounded-xl px-4 py-2.5 border',
                      theme === 'dark' ? 'bg-white border-gray-600' : 'bg-white border-gray-200'
                    )}>
                      <svg
                        ref={(node) => {
                          if (node && product.barcode) {
                            try {
                              JsBarcode(node, product.barcode, {
                                format: 'CODE128',
                                width: 1.5,
                                height: 40,
                                displayValue: true,
                                fontSize: 12,
                                fontOptions: 'bold',
                                font: 'monospace',
                                margin: 0,
                                background: 'transparent',
                                lineColor: '#000000',
                              })
                            } catch { /* invalid barcode format, ignore */ }
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Price Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-auto">
                    {/* Selling Price - Highlighted */}
                    <div className={cn(
                      'p-4 rounded-xl col-span-2 md:col-span-1',
                      'bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border-2 border-emerald-500/30'
                    )}>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Precio Venta</p>
                      <p className="text-lg sm:text-xl font-bold text-emerald-600 font-mono break-all">{symbol}{product.sellingPrice}</p>
                      <div className="mt-2 pt-2 border-t border-emerald-200/30 dark:border-emerald-800/30 space-y-0.5">
                        <p className="text-xs text-blue-600 font-medium">${Math.round(product.sellingPrice * USD_CUP).toLocaleString('es-ES')} CUP</p>
                        <p className="text-xs text-purple-600 font-medium">${(Number(product.sellingPrice) * USD_MLC).toFixed(2)} MLC</p>
                      </div>
                    </div>

                    {/* Cost Price */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Precio Costo</p>
                      <p className={cn(
                        'text-lg sm:text-xl font-bold font-mono break-all',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{symbol}{product.costPrice}</p>
                      <p className="text-xs text-blue-600 mt-1">${Math.round(product.costPrice * USD_CUP).toLocaleString('es-ES')} CUP</p>
                    </div>

                    {/* Margin */}
                    <div className={cn(
                      'p-4 rounded-xl',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Margen</p>
                      <p className={cn(
                        'text-2xl font-bold flex items-center gap-1',
                        margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'
                      )}>
                        <TrendingUp className="w-5 h-5" />
                        {margin}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1 break-all">{symbol}{(Number(product.sellingPrice) - Number(product.costPrice)).toFixed(10).replace(/0+$/, '').replace(/\.$/, '')} ganancia</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Content */}
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Stock Total',
                  value: formatNumber(product.quantityOnHand),
                  icon: Box,
                  color: stockStatus === 'in_stock' ? 'emerald' : stockStatus === 'low_stock' ? 'amber' : 'red',
                  suffix: product.unitOfMeasure,
                  subtext: `Mín: ${formatNumber(product.minimumStock)}`
                },
                {
                  label: 'Precio Costo',
                  value: `${symbol}${Number(product.costPrice).toFixed(2)}`,
                  icon: DollarSign,
                  color: 'blue',
                  subtext: `$${Math.round(product.costPrice * USD_CUP).toLocaleString('es-ES')} CUP`
                },
                {
                  label: 'Margen',
                  value: `${margin}%`,
                  icon: Percent,
                  color: margin >= 30 ? 'emerald' : margin >= 15 ? 'amber' : 'red',
                  subtext: `${symbol}${(Number(product.sellingPrice) - Number(product.costPrice)).toFixed(2)} ganancia`
                },
                {
                  label: 'Velocidad',
                  value: salesSummary?.salesVelocity ? `${salesSummary.salesVelocity}` : '0',
                  icon: Activity,
                  color: 'purple',
                  suffix: `${product.unitOfMeasure}/día`,
                  subtext: salesLoading ? 'Cargando...' : `${getTotalSales()} vendidas`
                }
              ].map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border relative overflow-hidden group',
                    theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                  )}
                >
                  <div className={cn(
                    'absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 group-hover:opacity-20 transition-opacity',
                    stat.color === 'emerald' && 'bg-emerald-500',
                    stat.color === 'blue' && 'bg-blue-500',
                    stat.color === 'amber' && 'bg-amber-500',
                    stat.color === 'red' && 'bg-red-500',
                    stat.color === 'purple' && 'bg-purple-500'
                  )} />

                  <div className="relative">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                      stat.color === 'emerald' && (theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'),
                      stat.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'),
                      stat.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/50 text-amber-400' : 'bg-amber-100 text-amber-600'),
                      stat.color === 'red' && (theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600'),
                      stat.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-600')
                    )}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                    <p className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {stat.value}
                      {stat.suffix && <span className="text-sm font-normal text-gray-500 ml-1">{stat.suffix}</span>}
                    </p>
                    {stat.subtext && (
                      <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Supplier Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <Truck className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className={cn(
                    'font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Proveedor Principal</h3>
                </div>

                {product.supplierName ? (
                  <div className="space-y-3">
                    <p className={cn(
                      'font-semibold text-lg',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>{product.supplierName}</p>

                    {product.supplierContact && (
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-500">{product.supplierContact}</span>
                      </div>
                    )}

                    {suppliers.length > 0 && (
                      <div className={cn(
                        'pt-3 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <p className="text-xs text-gray-500 mb-1">Último precio</p>
                        <p className="text-xl font-bold text-emerald-600">
                          {symbol}{Number(suppliers[0].lastPrice).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sin proveedor asignado</p>
                )}
              </motion.div>

              {/* Stock Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                    )}>
                      <Warehouse className="w-5 h-5 text-purple-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Distribución Stock</h3>
                  </div>
                  <span className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium',
                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  )}>
                    {warehouseStock.length} almacenes
                  </span>
                </div>

                {stockLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : warehouseStock.length > 0 ? (
                  <div className="space-y-2">
                    {warehouseStock.slice(0, 3).map((wh) => (
                      <div key={wh.warehouseId} className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 truncate">{wh.warehouseName}</span>
                        <span className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formatNumber(wh.quantityOnHand)}
                        </span>
                      </div>
                    ))}
                    {warehouseStock.length > 3 && (
                      <p className="text-xs text-gray-500 pt-2">
                        +{warehouseStock.length - 3} más
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sin distribución por almacén</p>
                )}
              </motion.div>

              {/* Sales Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'p-6 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
                    )}>
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Ventas</h3>
                  </div>
                  <div className="flex gap-1">
                    {(['week', 'month', 'year'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setSalesPeriod(p)}
                        className={cn(
                          'px-2 py-1 rounded text-xs font-medium transition-all',
                          salesPeriod === p
                            ? 'bg-emerald-500 text-white'
                            : theme === 'dark'
                              ? 'text-gray-400 hover:text-white'
                              : 'text-gray-500 hover:text-gray-900'
                        )}
                      >
                        {p === 'week' ? '7D' : p === 'month' ? '30D' : '1A'}
                      </button>
                    ))}
                  </div>
                </div>

                {salesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Unidades</span>
                      <span className={cn(
                        'text-lg font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{getTotalSales()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Ingresos</span>
                      <span className="text-lg font-bold text-emerald-600">
                        {symbol}{Number(getTotalRevenue()).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Órdenes</span>
                      <span className={cn(
                        'text-lg font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{getTotalOrders()}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Variants Section */}
            {product.variants && product.variants.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'rounded-2xl border overflow-hidden',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <button
                  onClick={() => setShowVariants(!showVariants)}
                  className={cn(
                    'w-full px-6 py-4 flex items-center justify-between border-b',
                    theme === 'dark' ? 'border-gray-700 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-xl',
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                    )}>
                      <Package className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="text-left">
                      <h3 className={cn(
                        'font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Variantes</h3>
                      <p className="text-sm text-gray-500">{product.variants.length} variantes disponibles</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => { e.stopPropagation(); setShowPrintModal(true); }}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        theme === 'dark'
                          ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      )}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir Todas
                    </motion.button>
                    {showVariants ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                <AnimatePresence>
                  {showVariants && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-3">
                        {product.variants.map((variant, idx) => (
                          <motion.div
                            key={variant.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={cn(
                              'flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                            )}
                          >
                            {/* Variant Image */}
                            <div className={cn(
                              'w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center',
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
                            )}>
                              {variant.imageUrl ? (
                                <Image
                                  src={variant.imageUrl}
                                  alt={variant.name}
                                  width={56}
                                  height={56}
                                  className="w-full h-full object-cover"
                                />
                              ) : product.imageUrl ? (
                                <Image
                                  src={product.imageUrl}
                                  alt={variant.name}
                                  width={56}
                                  height={56}
                                  className="w-full h-full object-cover opacity-50"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                              )}
                            </div>

                            {/* Variant Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className={cn(
                                  'font-medium truncate',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{variant.name}</h4>
                                {variant.options?.map((opt, optIdx) => (
                                  <span
                                    key={optIdx}
                                    className={cn(
                                      'px-2 py-0.5 rounded-full text-[10px] font-medium uppercase',
                                      opt.type === 'color'
                                        ? 'bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 dark:from-pink-900/30 dark:to-purple-900/30 dark:text-purple-300'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                    )}
                                  >
                                    {opt.value}
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                <span className="text-xs text-gray-500 font-mono">SKU: {variant.sku}</span>
                                {variant.barcode && (
                                  <span className="text-xs text-gray-500 font-mono flex items-center gap-1">
                                    <Barcode className="w-3 h-3" />
                                    {variant.barcode}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Prices */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-emerald-600">
                                {symbol}{variant.sellingPrice}
                              </p>
                              <p className="text-xs text-gray-500">
                                Costo: {symbol}{variant.costPrice || 0}
                              </p>
                            </div>

                            {/* Print Button */}
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => { setPrintVariant(variant); setShowPrintModal(true); }}
                              className={cn(
                                'p-2.5 rounded-xl transition-all flex-shrink-0',
                                theme === 'dark'
                                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                  : 'bg-white hover:bg-gray-100 text-gray-600 shadow-sm border border-gray-200'
                              )}
                              title={`Imprimir etiqueta: ${variant.name}`}
                            >
                              <Printer className="w-4 h-4" />
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Stock by Warehouse Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <button
                onClick={() => setShowStock(!showStock)}
                className={cn(
                  'w-full px-6 py-4 flex items-center justify-between border-b',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <Warehouse className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-left">
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Stock por Almacén</h3>
                    <p className="text-sm text-gray-500">
                      Total: {formatNumber(getTotalWarehouseStock())} {product.unitOfMeasure}
                    </p>
                  </div>
                </div>
                {showStock ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              <AnimatePresence>
                {showStock && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6">
                      {stockLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : warehouseStock.length === 0 ? (
                        <div className="text-center py-8">
                          <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500">Sin distribución por almacén</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {warehouseStock.map((warehouse) => (
                            <div
                              key={warehouse.warehouseId}
                              className={cn(
                                'p-4 rounded-xl border',
                                theme === 'dark' ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{warehouse.warehouseName}</p>
                                <span className="text-xs text-gray-500 font-mono">{warehouse.warehouseCode}</span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <p className={cn(
                                  'text-2xl font-bold',
                                  warehouse.quantityOnHand === 0 ? 'text-red-500' : 'text-emerald-600'
                                )}>
                                  {formatNumber(warehouse.quantityOnHand)}
                                </p>
                                <span className="text-sm text-gray-500">{product.unitOfMeasure}</span>
                              </div>
                              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                <span>Reservado: {formatNumber(warehouse.quantityReserved)}</span>
                                <span className="text-emerald-600">Disponible: {formatNumber(warehouse.quantityAvailable)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Variant Stock */}
                      {variantStock.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <h4 className={cn(
                            'font-semibold mb-4 flex items-center gap-2',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            <Package className="w-4 h-4 text-purple-500" />
                            Stock por Variante
                          </h4>
                          <div className="grid gap-4">
                            {variantStock.map((variant) => (
                              <div
                                key={variant.variantId}
                                className={cn(
                                  'p-4 rounded-xl border',
                                  theme === 'dark' ? 'bg-purple-900/20 border-purple-800/50' : 'bg-purple-50 border-purple-200'
                                )}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className={cn(
                                      'font-medium',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>{variant.variantName}</p>
                                    <p className="text-xs text-gray-500 font-mono">SKU: {variant.variantSku}</p>
                                  </div>
                                  <p className={cn(
                                    'text-xl font-bold',
                                    variant.totalOnHand === 0 ? 'text-red-500' : 'text-purple-600'
                                  )}>
                                    {formatNumber(variant.totalOnHand)}
                                  </p>
                                </div>
                                {variant.byWarehouse.length > 0 && (
                                  <div className="flex flex-wrap gap-3 mt-2">
                                    {variant.byWarehouse.map((wh) => (
                                      <span key={wh.warehouseId} className="text-xs text-gray-500">
                                        {wh.warehouseName}: <span className="font-medium">{formatNumber(wh.quantityOnHand)}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Lots Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <button
                onClick={() => setShowLots(!showLots)}
                className={cn(
                  'w-full px-6 py-4 flex items-center justify-between border-b',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                  )}>
                    <Archive className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="text-left">
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Lotes y Vencimientos</h3>
                    <p className="text-sm text-gray-500">{lots.length} lotes registrados</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getExpiredLots().length > 0 && (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {getExpiredLots().length} vencidos
                    </span>
                  )}
                  {getCriticalLots().length > 0 && (
                    <span className="px-2 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      {getCriticalLots().length} por vencer
                    </span>
                  )}
                  {showLots ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </button>

              <AnimatePresence>
                {showLots && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6">
                      {lotsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : lots.length === 0 ? (
                        <div className="text-center py-8">
                          <Archive className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 font-medium">No hay lotes registrados</p>
                          <p className="text-sm text-gray-400 mt-1">Los lotes se crean al recibir compras</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className={cn(
                              theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                            )}>
                              <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Lote</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Vencimiento</th>
                                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Almacén</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Compra</th>
                              </tr>
                            </thead>
                            <tbody className={cn(
                              'divide-y',
                              theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'
                            )}>
                              {lots.map((lot) => {
                                const expStatus = getLotExpirationStatus(lot.expirationDate)
                                const daysLeft = getDaysUntilExpiration(lot.expirationDate)

                                return (
                                  <tr key={lot.id} className={cn(
                                    'transition-colors',
                                    theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'
                                  )}>
                                    <td className="py-3 px-4">
                                      <p className={cn(
                                        'font-mono font-medium',
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      )}>{lot.lotNumber}</p>
                                      {lot.supplierName && (
                                        <p className="text-xs text-gray-500">{lot.supplierName}</p>
                                      )}
                                    </td>
                                    <td className="py-3 px-4">
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
                                          : 'Sin fecha'}
                                      </p>
                                      {daysLeft !== null && (
                                        <p className="text-xs text-gray-500">
                                          {daysLeft < 0 ? `Hace ${Math.abs(daysLeft)} días` : daysLeft === 0 ? 'Hoy' : `${daysLeft} días`}
                                        </p>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <p className={cn(
                                        'font-bold',
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      )}>
                                        {formatNumber(lot.quantityAvailable)}
                                      </p>
                                      <p className="text-xs text-gray-500">de {formatNumber(lot.quantity)}</p>
                                    </td>
                                    <td className="py-3 px-4">
                                      <p className="text-sm text-gray-500">{lot.warehouseName || '—'}</p>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className={cn(
                                        'px-2.5 py-1 rounded-full text-xs font-medium',
                                        expStatus.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                        expStatus.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                        expStatus.color === 'orange' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                                        expStatus.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                        expStatus.color === 'gray' && 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                      )}>
                                        {expStatus.label}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {lot.purchaseId ? (
                                        <Link
                                          href={lot.source === 'consignment'
                                            ? `/dashboard/market/consignments/${lot.purchaseId}`
                                            : lot.source === 'production'
                                            ? `/dashboard/market/production/dosification/${lot.purchaseId}`
                                            : `/dashboard/market/purchases/${lot.purchaseId}`
                                          }
                                          className={cn(
                                            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                            lot.source === 'production'
                                              ? theme === 'dark'
                                                ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50'
                                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                              : theme === 'dark'
                                                ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
                                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                          )}
                                        >
                                          {lot.source === 'production' ? <Factory className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />}
                                          {lot.purchaseNumber || 'Ver'}
                                        </Link>
                                      ) : (
                                        <span className="text-xs text-gray-400">—</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Suppliers History Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <button
                onClick={() => setShowSuppliers(!showSuppliers)}
                className={cn(
                  'w-full px-6 py-4 flex items-center justify-between border-b',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-100'
                  )}>
                    <Truck className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="text-left">
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Historial de Proveedores</h3>
                    <p className="text-sm text-gray-500">{suppliers.length} proveedores</p>
                  </div>
                </div>
                {showSuppliers ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              <AnimatePresence>
                {showSuppliers && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6">
                      {suppliersLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : suppliers.length === 0 ? (
                        <div className="text-center py-8">
                          <Truck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500">No hay historial de proveedores</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {suppliers.map((supplier, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                'p-4 rounded-xl border',
                                theme === 'dark' ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'
                              )}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className={cn(
                                    'font-bold',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>{supplier.supplierName}</p>
                                  {supplier.supplierContact && (
                                    <p className="text-sm text-gray-500">{supplier.supplierContact}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">Último</p>
                                  <p className="text-xl font-bold text-emerald-600">{symbol}{Number(supplier.lastPrice).toFixed(2)}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-gray-500">Promedio</p>
                                  <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    {symbol}{Number(supplier.avgPrice).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Comprado</p>
                                  <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    {supplier.totalPurchased} uds
                                  </p>
                                </div>
                              </div>
                              {supplier.lastPurchaseDate && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Última compra: {formatDate(supplier.lastPurchaseDate)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Inventory Movements Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <button
                onClick={() => setShowMovements(!showMovements)}
                className={cn(
                  'w-full px-6 py-4 flex items-center justify-between border-b',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-cyan-900/30' : 'bg-cyan-100'
                  )}>
                    <Repeat className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div className="text-left">
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Movimientos de Inventario</h3>
                    <p className="text-sm text-gray-500">{inventoryMovements.length} movimientos</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {movementSummary && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-green-600">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {movementSummary.totalIn}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        {movementSummary.totalOut}
                      </span>
                    </div>
                  )}
                  {showMovements ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </button>

              <AnimatePresence>
                {showMovements && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6">
                      {movementsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : inventoryMovements.length === 0 ? (
                        <div className="text-center py-8">
                          <Repeat className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 font-medium">No hay movimientos registrados</p>
                          <p className="text-sm text-gray-400 mt-1">Los movimientos se registran con compras, ventas y transferencias</p>
                        </div>
                      ) : (
                        <>
                          {/* Summary Stats - Compact Horizontal */}
                          {movementSummary && (
                            <div className={cn(
                              'flex items-center gap-6 mb-6 pb-4 border-b overflow-x-auto',
                              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                            )}>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className={cn('p-1.5 rounded-lg', theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100')}>
                                  <ArrowDownRight className="w-4 h-4 text-green-500" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Entradas</p>
                                  <p className="text-lg font-bold text-green-600">+{formatNumber(movementSummary.totalIn)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className={cn('p-1.5 rounded-lg', theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100')}>
                                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Salidas</p>
                                  <p className="text-lg font-bold text-red-600">-{formatNumber(movementSummary.totalOut)}</p>
                                </div>
                              </div>
                              <div className="h-8 w-px bg-gray-600 shrink-0" />
                              {movementSummary.purchaseCount > 0 && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <ShoppingCart className="w-4 h-4 text-blue-500" />
                                  <span className="text-sm"><span className="font-semibold text-blue-500">{movementSummary.purchaseCount}</span> <span className="text-gray-500">compras</span></span>
                                </div>
                              )}
                              {movementSummary.saleCount > 0 && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Receipt className="w-4 h-4 text-emerald-500" />
                                  <span className="text-sm"><span className="font-semibold text-emerald-500">{movementSummary.saleCount}</span> <span className="text-gray-500">ventas</span></span>
                                </div>
                              )}
                              {movementSummary.transferCount > 0 && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Repeat className="w-4 h-4 text-purple-500" />
                                  <span className="text-sm"><span className="font-semibold text-purple-500">{movementSummary.transferCount}</span> <span className="text-gray-500">transferencias</span></span>
                                </div>
                              )}
                              {(movementSummary.adjustmentCount || 0) > 0 && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Settings className="w-4 h-4 text-cyan-500" />
                                  <span className="text-sm"><span className="font-semibold text-cyan-500">{movementSummary.adjustmentCount}</span> <span className="text-gray-500">ajustes</span></span>
                                </div>
                              )}
                              {(movementSummary.scrapCount || 0) > 0 && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                  <span className="text-sm"><span className="font-semibold text-red-400">{movementSummary.scrapCount}</span> <span className="text-gray-500">scrap</span></span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Current Stock by Warehouse - Compact Pills */}
                          {Object.keys(currentWarehouseStock).length > 0 && (
                            <div className="flex items-center gap-2 mb-6 flex-wrap">
                              <span className="text-xs text-gray-500 font-medium">Stock actual:</span>
                              {Object.entries(currentWarehouseStock).map(([wh, data]) => (
                                <span key={wh} className={cn(
                                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                )}>
                                  <Warehouse className="w-3 h-3 text-gray-400" />
                                  <span className="text-gray-500">{wh}:</span>
                                  <span className={data.onHand === 0 ? 'text-red-500' : 'text-emerald-600'}>
                                    {formatNumber(data.onHand)}
                                  </span>
                                  {data.reserved > 0 && (
                                    <span className="text-amber-500">({formatNumber(data.reserved)} res.)</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Movements Timeline - Grouped by Date */}
                          <div className="relative">
                            {/* Timeline line */}
                            <div className={cn(
                              'absolute left-[19px] top-0 bottom-0 w-0.5',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                            )} />

                            {/* Group movements by date */}
                            {(() => {
                              const today = new Date()
                              today.setHours(0, 0, 0, 0)
                              const yesterday = new Date(today)
                              yesterday.setDate(yesterday.getDate() - 1)
                              const weekAgo = new Date(today)
                              weekAgo.setDate(weekAgo.getDate() - 7)

                              const sortedMovements = [...inventoryMovements].sort((a, b) => {
                                const dateA = new Date(a.date).getTime()
                                const dateB = new Date(b.date).getTime()
                                return dateB - dateA
                              })

                              const grouped: { label: string; movements: typeof inventoryMovements }[] = []
                              const todayMvts: typeof inventoryMovements = []
                              const yesterdayMvts: typeof inventoryMovements = []
                              const thisWeekMvts: typeof inventoryMovements = []
                              const olderMvts: typeof inventoryMovements = []

                              sortedMovements.slice(0, 30).forEach(m => {
                                const mDate = new Date(m.date)
                                mDate.setHours(0, 0, 0, 0)
                                if (mDate.getTime() === today.getTime()) {
                                  todayMvts.push(m)
                                } else if (mDate.getTime() === yesterday.getTime()) {
                                  yesterdayMvts.push(m)
                                } else if (mDate >= weekAgo) {
                                  thisWeekMvts.push(m)
                                } else {
                                  olderMvts.push(m)
                                }
                              })

                              if (todayMvts.length > 0) grouped.push({ label: 'Hoy', movements: todayMvts })
                              if (yesterdayMvts.length > 0) grouped.push({ label: 'Ayer', movements: yesterdayMvts })
                              if (thisWeekMvts.length > 0) grouped.push({ label: 'Esta semana', movements: thisWeekMvts })
                              if (olderMvts.length > 0) grouped.push({ label: 'Anteriores', movements: olderMvts })

                              const getMovementIcon = (type: string) => {
                                switch (type) {
                                  case 'purchase': return <ShoppingCart className="w-3.5 h-3.5" />
                                  case 'sale': return <Receipt className="w-3.5 h-3.5" />
                                  case 'transfer_in':
                                  case 'transfer_out': return <Repeat className="w-3.5 h-3.5" />
                                  case 'production_in':
                                  case 'production_out': return <Factory className="w-3.5 h-3.5" />
                                  case 'audit': return <ClipboardCheck className="w-3.5 h-3.5" />
                                  case 'adjustment': return <Settings className="w-3.5 h-3.5" />
                                  case 'scrap': return <Trash2 className="w-3.5 h-3.5" />
                                  default: return <Package className="w-3.5 h-3.5" />
                                }
                              }

                              const getTimeOnly = (dateStr: string) => {
                                try {
                                  return new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                                } catch {
                                  return ''
                                }
                              }

                              const getShortDate = (dateStr: string) => {
                                try {
                                  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                                } catch {
                                  return ''
                                }
                              }

                              return grouped.map((group, groupIdx) => (
                                <div key={group.label} className={groupIdx > 0 ? 'mt-6' : ''}>
                                  {/* Group Header */}
                                  <div className="flex items-center gap-3 mb-3 relative">
                                    <div className={cn(
                                      'w-10 h-10 rounded-full flex items-center justify-center z-10 shrink-0',
                                      theme === 'dark' ? 'bg-gray-800 border-2 border-gray-600' : 'bg-white border-2 border-gray-300'
                                    )}>
                                      <Calendar className={cn('w-4 h-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                                    </div>
                                    <h4 className={cn(
                                      'text-sm font-semibold uppercase tracking-wide',
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                    )}>{group.label}</h4>
                                    <div className={cn(
                                      'flex-1 h-px',
                                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                    )} />
                                  </div>

                                  {/* Movements in Group */}
                                  <div className="space-y-2 ml-1">
                                    {group.movements.map((movement) => {
                                      const isEntry = movement.direction === 'in'
                                      return (
                                        <div
                                          key={movement.id}
                                          className={cn(
                                            'flex items-center gap-3 pl-3 py-2 rounded-lg transition-all group cursor-default',
                                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                                          )}
                                        >
                                          {/* Timeline Dot */}
                                          <div className={cn(
                                            'w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0 transition-transform group-hover:scale-110',
                                            isEntry
                                              ? theme === 'dark' ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-600'
                                              : theme === 'dark' ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-600'
                                          )}>
                                            {getMovementIcon(movement.type)}
                                          </div>

                                          {/* Content */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <span className={cn(
                                                'font-medium text-sm',
                                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                                              )}>
                                                {movement.typeLabel}
                                              </span>
                                              <span className={cn(
                                                'text-xs font-mono',
                                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                              )}>
                                                {movement.reference}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              {(movement.type === 'transfer_in' || movement.type === 'transfer_out') && movement.sourceWarehouse && movement.destWarehouse ? (
                                                <span className="text-xs text-gray-500">
                                                  {movement.sourceWarehouse} → {movement.destWarehouse}
                                                </span>
                                              ) : movement.warehouseName && (
                                                <span className="text-xs text-gray-500">
                                                  {movement.warehouseName}
                                                </span>
                                              )}
                                              {movement.userName && (
                                                <>
                                                  <span className="text-gray-600">·</span>
                                                  <span className="text-xs text-gray-500">{movement.userName}</span>
                                                </>
                                              )}
                                            </div>
                                          </div>

                                          {/* Quantity & Time */}
                                          <div className="text-right shrink-0">
                                            <p className={cn(
                                              'text-base font-bold tabular-nums',
                                              isEntry ? 'text-green-500' : 'text-red-500'
                                            )}>
                                              {isEntry ? '+' : '-'}{formatNumber(movement.quantity)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              {group.label === 'Hoy' || group.label === 'Ayer'
                                                ? getTimeOnly(movement.date)
                                                : getShortDate(movement.date)
                                              }
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))
                            })()}

                            {inventoryMovements.length > 30 && (
                              <div className="flex items-center gap-3 mt-4 ml-1 pl-3">
                                <div className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center z-10',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                )}>
                                  <span className="text-xs text-gray-500">...</span>
                                </div>
                                <p className="text-sm text-gray-500">
                                  +{inventoryMovements.length - 30} movimientos anteriores
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* History Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className={cn(
                'rounded-2xl border overflow-hidden',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'
              )}
            >
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  'w-full px-6 py-4 flex items-center justify-between border-b',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800 hover:bg-gray-700' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-xl',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                  )}>
                    <History className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="text-left">
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Historial de Actividad</h3>
                    <p className="text-sm text-gray-500">{changeLogs.length + movements.length} registros</p>
                  </div>
                </div>
                {showHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6">
                      {historyLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Change Logs Timeline */}
                          {changeLogs.length > 0 && (
                            <div>
                              <h4 className={cn(
                                'font-semibold mb-4',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>Cambios del Producto</h4>
                              <div className="relative">
                                <div className={cn(
                                  'absolute left-[17px] top-2 bottom-2 w-0.5',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                )} />
                                <div className="space-y-4">
                                  {changeLogs.slice(0, 5).map((log) => (
                                    <div key={log.id} className="flex items-start gap-4 relative">
                                      <div className={cn(
                                        'w-[35px] h-[35px] rounded-full flex items-center justify-center shrink-0 z-10',
                                        log.action === 'created'
                                          ? theme === 'dark' ? 'bg-emerald-900/50 ring-4 ring-gray-800' : 'bg-emerald-100 ring-4 ring-white'
                                          : theme === 'dark' ? 'bg-blue-900/50 ring-4 ring-gray-800' : 'bg-blue-100 ring-4 ring-white'
                                      )}>
                                        {log.action === 'created' ? (
                                          <Package className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                          <Edit3 className="w-4 h-4 text-blue-500" />
                                        )}
                                      </div>
                                      <div className="pt-1 flex-1">
                                        <p className={cn(
                                          'text-sm font-medium',
                                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        )}>{log.actionLabel}</p>
                                        {log.fieldLabel && log.action !== 'created' && (
                                          <p className="text-xs text-gray-500">
                                            {log.fieldLabel}: <span className="line-through text-red-500">{log.oldValue}</span> → <span className="text-emerald-500">{log.newValue}</span>
                                          </p>
                                        )}
                                        <p className="text-xs text-gray-500">
                                          por {log.userName || 'Usuario'} • {formatDateTime(log.createdAt)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {changeLogs.length === 0 && (
                            <div className="text-center py-8">
                              <History className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                              <p className="text-gray-500">No hay historial registrado</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </div>
        </div>

        {/* Social Image Generation Modal */}
        <AnimatePresence>
          {showImageModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={cn('w-full max-w-sm rounded-2xl p-6 shadow-2xl', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}
              >
                <div className="text-center mb-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-3">
                    {generatingImage === 'facebook' ? <Facebook className="w-7 h-7 text-white" /> : <Instagram className="w-7 h-7 text-white" />}
                  </div>
                  <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Generando imagen {generatingImage === 'facebook' ? 'Facebook' : 'Instagram'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{imageProgressText}</p>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${imageProgress}%` }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                  />
                </div>
                <p className="text-center text-xs text-gray-400">{imageProgress}%</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Print Label Modal */}
        {product && showPrintModal && (
          <PrintLabelModal
            isOpen={showPrintModal}
            onClose={() => { setShowPrintModal(false); setPrintVariant(null); }}
            productData={printVariant ? {
              productName: `${product.name} - ${printVariant.name}`,
              sku: printVariant.sku || '',
              barcode: printVariant.barcode || '',
              price: printVariant.sellingPrice || 0,
              currency: product.currency || 'USD',
              unitOfMeasure: product.unitOfMeasure || 'unidad',
              category: product.category || undefined,
              description: product.description || undefined
            } : {
              productName: product.name || 'Producto',
              sku: product.sku || '',
              barcode: product.barcode || '',
              price: product.sellingPrice || 0,
              currency: product.currency || 'USD',
              unitOfMeasure: product.unitOfMeasure || 'unidad',
              category: product.category || undefined,
              description: product.description || undefined,
              variants: product.variants?.map(v => ({
                id: v.id,
                name: v.name || '',
                barcode: v.barcode || '',
                sku: v.sku || '',
                price: v.sellingPrice || 0,
                imageUrl: v.imageUrl || undefined
              }))
            }}
            onPrintSuccess={(jobNumber) => {
              console.log('Print job created:', jobNumber)
              setPrintVariant(null)
            }}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
