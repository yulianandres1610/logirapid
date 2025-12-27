'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Warehouse,
  Loader2,
  Package,
  CheckCircle2,
  X,
  AlertTriangle,
  Printer
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import OperationTypeSelector, { type OperationType } from '@/components/warehouse/OperationTypeSelector'
import WarehouseScanner, { type ScannedProductData } from '@/components/warehouse/WarehouseScanner'
import ScannedProductCard, { type ScannedProduct } from '@/components/warehouse/ScannedProductCard'
import WarehouseNumpad from '@/components/warehouse/WarehouseNumpad'
import DestinationWarehouseSelector from '@/components/warehouse/DestinationWarehouseSelector'
import ScrapReasonSelector, { type ScrapReason } from '@/components/warehouse/ScrapReasonSelector'
import AdjustmentReasonSelector, { type AdjustmentReason } from '@/components/warehouse/AdjustmentReasonSelector'
import ReferenceOrderSelector, { type ReferenceType } from '@/components/warehouse/ReferenceOrderSelector'
import PendingTransfersList, { type PendingTransfer } from '@/components/warehouse/PendingTransfersList'
import TransferValidationView from '@/components/warehouse/TransferValidationView'
import ConsignmentReceptionView from '@/components/warehouse/ConsignmentReceptionView'

interface WarehouseData {
  id: number
  name: string
  code: string
  allowNegativeStock: boolean
}

interface DestinationWarehouse {
  id: number
  name: string
  code: string
}

// Silent print function for warehouse operations - uses print service API
async function printOperationReport(data: {
  operationType: OperationType
  operationNumber: string
  operationId: number
  warehouse: WarehouseData
  destinationWarehouse?: DestinationWarehouse | null
  products: ScannedProduct[]
  scrapReason?: string | null
  adjustmentReason?: string | null
  notes?: string
  companyName?: string
}) {
  try {
    // Send print job to the silent print service
    const response = await fetch('/api/print/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentType: 'warehouse_operation',
        documentData: {
          operationType: data.operationType,
          operationNumber: data.operationNumber,
          warehouse: {
            id: data.warehouse.id,
            name: data.warehouse.name,
            code: data.warehouse.code
          },
          destinationWarehouse: data.destinationWarehouse ? {
            id: data.destinationWarehouse.id,
            name: data.destinationWarehouse.name,
            code: data.destinationWarehouse.code
          } : null,
          products: data.products.map(p => ({
            productId: p.productId,
            name: p.name,
            sku: p.sku,
            quantity: p.quantity,
            currentStock: p.currentStock,
            realStock: p.realStock
          })),
          scrapReason: data.scrapReason,
          adjustmentReason: data.adjustmentReason,
          notes: data.notes,
          createdAt: new Date().toISOString()
        },
        copies: 1,
        sourceType: 'warehouse_operation',
        sourceId: data.operationId,
        warehouseId: data.warehouse.id
      })
    })

    const result = await response.json()

    if (result.success) {
      console.log('[Print] Job created:', result.data.jobNumber)
      return true
    } else {
      console.warn('[Print] Service failed, falling back to browser print:', result.error)
      // Fallback to browser print
      printOperationReportBrowser(data)
      return false
    }
  } catch (error) {
    console.error('[Print] Error sending to print service:', error)
    // Fallback to browser print
    printOperationReportBrowser(data)
    return false
  }
}

