'use client'

import React, { useState, useCallback } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle,
  Loader2,
  Smartphone
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PhoneUploadModal } from '@/components/uploads/PhoneUploadModal'

export interface InvoiceFile {
  id: string
  file?: File // Optional for scanned invoices
  name: string
  size: number
  type: string
  preview?: string // Base64 preview for images
  url?: string // URL or base64 for scanned invoices
  uploaded?: boolean
  uploading?: boolean
  storagePath?: string
  error?: string
  uploadedAt?: string // For scanned invoices
}

interface InvoiceUploaderProps {
  invoices: InvoiceFile[]
  onInvoicesChange: (invoices: InvoiceFile[]) => void
  orderType: 'consignment' | 'purchase'
  orderId?: number
  disabled?: boolean
  className?: string
}

const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf'
]

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const generateId = (): string => {
  return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function InvoiceUploader({
  invoices,
  onInvoicesChange,
  orderType,
  orderId,
  disabled = false,
  className
}: InvoiceUploaderProps) {
  const { theme } = useTheme()
  const [dragActive, setDragActive] = useState(false)
  const [showPhoneUpload, setShowPhoneUpload] = useState(false)

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)

    const newInvoices: InvoiceFile[] = []
    const errors: string[] = []

    for (const file of fileArray) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Tipo de archivo no permitido`)
        continue
      }

      // Create preview for images
      let preview: string | undefined
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file)
      }

      newInvoices.push({
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview,
        uploaded: false,
        uploading: false
      })
    }

    if (errors.length > 0) {
      alert(`Algunos archivos no fueron aceptados:\n${errors.join('\n')}`)
    }

    if (newInvoices.length > 0) {
      onInvoicesChange([...invoices, ...newInvoices])
    }
  }, [invoices, onInvoicesChange])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
      // Reset input to allow selecting the same file again
      e.target.value = ''
    }
  }, [handleFiles])

  const removeInvoice = useCallback((id: string) => {
    const invoice = invoices.find(inv => inv.id === id)
    if (invoice?.preview) {
      URL.revokeObjectURL(invoice.preview)
    }
    onInvoicesChange(invoices.filter(inv => inv.id !== id))
  }, [invoices, onInvoicesChange])

  const handlePhoneUploadComplete = useCallback((fileUrl: string, fileName: string, fileSize?: number, fileType?: string, signedUrl?: string) => {
    console.log('[InvoiceUploader] Phone upload complete:', { fileUrl, fileName, fileSize, fileType, signedUrl })
    const detectedType = fileType || (fileName?.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
    const newInvoice: InvoiceFile = {
      id: generateId(),
      name: fileName || 'foto-telefono.jpg',
      size: fileSize || 0,
      type: detectedType,
      uploaded: true,
      storagePath: fileUrl,
      // Use signedUrl as preview for images
      preview: detectedType.startsWith('image/') ? signedUrl : undefined,
      uploadedAt: new Date().toISOString()
    }
    console.log('[InvoiceUploader] Created invoice:', newInvoice)
    onInvoicesChange([...invoices, newInvoice])
    setShowPhoneUpload(false)
  }, [invoices, onInvoicesChange])

  const isPdf = (type: string) => type === 'application/pdf'

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
          dragActive
            ? theme === 'dark'
              ? 'border-blue-500 bg-blue-900/20'
              : 'border-blue-500 bg-blue-50'
            : theme === 'dark'
              ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="invoice-files"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
        <label
          htmlFor="invoice-files"
          className={cn(
            'cursor-pointer flex flex-col items-center gap-4',
            disabled && 'cursor-not-allowed'
          )}
        >
          <div className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center',
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          )}>
            <Upload className={cn(
              'w-8 h-8',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )} />
          </div>
          <div>
            <p className={cn(
              'font-semibold text-lg',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Arrastra las facturas aqui
            </p>
            <p className={cn(
              'text-sm mt-1',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              o haz clic para seleccionar archivos
            </p>
            <p className={cn(
              'text-xs mt-2',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            )}>
              PDF, JPG, PNG, WEBP
            </p>
          </div>
        </label>
      </div>

      {/* Phone Upload Button */}
      {!disabled && (
        <button
          type="button"
          onClick={() => setShowPhoneUpload(true)}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed transition-all',
            theme === 'dark'
              ? 'border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400 hover:bg-blue-900/10'
              : 'border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50'
          )}
        >
          <Smartphone className="w-5 h-5" />
          <span className="font-medium">Subir con Telefono</span>
        </button>
      )}

      {/* Invoice List */}
      {invoices.length > 0 && (
        <div className="space-y-3">
          <h4 className={cn(
            'font-medium flex items-center gap-2',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            <FileText className="w-4 h-4" />
            Facturas seleccionadas ({invoices.length})
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {invoices.map((invoice) => (
                <motion.div
                  key={invoice.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'relative group rounded-xl overflow-hidden border',
                    theme === 'dark'
                      ? 'border-gray-700 bg-gray-800'
                      : 'border-gray-200 bg-white',
                    invoice.error && (theme === 'dark'
                      ? 'border-red-700 bg-red-900/20'
                      : 'border-red-300 bg-red-50')
                  )}
                >
                  {/* Preview Area */}
                  <div className="h-32 flex items-center justify-center overflow-hidden">
                    {isPdf(invoice.type) ? (
                      <div className={cn(
                        'w-full h-full flex flex-col items-center justify-center',
                        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                      )}>
                        <FileText className="w-12 h-12 text-red-500" />
                        <span className={cn(
                          'text-xs mt-1',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          PDF
                        </span>
                      </div>
                    ) : invoice.preview ? (
                      <img
                        src={invoice.preview}
                        alt={invoice.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={cn(
                        'w-full h-full flex items-center justify-center',
                        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                      )}>
                        <ImageIcon className={cn(
                          'w-12 h-12',
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                        )} />
                      </div>
                    )}

                    {/* Status Overlay */}
                    {(invoice.uploading || invoice.uploaded) && (
                      <div className={cn(
                        'absolute inset-0 flex items-center justify-center',
                        invoice.uploading ? 'bg-black/50' : 'bg-green-500/20'
                      )}>
                        {invoice.uploading ? (
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        ) : (
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        )}
                      </div>
                    )}

                    {/* Remove Button */}
                    {!disabled && !invoice.uploading && (
                      <button
                        type="button"
                        onClick={() => removeInvoice(invoice.id)}
                        className={cn(
                          'absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center',
                          'opacity-0 group-hover:opacity-100 transition-opacity',
                          theme === 'dark'
                            ? 'bg-gray-900/80 hover:bg-red-600'
                            : 'bg-white/90 hover:bg-red-500',
                          theme === 'dark'
                            ? 'text-gray-300 hover:text-white'
                            : 'text-gray-600 hover:text-white'
                        )}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* File Info */}
                  <div className={cn(
                    'p-3 border-t',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <p className={cn(
                      'text-sm font-medium truncate',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )} title={invoice.name}>
                      {invoice.name}
                    </p>
                    <p className={cn(
                      'text-xs mt-0.5',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      {formatFileSize(invoice.size)}
                    </p>
                    {invoice.error && (
                      <p className="text-xs text-red-500 mt-1">{invoice.error}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className={cn(
        'text-sm p-4 rounded-xl border',
        theme === 'dark'
          ? 'bg-blue-900/20 border-blue-800 text-blue-300'
          : 'bg-blue-50 border-blue-200 text-blue-700'
      )}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">Facturas originales del proveedor</p>
            <ul className="space-y-1 text-xs opacity-90">
              <li>• Sube las facturas o recibos originales de la {orderType === 'consignment' ? 'consignacion' : 'compra'}</li>
              <li>• Los archivos se guardan de forma segura y privada</li>
              <li>• Podras verlos desde los detalles de la orden</li>
              <li>• Formatos aceptados: PDF, JPG, PNG, WEBP</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Phone Upload Modal */}
      <PhoneUploadModal
        isOpen={showPhoneUpload}
        onClose={() => setShowPhoneUpload(false)}
        purpose="purchase_invoice"
        referenceType={orderType === 'purchase' ? 'purchase' : 'consignment'}
        referenceId={orderId}
        onUploadComplete={handlePhoneUploadComplete}
      />
    </div>
  )
}
