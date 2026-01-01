'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  Users,
  Box,
  Loader2,
  ArrowRight,
  Calendar,
  DollarSign,
  Filter,
  X
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: number | string
  type: 'consignment' | 'purchase' | 'pickup_order' | 'office_order' | 'product' | 'customer'
  title: string
  subtitle: string
  status?: string
  date?: string
  amount?: number
  url: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  consignment: { label: 'Consignacion', icon: Package, color: 'emerald' },
  purchase: { label: 'Compra', icon: ShoppingCart, color: 'blue' },
  pickup_order: { label: 'Orden Pickup', icon: Truck, color: 'purple' },
  office_order: { label: 'Orden Oficina', icon: FileText, color: 'orange' },
  product: { label: 'Producto', icon: Box, color: 'pink' },
  customer: { label: 'Cliente', icon: Users, color: 'cyan' }
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  pendiente: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  confirmed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  comprada: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  received: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  recibido: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  delivered: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  in_stock: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  out_of_stock: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' }
}

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { theme } = useTheme()

  const initialQuery = searchParams.get('q') || ''
  const initialType = searchParams.get('type') || 'all'

  const [query, setQuery] = useState(initialQuery)
  const [searchType, setSearchType] = useState(initialType)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const performSearch = useCallback(async (searchQuery: string, type: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&type=${type}&limit=50`)
      const data = await response.json()

      if (data.success) {
        setResults(data.data.results)
      } else {
        setResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, initialType)
    }
  }, [initialQuery, initialType, performSearch])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.length >= 2) {
      router.push(`/dashboard/search?q=${encodeURIComponent(query)}&type=${searchType}`)
      performSearch(query, searchType)
    }
  }

  const handleTypeChange = (type: string) => {
    setSearchType(type)
    if (query.length >= 2) {
      router.push(`/dashboard/search?q=${encodeURIComponent(query)}&type=${type}`)
      performSearch(query, type)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className={cn(
            'text-2xl font-bold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Busqueda Global
          </h1>
          <p className={cn(
            'text-sm mt-1',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Busca ordenes, productos, clientes y mas
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className={cn(
            'flex items-center gap-3 p-2 rounded-2xl border',
            theme === 'dark'
              ? 'bg-gray-900 border-gray-700'
              : 'bg-white border-gray-200 shadow-sm'
          )}>
            <Search className={cn(
              'w-6 h-6 ml-4',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por numero de orden, nombre, telefono, SKU..."
              className={cn(
                'flex-1 py-3 bg-transparent focus:outline-none text-lg',
                theme === 'dark' ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              )}
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setResults([])
                  setSearched(false)
                }}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={query.length < 2}
              className={cn(
                'px-6 py-3 rounded-xl font-medium transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                theme === 'dark'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              )}
            >
              Buscar
            </button>
          </div>

          {/* Type Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleTypeChange('all')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                searchType === 'all'
                  ? theme === 'dark'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <Filter className="w-4 h-4 inline mr-2" />
              Todos
            </button>
            {Object.entries(TYPE_CONFIG).map(([key, config]) => {
              const Icon = config.icon
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTypeChange(key)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                    searchType === key
                      ? theme === 'dark'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-500 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {config.label}
                </button>
              )
            })}
          </div>
        </form>

        {/* Results */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : searched && results.length === 0 ? (
            <div className={cn(
              'text-center py-16 rounded-2xl border',
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'
            )}>
              <Search className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
              <p className={cn(
                'text-lg font-medium',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                No se encontraron resultados
              </p>
              <p className={cn(
                'text-sm mt-1',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              )}>
                Intenta con otros terminos de busqueda
              </p>
            </div>
          ) : results.length > 0 ? (
            <>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {results.length} resultado{results.length !== 1 ? 's' : ''} para "{initialQuery}"
              </p>

              {searchType === 'all' ? (
                // Grouped by type
                Object.entries(groupedResults).map(([type, typeResults]) => {
                  const config = TYPE_CONFIG[type]
                  const Icon = config?.icon || Package
                  return (
                    <div key={type} className="space-y-3">
                      <h3 className={cn(
                        'font-semibold flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Icon className="w-5 h-5" />
                        {config?.label || type} ({typeResults.length})
                      </h3>
                      <div className="grid gap-3">
                        {typeResults.map((result) => (
                          <ResultCard key={`${result.type}-${result.id}`} result={result} theme={theme} formatDate={formatDate} formatCurrency={formatCurrency} />
                        ))}
                      </div>
                    </div>
                  )
                })
              ) : (
                // Flat list
                <div className="grid gap-3">
                  {results.map((result) => (
                    <ResultCard key={`${result.type}-${result.id}`} result={result} theme={theme} formatDate={formatDate} formatCurrency={formatCurrency} />
                  ))}
                </div>
              )}
            </>
          ) : !searched ? (
            <div className={cn(
              'text-center py-16 rounded-2xl border-2 border-dashed',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <Search className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
              <p className={cn(
                'text-lg font-medium',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Escribe para buscar
              </p>
              <p className={cn(
                'text-sm mt-1',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}>
                Busca ordenes, productos, clientes y mas
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ResultCard({
  result,
  theme,
  formatDate,
  formatCurrency
}: {
  result: SearchResult
  theme: string
  formatDate: (date: string) => string
  formatCurrency: (amount: number) => string
}) {
  const config = TYPE_CONFIG[result.type]
  const Icon = config?.icon || Package
  const statusColors = result.status ? STATUS_COLORS[result.status] || STATUS_COLORS.pending : null

  return (
    <Link href={result.url}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          'p-4 rounded-xl border transition-all cursor-pointer group',
          theme === 'dark'
            ? 'bg-gray-900 border-gray-700 hover:border-gray-600'
            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
          )}>
            <Icon className={cn(
              'w-6 h-6',
              config?.color === 'emerald' && 'text-emerald-500',
              config?.color === 'blue' && 'text-blue-500',
              config?.color === 'purple' && 'text-purple-500',
              config?.color === 'orange' && 'text-orange-500',
              config?.color === 'pink' && 'text-pink-500',
              config?.color === 'cyan' && 'text-cyan-500',
              !config?.color && 'text-gray-500'
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={cn(
                'font-medium truncate',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {result.title}
              </p>
              {statusColors && result.status && (
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  statusColors.bg,
                  statusColors.text
                )}>
                  {result.status}
                </span>
              )}
            </div>
            <p className={cn(
              'text-sm truncate',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              {result.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            {result.date && (
              <div className="text-right hidden sm:block">
                <p className={cn(
                  'text-xs',
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )}>
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {formatDate(result.date)}
                </p>
              </div>
            )}
            {result.amount !== undefined && result.amount > 0 && (
              <div className="text-right">
                <p className={cn(
                  'font-semibold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {formatCurrency(result.amount)}
                </p>
              </div>
            )}
            <ArrowRight className={cn(
              'w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )} />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export default function SearchPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        }>
          <SearchContent />
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
