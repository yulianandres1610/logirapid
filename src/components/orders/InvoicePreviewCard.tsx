'use client'

import React, { useState } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { motion } from 'framer-motion'
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Image as ImageIcon,
  Loader2,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface InvoiceData {
  id: number
  fileName: string
  originalName: string
  fileType: string
  fileSize: number
  signedUrl: string | null
  createdAt: string
}

interface InvoicePreviewCardProps {
  invoice: InvoiceData
  onView?: () => void
  onDownload?: () => void
  onDelete?: () => void
  showDelete?: boolean
  className?: string
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export function InvoicePreviewCard({
  invoice,
  onView,
  onDownload,
  onDelete,
  showDelete = false,
  className
}: InvoicePreviewCardProps) {
  const { theme } = useTheme()
  const [imageError, setImageError] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isPdf = invoice.fileType === 'application/pdf'
  const isImage = invoice.fileType.startsWith('image/')
  const hasSignedUrl = !!invoice.signedUrl

  const handleView = () => {
    if (invoice.signedUrl) {
      window.open(invoice.signedUrl, '_blank')
    }
    onView?.()
  }

  const handleDownload = async () => {
    if (!invoice.signedUrl) return

    try {
      const response = await fetch(invoice.signedUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = invoice.originalName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading invoice:', error)
      // Fallback: open in new tab
      window.open(invoice.signedUrl, '_blank')
    }
    onDownload?.()
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group rounded-xl overflow-hidden border transition-all duration-200',
        theme === 'dark'
          ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
          : 'border-gray-200 bg-white hover:border-gray-300',
        'hover:shadow-lg',
        className
      )}
    >
      {/* Preview Area */}
      <div className="relative h-36 overflow-hidden">
        {isPdf ? (
          <div className={cn(
            'w-full h-full flex flex-col items-center justify-center',
            theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
          )}>
            <FileText className="w-14 h-14 text-red-500" />
            <span className={cn(
              'text-sm font-medium mt-2',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              Documento PDF
            </span>
          </div>
        ) : isImage && hasSignedUrl && !imageError ? (
          <img
            src={invoice.signedUrl!}
            alt={invoice.originalName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className={cn(
            'w-full h-full flex flex-col items-center justify-center',
            theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
          )}>
            <ImageIcon className={cn(
              'w-14 h-14',
              theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
            )} />
            {!hasSignedUrl && (
              <span className={cn(
                'text-xs mt-2',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}>
                Vista previa no disponible
              </span>
            )}
          </div>
        )}

        {/* Hover Overlay with Actions */}
        <div className={cn(
          'absolute inset-0 flex items-center justify-center gap-2',
          'bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity'
        )}>
          {hasSignedUrl && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleView}
                className="text-white hover:bg-white/20 h-10 w-10 p-0 rounded-full"
                title="Ver"
              >
                <Eye className="w-5 h-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-white hover:bg-white/20 h-10 w-10 p-0 rounded-full"
                title="Descargar"
              >
                <Download className="w-5 h-5" />
              </Button>
            </>
          )}
          {showDelete && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-400 hover:bg-red-500/20 hover:text-red-300 h-10 w-10 p-0 rounded-full"
              title="Eliminar"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* File Info */}
      <div className={cn(
        'p-3 border-t',
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      )}>
        <p className={cn(
          'text-sm font-medium truncate',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )} title={invoice.originalName}>
          {invoice.originalName}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className={cn(
            'text-xs',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )}>
            {formatFileSize(invoice.fileSize)}
          </span>
          <span className={cn(
            'text-xs',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          )}>
            {formatDate(invoice.createdAt)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// Grid container component for displaying multiple invoices
interface InvoiceGridProps {
  invoices: InvoiceData[]
  onDelete?: (invoiceId: number) => Promise<void>
  showDelete?: boolean
  emptyMessage?: string
  className?: string
}

export function InvoiceGrid({
  invoices,
  onDelete,
  showDelete = false,
  emptyMessage = 'No hay facturas adjuntas',
  className
}: InvoiceGridProps) {
  const { theme } = useTheme()

  if (invoices.length === 0) {
    return (
      <div className={cn(
        'text-center py-8 rounded-xl border-2 border-dashed',
        theme === 'dark'
          ? 'border-gray-700 text-gray-500'
          : 'border-gray-200 text-gray-400'
      )}>
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn(
      'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4',
      className
    )}>
      {invoices.map((invoice) => (
        <InvoicePreviewCard
          key={invoice.id}
          invoice={invoice}
          showDelete={showDelete}
          onDelete={onDelete ? () => onDelete(invoice.id) : undefined}
        />
      ))}
    </div>
  )
}
