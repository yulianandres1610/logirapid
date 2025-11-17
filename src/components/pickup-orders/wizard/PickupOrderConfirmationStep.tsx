'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle, Printer, FileText, Loader2, PartyPopper, Mail, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { motion } from 'framer-motion'
import {
  generateReceiptHTML,
  type ReceiptData
} from '@/components/office-orders/templates/receipt-template'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

export default function PickupOrderConfirmationStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [creating, setCreating] = useState(false)
  const [orderCreated, setOrderCreated] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [sendingSMS, setSendingSMS] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const hasCreated = useRef(false)

  useEffect(() => {
    // Prevenir ejecución doble en React StrictMode usando useRef
    if (!hasCreated.current) {
      hasCreated.current = true
      createOrder()
    }
    setCanProceed(true)
  }, [])

  const geocodeAddress = async (addressText: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const mapboxToken = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'
      const encodedAddress = encodeURIComponent(addressText)
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&country=US&limit=1`

      const response = await fetch(url)
      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const [longitude, latitude] = data.features[0].center
        return { latitude, longitude }
      }
      return null
    } catch (error) {
      console.error('Error geocoding address:', error)
      return null
    }
  }

  const createOrder = async () => {
    setCreating(true)
    try {
      const isDelivery = wizardData.orderType === 'entrega'

      // Generar número de orden según el tipo
      const numberResponse = await fetch('/api/package-orders/generate-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderType: wizardData.orderType || 'recogida' })
      })

      const numberData = await numberResponse.json()
      const generatedOrderNumber = numberData.orderNumber

      if (numberData.warning) {
        console.warn('Advertencia al generar número:', numberData.warning)
      }

      // Construir dirección completa del remitente
      const senderFullAddress = [
        wizardData.sender.street || wizardData.sender.address || '',
        wizardData.sender.apartment ? `Apt ${wizardData.sender.apartment}` : '',
        wizardData.sender.city || '',
        wizardData.sender.state || '',
        wizardData.sender.zipCode || '',
        wizardData.sender.country || ''
      ].filter(Boolean).join(', ')

      // Geocodificar la dirección si no tiene coordenadas
      let latitude = wizardData.sender.latitude || null
      let longitude = wizardData.sender.longitude || null

      if (!latitude || !longitude) {
        console.log('📍 [PickupConfirmation] Sender missing coordinates, geocoding:', senderFullAddress)
        const coords = await geocodeAddress(senderFullAddress)
        if (coords) {
          latitude = coords.latitude
          longitude = coords.longitude
          console.log('📍 [PickupConfirmation] Geocoding successful:', coords)
        } else {
          console.warn('📍 [PickupConfirmation] Geocoding failed for:', senderFullAddress)
        }
      } else {
        console.log('📍 [PickupConfirmation] Using existing coordinates:', { latitude, longitude })
      }

      // Preparar datos según el tipo de orden
      let orderData: any

      if (isDelivery) {
        // Orden de ENTREGA de cajas vacías
        const totalEmpaques = wizardData.selectedEmpaques?.reduce((sum: number, e: any) => sum + e.quantity, 0) || 0

        orderData = {
          customerId: wizardData.sender.id,
          customerName: `${wizardData.sender.firstName} ${wizardData.sender.lastName}`, // Remitente
          customerAddress: senderFullAddress || wizardData.sender.address || null, // Dirección del remitente
          orderNumber: generatedOrderNumber,
          services: ['Entrega de Cajas Vacías'],
          notes: `Orden de entrega de ${totalEmpaques} empaques vacíos`,
          scheduledDate: wizardData.scheduledDate || null,
          timeSlot: wizardData.timeSlot || null,
          status: 'pending',
          createdBy: 'system',
          latitude: latitude, // Coordenadas geocodificadas del remitente
          longitude: longitude, // Coordenadas geocodificadas del remitente
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
          orderType: 'entrega',
          firstName: wizardData.sender.firstName, // Remitente
          lastName: wizardData.sender.lastName, // Remitente
          officeOrderData: JSON.stringify({
            senderName: `${wizardData.sender.firstName || ''} ${wizardData.sender.lastName || ''}`.trim(),
            senderPhone: wizardData.sender.phone || '',
            senderEmail: wizardData.sender.email || '',
            senderAddress: senderFullAddress || '',
            receiverName: `${wizardData.recipient.firstName || ''} ${wizardData.recipient.lastName || ''}`.trim(),
            receiverPhone: wizardData.recipient.phone || '',
            receiverEmail: wizardData.recipient.email || '',
            destination: {
              street: wizardData.recipient.street || '',
              apartment: wizardData.recipient.apartment || '',
              city: wizardData.recipient.city || '',
              state: wizardData.recipient.state || '',
              zipCode: wizardData.recipient.zipCode || '',
              country: wizardData.recipient.country || 'Estados Unidos',
              fullAddress: wizardData.recipient.address || ''
            },
            empaques: wizardData.selectedEmpaques || [],
            scheduledDate: wizardData.scheduledDate,
            timeSlot: wizardData.timeSlot,
            deliveryInstructions: wizardData.deliveryInstructions || ''
          })
        }
      } else {
        // Orden de RECOGIDA a domicilio
        const totalBoxCount = wizardData.serviceConfigs?.reduce((sum: number, config: any) => {
          return sum + (config.boxes?.length || 0)
        }, 0) || 0

        console.log('📍 [PickupConfirmation] wizardData.sender:', {
          hasLatitude: !!wizardData.sender.latitude,
          hasLongitude: !!wizardData.sender.longitude,
          latitude: wizardData.sender.latitude,
          longitude: wizardData.sender.longitude,
          street: wizardData.sender.street,
          city: wizardData.sender.city
        })

        orderData = {
          customerId: wizardData.sender.id,
          customerName: `${wizardData.sender.firstName} ${wizardData.sender.lastName}`,
          customerAddress: senderFullAddress || wizardData.sender.address || null,
          orderNumber: generatedOrderNumber,
          services: wizardData.selectedServices.map((s: any) => s.name),
          notes: 'Orden de recogida creada desde wizard',
          scheduledDate: wizardData.scheduledDate || null,
          timeSlot: wizardData.timeSlot || null,
          status: 'pending',
          createdBy: 'system',
          latitude: latitude, // Coordenadas geocodificadas
          longitude: longitude, // Coordenadas geocodificadas
          subtotal: wizardData.totalAmount,
          taxAmount: 0,
          totalAmount: wizardData.totalAmount,
          orderType: 'recogida',
          firstName: wizardData.sender.firstName,
          lastName: wizardData.sender.lastName,
          officeOrderData: JSON.stringify({
            senderName: `${wizardData.sender.firstName || ''} ${wizardData.sender.lastName || ''}`.trim(),
            senderPhone: wizardData.sender.phone || '',
            senderEmail: wizardData.sender.email || '',
            senderAddress: senderFullAddress || '',
            receiverName: `${wizardData.recipient.firstName || ''} ${wizardData.recipient.lastName || ''}`.trim(),
            receiverPhone: wizardData.recipient.phone || '',
            receiverEmail: wizardData.recipient.email || '',
            destination: {
              street: wizardData.recipient.street || '',
              apartment: wizardData.recipient.apartment || '',
              city: wizardData.recipient.city || '',
              state: wizardData.recipient.state || '',
              zipCode: wizardData.recipient.zipCode || '',
              country: wizardData.recipient.country || 'Estados Unidos',
              fullAddress: wizardData.recipient.address || ''
            },
            boxCount: totalBoxCount,
            estimatedBoxCount: totalBoxCount,
            serviceConfigs: wizardData.serviceConfigs,
            payments: wizardData.payments || [],
            scheduledDate: wizardData.scheduledDate,
            timeSlot: wizardData.timeSlot,
            pickupInstructions: wizardData.pickupInstructions || ''
          })
        }
      }

      console.log(`Creando orden de ${isDelivery ? 'entrega' : 'recogida'}:`, orderData)

      const response = await fetch('/api/package-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      const data = await response.json()
      console.log(`=== RESPUESTA CREACIÓN ORDEN ${isDelivery ? 'ENTREGA' : 'RECOGIDA'} ===`)
      console.log('Status:', response.status)
      console.log('Data:', JSON.stringify(data, null, 2))
      console.log('=========================================')

      if (data.success) {
        const createdOrderNumber = data.data.orderNumber
        const createdOrderId = data.data.id

        setOrderNumber(createdOrderNumber)
        updateWizardData('orderId', createdOrderId)
        updateWizardData('orderNumber', createdOrderNumber)

        setOrderCreated(true)
      } else {
        console.error(`=== ERROR AL CREAR ORDEN DE ${isDelivery ? 'ENTREGA' : 'RECOGIDA'} ===`)
        console.error('Error:', data.error)
        console.error('Detalles:', data.details)
        console.error('=========================================')
        // Continuar al paso final incluso si hay error
        setOrderNumber(generatedOrderNumber)
        updateWizardData('orderNumber', generatedOrderNumber)
        setOrderCreated(true)
      }
    } catch (error) {
      console.error('Error creating order:', error)
      const isDelivery = wizardData.orderType === 'entrega'
      const errorNumber = `${isDelivery ? 'DELIVERY' : 'PICKUP'}-ERROR${Date.now().toString().slice(-6)}`
      setOrderNumber(errorNumber)
      updateWizardData('orderNumber', errorNumber)
      updateWizardData('hasError', true)
      setOrderCreated(true)
    } finally {
      setCreating(false)
    }
  }

  const sendSMSNotification = async () => {
    setSendingSMS(true)
    try {
      // TODO: Implementar envío de SMS
      // Placeholder para integración futura con Twilio/similar
      console.log('Enviando SMS a:', wizardData.sender.phone)

      await new Promise(resolve => setTimeout(resolve, 1500)) // Simular envío

      alert(`SMS enviado exitosamente a ${wizardData.sender.phone}`)
    } catch (error) {
      console.error('Error sending SMS:', error)
      alert('Error al enviar SMS')
    } finally {
      setSendingSMS(false)
    }
  }

  const sendEmailNotification = async () => {
    setSendingEmail(true)
    try {
      // TODO: Implementar envío de Email
      // Placeholder para integración futura con SendGrid/similar
      console.log('Enviando Email a:', wizardData.sender.email)

      await new Promise(resolve => setTimeout(resolve, 1500)) // Simular envío

      alert(`Email enviado exitosamente a ${wizardData.sender.email}`)
    } catch (error) {
      console.error('Error sending email:', error)
      alert('Error al enviar email')
    } finally {
      setSendingEmail(false)
    }
  }

  const printInvoice = () => {
    // Obtener nombre de la compañía
    const getCompanyName = (): string => {
      try {
        const cookies = document.cookie.split(';')
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=')
          if (name === 'user-company-name') {
            return decodeURIComponent(value)
          }
        }
      } catch (error) {
        console.error('Error reading company name:', error)
      }
      return 'LogiRapid'
    }

    const companyName = getCompanyName()
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Orden de Recogida ${orderNumber}</title>
            <style>
              @page { size: letter; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }

              body {
                font-family: Arial, Helvetica, sans-serif;
                padding: 0.5in;
                width: 8.5in;
                min-height: 11in;
                margin: 0;
                color: #000;
                background: white;
                line-height: 1.6;
              }

              .invoice-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                padding-bottom: 30px;
                border-bottom: 3px solid #F59E0B;
                margin-bottom: 30px;
              }

              .company-info h1 {
                font-size: 28px;
                font-weight: 700;
                color: #F59E0B;
                margin-bottom: 5px;
              }

              .company-info p {
                font-size: 14px;
                color: #666;
              }

              .invoice-info {
                text-align: right;
              }

              .invoice-title {
                font-size: 28px;
                font-weight: 700;
                color: #000;
                margin-bottom: 5px;
              }

              .invoice-subtitle {
                font-size: 16px;
                color: #F59E0B;
                font-weight: 600;
                margin-bottom: 10px;
              }

              .invoice-number {
                font-size: 14px;
                color: #666;
              }

              .invoice-number span {
                font-weight: 700;
                color: #F59E0B;
              }

              .status-badge {
                display: inline-block;
                background: #FEF3C7;
                color: #92400E;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 700;
                text-transform: uppercase;
                margin-top: 10px;
              }

              .info-section {
                background: #F8F9FA;
                padding: 20px;
                margin-bottom: 30px;
                border-left: 4px solid #F59E0B;
              }

              .info-section h3 {
                font-size: 12px;
                text-transform: uppercase;
                color: #F59E0B;
                font-weight: 700;
                margin-bottom: 10px;
              }

              .info-section p {
                font-size: 14px;
                margin-bottom: 4px;
              }

              .two-columns {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }

              thead {
                background: #F59E0B;
                color: white;
              }

              th {
                padding: 12px;
                text-align: left;
                font-weight: 600;
                font-size: 12px;
                text-transform: uppercase;
              }

              td {
                padding: 12px;
                border-bottom: 1px solid #E5E7EB;
                font-size: 14px;
              }

              tbody tr:last-child td {
                border-bottom: 2px solid #F59E0B;
              }

              .totals {
                margin-top: 30px;
                text-align: right;
              }

              .total-row {
                display: flex;
                justify-content: flex-end;
                gap: 40px;
                padding: 8px 0;
                font-size: 16px;
              }

              .total-row.grand {
                background: #F59E0B;
                color: white;
                padding: 15px 20px;
                margin-top: 10px;
                font-size: 20px;
                font-weight: 700;
              }

              .footer {
                margin-top: 50px;
                padding-top: 20px;
                border-top: 2px solid #E5E7EB;
                text-align: center;
                font-size: 12px;
                color: #666;
              }

              .instructions-box {
                background: #FFFBEB;
                border: 2px dashed #F59E0B;
                padding: 15px;
                margin: 20px 0;
                border-radius: 8px;
              }

              .instructions-box h4 {
                color: #F59E0B;
                font-size: 14px;
                font-weight: 700;
                margin-bottom: 8px;
              }

              .instructions-box p {
                font-size: 13px;
                color: #92400E;
              }

              @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="invoice-header">
              <div class="company-info">
                <h1>${companyName}</h1>
                <p>Sistema de Gestión de Paquetería</p>
              </div>
              <div class="invoice-info">
                <div class="invoice-title">ORDEN DE RECOGIDA</div>
                <div class="invoice-subtitle">Pickup Order</div>
                <div class="invoice-number">No. <span>${orderNumber}</span></div>
                <div class="invoice-number">${new Date().toLocaleDateString('es-ES')}</div>
                <div class="status-badge">PENDIENTE</div>
              </div>
            </div>

            <div class="two-columns">
              <div class="info-section">
                <h3>Dirección de Recogida</h3>
                <p><strong>${wizardData.sender.firstName} ${wizardData.sender.lastName}</strong></p>
                <p>${wizardData.sender.phone}</p>
                ${wizardData.sender.email ? `<p>${wizardData.sender.email}</p>` : ''}
                <p style="margin-top: 8px;">${wizardData.sender.address || 'N/A'}</p>
              </div>

              <div class="info-section">
                <h3>Destinatario</h3>
                <p><strong>${wizardData.recipient.firstName} ${wizardData.recipient.lastName}</strong></p>
                <p>${wizardData.recipient.phone}</p>
                ${wizardData.recipient.email ? `<p>${wizardData.recipient.email}</p>` : ''}
                <p style="margin-top: 8px;">${wizardData.recipient.city || ''}, ${wizardData.recipient.state || ''}</p>
              </div>
            </div>

            ${wizardData.scheduledDate ? `
            <div class="instructions-box">
              <h4>📅 Fecha Programada de Recogida</h4>
              <p><strong>Fecha:</strong> ${new Date(wizardData.scheduledDate).toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</p>
              ${wizardData.timeSlot ? `<p><strong>Horario:</strong> ${wizardData.timeSlot}</p>` : ''}
            </div>
            ` : ''}

            <table>
              <thead>
                <tr>
                  <th style="width: 50%;">Servicio</th>
                  <th style="width: 20%; text-align: center;">Cajas Estimadas</th>
                  <th style="width: 15%; text-align: right;">Precio</th>
                  <th style="width: 15%; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${wizardData.serviceConfigs.map((config: any) => {
                  const boxCount = config.boxes?.length || 0
                  const serviceTotal = config.basePrice * boxCount
                  return `
                    <tr>
                      <td>${config.serviceName}</td>
                      <td style="text-align: center;">${boxCount}</td>
                      <td style="text-align: right;">$${config.basePrice.toFixed(2)}</td>
                      <td style="text-align: right;">$${serviceTotal.toFixed(2)}</td>
                    </tr>
                  `
                }).join('')}
              </tbody>
            </table>

            <div class="instructions-box">
              <h4>ℹ️ Instrucciones Importantes</h4>
              <p>• Los códigos de empaque serán asignados por el repartidor durante la recogida</p>
              <p>• El número exacto de cajas puede variar según lo recogido</p>
              <p>• Esta orden está en estado PENDIENTE hasta que se realice la recogida</p>
              ${wizardData.pickupInstructions ? `<p>• <strong>Notas:</strong> ${wizardData.pickupInstructions}</p>` : ''}
            </div>

            <div class="totals">
              <div class="total-row">
                <span>Total Estimado:</span>
                <span>$${wizardData.totalAmount.toFixed(2)}</span>
              </div>
              <div class="total-row grand">
                <span>TOTAL:</span>
                <span>$${wizardData.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div class="footer">
              Orden de Recogida - ${companyName} - ${orderNumber}
            </div>

            <script>window.print(); window.close();</script>
          </body>
        </html>
      `)
    }
  }

  const printThermalReceipt = () => {
    // Obtener nombre de la compañía
    const getCompanyName = (): string => {
      try {
        const cookies = document.cookie.split(';')
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=')
          if (name === 'user-company-name') {
            return decodeURIComponent(value)
          }
        }
      } catch (error) {
        console.error('Error reading company name:', error)
      }
      return 'LogiRapid'
    }

    // Preparar datos del recibo
    const receiptData: ReceiptData = {
      companyName: getCompanyName(),
      orderNumber: orderNumber,
      timestamp: new Date().toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      sender: {
        name: `${wizardData.sender.firstName} ${wizardData.sender.lastName}`,
        phone: wizardData.sender.phone
      },
      recipient: {
        name: wizardData.recipient
          ? `${wizardData.recipient.firstName} ${wizardData.recipient.lastName}`
          : 'N/A',
        phone: wizardData.recipient?.phone || '',
        city: wizardData.recipient?.city || '',
        state: wizardData.recipient?.state || ''
      },
      services: wizardData.serviceConfigs.map((config: any) => ({
        name: config.serviceName,
        quantity: config.boxes?.length || 0,
        price: config.basePrice
      })),
      payments: wizardData.payments?.map((payment: any) => ({
        method: payment.method === 'cash' ? 'Efectivo' : payment.method === 'zelle' ? 'Zelle' : 'Tarjeta',
        amount: payment.amount
      })) || [],
      subtotal: wizardData.totalAmount,
      total: wizardData.totalAmount,
      paid: wizardData.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0,
      change: undefined,
      remaining: undefined
    }

    // Calcular cambio o restante
    if (receiptData.paid > receiptData.total) {
      receiptData.change = receiptData.paid - receiptData.total
    } else if (receiptData.paid < receiptData.total) {
      receiptData.remaining = receiptData.total - receiptData.paid
    }

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const html = generateReceiptHTML(receiptData)
      printWindow.document.write(html)
      printWindow.document.close()
    }
  }

  const isDelivery = wizardData.orderType === 'entrega'

  if (creating) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className={cn(
          "w-16 h-16 animate-spin mb-4",
          isDelivery ? 'text-green-600' : 'text-amber-600'
        )} />
        <p className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Creando orden de {isDelivery ? 'entrega' : 'recogida'}...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Centered Icon Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            duration: 0.6
          }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center",
            "bg-gradient-to-br shadow-2xl",
            theme === 'dark'
              ? isDelivery
                ? 'from-green-600 to-green-700 shadow-green-500/30'
                : 'from-amber-600 to-amber-700 shadow-amber-500/30'
              : isDelivery
              ? 'from-green-500 to-green-600 shadow-green-400/30'
              : 'from-amber-500 to-amber-600 shadow-amber-400/30'
          )}
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1
            }}
          >
            <PartyPopper className="w-10 h-10 text-white" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className={cn("text-3xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            ¡Orden de {isDelivery ? 'Entrega' : 'Recogida'} Creada!
          </h2>
          <p className={cn("text-base", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
            Número de Orden: <span className={cn("font-bold", isDelivery ? 'text-green-600' : 'text-amber-600')}>{orderNumber}</span>
          </p>
          <p className={cn("text-sm mt-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            Estado: <span className={cn("font-semibold", isDelivery ? 'text-green-500' : 'text-amber-500')}>PENDIENTE</span>
          </p>
        </motion.div>
      </div>

      {/* Order Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={cn(
          "p-8 rounded-2xl backdrop-blur-sm border",
          theme === 'dark'
            ? 'bg-gray-800/50 border-gray-700/50 shadow-xl shadow-black/20'
            : 'bg-white/50 border-gray-200/50 shadow-xl shadow-gray-200/50'
        )}
      >
        <h3 className={cn("font-semibold mb-6 text-lg", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Resumen de la Orden
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Cliente:</span>
            <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {wizardData.sender.firstName} {wizardData.sender.lastName}
            </span>
          </div>

          {isDelivery ? (
            <>
              {/* For delivery orders - show empaques */}
              <div className="flex justify-between items-center">
                <span className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Total Empaques:</span>
                <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {wizardData.selectedEmpaques?.reduce((sum: number, e: any) => sum + e.quantity, 0) || 0}
                </span>
              </div>
              {wizardData.selectedEmpaques?.map((empaque: any) => (
                <div key={empaque.package_size_id} className="flex justify-between items-center pl-4">
                  <span className={cn("text-sm", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                    {empaque.package_size_name}:
                  </span>
                  <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {empaque.quantity} unidades
                  </span>
                </div>
              ))}
            </>
          ) : (
            <>
              {/* For pickup orders - show services and boxes */}
              <div className="flex justify-between items-center">
                <span className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Servicios:</span>
                <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {wizardData.selectedServices.length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Cajas Estimadas:</span>
                <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {wizardData.serviceConfigs?.reduce((sum: number, config: any) => sum + (config.boxes?.length || 0), 0) || 0}
                </span>
              </div>
            </>
          )}

          {wizardData.scheduledDate && (
            <div className="flex justify-between items-center">
              <span className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Fecha Programada:</span>
              <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {new Date(wizardData.scheduledDate).toLocaleDateString('es-ES')}
              </span>
            </div>
          )}

          {!isDelivery && (
            <div className={cn(
              "flex justify-between items-center font-bold text-xl pt-4 mt-4 border-t",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Total Estimado:</span>
              <span className="text-amber-600">${wizardData.totalAmount.toFixed(2)}</span>
            </div>
          )}

          {isDelivery && (
            <div className={cn(
              "flex justify-center items-center font-bold text-lg pt-4 mt-4 border-t",
              theme === 'dark' ? 'border-gray-700 text-green-400' : 'border-gray-200 text-green-600'
            )}>
              <CheckCircle className="w-5 h-5 mr-2" />
              Entrega Gratuita • Sin Costo
            </div>
          )}
        </div>
      </motion.div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className={cn(
          'rounded-xl border p-4 flex items-start gap-3',
          theme === 'dark'
            ? isDelivery
              ? 'bg-green-500/10 border-green-500/20'
              : 'bg-amber-500/10 border-amber-500/20'
            : isDelivery
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'
        )}
      >
        <CheckCircle className={cn(
          "w-5 h-5 flex-shrink-0 mt-0.5",
          isDelivery ? 'text-green-500' : 'text-amber-500'
        )} />
        <div className="flex-1">
          <p className={cn(
            'text-sm',
            theme === 'dark'
              ? isDelivery ? 'text-green-300' : 'text-amber-300'
              : isDelivery ? 'text-green-700' : 'text-amber-700'
          )}>
            {isDelivery ? (
              <>
                <strong>Próximos pasos:</strong> Esta orden de entrega está en estado PENDIENTE.
                Un repartidor será asignado para entregar los empaques vacíos en la dirección indicada.
                Este servicio es completamente gratuito.
              </>
            ) : (
              <>
                <strong>Próximos pasos:</strong> Esta orden está en estado PENDIENTE.
                Un repartidor será asignado para recoger los paquetes. Los códigos de empaque
                serán asignados durante la recogida.
              </>
            )}
          </p>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <Button
          onClick={printInvoice}
          className="flex items-center justify-center gap-2 bg-amber-600 text-white hover:bg-amber-700 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <FileText className="w-5 h-5" />
          Imprimir Orden
        </Button>
        <Button
          onClick={printThermalReceipt}
          className="flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <Printer className="w-5 h-5" />
          Recibo Térmico
        </Button>
      </motion.div>

      {/* Notification Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <Button
          onClick={sendSMSNotification}
          disabled={sendingSMS || !wizardData.sender.phone}
          className={cn(
            "flex items-center justify-center gap-2 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all",
            sendingSMS || !wizardData.sender.phone
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {sendingSMS ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <MessageSquare className="w-5 h-5" />
          )}
          {sendingSMS ? 'Enviando...' : 'Enviar SMS'}
        </Button>
        <Button
          onClick={sendEmailNotification}
          disabled={sendingEmail || !wizardData.sender.email}
          className={cn(
            "flex items-center justify-center gap-2 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all",
            sendingEmail || !wizardData.sender.email
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          )}
        >
          {sendingEmail ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Mail className="w-5 h-5" />
          )}
          {sendingEmail ? 'Enviando...' : 'Enviar Email'}
        </Button>
      </motion.div>
    </div>
  )
}
