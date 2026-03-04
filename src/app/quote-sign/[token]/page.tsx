'use client'

import { useEffect, useState, useRef, use, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  FileText,
  CheckCircle,
  Calendar,
  Building2,
  PenTool,
  Loader2,
  AlertCircle,
  Download
} from 'lucide-react'
import SignaturePad from '@/components/ui/SignaturePad'
import { detectBrandFromHost, brands } from '@/lib/brand-config'

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
    address: string | null
    phone: string | null
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
    originalPrice: number
    discountPercent: number
    discountAmount: number
    subtotal: number
    estimatedDelivery: string | null
  }>
}

export default function QuoteSignPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const token = resolvedParams.token

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-orange-500" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    }>
      <QuoteSignContent token={token} />
    </Suspense>
  )
}

function QuoteSignContent({ token }: { token: string }) {
  const searchParams = useSearchParams()

  const mode = (searchParams.get('mode') || 'usd') as 'usd' | 'cup' | 'dual'
  const exchangeRate = parseFloat(searchParams.get('r') || '1')

  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signerName, setSignerName] = useState('')
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [sigPadWidth, setSigPadWidth] = useState(350)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const sigContainerRef = useRef<HTMLDivElement>(null)

  // Measure container for responsive SignaturePad
  useEffect(() => {
    const measure = () => {
      if (sigContainerRef.current) {
        const w = sigContainerRef.current.clientWidth - 4
        setSigPadWidth(Math.min(w, 600))
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [loading, quote])

  // Dynamic brand detection
  const [brandConfig, setBrandConfig] = useState(() => brands.servisumic)
  useEffect(() => {
    const brandName = detectBrandFromHost(window.location.hostname)
    setBrandConfig(brands[brandName])
  }, [])

  const BRAND = {
    primary: brandConfig.colors.primary,
    primaryHover: brandConfig.colors.primaryHover,
    secondary: brandConfig.colors.secondary,
    secondaryLight: brandConfig.colors.secondaryLight,
    logo: brandConfig.logos.light,
    displayName: brandConfig.displayName
  }

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
    setError(null)

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

  const fmtUSD = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value)

  const fmtCUP = (value: number) =>
    new Intl.NumberFormat('es-CU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(value * exchangeRate)) + ' CUP'

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
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <img src={BRAND.logo} alt={BRAND.displayName} className="h-10 mx-auto mb-6 object-contain" />
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: BRAND.primary }} />
          <p className="text-gray-500 text-sm">Cargando cotización...</p>
        </div>
      </div>
    )
  }

  // Error
  if (error && !quote) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <img src={BRAND.logo} alt={BRAND.displayName} className="h-10 mx-auto mb-6 object-contain" />
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#fef2f2' }}>
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: BRAND.secondary }}>Enlace no válido</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!quote) return null

  // Success (just signed) — reload to show the full signed document
  if (signed && !quote.signedAt) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <img src={quote.company.logoUrl || BRAND.logo} alt={BRAND.displayName} className="h-16 sm:h-20 mx-auto mb-8 object-contain" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: `${BRAND.primary}15` }}
          >
            <CheckCircle className="w-10 h-10" style={{ color: BRAND.primary }} />
          </motion.div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: BRAND.secondary }}>Oferta Firmada</h1>
          <p className="text-gray-500 mb-2">
            La oferta <strong>{quote.quoteNumber}</strong> ha sido firmada exitosamente.
          </p>
          <p className="text-sm text-gray-400 mb-6">Puede cerrar esta página o descargar el PDF.</p>
          <button
            onClick={() => {
              // Reload to show full signed document with download option
              window.location.reload()
            }}
            className="py-3 px-6 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 mx-auto transition-all active:scale-[0.98] border-2"
            style={{
              borderColor: BRAND.primary,
              color: BRAND.primary,
              backgroundColor: `${BRAND.primary}08`
            }}
          >
            <Download className="w-4 h-4" />
            Ver y Descargar PDF
          </button>
        </motion.div>
      </div>
    )
  }

  const showUSD = mode === 'usd' || mode === 'dual'
  const showCUP = (mode === 'cup' || mode === 'dual') && exchangeRate > 1
  const hasDeliveryEstimates = quote.lines.some(l => l.estimatedDelivery)

  const deliveryBadgeConfig: Record<string, { label: string; bg: string; text: string }> = {
    '1-24h': { label: '1-24 h', bg: '#dcfce7', text: '#15803d' },
    '1-3d': { label: '1-3 días', bg: '#fef3c7', text: '#b45309' },
    '1-30d': { label: '1-30 días', bg: '#fee2e2', text: '#b91c1c' }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .min-h-screen { min-height: auto !important; }
          .bg-gray-50 { background: white !important; }
          .shadow-lg { box-shadow: none !important; }
          .sm\\:rounded-lg { border-radius: 0 !important; }
          .sm\\:border { border: none !important; }
          .no-print { display: none !important; }
          .sm\\:px-4 { padding-left: 0 !important; padding-right: 0 !important; }
          .py-4, .sm\\:py-8 { padding-top: 0 !important; padding-bottom: 0 !important; }
        }
      `}} />

      {/* Top bar */}
      <div className="w-full h-1" style={{ background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.secondary})` }} />

      <div className="max-w-[850px] mx-auto py-4 sm:py-8 px-0 sm:px-4">
        {/* Invoice document */}
        <div className="bg-white sm:rounded-lg shadow-lg sm:border border-gray-200 overflow-hidden">

          {/* Header */}
          <div className="px-4 sm:px-8 pt-5 sm:pt-8 pb-4 sm:pb-6">
            <div className="flex items-start justify-between gap-3">
              {/* Logo */}
              <div className="shrink-0">
                <img
                  src={quote.company.logoUrl || BRAND.logo}
                  alt={quote.company.name || BRAND.displayName}
                  className="h-14 sm:h-20 object-contain"
                />
                <p className="text-[10px] sm:text-xs mt-1.5" style={{ color: BRAND.secondaryLight }}>
                  {quote.company.name || BRAND.displayName}
                </p>
              </div>

              {/* Quote label */}
              <div className="text-right">
                <div
                  className="inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-md text-white text-xs sm:text-sm font-bold tracking-wider"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  OFERTA
                </div>
                <p className="text-sm sm:text-lg font-mono font-bold mt-1.5" style={{ color: BRAND.secondary }}>
                  {quote.quoteNumber}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                  {formatDate(quote.createdAt)}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="mt-4 sm:mt-6 h-px" style={{ background: `linear-gradient(90deg, ${BRAND.primary}, transparent)` }} />

            {/* Customer & Quote info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mt-4 sm:mt-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: BRAND.primary }}>
                  Cliente
                </p>
                <p className="font-semibold text-sm" style={{ color: BRAND.secondary }}>
                  {quote.customer.businessName}
                </p>
                {quote.customer.code && (
                  <p className="text-xs text-gray-500">Código: {quote.customer.code}</p>
                )}
                {quote.customer.taxId && (
                  <p className="text-xs text-gray-500">RUC/NIT: {quote.customer.taxId}</p>
                )}
                {quote.customer.address && (
                  <p className="text-xs text-gray-500">{quote.customer.address}</p>
                )}
                {quote.customer.phone && (
                  <p className="text-xs text-gray-500">Tel: {quote.customer.phone}</p>
                )}
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1.5" style={{ color: BRAND.primary }}>
                  Detalles
                </p>
                {quote.validUntil && (
                  <p className="text-xs text-gray-500">
                    Válida hasta: <span className="font-medium">{formatDate(quote.validUntil)}</span>
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Moneda: <span className="font-medium">{mode === 'cup' ? 'CUP' : mode === 'dual' ? 'USD / CUP' : 'USD'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Products - Desktop table */}
          <div className="hidden sm:block px-4 sm:px-8">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: BRAND.secondary }}>
                  <th className="py-2.5 px-3 text-left text-[11px] font-bold uppercase tracking-wider text-white">#</th>
                  <th className="py-2.5 px-3 text-left text-[11px] font-bold uppercase tracking-wider text-white">Producto</th>
                  <th className="py-2.5 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-white">Cant.</th>
                  {hasDeliveryEstimates && (
                    <th className="py-2.5 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-white">Entrega Est.</th>
                  )}
                  {showUSD && (
                    <>
                      <th className="py-2.5 px-3 text-right text-[11px] font-bold uppercase tracking-wider text-white">P. Unit</th>
                      <th className="py-2.5 px-3 text-right text-[11px] font-bold uppercase tracking-wider text-white">Subtotal</th>
                    </>
                  )}
                  {showCUP && (
                    <>
                      <th className="py-2.5 px-3 text-right text-[11px] font-bold uppercase tracking-wider text-white">P. Unit CUP</th>
                      <th className="py-2.5 px-3 text-right text-[11px] font-bold uppercase tracking-wider text-white">Subtotal CUP</th>
                    </>
                  )}
                  {quote.lines.some(l => l.originalPrice > 0 && l.originalPrice !== l.unitPrice) && (
                    <th className="py-2.5 px-3 text-center text-[11px] font-bold uppercase tracking-wider text-white">Desc.</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {quote.lines.map((line, idx) => (
                  <tr key={line.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="py-3 px-3 text-xs text-gray-400">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <p className="text-sm font-medium" style={{ color: BRAND.secondary }}>{line.productName}</p>
                      {line.productSku && <p className="text-[11px] text-gray-400">{line.productSku}</p>}
                    </td>
                    <td className="py-3 px-3 text-center text-sm text-gray-700">{line.quantity}</td>
                    {hasDeliveryEstimates && (
                      <td className="py-3 px-3 text-center">
                        {line.estimatedDelivery && deliveryBadgeConfig[line.estimatedDelivery] && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{
                              backgroundColor: deliveryBadgeConfig[line.estimatedDelivery].bg,
                              color: deliveryBadgeConfig[line.estimatedDelivery].text
                            }}
                          >
                            {deliveryBadgeConfig[line.estimatedDelivery].label}
                          </span>
                        )}
                      </td>
                    )}
                    {showUSD && (
                      <>
                        <td className="py-3 px-3 text-right">
                          {line.originalPrice > 0 && line.originalPrice !== line.unitPrice ? (
                            <div>
                              <span className="text-xs text-gray-400 line-through block">{fmtUSD(line.originalPrice)}</span>
                              <span className="text-sm font-medium text-blue-600">{fmtUSD(line.unitPrice)}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-700">{fmtUSD(line.unitPrice)}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-sm font-medium text-gray-900">{fmtUSD(line.subtotal)}</td>
                      </>
                    )}
                    {showCUP && (
                      <>
                        <td className="py-3 px-3 text-right">
                          {line.originalPrice > 0 && line.originalPrice !== line.unitPrice ? (
                            <div>
                              <span className="text-xs text-gray-400 line-through block">{fmtCUP(line.originalPrice)}</span>
                              <span className="text-sm font-medium text-blue-600">{fmtCUP(line.unitPrice)}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-700">{fmtCUP(line.unitPrice)}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-sm font-medium text-gray-900">{fmtCUP(line.subtotal)}</td>
                      </>
                    )}
                    {quote.lines.some(l => l.originalPrice > 0 && l.originalPrice !== l.unitPrice) && (
                      <td className="py-3 px-3 text-center">
                        {line.discountPercent > 0 ? (
                          <span className="text-green-600 text-sm font-medium">-{line.discountPercent}%</span>
                        ) : line.originalPrice > 0 && line.originalPrice !== line.unitPrice ? (
                          <span className="text-green-600 text-sm font-medium">
                            -{Math.round((1 - line.unitPrice / line.originalPrice) * 100)}%
                          </span>
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Products - Mobile cards */}
          <div className="sm:hidden px-4">
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <div className="py-2 px-3 text-[11px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: BRAND.secondary }}>
                Productos
              </div>
              {quote.lines.map((line, idx) => (
                <div key={line.id} className={`px-3 py-3 border-b border-gray-100 last:border-b-0 ${idx % 2 !== 0 ? 'bg-gray-50' : ''}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: BRAND.secondary }}>{line.productName}</p>
                      {line.productSku && <p className="text-[10px] text-gray-400">{line.productSku}</p>}
                      {line.estimatedDelivery && deliveryBadgeConfig[line.estimatedDelivery] && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium mt-0.5"
                          style={{
                            backgroundColor: deliveryBadgeConfig[line.estimatedDelivery].bg,
                            color: deliveryBadgeConfig[line.estimatedDelivery].text
                          }}
                        >
                          {deliveryBadgeConfig[line.estimatedDelivery].label}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">x{line.quantity}</span>
                  </div>
                  {line.originalPrice > 0 && line.originalPrice !== line.unitPrice && (
                    <div className="flex items-center gap-2 mt-1">
                      {showUSD && (
                        <span className="text-xs text-gray-400 line-through">{fmtUSD(line.originalPrice)} c/u</span>
                      )}
                      {showCUP && !showUSD && (
                        <span className="text-xs text-gray-400 line-through">{fmtCUP(line.originalPrice)} c/u</span>
                      )}
                      {line.discountPercent > 0 ? (
                        <span className="text-xs text-green-600 font-medium">-{line.discountPercent}%</span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">
                          -{Math.round((1 - line.unitPrice / line.originalPrice) * 100)}%
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-1.5">
                    <div className="text-xs text-gray-500">
                      {showUSD && (
                        <span>{fmtUSD(line.unitPrice)} c/u</span>
                      )}
                      {showCUP && !showUSD && (
                        <span>{fmtCUP(line.unitPrice)} c/u</span>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {showUSD && (
                        <span className="text-sm font-semibold" style={{ color: BRAND.secondary }}>{fmtUSD(line.subtotal)}</span>
                      )}
                      {showCUP && (
                        <span className="text-sm font-semibold text-gray-900">{fmtCUP(line.subtotal)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="px-4 sm:px-8 py-5 sm:py-6">
            <div className="flex justify-end">
              <div className="w-full sm:w-80">
                <div className="space-y-1.5">
                  {showUSD && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal USD:</span>
                      <span className="font-medium text-gray-700">{fmtUSD(quote.subtotal)}</span>
                    </div>
                  )}
                  {showCUP && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal CUP:</span>
                      <span className="font-medium text-gray-700">{fmtCUP(quote.subtotal)}</span>
                    </div>
                  )}
                  {quote.discountPercent > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Descuento ({quote.discountPercent}%):</span>
                      <span>{showUSD ? `-${fmtUSD(quote.discountAmount)}` : `-${fmtCUP(quote.discountAmount)}`}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t-2" style={{ borderColor: BRAND.primary }}>
                  {showUSD && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold" style={{ color: BRAND.secondary }}>Total USD:</span>
                      <span className="text-xl font-bold" style={{ color: BRAND.primary }}>{fmtUSD(quote.totalAmount)}</span>
                    </div>
                  )}
                  {showCUP && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-bold" style={{ color: BRAND.secondary }}>Total CUP:</span>
                      <span className={`font-bold ${showUSD ? 'text-base' : 'text-xl'}`} style={{ color: BRAND.secondary }}>{fmtCUP(quote.totalAmount)}</span>
                    </div>
                  )}
                  {showCUP && exchangeRate > 1 && (
                    <p className="text-[10px] text-gray-400 text-right mt-1">Tasa: $1 = {exchangeRate} CUP</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="px-4 sm:px-8 pb-4 sm:pb-6">
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-100">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: BRAND.primary }}>Notas</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
              </div>
            </div>
          )}

          {/* Valid Until warning */}
          {quote.validUntil && (
            <div className="mx-4 sm:mx-8 mb-4 sm:mb-6 rounded-lg p-3 text-center" style={{ backgroundColor: `${BRAND.primary}08`, border: `1px solid ${BRAND.primary}20` }}>
              <p className="text-xs" style={{ color: BRAND.primary }}>
                Esta oferta es válida hasta el <strong>{formatDate(quote.validUntil)}</strong>
              </p>
            </div>
          )}

          {/* Signature Section */}
          <div className="px-4 sm:px-8 pb-6 sm:pb-8">
            <div className="border-t border-gray-200 pt-5 sm:pt-6">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <PenTool className="w-4 h-4" style={{ color: BRAND.primary }} />
                <h3 className="font-bold text-sm uppercase tracking-wider" style={{ color: BRAND.secondary }}>
                  {quote.signedAt ? 'Firma Digital' : 'Firmar Oferta'}
                </h3>
              </div>

              {quote.signedAt ? (
                <div className="space-y-4">
                  <div className="rounded-lg p-4 text-center" style={{ backgroundColor: `${BRAND.primary}08` }}>
                    <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: BRAND.primary }} />
                    <p className="font-semibold text-sm" style={{ color: BRAND.primary }}>Oferta firmada y aceptada</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {quote.signerName && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Firmante</p>
                        <p className="text-sm font-medium" style={{ color: BRAND.secondary }}>{quote.signerName}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Fecha</p>
                      <p className="text-sm font-medium" style={{ color: BRAND.secondary }}>{formatDateTime(quote.signedAt)}</p>
                    </div>
                  </div>

                  {quote.signatureData && (
                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                      <img src={quote.signatureData} alt="Firma" className="w-full h-20 object-contain" />
                    </div>
                  )}

                  {/* Download PDF Button */}
                  <button
                    onClick={() => {
                      setDownloadingPdf(true)
                      setTimeout(() => {
                        window.print()
                        setDownloadingPdf(false)
                      }, 100)
                    }}
                    disabled={downloadingPdf}
                    className="no-print w-full py-3 px-6 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] border-2"
                    style={{
                      borderColor: BRAND.primary,
                      color: BRAND.primary,
                      backgroundColor: `${BRAND.primary}08`
                    }}
                    onMouseEnter={(e) => { (e.currentTarget).style.backgroundColor = `${BRAND.primary}15` }}
                    onMouseLeave={(e) => { (e.currentTarget).style.backgroundColor = `${BRAND.primary}08` }}
                  >
                    {downloadingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Descargar PDF de la Oferta Firmada
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: BRAND.secondary }}>
                      Nombre del firmante *
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full px-4 py-3 sm:py-2.5 rounded-lg border border-gray-200 text-base sm:text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ '--tw-ring-color': `${BRAND.primary}30` } as React.CSSProperties}
                      onFocus={(e) => { e.target.style.borderColor = BRAND.primary }}
                      onBlur={(e) => { e.target.style.borderColor = '#e5e7eb' }}
                    />
                  </div>

                  <div ref={sigContainerRef}>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: BRAND.secondary }}>
                      Firma *
                    </label>
                    <SignaturePad
                      onSave={(dataUrl) => setSignatureData(dataUrl)}
                      onClear={() => setSignatureData(null)}
                      width={sigPadWidth}
                      height={160}
                      label=""
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Al firmar esta oferta, usted confirma que ha revisado y acepta los términos,
                      productos y precios indicados. Esta firma digital tiene la misma validez legal
                      que una firma manuscrita conforme a la legislación aplicable.
                    </p>
                  </div>

                  <button
                    onClick={handleSign}
                    disabled={signing || !signatureData || !signerName.trim()}
                    className="w-full py-3.5 sm:py-3 px-6 text-white rounded-lg font-semibold text-base sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    style={{ backgroundColor: signing ? BRAND.primaryHover : BRAND.primary }}
                    onMouseEnter={(e) => { if (!signing) (e.target as HTMLElement).style.backgroundColor = BRAND.primaryHover }}
                    onMouseLeave={(e) => { if (!signing) (e.target as HTMLElement).style.backgroundColor = BRAND.primary }}
                  >
                    {signing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Firmando...
                      </>
                    ) : (
                      <>
                        <PenTool className="w-4 h-4" />
                        Firmar y Aceptar Oferta
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-8 py-3 sm:py-4 border-t border-gray-100" style={{ backgroundColor: `${BRAND.secondary}08` }}>
            <div className="flex items-center justify-between">
              <img src={BRAND.logo} alt={BRAND.displayName} className="h-4 sm:h-5 object-contain opacity-60" />
              <p className="text-[9px] sm:text-[10px] text-gray-400">
                Documento generado por {BRAND.displayName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
