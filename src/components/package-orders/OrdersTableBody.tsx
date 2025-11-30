import { motion } from 'framer-motion'
import { Store, AlertCircle, CheckCircle, Package, Truck, Eye, Edit, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Helper para obtener el nombre del servicio (puede ser string u objeto)
const getServiceName = (service: any): string => {
  if (typeof service === 'string') return service
  if (typeof service === 'object' && service !== null) {
    return service.name || service.type || ''
  }
  return ''
}

interface PackageOrder {
  id: number
  orderNumber: string
  customerId: number
  customerName: string
  customerAddress?: string
  services: string[]
  notes?: string
  scheduledDate?: string
  timeSlot?: string
  status: 'pending' | 'reprogrammed' | 'picked_up' | 'in_transit' | 'in_route' | 'en_ruta' | 'en_reparto' | 'delivered'
  createdAt: string
  updatedAt: string
  firstName?: string
  lastName?: string
  phone?: string
  total?: number
  email?: string
  address?: string
  customerNotes?: string
  orderType?: 'recogida' | 'oficina'
  latitude?: number | null
  longitude?: number | null
}

interface OrdersTableBodyProps {
  orders: PackageOrder[]
  orderTypeFilter: string
  theme: string
  handleViewOrder: (id: number) => void
  handleEditOrder: (id: number) => void
  handleDeleteOrder: (id: number) => void
}

const STATUSES: Record<string, { label: string; color: string; icon: typeof AlertCircle }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle },
  reprogrammed: { label: 'Reprogramado', color: 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-lg border border-yellow-200 dark:from-yellow-600 dark:to-orange-700 dark:border-yellow-400', icon: AlertCircle },
  picked_up: { label: 'Recogido', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Package },
  in_transit: { label: 'Enviado', color: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border border-blue-200 dark:from-blue-600 dark:to-indigo-700 dark:border-blue-400', icon: Package },
  in_route: { label: 'En Reparto', color: 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg border border-purple-200 dark:from-purple-600 dark:to-indigo-700 dark:border-purple-400', icon: Truck },
  en_ruta: { label: 'En Ruta', color: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg border border-blue-200 dark:from-blue-600 dark:to-cyan-700 dark:border-blue-400', icon: Truck },
  en_reparto: { label: 'En Reparto', color: 'bg-gradient-to-r from-cyan-500 to-teal-600 text-white shadow-lg border border-cyan-200 dark:from-cyan-600 dark:to-teal-700 dark:border-cyan-400', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  failed: { label: 'Fallido', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
}

// Función para normalizar el status
const normalizeStatus = (status: string): string => {
  if (!status) return 'pending'
  // Primero normalizar: minúsculas, sin espacios extra, reemplazar espacios y guiones por _
  const normalized = status.toLowerCase().trim().replace(/[\s-]+/g, '_')

  // Mapear variantes comunes al status correcto
  const statusMap: Record<string, string> = {
    'en_reparto': 'en_reparto',
    'en reparto': 'en_reparto',
    'en-reparto': 'en_reparto',
    'enreparto': 'en_reparto',
    'en_ruta': 'en_ruta',
    'en ruta': 'en_ruta',
    'en-ruta': 'en_ruta',
    'enruta': 'en_ruta',
    'in_route': 'in_route',
    'in route': 'in_route',
    'in-route': 'in_route',
    'in_transit': 'in_transit',
    'in transit': 'in_transit',
    'in-transit': 'in_transit',
    'picked_up': 'picked_up',
    'picked up': 'picked_up',
    'picked-up': 'picked_up',
  }

  // Buscar primero en el mapa con el valor original (lowercase)
  const lowerStatus = status.toLowerCase().trim()
  if (statusMap[lowerStatus]) {
    return statusMap[lowerStatus]
  }

  // Buscar con el valor normalizado
  if (statusMap[normalized]) {
    return statusMap[normalized]
  }

  return normalized
}

export default function OrdersTableBody({
  orders,
  orderTypeFilter,
  theme,
  handleViewOrder,
  handleEditOrder,
  handleDeleteOrder
}: OrdersTableBodyProps) {

  // Helper para parsear officeOrderData
  const getOfficeData = (order: any) => {
    if (!order.orderType || order.orderType !== 'oficina') return null
    try {
      const data = typeof order === 'object' && 'officeOrderData' in order
        ? (typeof order.officeOrderData === 'string'
            ? JSON.parse(order.officeOrderData)
            : order.officeOrderData)
        : null
      return data
    } catch {
      return null
    }
  }

  // Helper para parsear direcciones
  const parseAddress = (addressField: any) => {
    if (!addressField) return null
    if (typeof addressField === 'object' && addressField !== null) {
      return addressField
    }
    if (typeof addressField === 'string') {
      try {
        const parsed = JSON.parse(addressField)
        if (parsed && typeof parsed === 'object') {
          return parsed
        }
      } catch {
        return { street: addressField }
      }
    }
    return null
  }

  const formatAddress = (address: any) => {
    if (!address) return 'Sin dirección'
    const parts: string[] = []
    if (address.street) parts.push(address.street)
    if (address.apartment) parts.push(`Apt: ${address.apartment}`)
    if (address.city) parts.push(address.city)
    if (address.state) parts.push(address.state)
    if (address.zipCode) parts.push(address.zipCode)
    if (address.country && address.country !== 'Estados Unidos') parts.push(address.country)

    return parts.length > 0 ? (
      <div>
        <div className="font-medium text-black dark:text-gray-100">{parts[0]}</div>
        {parts.length > 1 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {parts.slice(1).join(', ')}
          </div>
        )}
      </div>
    ) : 'Sin dirección'
  }

  return (
    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
      {orders.map((order) => {
        const officeData = getOfficeData(order)

        return (
          <motion.tr
            key={order.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors')}
          >
            {/* Columna 1: Número de Orden (siempre visible) */}
            <td className="px-4 py-4 whitespace-nowrap">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-base font-bold text-black dark:text-gray-100">
                  {order.orderNumber}
                </div>
                {order.orderType === 'oficina' && orderTypeFilter === 'all' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <Store className="w-3 h-3 mr-1" />
                    Oficina
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {(() => {
                  if (!order.createdAt) return <span>Sin fecha</span>
                  const orderDate = new Date(order.createdAt)
                  if (isNaN(orderDate.getTime())) return <span>Fecha inválida</span>
                  const now = new Date()
                  const daysDiff = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24))

                  if (daysDiff === 0) return (
                    <div>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">Hoy</span>
                      <div className="text-gray-400 dark:text-gray-500 mt-1">
                        {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                  if (daysDiff === 1) return (
                    <div>
                      <span className="text-green-600 dark:text-green-400 font-medium">Ayer</span>
                      <div className="text-gray-400 dark:text-gray-500 mt-1">
                        {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                  return (
                    <div>
                      <div className="font-medium">
                        {orderDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="text-gray-400 dark:text-gray-500 mt-1">
                        {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </td>

            {/* COLUMNAS PARA PICKUP (recogida) */}
            {orderTypeFilter === 'recogida' && (
              <>
                {/* Fecha Recogida */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    {order.scheduledDate ? (
                      <div>
                        <div className="font-medium text-black dark:text-gray-100">
                          {(() => {
                            const dateStr = order.scheduledDate.includes('T') ? order.scheduledDate : order.scheduledDate + 'T00:00:00'
                            const scheduledDate = new Date(dateStr)
                            if (isNaN(scheduledDate.getTime())) return <span className="text-gray-400">Fecha inválida</span>
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            const tomorrow = new Date(today)
                            tomorrow.setDate(tomorrow.getDate() + 1)
                            const isToday = scheduledDate.toDateString() === today.toDateString()
                            const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString()
                            if (isToday) return <span className="text-blue-600 dark:text-blue-400">Hoy</span>
                            if (isTomorrow) return <span className="text-green-600 dark:text-green-400">Mañana</span>
                            return scheduledDate.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })
                          })()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {(() => {
                            const dateStr = order.scheduledDate.includes('T') ? order.scheduledDate : order.scheduledDate + 'T00:00:00'
                            const date = new Date(dateStr)
                            if (isNaN(date.getTime())) return 'Fecha inválida'
                            return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          })()}
                        </div>
                        {order.timeSlot && (
                          <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">
                            🕐 {(() => {
                              const timeSlots: { [key: string]: string } = {
                                'morning': '8:00 - 12:00',
                                'afternoon': '12:00 - 16:00',
                                'evening': '16:00 - 20:00'
                              }
                              return timeSlots[order.timeSlot] || order.timeSlot
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 italic">No programada</span>
                    )}
                  </div>
                </td>

                {/* Cliente */}
                <td className="px-6 py-2">
                  <div className="text-base font-medium text-black dark:text-gray-100">
                    {order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim()}
                  </div>
                </td>

                {/* Dirección Recogida */}
                <td className="px-6 py-3">
                  <div className="text-sm text-black dark:text-gray-400 min-w-0 max-w-md">
                    {formatAddress(parseAddress(order.customerAddress) || parseAddress(order.address))}
                  </div>
                </td>

                {/* Servicios */}
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {order.services.map((service, index) => {
                      const serviceName = getServiceName(service)
                      return (
                        <span
                          key={index}
                          className={cn(
                            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                            serviceName.toLowerCase().includes('recogida') || serviceName.toLowerCase().includes('pickup')
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          )}
                        >
                          {serviceName}
                        </span>
                      )
                    })}
                  </div>
                </td>

                {/* Estado */}
                <td className="px-4 py-4 whitespace-nowrap">
                  {(() => {
                    const normalizedStatus = normalizeStatus(order.status)
                    const statusConfig = STATUSES[normalizedStatus]
                    const StatusIcon = statusConfig?.icon || AlertCircle
                    return (
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        statusConfig?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      )}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig?.label || order.status || 'Desconocido'}
                      </span>
                    )
                  })()}
                </td>
              </>
            )}

            {/* COLUMNAS PARA OFFICE (oficina) */}
            {orderTypeFilter === 'oficina' && (
              <>
                {/* Fecha Creación */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    {(() => {
                      if (!order.createdAt) return <span className="text-gray-400">Sin fecha</span>
                      const orderDate = new Date(order.createdAt)
                      if (isNaN(orderDate.getTime())) return <span className="text-gray-400">Fecha inválida</span>
                      return (
                        <div>
                          <div className="font-medium text-black dark:text-gray-100">
                            {orderDate.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {orderDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </td>

                {/* Remitente */}
                <td className="px-6 py-2">
                  <div className="text-base font-medium text-black dark:text-gray-100">
                    {officeData?.senderName || order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim()}
                  </div>
                  {officeData?.senderPhone && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      📞 {officeData.senderPhone}
                    </div>
                  )}
                </td>

                {/* Destinatario */}
                <td className="px-6 py-2">
                  <div className="text-base font-medium text-black dark:text-gray-100">
                    {officeData?.receiverName || 'N/A'}
                  </div>
                  {officeData?.receiverPhone && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      📞 {officeData.receiverPhone}
                    </div>
                  )}
                </td>

                {/* Destino */}
                <td className="px-6 py-3">
                  <div className="text-sm text-black dark:text-gray-400 min-w-0 max-w-md">
                    {officeData?.destination ? formatAddress(officeData.destination) : 'Sin destino'}
                  </div>
                </td>

                {/* Cajas */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {officeData?.boxCount || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {officeData?.boxCount === 1 ? 'caja' : 'cajas'}
                    </div>
                  </div>
                </td>

                {/* Estado */}
                <td className="px-4 py-4 whitespace-nowrap">
                  {(() => {
                    const normalizedStatus = normalizeStatus(order.status)
                    const statusConfig = STATUSES[normalizedStatus]
                    const StatusIcon = statusConfig?.icon || AlertCircle
                    return (
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        statusConfig?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      )}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig?.label || order.status || 'Desconocido'}
                      </span>
                    )
                  })()}
                </td>
              </>
            )}

            {/* COLUMNAS PARA TODOS (vista genérica) */}
            {orderTypeFilter === 'all' && (
              <>
                {/* Tipo */}
                <td className="px-4 py-4 whitespace-nowrap">
                  {order.orderType === 'oficina' ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      <Store className="w-3 h-3 mr-1" />
                      Oficina
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                      <Truck className="w-3 h-3 mr-1" />
                      Recogida
                    </span>
                  )}
                </td>

                {/* Fecha */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    {order.scheduledDate ? (
                      <div>
                        <div className="font-medium text-black dark:text-gray-100">
                          {(() => {
                            const dateStr = order.scheduledDate.includes('T') ? order.scheduledDate : order.scheduledDate + 'T00:00:00'
                            const date = new Date(dateStr)
                            if (isNaN(date.getTime())) return 'Fecha inválida'
                            return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                          })()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 italic">Sin fecha</span>
                    )}
                  </div>
                </td>

                {/* Cliente */}
                <td className="px-6 py-2">
                  <div className="text-base font-medium text-black dark:text-gray-100">
                    {order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim()}
                  </div>
                </td>

                {/* Detalles */}
                <td className="px-6 py-3">
                  <div className="text-sm text-black dark:text-gray-400">
                    {order.orderType === 'oficina' ? (
                      <span>Destino: {officeData?.destination?.city || 'N/A'}</span>
                    ) : (
                      <span>{parseAddress(order.customerAddress)?.street || order.customerAddress || 'Sin dirección'}</span>
                    )}
                  </div>
                </td>

                {/* Estado */}
                <td className="px-4 py-4 whitespace-nowrap">
                  {(() => {
                    const normalizedStatus = normalizeStatus(order.status)
                    const statusConfig = STATUSES[normalizedStatus]
                    const StatusIcon = statusConfig?.icon || AlertCircle
                    return (
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        statusConfig?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                      )}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig?.label || order.status || 'Desconocido'}
                      </span>
                    )
                  })()}
                </td>
              </>
            )}

            {/* Acciones (siempre visible) */}
            <td className="px-2 py-4 whitespace-nowrap">
              <div className="flex gap-1 justify-end">
                {/* View Details Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleViewOrder(order.id)}
                  className={cn(
                    'relative p-2 rounded-lg transition-all duration-200',
                    theme === 'dark'
                      ? 'text-blue-400 hover:bg-blue-900/30'
                      : 'text-blue-600 hover:bg-blue-50'
                  )}
                  title="Ver detalles"
                >
                  <Eye className="w-4 h-4" />
                </motion.button>

                {/* Edit Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleEditOrder(order.id)}
                  className={cn(
                    'relative p-2 rounded-lg transition-all duration-200',
                    theme === 'dark'
                      ? 'text-gray-400 hover:bg-gray-700/50'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                  title="Editar orden"
                >
                  <Edit className="w-4 h-4" />
                </motion.button>

                {/* Delete Button (only for pending orders) */}
                {order.status === 'pending' ? (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDeleteOrder(order.id)
                    }}
                    className={cn(
                      'relative p-2 rounded-lg transition-all duration-200',
                      theme === 'dark'
                        ? 'text-red-400 hover:bg-red-900/30'
                        : 'text-red-600 hover:bg-red-50'
                    )}
                    title="Eliminar orden"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                ) : (
                  <div
                    className={cn(
                      'p-2 rounded-lg opacity-50 cursor-not-allowed',
                      theme === 'dark'
                        ? 'text-gray-600'
                        : 'text-gray-400'
                    )}
                    title="No se puede eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </div>
                )}
              </div>
            </td>
          </motion.tr>
        )
      })}
    </tbody>
  )
}
