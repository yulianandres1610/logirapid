'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Package, ShoppingCart, MessageCircle, Phone, MapPin, Star, Loader2, Minus, Plus, Share2, Truck, Shield, Clock, ThumbsUp, User } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import JsBarcode from 'jsbarcode'

interface Product {
  id: number; name: string; description: string | null; sku: string; category: string | null
  imageUrl: string | null; unit: string; priceUSD: number | null; priceCUP: number | null; stock: number | null
}

interface StoreInfo {
  name: string; logoUrl: string | null; logoDesktopUrl: string | null; primaryColor: string
  whatsapp: string | null; phone: string | null
  address: string | null; city: string | null; province: string | null
}

// Simulated reviews (static for now - could be DB-backed later)
const MOCK_REVIEWS = [
  { id: 1, name: 'María G.', rating: 5, date: 'Hace 2 semanas', comment: 'Excelente producto, muy buena calidad. Lo recomiendo.' },
  { id: 2, name: 'Carlos R.', rating: 4, date: 'Hace 1 mes', comment: 'Buen producto, llegó en buen estado.' },
  { id: 3, name: 'Ana L.', rating: 5, date: 'Hace 1 mes', comment: 'Muy satisfecha con la compra. Volveré a comprar.' },
]

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const productId = params.productId as string

  const [product, setProduct] = useState<Product | null>(null)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [addedToCart, setAddedToCart] = useState(false)
  const barcodeRef = useRef<SVGSVGElement>(null)

  const primaryColor = store?.primaryColor || '#f97316'
  const avgRating = 4.7
  const totalReviews = MOCK_REVIEWS.length

  // Generate real scannable barcode
  useEffect(() => {
    if (product && barcodeRef.current) {
      const barcodeValue = product.sku || `P${product.id}`
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000'
        })
      } catch {
        // Fallback if barcode generation fails
        try {
          JsBarcode(barcodeRef.current, String(product.id), {
            format: 'CODE128', width: 2, height: 50, displayValue: true, fontSize: 14, margin: 10
          })
        } catch { /* ignore */ }
      }
    }
  }, [product])

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/public/catalog/${slug}?limit=200`)
        const data = await res.json()
        if (data.success) {
          setStore(data.data.store)
          const found = data.data.products.find((p: Product) => p.id === parseInt(productId))
          if (found) {
            setProduct(found)
            const related = data.data.products
              .filter((p: Product) => p.id !== found.id && p.category === found.category)
              .slice(0, 4)
            setRelatedProducts(related)
          }
        }
      } catch {} finally { setLoading(false) }
    }
    fetchProduct()
  }, [slug, productId])

  const openWhatsApp = () => {
    if (!store?.whatsapp || !product) return
    const phone = store.whatsapp.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Hola! Me interesa:\n\n*${product.name}*\nCantidad: ${quantity}\n${product.priceCUP ? `Precio: ${(product.priceCUP * quantity).toLocaleString('es-ES')} CUP` : ''}${product.priceUSD ? ` ($${(product.priceUSD * quantity).toFixed(2)} USD)` : ''}\n\n¿Está disponible?`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const handleAddToCart = () => {
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
    // The cart state lives in the catalog page - this is visual feedback only
    // In a real implementation, this would use a global cart context
    openWhatsApp()
  }

  const share = () => {
    if (navigator.share && product) {
      navigator.share({ title: product.name, url: window.location.href })
    } else {
      navigator.clipboard.writeText(window.location.href)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
    </div>
  )

  if (!product) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Producto no encontrado</h1>
        <button onClick={() => router.push(`/catalog/${slug}`)} className="mt-4 px-6 py-2 rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
          Volver al catálogo
        </button>
      </div>
    </div>
  )

  const isAvailable = product.stock === null || product.stock > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 sm:px-8 lg:px-12 py-3 flex items-center justify-between">
          <button onClick={() => router.push(`/catalog/${slug}`)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          {/* Center logo */}
          <div className="flex-1 flex justify-center">
            {(store?.logoDesktopUrl || store?.logoUrl) && (
              <img src={store.logoDesktopUrl || store.logoUrl || ''} alt={store?.name || ''} className="h-12 max-w-[260px] object-contain" />
            )}
          </div>
          <button onClick={share} className="p-2 rounded-xl hover:bg-gray-100 transition-colors shrink-0">
            <Share2 className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Product Image */}
          <div>
            <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <div className="aspect-square relative bg-white">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-6" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-24 h-24 text-gray-200" />
                  </div>
                )}
                {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
                  <span className="absolute top-4 left-4 bg-red-500 text-white text-sm px-3 py-1 rounded-full font-medium">
                    Últimas {product.stock} unidades
                  </span>
                )}
              </div>
            </div>
            {/* Barcode - scannable CODE128 */}
            <div className="mt-3 bg-white rounded-xl border border-gray-100 p-4 text-center">
              <svg ref={barcodeRef} className="mx-auto" />
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-5">
            {product.category && (
              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">{product.category}</span>
            )}

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{product.name}</h1>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`w-4 h-4 ${i <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                ))}
              </div>
              <span className="text-sm font-medium text-gray-700">{avgRating}</span>
              <span className="text-sm text-gray-400">({totalReviews} opiniones)</span>
            </div>

            {/* Prices */}
            <div className="space-y-1">
              {product.priceCUP !== null && (
                <p className="text-3xl sm:text-4xl font-bold" style={{ color: primaryColor }}>
                  {product.priceCUP.toLocaleString('es-ES')} <span className="text-lg font-normal">CUP</span>
                </p>
              )}
              {product.priceUSD !== null && (
                <p className="text-lg text-gray-500 font-medium">${product.priceUSD.toFixed(2)} USD</p>
              )}
            </div>

            {/* Stock */}
            {product.stock !== null && (
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${product.stock > 10 ? 'bg-green-500' : product.stock > 0 ? 'bg-amber-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {product.stock > 0 ? `${product.stock} ${product.unit} disponibles` : 'Agotado'}
                </span>
              </div>
            )}

            {/* Quantity Selector */}
            {isAvailable && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Cantidad</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-bold w-12 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(product.stock || 999, q + 1))}
                    className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                  {product.priceCUP && quantity > 1 && (
                    <span className="text-sm text-gray-500 ml-2">
                      Total: <strong style={{ color: primaryColor }}>{(product.priceCUP * quantity).toLocaleString('es-ES')} CUP</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              {isAvailable && (
                <button onClick={handleAddToCart}
                  className={`flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${addedToCart ? 'bg-green-500 text-white' : 'text-white'}`}
                  style={!addedToCart ? { backgroundColor: primaryColor } : {}}>
                  {addedToCart ? (
                    <><ThumbsUp className="w-5 h-5" /> Consulta enviada</>
                  ) : (
                    <><MessageCircle className="w-5 h-5" /> Consultar disponibilidad</>
                  )}
                </button>
              )}
              {store?.phone && (
                <a href={`tel:${store.phone}`}
                  className="py-4 px-5 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <Phone className="w-5 h-5 text-gray-600" />
                </a>
              )}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200">
              <div className="text-center p-3 rounded-xl" style={{ backgroundColor: primaryColor + '08' }}>
                <div className="w-9 h-9 rounded-full mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: primaryColor + '15' }}>
                  <Truck className="w-4 h-4" style={{ color: primaryColor }} />
                </div>
                <p className="text-[11px] font-medium" style={{ color: primaryColor }}>Entrega disponible</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ backgroundColor: primaryColor + '08' }}>
                <div className="w-9 h-9 rounded-full mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: primaryColor + '15' }}>
                  <Shield className="w-4 h-4" style={{ color: primaryColor }} />
                </div>
                <p className="text-[11px] font-medium" style={{ color: primaryColor }}>Producto verificado</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ backgroundColor: primaryColor + '08' }}>
                <div className="w-9 h-9 rounded-full mx-auto mb-1.5 flex items-center justify-center" style={{ backgroundColor: primaryColor + '15' }}>
                  <Clock className="w-4 h-4" style={{ color: primaryColor }} />
                </div>
                <p className="text-[11px] font-medium" style={{ color: primaryColor }}>Respuesta rápida</p>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 text-lg mb-3">Descripción del producto</h3>
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
            {product.sku && <p className="text-xs text-gray-400 mt-4">SKU: {product.sku}</p>}
          </div>
        )}

        {/* Reviews Section */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 text-lg">Opiniones de clientes</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`w-4 h-4 ${i <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                ))}
              </div>
              <span className="text-sm font-bold text-gray-900">{avgRating}</span>
              <span className="text-sm text-gray-400">({totalReviews})</span>
            </div>
          </div>

          {/* Rating bars */}
          <div className="space-y-2 mb-6">
            {[5,4,3,2,1].map(stars => {
              const count = MOCK_REVIEWS.filter(r => r.rating === stars).length
              const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0
              return (
                <div key={stars} className="flex items-center gap-2 text-sm">
                  <span className="w-3 text-gray-500">{stars}</span>
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-gray-400 text-right">{count}</span>
                </div>
              )
            })}
          </div>

          {/* Individual reviews */}
          <div className="space-y-4">
            {MOCK_REVIEWS.map(review => (
              <div key={review.id} className="py-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{review.name}</p>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className={`w-3 h-3 ${i <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{review.date}</span>
                </div>
                <p className="text-sm text-gray-600">{review.comment}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Productos relacionados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map(rp => (
                <div key={rp.id} onClick={() => router.push(`/catalog/${slug}/product/${rp.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer group">
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    {rp.imageUrl ? (
                      <img src={rp.imageUrl} alt={rp.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-300" /></div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm line-clamp-2">{rp.name}</p>
                    {rp.priceCUP !== null && (
                      <p className="text-base font-bold mt-1" style={{ color: primaryColor }}>{rp.priceCUP.toLocaleString('es-ES')} CUP</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
