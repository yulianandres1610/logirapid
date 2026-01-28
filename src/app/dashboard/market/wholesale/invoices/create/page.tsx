'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Package,
  Settings,
  CheckCircle,
  Search,
  Plus,
  Minus,
  Trash2,
  Save,
  FileText,
  Building2,
  Tag,
  Percent,
  Calendar,
  ShoppingCart,
  Receipt
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Customer {
  id: number
  code: string
  businessName: string
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
  stock: number
}

interface InvoiceLine {
  productId: number
  variantId: number | null
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  originalPrice: number
  discountPercent: number
  discountAmount: number
  subtotal: number
}

interface Warehouse {
  id: number
  name: string
}

interface Quote {
  id: number
  quoteNumber: string
  customerName: string
  totalAmount: number
  status: string
}

interface WizardStep {
  id: number
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const steps: WizardStep[] = [
  { id: 1, title: 'Origen', description: 'Seleccionar', icon: FileText },
  { id: 2, title: 'Cliente', description: 'Mayorista', icon: Users },
  { id: 3, title: 'Productos', description: 'Agregar líneas', icon: Package },
  { id: 4, title: 'Condiciones', description: 'Configurar', icon: Settings },
  { id: 5, title: 'Confirmar', description: 'Revisar y crear', icon: CheckCircle }
]

export default function CreateInvoicePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')
  const fromQuoteId = searchParams.get('quoteId')

  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1: Origin
  const [fromQuote, setFromQuote] = useState(false)
  const [availableQuotes, setAvailableQuotes] = useState<Quote[]>([])
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null)

  // Step 2: Customer
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)

  // Step 3: Products
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<InvoiceLine[]>([])

  // Step 4: Conditions
  const [dueDate, setDueDate] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  useEffect(() => {
    fetchCustomers()
    fetchWarehouses()
    fetchProducts()
    fetchAvailableQuotes()
  }, [])

  useEffect(() => {
    if (fromQuoteId) {
      setFromQuote(true)
      setSelectedQuoteId(parseInt(fromQuoteId))
      loadQuoteData(parseInt(fromQuoteId))
    }
  }, [fromQuoteId])

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === parseInt(preselectedCustomerId))
      if (customer) {
        setSelectedCustomer(customer)
      }
    }
  }, [preselectedCustomerId, customers])

  const fetchAvailableQuotes = async () => {
    try {
      const response = await fetch('/api/market/wholesale/quotes?status=accepted&limit=50')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAvailableQuotes(result.data.quotes.filter((q: any) => !q.convertedToInvoiceId))
        }
      }
    } catch (error) {
      console.error('Error fetching quotes:', error)
    }
  }

  const loadQuoteData = async (quoteId: number) => {
    try {
      const response = await fetch(`/api/market/wholesale/quotes/${quoteId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const quote = result.data
          const customer = customers.find(c => c.id === quote.customer.id)
          if (customer) {
            setSelectedCustomer(customer)
          }
          setSelectedWarehouse(quote.warehouseId)
          setDiscountPercent(quote.discountPercent)
          setNotes(quote.notes || '')
          setInternalNotes(quote.internalNotes || '')
          setLines(quote.lines.map((line: any) => ({
            productId: line.productId,
            variantId: line.variantId,
            productName: line.productName,
            productSku: line.productSku || '',
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            originalPrice: line.originalPrice || line.unitPrice,
            discountPercent: line.discountPercent,
            discountAmount: line.discountAmount,
            subtotal: line.subtotal
          })))
          setCurrentStep(4)
        }
      }
    } catch (error) {
      console.error('Error loading quote:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/market/wholesale/customers?status=active&limit=100')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setCustomers(result.data.customers)
        }
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
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

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/market/products?limit=100')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setProducts(result.data.products || result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const addProduct = (product: Product) => {
    const existingIndex = lines.findIndex(l => l.productId === product.id)
    if (existingIndex >= 0) {
      const newLines = [...lines]
      newLines[existingIndex].quantity += 1
      newLines[existingIndex].subtotal = newLines[existingIndex].quantity * newLines[existingIndex].unitPrice
      setLines(newLines)
    } else {
      setLines([...lines, {
        productId: product.id,
        variantId: null,
        productName: product.name,
        productSku: product.sku || '',
        quantity: 1,
        unitPrice: product.sellingPrice,
        originalPrice: product.sellingPrice,
        discountPercent: 0,
        discountAmount: 0,
        subtotal: product.sellingPrice
      }])
    }
  }

  const updateLineQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return
    const newLines = [...lines]
    newLines[index].quantity = quantity
    newLines[index].subtotal = quantity * newLines[index].unitPrice * (1 - newLines[index].discountPercent / 100)
    setLines(newLines)
  }

  const updateLineDiscount = (index: number, discount: number) => {
    const newLines = [...lines]
    newLines[index].discountPercent = discount
    newLines[index].discountAmount = newLines[index].quantity * newLines[index].unitPrice * discount / 100
    newLines[index].subtotal = newLines[index].quantity * newLines[index].unitPrice - newLines[index].discountAmount
    setLines(newLines)
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
  const globalDiscount = subtotal * discountPercent / 100
  const total = subtotal - globalDiscount

  const canProceed = () => {
    switch (currentStep) {
      case 1: return !fromQuote || selectedQuoteId !== null
      case 2: return selectedCustomer !== null
      case 3: return lines.length > 0
      case 4: return true
      default: return true
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
          quoteId: selectedQuoteId,
          warehouseId: selectedWarehouse,
          pricelistId: selectedCustomer.pricelistId,
          dueDate: dueDate || null,
          discountPercent,
          notes,
          internalNotes,
          lines: lines.map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            productName: l.productName,
            productSku: l.productSku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            originalPrice: l.originalPrice,
            discountPercent: l.discountPercent,
            discountAmount: l.discountAmount
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
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const filteredCustomers = customers.filter(c =>
    c.businessName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
    (p.barcode && p.barcode.includes(productSearch))
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className={cn(
              'relative overflow-hidden rounded-2xl border shadow-xl p-6',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/wholesale/invoices">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'p-3 rounded-xl transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-700/50 hover:bg-gray-700 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                </Link>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark'
                      ? 'bg-green-900/30 border border-green-800/50'
                      : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                  )}>
                    <Receipt className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h1 className={cn(
                      'text-2xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Nueva Factura
                    </h1>
                    <p className={cn(
                      'text-sm mt-0.5',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Crea una nueva factura para cliente mayorista
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className={cn(
              'rounded-2xl border shadow-xl p-4 overflow-x-auto',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              <div className="flex items-center justify-between min-w-[600px]">
                {steps.map((step, index) => {
                  const StepIcon = step.icon
                  const isActive = currentStep === step.id
                  const isCompleted = currentStep > step.id

                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: isActive ? 1 : 0.95 }}
                        className={cn(
                          'flex items-center gap-3 px-3 py-3 rounded-xl transition-all flex-1',
                          isActive
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25'
                            : isCompleted
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                              : theme === 'dark'
                                ? 'bg-gray-800 text-gray-400'
                                : 'bg-gray-100 text-gray-500'
                        )}
                      >
                        <div className={cn(
                          'p-2 rounded-lg',
                          isActive || isCompleted
                            ? 'bg-white/20'
                            : theme === 'dark'
                              ? 'bg-gray-700'
                              : 'bg-white'
                        )}>
                          <StepIcon className="w-4 h-4" />
                        </div>
                        <div className="hidden sm:block">
                          <p className="font-semibold text-sm">{step.title}</p>
                          <p className={cn(
                            'text-xs',
                            isActive || isCompleted ? 'text-white/70' : 'text-gray-500'
                          )}>{step.description}</p>
                        </div>
                      </motion.div>
                      {index < steps.length - 1 && (
                        <div className={cn(
                          'w-6 h-1 mx-1 rounded-full',
                          currentStep > step.id
                            ? 'bg-green-500'
                            : theme === 'dark'
                              ? 'bg-gray-700'
                              : 'bg-gray-200'
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step Content */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={cn(
                'rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              {/* Step 1: Origin */}
              {currentStep === 1 && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className={cn(
                      'p-2 rounded-lg',
                      theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                    )}>
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h2 className={cn(
                        'text-lg font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Origen de la Factura</h2>
                      <p className="text-sm text-gray-500">Selecciona cómo crear la factura</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setFromQuote(false)
                        setSelectedQuoteId(null)
                      }}
                      className={cn(
                        'p-6 rounded-xl border-2 cursor-pointer transition-all text-center',
                        !fromQuote
                          ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/10'
                          : theme === 'dark'
                            ? 'border-gray-700 hover:border-gray-600'
                            : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className={cn(
                        'w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center',
                        !fromQuote
                          ? 'bg-green-500/20'
                          : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <Package className={cn(
                          'w-8 h-8',
                          !fromQuote ? 'text-green-500' : 'text-gray-400'
                        )} />
                      </div>
                      <h3 className={cn(
                        'font-semibold text-lg',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Factura Directa</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Crear factura sin cotización previa
                      </p>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFromQuote(true)}
                      className={cn(
                        'p-6 rounded-xl border-2 cursor-pointer transition-all text-center',
                        fromQuote
                          ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                          : theme === 'dark'
                            ? 'border-gray-700 hover:border-gray-600'
                            : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className={cn(
                        'w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center',
                        fromQuote
                          ? 'bg-blue-500/20'
                          : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                      )}>
                        <FileText className={cn(
                          'w-8 h-8',
                          fromQuote ? 'text-blue-500' : 'text-gray-400'
                        )} />
                      </div>
                      <h3 className={cn(
                        'font-semibold text-lg',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Desde Cotización</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Convertir cotización aceptada a factura
                      </p>
                    </motion.div>
                  </div>

                  {fromQuote && (
                    <div className="space-y-4">
                      <h3 className={cn(
                        'font-medium flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <FileText className="w-4 h-4 text-blue-500" />
                        Seleccionar Cotización
                      </h3>
                      {availableQuotes.length === 0 ? (
                        <div className={cn(
                          'text-center py-12 rounded-xl border',
                          theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
                        )}>
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-gray-500">No hay cotizaciones aceptadas disponibles</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                          {availableQuotes.map(quote => (
                            <motion.div
                              key={quote.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setSelectedQuoteId(quote.id)
                                loadQuoteData(quote.id)
                              }}
                              className={cn(
                                'p-4 rounded-xl border-2 cursor-pointer transition-all',
                                selectedQuoteId === quote.id
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : theme === 'dark'
                                    ? 'border-gray-700 hover:border-gray-600'
                                    : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className={cn(
                                    'font-semibold',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>{quote.quoteNumber}</p>
                                  <p className="text-sm text-gray-500">{quote.customerName}</p>
                                </div>
                                <p className="font-bold text-green-600">{formatCurrency(quote.totalAmount)}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Select Customer */}
              {currentStep === 2 && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className={cn(
                      'p-2 rounded-lg',
                      theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                    )}>
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className={cn(
                        'text-lg font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Seleccionar Cliente</h2>
                      <p className="text-sm text-gray-500">Elige el cliente mayorista para la factura</p>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar cliente por nombre o código..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className={cn(
                        'w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto">
                    {filteredCustomers.map(customer => (
                      <motion.div
                        key={customer.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedCustomer(customer)}
                        className={cn(
                          'p-4 rounded-xl border-2 cursor-pointer transition-all',
                          selectedCustomer?.id === customer.id
                            ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                          </div>
                          {selectedCustomer?.id === customer.id && (
                            <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                          )}
                        </div>
                        {customer.pricelistName && (
                          <div className="mt-3 flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs text-blue-500 font-medium">{customer.pricelistName}</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {selectedCustomer && (
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3 mb-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <h3 className="font-medium">Almacén de Origen (opcional)</h3>
                      </div>
                      <select
                        value={selectedWarehouse || ''}
                        onChange={(e) => setSelectedWarehouse(e.target.value ? parseInt(e.target.value) : null)}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      >
                        <option value="">Sin especificar</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Add Products */}
              {currentStep === 3 && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className={cn(
                      'p-2 rounded-lg',
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                    )}>
                      <Package className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h2 className={cn(
                        'text-lg font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Agregar Productos</h2>
                      <p className="text-sm text-gray-500">Busca y agrega productos a la factura</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Product Search */}
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar producto por nombre, SKU o código..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className={cn(
                            'w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500/20'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                          )}
                        />
                      </div>

                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {filteredProducts.slice(0, 20).map(product => (
                          <motion.div
                            key={product.id}
                            whileHover={{ scale: 1.01 }}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                              theme === 'dark'
                                ? 'border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                                : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            )}
                            onClick={() => addProduct(product)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center',
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  <Package className="w-6 h-6 text-gray-400" />
                                )}
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{product.name}</p>
                                <p className="text-xs text-gray-500">{product.sku}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600">{formatCurrency(product.sellingPrice)}</p>
                              <button className="text-xs text-purple-500 hover:text-purple-600 font-medium flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> Agregar
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Invoice Lines */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
                    )}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-5 h-5 text-gray-400" />
                          <h3 className="font-semibold">Productos ({lines.length})</h3>
                        </div>
                      </div>
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                        {lines.length === 0 ? (
                          <div className="text-center py-12">
                            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-gray-500">No hay productos agregados</p>
                            <p className="text-sm text-gray-400">Busca y agrega productos</p>
                          </div>
                        ) : (
                          lines.map((line, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                'p-3 rounded-xl border',
                                theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
                              )}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <p className={cn(
                                  'font-medium text-sm',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{line.productName}</p>
                                <button
                                  onClick={() => removeLine(index)}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => updateLineQuantity(index, line.quantity - 1)}
                                    className={cn(
                                      'p-1.5 rounded-lg transition-colors',
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
                                      'w-14 text-center px-2 py-1.5 rounded-lg border text-sm',
                                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                                    )}
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
                                <div className="flex items-center gap-1.5">
                                  <Percent className="w-3.5 h-3.5 text-gray-400" />
                                  <input
                                    type="number"
                                    value={line.discountPercent}
                                    onChange={(e) => updateLineDiscount(index, parseFloat(e.target.value) || 0)}
                                    className={cn(
                                      'w-14 text-center px-2 py-1.5 rounded-lg border text-sm',
                                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
                                    )}
                                    min="0"
                                    max="100"
                                  />
                                </div>
                                <p className="font-bold text-green-600 ml-auto">
                                  {formatCurrency(line.subtotal)}
                                </p>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>

                      {lines.length > 0 && (
                        <div className={cn(
                          'mt-4 pt-4 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <div className="flex justify-between items-center text-lg font-bold">
                            <span>Subtotal:</span>
                            <span className="text-green-600">{formatCurrency(subtotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Conditions */}
              {currentStep === 4 && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className={cn(
                      'p-2 rounded-lg',
                      theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                    )}>
                      <Settings className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h2 className={cn(
                        'text-lg font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Condiciones de la Factura</h2>
                      <p className="text-sm text-gray-500">Configura descuentos, vencimiento y notas</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-2 mb-3">
                        <Percent className="w-4 h-4 text-green-600" />
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
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
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
                        <Calendar className="w-4 h-4 text-red-600" />
                        <label className="font-medium">Fecha de Vencimiento</label>
                      </div>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-red-500 focus:ring-red-500/20'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-red-500 focus:ring-red-500/20'
                        )}
                      />
                    </div>
                    <div className={cn(
                      'md:col-span-2 p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-purple-600" />
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
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500/20'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
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
                        <span className="text-xs text-gray-400">(no visibles para el cliente)</span>
                      </div>
                      <textarea
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        rows={2}
                        placeholder="Notas internas..."
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white focus:border-gray-500 focus:ring-gray-500/20'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-gray-500 focus:ring-gray-500/20'
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Confirmation */}
              {currentStep === 5 && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className={cn(
                      'p-2 rounded-lg',
                      theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                    )}>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h2 className={cn(
                        'text-lg font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>Confirmar Factura</h2>
                      <p className="text-sm text-gray-500">Revisa los detalles antes de crear</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={cn(
                      'p-5 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br from-green-500 to-green-600'
                        )}>
                          {selectedCustomer?.businessName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Cliente</p>
                          <p className={cn(
                            'text-lg font-semibold',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>{selectedCustomer?.businessName}</p>
                          <p className="text-sm text-gray-500">{selectedCustomer?.code}</p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      'p-5 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
                    )}>
                      <p className="text-sm text-gray-500 mb-3">Resumen</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Subtotal:</span>
                          <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                        {discountPercent > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Descuento ({discountPercent}%):</span>
                            <span>-{formatCurrency(globalDiscount)}</span>
                          </div>
                        )}
                        <div className={cn(
                          'flex justify-between text-xl font-bold pt-3 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <span>Total:</span>
                          <span className="text-green-600">{formatCurrency(total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    'p-5 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
                  )}>
                    <div className="flex items-center gap-2 mb-4">
                      <Package className="w-5 h-5 text-gray-400" />
                      <h3 className="font-semibold">Productos ({lines.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {lines.map((line, index) => (
                        <div key={index} className={cn(
                          'flex justify-between items-center p-3 rounded-lg',
                          theme === 'dark' ? 'bg-gray-800/50' : 'bg-white'
                        )}>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                            )}>{line.quantity}</span>
                            <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {line.productName}
                            </span>
                          </div>
                          <span className="font-semibold text-green-600">{formatCurrency(line.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedQuoteId && (
                    <div className={cn(
                      'p-4 rounded-xl border-2 border-blue-500/30 bg-blue-500/5'
                    )}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                          Esta factura será vinculada a la cotización seleccionada
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Navigation Buttons */}
            <div className={cn(
              'flex justify-between p-4 rounded-2xl border shadow-xl',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
                disabled={currentStep === 1}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                  currentStep === 1
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </motion.button>

              {currentStep < 5 ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => canProceed() && setCurrentStep(currentStep + 1)}
                  disabled={!canProceed()}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all',
                    !canProceed()
                      ? 'opacity-50 cursor-not-allowed bg-gray-300 text-gray-500'
                      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/25'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium disabled:opacity-50 shadow-lg shadow-green-500/25"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Guardando...' : 'Crear Factura'}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
