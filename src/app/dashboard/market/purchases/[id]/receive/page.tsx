'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PackageOpen,
  Warehouse,
  Package,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Truck,
  Calendar,
  ShoppingCart,
  User,
  Plus,
  Minus,
  FileText,
  CheckCircle,
  MapPin
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'warehouse' | 'products' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ElementType
}

const STEPS: WizardStep[] = [
  { id: 'warehouse', title: 'Almacén', description: 'Destino recepción', icon: Warehouse },
  { id: 'products', title: 'Productos', description: 'Verificar cantidades', icon: Package },
  { id: 'review', title: 'Confirmar', description: 'Completar recepción', icon: Check }
]

interface WarehouseOption {
  id: number
  code: string
  name: string
  isCentral: boolean
  city: string
  address: string
  productsCount: number
  totalStock: number
}

interface PurchaseLine {
  id: number
  productId: number
  productName: string
  productSku: string
  productImage: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  quantityReceived: number
  lotNumber: string | null
  expirationDate: string | null
  manufacturingDate: string | null
}

interface PurchaseData {
  id: number
  purchaseNumber: string
  supplierName: string
  supplierContact: string | null
  supplierAddress: string | null
  status: string
  purchaseDate: string
  expectedDate: string | null
  totalAmount: number
  currency: string
  lines: PurchaseLine[]
}

interface ReceptionLine {
  lineId: number
  productId: number
  productName: string
  productSku: string
  productImage: string | null
  quantityOrdered: number
  quantityPreviouslyReceived: number
  quantityToReceive: number
  lotNumber: string | null
  expirationDate: string | null
}

