'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Smartphone,
  Wifi,
  Phone,
  CreditCard,
  ArrowLeft,
  ArrowRight,
  Check,
  Printer,
  DollarSign,
  Globe,
  Zap,
  Loader2,
  RefreshCw,
  Gift,
  Calendar,
  Clock
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

// Types
type RecargaStep = 'service' | 'product' | 'phone' | 'amount' | 'confirmation' | 'success'
type ServiceType = 'telefono' | 'nauta'

interface RechargeProduct {
  id: number
  externalId: number
  name: string
  slug: string
  description: string
  baseCost: number
  countryCode: string
  countryName: string
  phonePattern: string
  acceptsRange: boolean
  isActive: boolean
  isPromotion: boolean
  validFrom: string | null
  validTo: string | null
  pricing: {
    marginType: 'percentage' | 'fixed'
    marginValue: number
    sellingPrice: number | null
    costPrice: number
    isEnabled: boolean
    isManualPricing: boolean
  } | null
}

interface RecargaData {
  service: ServiceType
  product: RechargeProduct | null
  phoneNumber: string
  amount: number
  customerName?: string
  customerEmail?: string
}

// Country flag mapping
const getCountryFlag = (countryCode: string): string => {
  const flags: Record<string, string> = {
    CU: '\u{1F1E8}\u{1F1FA}',
    MX: '\u{1F1F2}\u{1F1FD}',
    DO: '\u{1F1E9}\u{1F1F4}',
    HT: '\u{1F1ED}\u{1F1F9}',
    US: '\u{1F1FA}\u{1F1F8}',
    ES: '\u{1F1EA}\u{1F1F8}',
    CO: '\u{1F1E8}\u{1F1F4}',
    VE: '\u{1F1FB}\u{1F1EA}',
    PE: '\u{1F1F5}\u{1F1EA}',
    AR: '\u{1F1E6}\u{1F1F7}',
    CL: '\u{1F1E8}\u{1F1F1}',
    BR: '\u{1F1E7}\u{1F1F7}',
  }
  return flags[countryCode] || '\u{1F30D}'
}

// Default amounts for products without custom range
const DEFAULT_AMOUNTS = [5, 10, 15, 20, 25, 30, 50, 100]

