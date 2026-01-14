'use client'

import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle, Loader2, PartyPopper, MessageSquare, Truck, MapPin, User, Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { motion } from 'framer-motion'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

export default function PickupOrderConfirmationStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const [creating, setCreating] = useState(false)
  const [orderCreated, setOrderCreated] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [sendingSMS, setSendingSMS] = useState(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
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
      // Generar número de orden
      const numberResponse = await fetch('/api/package-orders/generate-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderType: 'recogida' })
      })

      const numberData = await numberResponse.json()
      const generatedOrderNumber = numberData.orderNumber

      if (numberData.warning) {
        console.warn('Advertencia al generar número:', numberData.warning)
      }

      // Construir dirección completa del remitente (USA)
      const street = wizardData.sender.street || wizardData.sender.address || ''
      const apartment = wizardData.sender.apartment || ''
      const city = wizardData.sender.city || ''
      const state = wizardData.sender.state || ''
      const zipCode = wizardData.sender.zipCode || wizardData.sender.zipcode || ''
      const country = wizardData.sender.country || 'US'

      const stateZip = [state, zipCode].filter(Boolean).join(' ')
      const formattedApartment = apartment
        ? (apartment.toLowerCase().startsWith('apt') ? apartment : `Apt ${apartment}`)
        : ''

      const senderFullAddress = [
        street,
        formattedApartment,
        city,
        stateZip,
        country
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
        }
      }

      // Limpiar apartamento
      const cleanApartment = apartment
        ? apartment.replace(/^apt\s*/i, '').trim()
        : null

      // Construir dirección del destinatario (Cuba)
      const recipientAddress = [
        wizardData.recipient.street,
        wizardData.recipient.number ? `#${wizardData.recipient.number}` : '',
        wizardData.recipient.floor,
        wizardData.recipient.reparto,
        wizardData.recipient.municipalityName,
        wizardData.recipient.provinceName,
        'Cuba'
      ].filter(Boolean).join(', ')

      // Crear la orden simplificada para recogida a domicilio
      const orderData = {
        customerId: wizardData.sender.id,
        customerName: `${wizardData.sender.firstName} ${wizardData.sender.lastName}`,
        customerAddress: senderFullAddress || null,
        // Campos de dirección estructurados del remitente (para recogida)
        street: street || null,
        apartment: cleanApartment,
        city: city || null,
        state: state || null,
        country: country || 'US',
        zipcode: zipCode || null,
        orderNumber: generatedOrderNumber,
        services: ['Recogida a Domicilio'],
        notes: `Recogida programada - ${wizardData.pickupInstructions || 'Sin instrucciones especiales'}`,
        scheduledDate: wizardData.scheduledDate || null,
        timeSlot: wizardData.timeSlot || null,
        status: 'pending',
        createdBy: 'system',
        latitude: latitude,
        longitude: longitude,
        // Sin montos - el pago lo maneja el driver
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0,
        orderType: 'recogida',
        // Estado de pago pendiente - COD (Cash on Delivery)
        paymentMethod: 'cod',
        paymentStatus: 'pending_payment',
        paidAmount: 0,
        firstName: wizardData.sender.firstName,
        lastName: wizardData.sender.lastName,
        // Datos adicionales de la orden
        officeOrderData: JSON.stringify({
          senderName: `${wizardData.sender.firstName || ''} ${wizardData.sender.lastName || ''}`.trim(),
          senderPhone: wizardData.sender.phone || '',
          senderEmail: wizardData.sender.email || '',
          senderAddress: senderFullAddress || '',
          senderEntryPin: wizardData.sender.entryPin || '',
          senderEntryInstructions: wizardData.sender.entryInstructions || '',
          receiverName: `${wizardData.recipient.firstName || ''} ${wizardData.recipient.lastName || ''}`.trim(),
          receiverPhone: wizardData.recipient.phone || '',
          receiverEmail: wizardData.recipient.email || '',
          destination: {
            street: wizardData.recipient.street || '',
            number: wizardData.recipient.number || '',
            floor: wizardData.recipient.floor || '',
            reparto: wizardData.recipient.reparto || '',
            provinceId: wizardData.recipient.provinceId || null,
            provinceName: wizardData.recipient.provinceName || '',
            municipalityId: wizardData.recipient.municipalityId || null,
            municipalityName: wizardData.recipient.municipalityName || '',
            country: 'Cuba',
            fullAddress: recipientAddress
          },
          deliveryInstructions: wizardData.recipient.deliveryInstructions || '',
          scheduledDate: wizardData.scheduledDate,
          timeSlot: wizardData.timeSlot,
          pickupInstructions: wizardData.pickupInstructions || ''
        })
      }

      console.log('📦 Creando orden de recogida:', orderData)

      const response = await fetch('/api/package-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      const data = await response.json()

      if (data.success) {
        const createdOrderNumber = data.data.orderNumber
        const createdOrderId = data.data.id

        setOrderNumber(createdOrderNumber)
        updateWizardData('orderId', createdOrderId)
        updateWizardData('orderNumber', createdOrderNumber)

        setOrderCreated(true)
      } else {
        console.error('Error al crear orden:', data.error)
        setOrderNumber(generatedOrderNumber)
        updateWizardData('orderNumber', generatedOrderNumber)
        setOrderCreated(true)
      }
    } catch (error) {
      console.error('Error creating order:', error)
      const errorNumber = `PICKUP-ERROR${Date.now().toString().slice(-6)}`
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
      const orderId = wizardData.orderId

      if (!orderId) {
        showNotification('error', 'Error', 'No se encontró el ID de la orden')
        return
      }

      const response = await fetch(`/api/package-orders/${orderId}/resend-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (data.success) {
        showNotification(
          'success',
          'SMS Enviado',
          `Mensaje enviado exitosamente a ${data.data?.to || wizardData.sender.phone}`
        )
      } else {
        showNotification('error', 'Error al enviar SMS', data.error || 'No se pudo enviar el mensaje')
      }
    } catch (error) {
      showNotification('error', 'Error de conexión', 'No se pudo conectar con el servicio de SMS')
    } finally {
      setSendingSMS(false)
    }
  }

  const sendWhatsAppNotification = async () => {
    setSendingWhatsApp(true)
    try {
      const orderId = wizardData.orderId

      if (!orderId) {
        showNotification('error', 'Error', 'No se encontró el ID de la orden')
        return
      }

      const response = await fetch(`/api/package-orders/${orderId}/resend-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (data.success) {
        showNotification(
          'success',
          'WhatsApp Enviado',
          `Mensaje enviado exitosamente a ${data.data?.to || wizardData.sender.phone}`
        )
      } else {
        showNotification('error', 'Error al enviar WhatsApp', data.error || 'No se pudo enviar el mensaje')
      }
    } catch (error) {
      showNotification('error', 'Error de conexión', 'No se pudo conectar con el servicio de WhatsApp')
    } finally {
      setSendingWhatsApp(false)
    }
  }

  if (creating) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-16 h-16 animate-spin mb-4 text-amber-600" />
        <p className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          Creando orden de recogida...
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
              ? 'from-amber-600 to-amber-700 shadow-amber-500/30'
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
            Orden Creada con Exito
          </h2>
          <p className={cn("text-base", theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
            Número de Orden: <span className="font-bold text-amber-600">{orderNumber}</span>
          </p>
          <p className={cn("text-sm mt-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
            Estado: <span className="font-semibold text-amber-500">PENDIENTE</span>
          </p>
        </motion.div>
      </div>

      {/* Order Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={cn(
          "p-6 rounded-2xl backdrop-blur-sm border",
          theme === 'dark'
            ? 'bg-gray-800/50 border-gray-700/50 shadow-xl shadow-black/20'
            : 'bg-white/50 border-gray-200/50 shadow-xl shadow-gray-200/50'
        )}
      >
        <h3 className={cn("font-semibold mb-6 text-lg flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          <Truck className="w-5 h-5 text-amber-600" />
          Resumen de la Recogida
        </h3>

        <div className="space-y-6">
          {/* Remitente */}
          <div className={cn(
            "p-4 rounded-xl",
            theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-blue-600" />
              <span className={cn("font-semibold text-sm", theme === 'dark' ? 'text-blue-400' : 'text-blue-700')}>
                Remitente (Recogida)
              </span>
            </div>
            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {wizardData.sender.firstName} {wizardData.sender.lastName}
            </p>
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {wizardData.sender.phone}
            </p>
            <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {wizardData.sender.address || `${wizardData.sender.street}, ${wizardData.sender.city}, ${wizardData.sender.state}`}
            </p>
          </div>

          {/* Destinatario */}
          <div className={cn(
            "p-4 rounded-xl",
            theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-purple-600" />
              <span className={cn("font-semibold text-sm", theme === 'dark' ? 'text-purple-400' : 'text-purple-700')}>
                Destinatario (Cuba)
              </span>
            </div>
            <p className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {wizardData.recipient.firstName} {wizardData.recipient.lastName}
            </p>
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {wizardData.recipient.phone}
            </p>
            <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              {wizardData.recipient.address || `${wizardData.recipient.street}, ${wizardData.recipient.municipalityName}, ${wizardData.recipient.provinceName}`}
            </p>
          </div>

          {/* Programación */}
          {wizardData.scheduledDate && (
            <div className={cn(
              "p-4 rounded-xl",
              theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
            )}>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className={cn("text-sm", theme === 'dark' ? 'text-amber-400' : 'text-amber-700')}>
                    {new Date(wizardData.scheduledDate).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })}
                  </span>
                </div>
                {wizardData.timeSlot && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className={cn("text-sm", theme === 'dark' ? 'text-amber-400' : 'text-amber-700')}>
                      {wizardData.timeSlot}
                    </span>
                  </div>
                )}
              </div>
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
            ? 'bg-amber-500/10 border-amber-500/20'
            : 'bg-amber-50 border-amber-200'
        )}
      >
        <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
        <div className="flex-1">
          <p className={cn(
            'text-sm',
            theme === 'dark' ? 'text-amber-300' : 'text-amber-700'
          )}>
            <strong>Próximos pasos:</strong> Esta orden está en estado PENDIENTE.
            Un repartidor será asignado para recoger los paquetes en la dirección indicada.
            El pago se realizará durante la recogida.
          </p>
        </div>
      </motion.div>

      {/* Notification Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
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
          onClick={sendWhatsAppNotification}
          disabled={sendingWhatsApp || !wizardData.sender.phone}
          className={cn(
            "flex items-center justify-center gap-2 py-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all",
            sendingWhatsApp || !wizardData.sender.phone
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          )}
        >
          {sendingWhatsApp ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          )}
          {sendingWhatsApp ? 'Enviando...' : 'Enviar WhatsApp'}
        </Button>
      </motion.div>
    </div>
  )
}
