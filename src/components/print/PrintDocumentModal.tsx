'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Printer, X, Loader2, Minus, Plus, FileText, Receipt, Package, ShoppingCart, ChevronDown } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

export type DocumentType =
  | 'pos_receipt'
  | 'inventory_count_report'
  | 'purchase_invoice'
  | 'sales_report'
  | 'product_label'
  | 'cash_register_report'
  | 'invoice'
  | 'shipping_label'
  | 'lot_label'
  | 'unified_reception'
  | 'consignment_receipt'
  | 'warehouse_operation'
  | 'wholesale_invoice'
  | 'wholesale_quote'
  | 'session_close_report'
  | 'warehouse_pickup_ticket'

interface PrintDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  documentType: DocumentType
  documentData: Record<string, unknown>
  documentTitle: string
  sourceType?: string
  sourceId?: number
  posTerminalId?: number
  warehouseId?: number
  onPrintSuccess?: (jobNumber: string) => void
}

const DOCUMENT_LABELS: Record<DocumentType, { label: string; icon: typeof FileText }> = {
  pos_receipt: { label: 'Recibo de Venta', icon: Receipt },
  inventory_count_report: { label: 'Reporte de Conteo', icon: Package },
  purchase_invoice: { label: 'Factura de Compra', icon: FileText },
  sales_report: { label: 'Reporte de Ventas', icon: ShoppingCart },
  product_label: { label: 'Etiqueta de Producto', icon: Package },
  cash_register_report: { label: 'Reporte de Caja', icon: FileText },
  invoice: { label: 'Factura', icon: FileText },
  shipping_label: { label: 'Etiqueta de Envío', icon: Package },
  lot_label: { label: 'Etiqueta de Lote', icon: Package },
  unified_reception: { label: 'Comprobante de Recepción', icon: Receipt },
  consignment_receipt: { label: 'Recibo de Consignación', icon: Receipt },
  warehouse_operation: { label: 'Operación de Almacén', icon: Package },
  wholesale_invoice: { label: 'Factura Mayorista', icon: FileText },
  wholesale_quote: { label: 'Oferta Comercial', icon: FileText },
  session_close_report: { label: 'Cierre de Caja', icon: Receipt },
  warehouse_pickup_ticket: { label: 'Ticket de Recogida', icon: Package }
}

export function PrintDocumentModal({
  isOpen,
  onClose,
  documentType,
  documentData,
  documentTitle,
  sourceType,
  sourceId,
  posTerminalId,
  warehouseId,
  onPrintSuccess
}: PrintDocumentModalProps) {
  const { showNotification } = useNotifications()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [printing, setPrinting] = useState(false)
  const [copies, setCopies] = useState(1)
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [loadingServices, setLoadingServices] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLoadingServices(true)
      fetch(`/api/print-services/available?documentType=${documentType}`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data) {
            setAvailableServices(data.data)
            // Auto-select first online, or first if only one
            const online = data.data.filter((s: any) => s.online)
            if (online.length === 1) setSelectedServiceId(online[0].id)
            else if (data.data.length === 1) setSelectedServiceId(data.data[0].id)
          }
        })
        .catch(() => {})
        .finally(() => setLoadingServices(false))
    }
  }, [isOpen, documentType])

  const docConfig = DOCUMENT_LABELS[documentType] || { label: 'Documento', icon: FileText }
  const DocIcon = docConfig.icon

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          documentData,
          copies,
          serviceId: selectedServiceId,
          sourceType,
          sourceId,
          posTerminalId: posTerminalId || undefined,
          warehouseId: warehouseId || undefined,
          priority: 1
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        showNotification('success', 'Imprimiendo', `Trabajo ${data.data.jobNumber} enviado a imprimir`)
        onPrintSuccess?.(data.data.jobNumber)
        onClose()
      } else {
        throw new Error(data.error || 'Error al enviar trabajo de impresión')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      showNotification('error', 'Error de impresión', errorMessage)
    } finally {
      setPrinting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className={cn('w-full max-w-md rounded-2xl shadow-2xl overflow-hidden', isDark ? 'bg-gray-800' : 'bg-white')}
        >
          {/* Header */}
          <div className={cn('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50')}>
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', isDark ? 'bg-blue-900/30' : 'bg-blue-100')}>
                <DocIcon className={cn('w-5 h-5', isDark ? 'text-blue-400' : 'text-blue-600')} />
              </div>
              <div>
                <h3 className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Imprimir {docConfig.label}</h3>
                <p className="text-xs text-gray-400 truncate max-w-[200px]">{documentTitle}</p>
              </div>
            </div>
            <button onClick={onClose} className={cn('p-2 rounded-lg transition-colors', isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Printer selector - always shown */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                Servicio de impresión
              </label>
              {loadingServices ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando impresoras...
                </div>
              ) : availableServices.length === 0 ? (
                <p className="text-sm text-red-500">No hay servicios de impresión disponibles</p>
              ) : (
                <div className="relative">
                  <select
                    value={selectedServiceId || ''}
                    onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : null)}
                    className={cn(
                      'w-full px-3 py-2.5 pr-8 rounded-lg border text-sm font-medium appearance-none cursor-pointer',
                      isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    )}
                  >
                    <option value="">Automático</option>
                    {availableServices.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.printerName ? ` — ${s.printerName.replace(/_/g, ' ')}` : ''}{s.online ? ' ✓' : ' (offline)'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Copies Selector */}
            <div>
              <label className={cn('block text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                Cantidad de copias
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setCopies(Math.max(1, copies - 1))}
                  className={cn('w-12 h-12 rounded-xl flex items-center justify-center transition-colors', isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className={cn('w-20 h-12 rounded-xl flex items-center justify-center text-2xl font-bold', isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900')}>
                  {copies}
                </div>
                <button
                  onClick={() => setCopies(Math.min(10, copies + 1))}
                  className={cn('w-12 h-12 rounded-xl flex items-center justify-center transition-colors', isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={cn('px-6 py-4 border-t flex gap-3', isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50')}>
            <button
              onClick={onClose}
              className={cn('py-3 px-4 rounded-xl font-medium transition-colors', isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')}
            >
              Cancelar
            </button>

            <button
              onClick={handlePrint}
              disabled={printing || availableServices.length === 0}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors',
                'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
                'hover:from-blue-600 hover:to-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {printing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Printer className="w-5 h-5" />
              )}
              {printing ? 'Enviando...' : `Imprimir${copies > 1 ? ` (${copies})` : ''}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PrintDocumentModal
