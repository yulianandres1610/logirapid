'use client'

import { useState } from 'react'
import {
  MapPin,
  ChevronDown,
  ChevronUp,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  FileCheck,
  Camera,
  PenLine,
  Eye,
  Plus,
  User,
  Phone
} from 'lucide-react'

// Icono personalizado para editar parada (similar a ExternalLink con lápiz)
const EditSquareIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
)

interface Empaque {
  id: number
  codigo: string
  tipo?: string
  tamano?: string
  estado?: string
}

interface Service {
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
  // Datos del remitente (cliente que envía - primera milla)
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
  status: 'pendiente' | 'en_curso' | 'completada' | 'fallida' | 'pending' | 'delivered' | 'failed'
  proofComplete: boolean
}

interface RouteStopCardProps {
  stop: Stop
  routeId: number
  onAddProof?: (orderId: number) => void
  onViewProof?: (orderId: number) => void
  onEditOrder?: (orderId: number) => void
  onViewStop?: (stopNumber: number) => void
  expandedByDefault?: boolean
}

const statusConfig = {
  // Nuevos estados de parada
  pendiente: {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    icon: Clock,
    label: 'Pendiente'
  },
  en_curso: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Package,
    label: 'En Curso'
  },
  completada: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle,
    label: 'Completada'
  },
  fallida: {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
    label: 'Fallida'
  },
  // Estados legacy para compatibilidad
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

export default function RouteStopCard({
  stop,
  routeId,
  onAddProof,
  onViewProof,
  onEditOrder,
  onViewStop,
  expandedByDefault = false
}: RouteStopCardProps) {
  const [isExpanded, setIsExpanded] = useState(expandedByDefault)

  const stopStatus = statusConfig[stop.status as keyof typeof statusConfig] || statusConfig.pending

  // Formatear dirección completa
  const fullAddress = [
    stop.address,
    stop.city,
    stop.state,
    stop.zipcode,
    stop.country
  ].filter(Boolean).join(', ')

  // Contar órdenes con/sin comprobante
  const ordersWithProof = stop.orders.filter(o => o.hasProof).length
  const totalOrders = stop.orders.length

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
      {/* Header de la parada - siempre visible */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => e.key === 'Enter' && setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          {/* Número de parada con indicador de comprobante completo */}
          <div className="relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              stop.status === 'delivered'
                ? 'bg-green-500 text-white'
                : stop.status === 'failed'
                  ? 'bg-red-500 text-white'
                  : 'bg-blue-500 text-white'
            }`}>
              {stop.stopNumber}
            </div>
            {stop.proofComplete && (
              <FileCheck className="w-4 h-4 text-green-500 absolute -top-1 -right-1 bg-white dark:bg-gray-800 rounded-full" />
            )}
          </div>

          {/* Información de la parada */}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {stop.address}
              </span>
            </div>
            {(stop.city || stop.state) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                {[stop.city, stop.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Indicadores */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Cantidad de órdenes */}
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300">
              {totalOrders} {totalOrders === 1 ? 'orden' : 'órdenes'}
            </span>

            {/* Estado de comprobantes */}
            {ordersWithProof > 0 && (
              <span className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                ordersWithProof === totalOrders
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                <FileCheck className="w-3 h-3" />
                {ordersWithProof}/{totalOrders}
              </span>
            )}

            {/* Badge de estado */}
            <span className={`px-2 py-1 rounded text-xs ${stopStatus.color}`}>
              {stopStatus.label}
            </span>
          </div>

          {/* Botón ver detalles */}
          {onViewStop && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onViewStop(stop.stopNumber)
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="Ver detalles de parada"
            >
              <EditSquareIcon className="w-4 h-4" />
            </button>
          )}

          {/* Icono expandir */}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Contenido expandido - órdenes */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {stop.orders.map((order, index) => {
            const orderStatus = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
            const OrderStatusIcon = orderStatus.icon

            return (
              <div
                key={order.id}
                className={`px-4 py-3 ${
                  index < stop.orders.length - 1 ? 'border-b border-gray-100 dark:border-gray-700/50' : ''
                }`}
              >
                {/* Header de la orden */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Número de orden y estado */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                        {order.orderNumber}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs flex items-center gap-1 ${orderStatus.color}`}>
                        <OrderStatusIcon className="w-3 h-3" />
                        {orderStatus.label}
                      </span>
                      {order.deliveryType && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded text-xs">
                          {order.deliveryType}
                        </span>
                      )}
                    </div>

                    {/* Remitente (cliente que envía - primera milla) */}
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      <span className="font-medium">Cliente:</span> {order.senderName}
                      {order.senderPhone && (
                        <span className="text-gray-400"> • {order.senderPhone}</span>
                      )}
                    </p>

                    {/* Servicios con empaques */}
                    {order.services && order.services.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {order.services.map((service, sIdx) => {
                          const empaquesCount = service.empaques?.length || 0
                          const requiredEmpaques = service.quantity || 1

                          return (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1"
                            >
                              {service.name || service.type}
                              {service.quantity && service.quantity > 1 && ` x${service.quantity}`}
                              {/* Indicador de empaques */}
                              {service.type === 'envio' && (
                                <span className={`ml-1 px-1 rounded text-[10px] ${
                                  empaquesCount >= requiredEmpaques
                                    ? 'bg-green-200 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                                    : 'bg-orange-200 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400'
                                }`}>
                                  {empaquesCount}/{requiredEmpaques}
                                </span>
                              )}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* Estado del comprobante */}
                    {order.hasProof && order.proof && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {order.proof.hasSignature && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <PenLine className="w-3 h-3" />
                            Firmado
                            {order.proof.signerName && ` por ${order.proof.signerName}`}
                          </span>
                        )}
                        {order.proof.photosCount > 0 && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Camera className="w-3 h-3" />
                            {order.proof.photosCount} foto{order.proof.photosCount !== 1 && 's'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Botón ver orden */}
                    {onEditOrder && (
                      <button
                        type="button"
                        onClick={() => onEditOrder(order.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Ver orden"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {/* Botón comprobante */}
                    {order.hasProof && order.proof ? (
                      <button
                        type="button"
                        onClick={() => onViewProof?.(order.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Ver comprobante"
                      >
                        <FileCheck className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAddProof?.(order.id)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Agregar comprobante"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
