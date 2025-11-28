'use client'

import { useState } from 'react'
import {
  MapPin,
  User,
  Phone,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  Camera,
  PenLine,
  ChevronDown,
  ChevronUp,
  Edit2,
  Box
} from 'lucide-react'
import ClientInfoCard from './ClientInfoCard'
import EmpaqueAssignment from './EmpaqueAssignment'
import AddServiceModal from './AddServiceModal'
import DeliveryProofForm from './DeliveryProofForm'
import DeliveryProofViewer from './DeliveryProofViewer'
import { useAuth } from '@/hooks/useAuth'

interface Empaque {
  id: number
  codigo: string
  tipo?: string
  tamano?: string
  estado?: string
}

interface Service {
  id?: number
  type: string
  name: string
  price?: number
  quantity?: number
  empaques?: Empaque[]
}

interface OrderProof {
  id: number
  hasSignature: boolean
  signerName?: string
  signerRelation?: string
  photosCount: number
  createdAt: string
  createdByName?: string
}

interface Order {
  id: number
  orderNumber: string
  customerId?: number
  senderName: string
  senderPhone?: string
  senderAddress?: string
  senderCity?: string
  senderState?: string
  senderZipcode?: string
  services: Service[]
  status: string
  deliveryType?: string
  proofStatus: string
  deliveredAt?: string
  hasProof: boolean
  proof?: OrderProof | null
}

interface Stop {
  stopNumber: number
  address: string
  city?: string
  state?: string
  country?: string
  zipcode?: string
  coordinates: [number, number]
  orders: Order[]
  status: 'pending' | 'delivered' | 'failed'
  proofComplete: boolean
}

interface StopDetailPageProps {
  stop: Stop
  routeId: number
  routeData: {
    routeNumber: string
    status: string
    driverName?: string
    vehiclePlate?: string
  }
  onRefresh: () => void
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Clock,
    label: 'Pendiente'
  },
  delivered: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle,
    label: 'Entregado'
  },
  failed: {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
    label: 'Fallido'
  },
  in_transit: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Package,
    label: 'En tránsito'
  },
  cancelled: {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    icon: XCircle,
    label: 'Cancelado'
  }
}

