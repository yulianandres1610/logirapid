'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Printer, X, Loader2, CheckCircle, AlertCircle, Wifi, WifiOff, Minus, Plus, FileText, Receipt, Package, ShoppingCart, Download } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'

interface PrintService {
  id: number
  serviceCode: string
  serviceName: string
  status: string
  printers: PrinterInfo[]
}

interface PrinterInfo {
  id: number
  printerName: string
  printerId: string
  printerType: string
  isOnline: boolean
  isDefault: boolean
  supportedDocumentTypes?: string[]
}

export type DocumentType =
  | 'pos_receipt'
  | 'inventory_count_report'
  | 'purchase_invoice'
  | 'sales_report'
  | 'product_label'
  | 'cash_register_report'
  | 'invoice'
  | 'shipping_label'

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
  shipping_label: { label: 'Etiqueta de Envío', icon: Package }
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

  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [services, setServices] = useState<PrintService[]>([])
  const [selectedService, setSelectedService] = useState<PrintService | null>(null)
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterInfo | null>(null)
  const [copies, setCopies] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Document types that support PDF download
  const supportsDownload = ['sales_report', 'cash_register_report', 'inventory_count_report', 'purchase_invoice'].includes(documentType)

  const docConfig = DOCUMENT_LABELS[documentType] || { label: 'Documento', icon: FileText }
  const DocIcon = docConfig.icon

  useEffect(() => {
    if (isOpen) {
      fetchPrintServices()
    }
  }, [isOpen])

  // Helper to check if printer supports the document type
  const printerSupportsDocType = (printer: PrinterInfo, docType: string): boolean => {
    // If no supported types defined, assume it supports all
    if (!printer.supportedDocumentTypes || printer.supportedDocumentTypes.length === 0) {
      return true
    }
    return printer.supportedDocumentTypes.includes(docType)
  }

  const fetchPrintServices = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/print/services?includeOffline=false')
      const data = await response.json()

      if (data.success && data.data?.services) {
        // Filter services that have at least one printer supporting this document type
        const activeServices = data.data.services
          .filter((s: PrintService) => s.status === 'active' && s.printers?.length > 0)
          .map((service: PrintService) => ({
            ...service,
            // Filter printers to only those supporting this document type
            printers: service.printers.filter((p: PrinterInfo) => printerSupportsDocType(p, documentType))
          }))
          .filter((s: PrintService) => s.printers.length > 0) // Only keep services with compatible printers

        setServices(activeServices)

        if (activeServices.length > 0) {
          const firstService = activeServices[0]
          setSelectedService(firstService)

          // For receipts/reports, prefer thermal printers
          const thermalPrinter = firstService.printers.find(
            (p: PrinterInfo) => p.printerType === 'thermal_80mm' && p.isOnline
          )
          const defaultPrinter = thermalPrinter
            || firstService.printers.find((p: PrinterInfo) => p.isDefault && p.isOnline)
            || firstService.printers.find((p: PrinterInfo) => p.isOnline)
            || firstService.printers[0]

          setSelectedPrinter(defaultPrinter)
        }
      } else {
        setError('No se encontraron servicios de impresión activos')
      }
    } catch (err) {
      console.error('Error fetching print services:', err)
      setError('Error al cargar los servicios de impresión')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = async () => {
    if (!selectedService || !selectedPrinter) {
      showNotification('error', 'Error', 'Seleccione una impresora')
      return
    }

    setPrinting(true)
    try {
      const response = await fetch('/api/print/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          documentData,
          copies,
          printServiceId: selectedService.id,
          printerId: selectedPrinter.id,
          sourceType,
          sourceId,
          priority: 1
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        showNotification('success', 'Imprimiendo', `Trabajo ${data.data.jobNumber} enviado a ${selectedPrinter.printerName}`)
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

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const response = await fetch('/api/print/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType,
          documentData
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al generar PDF')
      }

      // Get the PDF blob and download it
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || `documento-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showNotification('success', 'Descarga completada', 'El PDF se ha descargado correctamente')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      showNotification('error', 'Error de descarga', errorMessage)
    } finally {
      setDownloading(false)
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
            {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                <p className="text-sm text-gray-400">Buscando impresoras...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
                <p className="text-gray-300 text-center">{error}</p>
                <button
                  onClick={fetchPrintServices}
                  className="mt-4 text-sm text-blue-400 hover:text-blue-300"
                >
                  Reintentar
                </button>
              </div>
            ) : services.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
                <p className="text-gray-300 text-center font-medium">
                  No hay servicios de impresión disponibles
                </p>
                <p className="text-sm text-gray-500 text-center mt-1">
                  Instala y configura LogiRapid Print Service
                </p>
              </div>
            ) : (
              <>
                {/* Service Selector (if multiple) */}
                {services.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Servicio de Impresión
                    </label>
                    <select
                      value={selectedService?.id || ''}
                      onChange={(e) => {
                        const service = services.find(s => s.id === parseInt(e.target.value))
                        setSelectedService(service || null)
                        if (service) {
                          const thermalPrinter = service.printers.find(
                            p => p.printerType === 'thermal_80mm' && p.isOnline
                          )
                          const defaultPrinter = thermalPrinter
                            || service.printers.find(p => p.isDefault && p.isOnline)
                            || service.printers.find(p => p.isOnline)
                            || service.printers[0]
                          setSelectedPrinter(defaultPrinter)
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl border bg-gray-700 border-gray-600 text-white"
                    >
                      {services.map(service => (
                        <option key={service.id} value={service.id}>
                          {service.serviceName} ({service.serviceCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Printer Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Impresora
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedService?.printers.map(printer => (
                      <button
                        key={printer.id}
                        onClick={() => setSelectedPrinter(printer)}
                        className={cn(
                          'w-full p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between',
                          selectedPrinter?.id === printer.id
                            ? 'border-blue-500 bg-blue-900/20'
                            : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Printer className={cn(
                            'w-5 h-5',
                            selectedPrinter?.id === printer.id ? 'text-blue-400' : 'text-gray-400'
                          )} />
                          <div>
                            <p className={cn(
                              'font-medium',
                              selectedPrinter?.id === printer.id
                                ? 'text-blue-400'
                                : 'text-white'
                            )}>
                              {printer.printerName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {printer.printerType === 'thermal_80mm' ? 'Térmica 80mm' :
                               printer.printerType === 'label_4x6' ? 'Etiquetas 4x6' :
                               printer.printerType === 'label_barcode' ? 'Código de barras' :
                               'Estándar'}
                              {printer.isDefault && ' • Predeterminada'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {printer.isOnline ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <Wifi className="w-4 h-4" />
                              <span className="text-xs">Online</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-500">
                              <WifiOff className="w-4 h-4" />
                              <span className="text-xs">Offline</span>
                            </div>
                          )}
                          {selectedPrinter?.id === printer.id && (
                            <CheckCircle className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

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
              </>
            )}
          </div>

          {/* Footer */}
          {!loading && (services.length > 0 || supportsDownload) && (
            <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex gap-3">
              <button
                onClick={onClose}
                className="py-3 px-4 rounded-xl font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>

              {/* Download button - always available for supported document types */}
              {supportsDownload && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors',
                    'bg-gradient-to-r from-green-500 to-green-600 text-white',
                    'hover:from-green-600 hover:to-green-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {downloading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  {downloading ? 'Generando...' : 'Descargar PDF'}
                </button>
              )}

              {/* Print button - only if printers available */}
              {services.length > 0 && (
                <button
                  onClick={handlePrint}
                  disabled={printing || !selectedPrinter}
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
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PrintDocumentModal
