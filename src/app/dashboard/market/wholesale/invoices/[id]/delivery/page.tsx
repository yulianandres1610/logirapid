'use client'

import { useEffect, useState, use } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Truck,
  Package,
  CheckCircle,
  Save
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface InvoiceLine {
  id: number
  productId: number
  productName: string
  productSku: string | null
  quantity: number
  quantityDelivered: number
  unitPrice: number
}

interface Invoice {
  id: number
  invoiceNumber: string
  customerName: string
  warehouseId: number | null
  warehouseName: string | null
  lines: InvoiceLine[]
}

interface Warehouse {
  id: number
  name: string
}

interface DeliveryLine {
  invoiceLineId: number
  productId: number
  productName: string
  quantityPending: number
  quantityToDeliver: number
}

export default function CreateDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { theme } = useTheme()
  const router = useRouter()
  const resolvedParams = use(params)
  const invoiceId = resolvedParams.id

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [deliveryLines, setDeliveryLines] = useState<DeliveryLine[]>([])

  useEffect(() => {
    fetchInvoice()
    fetchWarehouses()
  }, [invoiceId])

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const inv = result.data
          setInvoice({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customer.businessName,
            warehouseId: inv.warehouseId,
            warehouseName: inv.warehouseName,
            lines: inv.lines
          })
          setSelectedWarehouse(inv.warehouseId)
          // Initialize delivery lines with pending quantities
          setDeliveryLines(inv.lines
            .filter((line: InvoiceLine) => line.quantity > line.quantityDelivered)
            .map((line: InvoiceLine) => ({
              invoiceLineId: line.id,
              productId: line.productId,
              productName: line.productName,
              quantityPending: line.quantity - line.quantityDelivered,
              quantityToDeliver: line.quantity - line.quantityDelivered
            }))
          )
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/market/warehouses')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setWarehouses(result.data.warehouses || result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const updateDeliveryQuantity = (index: number, quantity: number) => {
    const newLines = [...deliveryLines]
    newLines[index].quantityToDeliver = Math.min(Math.max(0, quantity), newLines[index].quantityPending)
    setDeliveryLines(newLines)
  }

  const deliverAll = () => {
    setDeliveryLines(deliveryLines.map(line => ({
      ...line,
      quantityToDeliver: line.quantityPending
    })))
  }

  const handleSubmit = async () => {
    if (!selectedWarehouse) {
      alert('Por favor selecciona un almacén')
      return
    }

    const linesToDeliver = deliveryLines.filter(l => l.quantityToDeliver > 0)
    if (linesToDeliver.length === 0) {
      alert('Por favor agrega al menos un producto a entregar')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: selectedWarehouse,
          deliveryDate,
          deliveryAddress,
          notes,
          lines: linesToDeliver.map(l => ({
            invoiceLineId: l.invoiceLineId,
            productId: l.productId,
            quantityToDeliver: l.quantityToDeliver
          }))
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          router.push(`/dashboard/market/wholesale/invoices/${invoiceId}?tab=deliveries`)
        }
      }
    } catch (error) {
      console.error('Error creating delivery:', error)
    } finally {
      setSaving(false)
    }
  }

  const totalToDeliver = deliveryLines.reduce((sum, l) => sum + l.quantityToDeliver, 0)

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!invoice) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen p-6 flex flex-col items-center justify-center">
            <Truck className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-xl font-medium">Factura no encontrada</p>
            <Link href="/dashboard/market/wholesale/invoices" className="mt-4 text-blue-500">
              Volver a facturas
            </Link>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
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
            {/* Header */}
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/market/wholesale/invoices/${invoiceId}`}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Nueva Entrega
                </h1>
                <p className={cn(
                  'text-sm mt-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Factura {invoice.invoiceNumber} - {invoice.customerName}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className={cn(
              'rounded-2xl border shadow-xl p-6',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Delivery Info */}
                <div className="space-y-6">
                  <h2 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Información de Entrega</h2>

                  <div>
                    <label className="block text-sm font-medium mb-2">Almacén de Origen *</label>
                    <select
                      value={selectedWarehouse || ''}
                      onChange={(e) => setSelectedWarehouse(e.target.value ? parseInt(e.target.value) : null)}
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    >
                      <option value="">Seleccionar almacén</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Fecha de Entrega</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Dirección de Entrega</label>
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={2}
                      placeholder="Dirección donde se entregará..."
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Notas</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Observaciones adicionales..."
                      className={cn(
                        'w-full px-4 py-2 rounded-lg border',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>
                </div>

                {/* Products to Deliver */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className={cn(
                      'text-lg font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Productos a Entregar</h2>
                    <button
                      onClick={deliverAll}
                      className="text-sm text-blue-500 hover:text-blue-600"
                    >
                      Entregar todo
                    </button>
                  </div>

                  <div className={cn(
                    'rounded-lg border divide-y max-h-[400px] overflow-y-auto',
                    theme === 'dark' ? 'border-gray-700 divide-gray-700' : 'border-gray-200 divide-gray-200'
                  )}>
                    {deliveryLines.length === 0 ? (
                      <div className="p-6 text-center">
                        <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                        <p className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>Todo entregado</p>
                        <p className="text-sm text-gray-500">
                          Todos los productos de esta factura ya fueron entregados
                        </p>
                      </div>
                    ) : (
                      deliveryLines.map((line, index) => (
                        <div key={line.invoiceLineId} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{line.productName}</p>
                                <p className="text-xs text-gray-500">
                                  Pendiente: {line.quantityPending} unidades
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">Cantidad a entregar</label>
                              <input
                                type="number"
                                value={line.quantityToDeliver}
                                onChange={(e) => updateDeliveryQuantity(index, parseInt(e.target.value) || 0)}
                                min="0"
                                max={line.quantityPending}
                                className={cn(
                                  'w-full px-3 py-2 rounded-lg border text-center',
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                )}
                              />
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => updateDeliveryQuantity(index, 0)}
                                className={cn(
                                  'px-3 py-2 rounded-lg text-sm',
                                  theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                                )}
                              >
                                0
                              </button>
                              <button
                                onClick={() => updateDeliveryQuantity(index, line.quantityPending)}
                                className="px-3 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600"
                              >
                                Todo
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Summary */}
                  {deliveryLines.length > 0 && (
                    <div className={cn(
                      'p-4 rounded-lg border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Total a entregar:</span>
                        <span className={cn(
                          'text-xl font-bold',
                          totalToDeliver > 0 ? 'text-green-600' : 'text-gray-500'
                        )}>
                          {totalToDeliver} unidades
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Link href={`/dashboard/market/wholesale/invoices/${invoiceId}`}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'px-6 py-2.5 rounded-xl font-medium border',
                    theme === 'dark'
                      ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  Cancelar
                </motion.button>
              </Link>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={saving || totalToDeliver === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Creando...' : 'Crear Entrega'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
