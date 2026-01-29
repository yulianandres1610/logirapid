'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Package,
  Settings,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Minus,
  Trash2,
  FileText,
  Building2,
  Tag,
  Percent,
  Calendar,
  ShoppingCart,
  AlertCircle,
  Loader2,
  X,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Hash,
  User,
  Warehouse,
  TrendingUp,
  DollarSign,
  Truck
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Customer {
  id: number
  code: string
  businessName: string
  legalName?: string
  taxId?: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  pricelistId: number | null
  pricelistName: string | null
  creditDays: number
}

interface WarehouseStock {
  warehouseId: number
  warehouseName: string
  warehouseCode: string
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
}

interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  sellingPrice: number
  costPrice: number
  imageUrl: string | null
  quantityOnHand: number
  // Multi-warehouse data (when includeWarehouseStock=true)
  costPriceCup?: number
  profitMargin?: number
  warehouseStock?: WarehouseStock[]
  totalStock?: number
}

interface WarehouseQuantities {
  [warehouseId: string]: number
}

interface InvoiceLine {
  productId: number
  variantId: number | null
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  previousUnitPrice: number // For animation - track previous price
  costPrice: number
  originalPrice: number // Base selling price before any pricelist discounts
  discountPercent: number
  discountAmount: number
  subtotal: number
  warehouseQuantities: WarehouseQuantities
  warehouseStock: WarehouseStock[]
  profitMargin: number
  costPriceCup: number
  hasPricelistPrice: boolean // Whether price comes from pricelist
  pricelistDiscountInfo: string | null // Info about pricelist discount applied
  currentTierMinQty: number // Current tier minimum quantity for display
  priceJustChanged: boolean // Flag for animation
}

interface WarehouseInfo {
  id: number
  name: string
}

interface Pricelist {
  id: number
  name: string
}

interface PricelistItem {
  id: number
  productId: number
  categoryId: number | null
  priceType: 'fixed' | 'discount_percent' | 'discount_amount'
  fixedPrice: number | null
  discountPercent: number | null
  discountAmount: number | null
  minQuantity: number
}

const STEPS = [
  { id: 'customer', title: 'Cliente', icon: Users },
  { id: 'products', title: 'Productos', icon: Package },
  { id: 'conditions', title: 'Condiciones', icon: Settings },
  { id: 'confirm', title: 'Confirmación', icon: CheckCircle }
]

