'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Package,
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
  Calendar,
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
  Truck,
  Printer,
  Banknote,
  Smartphone,
  Clock,
  Receipt,
  Eye,
  Percent,
  QrCode
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { PrintDocumentModal } from '@/components/print/PrintDocumentModal'
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
  unitPriceCup: number // Selling price in CUP (BCC rate)
  previousUnitPrice: number // For animation - track previous price
  costPrice: number
  originalPrice: number // Base selling price before any pricelist discounts
  subtotal: number
  subtotalCup: number // Subtotal in CUP
  warehouseQuantities: WarehouseQuantities
  warehouseStock: WarehouseStock[]
  profitMargin: number
  costPriceCup: number // Cost in CUP (ElToque rate)
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

interface QuoteSummary {
  id: number
  quoteNumber: string
  customerName: string
  customerId: number
  totalAmount: number
  status: string
  createdAt: string
  linesCount: number
  warehouseId?: number | null
}

const STEPS = [
  { id: 'type', title: 'Tipo', icon: FileText },
  { id: 'customer', title: 'Cliente', icon: Users },
  { id: 'products', title: 'Productos', icon: Package },
  { id: 'terms', title: 'Términos', icon: Calendar },
  { id: 'review', title: 'Revisión', icon: Eye },
  { id: 'payment', title: 'Pago', icon: CreditCard },
  { id: 'confirm', title: 'Confirmar', icon: Printer }
]

const STORAGE_KEY = 'wholesale_invoice_draft'

// Helper to serialize lines for storage (remove non-serializable data)
const serializeLines = (lines: InvoiceLine[]) => {
  return lines.map(line => ({
    productId: line.productId,
    variantId: line.variantId,
    productName: line.productName,
    productSku: line.productSku,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    unitPriceCup: line.unitPriceCup,
    costPrice: line.costPrice,
    originalPrice: line.originalPrice,
    subtotal: line.subtotal,
    subtotalCup: line.subtotalCup,
    warehouseQuantities: line.warehouseQuantities,
    warehouseStock: line.warehouseStock,
    profitMargin: line.profitMargin,
    costPriceCup: line.costPriceCup,
    hasPricelistPrice: line.hasPricelistPrice,
    pricelistDiscountInfo: line.pricelistDiscountInfo,
    currentTierMinQty: line.currentTierMinQty
  }))
}

