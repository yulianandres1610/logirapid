'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, Truck, ChevronDown, Loader2, Package, Calendar, Hash } from 'lucide-react'

export type ReferenceType = 'purchase_order' | 'consignment' | 'none'

interface PurchaseOrder {
  id: number
  orderNumber: string
  supplierName: string
  itemCount: number
  totalUnits: number
  expectedDate: string | null
  createdAt: string
}

interface Consignment {
  id: number
  orderNumber: string
  providerName: string
  itemCount: number
  totalUnits: number
  sentAt: string | null
  status: string
}

interface SelectedReference {
  type: ReferenceType
  id: number | null
  orderNumber: string | null
}

interface ReferenceOrderSelectorProps {
  warehouseId: number
  selectedReference: SelectedReference
  onSelect: (reference: SelectedReference) => void
  disabled?: boolean
}

export default function ReferenceOrderSelector({
  warehouseId,
  selectedReference,
  onSelect,
  disabled = false
}: ReferenceOrderSelectorProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [consignments, setConsignments] = useState<Consignment[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/market/warehouses/${warehouseId}/pending-orders`)
        const data = await response.json()

        if (data.success) {
          setPurchaseOrders(data.data.purchaseOrders || [])
          setConsignments(data.data.consignments || [])
        } else {
          setError(data.error || 'Error al cargar ordenes')
        }
      } catch {
        setError('Error de conexion')
      } finally {
        setLoading(false)
      }
    }

    fetchPendingOrders()
  }, [warehouseId])

  const getSelectedLabel = () => {
    if (selectedReference.type === 'none') {
      return 'Recepcion libre (sin orden)'
    }
    if (selectedReference.type === 'purchase_order') {
      const order = purchaseOrders.find(o => o.id === selectedReference.id)
      return order ? `OC: ${order.orderNumber} - ${order.supplierName}` : 'Orden de compra'
    }
    if (selectedReference.type === 'consignment') {
      const cons = consignments.find(c => c.id === selectedReference.id)
      return cons ? `Consig: ${cons.orderNumber} - ${cons.providerName}` : 'Consignacion'
    }
    return 'Seleccionar referencia...'
  }

  const hasOrders = purchaseOrders.length > 0 || consignments.length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
        <Loader2 className="w-5 h-5 animate-spin text-green-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-300">Cargando ordenes pendientes...</span>
      </div>
    )
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Orden de Referencia (opcional)
      </label>

      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-3 p-4
          bg-white dark:bg-gray-800
          border-2 rounded-xl
          transition-all
          ${isOpen ? 'border-green-500 ring-2 ring-green-200 dark:ring-green-800' : 'border-gray-300 dark:border-gray-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-green-400 cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`
            p-2 rounded-lg
            ${selectedReference.type !== 'none' && selectedReference.id ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}
          `}>
            {selectedReference.type === 'purchase_order' ? (
              <FileText className="w-5 h-5 text-green-600" />
            ) : selectedReference.type === 'consignment' ? (
              <Truck className="w-5 h-5 text-blue-600" />
            ) : (
              <Package className="w-5 h-5 text-gray-400" />
            )}
          </div>

          <span className={`
            ${selectedReference.type !== 'none' && selectedReference.id
              ? 'font-medium text-gray-900 dark:text-white'
              : 'text-gray-500 dark:text-gray-400'}
          `}>
            {getSelectedLabel()}
          </span>
        </div>

        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-80 overflow-y-auto"
          >
            {/* Free reception option */}
            <button
              onClick={() => {
                onSelect({ type: 'none', id: null, orderNumber: null })
                setIsOpen(false)
              }}
              className={`
                w-full flex items-center gap-3 p-3
                hover:bg-gray-50 dark:hover:bg-gray-700
                transition-colors border-b border-gray-100 dark:border-gray-700
                ${selectedReference.type === 'none' ? 'bg-gray-50 dark:bg-gray-700' : ''}
              `}
            >
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-600">
                <Package className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 dark:text-white">
                  Recepcion Libre
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sin vincular a orden de compra o consignacion
                </p>
              </div>
            </button>

            {/* Purchase Orders Section */}
            {purchaseOrders.length > 0 && (
              <>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Ordenes de Compra
                </div>
                {purchaseOrders.map((order) => (
                  <button
                    key={`po-${order.id}`}
                    onClick={() => {
                      onSelect({ type: 'purchase_order', id: order.id, orderNumber: order.orderNumber })
                      setIsOpen(false)
                    }}
                    className={`
                      w-full flex items-center gap-3 p-3
                      hover:bg-gray-50 dark:hover:bg-gray-700
                      transition-colors
                      ${selectedReference.type === 'purchase_order' && selectedReference.id === order.id
                        ? 'bg-green-50 dark:bg-green-900/30'
                        : ''}
                    `}
                  >
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <FileText className="w-4 h-4 text-green-600" />
                    </div>

                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {order.orderNumber}
                        </p>
                        <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                          {order.itemCount} items
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {order.supplierName}
                      </p>
                      {order.expectedDate && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          Esperado: {new Date(order.expectedDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {order.totalUnits}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block">unidades</span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Consignments Section */}
            {consignments.length > 0 && (
              <>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Consignaciones en Transito
                </div>
                {consignments.map((cons) => (
                  <button
                    key={`cons-${cons.id}`}
                    onClick={() => {
                      onSelect({ type: 'consignment', id: cons.id, orderNumber: cons.orderNumber })
                      setIsOpen(false)
                    }}
                    className={`
                      w-full flex items-center gap-3 p-3
                      hover:bg-gray-50 dark:hover:bg-gray-700
                      transition-colors
                      ${selectedReference.type === 'consignment' && selectedReference.id === cons.id
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : ''}
                    `}
                  >
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Truck className="w-4 h-4 text-blue-600" />
                    </div>

                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {cons.orderNumber}
                        </p>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          En transito
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {cons.providerName}
                      </p>
                      {cons.sentAt && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-1">
                          <Truck className="w-3 h-3" />
                          Enviado: {new Date(cons.sentAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {cons.totalUnits}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block">unidades</span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {!hasOrders && (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No hay ordenes pendientes de recepcion
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
