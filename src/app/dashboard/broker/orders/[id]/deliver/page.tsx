'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Banknote,
  PenTool,
  Camera,
  FileCheck,
  Loader2,
  AlertCircle,
  Trash2,
  RotateCcw,
  Send,
  MessageCircle,
  Phone,
  X,
  Upload,
  User,
  MapPin,
  DollarSign,
  Clock,
  Building2,
  CreditCard,
  Mail,
  FileText,
  Wallet,
  AlertTriangle
} from 'lucide-react'

// Bill denominations by currency
const BILL_DENOMINATIONS: Record<string, number[]> = {
  CUP: [10, 20, 50, 100, 200, 500, 1000],
  USD: [1, 5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100, 200]
}

interface OrderData {
  id: number
  orderNumber: string
  status: string
  sendAmount: number
  sendCurrency: string
  receiveAmount: number
  receiveCurrency: string
  exchangeRate: number
  totalCharged: number
  serviceFee: number
  recipientName: string
  recipientPhone: string
  recipientIdNumber?: string
  recipientAddress: string
  recipientNeighborhood?: string
  recipientProvince: string
  recipientMunicipality: string
  recipientAddressReferences?: string
  hasAlternateContact: boolean
  alternateContactName?: string
  alternateContactPhone?: string
  senderName: string
  senderPhone?: string
  senderEmail?: string
  sellingCompanyName: string
  brokerCompanyName?: string
  estimatedDelivery?: string
  createdAt: string
}

interface BillCount {
  [denomination: string]: number
}

interface BillDenominations {
  CUP?: BillCount
  USD?: BillCount
  EUR?: BillCount
}

interface PhotoData {
  file?: File
  preview: string
  storagePath?: string
  uploadedAt?: string
}

interface CurrencyBalance {
  currency: string
  available: number
  reserved: number
}

const STEPS = [
  { id: 1, name: 'Informacion', icon: FileText },
  { id: 2, name: 'Denominaciones', icon: Banknote },
  { id: 3, name: 'Firma', icon: PenTool },
  { id: 4, name: 'Foto', icon: Camera },
  { id: 5, name: 'Confirmar', icon: FileCheck }
]

