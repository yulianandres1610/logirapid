'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  DollarSign,
  CreditCard,
  Banknote,
  Smartphone,
  FileText,
  Trash2,
  Plus,
  CheckCircle,
  Loader2,
  AlertCircle,
  Calculator,
  RefreshCw
} from 'lucide-react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface CartItem {
  productId: number
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  total: number
}

interface Payment {
  id: string
  method: 'cash' | 'card' | 'transfer' | 'credit'
  currency: 'USD' | 'CUP' | 'MLC'
  amount: number
  amountInUSD: number
  amountTendered?: number
  changeAmount?: number
  reference?: string
}

interface ExchangeRates {
  CUP: number // USD to CUP
  MLC: number // USD to MLC
}

// Default exchange rates (should be fetched from API)
const DEFAULT_RATES: ExchangeRates = {
  CUP: 250,
  MLC: 0.91 // 1 USD = 0.91 MLC (approx €1 = $1.10)
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', icon: Banknote },
  { id: 'card', label: 'Tarjeta', icon: CreditCard },
  { id: 'transfer', label: 'Transferencia', icon: Smartphone },
  { id: 'credit', label: 'Crédito', icon: FileText }
]

const CURRENCIES = [
  { id: 'USD', label: 'USD', symbol: '$' },
  { id: 'CUP', label: 'CUP', symbol: '$' },
  { id: 'MLC', label: 'MLC', symbol: '€' }
]

