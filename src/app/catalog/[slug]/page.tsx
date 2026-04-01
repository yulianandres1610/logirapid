'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Phone, MapPin, MessageCircle, Package, ShoppingBag, ExternalLink, Instagram, Facebook, Send, Loader2, ChevronLeft, ChevronRight, X, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useParams } from 'next/navigation'

interface StoreInfo {
  name: string; description: string | null; logoUrl: string | null
  primaryColor: string; phone: string | null; whatsapp: string | null; email: string | null
  address: string | null; city: string | null; province: string | null
  facebookUrl: string | null; instagramUrl: string | null; telegramUrl: string | null
}

interface CartItem {
  product: Product
  quantity: number
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
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        const max = product.stock || 999
        if (existing.quantity >= max) return prev
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const removeFromCart = (productId: number) => setCart(prev => prev.filter(i => i.product.id !== productId))

  const updateCartQty = (productId: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i
      const max = i.product.stock || 999
      const newQty = Math.max(1, Math.min(i.quantity + delta, max))
      return { ...i, quantity: newQty }
    }))
  }

  const cartTotal = cart.reduce((sum, i) => sum + (i.product.priceUSD || 0) * i.quantity, 0)
  const cartTotalCUP = cart.reduce((sum, i) => sum + (i.product.priceCUP || 0) * i.quantity, 0)
  const cartItemCount = cart.reduce((sum, i) => sum + i.quantity, 0)

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
              {/* Cart Button */}
              <button onClick={() => setShowCart(true)} className="relative p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
                <ShoppingCart className="w-5 h-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                    {cartItemCount}
                  </span>
                )}
              </button>
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

      {/* Description */}
      {store?.description && (
        <div className="py-4 px-4 text-center" style={{ backgroundColor: primaryColor + '10' }}>
          <p className="text-gray-700 max-w-2xl mx-auto text-sm">{store.description}</p>
        </div>
      )}

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

                  {/* Add to cart */}
                  <button
                    onClick={(e) => { e.stopPropagation(); addToCart(product) }}
                    className="mt-2 w-full py-2 rounded-lg text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {cart.find(i => i.product.id === product.id) ? `En carrito (${cart.find(i => i.product.id === product.id)!.quantity})` : 'Agregar'}
                  </button>
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
              {selectedProduct.stock && selectedProduct.stock > 0 && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => { addToCart(selectedProduct); setSelectedProduct(null) }}
                    className="flex-1 py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 text-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Agregar al carrito
                  </button>
                  {store?.whatsapp && (
                    <button
                      onClick={() => openWhatsApp(selectedProduct)}
                      className="py-3.5 px-4 rounded-xl text-white font-bold flex items-center justify-center"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setShowCart(false)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Mi Carrito ({cartItemCount})
              </h2>
              <button onClick={() => setShowCart(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ShoppingCart className="w-16 h-16 mb-3 opacity-30" />
                <p className="text-lg font-medium">Carrito vacío</p>
                <p className="text-sm">Agrega productos desde el catálogo</p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {cart.map(item => (
                    <div key={item.product.id} className="p-4 flex gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0 relative">
                        {item.product.imageUrl ? (
                          <Image src={item.product.imageUrl} alt={item.product.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-gray-300" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm line-clamp-2">{item.product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.product.priceCUP !== null && (
                            <span className="text-sm font-bold" style={{ color: primaryColor }}>{item.product.priceCUP?.toLocaleString('es-ES')} CUP</span>
                          )}
                          {item.product.priceUSD !== null && (
                            <span className="text-xs text-gray-500">${item.product.priceUSD?.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateCartQty(item.product.id, -1)} className="p-1 rounded-md bg-gray-100 hover:bg-gray-200"><Minus className="w-3.5 h-3.5" /></button>
                          <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.product.id, 1)} className="p-1 rounded-md bg-gray-100 hover:bg-gray-200"><Plus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeFromCart(item.product.id)} className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded-md"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cart Total */}
                <div className="p-4 border-t bg-gray-50 sticky bottom-0">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-500">Total</span>
                    <div className="text-right">
                      <p className="text-xl font-bold" style={{ color: primaryColor }}>{cartTotalCUP.toLocaleString('es-ES')} CUP</p>
                      <p className="text-sm text-gray-500">${cartTotal.toFixed(2)} USD</p>
                    </div>
                  </div>
                  {store?.whatsapp && (
                    <button
                      onClick={() => {
                        const phone = store!.whatsapp!.replace(/\D/g, '')
                        const items = cart.map(i => `- ${i.product.name} x${i.quantity}${i.product.priceCUP ? ` (${(i.product.priceCUP * i.quantity).toLocaleString('es-ES')} CUP)` : ''}`).join('\n')
                        const msg = encodeURIComponent(`Hola! Me interesan estos productos:\n\n${items}\n\nTotal: ${cartTotalCUP.toLocaleString('es-ES')} CUP ($${cartTotal.toFixed(2)} USD)\n\n¿Están disponibles?`)
                        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                      }}
                      className="w-full py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle className="w-5 h-5" />
                      Enviar pedido por WhatsApp
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating cart button (mobile) */}
      {cartItemCount > 0 && !showCart && (
        <button onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 z-40 p-4 rounded-full text-white shadow-2xl flex items-center gap-2"
          style={{ backgroundColor: primaryColor }}>
          <ShoppingCart className="w-6 h-6" />
          <span className="font-bold">{cartItemCount}</span>
        </button>
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
