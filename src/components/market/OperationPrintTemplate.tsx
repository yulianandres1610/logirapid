'use client'

import React, { forwardRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface OperationLine {
  productId: number
  productName: string
  sku: string
  quantityPlanned: number
  quantityDone: number
  sourceLocation?: string
  destinationLocation?: string
  scrapReason?: string
}

interface Warehouse {
  id: number
  name: string
  code: string
  address?: string
  city?: string
}

interface OperationData {
  id: number
  operationNumber: string
  operationType: 'transfer' | 'reception' | 'picking' | 'scrap' | 'adjustment'
  sourceWarehouse?: Warehouse | null
  destinationWarehouse?: Warehouse | null
  referenceType?: string
  referenceNumber?: string
  status: string
  scheduledDate?: string
  startedAt?: string
  completedAt?: string
  notes?: string
  lines: OperationLine[]
  createdBy?: string
  createdAt: string
  companyName?: string
  companyLogo?: string
}

interface OperationPrintTemplateProps {
  operation: OperationData
  title?: string
}

const OPERATION_TYPE_NAMES: Record<string, string> = {
  transfer: 'TRANSFERENCIA',
  reception: 'RECEPCIÓN',
  picking: 'PREPARACIÓN',
  scrap: 'SCRAP / MERMA',
  adjustment: 'AJUSTE'
}

export const OperationPrintTemplate = forwardRef<HTMLDivElement, OperationPrintTemplateProps>(
  ({ operation, title }, ref) => {
    const operationTypeName = OPERATION_TYPE_NAMES[operation.operationType] || operation.operationType.toUpperCase()
    const defaultTitle = title || `ALBARÁN DE ${operationTypeName}`

    const totalPlanned = operation.lines.reduce((sum, l) => sum + l.quantityPlanned, 0)
    const totalDone = operation.lines.reduce((sum, l) => sum + l.quantityDone, 0)

    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-'
      try {
        return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: es })
      } catch {
        return dateStr
      }
    }

    return (
      <div
        ref={ref}
        className="bg-white text-black p-8 min-h-[297mm] w-[210mm] mx-auto print:m-0 print:p-6"
        style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px' }}
      >
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              {operation.companyLogo ? (
                <img
                  src={operation.companyLogo}
                  alt={operation.companyName || 'Logo'}
                  className="h-12 mb-2"
                />
              ) : (
                <h1 className="text-2xl font-bold">{operation.companyName || 'LogiRapid'}</h1>
              )}
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">{defaultTitle}</h2>
              <p className="text-lg font-mono mt-1">{operation.operationNumber}</p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Left Column - Warehouses */}
          <div className="space-y-3">
            {operation.sourceWarehouse && (
              <div className="border rounded p-3">
                <p className="text-xs text-gray-500 uppercase font-bold">
                  {operation.operationType === 'transfer' ? 'ALMACÉN ORIGEN' : 'ALMACÉN'}
                </p>
                <p className="font-bold text-base">{operation.sourceWarehouse.name}</p>
                <p className="text-sm">{operation.sourceWarehouse.code}</p>
                {operation.sourceWarehouse.address && (
                  <p className="text-xs text-gray-600 mt-1">
                    {operation.sourceWarehouse.address}
                    {operation.sourceWarehouse.city && `, ${operation.sourceWarehouse.city}`}
                  </p>
                )}
              </div>
            )}

            {operation.destinationWarehouse && (
              <div className="border rounded p-3">
                <p className="text-xs text-gray-500 uppercase font-bold">ALMACÉN DESTINO</p>
                <p className="font-bold text-base">{operation.destinationWarehouse.name}</p>
                <p className="text-sm">{operation.destinationWarehouse.code}</p>
                {operation.destinationWarehouse.address && (
                  <p className="text-xs text-gray-600 mt-1">
                    {operation.destinationWarehouse.address}
                    {operation.destinationWarehouse.city && `, ${operation.destinationWarehouse.city}`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha Creación:</span>
              <span className="font-medium">{formatDate(operation.createdAt)}</span>
            </div>
            {operation.scheduledDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha Programada:</span>
                <span className="font-medium">{formatDate(operation.scheduledDate)}</span>
              </div>
            )}
            {operation.startedAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha Inicio:</span>
                <span className="font-medium">{formatDate(operation.startedAt)}</span>
              </div>
            )}
            {operation.completedAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha Completado:</span>
                <span className="font-medium">{formatDate(operation.completedAt)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Estado:</span>
              <span className={`font-bold px-2 py-0.5 rounded ${
                operation.status === 'done' ? 'bg-green-100 text-green-800' :
                operation.status === 'in_progress' ? 'bg-amber-100 text-amber-800' :
                operation.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {operation.status === 'draft' && 'BORRADOR'}
                {operation.status === 'confirmed' && 'CONFIRMADO'}
                {operation.status === 'in_progress' && 'EN PROCESO'}
                {operation.status === 'done' && 'COMPLETADO'}
                {operation.status === 'cancelled' && 'CANCELADO'}
              </span>
            </div>
            {operation.referenceNumber && (
              <div className="flex justify-between">
                <span className="text-gray-600">Referencia:</span>
                <span className="font-medium">{operation.referenceNumber}</span>
              </div>
            )}
            {operation.createdBy && (
              <div className="flex justify-between">
                <span className="text-gray-600">Creado por:</span>
                <span className="font-medium">{operation.createdBy}</span>
              </div>
            )}
          </div>
        </div>

        {/* Products Table */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">#</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">PRODUCTO</th>
              <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">SKU</th>
              {(operation.operationType === 'transfer' || operation.operationType === 'picking') && (
                <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">UBICACIÓN</th>
              )}
              {operation.operationType === 'scrap' && (
                <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">MOTIVO</th>
              )}
              <th className="border border-gray-300 px-3 py-2 text-center text-xs font-bold">PLAN.</th>
              <th className="border border-gray-300 px-3 py-2 text-center text-xs font-bold">REAL</th>
              <th className="border border-gray-300 px-3 py-2 text-center text-xs font-bold">✓</th>
            </tr>
          </thead>
          <tbody>
            {operation.lines.map((line, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-300 px-3 py-2 text-sm">{index + 1}</td>
                <td className="border border-gray-300 px-3 py-2 text-sm font-medium">{line.productName}</td>
                <td className="border border-gray-300 px-3 py-2 text-sm font-mono">{line.sku}</td>
                {(operation.operationType === 'transfer' || operation.operationType === 'picking') && (
                  <td className="border border-gray-300 px-3 py-2 text-sm">
                    {line.sourceLocation || line.destinationLocation || '-'}
                  </td>
                )}
                {operation.operationType === 'scrap' && (
                  <td className="border border-gray-300 px-3 py-2 text-sm">{line.scrapReason || '-'}</td>
                )}
                <td className="border border-gray-300 px-3 py-2 text-center text-sm font-bold">
                  {line.quantityPlanned}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                  {line.quantityDone > 0 ? line.quantityDone : ''}
                </td>
                <td className="border border-gray-300 px-3 py-2 text-center">
                  <div className="w-5 h-5 border-2 border-gray-400 mx-auto"></div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td colSpan={operation.operationType === 'reception' ? 3 : 4}
                  className="border border-gray-300 px-3 py-2 text-right text-sm">
                TOTALES:
              </td>
              <td className="border border-gray-300 px-3 py-2 text-center text-sm">{totalPlanned}</td>
              <td className="border border-gray-300 px-3 py-2 text-center text-sm">{totalDone > 0 ? totalDone : ''}</td>
              <td className="border border-gray-300 px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>

        {/* Notes */}
        {operation.notes && (
          <div className="mb-6 p-3 border rounded bg-gray-50">
            <p className="text-xs text-gray-500 uppercase font-bold mb-1">NOTAS:</p>
            <p className="text-sm">{operation.notes}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-8">
          <div className="text-center">
            <div className="border-t-2 border-black pt-2 mt-12">
              <p className="font-bold">
                {operation.operationType === 'transfer' && 'PREPARADO POR'}
                {operation.operationType === 'reception' && 'RECIBIDO POR'}
                {operation.operationType === 'picking' && 'PREPARADO POR'}
                {operation.operationType === 'scrap' && 'AUTORIZADO POR'}
                {operation.operationType === 'adjustment' && 'REALIZADO POR'}
              </p>
              <p className="text-sm text-gray-500 mt-1">Nombre y Firma</p>
              <p className="text-sm text-gray-500">Fecha: ___/___/______</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t-2 border-black pt-2 mt-12">
              <p className="font-bold">
                {operation.operationType === 'transfer' && 'RECIBIDO POR'}
                {operation.operationType === 'reception' && 'VERIFICADO POR'}
                {operation.operationType === 'picking' && 'VERIFICADO POR'}
                {operation.operationType === 'scrap' && 'EJECUTADO POR'}
                {operation.operationType === 'adjustment' && 'APROBADO POR'}
              </p>
              <p className="text-sm text-gray-500 mt-1">Nombre y Firma</p>
              <p className="text-sm text-gray-500">Fecha: ___/___/______</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
          <p>Este documento fue generado automáticamente por el sistema de gestión de almacenes</p>
          <p className="mt-1">
            {operation.operationNumber} - Impreso el {format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
          </p>
        </div>
      </div>
    )
  }
)

OperationPrintTemplate.displayName = 'OperationPrintTemplate'

// Hook for printing
export function usePrintOperation() {
  const printOperation = (operation: OperationData, title?: string) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Por favor, permite las ventanas emergentes para imprimir')
      return
    }

    const operationTypeName = OPERATION_TYPE_NAMES[operation.operationType] || operation.operationType.toUpperCase()
    const defaultTitle = title || `ALBARÁN DE ${operationTypeName}`

    const totalPlanned = operation.lines.reduce((sum, l) => sum + l.quantityPlanned, 0)
    const totalDone = operation.lines.reduce((sum, l) => sum + l.quantityDone, 0)

    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-'
      try {
        return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: es })
      } catch {
        return dateStr
      }
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${defaultTitle} - ${operation.operationNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
          .header { border-bottom: 2px solid black; padding-bottom: 15px; margin-bottom: 15px; display: flex; justify-content: space-between; }
          .title { font-size: 18px; font-weight: bold; }
          .op-number { font-size: 16px; font-family: monospace; margin-top: 5px; }
          .company { font-size: 20px; font-weight: bold; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .warehouse-box { border: 1px solid #ccc; padding: 10px; border-radius: 4px; }
          .warehouse-label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; }
          .warehouse-name { font-size: 14px; font-weight: bold; }
          .warehouse-code { font-size: 12px; }
          .detail-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .detail-label { color: #666; }
          .detail-value { font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 11px; }
          th { background: #f5f5f5; font-weight: bold; text-transform: uppercase; font-size: 10px; }
          tr:nth-child(even) { background: #fafafa; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .font-mono { font-family: monospace; }
          .status { padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; }
          .status-done { background: #dcfce7; color: #166534; }
          .status-progress { background: #fef3c7; color: #92400e; }
          .status-cancelled { background: #fee2e2; color: #991b1b; }
          .status-default { background: #f3f4f6; color: #374151; }
          .notes { background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
          .notes-label { font-size: 10px; color: #666; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
          .signature-box { text-align: center; }
          .signature-line { border-top: 2px solid black; padding-top: 10px; margin-top: 60px; }
          .signature-title { font-weight: bold; }
          .signature-subtitle { font-size: 11px; color: #666; margin-top: 5px; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #666; }
          .checkbox { width: 16px; height: 16px; border: 2px solid #9ca3af; display: inline-block; }
          @media print {
            body { padding: 0; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">${operation.companyName || 'LogiRapid'}</div>
          <div style="text-align: right;">
            <div class="title">${defaultTitle}</div>
            <div class="op-number">${operation.operationNumber}</div>
          </div>
        </div>

        <div class="info-grid">
          <div>
            ${operation.sourceWarehouse ? `
              <div class="warehouse-box">
                <div class="warehouse-label">${operation.operationType === 'transfer' ? 'ALMACÉN ORIGEN' : 'ALMACÉN'}</div>
                <div class="warehouse-name">${operation.sourceWarehouse.name}</div>
                <div class="warehouse-code">${operation.sourceWarehouse.code}</div>
                ${operation.sourceWarehouse.address ? `<div style="font-size: 11px; color: #666; margin-top: 5px;">${operation.sourceWarehouse.address}${operation.sourceWarehouse.city ? `, ${operation.sourceWarehouse.city}` : ''}</div>` : ''}
              </div>
            ` : ''}
            ${operation.destinationWarehouse ? `
              <div class="warehouse-box" style="margin-top: 10px;">
                <div class="warehouse-label">ALMACÉN DESTINO</div>
                <div class="warehouse-name">${operation.destinationWarehouse.name}</div>
                <div class="warehouse-code">${operation.destinationWarehouse.code}</div>
                ${operation.destinationWarehouse.address ? `<div style="font-size: 11px; color: #666; margin-top: 5px;">${operation.destinationWarehouse.address}${operation.destinationWarehouse.city ? `, ${operation.destinationWarehouse.city}` : ''}</div>` : ''}
              </div>
            ` : ''}
          </div>
          <div>
            <div class="detail-row">
              <span class="detail-label">Fecha Creación:</span>
              <span class="detail-value">${formatDate(operation.createdAt)}</span>
            </div>
            ${operation.scheduledDate ? `
              <div class="detail-row">
                <span class="detail-label">Fecha Programada:</span>
                <span class="detail-value">${formatDate(operation.scheduledDate)}</span>
              </div>
            ` : ''}
            ${operation.startedAt ? `
              <div class="detail-row">
                <span class="detail-label">Fecha Inicio:</span>
                <span class="detail-value">${formatDate(operation.startedAt)}</span>
              </div>
            ` : ''}
            ${operation.completedAt ? `
              <div class="detail-row">
                <span class="detail-label">Fecha Completado:</span>
                <span class="detail-value">${formatDate(operation.completedAt)}</span>
              </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Estado:</span>
              <span class="status ${
                operation.status === 'done' ? 'status-done' :
                operation.status === 'in_progress' ? 'status-progress' :
                operation.status === 'cancelled' ? 'status-cancelled' :
                'status-default'
              }">
                ${operation.status === 'draft' ? 'BORRADOR' : ''}
                ${operation.status === 'confirmed' ? 'CONFIRMADO' : ''}
                ${operation.status === 'in_progress' ? 'EN PROCESO' : ''}
                ${operation.status === 'done' ? 'COMPLETADO' : ''}
                ${operation.status === 'cancelled' ? 'CANCELADO' : ''}
              </span>
            </div>
            ${operation.referenceNumber ? `
              <div class="detail-row">
                <span class="detail-label">Referencia:</span>
                <span class="detail-value">${operation.referenceNumber}</span>
              </div>
            ` : ''}
            ${operation.createdBy ? `
              <div class="detail-row">
                <span class="detail-label">Creado por:</span>
                <span class="detail-value">${operation.createdBy}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>PRODUCTO</th>
              <th>SKU</th>
              ${['transfer', 'picking'].includes(operation.operationType) ? '<th>UBICACIÓN</th>' : ''}
              ${operation.operationType === 'scrap' ? '<th>MOTIVO</th>' : ''}
              <th class="text-center">PLAN.</th>
              <th class="text-center">REAL</th>
              <th class="text-center">✓</th>
            </tr>
          </thead>
          <tbody>
            ${operation.lines.map((line, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="font-bold">${line.productName}</td>
                <td class="font-mono">${line.sku}</td>
                ${['transfer', 'picking'].includes(operation.operationType) ? `<td>${line.sourceLocation || line.destinationLocation || '-'}</td>` : ''}
                ${operation.operationType === 'scrap' ? `<td>${line.scrapReason || '-'}</td>` : ''}
                <td class="text-center font-bold">${line.quantityPlanned}</td>
                <td class="text-center">${line.quantityDone > 0 ? line.quantityDone : ''}</td>
                <td class="text-center"><div class="checkbox"></div></td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background: #f5f5f5; font-weight: bold;">
              <td colspan="${['transfer', 'picking', 'scrap'].includes(operation.operationType) ? 4 : 3}" style="text-align: right;">TOTALES:</td>
              <td class="text-center">${totalPlanned}</td>
              <td class="text-center">${totalDone > 0 ? totalDone : ''}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        ${operation.notes ? `
          <div class="notes">
            <div class="notes-label">NOTAS:</div>
            <div>${operation.notes}</div>
          </div>
        ` : ''}

        <div class="signatures">
          <div class="signature-box">
            <div class="signature-line">
              <div class="signature-title">
                ${operation.operationType === 'transfer' ? 'PREPARADO POR' : ''}
                ${operation.operationType === 'reception' ? 'RECIBIDO POR' : ''}
                ${operation.operationType === 'picking' ? 'PREPARADO POR' : ''}
                ${operation.operationType === 'scrap' ? 'AUTORIZADO POR' : ''}
                ${operation.operationType === 'adjustment' ? 'REALIZADO POR' : ''}
              </div>
              <div class="signature-subtitle">Nombre y Firma</div>
              <div class="signature-subtitle">Fecha: ___/___/______</div>
            </div>
          </div>
          <div class="signature-box">
            <div class="signature-line">
              <div class="signature-title">
                ${operation.operationType === 'transfer' ? 'RECIBIDO POR' : ''}
                ${operation.operationType === 'reception' ? 'VERIFICADO POR' : ''}
                ${operation.operationType === 'picking' ? 'VERIFICADO POR' : ''}
                ${operation.operationType === 'scrap' ? 'EJECUTADO POR' : ''}
                ${operation.operationType === 'adjustment' ? 'APROBADO POR' : ''}
              </div>
              <div class="signature-subtitle">Nombre y Firma</div>
              <div class="signature-subtitle">Fecha: ___/___/______</div>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Este documento fue generado automáticamente por el sistema de gestión de almacenes</p>
          <p style="margin-top: 5px;">${operation.operationNumber} - Impreso el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  return { printOperation }
}
