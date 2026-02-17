'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Clock,
  Search,
  LogIn,
  LogOut,
  Calendar,
  Filter,
  ChevronRight,
  ChevronLeft,
  FileText,
  AlertTriangle,
  CheckCircle,
  User
} from 'lucide-react'

interface Log {
  id: number
  visitorId: number
  visitorName: string
  visitorIdNumber: string
  visitorIdType: string | null
  kioskId: number
  kioskName: string
  kioskLocation: string | null
  entryTime: string
  exitTime: string | null
  visitPurpose: string | null
  visitNotes: string | null
  hostName: string | null
  hasPendingInvoices: boolean
  invoicesValidated: boolean
  status: string
}

export default function DoorLogsPage() {
  const searchParams = useSearchParams()
  const initialStatus = searchParams.get('status') || 'all'

  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    fetchLogs()
  }, [page, statusFilter, dateFilter])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateFilter && { date: dateFilter }),
        ...(search && { search })
      })

      const res = await fetch(`/api/market/door-security/logs?${params}`)
      const data = await res.json()

      if (data.success) {
        setLogs(data.data.logs)
        setTotalPages(data.data.pagination.totalPages)
        setTotal(data.data.pagination.total)
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchLogs()
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateDuration = (entry: string, exit: string | null) => {
    if (!exit) return 'En curso'
    const start = new Date(entry).getTime()
    const end = new Date(exit).getTime()
    const diffMs = end - start
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 60) {
      return `${diffMins} min`
    }
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}h ${mins}m`
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historial de Visitas</h1>
        <p className="text-gray-500">Registro de entradas y salidas</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar visitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Buscar
          </button>
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">Todos los estados</option>
            <option value="active">Adentro ahora</option>
            <option value="completed">Completadas</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value)
              setPage(1)
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Total registros</p>
          <p className="text-2xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Adentro ahora</p>
          <p className="text-2xl font-bold text-green-600">
            {logs.filter(l => l.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Completadas hoy</p>
          <p className="text-2xl font-bold text-gray-600">
            {logs.filter(l => l.status === 'completed').length}
          </p>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visitante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entrada
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Salida
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duración
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motivo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kiosk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            log.status === 'active'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {log.status === 'active' ? (
                              <LogIn className="w-5 h-5" />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{log.visitorName}</p>
                            <p className="text-sm text-gray-500">{log.visitorIdNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-gray-900">{formatDateTime(log.entryTime)}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.exitTime ? (
                          <p className="text-gray-900">{formatDateTime(log.exitTime)}</p>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`font-medium ${
                          !log.exitTime ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {calculateDuration(log.entryTime, log.exitTime)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-600">
                          {log.visitPurpose || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-gray-900">{log.kioskName}</p>
                        {log.kioskLocation && (
                          <p className="text-sm text-gray-500">{log.kioskLocation}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {log.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              Adentro
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                              Salió
                            </span>
                          )}
                          {log.hasPendingInvoices && !log.invoicesValidated && (
                            <span title="Facturas pendientes">
                              <AlertTriangle className="w-4 h-4 text-orange-500" />
                            </span>
                          )}
                          {log.invoicesValidated && (
                            <span title="Facturas validadas">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Página {page} de {totalPages} ({total} registros)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {search || statusFilter !== 'all' || dateFilter
                ? 'No se encontraron registros con los filtros aplicados'
                : 'No hay registros de visitas'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
