'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  Search,
  User,
  Calendar,
  MapPin,
  Clock,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Eye
} from 'lucide-react'

interface Visitor {
  id: number
  fullName: string
  idType: string | null
  idNumber: string
  dateOfBirth: string | null
  address: string | null
  nationality: string | null
  gender: string | null
  firstVisit: string
  lastVisit: string | null
  totalVisits: number
  isCurrentlyInside: boolean
}

interface VisitorDetail {
  visitor: Visitor
  isCurrentlyInside: boolean
  activeLog: {
    id: number
    entryTime: string
    visitPurpose: string
    kioskName: string
  } | null
  recentHistory: Array<{
    id: number
    entryTime: string
    exitTime: string | null
    visitPurpose: string
    status: string
    kioskName: string
  }>
}

export default function DoorVisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorDetail | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    fetchVisitors()
  }, [page, search])

  const fetchVisitors = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search })
      })

      const res = await fetch(`/api/market/door-security/visitors?${params}`)
      const data = await res.json()

      if (data.success) {
        setVisitors(data.data.visitors)
        setTotalPages(data.data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Error fetching visitors:', error)
    } finally {
      setLoading(false)
    }
  }

  const viewVisitorDetails = async (visitorId: number) => {
    try {
      const res = await fetch(`/api/market/door-security/visitors/${visitorId}`)
      const data = await res.json()

      if (data.success) {
        setSelectedVisitor(data.data)
        setShowDetailModal(true)
      }
    } catch (error) {
      console.error('Error fetching visitor details:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchVisitors()
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Visitantes</h1>
        <p className="text-gray-500 dark:text-gray-400">Registro histórico de visitantes</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          Buscar
        </button>
      </form>

      {/* Visitors List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : visitors.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Visitante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Identificación
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Visitas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Última Visita
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {visitors.map(visitor => (
                    <tr key={visitor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{visitor.fullName}</p>
                            {visitor.nationality && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">{visitor.nationality}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900 dark:text-white">{visitor.idNumber}</span>
                        </div>
                        {visitor.idType && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{visitor.idType}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900 dark:text-white">{visitor.totalVisits}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-gray-900 dark:text-white">{formatDate(visitor.lastVisit)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Primera: {formatDate(visitor.firstVisit)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {visitor.isCurrentlyInside ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Adentro
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm">
                            Afuera
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => viewVisitorDetails(visitor.id)}
                          className="p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg"
                          title="Ver detalles"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search ? 'No se encontraron visitantes' : 'No hay visitantes registrados'}
            </p>
          </div>
        )}
      </div>

      {/* Visitor Detail Modal */}
      {showDetailModal && selectedVisitor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl m-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedVisitor.visitor.fullName}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                      {selectedVisitor.visitor.idType}: {selectedVisitor.visitor.idNumber}
                    </p>
                    {selectedVisitor.isCurrentlyInside && (
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Actualmente adentro
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total de visitas</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedVisitor.visitor.totalVisits}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Primera visita</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatDate(selectedVisitor.visitor.firstVisit)}
                  </p>
                </div>
                {selectedVisitor.visitor.dateOfBirth && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Fecha de nacimiento
                    </p>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      {formatDate(selectedVisitor.visitor.dateOfBirth)}
                    </p>
                  </div>
                )}
                {selectedVisitor.visitor.address && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Dirección
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                      {selectedVisitor.visitor.address}
                    </p>
                  </div>
                )}
              </div>

              {/* Active Log */}
              {selectedVisitor.activeLog && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                  <h3 className="font-medium text-green-800 dark:text-green-400 mb-2">Visita activa</h3>
                  <div className="flex items-center gap-4 text-sm text-green-700 dark:text-green-300">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Entrada: {formatDateTime(selectedVisitor.activeLog.entryTime)}
                    </span>
                    <span>
                      Motivo: {selectedVisitor.activeLog.visitPurpose || 'No especificado'}
                    </span>
                    <span>
                      Kiosk: {selectedVisitor.activeLog.kioskName}
                    </span>
                  </div>
                </div>
              )}

              {/* Recent History */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Historial reciente</h3>
                <div className="space-y-2">
                  {selectedVisitor.recentHistory.length > 0 ? (
                    selectedVisitor.recentHistory.map(log => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatDateTime(log.entryTime)}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {log.visitPurpose || 'Sin motivo'} • {log.kioskName}
                          </p>
                        </div>
                        <div className="text-right">
                          {log.exitTime ? (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Salida: {formatDateTime(log.exitTime)}
                            </p>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">
                              Activa
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500 text-sm">Sin historial</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedVisitor(null)
                }}
                className="w-full py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
