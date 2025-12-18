'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Save,
  Send,
  Package,
  DollarSign,
  Calendar,
  User,
  Phone,
  MapPin,
  X,
  FileText
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface Product {
  id: number
  name: string
  sku: string
  imageUrl: string | null
  costPrice: number
  sellingPrice: number
  quantityOnHand: number
  category: string
}

interface PurchaseLine {
  productId: number
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export default function CreatePurchasePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Form state
  const [supplierName, setSupplierName] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [supplierAddress, setSupplierAddress] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<PurchaseLine[]>([])

  // Product search modal
  const [showProductModal, setShowProductModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/market/products?limit=200')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setProducts(data.data.products)
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const addLine = (product: Product) => {
    if (editingLineIndex !== null) {
      // Replace existing line
      const newLines = [...lines]
      newLines[editingLineIndex] = {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: 1,
        unitPrice: product.costPrice,
        totalPrice: product.costPrice
      }
      setLines(newLines)
      setEditingLineIndex(null)
    } else {
      // Check if product already exists
      const existingIndex = lines.findIndex(l => l.productId === product.id)
      if (existingIndex >= 0) {
        const newLines = [...lines]
        newLines[existingIndex].quantity += 1
        newLines[existingIndex].totalPrice = newLines[existingIndex].quantity * newLines[existingIndex].unitPrice
        setLines(newLines)
      } else {
        setLines([...lines, {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: 1,
          unitPrice: product.costPrice,
          totalPrice: product.costPrice
        }])
      }
    }
    setShowProductModal(false)
    setProductSearch('')
  }

  const updateLine = (index: number, field: 'quantity' | 'unitPrice', value: number) => {
    const newLines = [...lines]
    newLines[index][field] = value
    newLines[index].totalPrice = newLines[index].quantity * newLines[index].unitPrice
    setLines(newLines)
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const subtotal = lines.reduce((sum, line) => sum + line.totalPrice, 0)
  const taxAmount = 0
  const total = subtotal + taxAmount

  const handleSave = async (confirm: boolean = false) => {
    if (!supplierName.trim()) {
      alert('El nombre del proveedor es requerido')
      return
    }

    if (lines.length === 0) {
      alert('Debe agregar al menos un producto')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/market/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName,
          supplierContact: supplierContact || null,
          supplierAddress: supplierAddress || null,
          purchaseDate,
          expectedDate: expectedDate || null,
          notes: notes || null,
          currency: 'USD',
          lines: lines.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice
          }))
        })
      })

      const data = await response.json()
      if (data.success) {
        if (confirm) {
          // Confirm the purchase immediately
          const confirmResponse = await fetch(`/api/market/purchases/${data.data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'confirm' })
          })
          const confirmData = await confirmResponse.json()
          if (confirmData.success) {
            router.push('/dashboard/market/purchases')
          } else {
            alert('Compra creada pero no se pudo confirmar')
            router.push('/dashboard/market/purchases')
          }
        } else {
          router.push('/dashboard/market/purchases')
        }
      } else {
        alert(data.error || 'Error al crear orden de compra')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al crear orden de compra')
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Nueva Orden de Compra
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  Crea una orden de compra a proveedor
                </p>
              </div>
            </div>
          </div>

          {/* Purchase Form - Invoice Style */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Header Section */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                    <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Orden de Compra</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      PUR-{new Date().getFullYear()}-XXXX
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Estado</p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300">
                    Borrador
                  </span>
                </div>
              </div>
            </div>

            {/* Supplier & Dates */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-200 dark:border-gray-700">
              {/* Supplier Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Proveedor
                </h3>
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <User className="w-4 h-4" />
                    Nombre del Proveedor *
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    placeholder="Distribuidora ABC"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Phone className="w-4 h-4" />
                    Contacto
                  </label>
                  <input
                    type="text"
                    value={supplierContact}
                    onChange={e => setSupplierContact(e.target.value)}
                    placeholder="+1 234 567 8900"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <MapPin className="w-4 h-4" />
                    Direccion
                  </label>
                  <input
                    type="text"
                    value={supplierAddress}
                    onChange={e => setSupplierAddress(e.target.value)}
                    placeholder="Calle 123, Ciudad"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Fechas
                </h3>
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Calendar className="w-4 h-4" />
                    Fecha de Compra
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Calendar className="w-4 h-4" />
                    Fecha Esperada de Entrega
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={e => setExpectedDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
                    Notas
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notas adicionales..."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Lines Section */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Lineas de Compra
                </h3>
                <button
                  onClick={() => {
                    setEditingLineIndex(null)
                    setShowProductModal(true)
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 dark:bg-green-700 text-white text-sm rounded-lg hover:opacity-90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Producto
                </button>
              </div>

              {/* Lines Table */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Producto
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">
                        Cantidad
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">
                        Precio Unit.
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">
                        Subtotal
                      </th>
                      <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No hay productos agregados</p>
                          <button
                            onClick={() => setShowProductModal(true)}
                            className="mt-2 text-green-600 dark:text-green-400 hover:underline text-sm"
                          >
                            Agregar primer producto
                          </button>
                        </td>
                      </tr>
                    ) : (
                      lines.map((line, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setEditingLineIndex(index)
                                setShowProductModal(true)
                              }}
                              className="text-left hover:text-green-600 dark:hover:text-green-400 transition-colors"
                            >
                              <p className="font-medium text-gray-900 dark:text-white">
                                {line.productName}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {line.productSku}
                              </p>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={e => updateLine(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              min={1}
                              className="w-full px-2 py-1.5 text-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative">
                              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="number"
                                value={line.unitPrice}
                                onChange={e => updateLine(index, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                min={0}
                                step={0.01}
                                className="w-full pl-7 pr-2 py-1.5 text-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              ${line.totalPrice.toFixed(2)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => removeLine(index)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              {lines.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <div className="w-72 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                      <span className="font-medium text-gray-900 dark:text-white">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Impuesto (0%):</span>
                      <span className="font-medium text-gray-900 dark:text-white">${taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-semibold text-gray-900 dark:text-white">Total:</span>
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-end gap-3">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                <Save className="w-4 h-4" />
                Guardar Borrador
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={loading || lines.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Confirmar Compra
              </button>
            </div>
          </motion.div>

          {/* Product Search Modal */}
          <AnimatePresence>
            {showProductModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowProductModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                >
                  <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Seleccionar Producto
                    </h3>
                    <button
                      onClick={() => setShowProductModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        placeholder="Buscar por nombre o SKU..."
                        autoFocus
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {loadingProducts ? (
                      <div className="py-8 text-center text-gray-500">
                        Cargando productos...
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="py-8 text-center text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No se encontraron productos</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredProducts.map(product => (
                          <button
                            key={product.id}
                            onClick={() => addLine(product)}
                            className="w-full p-4 flex items-center gap-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left border border-transparent hover:border-green-200 dark:hover:border-green-800"
                          >
                            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                <Package className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {product.name}
                              </p>
                              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                <span>{product.sku}</span>
                                {product.category && (
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                                    {product.category}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-green-600 dark:text-green-400">
                                ${product.costPrice.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Stock: {product.quantityOnHand}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
