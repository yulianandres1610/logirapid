'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Tag,
  Plus,
  Search,
  Edit,
  Trash2,
  Star,
  CheckCircle,
  XCircle,
  Loader2,
  DollarSign,
  Calendar,
  Package
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Pricelist {
  id: number
  name: string
  code: string | null
  type: string
  currency: string
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  isDefault: boolean
  itemsCount: number
  createdAt: string
}

export default function PricelistsPage() {
  const { theme } = useTheme()
  const [pricelists, setPricelists] = useState<Pricelist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteModalId, setDeleteModalId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchPricelists()
  }, [])

  const fetchPricelists = async () => {
    try {
      const response = await fetch('/api/market/pricelists')
      const data = await response.json()
      if (data.success) {
        setPricelists(data.data.pricelists)
      }
    } catch (error) {
      console.error('Error fetching pricelists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/market/pricelists/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setPricelists(prev => prev.filter(p => p.id !== id))
        setDeleteModalId(null)
      } else {
        alert(data.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Error deleting pricelist:', error)
    } finally {
      setDeleting(false)
    }
  }

  const filteredPricelists = pricelists.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Listas de Precios
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Gestiona precios especiales, promociones y descuentos por cantidad
                </p>
              </div>
              <Link href="/dashboard/market/pricelists/create">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Lista
                </motion.button>
              </Link>
            </div>

            {/* Search */}
            <div className={cn(
              'relative max-w-md',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar lista de precios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700 focus:ring-blue-500/20'
                    : 'bg-white border-gray-200 focus:ring-blue-500/20'
                )}
              />
            </div>

            {/* Loading */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : filteredPricelists.length === 0 ? (
              <div className={cn(
                'text-center py-20 rounded-2xl border-2 border-dashed',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <Tag className={cn(
                  'w-16 h-16 mx-auto mb-4',
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                )} />
                <h3 className={cn(
                  'text-lg font-semibold mb-2',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {searchTerm ? 'No se encontraron resultados' : 'No hay listas de precios'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm ? 'Intenta con otro término de búsqueda' : 'Crea tu primera lista de precios para aplicar precios especiales'}
                </p>
                {!searchTerm && (
                  <Link href="/dashboard/market/pricelists/create">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
                    >
                      <Plus className="w-4 h-4" />
                      Crear Lista de Precios
                    </motion.button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPricelists.map((pricelist, index) => (
                  <motion.div
                    key={pricelist.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      'relative overflow-hidden rounded-2xl border shadow-xl transition-all hover:shadow-2xl',
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                        : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                    )}
                  >
                    {/* Top accent */}
                    <div className={cn(
                      "absolute top-0 left-0 w-full h-1",
                      pricelist.isDefault
                        ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                        : pricelist.isActive
                        ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                        : 'bg-gradient-to-r from-gray-400 to-gray-600'
                    )} />

                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center relative',
                            pricelist.isActive
                              ? theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                              : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                          )}>
                            <Tag className={cn(
                              'w-6 h-6',
                              pricelist.isActive
                                ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                : 'text-gray-400'
                            )} />
                            {pricelist.isDefault && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                <Star className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className={cn(
                              'font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {pricelist.name}
                            </h3>
                            {pricelist.code && (
                              <p className="text-xs text-gray-500 font-mono">{pricelist.code}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/market/pricelists/${pricelist.id}/edit`}>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className={cn(
                                'p-2 rounded-lg transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                              )}
                            >
                              <Edit className="w-4 h-4 text-gray-500" />
                            </motion.button>
                          </Link>
                          {!pricelist.isDefault && (
                            <motion.button
                              onClick={() => setDeleteModalId(pricelist.id)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className={cn(
                                'p-2 rounded-lg transition-colors',
                                theme === 'dark' ? 'hover:bg-red-900/30' : 'hover:bg-red-50'
                              )}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </motion.button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Productos</span>
                          <span className={cn(
                            'font-medium flex items-center gap-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            <Package className="w-4 h-4" />
                            {pricelist.itemsCount}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Moneda</span>
                          <span className={cn(
                            'font-medium flex items-center gap-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            <DollarSign className="w-4 h-4" />
                            {pricelist.currency}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Vigencia</span>
                          <span className="text-gray-400 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {pricelist.validFrom || pricelist.validUntil
                              ? `${formatDate(pricelist.validFrom)} - ${formatDate(pricelist.validUntil)}`
                              : 'Sin límite'
                            }
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-gray-500">Estado</span>
                          <span className={cn(
                            'flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium',
                            pricelist.isActive
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          )}>
                            {pricelist.isActive ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Activa
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                Inactiva
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Delete Modal */}
          {deleteModalId && (
            <>
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                onClick={() => setDeleteModalId(null)}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    'w-full max-w-md rounded-2xl shadow-2xl border p-6',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}
                >
                  <h3 className={cn(
                    'text-lg font-bold mb-2',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    ¿Eliminar lista de precios?
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Esta acción no se puede deshacer. Se eliminarán todos los items de esta lista.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteModalId(null)}
                      disabled={deleting}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-xl font-medium transition-colors',
                        theme === 'dark'
                          ? 'bg-gray-700 text-white hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleDelete(deleteModalId)}
                      disabled={deleting}
                      className="flex-1 px-4 py-2 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
