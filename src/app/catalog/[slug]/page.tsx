'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Phone, MapPin, MessageCircle, Package, ShoppingBag, Instagram, Facebook, Send, Loader2, ChevronLeft, ChevronRight, X, ShoppingCart, Plus, Minus, Trash2, Flame, Star, ArrowRight } from 'lucide-react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

interface StoreInfo {
  name: string; description: string | null; logoUrl: string | null
  logoMobileUrl: string | null; logoDesktopUrl: string | null
  primaryColor: string; phone: string | null; whatsapp: string | null; email: string | null
  address: string | null; city: string | null; province: string | null
  facebookUrl: string | null; instagramUrl: string | null; telegramUrl: string | null
}

interface Product {
  id: number; name: string; description: string | null; sku: string; category: string | null
  imageUrl: string | null; unit: string; priceUSD: number | null; priceCUP: number | null
  stock: number | null; isTopSeller?: boolean
}

interface CartItem { product: Product; quantity: number }
interface Category { name: string; count: number }

export default function CatalogPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawSlug = params.slug as string

  const [resolvedSlug, setResolvedSlug] = useState<string | null>(rawSlug === 'resolve-host' ? null : rawSlug)
  const [store, setStore] = useState<StoreInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    if (rawSlug === 'resolve-host') {
      const host = searchParams.get('h') || window.location.hostname
      fetch(`/api/public/catalog/resolve?host=${encodeURIComponent(host)}`)
        .then(r => r.json())
        .then(data => { if (data.success && data.slug) setResolvedSlug(data.slug); else setError('Catálogo no encontrado') })
        .catch(() => setError('Error al resolver catálogo'))
    }
  }, [rawSlug, searchParams])

  const slug = resolvedSlug || ''
  const primaryColor = store?.primaryColor || '#f97316'

  const fetchCatalog = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: String(page), limit: '48' })
      if (search) p.set('search', search)
      if (selectedCategory !== 'all') p.set('category', selectedCategory)
      const res = await fetch(`/api/public/catalog/${slug}?${p}`)
      const data = await res.json()
      if (data.success) {
        setStore(data.data.store)
        setProducts(data.data.products)
        setCategories(data.data.categories)
        setTotalPages(data.data.pagination.totalPages)
      } else { setError(data.error || 'Catálogo no encontrado') }
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }, [slug, search, selectedCategory, page])

  useEffect(() => { fetchCatalog() }, [fetchCatalog])
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= (product.stock || 999)) return prev
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product, quantity: 1 }]
    })
  }
  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.product.id !== id))
  const updateCartQty = (id: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== id) return i
      return { ...i, quantity: Math.max(1, Math.min(i.quantity + delta, i.product.stock || 999)) }
    }))
  }
  const cartTotal = cart.reduce((s, i) => s + (i.product.priceUSD || 0) * i.quantity, 0)
  const cartTotalCUP = cart.reduce((s, i) => s + (i.product.priceCUP || 0) * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const topSellers = products.filter(p => p.isTopSeller)
  const showTopSellers = topSellers.length > 0 && !search && selectedCategory === 'all' && page === 1

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Catálogo no disponible</h1>
        <p className="text-gray-500">{error}</p>
      </div>
    </div>
  )

  if (loading && !store) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" style={{ color: primaryColor }} />
        <p className="text-gray-400 text-sm">Cargando catálogo...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {(store?.logoMobileUrl || store?.logoDesktopUrl || store?.logoUrl) ? (
                <>
                  {/* Mobile logo */}
                  <img src={store.logoMobileUrl || store.logoUrl || ''} alt={store.name} className="sm:hidden h-12 object-contain" />
                  {/* Desktop logo */}
                  <img src={store.logoDesktopUrl || store.logoUrl || ''} alt={store.name} className="hidden sm:block h-10 max-w-[200px] object-contain" />
                </>
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: primaryColor + '20' }}>
                  <ShoppingBag className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
              )}
              <div className="hidden sm:block">
                <h1 className="font-bold text-gray-900 text-sm">{store?.name}</h1>
                {store?.city && <p className="text-[11px] text-gray-500">{store.city}{store.province ? `, ${store.province}` : ''}</p>}
              </div>
            </div>

            {/* Search - centered */}
            <div className="flex-1 max-w-xl mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  placeholder="Buscar productos..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-100 border-0 text-sm focus:outline-none focus:ring-2 text-gray-900"
                  style={{ '--tw-ring-color': primaryColor + '40' } as any} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setShowCart(true)} className="relative p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                <ShoppingCart className="w-5 h-5 text-gray-700" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center animate-pulse" style={{ backgroundColor: primaryColor }}>
                    {cartCount}
                  </span>
                )}
              </button>
              {store?.whatsapp && (
                <a href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                  className="hidden sm:flex p-2.5 rounded-xl text-white items-center gap-1.5 text-sm font-medium" style={{ backgroundColor: '#25D366' }}>
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero / Description */}
      {store?.description && !search && selectedCategory === 'all' && page === 1 && (
        <div className="py-8 px-4" style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)` }}>
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{store.name}</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">{store.description}</p>
            {store.address && (
              <p className="text-sm text-gray-500 mt-3 flex items-center justify-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{store.address}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Top Sellers Section */}
        {showTopSellers && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-bold text-gray-900">Más Vendidos</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {topSellers.slice(0, 8).map(product => (
                <div key={`top-${product.id}`}
                  onClick={() => router.push(`/catalog/${slug}/product/${product.id}`)}
                  className="min-w-[160px] sm:min-w-[200px] bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer snap-start group">
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-300" /></div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1" style={{ backgroundColor: primaryColor }}>
                      <Flame className="w-3 h-3" /> Popular
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm line-clamp-1">{product.name}</p>
                    {product.priceCUP !== null && (
                      <p className="text-lg font-bold mt-0.5" style={{ color: primaryColor }}>{product.priceCUP.toLocaleString('es-ES')} <span className="text-xs font-normal">CUP</span></p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
            <button onClick={() => { setSelectedCategory('all'); setPage(1) }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'all' ? 'text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`} style={selectedCategory === 'all' ? { backgroundColor: primaryColor } : {}}>
              Todos
            </button>
            {categories.map(cat => (
              <button key={cat.name} onClick={() => { setSelectedCategory(cat.name); setPage(1) }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.name ? 'text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`} style={selectedCategory === cat.name ? { backgroundColor: primaryColor } : {}}>
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-20 h-20 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500 text-xl font-medium">No se encontraron productos</p>
            {search && <p className="text-gray-400 text-sm mt-2">Intenta con otra búsqueda</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {products.map(product => {
              const inCart = cart.find(i => i.product.id === product.id)
              return (
                <div key={product.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
                  {/* Image - clickable to detail */}
                  <div onClick={() => router.push(`/catalog/${slug}/product/${product.id}`)}
                    className="aspect-square bg-gray-50 relative overflow-hidden cursor-pointer">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-gray-200" /></div>
                    )}
                    {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                        Últimas {product.stock}
                      </span>
                    )}
                    {product.isTopSeller && (
                      <span className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                        <Flame className="w-3.5 h-3.5 text-white" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p onClick={() => router.push(`/catalog/${slug}/product/${product.id}`)}
                      className="font-medium text-gray-900 text-sm line-clamp-2 mb-1.5 leading-tight cursor-pointer hover:underline">{product.name}</p>
                    <div className="space-y-0.5 mb-2">
                      {product.priceCUP !== null && (
                        <p className="text-lg font-bold leading-none" style={{ color: primaryColor }}>
                          {product.priceCUP.toLocaleString('es-ES')} <span className="text-xs font-normal">CUP</span>
                        </p>
                      )}
                      {product.priceUSD !== null && (
                        <p className="text-xs text-gray-400">${product.priceUSD.toFixed(2)} USD</p>
                      )}
                    </div>
                    {product.stock !== null && (
                      <p className="text-[11px] text-gray-400 mb-2">{product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}</p>
                    )}

                    {/* Add to cart */}
                    {inCart ? (
                      <div className="flex items-center justify-between rounded-xl py-1 px-1" style={{ backgroundColor: primaryColor + '15' }}>
                        <button onClick={() => updateCartQty(product.id, -1)} className="p-1.5 rounded-lg hover:bg-white/50"><Minus className="w-3.5 h-3.5" style={{ color: primaryColor }} /></button>
                        <span className="text-sm font-bold" style={{ color: primaryColor }}>{inCart.quantity}</span>
                        <button onClick={() => updateCartQty(product.id, 1)} className="p-1.5 rounded-lg hover:bg-white/50"><Plus className="w-3.5 h-3.5" style={{ color: primaryColor }} /></button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(product)}
                        className="w-full py-2 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: primaryColor }}>
                        <ShoppingCart className="w-3.5 h-3.5" /> Agregar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-8">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2.5 rounded-xl bg-white border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm text-gray-500 font-medium">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2.5 rounded-xl bg-white border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronRight className="w-5 h-5" /></button>
          </div>
        )}
      </div>

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setShowCart(false)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl animate-slide-in-right" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Mi Carrito ({cartCount})
              </h2>
              <button onClick={() => setShowCart(false)} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <ShoppingCart className="w-20 h-20 mb-4 opacity-20" />
                <p className="text-lg font-medium">Carrito vacío</p>
                <p className="text-sm mt-1">Agrega productos desde el catálogo</p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {cart.map(item => (
                    <div key={item.product.id} className="p-4 flex gap-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0 relative">
                        {item.product.imageUrl ? (
                          <img src={item.product.imageUrl} alt={item.product.name} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-gray-300" /></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm line-clamp-2">{item.product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.product.priceCUP !== null && (
                            <span className="text-sm font-bold" style={{ color: primaryColor }}>{(item.product.priceCUP * item.quantity).toLocaleString('es-ES')} CUP</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateCartQty(item.product.id, -1)} className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200"><Minus className="w-3.5 h-3.5" /></button>
                          <span className="text-sm font-bold w-8 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.product.id, 1)} className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200"><Plus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeFromCart(item.product.id)} className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t bg-gray-50 sticky bottom-0">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-500">Total</span>
                    <div className="text-right">
                      <p className="text-2xl font-bold" style={{ color: primaryColor }}>{cartTotalCUP.toLocaleString('es-ES')} CUP</p>
                      <p className="text-sm text-gray-500">${cartTotal.toFixed(2)} USD</p>
                    </div>
                  </div>
                  {store?.whatsapp && (
                    <button onClick={() => {
                      const phone = store!.whatsapp!.replace(/\D/g, '')
                      const items = cart.map(i => `• ${i.product.name} x${i.quantity} — ${i.product.priceCUP ? (i.product.priceCUP * i.quantity).toLocaleString('es-ES') + ' CUP' : ''}`).join('\n')
                      const msg = encodeURIComponent(`Hola! Me interesan:\n\n${items}\n\n*Total: ${cartTotalCUP.toLocaleString('es-ES')} CUP ($${cartTotal.toFixed(2)} USD)*\n\n¿Están disponibles?`)
                      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                    }} className="w-full py-3.5 rounded-xl text-white font-bold flex items-center justify-center gap-2 text-lg" style={{ backgroundColor: '#25D366' }}>
                      <MessageCircle className="w-5 h-5" /> Enviar pedido
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating cart (mobile) */}
      {cartCount > 0 && !showCart && (
        <button onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 z-40 py-3 px-5 rounded-2xl text-white shadow-2xl flex items-center gap-3 hover:scale-105 transition-transform"
          style={{ backgroundColor: primaryColor }}>
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold">{cartCount}</span>
          <span className="text-sm opacity-80">|</span>
          <span className="font-bold text-sm">{cartTotalCUP.toLocaleString('es-ES')} CUP</span>
        </button>
      )}

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center gap-5">
            {/* Social Icons */}
            <div className="flex items-center gap-3">
              {store?.facebookUrl && (
                <a href={store.facebookUrl} target="_blank" rel="noopener" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors text-gray-600">
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {store?.instagramUrl && (
                <a href={store.instagramUrl} target="_blank" rel="noopener" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors text-gray-600">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {store?.telegramUrl && (
                <a href={store.telegramUrl} target="_blank" rel="noopener" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors text-gray-600">
                  <Send className="w-5 h-5" />
                </a>
              )}
              {store?.whatsapp && (
                <a href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors text-gray-600">
                  <MessageCircle className="w-5 h-5" />
                </a>
              )}
              {store?.phone && (
                <a href={`tel:${store.phone}`} className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors text-gray-600">
                  <Phone className="w-5 h-5" />
                </a>
              )}
            </div>
            {store?.address && (
              <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{store.address}</p>
            )}
            <p className="text-xs text-gray-400">© {new Date().getFullYear()} {store?.name} · Powered by LogiRapid</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
