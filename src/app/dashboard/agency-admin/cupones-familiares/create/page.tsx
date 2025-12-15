'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  MapPin,
  DollarSign,
  User,
  Users,
  CreditCard,
  FileCheck,
  Banknote,
  Loader2,
  Phone,
  Home,
  AlertCircle,
  Clock,
  Send,
  Printer,
  MessageCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface Province {
  name: string
  municipalities: {
    name: string
    brokerCount: number
    currencies: string[]
  }[]
}

interface WizardStep {
  id: number
  title: string
  description: string
  icon: any
}

interface RemittanceProduct {
  productId: number
  code: string
  name: string
  description: string
  pricingModel: 'percentage' | 'fixed'
  currency: string | null
  precioClientes: number | null  // Company's sale price (percentage or fixed)
  catalogPrecioPublico: number   // Default price if no company pricing
  catalogMiCostoFijo: number     // Fixed fee component
  catalogPrecioMayoristaFijo: number
}

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Efectivo', icon: '$' },
  { id: 'zelle', name: 'Zelle', icon: 'Z' },
  { id: 'card', name: 'Tarjeta', icon: 'T' }
]

export default function CreateRemittancePage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { user } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [canProceed, setCanProceed] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [availability, setAvailability] = useState<any>(null)
  const [remittanceProducts, setRemittanceProducts] = useState<RemittanceProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1, CUP: 1 })

  // Ref to always have latest exchange rates available in callbacks
  const exchangeRatesRef = React.useRef(exchangeRates)
  React.useEffect(() => {
    exchangeRatesRef.current = exchangeRates
  }, [exchangeRates])

  // Wizard data state
  const [wizardData, setWizardData] = useState({
    // Step 1: Location
    province: '',
    municipality: '',
    // Step 2: Service
    productId: null as number | null,
    serviceType: '',
    deliveryFee: 5,
    // Step 3: Amount
    sendAmount: 100,
    sendCurrency: 'USD',
    receiveCurrency: 'USD',
    receiveAmount: 100,
    exchangeRate: 1,
    serviceFee: 0,
    totalCharged: 0,
    estimatedDelivery: '',
    // Step 4: Recipient
    recipientName: '',
    recipientPhone: '',
    recipientIdNumber: '',
    recipientAddress: '',
    recipientNeighborhood: '',
    recipientAddressReferences: '',
    hasAlternateContact: false,
    alternateContactName: '',
    alternateContactPhone: '',
    // Step 5: Sender
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    // Step 6: Payment
    paymentMethod: '',
    paymentReference: '',
    cashReceived: 0,
    // Step 7: Confirmation
    orderNumber: '',
    orderId: null as number | null
  })

  const steps: WizardStep[] = [
    { id: 1, title: 'Ubicacion', description: 'Zona de entrega', icon: MapPin },
    { id: 2, title: 'Servicio', description: 'Tipo de envio', icon: Banknote },
    { id: 3, title: 'Monto', description: 'Cantidad a enviar', icon: DollarSign },
    { id: 4, title: 'Destinatario', description: 'Datos del beneficiario', icon: User },
    { id: 5, title: 'Remitente', description: 'Quien envia', icon: Users },
    { id: 6, title: 'Pago', description: 'Metodo de pago', icon: CreditCard },
    { id: 7, title: 'Confirmacion', description: 'Completar orden', icon: FileCheck }
  ]

  // Load provinces and exchange rates on mount
  useEffect(() => {
    loadProvinces()
    loadExchangeRates()
  }, [])

  // Load remittance products on mount
  useEffect(() => {
    if (user?.companyId) {
      loadRemittanceProducts()
    }
  }, [user?.companyId])

  const loadProvinces = async () => {
    try {
      const res = await fetch('/api/brokers/locations')
      const data = await res.json()
      if (data.success) {
        setProvinces(data.data.provinces)
      }
    } catch (error) {
      console.error('Error loading provinces:', error)
    }
  }

  const loadExchangeRates = async () => {
    try {
      const res = await fetch('/api/published-rates')
      const data = await res.json()
      if (data.success && data.rates) {
        const rates: Record<string, number> = { USD: 1 } // USD is always 1:1
        data.rates.forEach((r: { currency: string; rate: number }) => {
          rates[r.currency] = r.rate
        })
        setExchangeRates(rates)
        console.log('[Remittance Wizard] Loaded exchange rates:', rates)
      }
    } catch (error) {
      console.error('Error loading exchange rates:', error)
    }
  }

  const loadRemittanceProducts = async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch(`/api/companies/${user?.companyId}/products/pricing`)
      const data = await res.json()
      if (data.success && data.data) {
        // Filter only remittance products (service_category = 'remesa')
        const allProducts = data.data.products || []
        const remesaProducts = allProducts.filter((p: any) => p.serviceCategory === 'remesa')

        const products: RemittanceProduct[] = remesaProducts.map((p: any) => ({
          productId: p.productId,
          code: p.code,
          name: p.name,
          description: p.description || '',
          pricingModel: p.pricingModel,
          currency: p.currency,
          precioClientes: p.precioClientes,
          catalogPrecioPublico: p.catalogPrecioPublico || 0,
          catalogMiCostoFijo: p.catalogMiCostoFijo || 0,
          catalogPrecioMayoristaFijo: p.catalogPrecioMayoristaFijo || 0
        }))
        setRemittanceProducts(products)

        // Auto-select first product if available
        if (products.length > 0 && !wizardData.productId) {
          const firstProduct = products[0]
          setWizardData(prev => ({
            ...prev,
            productId: firstProduct.productId,
            serviceType: firstProduct.code,
            receiveCurrency: firstProduct.currency || 'USD'
          }))
        }
      }
    } catch (error) {
      console.error('Error loading remittance products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // Check availability when on step 3
  useEffect(() => {
    if (currentStep === 3 && wizardData.sendAmount > 0 && wizardData.province && wizardData.municipality) {
      checkAvailability()
    }
  }, [currentStep, wizardData.sendAmount, wizardData.receiveCurrency])

  // Recalculate receive amount when exchange rates change
  useEffect(() => {
    if (wizardData.productId && wizardData.receiveCurrency) {
      const rate = exchangeRates[wizardData.receiveCurrency] || 1
      if (rate !== wizardData.exchangeRate) {
        console.log('[Remittance Wizard] Recalculating with new rate:', rate, 'for', wizardData.receiveCurrency)
        setWizardData(prev => ({
          ...prev,
          exchangeRate: rate,
          receiveAmount: prev.sendAmount * rate
        }))
      }
    }
  }, [exchangeRates, wizardData.productId, wizardData.receiveCurrency])

  const checkAvailability = async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/brokers/availability?province=${encodeURIComponent(wizardData.province)}&municipality=${encodeURIComponent(wizardData.municipality)}&currency=${wizardData.receiveCurrency}&amount=${wizardData.sendAmount}`
      )
      const data = await res.json()
      if (data.success) {
        setAvailability(data.data)
        setWizardData(prev => ({
          ...prev,
          estimatedDelivery: data.data.estimatedDelivery
        }))
      }
    } catch (error) {
      console.error('Error checking availability:', error)
    } finally {
      setLoading(false)
    }
  }

  // Update wizard data and recalculate totals
  const updateWizardData = (updates: Partial<typeof wizardData>) => {
    setWizardData(prev => {
      const newData = { ...prev, ...updates }

      // Calculate totals when relevant fields change
      if ('sendAmount' in updates || 'productId' in updates || 'serviceType' in updates || 'deliveryFee' in updates) {
        // Find product by productId or serviceType
        const productId = updates.productId ?? prev.productId
        const product = remittanceProducts.find(p => p.productId === productId)

        if (product) {
          const amount = updates.sendAmount ?? prev.sendAmount
          // Use company's configured price (precioClientes) or fallback to catalog default
          const feePercentage = product.precioClientes ?? product.catalogPrecioPublico ?? 0
          const fixedFee = product.catalogMiCostoFijo || 0

          let fee = 0
          if (product.pricingModel === 'percentage') {
            fee = (amount * feePercentage / 100) + fixedFee
          } else {
            // Fixed pricing model
            fee = feePercentage + fixedFee
          }

          // Get receive currency and calculate exchange rate
          const receiveCurrency = product.currency || 'USD'
          // Use ref to get latest exchange rates (avoid stale closure)
          const currentRates = exchangeRatesRef.current
          const rate = currentRates[receiveCurrency] || 1

          // Calculate receive amount based on currency
          // USD: 1:1 (no conversion)
          // CUP/MLC/EUR: multiply by exchange rate
          const receiveAmount = amount * rate
          console.log(`[Remittance Wizard] Calculating: ${amount} USD × ${rate} = ${receiveAmount} ${receiveCurrency}`)

          newData.serviceFee = fee
          newData.totalCharged = amount + fee + (updates.deliveryFee ?? prev.deliveryFee)
          newData.receiveCurrency = receiveCurrency
          newData.exchangeRate = rate
          newData.receiveAmount = receiveAmount
          newData.productId = product.productId
          newData.serviceType = product.code
        }
      }

      return newData
    })
  }

  // Validate current step
  useEffect(() => {
    let valid = false
    switch (currentStep) {
      case 1:
        valid = !!wizardData.province && !!wizardData.municipality
        break
      case 2:
        valid = !!wizardData.productId
        break
      case 3:
        valid = wizardData.sendAmount > 0
        break
      case 4:
        valid = !!wizardData.recipientName && !!wizardData.recipientPhone
        break
      case 5:
        valid = !!wizardData.senderName
        break
      case 6:
        valid = !!wizardData.paymentMethod
        break
      case 7:
        valid = true
        break
    }
    setCanProceed(valid)
  }, [currentStep, wizardData])

  const handleNext = async () => {
    if (currentStep === 6 && canProceed) {
      // Create order on step 6
      await createOrder()
    } else if (currentStep < 7 && canProceed) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const createOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/remittance-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          province: wizardData.province,
          municipality: wizardData.municipality,
          productId: wizardData.productId,
          serviceType: wizardData.serviceType,
          sendAmount: wizardData.sendAmount,
          sendCurrency: wizardData.sendCurrency,
          receiveCurrency: wizardData.receiveCurrency,
          exchangeRate: wizardData.exchangeRate,
          deliveryFee: wizardData.deliveryFee,
          recipient: {
            name: wizardData.recipientName,
            phone: wizardData.recipientPhone,
            idNumber: wizardData.recipientIdNumber,
            address: wizardData.recipientAddress,
            neighborhood: wizardData.recipientNeighborhood,
            addressReferences: wizardData.recipientAddressReferences,
            hasAlternateContact: wizardData.hasAlternateContact,
            alternateContactName: wizardData.alternateContactName,
            alternateContactPhone: wizardData.alternateContactPhone
          },
          sender: {
            name: wizardData.senderName,
            phone: wizardData.senderPhone,
            email: wizardData.senderEmail
          },
          paymentMethod: wizardData.paymentMethod,
          paymentReference: wizardData.paymentReference,
          cashReceived: wizardData.cashReceived
        })
      })

      const data = await res.json()
      if (data.success) {
        setWizardData(prev => ({
          ...prev,
          orderNumber: data.data.orderNumber,
          orderId: data.data.id,
          estimatedDelivery: data.data.estimatedDelivery
        }))
        setCurrentStep(7)
        showNotification('success', 'Remesa Creada', `Orden ${data.data.orderNumber} creada exitosamente`)
      } else {
        showNotification('error', 'Error', data.error || 'Error al crear orden')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      showNotification('error', 'Error', 'Error al crear orden')
    } finally {
      setLoading(false)
    }
  }

  const selectedMunicipalities = provinces.find(p => p.name === wizardData.province)?.municipalities || []

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Ubicacion de Entrega
              </h2>
              <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Selecciona donde se entregara el dinero en Cuba
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Provincia
                </label>
                <select
                  value={wizardData.province}
                  onChange={(e) => updateWizardData({ province: e.target.value, municipality: '' })}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border text-base transition-all focus:ring-2 focus:ring-blue-500",
                    theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                  )}
                >
                  <option value="">Seleccionar provincia...</option>
                  {provinces.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              {wizardData.province && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Municipio
                  </label>
                  <select
                    value={wizardData.municipality}
                    onChange={(e) => updateWizardData({ municipality: e.target.value })}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border text-base transition-all focus:ring-2 focus:ring-blue-500",
                      theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    )}
                  >
                    <option value="">Seleccionar municipio...</option>
                    {selectedMunicipalities.map(m => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </motion.div>
              )}

              {wizardData.municipality && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-xl flex items-center gap-3",
                    theme === 'dark' ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'
                  )}
                >
                  <Check className="w-5 h-5 text-green-600" />
                  <span className={cn("text-sm font-medium", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                    Hay brokers disponibles en esta zona
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        )

      case 2:
        // Get icon for currency
        const getCurrencyIcon = (currency: string | null) => {
          switch (currency) {
            case 'USD': return '$'
            case 'EUR': return '€'
            case 'CUP': return '₱'
            case 'MLC': return 'M'
            default: return '$'
          }
        }

        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Tipo de Servicio
              </h2>
              <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Selecciona como quieres que reciba el dinero
              </p>
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className={cn("ml-3", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Cargando productos...
                </span>
              </div>
            ) : remittanceProducts.length === 0 ? (
              <div className={cn(
                "p-6 rounded-xl border-2 border-dashed text-center",
                theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
              )}>
                <AlertCircle className={cn("w-12 h-12 mx-auto mb-3", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                <p className={cn("font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  No hay productos de remesa configurados
                </p>
                <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                  Contacta al administrador para configurar los productos
                </p>
              </div>
            ) : (
              <div className={cn(
                "grid gap-4",
                remittanceProducts.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' :
                remittanceProducts.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              )}>
                {remittanceProducts.map(product => {
                  const price = product.precioClientes ?? product.catalogPrecioPublico ?? 0
                  const fixedFee = product.catalogMiCostoFijo || 0
                  const isSelected = wizardData.productId === product.productId

                  return (
                    <motion.button
                      key={product.productId}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateWizardData({ productId: product.productId })}
                      className={cn(
                        "p-6 rounded-xl border-2 text-center transition-all",
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-lg'
                          : theme === 'dark'
                            ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <span className={cn("text-3xl font-bold block mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {getCurrencyIcon(product.currency)}
                      </span>
                      <h3 className={cn("font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {product.name}
                      </h3>
                      <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {product.pricingModel === 'percentage' ? (
                          <>
                            {price}%{fixedFee > 0 ? ` + $${fixedFee.toFixed(2)}` : ''}
                          </>
                        ) : (
                          <>
                            ${price.toFixed(2)}{fixedFee > 0 ? ` + $${fixedFee.toFixed(2)}` : ''}
                          </>
                        )}
                      </p>
                      {product.description && (
                        <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          {product.description}
                        </p>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            )}

            <div className="pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wizardData.deliveryFee > 0}
                  onChange={(e) => updateWizardData({ deliveryFee: e.target.checked ? 5 : 0 })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Entrega a domicilio
                </span>
                <span className={cn("text-sm px-2 py-0.5 rounded-full", theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700')}>
                  +$5.00
                </span>
              </label>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Monto a Enviar
              </h2>
            </div>

            <div>
              <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                Monto en USD
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">$</span>
                <Input
                  type="number"
                  value={wizardData.sendAmount || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const numValue = value === '' ? 0 : parseFloat(value)
                    updateWizardData({ sendAmount: isNaN(numValue) ? 0 : numValue })
                  }}
                  min="0"
                  step="0.01"
                  className={cn(
                    "pl-10 text-2xl font-bold h-14 rounded-xl border-2",
                    theme === 'dark'
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-white text-gray-900 border-gray-300'
                  )}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm">Verificando disponibilidad...</span>
              </div>
            ) : availability && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-4 rounded-xl",
                  availability.hasAvailability
                    ? theme === 'dark' ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'
                    : theme === 'dark' ? 'bg-yellow-900/20 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'
                )}
              >
                <div className="flex items-center gap-3">
                  <Clock className={cn("w-5 h-5", availability.hasAvailability ? 'text-green-600' : 'text-yellow-600')} />
                  <div>
                    <p className={cn(
                      "font-medium",
                      availability.hasAvailability
                        ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                        : theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                    )}>
                      Entrega estimada: {availability.estimatedDelivery}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Show receive amount prominently when CUP */}
            {wizardData.receiveCurrency === 'CUP' && wizardData.exchangeRate > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-5 rounded-xl text-center",
                  theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                )}
              >
                <p className={cn("text-sm mb-1", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                  Tu familiar recibira en Cuba:
                </p>
                <p className={cn("text-3xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {wizardData.receiveAmount.toLocaleString('es-CU')} <span className="text-xl">CUP</span>
                </p>
                <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Tasa: 1 USD = {wizardData.exchangeRate.toLocaleString('es-CU')} CUP
                </p>
              </motion.div>
            )}

            <div className={cn(
              "p-5 rounded-xl space-y-3",
              theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'
            )}>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Monto a enviar:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>${wizardData.sendAmount.toFixed(2)} USD</span>
              </div>
              {wizardData.receiveCurrency !== 'USD' && (
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Recibe en Cuba:</span>
                  <span className={cn("font-medium", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                    {wizardData.receiveAmount.toLocaleString('es-CU')} {wizardData.receiveCurrency}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Comision:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>${wizardData.serviceFee.toFixed(2)}</span>
              </div>
              {wizardData.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Entrega:</span>
                  <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>${wizardData.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className={cn("flex justify-between pt-3 border-t font-bold text-lg", theme === 'dark' ? 'border-gray-600' : 'border-gray-300')}>
                <span>TOTAL:</span>
                <span className="text-blue-600">${wizardData.totalCharged.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Datos del Destinatario
              </h2>
              <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Informacion del beneficiario en Cuba
              </p>
            </div>

            <div className="space-y-4">
              <Input
                placeholder="Nombre completo *"
                value={wizardData.recipientName}
                onChange={(e) => updateWizardData({ recipientName: e.target.value })}
                className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Telefono *"
                  value={wizardData.recipientPhone}
                  onChange={(e) => updateWizardData({ recipientPhone: e.target.value })}
                  className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
                />
                <Input
                  placeholder="Carnet de Identidad"
                  value={wizardData.recipientIdNumber}
                  onChange={(e) => updateWizardData({ recipientIdNumber: e.target.value })}
                  className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
                />
              </div>

              <div className={cn("p-4 rounded-xl border", theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  <Home className="w-4 h-4" />
                  Direccion de Entrega
                </h4>
                <div className="space-y-3">
                  <Input
                    placeholder="Calle/Avenida con numero"
                    value={wizardData.recipientAddress}
                    onChange={(e) => updateWizardData({ recipientAddress: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />
                  <Input
                    placeholder="Reparto/Zona"
                    value={wizardData.recipientNeighborhood}
                    onChange={(e) => updateWizardData({ recipientNeighborhood: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={wizardData.municipality} disabled className={cn("rounded-xl h-11 opacity-70", theme === 'dark' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 border-gray-300')} />
                    <Input value={wizardData.province} disabled className={cn("rounded-xl h-11 opacity-70", theme === 'dark' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 border-gray-300')} />
                  </div>
                  <Input
                    placeholder="Referencias"
                    value={wizardData.recipientAddressReferences}
                    onChange={(e) => updateWizardData({ recipientAddressReferences: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wizardData.hasAlternateContact}
                  onChange={(e) => updateWizardData({ hasAlternateContact: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600"
                />
                <span className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Agregar contacto alternativo
                </span>
              </label>

              {wizardData.hasAlternateContact && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pl-8">
                  <Input
                    placeholder="Nombre del contacto"
                    value={wizardData.alternateContactName}
                    onChange={(e) => updateWizardData({ alternateContactName: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />
                  <Input
                    placeholder="Telefono del contacto"
                    value={wizardData.alternateContactPhone}
                    onChange={(e) => updateWizardData({ alternateContactPhone: e.target.value })}
                    className={cn("rounded-xl h-11", theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'bg-white text-gray-900 border-gray-300')}
                  />
                </motion.div>
              )}
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Datos del Remitente
              </h2>
              <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                Informacion de quien envia el dinero
              </p>
            </div>

            <div className="space-y-4">
              <Input
                placeholder="Nombre completo *"
                value={wizardData.senderName}
                onChange={(e) => updateWizardData({ senderName: e.target.value })}
                className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
              />
              <Input
                placeholder="Telefono"
                value={wizardData.senderPhone}
                onChange={(e) => updateWizardData({ senderPhone: e.target.value })}
                className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
              />
              <Input
                placeholder="Email (opcional)"
                type="email"
                value={wizardData.senderEmail}
                onChange={(e) => updateWizardData({ senderEmail: e.target.value })}
                className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
              />
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Metodo de Pago
              </h2>
              <p className="text-2xl font-bold mt-2 text-blue-600">
                Total: ${wizardData.totalCharged.toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {PAYMENT_METHODS.map(method => (
                <motion.button
                  key={method.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateWizardData({ paymentMethod: method.id })}
                  className={cn(
                    "p-4 rounded-xl border-2 text-center transition-all",
                    wizardData.paymentMethod === method.id
                      ? 'border-blue-500 bg-blue-500/10 shadow-lg'
                      : theme === 'dark'
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <span className={cn("text-2xl font-bold block mb-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {method.icon}
                  </span>
                  <span className={cn("font-medium text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {method.name}
                  </span>
                </motion.button>
              ))}
            </div>

            {wizardData.paymentMethod === 'cash' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div>
                  <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Efectivo recibido
                  </label>
                  <Input
                    type="number"
                    value={wizardData.cashReceived || ''}
                    onChange={(e) => updateWizardData({ cashReceived: parseFloat(e.target.value) || 0 })}
                    className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
                  />
                </div>
                {wizardData.cashReceived >= wizardData.totalCharged && (
                  <div className={cn("p-4 rounded-xl text-center", theme === 'dark' ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200')}>
                    <span className={cn("text-lg font-bold", theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                      Cambio: ${(wizardData.cashReceived - wizardData.totalCharged).toFixed(2)}
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {(wizardData.paymentMethod === 'zelle' || wizardData.paymentMethod === 'card') && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  Referencia de pago
                </label>
                <Input
                  value={wizardData.paymentReference}
                  onChange={(e) => updateWizardData({ paymentReference: e.target.value })}
                  className={cn("rounded-xl h-12", theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300')}
                  placeholder={wizardData.paymentMethod === 'zelle' ? 'ZELLE-XXXXX' : 'Ref. Terminal'}
                />
              </motion.div>
            )}
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-500"
              >
                <Check className="w-8 h-8 text-white" />
              </motion.div>
              <h2 className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Orden Creada Exitosamente
              </h2>
              <p className="text-2xl font-bold mt-2 text-blue-600">
                {wizardData.orderNumber}
              </p>
            </div>

            <div className={cn("p-5 rounded-xl space-y-3", theme === 'dark' ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200')}>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Destinatario:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{wizardData.recipientName}</span>
              </div>
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Monto enviado:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>${wizardData.sendAmount.toFixed(2)} USD</span>
              </div>
              {wizardData.receiveCurrency !== 'USD' && (
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Recibe en Cuba:</span>
                  <span className={cn("font-bold text-lg", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                    {wizardData.receiveAmount.toLocaleString('es-CU')} {wizardData.receiveCurrency}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Ubicacion:</span>
                <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{wizardData.municipality}, {wizardData.province}</span>
              </div>
              <div className={cn("flex justify-between items-center pt-3 border-t", theme === 'dark' ? 'border-gray-600' : 'border-gray-200')}>
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Entrega estimada:</span>
                <span className="font-bold px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-500 border border-green-500/30">
                  {wizardData.estimatedDelivery}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" className={cn("flex flex-col items-center gap-1 h-auto py-3 rounded-xl", theme === 'dark' ? 'border-gray-600' : '')}>
                <Phone className="w-5 h-5" />
                <span className="text-xs">SMS</span>
              </Button>
              <Button variant="outline" className={cn("flex flex-col items-center gap-1 h-auto py-3 rounded-xl", theme === 'dark' ? 'border-gray-600' : '')}>
                <MessageCircle className="w-5 h-5" />
                <span className="text-xs">WhatsApp</span>
              </Button>
              <Button variant="outline" className={cn("flex flex-col items-center gap-1 h-auto py-3 rounded-xl", theme === 'dark' ? 'border-gray-600' : '')}>
                <Printer className="w-5 h-5" />
                <span className="text-xs">Imprimir</span>
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        {/* Main Container */}
        <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 relative">

          {/* Close Button */}
          <motion.button
            onClick={() => setShowCancelModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "absolute -top-14 -right-2 sm:-top-12 sm:right-0 z-10 w-8 h-8 rounded-full flex items-center justify-center",
              "transition-colors duration-200",
              theme === 'dark'
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
            )}
          >
            <X className="w-4 h-4" />
          </motion.button>

          {/* Progress Indicator */}
          <div className="mb-8 sm:mb-12">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <div className="relative w-14 h-14">
                      {/* Pulsing ring for active step */}
                      {currentStep === step.id && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0, 0.5]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          style={{
                            background: theme === 'dark'
                              ? 'rgba(59, 130, 246, 0.5)'
                              : 'rgba(37, 99, 235, 0.5)'
                          }}
                        />
                      )}

                      <motion.div
                        initial={false}
                        animate={{
                          scale: currentStep === step.id ? 1.1 : 1,
                          backgroundColor: currentStep === step.id
                            ? theme === 'dark' ? '#3B82F6' : '#2563EB'
                            : currentStep > step.id
                            ? theme === 'dark' ? '#10B981' : '#059669'
                            : theme === 'dark' ? '#374151' : '#E5E7EB'
                        }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ scale: currentStep >= step.id ? 1.15 : 1.05 }}
                        className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                          "transition-shadow duration-300",
                          currentStep === step.id && (
                            theme === 'dark'
                              ? 'shadow-lg shadow-blue-500/50'
                              : 'shadow-lg shadow-blue-400/50'
                          ),
                          currentStep > step.id && (
                            theme === 'dark'
                              ? 'shadow-md shadow-green-500/30'
                              : 'shadow-md shadow-green-400/30'
                          )
                        )}
                      >
                        {currentStep > step.id ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                          >
                            <Check className="w-7 h-7 text-white" />
                          </motion.div>
                        ) : (
                          <step.icon className={cn(
                            "w-7 h-7",
                            currentStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                        )}
                      </motion.div>
                    </div>

                    <div className="mt-3 text-center">
                      <p className={cn(
                        "text-xs sm:text-sm font-semibold",
                        currentStep === step.id
                          ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          : currentStep > step.id
                          ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                          : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        {step.title}
                      </p>
                      <p className={cn(
                        "text-xs hidden sm:block mt-0.5",
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-500'
                      )}>
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {index < steps.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                      <div className={cn(
                        "absolute inset-0 rounded-full",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )} />
                      <motion.div
                        initial={false}
                        animate={{
                          scaleX: currentStep > step.id ? 1 : 0
                        }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className={cn(
                          "h-full origin-left rounded-full",
                          theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
                        )}
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <motion.div
            className={cn(
              "rounded-2xl border p-6 sm:p-8 shadow-lg",
              theme === 'dark'
                ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
                : 'bg-white border-gray-200 backdrop-blur-sm'
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white shadow-lg'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900 shadow-md'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </Button>
            </motion.div>

            {currentStep < 7 ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleNext}
                  disabled={!canProceed || loading}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    currentStep === 6
                      ? theme === 'dark'
                        ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/30'
                        : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-400/30'
                      : theme === 'dark'
                        ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                        : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/30',
                    'text-white'
                  )}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : currentStep === 6 ? (
                    <>
                      <Check className="w-5 h-5" />
                      Confirmar Orden
                    </>
                  ) : (
                    <>
                      Siguiente
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={() => router.push('/dashboard/agency-admin/cupones-familiares')}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    theme === 'dark'
                      ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/30'
                      : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-400/30',
                    'text-white'
                  )}
                >
                  <Check className="w-5 h-5" />
                  Finalizar
                </Button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Cancel Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCancelModal(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className={cn(
                    "w-full max-w-md rounded-2xl shadow-2xl border",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                        theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                      )}>
                        <X className={cn("w-6 h-6", theme === 'dark' ? 'text-red-400' : 'text-red-600')} />
                      </div>
                      <div className="flex-1">
                        <h3 className={cn("text-xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Cancelar orden?
                        </h3>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          Se perdera toda la informacion ingresada y no podras recuperarla.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={cn("flex gap-3 p-6 pt-4 border-t", theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCancelModal(false)}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                        theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      )}
                    >
                      Continuar editando
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => router.push('/dashboard/agency-admin/cupones-familiares')}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                        theme === 'dark' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                      )}
                    >
                      Si, cancelar
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
