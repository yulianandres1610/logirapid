'use client'

import React, { useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { PurchaseOrder } from '@/lib/package-types'

interface PurchaseOrderInvoiceProps {
  order: PurchaseOrder
  isVisible: boolean
}

export function PurchaseOrderInvoice({ order, isVisible }: PurchaseOrderInvoiceProps) {
  const invoiceRef = useRef<HTMLDivElement>(null)

  const generatePDF = async () => {
    if (!invoiceRef.current) return

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
      const imgX = (pdfWidth - imgWidth * ratio) / 2
      const imgY = 0

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
      pdf.save(`Factura_${order.order_number}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
    }
  }

  if (!isVisible) return null

  return (
    <>
      <div
        ref={invoiceRef}
        className="fixed -top-[9999px] -left-[9999px] w-[210mm] bg-white p-8"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        {/* Invoice Header */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">FACTURA</h1>
              <p className="text-gray-600 mt-2">Orden de Compra: {order.order_number}</p>
              <p className="text-gray-600">Fecha: {new Date(order.order_date).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-2">LogiRapid Logistics</div>
              <div className="text-sm text-gray-600">Sistema de Gestión</div>
              <div className="text-sm text-gray-600">contacto@logirapid.com</div>
            </div>
          </div>
        </div>

        {/* Supplier Information */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Datos del Proveedor</h2>
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-gray-700"><strong>Proveedor:</strong> {order.supplier}</p>
            {order.supplier_contact && (
              <p className="text-gray-700"><strong>Contacto:</strong> {order.supplier_contact}</p>
            )}
            {order.supplier_phone && (
              <p className="text-gray-700"><strong>Teléfono:</strong> {order.supplier_phone}</p>
            )}
            {order.supplier_email && (
              <p className="text-gray-700"><strong>Email:</strong> {order.supplier_email}</p>
            )}
          </div>
        </div>

        {/* Order Items Table */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Detalle de Productos</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Descripción</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Tamaño</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Cantidad</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Precio Unitario</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 px-4 py-2">Caja de Empaque</td>
                  <td className="border border-gray-300 px-4 py-2 text-center capitalize">{item.size}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center">{item.quantity}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">${item.unit_price.toFixed(2)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">${item.total_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
                <td colSpan={4} className="border border-gray-300 px-4 py-2 text-right">Total:</td>
                <td className="border border-gray-300 px-4 py-2 text-right">${order.total_amount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Order Status and Dates */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Estado de la Orden</h2>
          <div className="bg-gray-50 p-4 rounded">
            <p className="text-gray-700 mb-2">
              <strong>Estado Actual:</strong>
              <span className="ml-2 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                {getStatusText(order.status)}
              </span>
            </p>

            {order.budget_request_date && (
              <p className="text-gray-700">
                <strong>Fecha Solicitud Presupuesto:</strong>{' '}
                {new Date(order.budget_request_date).toLocaleDateString('es-ES')}
              </p>
            )}

            {order.purchase_date && (
              <p className="text-gray-700">
                <strong>Fecha Compra:</strong>{' '}
                {new Date(order.purchase_date).toLocaleDateString('es-ES')}
              </p>
            )}

            {order.received_date && (
              <p className="text-gray-700">
                <strong>Fecha Recepción:</strong>{' '}
                {new Date(order.received_date).toLocaleDateString('es-ES')}
              </p>
            )}

            {order.expected_delivery && (
              <p className="text-gray-700">
                <strong>Entrega Esperada:</strong>{' '}
                {new Date(order.expected_delivery).toLocaleDateString('es-ES')}
              </p>
            )}
          </div>
        </div>

        {/* Payment Information */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Información de Pago</h2>
          <div className="bg-gray-50 p-4 rounded">
            {order.payment_method && (
              <p className="text-gray-700 mb-2">
                <strong>Método de Pago:</strong> {order.payment_method}
              </p>
            )}
            {order.payment_terms && (
              <p className="text-gray-700">
                <strong>Condiciones de Pago:</strong> {order.payment_terms}
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Notas</h2>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-gray-700">{order.notes}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t-2 border-gray-800 pt-4 mt-8 text-center">
          <p className="text-sm text-gray-600">
            Esta es una factura generada automáticamente por el sistema LogiRapid
          </p>
          <p className="text-sm text-gray-600">
            Para cualquier consulta, contacte a nuestro departamento de compras
          </p>
        </div>
      </div>

      {/* Print Button */}
      <button
        onClick={generatePDF}
        className="fixed top-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg z-50"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        Generar PDF
      </button>
    </>
  )
}

function getStatusText(status: string): string {
  const statusMap: { [key: string]: string } = {
    'BORRADOR': 'Borrador',
    'SOLICITUD_PRESUPUESTO': 'Solicitud de Presupuesto',
    'COMPRADA': 'Comprada',
    'RECIBIDA': 'Recibida',
    'CANCELLED': 'Cancelada'
  }
  return statusMap[status] || status
}