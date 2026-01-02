'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Package,
  FileText,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Trash2,
  Loader2,
  X,
  Warehouse,
  Calendar,
  Barcode,
  Printer,
  CheckCircle,
  FileUp
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { VariantSelectorModal, Variant } from '@/components/market/VariantSelectorModal'
import { InvoiceUploader, InvoiceFile } from '@/components/orders/InvoiceUploader'

interface ProductVariant {
  id: number
  name: string
  sku: string
  barcode: string
  price: number
  costPrice?: number
  stock: number
  imageUrl: string | null
}

type Step = 'supplier' | 'products' | 'invoices' | 'review' | 'confirmation'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'supplier', title: 'Proveedor', description: 'Seleccionar', icon: Users },
  { id: 'products', title: 'Productos', description: 'Agregar lineas', icon: Package },
  { id: 'invoices', title: 'Facturas', description: 'Adjuntar', icon: FileUp },
  { id: 'review', title: 'Revision', description: 'Verificar orden', icon: FileText },
  { id: 'confirmation', title: 'Confirmacion', description: 'Finalizar', icon: Check }
]

interface Supplier {
  id: number
  code: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
}

interface WarehouseInfo {
  id: number
  code: string
  name: string
}

interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
  costPrice: number
  sellingPrice: number
  currency: string
  quantityOnHand: number
  hasVariants?: boolean
  variants?: ProductVariant[]
}

interface OrderLine {
  productId: number
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  product: Product
  quantity: number
  unitCost: number
  unitPrice: number
  totalCost: number
}

interface CreatedOrder {
  id: number
  orderNumber: string
  totalItems: number
  totalUnits: number
  totalCost: number
}

