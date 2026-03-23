'use client'

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Package,
  Settings,
  Check,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  X,
  Tag,
  Percent,
  Calendar,
  FileText,
  CheckCircle,
  DollarSign,
  Eye,
  AlertCircle,
  Warehouse
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

// Wrapper component to handle Suspense for useSearchParams
export default function CreateQuotePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <CreateQuotePage />
    </Suspense>
  )
}

interface Customer {
  id: number
  code: string
  businessName: string
  taxId?: string
  pricelistId: number | null
  pricelistName: string | null
  creditDays: number
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
  profitMargin?: number
}

interface QuoteLine {
  productId: number
  variantId: number | null
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  unitPriceCup: number
  originalPrice: number
  subtotal: number
  subtotalCup: number
  costPrice: number
  profitMargin: number
  hasPricelistPrice: boolean
  pricelistDiscountInfo: string | null
  estimatedDelivery: string | null
}

interface WarehouseOption {
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
  { id: 'review', title: 'Confirmar', icon: Eye }
]

const STORAGE_KEY = 'wholesale_quote_draft'

function CreateQuotePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')

  const initialStep = searchParams.get('step') || 'customer'
  const validSteps = STEPS.map(s => s.id)
  const [currentStep, setCurrentStep] = useState<string>(
    validSteps.includes(initialStep) ? initialStep : 'customer'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [exchangeRateBCC, setExchangeRateBCC] = useState(411)
  const [pricelistItems, setPricelistItems] = useState<PricelistItem[]>([])
  const [loadingPricelist, setLoadingPricelist] = useState(false)

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Step 2: Products
  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<QuoteLine[]>([])

  // Step 3: Conditions
  const [validUntil, setValidUntil] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  // Sales Rep
  const [companyUsers, setCompanyUsers] = useState<Array<{id: number, name: string, email: string}>>([])
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<number | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Warehouse & Delivery Estimates
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null)
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)
  const [deliveryEstimates, setDeliveryEstimates] = useState<Record<number, string>>({})
  const [loadingEstimates, setLoadingEstimates] = useState(false)
  const estimateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasRestoredRef = useRef(false)

  const [isRestoring, setIsRestoring] = useState(true)

  // Quick create customer
  const [showCreateCustomer, setShowCreateCustomer] = useState(false)
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({
    businessName: '',
    contactName: '',
    phone: '',
    email: '',
    taxId: '',
    address: '',
    pricelistId: ''
  })
  const [availablePricelists, setAvailablePricelists] = useState<Array<{ id: number; name: string }>>([])
  const [loadingPricelists, setLoadingPricelists] = useState(false)

  // Update URL with current step
  const updateURL = useCallback((step: string, customerId?: number) => {
    const params = new URLSearchParams()
    params.set('step', step)
    if (customerId) {
      params.set('customerId', customerId.toString())
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router])

  // Save form state to localStorage
  const saveToStorage = useCallback(() => {
    if (isRestoring) return
    const state = {
      customerId: selectedCustomer?.id || null,
      lines: lines.map(l => ({
        productId: l.productId,
        variantId: l.variantId,
        productName: l.productName,
        productSku: l.productSku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        unitPriceCup: l.unitPriceCup,
        originalPrice: l.originalPrice,
        subtotal: l.subtotal,
        subtotalCup: l.subtotalCup,
        costPrice: l.costPrice,
        profitMargin: l.profitMargin,
        hasPricelistPrice: l.hasPricelistPrice,
        pricelistDiscountInfo: l.pricelistDiscountInfo
      })),
      validUntil,
      discountPercent,
      notes,
      internalNotes,
      timestamp: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [selectedCustomer, lines, validUntil, discountPercent, notes, internalNotes, isRestoring])

  const clearStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Restore state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        if (state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          if (state.validUntil) setValidUntil(state.validUntil)
          if (state.discountPercent) setDiscountPercent(state.discountPercent)
          if (state.notes) setNotes(state.notes)
          if (state.internalNotes) setInternalNotes(state.internalNotes)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (e) {
        console.error('Error restoring saved state:', e)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setIsRestoring(false)
  }, [])

  // Restore customer and lines after data is loaded (runs only once)
  useEffect(() => {
    if (isRestoring || customers.length === 0 || products.length === 0 || hasRestoredRef.current) return
    hasRestoredRef.current = true

    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        if (state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          if (state.customerId && !selectedCustomer) {
            const customer = customers.find(c => c.id === state.customerId)
            if (customer) {
              setSelectedCustomer(customer)
              if (customer.pricelistId) {
                fetchPricelistItems(customer.pricelistId)
              }
            }
          }
          if (state.lines && state.lines.length > 0 && lines.length === 0) {
            setLines(state.lines as QuoteLine[])
          }
        }
      } catch (e) {
        console.error('Error restoring customer/lines:', e)
      }
    }
  }, [isRestoring, customers, products])

  useEffect(() => {
    saveToStorage()
  }, [saveToStorage])

  useEffect(() => {
    updateURL(currentStep, selectedCustomer?.id)
  }, [currentStep, selectedCustomer?.id, updateURL])

  const fetchAvailablePricelists = async () => {
    setLoadingPricelists(true)
    try {
      const response = await fetch('/api/market/pricelists')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAvailablePricelists(
            (result.data.pricelists || [])
              .filter((p: { isActive: boolean }) => p.isActive)
              .map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }))
          )
        }
      }
    } catch (error) {
      console.error('Error fetching pricelists:', error)
    } finally {
      setLoadingPricelists(false)
    }
  }

  const fetchCompanyUsers = async () => {
    setLoadingUsers(true)
    try {
      const response = await fetch('/api/users?limit=200')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const users = result.data?.users || result.data || []
          setCompanyUsers(users.map((u: { id: number; firstName?: string; lastName?: string; email: string }) => ({
            id: u.id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
            email: u.email
          })))
        }
      }
    } catch { /* ignore */ }
    finally { setLoadingUsers(false) }
  }

  useEffect(() => {
    fetchCustomers()
    fetchProducts()
    fetchExchangeRates()
    fetchWarehouses()
    fetchCompanyUsers()
  }, [])

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('/api/market/pos/exchange-rates')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.rates) {
          setExchangeRateBCC(result.rates.CUP || 411)
        }
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
    }
  }

  const fetchWarehouses = async () => {
    setLoadingWarehouses(true)
    try {
      const response = await fetch('/api/market/warehouses?isActive=true')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setWarehouses((result.data.warehouses || result.data || []).map((w: { id: number; name: string }) => ({
            id: w.id,
            name: w.name
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    } finally {
      setLoadingWarehouses(false)
    }
  }

  const fetchDeliveryEstimates = useCallback(async (whId: number, currentLines: QuoteLine[]) => {
    if (!whId || currentLines.length === 0) return
    setLoadingEstimates(true)
    try {
      const response = await fetch('/api/market/wholesale/quotes/delivery-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId: whId,
          items: currentLines.map(l => ({ productId: l.productId, quantity: l.quantity }))
        })
      })
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data?.estimates) {
          const newEstimates: Record<number, string> = {}
          for (const est of result.data.estimates) {
            newEstimates[est.productId] = est.estimatedDelivery
          }
          setDeliveryEstimates(newEstimates)
          // Update lines with delivery estimates
          setLines(prev => prev.map(l => ({
            ...l,
            estimatedDelivery: newEstimates[l.productId] || null
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching delivery estimates:', error)
    } finally {
      setLoadingEstimates(false)
    }
  }, [])

  // Debounced delivery estimate fetch when lines or warehouse change
  useEffect(() => {
    if (!selectedWarehouseId || lines.length === 0) return
    if (estimateTimeoutRef.current) clearTimeout(estimateTimeoutRef.current)
    estimateTimeoutRef.current = setTimeout(() => {
      fetchDeliveryEstimates(selectedWarehouseId, lines)
    }, 500)
    return () => {
      if (estimateTimeoutRef.current) clearTimeout(estimateTimeoutRef.current)
    }
  }, [selectedWarehouseId, lines.map(l => `${l.productId}:${l.quantity}`).join(','), fetchDeliveryEstimates])

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === parseInt(preselectedCustomerId))
      if (customer) {
        handleSelectCustomer(customer)
      }
    }
  }, [preselectedCustomerId, customers])

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

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const response = await fetch('/api/market/products?limit=500')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setProducts(result.data.products || result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
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

  const getPricelistPrice = (productId: number, basePrice: number, quantity: number = 1): { price: number; hasDiscount: boolean; discountInfo: string | null } => {
    const applicableItems = pricelistItems
      .filter(item => item.productId === productId && item.minQuantity <= quantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)

    if (applicableItems.length === 0) {
      return { price: basePrice, hasDiscount: false, discountInfo: null }
    }

    const item = applicableItems[0]

    if (item.priceType === 'fixed' && item.fixedPrice !== null) {
      const discount = ((basePrice - item.fixedPrice) / basePrice) * 100
      return {
        price: item.fixedPrice,
        hasDiscount: true,
        discountInfo: `Precio fijo (-${discount.toFixed(0)}%)`
      }
    } else if (item.priceType === 'discount_percent' && item.discountPercent !== null) {
      const discountedPrice = basePrice * (1 - item.discountPercent / 100)
      return {
        price: discountedPrice,
        hasDiscount: true,
        discountInfo: `${item.discountPercent}% descuento`
      }
    } else if (item.priceType === 'discount_amount' && item.discountAmount !== null) {
      const discountedPrice = Math.max(0, basePrice - item.discountAmount)
      return {
        price: discountedPrice,
        hasDiscount: true,
        discountInfo: `$${item.discountAmount} descuento`
      }
    }

    return { price: basePrice, hasDiscount: false, discountInfo: null }
  }

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setPricelistItems([])
    setLines([])
    if (customer.pricelistId) {
      fetchPricelistItems(customer.pricelistId)
    }
  }

  const handleCreateCustomer = async () => {
    if (!newCustomer.businessName.trim()) {
      setError('El nombre comercial es requerido')
      return
    }
    setCreatingCustomer(true)
    setError('')
    try {
      const response = await fetch('/api/market/wholesale/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: newCustomer.businessName.trim(),
          contactName: newCustomer.contactName.trim() || null,
          phone: newCustomer.phone.trim() || null,
          email: newCustomer.email.trim() || null,
          taxId: newCustomer.taxId.trim() || null,
          address: newCustomer.address.trim() || null,
          pricelistId: newCustomer.pricelistId ? parseInt(newCustomer.pricelistId) : null
        })
      })
      const result = await response.json()
      if (result.success) {
        // Refresh customer list and select the new one
        const refreshRes = await fetch('/api/market/wholesale/customers?status=active&limit=200')
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          if (refreshData.success) {
            setCustomers(refreshData.data.customers)
            const created = refreshData.data.customers.find((c: Customer) => c.id === result.data.id)
            if (created) handleSelectCustomer(created)
          }
        }
        setShowCreateCustomer(false)
        setNewCustomer({ businessName: '', contactName: '', phone: '', email: '', taxId: '', address: '', pricelistId: '' })
      } else {
        setError(result.error || 'Error al crear cliente')
      }
    } catch (err) {
      console.error('Error creating customer:', err)
      setError('Error de conexión al crear cliente')
    } finally {
      setCreatingCustomer(false)
    }
  }

  const addProduct = (product: Product) => {
    const existingIndex = lines.findIndex(l => l.productId === product.id)
    if (existingIndex >= 0) {
      updateLineQuantity(existingIndex, lines[existingIndex].quantity + 1)
      return
    }

    const { price: pricelistPrice, hasDiscount, discountInfo } = getPricelistPrice(
      product.id,
      product.sellingPrice,
      1
    )

    const unitPrice = hasDiscount ? pricelistPrice : product.sellingPrice
    const profitMargin = product.costPrice > 0
      ? ((unitPrice - product.costPrice) / product.costPrice) * 100
      : 0

    setLines([...lines, {
      productId: product.id,
      variantId: null,
      productName: product.name,
      productSku: product.sku || '',
      quantity: 1,
      unitPrice,
      unitPriceCup: Math.round(unitPrice * exchangeRateBCC),
      originalPrice: product.sellingPrice,
      subtotal: unitPrice,
      subtotalCup: Math.round(unitPrice * exchangeRateBCC),
      costPrice: product.costPrice,
      profitMargin,
      hasPricelistPrice: hasDiscount,
      pricelistDiscountInfo: discountInfo,
      estimatedDelivery: deliveryEstimates[product.id] || null
    }])
  }

  const updateLineQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return
    const newLines = [...lines]
    const line = newLines[index]

    // Recalculate pricelist price based on new quantity
    const { price: newPrice, hasDiscount, discountInfo } = getPricelistPrice(
      line.productId,
      line.originalPrice,
      quantity
    )

    line.quantity = quantity
    line.unitPrice = newPrice
    line.unitPriceCup = Math.round(newPrice * exchangeRateBCC)
    line.subtotal = quantity * newPrice
    line.subtotalCup = line.unitPriceCup * quantity
    line.hasPricelistPrice = hasDiscount
    line.pricelistDiscountInfo = discountInfo
    line.profitMargin = line.costPrice > 0
      ? ((newPrice - line.costPrice) / line.costPrice) * 100
      : 0

    setLines(newLines)
  }

  const updateLinePrice = (index: number, newPrice: number) => {
    if (newPrice < 0) return
    const newLines = [...lines]
    const line = newLines[index]
    line.unitPrice = newPrice
    line.unitPriceCup = Math.round(newPrice * exchangeRateBCC)
    line.subtotal = line.quantity * newPrice
    line.subtotalCup = line.unitPriceCup * line.quantity
    line.profitMargin = line.costPrice > 0
      ? ((newPrice - line.costPrice) / line.costPrice) * 100
      : 0
    setLines(newLines)
  }

  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
  const subtotalCupTotal = lines.reduce((sum, line) => sum + line.subtotalCup, 0)
  const globalDiscount = subtotal * discountPercent / 100
  const total = subtotal - globalDiscount
  const totalCup = Math.round(total * exchangeRateBCC)

  // Pure check — safe to call during render (no side effects)
  const isStepValid = (step: string): boolean => {
    switch (step) {
      case 'customer':
        return !!selectedCustomer
      case 'products':
        return lines.length > 0
      default:
        return true
    }
  }

  const nextStep = () => {
    setError('')
    if (!isStepValid(currentStep)) {
      if (currentStep === 'customer') setError('Debe seleccionar un cliente')
      if (currentStep === 'products') setError('Debe agregar al menos un producto')
      return
    }
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
    setError('')
  }

  const handleSubmit = async () => {
    if (!selectedCustomer) return
    setSaving(true)

    try {
      const response = await fetch('/api/market/wholesale/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          pricelistId: selectedCustomer.pricelistId,
          warehouseId: selectedWarehouseId || null,
          validUntil: validUntil || null,
          discountPercent,
          notes,
          internalNotes,
          salesRepId: selectedSalesRepId || null,
          lines: lines.map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            productName: l.productName,
            productSku: l.productSku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            originalPrice: l.originalPrice,
            estimatedDelivery: l.estimatedDelivery || null
          }))
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          clearStorage()
          router.push(`/dashboard/market/wholesale/quotes/${result.data.id}`)
        } else {
          setError(result.error || 'Error al crear cotización')
        }
      } else {
        setError('Error al crear cotización')
      }
    } catch (error) {
      console.error('Error creating quote:', error)
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    }).format(value)
  }

  const formatCUP = (value: number) => {
    const rounded = Math.round(value)
    return rounded.toLocaleString('en-US') + ' CUP'
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

  const DeliveryBadge = ({ estimate }: { estimate: string | null }) => {
    if (!estimate) return null
    const config: Record<string, { label: string; bg: string; text: string; darkBg: string; darkText: string }> = {
      '1-24h': { label: '1-24 h', bg: 'bg-green-100', text: 'text-green-700', darkBg: 'bg-green-900/30', darkText: 'text-green-400' },
      '1-3d': { label: '1-3 días', bg: 'bg-amber-100', text: 'text-amber-700', darkBg: 'bg-amber-900/30', darkText: 'text-amber-400' },
      '1-30d': { label: '1-30 días', bg: 'bg-red-100', text: 'text-red-700', darkBg: 'bg-red-900/30', darkText: 'text-red-400' }
    }
    const c = config[estimate]
    if (!c) return null
    return (
      <span className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
        theme === 'dark' ? `${c.darkBg} ${c.darkText}` : `${c.bg} ${c.text}`
      )}>
        {c.label}
      </span>
    )
  }

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
          <Link
            href="/dashboard/market/wholesale/quotes"
            className={cn(
              "inline-flex items-center gap-2 text-sm mb-2 transition-colors",
              theme === 'dark'
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a cotizaciones
          </Link>
          <h1 className={cn(
            "text-2xl sm:text-3xl lg:text-4xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Nueva Cotización
          </h1>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Crea una cotización para cliente mayorista
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
                        className="absolute inset-0 rounded-full bg-blue-500"
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
                          ? 'bg-blue-500 text-white'
                          : isActive
                            ? 'bg-blue-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-500'
                              : 'bg-gray-200 text-gray-500'
                      )}
                      animate={{
                        scale: isActive ? 1 : 0.9,
                        backgroundColor: isCompleted
                          ? '#3b82f6'
                          : isActive
                            ? '#2563eb'
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
                      ? 'text-blue-600'
                      : isCompleted
                        ? 'text-blue-600'
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
                      className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
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
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Seleccionar Cliente
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowCreateCustomer(true)
                      if (availablePricelists.length === 0) fetchAvailablePricelists()
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Cliente
                  </motion.button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, código o RUC/NIT..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className={cn(
                      "w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2 transition-all",
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                {loadingCustomers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {filteredCustomers.length === 0 && (
                      <div className="col-span-full text-center py-8">
                        <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 mb-1">
                          {customerSearch ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                        </p>
                        <button
                          onClick={() => {
                            setShowCreateCustomer(true)
                            if (availablePricelists.length === 0) fetchAvailablePricelists()
                            if (customerSearch) {
                              setNewCustomer(prev => ({ ...prev, businessName: customerSearch }))
                            }
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                        >
                          + Crear nuevo cliente
                        </button>
                      </div>
                    )}
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className={cn(
                          "p-4 border-2 rounded-xl cursor-pointer transition-all",
                          selectedCustomer?.id === customer.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg',
                            selectedCustomer?.id === customer.id
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600'
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
                            <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                        {customer.pricelistName && (
                          <div className="mt-3 flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{customer.pricelistName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Products */}
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
                        <Tag className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {loadingPricelist ? 'Cargando lista...' : `Lista: ${selectedCustomer.pricelistName}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                    theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                  )}>
                    <DollarSign className="w-4 h-4" />
                    Tasa: $1 = {exchangeRateBCC.toLocaleString()} CUP
                  </div>
                </div>

                {/* Product Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar producto por nombre, SKU o código de barras..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className={cn(
                      'w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                {/* Product Search Results */}
                {productSearch && (
                  <div className={cn(
                    'max-h-[200px] overflow-y-auto rounded-xl border',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
                  )}>
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
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
                              <p className="text-xs text-gray-500">{product.sku}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600">{formatCurrency(product.sellingPrice)}</p>
                            <button className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" /> Agregar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Quote Lines Table */}
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
                    <div className="col-span-2 text-right">Precio Unit.</div>
                    <div className="col-span-2 text-center">Cantidad</div>
                    <div className="col-span-3 text-right">Total</div>
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
                        <div
                          key={index}
                          className={cn(
                            'grid grid-cols-12 gap-2 p-3 items-center',
                            theme === 'dark' ? 'hover:bg-gray-900/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <div className="col-span-1 text-sm text-gray-500">{index + 1}</div>
                          <div className="col-span-3">
                            <div className="flex items-center gap-1.5">
                              <p className={cn(
                                'font-medium text-sm truncate',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{line.productName}</p>
                              <DeliveryBadge estimate={line.estimatedDelivery} />
                            </div>
                            <p className="text-xs text-gray-500">{line.productSku}</p>
                            {line.hasPricelistPrice && line.pricelistDiscountInfo && (
                              <span className="text-[10px] text-blue-500">{line.pricelistDiscountInfo}</span>
                            )}
                          </div>
                          <div className="col-span-2 text-right">
                            {line.hasPricelistPrice && (
                              <span className="text-xs text-gray-400 line-through block">
                                {formatCurrency(line.originalPrice)}
                              </span>
                            )}
                            <div className="relative inline-flex items-center">
                              <span className="absolute left-1.5 text-xs text-gray-400">$</span>
                              <input
                                type="number"
                                value={line.unitPrice}
                                onChange={(e) => updateLinePrice(index, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                step="any"
                                min="0"
                                className={cn(
                                  'w-24 text-right pl-4 pr-1.5 py-1 rounded-lg border text-sm font-medium text-blue-600',
                                  theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                                )}
                              />
                            </div>
                            <span className="text-[11px] text-gray-500 block">
                              {formatCUP(line.unitPriceCup)}
                            </span>
                          </div>
                          <div className="col-span-2 flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => updateLineQuantity(index, line.quantity - 1)}
                              disabled={line.quantity <= 1}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors disabled:opacity-30',
                                theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                              )}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLineQuantity(index, parseInt(e.target.value) || 1)}
                              className={cn(
                                'w-20 text-center px-2 py-1.5 rounded-lg border text-sm font-medium',
                                theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                              )}
                              min="1"
                            />
                            <button
                              onClick={() => updateLineQuantity(index, line.quantity + 1)}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                              )}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="font-bold text-blue-600 block">
                              {formatCurrency(line.subtotal)}
                            </span>
                            <span className="text-[11px] text-gray-500 block">
                              {formatCUP(line.subtotalCup)}
                            </span>
                          </div>
                          <div className="col-span-1 text-right">
                            <button
                              onClick={() => removeLine(index)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                        <div className="w-72 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal USD:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal CUP:</span>
                            <span className="font-medium text-gray-600 dark:text-gray-300">{formatCUP(subtotalCupTotal)}</span>
                          </div>
                          <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span>Total USD:</span>
                            <span className="text-blue-600">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-lg font-semibold">
                            <span className="text-gray-500">Total CUP:</span>
                            <span className={cn(
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>{formatCUP(subtotalCupTotal)}</span>
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
                  Condiciones de la Cotización
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Warehouse Selector */}
                  <div className={cn(
                    'md:col-span-2 p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <Warehouse className="w-4 h-4 text-blue-600" />
                      <label className="font-medium">Almacén de Despacho</label>
                      {loadingEstimates && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 ml-auto" />
                      )}
                    </div>
                    <select
                      value={selectedWarehouseId || ''}
                      onChange={(e) => setSelectedWarehouseId(e.target.value ? parseInt(e.target.value) : null)}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="">Seleccionar almacén...</option>
                      {loadingWarehouses ? (
                        <option disabled>Cargando...</option>
                      ) : (
                        warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      Selecciona un almacén para calcular tiempos de entrega estimados por producto.
                    </p>
                  </div>

                  {/* Sales Rep Selector */}
                  <div className={cn(
                    'md:col-span-2 p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-blue-600" />
                      <label className="font-medium">Comercial de Ventas</label>
                      {loadingUsers && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 ml-auto" />
                      )}
                    </div>
                    <select
                      value={selectedSalesRepId || ''}
                      onChange={(e) => setSelectedSalesRepId(e.target.value ? parseInt(e.target.value) : null)}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="">Seleccionar comercial...</option>
                      {companyUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      Comercial responsable de esta venta. Si no se selecciona, se asigna al usuario actual.
                    </p>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <Percent className="w-4 h-4 text-blue-600" />
                      <label className="font-medium">Descuento Global</label>
                    </div>
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
                            ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <label className="font-medium">Válida Hasta</label>
                    </div>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div className={cn(
                    'md:col-span-2 p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <label className="font-medium">Notas para el Cliente</label>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Condiciones, observaciones..."
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div className={cn(
                    'md:col-span-2 p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <label className="font-medium">Notas Internas</label>
                    </div>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={2}
                      placeholder="Notas internas (no visibles para el cliente)..."
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

            {/* Step 4: Review */}
            {currentStep === 'review' && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Revisar Cotización
                </h2>

                {/* Customer Summary */}
                <div className={cn(
                  'p-4 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                )}>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Cliente
                  </h3>
                  <p className={cn(
                    'font-medium',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{selectedCustomer?.businessName}</p>
                  <p className="text-sm text-gray-500">{selectedCustomer?.code}</p>
                </div>

                {/* Sales Rep Summary */}
                {selectedSalesRepId && (
                  <div className={cn(
                    'p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                  )}>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      Comercial de Ventas
                    </h3>
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {companyUsers.find(u => u.id === selectedSalesRepId)?.name || ''}
                    </p>
                    <p className="text-sm text-gray-500">
                      {companyUsers.find(u => u.id === selectedSalesRepId)?.email || ''}
                    </p>
                  </div>
                )}

                {/* Products Summary */}
                <div className={cn(
                  'p-4 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                )}>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" />
                    Productos ({lines.length})
                  </h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {lines.map((line, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{line.quantity}x {line.productName}</span>
                        <span className="font-medium">{formatCurrency(line.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className={cn(
                  'p-4 rounded-xl border',
                  theme === 'dark' ? 'border-blue-900/50 bg-blue-900/20' : 'border-blue-200 bg-blue-50'
                )}>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal USD:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal CUP:</span>
                      <span className={cn(
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      )}>{formatCUP(subtotalCupTotal)}</span>
                    </div>
                    {discountPercent > 0 && (
                      <div className="flex justify-between text-red-500">
                        <span>Descuento ({discountPercent}%):</span>
                        <span>-{formatCurrency(globalDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-bold pt-2 border-t border-blue-300 dark:border-blue-800">
                      <span>Total USD:</span>
                      <span className="text-blue-600">{formatCurrency(total)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold">
                      <span className="text-gray-500">Total CUP:</span>
                      <span className={cn(
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>{formatCUP(totalCup)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={prevStep}
            disabled={currentStepIndex === 0}
            className={cn(
              "px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all",
              currentStepIndex === 0
                ? 'opacity-50 cursor-not-allowed'
                : theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
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
              disabled={saving}
              className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white flex items-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Crear Cotización
                </>
              )}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={nextStep}
              className={cn(
                "px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all",
                'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25'
              )}
            >
              Siguiente
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Create Customer Modal */}
      <AnimatePresence>
        {showCreateCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowCreateCustomer(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-lg p-6 rounded-2xl shadow-2xl',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  'text-xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Nuevo Cliente Mayorista
                </h3>
                <button
                  onClick={() => setShowCreateCustomer(false)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    value={newCustomer.businessName}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, businessName: e.target.value }))}
                    placeholder="Ej: Distribuidora XYZ"
                    autoFocus
                    className={cn(
                      'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Contacto
                    </label>
                    <input
                      type="text"
                      value={newCustomer.contactName}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, contactName: e.target.value }))}
                      placeholder="Nombre del contacto"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      RUC/NIT
                    </label>
                    <input
                      type="text"
                      value={newCustomer.taxId}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, taxId: e.target.value }))}
                      placeholder="Identificación fiscal"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+53 5..."
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="correo@ejemplo.com"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Dirección del cliente"
                    className={cn(
                      'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Lista de Precios
                  </label>
                  <select
                    value={newCustomer.pricelistId}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, pricelistId: e.target.value }))}
                    className={cn(
                      'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  >
                    <option value="">Sin lista de precios</option>
                    {loadingPricelists ? (
                      <option disabled>Cargando...</option>
                    ) : (
                      availablePricelists.map(pl => (
                        <option key={pl.id} value={pl.id}>{pl.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateCustomer(false)}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateCustomer}
                  disabled={creatingCustomer || !newCustomer.businessName.trim()}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
                    creatingCustomer || !newCustomer.businessName.trim()
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700',
                    'text-white'
                  )}
                >
                  {creatingCustomer ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Crear Cliente
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-md p-6 rounded-2xl shadow-2xl',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <h3 className={cn(
                'text-xl font-bold mb-4',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                ¿Cancelar cotización?
              </h3>
              <p className="text-gray-500 mb-6">
                Se perderán todos los datos ingresados. ¿Estás seguro?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  )}
                >
                  Continuar editando
                </button>
                <button
                  onClick={() => {
                    clearStorage()
                    router.push('/dashboard/market/wholesale/quotes')
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  Sí, cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
