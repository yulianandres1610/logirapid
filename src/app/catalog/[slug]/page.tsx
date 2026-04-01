'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Phone, MapPin, MessageCircle, Package, ShoppingBag, ExternalLink, Instagram, Facebook, Send, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import Image from 'next/image'
import { useParams } from 'next/navigation'

interface StoreInfo {
  name: string; description: string | null; logoUrl: string | null; bannerUrl: string | null
  primaryColor: string; phone: string | null; whatsapp: string | null; email: string | null
  address: string | null; city: string | null; province: string | null
  facebookUrl: string | null; instagramUrl: string | null; telegramUrl: string | null
}

interface Product {
  id: number; name: string; description: string | null; sku: string; category: string | null
  imageUrl: string | null; unit: string; priceUSD: number | null; priceCUP: number | null; stock: number | null
}

interface Category { name: string; count: number }

export default function CatalogPage() {
  const params = useParams()
  const slug = params.slug as string

  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [exchangeRate, setExchangeRate] = useState(505)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const fetchCatalog = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '48' })
      if (search) params.set('search', search)
      if (selectedCategory !== 'all') params.set('category', selectedCategory)

      const res = await fetch(`/api/public/catalog/${slug}?${params}`)
      const data = await res.json()

      if (data.success) {
        setStore(data.data.store)
        setProducts(data.data.products)
        setCategories(data.data.categories)
        setExchangeRate(data.data.exchangeRate)
        setTotalPages(data.data.pagination.totalPages)
      } else {
        setError(data.error || 'Catálogo no encontrado')
      }
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }, [slug, search, selectedCategory, page])

  useEffect(() => { fetchCatalog() }, [fetchCatalog])

  // Debounced search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const openWhatsApp = (product: Product) => {
    if (!store?.whatsapp) return
    const phone = store.whatsapp.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Hola! Me interesa el producto:\n*${product.name}*\n${product.priceUSD ? `Precio: $${product.priceUSD.toFixed(2)} USD` : ''}${product.priceCUP ? ` (${product.priceCUP.toLocaleString('es-ES')} CUP)` : ''}\n¿Está disponible?`
    )
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const primaryColor = store?.primaryColor || '#f97316'

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-700 mb-2">Catálogo no disponible</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (loading && !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {store?.logoUrl ? (
                <Image src={store.logoUrl} alt={store.name} width={40} height={40} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor + '20' }}>
                  <ShoppingBag className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
              )}
              <div>
                <h1 className="font-bold text-gray-900 text-sm sm:text-base">{store?.name}</h1>
                {store?.city && <p className="text-xs text-gray-500">{store.city}{store.province ? `, ${store.province}` : ''}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {store?.whatsapp && (
                <a href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                  className="p-2 rounded-lg text-white text-sm font-medium flex items-center gap-1.5" style={{ backgroundColor: '#25D366' }}>
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
              {store?.phone && (
                <a href={`tel:${store.phone}`} className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Banner / Hero */}
      {store?.bannerUrl ? (
        <div className="relative h-40 sm:h-56 overflow-hidden">
          <Image src={store.bannerUrl} alt="Banner" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          {store.description && (
            <div className="absolute bottom-4 left-4 right-4">
              <p className="text-white text-sm sm:text-base max-w-2xl">{store.description}</p>
            </div>
          )}
        </div>
      ) : store?.description ? (
        <div className="py-6 px-4 text-center" style={{ backgroundColor: primaryColor + '10' }}>
          <p className="text-gray-700 max-w-2xl mx-auto">{store.description}</p>
        </div>
      ) : null}

      {/* Info bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          {store?.address && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{store.address}</span>
          )}
          <span className="flex items-center gap-1 font-medium" style={{ color: primaryColor }}>
            1 USD = {exchangeRate.toLocaleString('es-ES')} CUP
          </span>
        </div>
      </div>

      {/* Search + Categories */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': primaryColor + '40' } as any}
          />
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            <button
              onClick={() => { setSelectedCategory('all'); setPage(1) }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'all' ? 'text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
              style={selectedCategory === 'all' ? { backgroundColor: primaryColor } : {}}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.name}
                onClick={() => { setSelectedCategory(cat.name); setPage(1) }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.name ? 'text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
                style={selectedCategory === cat.name ? { backgroundColor: primaryColor } : {}}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg">No se encontraron productos</p>
            {search && <p className="text-gray-400 text-sm mt-1">Intenta con otra búsqueda</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {products.map(product => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
              >
                {/* Image */}
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                      Últimas {product.stock}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="font-medium text-gray-900 text-sm line-clamp-2 mb-2 leading-tight">{product.name}</p>

                  {/* Prices */}
                  <div className="space-y-0.5">
                    {product.priceCUP !== null && (
                      <p className="text-lg font-bold" style={{ color: primaryColor }}>
                        {product.priceCUP.toLocaleString('es-ES')} CUP
                      </p>
                    )}
                    {product.priceUSD !== null && (
                      <p className="text-sm text-gray-500 font-medium">
                        ${product.priceUSD.toFixed(2)} USD
                      </p>
                    )}
                  </div>

                  {/* Stock */}
                  {product.stock !== null && (
                    <p className="text-xs text-gray-400 mt-1">
                      {product.stock > 0 ? `${product.stock} ${product.unit}` : 'Agotado'}
                    </p>
                  )}

                  {/* WhatsApp button */}
                  {store?.whatsapp && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openWhatsApp(product) }}
                      className="mt-2 w-full py-2 rounded-lg text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Consultar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8 mb-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => setSelectedProduct(null)}>
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <div className="aspect-video bg-gray-100 relative">
                {selectedProduct.imageUrl ? (
                  <Image src={selectedProduct.imageUrl} alt={selectedProduct.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Package className="w-16 h-16 text-gray-300" /></div>
                )}
              </div>
              <button onClick={() => setSelectedProduct(null)} className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              {selectedProduct.category && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">{selectedProduct.category}</span>
              )}
              <h2 className="text-xl font-bold text-gray-900 mt-2">{selectedProduct.name}</h2>
              {selectedProduct.description && (
                <p className="text-gray-600 text-sm mt-2">{selectedProduct.description}</p>
              )}
              <div className="mt-4 flex items-end gap-3">
                {selectedProduct.priceCUP !== null && (
                  <p className="text-3xl font-bold" style={{ color: primaryColor }}>
                    {selectedProduct.priceCUP.toLocaleString('es-ES')} CUP
                  </p>
                )}
                {selectedProduct.priceUSD !== null && (
                  <p className="text-lg text-gray-500 font-medium pb-0.5">${selectedProduct.priceUSD.toFixed(2)} USD</p>
                )}
              </div>
              {selectedProduct.stock !== null && (
                <p className="text-sm text-gray-500 mt-2">
                  {selectedProduct.stock > 0 ? `${selectedProduct.stock} ${selectedProduct.unit} disponibles` : 'Producto agotado'}
                </p>
              )}
              {store?.whatsapp && selectedProduct.stock && selectedProduct.stock > 0 && (
                <button
                  onClick={() => openWhatsApp(selectedProduct)}
                  className="mt-4 w-full py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 text-lg"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <MessageCircle className="w-5 h-5" />
                  Consultar por WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {store?.logoUrl ? (
                <Image src={store.logoUrl} alt={store?.name || ''} width={32} height={32} className="w-8 h-8 rounded-lg object-cover" />
              ) : null}
              <span className="font-bold text-gray-700">{store?.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {store?.instagramUrl && (
                <a href={store.instagramUrl} target="_blank" rel="noopener" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {store?.facebookUrl && (
                <a href={store.facebookUrl} target="_blank" rel="noopener" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {store?.telegramUrl && (
                <a href={store.telegramUrl} target="_blank" rel="noopener" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
                  <Send className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center">
            © {new Date().getFullYear()} {store?.name}. Powered by LogiRapid
          </p>
        </div>
      </footer>
    </div>
  )
}
