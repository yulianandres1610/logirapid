'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Package, CheckCircle, ArrowLeft, ArrowRight, Phone, MapPin, Calendar, Clock, AlertCircle } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Box {
  id: number
  trackingNumber: string
  boxType: string
  status: string
  currentLocation: string
}

interface PendingOrder {
  id: number
  orderNumber: string
  createdAt: string
  pickupAddress: string
  deliveryAddress: string
  pickupCity: string
  pickupState: string
  pickupZipcode: string
  deliveryCity: string
  deliveryState: string
  deliveryZipcode: string
  boxesDelivered: number
  boxesReturned: number
  boxesPending: number
  senderName: string
  senderPhone: string
  senderEmail: string
  recipientName: string
  recipientPhone: string
  recipientEmail: string
  deliveryLatitude: number | null
  deliveryLongitude: number | null
  pickupLatitude: number | null
  pickupLongitude: number | null
  availableBoxes: Box[]
}

interface Customer {
  id: number
  firstName: string
  lastName: string
  phone: string
  email: string
}

// Empty State Component
const EmptyStateMessage = ({
  theme,
  onTryAgain
}: {
  theme: string
  onTryAgain: () => void
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className={cn(
      'flex flex-col items-center justify-center py-12 px-6 rounded-2xl border-2 backdrop-blur-sm',
      theme === 'dark'
        ? 'bg-purple-900/10 border-purple-700/30'
        : 'bg-purple-50/50 border-purple-200'
    )}
  >
    {/* Animated Icon */}
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
      className={cn(
        "w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg",
        theme === 'dark'
          ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/30'
          : 'bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-300'
      )}
    >
      <motion.div
        animate={{
          y: [0, -8, 0],
          rotate: [0, 5, -5, 0]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Package className={cn(
          "w-12 h-12",
          theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
        )} />
      </motion.div>
    </motion.div>

    {/* Title */}
    <motion.h3
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn(
        "text-2xl font-bold mb-3",
        theme === 'dark' ? 'text-white' : 'text-gray-900'
      )}
    >
      No hay órdenes pendientes
    </motion.h3>

    {/* Description */}
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={cn(
        "text-center text-sm mb-6 max-w-md",
        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      )}
    >
      Este cliente no tiene órdenes de retorno pendientes en este momento.
      Las cajas deben estar en estado "entregado" para poder crear una orden de retorno.
    </motion.p>

    {/* Decorative Pills */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="flex gap-2 flex-wrap justify-center mb-6"
    >
      {['Sin órdenes activas', 'Estado: Entregado requerido'].map((text, i) => (
        <span
          key={i}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            theme === 'dark'
              ? 'bg-purple-900/30 text-purple-300 border border-purple-700/50'
              : 'bg-purple-100 text-purple-700 border border-purple-300'
          )}
        >
          {text}
        </span>
      ))}
    </motion.div>

    {/* Try Again Button */}
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onTryAgain}
      className={cn(
        "px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg",
        theme === 'dark'
          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
      )}
    >
      <Search className="w-5 h-5" />
      Buscar otro cliente
    </motion.button>
  </motion.div>
)

