'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Package,
  DollarSign,
  Info,
  Loader2,
  Check,
  Gift,
  Smartphone,
  Globe,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface UnivCellProductOption {
  id: string
  univcellProductId: number
  name: string
  description: string | null
  type: 'product' | 'promotion'
  providerAmount: number
  pattern: string
  mask: string
  countryCode: string
  countryName: string
  validFrom?: string
  validTo?: string
  promotionSummary?: string
}

const getCountryFlag = (countryCode: string): string => {
  const flags: Record<string, string> = {
    CU: '🇨🇺',
    MX: '🇲🇽',
    DO: '🇩🇴',
    US: '🇺🇸',
  }
  return flags[countryCode] || '🌍'
}

export default function CreateProductoRecargaPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')

  // Loading states
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Products from UnivCell
  const [univcellProducts, setUnivCellProducts] = useState<UnivCellProductOption[]>([])

  // Selected product details
  const selectedProduct = univcellProducts.find((p) => p.id === selectedProductId)

  // Calculate profit
  const profit =
    costPrice && sellingPrice
      ? parseFloat(sellingPrice) - parseFloat(costPrice)
      : 0

  // Fetch UnivCell products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true)
        const response = await fetch('/api/recharges/univcell-products')
        const data = await response.json()

        if (data.success) {
          setUnivCellProducts(data.data.products)
        } else {
          showNotification('error', 'Error', data.error || 'Error al cargar productos del proveedor')
        }
      } catch (error) {
        console.error('Error fetching products:', error)
        showNotification('error', 'Error', 'Error al cargar productos del proveedor')
      } finally {
        setLoadingProducts(false)
      }
    }

    fetchProducts()
  }, [])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      showNotification('error', 'Campo requerido', 'El nombre es requerido')
      return
    }

    if (!selectedProduct) {
      showNotification('error', 'Campo requerido', 'Debe seleccionar un producto del proveedor')
      return
    }

    if (!costPrice || parseFloat(costPrice) <= 0) {
      showNotification('error', 'Campo requerido', 'El precio de costo debe ser mayor a 0')
      return
    }

    if (!sellingPrice || parseFloat(sellingPrice) <= 0) {
      showNotification('error', 'Campo requerido', 'El precio de venta debe ser mayor a 0')
      return
    }

    if (parseFloat(sellingPrice) < parseFloat(costPrice)) {
      showNotification('error', 'Precio invalido', 'El precio de venta no puede ser menor al precio de costo')
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch('/api/recharges/products/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          univcellProductId: selectedProduct.univcellProductId,
          isPromotion: selectedProduct.type === 'promotion',
          promotionId: selectedProduct.type === 'promotion' ? selectedProduct.id.replace('promo-', '') : null,
          providerAmount: selectedProduct.providerAmount,
          costPrice: parseFloat(costPrice),
          sellingPrice: parseFloat(sellingPrice),
          pattern: selectedProduct.pattern,
          mask: selectedProduct.mask,
          countryCode: selectedProduct.countryCode,
          countryName: selectedProduct.countryName,
          validFrom: selectedProduct.validFrom,
          validTo: selectedProduct.validTo,
        }),
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Exito', 'Producto creado exitosamente')
        router.push('/dashboard/admin/recargas/productos')
      } else {
        showNotification('error', 'Error', data.error || 'Error al crear producto')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      showNotification('error', 'Error', 'Error al crear producto')
    } finally {
      setSubmitting(false)
    }
  }

  // Separate products and promotions
  const regularProducts = univcellProducts.filter((p) => p.type === 'product')
  const promotions = univcellProducts.filter((p) => p.type === 'promotion')

  return (
    <ProtectedRoute requiredRole="SUPER_ADMIN">
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4"
            >
              <Link href="/dashboard/admin/recargas/productos">
                <button
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div>
                <h1
                  className={cn(
                    'text-2xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                >
                  Crear Producto de Recarga
                </h1>
                <p
                  className={cn(
                    'text-sm',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}
                >
                  Configura un nuevo producto con precios personalizados
                </p>
              </div>
            </motion.div>

            {/* Form */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit}
              className={cn(
                'p-6 rounded-xl border space-y-6',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              {/* Name */}
              <div>
                <label
                  className={cn(
                    'block text-sm font-medium mb-2',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}
                >
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Recarga Cubacel Ilimitada"
                  className={cn(
                    'w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-exa-primary',
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  )}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className={cn(
                    'block text-sm font-medium mb-2',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}
                >
                  Descripcion
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripcion del servicio..."
                  rows={3}
                  className={cn(
                    'w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-exa-primary resize-none',
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  )}
                />
              </div>

              {/* Product Select */}
              <div>
                <label
                  className={cn(
                    'block text-sm font-medium mb-2',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}
                >
                  Producto del Proveedor *
                </label>

                {loadingProducts ? (
                  <div
                    className={cn(
                      'flex items-center justify-center py-8 rounded-lg border',
                      theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                    )}
                  >
                    <Loader2 className="w-6 h-6 animate-spin text-exa-primary" />
                    <span className="ml-2">Cargando productos...</span>
                  </div>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-exa-primary',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  >
                    <option value="">Seleccionar producto...</option>

                    {regularProducts.length > 0 && (
                      <optgroup label="PRODUCTOS">
                        {regularProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {getCountryFlag(product.countryCode)} {product.name} - ${product.providerAmount.toFixed(2)}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {promotions.length > 0 && (
                      <optgroup label="PROMOCIONES">
                        {promotions.map((product) => (
                          <option key={product.id} value={product.id}>
                            🎁 {product.name} - ${product.providerAmount.toFixed(2)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              {/* Selected Product Info */}
              {selectedProduct && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={cn(
                    'p-4 rounded-lg border',
                    theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-blue-50 border-blue-200'
                  )}
                >
                  <div className="flex items-start gap-2 mb-3">
                    <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span
                      className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
                      )}
                    >
                      Informacion del Producto Seleccionado
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Monto a enviar al proveedor (fijo):
                      </span>
                      <span
                        className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}
                      >
                        ${selectedProduct.providerAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Patron de validacion:
                      </span>
                      <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                        {selectedProduct.mask || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                        Tipo:
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          selectedProduct.type === 'promotion'
                            ? 'bg-purple-500/10 text-purple-500'
                            : 'bg-blue-500/10 text-blue-500'
                        )}
                      >
                        {selectedProduct.type === 'promotion' ? 'Promocion' : 'Producto'}
                      </span>
                    </div>
                    {selectedProduct.validFrom && selectedProduct.validTo && (
                      <div className="flex justify-between">
                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                          Valido:
                        </span>
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                          {new Date(selectedProduct.validFrom).toLocaleDateString('es-ES')} -{' '}
                          {new Date(selectedProduct.validTo).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedProduct.description && (
                    <div
                      className={cn(
                        'mt-3 pt-3 border-t text-sm',
                        theme === 'dark'
                          ? 'border-gray-600 text-gray-300'
                          : 'border-blue-200 text-gray-700'
                      )}
                    >
                      {selectedProduct.description}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Prices */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className={cn(
                      'block text-sm font-medium mb-2',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}
                  >
                    Precio de Costo * (Tu costo real)
                  </label>
                  <div className="relative">
                    <DollarSign
                      className={cn(
                        'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        'w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-exa-primary',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      )}
                    />
                  </div>
                  <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                    Tu costo real despues del descuento del proveedor
                  </p>
                </div>

                <div>
                  <label
                    className={cn(
                      'block text-sm font-medium mb-2',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}
                  >
                    Precio de Venta * (Lo que cobras)
                  </label>
                  <div className="relative">
                    <DollarSign
                      className={cn(
                        'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        'w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-exa-primary',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      )}
                    />
                  </div>
                  <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                    Lo que le cobras a las empresas
                  </p>
                </div>
              </div>

              {/* Profit Display */}
              {costPrice && sellingPrice && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    'p-4 rounded-lg border text-center',
                    profit > 0
                      ? theme === 'dark'
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-green-50 border-green-200'
                      : profit < 0
                        ? theme === 'dark'
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-red-50 border-red-200'
                        : theme === 'dark'
                          ? 'bg-gray-700 border-gray-600'
                          : 'bg-gray-100 border-gray-200'
                  )}
                >
                  <p
                    className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}
                  >
                    Ganancia estimada por recarga
                  </p>
                  <p
                    className={cn(
                      'text-3xl font-bold mt-1',
                      profit > 0
                        ? 'text-green-500'
                        : profit < 0
                          ? 'text-red-500'
                          : theme === 'dark'
                            ? 'text-gray-300'
                            : 'text-gray-700'
                    )}
                  >
                    ${profit.toFixed(2)}
                  </p>
                </motion.div>
              )}

              {/* Warning if negative profit */}
              {profit < 0 && (
                <div
                  className={cn(
                    'p-3 rounded-lg flex items-center gap-2',
                    theme === 'dark'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-red-50 text-red-600'
                  )}
                >
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">
                    El precio de venta es menor al costo. Tendras perdidas.
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <Link href="/dashboard/admin/recargas/productos" className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      'w-full',
                      theme === 'dark'
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    Cancelar
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={submitting || !selectedProduct || !name || !costPrice || !sellingPrice}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2',
                    'bg-exa-primary hover:bg-exa-secondary text-white disabled:opacity-50'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Crear Producto
                    </>
                  )}
                </Button>
              </div>
            </motion.form>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