export default function StopDetailPage({
  stop,
  routeId,
  routeData,
  onRefresh
}: StopDetailPageProps) {
  const [expandedOrders, setExpandedOrders] = useState<number[]>(stop.orders.map(o => o.id))
  const [addServiceOrderId, setAddServiceOrderId] = useState<number | null>(null)
  const [proofOrderId, setProofOrderId] = useState<number | null>(null)
  const [viewProofOrderId, setViewProofOrderId] = useState<number | null>(null)

  const { user } = useAuth()
  const companyId = user?.companyId

  const toggleOrderExpanded = (orderId: number) => {
    setExpandedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const handleProofSuccess = () => {
    setProofOrderId(null)
    onRefresh()
  }

  const handleServiceAdded = () => {
    setAddServiceOrderId(null)
    onRefresh()
  }

  const handleEmpaqueAssigned = () => {
    onRefresh()
  }

  // Construir dirección completa
  const fullAddress = [
    stop.address,
    stop.city,
    stop.state,
    stop.zipcode,
    stop.country
  ].filter(Boolean).join(', ')

  // Obtener datos del primer remitente para el card de cliente
  const firstOrder = stop.orders[0]
  const clientData = firstOrder ? {
    name: firstOrder.senderName,
    phone: firstOrder.senderPhone,
    address: fullAddress,
    customerId: firstOrder.customerId
  } : null

  return (
    <div className="space-y-6">
      {/* Sección: Información del Cliente (Remitente) */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Cliente (Remitente)
        </h2>
        {clientData && (
          <ClientInfoCard
            clientData={clientData}
            orderId={firstOrder.id}
            onUpdate={onRefresh}
          />
        )}
      </section>

      {/* Sección: Órdenes en esta parada */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Órdenes en esta Parada ({stop.orders.length})
        </h2>

        <div className="space-y-4">
          {stop.orders.map(order => {
            const orderStatus = statusConfig[order.status] || statusConfig.pending
            const OrderStatusIcon = orderStatus.icon
            const isExpanded = expandedOrders.includes(order.id)

            return (
              <div
                key={order.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
              >
                {/* Header de la orden */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleOrderExpanded(order.id)}
                  onKeyDown={(e) => e.key === 'Enter' && toggleOrderExpanded(order.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                      {order.orderNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${orderStatus.color}`}>
                      <OrderStatusIcon className="w-3 h-3" />
                      {orderStatus.label}
                    </span>
                    {order.deliveryType && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs">
                        {order.deliveryType}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Indicadores rápidos */}
                    {order.hasProof && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                        <CheckCircle className="w-3 h-3" />
                        Comprobante
                      </span>
                    )}

                    {/* Botón agregar servicio */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setAddServiceOrderId(order.id)
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Agregar servicio"
                    >
                      <Plus className="w-4 h-4" />
                    </button>

                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Contenido expandido */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    {/* Información del cliente */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {order.senderName}
                      </span>
                      {order.senderPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {order.senderPhone}
                        </span>
                      )}
                    </div>

                    {/* Servicios con asignación de empaques */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <Box className="w-4 h-4" />
                        Servicios
                      </h4>

                      {order.services && order.services.length > 0 ? (
                        <div className="space-y-3">
                          {order.services.map((service, sIdx) => (
                            <div
                              key={sIdx}
                              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {service.name || service.type}
                                  {service.quantity && service.quantity > 1 ? (
                                    <span className="text-gray-500"> x{service.quantity}</span>
                                  ) : null}
                                </span>
                                {service.price ? (
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    ${parseFloat(String(service.price)).toFixed(2)}
                                  </span>
                                ) : null}
                              </div>

                              {/* Asignación de empaques para servicios de envío */}
                              {(service.type === 'envio' || service.type?.includes('envio') || service.name?.toLowerCase().includes('envio') || service.name?.toLowerCase().includes('caja')) && (
                                <EmpaqueAssignment
                                  orderId={order.id}
                                  orderNumber={order.orderNumber}
                                  serviceName={service.name || service.type}
                                  serviceIndex={sIdx}
                                  quantity={service.quantity || 1}
                                  empaques={service.empaques || []}
                                  companyId={companyId}
                                  onAssigned={handleEmpaqueAssigned}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          No hay servicios registrados
                        </p>
                      )}
                    </div>

                    {/* Sección de comprobante */}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        Comprobante de Recogida
                      </h4>

                      {order.hasProof && order.proof ? (
                        <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                          <div className="flex items-center gap-3 text-sm">
                            {order.proof.hasSignature && (
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <PenLine className="w-4 h-4" />
                                Firmado
                                {order.proof.signerName && ` por ${order.proof.signerName}`}
                              </span>
                            )}
                            {order.proof.photosCount > 0 && (
                              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                <Camera className="w-4 h-4" />
                                {order.proof.photosCount} foto{order.proof.photosCount !== 1 && 's'}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewProofOrderId(order.id)}
                            className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                          >
                            Ver Comprobante
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setProofOrderId(order.id)}
                          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-2"
                        >
                          <Camera className="w-5 h-5" />
                          Agregar Comprobante de Recogida
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Modal: Agregar Servicio */}
      {addServiceOrderId && (
        <AddServiceModal
          orderId={addServiceOrderId}
          orderNumber={stop.orders.find(o => o.id === addServiceOrderId)?.orderNumber || ''}
          companyId={companyId}
          onClose={() => setAddServiceOrderId(null)}
          onSuccess={handleServiceAdded}
        />
      )}

      {/* Modal: Agregar Comprobante */}
      {proofOrderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Comprobante de Recogida
              </h3>
              <button
                type="button"
                onClick={() => setProofOrderId(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              <DeliveryProofForm
                orderId={proofOrderId}
                orderNumber={stop.orders.find(o => o.id === proofOrderId)?.orderNumber || ''}
                companyId={companyId || undefined}
                onSuccess={handleProofSuccess}
                onCancel={() => setProofOrderId(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ver Comprobante */}
      {viewProofOrderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Comprobante de Entrega
              </h3>
              <button
                type="button"
                onClick={() => setViewProofOrderId(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              <DeliveryProofViewer orderId={viewProofOrderId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