export default function CreateInvoicePage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const preselectedCustomerId = searchParams.get('customerId')

  // Read initial step from URL
  const initialStep = searchParams.get('step') || 'type'
  const validSteps = STEPS.map(s => s.id)
  const [currentStep, setCurrentStep] = useState<string>(
    validSteps.includes(initialStep) ? initialStep : 'type'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false)

  // Step 0: Invoice Type
  const [invoiceType, setInvoiceType] = useState<'direct' | 'from_quote' | null>(null)
  const [availableQuotes, setAvailableQuotes] = useState<QuoteSummary[]>([])
  const [selectedQuote, setSelectedQuote] = useState<QuoteSummary | null>(null)
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [quoteSearch, setQuoteSearch] = useState('')
  const [fromQuoteId, setFromQuoteId] = useState<number | null>(null)
  const [fromQuoteWarehouseId, setFromQuoteWarehouseId] = useState<number | null>(null)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([])
  const [pricelists, setPricelists] = useState<Pricelist[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [exchangeRate, setExchangeRate] = useState(340) // ElToque rate for cost
  const [exchangeRateBCC, setExchangeRateBCC] = useState(411) // BCC rate for selling
  const [pricelistItems, setPricelistItems] = useState<PricelistItem[]>([])
  const [loadingPricelist, setLoadingPricelist] = useState(false)
  const [exchangeRateWholesale, setExchangeRateWholesale] = useState(411) // Same as system rate
  const [includeTax, setIncludeTax] = useState(true)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printDocType, setPrintDocType] = useState<string>('wholesale_invoice')
  const [printDocData, setPrintDocData] = useState<any>(null)
  const [printDocTitle, setPrintDocTitle] = useState('')
  const [printSourceId, setPrintSourceId] = useState<number>(0)

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Step 2: Products
  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [expandedLineIndex, setExpandedLineIndex] = useState<number | null>(null)

  // Step 3: Payment Terms
  const [paymentTerms, setPaymentTerms] = useState<'immediate' | '15' | '30' | '40' | 'custom'>('immediate')
  const [customDueDate, setCustomDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  // Downpayment (anticipo)
  const [requiresDownpayment, setRequiresDownpayment] = useState(false)
  const [downpaymentType, setDownpaymentType] = useState<'percentage' | 'fixed_amount'>('percentage')
  const [downpaymentValue, setDownpaymentValue] = useState<string>('30')

  // Step 4: Payment (multi-currency like POS)
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [paymentCurrency, setPaymentCurrency] = useState<string>('USD')
  const [amountTendered, setAmountTendered] = useState<string>('')
  const [paymentReference, setPaymentReference] = useState<string>('')

  interface WizardPaymentEntry {
    id: string; method: string; currency: string; amount: number; amountInUSD: number; reference?: string
  }
  const [wizardPayments, setWizardPayments] = useState<WizardPaymentEntry[]>([])

  const convertToUSD = (amt: number, cur: string) => {
    if (cur === 'CUP') return amt / exchangeRateWholesale
    if (cur === 'MLC') return amt / 1.2
    return amt
  }

  const wizardTotalPaidUSD = wizardPayments.reduce((s, p) => s + p.amountInUSD, 0)

  const addWizardPayment = () => {
    const num = parseFloat(amountTendered)
    if (isNaN(num) || num <= 0) return
    if (paymentMethod === 'transfer' && !paymentReference.trim()) return
    setWizardPayments(prev => [...prev, {
      id: Date.now().toString(),
      method: paymentMethod,
      currency: paymentCurrency,
      amount: num,
      amountInUSD: convertToUSD(num, paymentCurrency),
      reference: paymentMethod === 'transfer' ? paymentReference.toUpperCase() : undefined
    }])
    setAmountTendered('')
    setPaymentReference('')
  }

  const removeWizardPayment = (id: string) => setWizardPayments(prev => prev.filter(p => p.id !== id))

  // Step 5: Created invoice
  interface CreatedInvoice {
    id: number
    invoiceNumber: string
    customerName: string
    customerCode?: string
    total: number
    paymentStatus: string
    dueDate: string | null
    downpaymentAmount?: number
    createdAt?: string
  }
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null)

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
  const [isRestoring, setIsRestoring] = useState(true)

  // Update URL with current step and customer
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
      lines: serializeLines(lines),
      paymentTerms,
      customDueDate,
      notes,
      internalNotes,
      timestamp: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [selectedCustomer, lines, paymentTerms, customDueDate, notes, internalNotes, isRestoring])

  // Clear storage after successful save
  const clearStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Restore state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        // Check if saved state is less than 24 hours old
        if (state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          // Will restore customer after customers are loaded
          if (state.paymentTerms) setPaymentTerms(state.paymentTerms)
          if (state.customDueDate) setCustomDueDate(state.customDueDate)
          if (state.notes) setNotes(state.notes)
          if (state.internalNotes) setInternalNotes(state.internalNotes)
        } else {
          // Clear old saved state
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (e) {
        console.error('Error restoring saved state:', e)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setIsRestoring(false)
  }, [])

  // Restore customer and lines after data is loaded
  useEffect(() => {
    if (isRestoring || customers.length === 0 || products.length === 0) return

    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        if (state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          // Restore customer if not already set by URL
          if (state.customerId && !selectedCustomer) {
            const customer = customers.find(c => c.id === state.customerId)
            if (customer) {
              setSelectedCustomer(customer)
              if (customer.pricelistId) {
                fetchPricelistItems(customer.pricelistId)
              }
            }
          }
          // Restore lines with fresh warehouse stock data
          if (state.lines && state.lines.length > 0 && lines.length === 0) {
            const restoredLines = state.lines.map((savedLine: Partial<InvoiceLine>) => {
              const product = products.find(p => p.id === savedLine.productId)
              if (product) {
                return {
                  ...savedLine,
                  warehouseStock: product.warehouseStock || [],
                  previousUnitPrice: savedLine.unitPrice || 0,
                  priceJustChanged: false
                } as InvoiceLine
              }
              return null
            }).filter(Boolean) as InvoiceLine[]
            if (restoredLines.length > 0) {
              setLines(restoredLines)
            }
          }
        }
      } catch (e) {
        console.error('Error restoring customer/lines:', e)
      }
    }
  }, [isRestoring, customers, products, selectedCustomer, lines.length])

  // Save to storage when state changes
  useEffect(() => {
    saveToStorage()
  }, [saveToStorage])

  // Update URL when step changes
  useEffect(() => {
    updateURL(currentStep, selectedCustomer?.id)
  }, [currentStep, selectedCustomer?.id, updateURL])

  useEffect(() => {
    fetchCustomers()
    fetchWarehouses()
    fetchProductsWithStock()
    fetchPricelists()
    fetchExchangeRates()
  }, [])

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('/api/market/pos/exchange-rates')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.rates) {
          setExchangeRate(result.rates.CUP || 340)
          setExchangeRateBCC(result.rates.CUP || 411)
          setExchangeRateWholesale(result.rates.CUP || 411)
        }
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
    }
  }

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === parseInt(preselectedCustomerId))
      if (customer) {
        handleSelectCustomer(customer)
        // Auto-set to direct mode when customerId is in URL
        setInvoiceType('direct')
        if (currentStep === 'type') {
          setCurrentStep('customer')
        }
      }
    }
  }, [preselectedCustomerId, customers])

  // If URL has step=customer, auto-set to direct mode
  useEffect(() => {
    if (initialStep === 'customer' || initialStep === 'products') {
      setInvoiceType('direct')
    }
  }, [initialStep])

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

  // Fetch available quotes for "from quote" flow
  const fetchAvailableQuotes = async () => {
    setLoadingQuotes(true)
    try {
      const response = await fetch('/api/market/wholesale/quotes?status=draft,sent,accepted&notConverted=true&limit=100')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAvailableQuotes(result.data.quotes.map((q: {
            id: number
            quoteNumber: string
            customerName: string
            customerId: number
            totalAmount: number
            status: string
            createdAt: string
            linesCount: number
          }) => ({
            id: q.id,
            quoteNumber: q.quoteNumber,
            customerName: q.customerName,
            customerId: q.customerId,
            totalAmount: q.totalAmount,
            status: q.status,
            createdAt: q.createdAt,
            linesCount: q.linesCount
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching quotes:', error)
    } finally {
      setLoadingQuotes(false)
    }
  }

  // Handle selecting a quote — fetch full details and pre-populate invoice data
  const handleSelectQuoteForInvoice = async (quote: QuoteSummary) => {
    setSelectedQuote(quote)
    setError('')

    try {
      // Fetch full quote details
      const response = await fetch(`/api/market/wholesale/quotes/${quote.id}`)
      if (!response.ok) {
        setError('Error al cargar los datos de la cotización')
        return
      }
      const result = await response.json()
      if (!result.success) {
        setError(result.error || 'Error al cargar cotización')
        return
      }

      const quoteData = result.data

      // Find and set customer
      const customer = customers.find(c => c.id === quoteData.customerId)
      if (customer) {
        setSelectedCustomer(customer)
        if (customer.pricelistId) {
          await fetchPricelistItems(customer.pricelistId)
        }
      }

      // Store quote warehouse for invoice creation
      setFromQuoteId(quote.id)
      const quoteWarehouseId = quoteData.warehouseId
      setFromQuoteWarehouseId(quoteWarehouseId || null)

      // Map quote lines to invoice lines
      if (quoteData.lines && quoteData.lines.length > 0) {
        const invoiceLines: InvoiceLine[] = quoteData.lines.map((ql: {
          productId: number
          productName: string
          productSku: string
          quantity: number
          unitPrice: number
          originalPrice: number
          costPrice?: number
          subtotal: number
        }) => {
          const product = products.find(p => p.id === ql.productId)
          const costPrice = product?.costPrice || ql.costPrice || 0
          const unitPrice = ql.unitPrice
          const costPriceCup = costPrice * exchangeRate
          const profitMargin = costPrice > 0 ? ((unitPrice - costPrice) / costPrice) * 100 : 0

          // Assign full quantity to quote's warehouse
          const wq: Record<string, number> = {}
          if (quoteWarehouseId) wq[String(quoteWarehouseId)] = ql.quantity

          return {
            productId: ql.productId,
            variantId: null,
            productName: ql.productName,
            productSku: ql.productSku || '',
            quantity: ql.quantity,
            unitPrice,
            unitPriceCup: Math.round(unitPrice * exchangeRateWholesale),
            previousUnitPrice: unitPrice,
            costPrice,
            originalPrice: ql.originalPrice || unitPrice,
            subtotal: ql.subtotal || ql.quantity * unitPrice,
            subtotalCup: Math.round(unitPrice * exchangeRateWholesale) * ql.quantity,
            warehouseQuantities: wq,
            warehouseStock: product?.warehouseStock || [],
            profitMargin,
            costPriceCup,
            hasPricelistPrice: false,
            pricelistDiscountInfo: null,
            currentTierMinQty: 1,
            priceJustChanged: false
          }
        })
        setLines(invoiceLines)
      }

      // Set notes from quote
      if (quoteData.notes) {
        setNotes(`Desde cotización ${quoteData.quoteNumber}. ${quoteData.notes}`)
      } else {
        setNotes(`Desde cotización ${quoteData.quoteNumber}`)
      }

      // Set payment terms based on customer credit days
      if (customer && customer.creditDays > 0) {
        if (customer.creditDays === 15) setPaymentTerms('15')
        else if (customer.creditDays === 30) setPaymentTerms('30')
        else if (customer.creditDays === 40) setPaymentTerms('40')
        else {
          setPaymentTerms('custom')
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + customer.creditDays)
          setCustomDueDate(dueDate.toISOString().split('T')[0])
        }
      }

      // Save quote reference
      setFromQuoteId(quote.id)

      // Jump to review step
      setCurrentStep('review')
    } catch (error) {
      console.error('Error loading quote data:', error)
      setError('Error al cargar los datos de la cotización')
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
          ? `Desde ${item.minQuantity} uds: $${item.fixedPrice} (-${discount.toFixed(0)}%)`
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
      unitPriceCup: Math.round(unitPrice * exchangeRateWholesale), // Wholesale rate (ElToque + 15) for selling
      previousUnitPrice: unitPrice,
      costPrice: product.costPrice,
      originalPrice: product.sellingPrice, // Keep base price for reference
      subtotal: 0,
      subtotalCup: 0,
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
    line.unitPriceCup = Math.round(newPrice * exchangeRateWholesale) // Update CUP price with wholesale rate
    line.hasPricelistPrice = hasDiscount
    line.pricelistDiscountInfo = discountInfo
    line.currentTierMinQty = minQuantity

    // Recalculate profit margin with new price
    line.profitMargin = line.costPrice > 0
      ? ((newPrice - line.costPrice) / line.costPrice) * 100
      : 0

    // Recalculate subtotal with new price (no manual discounts)
    line.subtotal = line.quantity * line.unitPrice
    line.subtotalCup = line.unitPriceCup * line.quantity

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
  const subtotalCupTotal = lines.reduce((sum, line) => sum + line.subtotalCup, 0)
  const total = subtotal // No global discount in new flow
  const totalCup = subtotalCupTotal

  // Calculate due date based on payment terms
  const calculateDueDate = useCallback((terms: string, customDate?: string): string => {
    if (terms === 'immediate') return new Date().toISOString().split('T')[0]
    if (terms === 'custom' && customDate) return customDate

    const days = parseInt(terms) // 15, 30, or 40
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + days)
    return dueDate.toISOString().split('T')[0]
  }, [])

  // Format date in Spanish
  const formatDateSpanish = useCallback((dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }, [])

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
      case 'type':
        if (!invoiceType) {
          setError('Debe seleccionar un tipo de factura')
          return false
        }
        if (invoiceType === 'from_quote' && !selectedQuote) {
          setError('Debe seleccionar una cotización')
          return false
        }
        return true

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

      case 'terms':
        // If custom date selected, must have a date
        if (paymentTerms === 'custom' && !customDueDate) {
          setError('Debe seleccionar una fecha de vencimiento')
          return false
        }
        // Custom date must be >= today
        if (paymentTerms === 'custom' && customDueDate) {
          const today = new Date().toISOString().split('T')[0]
          if (customDueDate < today) {
            setError('La fecha de vencimiento debe ser igual o posterior a hoy')
            return false
          }
        }
        return true

      case 'payment':
        // For immediate payment with cash, validate amount
        if (paymentTerms === 'immediate' && paymentMethod === 'cash' && amountTendered) {
          if (parseFloat(amountTendered) < total) {
            setError('El monto recibido es menor al total')
            return false
          }
        }
        // For transfer, reference is optional but recommended
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
    // If on review step and came from a quote, go back to type selection
    if (currentStep === 'review' && invoiceType === 'from_quote') {
      setCurrentStep('type')
      setError('')
      return
    }
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
      const effectiveDueDate = calculateDueDate(paymentTerms, customDueDate)
      const isImmediatePayment = paymentTerms === 'immediate'
      const hasDownpayment = !isImmediatePayment && requiresDownpayment
      const needsPayment = isImmediatePayment || hasDownpayment

      // Calculate downpayment amount
      let downpaymentAmount = 0
      if (hasDownpayment) {
        if (downpaymentType === 'percentage') {
          downpaymentAmount = (total * parseFloat(downpaymentValue || '0')) / 100
        } else {
          downpaymentAmount = parseFloat(downpaymentValue || '0')
        }
      }

      // Amount to pay now: full amount for immediate, downpayment for credit with anticipo
      const amountToPay = isImmediatePayment ? total : downpaymentAmount

      const response = await fetch('/api/market/wholesale/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          warehouseId: fromQuoteWarehouseId || null, // From quote warehouse or multi-warehouse mode
          pricelistId: selectedCustomer.pricelistId,
          dueDate: effectiveDueDate,
          discountPercent: 0, // No global discount in new flow
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
            warehouseQuantities: l.warehouseQuantities
          })),
          // Downpayment fields
          downpaymentType: hasDownpayment ? downpaymentType : null,
          downpaymentValue: hasDownpayment ? parseFloat(downpaymentValue || '0') : null,
          wholesaleExchangeRate: exchangeRateWholesale,
          // Quote reference if created from a quote
          fromQuoteId: fromQuoteId || null,
          // Payment data - multi-currency support
          payment: needsPayment && wizardPayments.length > 0 ? {
            method: wizardPayments[0].method,
            currency: wizardPayments[0].currency,
            amount: wizardTotalPaidUSD,
            amountTendered: wizardTotalPaidUSD,
            reference: wizardPayments[0].reference || null,
            // Include all payments for the API to process
            entries: wizardPayments.map(p => ({
              method: p.method,
              currency: p.currency,
              amount: p.amountInUSD,
              originalAmount: p.amount,
              reference: p.reference || null
            }))
          } : needsPayment ? {
            method: paymentMethod,
            currency: paymentCurrency,
            amount: amountToPay,
            amountTendered: amountToPay,
            reference: paymentReference || null
          } : null
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          clearStorage() // Clear saved draft on success

          // Auto-confirm: creates delivery + deducts stock in one transaction
          try {
            const confirmRes = await fetch(`/api/market/wholesale/invoices/${result.data.id}/confirm`, {
              method: 'POST'
            })
            const confirmResult = await confirmRes.json()
            if (!confirmResult.success) {
              console.warn('[Invoice Create] Auto-confirm warning:', confirmResult.error)
            }
          } catch (confirmError) {
            console.error('[Invoice Create] Auto-confirm failed:', confirmError)
          }

          // Determine payment status
          const paymentStatus = isImmediatePayment
            ? 'paid'
            : hasDownpayment
              ? 'partial'
              : 'pending'
          // Set created invoice data for confirm step
          setCreatedInvoice({
            id: result.data.id,
            invoiceNumber: result.data.invoiceNumber,
            customerName: selectedCustomer.businessName,
            total: total,
            paymentStatus,
            dueDate: isImmediatePayment ? null : effectiveDueDate,
            downpaymentAmount: hasDownpayment ? downpaymentAmount : 0
          })
          // Move to confirm step
          setCurrentStep('confirm')
        } else {
          setError(result.error || 'Error al crear factura')
        }
      } else {
        setError('Error al crear factura')
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
            {/* Step 0: Invoice Type */}
            {currentStep === 'type' && (
              <motion.div
                key="step-type"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Tipo de Factura
                  </h2>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}>
                    Selecciona cómo deseas crear la factura
                  </p>
                </div>

                {/* Type Selection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {/* Direct Invoice */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setInvoiceType('direct')
                      setSelectedQuote(null)
                      setFromQuoteId(null)
                      setError('')
                    }}
                    className={cn(
                      "p-6 border-2 rounded-2xl cursor-pointer transition-all text-center",
                      invoiceType === 'direct'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : theme === 'dark'
                          ? 'border-gray-700 hover:border-gray-500'
                          : 'border-gray-200 hover:border-gray-400'
                    )}
                  >
                    <div className={cn(
                      'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                      invoiceType === 'direct'
                        ? 'bg-green-100 dark:bg-green-800/50'
                        : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <FileText className={cn(
                        'w-8 h-8',
                        invoiceType === 'direct' ? 'text-green-600' : 'text-gray-400'
                      )} />
                    </div>
                    <h3 className={cn(
                      'font-bold text-lg mb-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Factura Directa
                    </h3>
                    <p className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Crear una factura manual sin cotización previa
                    </p>
                    {invoiceType === 'direct' && (
                      <div className="mt-3">
                        <CheckCircle className="w-6 h-6 text-green-500 mx-auto" />
                      </div>
                    )}
                  </motion.div>

                  {/* From Quote */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setInvoiceType('from_quote')
                      setError('')
                      if (availableQuotes.length === 0) {
                        fetchAvailableQuotes()
                      }
                    }}
                    className={cn(
                      "p-6 border-2 rounded-2xl cursor-pointer transition-all text-center",
                      invoiceType === 'from_quote'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : theme === 'dark'
                          ? 'border-gray-700 hover:border-gray-500'
                          : 'border-gray-200 hover:border-gray-400'
                    )}
                  >
                    <div className={cn(
                      'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                      invoiceType === 'from_quote'
                        ? 'bg-blue-100 dark:bg-blue-800/50'
                        : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      <Receipt className={cn(
                        'w-8 h-8',
                        invoiceType === 'from_quote' ? 'text-blue-600' : 'text-gray-400'
                      )} />
                    </div>
                    <h3 className={cn(
                      'font-bold text-lg mb-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Desde Cotización
                    </h3>
                    <p className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Crear factura a partir de una cotización existente
                    </p>
                    {invoiceType === 'from_quote' && (
                      <div className="mt-3">
                        <CheckCircle className="w-6 h-6 text-blue-500 mx-auto" />
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Quote Selection (shown when "from_quote" is selected) */}
                {invoiceType === 'from_quote' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 mt-6"
                  >
                    <h3 className={cn(
                      'font-semibold text-lg',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Seleccionar Cotización
                    </h3>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por número o cliente..."
                        value={quoteSearch}
                        onChange={(e) => setQuoteSearch(e.target.value)}
                        className={cn(
                          "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all",
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>

                    {loadingQuotes ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      </div>
                    ) : availableQuotes.length === 0 ? (
                      <div className="text-center py-8">
                        <Receipt className={cn('w-12 h-12 mx-auto mb-3', theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          No hay cotizaciones disponibles para convertir
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                        {availableQuotes
                          .filter(q =>
                            q.quoteNumber.toLowerCase().includes(quoteSearch.toLowerCase()) ||
                            q.customerName.toLowerCase().includes(quoteSearch.toLowerCase())
                          )
                          .map(quote => {
                            const statusLabels: Record<string, { label: string, color: string }> = {
                              draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
                              sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
                              accepted: { label: 'Aceptada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }
                            }
                            const statusInfo = statusLabels[quote.status] || statusLabels.draft

                            return (
                              <motion.div
                                key={quote.id}
                                whileHover={{ scale: 1.01 }}
                                onClick={() => handleSelectQuoteForInvoice(quote)}
                                className={cn(
                                  "p-4 border-2 rounded-xl cursor-pointer transition-all",
                                  selectedQuote?.id === quote.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : theme === 'dark'
                                      ? 'border-gray-700 hover:border-gray-500'
                                      : 'border-gray-200 hover:border-gray-300'
                                )}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className={cn(
                                    'font-bold text-sm',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {quote.quoteNumber}
                                  </span>
                                  <span className={cn(
                                    'text-xs px-2 py-0.5 rounded-full font-medium',
                                    statusInfo.color
                                  )}>
                                    {statusInfo.label}
                                  </span>
                                </div>
                                <p className={cn(
                                  'text-sm mb-1',
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  {quote.customerName}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className={cn(
                                    'text-xs',
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )}>
                                    {quote.linesCount} producto{quote.linesCount !== 1 ? 's' : ''} &middot; {new Date(quote.createdAt).toLocaleDateString('es-ES')}
                                  </span>
                                  <span className={cn(
                                    'font-bold text-sm',
                                    theme === 'dark' ? 'text-green-400' : 'text-green-600'
                                  )}>
                                    ${quote.totalAmount.toFixed(2)}
                                  </span>
                                </div>
                                {selectedQuote?.id === quote.id && (
                                  <div className="mt-2 flex items-center gap-1 text-blue-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-xs font-medium">Seleccionada</span>
                                  </div>
                                )}
                              </motion.div>
                            )
                          })}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}

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
                    theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-700'
                  )}>
                    <DollarSign className="w-4 h-4" />
                    Tasa Mayoreo: $1 = {exchangeRateWholesale.toLocaleString()} CUP
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
                    <div className="col-span-2 text-right">Precio USD</div>
                    <div className="col-span-2 text-right">Precio CUP</div>
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
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-gray-400">Costo: {formatCurrency(line.costPrice)}</span>
                                <span className={cn(
                                  'text-[10px] px-1 py-0.5 rounded',
                                  line.profitMargin >= 20
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                                    : line.profitMargin >= 10
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                                )}>
                                  {line.profitMargin.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <div className="col-span-2 text-right">
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
                            <div className="col-span-2 text-right">
                              <motion.span
                                key={`cup-${line.productId}-${line.unitPriceCup}`}
                                initial={line.priceJustChanged ? { scale: 1.2 } : false}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.3, type: 'spring' }}
                                className={cn(
                                  'text-sm font-medium block',
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}
                              >
                                {formatCUP(line.unitPriceCup)}
                              </motion.span>
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
                                className="font-bold text-green-600 block"
                              >
                                {formatCurrency(line.subtotal)}
                              </motion.span>
                              <span className="text-xs text-gray-500">
                                {formatCUP(line.subtotalCup)}
                              </span>
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
                        <div className="w-72 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal USD:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Subtotal CUP:</span>
                            <span className="font-medium text-gray-600 dark:text-gray-300">{formatCUP(subtotalCupTotal)}</span>
                          </div>
                          <div className="flex justify-between font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span>Total USD:</span>
                            <span className="text-green-600">{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Total CUP:</span>
                            <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{formatCUP(totalCup)}</span>
                          </div>
                          {includeTax && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Impuesto (10%):</span>
                              <span className={cn(theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                {formatCurrency(total * 0.10)} / {formatCUP(Math.round(totalCup * 0.10))}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span>Total General:</span>
                            <span className="text-green-600">{formatCurrency(includeTax ? total * 1.10 : total)}</span>
                          </div>
                          <div className="flex justify-between text-lg font-semibold">
                            <span className="text-gray-500">Total General CUP:</span>
                            <span className={cn(
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>{formatCUP(includeTax ? totalCup + Math.round(totalCup * 0.10) : totalCup)}</span>
                          </div>
                          {/* Tax checkbox */}
                          <div className="pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={includeTax} onChange={e => setIncludeTax(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                              <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                Incluir Impuesto (10%)
                              </span>
                            </label>
                          </div>
                          <div className="text-xs text-center text-gray-400 mt-1">
                            Tasa mayoreo: {exchangeRateWholesale} CUP/USD
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Payment Terms */}
            {currentStep === 'terms' && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Términos de Pago
                </h2>

                <div className="space-y-6">
                  {/* Payment Terms Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      <Clock className="w-4 h-4 inline mr-2" />
                      Términos de Pago
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { id: 'immediate', label: 'Inmediato' },
                        { id: '15', label: '15 días' },
                        { id: '30', label: '30 días' },
                        { id: '40', label: '40 días' }
                      ].map(term => (
                        <button
                          key={term.id}
                          onClick={() => setPaymentTerms(term.id as typeof paymentTerms)}
                          className={cn(
                            'py-3 px-4 rounded-xl font-medium transition-all border-2',
                            paymentTerms === term.id
                              ? 'bg-green-500 text-white border-green-500'
                              : theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-green-500/50'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-green-500/50'
                          )}
                        >
                          {term.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom date option */}
                    <div className="mt-3">
                      <button
                        onClick={() => setPaymentTerms('custom')}
                        className={cn(
                          'w-full py-3 px-4 rounded-xl font-medium transition-all border-2 flex items-center justify-between',
                          paymentTerms === 'custom'
                            ? 'bg-green-500 text-white border-green-500'
                            : theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-green-500/50'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-green-500/50'
                        )}
                      >
                        <span>Fecha específica</span>
                        {paymentTerms === 'custom' && (
                          <input
                            type="date"
                            value={customDueDate}
                            onChange={(e) => setCustomDueDate(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            min={new Date().toISOString().split('T')[0]}
                            className={cn(
                              'px-3 py-1 rounded-lg bg-white/20 border-0 focus:outline-none focus:ring-2 focus:ring-white/50',
                              'text-white'
                            )}
                          />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Creation Date (read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Fecha de Creación
                    </label>
                    <div className={cn(
                      'px-4 py-3 rounded-xl border flex items-center gap-3',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-gray-300'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    )}>
                      <Calendar className="w-5 h-5 text-green-500" />
                      <span className="font-medium">
                        {formatDateSpanish(new Date().toISOString().split('T')[0])}
                      </span>
                    </div>
                  </div>

                  {/* Due Date Preview (when not immediate) */}
                  {paymentTerms !== 'immediate' && (
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark'
                        ? 'bg-blue-900/20 border-blue-800'
                        : 'bg-blue-50 border-blue-200'
                    )}>
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <Clock className="w-5 h-5" />
                        <span className="font-medium">Fecha de Vencimiento:</span>
                        <span className="font-bold">
                          {paymentTerms === 'custom' && customDueDate
                            ? formatDateSpanish(customDueDate)
                            : formatDateSpanish(calculateDueDate(paymentTerms))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Downpayment Section (only for credit terms) */}
                  {paymentTerms !== 'immediate' && (
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requiresDownpayment}
                          onChange={(e) => setRequiresDownpayment(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Requiere anticipo (downpayment)
                        </span>
                      </label>

                      {requiresDownpayment && (
                        <div className={cn(
                          'p-4 rounded-xl border space-y-4',
                          theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}>
                          {/* Downpayment Type */}
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => setDownpaymentType('percentage')}
                              className={cn(
                                'py-3 px-4 rounded-xl font-medium transition-all border-2 flex items-center justify-center gap-2',
                                downpaymentType === 'percentage'
                                  ? 'bg-green-500 text-white border-green-500'
                                  : theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-green-500/50'
                                    : 'bg-white border-gray-200 text-gray-700 hover:border-green-500/50'
                              )}
                            >
                              <Percent className="w-4 h-4" />
                              Porcentaje
                            </button>
                            <button
                              onClick={() => setDownpaymentType('fixed_amount')}
                              className={cn(
                                'py-3 px-4 rounded-xl font-medium transition-all border-2 flex items-center justify-center gap-2',
                                downpaymentType === 'fixed_amount'
                                  ? 'bg-green-500 text-white border-green-500'
                                  : theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-green-500/50'
                                    : 'bg-white border-gray-200 text-gray-700 hover:border-green-500/50'
                              )}
                            >
                              <DollarSign className="w-4 h-4" />
                              Monto Fijo
                            </button>
                          </div>

                          {/* Downpayment Value */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {downpaymentType === 'percentage' ? 'Porcentaje del anticipo' : 'Monto del anticipo (USD)'}
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                max={downpaymentType === 'percentage' ? 99 : total}
                                step={downpaymentType === 'percentage' ? 1 : 0.01}
                                value={downpaymentValue}
                                onChange={(e) => setDownpaymentValue(e.target.value)}
                                className={cn(
                                  'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                                  theme === 'dark'
                                    ? 'bg-gray-800 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                                    : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                                )}
                              />
                              <span className={cn(
                                'absolute right-4 top-1/2 -translate-y-1/2 text-sm',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                {downpaymentType === 'percentage' ? '%' : 'USD'}
                              </span>
                            </div>
                          </div>

                          {/* Quick percentages (only for percentage type) */}
                          {downpaymentType === 'percentage' && (
                            <div className="flex gap-2">
                              {[25, 30, 50].map(pct => (
                                <button
                                  key={pct}
                                  onClick={() => setDownpaymentValue(pct.toString())}
                                  className={cn(
                                    'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                                    downpaymentValue === pct.toString()
                                      ? 'bg-green-500 text-white'
                                      : theme === 'dark'
                                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  )}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Payment Summary */}
                          <div className={cn(
                            'p-4 rounded-lg',
                            theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                          )}>
                            <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Resumen de Pago:</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Total de factura:</span>
                                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(total)}</span>
                              </div>
                              <div className="flex justify-between text-green-600">
                                <span>
                                  Anticipo ({downpaymentType === 'percentage' ? `${downpaymentValue}%` : 'fijo'}):
                                </span>
                                <span className="font-bold">
                                  {formatCurrency(
                                    downpaymentType === 'percentage'
                                      ? (total * parseFloat(downpaymentValue || '0')) / 100
                                      : parseFloat(downpaymentValue || '0')
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-green-200 dark:border-green-800">
                                <span className="text-gray-600 dark:text-gray-400">Restante (a {paymentTerms === 'custom' ? 'fecha' : `${paymentTerms} días`}):</span>
                                <span className="font-medium text-amber-600">
                                  {formatCurrency(
                                    total - (downpaymentType === 'percentage'
                                      ? (total * parseFloat(downpaymentValue || '0')) / 100
                                      : parseFloat(downpaymentValue || '0'))
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes for client */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Notas para el Cliente
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Notas visibles para el cliente..."
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                      )}
                    />
                  </div>

                  {/* Internal notes */}
                  <div>
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

            {/* Step 4: Review */}
            {currentStep === 'review' && (
              <motion.div
                key="step4-review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Revisión de Factura
                </h2>

                {/* Invoice Preview */}
                <div className={cn(
                  'rounded-xl border-2 overflow-hidden',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                )}>
                  {/* Invoice Header */}
                  <div className={cn(
                    'p-6 border-b',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
                  )}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-2xl font-bold text-green-600">FACTURA PROFORMA</p>
                        <p className={cn(
                          'text-sm mt-1',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          Vencimiento: {paymentTerms === 'immediate'
                            ? 'Inmediato'
                            : formatDateSpanish(calculateDueDate(paymentTerms, customDueDate))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <p className={cn(
                      'text-sm uppercase tracking-wider mb-2',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Cliente
                    </p>
                    <p className={cn(
                      'text-lg font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {selectedCustomer?.businessName}
                    </p>
                    {selectedCustomer?.taxId && (
                      <p className="text-sm text-gray-500">RUC: {selectedCustomer.taxId}</p>
                    )}
                    {selectedCustomer?.address && (
                      <p className="text-sm text-gray-500">{selectedCustomer.address}</p>
                    )}
                  </div>

                  {/* Products Table */}
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <table className="w-full">
                      <thead>
                        <tr className={cn(
                          'text-sm border-b',
                          theme === 'dark' ? 'text-gray-400 border-gray-700' : 'text-gray-500 border-gray-200'
                        )}>
                          <th className="text-left py-2">Producto</th>
                          <th className="text-center py-2">Cant.</th>
                          <th className="text-right py-2">P.Unit USD</th>
                          <th className="text-right py-2">P.Unit CUP</th>
                          <th className="text-right py-2">Subtotal USD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.filter(l => l.quantity > 0).map((line, idx) => (
                          <tr key={idx} className={cn(
                            'border-b text-sm',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
                          )}>
                            <td className="py-3">
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{line.productName}</p>
                              <p className="text-xs text-gray-500">{line.productSku}</p>
                            </td>
                            <td className="text-center py-3">{line.quantity}</td>
                            <td className="text-right py-3">{formatCurrency(line.unitPrice)}</td>
                            <td className="text-right py-3 text-gray-500">{formatCUP(line.unitPriceCup)}</td>
                            <td className="text-right py-3 font-medium text-green-600">{formatCurrency(line.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="p-6">
                    <div className="flex justify-end">
                      <div className="w-72 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Subtotal:</span>
                          <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {formatCurrency(total)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>En CUP:</span>
                          <span>{formatCUP(totalCup)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 pt-1">
                          <span>Tasa mayoreo:</span>
                          <span>$1 = {exchangeRateWholesale} CUP</span>
                        </div>
                        <div className={cn(
                          'flex justify-between text-xl font-bold pt-3 mt-2 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <span>TOTAL:</span>
                          <span className="text-green-600">{formatCurrency(total)}</span>
                        </div>

                        {/* Downpayment Summary in Review */}
                        {requiresDownpayment && paymentTerms !== 'immediate' && (
                          <div className={cn(
                            'mt-4 p-3 rounded-lg text-sm',
                            theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50'
                          )}>
                            <p className="font-medium text-amber-700 dark:text-amber-300 mb-2">Términos de Pago:</p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                <span>Anticipo ({downpaymentType === 'percentage' ? `${downpaymentValue}%` : 'fijo'}):</span>
                                <span className="font-bold">
                                  {formatCurrency(
                                    downpaymentType === 'percentage'
                                      ? (total * parseFloat(downpaymentValue || '0')) / 100
                                      : parseFloat(downpaymentValue || '0')
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                <span>Plazo: {paymentTerms === 'custom' ? formatDateSpanish(customDueDate) : `${paymentTerms} días`}</span>
                                <span>
                                  {formatCurrency(
                                    total - (downpaymentType === 'percentage'
                                      ? (total * parseFloat(downpaymentValue || '0')) / 100
                                      : parseFloat(downpaymentValue || '0'))
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deliveries Preview */}
                {deliveriesPreview.length > 0 && (
                  <div className={cn(
                    'rounded-xl p-4',
                    theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                  )}>
                    <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                      <Warehouse className="w-5 h-5" />
                      Entregas a generar ({deliveriesPreview.length} tickets)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {deliveriesPreview.map((delivery) => (
                        <div
                          key={delivery.warehouseId}
                          className={cn(
                            'p-3 rounded-lg flex items-center justify-between',
                            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-sm text-gray-900 dark:text-white">
                              {delivery.warehouseName}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {delivery.products.length} productos ({delivery.products.reduce((sum, p) => sum + p.quantity, 0)} uds)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes Preview */}
                {(notes || internalNotes) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {notes && (
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                      )}>
                        <p className="text-sm font-medium text-gray-500 mb-1">Notas para el cliente:</p>
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{notes}</p>
                      </div>
                    )}
                    {internalNotes && (
                      <div className={cn(
                        'p-4 rounded-xl border border-dashed',
                        theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-300'
                      )}>
                        <p className="text-sm font-medium text-gray-400 mb-1">Notas internas:</p>
                        <p className="text-sm text-gray-500">{internalNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 5: Payment */}
            {currentStep === 'payment' && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Determine what amount to pay */}
                {(() => {
                  const showPaymentScreen = paymentTerms === 'immediate' || requiresDownpayment
                  const amountToPay = paymentTerms === 'immediate'
                    ? total
                    : (downpaymentType === 'percentage'
                        ? (total * parseFloat(downpaymentValue || '0')) / 100
                        : parseFloat(downpaymentValue || '0'))
                  const paymentLabel = paymentTerms === 'immediate'
                    ? 'Total a Pagar'
                    : `Anticipo (${downpaymentType === 'percentage' ? downpaymentValue + '%' : formatCurrency(parseFloat(downpaymentValue || '0'))})`

                  if (!showPaymentScreen) {
                    // Credit without downpayment - just show summary
                    return (
                      <>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          Resumen de Factura a Crédito
                        </h2>

                        <div className={cn(
                          'rounded-xl p-6',
                          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                        )}>
                          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-xl">
                              {selectedCustomer?.businessName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-lg text-gray-900 dark:text-white">
                                {selectedCustomer?.businessName}
                              </p>
                              <p className="text-sm text-gray-500">{selectedCustomer?.code}</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Productos</span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {lines.filter(l => l.quantity > 0).length} items
                              </span>
                            </div>
                            <div className="flex justify-between text-xl font-bold">
                              <span>Total</span>
                              <span className="text-green-600">{formatCurrency(total)}</span>
                            </div>

                            <div className={cn(
                              'mt-4 p-4 rounded-xl flex items-center gap-3',
                              theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                            )}>
                              <Clock className="w-6 h-6 text-blue-500" />
                              <div>
                                <p className="font-medium text-blue-700 dark:text-blue-300">
                                  Términos: {paymentTerms === 'custom' ? 'Fecha específica' : `${paymentTerms} días`}
                                </p>
                                <p className="text-sm text-blue-600 dark:text-blue-400">
                                  Vencimiento: {formatDateSpanish(calculateDueDate(paymentTerms, customDueDate))}
                                </p>
                              </div>
                            </div>

                            <div className={cn(
                              'p-4 rounded-xl flex items-start gap-3',
                              theme === 'dark' ? 'bg-yellow-900/20' : 'bg-yellow-50'
                            )}>
                              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                Esta factura quedará en estado <strong>Pendiente de Pago</strong>.
                                El cliente podrá pagar posteriormente.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Deliveries Preview */}
                        <div className={cn(
                          'rounded-xl p-4',
                          theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                        )}>
                          <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                            <Truck className="w-5 h-5" />
                            Entregas a generar ({deliveriesPreview.length})
                          </h3>
                          <div className="space-y-2">
                            {deliveriesPreview.map((delivery) => (
                              <div
                                key={delivery.warehouseId}
                                className={cn(
                                  'p-3 rounded-lg flex items-center justify-between',
                                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Warehouse className="w-4 h-4 text-blue-500" />
                                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                                    {delivery.warehouseName}
                                  </span>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {delivery.products.reduce((sum, p) => sum + p.quantity, 0)} productos
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )
                  }

                  // Show payment screen (immediate or downpayment)
                  return (
                    <>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {paymentTerms === 'immediate' ? 'Pago de Factura' : 'Pago del Anticipo'}
                      </h2>

                      {/* Amount to Pay */}
                      <div className={cn(
                        'rounded-xl p-6 text-center',
                        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                      )}>
                        <p className="text-sm text-gray-500 mb-1">{paymentLabel}</p>
                        <p className="text-4xl font-bold text-green-600">{formatCurrency(amountToPay)}</p>
                        <p className="text-lg text-gray-500 mt-1">
                          {formatCUP(Math.round(amountToPay * exchangeRateWholesale))} <span className="text-xs">(Tasa Mayoreo: {exchangeRateWholesale})</span>
                        </p>

                        {paymentTerms !== 'immediate' && (
                          <div className={cn(
                            'mt-4 pt-4 border-t text-sm',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                          )}>
                            <p className="text-gray-500">
                              Restante: <span className="font-medium text-amber-600">{formatCurrency(total - amountToPay)}</span>
                              <span className="text-gray-400"> (vence {formatDateSpanish(calculateDueDate(paymentTerms, customDueDate))})</span>
                            </p>
                          </div>
                        )}
                      </div>

                    {/* Remaining amount */}
                    {(() => {
                      const remaining = amountToPay - wizardTotalPaidUSD
                      const remainingCUP = Math.round(remaining * exchangeRateWholesale)
                      const fullyPaid = remaining <= 0.01
                      return (
                        <div className={cn('p-4 rounded-xl text-center', fullyPaid ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20')}>
                          <p className="text-xs text-gray-500 mb-1">{fullyPaid ? 'Pagado completo' : 'Restante por pagar'}</p>
                          <p className={cn('text-2xl font-bold', fullyPaid ? 'text-green-600' : 'text-amber-600')}>
                            {fullyPaid ? 'Completo' : `$${Math.max(0, remaining).toFixed(2)} USD`}
                          </p>
                          {!fullyPaid && remainingCUP > 0 && <p className="text-sm text-gray-500">{remainingCUP.toLocaleString('es-ES')} CUP</p>}
                        </div>
                      )
                    })()}

                    {/* Currency */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Moneda</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['USD', 'CUP', 'MLC'] as const).map(c => (
                          <button key={c} onClick={() => setPaymentCurrency(c)}
                            className={cn('py-2.5 rounded-xl text-sm font-bold transition-all border-2',
                              paymentCurrency === c ? 'bg-green-500 text-white border-green-500'
                                : theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-600')}>
                            {c} {c === 'CUP' ? `(${Math.round(exchangeRate)})` : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Method */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Método</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[{ id: 'cash', label: 'Efectivo' }, { id: 'transfer', label: 'Transfer.' }, { id: 'card', label: 'Tarjeta' }].map(m => (
                          <button key={m.id} onClick={() => setPaymentMethod(m.id)}
                            className={cn('py-2.5 rounded-xl text-sm font-medium transition-all border-2',
                              paymentMethod === m.id ? 'bg-blue-500 text-white border-blue-500'
                                : theme === 'dark' ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-600')}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount + Add */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Monto en {paymentCurrency}</label>
                      <div className="flex gap-2">
                        <input type="number" step="0.01" value={amountTendered}
                          onChange={(e) => setAmountTendered(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addWizardPayment()}
                          placeholder="Monto"
                          className={cn('flex-1 px-4 py-3 rounded-xl border text-lg font-bold focus:outline-none focus:ring-2',
                            theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white focus:ring-green-500/20' : 'bg-white border-gray-200 text-gray-900 focus:ring-green-500/20')} />
                        <button onClick={addWizardPayment}
                          disabled={!amountTendered || parseFloat(amountTendered) <= 0}
                          className="px-4 py-3 bg-green-500 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-green-600 transition-colors">
                          +
                        </button>
                      </div>
                      {paymentCurrency !== 'USD' && amountTendered && parseFloat(amountTendered) > 0 && (
                        <p className="text-xs text-gray-400 mt-1">= ${convertToUSD(parseFloat(amountTendered), paymentCurrency).toFixed(2)} USD</p>
                      )}
                    </div>

                    {/* Transfer reference */}
                    {paymentMethod === 'transfer' && (
                      <input type="text" value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 13))}
                        placeholder="Código confirmación (13 caracteres)"
                        className={cn('w-full px-4 py-3 rounded-xl border font-mono focus:outline-none focus:ring-2',
                          theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900')} />
                    )}

                    {/* Payment entries list */}
                    {wizardPayments.length > 0 && (
                      <div className={cn('rounded-xl border divide-y', theme === 'dark' ? 'border-gray-700 divide-gray-700' : 'border-gray-200 divide-gray-100')}>
                        {wizardPayments.map(entry => (
                          <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <span className="text-sm font-bold">{entry.amount.toLocaleString('es-ES')} {entry.currency}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                {entry.method === 'cash' ? 'Efectivo' : entry.method === 'transfer' ? 'Transferencia' : 'Tarjeta'}
                              </span>
                              {entry.reference && <span className="text-xs text-blue-400 ml-1">({entry.reference})</span>}
                              {entry.currency !== 'USD' && <p className="text-xs text-gray-400">= ${entry.amountInUSD.toFixed(2)} USD</p>}
                            </div>
                            <button onClick={() => removeWizardPayment(entry.id)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30">
                              <X className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        ))}
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 flex justify-between text-sm font-bold">
                          <span>Total pagos:</span>
                          <span className="text-green-600">${wizardTotalPaidUSD.toFixed(2)} USD</span>
                        </div>
                      </div>
                    )}
                  </>
                  )
                })()}
              </motion.div>
            )}

            {/* Step 6: Confirmation */}
            {currentStep === 'confirm' && createdInvoice && (
              <motion.div
                key="step6-confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6 text-center"
              >
                {/* Success Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-20 h-20 mx-auto rounded-full bg-green-500 flex items-center justify-center"
                >
                  <CheckCircle className="w-10 h-10 text-white" />
                </motion.div>

                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {createdInvoice.paymentStatus === 'paid' ? 'Factura Creada y Pagada' : 'Factura Creada'}
                  </h2>
                  <p className="text-gray-500">
                    La factura ha sido creada exitosamente
                  </p>
                </div>

                {/* Invoice Details */}
                <div className={cn(
                  'rounded-xl p-6 max-w-md mx-auto',
                  theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                )}>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Factura</span>
                      <span className="font-bold text-gray-900 dark:text-white">{createdInvoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cliente</span>
                      <span className="font-medium text-gray-900 dark:text-white">{createdInvoice.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total</span>
                      <span className="font-bold text-green-600">{formatCurrency(createdInvoice.total)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Estado</span>
                      <span className={cn(
                        'px-3 py-1 rounded-full text-sm font-medium',
                        createdInvoice.paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                          : createdInvoice.paymentStatus === 'partial'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400'
                      )}>
                        {createdInvoice.paymentStatus === 'paid'
                          ? 'Pagada'
                          : createdInvoice.paymentStatus === 'partial'
                            ? 'Pago Parcial'
                            : 'Pendiente de Pago'}
                      </span>
                    </div>
                    {createdInvoice.downpaymentAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Anticipo Pagado</span>
                        <span className="font-medium text-blue-600">{formatCurrency(createdInvoice.downpaymentAmount)}</span>
                      </div>
                    )}
                    {createdInvoice.dueDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Vencimiento</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatDateSpanish(createdInvoice.dueDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Warehouse Tickets with QR */}
                {deliveriesPreview.length > 0 && (
                  <div className={cn(
                    'rounded-xl p-4 max-w-2xl mx-auto',
                    theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                  )}>
                    <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                      <QrCode className="w-5 h-5" />
                      Tickets de Recogida por Almacén
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {deliveriesPreview.map((delivery, idx) => (
                        <button
                          key={delivery.warehouseId}
                          onClick={() => {
                            setPrintDocType('warehouse_pickup_ticket')
                            setPrintDocData({
                              invoiceNumber: createdInvoice.invoiceNumber,
                              customerName: createdInvoice.customerName,
                              warehouseName: delivery.warehouseName,
                              warehouseId: delivery.warehouseId,
                              products: delivery.products,
                              createdAt: createdInvoice.createdAt || new Date().toISOString()
                            })
                            setPrintDocTitle(`Ticket ${delivery.warehouseName}`)
                            setPrintSourceId(createdInvoice.id)
                            setShowPrintModal(true)
                          }}
                          className={cn(
                            'p-3 rounded-lg flex items-center justify-between transition-all border-2 hover:border-blue-500',
                            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                              theme === 'dark' ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
                            )}>
                              {idx + 1}
                            </div>
                            <div className="text-left">
                              <span className="font-medium text-sm text-gray-900 dark:text-white block">
                                {delivery.warehouseName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {delivery.products.length} productos, {delivery.products.reduce((sum, p) => sum + p.quantity, 0)} uds
                              </span>
                            </div>
                          </div>
                          <Printer className="w-4 h-4 text-blue-500" />
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setPrintDocType('warehouse_pickup_ticket')
                        setPrintDocData({
                          invoiceNumber: createdInvoice.invoiceNumber,
                          customerName: createdInvoice.customerName,
                          warehouseName: 'Todos los almacenes',
                          products: deliveriesPreview.flatMap(d => d.products.map(p => ({ ...p, warehouseName: d.warehouseName }))),
                          createdAt: createdInvoice.createdAt || new Date().toISOString()
                        })
                        setPrintDocTitle(`Tickets - ${createdInvoice.invoiceNumber}`)
                        setPrintSourceId(createdInvoice.id)
                        setShowPrintModal(true)
                      }}
                      className={cn(
                        'w-full mt-3 py-2.5 rounded-lg font-medium text-sm transition-all border-2 flex items-center justify-center gap-2',
                        theme === 'dark'
                          ? 'border-blue-500 text-blue-400 hover:bg-blue-500/10'
                          : 'border-blue-600 text-blue-600 hover:bg-blue-50'
                      )}
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir Todos los Tickets
                    </button>
                  </div>
                )}

                {/* Print Options */}
                <div className="space-y-3 max-w-md mx-auto">
                  <p className="text-sm text-gray-500 font-medium">Documentos de Factura</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setPrintDocType('wholesale_invoice')
                        setPrintDocData({
                          invoiceNumber: createdInvoice.invoiceNumber,
                          customerName: createdInvoice.customerName,
                          customerCode: createdInvoice.customerCode,
                          lines: lines.map(l => ({
                            productName: l.productName,
                            productSku: l.productSku,
                            quantity: l.quantity,
                            unitPrice: l.unitPrice,
                            subtotal: l.subtotal
                          })),
                          subtotal: createdInvoice.total,
                          total: createdInvoice.total,
                          exchangeRate: exchangeRateWholesale,
                          warehouseName: '',
                          createdAt: createdInvoice.createdAt || new Date().toISOString(),
                          paymentStatus: createdInvoice.paymentStatus,
                          includeTax
                        })
                        setPrintDocTitle(`Recibo ${createdInvoice.invoiceNumber}`)
                        setPrintSourceId(createdInvoice.id)
                        setShowPrintModal(true)
                      }}
                      className={cn(
                        'py-4 px-4 rounded-xl flex flex-col items-center gap-2 transition-all border-2',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-green-500'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-green-500'
                      )}
                    >
                      <Receipt className="w-6 h-6" />
                      <span className="font-medium">Imprimir Recibo</span>
                      <span className="text-xs text-gray-400">(Ticket 80mm)</span>
                    </button>
                    <button
                      onClick={() => {
                        setPrintDocType('wholesale_invoice')
                        setPrintDocData({
                          invoiceNumber: createdInvoice.invoiceNumber,
                          customerName: createdInvoice.customerName,
                          customerCode: createdInvoice.customerCode,
                          lines: lines.map(l => ({
                            productName: l.productName,
                            productSku: l.productSku,
                            quantity: l.quantity,
                            unitPrice: l.unitPrice,
                            subtotal: l.subtotal
                          })),
                          subtotal: createdInvoice.total,
                          total: createdInvoice.total,
                          exchangeRate: exchangeRateWholesale,
                          warehouseName: '',
                          createdAt: createdInvoice.createdAt || new Date().toISOString(),
                          paymentStatus: createdInvoice.paymentStatus,
                          includeTax
                        })
                        setPrintDocTitle(`Factura ${createdInvoice.invoiceNumber}`)
                        setPrintSourceId(createdInvoice.id)
                        setShowPrintModal(true)
                      }}
                      className={cn(
                        'py-4 px-4 rounded-xl flex flex-col items-center gap-2 transition-all border-2',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-green-500'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-green-500'
                      )}
                    >
                      <FileText className="w-6 h-6" />
                      <span className="font-medium">Imprimir Factura</span>
                      <span className="text-xs text-gray-400">(Tamaño Carta)</span>
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 max-w-md mx-auto pt-4">
                  <button
                    onClick={() => {
                      // Reset all state and start fresh
                      setSelectedCustomer(null)
                      setLines([])
                      setPaymentTerms('immediate')
                      setCustomDueDate('')
                      setNotes('')
                      setInternalNotes('')
                      setRequiresDownpayment(false)
                      setDownpaymentType('percentage')
                      setDownpaymentValue('30')
                      setPaymentMethod('cash')
                      setPaymentCurrency('USD')
                      setAmountTendered('')
                      setPaymentReference('')
                      setCreatedInvoice(null)
                      setCurrentStep('customer')
                    }}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Crear Nueva Factura
                  </button>

                  {createdInvoice.paymentStatus !== 'paid' && (
                    <button
                      onClick={() => {
                        router.push(`/dashboard/market/wholesale/invoices/${createdInvoice.id}/payment`)
                      }}
                      className={cn(
                        'w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border-2',
                        theme === 'dark'
                          ? 'border-green-500 text-green-500 hover:bg-green-500/10'
                          : 'border-green-600 text-green-600 hover:bg-green-50'
                      )}
                    >
                      <CreditCard className="w-5 h-5" />
                      Registrar Pago
                    </button>
                  )}

                  <button
                    onClick={() => {
                      router.push(`/dashboard/market/wholesale/invoices/${createdInvoice.id}`)
                    }}
                    className={cn(
                      'w-full py-3 rounded-xl font-medium transition-colors',
                      theme === 'dark'
                        ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                    )}
                  >
                    Ver Detalle de Factura
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons - Hide on confirm step */}
          {currentStep !== 'confirm' && (
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

              {currentStep === 'payment' ? (
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
                      Procesando...
                    </>
                  ) : paymentTerms === 'immediate' ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Confirmar Pago
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Crear Factura
                    </>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          )}
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
                  onClick={() => {
                    clearStorage()
                    router.push('/dashboard/market/wholesale/invoices')
                  }}
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

      {/* Print Modal */}
      <PrintDocumentModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        documentType={printDocType as any}
        documentData={printDocData || {}}
        documentTitle={printDocTitle}
        sourceType="wholesale_invoice"
        sourceId={printSourceId}
      />
    </div>
  )
}
