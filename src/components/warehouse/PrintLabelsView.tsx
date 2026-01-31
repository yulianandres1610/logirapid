'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Printer,
  Loader2,
  Package,
  Tag,
  Barcode,
  Image as ImageIcon
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'
import { PrintLabelModal } from '@/components/print/PrintLabelModal'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  name: string
  description: string | null
  sku: string
  barcode: string | null
  imageUrl: string | null
  sellingPrice: number
  costPrice: number
  unit: string
  category: string | null
  stock: number
  variants?: ProductVariant[]
}

interface ProductVariant {
  id: number
  name: string
  barcode: string | null
  sku?: string | null
  price?: number
  imageUrl?: string | null
}

interface PrintLabelsViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
}

export default function PrintLabelsView({
  warehouseId,
  warehouseName,
  onBack
}: PrintLabelsViewProps) {
  const { theme } = useTheme()
  const { USD_CUP } = useMarketExchangeRates()

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)

  // Fetch products from warehouse using POS products API
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/market/pos/products?warehouseId=${warehouseId}`)
        const data = await response.json()

        if (data.success && data.data?.products) {
          // Transform POS products data
          // IMPORTANTE: Usar basePrice (precio de la ficha) en lugar de price (precio calculado con pricelist)
          const productsList = data.data.products.map((item: {
            id: number
            name: string
            description: string | null
            sku: string
            barcode: string | null
            imageUrl: string | null
            basePrice: number
            price: number
            costPrice: number
            unit: string
            categoryName: string | null
            stock: number
            variants?: ProductVariant[]
          }) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            sku: item.sku,
            barcode: item.barcode,
            imageUrl: item.imageUrl,
            sellingPrice: item.basePrice, // Usar basePrice para etiquetas, no price
            costPrice: item.costPrice,
            unit: item.unit,
            category: item.categoryName,
            stock: item.stock,
            variants: item.variants
          }))
          setProducts(productsList)
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [warehouseId])

  // Filter products based on search term
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products

    const term = searchTerm.toLowerCase().trim()
    return products.filter(product =>
      (product.name && product.name.toLowerCase().includes(term)) ||
      (product.sku && product.sku.toLowerCase().includes(term)) ||
      (product.barcode && product.barcode.toLowerCase().includes(term)) ||
      (product.description && product.description.toLowerCase().includes(term))
    )
  }, [products, searchTerm])

  const handlePrintClick = (product: Product) => {
    setSelectedProduct(product)
    setShowPrintModal(true)
  }

  const handlePrintModalClose = () => {
    setShowPrintModal(false)
    setSelectedProduct(null)
  }

  const formatPriceCUP = (priceUSD: number) => {
    const rate = USD_CUP || 411
    return Math.round(priceUSD * rate)
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className={cn(
        'mb-6 p-4 rounded-xl border',
        theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer className="w-6 h-6 text-emerald-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Imprimir Etiquetas
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {warehouseName} - {products.length} productos
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, SKU o codigo de barras..."
            className={cn(
              'w-full pl-10 pr-4 py-3 rounded-lg border transition-colors',
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-emerald-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-emerald-500'
            )}
          />
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Cargando productos...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className={cn(
          'flex flex-col items-center justify-center py-20 rounded-xl border',
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        )}>
          <Package className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
            {searchTerm ? 'No se encontraron productos' : 'No hay productos en este almacen'}
          </p>
          {searchTerm && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Intenta con otro termino de busqueda
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  'rounded-xl border overflow-hidden transition-shadow hover:shadow-lg',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-white border-gray-200'
                )}
              >
                {/* Product Image */}
                <div className={cn(
                  'aspect-square relative',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                )}>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  {/* Stock Badge */}
                  <div className={cn(
                    'absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-medium',
                    product.stock > 0
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                  )}>
                    {product.stock} {product.unit}
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4">
                  {/* Name */}
                  <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1">
                    {product.name}
                  </h3>

                  {/* SKU */}
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <Tag className="w-3 h-3" />
                    <span className="font-mono">{product.sku}</span>
                  </div>

                  {/* Barcode */}
                  {product.barcode && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <Barcode className="w-3 h-3" />
                      <span className="font-mono">{product.barcode}</span>
                    </div>
                  )}

                  {/* Prices - visible con 2 decimales, interno con 4 */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={cn(
                      'px-2 py-1 rounded text-sm font-medium',
                      theme === 'dark'
                        ? 'bg-blue-900/30 text-blue-400'
                        : 'bg-blue-100 text-blue-700'
                    )}>
                      ${(Math.round(product.sellingPrice * 100) / 100).toFixed(2)}
                    </span>
                    <span className={cn(
                      'px-2 py-1 rounded text-sm font-medium',
                      theme === 'dark'
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-green-100 text-green-700'
                    )}>
                      ${formatPriceCUP(product.sellingPrice).toLocaleString()} CUP
                    </span>
                  </div>

                  {/* Description */}
                  {product.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                      {product.description}
                    </p>
                  )}

                  {/* Print Button */}
                  <button
                    onClick={() => handlePrintClick(product)}
                    className={cn(
                      'w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors',
                      'bg-gradient-to-r from-emerald-500 to-green-600 text-white',
                      'hover:from-emerald-600 hover:to-green-700'
                    )}
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Etiqueta
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Print Label Modal */}
      {selectedProduct && (
        <PrintLabelModal
          isOpen={showPrintModal}
          onClose={handlePrintModalClose}
          warehouseId={warehouseId}
          productData={{
            productName: selectedProduct.name,
            sku: selectedProduct.sku,
            barcode: selectedProduct.barcode || selectedProduct.sku,
            price: selectedProduct.sellingPrice,
            currency: 'USD',
            unitOfMeasure: selectedProduct.unit,
            category: selectedProduct.category || undefined,
            description: selectedProduct.description || undefined,
            variants: selectedProduct.variants?.map(v => ({
              id: v.id,
              name: v.name || v.sku || `Variante ${v.id}`,
              barcode: v.barcode || v.sku || '',
              sku: v.sku || '',
              price: v.price || selectedProduct.sellingPrice,
              imageUrl: v.imageUrl || null
            }))
          }}
          onPrintSuccess={() => {
            handlePrintModalClose()
          }}
        />
      )}
    </div>
  )
}