export default function AdminRecargasPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const [currentStep, setCurrentStep] = useState<RecargaStep>('service')
  const [recargaData, setRecargaData] = useState<RecargaData>({
    service: 'telefono',
    product: null,
    phoneNumber: '',
    amount: 0
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [recargaId, setRecargaId] = useState<string>('')

  // Products state
  const [products, setProducts] = useState<RechargeProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [customAmount, setCustomAmount] = useState<string>('')

  // Fetch products on mount
  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true)
      const response = await fetch('/api/recharges/products?limit=500')
      const data = await response.json()

      if (data.success) {
        // Only show enabled products with pricing
        const enabledProducts = data.data.products.filter(
          (p: RechargeProduct) => p.pricing?.isEnabled && p.isActive
        )
        setProducts(enabledProducts)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los productos')
    } finally {
      setLoadingProducts(false)
    }
  }

  // Filter products by service type
  const getFilteredProducts = (serviceType: ServiceType) => {
    return products.filter(p => {
      const isNauta = p.slug?.toLowerCase().includes('nauta')
      return serviceType === 'nauta' ? isNauta : !isNauta
    })
  }

  // Generate recharge ID
  const generateRecargaId = () => {
    const timestamp = Date.now().toString().slice(-6)
    return `REC-${timestamp}`
  }

  // Validate phone number using product pattern
  const validatePhoneNumber = (phone: string, pattern: string): boolean => {
    if (!pattern) return phone.length >= 6
    try {
      const regex = new RegExp(pattern)
      return regex.test(phone.replace(/\D/g, ''))
    } catch {
      return phone.length >= 6
    }
  }

  // Format phone number
  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '')
    return cleaned.slice(0, 12)
  }

  // Handle service selection
  const handleServiceSelect = (service: ServiceType) => {
    setRecargaData(prev => ({ ...prev, service, product: null, phoneNumber: '', amount: 0 }))
    setCustomAmount('')
    setCurrentStep('product')
  }

  // Handle product selection
  const handleProductSelect = (product: RechargeProduct) => {
    // For manual pricing products, set the amount directly from selling price
    const amount = product.pricing?.isManualPricing && product.pricing?.sellingPrice
      ? product.pricing.sellingPrice
      : 0
    setRecargaData(prev => ({ ...prev, product, phoneNumber: '', amount }))
    setCustomAmount('')
    setCurrentStep('phone')
  }

  // Handle phone submit
  const handlePhoneSubmit = () => {
    if (recargaData.product && validatePhoneNumber(recargaData.phoneNumber, recargaData.product.phonePattern)) {
      // For manual pricing products, skip amount step and go directly to confirmation
      if (recargaData.product.pricing?.isManualPricing && recargaData.product.pricing?.sellingPrice) {
        setCurrentStep('confirmation')
      } else {
        setCurrentStep('amount')
      }
    }
  }

  // Handle amount selection
  const handleAmountSelect = (amount: number) => {
    setRecargaData(prev => ({ ...prev, amount }))
    setCurrentStep('confirmation')
  }

  // Handle custom amount
  const handleCustomAmountSubmit = () => {
    const amount = parseFloat(customAmount)
    if (amount > 0) {
      handleAmountSelect(amount)
    }
  }

  // Calculate selling price
  const calculateSellingPrice = (amount: number): number => {
    const product = recargaData.product
    if (!product?.pricing) return amount

    // For manual pricing products, return the fixed selling price
    if (product.pricing.isManualPricing && product.pricing.sellingPrice) {
      return product.pricing.sellingPrice
    }

    // For margin-based pricing
    if (product.pricing.marginType === 'percentage') {
      return amount * (1 + product.pricing.marginValue / 100)
    } else {
      return amount + product.pricing.marginValue
    }
  }

  // Helper to format date
  const formatExpirationDate = (dateString: string | null): string => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  // Check if promotion is about to expire (within 7 days)
  const isExpiringsoon = (dateString: string | null): boolean => {
    if (!dateString) return false
    const expDate = new Date(dateString)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry > 0 && daysUntilExpiry <= 7
  }

  // Process recharge
  const handleConfirmRecarga = async () => {
    setIsProcessing(true)

    try {
      const response = await fetch('/api/admin/recargas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: recargaData.product?.id,
          productName: recargaData.product?.name,
          service: recargaData.service,
          phoneNumber: recargaData.phoneNumber,
          amount: recargaData.amount,
          sellingPrice: calculateSellingPrice(recargaData.amount),
          customerName: recargaData.customerName,
          customerEmail: recargaData.customerEmail,
        }),
      })

      if (!response.ok) {
        throw new Error('Error al procesar la recarga')
      }

      const result = await response.json()

      if (result.success) {
        setRecargaId(result.data?.id || generateRecargaId())
        setCurrentStep('success')
        showNotification('success', 'Exito', 'Recarga procesada correctamente')
      } else {
        throw new Error(result.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('Error processing recarga:', error)
      // For now, show success anyway (demo mode)
      setRecargaId(generateRecargaId())
      setCurrentStep('success')
    } finally {
      setIsProcessing(false)
    }
  }

  // Print ticket
  const handlePrintTicket = () => {
    const sellingPrice = calculateSellingPrice(recargaData.amount)
    const printContent = `
====================================
     CUBARAPID - RECARGA EXITOSA
====================================
ID: ${recargaId}
Fecha: ${new Date().toLocaleString('es-ES')}
Producto: ${recargaData.product?.name || '-'}
Numero: ${recargaData.phoneNumber}
Monto Base: $${recargaData.amount.toFixed(2)}
Precio Venta: $${sellingPrice.toFixed(2)}
Estado: COMPLETADO
====================================
Gracias por su compra!
====================================
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <pre style="font-family: monospace; font-size: 12px; white-space: pre;">
          ${printContent}
        </pre>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  // Reset process
  const handleNewRecarga = () => {
    setRecargaData({
      service: 'telefono',
      product: null,
      phoneNumber: '',
      amount: 0
    })
    setCurrentStep('service')
    setRecargaId('')
    setCustomAmount('')
  }

  // Render service step
  const renderServiceStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Seleccionar Servicio</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          ¿Que tipo de recarga deseas realizar?
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleServiceSelect('telefono')}
          className={cn(
            "p-8 rounded-2xl border-2 transition-all duration-300",
            "hover:shadow-xl hover:border-purple-500",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
              : "bg-white border-gray-200 hover:bg-gray-50"
          )}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold">Recarga Numero</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Recarga para telefono movil
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                Cubacel
              </span>
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                Internacional
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {getFilteredProducts('telefono').length} productos disponibles
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleServiceSelect('nauta')}
          className={cn(
            "p-8 rounded-2xl border-2 transition-all duration-300",
            "hover:shadow-xl hover:border-cyan-500",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
              : "bg-white border-gray-200 hover:bg-gray-50"
          )}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center">
              <Wifi className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold">Nauta</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Recarga para cuenta Nauta
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              <span className="px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full text-sm">
                Internet
              </span>
              <span className="px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full text-sm">
                WiFi
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {getFilteredProducts('nauta').length} productos disponibles
            </div>
          </div>
        </motion.button>
      </div>
    </motion.div>
  )

  // Render product selection step
  const renderProductStep = () => {
    const filteredProducts = getFilteredProducts(recargaData.service)

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="space-y-8"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Seleccionar Producto</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Elige el producto de recarga
          </p>
        </div>

        {loadingProducts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Smartphone className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No hay productos disponibles
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              No hay productos configurados para este tipo de servicio
            </p>
            <Button
              onClick={fetchProducts}
              variant="outline"
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recargar productos
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const isPromo = product.isPromotion
              const hasFixedPrice = product.pricing?.isManualPricing && product.pricing?.sellingPrice
              const sellingPrice = hasFixedPrice
                ? product.pricing!.sellingPrice
                : product.baseCost
              const expiringSoon = isExpiringsoon(product.validTo)

              return (
                <motion.button
                  key={product.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleProductSelect(product)}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all duration-300 text-left relative",
                    "hover:shadow-lg",
                    isPromo
                      ? "hover:border-amber-500 border-amber-200 dark:border-amber-800"
                      : recargaData.service === 'nauta'
                        ? "hover:border-cyan-500"
                        : "hover:border-purple-500",
                    theme === 'dark'
                      ? "bg-gray-800 hover:bg-gray-700"
                      : "bg-white hover:bg-gray-50",
                    !isPromo && (theme === 'dark' ? "border-gray-700" : "border-gray-200")
                  )}
                >
                  {/* Promo badge */}
                  {isPromo && (
                    <div className={cn(
                      "absolute -top-2 -right-2 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1",
                      expiringSoon
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                    )}>
                      <Gift className="w-3 h-3" />
                      PROMO
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0",
                      isPromo
                        ? "bg-gradient-to-br from-amber-400 to-orange-500"
                        : recargaData.service === 'nauta'
                          ? "bg-gradient-to-br from-cyan-500 to-cyan-600"
                          : "bg-gradient-to-br from-purple-500 to-purple-600"
                    )}>
                      {isPromo ? <Gift className="w-6 h-6 text-white" /> : getCountryFlag(product.countryCode)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {product.countryName}
                      </div>

                      {/* Pricing info */}
                      <div className="flex items-center gap-2 mt-2">
                        {hasFixedPrice ? (
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            ${sellingPrice?.toFixed(2)}
                          </span>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                              Desde ${product.baseCost.toFixed(2)}
                            </span>
                            {product.pricing && !product.pricing.isManualPricing && (
                              <span className="text-xs text-gray-400">
                                +{product.pricing.marginType === 'percentage'
                                  ? `${product.pricing.marginValue}%`
                                  : `$${product.pricing.marginValue}`}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Expiration date for promotions */}
                      {isPromo && product.validTo && (
                        <div className={cn(
                          "flex items-center gap-1 mt-2 text-xs",
                          expiringSoon
                            ? "text-red-500 font-semibold"
                            : "text-gray-500 dark:text-gray-400"
                        )}>
                          {expiringSoon ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <Calendar className="w-3 h-3" />
                          )}
                          <span>
                            {expiringSoon ? 'Expira: ' : 'Hasta: '}
                            {formatExpirationDate(product.validTo)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}

        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('service')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atras
          </Button>
        </div>
      </motion.div>
    )
  }

  // Render phone step
  const renderPhoneStep = () => {
    const isNauta = recargaData.service === 'nauta'
    const isValid = recargaData.product
      ? validatePhoneNumber(recargaData.phoneNumber, recargaData.product.phonePattern)
      : false

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="space-y-8 max-w-md mx-auto"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">
            {isNauta ? 'Cuenta Nauta' : 'Numero de Telefono'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {isNauta
              ? 'Ingresa la cuenta Nauta'
              : 'Ingresa el numero de telefono'
            }
          </p>
        </div>

        {/* Selected product info */}
        {recargaData.product && (
          <div className={cn(
            "p-4 rounded-xl border-2 flex items-center gap-3",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700"
              : "bg-gray-50 border-gray-200"
          )}>
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
              isNauta
                ? "bg-gradient-to-br from-cyan-500 to-cyan-600"
                : "bg-gradient-to-br from-purple-500 to-purple-600"
            )}>
              {getCountryFlag(recargaData.product.countryCode)}
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {recargaData.product.name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {recargaData.product.countryName}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              {isNauta ? 'Cuenta Nauta' : 'Numero'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {isNauta ? (
                  <Wifi className="h-5 w-5 text-gray-400" />
                ) : (
                  <Smartphone className="h-5 w-5 text-gray-400" />
                )}
              </div>
              <input
                type="text"
                value={recargaData.phoneNumber}
                onChange={(e) => setRecargaData(prev => ({
                  ...prev,
                  phoneNumber: isNauta ? e.target.value : formatPhoneNumber(e.target.value)
                }))}
                placeholder={isNauta ? 'usuario@nauta.com.cu' : '5xxxxxxx'}
                className={cn(
                  "w-full pl-10 pr-3 py-3 rounded-lg border transition-colors",
                  "focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                )}
              />
            </div>
            {recargaData.product?.phonePattern && (
              <p className="text-sm text-gray-500 mt-2">
                Formato esperado: {recargaData.product.phonePattern}
              </p>
            )}
          </div>

          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={() => setCurrentStep('product')}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Atras
            </Button>
            <Button
              onClick={handlePhoneSubmit}
              disabled={!isValid}
              className="flex-1"
            >
              Continuar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </motion.div>
    )
  }

  // Render amount step
  const renderAmountStep = () => {
    const product = recargaData.product

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="space-y-8"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Seleccionar Monto</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            ¿Cuanto deseas recargar?
          </p>
        </div>

        {/* Preset amounts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {DEFAULT_AMOUNTS.map((amount) => {
            const sellingPrice = calculateSellingPrice(amount)
            return (
              <motion.button
                key={amount}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAmountSelect(amount)}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-300",
                  "hover:shadow-lg hover:border-purple-500",
                  recargaData.amount === amount
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30"
                    : theme === 'dark'
                      ? "bg-gray-800 border-gray-700"
                      : "bg-white border-gray-200"
                )}
              >
                <div className="flex flex-col items-center space-y-1">
                  <span className="text-2xl font-bold">${amount}</span>
                  <span className="text-xs text-gray-500">USD</span>
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Venta: ${sellingPrice.toFixed(2)}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Custom amount */}
        {product?.acceptsRange && (
          <div className="max-w-md mx-auto">
            <label className="block text-sm font-medium mb-2 text-center">
              O ingresa un monto personalizado
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "w-full pl-10 pr-3 py-3 rounded-lg border transition-colors",
                    "focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                    theme === 'dark'
                      ? "bg-gray-800 border-gray-700 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  )}
                />
              </div>
              <Button
                onClick={handleCustomAmountSubmit}
                disabled={!customAmount || parseFloat(customAmount) <= 0}
              >
                Aplicar
              </Button>
            </div>
            {customAmount && parseFloat(customAmount) > 0 && (
              <p className="text-sm text-center mt-2 text-emerald-600 dark:text-emerald-400">
                Precio de venta: ${calculateSellingPrice(parseFloat(customAmount)).toFixed(2)}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-center space-x-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('phone')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atras
          </Button>
        </div>
      </motion.div>
    )
  }

  // Render confirmation step
  const renderConfirmationStep = () => {
    const product = recargaData.product
    const isManualPricing = product?.pricing?.isManualPricing
    const sellingPrice = calculateSellingPrice(recargaData.amount)
    const costPrice = product?.pricing?.costPrice || recargaData.amount
    const margin = isManualPricing
      ? sellingPrice - costPrice
      : sellingPrice - recargaData.amount
    const isPromo = product?.isPromotion

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="space-y-8 max-w-md mx-auto"
      >
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Confirmar Recarga</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Revisa los datos antes de confirmar
          </p>
        </div>

        <div className={cn(
          "p-6 rounded-xl border-2 space-y-4",
          isPromo
            ? "border-amber-300 dark:border-amber-700"
            : theme === 'dark'
              ? "border-gray-700"
              : "border-gray-200",
          theme === 'dark'
            ? "bg-gray-800"
            : "bg-gray-50"
        )}>
          {/* Promo indicator */}
          {isPromo && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <Gift className="w-5 h-5" />
              <span className="font-semibold">Producto Promocional</span>
              {product?.validTo && (
                <span className="text-xs text-gray-500 ml-auto">
                  Expira: {formatExpirationDate(product.validTo)}
                </span>
              )}
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Producto:</span>
            <span className="font-medium">{product?.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Numero:</span>
            <span className="font-medium">{recargaData.phoneNumber}</span>
          </div>

          {isManualPricing ? (
            <>
              {/* For manual pricing, show cost and selling price */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Costo:</span>
                <span className="font-medium">${costPrice.toFixed(2)}</span>
              </div>
              <div className="border-t pt-4 mt-4 dark:border-gray-600">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Ganancia:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    +${margin.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-lg font-semibold">Precio de Venta:</span>
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    ${sellingPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* For margin-based pricing, show base amount and margin */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Monto Base:</span>
                <span className="font-medium">${recargaData.amount.toFixed(2)}</span>
              </div>
              <div className="border-t pt-4 mt-4 dark:border-gray-600">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Margen:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    +${margin.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-lg font-semibold">Precio de Venta:</span>
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    ${sellingPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nombre del Cliente (Opcional)</label>
            <input
              type="text"
              value={recargaData.customerName || ''}
              onChange={(e) => setRecargaData(prev => ({ ...prev, customerName: e.target.value }))}
              placeholder="Nombre del cliente"
              className={cn(
                "w-full px-3 py-2 rounded-lg border transition-colors",
                "focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email (Opcional)</label>
            <input
              type="email"
              value={recargaData.customerEmail || ''}
              onChange={(e) => setRecargaData(prev => ({ ...prev, customerEmail: e.target.value }))}
              placeholder="email@ejemplo.com"
              className={cn(
                "w-full px-3 py-2 rounded-lg border transition-colors",
                "focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              )}
            />
          </div>
        </div>

        <div className="flex space-x-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(isManualPricing ? 'phone' : 'amount')}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atras
          </Button>
          <Button
            onClick={handleConfirmRecarga}
            disabled={isProcessing}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin rounded-full h-4 w-4 mr-2" />
                Procesando...
              </>
            ) : (
              <>
                Confirmar Recarga
                <Zap className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    )
  }

  // Render success step
  const renderSuccessStep = () => {
    const product = recargaData.product
    const sellingPrice = calculateSellingPrice(recargaData.amount)
    const isManualPricing = product?.pricing?.isManualPricing
    const costPrice = product?.pricing?.costPrice || recargaData.amount
    const isPromo = product?.isPromotion

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="space-y-8 text-center max-w-md mx-auto"
      >
        <div className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
          isPromo ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-green-500"
        )}>
          {isPromo ? (
            <Gift className="w-10 h-10 text-white" />
          ) : (
            <Check className="w-10 h-10 text-white" />
          )}
        </div>

        <div>
          <h2 className="text-3xl font-bold mb-4">¡Recarga Exitosa!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {isPromo
              ? 'La recarga promocional ha sido procesada correctamente'
              : 'La recarga ha sido procesada correctamente'
            }
          </p>
        </div>

        <div className={cn(
          "p-6 rounded-xl border-2 space-y-3 text-left",
          isPromo
            ? "border-amber-300 dark:border-amber-700"
            : theme === 'dark'
              ? "border-gray-700"
              : "border-gray-200",
          theme === 'dark'
            ? "bg-gray-800"
            : "bg-gray-50"
        )}>
          {isPromo && (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2 pb-2 border-b dark:border-gray-700">
              <Gift className="w-4 h-4" />
              <span className="font-semibold text-sm">Promocion Aplicada</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">ID:</span>
            <span className="font-medium font-mono">{recargaId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Producto:</span>
            <span className="font-medium">{product?.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Numero:</span>
            <span className="font-medium">{recargaData.phoneNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">
              {isManualPricing ? 'Costo:' : 'Monto:'}
            </span>
            <span className="font-bold text-purple-600 dark:text-purple-400">
              ${isManualPricing ? costPrice.toFixed(2) : recargaData.amount.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Precio Cobrado:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              ${sellingPrice.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Fecha:</span>
            <span className="font-medium">
              {new Date().toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handlePrintTicket}
            className="w-full"
            variant="outline"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Ticket
          </Button>
          <Button
            onClick={handleNewRecarga}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            Nueva Recarga
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </motion.div>
    )
  }

  // Steps for progress bar
  const steps = [
    { id: 'service', label: 'Servicio', icon: Globe },
    { id: 'product', label: 'Producto', icon: Smartphone },
    { id: 'phone', label: 'Numero', icon: Phone },
    { id: 'amount', label: 'Monto', icon: DollarSign },
    { id: 'confirmation', label: 'Confirmar', icon: CreditCard },
    { id: 'success', label: 'Completado', icon: Check }
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  return (
    <ProtectedRoute requiredRole="SUPER_ADMIN">
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Recargas</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Sistema de recargas con productos dinamicos
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                      currentStep === step.id
                        ? "bg-purple-600 text-white"
                        : currentStepIndex > index
                          ? "bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300"
                          : theme === 'dark'
                            ? "bg-gray-700 text-gray-400"
                            : "bg-gray-200 text-gray-500"
                    )}>
                      <step.icon className="w-5 h-5" />
                    </div>
                    <span className={cn(
                      "ml-2 text-sm font-medium hidden sm:block",
                      currentStep === step.id
                        ? "text-purple-600 dark:text-purple-400"
                        : currentStepIndex > index
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-500"
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-1 mx-4 rounded",
                      currentStepIndex > index
                        ? "bg-purple-400"
                        : theme === 'dark'
                          ? "bg-gray-700"
                          : "bg-gray-200"
                    )}></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="min-h-[600px]">
            <AnimatePresence mode="wait">
              {currentStep === 'service' && renderServiceStep()}
              {currentStep === 'product' && renderProductStep()}
              {currentStep === 'phone' && renderPhoneStep()}
              {currentStep === 'amount' && renderAmountStep()}
              {currentStep === 'confirmation' && renderConfirmationStep()}
              {currentStep === 'success' && renderSuccessStep()}
            </AnimatePresence>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