export default function ReturnOrderWizard({ companyId, onComplete }: { companyId: string; onComplete: () => void }) {
  const { theme } = useTheme()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showEmptyState, setShowEmptyState] = useState(false)
  const [searchSuccess, setSearchSuccess] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Step 1: Búsqueda de cliente
  const [phoneNumber, setPhoneNumber] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])

  // Step 2: Selección de orden y cajas
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null)
  const [selectedBoxIds, setSelectedBoxIds] = useState<number[]>([])

  // Step 3: Confirmación de información
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [notes, setNotes] = useState('')

  // Información editable
  const [senderName, setSenderName] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')

  // Búsqueda de cliente
  const handleSearchCustomer = async () => {
    if (!phoneNumber.trim()) {
      setError('Ingrese un número de teléfono')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        `/api/orders/pending-returns?phone=${encodeURIComponent(phoneNumber)}`,
        {
          headers: {
            'x-company-id': companyId
          }
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al buscar cliente')
      }

      if (data.data.pendingOrders.length === 0) {
        setCustomer(data.data.customer)
        setPendingOrders([])
        setShowEmptyState(true)
        return
      }

      setCustomer(data.data.customer)
      setPendingOrders(data.data.pendingOrders)
      setShowEmptyState(false)
      setSearchSuccess(true)
      setTimeout(() => setSearchSuccess(false), 800)

      // Transition to step 2
      setIsTransitioning(true)
      setTimeout(() => {
        setStep(2)
        setIsTransitioning(false)
      }, 300)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar cliente')
    } finally {
      setLoading(false)
    }
  }

  // Selección de orden
  const handleSelectOrder = (order: PendingOrder) => {
    setSelectedOrder(order)
    setSelectedBoxIds([])

    // Pre-cargar información (invertida: pickup se convierte en delivery y viceversa)
    setSenderName(order.recipientName)
    setSenderPhone(order.recipientPhone)
    setSenderEmail(order.recipientEmail)
    setRecipientName(order.senderName)
    setRecipientPhone(order.senderPhone)
    setRecipientEmail(order.senderEmail)
    setPickupAddress(`${order.deliveryAddress}, ${order.deliveryCity}, ${order.deliveryState} ${order.deliveryZipcode}`)
    setDeliveryAddress(`${order.pickupAddress}, ${order.pickupCity}, ${order.pickupState} ${order.pickupZipcode}`)
  }

  // Toggle selección de caja
  const toggleBoxSelection = (boxId: number) => {
    setSelectedBoxIds(prev =>
      prev.includes(boxId)
        ? prev.filter(id => id !== boxId)
        : [...prev, boxId]
    )
  }

  // Seleccionar todas las cajas
  const selectAllBoxes = () => {
    if (selectedOrder) {
      setSelectedBoxIds(selectedOrder.availableBoxes.map(b => b.id))
    }
  }

  // Crear orden de retorno
  const handleCreateReturn = async () => {
    if (!selectedOrder || selectedBoxIds.length === 0) {
      setError('Seleccione al menos una caja para recoger')
      return
    }

    if (!pickupDate || !pickupTime) {
      setError('Fecha y hora de recogida son requeridas')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/orders/create-return', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': companyId,
          'x-user-name': 'Usuario' // TODO: Obtener del contexto de autenticación
        },
        body: JSON.stringify({
          parentOrderId: selectedOrder.id,
          selectedBoxIds,
          pickupDate,
          pickupTime,
          senderName,
          senderPhone,
          senderEmail,
          recipientName,
          recipientPhone,
          recipientEmail,
          pickupAddress: selectedOrder.deliveryAddress,
          pickupCity: selectedOrder.deliveryCity,
          pickupState: selectedOrder.deliveryState,
          pickupZipcode: selectedOrder.deliveryZipcode,
          pickupLatitude: selectedOrder.deliveryLatitude,
          pickupLongitude: selectedOrder.deliveryLongitude,
          deliveryAddress: selectedOrder.pickupAddress,
          deliveryCity: selectedOrder.pickupCity,
          deliveryState: selectedOrder.pickupState,
          deliveryZipcode: selectedOrder.pickupZipcode,
          deliveryLatitude: selectedOrder.pickupLatitude,
          deliveryLongitude: selectedOrder.pickupLongitude,
          notes
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear orden de retorno')
      }

      setStep(4) // Paso de éxito
      setTimeout(() => onComplete(), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear orden de retorno')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Error Message - Only for actual errors */}
      {error && !showEmptyState && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-4 rounded-xl border-2',
            theme === 'dark'
              ? 'bg-red-900/30 border-red-700 text-red-300'
              : 'bg-red-50 border-red-400 text-red-700'
          )}
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: 2, duration: 0.5 }}
            >
              <AlertCircle className="w-5 h-5" />
            </motion.div>
            {error}
          </div>
        </motion.div>
      )}

      {/* Empty State - When no pending orders */}
      <AnimatePresence>
        {showEmptyState && customer && (
          <EmptyStateMessage
            theme={theme}
            onTryAgain={() => {
              setPhoneNumber('')
              setError('')
              setShowEmptyState(false)
              setCustomer(null)
              setPendingOrders([])
            }}
          />
        )}
      </AnimatePresence>

      {/* Success Flash Animation */}
      <AnimatePresence>
        {searchSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-br from-purple-500/20 to-green-500/20 pointer-events-none z-50 backdrop-blur-sm"
            transition={{ duration: 0.8 }}
          />
        )}
      </AnimatePresence>

      {/* Step Transition Loading Overlay */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Package className="w-12 h-12 text-purple-400" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* STEP 1: Búsqueda de Cliente */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center shadow-lg",
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/30'
                    : 'bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-300'
                )}
              >
                <Phone className={cn(
                  "w-10 h-10",
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                )} />
              </motion.div>
              <div>
                <h2 className={cn(
                  "text-3xl font-bold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Buscar Cliente
                </h2>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Ingresa el número de teléfono del cliente para buscar entregas pendientes
                </p>
              </div>
            </div>

            {/* Form Card */}
            <div className={cn(
              'p-8 rounded-2xl border-2 shadow-xl backdrop-blur-sm',
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-white/80 border-gray-200'
            )}>
              <div className="space-y-6">
                <div>
                  <label className={cn(
                    "block text-sm font-semibold mb-3",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Número de Teléfono
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Ej: 3051234567"
                    className={cn(
                      'w-full px-5 py-3 rounded-xl border-2 transition-all duration-200 text-lg',
                      'focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                    )}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchCustomer()}
                  />
                </div>

                <motion.button
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  onClick={handleSearchCustomer}
                  disabled={loading}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-all relative overflow-hidden",
                    "disabled:cursor-not-allowed",
                    loading
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600'
                      : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800',
                    "text-white"
                  )}
                >
                  {/* Animated background shimmer effect when loading */}
                  {loading && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}

                  {/* Icon with rotation animation */}
                  <motion.div
                    animate={loading ? {
                      rotate: 360,
                      scale: [1, 1.2, 1]
                    } : {}}
                    transition={loading ? {
                      rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                      scale: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
                    } : {}}
                    className="relative z-10"
                  >
                    <Search className={cn(
                      "w-6 h-6",
                      loading && "text-purple-200"
                    )} />
                  </motion.div>

                  {/* Text with dots animation */}
                  <span className="relative z-10 flex items-center gap-1">
                    {loading ? (
                      <>
                        Buscando
                        <span className="flex gap-0.5 ml-1">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-white"
                              animate={{
                                y: [0, -4, 0],
                                opacity: [0.5, 1, 0.5]
                              }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.15,
                                ease: "easeInOut"
                              }}
                            />
                          ))}
                        </span>
                      </>
                    ) : (
                      'Buscar Entregas Pendientes'
                    )}
                  </span>

                  {/* Progress bar at bottom when loading */}
                  {loading && (
                    <motion.div
                      className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2, ease: "easeInOut" }}
                    />
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Selección de Orden y Cajas */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center shadow-lg",
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/30'
                    : 'bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-300'
                )}
              >
                <Package className={cn(
                  "w-10 h-10",
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                )} />
              </motion.div>
              <div>
                <h2 className={cn(
                  "text-3xl font-bold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Seleccionar Cajas
                </h2>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Cliente: {customer?.firstName} {customer?.lastName} • {customer?.phone}
                </p>
              </div>
            </div>

            {/* Órdenes Pendientes */}
            <div className={cn(
              'p-8 rounded-2xl border-2 shadow-xl backdrop-blur-sm',
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-white/80 border-gray-200'
            )}>
              <h3 className={cn(
                "text-xl font-bold mb-6",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Entregas de Cajas Vacías
              </h3>

              <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 shadow-md',
                      selectedOrder?.id === order.id
                        ? theme === 'dark'
                          ? 'border-purple-500 bg-purple-900/20 shadow-purple-500/20'
                          : 'border-purple-500 bg-purple-50 shadow-purple-500/20'
                        : theme === 'dark'
                          ? 'border-gray-600 hover:border-purple-400 bg-gray-700/50'
                          : 'border-gray-300 hover:border-purple-400 bg-white'
                    )}
                    onClick={() => handleSelectOrder(order)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className={cn(
                          "font-bold text-lg",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {order.orderNumber}
                        </p>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={cn(
                        "text-right px-3 py-1 rounded-lg",
                        theme === 'dark'
                          ? 'bg-purple-900/30 border border-purple-700'
                          : 'bg-purple-100 border border-purple-300'
                      )}>
                        <p className={cn(
                          "text-sm font-bold",
                          theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                        )}>
                          {order.boxesPending} pendientes
                        </p>
                        <p className="text-xs text-gray-500">
                          de {order.boxesDelivered} entregadas
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className={cn(
                        "w-4 h-4 mt-0.5 flex-shrink-0",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )} />
                      <p className={cn(
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {order.deliveryAddress}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Selección de Cajas */}
              {selectedOrder && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "mt-6 pt-6 border-t-2",
                    theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                  )}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className={cn(
                      "text-lg font-bold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Seleccionar Cajas a Recoger
                    </h3>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={selectAllBoxes}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                        theme === 'dark'
                          ? 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      )}
                    >
                      Seleccionar Todas
                    </motion.button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {selectedOrder.availableBoxes.map((box) => (
                      <motion.div
                        key={box.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => toggleBoxSelection(box.id)}
                        className={cn(
                          'p-4 rounded-xl border-2 cursor-pointer transition-all duration-200',
                          selectedBoxIds.includes(box.id)
                            ? theme === 'dark'
                              ? 'border-purple-500 bg-purple-900/30 shadow-lg shadow-purple-500/20'
                              : 'border-purple-500 bg-purple-100 shadow-lg shadow-purple-500/20'
                            : theme === 'dark'
                              ? 'border-gray-600 hover:border-purple-400 bg-gray-700/30'
                              : 'border-gray-300 hover:border-purple-400 bg-gray-50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                            selectedBoxIds.includes(box.id)
                              ? theme === 'dark'
                                ? 'bg-purple-600 border-purple-600'
                                : 'bg-purple-600 border-purple-600'
                              : theme === 'dark'
                                ? 'border-gray-500'
                                : 'border-gray-400'
                          )}>
                            {selectedBoxIds.includes(box.id) && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={cn(
                              "font-bold",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {box.boxType}
                            </p>
                            <p className="text-xs text-gray-500">{box.trackingNumber}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setStep(1)
                        setSelectedOrder(null)
                        setSelectedBoxIds([])
                      }}
                      className={cn(
                        "px-6 py-3 rounded-xl border-2 font-semibold flex items-center gap-2 transition-colors",
                        theme === 'dark'
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Atrás
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: selectedBoxIds.length === 0 ? 1 : 1.02 }}
                      whileTap={{ scale: selectedBoxIds.length === 0 ? 1 : 0.98 }}
                      onClick={() => setStep(3)}
                      disabled={selectedBoxIds.length === 0}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        theme === 'dark'
                          ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white'
                          : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white'
                      )}
                    >
                      Continuar
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* STEP 3: Confirmación */}
        {step === 3 && selectedOrder && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center shadow-lg",
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/30'
                    : 'bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-300'
                )}
              >
                <CheckCircle className={cn(
                  "w-10 h-10",
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                )} />
              </motion.div>
              <div>
                <h2 className={cn(
                  "text-3xl font-bold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Confirmar Información
                </h2>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Revisa y confirma los detalles de la orden de retorno
                </p>
              </div>
            </div>

            <div className={cn(
              'p-8 rounded-2xl border-2 shadow-xl backdrop-blur-sm',
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-white/80 border-gray-200'
            )}>

            <div className="space-y-8">
              {/* Fecha y Hora */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={cn(
                    "block text-sm font-semibold mb-3 flex items-center gap-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    <Calendar className="w-5 h-5 text-purple-600" />
                    Fecha de Recogida
                  </label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border-2 transition-all duration-200',
                      'focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                    )}
                  />
                </div>
                <div>
                  <label className={cn(
                    "block text-sm font-semibold mb-3 flex items-center gap-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    <Clock className="w-5 h-5 text-purple-600" />
                    Hora
                  </label>
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border-2 transition-all duration-200',
                      'focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-700/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                    )}
                  />
                </div>
              </div>

              {/* Resumen */}
              <div className={cn(
                'p-6 rounded-xl border-2',
                theme === 'dark' ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50 border-purple-300'
              )}>
                <h3 className={cn(
                  "font-bold text-lg mb-4",
                  theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                )}>
                  Resumen de Retorno
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cajas a recoger:</span>
                    <span className="font-bold">{selectedBoxIds.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Orden original:</span>
                    <span className="font-semibold">{selectedOrder.orderNumber}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-300 dark:border-gray-600">
                    <p className="text-xs text-gray-500 mb-1">Dirección de recogida:</p>
                    <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{pickupAddress}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Dirección de entrega:</p>
                    <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{deliveryAddress}</p>
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className={cn(
                  "block text-sm font-semibold mb-3",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Notas Adicionales (Opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Instrucciones especiales para la recogida..."
                  className={cn(
                    'w-full px-4 py-3 rounded-xl border-2 transition-all duration-200',
                    'focus:outline-none focus:ring-2',
                    theme === 'dark'
                      ? 'bg-gray-700/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                  )}
                />
              </div>

              {/* Botones */}
              <div className="flex gap-4 pt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep(2)}
                  className={cn(
                    "px-6 py-3 rounded-xl border-2 font-semibold flex items-center gap-2 transition-colors",
                    theme === 'dark'
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                  Atrás
                </motion.button>
                <motion.button
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  onClick={handleCreateReturn}
                  disabled={loading}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
                  )}
                >
                  {loading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        ⏳
                      </motion.div>
                      Creando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Crear Orden de Retorno
                    </>
                  )}
                </motion.button>
              </div>
            </div>
            </div>
          </motion.div>
        )}

        {/* STEP 4: Éxito */}
        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="flex flex-col items-center text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
              className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center shadow-2xl mb-6",
                theme === 'dark'
                  ? 'bg-gradient-to-br from-green-500/20 to-green-600/20 border-4 border-green-500/30'
                  : 'bg-gradient-to-br from-green-100 to-green-200 border-4 border-green-300'
              )}
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 15 }}
              >
                <CheckCircle className={cn(
                  "w-20 h-20",
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                )} />
              </motion.div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                "text-4xl font-bold mb-4",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}
            >
              ¡Orden Creada con Éxito!
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                "text-lg mb-8",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}
            >
              La orden de retorno ha sido creada exitosamente y está lista para procesarse
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className={cn(
                'p-6 rounded-2xl border-2 shadow-xl',
                theme === 'dark'
                  ? 'bg-green-900/20 border-green-700'
                  : 'bg-green-50 border-green-300'
              )}
            >
              <p className="text-sm text-gray-500">Redirigiendo automáticamente...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
