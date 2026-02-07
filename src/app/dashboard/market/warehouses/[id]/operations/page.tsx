'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
import PendingWholesaleDeliveriesList, { type PendingWholesaleDelivery } from '@/components/warehouse/PendingWholesaleDeliveriesList'
import WholesaleDeliveryValidationView from '@/components/warehouse/WholesaleDeliveryValidationView'
import UnifiedReceptionView from '@/components/warehouse/UnifiedReceptionView'
import ReturnTypeSelector, { type ReturnType } from '@/components/warehouse/ReturnTypeSelector'
import SupplierReturnView from '@/components/warehouse/SupplierReturnView'
import POSReturnReceiveView from '@/components/warehouse/POSReturnReceiveView'
import PrintLabelsView from '@/components/warehouse/PrintLabelsView'
import StockReportView from '@/components/warehouse/StockReportView'
import TransferHistoryView from '@/components/warehouse/TransferHistoryView'
import AdjustmentsHistoryView from '@/components/warehouse/AdjustmentsHistoryView'
import { PasswordConfirmModal } from '@/components/auth/PasswordConfirmModal'

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
    transfer: 'TRANSFERENCIA INTERNA',
    scrap: 'REPORTE DE SCRAP / MERMA',
    adjustment: 'AJUSTE DE INVENTARIO',
    receive_transfer: 'RECEPCIÓN DE TRANSFERENCIA',
    order_reception: 'RECEPCIÓN DE ORDEN',
    return: 'DEVOLUCIÓN'
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
            data.operationType === 'transfer' ? 'badge-blue' :
            data.operationType === 'scrap' ? 'badge-red' :
            data.operationType === 'return' ? 'badge-red' :
            data.operationType === 'receive_transfer' ? 'badge-green' :
            data.operationType === 'order_reception' ? 'badge-green' : 'badge-amber'
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
              ${data.operationType === 'receive_transfer' || data.operationType === 'order_reception' ? 'RECIBIDO POR' :
                data.operationType === 'transfer' ? 'ENTREGADO POR' :
                data.operationType === 'scrap' || data.operationType === 'return' ? 'AUTORIZADO POR' : 'REALIZADO POR'}
            </div>
            <div class="signature-subtitle">Nombre y Firma</div>
            <div class="signature-subtitle">Fecha: ___/___/______</div>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-line">
            <div class="signature-title">
              ${data.operationType === 'receive_transfer' || data.operationType === 'order_reception' ? 'VERIFICADO POR' :
                data.operationType === 'transfer' ? 'RECIBIDO POR' :
                data.operationType === 'scrap' || data.operationType === 'return' ? 'EJECUTADO POR' : 'APROBADO POR'}
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
  const searchParams = useSearchParams()
  const warehouseId = parseInt(params.id as string)

  // Get initial values from URL
  const initialOperationType = searchParams.get('type') as OperationType | null
  const initialOperationId = searchParams.get('operationId')
  const initialReturnType = searchParams.get('returnType') as ReturnType | null

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

  // Wholesale delivery validation state
  const [pendingWholesaleDeliveries, setPendingWholesaleDeliveries] = useState<PendingWholesaleDelivery[]>([])
  const [loadingWholesaleDeliveries, setLoadingWholesaleDeliveries] = useState(false)
  const [selectedWholesaleDelivery, setSelectedWholesaleDelivery] = useState<PendingWholesaleDelivery | null>(null)
  const [showWholesaleValidationView, setShowWholesaleValidationView] = useState(false)

  // Return operation state
  const [returnType, setReturnType] = useState<ReturnType | null>(initialReturnType)

  // History view state
  const [historyOperationId, setHistoryOperationId] = useState<number | null>(
    initialOperationId ? parseInt(initialOperationId) : null
  )

  // Update URL when operation state changes
  const updateURL = useCallback((type: OperationType | null, opId?: number | null, retType?: ReturnType | null) => {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (opId) params.set('operationId', opId.toString())
    if (retType) params.set('returnType', retType)

    const newURL = params.toString()
      ? `/dashboard/market/warehouses/${warehouseId}/operations?${params.toString()}`
      : `/dashboard/market/warehouses/${warehouseId}/operations`

    router.replace(newURL, { scroll: false })
  }, [warehouseId, router])

  // Password verification for sensitive operations
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pendingOperationType, setPendingOperationType] = useState<OperationType | null>(null)

  // Password verification for exiting to backend
  const [showExitPasswordModal, setShowExitPasswordModal] = useState(false)

  // Variant selection state
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [pendingProductWithVariants, setPendingProductWithVariants] = useState<ScannedProductData | null>(null)

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

  // Initialize operation from URL params
  useEffect(() => {
    if (initialOperationType && !operation.operationType) {
      // Initialize state from URL
      if (initialOperationType === 'return' && initialReturnType) {
        setOperation({ ...initialOperationState, operationType: initialOperationType })
        setReturnType(initialReturnType)
      } else if (initialOperationType === 'receive_transfer') {
        setOperation({ ...initialOperationState, operationType: initialOperationType })
        fetchPendingTransfers()
      } else {
        setOperation({ ...initialOperationState, operationType: initialOperationType })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOperationType, initialReturnType])

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

  // Fetch pending wholesale deliveries when wholesale_delivery is selected
  const fetchPendingWholesaleDeliveries = useCallback(async () => {
    setLoadingWholesaleDeliveries(true)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/pending-wholesale-deliveries`)
      const data = await response.json()
      if (data.success) {
        setPendingWholesaleDeliveries(data.data.deliveries)
      } else {
        setError(data.error)
      }
    } catch (err) {
      console.error('Error fetching pending wholesale deliveries:', err)
      setError('Error al cargar entregas mayoristas pendientes')
    } finally {
      setLoadingWholesaleDeliveries(false)
    }
  }, [warehouseId])

  const handleOperationTypeSelect = (type: OperationType) => {
    // Require password for scrap and adjustment operations
    if (type === 'scrap' || type === 'adjustment') {
      setPendingOperationType(type)
      setShowPasswordModal(true)
      return
    }

    proceedWithOperation(type)
  }

  const proceedWithOperation = (type: OperationType) => {
    if (type === 'receive_transfer') {
      setOperation({ ...initialOperationState, operationType: type })
      fetchPendingTransfers()
    } else if (type === 'wholesale_delivery') {
      setOperation({ ...initialOperationState, operationType: type })
      fetchPendingWholesaleDeliveries()
    } else if (type === 'order_reception') {
      setOperation({ ...initialOperationState, operationType: type })
    } else if (type === 'return') {
      setOperation({ ...initialOperationState, operationType: type })
      setReturnType(null)
    } else if (type === 'transfer_history') {
      setOperation({ ...initialOperationState, operationType: type })
      setHistoryOperationId(null)
    } else if (type === 'adjustments_history') {
      setOperation({ ...initialOperationState, operationType: type })
      setHistoryOperationId(null)
    } else {
      setOperation({ ...initialOperationState, operationType: type })
    }
    setSelectedProductIndex(null)
    setNumpadValue('1')
    setError(null)
    setSuccess(null)
    setSelectedTransfer(null)
    setShowValidationView(false)
    setSelectedWholesaleDelivery(null)
    setShowWholesaleValidationView(false)
    if (type !== 'return') {
      setReturnType(null)
    }
    // Update URL
    updateURL(type)
  }

  const handlePasswordConfirm = () => {
    if (pendingOperationType) {
      proceedWithOperation(pendingOperationType)
    }
    setShowPasswordModal(false)
    setPendingOperationType(null)
  }

  const handlePasswordClose = () => {
    setShowPasswordModal(false)
    setPendingOperationType(null)
  }

  const handleReturnTypeSelect = (type: ReturnType) => {
    setReturnType(type)
    updateURL('return', null, type)
  }

  const handleReturnBack = () => {
    if (returnType) {
      setReturnType(null)
      updateURL('return')
    } else {
      setOperation(initialOperationState)
      updateURL(null)
    }
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

  // Wholesale delivery handlers
  const handleSelectWholesaleDelivery = (delivery: PendingWholesaleDelivery) => {
    setSelectedWholesaleDelivery(delivery)
    setShowWholesaleValidationView(true)
  }

  const handleWholesaleDeliveryComplete = () => {
    setShowWholesaleValidationView(false)
    setSelectedWholesaleDelivery(null)
    setSuccess('Entrega mayorista completada exitosamente')
    // Refresh the pending deliveries list
    fetchPendingWholesaleDeliveries()
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleWholesaleDeliveryClose = () => {
    setShowWholesaleValidationView(false)
    setSelectedWholesaleDelivery(null)
  }

  const handleProductScanned = useCallback((data: ScannedProductData) => {
    // Log completo de datos recibidos del API
    console.log('[Operations] Datos completos del API:', JSON.stringify(data, null, 2))

    // Si el producto tiene variantes y NO se escaneó una variante específica, mostrar selector
    if (data.product.hasVariants && data.variants && data.variants.length > 0 && !data.variant) {
      setPendingProductWithVariants(data)
      setShowVariantModal(true)
      return
    }

    // Determinar el variantId si se escaneó una variante específica
    const variantId = data.variant?.id ?? null
    const variantName = data.variant?.name ?? null

    // Log para debug
    console.log('[Operations] Producto escaneado:', {
      productName: data.product.name,
      variantId,
      variantName,
      variantObject: data.variant,
      hasVariant: !!data.variant
    })

    setOperation(prev => {
      // Check if product+variant already exists
      const existingIndex = prev.products.findIndex(p =>
        p.productId === data.product.id && p.variantId === variantId
      )

      if (existingIndex >= 0) {
        // Increment quantity y mover al inicio de la lista
        const existingProduct = prev.products[existingIndex]
        const otherProducts = prev.products.filter((_, i) => i !== existingIndex)
        const updatedProduct = {
          ...existingProduct,
          quantity: existingProduct.quantity + 1
        }
        return { ...prev, products: [updatedProduct, ...otherProducts] }
      }

      // Add new product (with or without variant)
      // El nombre debe incluir la variante para identificación clara
      const displayName = variantName
        ? `${data.product.name} - ${variantName}`
        : data.product.name

      const newProduct: ScannedProduct = {
        id: Date.now(),
        productId: data.product.id,
        variantId: variantId,
        variantName: variantName,
        name: displayName,
        sku: data.variant?.sku || data.product.sku,
        barcode: data.variant?.barcode || data.product.barcode,
        imageUrl: data.variant?.imageUrl || data.product.imageUrl,
        unit: data.product.unit || 'unidad',
        quantity: 1,
        currentStock: data.stock.quantityAvailable,
        costPrice: data.variant?.costPrice || data.product.costPrice,
        sellingPrice: data.variant?.price || data.product.sellingPrice
      }

      console.log('[Operations] Nuevo producto agregado:', {
        name: newProduct.name,
        variantId: newProduct.variantId,
        variantName: newProduct.variantName,
        sku: newProduct.sku
      })

      // Agregar el producto al inicio de la lista para que sea visible sin scroll
      return { ...prev, products: [newProduct, ...prev.products] }
    })
    setError(null)
  }, [])

  // Handle variant selection from modal
  const handleVariantSelect = useCallback((variant: { id: number; name: string; sku: string; barcode: string | null; price: number; costPrice: number; imageUrl: string | null; stock: number }) => {
    if (!pendingProductWithVariants) return

    const data = pendingProductWithVariants

    setOperation(prev => {
      // Check if this variant already exists
      const existingIndex = prev.products.findIndex(p =>
        p.productId === data.product.id && p.variantId === variant.id
      )

      if (existingIndex >= 0) {
        // Increment quantity y mover al inicio
        const existingProduct = prev.products[existingIndex]
        const otherProducts = prev.products.filter((_, i) => i !== existingIndex)
        const updatedProduct = {
          ...existingProduct,
          quantity: existingProduct.quantity + 1
        }
        return { ...prev, products: [updatedProduct, ...otherProducts] }
      }

      const displayName = `${data.product.name} - ${variant.name}`

      const newProduct: ScannedProduct = {
        id: Date.now(),
        productId: data.product.id,
        variantId: variant.id,
        variantName: variant.name,
        name: displayName,
        sku: variant.sku,
        barcode: variant.barcode || data.product.barcode,
        imageUrl: variant.imageUrl || data.product.imageUrl,
        unit: data.product.unit,
        quantity: 1,
        currentStock: variant.stock,
        costPrice: variant.costPrice,
        sellingPrice: variant.price
      }

      return { ...prev, products: [newProduct, ...prev.products] }
    })

    setShowVariantModal(false)
    setPendingProductWithVariants(null)
    setError(null)
  }, [pendingProductWithVariants])

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
      const quantity = parseFloat(numpadValue) || 1
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
        variantId: p.variantId || null,
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
        setHistoryOperationId(null)
        updateURL(null)
      }
    } else if (operation.operationType) {
      setOperation(initialOperationState)
      setHistoryOperationId(null)
      updateURL(null)
    } else {
      // Require password to exit to backend
      setShowExitPasswordModal(true)
    }
  }

  const handleExitPasswordConfirm = () => {
    setShowExitPasswordModal(false)
    router.push('/dashboard/market/warehouses')
  }

  const handleExitPasswordClose = () => {
    setShowExitPasswordModal(false)
  }

  const getOperationColor = () => {
    switch (operation.operationType) {
      case 'transfer': return 'blue'
      case 'scrap': return 'red'
      case 'adjustment': return 'amber'
      case 'return': return 'orange'
      case 'receive_transfer': return 'purple'
      case 'order_reception': return 'teal'
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
      {/* Password Confirmation Modal for sensitive operations */}
      <PasswordConfirmModal
        isOpen={showPasswordModal}
        onClose={handlePasswordClose}
        onConfirm={handlePasswordConfirm}
        title={pendingOperationType === 'scrap' ? 'Autorizar Scrap' : 'Autorizar Ajuste'}
        description={
          pendingOperationType === 'scrap'
            ? 'Esta operacion eliminara productos del inventario permanentemente.'
            : 'Esta operacion modificara las cantidades del inventario.'
        }
        operationType={pendingOperationType === 'scrap' ? 'scrap' : 'adjustment'}
      />

      {/* Password Confirmation Modal for exiting to backend */}
      <PasswordConfirmModal
        isOpen={showExitPasswordModal}
        onClose={handleExitPasswordClose}
        onConfirm={handleExitPasswordConfirm}
        title="Salir al Sistema"
        description="Ingrese su contraseña para salir de las operaciones de almacén y volver al backend."
        operationType="exit"
      />

      {/* Variant Selection Modal */}
      <AnimatePresence>
        {showVariantModal && pendingProductWithVariants && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              setShowVariantModal(false)
              setPendingProductWithVariants(null)
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  Seleccionar Variante
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {pendingProductWithVariants.product.name}
                </p>
              </div>
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {pendingProductWithVariants.variants?.map(variant => (
                  <button
                    key={variant.id}
                    onClick={() => handleVariantSelect(variant)}
                    className="w-full p-3 flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                  >
                    <div className="text-left">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {variant.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        SKU: {variant.sku}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-600">
                        Stock: {variant.stock}
                      </p>
                      {variant.barcode && (
                        <p className="text-xs text-gray-400">
                          {variant.barcode}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowVariantModal(false)
                    setPendingProductWithVariants(null)
                  }}
                  className="w-full py-2 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    ? `${operation.operationType === 'transfer' ? 'Transferencia' :
                        operation.operationType === 'scrap' ? 'Scrap' :
                        operation.operationType === 'adjustment' ? 'Ajuste' :
                        operation.operationType === 'receive_transfer' ? 'Recibir Transferencia' :
                        operation.operationType === 'wholesale_delivery' ? 'Entrega Mayorista' :
                        operation.operationType === 'order_reception' ? 'Recibir Orden' :
                        operation.operationType === 'return' ? (returnType === 'supplier' ? 'Devolucion a Proveedor' : returnType === 'pos' ? 'Devolucion desde POS' : 'Devoluciones') :
                        operation.operationType === 'print_labels' ? 'Imprimir Etiquetas' :
                        operation.operationType === 'stock_report' ? 'Reporte de Stock' :
                        operation.operationType === 'transfer_history' ? 'Historial de Transferencias' :
                        operation.operationType === 'adjustments_history' ? 'Historial de Ajustes y Scrap' : 'Operacion'}`
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
                onViewHistory={() => {
                  proceedWithOperation('transfer_history')
                }}
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
        ) : operation.operationType === 'wholesale_delivery' ? (
          /* Wholesale Delivery View */
          showWholesaleValidationView && selectedWholesaleDelivery ? (
            /* Validation View - replaces the list entirely */
            <WholesaleDeliveryValidationView
              warehouseId={warehouseId}
              operationId={selectedWholesaleDelivery.id}
              onClose={handleWholesaleDeliveryClose}
              onComplete={handleWholesaleDeliveryComplete}
            />
          ) : (
            /* Pending Deliveries List */
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <PendingWholesaleDeliveriesList
                  deliveries={pendingWholesaleDeliveries}
                  onSelectDelivery={handleSelectWholesaleDelivery}
                  loading={loadingWholesaleDeliveries}
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
          )
        ) : operation.operationType === 'order_reception' ? (
          /* Unified Order Reception View (Consignments + Purchases) */
          <UnifiedReceptionView
            warehouseId={warehouseId}
            warehouseName={warehouse.name}
            onBack={handleBack}
            onComplete={(data) => {
              setOperation({ ...initialOperationState, operationType: null })
              setSuccess(`Orden ${data.orderNumber} recibida: ${data.unitsReceived} unidades`)
              setTimeout(() => setSuccess(null), 3000)
            }}
          />
        ) : operation.operationType === 'return' ? (
          /* Return Operations View */
          !returnType ? (
            <ReturnTypeSelector
              onSelect={handleReturnTypeSelect}
              onBack={handleReturnBack}
              currentWarehouse={warehouse}
            />
          ) : returnType === 'supplier' ? (
            <SupplierReturnView
              warehouseId={warehouseId}
              warehouseName={warehouse.name}
              onBack={handleReturnBack}
              onComplete={(data) => {
                setReturnType(null)
                setOperation(initialOperationState)
                setSuccess(`Devolucion completada: ${data.totalUnits} unidades devueltas a ${data.supplierName}`)
                setTimeout(() => setSuccess(null), 3000)
              }}
            />
          ) : (
            <POSReturnReceiveView
              warehouseId={warehouseId}
              warehouseName={warehouse.name}
              onBack={handleReturnBack}
              onComplete={(data) => {
                setReturnType(null)
                setOperation(initialOperationState)
                setSuccess(`Devolucion POS procesada: ${data.totalUnits} unidades a scrap`)
                setTimeout(() => setSuccess(null), 3000)
              }}
            />
          )
        ) : operation.operationType === 'print_labels' ? (
          /* Print Labels View */
          <PrintLabelsView
            warehouseId={warehouseId}
            warehouseName={warehouse.name}
            onBack={handleBack}
          />
        ) : operation.operationType === 'stock_report' ? (
          /* Stock Report View */
          <StockReportView
            warehouseId={warehouseId}
            warehouseName={warehouse.name}
            onBack={handleBack}
          />
        ) : operation.operationType === 'transfer_history' ? (
          /* Transfer History View */
          <TransferHistoryView
            warehouseId={warehouseId}
            warehouseName={warehouse.name}
            onBack={handleBack}
            initialOperationId={historyOperationId}
            onSelectOperation={(opId) => {
              setHistoryOperationId(opId || null)
              updateURL('transfer_history', opId || null)
            }}
          />
        ) : operation.operationType === 'adjustments_history' ? (
          /* Adjustments History View */
          <AdjustmentsHistoryView
            warehouseId={warehouseId}
            warehouseName={warehouse.name}
            onBack={handleBack}
            initialOperationId={historyOperationId}
            onSelectOperation={(opId) => {
              setHistoryOperationId(opId || null)
              updateURL('adjustments_history', opId || null)
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
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {operation.products.map((product, index) => (
                        <motion.div
                          key={product.id}
                          layout
                          initial={{ opacity: 0, y: -20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
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
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Configuration */}
            <div className="space-y-4">
              {/* Operation specific selectors */}
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
                  onViewHistory={() => proceedWithOperation('transfer_history')}
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
                      ? operation.operationType === 'transfer' ? 'linear-gradient(to right, #3b82f6, #06b6d4)' :
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
