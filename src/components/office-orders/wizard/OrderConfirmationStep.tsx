'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle, Printer, Download, FileText, Loader2, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { motion } from 'framer-motion'
import {
  generateShippingLabelHTML,
  type ShippingLabelData
} from '../templates/shipping-label-template'
import {
  generateReceiptHTML,
  type ReceiptData
} from '../templates/receipt-template'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

export default function OrderConfirmationStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [creating, setCreating] = useState(false)
  const [orderCreated, setOrderCreated] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const hasCreated = useRef(false)

  useEffect(() => {
    // Prevenir ejecución doble en React StrictMode usando useRef
    if (!hasCreated.current) {
      hasCreated.current = true
      createOrder()
    }
    setCanProceed(true)
  }, [])

  const createOrder = async () => {
    setCreating(true)
    try {
      // Generar número de orden SHIPPING-XXX
      const numberResponse = await fetch('/api/package-orders/generate-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderType: 'oficina' })
      })

      const numberData = await numberResponse.json()

      // El API ahora siempre retorna success:true con un número válido
      const generatedOrderNumber = numberData.orderNumber

      if (numberData.warning) {
        console.warn('Advertencia al generar número:', numberData.warning)
      }

      // Calcular cantidad total de cajas
      const totalBoxCount = wizardData.serviceConfigs?.reduce((sum: number, config: any) => {
        return sum + (config.boxes?.length || 0)
      }, 0) || 0

      // Recalcular el monto total para asegurar que tenemos el valor correcto
      const calculatedTotalAmount = wizardData.serviceConfigs?.reduce((sum: number, config: any) => {
        const boxCount = config.boxes?.length || 0
        return sum + (config.basePrice * boxCount)
      }, 0) || 0
      const totalAmount = wizardData.totalAmount || calculatedTotalAmount

      // Calcular monto pagado y determinar estado de pago
      const paidAmount = wizardData.payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0

      // IMPORTANTE: Solo es COD si el método es explícitamente 'cod'
      // 'cash' (efectivo) es un pago inmediato, NO es COD (Cash on Delivery)
      const hasCODPayment = wizardData.payments?.some((p: any) => p.method === 'cod')

      console.log('=== PAYMENT STATUS DEBUG ===')
      console.log('totalAmount:', totalAmount)
      console.log('paidAmount:', paidAmount)
      console.log('hasCODPayment:', hasCODPayment)
      console.log('payments:', wizardData.payments)
      console.log('============================')

      // Determinar paymentMethod y paymentStatus
      let paymentMethod = 'cod' // Default
      let paymentStatus = 'pending_payment' // Default

      if (wizardData.payments && wizardData.payments.length > 0) {
        // Usar el primer método de pago como el principal
        paymentMethod = wizardData.payments[0].method || 'cod'

        // Lógica de estado de pago:
        // 1. Si hay COD -> siempre pending_payment (se paga en la entrega)
        // 2. Si se pagó el total con cash/zelle/card -> paid
        // 3. Si se pagó parcialmente con cash/zelle/card -> partial
        // 4. Sin pagos -> pending_payment
        if (hasCODPayment) {
          // COD: el pago se realizará en la entrega
          paymentStatus = 'pending_payment'
          paymentMethod = 'cod'
        } else if (paidAmount >= totalAmount && totalAmount > 0) {
          // Pago completo con efectivo, zelle o tarjeta
          paymentStatus = 'paid'
        } else if (paidAmount > 0) {
          // Pago parcial
          paymentStatus = 'partial'
        }
        // Si ninguna condición se cumple, se mantiene pending_payment
      }

      console.log('=== FINAL PAYMENT STATUS ===')
      console.log('paymentMethod:', paymentMethod)
      console.log('paymentStatus:', paymentStatus)
      console.log('============================')

      // Construir dirección completa del destinatario para el campo customerAddress
      const apt = wizardData.recipient.apartment || ''
      const recipientFullAddress = [
        wizardData.recipient.street || '',
        apt ? (apt.toLowerCase().startsWith('apt') ? apt : `Apt ${apt}`) : '',
        wizardData.recipient.city || '',
        wizardData.recipient.state || '',
        wizardData.recipient.zipCode || '',
        wizardData.recipient.country || 'Estados Unidos'
      ].filter(Boolean).join(', ')

      // Preparar datos para crear la orden
      const orderData = {
        customerId: wizardData.sender.id,
        customerName: `${wizardData.sender.firstName} ${wizardData.sender.lastName}`,
        customerAddress: recipientFullAddress || wizardData.recipient.address || null,
        // Campos de dirección estructurados
        street: wizardData.recipient.street || null,
        apartment: wizardData.recipient.apartment || null,
        city: wizardData.recipient.city || null,
        state: wizardData.recipient.state || null,
        country: wizardData.recipient.country || 'US',
        zipcode: wizardData.recipient.zipCode || null,
        orderNumber: generatedOrderNumber,
        services: wizardData.selectedServices.map((s: any) => s.name),
        notes: 'Orden creada desde wizard de oficina',
        // No enviamos status - la API lo determina según orderType ('picked_up' para oficina)
        createdBy: 'system',
        subtotal: wizardData.totalAmount,
        taxAmount: 0,
        totalAmount: wizardData.totalAmount,
        orderType: 'oficina',
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        paidAmount: paidAmount,
        officeOrderData: JSON.stringify({
          senderName: `${wizardData.sender.firstName || ''} ${wizardData.sender.lastName || ''}`.trim(),
          senderPhone: wizardData.sender.phone || '',
          senderEmail: wizardData.sender.email || '',
          senderAddress: wizardData.sender.address || '', // Dirección completa legacy
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
            // Si no hay campos estructurados, guardar la dirección completa legacy
            fullAddress: wizardData.recipient.address || ''
          },
          boxCount: totalBoxCount,
          serviceConfigs: wizardData.serviceConfigs,
          labels: wizardData.labels,
          payments: wizardData.payments
        })
      }

      console.log('Enviando datos de orden:', orderData)
      console.log('wizardData.sender:', wizardData.sender)
      console.log('wizardData.recipient:', wizardData.recipient)
      console.log('=== TELÉFONOS ===')
      console.log('Sender phone:', wizardData.sender.phone)
      console.log('Recipient phone:', wizardData.recipient.phone)
      console.log('officeOrderData parseado:', JSON.parse(orderData.officeOrderData))

      const response = await fetch('/api/package-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      const data = await response.json()
      console.log('=== RESPUESTA COMPLETA DEL SERVIDOR ===')
      console.log('Status:', response.status)
      console.log('Data:', JSON.stringify(data, null, 2))
      console.log('=====================================')

      if (data.success) {
        const createdOrderNumber = data.data.orderNumber
        const createdOrderId = data.data.id

        setOrderNumber(createdOrderNumber)
        updateWizardData('orderId', createdOrderId)
        updateWizardData('orderNumber', createdOrderNumber)

        // Asignar empaques pre-etiquetados y actualizar warehouse de la orden
        await assignPackagesToOrder(createdOrderId, createdOrderNumber)

        setOrderCreated(true)
      } else {
        console.error('=== ERROR AL CREAR ORDEN ===')
        console.error('Error:', data.error)
        console.error('Detalles:', data.details)
        console.error('Response status:', response.status)
        console.error('Data completa:', data)
        console.error('===========================')
        // Continuar al paso final incluso si hay error
        setOrderNumber(generatedOrderNumber)
        updateWizardData('orderNumber', generatedOrderNumber)
        setOrderCreated(true)
      }
    } catch (error) {
      console.error('Error creating order:', error)
      // Continuar al paso final con un mensaje de error visible
      const errorNumber = `ERROR${Date.now().toString().slice(-6)}`
      setOrderNumber(errorNumber)
      updateWizardData('orderNumber', errorNumber)
      updateWizardData('hasError', true)
      setOrderCreated(true)
    } finally {
      setCreating(false)
    }
  }

  const assignPackagesToOrder = async (orderId: number, orderNumber: string) => {
    try {
      // Obtener todos los empaques que tienen empaqueId con sus datos completos
      const packagesToAssign: any[] = []
      const empaqueIdMap = new Map<string, number>() // boxCode -> empaqueId

      wizardData.labels.forEach((label: any) => {
        // Buscar el box correspondiente que tiene el empaqueId
        wizardData.serviceConfigs.forEach((config: any) => {
          const matchingBox = config.boxes.find((box: any) => box.boxCode === label.boxCode)
          if (matchingBox && matchingBox.empaqueId) {
            packagesToAssign.push({
              empaqueId: matchingBox.empaqueId,
              servicioNombre: label.serviceName,
              labelData: {
                boxCode: label.boxCode,
                boxNumber: label.boxNumber,
                totalBoxes: label.totalBoxes,
                serviceName: label.serviceName,
                recipient: label.recipient,
                recipientCity: label.recipientCity,
                recipientState: label.recipientState,
                weight: label.weight,
                weightKg: label.weightKg
              }
            })
            // Guardar el empaqueId para actualizar officeOrderData después
            empaqueIdMap.set(label.boxCode, matchingBox.empaqueId)
          }
        })
      })

      // Asignar cada empaque con datos completos
      for (const pkg of packagesToAssign) {
        const response = await fetch('/api/empaques/assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empaqueId: pkg.empaqueId,
            ordenId: orderId,
            ordenNumero: orderNumber,
            servicioNombre: pkg.servicioNombre,
            labelData: pkg.labelData,
            clienteId: wizardData.sender.id
          })
        })

        const data = await response.json()
        if (data.success) {
          console.log(`✓ Empaque ${pkg.labelData.boxCode} asignado correctamente`)
        } else {
          console.error(`✗ Error asignando empaque ${pkg.labelData.boxCode}:`, data.error)
        }
      }

      // Actualizar officeOrderData con los empaqueIds
      if (empaqueIdMap.size > 0) {
        await updateOrderWithEmpaqueIds(orderId, empaqueIdMap)
      }

      console.log(`${packagesToAssign.length} empaques procesados para la orden ${orderNumber}`)
    } catch (error) {
      console.error('Error assigning packages:', error)
      // No lanzar error para que la orden se complete de todas formas
    }
  }

  const updateOrderWithEmpaqueIds = async (orderId: number, empaqueIdMap: Map<string, number>) => {
    try {
      // Leer la orden actual
      const orderResponse = await fetch(`/api/package-orders?id=${orderId}`)
      const orderData = await orderResponse.json()

      if (orderData.success && orderData.data) {
        const order = orderData.data
        const officeData = order.officeOrderData ? JSON.parse(order.officeOrderData) : {}

        // Actualizar labels con empaqueId
        if (officeData.labels) {
          officeData.labels = officeData.labels.map((label: any) => ({
            ...label,
            empaqueId: empaqueIdMap.get(label.boxCode) || null
          }))
        }

        // Actualizar la orden en la BD
        const updateResponse = await fetch(`/api/package-orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            officeOrderData: JSON.stringify(officeData)
          })
        })

        const updateData = await updateResponse.json()
        if (updateData.success) {
          console.log('✓ officeOrderData actualizado con empaqueIds')
        } else {
          console.error('✗ Error actualizando officeOrderData:', updateData.error)
        }
      }
    } catch (error) {
      console.error('Error updating order with empaque IDs:', error)
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
            <title>Invoice ${orderNumber}</title>
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
                border-bottom: 3px solid #3B82F6;
                margin-bottom: 30px;
              }

              .company-info h1 {
                font-size: 28px;
                font-weight: 700;
                color: #3B82F6;
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
                font-size: 32px;
                font-weight: 700;
                color: #000;
                margin-bottom: 5px;
              }

              .invoice-number {
                font-size: 14px;
                color: #666;
              }

              .invoice-number span {
                font-weight: 700;
                color: #3B82F6;
              }

              .client-info {
                background: #F8F9FA;
                padding: 20px;
                margin-bottom: 30px;
                border-left: 4px solid #3B82F6;
              }

              .client-info h3 {
                font-size: 12px;
                text-transform: uppercase;
                color: #3B82F6;
                font-weight: 700;
                margin-bottom: 10px;
              }

              .client-info p {
                font-size: 14px;
                margin-bottom: 4px;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }

              thead {
                background: #3B82F6;
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
                border-bottom: 2px solid #3B82F6;
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
                background: #3B82F6;
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
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-number">No. <span>${orderNumber}</span></div>
                <div class="invoice-number">${new Date().toLocaleDateString('es-ES')}</div>
              </div>
            </div>

            <div class="client-info">
              <h3>Cliente</h3>
              <p><strong>${wizardData.sender.firstName} ${wizardData.sender.lastName}</strong></p>
              <p>${wizardData.sender.phone}</p>
              ${wizardData.sender.email ? `<p>${wizardData.sender.email}</p>` : ''}
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 50%;">Descripción</th>
                  <th style="width: 15%; text-align: center;">Cantidad</th>
                  <th style="width: 20%; text-align: right;">Precio</th>
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

            ${wizardData.payments && wizardData.payments.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th style="width: 50%;">Método de Pago</th>
                  <th style="width: 30%;">Referencia</th>
                  <th style="width: 20%; text-align: right;">Monto</th>
                </tr>
              </thead>
              <tbody>
                ${wizardData.payments.map((payment: any) => `
                  <tr>
                    <td>${payment.method === 'cash' ? 'Efectivo' : payment.method === 'zelle' ? 'Zelle' : 'Tarjeta'}</td>
                    <td>${payment.reference || '-'}</td>
                    <td style="text-align: right;">$${payment.amount.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ` : ''}

            <div class="totals">
              <div class="total-row">
                <span>Subtotal:</span>
                <span>$${wizardData.totalAmount.toFixed(2)}</span>
              </div>
              <div class="total-row grand">
                <span>TOTAL:</span>
                <span>$${wizardData.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div class="footer">
              Gracias por su preferencia - ${companyName}
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
      payments: wizardData.payments.map((payment: any) => ({
        method: payment.method === 'cash' ? 'Efectivo' : payment.method === 'zelle' ? 'Zelle' : 'Tarjeta',
        amount: payment.amount
      })),
      subtotal: wizardData.totalAmount,
      total: wizardData.totalAmount,
      paid: wizardData.payments.reduce((sum: number, p: any) => sum + p.amount, 0),
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

  if (creating) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-4" />
        <p className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Creando orden...
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
              ? 'from-green-600 to-green-700 shadow-green-500/30'
              : 'from-green-500 to-green-600 shadow-green-400/30'
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
            ¡Orden Creada Exitosamente!
          </h2>
          <p className={cn("text-base", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
            Número de Orden: <span className="font-bold text-green-600">{orderNumber}</span>
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
          <div className="flex justify-between items-center">
            <span className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Servicios:</span>
            <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {wizardData.selectedServices.length}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Etiquetas:</span>
            <span className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {wizardData.labels.length}
            </span>
          </div>
          <div className={cn(
            "flex justify-between items-center font-bold text-xl pt-4 mt-4 border-t",
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>Total:</span>
            <span className="text-green-600">${wizardData.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Button
          onClick={printInvoice}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <FileText className="w-5 h-5" />
          Imprimir Factura
        </Button>
        <Button
          onClick={() => {
            wizardData.labels.forEach((label: any, index: number) => {
              setTimeout(() => {
                // Usar los datos completos de la etiqueta con las imágenes base64
                const labelData: ShippingLabelData = {
                  companyName: label.companyName,
                  boxNumber: label.boxNumber,
                  totalBoxes: label.totalBoxes,
                  boxCode: label.boxCode,
                  sender: {
                    name: label.sender,
                    address: label.senderAddress,
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
                    code: wizardData.warehouse?.code || 'N/A',
                    name: wizardData.warehouse?.name || '',
                    city: wizardData.warehouse?.city || ''
                  },
                  barcodeDataUrl: label.barcodeDataUrl || '',
                  qrCodeDataUrl: label.qrCodeDataUrl || '',
                  warehouseBarcodeDataUrl: label.warehouseBarcodeDataUrl || ''
                }

                const printWindow = window.open('', '_blank')
                if (printWindow) {
                  const html = generateShippingLabelHTML(labelData)
                  printWindow.document.write(html)
                  printWindow.document.close()
                }
              }, index * 500)
            })
          }}
          className="flex items-center justify-center gap-2 bg-purple-600 text-white hover:bg-purple-700 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <Printer className="w-5 h-5" />
          Imprimir Etiquetas
        </Button>
        <Button
          onClick={printThermalReceipt}
          className="flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <Download className="w-5 h-5" />
          Recibo Térmico
        </Button>
      </motion.div>
    </div>
  )
}
