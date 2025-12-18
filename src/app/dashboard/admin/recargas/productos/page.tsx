'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Plus,
  Package,
  DollarSign,
  TrendingUp,
  Gift,
  Smartphone,
  Globe,
  Edit,
  Trash2,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface RechargeProduct {
  id: number
  externalId: number
  slug: string
  name: string
  description: string | null
  costPrice: number | null
  sellingPrice: number | null
  providerAmount: number
  isPromotion: boolean
  promotionId: string | null
  univcellProductId: number
  countryCode: string
  countryName: string
  pattern: string
  mask: string
  isActive: boolean
  validFrom: string | null
  validTo: string | null
  profit: number | null
  createdAt: string
  updatedAt: string
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

export default function ProductosRecargaPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const [products, setProducts] = useState<RechargeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState<'all' | 'product' | 'promotion'>('all')

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/recharges/products/create')
      const data = await response.json()

      if (data.success) {
        setProducts(data.data.products)
      } else {
        showNotification('error', 'Error', data.error || 'Error al cargar productos')
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      showNotification('error', 'Error', 'Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'promotion' && product.isPromotion) ||
      (filter === 'product' && !product.isPromotion)
    return matchesSearch && matchesFilter
  })

  // Stats
  const totalProducts = products.length
  const totalPromotions = products.filter((p) => p.isPromotion).length
  const totalProfit = products.reduce((sum, p) => sum + (p.profit || 0), 0)

  return (
    <ProtectedRoute requiredRole="SUPER_ADMIN">
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between"
            >
              <div>
                <h1
                  className={cn(
                    'text-3xl font-bold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                >
                  Productos de Recarga
                </h1>
                <p
                  className={cn(
                    'mt-2 text-sm',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}
                >
                  Gestiona los productos de recarga con precios personalizados
                </p>
              </div>

              <Link href="/dashboard/admin/recargas/productos/create">
                <Button
                  className={cn(
                    'flex items-center gap-2',
                    theme === 'dark'
                      ? 'bg-exa-primary hover:bg-exa-secondary text-white'
                      : 'bg-exa-primary hover:bg-exa-secondary text-white'
                  )}
                >
                  <Plus className="w-4 h-4" />
                  Crear Producto
                </Button>
              </Link>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                {
                  icon: Package,
                  label: 'Total Productos',
                  value: totalProducts,
                  color: 'blue',
                },
                {
                  icon: Gift,
                  label: 'Promociones',
                  value: totalPromotions,
                  color: 'purple',
                },
                {
                  icon: Smartphone,
                  label: 'Productos Regulares',
                  value: totalProducts - totalPromotions,
                  color: 'green',
                },
                {
                  icon: TrendingUp,
                  label: 'Ganancia Total/Unidad',
                  value: `$${totalProfit.toFixed(2)}`,
                  color: 'amber',
                },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'p-4 rounded-xl border',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        stat.color === 'blue' && 'bg-blue-500/10 text-blue-500',
                        stat.color === 'purple' && 'bg-purple-500/10 text-purple-500',
                        stat.color === 'green' && 'bg-green-500/10 text-green-500',
                        stat.color === 'amber' && 'bg-amber-500/10 text-amber-500'
                      )}
                    >
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p
                        className={cn(
                          'text-xs',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}
                      >
                        {stat.label}
                      </p>
                      <p
                        className={cn(
                          'text-xl font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}
                      >
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search
                  className={cn(
                    'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}
                />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-exa-primary',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  )}
                />
              </div>

              <div className="flex gap-2">
                {(['all', 'product', 'promotion'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      filter === f
                        ? 'bg-exa-primary text-white'
                        : theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {f === 'all' ? 'Todos' : f === 'product' ? 'Productos' : 'Promociones'}
                  </button>
                ))}

                <button
                  onClick={fetchProducts}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
                </button>
              </div>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-exa-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn(
                  'text-center py-12 rounded-xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}
              >
                <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p
                  className={cn(
                    'text-lg font-medium',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}
                >
                  No hay productos
                </p>
                <p className={cn('text-sm mt-2', theme === 'dark' ? 'text-gray-500' : 'text-gray-600')}>
                  Crea tu primer producto de recarga
                </p>
                <Link href="/dashboard/admin/recargas/productos/create">
                  <Button className="mt-4 bg-exa-primary hover:bg-exa-secondary text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Producto
                  </Button>
                </Link>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'p-4 rounded-xl border relative overflow-hidden',
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                  >
                    {/* Badge */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          product.isPromotion
                            ? 'bg-purple-500/10 text-purple-500'
                            : 'bg-blue-500/10 text-blue-500'
                        )}
                      >
                        {product.isPromotion ? 'Promocion' : 'Producto'}
                      </span>
                    </div>

                    {/* Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className={cn(
                          'p-2 rounded-lg text-2xl',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}
                      >
                        {getCountryFlag(product.countryCode)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className={cn(
                            'font-semibold truncate',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}
                        >
                          {product.name}
                        </h3>
                        <p
                          className={cn(
                            'text-xs truncate',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}
                        >
                          {product.countryName}
                        </p>
                      </div>
                    </div>

                    {/* Prices */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center">
                        <span
                          className={cn(
                            'text-xs',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}
                        >
                          Monto Proveedor:
                        </span>
                        <span
                          className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}
                        >
                          ${product.providerAmount?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={cn(
                            'text-xs',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}
                        >
                          Tu Costo:
                        </span>
                        <span
                          className={cn(
                            'font-medium',
                            theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                          )}
                        >
                          ${product.costPrice?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={cn(
                            'text-xs',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}
                        >
                          Precio Venta:
                        </span>
                        <span
                          className={cn(
                            'font-bold text-lg',
                            theme === 'dark' ? 'text-green-400' : 'text-green-600'
                          )}
                        >
                          ${product.sellingPrice?.toFixed(2)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          'flex justify-between items-center pt-2 border-t',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}
                      >
                        <span
                          className={cn(
                            'text-xs font-medium',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}
                        >
                          Ganancia:
                        </span>
                        <span className="font-bold text-exa-primary">
                          ${product.profit?.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Validity for promotions */}
                    {product.isPromotion && product.validTo && (
                      <div
                        className={cn(
                          'text-xs mb-4 p-2 rounded-lg',
                          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                        )}
                      >
                        Valido hasta: {new Date(product.validTo).toLocaleDateString('es-ES')}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        )}
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        className={cn(
                          'flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors',
                          theme === 'dark'
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