// Fallback browser print function
function printOperationReportBrowser(data: {
  operationType: OperationType
  operationNumber: string
  warehouse: WarehouseData
  destinationWarehouse?: DestinationWarehouse | null
  products: ScannedProduct[]
  scrapReason?: string | null
  adjustmentReason?: string | null
  notes?: string
  companyName?: string
}) {
  const OPERATION_TITLES: Record<string, string> = {
    reception: 'RECEPCIÓN DE MERCANCÍA',
    transfer: 'TRANSFERENCIA INTERNA',
    scrap: 'REPORTE DE SCRAP / MERMA',
    adjustment: 'AJUSTE DE INVENTARIO'
  }

  const SCRAP_REASONS: Record<string, string> = {
    damaged: 'Producto Dañado',
    expired: 'Producto Vencido',
    defective: 'Producto Defectuoso',
    other: 'Otro Motivo'
  }

  const ADJUSTMENT_REASONS: Record<string, string> = {
    physical_count: 'Conteo Físico',
    system_error: 'Error de Sistema',
    theft_loss: 'Robo / Pérdida',
    other: 'Otro Motivo'
  }

  const totalUnits = data.products.reduce((sum, p) => sum + p.quantity, 0)
  const now = new Date()

  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) {
    console.error('No se pudo abrir ventana de impresión')
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${OPERATION_TITLES[data.operationType]} - ${data.operationNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; background: white; color: black; }
        .header { border-bottom: 2px solid black; padding-bottom: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: start; }
        .company { font-size: 20px; font-weight: bold; }
        .title { font-size: 18px; font-weight: bold; text-align: right; }
        .op-number { font-size: 14px; font-family: monospace; margin-top: 5px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .info-box { border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
        .info-label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
        .info-value { font-size: 14px; font-weight: bold; }
        .info-code { font-size: 12px; color: #666; }
        .detail-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 12px; }
        .detail-label { color: #666; }
        .detail-value { font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f5f5f5; border: 1px solid #ccc; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: bold; }
        td { border: 1px solid #ccc; padding: 10px; font-size: 12px; }
        tr:nth-child(even) { background: #fafafa; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .font-mono { font-family: monospace; }
        .totals-row { background: #f5f5f5 !important; font-weight: bold; }
        .notes { background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; border-radius: 4px; margin-bottom: 20px; }
        .notes-label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 50px; }
        .signature-box { text-align: center; }
        .signature-line { border-top: 2px solid black; padding-top: 10px; margin-top: 70px; }
        .signature-title { font-weight: bold; font-size: 11px; }
        .signature-subtitle { font-size: 10px; color: #666; margin-top: 5px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #666; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; }
        .badge-green { background: #dcfce7; color: #166534; }
        .badge-blue { background: #dbeafe; color: #1e40af; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        .badge-amber { background: #fef3c7; color: #92400e; }
        @media print {
          body { padding: 10px; }
          @page { margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company">${data.companyName || 'LogiRapid'}</div>
          <div style="font-size: 11px; color: #666; margin-top: 5px;">Sistema de Gestión de Almacenes</div>
        </div>
        <div style="text-align: right;">
          <div class="title">${OPERATION_TITLES[data.operationType]}</div>
          <div class="op-number">${data.operationNumber}</div>
          <div class="badge ${
            data.operationType === 'reception' ? 'badge-green' :
            data.operationType === 'transfer' ? 'badge-blue' :
            data.operationType === 'scrap' ? 'badge-red' : 'badge-amber'
          }" style="margin-top: 8px;">COMPLETADO</div>
        </div>
      </div>

      <div class="info-grid">
        <div>
          <div class="info-box">
            <div class="info-label">${data.operationType === 'transfer' ? 'Almacén Origen' : 'Almacén'}</div>
            <div class="info-value">${data.warehouse.name}</div>
            <div class="info-code">${data.warehouse.code}</div>
          </div>
          ${data.destinationWarehouse ? `
            <div class="info-box" style="margin-top: 10px;">
              <div class="info-label">Almacén Destino</div>
              <div class="info-value">${data.destinationWarehouse.name}</div>
              <div class="info-code">${data.destinationWarehouse.code}</div>
            </div>
          ` : ''}
        </div>
        <div>
          <div class="detail-row">
            <span class="detail-label">Fecha y Hora:</span>
            <span class="detail-value">${format(now, "dd/MM/yyyy HH:mm", { locale: es })}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Total Productos:</span>
            <span class="detail-value">${data.products.length}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Total Unidades:</span>
            <span class="detail-value">${totalUnits}</span>
          </div>
          ${data.scrapReason ? `
            <div class="detail-row">
              <span class="detail-label">Motivo Scrap:</span>
              <span class="detail-value">${SCRAP_REASONS[data.scrapReason] || data.scrapReason}</span>
            </div>
          ` : ''}
          ${data.adjustmentReason ? `
            <div class="detail-row">
              <span class="detail-label">Motivo Ajuste:</span>
              <span class="detail-value">${ADJUSTMENT_REASONS[data.adjustmentReason] || data.adjustmentReason}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Producto</th>
            <th style="width: 100px;">SKU</th>
            ${data.operationType === 'adjustment' ? '<th style="width: 80px;" class="text-center">Stock Ant.</th>' : ''}
            <th style="width: 80px;" class="text-center">${data.operationType === 'adjustment' ? 'Stock Real' : 'Cantidad'}</th>
            ${data.operationType === 'adjustment' ? '<th style="width: 80px;" class="text-center">Diferencia</th>' : ''}
            <th style="width: 50px;" class="text-center">✓</th>
          </tr>
        </thead>
        <tbody>
          ${data.products.map((p, i) => {
            const diff = data.operationType === 'adjustment' && p.realStock !== undefined
              ? (p.realStock - p.currentStock)
              : 0
            return `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td class="font-bold">${p.name}</td>
                <td class="font-mono">${p.sku}</td>
                ${data.operationType === 'adjustment' ? `<td class="text-center">${p.currentStock}</td>` : ''}
                <td class="text-center font-bold">${data.operationType === 'adjustment' ? (p.realStock ?? '-') : p.quantity}</td>
                ${data.operationType === 'adjustment' ? `
                  <td class="text-center font-bold" style="color: ${diff >= 0 ? '#16a34a' : '#dc2626'};">
                    ${diff >= 0 ? '+' : ''}${diff}
                  </td>
                ` : ''}
                <td class="text-center">☐</td>
              </tr>
            `
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td colspan="${data.operationType === 'adjustment' ? 4 : 3}" class="text-right">TOTAL:</td>
            <td class="text-center font-bold">${data.operationType === 'adjustment'
              ? data.products.reduce((sum, p) => sum + (p.realStock ?? 0), 0)
              : totalUnits}</td>
            ${data.operationType === 'adjustment' ? '<td></td>' : ''}
            <td></td>
          </tr>
        </tfoot>
      </table>

      ${data.notes ? `
        <div class="notes">
          <div class="notes-label">Notas:</div>
          <div>${data.notes}</div>
        </div>
      ` : ''}

      <div class="signatures">
        <div class="signature-box">
          <div class="signature-line">
            <div class="signature-title">
              ${data.operationType === 'reception' ? 'RECIBIDO POR' :
                data.operationType === 'transfer' ? 'ENTREGADO POR' :
                data.operationType === 'scrap' ? 'AUTORIZADO POR' : 'REALIZADO POR'}
            </div>
            <div class="signature-subtitle">Nombre y Firma</div>
            <div class="signature-subtitle">Fecha: ___/___/______</div>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-line">
            <div class="signature-title">
              ${data.operationType === 'reception' ? 'VERIFICADO POR' :
                data.operationType === 'transfer' ? 'RECIBIDO POR' :
                data.operationType === 'scrap' ? 'EJECUTADO POR' : 'APROBADO POR'}
            </div>
            <div class="signature-subtitle">Nombre y Firma</div>
            <div class="signature-subtitle">Fecha: ___/___/______</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Este documento fue generado automáticamente por el sistema de gestión de almacenes</p>
        <p style="margin-top: 5px;">${data.operationNumber} - Impreso el ${format(now, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</p>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 100);
        }
        window.onafterprint = function() { window.close(); }
        window.onfocus = function() { setTimeout(function() { window.close(); }, 300); }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

interface OperationState {
  operationType: OperationType | null
  destinationWarehouseId: number | null
  destinationWarehouse: DestinationWarehouse | null
  referenceType: ReferenceType
  referenceId: number | null
  referenceOrderNumber: string | null
  scrapReason: ScrapReason | null
  adjustmentReason: AdjustmentReason | null
  products: ScannedProduct[]
  notes: string
}

const initialOperationState: OperationState = {
  operationType: null,
  destinationWarehouseId: null,
  destinationWarehouse: null,
  referenceType: 'none',
  referenceId: null,
  referenceOrderNumber: null,
  scrapReason: null,
  adjustmentReason: null,
  products: [],
  notes: ''
}

export default function WarehouseOperationsPage() {
  const params = useParams()
  const router = useRouter()
  const warehouseId = parseInt(params.id as string)

  const [warehouse, setWarehouse] = useState<WarehouseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [operation, setOperation] = useState<OperationState>(initialOperationState)
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null)
  const [numpadValue, setNumpadValue] = useState('1')

  // Transfer validation state
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([])
  const [loadingTransfers, setLoadingTransfers] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState<PendingTransfer | null>(null)
  const [showValidationView, setShowValidationView] = useState(false)

  // Fetch warehouse data
  useEffect(() => {
    const fetchWarehouse = async () => {
      try {
        const response = await fetch(`/api/market/warehouses/${warehouseId}`)
        const data = await response.json()

        if (data.success) {
          setWarehouse({
            id: data.data.id,
            name: data.data.name,
            code: data.data.code,
            allowNegativeStock: data.data.allowNegativeStock
          })
        } else {
          setError(data.error || 'Error al cargar almacen')
        }
      } catch {
        setError('Error de conexion')
      } finally {
        setLoading(false)
      }
    }

    if (warehouseId) {
      fetchWarehouse()
    }
  }, [warehouseId])

  // Fetch pending transfers when receive_transfer is selected
  const fetchPendingTransfers = useCallback(async () => {
    setLoadingTransfers(true)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/pending-transfers`)
      const data = await response.json()
      if (data.success) {
        setPendingTransfers(data.data.transfers)
      } else {
        setError(data.error)
      }
    } catch (err) {
      console.error('Error fetching pending transfers:', err)
      setError('Error al cargar transferencias pendientes')
    } finally {
      setLoadingTransfers(false)
    }
  }, [warehouseId])

  const handleOperationTypeSelect = (type: OperationType) => {
    if (type === 'receive_transfer') {
      setOperation({ ...initialOperationState, operationType: type })
      fetchPendingTransfers()
    } else if (type === 'consignment_reception') {
      setOperation({ ...initialOperationState, operationType: type })
    } else {
      setOperation({ ...initialOperationState, operationType: type })
    }
    setSelectedProductIndex(null)
    setNumpadValue('1')
    setError(null)
    setSuccess(null)
    setSelectedTransfer(null)
    setShowValidationView(false)
  }

  const handleSelectTransferForValidation = (transfer: PendingTransfer) => {
    setSelectedTransfer(transfer)
    setShowValidationView(true)
  }

  const handleValidationComplete = () => {
    setShowValidationView(false)
    setSelectedTransfer(null)
    setSuccess('Transferencia recibida exitosamente')
    // Refresh the pending transfers list
    fetchPendingTransfers()
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleValidationClose = () => {
    setShowValidationView(false)
    setSelectedTransfer(null)
  }

  const handleProductScanned = useCallback((data: ScannedProductData) => {
    setOperation(prev => {
      // Check if product already exists
      const existingIndex = prev.products.findIndex(p => p.productId === data.product.id)

      if (existingIndex >= 0) {
        // Increment quantity
        const updated = [...prev.products]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1
        }
        return { ...prev, products: updated }
      }

      // Add new product
      const newProduct: ScannedProduct = {
        id: Date.now(),
        productId: data.product.id,
        name: data.product.name,
        sku: data.product.sku,
        barcode: data.product.barcode,
        imageUrl: data.product.imageUrl,
        unit: data.stock.warehouseName ? data.product.unit : 'unidad',
        quantity: 1,
        currentStock: data.stock.quantityAvailable,
        costPrice: data.product.costPrice,
        sellingPrice: data.product.sellingPrice
      }

      return { ...prev, products: [...prev.products, newProduct] }
    })
    setError(null)
  }, [])

  const handleScanError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setTimeout(() => setError(null), 3000)
  }, [])

  const handleQuantityChange = (productId: number, quantity: number) => {
    setOperation(prev => ({
      ...prev,
      products: prev.products.map(p =>
        p.id === productId ? { ...p, quantity } : p
      )
    }))
  }

  const handleRealStockChange = (productId: number, realStock: number) => {
    setOperation(prev => ({
      ...prev,
      products: prev.products.map(p =>
        p.id === productId ? { ...p, realStock } : p
      )
    }))
  }

  const handleRemoveProduct = (productId: number) => {
    setOperation(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== productId)
    }))
    if (selectedProductIndex !== null) {
      setSelectedProductIndex(null)
    }
  }

  const handleNumpadConfirm = () => {
    if (selectedProductIndex !== null && operation.products[selectedProductIndex]) {
      const quantity = parseInt(numpadValue) || 1
      const productId = operation.products[selectedProductIndex].id

      if (operation.operationType === 'adjustment') {
        handleRealStockChange(productId, quantity)
      } else {
        handleQuantityChange(productId, quantity)
      }

      setSelectedProductIndex(null)
      setNumpadValue('1')
    }
  }

  const getTotalItems = () => operation.products.length
  const getTotalUnits = () => operation.products.reduce((sum, p) => sum + p.quantity, 0)

  const canConfirm = () => {
    if (operation.products.length === 0) return false

    switch (operation.operationType) {
      case 'transfer':
        return operation.destinationWarehouseId !== null
      case 'scrap':
        return operation.scrapReason !== null
      case 'adjustment':
        return operation.adjustmentReason !== null &&
               operation.products.every(p => p.realStock !== undefined)
      default:
        return true
    }
  }

  const handleConfirmOperation = async () => {
    if (!canConfirm() || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const lines = operation.products.map(p => ({
        productId: p.productId,
        quantity: p.quantity,
        realStock: p.realStock,
        scrapReason: operation.scrapReason,
        adjustmentReason: operation.adjustmentReason
      }))

      const response = await fetch(`/api/market/warehouses/${warehouseId}/operations/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationType: operation.operationType,
          destinationWarehouseId: operation.destinationWarehouseId,
          referenceType: operation.referenceType !== 'none' ? operation.referenceType : undefined,
          referenceId: operation.referenceId,
          scrapReason: operation.scrapReason,
          adjustmentReason: operation.adjustmentReason,
          notes: operation.notes || undefined,
          lines
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(data.message)

        // Print report silently via print service
        if (operation.operationType) {
          printOperationReport({
            operationType: operation.operationType,
            operationNumber: data.data.operationNumber,
            operationId: data.data.operationId,
            warehouse: warehouse!,
            destinationWarehouse: operation.destinationWarehouse,
            products: operation.products,
            scrapReason: operation.scrapReason,
            adjustmentReason: operation.adjustmentReason,
            notes: operation.notes
          })
        }

        // Reset after success
        setTimeout(() => {
          setOperation(initialOperationState)
          setSuccess(null)
        }, 2000)
      } else {
        setError(data.error || 'Error al confirmar operacion')
      }
    } catch {
      setError('Error de conexion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (operation.operationType && operation.products.length > 0) {
      if (confirm('Hay productos escaneados. ¿Desea salir sin guardar?')) {
        setOperation(initialOperationState)
      }
    } else if (operation.operationType) {
      setOperation(initialOperationState)
    } else {
      router.push('/dashboard/market/warehouses')
    }
  }

  const getOperationColor = () => {
    switch (operation.operationType) {
      case 'reception': return 'green'
      case 'transfer': return 'blue'
      case 'scrap': return 'red'
      case 'adjustment': return 'amber'
      default: return 'purple'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (!warehouse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <p className="text-lg text-gray-600 dark:text-gray-300">Almacen no encontrado</p>
        <button
          onClick={() => router.push('/dashboard/market/warehouses')}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Volver a almacenes
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            <div className="flex items-center gap-2">
              <Warehouse className="w-6 h-6 text-purple-600" />
              <div>
                <h1 className="font-bold text-gray-900 dark:text-white">
                  {operation.operationType
                    ? `${operation.operationType === 'reception' ? 'Recepcion' :
                        operation.operationType === 'transfer' ? 'Transferencia' :
                        operation.operationType === 'scrap' ? 'Scrap' :
                        operation.operationType === 'adjustment' ? 'Ajuste' :
                        operation.operationType === 'receive_transfer' ? 'Recibir Transferencia' :
                        operation.operationType === 'consignment_reception' ? 'Recibir Consignacion' : 'Operacion'}`
                    : 'Operaciones'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{warehouse.name}</p>
              </div>
            </div>
          </div>

          {operation.operationType && operation.products.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">{getTotalItems()} productos</p>
                <p className="font-bold text-gray-900 dark:text-white">{getTotalUnits()} unidades</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Success/Error Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            {success}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Validation Modal */}
      {showValidationView && selectedTransfer && (
        <TransferValidationView
          warehouseId={warehouseId}
          operationId={selectedTransfer.id}
          onClose={handleValidationClose}
          onComplete={handleValidationComplete}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4">
        {!operation.operationType ? (
          <OperationTypeSelector
            onSelect={handleOperationTypeSelect}
            currentWarehouse={warehouse}
          />
        ) : operation.operationType === 'receive_transfer' ? (
          /* Receive Transfer View */
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <PendingTransfersList
                transfers={pendingTransfers}
                onSelectTransfer={handleSelectTransferForValidation}
                loading={loadingTransfers}
              />

              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleBack}
                  className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  Volver a operaciones
                </button>
              </div>
            </div>
          </div>
        ) : operation.operationType === 'consignment_reception' ? (
          /* Consignment Reception View */
          <ConsignmentReceptionView
            warehouseId={warehouseId}
            warehouseName={warehouse.name}
            onBack={handleBack}
            onComplete={() => {
              setOperation({ ...initialOperationState, operationType: null })
              setSuccess('Consignacion recibida exitosamente')
              setTimeout(() => setSuccess(null), 3000)
            }}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Scanner + Products */}
            <div className="lg:col-span-2 space-y-4">
              {/* Scanner */}
              <WarehouseScanner
                warehouseId={warehouseId}
                onProductScanned={handleProductScanned}
                onError={handleScanError}
                disabled={submitting}
              />

              {/* Products List */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Productos Escaneados
                  </h2>
                  {operation.products.length > 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Click en un producto para editar cantidad
                    </span>
                  )}
                </div>

                {operation.products.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Escanea productos para agregarlos</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    <AnimatePresence>
                      {operation.products.map((product, index) => (
                        <div
                          key={product.id}
                          onClick={() => {
                            setSelectedProductIndex(index)
                            setNumpadValue(
                              operation.operationType === 'adjustment'
                                ? String(product.realStock ?? product.currentStock)
                                : String(product.quantity)
                            )
                          }}
                          className={`cursor-pointer ${selectedProductIndex === index ? 'ring-2 ring-purple-500 rounded-xl' : ''}`}
                        >
                          <ScannedProductCard
                            product={product}
                            onQuantityChange={(qty) => handleQuantityChange(product.id, qty)}
                            onRemove={() => handleRemoveProduct(product.id)}
                            showStock={operation.operationType === 'transfer' || operation.operationType === 'scrap'}
                            showRealStock={operation.operationType === 'adjustment'}
                            onRealStockChange={(realStock) => handleRealStockChange(product.id, realStock)}
                            maxQuantity={
                              (operation.operationType === 'transfer' || operation.operationType === 'scrap') && !warehouse.allowNegativeStock
                                ? product.currentStock
                                : undefined
                            }
                          />
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Configuration */}
            <div className="space-y-4">
              {/* Operation specific selectors */}
              {operation.operationType === 'reception' && (
                <ReferenceOrderSelector
                  warehouseId={warehouseId}
                  selectedReference={{
                    type: operation.referenceType,
                    id: operation.referenceId,
                    orderNumber: operation.referenceOrderNumber
                  }}
                  onSelect={(ref) => setOperation(prev => ({
                    ...prev,
                    referenceType: ref.type,
                    referenceId: ref.id,
                    referenceOrderNumber: ref.orderNumber
                  }))}
                  disabled={submitting}
                />
              )}

              {operation.operationType === 'transfer' && (
                <DestinationWarehouseSelector
                  currentWarehouseId={warehouseId}
                  selectedWarehouseId={operation.destinationWarehouseId}
                  onSelect={(id, warehouse) => setOperation(prev => ({
                    ...prev,
                    destinationWarehouseId: id,
                    destinationWarehouse: warehouse
                  }))}
                  disabled={submitting}
                />
              )}

              {operation.operationType === 'scrap' && (
                <ScrapReasonSelector
                  selectedReason={operation.scrapReason}
                  onSelect={(reason) => setOperation(prev => ({ ...prev, scrapReason: reason }))}
                  disabled={submitting}
                />
              )}

              {operation.operationType === 'adjustment' && (
                <AdjustmentReasonSelector
                  selectedReason={operation.adjustmentReason}
                  onSelect={(reason) => setOperation(prev => ({ ...prev, adjustmentReason: reason }))}
                  disabled={submitting}
                />
              )}

              {/* Numpad */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  {selectedProductIndex !== null && operation.products[selectedProductIndex] ? (
                    <>
                      <span>Cantidad para:</span>
                      <span className="text-purple-600">{operation.products[selectedProductIndex].name}</span>
                    </>
                  ) : (
                    'Selecciona un producto'
                  )}
                </h3>

                <WarehouseNumpad
                  value={numpadValue}
                  onChange={setNumpadValue}
                  onConfirm={handleNumpadConfirm}
                  disabled={selectedProductIndex === null || submitting}
                  maxValue={
                    selectedProductIndex !== null &&
                    (operation.operationType === 'transfer' || operation.operationType === 'scrap') &&
                    !warehouse.allowNegativeStock
                      ? operation.products[selectedProductIndex]?.currentStock
                      : undefined
                  }
                />
              </div>

              {/* Notes */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={operation.notes}
                  onChange={(e) => setOperation(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Agregar notas sobre esta operacion..."
                  rows={3}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirmOperation}
                  disabled={!canConfirm() || submitting}
                  className={`
                    flex-1 px-4 py-3 rounded-xl font-medium text-white
                    flex items-center justify-center gap-2
                    transition-all
                    ${canConfirm() && !submitting
                      ? `bg-gradient-to-r from-${getOperationColor()}-500 to-${getOperationColor()}-600 hover:from-${getOperationColor()}-600 hover:to-${getOperationColor()}-700`
                      : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'}
                  `}
                  style={{
                    background: canConfirm() && !submitting
                      ? operation.operationType === 'reception' ? 'linear-gradient(to right, #22c55e, #10b981)' :
                        operation.operationType === 'transfer' ? 'linear-gradient(to right, #3b82f6, #06b6d4)' :
                        operation.operationType === 'scrap' ? 'linear-gradient(to right, #ef4444, #f43f5e)' :
                        'linear-gradient(to right, #f59e0b, #eab308)'
                      : undefined
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Confirmar
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
