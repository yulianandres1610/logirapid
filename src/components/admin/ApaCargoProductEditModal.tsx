'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Loader2,
  AlertCircle,
  Plane,
  Ship,
  Check,
  DollarSign,
  Save,
} from 'lucide-react'

interface ApaCargoProduct {
  id: number
  apacargoProductId: number
  originalName: string
  originalDescription: string | null
  customName: string
  customDescription: string | null
  supportsAir: boolean
  supportsSea: boolean
  miCosto: number
  precioMayorista: number
  precioPublico: number | null
  isActive: boolean
}

interface ApaCargoProductEditModalProps {
  product: ApaCargoProduct
  onClose: () => void
  onSaved: () => void
}

export function ApaCargoProductEditModal({
  product,
  onClose,
  onSaved,
}: ApaCargoProductEditModalProps) {
  const [customName, setCustomName] = useState(product.customName)
  const [customDescription, setCustomDescription] = useState(product.customDescription || '')
  const [supportsAir, setSupportsAir] = useState(product.supportsAir)
  const [supportsSea, setSupportsSea] = useState(product.supportsSea)
  const [miCosto, setMiCosto] = useState(product.miCosto.toString())
  const [precioMayorista, setPrecioMayorista] = useState(product.precioMayorista.toString())
  const [precioPublico, setPrecioPublico] = useState(product.precioPublico?.toString() || '')
  const [isActive, setIsActive] = useState(product.isActive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)

    // Validations
    if (!customName.trim()) {
      setError('El nombre del producto es requerido')
      return
    }

    if (!miCosto || parseFloat(miCosto) <= 0) {
      setError('Mi Costo debe ser mayor a 0')
      return
    }

    if (!precioMayorista || parseFloat(precioMayorista) <= 0) {
      setError('Precio Mayorista debe ser mayor a 0')
      return
    }

    if (parseFloat(precioMayorista) < parseFloat(miCosto)) {
      setError('Precio Mayorista no puede ser menor a Mi Costo')
      return
    }

    if (!supportsAir && !supportsSea) {
      setError('El producto debe soportar al menos un tipo de envio')
      return
    }

    try {
      setSaving(true)

      const response = await fetch(`/api/apacargo/shipping-products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customName: customName.trim(),
          customDescription: customDescription.trim() || null,
          supportsAir,
          supportsSea,
          miCosto: parseFloat(miCosto),
          precioMayorista: parseFloat(precioMayorista),
          precioPublico: precioPublico ? parseFloat(precioPublico) : null,
          isActive,
        }),
      })

      const data = await response.json()

      if (data.success) {
        onSaved()
      } else {
        setError(data.error || 'Error actualizando producto')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de conexion'
      setError(message)
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
        className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Editar Producto</h2>
            <p className="text-sm text-gray-400">
              ID ApaCargo: {product.apacargoProductId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Original Name (readonly) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Nombre Original (ApaCargo)
              </label>
              <input
                type="text"
                value={product.originalName}
                disabled
                className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Nombre Personalizado *
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nombre para mostrar a clientes"
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
                placeholder="Descripcion del producto..."
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Mayorista ($) *
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Publico ($)
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
              </div>
            </div>

            {/* Profit calculation */}
            {miCosto && precioMayorista && parseFloat(precioMayorista) > parseFloat(miCosto) && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-green-400 text-sm">Ganancia:</span>
                  <span className="text-green-400 font-semibold">
                    ${(parseFloat(precioMayorista) - parseFloat(miCosto)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Active toggle */}
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="text-white font-medium">Producto Activo</span>
                <p className="text-gray-400 text-sm">El producto sera visible para los clientes</p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isActive ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    isActive ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
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
                <Save className="w-4 h-4" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