export default function PaymentPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const terminalId = params.terminalId as string

  // Get cart data from URL params (passed from POS)
  const cartData = searchParams.get('cart')
  const sessionId = searchParams.get('sessionId')
  const warehouseId = searchParams.get('warehouseId')

  // State
  const [cart, setCart] = useState<CartItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash')
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'CUP' | 'MLC'>('USD')
  const [amount, setAmount] = useState('')
  const [changeCurrency, setChangeCurrency] = useState<'USD' | 'CUP'>('USD')
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Parse cart data on mount
  useEffect(() => {
    if (cartData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cartData))
        setCart(parsed)
      } catch (e) {
        console.error('Error parsing cart data:', e)
        setError('Error al cargar datos del carrito')
      }
    }
  }, [cartData])

  // Fetch exchange rates
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('/api/agency-rates')
        const data = await res.json()
        if (data.success && data.rates) {
          setRates({
            CUP: data.rates.usd || DEFAULT_RATES.CUP,
            MLC: data.rates.mlc || DEFAULT_RATES.MLC
          })
        }
      } catch (e) {
        console.error('Error fetching rates:', e)
      }
    }
    fetchRates()
  }, [])

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const discount = cart.reduce((sum, item) => sum + item.discountAmount, 0)
    const total = subtotal - discount
    return { subtotal, discount, total }
  }, [cart])

  // Calculate total paid in USD
  const totalPaidUSD = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amountInUSD, 0)
  }, [payments])

  const remainingUSD = totals.total - totalPaidUSD
  const isFullyPaid = remainingUSD <= 0.01 // Allow small rounding errors

  // Calculate change
  const changeAmount = useMemo(() => {
    if (remainingUSD < 0) {
      const changeUSD = Math.abs(remainingUSD)
      if (changeCurrency === 'CUP') {
        return changeUSD * rates.CUP
      }
      return changeUSD
    }
    return 0
  }, [remainingUSD, changeCurrency, rates])

  // Convert amount to USD
  const convertToUSD = (amount: number, currency: 'USD' | 'CUP' | 'MLC'): number => {
    switch (currency) {
      case 'CUP':
        return amount / rates.CUP
      case 'MLC':
        return amount / rates.MLC
      default:
        return amount
    }
  }

  // Add payment
  const addPayment = () => {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return
    }

    const amountInUSD = convertToUSD(numAmount, selectedCurrency)

    const newPayment: Payment = {
      id: Date.now().toString(),
      method: selectedMethod,
      currency: selectedCurrency,
      amount: numAmount,
      amountInUSD
    }

    setPayments([...payments, newPayment])
    setAmount('')
  }

  // Remove payment
  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id))
  }

  // Set exact amount
  const setExactAmount = () => {
    if (remainingUSD > 0) {
      let exactAmount = remainingUSD
      if (selectedCurrency === 'CUP') {
        exactAmount = remainingUSD * rates.CUP
      } else if (selectedCurrency === 'MLC') {
        exactAmount = remainingUSD * rates.MLC
      }
      setAmount(exactAmount.toFixed(2))
    }
  }

  // Process payment
  const processPayment = async () => {
    if (!isFullyPaid || !sessionId) {
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const orderData = {
        sessionId: parseInt(sessionId),
        terminalId: parseInt(terminalId),
        warehouseId: warehouseId ? parseInt(warehouseId) : null,
        currency: 'USD',
        lines: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount
        })),
        payments: payments.map(p => ({
          method: p.method,
          amount: p.amountInUSD,
          currency: p.currency,
          amountTendered: p.method === 'cash' ? p.amount : null,
          changeAmount: changeAmount > 0 ? (changeCurrency === 'USD' ? changeAmount : changeAmount / rates.CUP) : null,
          reference: p.reference
        }))
      }

      const response = await fetch('/api/market/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      const data = await response.json()

      if (data.success) {
        // Navigate to receipt page
        router.push(`/dashboard/market/pos/${terminalId}/receipt?orderId=${data.data.id}&orderNumber=${data.data.orderNumber}`)
      } else {
        setError(data.error || 'Error al procesar pago')
      }
    } catch (e) {
      console.error('Error processing payment:', e)
      setError('Error de conexión')
    } finally {
      setProcessing(false)
    }
  }

  // Format currency
  const formatCurrency = (amount: number, currency: 'USD' | 'CUP' | 'MLC' = 'USD') => {
    const symbol = CURRENCIES.find(c => c.id === currency)?.symbol || '$'
    if (currency === 'CUP') {
      return `${symbol}${amount.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`
    }
    return `${symbol}${amount.toFixed(2)}`
  }

  // Numpad handler
  const handleNumpad = (key: string) => {
    if (key === 'C') {
      setAmount('')
    } else if (key === '.' && !amount.includes('.')) {
      setAmount(amount + '.')
    } else if (key !== '.') {
      setAmount(amount + key)
    }
  }

  if (error && !cart.length) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
      )}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'min-h-screen flex flex-col',
      theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
    )}>
      {/* Header */}
      <header className={cn(
        'flex items-center justify-between px-4 py-3 border-b',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Volver al POS</span>
        </button>
        <h1 className="text-lg font-semibold">Cobrar</h1>
        <div className="w-24" />
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Order Summary */}
          <div className="space-y-4">
            {/* Order Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-xl p-4 shadow-sm',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <h2 className="text-lg font-semibold mb-4">Resumen de Orden</h2>
              <div className="space-y-2 max-h-48 overflow-auto">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="truncate flex-1">
                      {item.productName} x{item.quantity}
                    </span>
                    <span className="ml-2">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className={cn(
                'mt-4 pt-4 border-t space-y-2',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>Descuento:</span>
                    <span>-{formatCurrency(totals.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </motion.div>

            {/* Payments List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'rounded-xl p-4 shadow-sm',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <h2 className="text-lg font-semibold mb-4">Pagos Realizados</h2>

              {payments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay pagos agregados</p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {payments.map((payment) => (
                      <motion.div
                        key={payment.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {payment.method === 'cash' && <Banknote className="w-5 h-5 text-green-500" />}
                          {payment.method === 'card' && <CreditCard className="w-5 h-5 text-blue-500" />}
                          {payment.method === 'transfer' && <Smartphone className="w-5 h-5 text-purple-500" />}
                          {payment.method === 'credit' && <FileText className="w-5 h-5 text-orange-500" />}
                          <div>
                            <p className="font-medium">
                              {PAYMENT_METHODS.find(m => m.id === payment.method)?.label}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(payment.amount, payment.currency)}
                              {payment.currency !== 'USD' && (
                                <span className="ml-1">
                                  (≈{formatCurrency(payment.amountInUSD)})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removePayment(payment.id)}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <div className={cn(
                'mt-4 pt-4 border-t space-y-2',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <div className="flex justify-between">
                  <span>Total pagado:</span>
                  <span className="font-semibold">{formatCurrency(totalPaidUSD)}</span>
                </div>
                <div className={cn(
                  'flex justify-between font-bold',
                  remainingUSD > 0 ? 'text-red-500' : 'text-green-500'
                )}>
                  <span>{remainingUSD > 0 ? 'Pendiente:' : 'Cambio:'}</span>
                  <span>
                    {remainingUSD > 0
                      ? formatCurrency(remainingUSD)
                      : formatCurrency(changeAmount, changeCurrency)
                    }
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Add Payment */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'rounded-xl p-4 shadow-sm',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <h2 className="text-lg font-semibold mb-4">Agregar Pago</h2>

              {/* Payment Method */}
              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-2 block">Método de Pago</label>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedMethod(method.id as Payment['method'])}
                        className={cn(
                          'p-3 rounded-lg flex flex-col items-center gap-1 transition-all',
                          selectedMethod === method.id
                            ? 'bg-blue-500 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600'
                              : 'bg-gray-100 hover:bg-gray-200'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs">{method.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Currency */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-500">Moneda</label>
                  <span className="text-xs text-gray-400">
                    1 USD = {rates.CUP} CUP | {rates.MLC.toFixed(2)} MLC
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CURRENCIES.map((currency) => (
                    <button
                      key={currency.id}
                      onClick={() => setSelectedCurrency(currency.id as Payment['currency'])}
                      className={cn(
                        'p-3 rounded-lg font-medium transition-all',
                        selectedCurrency === currency.id
                          ? 'bg-blue-500 text-white'
                          : theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600'
                            : 'bg-gray-100 hover:bg-gray-200'
                      )}
                    >
                      {currency.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-2 block">Monto</label>
                <div className={cn(
                  'relative rounded-lg',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                )}>
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">
                    {CURRENCIES.find(c => c.id === selectedCurrency)?.symbol}
                  </span>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className={cn(
                      'w-full pl-10 pr-4 py-4 text-3xl font-bold text-right bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}
                  />
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {remainingUSD > 0 && (
                  <button
                    onClick={setExactAmount}
                    className={cn(
                      'p-2 rounded-lg text-sm font-medium',
                      theme === 'dark' ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                    )}
                  >
                    Exacto
                  </button>
                )}
                {selectedCurrency === 'USD' && [5, 10, 20, 50].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className={cn(
                      'p-2 rounded-lg text-sm font-medium',
                      theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                    )}
                  >
                    ${val}
                  </button>
                ))}
                {selectedCurrency === 'CUP' && [1000, 2000, 5000, 10000].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className={cn(
                      'p-2 rounded-lg text-sm font-medium',
                      theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                    )}
                  >
                    ${val.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleNumpad(key)}
                    className={cn(
                      'p-4 rounded-lg text-xl font-bold transition-all active:scale-95',
                      key === 'C'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600'
                          : 'bg-gray-200 hover:bg-gray-300'
                    )}
                  >
                    {key}
                  </button>
                ))}
              </div>

              {/* Add Payment Button */}
              <button
                onClick={addPayment}
                disabled={!amount || parseFloat(amount) <= 0}
                className={cn(
                  'w-full p-4 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all',
                  amount && parseFloat(amount) > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                <Plus className="w-5 h-5" />
                Agregar Pago
              </button>
            </motion.div>

            {/* Change Currency (when overpaid) */}
            {remainingUSD < 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-xl p-4 shadow-sm',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <h3 className="font-semibold mb-3">Devolver cambio en:</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setChangeCurrency('USD')}
                    className={cn(
                      'p-3 rounded-lg font-medium',
                      changeCurrency === 'USD'
                        ? 'bg-blue-500 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-700'
                          : 'bg-gray-100'
                    )}
                  >
                    USD ({formatCurrency(Math.abs(remainingUSD))})
                  </button>
                  <button
                    onClick={() => setChangeCurrency('CUP')}
                    className={cn(
                      'p-3 rounded-lg font-medium',
                      changeCurrency === 'CUP'
                        ? 'bg-blue-500 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-700'
                          : 'bg-gray-100'
                    )}
                  >
                    CUP ({formatCurrency(Math.abs(remainingUSD) * rates.CUP, 'CUP')})
                  </button>
                </div>
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-lg bg-red-100 text-red-700 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={cn(
        'p-4 border-t',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className={cn(
              'px-6 py-3 rounded-lg font-medium',
              theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
            )}
          >
            Cancelar Venta
          </button>

          <button
            onClick={processPayment}
            disabled={!isFullyPaid || processing}
            className={cn(
              'px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all',
              isFullyPaid && !processing
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Confirmar Pago - {formatCurrency(totals.total)}
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  )
}
