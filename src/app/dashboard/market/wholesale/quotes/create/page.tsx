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
  Save
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

interface QuoteLine {
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

const steps = [
  { id: 1, title: 'Cliente', icon: Users },
  { id: 2, title: 'Productos', icon: Package },
  { id: 3, title: 'Condiciones', icon: Settings },
  { id: 4, title: 'Confirmación', icon: CheckCircle }
]

export default function CreateQuotePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')

  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1: Customer
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)

  // Step 2: Products
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<QuoteLine[]>([])

  // Step 3: Conditions
  const [validUntil, setValidUntil] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  useEffect(() => {
    fetchCustomers()
    fetchWarehouses()
    fetchProducts()
  }, [])

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === parseInt(preselectedCustomerId))
      if (customer) {
        setSelectedCustomer(customer)
      }
    }
  }, [preselectedCustomerId, customers])

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
      case 1: return selectedCustomer !== null
      case 2: return lines.length > 0
      case 3: return true
      default: return true
    }
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
          warehouseId: selectedWarehouse,
          pricelistId: selectedCustomer.pricelistId,
          validUntil: validUntil || null,
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
          router.push(`/dashboard/market/wholesale/quotes/${result.data.id}`)
        }
      }
    } catch (error) {
      console.error('Error creating quote:', error)
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
            <div className="flex items-center gap-4">
              <Link href="/dashboard/market/wholesale/quotes">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Nueva Cotización
                </h1>
                <p className={cn(
                  'text-sm mt-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Crea una nueva cotización para cliente mayorista
                </p>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2">
              {steps.map((step, index) => {
                const StepIcon = step.icon
                const isActive = currentStep === step.id
                const isCompleted = currentStep > step.id

                return (
                  <div key={step.id} className="flex items-center">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: isActive ? 1.1 : 1 }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
                        isActive
                          ? 'bg-blue-500 text-white'
                          : isCompleted
                            ? 'bg-green-500 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-400'
                              : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <StepIcon className="w-5 h-5" />
                      <span className="font-medium hidden sm:inline">{step.title}</span>
                    </motion.div>
                    {index < steps.length - 1 && (
                      <div className={cn(
                        'w-8 h-0.5 mx-2',
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

            {/* Step Content */}
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={cn(
                'rounded-2xl border shadow-xl p-6',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              {/* Step 1: Select Customer */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <h2 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Seleccionar Cliente</h2>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar cliente por nombre o código..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className={cn(
                        'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white'
                          : 'bg-white border-gray-200 text-gray-900'
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
                          'p-4 rounded-xl border cursor-pointer transition-all',
                          selectedCustomer?.id === customer.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                            {customer.businessName.charAt(0)}
                          </div>
                          <div>
                            <p className={cn(
                              'font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{customer.businessName}</p>
                            <p className="text-sm text-gray-500">{customer.code}</p>
                          </div>
                        </div>
                        {customer.pricelistName && (
                          <p className="text-xs text-blue-500 mt-2">Lista: {customer.pricelistName}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {selectedCustomer && (
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <h3 className="font-medium mb-3">Almacén de Origen (opcional)</h3>
                      <select
                        value={selectedWarehouse || ''}
                        onChange={(e) => setSelectedWarehouse(e.target.value ? parseInt(e.target.value) : null)}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
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

              {/* Step 2: Add Products */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <h2 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Agregar Productos</h2>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Product Search */}
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Buscar producto por nombre, SKU o código..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800/50 border-gray-700 text-white'
                              : 'bg-white border-gray-200 text-gray-900'
                          )}
                        />
                      </div>

                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {filteredProducts.slice(0, 20).map(product => (
                          <motion.div
                            key={product.id}
                            whileHover={{ scale: 1.01 }}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border cursor-pointer',
                              theme === 'dark'
                                ? 'border-gray-700 hover:bg-gray-800'
                                : 'border-gray-200 hover:bg-gray-50'
                            )}
                            onClick={() => addProduct(product)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" />
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
                              <p className="font-medium text-green-600">{formatCurrency(product.sellingPrice)}</p>
                              <button className="text-xs text-blue-500 hover:text-blue-600">
                                <Plus className="w-4 h-4 inline" /> Agregar
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Quote Lines */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <h3 className="font-medium mb-4">Productos en la cotización ({lines.length})</h3>
                      <div className="space-y-3 max-h-[350px] overflow-y-auto">
                        {lines.length === 0 ? (
                          <p className="text-center text-gray-500 py-8">
                            No hay productos agregados
                          </p>
                        ) : (
                          lines.map((line, index) => (
                            <div
                              key={index}
                              className={cn(
                                'p-3 rounded-lg border',
                                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <p className={cn(
                                  'font-medium text-sm',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{line.productName}</p>
                                <button
                                  onClick={() => removeLine(index)}
                                  className="text-red-500 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateLineQuantity(index, line.quantity - 1)}
                                    className="p-1 rounded bg-gray-200 dark:bg-gray-700"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <input
                                    type="number"
                                    value={line.quantity}
                                    onChange={(e) => updateLineQuantity(index, parseInt(e.target.value) || 1)}
                                    className="w-16 text-center px-2 py-1 rounded border dark:bg-gray-800 dark:border-gray-700"
                                  />
                                  <button
                                    onClick={() => updateLineQuantity(index, line.quantity + 1)}
                                    className="p-1 rounded bg-gray-200 dark:bg-gray-700"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">Desc:</span>
                                  <input
                                    type="number"
                                    value={line.discountPercent}
                                    onChange={(e) => updateLineDiscount(index, parseFloat(e.target.value) || 0)}
                                    className="w-16 text-center px-2 py-1 rounded border dark:bg-gray-800 dark:border-gray-700"
                                    min="0"
                                    max="100"
                                  />
                                  <span className="text-xs">%</span>
                                </div>
                                <p className="font-medium text-green-600 ml-auto">
                                  {formatCurrency(line.subtotal)}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {lines.length > 0 && (
                        <div className={cn(
                          'mt-4 pt-4 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <div className="flex justify-between text-lg font-bold">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(subtotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Conditions */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <h2 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Condiciones de la Cotización</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Descuento Global (%)</label>
                      <input
                        type="number"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Válida Hasta</label>
                      <input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">Notas para el Cliente</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Condiciones, observaciones..."
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">Notas Internas</label>
                      <textarea
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        rows={2}
                        placeholder="Notas internas (no visibles para el cliente)..."
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Confirmation */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  <h2 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>Confirmar Cotización</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <h3 className="font-medium mb-3">Cliente</h3>
                      <p className={cn(
                        'text-lg font-semibold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{selectedCustomer?.businessName}</p>
                      <p className="text-sm text-gray-500">{selectedCustomer?.code}</p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <h3 className="font-medium mb-3">Resumen</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Subtotal:</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {discountPercent > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Descuento ({discountPercent}%):</span>
                            <span>-{formatCurrency(globalDiscount)}</span>
                          </div>
                        )}
                        <div className={cn(
                          'flex justify-between text-lg font-bold pt-2 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <span>Total:</span>
                          <span className="text-green-600">{formatCurrency(total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    'p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <h3 className="font-medium mb-3">Productos ({lines.length})</h3>
                    <div className="space-y-2">
                      {lines.map((line, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{line.quantity}x {line.productName}</span>
                          <span>{formatCurrency(line.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
                disabled={currentStep === 1}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all',
                  currentStep === 1
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </motion.button>

              {currentStep < 4 ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => canProceed() && setCurrentStep(currentStep + 1)}
                  disabled={!canProceed()}
                  className={cn(
                    'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all',
                    !canProceed()
                      ? 'opacity-50 cursor-not-allowed bg-gray-300'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
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
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Guardando...' : 'Crear Cotización'}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