export default function DeliveryWizardPage() {
  const params = useParams()
  const router = useRouter()
  const { theme } = useTheme()
  const orderId = params.id as string

  // State
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderData | null>(null)
  const [walletBalances, setWalletBalances] = useState<CurrencyBalance[]>([])
  const [insufficientFunds, setInsufficientFunds] = useState(false)

  // Form data
  const [billDenominations, setBillDenominations] = useState<BillDenominations>({})
  const [signerName, setSignerName] = useState('')
  const [signerIdNumber, setSignerIdNumber] = useState('')
  const [signerRelation, setSignerRelation] = useState<'recipient' | 'family' | 'other'>('recipient')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoData[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [sendReceiptVia, setSendReceiptVia] = useState<'sms' | 'whatsapp' | 'both' | 'none'>('none')

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  // Load order data and wallet balance
  useEffect(() => {
    const loadOrderAndWallet = async () => {
      try {
        // Fetch order and wallet data in parallel
        const [orderRes, walletRes] = await Promise.all([
          fetch(`/api/broker/orders/${orderId}/deliver`),
          fetch('/api/broker/wallet')
        ])

        const orderData = await orderRes.json()
        const walletData = await walletRes.json()

        if (!orderData.success) {
          throw new Error(orderData.error || 'Error al cargar orden')
        }

        const orderInfo = orderData.data.order
        setOrder(orderInfo)
        setSignerName(orderInfo.recipientName || '')

        // Store wallet balances
        if (walletData.success && walletData.data.currencyBalances) {
          setWalletBalances(walletData.data.currencyBalances)

          // Check if there are sufficient funds for the order's currency
          const currencyBalance = walletData.data.currencyBalances.find(
            (b: CurrencyBalance) => b.currency === orderInfo.receiveCurrency
          )

          const availableBalance = currencyBalance?.available || 0
          if (availableBalance < orderInfo.receiveAmount) {
            setInsufficientFunds(true)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar orden')
      } finally {
        setLoading(false)
      }
    }

    loadOrderAndWallet()
  }, [orderId])

  // Calculate total from denominations
  const calculateTotal = useCallback(() => {
    if (!order) return 0
    let total = 0
    const currency = order.receiveCurrency
    const currencyDenoms = billDenominations[currency as keyof BillDenominations]
    if (currencyDenoms) {
      Object.entries(currencyDenoms).forEach(([denom, count]) => {
        total += parseInt(denom) * (count || 0)
      })
    }
    return total
  }, [billDenominations, order])

  // Signature canvas functions
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    ctx.strokeStyle = theme === 'dark' ? '#fff' : '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [theme])

  useEffect(() => {
    if (currentStep === 3) {
      setTimeout(initCanvas, 100)
    }
  }, [currentStep, initCanvas])

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    let clientX, clientY

    if ('touches' in e) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    const { x, y } = getCanvasCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const { x, y } = getCanvasCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    setSignatureData(null)
  }

  // Photo handling
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newPhotos: PhotoData[] = []
    Array.from(files).forEach(file => {
      if (photos.length + newPhotos.length >= 5) return

      const preview = URL.createObjectURL(file)
      newPhotos.push({ file, preview })
    })

    setPhotos([...photos, ...newPhotos])
  }

  const removePhoto = (index: number) => {
    const newPhotos = [...photos]
    URL.revokeObjectURL(newPhotos[index].preview)
    newPhotos.splice(index, 1)
    setPhotos(newPhotos)
  }

  // Upload photos
  const uploadPhotos = async (): Promise<PhotoData[]> => {
    if (photos.length === 0) return []

    const formData = new FormData()
    photos.forEach(photo => {
      if (photo.file) {
        formData.append('photos', photo.file)
      }
    })

    const res = await fetch(`/api/broker/orders/${orderId}/upload-photos`, {
      method: 'POST',
      body: formData
    })

    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Error al subir fotos')
    }

    return data.data.photos.map((p: any) => ({
      storagePath: p.storagePath,
      uploadedAt: p.uploadedAt
    }))
  }

  // Get available balance for a currency
  const getAvailableBalance = useCallback((currency: string): number => {
    const balance = walletBalances.find(b => b.currency === currency)
    return balance?.available || 0
  }, [walletBalances])

  // Validation
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        // Can't proceed if insufficient funds in order's currency
        return order ? !insufficientFunds : false
      case 2:
        const total = calculateTotal()
        return total > 0 && order && Math.abs(total - order.receiveAmount) < 0.01
      case 3:
        return hasSignature && signerName.trim().length > 0
      case 4:
        return true
      case 5:
        return true
      default:
        return false
    }
  }

  // Submit delivery
  const submitDelivery = async () => {
    if (!order) return

    setSubmitting(true)
    setError(null)

    try {
      let signature = signatureData
      if (!signature && canvasRef.current) {
        signature = canvasRef.current.toDataURL('image/png')
      }

      if (!signature) {
        throw new Error('No se encontro la firma. Por favor, vuelva al paso 3 y firme nuevamente.')
      }

      let uploadedPhotos: PhotoData[] = []
      if (photos.length > 0) {
        try {
          uploadedPhotos = await uploadPhotos()
        } catch (photoErr) {
          console.error('Error uploading photos:', photoErr)
        }
      }

      const res = await fetch(`/api/broker/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billDenominations: { [order.receiveCurrency]: billDenominations[order.receiveCurrency as keyof BillDenominations] },
          deliveryCurrency: order.receiveCurrency,
          signerName,
          signerIdNumber: signerIdNumber || undefined,
          signerRelation,
          signatureData: signature,
          photos: uploadedPhotos,
          notes: deliveryNotes || undefined,
          sendReceiptVia
        })
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al completar entrega')
      }

      router.push('/dashboard/broker/orders?success=delivery')

    } catch (err) {
      console.error('Submit delivery error:', err)
      setError(err instanceof Error ? err.message : 'Error al completar entrega')
    } finally {
      setSubmitting(false)
    }
  }

  // Navigation
  const nextStep = () => {
    if (currentStep < 5 && canProceed()) {
      if (currentStep === 3 && hasSignature) {
        const canvas = canvasRef.current
        if (canvas) {
          const data = canvas.toDataURL('image/png')
          setSignatureData(data)
        }
      }
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Update denomination count
  const updateDenomination = (denomination: number, delta: number) => {
    if (!order) return
    const currency = order.receiveCurrency

    setBillDenominations(prev => {
      const existingDenoms = prev[currency as keyof BillDenominations]
      const currencyDenoms: BillCount = existingDenoms ? { ...existingDenoms } : {}
      const current = currencyDenoms[denomination.toString()] || 0
      const newValue = Math.max(0, current + delta)

      if (newValue === 0) {
        delete currencyDenoms[denomination.toString()]
      } else {
        currencyDenoms[denomination.toString()] = newValue
      }

      return {
        ...prev,
        [currency]: currencyDenoms
      }
    })
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error && !order) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className={cn(
              'rounded-2xl p-6 flex items-center gap-3',
              theme === 'dark' ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'
            )}>
              <AlertCircle className="w-6 h-6 text-red-500" />
              <span className={theme === 'dark' ? 'text-red-300' : 'text-red-700'}>{error}</span>
            </div>
            <button
              onClick={() => router.back()}
              className={cn(
                'mt-4 px-4 py-2 flex items-center gap-2',
                theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          'min-h-screen pt-12 pb-20 px-4 sm:px-6 lg:px-8',
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <button
                onClick={() => router.back()}
                className={cn(
                  'flex items-center gap-2 mb-4 transition-colors',
                  theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a Ordenes
              </button>
              <div className="text-center">
                <h1 className={cn(
                  'text-3xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Completar Entrega
                </h1>
                <p className={cn(
                  'mt-2 text-lg',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Orden <span className="font-semibold text-blue-500">#{order?.orderNumber}</span>
                </p>
              </div>
            </motion.div>

            {/* Progress Steps */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: currentStep >= step.id ? 1 : 0.8 }}
                      className={cn(
                        'flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300',
                        currentStep > step.id
                          ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30'
                          : currentStep === step.id
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : theme === 'dark'
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-gray-200 text-gray-500'
                      )}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </motion.div>
                    <span className={cn(
                      'ml-2 text-sm font-medium hidden lg:block',
                      currentStep >= step.id
                        ? theme === 'dark' ? 'text-white' : 'text-gray-900'
                        : theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      {step.name}
                    </span>
                    {index < STEPS.length - 1 && (
                      <div className={cn(
                        'w-8 sm:w-16 lg:w-24 h-1 mx-2 rounded-full transition-all duration-300',
                        currentStep > step.id
                          ? 'bg-gradient-to-r from-green-500 to-green-400'
                          : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )} />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    'mb-6 rounded-2xl p-4 flex items-center gap-3',
                    theme === 'dark' ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'
                  )}
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <span className={theme === 'dark' ? 'text-red-300' : 'text-red-700'}>{error}</span>
                  <button onClick={() => setError(null)} className="ml-auto">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step Content */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className={cn(
                'rounded-2xl shadow-xl border p-6 sm:p-8',
                theme === 'dark' ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm' : 'bg-white border-gray-200'
              )}
            >
              {/* Step 1: Informacion del Envio */}
              {currentStep === 1 && order && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className={cn(
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Informacion del Envio
                    </h2>
                    <p className={cn(
                      'text-sm mt-1',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Revise los detalles antes de continuar
                    </p>
                  </div>

                  {/* Insufficient Funds Warning */}
                  {insufficientFunds && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'rounded-xl p-4 border-2 flex items-start gap-4',
                        theme === 'dark'
                          ? 'bg-red-900/30 border-red-700 text-red-200'
                          : 'bg-red-50 border-red-300 text-red-800'
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                        theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100'
                      )}>
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold mb-1">Saldo Insuficiente</p>
                        <p className={cn('text-sm', theme === 'dark' ? 'text-red-300' : 'text-red-700')}>
                          No tiene saldo suficiente en <span className="font-semibold">{order.receiveCurrency}</span> para completar esta entrega.
                        </p>
                        <div className={cn(
                          'mt-3 p-3 rounded-lg',
                          theme === 'dark' ? 'bg-red-900/40' : 'bg-red-100'
                        )}>
                          <div className="flex justify-between text-sm">
                            <span>Saldo disponible:</span>
                            <span className="font-bold text-red-500">
                              {getAvailableBalance(order.receiveCurrency).toLocaleString()} {order.receiveCurrency}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <span>Monto requerido:</span>
                            <span className="font-bold">
                              {order.receiveAmount.toLocaleString()} {order.receiveCurrency}
                            </span>
                          </div>
                          <div className={cn(
                            'flex justify-between text-sm mt-2 pt-2 border-t',
                            theme === 'dark' ? 'border-red-700' : 'border-red-200'
                          )}>
                            <span>Faltante:</span>
                            <span className="font-bold text-red-500">
                              {(order.receiveAmount - getAvailableBalance(order.receiveCurrency)).toLocaleString()} {order.receiveCurrency}
                            </span>
                          </div>
                        </div>
                        <p className={cn('text-xs mt-3', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                          Contacte al administrador para recargar su billetera antes de continuar.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Wallet Balance Card - Show when funds are sufficient */}
                  {!insufficientFunds && walletBalances.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'rounded-xl p-4 border',
                        theme === 'dark'
                          ? 'bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 border-emerald-700/50'
                          : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-200'
                          )}>
                            <Wallet className="w-5 h-5 text-emerald-500" />
                          </div>
                          <div>
                            <p className={cn('text-sm', theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700')}>
                              Saldo Disponible ({order.receiveCurrency})
                            </p>
                            <p className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {getAvailableBalance(order.receiveCurrency).toLocaleString()} {order.receiveCurrency}
                            </p>
                          </div>
                        </div>
                        <Check className="w-6 h-6 text-emerald-500" />
                      </div>
                    </motion.div>
                  )}

                  {/* Amount Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'rounded-xl p-4 border',
                        theme === 'dark'
                          ? 'bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center',
                          theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-200'
                        )}>
                          <Send className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                            Monto Enviado
                          </p>
                          <p className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            ${order.sendAmount.toFixed(2)} {order.sendCurrency}
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className={cn(
                        'rounded-xl p-4 border',
                        theme === 'dark'
                          ? 'bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50'
                          : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center',
                          theme === 'dark' ? 'bg-green-500/20' : 'bg-green-200'
                        )}>
                          <Banknote className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-green-300' : 'text-green-700')}>
                            Monto a Entregar
                          </p>
                          <p className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {order.receiveAmount.toLocaleString()} {order.receiveCurrency}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Recipient Info */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={cn(
                      'rounded-xl p-5 border',
                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-purple-600'
                      )}>
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <h3 className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Destinatario
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <User className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Nombre</p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {order.recipientName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Telefono</p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {order.recipientPhone}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 sm:col-span-2">
                        <MapPin className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Direccion</p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {order.recipientAddress || `${order.recipientMunicipality}, ${order.recipientProvince}`}
                          </p>
                          {order.recipientAddressReferences && (
                            <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                              Ref: {order.recipientAddressReferences}
                            </p>
                          )}
                        </div>
                      </div>
                      {order.hasAlternateContact && order.alternateContactName && (
                        <div className="flex items-start gap-3 sm:col-span-2">
                          <Phone className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                          <div>
                            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Contacto Alternativo</p>
                            <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {order.alternateContactName} - {order.alternateContactPhone}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Sender Info */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className={cn(
                      'rounded-xl p-5 border',
                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600'
                      )}>
                        <Send className="w-5 h-5 text-white" />
                      </div>
                      <h3 className={cn('text-lg font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Remitente
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <User className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <div>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Nombre</p>
                          <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {order.senderName}
                          </p>
                        </div>
                      </div>
                      {order.senderPhone && (
                        <div className="flex items-start gap-3">
                          <Phone className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                          <div>
                            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Telefono</p>
                            <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {order.senderPhone}
                            </p>
                          </div>
                        </div>
                      )}
                      {order.senderEmail && (
                        <div className="flex items-start gap-3">
                          <Mail className={cn('w-5 h-5 mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                          <div>
                            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Email</p>
                            <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {order.senderEmail}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Agency Info */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className={cn(
                      'rounded-xl p-4 border flex items-center gap-4',
                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      theme === 'dark' ? 'bg-orange-500/20' : 'bg-orange-100'
                    )}>
                      <Building2 className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Agencia Vendedora
                      </p>
                      <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {order.sellingCompanyName}
                      </p>
                    </div>
                    {order.estimatedDelivery && (
                      <div className="ml-auto text-right">
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          Tiempo Estimado
                        </p>
                        <p className={cn('font-semibold text-green-500')}>
                          {order.estimatedDelivery}
                        </p>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}

              {/* Step 2: Denominaciones */}
              {currentStep === 2 && order && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className={cn(
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Seleccionar Denominaciones
                    </h2>
                    <p className={cn(
                      'text-sm mt-1',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Seleccione los billetes a entregar en <span className="font-semibold text-blue-500">{order.receiveCurrency}</span>
                    </p>
                  </div>

                  {/* Amount to deliver */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      'rounded-xl p-4 border text-center',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
                    )}
                  >
                    <p className={cn('text-sm mb-1', theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                      Monto a Entregar
                    </p>
                    <p className={cn('text-3xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {order.receiveAmount.toLocaleString()} {order.receiveCurrency}
                    </p>
                  </motion.div>

                  {/* Denomination Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {BILL_DENOMINATIONS[order.receiveCurrency]?.map((denom, index) => {
                      const count = billDenominations[order.receiveCurrency as keyof BillDenominations]?.[denom.toString()] || 0
                      return (
                        <motion.div
                          key={denom}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            'rounded-xl p-4 text-center border transition-all',
                            count > 0
                              ? theme === 'dark'
                                ? 'bg-blue-900/30 border-blue-700'
                                : 'bg-blue-50 border-blue-300'
                              : theme === 'dark'
                                ? 'bg-gray-700/50 border-gray-600'
                                : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          <div className={cn(
                            'text-lg font-bold mb-3',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {denom.toLocaleString()} {order.receiveCurrency}
                          </div>
                          <div className="flex items-center justify-center gap-3">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateDenomination(denom, -1)}
                              disabled={count === 0}
                              className={cn(
                                'w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                                theme === 'dark'
                                  ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              )}
                            >
                              -
                            </motion.button>
                            <span className={cn(
                              'w-12 text-center font-bold text-xl',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {count}
                            </span>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateDenomination(denom, 1)}
                              className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/30"
                            >
                              +
                            </motion.button>
                          </div>
                          {count > 0 && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className={cn('mt-2 text-sm font-medium', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}
                            >
                              = {(denom * count).toLocaleString()}
                            </motion.div>
                          )}
                        </motion.div>
                      )
                    })}
                  </div>

                  {/* Total */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      'rounded-xl p-5 border',
                      calculateTotal() === order.receiveAmount
                        ? theme === 'dark'
                          ? 'bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50'
                          : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                        : theme === 'dark'
                          ? 'bg-gradient-to-br from-red-900/50 to-red-800/30 border-red-700/50'
                          : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Total seleccionado:</span>
                      <span className={cn(
                        'text-2xl font-bold',
                        calculateTotal() === order.receiveAmount ? 'text-green-500' : 'text-red-500'
                      )}>
                        {calculateTotal().toLocaleString()} {order.receiveCurrency}
                      </span>
                    </div>
                    {calculateTotal() !== order.receiveAmount && (
                      <p className={cn('text-sm mt-2', theme === 'dark' ? 'text-red-400' : 'text-red-600')}>
                        Diferencia: {(calculateTotal() - order.receiveAmount).toLocaleString()} {order.receiveCurrency}
                      </p>
                    )}
                    {calculateTotal() === order.receiveAmount && (
                      <div className="flex items-center gap-2 mt-2">
                        <Check className="w-5 h-5 text-green-500" />
                        <span className={cn('text-sm', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                          Monto correcto
                        </span>
                      </div>
                    )}
                  </motion.div>
                </div>
              )}

              {/* Step 3: Firma */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className={cn(
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Firma del Cliente
                    </h2>
                    <p className={cn(
                      'text-sm mt-1',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      El cliente debe firmar para confirmar la recepcion
                    </p>
                  </div>

                  {/* Signer Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Nombre del Firmante *
                      </label>
                      <input
                        type="text"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                        placeholder="Nombre completo"
                      />
                    </div>
                    <div>
                      <label className={cn(
                        'block text-sm font-medium mb-2',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        No. Identificacion (opcional)
                      </label>
                      <input
                        type="text"
                        value={signerIdNumber}
                        onChange={(e) => setSignerIdNumber(e.target.value)}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                        placeholder="Carnet de identidad"
                      />
                    </div>
                  </div>

                  {/* Relation */}
                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-3',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Relacion con el destinatario
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { value: 'recipient', label: 'Destinatario' },
                        { value: 'family', label: 'Familiar' },
                        { value: 'other', label: 'Otro' }
                      ].map(option => (
                        <motion.button
                          key={option.value}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSignerRelation(option.value as any)}
                          className={cn(
                            'px-4 py-2 rounded-xl border-2 font-medium transition-all',
                            signerRelation === option.value
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : theme === 'dark'
                                ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          )}
                        >
                          {option.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Signature Canvas */}
                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-2',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Firma *
                    </label>
                    <div className={cn(
                      'border-2 border-dashed rounded-2xl relative overflow-hidden',
                      theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'
                    )}>
                      <canvas
                        ref={canvasRef}
                        className="w-full h-48 touch-none cursor-crosshair"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                      {!hasSignature && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>
                            Firme aqui
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={clearSignature}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1 rounded-lg transition-colors',
                          theme === 'dark' ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        )}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Limpiar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Foto */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className={cn(
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Foto de Entrega
                    </h2>
                    <p className={cn(
                      'text-sm mt-1',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Opcional - Puede agregar hasta 5 fotos como prueba
                    </p>
                  </div>

                  {/* Photo Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {photos.map((photo, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          'relative aspect-square rounded-xl overflow-hidden border-2',
                          theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                        )}
                      >
                        <img
                          src={photo.preview}
                          alt={`Foto ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removePhoto(index)}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </motion.div>
                    ))}

                    {photos.length < 5 && (
                      <motion.label
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          'aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all',
                          theme === 'dark'
                            ? 'border-gray-600 hover:border-blue-500 hover:bg-gray-700'
                            : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                        )}
                      >
                        <Upload className={cn('w-8 h-8 mb-2', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                        <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          Agregar Foto
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={handlePhotoCapture}
                          className="hidden"
                        />
                      </motion.label>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-2',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Notas de Entrega (Opcional)
                    </label>
                    <textarea
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      rows={3}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                      placeholder="Observaciones sobre la entrega..."
                    />
                  </div>
                </div>
              )}

              {/* Step 5: Confirmacion */}
              {currentStep === 5 && order && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className={cn(
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Confirmar Entrega
                    </h2>
                    <p className={cn(
                      'text-sm mt-1',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Revise los detalles y confirme la entrega
                    </p>
                  </div>

                  {/* Summary */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-xl p-5 border',
                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}
                  >
                    <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Detalles de la Orden
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Numero:</div>
                      <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{order.orderNumber}</div>
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Destinatario:</div>
                      <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{order.recipientName}</div>
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Telefono:</div>
                      <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{order.recipientPhone}</div>
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Ubicacion:</div>
                      <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {order.recipientMunicipality}, {order.recipientProvince}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className={cn(
                      'rounded-xl p-5 border',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50'
                        : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                    )}
                  >
                    <h3 className={cn('font-semibold mb-2', theme === 'dark' ? 'text-green-300' : 'text-green-900')}>
                      Monto Entregado
                    </h3>
                    <div className={cn('text-3xl font-bold', theme === 'dark' ? 'text-green-400' : 'text-green-700')}>
                      {calculateTotal().toLocaleString()} {order.receiveCurrency}
                    </div>
                    <div className={cn('text-sm mt-2', theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                      Recibido por: {signerName}
                      {signerRelation !== 'recipient' && ` (${signerRelation === 'family' ? 'Familiar' : 'Otro'})`}
                    </div>
                  </motion.div>

                  {/* Receipt Options */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={cn(
                      'rounded-xl p-5 border',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
                    )}
                  >
                    <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-blue-300' : 'text-blue-900')}>
                      Enviar Recibo
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'none', label: 'No enviar', icon: X },
                        { value: 'sms', label: 'SMS', icon: Phone },
                        { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                        { value: 'both', label: 'Ambos', icon: Send }
                      ].map(option => (
                        <motion.button
                          key={option.value}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSendReceiptVia(option.value as any)}
                          className={cn(
                            'flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all',
                            sendReceiptVia === option.value
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : theme === 'dark'
                                ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          )}
                        >
                          <option.icon className="w-4 h-4" />
                          <span className="text-sm font-medium">{option.label}</span>
                        </motion.button>
                      ))}
                    </div>
                    {sendReceiptVia !== 'none' && order.recipientPhone && (
                      <p className={cn('text-sm mt-3', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                        Se enviara a: {order.recipientPhone}
                      </p>
                    )}
                  </motion.div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className={cn(
                'flex justify-between mt-8 pt-6 border-t',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                    theme === 'dark' ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Anterior
                </motion.button>

                {currentStep < 5 ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={nextStep}
                    disabled={!canProceed()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
                  >
                    Siguiente
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={submitDelivery}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 shadow-lg shadow-green-500/30"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Completar Entrega
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
