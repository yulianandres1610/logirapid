'use client'

import { useState } from 'react'
import { Printer, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'

type DocumentType =
  | 'pos_receipt'
  | 'shipping_label'
  | 'product_label'
  | 'invoice'
  | 'purchase_invoice'
  | 'sales_report'
  | 'inventory_count_report'
  | 'cash_register_report'

interface PrintButtonProps {
  documentType: DocumentType
  documentData: Record<string, unknown>
  sourceType?: string
  sourceId?: number
  copies?: number
  posTerminalId?: number
  warehouseId?: number
  onPrintStarted?: (jobNumber: string) => void
  onPrintCompleted?: (jobNumber: string) => void
  onPrintFailed?: (error: string) => void
  variant?: 'default' | 'outline' | 'ghost' | 'icon'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  showCopiesSelector?: boolean
  label?: string
  disabled?: boolean
}

export function PrintButton({
  documentType,
  documentData,
  sourceType,
  sourceId,
  copies: defaultCopies = 1,
  posTerminalId,
  warehouseId,
  onPrintStarted,
  onPrintCompleted,
  onPrintFailed,
  variant = 'outline',
  size = 'sm',
  className,
  showCopiesSelector = false,
  label,
  disabled = false
}: PrintButtonProps) {
  const { showNotification } = useNotifications()
  const [printing, setPrinting] = useState(false)
  const [copies, setCopies] = useState(defaultCopies)
  const [showCopiesModal, setShowCopiesModal] = useState(false)
  const [lastJobNumber, setLastJobNumber] = useState<string | null>(null)
  const [lastStatus, setLastStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handlePrint = async (e?: React.MouseEvent) => {
    e?.stopPropagation()

    if (showCopiesSelector && !showCopiesModal) {
      setShowCopiesModal(true)
      return
    }

    setPrinting(true)
    setLastStatus('idle')
    setShowCopiesModal(false)

    try {
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          documentData,
          sourceType,
          sourceId,
          copies,
          posTerminalId,
          warehouseId
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setLastJobNumber(data.data.jobNumber)
        setLastStatus('success')
        showNotification('success', 'Imprimiendo', `Trabajo ${data.data.jobNumber} enviado a imprimir`)
        onPrintStarted?.(data.data.jobNumber)

        // If service is not assigned, show warning
        if (!data.data.printServiceId) {
          showNotification('warning', 'Sin servicio', 'No hay servicio de impresión configurado')
        }

        // Poll for status if needed (optional enhancement)
        if (onPrintCompleted) {
          pollJobStatus(data.data.jobId, data.data.jobNumber)
        }
      } else {
        throw new Error(data.error || 'Error al imprimir')
      }
    } catch (error) {
      setLastStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      showNotification('error', 'Error', errorMessage)
      onPrintFailed?.(errorMessage)
    } finally {
      setPrinting(false)
    }
  }

  const pollJobStatus = async (jobId: number, jobNumber: string) => {
    // Simple polling for job completion (max 30 seconds)
    const maxAttempts = 15
    let attempts = 0

    const checkStatus = async () => {
      attempts++
      try {
        const response = await fetch(`/api/print-jobs?status=completed&limit=1`)
        const data = await response.json()

        if (data.success) {
          const completedJob = data.data.jobs?.find((j: { id: number }) => j.id === jobId)
          if (completedJob) {
            onPrintCompleted?.(jobNumber)
            return
          }
        }

        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000)
        }
      } catch {
        // Ignore polling errors
      }
    }

    setTimeout(checkStatus, 2000)
  }

  const getLabel = () => {
    if (label) return label
    if (printing) return 'Enviando...'

    const labels: Record<DocumentType, string> = {
      pos_receipt: 'Imprimir Recibo',
      shipping_label: 'Imprimir Etiqueta',
      product_label: 'Imprimir Etiqueta',
      invoice: 'Imprimir Factura',
      purchase_invoice: 'Imprimir Factura',
      sales_report: 'Imprimir Reporte',
      inventory_count_report: 'Imprimir Conteo',
      cash_register_report: 'Imprimir Arqueo'
    }
    return labels[documentType] || 'Imprimir'
  }

  const getIcon = () => {
    if (printing) return <Loader2 className="w-4 h-4 animate-spin" />
    if (lastStatus === 'success') return <CheckCircle className="w-4 h-4 text-green-500" />
    if (lastStatus === 'error') return <XCircle className="w-4 h-4 text-red-500" />
    return <Printer className="w-4 h-4" />
  }

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={handlePrint}
          disabled={disabled || printing}
          className={cn(
            "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          title={getLabel()}
        >
          {getIcon()}
        </button>

        {showCopiesModal && (
          <CopiesModal
            copies={copies}
            onCopiesChange={setCopies}
            onConfirm={() => handlePrint()}
            onCancel={() => setShowCopiesModal(false)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handlePrint}
        disabled={disabled || printing}
        className={className}
      >
        {getIcon()}
        <span className="ml-2">{getLabel()}</span>
        {copies > 1 && <span className="ml-1 text-xs opacity-70">x{copies}</span>}
      </Button>

      {showCopiesModal && (
        <CopiesModal
          copies={copies}
          onCopiesChange={setCopies}
          onConfirm={() => handlePrint()}
          onCancel={() => setShowCopiesModal(false)}
        />
      )}
    </>
  )
}

// Copies selection modal
function CopiesModal({
  copies,
  onCopiesChange,
  onConfirm,
  onCancel
}: {
  copies: number
  onCopiesChange: (n: number) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl p-4 w-full max-w-xs mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Cantidad de copias
        </h3>
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => onCopiesChange(Math.max(1, copies - 1))}
            className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            -
          </button>
          <input
            type="number"
            value={copies}
            onChange={(e) => onCopiesChange(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            className="w-16 h-10 text-center text-xl font-bold border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
            min={1}
            max={10}
          />
          <button
            onClick={() => onCopiesChange(Math.min(10, copies + 1))}
            className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 text-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            +
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={onConfirm}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PrintButton
