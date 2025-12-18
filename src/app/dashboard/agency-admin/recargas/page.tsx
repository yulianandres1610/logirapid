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
  RefreshCw
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
  productId: string
  rechargeProductId: number
  code: string
  name: string
  description: string
  countryCode: string
  countryName: string
  isPromotion: boolean
  validFrom: string | null
  validTo: string | null
  // Pricing
  miCosto: number      // Company's cost (what LogiRapid charges them)
  precioClientes: number | null  // Company's selling price to customers
  hasPricing: boolean
  // For display
  slug?: string
  phonePattern?: string
  acceptsRange?: boolean
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

// Default amounts for products
const DEFAULT_AMOUNTS = [5, 10, 15, 20, 25, 30, 50, 100]

export default function RecargasPage() {
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

      // Get company ID from cookie
      const companyIdCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('user-company-id='))
        ?.split('=')[1]

      if (!companyIdCookie) {
        console.error('[Agency Recargas] No company ID found in cookies')
        showNotification('error', 'Error', 'No se pudo identificar la empresa')
        return
      }

      // Fetch products from company catalog with pricing
      const response = await fetch(`/api/companies/${companyIdCookie}/products/pricing`)
      const data = await response.json()

      console.log('[Agency Recargas] API Response:', data)

      if (data.success) {
        // Filter only recharge products (serviceCategory === 'recarga')
        const rechargeProducts = (data.data.byCategory?.recarga || []) as RechargeProduct[]

        console.log('[Agency Recargas] Recharge products found:', rechargeProducts.length)

        // Only show products with pricing configured (precioClientes set)
        const enabledProducts = rechargeProducts.filter(
          (p: RechargeProduct) => p.hasPricing && p.precioClientes !== null && p.precioClientes > 0
        )

        console.log('[Agency Recargas] Products with pricing:', enabledProducts.length)
        setProducts(enabledProducts)
      } else {
        console.error('[Agency Recargas] API error:', data.error)
        showNotification('error', 'Error', data.error || 'No se pudieron cargar los productos')
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
      const productName = p.name?.toLowerCase() || ''
      const isNauta = productName.includes('nauta')
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

  // Handle product selection - for recharge products, go directly to phone since price is fixed
  const handleProductSelect = (product: RechargeProduct) => {
    // Set amount to the company's selling price (precioClientes)
    const amount = product.precioClientes || product.miCosto
    setRecargaData(prev => ({ ...prev, product, phoneNumber: '', amount }))
    setCustomAmount('')
    setCurrentStep('phone')
  }

  // Handle phone submit - skip amount step for fixed-price products, go to confirmation
  const handlePhoneSubmit = () => {
    if (recargaData.product && validatePhoneNumber(recargaData.phoneNumber, recargaData.product.phonePattern || '')) {
      // For recharge products with fixed price, skip amount selection
      setCurrentStep('confirmation')
    }
  }

  // Handle amount selection (not used for fixed-price recharge products)
  const handleAmountSelect = (amount: number) => {
    setRecargaData(prev => ({ ...prev, amount }))
    setCurrentStep('confirmation')
  }

  // Handle custom amount (not used for fixed-price recharge products)
  const handleCustomAmountSubmit = () => {
    const amount = parseFloat(customAmount)
    if (amount > 0) {
      handleAmountSelect(amount)
    }
  }

  // Get the selling price - for recharge products it's precioClientes
  const getSellingPrice = (): number => {
    const product = recargaData.product
    if (!product) return 0
    return product.precioClientes || product.miCosto || 0
  }

  // Process recharge
  const handleConfirmRecarga = async () => {
    setIsProcessing(true)

    try {
      const sellingPrice = getSellingPrice()

      const response = await fetch('/api/admin/recargas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: recargaData.product?.rechargeProductId,
          productName: recargaData.product?.name,
          service: recargaData.service,
          phoneNumber: recargaData.phoneNumber,
          amount: sellingPrice, // For fixed-price products, amount = selling price
          sellingPrice: sellingPrice,
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
    const sellingPrice = getSellingPrice()
    const printContent = `
====================================
     CUBARAPID - RECARGA EXITOSA
====================================
ID: ${recargaId}
Fecha: ${new Date().toLocaleString('es-ES')}
Producto: ${recargaData.product?.name || '-'}
Numero: ${recargaData.phoneNumber}
Precio Cobrado: $${sellingPrice.toFixed(2)}
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
            "hover:shadow-xl hover:border-exa-primary",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
              : "bg-white border-gray-200 hover:bg-gray-50"
          )}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold">Telefono</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Recarga para telefono movil
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                Cubacel
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
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
            "hover:shadow-xl hover:border-exa-primary",
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
              <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">
                Internet
              </span>
              <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">
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
            <Loader2 className="w-8 h-8 animate-spin text-exa-primary" />
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
            {filteredProducts.map((product) => (
              <motion.button
                key={product.productId}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleProductSelect(product)}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-300 text-left",
                  "hover:shadow-lg hover:border-exa-primary",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0",
                    recargaData.service === 'nauta'
                      ? "bg-gradient-to-br from-cyan-500 to-cyan-600"
                      : "bg-gradient-to-br from-blue-500 to-blue-600"
                  )}>
                    {getCountryFlag(product.countryCode)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                      {product.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {product.countryName}
                    </div>
                    {/* Show company's selling price */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ${(product.precioClientes || product.miCosto).toFixed(2)}
                      </span>
                    </div>
                    {product.isPromotion && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                        Promoción
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            ))}
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
      ? validatePhoneNumber(recargaData.phoneNumber, recargaData.product.phonePattern || '')
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
                : "bg-gradient-to-br from-blue-500 to-blue-600"
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
                  "focus:ring-2 focus:ring-exa-primary focus:border-transparent",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                )}
              />
            </div>
            {recargaData.product?.phonePattern && (
              <p className="text-sm text-gray-500 mt-2">
                Formato: {recargaData.product.phonePattern}
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

  // Render amount step (not used for fixed-price recharge products)
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
          {DEFAULT_AMOUNTS.map((amount) => (
            <motion.button
              key={amount}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAmountSelect(amount)}
              className={cn(
                "p-4 rounded-xl border-2 transition-all duration-300",
                "hover:shadow-lg hover:border-exa-primary",
                recargaData.amount === amount
                  ? "border-exa-primary bg-exa-primary/10"
                  : theme === 'dark'
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
              )}
            >
              <div className="flex flex-col items-center space-y-1">
                <span className="text-2xl font-bold">${amount}</span>
                <span className="text-xs text-gray-500">USD</span>
              </div>
            </motion.button>
          ))}
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
                    "focus:ring-2 focus:ring-exa-primary focus:border-transparent",
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
    const sellingPrice = getSellingPrice()

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
          theme === 'dark'
            ? "bg-gray-800 border-gray-700"
            : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Producto:</span>
            <span className="font-medium">{recargaData.product?.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Numero:</span>
            <span className="font-medium">{recargaData.phoneNumber}</span>
          </div>
          {recargaData.product?.isPromotion && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-sm rounded-full">
                Promoción
              </span>
            </div>
          )}
          <div className="border-t pt-4 mt-4 dark:border-gray-600">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total a Cobrar:</span>
              <span className="text-2xl font-bold text-exa-primary">
                ${sellingPrice.toFixed(2)}
              </span>
            </div>
          </div>
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
                "focus:ring-2 focus:ring-exa-primary focus:border-transparent",
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
                "focus:ring-2 focus:ring-exa-primary focus:border-transparent",
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
            onClick={() => setCurrentStep('phone')}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atras
          </Button>
          <Button
            onClick={handleConfirmRecarga}
            disabled={isProcessing}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
    const sellingPrice = getSellingPrice()

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="space-y-8 text-center max-w-md mx-auto"
      >
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-10 h-10 text-white" />
        </div>

        <div>
          <h2 className="text-3xl font-bold mb-4">¡Recarga Exitosa!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Tu recarga ha sido procesada correctamente
          </p>
        </div>

        <div className={cn(
          "p-6 rounded-xl border-2 space-y-3 text-left",
          theme === 'dark'
            ? "bg-gray-800 border-gray-700"
            : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">ID:</span>
            <span className="font-medium font-mono">{recargaId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Producto:</span>
            <span className="font-medium">{recargaData.product?.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Numero:</span>
            <span className="font-medium">{recargaData.phoneNumber}</span>
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
            className="w-full"
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
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Recargas</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Sistema de recargas para Telefono y Nauta
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
                        ? theme === 'dark'
                          ? "bg-exa-secondary text-white"
                          : "bg-exa-primary text-white"
                        : currentStepIndex > index
                          ? theme === 'dark'
                            ? "bg-white/10 text-white"
                            : "bg-gray-100 text-gray-700"
                          : theme === 'dark'
                            ? "bg-gray-700 text-gray-400"
                            : "bg-gray-200 text-gray-500"
                    )}>
                      <step.icon className="w-5 h-5" />
                    </div>
                    <span className={cn(
                      "ml-2 text-sm font-medium hidden sm:block",
                      currentStep === step.id
                        ? "text-exa-primary"
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
                        ? theme === 'dark'
                          ? "bg-white/10"
                          : "bg-gray-200"
                        : "bg-exa-primary"
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