export default function CreateInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const preselectedCustomerId = searchParams.get('customerId')

  const [currentStep, setCurrentStep] = useState<string>('customer')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([])
  const [pricelists, setPricelists] = useState<Pricelist[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [exchangeRate, setExchangeRate] = useState(340)
  const [pricelistItems, setPricelistItems] = useState<PricelistItem[]>([])
  const [loadingPricelist, setLoadingPricelist] = useState(false)

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Step 2: Products
  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [expandedLineIndex, setExpandedLineIndex] = useState<number | null>(null)

  // Step 3: Conditions
  const [dueDate, setDueDate] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    businessName: '',
    legalName: '',
    taxId: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    pricelistId: '',
    creditDays: '0'
  })
  const [savingCustomer, setSavingCustomer] = useState(false)

  useEffect(() => {
    fetchCustomers()
    fetchWarehouses()
    fetchProductsWithStock()
    fetchPricelists()
  }, [])

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === parseInt(preselectedCustomerId))
      if (customer) {
        handleSelectCustomer(customer)
      }
    }
  }, [preselectedCustomerId, customers])

  // Handle customer selection - also fetch pricelist items
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    // Clear previous pricelist items and lines when changing customer
    setPricelistItems([])
    setLines([])
    // Fetch pricelist items if customer has a pricelist
    if (customer.pricelistId) {
      fetchPricelistItems(customer.pricelistId)
    }
  }

  const fetchCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const response = await fetch('/api/market/wholesale/customers?status=active&limit=200')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setCustomers(result.data.customers)
        }
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/market/warehouses')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setWarehouses(result.data.warehouses || result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const fetchProductsWithStock = async () => {
    setLoadingProducts(true)
    try {
      const response = await fetch('/api/market/products?limit=500&includeWarehouseStock=true')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setProducts(result.data.products || result.data)
          if (result.data.exchangeRate) {
            setExchangeRate(result.data.exchangeRate)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchPricelists = async () => {
    try {
      const response = await fetch('/api/market/pricelists')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setPricelists(result.data.pricelists || result.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching pricelists:', error)
    }
  }

  const fetchPricelistItems = async (pricelistId: number) => {
    setLoadingPricelist(true)
    try {
      const response = await fetch(`/api/market/pricelists/${pricelistId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data.items) {
          setPricelistItems(result.data.items.map((item: {
            id: number
            productId: number
            categoryId: number | null
            priceType: string
            fixedPrice: number | null
            discountPercent: number | null
            discountAmount: number | null
            minQuantity: number
          }) => ({
            id: item.id,
            productId: item.productId,
            categoryId: item.categoryId,
            priceType: item.priceType as 'fixed' | 'discount_percent' | 'discount_amount',
            fixedPrice: item.fixedPrice,
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            minQuantity: item.minQuantity || 1
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching pricelist items:', error)
    } finally {
      setLoadingPricelist(false)
    }
  }

  // Calculate price from pricelist for a product
  const getPricelistPrice = (productId: number, basePrice: number, quantity: number = 1): {
    price: number
    hasDiscount: boolean
    discountInfo: string | null
    minQuantity: number
  } => {
    // Find applicable pricelist items for this product (sorted by min_quantity desc to get best tier)
    const applicableItems = pricelistItems
      .filter(item => item.productId === productId && item.minQuantity <= quantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)

    if (applicableItems.length === 0) {
      return { price: basePrice, hasDiscount: false, discountInfo: null, minQuantity: 1 }
    }

    const item = applicableItems[0] // Best applicable tier

    if (item.priceType === 'fixed' && item.fixedPrice !== null) {
      const discount = ((basePrice - item.fixedPrice) / basePrice) * 100
      return {
        price: item.fixedPrice,
        hasDiscount: true,
        discountInfo: item.minQuantity > 1
          ? `Desde ${item.minQuantity} uds: $${item.fixedPrice.toFixed(2)} (-${discount.toFixed(0)}%)`
          : `Precio de lista (-${discount.toFixed(0)}%)`,
        minQuantity: item.minQuantity
      }
    } else if (item.priceType === 'discount_percent' && item.discountPercent !== null) {
      const discountedPrice = basePrice * (1 - item.discountPercent / 100)
      return {
        price: discountedPrice,
        hasDiscount: true,
        discountInfo: item.minQuantity > 1
          ? `Desde ${item.minQuantity} uds: ${item.discountPercent}% desc.`
          : `${item.discountPercent}% descuento de lista`,
        minQuantity: item.minQuantity
      }
    } else if (item.priceType === 'discount_amount' && item.discountAmount !== null) {
      const discountedPrice = Math.max(0, basePrice - item.discountAmount)
      return {
        price: discountedPrice,
        hasDiscount: true,
        discountInfo: item.minQuantity > 1
          ? `Desde ${item.minQuantity} uds: -$${item.discountAmount}`
          : `$${item.discountAmount} descuento de lista`,
        minQuantity: item.minQuantity
      }
    }

    return { price: basePrice, hasDiscount: false, discountInfo: null, minQuantity: 1 }
  }

  // Get all available tiers for a product to show upcoming discounts
  const getProductTiers = (productId: number, basePrice: number) => {
    return pricelistItems
      .filter(item => item.productId === productId)
      .sort((a, b) => a.minQuantity - b.minQuantity)
      .map(item => {
        let price = basePrice
        if (item.priceType === 'fixed' && item.fixedPrice !== null) {
          price = item.fixedPrice
        } else if (item.priceType === 'discount_percent' && item.discountPercent !== null) {
          price = basePrice * (1 - item.discountPercent / 100)
        } else if (item.priceType === 'discount_amount' && item.discountAmount !== null) {
          price = Math.max(0, basePrice - item.discountAmount)
        }
        return {
          minQuantity: item.minQuantity,
          price,
          savings: ((basePrice - price) / basePrice) * 100
        }
      })
  }

  const addProduct = (product: Product) => {
    const existingIndex = lines.findIndex(l => l.productId === product.id)
    if (existingIndex >= 0) {
      // Product already added, expand it
      setExpandedLineIndex(existingIndex)
      return
    }

    // Initialize warehouse quantities - set 0 for all warehouses with stock
    const warehouseQuantities: WarehouseQuantities = {}
    const warehouseStock = product.warehouseStock || []
    for (const ws of warehouseStock) {
      warehouseQuantities[ws.warehouseId.toString()] = 0
    }

    const costPriceCup = product.costPriceCup || product.costPrice * exchangeRate

    // Check if there's a pricelist price for this product
    const { price: pricelistPrice, hasDiscount, discountInfo, minQuantity } = getPricelistPrice(
      product.id,
      product.sellingPrice,
      1 // Initial quantity for price tier
    )

    // Calculate profit margin based on the actual unit price (after pricelist)
    const unitPrice = hasDiscount ? pricelistPrice : product.sellingPrice
    const profitMargin = product.costPrice > 0
      ? ((unitPrice - product.costPrice) / product.costPrice) * 100
      : 0

    setLines([...lines, {
      productId: product.id,
      variantId: null,
      productName: product.name,
      productSku: product.sku || '',
      quantity: 0, // Will be calculated from warehouse quantities
      unitPrice,
      previousUnitPrice: unitPrice,
      costPrice: product.costPrice,
      originalPrice: product.sellingPrice, // Keep base price for reference
      discountPercent: 0, // Additional discount on top of pricelist price
      discountAmount: 0,
      subtotal: 0,
      warehouseQuantities,
      warehouseStock,
      profitMargin,
      costPriceCup,
      hasPricelistPrice: hasDiscount,
      pricelistDiscountInfo: discountInfo,
      currentTierMinQty: minQuantity,
      priceJustChanged: false
    }])

    // Expand the newly added line
    setExpandedLineIndex(lines.length)
  }

  const updateWarehouseQuantity = (lineIndex: number, warehouseId: number, quantity: number) => {
    const newLines = [...lines]
    const line = newLines[lineIndex]
    const warehouseStock = line.warehouseStock.find(ws => ws.warehouseId === warehouseId)
    const maxQuantity = warehouseStock?.quantityAvailable || 0

    // Clamp quantity to available stock
    const clampedQuantity = Math.max(0, Math.min(quantity, maxQuantity))
    line.warehouseQuantities[warehouseId.toString()] = clampedQuantity

    // Calculate total quantity from all warehouses
    const newTotalQuantity = Object.values(line.warehouseQuantities).reduce((sum, q) => sum + q, 0)
    line.quantity = newTotalQuantity

    // Store previous price for animation
    const previousPrice = line.unitPrice

    // Recalculate pricelist price based on new total quantity
    const { price: newPrice, hasDiscount, discountInfo, minQuantity } = getPricelistPrice(
      line.productId,
      line.originalPrice,
      newTotalQuantity
    )

    // Check if price changed for animation effect
    const priceChanged = Math.abs(newPrice - previousPrice) > 0.001
    if (priceChanged) {
      line.previousUnitPrice = previousPrice
      line.priceJustChanged = true
      // Reset the animation flag after a delay
      setTimeout(() => {
        setLines(prev => prev.map((l, i) =>
          i === lineIndex ? { ...l, priceJustChanged: false } : l
        ))
      }, 1500)
    }

    line.unitPrice = newPrice
    line.hasPricelistPrice = hasDiscount
    line.pricelistDiscountInfo = discountInfo
    line.currentTierMinQty = minQuantity

    // Recalculate profit margin with new price
    line.profitMargin = line.costPrice > 0
      ? ((newPrice - line.costPrice) / line.costPrice) * 100
      : 0

    // Recalculate subtotal with new price
    const discountMultiplier = 1 - line.discountPercent / 100
    line.subtotal = line.quantity * line.unitPrice * discountMultiplier
    line.discountAmount = line.quantity * line.unitPrice * (line.discountPercent / 100)

    setLines(newLines)
  }

  const updateLineDiscount = (index: number, discount: number) => {
    const newLines = [...lines]
    const line = newLines[index]
    // Discount cannot exceed the profit margin
    const maxDiscount = Math.max(0, line.profitMargin)
    line.discountPercent = Math.max(0, Math.min(maxDiscount, discount))
    line.discountAmount = line.quantity * line.unitPrice * line.discountPercent / 100
    line.subtotal = line.quantity * line.unitPrice - line.discountAmount
    setLines(newLines)
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
    if (expandedLineIndex === index) {
      setExpandedLineIndex(null)
    } else if (expandedLineIndex !== null && expandedLineIndex > index) {
      setExpandedLineIndex(expandedLineIndex - 1)
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
  const globalDiscount = subtotal * discountPercent / 100
  const total = subtotal - globalDiscount

  // Calculate deliveries that will be generated
  const deliveriesPreview = useMemo(() => {
    const deliveryMap = new Map<number, {
      warehouseId: number
      warehouseName: string
      products: Array<{ name: string; quantity: number }>
    }>()

    for (const line of lines) {
      for (const [warehouseIdStr, qty] of Object.entries(line.warehouseQuantities)) {
        if (qty <= 0) continue
        const warehouseId = parseInt(warehouseIdStr)
        const warehouse = line.warehouseStock.find(ws => ws.warehouseId === warehouseId)

        if (!deliveryMap.has(warehouseId)) {
          deliveryMap.set(warehouseId, {
            warehouseId,
            warehouseName: warehouse?.warehouseName || `Almacén ${warehouseId}`,
            products: []
          })
        }

        deliveryMap.get(warehouseId)!.products.push({
          name: line.productName,
          quantity: qty
        })
      }
    }

    return Array.from(deliveryMap.values())
  }, [lines])

  const validateStep = (step: string): boolean => {
    setError('')

    switch (step) {
      case 'customer':
        if (!selectedCustomer) {
          setError('Debe seleccionar un cliente')
          return false
        }
        return true

      case 'products':
        if (lines.length === 0) {
          setError('Debe agregar al menos un producto')
          return false
        }
        // Check that at least one product has quantity
        const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0)
        if (totalQuantity === 0) {
          setError('Debe especificar cantidades para al menos un producto')
          return false
        }
        return true

      case 'conditions':
        return true

      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) {
        setCurrentStep(STEPS[nextIndex].id)
      }
    }
  }

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
    setError('')
  }

  const handleSaveCustomer = async () => {
    if (!newCustomer.businessName.trim()) {
      setError('El nombre comercial es requerido')
      return
    }

    setSavingCustomer(true)
    try {
      const response = await fetch('/api/market/wholesale/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: newCustomer.businessName,
          legalName: newCustomer.legalName || null,
          taxId: newCustomer.taxId || null,
          contactName: newCustomer.contactName || null,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
          address: newCustomer.address || null,
          city: newCustomer.city || null,
          pricelistId: newCustomer.pricelistId ? parseInt(newCustomer.pricelistId) : null,
          creditDays: parseInt(newCustomer.creditDays) || 0
        })
      })

      const result = await response.json()
      if (result.success) {
        const created = result.data
        setCustomers(prev => [...prev, created])
        setSelectedCustomer(created)
        setShowCreateCustomerModal(false)
        setNewCustomer({
          businessName: '',
          legalName: '',
          taxId: '',
          contactName: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          pricelistId: '',
          creditDays: '0'
        })
      } else {
        setError(result.error || 'Error al crear cliente')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      setError('Error de conexion')
    } finally {
      setSavingCustomer(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedCustomer) return
    setSaving(true)

    try {
      const response = await fetch('/api/market/wholesale/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          warehouseId: null, // Multi-warehouse mode, no single warehouse
          pricelistId: selectedCustomer.pricelistId,
          dueDate: dueDate || null,
          discountPercent,
          notes,
          internalNotes,
          lines: lines.filter(l => l.quantity > 0).map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            productName: l.productName,
            productSku: l.productSku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            originalPrice: l.originalPrice,
            discountPercent: l.discountPercent,
            discountAmount: l.discountAmount,
            warehouseQuantities: l.warehouseQuantities
          }))
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          router.push(`/dashboard/market/wholesale/invoices/${result.data.id}`)
        }
      }
    } catch (error) {
      console.error('Error creating invoice:', error)
      setError('Error al crear factura')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatCUP = (value: number) => {
    return new Intl.NumberFormat('es-CU', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value) + ' CUP'
  }

  const filteredCustomers = customers.filter(c =>
    c.businessName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.taxId && c.taxId.toLowerCase().includes(customerSearch.toLowerCase()))
  )

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
    (p.barcode && p.barcode.includes(productSearch))
  )

  return (
    <div className={cn(
      "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      <div className="max-w-6xl xl:max-w-7xl mx-auto space-y-6 sm:space-y-8 relative">
        {/* Close Button */}
        <motion.button
          onClick={() => setShowCancelModal(true)}
          className={cn(
            "absolute -top-2 right-0 sm:right-0 p-2 rounded-full transition-colors z-10",
            theme === 'dark'
              ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              : 'bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-100 shadow-sm'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Header */}
        <div className="text-center">
          <h1 className={cn(
            "text-2xl sm:text-3xl lg:text-4xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Nueva Factura
          </h1>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Crea una nueva factura para cliente mayorista
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStepIndex > index

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className="relative w-14 h-14">
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-green-500"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0, 0.5]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}
                    <motion.div
                      className={cn(
                        "relative w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-green-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-500'
                              : 'bg-gray-200 text-gray-500'
                      )}
                      animate={{
                        scale: isActive ? 1 : 0.9,
                        backgroundColor: isCompleted
                          ? '#22c55e'
                          : isActive
                            ? '#16a34a'
                            : theme === 'dark'
                              ? '#1f2937'
                              : '#e5e7eb'
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </motion.div>
                  </div>
                  <span className={cn(
                    "text-xs mt-2 hidden sm:block text-center font-medium",
                    isActive
                      ? 'text-green-600'
                      : isCompleted
                        ? 'text-green-600'
                        : theme === 'dark'
                          ? 'text-gray-500'
                          : 'text-gray-400'
                  )}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="relative w-8 sm:w-16 lg:w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: currentStepIndex > index ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
              <button onClick={() => setError('')} className="ml-auto">
                <X className="w-4 h-4 text-red-500" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content */}
        <div className={cn(
          "rounded-2xl shadow-lg p-6",
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}>
          <AnimatePresence mode="wait">
            {/* Step 1: Customer */}
            {currentStep === 'customer' && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Seleccionar Cliente
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateCustomerModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Cliente
                  </motion.button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, codigo o RUC/NIT..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className={cn(
                      "w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2 transition-all",
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                {loadingCustomers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className={cn(
                          "p-4 border-2 rounded-xl cursor-pointer transition-all",
                          selectedCustomer?.id === customer.id
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg',
                            selectedCustomer?.id === customer.id
                              ? 'bg-gradient-to-br from-green-500 to-green-600'
                              : 'bg-gradient-to-br from-gray-400 to-gray-500'
                          )}>
                            {customer.businessName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'font-semibold truncate',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{customer.businessName}</p>
                            <p className="text-sm text-gray-500">{customer.code}</p>
                            {customer.taxId && (
                              <p className="text-xs text-gray-400">RUC: {customer.taxId}</p>
                            )}
                          </div>
                          {selectedCustomer?.id === customer.id && (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        {customer.pricelistName && (
                          <div className="mt-3 flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">{customer.pricelistName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Products - Invoice Style with Multi-Warehouse */}
            {currentStep === 'products' && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Agregar Productos
                    </h2>
                    {selectedCustomer?.pricelistName && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Tag className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs text-green-600 dark:text-green-400">
                          {loadingPricelist ? 'Cargando lista...' : `Lista de precios: ${selectedCustomer.pricelistName}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                    theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                  )}>
                    <DollarSign className="w-4 h-4" />
                    Tasa: $1 = {exchangeRate.toLocaleString()} CUP
                  </div>
                </div>

                {/* Product Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar producto por nombre, SKU o codigo de barras..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className={cn(
                      'w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                {/* Product List for Selection */}
                {productSearch && (
                  <div className={cn(
                    'max-h-[200px] overflow-y-auto rounded-xl border',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
                  )}>
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                      </div>
                    ) : (
                      filteredProducts.slice(0, 20).map(product => (
                        <div
                          key={product.id}
                          onClick={() => addProduct(product)}
                          className={cn(
                            'flex items-center justify-between p-3 cursor-pointer transition-colors border-b last:border-b-0',
                            theme === 'dark'
                              ? 'border-gray-700 hover:bg-gray-800'
                              : 'border-gray-200 hover:bg-gray-100'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                            )}>
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className={cn(
                                'font-medium text-sm',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{product.name}</p>
                              <p className="text-xs text-gray-500">{product.sku} | Stock: {product.totalStock || 0}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{formatCurrency(product.sellingPrice)}</p>
                            <button className="text-xs text-green-500 hover:text-green-600 font-medium flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" /> Agregar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Invoice-Style Product Table */}
                <div className={cn(
                  'rounded-xl border overflow-hidden',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  {/* Table Header */}
                  <div className={cn(
                    'grid grid-cols-12 gap-2 p-3 text-xs font-semibold uppercase tracking-wider',
                    theme === 'dark' ? 'bg-gray-900 text-gray-400' : 'bg-gray-100 text-gray-600'
                  )}>
                    <div className="col-span-1">#</div>
                    <div className="col-span-3">Producto</div>
                    <div className="col-span-1 text-right">P.Costo</div>
                    <div className="col-span-1 text-right">P.Venta</div>
                    <div className="col-span-1 text-right">Margen</div>
                    <div className="col-span-1 text-center">Desc%</div>
                    <div className="col-span-1 text-right">Cant.</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-1"></div>
                  </div>

                  {/* Table Body */}
                  {lines.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">No hay productos agregados</p>
                      <p className="text-sm text-gray-400">Busca y agrega productos</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {lines.map((line, index) => (
                        <div key={index}>
                          {/* Main Row */}
                          <motion.div
                            animate={line.priceJustChanged ? {
                              backgroundColor: [
                                theme === 'dark' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)',
                                theme === 'dark' ? 'rgba(34, 197, 94, 0)' : 'rgba(34, 197, 94, 0)'
                              ]
                            } : {}}
                            transition={{ duration: 1 }}
                            className={cn(
                              'grid grid-cols-12 gap-2 p-3 items-center cursor-pointer transition-colors',
                              expandedLineIndex === index
                                ? theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                                : theme === 'dark' ? 'hover:bg-gray-900/50' : 'hover:bg-gray-50'
                            )}
                            onClick={() => setExpandedLineIndex(expandedLineIndex === index ? null : index)}
                          >
                            <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                            <div className="col-span-3">
                              <p className={cn(
                                'font-medium text-sm truncate',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{line.productName}</p>
                              <p className="text-xs text-gray-500">{line.productSku}</p>
                              <p className="text-xs text-gray-400">{formatCUP(line.costPriceCup)}</p>
                            </div>
                            <div className="col-span-1 text-right text-sm text-gray-600 dark:text-gray-400">
                              {formatCurrency(line.costPrice)}
                            </div>
                            <div className="col-span-1 text-right">
                              {line.hasPricelistPrice ? (
                                <div title={line.pricelistDiscountInfo || ''}>
                                  <span className="text-xs text-gray-400 line-through block">
                                    {formatCurrency(line.originalPrice)}
                                  </span>
                                  <motion.span
                                    key={`${line.productId}-${line.unitPrice}`}
                                    initial={line.priceJustChanged ? { scale: 1.3, color: '#22c55e' } : false}
                                    animate={{ scale: 1, color: '#16a34a' }}
                                    transition={{ duration: 0.5, type: 'spring' }}
                                    className="text-sm font-medium text-green-600 block"
                                  >
                                    {formatCurrency(line.unitPrice)}
                                  </motion.span>
                                  {line.priceJustChanged && (
                                    <motion.span
                                      initial={{ opacity: 1, y: 0 }}
                                      animate={{ opacity: 0, y: -10 }}
                                      transition={{ duration: 1 }}
                                      className="text-[10px] text-green-500 block"
                                    >
                                      -${(line.previousUnitPrice - line.unitPrice).toFixed(2)}
                                    </motion.span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm font-medium text-green-600">
                                  {formatCurrency(line.unitPrice)}
                                </span>
                              )}
                            </div>
                            <div className="col-span-1 text-right">
                              <span className={cn(
                                'text-xs px-1.5 py-0.5 rounded',
                                line.profitMargin >= 20
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                                  : line.profitMargin >= 10
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                              )}>
                                {line.profitMargin.toFixed(0)}%
                              </span>
                            </div>
                            <div className="col-span-1 text-center" onClick={e => e.stopPropagation()}>
                              <input
                                type="number"
                                value={line.discountPercent}
                                onChange={(e) => updateLineDiscount(index, parseFloat(e.target.value) || 0)}
                                className={cn(
                                  'w-14 text-center px-1 py-1 rounded border text-sm',
                                  theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
                                )}
                                min="0"
                                max={Math.max(0, line.profitMargin)}
                                title={`Máximo: ${line.profitMargin.toFixed(0)}% (margen)`}
                              />
                            </div>
                            <div className="col-span-1 text-right">
                              <span className={cn(
                                'font-semibold text-sm',
                                line.quantity > 0 ? 'text-green-600' : 'text-gray-400'
                              )}>
                                {line.quantity}
                              </span>
                            </div>
                            <div className="col-span-2 text-right">
                              <motion.span
                                key={`subtotal-${line.productId}-${line.subtotal.toFixed(2)}`}
                                initial={line.priceJustChanged ? { scale: 1.2 } : false}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.3, type: 'spring' }}
                                className="font-bold text-green-600"
                              >
                                {formatCurrency(line.subtotal)}
                              </motion.span>
                            </div>
                            <div className="col-span-1 text-right" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => removeLine(index)}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </motion.div>

                          {/* Expanded: Warehouse Stock Section */}
                          <AnimatePresence>
                            {expandedLineIndex === index && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className={cn(
                                  'overflow-hidden',
                                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                                )}
                              >
                                <div className="p-4 space-y-4">
                                  {/* Price Tiers Section */}
                                  {(() => {
                                    const tiers = getProductTiers(line.productId, line.originalPrice)
                                    if (tiers.length > 0) {
                                      return (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                            <TrendingUp className="w-4 h-4" />
                                            Descuentos por Cantidad
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            {tiers.map((tier, tierIdx) => {
                                              const isActive = line.quantity >= tier.minQuantity &&
                                                (tierIdx === tiers.length - 1 || line.quantity < tiers[tierIdx + 1].minQuantity)
                                              const isReached = line.quantity >= tier.minQuantity
                                              const unitsNeeded = tier.minQuantity - line.quantity

                                              return (
                                                <motion.div
                                                  key={tier.minQuantity}
                                                  initial={false}
                                                  animate={{
                                                    scale: isActive ? 1.05 : 1,
                                                    borderColor: isActive ? '#22c55e' : isReached ? '#86efac' : '#374151'
                                                  }}
                                                  className={cn(
                                                    'relative px-3 py-2 rounded-lg border-2 text-center min-w-[80px] transition-all',
                                                    isActive
                                                      ? 'bg-green-500/20 border-green-500'
                                                      : isReached
                                                        ? 'bg-green-500/10 border-green-300 dark:border-green-700'
                                                        : theme === 'dark'
                                                          ? 'bg-gray-800/50 border-gray-700'
                                                          : 'bg-gray-100 border-gray-300'
                                                  )}
                                                >
                                                  {isActive && (
                                                    <motion.div
                                                      initial={{ scale: 0 }}
                                                      animate={{ scale: 1 }}
                                                      className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                                                    >
                                                      <CheckCircle className="w-3 h-3 text-white" />
                                                    </motion.div>
                                                  )}
                                                  <p className={cn(
                                                    'text-xs font-medium',
                                                    isActive || isReached ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                                                  )}>
                                                    {tier.minQuantity === 1 ? 'Base' : `+${tier.minQuantity} uds`}
                                                  </p>
                                                  <p className={cn(
                                                    'font-bold text-sm',
                                                    isActive ? 'text-green-600' : theme === 'dark' ? 'text-white' : 'text-gray-900'
                                                  )}>
                                                    ${tier.price.toFixed(2)}
                                                  </p>
                                                  {tier.savings > 0 && (
                                                    <p className={cn(
                                                      'text-[10px]',
                                                      isActive || isReached ? 'text-green-500' : 'text-gray-400'
                                                    )}>
                                                      -{tier.savings.toFixed(0)}%
                                                    </p>
                                                  )}
                                                  {!isReached && unitsNeeded > 0 && (
                                                    <p className="text-[10px] text-orange-500 mt-1">
                                                      Faltan {unitsNeeded}
                                                    </p>
                                                  )}
                                                </motion.div>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )
                                    }
                                    return null
                                  })()}

                                  {/* Warehouse Stock Section */}
                                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                                    <Warehouse className="w-4 h-4" />
                                    Stock por Almacen - Total: {line.quantity}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {line.warehouseStock.map(ws => {
                                      const qty = line.warehouseQuantities[ws.warehouseId.toString()] || 0
                                      const hasStock = ws.quantityAvailable > 0

                                      return (
                                        <div
                                          key={ws.warehouseId}
                                          className={cn(
                                            'flex items-center justify-between p-3 rounded-lg border',
                                            hasStock
                                              ? theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                                              : theme === 'dark' ? 'border-gray-700 bg-gray-800/50 opacity-50' : 'border-gray-200 bg-gray-100 opacity-50'
                                          )}
                                        >
                                          <div>
                                            <p className={cn(
                                              'font-medium text-sm',
                                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                                            )}>
                                              {ws.warehouseName}
                                            </p>
                                            <p className={cn(
                                              'text-xs',
                                              hasStock ? 'text-green-600' : 'text-gray-400'
                                            )}>
                                              {ws.quantityAvailable} disponibles
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <button
                                              onClick={() => updateWarehouseQuantity(index, ws.warehouseId, qty - 1)}
                                              disabled={qty <= 0}
                                              className={cn(
                                                'p-1.5 rounded-lg transition-colors disabled:opacity-30',
                                                theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                              )}
                                            >
                                              <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <input
                                              type="number"
                                              value={qty}
                                              onChange={(e) => updateWarehouseQuantity(index, ws.warehouseId, parseInt(e.target.value) || 0)}
                                              disabled={!hasStock}
                                              className={cn(
                                                'w-14 text-center px-2 py-1.5 rounded-lg border text-sm font-medium',
                                                theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300',
                                                !hasStock && 'opacity-50 cursor-not-allowed'
                                              )}
                                              min="0"
                                              max={ws.quantityAvailable}
                                            />
                                            <button
                                              onClick={() => updateWarehouseQuantity(index, ws.warehouseId, qty + 1)}
                                              disabled={!hasStock || qty >= ws.quantityAvailable}
                                              className={cn(
                                                'p-1.5 rounded-lg transition-colors disabled:opacity-30',
                                                theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                              )}
                                            >
                                              <Plus className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                  {line.warehouseStock.length === 0 && (
                                    <p className="text-sm text-gray-500 text-center py-2">
                                      No hay stock disponible en ningun almacen
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Table Footer - Totals */}
                  {lines.length > 0 && (
                    <div className={cn(
                      'p-4 border-t',
                      theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
                    )}>
                      <div className="flex justify-end">
                        <div className="w-64 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span>Total:</span>
                            <span className="text-green-600">{formatCurrency(subtotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Conditions */}
            {currentStep === 'conditions' && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Condiciones de la Factura
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Percent className="w-4 h-4 inline mr-2" />
                      Descuento Global
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border pr-12 focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                        )}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Fecha de Vencimiento
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                      )}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Notas para el Cliente
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Condiciones, observaciones..."
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                      )}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-2 text-gray-400" />
                      Notas Internas
                      <span className="text-xs text-gray-400 ml-2">(no visibles para el cliente)</span>
                    </label>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={2}
                      placeholder="Notas internas..."
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-gray-500 focus:ring-gray-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-gray-500 focus:ring-gray-500/20'
                      )}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Confirmation */}
            {currentStep === 'confirm' && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Confirmar Factura
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Customer Summary */}
                    <div className={cn(
                      'rounded-xl p-4',
                      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                    )}>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-green-600" />
                        Cliente
                      </h3>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-xl">
                          {selectedCustomer?.businessName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-lg text-gray-900 dark:text-white">
                            {selectedCustomer?.businessName}
                          </p>
                          <p className="text-sm text-gray-500">{selectedCustomer?.code}</p>
                          {selectedCustomer?.taxId && (
                            <p className="text-xs text-gray-400">RUC/NIT: {selectedCustomer.taxId}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Products Summary */}
                    <div className={cn(
                      'rounded-xl p-4',
                      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                    )}>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Package className="w-5 h-5 text-green-600" />
                        Productos ({lines.filter(l => l.quantity > 0).length})
                      </h3>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {lines.filter(l => l.quantity > 0).map((line, index) => (
                          <div key={index} className={cn(
                            'flex justify-between items-center p-3 rounded-lg',
                            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                          )}>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium',
                                theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                              )}>{line.quantity}</span>
                              <span className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {line.productName}
                              </span>
                            </div>
                            <span className="font-semibold text-green-600">{formatCurrency(line.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Deliveries Preview */}
                    <div className={cn(
                      'rounded-xl p-4',
                      theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                    )}>
                      <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                        <Truck className="w-5 h-5" />
                        Entregas a generar ({deliveriesPreview.length})
                      </h3>
                      <div className="space-y-3">
                        {deliveriesPreview.map((delivery, index) => (
                          <div
                            key={delivery.warehouseId}
                            className={cn(
                              'p-3 rounded-lg',
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Warehouse className="w-4 h-4 text-blue-500" />
                              <span className="font-medium text-sm text-gray-900 dark:text-white">
                                {delivery.warehouseName}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                              {delivery.products.map((p, i) => (
                                <div key={i}>{p.quantity}x {p.name}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {deliveriesPreview.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-2">
                            No se generaran entregas (sin productos con cantidades)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Totals */}
                    <div className={cn(
                      'rounded-xl p-4',
                      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                    )}>
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-green-600" />
                        Resumen
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Subtotal</span>
                          <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                        </div>
                        {discountPercent > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Descuento ({discountPercent}%)</span>
                            <span>-{formatCurrency(globalDiscount)}</span>
                          </div>
                        )}
                        <div className={cn(
                          'flex justify-between text-xl font-bold pt-3 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <span>Total</span>
                          <span className="text-green-600">{formatCurrency(total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className={cn(
            "flex items-center justify-between mt-8 pt-6 border-t",
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <motion.button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors",
                currentStepIndex === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-600 hover:bg-gray-100'
              )}
              whileHover={currentStepIndex > 0 ? { scale: 1.02 } : {}}
              whileTap={currentStepIndex > 0 ? { scale: 0.98 } : {}}
            >
              <ArrowLeft className="w-5 h-5" />
              Anterior
            </motion.button>

            {currentStepIndex < STEPS.length - 1 ? (
              <motion.button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Siguiente
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                whileHover={!saving ? { scale: 1.02 } : {}}
                whileTap={!saving ? { scale: 0.98 } : {}}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Crear Factura
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-2xl p-6 max-w-md w-full shadow-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={cn(
                "text-lg font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Cancelar factura?
              </h3>
              <p className={cn(
                "mb-6",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Perderas todos los datos ingresados. Estas seguro?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Continuar editando
                </button>
                <button
                  onClick={() => router.push('/dashboard/market/wholesale/invoices')}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                >
                  Si, cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Customer Modal */}
      <AnimatePresence>
        {showCreateCustomerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateCustomerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Nuevo Cliente Mayorista
                </h3>
                <button
                  onClick={() => setShowCreateCustomerModal(false)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-2" />
                    Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    value={newCustomer.businessName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, businessName: e.target.value })}
                    placeholder="Nombre de la empresa"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Razon Social
                  </label>
                  <input
                    type="text"
                    value={newCustomer.legalName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, legalName: e.target.value })}
                    placeholder="Razon social"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Hash className="w-4 h-4 inline mr-2" />
                    RUC/NIT/RFC
                  </label>
                  <input
                    type="text"
                    value={newCustomer.taxId}
                    onChange={(e) => setNewCustomer({ ...newCustomer, taxId: e.target.value })}
                    placeholder="Identificacion fiscal"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Contacto
                  </label>
                  <input
                    type="text"
                    value={newCustomer.contactName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, contactName: e.target.value })}
                    placeholder="Nombre del contacto"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="correo@empresa.com"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Direccion
                  </label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="Direccion completa"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Tag className="w-4 h-4 inline mr-2" />
                    Lista de Precios
                  </label>
                  <select
                    value={newCustomer.pricelistId}
                    onChange={(e) => setNewCustomer({ ...newCustomer, pricelistId: e.target.value })}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  >
                    <option value="">Sin lista asignada</option>
                    {pricelists.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Dias de Credito
                  </label>
                  <input
                    type="number"
                    value={newCustomer.creditDays}
                    onChange={(e) => setNewCustomer({ ...newCustomer, creditDays: e.target.value })}
                    placeholder="0"
                    min="0"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowCreateCustomerModal(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCustomer}
                  disabled={savingCustomer}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingCustomer ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Crear Cliente
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
