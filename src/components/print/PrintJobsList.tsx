'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Printer
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PrintJob {
  id: number
  jobNumber: string
  documentType: string
  sourceType: string | null
  sourceId: number | null
  copies: number
  status: 'pending' | 'sent' | 'printing' | 'completed' | 'failed'
  attempts: number
  errorMessage: string | null
  serviceName: string | null
  printerName: string | null
  requestedByEmail: string | null
  createdAt: string
  sentAt: string | null
  completedAt: string | null
}

interface PrintJobsListProps {
  status?: string
  documentType?: string
  limit?: number
  showPagination?: boolean
  autoRefresh?: boolean
  className?: string
  onJobClick?: (job: PrintJob) => void
}

export function PrintJobsList({
  status,
  documentType,
  limit = 10,
  showPagination = true,
  autoRefresh = true,
  className,
  onJobClick
}: PrintJobsListProps) {
  const [jobs, setJobs] = useState<PrintJob[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(status && { status }),
        ...(documentType && { documentType })
      })

      const response = await fetch(`/api/print-jobs?${params}`)
      if (response.ok) {
        const data = await response.json()
        setJobs(data.data || [])
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Error fetching print jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [page, limit, status, documentType])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(fetchJobs, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchJobs])

  const getStatusBadge = (jobStatus: string) => {
    switch (jobStatus) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="w-3 h-3" />
            Completado
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="w-3 h-3" />
            Fallido
          </span>
        )
      case 'printing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Imprimiendo
          </span>
        )
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <Printer className="w-3 h-3" />
            Enviado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        )
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDocTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pos_receipt: 'Recibo POS',
      shipping_label: 'Etiqueta Envío',
      product_label: 'Etiqueta Producto',
      invoice: 'Factura'
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <FileText className="w-10 h-10 mx-auto text-gray-400 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No hay trabajos de impresión
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Trabajo</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Tipo</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Impresora</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Estado</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {jobs.map((job) => (
              <tr
                key={job.id}
                className={cn(
                  "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                  onJobClick && "cursor-pointer"
                )}
                onClick={() => onJobClick?.(job)}
              >
                <td className="px-3 py-2">
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {job.jobNumber}
                  </p>
                  {job.copies > 1 && (
                    <span className="text-xs text-gray-500">x{job.copies} copias</span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300">
                  {getDocTypeLabel(job.documentType)}
                </td>
                <td className="px-3 py-2">
                  {job.printerName ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[150px]">
                      {job.printerName}
                    </p>
                  ) : (
                    <span className="text-xs text-gray-400">Sin asignar</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {getStatusBadge(job.status)}
                  {job.errorMessage && (
                    <p className="text-xs text-red-500 mt-1 truncate max-w-[200px]" title={job.errorMessage}>
                      {job.errorMessage}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(job.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PrintJobsList
