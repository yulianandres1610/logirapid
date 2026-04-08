'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Phone, MapPin, MessageCircle, Package, ShoppingBag, Instagram, Facebook, Send, Loader2, ChevronLeft, ChevronRight, X, ShoppingCart, Plus, Minus, Trash2, Flame, Star, ArrowRight, Check } from 'lucide-react'
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

// Lazy-loading image with fade-in and placeholder
function LazyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.disconnect() }
    }, { rootMargin: '200px' })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="absolute inset-0">
      {!loaded && <div className="absolute inset-0 bg-gray-100 animate-pulse" />}
      {inView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`${className || ''} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}

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

  const fetchCatalog = useCallback(async (silent = false) => {
    if (!slug) return
    if (!silent) setLoading(true)
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
      } else if (!silent) { setError(data.error || 'Catálogo no encontrado') }
    } catch { if (!silent) setError('Error de conexión') }
    finally { if (!silent) setLoading(false) }
  }, [slug, search, selectedCategory, page])

  useEffect(() => { fetchCatalog(false) }, [fetchCatalog])

  // Silent auto-refresh every 60s (no loading spinner, no flicker)
  useEffect(() => {
    if (!slug) return
    const interval = setInterval(() => fetchCatalog(true), 60000)
    return () => clearInterval(interval)
  }, [slug, fetchCatalog])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const [justAdded, setJustAdded] = useState<number | null>(null)
  const [cartBounce, setCartBounce] = useState(false)

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= (product.stock || 999)) return prev
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product, quantity: 1 }]
    })
    // Visual feedback
    setJustAdded(product.id)
    setCartBounce(true)
    setTimeout(() => setJustAdded(null), 800)
    setTimeout(() => setCartBounce(false), 600)
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
  const paintProducts = products.filter(p => p.category?.toLowerCase().includes('pintura') && p.stock && p.stock > 0)
  const showPaintCarousel = paintProducts.length > 0 && !search && selectedCategory === 'all' && page === 1

  const scrollCarousel = (ref: React.RefObject<HTMLDivElement | null>, dir: 'left' | 'right') => {
    if (!ref.current) return
    const scrollAmount = ref.current.clientWidth * 0.7
    ref.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
  }
  const topRef = useRef<HTMLDivElement>(null)
  const paintRef = useRef<HTMLDivElement>(null)

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 sm:px-8 lg:px-12 py-4">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            <div className="flex items-center shrink-0">
              {(store?.logoMobileUrl || store?.logoDesktopUrl || store?.logoUrl) ? (
                <>
                  {/* Mobile logo */}
                  <img src={store.logoMobileUrl || store.logoUrl || ''} alt={store.name} className="sm:hidden h-16 object-contain" />
                  {/* Desktop logo */}
                  <img src={store.logoDesktopUrl || store.logoUrl || ''} alt={store.name} className="hidden sm:block h-14 max-w-[280px] object-contain ml-4" />
                </>
              ) : (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: primaryColor + '20' }}>
                  <ShoppingBag className="w-6 h-6" style={{ color: primaryColor }} />
                </div>
              )}
            </div>

            {/* Search */}
            <div className="flex-1 max-w-3xl mx-2 sm:mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  placeholder="Buscar productos..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-100 border-0 text-sm focus:outline-none focus:ring-2 text-gray-900"
                  style={{ '--tw-ring-color': primaryColor + '40' } as any} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => setShowCart(true)}
                animate={cartBounce ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
                transition={{ duration: 0.5 }}
                className="relative p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                <ShoppingCart className="w-5 h-5 text-gray-700" />
                <AnimatePresence>
                  {cartCount > 0 && (
                    <motion.span
                      key={cartCount}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}>
                      {cartCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
          className="py-8 px-4" style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${primaryColor}05)` }}>
          <div className="max-w-7xl mx-auto text-center">
            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{store.name}</motion.h2>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-gray-600 max-w-2xl mx-auto">{store.description}</motion.p>
            {store.address && (
              <p className="text-sm text-gray-500 mt-3 flex items-center justify-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{store.address}
              </p>
            )}
          </div>
        </motion.div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 flex-1">

        {/* Top Sellers Carousel */}
        {showTopSellers && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <h2 className="text-xl font-bold text-gray-900">Más Vendidos</h2>
              </div>
              <div className="flex gap-1">
                <button onClick={() => scrollCarousel(topRef, 'left')} className="p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
                <button onClick={() => scrollCarousel(topRef, 'right')} className="p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
              </div>
            </div>
            <div ref={topRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x scroll-smooth">
              {topSellers.map(product => (
                <div key={`top-${product.id}`}
                  onClick={() => router.push(`/catalog/${slug}/product/${product.id}`)}
                  className="min-w-[160px] sm:min-w-[200px] bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer snap-start group flex-shrink-0">
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    {product.imageUrl ? (
                      <LazyImage src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-300" /></div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1" style={{ backgroundColor: primaryColor }}>
                      <Flame className="w-3 h-3" /> Popular
                    </div>
                    {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-red-500">Últimas {product.stock}</div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm line-clamp-1">{product.name}</p>
                    {product.priceCUP !== null && (
                      <p className="text-lg font-bold mt-0.5" style={{ color: primaryColor }}>{product.priceCUP.toLocaleString('es-ES')} <span className="text-xs font-normal">CUP</span></p>
                    )}
                    {product.priceUSD !== null && (
                      <p className="text-xs text-gray-500">${product.priceUSD.toFixed(2)} USD</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paint Products Carousel */}
        {showPaintCarousel && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎨</span>
                <h2 className="text-xl font-bold text-gray-900">Pinturas</h2>
                <span className="text-sm text-gray-500">Fabricación propia</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => scrollCarousel(paintRef, 'left')} className="p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
                <button onClick={() => scrollCarousel(paintRef, 'right')} className="p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-50 transition-colors"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
              </div>
            </div>
            <div ref={paintRef} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x scroll-smooth">
              {paintProducts.map(product => (
                <div key={`paint-${product.id}`}
                  onClick={() => router.push(`/catalog/${slug}/product/${product.id}`)}
                  className="min-w-[160px] sm:min-w-[200px] bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer snap-start group flex-shrink-0">
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    {product.imageUrl ? (
                      <LazyImage src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-300" /></div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-blue-600 flex items-center gap-1">
                      🎨 Pintura
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm line-clamp-1">{product.name}</p>
                    {product.priceCUP !== null && (
                      <p className="text-lg font-bold mt-0.5" style={{ color: primaryColor }}>{product.priceCUP.toLocaleString('es-ES')} <span className="text-xs font-normal">CUP</span></p>
                    )}
                    {product.priceUSD !== null && (
                      <p className="text-xs text-gray-500">${product.priceUSD.toFixed(2)} USD</p>
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
          <>
          {/* Desktop grid */}
          <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product, i) => {
              const inCart = cart.find(c => c.product.id === product.id)
              return (
                <motion.div key={product.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.5), duration: 0.3 }}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300 group flex flex-col">
                  <div onClick={() => router.push(`/catalog/${slug}/product/${product.id}`)}
                    className="aspect-square bg-gray-50 relative overflow-hidden cursor-pointer">
                    {product.imageUrl ? (
                      <LazyImage src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-10 h-10 text-gray-200" /></div>
                    )}
                    {product.stock !== null && product.stock <= 5 && product.stock > 0 && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Últimas {product.stock}</span>
                    )}
                    {product.isTopSeller && (
                      <span className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                        <Flame className="w-3.5 h-3.5 text-white" />
                      </span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <p onClick={() => router.push(`/catalog/${slug}/product/${product.id}`)}
                      className="font-medium text-gray-900 text-sm line-clamp-2 mb-1.5 leading-tight cursor-pointer hover:underline">{product.name}</p>
                    <div className="space-y-0.5 mb-2">
                      {product.priceCUP !== null && (
                        <p className="text-lg font-bold leading-none" style={{ color: primaryColor }}>{product.priceCUP.toLocaleString('es-ES')} <span className="text-xs font-normal">CUP</span></p>
                      )}
                      {product.priceUSD !== null && <p className="text-xs text-gray-400">${product.priceUSD.toFixed(2)} USD</p>}
                    </div>
                    {product.stock !== null && <p className="text-[11px] text-gray-400 mb-auto">{product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}</p>}
                    <div className="mt-auto pt-2">
                      {inCart ? (
                        <div className="flex items-center justify-between rounded-xl py-1 px-1" style={{ backgroundColor: primaryColor + '15' }}>
                          <button onClick={() => updateCartQty(product.id, -1)} className="p-1.5 rounded-lg hover:bg-white/50"><Minus className="w-3.5 h-3.5" style={{ color: primaryColor }} /></button>
                          <span className="text-sm font-bold" style={{ color: primaryColor }}>{inCart.quantity}</span>
                          <button onClick={() => updateCartQty(product.id, 1)} className="p-1.5 rounded-lg hover:bg-white/50"><Plus className="w-3.5 h-3.5" style={{ color: primaryColor }} /></button>
                        </div>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => addToCart(product)}
                          className="w-full py-2 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-1.5"
                          style={{ backgroundColor: justAdded === product.id ? '#10b981' : primaryColor }}>
                          {justAdded === product.id ? (
                            <><Check className="w-3.5 h-3.5" /> Agregado</>
                          ) : (
                            <><ShoppingCart className="w-3.5 h-3.5" /> Agregar</>
                          )}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Mobile: horizontal card list (1 product per row) */}
          <div className="sm:hidden space-y-3">
            {products.map((product, i) => {
              const inCart = cart.find(c => c.product.id === product.id)
              return (
                <motion.div key={product.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.25 }}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden flex hover:shadow-md transition-shadow">
                  {/* Image */}
                  <div onClick={() => router.push(`/catalog/${slug}/product/${product.id}`)}
                    className="w-28 h-28 bg-gray-50 relative overflow-hidden cursor-pointer shrink-0">
                    {product.imageUrl ? (
                      <LazyImage src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-200" /></div>
                    )}
                    {product.isTopSeller && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white flex items-center gap-0.5" style={{ backgroundColor: primaryColor }}>
                        <Flame className="w-2.5 h-2.5" /> Popular
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                      <p onClick={() => router.push(`/catalog/${slug}/product/${product.id}`)}
                        className="font-medium text-gray-900 text-sm line-clamp-2 leading-tight cursor-pointer">{product.name}</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        {product.priceCUP !== null && (
                          <p className="text-base font-bold" style={{ color: primaryColor }}>{product.priceCUP.toLocaleString('es-ES')} CUP</p>
                        )}
                        {product.priceUSD !== null && <p className="text-[11px] text-gray-400">${product.priceUSD.toFixed(2)}</p>}
                      </div>
                      {product.stock !== null && <p className="text-[10px] text-gray-400 mt-0.5">{product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}</p>}
                    </div>
                    {/* Cart button */}
                    <div className="mt-2">
                      {inCart ? (
                        <div className="flex items-center gap-2 rounded-lg py-1 px-2 w-fit" style={{ backgroundColor: primaryColor + '15' }}>
                          <button onClick={() => updateCartQty(product.id, -1)} className="p-1 rounded"><Minus className="w-3 h-3" style={{ color: primaryColor }} /></button>
                          <span className="text-xs font-bold min-w-[16px] text-center" style={{ color: primaryColor }}>{inCart.quantity}</span>
                          <button onClick={() => updateCartQty(product.id, 1)} className="p-1 rounded"><Plus className="w-3 h-3" style={{ color: primaryColor }} /></button>
                        </div>
                      ) : (
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => addToCart(product)}
                          className="px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-1"
                          style={{ backgroundColor: justAdded === product.id ? '#10b981' : primaryColor }}>
                          {justAdded === product.id ? <><Check className="w-3 h-3" /> Listo</> : <><ShoppingCart className="w-3 h-3" /> Agregar</>}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
          </>
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

      {/* Floating cart (mobile) - animated on add */}
      <AnimatePresence>
        {cartCount > 0 && !showCart && (
          <motion.button
            key="floating-cart"
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.8 }}
            onClick={() => setShowCart(true)}
            className="fixed bottom-6 right-6 z-40 py-3 px-5 rounded-2xl text-white shadow-2xl flex items-center gap-3"
            style={{ backgroundColor: primaryColor }}>
            <motion.div animate={cartBounce ? { scale: [1, 1.4, 1], rotate: [0, -15, 15, 0] } : {}} transition={{ duration: 0.4 }}>
              <ShoppingCart className="w-5 h-5" />
            </motion.div>
            <motion.span key={cartCount} initial={{ scale: 1.5, color: '#fff' }} animate={{ scale: 1 }} className="font-bold">
              {cartCount}
            </motion.span>
            <span className="text-sm opacity-80">|</span>
            <motion.span key={cartTotalCUP} initial={{ y: -5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-bold text-sm">
              {cartTotalCUP.toLocaleString('es-ES')} CUP
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>

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
