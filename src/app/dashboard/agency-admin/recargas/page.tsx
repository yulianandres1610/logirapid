'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  Clock,
  Plus,
  Search,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import LoadingBox from '@/components/ui/LoadingBox'

// Types
type RecargaStep = 'service' | 'product' | 'phone' | 'confirmation' | 'success'
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
  miCosto: number
  precioClientes: number | null
  hasPricing: boolean
  slug?: string
}

interface RecargaData {
  service: ServiceType
  product: RechargeProduct | null
  phoneNumber: string
  customerName?: string
  customerEmail?: string
}

interface RechargeTransaction {
  id: number
  localReference: string
  univcellOrderId: string | null
  productId: number
  productName: string
  service: string
  phoneNumber: string
  amount: number
  status: 'pending' | 'completed' | 'failed'
  resultCode: number | null
  resultMessage: string | null
  confirmationCode: string | null
  customerName: string | null
  customerEmail: string | null
  createdAt: string
  completedAt: string | null
}

interface RechargeStats {
  total: number
  completed: number
  pending: number
  failed: number
  totalAmount: number
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

// Status configuration
const STATUSES: Record<string, { label: string; color: string; icon: typeof AlertCircle }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  failed: { label: 'Fallida', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
}

export default function AgencyRecargasPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  // Modal state
  const [showWizard, setShowWizard] = useState(false)
  const [currentStep, setCurrentStep] = useState<RecargaStep>('service')
  const [recargaData, setRecargaData] = useState<RecargaData>({
    service: 'telefono',
    product: null,
    phoneNumber: ''
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [recargaId, setRecargaId] = useState<string>('')

  // Products state
  const [products, setProducts] = useState<RechargeProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Table state
  const [transactions, setTransactions] = useState<RechargeTransaction[]>([])
  const [stats, setStats] = useState<RechargeStats>({ total: 0, completed: 0, pending: 0, failed: 0, totalAmount: 0 })
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const ITEMS_PER_PAGE = 25

  // Fetch products on mount
  useEffect(() => {
    fetchProducts()
    fetchTransactions()
  }, [])

  // Refetch when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  useEffect(() => {
    fetchTransactions()
  }, [currentPage, statusFilter])

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true)
      const response = await fetch('/api/agency/recharges/products')
      const data = await response.json()

      if (data.success) {
        // Only show products with pricing configured
        const enabledProducts = data.data.filter((p: RechargeProduct) => p.hasPricing)
        setProducts(enabledProducts)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los productos')
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true)
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: ((currentPage - 1) * ITEMS_PER_PAGE).toString(),
        ...(statusFilter !== 'all' && { status: statusFilter })
      })

      const response = await fetch(`/api/admin/recargas?${params}`)
      const data = await response.json()

      if (data.success) {
        setTransactions(data.data || [])
        setStats(data.stats || { total: 0, completed: 0, pending: 0, failed: 0, totalAmount: 0 })
        setTotalTransactions(data.total || 0)
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
    } finally {
      setLoadingTransactions(false)
    }
  }

  // Filter products by service type
  const getFilteredProducts = (serviceType: ServiceType) => {
    return products.filter(p => {
      const isNauta = p.slug?.toLowerCase().includes('nauta') || p.name?.toLowerCase().includes('nauta')
      return serviceType === 'nauta' ? isNauta : !isNauta
    })
  }

  // Generate recharge ID
  const generateRecargaId = () => {
    const timestamp = Date.now().toString().slice(-6)
    return `REC-${timestamp}`
  }

  // Validate phone number
  const validatePhoneNumber = (phone: string): boolean => {
    return phone.length >= 6
  }

  // Format phone number
  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '')
    return cleaned.slice(0, 12)
  }

  // Handle service selection
  const handleServiceSelect = (service: ServiceType) => {
    setRecargaData(prev => ({ ...prev, service, product: null, phoneNumber: '' }))
    setCurrentStep('product')
  }

  // Handle product selection
  const handleProductSelect = (product: RechargeProduct) => {
    setRecargaData(prev => ({ ...prev, product, phoneNumber: '' }))
    setCurrentStep('phone')
  }

  // Handle phone submit
  const handlePhoneSubmit = () => {
    if (!recargaData.product) return
    setCurrentStep('confirmation')
  }

  // Process recharge
  const handleConfirmRecarga = async () => {
    setIsProcessing(true)

    try {
      const response = await fetch('/api/admin/recargas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: recargaData.product?.rechargeProductId,
          productName: recargaData.product?.name,
          service: recargaData.service,
          phoneNumber: recargaData.phoneNumber,
          amount: recargaData.product?.miCosto || 0,
          sellingPrice: recargaData.product?.precioClientes || recargaData.product?.miCosto || 0,
          customerName: recargaData.customerName,
          customerEmail: recargaData.customerEmail,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setRecargaId(result.data?.id || generateRecargaId())
        setCurrentStep('success')
        showNotification('success', 'Exito', 'Recarga procesada correctamente')
        fetchTransactions()
      } else {
        throw new Error(result.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('Error processing recarga:', error)
      showNotification('error', 'Error', 'Error al procesar la recarga')
    } finally {
      setIsProcessing(false)
    }
  }

  // Print ticket
  const handlePrintTicket = () => {
    const sellingPrice = recargaData.product?.precioClientes || recargaData.product?.miCosto || 0
    const printContent = `
====================================
        RECARGA EXITOSA
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

  // Reset wizard
  const handleNewRecarga = () => {
    setRecargaData({
      service: 'telefono',
      product: null,
      phoneNumber: ''
    })
    setCurrentStep('service')
    setRecargaId('')
  }

  // Open wizard modal
  const openWizard = () => {
    handleNewRecarga()
    setShowWizard(true)
  }

  // Close wizard modal
  const closeWizard = () => {
    setShowWizard(false)
    handleNewRecarga()
  }

  // Filter transactions by search term
  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      t.phoneNumber?.toLowerCase().includes(search) ||
      t.productName?.toLowerCase().includes(search) ||
      t.customerName?.toLowerCase().includes(search) ||
      t.localReference?.toLowerCase().includes(search)
    )
  })

  // Check if promotion is about to expire
  const isExpiringSoon = (dateString: string | null): boolean => {
    if (!dateString) return false
    const expDate = new Date(dateString)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry > 0 && daysUntilExpiry <= 7
  }

  // Render service step
  const renderServiceStep = () => {
    const telefonoCount = getFilteredProducts('telefono').length
    const nautaCount = getFilteredProducts('nauta').length

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="space-y-8"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Seleccionar Servicio</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            ¿Que tipo de recarga deseas realizar?
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <motion.button
            whileHover={telefonoCount > 0 ? { scale: 1.02 } : {}}
            whileTap={telefonoCount > 0 ? { scale: 0.98 } : {}}
            onClick={() => telefonoCount > 0 && handleServiceSelect('telefono')}
            disabled={telefonoCount === 0}
            className={cn(
              "p-6 rounded-xl border-2 transition-all duration-300",
              telefonoCount > 0
                ? cn(
                    "hover:shadow-xl hover:border-purple-500 cursor-pointer",
                    theme === 'dark'
                      ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  )
                : cn(
                    "cursor-not-allowed opacity-50",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-gray-100 border-gray-200"
                  )
            )}
          >
            <div className="flex flex-col items-center space-y-3">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center",
                telefonoCount > 0
                  ? "bg-gradient-to-br from-purple-500 to-purple-600"
                  : "bg-gray-400"
              )}>
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold">Recarga Numero</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
                Recarga para telefono movil
              </p>
              <div className={cn(
                "text-xs",
                telefonoCount > 0
                  ? "text-gray-500 dark:text-gray-400"
                  : "text-red-500 dark:text-red-400 font-medium"
              )}>
                {telefonoCount > 0 ? `${telefonoCount} productos` : 'No disponible'}
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={nautaCount > 0 ? { scale: 1.02 } : {}}
            whileTap={nautaCount > 0 ? { scale: 0.98 } : {}}
            onClick={() => nautaCount > 0 && handleServiceSelect('nauta')}
            disabled={nautaCount === 0}
            className={cn(
              "p-6 rounded-xl border-2 transition-all duration-300",
              nautaCount > 0
                ? cn(
                    "hover:shadow-xl hover:border-cyan-500 cursor-pointer",
                    theme === 'dark'
                      ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  )
                : cn(
                    "cursor-not-allowed opacity-50",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700"
                      : "bg-gray-100 border-gray-200"
                  )
            )}
          >
            <div className="flex flex-col items-center space-y-3">
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center",
                nautaCount > 0
                  ? "bg-gradient-to-br from-cyan-500 to-cyan-600"
                  : "bg-gray-400"
              )}>
                <Wifi className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold">Nauta</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
                Recarga para cuenta Nauta
              </p>
              <div className={cn(
                "text-xs",
                nautaCount > 0
                  ? "text-gray-500 dark:text-gray-400"
                  : "text-red-500 dark:text-red-400 font-medium"
              )}>
                {nautaCount > 0 ? `${nautaCount} productos` : 'No disponible'}
              </div>
            </div>
          </motion.button>
        </div>
      </motion.div>
    )
  }

  // Render product selection step
  const renderProductStep = () => {
    const filteredProducts = getFilteredProducts(recargaData.service)

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="space-y-6"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Seleccionar Producto</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Elige el producto de recarga
          </p>
        </div>

        {loadingProducts ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8">
            <Smartphone className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No hay productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
            {filteredProducts.map((product) => {
              const isPromo = product.isPromotion
              const sellingPrice = product.precioClientes || product.miCosto

              return (
                <motion.button
                  key={product.productId}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleProductSelect(product)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all duration-300 text-left relative",
                    "hover:shadow-lg",
                    isPromo ? "hover:border-amber-500 border-amber-200 dark:border-amber-800" : "hover:border-purple-500",
                    theme === 'dark' ? "bg-gray-800 hover:bg-gray-700" : "bg-white hover:bg-gray-50",
                    !isPromo && (theme === 'dark' ? "border-gray-700" : "border-gray-200")
                  )}
                >
                  {isPromo && (
                    <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white flex items-center gap-1">
                      <Gift className="w-3 h-3" />
                      PROMO
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0",
                      isPromo ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-purple-500 to-purple-600"
                    )}>
                      {isPromo ? <Gift className="w-5 h-5 text-white" /> : getCountryFlag(product.countryCode)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                        {product.name}
                      </div>
                      <div className="text-xs text-gray-500">{product.countryName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          ${sellingPrice.toFixed(2)}
                        </span>
                        {product.precioClientes && product.precioClientes !== product.miCosto && (
                          <span className="text-xs text-gray-400">
                            (Costo: ${product.miCosto.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}

        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setCurrentStep('service')}>
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
    const isCuban = recargaData.product?.countryCode === 'CU'
    const phoneToValidate = isCuban && !isNauta ? recargaData.phoneNumber.replace(/^\+53/, '') : recargaData.phoneNumber

    const isValid = (() => {
      if (!recargaData.product) return false
      if (isCuban && !isNauta) {
        const cleaned = phoneToValidate.replace(/\D/g, '')
        return cleaned.length === 8 && cleaned.startsWith('5')
      }
      if (isNauta) {
        return phoneToValidate.includes('@nauta.com.cu') && phoneToValidate.length > 14
      }
      return validatePhoneNumber(recargaData.phoneNumber)
    })()

    const displayPhoneNumber = isCuban && !isNauta ? recargaData.phoneNumber.replace(/^\+53/, '') : recargaData.phoneNumber

    const handlePhoneChange = (value: string) => {
      if (isNauta) {
        setRecargaData(prev => ({ ...prev, phoneNumber: value }))
      } else if (isCuban) {
        const cleaned = value.replace(/\D/g, '').slice(0, 8)
        setRecargaData(prev => ({ ...prev, phoneNumber: cleaned ? `+53${cleaned}` : '' }))
      } else {
        setRecargaData(prev => ({ ...prev, phoneNumber: formatPhoneNumber(value) }))
      }
    }

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="space-y-6"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            {isNauta ? 'Cuenta Nauta' : 'Numero de Telefono'}
          </h2>
        </div>

        {recargaData.product && (
          <div className={cn(
            "p-3 rounded-xl border-2 flex items-center gap-3",
            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
          )}>
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
              isNauta ? "bg-gradient-to-br from-cyan-500 to-cyan-600" : "bg-gradient-to-br from-purple-500 to-purple-600"
            )}>
              {getCountryFlag(recargaData.product.countryCode)}
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm">
                {recargaData.product.name}
              </div>
              <div className="text-xs text-gray-500">{recargaData.product.countryName}</div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {isNauta ? 'Cuenta Nauta' : 'Numero'}
            </label>
            <div className="relative flex">
              {isCuban && !isNauta && (
                <div className={cn(
                  "flex items-center px-4 rounded-l-lg border border-r-0 font-semibold",
                  theme === 'dark' ? "bg-gray-700 border-gray-600 text-purple-400" : "bg-gray-100 border-gray-300 text-purple-600"
                )}>
                  +53
                </div>
              )}
              <div className={cn("relative flex-1")}>
                {(!isCuban || isNauta) && (
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {isNauta ? <Wifi className="h-5 w-5 text-gray-400" /> : <Smartphone className="h-5 w-5 text-gray-400" />}
                  </div>
                )}
                <input
                  type="text"
                  value={displayPhoneNumber}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder={isNauta ? 'usuario@nauta.com.cu' : '5xxxxxxx'}
                  className={cn(
                    "w-full py-3 border transition-colors",
                    "focus:ring-2 focus:ring-purple-500 focus:border-transparent",
                    isCuban && !isNauta ? "rounded-r-lg rounded-l-none pl-4 pr-3" : "rounded-lg pl-10 pr-3",
                    theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                  )}
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button variant="outline" onClick={() => setCurrentStep('product')} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Atras
            </Button>
            <Button onClick={handlePhoneSubmit} disabled={!isValid} className="flex-1">
              Continuar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </motion.div>
    )
  }

  // Render confirmation step
  const renderConfirmationStep = () => {
    const product = recargaData.product
    const sellingPrice = product?.precioClientes || product?.miCosto || 0
    const costPrice = product?.miCosto || 0
    const margin = sellingPrice - costPrice

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="space-y-6"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Confirmar Recarga</h2>
        </div>

        <div className={cn(
          "p-4 rounded-xl border-2 space-y-3",
          theme === 'dark' ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
        )}>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400 text-sm">Producto:</span>
            <span className="font-medium text-sm">{product?.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400 text-sm">Numero:</span>
            <span className="font-medium text-sm">{recargaData.phoneNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400 text-sm">Mi Costo:</span>
            <span className="font-medium text-sm">${costPrice.toFixed(2)}</span>
          </div>
          <div className="border-t pt-3 mt-3 dark:border-gray-600">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Mi Ganancia:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400 text-sm">
                +${margin.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="font-semibold">Precio al Cliente:</span>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                ${sellingPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={recargaData.customerName || ''}
            onChange={(e) => setRecargaData(prev => ({ ...prev, customerName: e.target.value }))}
            placeholder="Nombre del cliente (opcional)"
            className={cn(
              "w-full px-3 py-2 rounded-lg border transition-colors text-sm",
              theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
            )}
          />
          <input
            type="email"
            value={recargaData.customerEmail || ''}
            onChange={(e) => setRecargaData(prev => ({ ...prev, customerEmail: e.target.value }))}
            placeholder="Email (opcional)"
            className={cn(
              "w-full px-3 py-2 rounded-lg border transition-colors text-sm",
              theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
            )}
          />
        </div>

        <div className="flex space-x-4">
          <Button variant="outline" onClick={() => setCurrentStep('phone')} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atras
          </Button>
          <Button onClick={handleConfirmRecarga} disabled={isProcessing} className="flex-1 bg-purple-600 hover:bg-purple-700">
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Procesando...
              </>
            ) : (
              <>
                Confirmar
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
    const sellingPrice = product?.precioClientes || product?.miCosto || 0

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-white" />
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-2">Recarga Exitosa</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            La recarga ha sido procesada correctamente
          </p>
        </div>

        <div className={cn(
          "p-4 rounded-xl border-2 space-y-2 text-left text-sm",
          theme === 'dark' ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
        )}>
          <div className="flex justify-between">
            <span className="text-gray-500">ID:</span>
            <span className="font-mono">{recargaId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Numero:</span>
            <span>{recargaData.phoneNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Cobrado:</span>
            <span className="font-bold text-emerald-600">${sellingPrice.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={handlePrintTicket} className="w-full" variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Ticket
          </Button>
          <Button onClick={closeWizard} className="w-full bg-purple-600 hover:bg-purple-700">
            Volver al Historial
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
    { id: 'confirmation', label: 'Confirmar', icon: CreditCard },
    { id: 'success', label: 'Completado', icon: Check }
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  // Render wizard as main content - Full page wizard design with animated progress bar
  const renderWizardView = () => (
    <div className="max-w-4xl mx-auto">
      {/* Close button - minimalist */}
      <div className="flex justify-end mb-4">
        <button
          onClick={closeWizard}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            theme === 'dark'
              ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
          )}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Bar with Animations */}
      <div className="mb-8 sm:mb-12">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className="relative w-12 h-12 sm:w-14 sm:h-14">
                  {/* Pulsing ring for active step */}
                  {currentStep === step.id && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.6, 0, 0.6]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      style={{
                        background: theme === 'dark'
                          ? 'rgba(147, 51, 234, 0.5)'
                          : 'rgba(126, 34, 206, 0.5)'
                      }}
                    />
                  )}

                  <motion.div
                    initial={false}
                    animate={{
                      scale: currentStep === step.id ? 1.1 : 1,
                      backgroundColor: currentStep === step.id
                        ? theme === 'dark' ? '#9333EA' : '#7E22CE'
                        : currentStepIndex > index
                        ? theme === 'dark' ? '#10B981' : '#059669'
                        : theme === 'dark' ? '#374151' : '#E5E7EB'
                    }}
                    transition={{
                      scale: { duration: 0.3, type: "spring", stiffness: 200 },
                      backgroundColor: { duration: 0.3 }
                    }}
                    whileHover={{ scale: currentStepIndex >= index ? 1.15 : 1.05 }}
                    className={cn(
                      "w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center relative z-10",
                      "transition-shadow duration-300",
                      currentStep === step.id && (
                        theme === 'dark'
                          ? 'shadow-lg shadow-purple-500/50'
                          : 'shadow-lg shadow-purple-400/50'
                      ),
                      currentStepIndex > index && (
                        theme === 'dark'
                          ? 'shadow-md shadow-green-500/30'
                          : 'shadow-md shadow-green-400/30'
                      )
                    )}
                  >
                    {currentStepIndex > index ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      >
                        <Check className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                      </motion.div>
                    ) : (
                      <motion.div
                        animate={{
                          rotate: currentStep === step.id ? [0, 10, -10, 0] : 0
                        }}
                        transition={{
                          duration: 0.5,
                          ease: "easeInOut",
                          times: [0, 0.25, 0.75, 1]
                        }}
                      >
                        <step.icon className={cn(
                          "w-5 h-5 sm:w-6 sm:h-6",
                          currentStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )} />
                      </motion.div>
                    )}
                  </motion.div>
                </div>

                <motion.div
                  className="mt-2 sm:mt-3 text-center"
                  initial={false}
                  animate={{
                    y: currentStep === step.id ? -2 : 0
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <p className={cn(
                    "text-xs sm:text-sm font-semibold transition-colors duration-300",
                    currentStep === step.id
                      ? theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                      : currentStepIndex > index
                      ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                      : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    {step.label}
                  </p>
                </motion.div>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                  <div className={cn(
                    "absolute inset-0 rounded-full",
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                  )} />
                  <motion.div
                    initial={false}
                    animate={{
                      scaleX: currentStepIndex > index ? 1 : 0
                    }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className={cn(
                      "h-full origin-left rounded-full",
                      theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
                    )}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Card */}
      <div className={cn(
        "rounded-2xl p-6 sm:p-8 min-h-[500px]",
        theme === 'dark'
          ? 'bg-gray-800/50 border border-gray-700'
          : 'bg-white border border-gray-200 shadow-lg'
      )}>
        <AnimatePresence mode="wait">
          {currentStep === 'service' && renderServiceStep()}
          {currentStep === 'product' && renderProductStep()}
          {currentStep === 'phone' && renderPhoneStep()}
          {currentStep === 'confirmation' && renderConfirmationStep()}
          {currentStep === 'success' && renderSuccessStep()}
        </AnimatePresence>
      </div>
    </div>
  )

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="min-h-screen p-6">
          {showWizard ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {renderWizardView()}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Total Recargas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark' ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark' ? 'bg-purple-900/30 border border-purple-800/50' : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                    )}>
                      <Smartphone className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-black')}>Total Recargas</p>
                      <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-slate-900')}>{stats.total}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Completadas */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark' ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark' ? 'bg-emerald-900/30 border border-emerald-800/50' : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                    )}>
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-black')}>Completadas</p>
                      <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-slate-900')}>{stats.completed}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Pendientes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark' ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark' ? 'bg-amber-900/30 border border-amber-800/50' : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                    )}>
                      <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-black')}>Pendientes</p>
                      <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-slate-900')}>{stats.pending}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Monto Total */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark' ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark' ? 'bg-blue-900/30 border border-blue-800/50' : 'bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200'
                    )}>
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-black')}>Monto Total</p>
                      <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-slate-900')}>${stats.totalAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por numero, producto, cliente o referencia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    'w-full h-12 pl-10 pr-4 rounded-lg border transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500',
                    theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm' : 'bg-white border-gray-300 text-black placeholder-gray-500 text-sm'
                  )}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(
                    'w-full sm:w-auto h-12 px-4 rounded-lg border transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500',
                    theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white text-sm' : 'bg-white border-gray-300 text-black text-sm'
                  )}
                >
                  <option value="all">Todos los estados</option>
                  {Object.entries(STATUSES).map(([key, status]) => (
                    <option key={key} value={key}>{status.label}</option>
                  ))}
                </select>

                <div className="flex gap-3 w-full sm:w-auto">
                  <Button
                    onClick={fetchTransactions}
                    className={cn(
                      'flex-1 sm:flex-none items-center justify-center gap-2 h-12',
                      'bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg'
                    )}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Actualizar
                  </Button>

                  <button
                    onClick={openWizard}
                    className={cn(
                      'flex-1 sm:flex-none justify-center whitespace-nowrap',
                      'rounded-lg text-sm font-medium transition-all duration-200',
                      'h-12 bg-purple-600 hover:bg-purple-700 text-white',
                      'shadow-sm hover:shadow-md flex items-center gap-2 px-6'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Nueva Recarga
                  </button>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className={cn(
              'rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}>
              {loadingTransactions ? (
                <div className="p-8">
                  <LoadingBox size="lg" text="Cargando recargas..." />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="p-8 text-center">
                  <Smartphone className="w-12 h-12 mx-auto text-gray-400" />
                  <p className="mt-2 text-black dark:text-gray-400">
                    {searchTerm || statusFilter !== 'all' ? 'No se encontraron recargas con los filtros aplicados' : 'No hay recargas registradas'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={cn(
                      'border-b border-gray-200 dark:border-gray-700',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Producto
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Numero
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Cliente
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Monto
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Referencia
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredTransactions.map((transaction) => {
                        const statusConfig = STATUSES[transaction.status] || STATUSES.pending
                        const StatusIcon = statusConfig.icon

                        return (
                          <motion.tr
                            key={transaction.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => router.push(`/dashboard/agency-admin/recargas/${transaction.id}`)}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-black dark:text-gray-100">
                                {new Date(transaction.createdAt).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short'
                                })}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(transaction.createdAt).toLocaleTimeString('es-ES', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center",
                                  transaction.service === 'nauta'
                                    ? "bg-gradient-to-br from-cyan-500 to-cyan-600"
                                    : "bg-gradient-to-br from-purple-500 to-purple-600"
                                )}>
                                  {transaction.service === 'nauta' ? (
                                    <Wifi className="w-4 h-4 text-white" />
                                  ) : (
                                    <Smartphone className="w-4 h-4 text-white" />
                                  )}
                                </div>
                                <div className="text-sm font-medium text-black dark:text-gray-100 truncate max-w-[150px]">
                                  {transaction.productName}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-mono text-black dark:text-gray-100">
                                {transaction.phoneNumber}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-black dark:text-gray-100">
                                {transaction.customerName || '-'}
                              </div>
                              {transaction.customerEmail && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {transaction.customerEmail}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                ${transaction.amount.toFixed(2)}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                                statusConfig.color
                              )}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                                {transaction.localReference?.slice(0, 8)}...
                              </div>
                              {transaction.confirmationCode && (
                                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                                  {transaction.confirmationCode}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/dashboard/agency-admin/recargas/${transaction.id}`)
                                }}
                                className={cn(
                                  "p-2 rounded-lg transition-colors",
                                  theme === 'dark'
                                    ? 'hover:bg-gray-600 text-gray-400 hover:text-white'
                                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
                                )}
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalTransactions > ITEMS_PER_PAGE && (
                <div className={cn(
                  'p-4 border-t',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{' '}
                      {Math.min(currentPage * ITEMS_PER_PAGE, totalTransactions)} de {totalTransactions}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage >= Math.ceil(totalTransactions / ITEMS_PER_PAGE)}
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
