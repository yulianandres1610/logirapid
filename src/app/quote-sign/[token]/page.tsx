'use client'

import { useEffect, useState, use } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  CheckCircle,
  Package,
  Calendar,
  Building2,
  Tag,
  DollarSign,
  PenTool,
  Loader2,
  AlertCircle
} from 'lucide-react'
import SignaturePad from '@/components/ui/SignaturePad'

interface QuoteData {
  quoteNumber: string
  status: string
  subtotal: number
  discountPercent: number
  discountAmount: number
  totalAmount: number
  currency: string
  validUntil: string | null
  notes: string | null
  createdAt: string
  signatureData: string | null
  signedAt: string | null
  signerName: string | null
  customer: {
    businessName: string
    code: string
    taxId: string | null
  }
  company: {
    name: string
    logoUrl: string | null
  }
  lines: Array<{
    id: number
    productName: string
    productSku: string | null
    productImage: string | null
    quantity: number
    unitPrice: number
    subtotal: number
  }>
}

export default function QuoteSignPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const token = resolvedParams.token

  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signerName, setSignerName] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    fetchQuote()
  }, [token])

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/public/quote-sign/${token}`)
      const result = await response.json()
      if (result.success) {
        setQuote(result.data)
        if (result.data.signedAt) {
          setSigned(true)
        }
      } else {
        setError(result.error || 'Cotización no encontrada')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleSign = async () => {
    if (!signatureData || !signerName.trim()) return
    setSigning(true)

    try {
      const response = await fetch(`/api/public/quote-sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData,
          signerName: signerName.trim()
        })
      })

      const result = await response.json()
      if (result.success) {
        setSigned(true)
      } else {
        setError(result.error || 'Error al firmar')
      }
    } catch {
      setError('Error de conexión al firmar')
    } finally {
      setSigning(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)

  const formatDate = (date: string | null | undefined) => {
    if (!date) return ''
    let d: Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-').map(Number)
      d = new Date(year, month - 1, day)
    } else {
      d = new Date(date)
    }
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">Cargando cotización...</p>
        </div>
      </div>
    )
  }

  // Error
  if (error && !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace no válido</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!quote) return null

  // Success (just signed)
  if (signed && !quote.signedAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-12 h-12 text-emerald-500" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Cotización Firmada</h1>
          <p className="text-gray-500 mb-2">
            La cotización <strong>{quote.quoteNumber}</strong> ha sido firmada exitosamente.
          </p>
          <p className="text-sm text-gray-400">Puede cerrar esta página.</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          {quote.company.logoUrl && (
            <img
              src={quote.company.logoUrl}
              alt={quote.company.name}
              className="h-12 mx-auto mb-4 object-contain"
            />
          )}
          <h1 className="text-lg font-semibold text-gray-600">{quote.company.name}</h1>
        </div>

        {/* Quote Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold font-mono text-gray-900">{quote.quoteNumber}</h2>
                <span className="px-3 py-1 rounded-lg text-sm font-medium bg-blue-100 text-blue-700">
                  Cotización
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  {quote.customer.businessName}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDate(quote.createdAt)}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(quote.totalAmount)}</p>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 pb-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-blue-100">
                <Package className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-900">Productos</h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-6 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Producto</th>
                  <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Cant</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">P. Unit</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {quote.lines.map(line => (
                  <tr key={line.id} className="border-b border-gray-100">
                    <td className="py-4 px-6">
                      <p className="font-medium text-sm text-gray-900">{line.productName}</p>
                      {line.productSku && <p className="text-xs text-gray-500">{line.productSku}</p>}
                    </td>
                    <td className="py-4 px-4 text-center text-sm">{line.quantity}</td>
                    <td className="py-4 px-4 text-right text-sm">{formatCurrency(line.unitPrice)}</td>
                    <td className="py-4 px-4 text-right text-sm font-medium text-blue-600">{formatCurrency(line.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discountPercent > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Descuento ({quote.discountPercent}%):</span>
                    <span>-{formatCurrency(quote.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-3 border-t border-gray-300">
                  <span>Total:</span>
                  <span className="text-blue-600">{formatCurrency(quote.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Notas</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Valid Until */}
        {quote.validUntil && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-sm text-amber-700">
              Esta cotización es válida hasta el <strong>{formatDate(quote.validUntil)}</strong>
            </p>
          </div>
        )}

        {/* Signature Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 rounded-xl ${quote.signedAt ? 'bg-emerald-100' : 'bg-purple-100'}`}>
              <PenTool className={`w-5 h-5 ${quote.signedAt ? 'text-emerald-500' : 'text-purple-500'}`} />
            </div>
            <h3 className="font-semibold text-gray-900">
              {quote.signedAt ? 'Firma Digital' : 'Firmar Cotización'}
            </h3>
          </div>

          {quote.signedAt ? (
            // Already signed - show signature
            <div className="space-y-4">
              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-medium text-emerald-700">Cotización firmada</p>
              </div>

              {quote.signerName && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Firmante:</span>
                  <span className="font-medium text-gray-900">{quote.signerName}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fecha de firma:</span>
                <span className="font-medium text-gray-900">{formatDateTime(quote.signedAt)}</span>
              </div>

              {quote.signatureData && (
                <div className="border border-gray-200 rounded-xl p-3 bg-white">
                  <img src={quote.signatureData} alt="Firma" className="w-full h-24 object-contain" />
                </div>
              )}
            </div>
          ) : (
            // Not signed - show signature pad
            <div className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del firmante *
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Firma *
                </label>
                <SignaturePad
                  onSave={(dataUrl) => setSignatureData(dataUrl)}
                  onClear={() => setSignatureData(null)}
                  width={600}
                  height={200}
                  label=""
                />
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Al firmar esta cotización, usted confirma que ha revisado y acepta los términos,
                  productos y precios indicados. Esta firma digital tiene la misma validez legal
                  que una firma manuscrita conforme a la legislación aplicable.
                </p>
              </div>

              <button
                onClick={handleSign}
                disabled={signing || !signatureData || !signerName.trim()}
                className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {signing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Firmando...
                  </>
                ) : (
                  <>
                    <PenTool className="w-5 h-5" />
                    Firmar y Aceptar Cotización
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            Powered by <strong>LogiRapid</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
