'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Package, Users, MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import Spinner from '@/components/ui/Spinner'
import {
  generateShippingLabelHTML,
  type ShippingLabelData
} from '@/components/office-orders/templates/shipping-label-template'

// Import detail components
import OrderHeader from '@/components/office-orders/details/OrderHeader'
import PersonInfoCard from '@/components/office-orders/details/PersonInfoCard'
import ServiceBoxesCard from '@/components/office-orders/details/ServiceBoxesCard'
import PaymentSummaryCard from '@/components/office-orders/details/PaymentSummaryCard'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

interface OrderData {
  id: number
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  officeOrderData: any
}

export default function OfficeOrderDetailPage() {
  const params = useParams()
  const { theme } = useTheme()
  const [order, setOrder] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trazabilidadMap, setTrazabilidadMap] = useState<Map<number, any[]>>(new Map())
  const printFrameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    fetchOrderDetails()
  }, [params.id])

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/package-orders?id=${params.id}`)
      const data = await response.json()

      if (data.success && data.data && data.data.length > 0) {
        const orderData = data.data[0]

        // Parse officeOrderData if it's a string
        if (typeof orderData.officeOrderData === 'string') {
          orderData.officeOrderData = JSON.parse(orderData.officeOrderData)
        }

        setOrder(orderData)

        // Fetch trazabilidad for each empaque
        await fetchTrazabilidadForOrder(orderData)
      } else {
        setError('Orden no encontrada')
      }
    } catch (err) {
      console.error('Error fetching order:', err)
      setError('Error al cargar los detalles de la orden')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrazabilidadForOrder = async (orderData: OrderData) => {
    try {
      const officeData = orderData.officeOrderData || {}
      const labels = officeData.labels || []

      const trazMap = new Map<number, any[]>()

      // Fetch trazabilidad for each label
      for (const label of labels) {
        let empaqueId = label.empaqueId

        // Fallback: Si no tiene empaqueId guardado, buscar por boxCode
        if (!empaqueId && label.boxCode) {
          try {
            const empaqueResponse = await fetch(`/api/empaques?codigo=${encodeURIComponent(label.boxCode)}`)
            const empaqueData = await empaqueResponse.json()

            if (empaqueData.success && empaqueData.empaques && empaqueData.empaques.length > 0) {
              empaqueId = empaqueData.empaques[0].id
              // Actualizar label con el empaqueId encontrado para futuras referencias
              label.empaqueId = empaqueId
            }
          } catch (err) {
            console.error(`Error fetching empaque by code ${label.boxCode}:`, err)
          }
        }

        // Fetch trazabilidad si tenemos empaqueId
        if (empaqueId) {
          try {
            const trazResponse = await fetch(`/api/empaques/${empaqueId}?trazabilidad=true`)
            const trazData = await trazResponse.json()

            if (trazData.success && trazData.trazabilidad) {
              trazMap.set(empaqueId, trazData.trazabilidad)
            }
          } catch (err) {
            console.error(`Error fetching trazabilidad for empaque ${empaqueId}:`, err)
          }
        }
      }

      setTrazabilidadMap(trazMap)
    } catch (err) {
      console.error('Error fetching trazabilidad:', err)
    }
  }

  const handlePrintLabels = () => {
    if (!order?.officeOrderData?.labels) return

    const labels = order.officeOrderData.labels
    const printWindow = window.open('', '_blank')

    if (!printWindow) {
      alert('Por favor, permite ventanas emergentes para imprimir')
      return
    }

    // Generar HTML para cada etiqueta usando el template oficial
    const labelHTMLs = labels.map((label: any) => {
      const labelData: ShippingLabelData = {
        companyName: label.companyName || 'LogiRapid',
        boxNumber: label.boxNumber,
        totalBoxes: label.totalBoxes,
        boxCode: label.boxCode,
        sender: {
          name: label.sender,
          address: label.senderAddress || '',
          phone: label.senderPhone
        },
        recipient: {
          name: label.recipient,
          address: label.recipientAddress,
          phone: label.recipientPhone,
          city: label.recipientCity,
          state: label.recipientState
        },
        service: {
          name: label.serviceName,
          weight: label.weight,
          weightKg: label.weightKg
        },
        warehouse: {
          code: 'ALM-001', // Default warehouse code
          name: 'Almacén Principal'
        },
        barcodeDataUrl: label.barcodeDataUrl || '',
        qrCodeDataUrl: label.qrCodeDataUrl,
        warehouseBarcodeDataUrl: label.warehouseBarcodeDataUrl,
        printTimestamp: new Date().toLocaleString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }

      return generateShippingLabelHTML(labelData)
    })

    // Combinar todas las etiquetas en un solo documento
    const combinedHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Etiquetas - ${order.orderNumber}</title>
      </head>
      <body>
        ${labelHTMLs.join('\n')}
      </body>
      </html>
    `

    printWindow.document.write(combinedHTML)
    printWindow.document.close()
  }

  const handlePrintSingleLabel = (label: any) => {
    const printWindow = window.open('', '_blank')

    if (!printWindow) {
      alert('Por favor, permite ventanas emergentes para imprimir')
      return
    }

    // Preparar datos para el template
    const labelData: ShippingLabelData = {
      companyName: label.companyName || 'LogiRapid',
      boxNumber: label.boxNumber,
      totalBoxes: label.totalBoxes,
      boxCode: label.boxCode,
      sender: {
        name: label.sender,
        address: label.senderAddress || '',
        phone: label.senderPhone
      },
      recipient: {
        name: label.recipient,
        address: label.recipientAddress,
        phone: label.recipientPhone,
        city: label.recipientCity,
        state: label.recipientState
      },
      service: {
        name: label.serviceName,
        weight: label.weight,
        weightKg: label.weightKg
      },
      warehouse: {
        code: 'ALM-001', // Default warehouse code
        name: 'Almacén Principal'
      },
      barcodeDataUrl: label.barcodeDataUrl || '',
      qrCodeDataUrl: label.qrCodeDataUrl,
      warehouseBarcodeDataUrl: label.warehouseBarcodeDataUrl,
      printTimestamp: new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    // Generar HTML usando el template oficial
    const labelHTML = generateShippingLabelHTML(labelData)

    printWindow.document.write(labelHTML)
    printWindow.document.close()
  }

  const handlePrintInvoice = () => {
    alert('Función de imprimir factura en desarrollo')
  }

  const handlePrintReceipt = () => {
    alert('Función de imprimir recibo en desarrollo')
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Spinner size="lg" text="Cargando detalles de la orden..." />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-red-500 mb-4">
              {error || 'Orden no encontrada'}
            </p>
            <button
              onClick={() => window.history.back()}
              className="text-blue-500 hover:text-blue-600 underline"
            >
              Volver atrás
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const officeData = order.officeOrderData || {}
  const serviceConfigs = officeData.serviceConfigs || []
  const labels = officeData.labels || []
  const payments = officeData.payments || []

  // Build service breakdown for payment card
  const serviceBreakdown = serviceConfigs.map((config: any) => ({
    name: config.serviceName,
    quantity: config.boxes?.length || 0,
    unitPrice: config.basePrice || 0,
    total: (config.basePrice || 0) * (config.boxes?.length || 0)
  }))

  // Format address helper
  const formatAddress = (destination: any) => {
    if (!destination) return 'Sin dirección'
    if (destination.fullAddress) return destination.fullAddress

    const parts = []
    if (destination.street) parts.push(destination.street)
    if (destination.apartment) parts.push(`Apt: ${destination.apartment}`)
    if (destination.city) parts.push(destination.city)
    if (destination.state) parts.push(destination.state)
    if (destination.zipCode) parts.push(destination.zipCode)
    if (destination.country && destination.country !== 'Estados Unidos') parts.push(destination.country)

    return parts.length > 0 ? parts.join(', ') : 'Sin dirección'
  }

  return (
    <DashboardLayout>
      <div className={cn(
        'min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Order Header */}
          <OrderHeader
            orderNumber={order.orderNumber}
            status={order.status}
            createdAt={order.createdAt}
            onPrintLabels={handlePrintLabels}
            onPrintInvoice={handlePrintInvoice}
            onPrintReceipt={handlePrintReceipt}
          />

          {/* Overview Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-2xl border p-6 shadow-lg',
              theme === 'dark'
                ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
                : 'bg-white border-gray-200'
            )}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                  <Package className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Total de Cajas
                  </p>
                  <p className={cn(
                    'text-2xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {officeData.boxCount || 0}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
                  <Package className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Servicios
                  </p>
                  <p className={cn(
                    'text-2xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {serviceConfigs.length}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                  <Package className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Monto Total
                  </p>
                  <p className={cn(
                    'text-2xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    ${order.totalAmount ? Number(order.totalAmount).toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sender and Recipient */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PersonInfoCard
              title="Remitente"
              name={officeData.senderName || 'N/A'}
              phone={officeData.senderPhone}
              email={officeData.senderEmail}
              address={officeData.senderAddress}
              icon={<Users className="w-6 h-6 text-white" />}
              iconColor="blue"
            />

            <PersonInfoCard
              title="Destinatario"
              name={officeData.receiverName || 'N/A'}
              phone={officeData.receiverPhone}
              email={officeData.receiverEmail}
              address={formatAddress(officeData.destination)}
              icon={<MapPin className="w-6 h-6 text-white" />}
              iconColor="purple"
            />
          </div>

          {/* Services and Boxes */}
          <div className="space-y-4">
            <h2 className={cn(
              'text-2xl font-bold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Servicios y Empaques
            </h2>
            {serviceConfigs.map((config: any, index: number) => (
              <ServiceBoxesCard
                key={index}
                serviceName={config.serviceName}
                servicePrice={config.basePrice * (config.boxes?.length || 0)}
                boxes={config.boxes || []}
                serviceIndex={index}
                labels={labels}
                trazabilidadMap={trazabilidadMap}
              />
            ))}
          </div>

          {/* Payment Summary */}
          <PaymentSummaryCard
            serviceBreakdown={serviceBreakdown}
            payments={payments}
            totalAmount={order.totalAmount ? Number(order.totalAmount) : 0}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
