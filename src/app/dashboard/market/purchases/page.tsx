'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart,
  Plus,
  Search,
  RefreshCw,
  FileText,
  CheckCircle,
  Package,
  XCircle,
  Eye,
  MoreVertical,
  Calendar,
  DollarSign,
  Truck,
  Printer
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { PrintDocumentModal } from '@/components/print/PrintDocumentModal'

interface Purchase {
  id: number
  purchaseNumber: string
  supplierName: string
  supplierContact: string | null
  totalAmount: number
  currency: string
  status: 'draft' | 'confirmed' | 'comprada' | 'pendiente' | 'received' | 'recibido' | 'cancelled'
  purchaseDate: string
  expectedDate: string | null
  createdAt: string
  lineCount: number
  totalItems: number
}

interface Stats {
  draft: number
  confirmed: number
  received: number
  cancelled: number
  totalReceivedAmount: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: FileText },
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
  comprada: { label: 'Comprada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Package },
  received: { label: 'Recibida', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Package },
  recibido: { label: 'Recibida', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Package },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle }
}

export default function MarketPurchasesPage() {
  const router = useRouter()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ draft: 0, confirmed: 0, received: 0, cancelled: 0, totalReceivedAmount: 0 })
  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [printPurchase, setPrintPurchase] = useState<Purchase | null>(null)
  const [printData, setPrintData] = useState<Record<string, unknown> | null>(null)
  const [loadingPrint, setLoadingPrint] = useState(false)

  useEffect(() => {
    fetchPurchases()
  }, [activeTab])

  // Fetch complete purchase data for printing
  const handlePrintPurchase = async (purchase: Purchase) => {
    setLoadingPrint(true)
    setPrintPurchase(purchase)
    try {
      const response = await fetch(`/api/market/purchases/${purchase.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Transform data for the print generator
          setPrintData({
            companyName: 'LogiRapid', // TODO: Get from company context
            supplierName: data.data.supplierName,
            supplierRuc: data.data.supplierCode,
            supplierAddress: data.data.supplierAddress,
            supplierPhone: data.data.supplierPhone,
            invoiceNumber: data.data.purchaseNumber,
            purchaseNumber: data.data.purchaseNumber,
            date: data.data.purchaseDate ? new Date(data.data.purchaseDate).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES'),
            dueDate: data.data.expectedDate ? new Date(data.data.expectedDate).toLocaleDateString('es-ES') : undefined,
            warehouseName: data.data.warehouseName,
            receivedBy: data.data.receivedByName,
            items: data.data.lines.map((line: { productName: string; productSku: string; quantity: number; unitPrice: number; totalPrice: number }) => ({
              name: line.productName,
              sku: line.productSku,
              quantity: line.quantity,
              unitCost: line.unitPrice,
              total: line.totalPrice
            })),
            subtotal: data.data.subtotal,
            tax: data.data.taxAmount,
            total: data.data.totalAmount,
            paymentStatus: data.data.status === 'recibido' ? 'paid' : 'pending',
            notes: data.data.notes
          })
        }
      }
    } catch (error) {
      console.error('Error fetching purchase for print:', error)
    } finally {
      setLoadingPrint(false)
    }
  }

  const fetchPurchases = async () => {
    setLoading(true)
    try {
      const statusParam = activeTab !== 'all' ? `&status=${activeTab}` : ''
      const response = await fetch(`/api/market/purchases?limit=50${statusParam}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPurchases(data.data.purchases)
          setStats(data.data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching purchases:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (purchaseId: number, action: 'confirm' | 'receive' | 'cancel') => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/market/purchases/${purchaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      const data = await response.json()
      if (data.success) {
        fetchPurchases()
        setSelectedPurchase(null)
      } else {
        alert(data.error || 'Error al procesar accion')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar accion')
    } finally {
      setActionLoading(false)
    }
  }

  const filteredPurchases = purchases.filter(p =>
    p.purchaseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const tabs = [
    { id: 'all', label: 'Todas', count: stats.draft + stats.confirmed + stats.received + stats.cancelled },
    { id: 'draft', label: 'Borradores', count: stats.draft },
    { id: 'confirmed', label: 'Confirmadas', count: stats.confirmed },
    { id: 'received', label: 'Recibidas', count: stats.received }
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Compras
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Gestiona las ordenes de compra a proveedores
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchPurchases}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>
              <button
                onClick={() => router.push('/dashboard/market/purchases/create')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:opacity-90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Compra
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Borradores</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.draft}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Confirmadas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.confirmed}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Recibidas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.received}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Comprado</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats.totalReceivedAmount)}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Tabs and Search */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-green-600 dark:bg-green-700 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar compras..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-600 dark:focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Purchases List */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Cargando compras...</p>
              </div>
            ) : filteredPurchases.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchTerm ? 'No se encontraron compras' : 'No hay compras registradas'}
                </p>
                <button
                  onClick={() => router.push('/dashboard/market/purchases/create')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  Crear Primera Compra
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        # Compra
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Proveedor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Items
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredPurchases.map((purchase, index) => {
                      const statusConfig = STATUS_CONFIG[purchase.status] || STATUS_CONFIG.draft
                      const StatusIcon = statusConfig.icon
                      return (
                        <motion.tr
                          key={purchase.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {purchase.purchaseNumber}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {purchase.supplierName}
                              </p>
                              {purchase.supplierContact && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {purchase.supplierContact}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                              <Calendar className="w-4 h-4" />
                              {formatDate(purchase.purchaseDate)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              {purchase.lineCount} productos ({purchase.totalItems} unidades)
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(purchase.totalAmount, purchase.currency)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handlePrintPurchase(purchase)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Imprimir factura"
                              >
                                <Printer className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => router.push(`/dashboard/market/purchases/${purchase.id}`)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4 text-gray-500" />
                              </button>
                              {purchase.status === 'draft' && (
                                <button
                                  onClick={() => setSelectedPurchase(purchase)}
                                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                  title="Mas opciones"
                                >
                                  <MoreVertical className="w-4 h-4 text-gray-500" />
                                </button>
                              )}
                              {(purchase.status === 'confirmed' || purchase.status === 'comprada' || purchase.status === 'pendiente') && (
                                <button
                                  onClick={() => router.push(`/dashboard/market/purchases/${purchase.id}/receive`)}
                                  className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:opacity-90 transition-colors flex items-center gap-1.5"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  Recibir
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Action Modal */}
          <AnimatePresence>
            {selectedPurchase && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setSelectedPurchase(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm"
                >
                  <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedPurchase.purchaseNumber}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {selectedPurchase.supplierName}
                    </p>
                  </div>

                  <div className="p-5 space-y-3">
                    {selectedPurchase.status === 'draft' && (
                      <>
                        <button
                          onClick={() => handleAction(selectedPurchase.id, 'confirm')}
                          disabled={actionLoading}
                          className="w-full py-3 bg-blue-600 text-white rounded-xl hover:opacity-90 transition-colors font-medium flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Confirmar Compra
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/market/purchases/${selectedPurchase.id}/edit`)}
                          className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleAction(selectedPurchase.id, 'cancel')}
                          disabled={actionLoading}
                          className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors font-medium"
                        >
                          Cancelar Compra
                        </button>
                      </>
                    )}
                  </div>

                  <div className="p-5 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setSelectedPurchase(null)}
                      className="w-full py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Print Modal */}
          {printPurchase && printData && !loadingPrint && (
            <PrintDocumentModal
              isOpen={!!printPurchase}
              onClose={() => { setPrintPurchase(null); setPrintData(null); }}
              documentType="purchase_invoice"
              documentTitle={`Compra ${printPurchase.purchaseNumber}`}
              documentData={printData}
              sourceType="purchase"
              sourceId={printPurchase.id}
              onPrintSuccess={() => { setPrintPurchase(null); setPrintData(null); }}
            />
          )}

          {/* Loading indicator for print data */}
          {loadingPrint && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-700 dark:text-gray-300">Cargando datos para imprimir...</span>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
