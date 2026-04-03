'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Package, ShoppingCart, MessageCircle, Phone, MapPin, Star, Loader2, Minus, Plus, Share2, Heart } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'

interface Product {
  id: number; name: string; description: string | null; sku: string; category: string | null
  imageUrl: string | null; unit: string; priceUSD: number | null; priceCUP: number | null; stock: number | null
}

interface StoreInfo {
  name: string; logoUrl: string | null; primaryColor: string
  whatsapp: string | null; phone: string | null
  address: string | null; city: string | null; province: string | null
}

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

  const primaryColor = store?.primaryColor || '#f97316'

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
            // Related: same category, exclude current
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

  const share = () => {
    if (navigator.share && product) {
      navigator.share({ title: product.name, url: window.location.href })
    } else {
      navigator.clipboard.writeText(window.location.href)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    )
  }

  if (!product) {
    return (
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
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push(`/catalog/${slug}`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Catálogo</span>
          </button>
          <span className="font-bold text-gray-900">{store?.name}</span>
          <button onClick={share} className="p-2 rounded-lg hover:bg-gray-100">
            <Share2 className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Product Image */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            <div className="aspect-square relative bg-gray-100">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-4" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-24 h-24 text-gray-300" />
                </div>
              )}
              {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-sm px-3 py-1 rounded-full font-medium">
                  Últimas {product.stock} unidades
                </span>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category */}
            {product.category && (
              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">{product.category}</span>
            )}

            {/* Name */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{product.name}</h1>

            {/* Prices */}
            <div className="space-y-1">
              {product.priceCUP !== null && (
                <p className="text-3xl sm:text-4xl font-bold" style={{ color: primaryColor }}>
                  {product.priceCUP.toLocaleString('es-ES')} CUP
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

            {/* Description */}
            {product.description && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
                <p className="text-gray-600 leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* SKU */}
            {product.sku && (
              <p className="text-xs text-gray-400">SKU: {product.sku}</p>
            )}

            {/* Quantity Selector */}
            {product.stock && product.stock > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Cantidad</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xl font-bold w-12 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(product.stock || 999, q + 1))}
                    className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
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

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              {store?.whatsapp && product.stock && product.stock > 0 && (
                <button onClick={openWhatsApp}
                  className="flex-1 py-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#25D366' }}>
                  <MessageCircle className="w-5 h-5" />
                  Consultar por WhatsApp
                </button>
              )}
              {store?.phone && (
                <a href={`tel:${store.phone}`}
                  className="py-4 px-5 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-gray-600" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Productos relacionados</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map(rp => (
                <div key={rp.id} onClick={() => router.push(`/catalog/${slug}/product/${rp.id}`)}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer">
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    {rp.imageUrl ? (
                      <img src={rp.imageUrl} alt={rp.name} className="absolute inset-0 w-full h-full object-cover" />
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
