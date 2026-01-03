'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck,
  Package,
  Calendar,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  Building2,
  Phone,
  MapPin,
  Clock,
  FileText,
  Hash,
  FileUp
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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

type Step = 'supplier' | 'products' | 'lots' | 'invoices' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'supplier', title: 'Proveedor', description: 'Buscar o crear', icon: Truck },
  { id: 'products', title: 'Productos', description: 'Agregar líneas', icon: Package },
  { id: 'lots', title: 'Lotes', description: 'Vencimientos', icon: Calendar },
  { id: 'invoices', title: 'Facturas', description: 'Adjuntar', icon: FileUp },
  { id: 'review', title: 'Revisar', description: 'Confirmar compra', icon: Check }
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

interface Supplier {
  id: number
  supplierCode: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  fullAddress: string
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

interface PurchaseLine {
  productId: number
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  product: Product
  quantity: number
  unitPrice: number
  totalPrice: number
  lotNumber: string
  expirationDate: string
  manufacturingDate: string
}

export default function CreatePurchasePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('supplier')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Step 1: Supplier
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([])
  const [searchingSupplier, setSearchingSupplier] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false)
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: ''
  })
  const [creatingSupplier, setCreatingSupplier] = useState(false)

  // Step 2: Products
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)

  // Variant modal state
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)

  // Step 4: Invoices
  const [invoiceFiles, setInvoiceFiles] = useState<InvoiceFile[]>([])

  // Step 5: Review
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [currency, setCurrency] = useState('USD')

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Search suppliers with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (supplierSearch.length >= 2) {
        setSearchingSupplier(true)
        try {
          const response = await fetch(`/api/market/suppliers/search?q=${encodeURIComponent(supplierSearch)}&limit=10`)
          const data = await response.json()
          if (data.success) {
            setSupplierResults(data.data)
          }
        } catch (error) {
          console.error('Error searching suppliers:', error)
        } finally {
          setSearchingSupplier(false)
        }
      } else {
        setSupplierResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [supplierSearch])

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
      if (productSearch) {
        searchProducts(productSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, searchProducts])

  // Create new supplier
  const handleCreateSupplier = async () => {
    if (!newSupplierData.name.trim()) return
    setCreatingSupplier(true)
    try {
      const response = await fetch('/api/market/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplierData)
      })
      const data = await response.json()
      if (data.success) {
        setSelectedSupplier({
          id: data.data.id,
          supplierCode: data.data.supplierCode,
          name: newSupplierData.name,
          phone: newSupplierData.phone || null,
          email: null,
          address: newSupplierData.address || null,
          city: newSupplierData.city || null,
          state: newSupplierData.state || null,
          fullAddress: [newSupplierData.address, newSupplierData.city, newSupplierData.state].filter(Boolean).join(', ')
        })
        setShowNewSupplierModal(false)
        setNewSupplierData({ name: '', phone: '', address: '', city: '', state: '' })
        setSupplierSearch('')
      }
    } catch (error) {
      console.error('Error creating supplier:', error)
    } finally {
      setCreatingSupplier(false)
    }
  }

  // Add product to purchase (with optional variant)
  const addProductToPurchase = (product: Product, variant?: ProductVariant | null) => {
    const variantId = variant?.id ?? null
    const unitPrice = variant?.costPrice ?? variant?.price ?? product.costPrice

    // Find existing line by product.id + variant.id combination
    const existing = purchaseLines.find(l =>
      l.productId === product.id && l.variantId === variantId
    )

    if (existing) {
      setPurchaseLines(prev => prev.map(l =>
        l.productId === product.id && l.variantId === variantId
          ? { ...l, quantity: l.quantity + 1, totalPrice: (l.quantity + 1) * l.unitPrice }
          : l
      ))
    } else {
      setPurchaseLines(prev => [...prev, {
        productId: product.id,
        variantId,
        variantName: variant?.name ?? null,
        variantSku: variant?.sku ?? null,
        product,
        quantity: 1,
        unitPrice: unitPrice,
        totalPrice: unitPrice,
        lotNumber: '',
        expirationDate: '',
        manufacturingDate: ''
      }])
    }
    setProductSearch('')
    setProductResults([])
    setShowProductModal(false)
    setShowVariantModal(false)
    setSelectedProductForVariant(null)
  }

  // Handle product click - show variant modal if product has variants
  const handleProductClick = (product: Product) => {
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      setSelectedProductForVariant(product)
      setShowVariantModal(true)
    } else {
      addProductToPurchase(product, null)
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
      addProductToPurchase(selectedProductForVariant, productVariant)
    }
  }

  // Update line quantity
  const updateLineQuantity = (productId: number, variantId: number | null, quantity: number) => {
    if (quantity < 1) return
    setPurchaseLines(prev => prev.map(l =>
      l.productId === productId && l.variantId === variantId
        ? { ...l, quantity, totalPrice: quantity * l.unitPrice }
        : l
    ))
  }

  // Update line price
  const updateLinePrice = (productId: number, variantId: number | null, unitPrice: number) => {
    if (unitPrice < 0) return
    setPurchaseLines(prev => prev.map(l =>
      l.productId === productId && l.variantId === variantId
        ? { ...l, unitPrice, totalPrice: l.quantity * unitPrice }
        : l
    ))
  }

  // Update lot info
  const updateLotInfo = (productId: number, variantId: number | null, field: 'lotNumber' | 'expirationDate' | 'manufacturingDate', value: string) => {
    setPurchaseLines(prev => prev.map(l =>
      l.productId === productId && l.variantId === variantId ? { ...l, [field]: value } : l
    ))
  }

  // Remove line
  const removeLine = (productId: number, variantId: number | null) => {
    setPurchaseLines(prev => prev.filter(l => !(l.productId === productId && l.variantId === variantId)))
  }

  // Calculate totals
  const subtotal = purchaseLines.reduce((sum, l) => sum + l.totalPrice, 0)
  const tax = 0
  const total = subtotal + tax

  // Validate step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}
    switch (step) {
      case 'supplier':
        if (!selectedSupplier) newErrors.supplier = 'Selecciona un proveedor'
        break
      case 'products':
        if (purchaseLines.length === 0) newErrors.products = 'Agrega al menos un producto'
        break
      case 'review':
        if (!purchaseDate) newErrors.purchaseDate = 'La fecha de compra es requerida'
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

  // Submit purchase
  const handleSubmit = async () => {
    if (!validateStep('review')) return
    setLoading(true)
    try {
      const response = await fetch('/api/market/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier!.id,
          supplierName: selectedSupplier!.name,
          supplierContact: selectedSupplier!.phone,
          supplierAddress: selectedSupplier!.fullAddress,
          purchaseDate,
          expectedDate: expectedDate || null,
          notes: notes || null,
          currency,
          lines: purchaseLines.map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lotNumber: l.lotNumber || null,
            expirationDate: l.expirationDate || null,
            manufacturingDate: l.manufacturingDate || null
          }))
        })
      })
      const data = await response.json()
      if (data.success) {
        const purchaseId = data.data.id

        // Upload invoices if any
        if (invoiceFiles.length > 0) {
          try {
            const formData = new FormData()
            invoiceFiles.forEach(inv => {
              formData.append('files', inv.file)
            })
            formData.append('orderType', 'purchase')
            formData.append('orderId', purchaseId.toString())

            await fetch('/api/upload/order-invoices', {
              method: 'POST',
              body: formData
            })
          } catch (uploadError) {
            console.error('Error uploading invoices:', uploadError)
            // Continue even if invoice upload fails
          }
        }

        router.push('/dashboard/market/purchases')
      } else {
        setErrors({ submit: data.error || 'Error al crear la compra' })
      }
    } catch (error) {
      console.error('Error creating purchase:', error)
      setErrors({ submit: 'Error al crear la compra' })
    } finally {
      setLoading(false)
    }
  }

  // Days until expiration helper
  const getDaysUntilExpiration = (date: string) => {
    if (!date) return null
    const exp = new Date(date)
    const today = new Date()
    return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  return (
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

            {/* Header */}
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
                Nueva Orden de Compra
              </h1>
            </div>

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
                                ? 'shadow-lg shadow-blue-500/50'
                                : 'shadow-lg shadow-blue-400/50'
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
                            : currentStepIndex > index
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-white" />
                      </div>
                      Seleccionar Proveedor
                    </h2>

                    {/* Search Input */}
                    <div className="relative">
                      <div className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 focus-within:border-blue-500'
                          : 'bg-gray-50 border-gray-200 focus-within:border-blue-500'
                      )}>
                        <Search className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <input
                          type="text"
                          placeholder="Buscar por nombre, código o teléfono..."
                          value={supplierSearch}
                          onChange={(e) => setSupplierSearch(e.target.value)}
                          className={cn(
                            'flex-1 bg-transparent outline-none text-lg',
                            theme === 'dark' ? 'text-white placeholder:text-gray-500' : 'text-gray-900 placeholder:text-gray-400'
                          )}
                        />
                        {searchingSupplier && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                      </div>

                      {/* Search Results */}
                      {supplierSearch.length >= 2 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'absolute z-50 w-full mt-2 rounded-xl border shadow-2xl overflow-hidden',
                            theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                          )}
                        >
                          {supplierResults.length > 0 ? (
                            <div className="max-h-64 overflow-y-auto">
                              {supplierResults.map((supplier) => (
                                <motion.button
                                  key={supplier.id}
                                  whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(249, 250, 251, 1)' }}
                                  onClick={() => { setSelectedSupplier(supplier); setSupplierSearch(''); setSupplierResults([]) }}
                                  className={cn('w-full p-4 flex items-start gap-3 text-left border-b last:border-b-0', theme === 'dark' ? 'border-gray-700' : 'border-gray-100')}
                                >
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-5 h-5 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{supplier.name}</span>
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">{supplier.supplierCode}</span>
                                    </div>
                                    <div className={cn('flex items-center gap-4 text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                      {supplier.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{supplier.phone}</span>}
                                      {supplier.fullAddress && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" />{supplier.fullAddress}</span>}
                                    </div>
                                  </div>
                                </motion.button>
                              ))}
                            </div>
                          ) : !searchingSupplier && (
                            <div className="p-4 text-center">
                              <p className={cn('text-sm mb-3', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No se encontraron proveedores</p>
                            </div>
                          )}

                          <motion.button
                            whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(30, 64, 175, 0.2)' : 'rgba(219, 234, 254, 1)' }}
                            onClick={() => { setNewSupplierData({ ...newSupplierData, name: supplierSearch }); setShowNewSupplierModal(true) }}
                            className={cn('w-full p-4 flex items-center gap-3 text-blue-600 dark:text-blue-400', theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50')}
                          >
                            <Plus className="w-5 h-5" />
                            <span className="font-medium">Crear nuevo proveedor &quot;{supplierSearch}&quot;</span>
                          </motion.button>
                        </motion.div>
                      )}
                    </div>

                    {/* Selected Supplier Card */}
                    {selectedSupplier && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          'p-6 rounded-xl border-2',
                          theme === 'dark' ? 'bg-green-900/20 border-green-500/50' : 'bg-green-50 border-green-200'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                              <Building2 className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedSupplier.name}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">{selectedSupplier.supplierCode}</span>
                              </div>
                              {selectedSupplier.phone && <p className={cn('flex items-center gap-2 text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}><Phone className="w-4 h-4" />{selectedSupplier.phone}</p>}
                              {selectedSupplier.fullAddress && <p className={cn('flex items-center gap-2 text-sm mt-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}><MapPin className="w-4 h-4" />{selectedSupplier.fullAddress}</p>}
                            </div>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedSupplier(null)}
                            className={cn('px-4 py-2 rounded-lg text-sm font-medium', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700 shadow-sm')}
                          >
                            Cambiar
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {errors.supplier && <p className="text-red-500 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{errors.supplier}</p>}
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
                    <div className="flex items-center justify-between">
                      <h2 className={cn(
                        "text-xl font-bold flex items-center gap-3",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        Productos de la Compra
                      </h2>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowProductModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium shadow-lg"
                      >
                        <Plus className="w-5 h-5" />Agregar
                      </motion.button>
                    </div>

                    {purchaseLines.length === 0 ? (
                      <div className={cn(
                        'text-center py-16 rounded-xl border-2 border-dashed',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
                      )}>
                        <Package className={cn('w-16 h-16 mx-auto mb-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                        <p className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>No hay productos agregados</p>
                        <p className={cn('text-sm mb-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>Haz clic en &quot;Agregar&quot; para comenzar</p>
                      </div>
                    ) : (
                      <div className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                        <table className="w-full">
                          <thead className={cn(theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                            <tr>
                              <th className={cn('px-4 py-3 text-left text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Producto</th>
                              <th className={cn('px-4 py-3 text-center text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Cantidad</th>
                              <th className={cn('px-4 py-3 text-center text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>P. Unitario</th>
                              <th className={cn('px-4 py-3 text-right text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Subtotal</th>
                              <th className="px-4 py-3 w-12"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {purchaseLines.map((line, index) => (
                              <motion.tr
                                key={line.productId}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className={cn('border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}
                              >
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    {line.product.imageUrl ? (
                                      <img src={line.product.imageUrl} alt={line.product.name} className="w-12 h-12 rounded-lg object-cover" />
                                    ) : (
                                      <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                        <Package className="w-6 h-6 text-gray-400" />
                                      </div>
                                    )}
                                    <div>
                                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                        {line.variantName ? `${line.product.name} - ${line.variantName}` : line.product.name}
                                      </p>
                                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                        SKU: {line.variantSku || line.product.sku}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => updateLineQuantity(line.productId, line.variantId, line.quantity - 1)}
                                      className={cn('w-8 h-8 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
                                    >-</button>
                                    <input
                                      type="number"
                                      value={line.quantity}
                                      onChange={(e) => updateLineQuantity(line.productId, line.variantId, parseInt(e.target.value) || 1)}
                                      className={cn('w-16 text-center rounded-lg py-2 border', theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200')}
                                    />
                                    <button
                                      onClick={() => updateLineQuantity(line.productId, line.variantId, line.quantity + 1)}
                                      className={cn('w-8 h-8 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
                                    >+</button>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex items-center justify-center">
                                    <span className={cn('text-sm mr-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{CURRENCY_SYMBOLS[currency]}</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={line.unitPrice}
                                      onChange={(e) => updateLinePrice(line.productId, line.variantId, parseFloat(e.target.value) || 0)}
                                      className={cn('w-24 text-center rounded-lg py-2 border', theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200')}
                                    />
                                  </div>
                                </td>
                                <td className={cn('px-4 py-4 text-right font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {CURRENCY_SYMBOLS[currency]}{line.totalPrice.toFixed(2)}
                                </td>
                                <td className="px-4 py-4">
                                  <button onClick={() => removeLine(line.productId, line.variantId)} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                        <div className={cn('p-4 border-t', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                          <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Subtotal:</span>
                                <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{CURRENCY_SYMBOLS[currency]}{subtotal.toFixed(2)}</span>
                              </div>
                              <div className={cn('flex justify-between pt-2 border-t font-bold text-lg', theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900')}>
                                <span>Total:</span>
                                <span>{CURRENCY_SYMBOLS[currency]}{total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {errors.products && <p className="text-red-500 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{errors.products}</p>}
                  </motion.div>
                )}

                {/* Step 3: Lots */}
                {currentStep === 'lots' && (
                  <motion.div
                    key="lots"
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
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      Lotes y Vencimientos
                    </h2>

                    <div className={cn(
                      'p-4 rounded-xl flex items-start gap-3',
                      theme === 'dark' ? 'bg-amber-900/20 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'
                    )}>
                      <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-amber-300' : 'text-amber-800')}>Este paso es opcional</p>
                        <p className={cn('text-sm', theme === 'dark' ? 'text-amber-400' : 'text-amber-700')}>Puedes agregar esta información cuando recibas la mercancía en el almacén.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {purchaseLines.map((line, index) => {
                        const daysUntil = getDaysUntilExpiration(line.expirationDate)
                        return (
                          <motion.div
                            key={line.productId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}
                          >
                            <div className="flex items-center gap-3 mb-4">
                              {line.product.imageUrl ? (
                                <img src={line.product.imageUrl} alt={line.product.name} className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {line.variantName ? `${line.product.name} - ${line.variantName}` : line.product.name}
                                </p>
                                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{line.quantity} unidades</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                  <Hash className="w-4 h-4 inline mr-1" />Número de Lote
                                </label>
                                <input
                                  type="text"
                                  placeholder="LOT-2024-XXXX"
                                  value={line.lotNumber}
                                  onChange={(e) => updateLotInfo(line.productId, line.variantId, 'lotNumber', e.target.value)}
                                  className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white placeholder:text-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400')}
                                />
                              </div>
                              <div>
                                <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                  <Calendar className="w-4 h-4 inline mr-1" />Fecha de Vencimiento
                                </label>
                                <input
                                  type="date"
                                  value={line.expirationDate}
                                  onChange={(e) => updateLotInfo(line.productId, line.variantId, 'expirationDate', e.target.value)}
                                  className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                                />
                                {daysUntil !== null && (
                                  <p className={cn('text-xs mt-1 flex items-center gap-1', daysUntil < 0 ? 'text-red-500' : daysUntil < 30 ? 'text-amber-500' : 'text-green-500')}>
                                    {daysUntil < 0 ? (
                                      <><AlertTriangle className="w-3 h-3" />Vencido hace {Math.abs(daysUntil)} días</>
                                    ) : (
                                      <><Check className="w-3 h-3" />Vence en {daysUntil} días</>
                                    )}
                                  </p>
                                )}
                              </div>
                              <div>
                                <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                                  <Calendar className="w-4 h-4 inline mr-1" />Fecha de Fabricación
                                </label>
                                <input
                                  type="date"
                                  value={line.manufacturingDate}
                                  onChange={(e) => updateLotInfo(line.productId, line.variantId, 'manufacturingDate', e.target.value)}
                                  className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Invoices */}
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
                      orderType="purchase"
                    />
                  </motion.div>
                )}

                {/* Step 5: Review */}
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
                      Resumen de la Compra
                    </h2>

                    {/* Supplier Card */}
                    <div className={cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                      <h3 className={cn('font-medium mb-3 flex items-center gap-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        <Truck className="w-4 h-4" />Proveedor
                      </h3>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedSupplier?.name}</p>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{selectedSupplier?.supplierCode}</p>
                          {selectedSupplier?.phone && (
                            <p className={cn('text-sm flex items-center gap-1 mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              <Phone className="w-3 h-3" />{selectedSupplier.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          <Calendar className="w-4 h-4 inline mr-1" />Fecha de Compra *
                        </label>
                        <input
                          type="date"
                          value={purchaseDate}
                          onChange={(e) => setPurchaseDate(e.target.value)}
                          className={cn('w-full px-4 py-3 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                        />
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          <Calendar className="w-4 h-4 inline mr-1" />Entrega Esperada
                        </label>
                        <input
                          type="date"
                          value={expectedDate}
                          onChange={(e) => setExpectedDate(e.target.value)}
                          className={cn('w-full px-4 py-3 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        <FileText className="w-4 h-4 inline mr-1" />Notas (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Agregar notas adicionales..."
                        rows={3}
                        className={cn('w-full px-4 py-3 rounded-xl border resize-none', theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400')}
                      />
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
                            Se subiran al crear la compra
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Products Summary */}
                    <div className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <div className={cn('px-5 py-3 border-b', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                        <h3 className={cn('font-medium flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          <Package className="w-4 h-4" />Productos ({purchaseLines.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {purchaseLines.map((line) => (
                          <div key={line.productId} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {line.product.imageUrl ? (
                                <img src={line.product.imageUrl} alt={line.product.name} className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {line.variantName ? `${line.product.name} - ${line.variantName}` : line.product.name}
                                </p>
                                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                  x{line.quantity} @ {CURRENCY_SYMBOLS[currency]}{line.unitPrice.toFixed(2)}
                                  {line.lotNumber && ` • Lote: ${line.lotNumber}`}
                                </p>
                              </div>
                            </div>
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {CURRENCY_SYMBOLS[currency]}{line.totalPrice.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className={cn('p-4 border-t', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                        <div className="flex justify-end">
                          <div className="w-64 space-y-2">
                            <div className="flex justify-between">
                              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Subtotal:</span>
                              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{CURRENCY_SYMBOLS[currency]}{subtotal.toFixed(2)}</span>
                            </div>
                            <div className={cn('flex justify-between pt-2 border-t font-bold text-lg', theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900')}>
                              <span>Total:</span>
                              <span className="text-green-500">{CURRENCY_SYMBOLS[currency]}{total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {errors.submit && (
                      <div className={cn('p-4 rounded-xl flex items-center gap-3', 'bg-red-500/10 border border-red-500/30')}>
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <p className="text-red-500">{errors.submit}</p>
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
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Creando...</>
                  ) : (
                    <><Check className="w-5 h-5" />Crear Compra</>
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
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                      : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/30',
                    'text-white'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Product Search Modal */}
          <AnimatePresence>
            {showProductModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => setShowProductModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn('w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}
                >
                  <div className={cn('p-4 border-b flex items-center justify-between', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Buscar Producto</h3>
                    <button onClick={() => setShowProductModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4">
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                      <Search className="w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, SKU o código de barras..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        autoFocus
                        className={cn('flex-1 bg-transparent outline-none', theme === 'dark' ? 'text-white' : 'text-gray-900')}
                      />
                      {searchingProducts && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {productResults.length > 0 ? (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {productResults.map((product) => (
                          <motion.button
                            key={product.id}
                            whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(249, 250, 251, 1)' }}
                            onClick={() => handleProductClick(product)}
                            className="w-full p-4 flex items-center gap-4 text-left"
                          >
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-14 h-14 rounded-lg object-cover" />
                            ) : (
                              <div className={cn('w-14 h-14 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                <Package className="w-7 h-7 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{product.name}</p>
                                {product.hasVariants && (
                                  <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[10px] font-medium">
                                    {product.variants?.length || 0} var
                                  </span>
                                )}
                              </div>
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                SKU: {product.sku}{product.barcode && ` • ${product.barcode}`}
                              </p>
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                Stock: {product.quantityOnHand} unidades
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn('font-bold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {CURRENCY_SYMBOLS[product.currency]}{product.costPrice.toFixed(2)}
                              </p>
                              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Precio costo</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    ) : productSearch.length >= 2 && !searchingProducts ? (
                      <div className="p-8 text-center">
                        <Package className={cn('w-12 h-12 mx-auto mb-3', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No se encontraron productos</p>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <Search className={cn('w-12 h-12 mx-auto mb-3', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Escribe para buscar productos</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* New Supplier Modal */}
          <AnimatePresence>
            {showNewSupplierModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => setShowNewSupplierModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn('w-full max-w-md rounded-2xl shadow-xl overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}
                >
                  <div className={cn('p-4 border-b flex items-center justify-between', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Nuevo Proveedor</h3>
                    <button onClick={() => setShowNewSupplierModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Nombre *</label>
                      <input
                        type="text"
                        value={newSupplierData.name}
                        onChange={(e) => setNewSupplierData(prev => ({ ...prev, name: e.target.value }))}
                        className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                      />
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Teléfono</label>
                      <input
                        type="text"
                        value={newSupplierData.phone}
                        onChange={(e) => setNewSupplierData(prev => ({ ...prev, phone: e.target.value }))}
                        className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                      />
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Dirección</label>
                      <input
                        type="text"
                        value={newSupplierData.address}
                        onChange={(e) => setNewSupplierData(prev => ({ ...prev, address: e.target.value }))}
                        className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Ciudad</label>
                        <input
                          type="text"
                          value={newSupplierData.city}
                          onChange={(e) => setNewSupplierData(prev => ({ ...prev, city: e.target.value }))}
                          className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                        />
                      </div>
                      <div>
                        <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>Provincia</label>
                        <input
                          type="text"
                          value={newSupplierData.state}
                          onChange={(e) => setNewSupplierData(prev => ({ ...prev, state: e.target.value }))}
                          className={cn('w-full px-4 py-2 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900')}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={cn('p-4 border-t flex justify-end gap-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <button
                      onClick={() => setShowNewSupplierModal(false)}
                      className={cn('px-4 py-2 rounded-lg font-medium', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreateSupplier}
                      disabled={!newSupplierData.name.trim() || creatingSupplier}
                      className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white disabled:opacity-50"
                    >
                      {creatingSupplier ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear Proveedor'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

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
                            ¿Cancelar compra?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Los datos ingresados se perderán y no podrás recuperarlos.
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
            currency={currency}
          />
    </div>
  )
}
