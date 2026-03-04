'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, Printer, QrCode, Package, Warehouse, CheckSquare } from 'lucide-react'
import QRCode from 'qrcode'
import { detectBrandFromHost, brands } from '@/lib/brand-config'

interface InvoiceData {
  id: number
  invoiceNumber: string
  customer: {
    businessName: string
    code: string
    taxId: string | null
    address: string | null
    phone: string | null
  }
  total: number
  currency: string
  status: string
  paymentStatus: string
  dueDate: string | null
  createdAt: string
  wholesaleExchangeRate: number | null
  downpaymentType: string | null
  downpaymentValue: number | null
  downpaymentAmount: number | null
  amountPaid: number
  amountDue: number
  lines: Array<{
    id: number
    productName: string
    productSku: string
    quantity: number
    unitPrice: number
    subtotal: number
    warehouseQuantities: Record<string, number>
  }>
  deliveries: Array<{
    id: number
    deliveryNumber: string
    warehouseId: number
    warehouseName: string
    status: string
    lines: Array<{
      productName: string
      productSku: string
      quantity: number
    }>
  }>
}

export default function PrintInvoicePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const invoiceId = params.id
  const format = searchParams.get('format') || 'letter'
  const warehouseId = searchParams.get('warehouse')

  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [brandLogo, setBrandLogo] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const brandName = detectBrandFromHost(window.location.hostname)
    const brand = brands[brandName]
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        setBrandLogo(canvas.toDataURL('image/png'))
      }
    }
    img.src = brand.logos.light
  }, [])

  useEffect(() => {
    fetchInvoice()
  }, [invoiceId])

  useEffect(() => {
    if (invoice && invoice.deliveries.length > 0) {
      generateQRCodes()
    }
  }, [invoice])

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/market/wholesale/invoices/${invoiceId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setInvoice(result.data)
        } else {
          setError(result.error || 'Error loading invoice')
        }
      } else {
        setError('Error loading invoice')
      }
    } catch (err) {
      setError('Error loading invoice')
    } finally {
      setLoading(false)
    }
  }

  const generateQRCodes = async () => {
    if (!invoice) return

    const codes: Record<string, string> = {}
    for (const delivery of invoice.deliveries) {
      try {
        // QR content: deliveryNumber|invoiceNumber|warehouseId
        const qrContent = `${delivery.deliveryNumber}|${invoice.invoiceNumber}|${delivery.warehouseId}`
        const qrDataUrl = await QRCode.toDataURL(qrContent, {
          width: 150,
          margin: 1,
          errorCorrectionLevel: 'M'
        })
        codes[delivery.id] = qrDataUrl
      } catch (err) {
        console.error('Error generating QR code:', err)
      }
    }
    setQrCodes(codes)
  }

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const formatCUP = (value: number, rate: number) => {
    return new Intl.NumberFormat('es-CU', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value * rate) + ' CUP'
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateLong = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-500">{error || 'Invoice not found'}</p>
      </div>
    )
  }

  // Render warehouse ticket
  if (format === 'warehouse-ticket' && warehouseId) {
    const delivery = invoice.deliveries.find(d => d.warehouseId === parseInt(warehouseId))
    if (!delivery) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-red-500">Warehouse delivery not found</p>
        </div>
      )
    }

    return (
      <>
        <style jsx global>{`
          @media print {
            @page {
              size: 80mm auto;
              margin: 5mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Print Button */}
        <div className="no-print fixed top-4 right-4 z-50">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg"
          >
            <Printer className="w-4 h-4" />
            Imprimir Ticket
          </button>
        </div>

        {/* Warehouse Ticket - 80mm thermal */}
        <div className="w-[80mm] mx-auto bg-white p-4 text-sm" ref={printRef}>
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-black pb-3 mb-3">
            <h1 className="text-lg font-bold">TICKET DE RECOGIDA</h1>
            <p className="text-xs text-gray-600 mt-1">Almacen: {delivery.warehouseName}</p>
          </div>

          {/* Invoice Info */}
          <div className="mb-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Factura:</span>
              <span className="font-bold">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Entrega:</span>
              <span className="font-bold">{delivery.deliveryNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha:</span>
              <span>{formatDate(invoice.createdAt)}</span>
            </div>
          </div>

          {/* Customer */}
          <div className="mb-3 p-2 bg-gray-100 rounded text-xs">
            <p className="font-bold">{invoice.customer.businessName}</p>
            {invoice.customer.code && (
              <p className="text-gray-600">Cod: {invoice.customer.code}</p>
            )}
          </div>

          {/* QR Code */}
          <div className="text-center mb-3">
            {qrCodes[delivery.id] ? (
              <img
                src={qrCodes[delivery.id]}
                alt="QR Code"
                className="w-[120px] h-[120px] mx-auto"
              />
            ) : (
              <div className="w-[120px] h-[120px] mx-auto bg-gray-200 flex items-center justify-center">
                <QrCode className="w-12 h-12 text-gray-400" />
              </div>
            )}
            <p className="text-[10px] text-gray-500 mt-1">{delivery.deliveryNumber}</p>
          </div>

          {/* Products */}
          <div className="border-t-2 border-dashed border-black pt-3 mb-3">
            <p className="font-bold text-xs mb-2 flex items-center gap-1">
              <Package className="w-3 h-3" />
              PRODUCTOS A ENTREGAR:
            </p>
            <div className="space-y-2">
              {delivery.lines.map((line, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <CheckSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">{line.productName}</p>
                    <div className="flex justify-between text-gray-600">
                      <span>{line.productSku}</span>
                      <span className="font-bold">x{line.quantity}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t-2 border-dashed border-black pt-3 mb-3 text-xs">
            <div className="flex justify-between font-bold">
              <span>Total productos:</span>
              <span>{delivery.lines.length}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total unidades:</span>
              <span>{delivery.lines.reduce((sum, l) => sum + l.quantity, 0)}</span>
            </div>
          </div>

          {/* Signatures */}
          <div className="border-t-2 border-dashed border-black pt-3 space-y-4">
            <div>
              <p className="text-[10px] text-gray-600 mb-1">Firma almacenero:</p>
              <div className="border-b border-black h-8"></div>
            </div>
            <div>
              <p className="text-[10px] text-gray-600 mb-1">Firma cliente:</p>
              <div className="border-b border-black h-8"></div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[9px] text-gray-400 mt-4 pt-2 border-t border-gray-200">
            <p>Generado: {new Date().toLocaleString('es-ES')}</p>
          </div>
        </div>
      </>
    )
  }

  // Render all warehouse tickets
  if (format === 'warehouse-tickets-all') {
    return (
      <>
        <style jsx global>{`
          @media print {
            @page {
              size: 80mm auto;
              margin: 5mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
            .page-break {
              page-break-after: always;
            }
          }
        `}</style>

        {/* Print Button */}
        <div className="no-print fixed top-4 right-4 z-50">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg"
          >
            <Printer className="w-4 h-4" />
            Imprimir Todos los Tickets
          </button>
        </div>

        <div className="w-[80mm] mx-auto bg-white">
          {invoice.deliveries.map((delivery, index) => (
            <div key={delivery.id} className={index < invoice.deliveries.length - 1 ? 'page-break' : ''}>
              {/* Ticket content - same as single ticket */}
              <div className="p-4 text-sm">
                {/* Header */}
                <div className="text-center border-b-2 border-dashed border-black pb-3 mb-3">
                  <h1 className="text-lg font-bold">TICKET DE RECOGIDA</h1>
                  <p className="text-xs text-gray-600 mt-1">Almacen: {delivery.warehouseName}</p>
                </div>

                {/* Invoice Info */}
                <div className="mb-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Factura:</span>
                    <span className="font-bold">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Entrega:</span>
                    <span className="font-bold">{delivery.deliveryNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fecha:</span>
                    <span>{formatDate(invoice.createdAt)}</span>
                  </div>
                </div>

                {/* Customer */}
                <div className="mb-3 p-2 bg-gray-100 rounded text-xs">
                  <p className="font-bold">{invoice.customer.businessName}</p>
                  {invoice.customer.code && (
                    <p className="text-gray-600">Cod: {invoice.customer.code}</p>
                  )}
                </div>

                {/* QR Code */}
                <div className="text-center mb-3">
                  {qrCodes[delivery.id] ? (
                    <img
                      src={qrCodes[delivery.id]}
                      alt="QR Code"
                      className="w-[120px] h-[120px] mx-auto"
                    />
                  ) : (
                    <div className="w-[120px] h-[120px] mx-auto bg-gray-200 flex items-center justify-center">
                      <QrCode className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500 mt-1">{delivery.deliveryNumber}</p>
                </div>

                {/* Products */}
                <div className="border-t-2 border-dashed border-black pt-3 mb-3">
                  <p className="font-bold text-xs mb-2 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    PRODUCTOS A ENTREGAR:
                  </p>
                  <div className="space-y-2">
                    {delivery.lines.map((line, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <CheckSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{line.productName}</p>
                          <div className="flex justify-between text-gray-600">
                            <span>{line.productSku}</span>
                            <span className="font-bold">x{line.quantity}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="border-t-2 border-dashed border-black pt-3 mb-3 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>Total productos:</span>
                    <span>{delivery.lines.length}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total unidades:</span>
                    <span>{delivery.lines.reduce((sum, l) => sum + l.quantity, 0)}</span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="border-t-2 border-dashed border-black pt-3 space-y-4">
                  <div>
                    <p className="text-[10px] text-gray-600 mb-1">Firma almacenero:</p>
                    <div className="border-b border-black h-8"></div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 mb-1">Firma cliente:</p>
                    <div className="border-b border-black h-8"></div>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center text-[9px] text-gray-400 mt-4 pt-2 border-t border-gray-200">
                  <p>Ticket {index + 1} de {invoice.deliveries.length}</p>
                  <p>Generado: {new Date().toLocaleString('es-ES')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

  // Render receipt (80mm ticket)
  if (format === 'receipt') {
    const rate = invoice.wholesaleExchangeRate || 355

    return (
      <>
        <style jsx global>{`
          @media print {
            @page {
              size: 80mm auto;
              margin: 5mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Print Button */}
        <div className="no-print fixed top-4 right-4 z-50">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg"
          >
            <Printer className="w-4 h-4" />
            Imprimir Recibo
          </button>
        </div>

        {/* Receipt - 80mm thermal */}
        <div className="w-[80mm] mx-auto bg-white p-4 text-sm">
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-black pb-3 mb-3">
            <h1 className="text-lg font-bold">FACTURA MAYORISTA</h1>
            <p className="font-bold mt-1">{invoice.invoiceNumber}</p>
            <p className="text-xs text-gray-600">{formatDate(invoice.createdAt)}</p>
          </div>

          {/* Customer */}
          <div className="mb-3 text-xs">
            <p className="font-bold">{invoice.customer.businessName}</p>
            {invoice.customer.taxId && <p>RUC: {invoice.customer.taxId}</p>}
            {invoice.customer.address && <p>{invoice.customer.address}</p>}
          </div>

          {/* Items */}
          <div className="border-t-2 border-dashed border-black pt-3 mb-3">
            <div className="space-y-2 text-xs">
              {invoice.lines.map((line, idx) => (
                <div key={idx}>
                  <p className="font-medium">{line.productName}</p>
                  <div className="flex justify-between text-gray-600">
                    <span>{line.quantity} x {formatCurrency(line.unitPrice)}</span>
                    <span className="font-medium">{formatCurrency(line.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t-2 border-dashed border-black pt-3 text-xs space-y-1">
            <div className="flex justify-between font-bold text-base">
              <span>TOTAL USD:</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total CUP:</span>
              <span>{formatCUP(invoice.total, rate)}</span>
            </div>
            <p className="text-[10px] text-gray-400 text-right">
              Tasa: $1 = {rate} CUP
            </p>

            {/* Payment Info */}
            {invoice.downpaymentAmount && invoice.downpaymentAmount > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="flex justify-between">
                  <span>Anticipo:</span>
                  <span className="font-medium text-green-600">{formatCurrency(invoice.downpaymentAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pendiente:</span>
                  <span className="font-medium text-amber-600">{formatCurrency(invoice.amountDue)}</span>
                </div>
              </div>
            )}

            {invoice.dueDate && (
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                <span>Vencimiento:</span>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="text-center mt-3 pt-3 border-t-2 border-dashed border-black">
            <span className={`px-3 py-1 text-xs font-bold rounded ${
              invoice.paymentStatus === 'paid'
                ? 'bg-green-100 text-green-700'
                : invoice.paymentStatus === 'partial'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-yellow-100 text-yellow-700'
            }`}>
              {invoice.paymentStatus === 'paid'
                ? 'PAGADA'
                : invoice.paymentStatus === 'partial'
                  ? 'PAGO PARCIAL'
                  : 'PENDIENTE'}
            </span>
          </div>

          {/* Footer */}
          <div className="text-center text-[9px] text-gray-400 mt-4 pt-2 border-t border-gray-200">
            <p>Gracias por su compra</p>
            <p>Generado: {new Date().toLocaleString('es-ES')}</p>
          </div>
        </div>
      </>
    )
  }

  // Render letter format (default)
  const rate = invoice.wholesaleExchangeRate || 355

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Print Button */}
      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg"
        >
          <Printer className="w-4 h-4" />
          Imprimir Factura
        </button>
      </div>

      {/* Invoice - Letter format */}
      <div className="max-w-[8.5in] mx-auto bg-white p-8 shadow-lg">
        {/* Header */}
        {(() => {
          const brandName = detectBrandFromHost(typeof window !== 'undefined' ? window.location.hostname : '')
          const brand = brands[brandName]
          const primaryColor = brand.colors.primary
          return (
            <div className="flex justify-between items-start pb-6 mb-6" style={{ borderBottom: `2px solid ${primaryColor}` }}>
              <div className="flex items-center gap-4">
                {brandLogo && (
                  <img src={brandLogo} alt={brand.displayName} className="h-14 w-auto" />
                )}
                <div>
                  <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>FACTURA</h1>
                  <p className="text-gray-500 mt-1">Venta Mayorista</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{invoice.invoiceNumber}</p>
                <p className="text-gray-500">Fecha: {formatDateLong(invoice.createdAt)}</p>
                {invoice.dueDate && (
                  <p className="text-gray-500">Vencimiento: {formatDateLong(invoice.dueDate)}</p>
                )}
              </div>
            </div>
          )
        })()}

        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-500 mb-2">FACTURADO A:</p>
            <p className="text-lg font-bold">{invoice.customer.businessName}</p>
            {invoice.customer.taxId && <p className="text-gray-600">RUC: {invoice.customer.taxId}</p>}
            {invoice.customer.address && <p className="text-gray-600">{invoice.customer.address}</p>}
            {invoice.customer.phone && <p className="text-gray-600">Tel: {invoice.customer.phone}</p>}
          </div>
          {(() => {
            const brandName = detectBrandFromHost(typeof window !== 'undefined' ? window.location.hostname : '')
            const brand = brands[brandName]
            return (
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${brand.colors.primary}10` }}>
                <p className="text-sm font-medium text-gray-500 mb-2">ESTADO DE PAGO:</p>
                <span className={`inline-block px-3 py-1 text-sm font-bold rounded ${
                  invoice.paymentStatus === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : invoice.paymentStatus === 'partial'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {invoice.paymentStatus === 'paid'
                    ? 'PAGADA'
                    : invoice.paymentStatus === 'partial'
                      ? 'PAGO PARCIAL'
                      : 'PENDIENTE DE PAGO'}
                </span>
                {invoice.downpaymentAmount && invoice.downpaymentAmount > 0 && (
                  <div className="mt-2 text-sm">
                    <p>Anticipo pagado: <span className="font-bold" style={{ color: brand.colors.primary }}>{formatCurrency(invoice.downpaymentAmount)}</span></p>
                    <p>Restante: <span className="font-bold text-amber-600">{formatCurrency(invoice.amountDue)}</span></p>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Items Table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Producto</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Cantidad</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Precio USD</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Precio CUP</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-3 px-4">
                  <p className="font-medium">{line.productName}</p>
                  <p className="text-sm text-gray-500">{line.productSku}</p>
                </td>
                <td className="text-center py-3 px-4">{line.quantity}</td>
                <td className="text-right py-3 px-4">{formatCurrency(line.unitPrice)}</td>
                <td className="text-right py-3 px-4 text-gray-500">{formatCUP(line.unitPrice, rate)}</td>
                <td className="text-right py-3 px-4 font-medium">{formatCurrency(line.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-80">
            <div className="flex justify-between py-2 text-lg">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between py-2 text-gray-500">
              <span>En CUP:</span>
              <span>{formatCUP(invoice.total, rate)}</span>
            </div>
            <div className="text-xs text-right text-gray-400 mb-2">
              Tasa mayoreo: $1 = {rate} CUP
            </div>
            {(() => {
              const brandName = detectBrandFromHost(typeof window !== 'undefined' ? window.location.hostname : '')
              const brand = brands[brandName]
              return (
                <div className="flex justify-between py-3 text-xl font-bold mt-2" style={{ borderTop: `2px solid ${brand.colors.primary}` }}>
                  <span>TOTAL:</span>
                  <span style={{ color: brand.colors.primary }}>{formatCurrency(invoice.total)}</span>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Deliveries */}
        {invoice.deliveries.length > 0 && (
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
              <Warehouse className="w-5 h-5" />
              Entregas Asociadas
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {invoice.deliveries.map(delivery => (
                <div key={delivery.id} className="bg-white p-3 rounded border border-blue-200">
                  <p className="font-bold text-sm">{delivery.deliveryNumber}</p>
                  <p className="text-sm text-gray-600">{delivery.warehouseName}</p>
                  <p className="text-xs text-gray-500">
                    {delivery.lines.length} productos, {delivery.lines.reduce((s, l) => s + l.quantity, 0)} uds
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-400">
          <p>Documento generado el {new Date().toLocaleString('es-ES')}</p>
          <p className="mt-1">{brands[detectBrandFromHost(typeof window !== 'undefined' ? window.location.hostname : '')].displayName}</p>
        </div>
      </div>
    </>
  )
}
