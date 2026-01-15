'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  Loader2,
  AlertCircle,
  Package,
  Plane,
  Ship,
  Check,
  DollarSign,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'

interface AvailableProduct {
  id: number
  name: string
  description: string
  code: string
  price: number
  weight: number
  dimensions: string
}

interface ApaCargoProductSelectorProps {
  onClose: () => void
  onProductCreated: () => void
}

export function ApaCargoProductSelector({ onClose, onProductCreated }: ApaCargoProductSelectorProps) {
  const [step, setStep] = useState<'select' | 'configure'>('select')
  const [products, setProducts] = useState<AvailableProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<AvailableProduct | null>(null)

  // Configuration form
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [supportsAir, setSupportsAir] = useState(true)
  const [supportsSea, setSupportsSea] = useState(true)
  const [miCosto, setMiCosto] = useState('')
  const [precioMayorista, setPrecioMayorista] = useState('')
  const [precioPublico, setPrecioPublico] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchAvailableProducts()
  }, [])

  const fetchAvailableProducts = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/apacargo/shipping-products/available')
      const data = await response.json()

      if (data.success) {
        setProducts(data.data.products)
      } else {
        setError(data.error || 'Error cargando productos')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de conexion'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectProduct = (product: AvailableProduct) => {
    setSelectedProduct(product)
    setCustomName(product.name)
    setCustomDescription(product.description || '')
    setStep('configure')
  }

  const handleBackToSelect = () => {
    setStep('select')
    setSelectedProduct(null)
    setFormError(null)
  }

  const handleSave = async () => {
    setFormError(null)

    // Validations
    if (!customName.trim()) {
      setFormError('El nombre del producto es requerido')
      return
    }

    if (!miCosto || parseFloat(miCosto) <= 0) {
      setFormError('Mi Costo debe ser mayor a 0')
      return
    }

    if (!precioMayorista || parseFloat(precioMayorista) <= 0) {
      setFormError('Precio Mayorista debe ser mayor a 0')
      return
    }

    if (parseFloat(precioMayorista) < parseFloat(miCosto)) {
      setFormError('Precio Mayorista no puede ser menor a Mi Costo')
      return
    }

    if (!supportsAir && !supportsSea) {
      setFormError('El producto debe soportar al menos un tipo de envio')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/apacargo/shipping-products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apacargoProductId: selectedProduct!.id,
          originalName: selectedProduct!.name,
          originalDescription: selectedProduct!.description || null,
          customName: customName.trim(),
          customDescription: customDescription.trim() || null,
          supportsAir,
          supportsSea,
          miCosto: parseFloat(miCosto),
          precioMayorista: parseFloat(precioMayorista),
          precioPublico: precioPublico ? parseFloat(precioPublico) : null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        onProductCreated()
      } else {
        setFormError(data.error || 'Error creando producto')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de conexion'
      setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            {step === 'configure' && (
              <button
                onClick={handleBackToSelect}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">
                {step === 'select' ? 'Seleccionar Producto' : 'Configurar Producto'}
              </h2>
              <p className="text-sm text-gray-400">
                {step === 'select'
                  ? 'Selecciona un producto de ApaCargo para agregar'
                  : `Configura "${selectedProduct?.name}"`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6"
              >
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-exa-primary"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-3 p-4 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Loading */}
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-exa-primary animate-spin" />
                  </div>
                )}

                {/* Products List */}
                {!loading && filteredProducts.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">
                      {searchTerm
                        ? 'No se encontraron productos'
                        : 'No hay productos disponibles'
                      }
                    </p>
                  </div>
                )}

                {!loading && filteredProducts.length > 0 && (
                  <div className="space-y-2">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className="w-full flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-exa-primary/50 hover:bg-gray-800 transition-colors text-left group"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate">
                            {product.name}
                          </h3>
                          {product.description && (
                            <p className="text-gray-400 text-sm mt-1 truncate">
                              {product.description}
                            </p>
                          )}
                          <span className="text-xs text-gray-500 mt-1 inline-block">
                            ID: {product.id}
                          </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-exa-primary transition-colors ml-3 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {step === 'configure' && selectedProduct && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6"
              >
                {/* Form Error */}
                {formError && (
                  <div className="flex items-center gap-3 p-4 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ej: Caja Mediana Cuba"
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-exa-primary"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Descripcion
                    </label>
                    <textarea
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      placeholder="Descripcion del producto para tus clientes..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-exa-primary resize-none"
                    />
                  </div>

                  {/* Shipping Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tipo de Envio *
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          onClick={() => setSupportsAir(!supportsAir)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                            supportsAir
                              ? 'bg-blue-500 border-blue-500'
                              : 'bg-transparent border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          {supportsAir && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-white flex items-center gap-1.5">
                          <Plane className="w-4 h-4 text-blue-400" />
                          Aereo
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          onClick={() => setSupportsSea(!supportsSea)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                            supportsSea
                              ? 'bg-cyan-500 border-cyan-500'
                              : 'bg-transparent border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          {supportsSea && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-white flex items-center gap-1.5">
                          <Ship className="w-4 h-4 text-cyan-400" />
                          Maritimo
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Prices */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Mi Costo ($) *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={miCosto}
                          onChange={(e) => setMiCosto(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-exa-primary"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Tu costo real</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Precio Mayorista ($) *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={precioMayorista}
                          onChange={(e) => setPrecioMayorista(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-exa-primary"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Precio para agencias</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Precio Publico ($)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={precioPublico}
                          onChange={(e) => setPrecioPublico(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-exa-primary"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Opcional</p>
                    </div>
                  </div>

                  {/* Profit calculation */}
                  {miCosto && precioMayorista && parseFloat(precioMayorista) > parseFloat(miCosto) && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-green-400 text-sm">Ganancia por producto:</span>
                        <span className="text-green-400 font-semibold">
                          ${(parseFloat(precioMayorista) - parseFloat(miCosto)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                  <button
                    onClick={onClose}
                    disabled={saving}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-exa-primary hover:bg-exa-primary/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Agregar Producto
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
