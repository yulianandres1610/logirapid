'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User,
  Phone,
  MapPin,
  Package,
  CreditCard,
  Plus,
  Key,
  FileText,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Send,
  MessageCircle,
  Mail,
  Navigation
} from 'lucide-react'

interface Address {
  street: string
  number?: string
  apartment?: string
  city: string
  state: string
  zipCode?: string
  country: string
  provinceName?: string
  municipalityName?: string
  reparto?: string
  floor?: string
}

interface Customer {
  id: number
  firstName: string
  lastName: string
  phone: string
  email?: string
  address?: Address
  entryPin?: string
  entryInstructions?: string
  deliveryInstructions?: string
}

interface Service {
  id: number
  name: string
  type: string
  price: number
  empaques?: Array<{
    id: number
    codigo: string
    estado: string
  }>
}

interface Product {
  id: number
  productId: number
  productCode: string
  productName: string
  quantity: number
  weightLbs: number
  unitPrice: number
  subtotal: number
}

interface OrderDetail {
  id: number
  orderNumber: string
  status: string
  paymentStatus: string
  shippingType: string
  sender: Customer
  recipient: Customer
  services: Service[]
  products: Product[]
  totalAmount: number
  createdAt: string
  notes?: string
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showReceiptOptions, setShowReceiptOptions] = useState(false)

  const fetchOrderDetails = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/driver-app/orders/${orderId}`)
      const data = await response.json()

      if (data.success) {
        setOrder(data.data)
      } else {
        setError(data.error || 'Error al cargar orden')
      }
    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId])

  const handleAddProducts = () => {
    router.push(`/driver/orders/${orderId}/products`)
  }

  const handleProcessPayment = () => {
    router.push(`/driver/orders/${orderId}/payment`)
  }

  const formatAddress = (address?: Address, isCuba?: boolean) => {
    if (!address) return 'Sin direccion'

    if (isCuba) {
      const parts = [
        address.street,
        address.number && `#${address.number}`,
        address.reparto && `Rpto. ${address.reparto}`,
        address.floor,
        address.municipalityName,
        address.provinceName
      ].filter(Boolean)
      return parts.join(', ')
    }

    const parts = [
      address.street,
      address.apartment && `Apt ${address.apartment}`,
      address.city,
      address.state,
      address.zipCode
    ].filter(Boolean)
    return parts.join(', ')
  }

  const openNavigation = (address?: Address) => {
    if (!address) return
    const query = encodeURIComponent(formatAddress(address))
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`
    window.open(url, '_blank')
  }

  const sendReceipt = async (method: 'whatsapp' | 'sms' | 'email') => {
    if (!order) return

    const phone = order.sender.phone
    const email = order.sender.email

    try {
      const response = await fetch(`/api/driver-app/orders/${orderId}/send-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, phone, email })
      })
      const data = await response.json()

      if (data.success) {
        setShowReceiptOptions(false)
        // Show success notification
      } else {
        setError(data.error || 'Error al enviar recibo')
      }
    } catch (err) {
      setError('Error de conexion')
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-exa-primary/30 border-t-exa-primary rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Cargando orden...</p>
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchOrderDetails}
            className="mt-3 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!order) return null

  const isPaid = order.paymentStatus === 'pagada' || order.paymentStatus === 'paid'
  const hasProducts = order.products && order.products.length > 0
  const totalProducts = order.products?.reduce((sum, p) => sum + p.subtotal, 0) || 0

  return (
    <div className="pb-32">
      {/* Order Header */}
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-4 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-white font-bold text-xl">{order.orderNumber}</h2>
              <p className="text-gray-400 text-sm">
                {new Date(order.createdAt).toLocaleDateString('es', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isPaid
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>
              {isPaid ? 'Pagada' : 'Pendiente Pago'}
            </div>
          </div>

          {/* Shipping Type */}
          {order.shippingType && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-sm">
              <Package className="w-4 h-4" />
              <span className="font-medium">
                {order.shippingType === 'air' ? 'Envio Aereo' : 'Envio Maritimo'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Sender Section */}
      <div className="px-4 mb-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-400" />
          Remitente
        </h3>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white font-semibold">
                {order.sender.firstName} {order.sender.lastName}
              </p>
              <a
                href={`tel:${order.sender.phone}`}
                className="text-gray-400 text-sm flex items-center gap-1 hover:text-white"
              >
                <Phone className="w-3.5 h-3.5" />
                {order.sender.phone}
              </a>
            </div>
            {order.sender.address && (
              <button
                onClick={() => openNavigation(order.sender.address)}
                className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
              >
                <Navigation className="w-4 h-4" />
              </button>
            )}
          </div>

          {order.sender.address && (
            <div className="flex items-start gap-2 mb-3">
              <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-gray-300 text-sm">
                {formatAddress(order.sender.address, false)}
              </p>
            </div>
          )}

          {/* Entry Info */}
          {(order.sender.entryPin || order.sender.entryInstructions) && (
            <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
              {order.sender.entryPin && (
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-yellow-400" />
                  <span className="text-gray-400 text-sm">PIN:</span>
                  <span className="text-white font-mono font-semibold">{order.sender.entryPin}</span>
                </div>
              )}
              {order.sender.entryInstructions && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-400 mt-0.5" />
                  <p className="text-gray-300 text-sm">{order.sender.entryInstructions}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recipient Section */}
      <div className="px-4 mb-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-green-400" />
          Destinatario
        </h3>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <div className="mb-3">
            <p className="text-white font-semibold">
              {order.recipient.firstName} {order.recipient.lastName}
            </p>
            {order.recipient.phone && (
              <p className="text-gray-400 text-sm flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {order.recipient.phone}
              </p>
            )}
          </div>

          {order.recipient.address && (
            <div className="flex items-start gap-2 mb-3">
              <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-gray-300 text-sm">
                {formatAddress(order.recipient.address, true)}
              </p>
            </div>
          )}

          {/* Delivery Instructions */}
          {order.recipient.deliveryInstructions && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-purple-400 mt-0.5" />
                <p className="text-gray-300 text-sm">{order.recipient.deliveryInstructions}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Products Section */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-400" />
            Productos
          </h3>
          {!isPaid && (
            <button
              onClick={handleAddProducts}
              className="text-exa-primary text-sm font-medium flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </button>
          )}
        </div>

        {hasProducts ? (
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
            {order.products.map((product, index) => (
              <div
                key={product.id}
                className={`p-4 ${index > 0 ? 'border-t border-gray-700/50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium">{product.productName}</p>
                    <p className="text-gray-500 text-sm">
                      {product.productCode} | {product.quantity} x ${product.unitPrice.toFixed(2)}
                    </p>
                    {product.weightLbs > 0 && (
                      <p className="text-gray-500 text-sm">Peso: {product.weightLbs} lbs</p>
                    )}
                  </div>
                  <p className="text-white font-semibold">${product.subtotal.toFixed(2)}</p>
                </div>
              </div>
            ))}
            <div className="p-4 bg-gray-900/50 border-t border-gray-700/50">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Productos</span>
                <span className="text-white font-bold text-lg">${totalProducts.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={handleAddProducts}
            className="bg-gray-800/30 border border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-800/50 hover:border-gray-600 transition-all"
          >
            <Plus className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400">No hay productos agregados</p>
            <p className="text-exa-primary text-sm mt-1">Toca para agregar</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="fixed bottom-20 left-0 right-0 px-4 py-3 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800">
        {isPaid ? (
          <>
            {/* Send Receipt Options */}
            {showReceiptOptions ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <p className="text-gray-400 text-sm text-center mb-2">Enviar recibo por:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => sendReceipt('whatsapp')}
                    className="flex-1 py-3 bg-green-500/20 text-green-400 font-medium rounded-xl flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-5 h-5" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => sendReceipt('sms')}
                    className="flex-1 py-3 bg-blue-500/20 text-blue-400 font-medium rounded-xl flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    SMS
                  </button>
                </div>
                <button
                  onClick={() => setShowReceiptOptions(false)}
                  className="w-full py-2 text-gray-400 text-sm"
                >
                  Cancelar
                </button>
              </motion.div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReceiptOptions(true)}
                  className="flex-1 py-3 bg-gray-800 text-white font-medium rounded-xl flex items-center justify-center gap-2 border border-gray-700"
                >
                  <Send className="w-5 h-5" />
                  Enviar Recibo
                </button>
                <div className="flex items-center gap-2 px-4 py-3 bg-green-500/20 text-green-400 rounded-xl">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Pagada</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleAddProducts}
              className="flex-1 py-3 bg-gray-800 text-white font-medium rounded-xl flex items-center justify-center gap-2 border border-gray-700"
            >
              <Plus className="w-5 h-5" />
              Productos
            </button>
            <button
              onClick={handleProcessPayment}
              className="flex-1 py-3 bg-gradient-to-r from-exa-primary to-exa-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Cobrar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
