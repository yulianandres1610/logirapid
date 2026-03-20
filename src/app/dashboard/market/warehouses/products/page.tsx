'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Printer,
  Tag,
  RefreshCw,
  Plus,
  Minus,
  CheckCircle,
  XCircle,
  Package,
  Calendar,
  DollarSign,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import LoadingBox from '@/components/ui/LoadingBox'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'

interface Product {
  id: number
  name: string
  sku: string
  barcode: string
  imageUrl: string | null
  sellingPrice: number
  currency: string
  unitOfMeasure: string
  categoryName: string | null
  expirationDate: string | null
}

interface PrintQueue {
  productId: number
  product: Product
  copies: number
}

export default function WarehouseProductsPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const { USD_CUP } = useMarketExchangeRates() // Tasa ElToque para etiquetas

  // State
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [printQueue, setPrintQueue] = useState<PrintQueue[]>([])
  const [productCopies, setProductCopies] = useState<Record<number, number>>({})


  // Search products
  const searchProducts = useCallback(async (term: string) => {
    try {
      setSearching(true)
      const params = new URLSearchParams()
      if (term) params.set('search', term)
      params.set('limit', '30')

      const response = await fetch(`/api/warehouse/products-labels?${params}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.data?.products || [])
      }
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setSearching(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await searchProducts('')
      setLoading(false)
    }
    init()
  }, [searchProducts])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, searchProducts])

  // Get copies for a product
  const getCopies = (productId: number) => productCopies[productId] || 1

  // Set copies for a product
  const setCopies = (productId: number, copies: number) => {
    setProductCopies(prev => ({
      ...prev,
      [productId]: Math.max(1, Math.min(99, copies))
    }))
  }

  // Add to print queue
  const addToQueue = (product: Product) => {
    const existing = printQueue.find(q => q.productId === product.id)
    if (existing) {
      setPrintQueue(prev =>
        prev.map(q =>
          q.productId === product.id
            ? { ...q, copies: q.copies + getCopies(product.id) }
            : q
        )
      )
    } else {
      setPrintQueue(prev => [
        ...prev,
        { productId: product.id, product, copies: getCopies(product.id) }
      ])
    }
    showNotification('success', 'Agregado', `${product.name} agregado a la cola`)
  }

  // Remove from queue
  const removeFromQueue = (productId: number) => {
    setPrintQueue(prev => prev.filter(q => q.productId !== productId))
  }

  // Print single product (includePrice: true = con precio CUP, false = solo nombre y codigo)
  const printProduct = async (product: Product, copies: number, includePrice: boolean = true) => {
    try {
      setPrinting(true)

      // Calculate price in CUP using ElToque rate
      const priceCUP = includePrice && USD_CUP > 0
        ? Math.round(product.sellingPrice * USD_CUP)
        : undefined

      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'product_label',
          sourceType: 'product',
          sourceId: product.id,
          documentData: {
            productName: product.name,
            sku: product.sku,
            barcode: product.barcode,
            includePrice,
            priceCUP, // Price in CUP (already converted)
            currency: 'CUP',
            expirationDate: product.expirationDate,
            labelSize: 'medium'
          },
          copies
        })
      })

      const data = await response.json()

      if (data.success) {
        const priceInfo = includePrice ? ' con precio' : ' sin precio'
        showNotification('success', 'Imprimiendo', `Enviando ${copies} etiqueta${copies > 1 ? 's' : ''}${priceInfo} de ${product.name}`)
      } else {
        showNotification('error', 'Error', data.error || 'No se pudo imprimir')
      }
    } catch (error) {
      console.error('Error printing:', error)
      showNotification('error', 'Error', 'Error al enviar a imprimir')
    } finally {
      setPrinting(false)
    }
  }

  // Print all in queue (includePrice: true = con precio CUP, false = solo nombre y codigo)
  const printQueueItems = async (includePrice: boolean) => {
    if (printQueue.length === 0) return

    try {
      setPrinting(true)

      for (const item of printQueue) {
        await printProduct(item.product, item.copies, includePrice)
        await new Promise(r => setTimeout(r, 200)) // Small delay between jobs
      }

      setPrintQueue([])
      const priceInfo = includePrice ? 'con precio CUP' : 'sin precio'
      showNotification('success', 'Completado', `Todos los trabajos ${priceInfo} enviados`)
    } catch (error) {
      console.error('Error printing queue:', error)
      showNotification('error', 'Error', 'Error al imprimir cola')
    } finally {
      setPrinting(false)
    }
  }

  // Format price
  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(price)
  }

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Check if expiring soon (within 30 days)
  const isExpiringSoon = (dateStr: string | null) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const thirtyDays = new Date()
    thirtyDays.setDate(thirtyDays.getDate() + 30)
    return date <= thirtyDays
  }

  const totalQueueCopies = printQueue.reduce((sum, q) => sum + q.copies, 0)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingBox text="Cargando..." size="md" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-amber-500 to-orange-600"
            )}>
              <Tag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={cn(
                "text-2xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Etiquetas de Productos
              </h1>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>
                Busca productos e imprime etiquetas con nombre, precio y vencimiento
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, codigo de barras o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full pl-12 pr-4 py-3 rounded-xl border text-base",
              theme === 'dark'
                ? 'bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
            )}
          />
          {searching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
          )}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => {
            const copies = getCopies(product.id)
            const isQueued = printQueue.some(q => q.productId === product.id)
            const expiring = isExpiringSoon(product.expirationDate)

            return (
              <div
                key={product.id}
                className={cn(
                  "rounded-xl border overflow-hidden transition-shadow hover:shadow-lg",
                  theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200',
                  isQueued && 'ring-2 ring-blue-500'
                )}
              >
                {/* Product Image */}
                <div className={cn(
                  "h-32 flex items-center justify-center",
                  theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'
                )}>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-gray-400" />
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className={cn(
                      "font-semibold line-clamp-2",
                      theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                    )}>
                      {product.name}
                    </h3>
                    <p className={cn(
                      "text-xs mt-1",
                      theme === 'dark' ? 'text-zinc-500' : 'text-gray-500'
                    )}>
                      {product.barcode || product.sku}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className={cn(
                        "font-bold",
                        theme === 'dark' ? 'text-zinc-100' : 'text-gray-900'
                      )}>
                        {formatPrice(product.sellingPrice, product.currency)}
                      </span>
                    </div>

                    {product.expirationDate && (
                      <div className={cn(
                        "flex items-center gap-1.5 text-xs px-2 py-1 rounded",
                        expiring
                          ? 'bg-red-500/10 text-red-500'
                          : theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'
                      )}>
                        <Calendar className="w-3 h-3" />
                        {formatDate(product.expirationDate)}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex items-center rounded-lg",
                      theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-100'
                    )}>
                      <button
                        onClick={() => setCopies(product.id, copies - 1)}
                        className="p-2 hover:bg-black/10 rounded-l-lg"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className={cn(
                        "w-10 text-center text-sm font-medium",
                        theme === 'dark' ? 'text-zinc-200' : 'text-gray-700'
                      )}>
                        {copies}
                      </span>
                      <button
                        onClick={() => setCopies(product.id, copies + 1)}
                        className="p-2 hover:bg-black/10 rounded-r-lg"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addToQueue(product)}
                      disabled={isQueued}
                      className="flex-1"
                    >
                      {isQueued ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          En cola
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1" />
                          Cola
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printProduct(product, copies, true)}
                      disabled={printing}
                      title="Imprimir con precio en CUP"
                      className="text-green-600 border-green-300 hover:bg-green-50"
                    >
                      <DollarSign className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printProduct(product, copies, false)}
                      disabled={printing}
                      title="Imprimir sin precio"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}

          {products.length === 0 && !searching && (
            <div className={cn(
              "col-span-full text-center py-12 rounded-xl",
              theme === 'dark' ? 'bg-zinc-900/50' : 'bg-gray-50'
            )}>
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-zinc-400' : 'text-gray-500'
              )}>
                {searchTerm ? 'No se encontraron productos' : 'Busca un producto para imprimir etiquetas'}
              </p>
            </div>
          )}
        </div>

        {/* Print Queue (Fixed at bottom) */}
        {printQueue.length > 0 && (
          <div className={cn(
            "fixed bottom-0 left-0 right-0 p-4 border-t shadow-lg z-50",
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'
          )}>
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className={cn(
                  "text-sm font-medium",
                  theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'
                )}>
                  Cola de impresion:
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {printQueue.map(item => (
                    <div
                      key={item.productId}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
                        theme === 'dark' ? 'bg-zinc-800 text-zinc-200' : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      <span className="truncate max-w-[150px]">{item.product.name}</span>
                      <span className="text-xs opacity-60">x{item.copies}</span>
                      <button
                        onClick={() => removeFromQueue(item.productId)}
                        className="hover:text-red-500"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => printQueueItems(true)}
                  disabled={printing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {printing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <DollarSign className="w-4 h-4 mr-2" />
                  )}
                  Con Precio (CUP)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => printQueueItems(false)}
                  disabled={printing}
                >
                  {printing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4 mr-2" />
                  )}
                  Sin Precio
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Spacer for fixed footer */}
        {printQueue.length > 0 && <div className="h-20" />}
      </div>
    </DashboardLayout>
  )
}
