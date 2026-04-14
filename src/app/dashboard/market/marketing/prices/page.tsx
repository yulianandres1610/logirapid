'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Search,
  Tag,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  RefreshCw,
  Filter
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PriceFinding {
  id: number
  productName: string
  foundPrice: number
  ourPrice: number
  diffPercent: number
  source: string
  platform: string
  confidence: number
  foundAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const PLATFORMS = [
  { value: 'all', label: 'Todos' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'web', label: 'Web' }
]

const PLATFORM_BADGE: Record<string, { bg: string; text: string }> = {
  facebook: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400' },
  whatsapp: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  telegram: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  web: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400' },
  instagram: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400' }
}

function getDiffColor(diff: number): string {
  if (diff < -5) return 'text-emerald-600 dark:text-emerald-400'
  if (diff > 5) return 'text-red-600 dark:text-red-400'
  return 'text-amber-600 dark:text-amber-400'
}

function getDiffBg(diff: number): string {
  if (diff < -5) return 'bg-emerald-50 dark:bg-emerald-900/20'
  if (diff > 5) return 'bg-red-50 dark:bg-red-900/20'
  return 'bg-amber-50 dark:bg-amber-900/20'
}

function getDiffIcon(diff: number) {
  if (diff < -5) return TrendingDown
  if (diff > 5) return TrendingUp
  return Minus
}

export default function PricesPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [findings, setFindings] = useState<PriceFinding[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState('all')
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })

  useEffect(() => {
    fetchFindings()
  }, [platform, pagination.page])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }))
      fetchFindings()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchFindings = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (search) params.set('search', search)
      if (platform !== 'all') params.set('platform', platform)

      const response = await fetch(`/api/mkt/price-findings?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const mapped = (result.data?.findings || []).map((f: any) => ({
            id: f.id,
            productName: f.product_name || f.found_name || f.search_term || 'Sin nombre',
            foundPrice: parseFloat(f.found_price) || 0,
            ourPrice: parseFloat(f.our_price || f.current_price) || 0,
            diffPercent: parseFloat(f.price_diff_pct) || 0,
            source: f.source_name || '-',
            platform: f.source_platform || 'web',
            confidence: Math.round((parseFloat(f.match_confidence) || 0) * 100),
            foundAt: f.captured_at || ''
          }))
          setFindings(mapped)
          if (result.data?.pagination) {
            setPagination(result.data.pagination)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching price findings:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Link href="/dashboard/market/marketing">
                <button className={cn(
                  'p-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                )}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Hallazgos de Precios</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{pagination.total} resultados encontrados</p>
              </div>
            </div>
          </motion.div>

          {/* Search + Platform Filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                )}
              />
            </div>

            {/* Platform Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PLATFORMS.map(p => (
                <button
                  key={p.value}
                  onClick={() => { setPlatform(p.value); setPagination(prev => ({ ...prev, page: 1 })) }}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                    platform === p.value
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                      : theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              'rounded-2xl border shadow-sm overflow-hidden',
              theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
            )}
          >
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Cargando...</p>
              </div>
            ) : findings.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">Sin hallazgos</p>
                <p className="text-sm">No se encontraron precios con los filtros actuales</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'text-xs font-medium uppercase',
                      theme === 'dark' ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-50 text-gray-500'
                    )}>
                      <th className="text-left py-3 px-4">Producto</th>
                      <th className="text-right py-3 px-4">Precio Encontrado</th>
                      <th className="text-right py-3 px-4">Nuestro Precio</th>
                      <th className="text-right py-3 px-4">Diferencia</th>
                      <th className="text-left py-3 px-4">Fuente</th>
                      <th className="text-center py-3 px-4">Plataforma</th>
                      <th className="text-center py-3 px-4">Confianza</th>
                      <th className="text-right py-3 px-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {findings.map((finding, i) => {
                      const DiffIcon = getDiffIcon(finding.diffPercent)
                      const platformStyle = PLATFORM_BADGE[finding.platform] || PLATFORM_BADGE.web

                      return (
                        <motion.tr
                          key={finding.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className={cn(
                            'transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-3 px-4">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{finding.productName}</p>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              ${finding.foundPrice.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              ${finding.ourPrice.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full',
                              getDiffColor(finding.diffPercent),
                              getDiffBg(finding.diffPercent)
                            )}>
                              <DiffIcon className="w-3 h-3" />
                              {finding.diffPercent > 0 ? '+' : ''}{finding.diffPercent.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{finding.source}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium',
                              platformStyle.bg, platformStyle.text
                            )}>
                              {finding.platform}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <div className={cn('h-1.5 rounded-full w-12', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100')}>
                                <div
                                  className={cn(
                                    'h-full rounded-full',
                                    finding.confidence >= 80 ? 'bg-emerald-500' :
                                    finding.confidence >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                  )}
                                  style={{ width: `${finding.confidence}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{finding.confidence}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-xs text-gray-400">
                              {new Date(finding.foundAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                            </span>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className={cn(
                'flex items-center justify-between px-4 py-3 border-t',
                theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
              )}>
                <p className="text-xs text-gray-500">
                  Pagina {pagination.page} de {pagination.totalPages} ({pagination.total} resultados)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page <= 1}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors disabled:opacity-30',
                      theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors disabled:opacity-30',
                      theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                    )}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
