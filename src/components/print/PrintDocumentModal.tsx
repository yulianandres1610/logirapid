'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Printer, X, Loader2, Minus, Plus, FileText, Receipt, Package, ShoppingCart } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
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

interface PrintDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  documentType: DocumentType
  documentData: Record<string, unknown>
  documentTitle: string
  sourceType?: string
  sourceId?: number
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
  wholesale_invoice: { label: 'Factura Mayorista', icon: FileText }
}

export function PrintDocumentModal({
  isOpen,
  onClose,
  documentType,
  documentData,
  documentTitle,
  sourceType,
  sourceId,
  onPrintSuccess
}: PrintDocumentModalProps) {
  const { showNotification } = useNotifications()

  const [printing, setPrinting] = useState(false)
  const [copies, setCopies] = useState(1)

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
          sourceType,
          sourceId,
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
          className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-gray-800"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-900/30">
                <DocIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Imprimir {docConfig.label}</h3>
                <p className="text-xs text-gray-400 truncate max-w-[200px]">{documentTitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Copies Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cantidad de copias
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setCopies(Math.max(1, copies - 1))}
                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="w-20 h-12 rounded-xl flex items-center justify-center text-2xl font-bold bg-gray-700 text-white">
                  {copies}
                </div>
                <button
                  onClick={() => setCopies(Math.min(10, copies + 1))}
                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex gap-3">
            <button
              onClick={onClose}
              className="py-3 px-4 rounded-xl font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handlePrint}
              disabled={printing}
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
              {printing ? 'Enviando...' : `Imprimir ${copies > 1 ? `(${copies})` : ''}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PrintDocumentModal
