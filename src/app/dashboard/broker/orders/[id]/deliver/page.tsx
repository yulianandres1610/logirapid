'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  Upload
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
  receiveAmount: number
  receiveCurrency: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientProvince: string
  recipientMunicipality: string
  hasAlternateContact: boolean
  alternateContactName?: string
  alternateContactPhone?: string
  sellingCompanyName: string
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

const STEPS = [
  { id: 1, name: 'Denominaciones', icon: Banknote },
  { id: 2, name: 'Firma', icon: PenTool },
  { id: 3, name: 'Foto', icon: Camera },
  { id: 4, name: 'Confirmar', icon: FileCheck }
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

  // Form data
  const [selectedCurrency, setSelectedCurrency] = useState<string>('CUP')
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

  // Load order data
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const res = await fetch(`/api/broker/orders/${orderId}/deliver`)
        const data = await res.json()

        if (!data.success) {
          throw new Error(data.error || 'Error al cargar orden')
        }

        setOrder(data.data.order)
        setSelectedCurrency(data.data.order.receiveCurrency)
        setSignerName(data.data.order.recipientName || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar orden')
      } finally {
        setLoading(false)
      }
    }

    loadOrder()
  }, [orderId])

  // Calculate total from denominations
  const calculateTotal = useCallback(() => {
    let total = 0
    const currencyDenoms = billDenominations[selectedCurrency as keyof BillDenominations]
    if (currencyDenoms) {
      Object.entries(currencyDenoms).forEach(([denom, count]) => {
        total += parseInt(denom) * (count || 0)
      })
    }
    return total
  }, [billDenominations, selectedCurrency])

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
    if (currentStep === 2) {
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

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return null

    return canvas.toDataURL('image/png')
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

  // Validation
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        const total = calculateTotal()
        return total > 0 && order && Math.abs(total - order.receiveAmount) < 0.01
      case 2:
        return hasSignature && signerName.trim().length > 0
      case 3:
        return true
      case 4:
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
      // Use saved signature data from state (saved when leaving step 2)
      // If not saved yet, try to get it from canvas (user might be on step 2)
      let signature = signatureData
      if (!signature && canvasRef.current) {
        signature = canvasRef.current.toDataURL('image/png')
      }

      if (!signature) {
        throw new Error('No se encontró la firma. Por favor, vuelva al paso 2 y firme nuevamente.')
      }

      let uploadedPhotos: PhotoData[] = []
      if (photos.length > 0) {
        try {
          uploadedPhotos = await uploadPhotos()
        } catch (photoErr) {
          console.error('Error uploading photos:', photoErr)
          // Continue without photos if upload fails
        }
      }

      const res = await fetch(`/api/broker/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billDenominations: { [selectedCurrency]: billDenominations[selectedCurrency as keyof BillDenominations] },
          deliveryCurrency: selectedCurrency,
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
    if (currentStep < 4 && canProceed()) {
      // Save signature data when leaving step 2
      if (currentStep === 2 && hasSignature) {
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
  const updateDenomination = (currency: string, denomination: number, delta: number) => {
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
              'rounded-lg p-4 flex items-center gap-3',
              theme === 'dark' ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'
            )}>
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className={theme === 'dark' ? 'text-red-300' : 'text-red-700'}>{error}</span>
            </div>
            <button
              onClick={() => router.back()}
              className={cn(
                'mt-4 px-4 py-2',
                theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
              )}
            >
              <ArrowLeft className="w-4 h-4 inline mr-2" />
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
        <div className="p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
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
            <h1 className={cn(
              'text-2xl font-bold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Completar Entrega
            </h1>
            <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
              Orden #{order?.orderNumber} - {order?.recipientName}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full',
                    currentStep > step.id ? 'bg-green-500 text-white' :
                    currentStep === step.id ? 'bg-blue-600 text-white' :
                    theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                  )}>
                    {currentStep > step.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={cn(
                    'ml-2 text-sm font-medium hidden sm:block',
                    currentStep >= step.id
                      ? theme === 'dark' ? 'text-white' : 'text-gray-900'
                      : theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  )}>
                    {step.name}
                  </span>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      'w-12 sm:w-24 h-1 mx-2 rounded',
                      currentStep > step.id ? 'bg-green-500' :
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className={cn(
              'mb-4 rounded-lg p-4 flex items-center gap-3',
              theme === 'dark' ? 'bg-red-900/30 border border-red-800' : 'bg-red-50 border border-red-200'
            )}>
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className={theme === 'dark' ? 'text-red-300' : 'text-red-700'}>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="w-4 h-4 text-red-500" />
              </button>
            </div>
          )}

          {/* Step Content */}
          <div className={cn(
            'rounded-xl shadow-sm border p-6',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}>
            {/* Step 1: Denominaciones */}
            {currentStep === 1 && (
              <div>
                <h2 className={cn(
                  'text-lg font-semibold mb-4',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Seleccionar Denominaciones
                </h2>
                <p className={cn('mb-6', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Monto a entregar: <strong className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                    {order?.receiveAmount.toLocaleString()} {order?.receiveCurrency}
                  </strong>
                </p>

                {/* Currency Tabs */}
                <div className="flex gap-2 mb-6">
                  {Object.keys(BILL_DENOMINATIONS).map(currency => (
                    <button
                      key={currency}
                      onClick={() => setSelectedCurrency(currency)}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-colors',
                        selectedCurrency === currency
                          ? 'bg-blue-600 text-white'
                          : theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {currency}
                    </button>
                  ))}
                </div>

                {/* Denomination Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {BILL_DENOMINATIONS[selectedCurrency]?.map(denom => {
                    const count = billDenominations[selectedCurrency as keyof BillDenominations]?.[denom.toString()] || 0
                    return (
                      <div key={denom} className={cn(
                        'rounded-lg p-4 text-center',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                      )}>
                        <div className={cn(
                          'text-lg font-bold mb-2',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {denom.toLocaleString()} {selectedCurrency}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => updateDenomination(selectedCurrency, denom, -1)}
                            disabled={count === 0}
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed',
                              theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
                            )}
                          >
                            -
                          </button>
                          <span className={cn(
                            'w-12 text-center font-semibold text-lg',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {count}
                          </span>
                          <button
                            onClick={() => updateDenomination(selectedCurrency, denom, 1)}
                            className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                        {count > 0 && (
                          <div className={cn('mt-2 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            = {(denom * count).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Total */}
                <div className={cn(
                  'mt-6 p-4 rounded-lg',
                  theme === 'dark' ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50'
                )}>
                  <div className="flex justify-between items-center">
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>Total a entregar:</span>
                    <span className={cn(
                      'text-xl font-bold',
                      calculateTotal() === order?.receiveAmount ? 'text-green-500' : 'text-red-500'
                    )}>
                      {calculateTotal().toLocaleString()} {selectedCurrency}
                    </span>
                  </div>
                  {calculateTotal() !== order?.receiveAmount && (
                    <p className="text-sm text-red-500 mt-2">
                      Diferencia: {(calculateTotal() - (order?.receiveAmount || 0)).toLocaleString()} {selectedCurrency}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Firma */}
            {currentStep === 2 && (
              <div>
                <h2 className={cn(
                  'text-lg font-semibold mb-4',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Firma del Cliente
                </h2>

                {/* Signer Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-1',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Nombre del Firmante *
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div>
                    <label className={cn(
                      'block text-sm font-medium mb-1',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      No. Identificacion (opcional)
                    </label>
                    <input
                      type="text"
                      value={signerIdNumber}
                      onChange={(e) => setSignerIdNumber(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                      placeholder="Carnet de identidad"
                    />
                  </div>
                </div>

                {/* Relation */}
                <div className="mb-6">
                  <label className={cn(
                    'block text-sm font-medium mb-2',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Relacion con el destinatario
                  </label>
                  <div className="flex gap-4">
                    {[
                      { value: 'recipient', label: 'Destinatario' },
                      { value: 'family', label: 'Familiar' },
                      { value: 'other', label: 'Otro' }
                    ].map(option => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="signerRelation"
                          value={option.value}
                          checked={signerRelation === option.value}
                          onChange={(e) => setSignerRelation(e.target.value as any)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Signature Canvas */}
                <div className="mb-4">
                  <label className={cn(
                    'block text-sm font-medium mb-2',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Firma *
                  </label>
                  <div className={cn(
                    'border-2 border-dashed rounded-lg relative',
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
                        <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>Firme aqui</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={clearSignature}
                      className={cn(
                        'flex items-center gap-1 text-sm',
                        theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                      )}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Limpiar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Foto */}
            {currentStep === 3 && (
              <div>
                <h2 className={cn(
                  'text-lg font-semibold mb-4',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Foto de Entrega (Opcional)
                </h2>
                <p className={cn('mb-6', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Puede agregar hasta 5 fotos como prueba de entrega.
                </p>

                {/* Photo Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  {photos.map((photo, index) => (
                    <div key={index} className={cn(
                      'relative aspect-square rounded-lg overflow-hidden',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <img
                        src={photo.preview}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {photos.length < 5 && (
                    <label className={cn(
                      'aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors',
                      theme === 'dark'
                        ? 'border-gray-600 hover:border-blue-500 hover:bg-gray-700'
                        : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                    )}>
                      <Upload className={cn('w-8 h-8 mb-2', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                      <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Agregar Foto</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={handlePhotoCapture}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className={cn(
                    'block text-sm font-medium mb-1',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Notas de Entrega (Opcional)
                  </label>
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    rows={3}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                    placeholder="Observaciones sobre la entrega..."
                  />
                </div>
              </div>
            )}

            {/* Step 4: Confirmacion */}
            {currentStep === 4 && (
              <div>
                <h2 className={cn(
                  'text-lg font-semibold mb-4',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Confirmar Entrega
                </h2>

                {/* Summary */}
                <div className="space-y-4 mb-6">
                  <div className={cn(
                    'rounded-lg p-4',
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                  )}>
                    <h3 className={cn(
                      'font-medium mb-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>Detalles de la Orden</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Numero:</div>
                      <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{order?.orderNumber}</div>
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Destinatario:</div>
                      <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{order?.recipientName}</div>
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Telefono:</div>
                      <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{order?.recipientPhone}</div>
                      <div className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Ubicacion:</div>
                      <div className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{order?.recipientMunicipality}, {order?.recipientProvince}</div>
                    </div>
                  </div>

                  <div className={cn(
                    'rounded-lg p-4',
                    theme === 'dark' ? 'bg-emerald-900/30 border border-emerald-800' : 'bg-green-50'
                  )}>
                    <h3 className={cn(
                      'font-medium mb-2',
                      theme === 'dark' ? 'text-emerald-300' : 'text-green-900'
                    )}>Monto Entregado</h3>
                    <div className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-emerald-400' : 'text-green-700'
                    )}>
                      {calculateTotal().toLocaleString()} {selectedCurrency}
                    </div>
                    <div className={cn(
                      'text-sm mt-1',
                      theme === 'dark' ? 'text-emerald-400' : 'text-green-600'
                    )}>
                      Recibido por: {signerName}
                      {signerRelation !== 'recipient' && ` (${signerRelation === 'family' ? 'Familiar' : 'Otro'})`}
                    </div>
                  </div>

                  {/* Receipt Options */}
                  <div className={cn(
                    'rounded-lg p-4',
                    theme === 'dark' ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50'
                  )}>
                    <h3 className={cn(
                      'font-medium mb-3',
                      theme === 'dark' ? 'text-blue-300' : 'text-blue-900'
                    )}>Enviar Recibo</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'none', label: 'No enviar', icon: X },
                        { value: 'sms', label: 'SMS', icon: Phone },
                        { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                        { value: 'both', label: 'Ambos', icon: Send }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => setSendReceiptVia(option.value as any)}
                          className={cn(
                            'flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors',
                            sendReceiptVia === option.value
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : theme === 'dark'
                                ? 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          )}
                        >
                          <option.icon className="w-4 h-4" />
                          <span className="text-sm font-medium">{option.label}</span>
                        </button>
                      ))}
                    </div>
                    {sendReceiptVia !== 'none' && order?.recipientPhone && (
                      <p className={cn(
                        'text-sm mt-2',
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      )}>
                        Se enviara a: {order.recipientPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className={cn(
              'flex justify-between mt-8 pt-6 border-t',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed',
                  theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </button>

              {currentStep < 4 ? (
                <button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={submitDelivery}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
                </button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