export default function CreateConsignmentOrderPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('supplier')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Step 1: Supplier & Warehouse
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseInfo | null>(null)
  const [consignmentDate, setConsignmentDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [supplierSearch, setSupplierSearch] = useState('')

  // Step 2: Products
  const [orderLines, setOrderLines] = useState<OrderLine[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')

  // Variant modal state
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)

  // Step 3: Invoices
  const [invoiceFiles, setInvoiceFiles] = useState<InvoiceFile[]>([])

  // Step 4: Confirmation
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Print state
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printServices, setPrintServices] = useState<Array<{
    id: number
    serviceName: string
    printers: Array<{
      id: number
      printerName: string
      isOnline: boolean
      isDefault: boolean
      printerType: string
    }>
  }>>([])
  const [selectedPrinter, setSelectedPrinter] = useState<{ serviceId: number; printerId: number } | null>(null)
  const [printingWithService, setPrintingWithService] = useState(false)
  const [copies, setCopies] = useState(1)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Load suppliers and warehouses
  useEffect(() => {
    const fetchData = async () => {
      setLoadingSuppliers(true)
      try {
        const [suppliersRes, warehousesRes] = await Promise.all([
          fetch('/api/consignments/suppliers?limit=100'),
          fetch('/api/market/warehouses')
        ])

        if (suppliersRes.ok) {
          const data = await suppliersRes.json()
          if (data.success) setSuppliers(data.data.suppliers)
        }

        if (warehousesRes.ok) {
          const data = await warehousesRes.json()
          if (data.success) setWarehouses(data.data.warehouses || data.data)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoadingSuppliers(false)
      }
    }
    fetchData()
  }, [])

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProductResults([])
      return
    }
    setSearchingProducts(true)
    try {
      const response = await fetch(`/api/market/products?search=${encodeURIComponent(query)}&limit=20`)
      const data = await response.json()
      if (data.success) {
        setProductResults(data.data.products || [])
      }
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setSearchingProducts(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch) searchProducts(productSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, searchProducts])

  // Handle barcode scan
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeInput.trim()) return

    setSearchingProducts(true)
    try {
      const response = await fetch(`/api/market/products?search=${encodeURIComponent(barcodeInput)}&limit=1`)
      const data = await response.json()
      if (data.success && data.data.products?.length > 0) {
        // Use handleProductClick to properly check for variants
        handleProductClick(data.data.products[0])
      } else {
        setErrors({ barcode: 'Producto no encontrado' })
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setSearchingProducts(false)
      setBarcodeInput('')
    }
  }

  // Add product to order (with optional variant)
  const addProductToOrder = (product: Product, variant?: ProductVariant | null) => {
    const variantId = variant?.id ?? null
    const unitCost = variant?.costPrice ?? variant?.price ?? product.costPrice
    const unitPrice = variant?.price ?? product.sellingPrice

    // Find existing line by product.id + variant.id combination
    const existing = orderLines.find(l =>
      l.productId === product.id && l.variantId === variantId
    )

    if (existing) {
      setOrderLines(prev => prev.map(l =>
        l.productId === product.id && l.variantId === variantId
          ? { ...l, quantity: l.quantity + 1, totalCost: (l.quantity + 1) * l.unitCost }
          : l
      ))
    } else {
      setOrderLines(prev => [...prev, {
        productId: product.id,
        variantId,
        variantName: variant?.name ?? null,
        variantSku: variant?.sku ?? null,
        product,
        quantity: 1,
        unitCost: unitCost,
        unitPrice: unitPrice,
        totalCost: unitCost
      }])
    }
    setProductSearch('')
    setProductResults([])
    setShowVariantModal(false)
    setSelectedProductForVariant(null)
    setErrors({})
  }

  // Handle product click - show variant modal if product has variants
  const handleProductClick = (product: Product) => {
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      setSelectedProductForVariant(product)
      setShowVariantModal(true)
    } else {
      addProductToOrder(product, null)
    }
  }

  // Handle variant selection from modal
  const handleVariantSelect = (variant: Variant) => {
    if (selectedProductForVariant) {
      const productVariant: ProductVariant = {
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        costPrice: variant.costPrice,
        stock: variant.stock,
        imageUrl: variant.imageUrl
      }
      addProductToOrder(selectedProductForVariant, productVariant)
    }
  }

  // Update line
  const updateLine = (productId: number, variantId: number | null, field: 'quantity' | 'unitCost' | 'unitPrice', value: number) => {
    if (value < 0) return
    if (field === 'quantity' && value < 1) return

    setOrderLines(prev => prev.map(l => {
      if (l.productId !== productId || l.variantId !== variantId) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'unitCost') {
        updated.totalCost = updated.quantity * updated.unitCost
      }
      return updated
    }))
  }

  // Remove line
  const removeLine = (productId: number, variantId: number | null) => {
    setOrderLines(prev => prev.filter(l => !(l.productId === productId && l.variantId === variantId)))
  }

  // Calculate totals
  const totalItems = orderLines.length
  const totalUnits = orderLines.reduce((sum, l) => sum + l.quantity, 0)
  const totalCost = orderLines.reduce((sum, l) => sum + l.totalCost, 0)

  // Validate step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}
    switch (step) {
      case 'supplier':
        if (!selectedSupplier) newErrors.supplier = 'Selecciona un proveedor'
        if (!selectedWarehouse) newErrors.warehouse = 'Selecciona un almacen'
        break
      case 'products':
        if (orderLines.length === 0) newErrors.products = 'Agrega al menos un producto'
        break
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Navigate steps
  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id)
  }

  // Submit order
  const handleSubmitOrder = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/consignments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier?.id,
          warehouseId: selectedWarehouse?.id,
          consignmentDate,
          notes: notes || null,
          lines: orderLines.map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            unitPrice: l.unitPrice
          }))
        })
      })

      const data = await response.json()
      if (data.success) {
        const orderId = data.data.id

        // Upload invoices if any
        if (invoiceFiles.length > 0) {
          try {
            const formData = new FormData()
            invoiceFiles.forEach(inv => {
              formData.append('files', inv.file)
            })
            formData.append('orderType', 'consignment')
            formData.append('orderId', orderId.toString())

            await fetch('/api/upload/order-invoices', {
              method: 'POST',
              body: formData
            })
          } catch (uploadError) {
            console.error('Error uploading invoices:', uploadError)
            // Continue even if invoice upload fails
          }
        }

        setCreatedOrder(data.data)
        setCurrentStep('confirmation')
      } else {
        setErrors({ submit: data.error || 'Error al crear orden' })
      }
    } catch (error) {
      console.error('Error:', error)
      setErrors({ submit: 'Error de conexion' })
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  // Fetch print services for silent printing
  const fetchPrintServices = async () => {
    try {
      const response = await fetch('/api/print/services?includeOffline=false')
      const data = await response.json()
      if (data.success && data.data?.services) {
        const activeServices = data.data.services.filter(
          (s: { status: string; printers?: unknown[] }) => s.status === 'active' && s.printers && s.printers.length > 0
        )
        setPrintServices(activeServices)

        // Auto-select first available printer
        for (const service of activeServices) {
          const availablePrinter = service.printers.find(
            (p: { isOnline: boolean }) => p.isOnline
          )
          if (availablePrinter) {
            setSelectedPrinter({ serviceId: service.id, printerId: availablePrinter.id })
            break
          }
        }
      }
    } catch (err) {
      console.error('[Consignment Print] Error fetching print services:', err)
    }
  }

  // Print with silent service
  const printWithSilentService = async () => {
    if (!createdOrder || !selectedSupplier || !selectedWarehouse || !selectedPrinter) return

    setPrintingWithService(true)
    try {
      const response = await fetch('/api/print/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'consignment_receipt',
          documentData: {
            orderNumber: createdOrder.orderNumber,
            supplier: {
              code: selectedSupplier.code,
              name: selectedSupplier.name,
              contactName: selectedSupplier.contactName
            },
            warehouse: {
              code: selectedWarehouse.code,
              name: selectedWarehouse.name
            },
            lines: orderLines.map(l => ({
              productName: l.product.name,
              sku: l.product.sku,
              barcode: l.product.barcode,
              quantity: l.quantity,
              unitCost: l.unitCost,
              totalCost: l.totalCost
            })),
            totalItems: createdOrder.totalItems,
            totalUnits: createdOrder.totalUnits,
            totalCost: createdOrder.totalCost,
            consignmentDate: consignmentDate,
            notes: notes || undefined
          },
          copies,
          printServiceId: selectedPrinter.serviceId,
          printerId: selectedPrinter.printerId,
          sourceType: 'consignment_order',
          sourceId: createdOrder.id,
          warehouseId: selectedWarehouse.id
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowPrintModal(false)
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('[Consignment Print] Error printing with service:', err)
      setShowPrintModal(false)
    } finally {
      setPrintingWithService(false)
    }
  }

  // Handle print button click
  const handlePrint = () => {
    fetchPrintServices()
    setShowPrintModal(true)
  }

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-[#1a2332]' : 'bg-gray-50'
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

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
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
                            ),
                            currentStepIndex > index && (
                              theme === 'dark'
                                ? 'shadow-md shadow-emerald-500/30'
                                : 'shadow-md shadow-emerald-400/30'
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
                        <p className={cn(
                          "text-xs hidden sm:block mt-0.5",
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-500'
                        )}>
                          {step.description}
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
                          animate={{
                            scaleX: currentStepIndex > index ? 1 : 0
                          }}
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
                "rounded-2xl p-6 sm:p-8",
                theme === 'dark'
                  ? 'bg-[#1a2332]'
                  : 'bg-white border border-gray-200 shadow-lg'
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {/* Step 1: Supplier */}
                {currentStep === 'supplier' && (
                  <motion.div
                    key="supplier"
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
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      Seleccionar Proveedor y Almacen
                    </h2>

                    {/* Supplier Selection */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Proveedor *
                      </label>
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          placeholder="Buscar proveedor..."
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      {/* Selected Supplier Display */}
                      {selectedSupplier && !supplierSearch && (
                        <div className={cn(
                          'p-4 rounded-xl border mb-3',
                          theme === 'dark'
                            ? 'border-emerald-600 bg-emerald-900/20'
                            : 'border-emerald-500 bg-emerald-50'
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="px-2 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500 text-white">
                                {selectedSupplier.code}
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{selectedSupplier.name}</p>
                                {selectedSupplier.contactName && (
                                  <p className="text-xs text-gray-500">{selectedSupplier.contactName}</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedSupplier(null)}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500'
                              )}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Search Results */}
                      {loadingSuppliers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                      ) : supplierSearch.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                          {filteredSuppliers.map(supplier => (
                            <motion.button
                              key={supplier.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setSelectedSupplier(supplier)
                                setSupplierSearch('')
                              }}
                              className={cn(
                                'p-4 rounded-xl border text-left transition-all',
                                selectedSupplier?.id === supplier.id
                                  ? theme === 'dark'
                                    ? 'border-emerald-600 bg-emerald-900/20'
                                    : 'border-emerald-500 bg-emerald-50'
                                  : theme === 'dark'
                                    ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'px-2 py-1 rounded-lg text-xs font-mono font-bold',
                                  selectedSupplier?.id === supplier.id
                                    ? 'bg-emerald-500 text-white'
                                    : theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                )}>
                                  {supplier.code}
                                </div>
                                <div>
                                  <p className={cn(
                                    'font-medium',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>{supplier.name}</p>
                                  {supplier.contactName && (
                                    <p className="text-xs text-gray-500">{supplier.contactName}</p>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          ))}
                          {filteredSuppliers.length === 0 && (
                            <div className="col-span-2 text-center py-8">
                              <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>No se encontraron proveedores</p>
                              <Link href="/dashboard/market/consignments/suppliers/create">
                                <button className="mt-2 text-sm text-emerald-500 hover:text-emerald-600">
                                  Crear proveedor
                                </button>
                              </Link>
                            </div>
                          )}
                        </div>
                      ) : !selectedSupplier ? (
                        <div className={cn(
                          'text-center py-8 rounded-xl border-2 border-dashed',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>Busca un proveedor</p>
                          <p className={cn(
                            'text-sm mt-1',
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>Escribe el nombre o codigo del proveedor</p>
                        </div>
                      ) : null}
                      {errors.supplier && (
                        <p className="text-sm text-red-500 mt-2">{errors.supplier}</p>
                      )}
                    </div>

                    {/* Warehouse Selection */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Almacen Destino *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {warehouses.map(warehouse => (
                          <motion.button
                            key={warehouse.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedWarehouse(warehouse)}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all flex items-center gap-3',
                              selectedWarehouse?.id === warehouse.id
                                ? theme === 'dark'
                                  ? 'border-emerald-600 bg-emerald-900/20'
                                  : 'border-emerald-500 bg-emerald-50'
                                : theme === 'dark'
                                  ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                            )}
                          >
                            <Warehouse className={cn(
                              'w-5 h-5',
                              selectedWarehouse?.id === warehouse.id ? 'text-emerald-500' : 'text-gray-400'
                            )} />
                            <div>
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{warehouse.name}</p>
                              <p className="text-xs text-gray-500">{warehouse.code}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      {errors.warehouse && (
                        <p className="text-sm text-red-500 mt-2">{errors.warehouse}</p>
                      )}
                    </div>

                    {/* Date */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Fecha de Consignacion
                      </label>
                      <div className="relative max-w-xs">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="date"
                          value={consignmentDate}
                          onChange={(e) => setConsignmentDate(e.target.value)}
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>
                    </div>
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      Agregar Productos
                    </h2>

                    {/* Barcode Scanner */}
                    <form onSubmit={handleBarcodeSubmit} className="flex gap-3">
                      <div className="flex-1 relative">
                        <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          placeholder="Escanear codigo de barras..."
                          autoFocus
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={searchingProducts}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                      >
                        {searchingProducts ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      </motion.button>
                    </form>
                    {errors.barcode && (
                      <p className="text-sm text-red-500">{errors.barcode}</p>
                    )}

                    {/* Product Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar por nombre o SKU..."
                        className={cn(
                          'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />

                      {/* Search Results */}
                      {productResults.length > 0 && (
                        <div className={cn(
                          'absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl z-10 max-h-64 overflow-y-auto',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}>
                          {productResults.map(product => (
                            <button
                              key={product.id}
                              onClick={() => handleProductClick(product)}
                              className={cn(
                                'w-full p-3 flex items-center gap-3 text-left transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                              )}
                            >
                              <Package className="w-5 h-5 text-gray-400" />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                                <p className="text-xs text-gray-500">SKU: {product.sku} | Costo: {formatCurrency(product.costPrice)}</p>
                              </div>
                              <Plus className="w-5 h-5 text-emerald-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Order Lines */}
                    <div className="space-y-3">
                      {orderLines.length === 0 ? (
                        <div className={cn(
                          'text-center py-12 rounded-xl border-2 border-dashed',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>No hay productos agregados</p>
                          <p className={cn(
                            "text-sm mt-1",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          )}>Escanea o busca productos para agregar</p>
                        </div>
                      ) : (
                        orderLines.map((line, index) => (
                          <motion.div
                            key={line.productId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              'p-4 rounded-xl border',
                              theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-gray-50 border-gray-200'
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {line.variantName ? `${line.product.name} - ${line.variantName}` : line.product.name}
                                </p>
                                <p className="text-xs text-gray-500">SKU: {line.product.sku}</p>
                              </div>

                              <div className="flex items-center gap-4">
                                {/* Quantity */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Cantidad</label>
                                  <input
                                    type="number"
                                    value={line.quantity}
                                    onChange={(e) => updateLine(line.productId, line.variantId, 'quantity', parseInt(e.target.value) || 1)}
                                    min={1}
                                    className={cn(
                                      'w-20 px-3 py-1.5 rounded-lg border text-center',
                                      theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>

                                {/* Unit Cost */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Costo</label>
                                  <input
                                    type="number"
                                    value={line.unitCost}
                                    onChange={(e) => updateLine(line.productId, line.variantId, 'unitCost', parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    min={0}
                                    className={cn(
                                      'w-24 px-3 py-1.5 rounded-lg border text-right',
                                      theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>

                                {/* Unit Price */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">P. Venta</label>
                                  <input
                                    type="number"
                                    value={line.unitPrice}
                                    onChange={(e) => updateLine(line.productId, line.variantId, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    min={0}
                                    className={cn(
                                      'w-24 px-3 py-1.5 rounded-lg border text-right',
                                      theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>

                                {/* Total */}
                                <div className="text-right min-w-[80px]">
                                  <label className="block text-xs text-gray-500 mb-1">Total</label>
                                  <p className="font-bold text-emerald-600">{formatCurrency(line.totalCost)}</p>
                                </div>

                                {/* Remove */}
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => removeLine(line.productId, line.variantId)}
                                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>

                    {errors.products && (
                      <p className="text-sm text-red-500">{errors.products}</p>
                    )}

                    {/* Summary */}
                    {orderLines.length > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-100'
                      )}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Productos:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{totalItems}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-500">Unidades:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{totalUnits}</span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-600">
                          <span className="text-gray-900 dark:text-white">Total Costo:</span>
                          <span className="text-emerald-600">{formatCurrency(totalCost)}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Invoices */}
                {currentStep === 'invoices' && (
                  <motion.div
                    key="invoices"
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
                        <FileUp className="w-5 h-5 text-white" />
                      </div>
                      Facturas Originales
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Adjunta las facturas o recibos originales del proveedor. Este paso es opcional.
                    </p>

                    <InvoiceUploader
                      invoices={invoiceFiles}
                      onInvoicesChange={setInvoiceFiles}
                      orderType="consignment"
                    />
                  </motion.div>
                )}

                {/* Step 4: Review */}
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      Revisar Orden
                    </h2>

                    {/* Order Info */}
                    <div className={cn(
                      'rounded-2xl p-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className={cn(
                          'p-4 rounded-xl',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <h3 className="text-xs text-gray-500 mb-2">Proveedor</h3>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'px-2 py-1 rounded-lg text-xs font-mono font-bold',
                              theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                            )}>
                              {selectedSupplier?.code}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{selectedSupplier?.name}</p>
                              {selectedSupplier?.contactName && (
                                <p className="text-xs text-gray-500">{selectedSupplier.contactName}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className={cn(
                          'p-4 rounded-xl',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <h3 className="text-xs text-gray-500 mb-2">Almacen Destino</h3>
                          <div className="flex items-center gap-3">
                            <Warehouse className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{selectedWarehouse?.name}</p>
                              <p className="text-xs text-gray-500">{selectedWarehouse?.code}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalItems}</p>
                          <p className="text-xs text-gray-500">productos</p>
                        </div>
                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUnits}</p>
                          <p className="text-xs text-gray-500">unidades</p>
                        </div>
                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCost)}</p>
                          <p className="text-xs text-gray-500">total costo</p>
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div className={cn(
                      'rounded-xl border overflow-hidden',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <table className="w-full">
                        <thead className={cn(
                          theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                        )}>
                          <tr>
                            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Producto</th>
                            <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Cant.</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Costo</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">P. Venta</th>
                            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {orderLines.map(line => (
                            <tr key={`${line.productId}-${line.variantId || 'base'}`}>
                              <td className="py-3 px-4">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                  {line.variantName ? `${line.product.name} - ${line.variantName}` : line.product.name}
                                </p>
                                <p className="text-xs text-gray-500">SKU: {line.variantSku || line.product.sku}</p>
                              </td>
                              <td className="py-3 px-4 text-center font-medium text-gray-900 dark:text-white">{line.quantity}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(line.unitCost)}</td>
                              <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(line.unitPrice)}</td>
                              <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(line.totalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className={cn(
                          theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                        )}>
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-right font-bold text-gray-900 dark:text-white">
                              Total:
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600 text-lg">
                              {formatCurrency(totalCost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Invoices Summary */}
                    {invoiceFiles.length > 0 && (
                      <div className={cn(
                        'p-4 rounded-xl border flex items-center gap-4',
                        theme === 'dark' ? 'bg-purple-900/20 border-purple-800' : 'bg-purple-50 border-purple-200'
                      )}>
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center',
                          theme === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100'
                        )}>
                          <FileUp className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                          <p className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {invoiceFiles.length} {invoiceFiles.length === 1 ? 'factura adjunta' : 'facturas adjuntas'}
                          </p>
                          <p className={cn(
                            'text-sm',
                            theme === 'dark' ? 'text-purple-300' : 'text-purple-600'
                          )}>
                            Se subiran al crear la orden
                          </p>
                        </div>
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
                        rows={3}
                        placeholder="Agregar notas u observaciones..."
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                          theme === 'dark'
                            ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                        )}
                      />
                    </div>

                    {errors.submit && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-red-600 text-sm">{errors.submit}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 4: Confirmation */}
                {currentStep === 'confirmation' && createdOrder && (
                  <motion.div
                    key="confirmation"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                      className="w-20 h-20 mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"
                    >
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Orden Creada Exitosamente
                    </h2>
                    <p className="text-gray-500 mb-6">
                      La orden de consignacion ha sido registrada
                    </p>

                    <div className={cn(
                      'inline-block p-6 rounded-2xl mb-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <p className="text-sm text-gray-500 mb-1">Numero de Orden</p>
                      <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                        {createdOrder.orderNumber}
                      </p>
                      <div className="flex justify-center gap-6 mt-4">
                        <div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{createdOrder.totalItems}</p>
                          <p className="text-xs text-gray-500">productos</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{createdOrder.totalUnits}</p>
                          <p className="text-xs text-gray-500">unidades</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(createdOrder.totalCost)}</p>
                          <p className="text-xs text-gray-500">total</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handlePrint}
                        className={cn(
                          'flex items-center gap-2 px-6 py-3 rounded-xl transition-all',
                          theme === 'dark'
                            ? 'bg-gray-700 text-white hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        <Printer className="w-5 h-5" />
                        Imprimir Recepcion
                      </motion.button>

                      <Link href="/dashboard/market/consignments">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                        >
                          Ver Ordenes
                          <ArrowRight className="w-5 h-5" />
                        </motion.button>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
            {currentStep !== 'confirmation' && (
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
                    onClick={handleSubmitOrder}
                    disabled={submitting}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-400/30',
                      'text-white'
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Crear Orden
                      </>
                    )}
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
            )}
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
                            ¿Cancelar orden?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Se perdera toda la informacion ingresada y no podras recuperarla.
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
                        onClick={() => router.push('/dashboard/market/consignments')}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
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

          {/* Print Modal */}
          <AnimatePresence>
            {showPrintModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPrintModal(false)}
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
                    <div className={cn(
                      "px-6 py-4 border-b flex items-center justify-between",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Printer className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            Imprimir Recepcion
                          </h3>
                          <p className="text-xs text-gray-500">#{createdOrder?.orderNumber}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPrintModal(false)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      {printServices.length === 0 ? (
                        <div className="text-center py-4">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
                          <p className="text-gray-500">Buscando impresoras...</p>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Seleccionar Impresora
                            </label>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {printServices.map(service => (
                                service.printers.map(printer => (
                                  <button
                                    key={`${service.id}-${printer.id}`}
                                    onClick={() => setSelectedPrinter({ serviceId: service.id, printerId: printer.id })}
                                    className={cn(
                                      'w-full p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between',
                                      selectedPrinter?.printerId === printer.id
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                        : theme === 'dark'
                                          ? 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Printer className={cn(
                                        "w-5 h-5",
                                        selectedPrinter?.printerId === printer.id ? 'text-emerald-600' : 'text-gray-400'
                                      )} />
                                      <div>
                                        <p className={cn(
                                          "font-medium",
                                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        )}>
                                          {printer.printerName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {printer.printerType === 'thermal_80mm' ? 'Termica 80mm' : 'Estandar'}
                                        </p>
                                      </div>
                                    </div>
                                    {printer.isOnline ? (
                                      <span className="text-xs text-emerald-500 font-medium">Online</span>
                                    ) : (
                                      <span className="text-xs text-gray-400">Offline</span>
                                    )}
                                  </button>
                                ))
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Copias
                            </label>
                            <div className="flex items-center justify-center gap-4">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCopies(Math.max(1, copies - 1))}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                                  theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                )}
                              >
                                -
                              </motion.button>
                              <span className={cn(
                                "w-12 text-center text-xl font-bold",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {copies}
                              </span>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCopies(Math.min(5, copies + 1))}
                                className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                                  theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                                )}
                              >
                                +
                              </motion.button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {printServices.length > 0 && (
                      <div className={cn(
                        "flex gap-3 p-6 pt-4 border-t",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowPrintModal(false)}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-medium transition-all",
                            theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          )}
                        >
                          Cancelar
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={printWithSilentService}
                          disabled={printingWithService || !selectedPrinter}
                          className={cn(
                            "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                            "bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                          )}
                        >
                          {printingWithService ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Printer className="w-5 h-5" />
                              Imprimir
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Variant Selector Modal */}
          <VariantSelectorModal
            isOpen={showVariantModal}
            onClose={() => {
              setShowVariantModal(false)
              setSelectedProductForVariant(null)
            }}
            product={selectedProductForVariant ? {
              id: selectedProductForVariant.id,
              name: selectedProductForVariant.name,
              imageUrl: selectedProductForVariant.imageUrl,
              variants: (selectedProductForVariant.variants || []).map(v => ({
                id: v.id,
                name: v.name,
                sku: v.sku,
                barcode: v.barcode,
                price: v.price,
                costPrice: v.costPrice,
                stock: v.stock,
                imageUrl: v.imageUrl
              }))
            } : null}
            onSelect={handleVariantSelect}
            mode="purchase"
            showOutOfStock={true}
            currency="USD"
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
