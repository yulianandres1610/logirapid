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
  Search,
  Plus,
  Minus,
  Trash2,
  Calendar,
  ShoppingCart,
  FileText,
  Truck
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'warehouse' | 'products' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 'warehouse', title: 'Almacén', description: 'Destino recepción', icon: Warehouse },
  { id: 'products', title: 'Productos', description: 'Items a recibir', icon: Package },
  { id: 'review', title: 'Revisión', description: 'Confirmar datos', icon: Check }
]

interface WarehouseOption {
  id: number
  code: string
  name: string
  isCentral: boolean
  city: string
  productsCount: number
  totalStock: number
}

interface ProductOption {
  id: number
  name: string
  sku: string
  barcode: string
  imageUrl: string
  quantityOnHand: number
}

interface PurchaseOption {
  id: number
  purchaseNumber: string
  supplierName: string
  status: string
  totalItems: number
  createdAt: string
}

interface ReceptionLine {
  productId: number
  productName: string
  sku: string
  imageUrl: string
  quantityExpected: number
  quantityReceived: number
}

export default function CreateReceptionPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('warehouse')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Warehouse
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [loadingWarehouses, setLoadingWarehouses] = useState(true)
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<number | null>(null)

  // Reference (purchase order)
  const [purchases, setPurchases] = useState<PurchaseOption[]>([])
  const [loadingPurchases, setLoadingPurchases] = useState(false)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null)
  const [purchaseSearch, setPurchaseSearch] = useState('')

  // Products
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [receptionLines, setReceptionLines] = useState<ReceptionLine[]>([])

  // Form data
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')
  const [supplierRef, setSupplierRef] = useState('')

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

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

  // Fetch purchases (only approved ones - ready for reception)
  useEffect(() => {
    const fetchPurchases = async () => {
      setLoadingPurchases(true)
      try {
        // Only fetch purchases that are approved by manager (forReception=true)
        const response = await fetch('/api/market/purchases?status=pendiente&forReception=true')
        const data = await response.json()
        if (data.success) {
          setPurchases(data.data?.purchases || [])
        }
      } catch (error) {
        console.error('Error fetching purchases:', error)
        setPurchases([])
      } finally {
        setLoadingPurchases(false)
      }
    }
    fetchPurchases()
  }, [])

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true)
      try {
        const response = await fetch('/api/market/products')
        const data = await response.json()
        if (data.success) {
          setProducts(data.data.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            imageUrl: p.imageUrl,
            quantityOnHand: p.quantityOnHand
          })))
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [])

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'warehouse') {
      if (!destinationWarehouseId) newErrors.destination = 'Selecciona el almacén de destino'
    }

    if (step === 'products') {
      if (receptionLines.length === 0) {
        newErrors.products = 'Agrega al menos un producto a recibir'
      }
      const invalidLines = receptionLines.filter(l => l.quantityExpected <= 0)
      if (invalidLines.length > 0) {
        newErrors.products = 'Todas las cantidades deben ser mayores a 0'
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

  const addProductLine = (product: ProductOption) => {
    if (receptionLines.some(l => l.productId === product.id)) return

    setReceptionLines([...receptionLines, {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      imageUrl: product.imageUrl,
      quantityExpected: 1,
      quantityReceived: 0
    }])
  }

  const updateLineQuantity = (productId: number, quantity: number) => {
    setReceptionLines(lines =>
      lines.map(l =>
        l.productId === productId ? { ...l, quantityExpected: Math.max(0, quantity) } : l
      )
    )
  }

  const removeLine = (productId: number) => {
    setReceptionLines(lines => lines.filter(l => l.productId !== productId))
  }

  const handleSubmit = async () => {
    if (!validateStep('review')) return

    setLoading(true)
    try {
      const response = await fetch('/api/market/warehouse-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationType: 'reception',
          destinationWarehouseId,
          referenceType: selectedPurchaseId ? 'purchase' : 'manual',
          referenceId: selectedPurchaseId,
          scheduledDate: scheduledDate || null,
          notes: notes || null,
          lines: receptionLines.map(l => ({
            productId: l.productId,
            quantityPlanned: l.quantityExpected
          }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear recepción')
      }

      router.push('/dashboard/market/warehouses/receptions')
    } catch (error) {
      console.error('Error creating reception:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Error al crear recepción' })
    } finally {
      setLoading(false)
    }
  }

  const destinationWarehouse = warehouses.find(w => w.id === destinationWarehouseId)
  const selectedPurchase = purchases.find(p => p.id === selectedPurchaseId)
  const totalItems = receptionLines.reduce((sum, l) => sum + l.quantityExpected, 0)

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.barcode && p.barcode.includes(productSearch))
  )

  const filteredPurchases = purchases.filter(p =>
    p.purchaseNumber.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
    p.supplierName.toLowerCase().includes(purchaseSearch.toLowerCase())
  )

  return (
    
      
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

            {/* Header */}
            <div className="text-center mb-4">
              <Link
                href="/dashboard/market/warehouses/receptions"
                className={cn(
                  "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a recepciones
              </Link>
              <h1 className={cn(
                "text-2xl sm:text-3xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nueva Recepción
              </h1>
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
                {/* Step 1: Warehouse */}
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
                      Seleccionar Almacén de Destino
                    </h2>

                    {loadingWarehouses ? (
                      <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                      </div>
                    ) : (
                      <>
                        {/* Destination Warehouse */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-3",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Almacén Destino *
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {warehouses.map((warehouse) => (
                              <motion.button
                                key={warehouse.id}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                type="button"
                                onClick={() => setDestinationWarehouseId(warehouse.id)}
                                className={cn(
                                  "w-full p-4 rounded-xl border-2 transition-all text-left",
                                  destinationWarehouseId === warehouse.id
                                    ? theme === 'dark'
                                      ? 'border-emerald-500 bg-emerald-900/20'
                                      : 'border-emerald-500 bg-emerald-50'
                                    : theme === 'dark'
                                      ? 'border-gray-700 hover:border-gray-600'
                                      : 'border-gray-200 hover:border-gray-300'
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className={cn(
                                      "font-medium",
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {warehouse.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {warehouse.code} • {warehouse.city}
                                    </p>
                                  </div>
                                  {destinationWarehouseId === warehouse.id && (
                                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              </motion.button>
                            ))}
                          </div>
                          {errors.destination && <p className="text-red-500 text-xs mt-2">{errors.destination}</p>}
                        </div>

                        {/* Optional: Link to Purchase Order */}
                        <div className={cn(
                          "pt-6 border-t",
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <label className={cn(
                            "block text-sm font-medium mb-3 flex items-center gap-2",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            <ShoppingCart className="w-4 h-4" />
                            Vincular a Orden de Compra (opcional)
                          </label>

                          {/* Purchase Search */}
                          <div className="relative mb-3">
                            <Search className={cn(
                              "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )} />
                            <input
                              type="text"
                              value={purchaseSearch}
                              onChange={(e) => setPurchaseSearch(e.target.value)}
                              placeholder="Buscar por número o proveedor..."
                              className={cn(
                                'w-full pl-10 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 transition-all text-sm',
                                theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                          </div>

                          {loadingPurchases ? (
                            <div className="flex items-center justify-center h-24">
                              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                            </div>
                          ) : filteredPurchases.length === 0 ? (
                            <div className={cn(
                              "text-center py-6 rounded-xl border",
                              theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-gray-50 border-gray-200'
                            )}>
                              <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-sm text-gray-500">
                                No hay órdenes de compra pendientes
                              </p>
                            </div>
                          ) : (
                            <div className={cn(
                              "max-h-48 overflow-y-auto rounded-xl border p-2 space-y-2",
                              theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-gray-50 border-gray-200'
                            )}>
                              {/* Option to not link to purchase */}
                              <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                type="button"
                                onClick={() => setSelectedPurchaseId(null)}
                                className={cn(
                                  "w-full p-3 rounded-lg border transition-all text-left",
                                  selectedPurchaseId === null
                                    ? theme === 'dark'
                                      ? 'border-emerald-500 bg-emerald-900/20'
                                      : 'border-emerald-500 bg-emerald-50'
                                    : theme === 'dark'
                                      ? 'border-gray-700 hover:border-gray-600'
                                      : 'border-gray-200 hover:border-gray-300'
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    <Truck className="w-4 h-4 text-gray-400" />
                                  </div>
                                  <div>
                                    <p className={cn(
                                      "font-medium text-sm",
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      Recepción Manual
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Sin vincular a orden de compra
                                    </p>
                                  </div>
                                  {selectedPurchaseId === null && (
                                    <div className="ml-auto w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              </motion.button>

                              {filteredPurchases.map((purchase) => (
                                <motion.button
                                  key={purchase.id}
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                  type="button"
                                  onClick={() => setSelectedPurchaseId(purchase.id)}
                                  className={cn(
                                    "w-full p-3 rounded-lg border transition-all text-left",
                                    selectedPurchaseId === purchase.id
                                      ? theme === 'dark'
                                        ? 'border-emerald-500 bg-emerald-900/20'
                                        : 'border-emerald-500 bg-emerald-50'
                                      : theme === 'dark'
                                        ? 'border-gray-700 hover:border-gray-600'
                                        : 'border-gray-200 hover:border-gray-300'
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center",
                                      theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                                    )}>
                                      <ShoppingCart className={cn(
                                        "w-4 h-4",
                                        theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                                      )} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        "font-medium text-sm",
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      )}>
                                        {purchase.purchaseNumber}
                                      </p>
                                      <p className="text-xs text-gray-500 truncate">
                                        {purchase.supplierName} • {purchase.totalItems} items
                                      </p>
                                    </div>
                                    {selectedPurchaseId === purchase.id && (
                                      <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" />
                                      </div>
                                    )}
                                  </div>
                                </motion.button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Optional: Scheduled Date & Supplier Ref */}
                        <div className={cn(
                          "pt-6 border-t grid grid-cols-1 sm:grid-cols-2 gap-4",
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2 flex items-center gap-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              <Calendar className="w-4 h-4" />
                              Fecha Programada (opcional)
                            </label>
                            <input
                              type="date"
                              value={scheduledDate}
                              onChange={(e) => setScheduledDate(e.target.value)}
                              className={cn(
                                'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                          </div>
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2 flex items-center gap-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              <FileText className="w-4 h-4" />
                              Ref. Proveedor (opcional)
                            </label>
                            <input
                              type="text"
                              value={supplierRef}
                              onChange={(e) => setSupplierRef(e.target.value)}
                              placeholder="Número de guía, factura..."
                              className={cn(
                                'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20 placeholder:text-gray-500'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                          </div>
                        </div>
                      </>
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
                      Productos a Recibir
                    </h2>

                    {/* Search */}
                    <div className="relative">
                      <Search className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5",
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )} />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar por nombre, SKU o código de barras..."
                        className={cn(
                          'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Available Products */}
                      <div>
                        <h3 className={cn(
                          "text-sm font-medium mb-3",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Productos Disponibles
                        </h3>
                        <div className={cn(
                          "h-80 overflow-y-auto rounded-xl border p-2 space-y-2",
                          theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}>
                          {loadingProducts ? (
                            <div className="flex items-center justify-center h-full">
                              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                            </div>
                          ) : filteredProducts.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                              No hay productos disponibles
                            </div>
                          ) : (
                            filteredProducts.map((product) => {
                              const isAdded = receptionLines.some(l => l.productId === product.id)
                              return (
                                <motion.button
                                  key={product.id}
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                  type="button"
                                  onClick={() => addProductLine(product)}
                                  disabled={isAdded}
                                  className={cn(
                                    "w-full p-3 rounded-lg border transition-all text-left flex items-center gap-3",
                                    "disabled:opacity-50",
                                    isAdded
                                      ? theme === 'dark' ? 'bg-emerald-900/20 border-emerald-700' : 'bg-emerald-50 border-emerald-200'
                                      : theme === 'dark' ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
                                  )}
                                >
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    {product.imageUrl ? (
                                      <img src={product.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                      <Package className="w-5 h-5 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      "font-medium text-sm truncate",
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {product.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {product.sku} • Stock actual: {product.quantityOnHand}
                                    </p>
                                  </div>
                                  {!isAdded && <Plus className="w-5 h-5 text-emerald-500" />}
                                  {isAdded && <Check className="w-5 h-5 text-green-500" />}
                                </motion.button>
                              )
                            })
                          )}
                        </div>
                      </div>

                      {/* Selected Products */}
                      <div>
                        <h3 className={cn(
                          "text-sm font-medium mb-3 flex items-center justify-between",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <span>Productos a Recibir ({receptionLines.length})</span>
                          <span className="text-emerald-500">{totalItems} unidades</span>
                        </h3>
                        <div className={cn(
                          "h-80 overflow-y-auto rounded-xl border p-2 space-y-2",
                          theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}>
                          {receptionLines.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                              <PackageOpen className="w-10 h-10 mb-2 opacity-50" />
                              Selecciona productos de la lista
                            </div>
                          ) : (
                            receptionLines.map((line) => (
                              <motion.div
                                key={line.productId}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className={cn(
                                  "p-3 rounded-lg border",
                                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    {line.imageUrl ? (
                                      <img src={line.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                      <Package className="w-5 h-5 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      "font-medium text-sm truncate",
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {line.productName}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {line.sku}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => updateLineQuantity(line.productId, line.quantityExpected - 1)}
                                      className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center",
                                        theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                                      )}
                                    >
                                      <Minus className="w-4 h-4" />
                                    </button>
                                    <input
                                      type="number"
                                      value={line.quantityExpected}
                                      onChange={(e) => updateLineQuantity(line.productId, parseInt(e.target.value) || 0)}
                                      min="1"
                                      className={cn(
                                        "w-14 text-center py-1 rounded-lg border",
                                        theme === 'dark'
                                          ? 'bg-gray-900 border-gray-600 text-white'
                                          : 'bg-white border-gray-200 text-gray-900'
                                      )}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateLineQuantity(line.productId, line.quantityExpected + 1)}
                                      className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center",
                                        theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                                      )}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeLine(line.productId)}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                        {errors.products && <p className="text-red-500 text-xs mt-2">{errors.products}</p>}
                      </div>
                    </div>
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
                      Revisión de Recepción
                    </h2>

                    <div className={cn(
                      'rounded-2xl p-6 space-y-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      {/* Destination Summary */}
                      <div className="flex items-center justify-center">
                        <div className={cn(
                          "p-6 rounded-xl text-center min-w-64",
                          theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50'
                        )}>
                          <Warehouse className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
                          <p className="text-xs text-gray-500">Almacén Destino</p>
                          <p className={cn(
                            "font-semibold text-lg",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {destinationWarehouse?.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {destinationWarehouse?.code} • {destinationWarehouse?.city}
                          </p>
                        </div>
                      </div>

                      {/* Purchase Reference */}
                      {selectedPurchase && (
                        <div className={cn(
                          "p-4 rounded-xl flex items-center gap-3",
                          theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
                        )}>
                          <ShoppingCart className={cn(
                            "w-5 h-5",
                            theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                          )} />
                          <div>
                            <p className="text-xs text-gray-500">Orden de Compra</p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {selectedPurchase.purchaseNumber} - {selectedPurchase.supplierName}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Products Summary */}
                      <div>
                        <h3 className={cn(
                          "text-sm font-medium mb-3",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Productos a Recibir ({receptionLines.length} líneas, {totalItems} unidades)
                        </h3>
                        <div className={cn(
                          "rounded-xl border divide-y max-h-60 overflow-y-auto",
                          theme === 'dark' ? 'border-gray-700 divide-gray-700' : 'border-gray-200 divide-gray-200'
                        )}>
                          {receptionLines.map((line) => (
                            <div key={line.productId} className="p-3 flex items-center justify-between">
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
                                x{line.quantityExpected}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Extra Info */}
                      {(scheduledDate || supplierRef) && (
                        <div className="grid grid-cols-2 gap-4">
                          {scheduledDate && (
                            <div className={cn(
                              "p-3 rounded-xl",
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Fecha Programada
                              </p>
                              <p className={cn(
                                "font-medium",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {new Date(scheduledDate).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                          )}
                          {supplierRef && (
                            <div className={cn(
                              "p-3 rounded-xl",
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                Ref. Proveedor
                              </p>
                              <p className={cn(
                                "font-medium",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {supplierRef}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Notas (opcional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Agregar notas o instrucciones especiales..."
                          rows={3}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>
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
                  Crear Recepción
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
                            Se perderá toda la información ingresada.
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
                        Continuar editando
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/market/warehouses/receptions')}
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
      
    
  )
}