export default function ReceivePurchasePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const purchaseId = params.id as string

  const [currentStep, setCurrentStep] = useState<Step>('warehouse')
  const [loading, setLoading] = useState(false)
  const [loadingPurchase, setLoadingPurchase] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Purchase data
  const [purchase, setPurchase] = useState<PurchaseData | null>(null)

  // Warehouse
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [loadingWarehouses, setLoadingWarehouses] = useState(true)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null)

  // Reception lines
  const [receptionLines, setReceptionLines] = useState<ReceptionLine[]>([])

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Fetch purchase data
  useEffect(() => {
    const fetchPurchase = async () => {
      try {
        const response = await fetch(`/api/market/purchases/${purchaseId}`)
        const data = await response.json()
        if (data.success) {
          setPurchase(data.data)
          // Initialize reception lines from purchase
          setReceptionLines(data.data.lines.map((line: PurchaseLine) => ({
            lineId: line.id,
            productId: line.productId,
            productName: line.productName,
            productSku: line.productSku,
            productImage: line.productImage,
            quantityOrdered: line.quantity,
            quantityPreviouslyReceived: line.quantityReceived,
            quantityToReceive: line.quantity - line.quantityReceived,
            lotNumber: line.lotNumber,
            expirationDate: line.expirationDate
          })))
        } else {
          setErrors({ fetch: data.error || 'Error al cargar la compra' })
        }
      } catch (error) {
        console.error('Error fetching purchase:', error)
        setErrors({ fetch: 'Error al cargar la compra' })
      } finally {
        setLoadingPurchase(false)
      }
    }
    fetchPurchase()
  }, [purchaseId])

  // Fetch warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const response = await fetch('/api/market/warehouses')
        const data = await response.json()
        if (data.success) {
          setWarehouses(data.data.warehouses)
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error)
      } finally {
        setLoadingWarehouses(false)
      }
    }
    fetchWarehouses()
  }, [])

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'warehouse') {
      if (!selectedWarehouseId) {
        newErrors.warehouse = 'Selecciona el almacén donde recibirás la mercancía'
      }
    }

    if (step === 'products') {
      const hasItemsToReceive = receptionLines.some(l => l.quantityToReceive > 0)
      if (!hasItemsToReceive) {
        newErrors.products = 'Debe recibir al menos un producto'
      }
      const invalidLines = receptionLines.filter(l =>
        l.quantityToReceive < 0 ||
        l.quantityToReceive > (l.quantityOrdered - l.quantityPreviouslyReceived)
      )
      if (invalidLines.length > 0) {
        newErrors.products = 'Las cantidades deben ser válidas'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return

    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const updateLineQuantity = (lineId: number, quantity: number) => {
    setReceptionLines(lines =>
      lines.map(l => {
        if (l.lineId !== lineId) return l
        const maxQuantity = l.quantityOrdered - l.quantityPreviouslyReceived
        return {
          ...l,
          quantityToReceive: Math.max(0, Math.min(quantity, maxQuantity))
        }
      })
    )
  }

  const handleSubmit = async () => {
    if (!validateStep('review')) return

    setLoading(true)
    try {
      // Build received items map
      const receivedItems: Record<number, number> = {}
      receptionLines.forEach(line => {
        if (line.quantityToReceive > 0) {
          receivedItems[line.lineId] = line.quantityToReceive
        }
      })

      const response = await fetch(`/api/market/purchases/${purchaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'receive',
          warehouseId: selectedWarehouseId,
          receivedItems
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar recepción')
      }

      router.push('/dashboard/market/purchases')
    } catch (error) {
      console.error('Error processing reception:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Error al procesar recepción' })
    } finally {
      setLoading(false)
    }
  }

  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)
  const totalItemsToReceive = receptionLines.reduce((sum, l) => sum + l.quantityToReceive, 0)
  const totalLinesWithItems = receptionLines.filter(l => l.quantityToReceive > 0).length

  // Check if purchase can be received
  const canReceive = purchase && ['comprada', 'pendiente', 'confirmed'].includes(purchase.status)
  const hasItemsPending = receptionLines.some(l => l.quantityOrdered > l.quantityPreviouslyReceived)

  if (loadingPurchase) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
              <p className={cn(
                "text-lg",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Cargando compra...
              </p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (errors.fetch || !purchase) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className={cn(
                "text-lg mb-4",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {errors.fetch || 'Compra no encontrada'}
              </p>
              <Link
                href="/dashboard/market/purchases"
                className="text-emerald-500 hover:underline"
              >
                Volver a compras
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!canReceive) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center max-w-md">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className={cn(
                "text-xl font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Compra ya recibida
              </h2>
              <p className={cn(
                "text-sm mb-4",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Esta compra ya ha sido recibida completamente o su estado no permite recepción.
              </p>
              <Link
                href="/dashboard/market/purchases"
                className="inline-flex items-center gap-2 text-emerald-500 hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a compras
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!hasItemsPending) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center max-w-md">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className={cn(
                "text-xl font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Todos los productos recibidos
              </h2>
              <p className={cn(
                "text-sm mb-4",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                No quedan productos pendientes por recibir en esta compra.
              </p>
              <Link
                href="/dashboard/market/purchases"
                className="inline-flex items-center gap-2 text-emerald-500 hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a compras
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
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

            {/* Header with Purchase Info */}
            <div className="text-center mb-4">
              <Link
                href="/dashboard/market/purchases"
                className={cn(
                  "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a compras
              </Link>
              <h1 className={cn(
                "text-2xl sm:text-3xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Recibir Compra
              </h1>
              <div className={cn(
                "inline-flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full text-sm",
                theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
              )}>
                <ShoppingCart className="w-4 h-4 text-emerald-500" />
                <span className={cn(
                  "font-medium",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {purchase.purchaseNumber}
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-500">{purchase.supplierName}</span>
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div className="relative w-14 h-14">
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
                                ? 'rgba(16, 185, 129, 0.5)'
                                : 'rgba(5, 150, 105, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#10B981' : '#059669'
                              : currentStepIndex > index
                                ? theme === 'dark' ? '#10B981' : '#059669'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                          }}
                          transition={{
                            scale: { duration: 0.3 },
                            backgroundColor: { duration: 0.3 }
                          }}
                          whileHover={{ scale: currentStepIndex >= index ? 1.15 : 1.05 }}
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                            "transition-shadow duration-300",
                            currentStep === step.id && (
                              theme === 'dark'
                                ? 'shadow-lg shadow-emerald-500/50'
                                : 'shadow-lg shadow-emerald-400/50'
                            )
                          )}
                        >
                          {currentStepIndex > index ? (
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
                            ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                            : currentStepIndex > index
                              ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                              : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {step.title}
                        </p>
                      </div>
                    </div>

                    {index < STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                        <div className={cn(
                          "absolute inset-0 rounded-full",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                        <motion.div
                          initial={false}
                          animate={{ scaleX: currentStepIndex > index ? 1 : 0 }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          className={cn(
                            "h-full origin-left rounded-full",
                            theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-600'
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
                {/* Step 1: Warehouse Selection */}
                {currentStep === 'warehouse' && (
                  <motion.div
                    key="warehouse"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <Warehouse className="w-5 h-5 text-white" />
                      </div>
                      ¿Dónde recibirás la mercancía?
                    </h2>

                    {/* Purchase Summary Card */}
                    <div className={cn(
                      "p-4 rounded-xl border",
                      theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                    )}>
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                          theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                        )}>
                          <Truck className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {purchase.supplierName}
                          </p>
                          {purchase.supplierAddress && (
                            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {purchase.supplierAddress}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(purchase.purchaseDate).toLocaleDateString('es-ES')}
                            </span>
                            <span className={cn(
                              "font-medium",
                              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                            )}>
                              ${purchase.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {loadingWarehouses ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                      </div>
                    ) : warehouses.length === 0 ? (
                      <div className={cn(
                        "text-center py-12 rounded-xl border",
                        theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className={cn(
                          "font-medium mb-2",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          No hay almacenes disponibles
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          Debes crear un almacén antes de recibir mercancía
                        </p>
                        <Link
                          href="/dashboard/market/warehouses/create"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Crear Almacén
                        </Link>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {warehouses.map((warehouse) => (
                          <motion.button
                            key={warehouse.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            type="button"
                            onClick={() => setSelectedWarehouseId(warehouse.id)}
                            className={cn(
                              "w-full p-4 rounded-xl border-2 transition-all text-left",
                              selectedWarehouseId === warehouse.id
                                ? theme === 'dark'
                                  ? 'border-emerald-500 bg-emerald-900/20'
                                  : 'border-emerald-500 bg-emerald-50'
                                : theme === 'dark'
                                  ? 'border-gray-700 hover:border-gray-600'
                                  : 'border-gray-200 hover:border-gray-300'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={cn(
                                    "font-medium",
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {warehouse.name}
                                  </p>
                                  {warehouse.isCentral && (
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-xs font-medium",
                                      theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'
                                    )}>
                                      Central
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {warehouse.code} • {warehouse.city}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {warehouse.productsCount} productos • {warehouse.totalStock} unidades
                                </p>
                              </div>
                              {selectedWarehouseId === warehouse.id && (
                                <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}

                    {errors.warehouse && (
                      <p className="text-red-500 text-sm">{errors.warehouse}</p>
                    )}
                  </motion.div>
                )}

                {/* Step 2: Products */}
                {currentStep === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      Verificar Productos a Recibir
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Ajusta las cantidades según lo que realmente estás recibiendo. Si un producto llegó incompleto, modifica la cantidad.
                    </p>

                    <div className={cn(
                      "rounded-xl border divide-y overflow-hidden",
                      theme === 'dark' ? 'border-gray-700 divide-gray-700' : 'border-gray-200 divide-gray-200'
                    )}>
                      {receptionLines.map((line) => {
                        const pending = line.quantityOrdered - line.quantityPreviouslyReceived
                        const isPartiallyReceived = line.quantityPreviouslyReceived > 0

                        return (
                          <div
                            key={line.lineId}
                            className={cn(
                              "p-4",
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}
                          >
                            <div className="flex items-center gap-4">
                              {/* Product Image */}
                              <div className={cn(
                                "w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0",
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                {line.productImage ? (
                                  <img
                                    src={line.productImage}
                                    alt={line.productName}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                ) : (
                                  <Package className="w-6 h-6 text-gray-400" />
                                )}
                              </div>

                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "font-medium truncate",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {line.productName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {line.productSku}
                                </p>
                                <div className="flex items-center gap-3 mt-1 text-xs">
                                  <span className="text-gray-500">
                                    Pedido: <span className="font-medium">{line.quantityOrdered}</span>
                                  </span>
                                  {isPartiallyReceived && (
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded",
                                      theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                                    )}>
                                      Ya recibido: {line.quantityPreviouslyReceived}
                                    </span>
                                  )}
                                  <span className={cn(
                                    "font-medium",
                                    theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                                  )}>
                                    Pendiente: {pending}
                                  </span>
                                </div>
                              </div>

                              {/* Quantity Controls */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateLineQuantity(line.lineId, line.quantityToReceive - 1)}
                                  disabled={line.quantityToReceive <= 0}
                                  className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                    "disabled:opacity-50 disabled:cursor-not-allowed",
                                    theme === 'dark'
                                      ? 'bg-gray-700 hover:bg-gray-600'
                                      : 'bg-gray-100 hover:bg-gray-200'
                                  )}
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <input
                                  type="number"
                                  value={line.quantityToReceive}
                                  onChange={(e) => updateLineQuantity(line.lineId, parseInt(e.target.value) || 0)}
                                  min="0"
                                  max={pending}
                                  className={cn(
                                    "w-16 text-center py-2 rounded-lg border font-medium",
                                    theme === 'dark'
                                      ? 'bg-gray-900 border-gray-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-900'
                                  )}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateLineQuantity(line.lineId, line.quantityToReceive + 1)}
                                  disabled={line.quantityToReceive >= pending}
                                  className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                                    "disabled:opacity-50 disabled:cursor-not-allowed",
                                    theme === 'dark'
                                      ? 'bg-gray-700 hover:bg-gray-600'
                                      : 'bg-gray-100 hover:bg-gray-200'
                                  )}
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Lot info if exists */}
                            {(line.lotNumber || line.expirationDate) && (
                              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                {line.lotNumber && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    Lote: {line.lotNumber}
                                  </span>
                                )}
                                {line.expirationDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Vence: {new Date(line.expirationDate).toLocaleDateString('es-ES')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Summary */}
                    <div className={cn(
                      "p-4 rounded-xl",
                      theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
                    )}>
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Total a recibir
                        </span>
                        <span className={cn(
                          "font-bold text-lg",
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                        )}>
                          {totalItemsToReceive} unidades
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {totalLinesWithItems} de {receptionLines.length} productos
                      </p>
                    </div>

                    {errors.products && (
                      <p className="text-red-500 text-sm">{errors.products}</p>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Review */}
                {currentStep === 'review' && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      Confirmar Recepción
                    </h2>

                    <div className={cn(
                      'rounded-2xl p-6 space-y-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      {/* Warehouse & Supplier Summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className={cn(
                          "p-4 rounded-xl",
                          theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50'
                        )}>
                          <div className="flex items-center gap-3">
                            <Warehouse className="w-8 h-8 text-emerald-500" />
                            <div>
                              <p className="text-xs text-gray-500">Almacén Destino</p>
                              <p className={cn(
                                "font-semibold",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {selectedWarehouse?.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {selectedWarehouse?.code}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className={cn(
                          "p-4 rounded-xl",
                          theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50'
                        )}>
                          <div className="flex items-center gap-3">
                            <Truck className={cn(
                              "w-8 h-8",
                              theme === 'dark' ? 'text-amber-400' : 'text-amber-500'
                            )} />
                            <div>
                              <p className="text-xs text-gray-500">Proveedor</p>
                              <p className={cn(
                                "font-semibold",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {purchase.supplierName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {purchase.purchaseNumber}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Products to Receive */}
                      <div>
                        <h3 className={cn(
                          "text-sm font-medium mb-3 flex items-center justify-between",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <span>Productos a Recibir</span>
                          <span className={cn(
                            "font-bold",
                            theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                          )}>
                            {totalItemsToReceive} unidades
                          </span>
                        </h3>
                        <div className={cn(
                          "rounded-xl border divide-y max-h-60 overflow-y-auto",
                          theme === 'dark' ? 'border-gray-700 divide-gray-700' : 'border-gray-200 divide-gray-200'
                        )}>
                          {receptionLines
                            .filter(l => l.quantityToReceive > 0)
                            .map((line) => (
                              <div key={line.lineId} className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    <Package className="w-4 h-4 text-gray-400" />
                                  </div>
                                  <span className={cn(
                                    "text-sm",
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {line.productName}
                                  </span>
                                </div>
                                <span className={cn(
                                  "font-mono font-semibold",
                                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                                )}>
                                  +{line.quantityToReceive}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Note about partial reception */}
                      {receptionLines.some(l => l.quantityToReceive < (l.quantityOrdered - l.quantityPreviouslyReceived)) && (
                        <div className={cn(
                          "p-4 rounded-xl flex items-start gap-3",
                          theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
                        )}>
                          <FileText className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                          )} />
                          <div>
                            <p className={cn(
                              "font-medium text-sm",
                              theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                            )}>
                              Recepción Parcial
                            </p>
                            <p className={cn(
                              "text-xs mt-1",
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            )}>
                              No recibirás todos los productos pendientes. La compra quedará en estado &quot;Pendiente&quot; hasta completar la recepción.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {errors.submit && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-red-600 text-sm">{errors.submit}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
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
              </motion.button>

              {currentStep === 'review' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={loading}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-400/30',
                    'text-white'
                  )}
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  <PackageOpen className="w-5 h-5" />
                  Confirmar Recepción
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextStep}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    theme === 'dark'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-400/30',
                    'text-white'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
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
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 pb-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                          theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                        )}>
                          <X className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? 'text-red-400' : 'text-red-600'
                          )} />
                        </div>
                        <div className="flex-1">
                          <h3 className={cn(
                            "text-xl font-bold mb-2",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            ¿Cancelar recepción?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Se perderá toda la información ingresada y volverás a la lista de compras.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCancelModal(false)}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        )}
                      >
                        Continuar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/market/purchases')}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
                        )}
                      >
                        Sí, cancelar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
