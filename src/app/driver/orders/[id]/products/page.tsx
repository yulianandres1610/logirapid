'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Package,
  Plus,
  Minus,
  Trash2,
  Scale,
  DollarSign,
  X,
  Check,
  Plane,
  Ship,
  AlertCircle,
  ShoppingCart
} from 'lucide-react'

interface CatalogProduct {
  id: number
  code: string
  name: string
  description: string
  service_category: string
  unit_type: string
  precio_publico: number
  weight_capacity: string
}

interface CartProduct {
  productId: number
  productCode: string
  productName: string
  quantity: number
  weightLbs: number
  unitPrice: number
  subtotal: number
}

type ShippingType = 'air' | 'maritime'

export default function AddProductsPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [shippingType, setShippingType] = useState<ShippingType>('air')
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [cart, setCart] = useState<CartProduct[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [empaqueCode, setEmpaqueCode] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null)
  const [addQuantity, setAddQuantity] = useState(1)
  const [addWeight, setAddWeight] = useState(0)

  // Fetch products from catalog
  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/products?category=paqueteria&active=true')
      const data = await response.json()

      if (data.success) {
        setProducts(data.data.products || [])
      } else {
        setError(data.error || 'Error al cargar productos')
      }
    } catch (err) {
      console.error('Error fetching products:', err)
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch existing products from order
  const fetchOrderProducts = async () => {
    try {
      const response = await fetch(`/api/driver-app/orders/${orderId}/products`)
      const data = await response.json()

      if (data.success && data.data.products) {
        setCart(data.data.products)
        if (data.data.shippingType) {
          setShippingType(data.data.shippingType)
        }
        if (data.data.empaqueCode) {
          setEmpaqueCode(data.data.empaqueCode)
        }
      }
    } catch (err) {
      console.error('Error fetching order products:', err)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchOrderProducts()
  }, [orderId])

  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      product.name?.toLowerCase().includes(query) ||
      product.code?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    )
  })

  const handleSelectProduct = (product: CatalogProduct) => {
    setSelectedProduct(product)
    setAddQuantity(1)
    setAddWeight(0)
    setShowAddModal(true)
  }

  const handleAddToCart = () => {
    if (!selectedProduct) return

    const existingIndex = cart.findIndex(item => item.productId === selectedProduct.id)
    const unitPrice = selectedProduct.precio_publico

    if (existingIndex >= 0) {
      // Update existing item
      const updatedCart = [...cart]
      updatedCart[existingIndex].quantity += addQuantity
      updatedCart[existingIndex].weightLbs += addWeight
      updatedCart[existingIndex].subtotal = updatedCart[existingIndex].quantity * unitPrice
      setCart(updatedCart)
    } else {
      // Add new item
      setCart([...cart, {
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        productName: selectedProduct.name,
        quantity: addQuantity,
        weightLbs: addWeight,
        unitPrice,
        subtotal: addQuantity * unitPrice
      }])
    }

    setShowAddModal(false)
    setSelectedProduct(null)
  }

  const handleRemoveFromCart = (productId: number) => {
    setCart(cart.filter(item => item.productId !== productId))
  }

  const handleUpdateQuantity = (productId: number, delta: number) => {
    const updatedCart = cart.map(item => {
      if (item.productId === productId) {
        const newQuantity = Math.max(1, item.quantity + delta)
        return {
          ...item,
          quantity: newQuantity,
          subtotal: newQuantity * item.unitPrice
        }
      }
      return item
    })
    setCart(updatedCart)
  }

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0)

  const handleSave = async () => {
    if (cart.length === 0) {
      setError('Agrega al menos un producto')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/driver-app/orders/${orderId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingType,
          products: cart,
          empaqueCode,
          totalAmount
        })
      })

      const data = await response.json()

      if (data.success) {
        router.back()
      } else {
        setError(data.error || 'Error al guardar productos')
      }
    } catch (err) {
      console.error('Error saving products:', err)
      setError('Error de conexion')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="pb-40">
      {/* Shipping Type Toggle */}
      <div className="px-4 pt-4 mb-4">
        <p className="text-gray-400 text-sm mb-2">Tipo de Envio</p>
        <div className="flex bg-gray-800 rounded-xl p-1">
          <button
            onClick={() => setShippingType('air')}
            className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
              shippingType === 'air'
                ? 'bg-exa-primary text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Plane className="w-4 h-4" />
            <span>Aereo</span>
          </button>
          <button
            onClick={() => setShippingType('maritime')}
            className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
              shippingType === 'maritime'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Ship className="w-4 h-4" />
            <span>Maritimo</span>
          </button>
        </div>
      </div>

      {/* Empaque Code */}
      <div className="px-4 mb-4">
        <p className="text-gray-400 text-sm mb-2">Codigo de Empaque</p>
        <input
          type="text"
          value={empaqueCode}
          onChange={(e) => setEmpaqueCode(e.target.value.toUpperCase())}
          placeholder="EMP-2025-0001"
          className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary focus:ring-1 focus:ring-exa-primary transition-all outline-none font-mono"
        />
      </div>

      {/* Search Products */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary focus:ring-1 focus:ring-exa-primary transition-all outline-none"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 mb-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Products List from Catalog */}
      <div className="px-4">
        <h3 className="text-white font-semibold mb-3">Catalogo de Productos</h3>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-exa-primary/30 border-t-exa-primary rounded-full animate-spin mb-3" />
            <p className="text-gray-400 text-sm">Cargando productos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No se encontraron productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => handleSelectProduct(product)}
                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-all active:scale-[0.98]"
              >
                <div className="w-10 h-10 bg-gray-700/50 rounded-lg flex items-center justify-center mb-2">
                  <Package className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-white font-medium text-sm truncate">{product.name}</p>
                <p className="text-gray-500 text-xs mb-2">{product.code}</p>
                <p className="text-exa-primary font-semibold">
                  ${product.precio_publico?.toFixed(2) || '0.00'}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Summary (Fixed at bottom) */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 py-3 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800">
          {/* Cart Items Preview */}
          <div className="mb-3 max-h-32 overflow-y-auto">
            {cart.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-white text-sm truncate">{item.productName}</span>
                  <span className="text-gray-500 text-xs">x{item.quantity}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">${item.subtotal.toFixed(2)}</span>
                  <button
                    onClick={() => handleRemoveFromCart(item.productId)}
                    className="p-1 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total and Save Button */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-gray-400 text-xs">Total</p>
              <p className="text-white font-bold text-xl">${totalAmount.toFixed(2)}</p>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-gradient-to-r from-exa-primary to-exa-secondary text-white font-semibold rounded-xl flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddModal && selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-gray-900 rounded-t-3xl p-6 pb-8"
            >
              {/* Handle */}
              <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6" />

              {/* Product Info */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">{selectedProduct.name}</h3>
                  <p className="text-gray-400 text-sm">{selectedProduct.code}</p>
                  <p className="text-exa-primary font-bold text-xl mt-1">
                    ${selectedProduct.precio_publico?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>

              {/* Quantity */}
              <div className="mb-4">
                <p className="text-gray-400 text-sm mb-2">Cantidad</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setAddQuantity(Math.max(1, addQuantity - 1))}
                    className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-white hover:bg-gray-700"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="text-white font-bold text-2xl flex-1 text-center">
                    {addQuantity}
                  </span>
                  <button
                    onClick={() => setAddQuantity(addQuantity + 1)}
                    className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-white hover:bg-gray-700"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Weight */}
              <div className="mb-6">
                <p className="text-gray-400 text-sm mb-2">Peso (libras)</p>
                <div className="relative">
                  <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    value={addWeight || ''}
                    onChange={(e) => setAddWeight(parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    step="0.1"
                    min="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                  />
                </div>
              </div>

              {/* Subtotal */}
              <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-white font-bold text-xl">
                    ${(addQuantity * (selectedProduct.precio_publico || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Add Button */}
              <button
                onClick={handleAddToCart}
                className="w-full py-4 bg-gradient-to-r from-exa-primary to-exa-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>Agregar al Carrito</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
