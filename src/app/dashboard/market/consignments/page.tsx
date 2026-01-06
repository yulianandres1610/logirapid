'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Plus,
  Search,
  Clock,
  CheckCircle,
  DollarSign,
  RotateCcw,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Building2,
  Calendar,
  Truck,
  Warehouse,
  FileText,
  TrendingUp,
  Printer,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Supplier {
  id: number
  code: string
  name: string
}

interface WarehouseInfo {
  id: number
  code: string
  name: string
}

interface ConsignmentOrder {
  id: number
  orderNumber: string
  supplier: Supplier
  warehouse: WarehouseInfo
  status: string
  totalItems: number
  totalUnits: number
  totalCost: number
  totalSold: number
  totalPaid: number
  totalReturned: number
  consignmentDate: string
  receivedAt: string | null
  completedAt: string | null
  notes: string | null
  createdBy: string
  createdAt: string
}

interface Stats {
  pending: { count: number; totalCost: number }
  received: { count: number; totalCost: number }
  selling: { count: number; totalCost: number; totalSold: number }
  paid: { count: number; totalPaid: number }
  returned: { count: number }
  liquidated: { count: number }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface PrintService {
  id: number
  serviceName: string
  printers: Array<{
    id: number
    printerName: string
    isOnline: boolean
    isDefault: boolean
    printerType: string
  }>
}

interface OrderLine {
  productName: string
  sku: string
  barcode: string | null
  quantity: number
  unitCost: number
  totalCost: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; gradient: string }> = {
  pending: { label: 'Pendiente', color: 'amber', icon: Clock, gradient: 'from-amber-400 to-orange-600' },
  received: { label: 'Recibida', color: 'blue', icon: Truck, gradient: 'from-blue-400 to-blue-600' },
  selling: { label: 'En Venta', color: 'emerald', icon: TrendingUp, gradient: 'from-emerald-400 to-green-600' },
  paid: { label: 'Pagada', color: 'purple', icon: DollarSign, gradient: 'from-purple-400 to-purple-600' },
  returned: { label: 'Devuelta', color: 'red', icon: RotateCcw, gradient: 'from-red-400 to-rose-600' },
  liquidated: { label: 'Liquidada', color: 'gray', icon: CheckCircle, gradient: 'from-gray-400 to-gray-600' }
}

export default function ConsignmentsPage() {
  const { theme } = useTheme()
  const [orders, setOrders] = useState<ConsignmentOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([])
  const [stats, setStats] = useState<Stats>({
    pending: { count: 0, totalCost: 0 },
    received: { count: 0, totalCost: 0 },
    selling: { count: 0, totalCost: 0, totalSold: 0 },
    paid: { count: 0, totalPaid: 0 },
    returned: { count: 0 },
    liquidated: { count: 0 }
  })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<ConsignmentOrder | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printOrder, setPrintOrder] = useState<ConsignmentOrder | null>(null)
  const [printServices, setPrintServices] = useState<PrintService[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<{ serviceId: number; printerId: number } | null>(null)
  const [printingWithService, setPrintingWithService] = useState(false)
  const [copies, setCopies] = useState(1)
  const [loadingOrderLines, setLoadingOrderLines] = useState(false)
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])

  useEffect(() => {
    fetchOrders()
    fetchSuppliers()
    fetchWarehouses()
  }, [pagination.page, selectedStatus, selectedSupplier, selectedWarehouse])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (pagination.page === 1) {
        fetchOrders()
      } else {
        setPagination(p => ({ ...p, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (search) params.set('search', search)
      if (selectedStatus) params.set('status', selectedStatus)
      if (selectedSupplier) params.set('supplierId', selectedSupplier)
      if (selectedWarehouse) params.set('warehouseId', selectedWarehouse)

      const response = await fetch(`/api/consignments/orders?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrders(data.data.orders)
          setStats(data.data.stats)
          setPagination(data.data.pagination)
          setLastUpdated(new Date())
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/consignments/suppliers?limit=100')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSuppliers(data.data.suppliers)
        }
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/market/warehouses')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setWarehouses(data.data.warehouses || data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const handleManualRefresh = () => fetchOrders(true)

  const getTotalCount = () => {
    return stats.pending.count + stats.received.count + stats.selling.count +
           stats.paid.count + stats.returned.count + stats.liquidated.count
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Print functions
  const fetchPrintServices = async () => {
    try {
      const response = await fetch('/api/print/services?includeOffline=false')
      const data = await response.json()
      if (data.success && data.data?.services) {
        // Filter services to only include thermal printers for consignment receipts
        const activeServices = data.data.services
          .filter((s: { status: string; printers?: unknown[] }) => s.status === 'active' && s.printers && s.printers.length > 0)
          .map((service: PrintService) => ({
            ...service,
            // Only keep thermal printers (80mm receipt printers)
            printers: service.printers.filter((p: { printerType: string }) => p.printerType === 'thermal_80mm')
          }))
          .filter((s: PrintService) => s.printers.length > 0) // Remove services with no thermal printers

        setPrintServices(activeServices)

        // Auto-select first available thermal printer
        for (const service of activeServices) {
          const availablePrinter = service.printers.find((p: { isOnline: boolean }) => p.isOnline)
          if (availablePrinter) {
            setSelectedPrinter({ serviceId: service.id, printerId: availablePrinter.id })
            break
          }
        }
      }
    } catch (err) {
      console.error('[Print] Error fetching print services:', err)
    }
  }

  const fetchOrderLines = async (orderId: number) => {
    setLoadingOrderLines(true)
    try {
      const response = await fetch(`/api/consignments/orders/${orderId}`)
      const data = await response.json()
      if (data.success && data.data?.lines) {
        setOrderLines(data.data.lines.map((l: { product: { name: string; sku: string; barcode: string | null }; quantityOrdered: number; unitCost: number }) => ({
          productName: l.product.name,
          sku: l.product.sku,
          barcode: l.product.barcode,
          quantity: l.quantityOrdered,
          unitCost: l.unitCost,
          totalCost: l.quantityOrdered * l.unitCost
        })))
      }
    } catch (err) {
      console.error('[Print] Error fetching order lines:', err)
    } finally {
      setLoadingOrderLines(false)
    }
  }

  const handlePrintOrder = (order: ConsignmentOrder) => {
    setPrintOrder(order)
    setShowPrintModal(true)
    setCopies(1)
    fetchPrintServices()
    fetchOrderLines(order.id)
  }

  const printWithSilentService = async () => {
    if (!printOrder || !selectedPrinter || orderLines.length === 0) return

    setPrintingWithService(true)
    try {
      const response = await fetch('/api/print/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'consignment_receipt',
          documentData: {
            orderNumber: printOrder.orderNumber,
            supplier: {
              code: printOrder.supplier.code,
              name: printOrder.supplier.name
            },
            warehouse: {
              code: printOrder.warehouse.code,
              name: printOrder.warehouse.name
            },
            lines: orderLines,
            totalItems: printOrder.totalItems,
            totalUnits: printOrder.totalUnits,
            totalCost: printOrder.totalCost,
            consignmentDate: printOrder.consignmentDate || printOrder.createdAt,
            notes: printOrder.notes || undefined
          },
          copies,
          printServiceId: selectedPrinter.serviceId,
          printerId: selectedPrinter.printerId,
          sourceType: 'consignment_order',
          sourceId: printOrder.id,
          warehouseId: printOrder.warehouse.id
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowPrintModal(false)
        setPrintOrder(null)
        setOrderLines([])
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('[Print] Error printing:', err)
    } finally {
      setPrintingWithService(false)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Ordenes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => setSelectedStatus(null)}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  selectedStatus === null && 'ring-2 ring-blue-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-800/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                      )}>
                        <Package className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Total Ordenes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{getTotalCount()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Pendientes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setSelectedStatus(selectedStatus === 'pending' ? null : 'pending')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  selectedStatus === 'pending' && 'ring-2 ring-amber-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-amber-900/30 border border-amber-800/50'
                          : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                      )}>
                        <Clock className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Pendientes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.pending.count}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Valor: {formatCurrency(stats.pending.totalCost)}</span>
                  </div>
                </div>
              </motion.div>

              {/* En Venta */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => setSelectedStatus(selectedStatus === 'selling' ? null : 'selling')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  selectedStatus === 'selling' && 'ring-2 ring-emerald-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-emerald-900/30 border border-emerald-800/50'
                          : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                      )}>
                        <TrendingUp className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>En Venta</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.selling.count}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Vendido: {formatCurrency(stats.selling.totalSold || 0)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Pagadas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => setSelectedStatus(selectedStatus === 'paid' ? null : 'paid')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  selectedStatus === 'paid' && 'ring-2 ring-purple-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-purple-900/30 border border-purple-800/50'
                          : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                      )}>
                        <DollarSign className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Pagadas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.paid.count}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Total: {formatCurrency(stats.paid.totalPaid || 0)}</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-4 rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por orden o proveedor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                {/* Supplier Filter */}
                <select
                  value={selectedSupplier || ''}
                  onChange={(e) => setSelectedSupplier(e.target.value || null)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Todos los proveedores</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>

                {/* Warehouse Filter */}
                <select
                  value={selectedWarehouse || ''}
                  onChange={(e) => setSelectedWarehouse(e.target.value || null)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Todos los almacenes</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>

                {/* Clear Filters */}
                {(search || selectedStatus || selectedSupplier || selectedWarehouse) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearch('')
                      setSelectedStatus(null)
                      setSelectedSupplier(null)
                      setSelectedWarehouse(null)
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </motion.button>
                )}

                {/* Refresh */}
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualRefresh}
                    disabled={loading || isRefreshing}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      isRefreshing && 'opacity-75'
                    )}
                  >
                    <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
                  </motion.button>
                </div>

                {/* Nueva Orden */}
                <Link href="/dashboard/market/consignments/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Orden
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Orders Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'border-b',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider"># Orden</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Proveedor</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Almacen</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Costo Total</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Vendido</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={9} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center">
                          <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay ordenes de consignacion</p>
                          <Link href="/dashboard/market/consignments/create">
                            <button className="mt-3 text-sm text-emerald-500 hover:text-emerald-600">
                              Crear primera orden
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      orders.map((order, index) => {
                        const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
                        const StatusIcon = statusConfig.icon

                        return (
                          <motion.tr
                            key={order.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={cn(
                              'group transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                <span className="font-mono font-medium text-gray-900 dark:text-white">
                                  {order.orderNumber}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                                  theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                                )}>
                                  {order.supplier.code}
                                </div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">{order.supplier.name}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <Warehouse className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600 dark:text-gray-300">{order.warehouse.name}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {order.totalItems} / {order.totalUnits}
                              </span>
                              <p className="text-xs text-gray-500">items / uds</p>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {formatCurrency(order.totalCost)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className={cn(
                                'text-sm font-bold',
                                order.totalSold > 0 ? 'text-emerald-600' : 'text-gray-400'
                              )}>
                                {formatCurrency(order.totalSold)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                  {formatDate(order.consignmentDate || order.createdAt)}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium',
                                statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                statusConfig.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                                statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                                statusConfig.color === 'purple' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                                statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                              )}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handlePrintOrder(order)}
                                  className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                  title="Imprimir recepcion"
                                >
                                  <Printer className="w-4 h-4 text-emerald-500" />
                                </motion.button>
                                <Link href={`/dashboard/market/consignments/${order.id}`}>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    title="Ver detalle"
                                  >
                                    <Eye className="w-4 h-4 text-blue-500" />
                                  </motion.button>
                                </Link>
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className={cn(
                  'flex items-center justify-between px-4 py-3 border-t',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page === 1}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </motion.button>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Print Modal */}
          <AnimatePresence>
            {showPrintModal && printOrder && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    setShowPrintModal(false)
                    setPrintOrder(null)
                    setOrderLines([])
                  }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={cn(
                      "px-6 py-4 border-b flex items-center justify-between",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Printer className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            Imprimir Recepcion
                          </h3>
                          <p className="text-xs text-gray-500">#{printOrder.orderNumber}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowPrintModal(false)
                          setPrintOrder(null)
                          setOrderLines([])
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      {(printServices.length === 0 || loadingOrderLines) ? (
                        <div className="text-center py-4">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
                          <p className="text-gray-500">
                            {loadingOrderLines ? 'Cargando datos...' : 'Buscando impresoras...'}
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Order Summary */}
                          <div className={cn(
                            "p-4 rounded-xl",
                            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                          )}>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-500">Proveedor</span>
                              <span className="font-medium text-gray-900 dark:text-white">{printOrder.supplier.name}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm text-gray-500">Almacen</span>
                              <span className="font-medium text-gray-900 dark:text-white">{printOrder.warehouse.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-500">Productos</span>
                              <span className="font-medium text-gray-900 dark:text-white">{orderLines.length} items</span>
                            </div>
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Seleccionar Impresora
                            </label>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {printServices.map(service => (
                                service.printers.map(printer => (
                                  <button
                                    key={`${service.id}-${printer.id}`}
                                    onClick={() => setSelectedPrinter({ serviceId: service.id, printerId: printer.id })}
                                    className={cn(
                                      'w-full p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between',
                                      selectedPrinter?.printerId === printer.id
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                        : theme === 'dark'
                                          ? 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Printer className={cn(
                                        "w-5 h-5",
                                        selectedPrinter?.printerId === printer.id ? 'text-emerald-600' : 'text-gray-400'
                                      )} />
                                      <div>
                                        <p className={cn(
                                          "font-medium",
                                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        )}>
                                          {printer.printerName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {printer.printerType === 'thermal_80mm' ? 'Termica 80mm' : 'Estandar'}
                                        </p>
                                      </div>
                                    </div>
                                    {printer.isOnline ? (
                                      <span className="text-xs text-emerald-500 font-medium">Online</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">Offline</span>
                                    )}
                                  </button>
                                ))
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Copias
                            </label>
                            <div className="flex items-center justify-center gap-4">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCopies(Math.max(1, copies - 1))}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                                  theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                )}
                              >
                                -
                              </motion.button>
                              <span className={cn(
                                "w-12 text-center text-xl font-bold",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {copies}
                              </span>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCopies(Math.min(5, copies + 1))}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                                  theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                )}
                              >
                                +
                              </motion.button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {printServices.length > 0 && !loadingOrderLines && (
                      <div className={cn(
                        "flex gap-3 p-6 pt-4 border-t",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setShowPrintModal(false)
                            setPrintOrder(null)
                            setOrderLines([])
                          }}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-medium transition-all",
                            theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          )}
                        >
                          Cancelar
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={printWithSilentService}
                          disabled={printingWithService || !selectedPrinter || orderLines.length === 0}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                            "bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                          )}
                        >
                          {printingWithService ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Printer className="w-5 h-5" />
                              Imprimir
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
