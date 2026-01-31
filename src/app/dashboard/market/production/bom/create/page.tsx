'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Plus,
  Trash2,
  Search,
  Package,
  Loader2,
  Check,
  X,
  ChevronDown,
  Percent,
  Calculator,
  Boxes,
  Target,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  costPrice: number
  sellingPrice: number
  imageUrl: string | null
  unitOfMeasure: string
  hasVariants: boolean
  variants?: ProductVariant[]
}

interface ProductVariant {
  id: number
  variantName: string
  sku: string
  costPrice: number
  sellingPrice: number
}

interface BOMLine {
  id: string
  productId: number | null
  variantId: number | null
  productName: string
  productSku: string
  productImage: string | null
  productCostPrice: number
  quantityRequired: number
  unit: string
  isPrimary: boolean
  lineCost: number
}

const UNITS = [
  { value: 'unidad', label: 'Unidad', abbr: 'ud' },
  { value: 'kg', label: 'Kilogramo', abbr: 'kg' },
  { value: 'g', label: 'Gramo', abbr: 'g' },
  { value: 'lb', label: 'Libra', abbr: 'lb' },
  { value: 'lt', label: 'Litro', abbr: 'lt' },
  { value: 'ml', label: 'Mililitro', abbr: 'ml' }
]

export default function CreateBOMPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [saving, setSaving] = useState(false)
  const outputSearchRef = useRef<HTMLInputElement>(null)
  const materialSearchRef = useRef<HTMLInputElement>(null)

  // Form state
  const [bomName, setBomName] = useState('')
  const [outputProduct, setOutputProduct] = useState<Product | null>(null)
  const [outputVariant, setOutputVariant] = useState<ProductVariant | null>(null)
  const [outputQuantity, setOutputQuantity] = useState<number>(1)
  const [outputUnit, setOutputUnit] = useState('unidad')
  const [expectedWastePercent, setExpectedWastePercent] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<BOMLine[]>([])

  // Product search state
  const [productSearchOutput, setProductSearchOutput] = useState('')
  const [productSearchLine, setProductSearchLine] = useState('')
  const [searchResultsOutput, setSearchResultsOutput] = useState<Product[]>([])
  const [searchResultsLine, setSearchResultsLine] = useState<Product[]>([])
  const [searchingOutput, setSearchingOutput] = useState(false)
  const [searchingLine, setSearchingLine] = useState(false)
  const [showOutputDropdown, setShowOutputDropdown] = useState(false)
  const [showLineDropdown, setShowLineDropdown] = useState(false)

  // Calculate totals
  const totalMaterialCost = lines.reduce((sum, line) => sum + line.lineCost, 0)
  const unitCost = outputQuantity > 0 ? totalMaterialCost / outputQuantity : 0
  const wasteAmount = (totalMaterialCost * expectedWastePercent) / 100
  const effectiveUnitCost = outputQuantity > 0 ? (totalMaterialCost + wasteAmount) / outputQuantity : 0

  // Search products
  const searchProducts = async (term: string, forOutput: boolean) => {
    if (term.length < 2) {
      if (forOutput) setSearchResultsOutput([])
      else setSearchResultsLine([])
      return
    }

    try {
      if (forOutput) setSearchingOutput(true)
      else setSearchingLine(true)

      const response = await fetch(`/api/market/products?search=${encodeURIComponent(term)}&limit=10`)
      const data = await response.json()

      if (data.success) {
        // Map the response to match our Product interface
        const products = (data.data.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          costPrice: p.costPrice || 0,
          sellingPrice: p.sellingPrice || 0,
          imageUrl: p.imageUrl,
          unitOfMeasure: p.unitOfMeasure || 'unidad',
          hasVariants: p.hasVariants || false,
          variants: p.variants?.map((v: any) => ({
            id: v.id,
            variantName: v.name,
            sku: v.sku,
            costPrice: v.costPrice || 0,
            sellingPrice: v.price || 0
          }))
        }))

        if (forOutput) setSearchResultsOutput(products)
        else setSearchResultsLine(products)
      }
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      if (forOutput) setSearchingOutput(false)
      else setSearchingLine(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearchOutput) searchProducts(productSearchOutput, true)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearchOutput])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearchLine) searchProducts(productSearchLine, false)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearchLine])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (outputSearchRef.current && !outputSearchRef.current.contains(e.target as Node)) {
        setShowOutputDropdown(false)
      }
      if (materialSearchRef.current && !materialSearchRef.current.contains(e.target as Node)) {
        setShowLineDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectOutputProduct = (product: Product, variant?: ProductVariant) => {
    setOutputProduct(product)
    setOutputVariant(variant || null)
    setOutputUnit(product.unitOfMeasure || 'unidad')
    setProductSearchOutput('')
    setSearchResultsOutput([])
    setShowOutputDropdown(false)

    if (!bomName) {
      setBomName(`Producción de ${variant?.variantName || product.name}`)
    }
  }

  const addMaterialLine = (product: Product, variant?: ProductVariant) => {
    const costPrice = variant?.costPrice || product.costPrice || 0
    const newLine: BOMLine = {
      id: `line-${Date.now()}`,
      productId: product.id,
      variantId: variant?.id || null,
      productName: variant ? `${product.name} - ${variant.variantName}` : product.name,
      productSku: variant?.sku || product.sku,
      productImage: product.imageUrl,
      productCostPrice: costPrice,
      quantityRequired: 1,
      unit: product.unitOfMeasure || 'unidad',
      isPrimary: lines.length === 0,
      lineCost: costPrice
    }

    setLines([...lines, newLine])
    setProductSearchLine('')
    setSearchResultsLine([])
    setShowLineDropdown(false)
  }

  const updateLine = (index: number, field: keyof BOMLine, value: any) => {
    const updatedLines = [...lines]
    updatedLines[index] = {
      ...updatedLines[index],
      [field]: value
    }

    if (field === 'quantityRequired') {
      updatedLines[index].lineCost = updatedLines[index].productCostPrice * value
    }

    setLines(updatedLines)
  }

  const removeLine = (index: number) => {
    const updatedLines = lines.filter((_, i) => i !== index)
    if (lines[index].isPrimary && updatedLines.length > 0) {
      updatedLines[0].isPrimary = true
    }
    setLines(updatedLines)
  }

  const setPrimaryLine = (index: number) => {
    const updatedLines = lines.map((line, i) => ({
      ...line,
      isPrimary: i === index
    }))
    setLines(updatedLines)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!outputProduct) {
      alert('Seleccione el producto a fabricar')
      return
    }

    if (!bomName.trim()) {
      alert('Ingrese un nombre para la receta')
      return
    }

    if (outputQuantity <= 0) {
      alert('La cantidad a producir debe ser mayor a 0')
      return
    }

    if (lines.length === 0) {
      alert('Agregue al menos una materia prima')
      return
    }

    try {
      setSaving(true)

      const response = await fetch('/api/market/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: outputProduct.id,
          variantId: outputVariant?.id || null,
          bomName: bomName.trim(),
          outputQuantity,
          outputUnit,
          expectedWastePercent,
          notes: notes.trim() || null,
          lines: lines.map(line => ({
            productId: line.productId,
            variantId: line.variantId,
            quantityRequired: line.quantityRequired,
            unit: line.unit,
            isPrimary: line.isPrimary
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push('/dashboard/market/production/bom')
      } else {
        alert(data.error || 'Error al crear receta')
      }
    } catch (error) {
      console.error('Error creating BOM:', error)
      alert('Error al crear receta')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount)
  }

  const canSave = outputProduct && bomName.trim() && outputQuantity > 0 && lines.length > 0

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL']}>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl mx-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard/market/production/bom"
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    theme === 'dark'
                      ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Nueva Receta
                  </h1>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}>
                    Define los materiales para fabricar un producto
                  </p>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving || !canSave}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all",
                  canSave
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {saving ? 'Guardando...' : 'Guardar Receta'}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Output Product */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  "p-6 rounded-2xl border shadow-xl",
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500 text-white text-sm font-bold">
                    1
                  </div>
                  <div>
                    <h2 className={cn(
                      "font-semibold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Producto a Fabricar
                    </h2>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Selecciona el producto final que vas a producir
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Product Search */}
                  <div className="space-y-4">
                    {outputProduct ? (
                      <div className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border-2 border-purple-500/50",
                        theme === 'dark' ? 'bg-purple-900/20' : 'bg-purple-50'
                      )}>
                        {outputProduct.imageUrl ? (
                          <img
                            src={outputProduct.imageUrl}
                            alt=""
                            className="w-16 h-16 rounded-xl object-cover"
                          />
                        ) : (
                          <div className={cn(
                            "w-16 h-16 rounded-xl flex items-center justify-center",
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          )}>
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-semibold truncate",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {outputVariant ? `${outputProduct.name} - ${outputVariant.variantName}` : outputProduct.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            SKU: {outputVariant?.sku || outputProduct.sku}
                          </p>
                          <p className="text-sm text-purple-500 font-medium">
                            {formatCurrency(outputVariant?.costPrice || outputProduct.costPrice)} costo actual
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setOutputProduct(null)
                            setOutputVariant(null)
                          }}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div ref={outputSearchRef} className="relative">
                        <div className="relative">
                          <Search className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )} />
                          <input
                            type="text"
                            value={productSearchOutput}
                            onChange={(e) => {
                              setProductSearchOutput(e.target.value)
                              setShowOutputDropdown(true)
                            }}
                            onFocus={() => setShowOutputDropdown(true)}
                            placeholder="Buscar producto por nombre o SKU..."
                            className={cn(
                              "w-full pl-12 pr-4 py-4 rounded-xl border-2 transition-all text-lg",
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-purple-500'
                                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500'
                            )}
                          />
                          {searchingOutput && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-purple-500" />
                          )}
                        </div>

                        <AnimatePresence>
                          {showOutputDropdown && searchResultsOutput.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className={cn(
                                "absolute z-50 w-full mt-2 max-h-80 overflow-auto rounded-xl border shadow-2xl",
                                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                              )}
                            >
                              {searchResultsOutput.map((product) => (
                                <div key={product.id}>
                                  {product.hasVariants && product.variants ? (
                                    product.variants.map((variant) => (
                                      <button
                                        key={variant.id}
                                        type="button"
                                        onClick={() => selectOutputProduct(product, variant)}
                                        className={cn(
                                          "w-full flex items-center gap-4 p-4 text-left transition-colors",
                                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                        )}
                                      >
                                        {product.imageUrl ? (
                                          <img src={product.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                        ) : (
                                          <div className={cn(
                                            "w-12 h-12 rounded-lg flex items-center justify-center",
                                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                          )}>
                                            <Package className="w-6 h-6 text-gray-400" />
                                          </div>
                                        )}
                                        <div className="flex-1">
                                          <p className={cn(
                                            "font-medium",
                                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                                          )}>
                                            {product.name} - {variant.variantName}
                                          </p>
                                          <p className="text-sm text-gray-500">
                                            {variant.sku} &bull; {formatCurrency(variant.costPrice)}
                                          </p>
                                        </div>
                                      </button>
                                    ))
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => selectOutputProduct(product)}
                                      className={cn(
                                        "w-full flex items-center gap-4 p-4 text-left transition-colors",
                                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                      )}
                                    >
                                      {product.imageUrl ? (
                                        <img src={product.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                      ) : (
                                        <div className={cn(
                                          "w-12 h-12 rounded-lg flex items-center justify-center",
                                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                        )}>
                                          <Package className="w-6 h-6 text-gray-400" />
                                        </div>
                                      )}
                                      <div className="flex-1">
                                        <p className={cn(
                                          "font-medium",
                                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        )}>
                                          {product.name}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          {product.sku} &bull; {formatCurrency(product.costPrice)}
                                        </p>
                                      </div>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Recipe Name */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Nombre de la receta
                      </label>
                      <input
                        type="text"
                        value={bomName}
                        onChange={(e) => setBomName(e.target.value)}
                        placeholder="Ej: Empaque de Frijoles 3kg"
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border transition-all",
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-600 text-white focus:border-purple-500'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500'
                        )}
                      />
                    </div>
                  </div>

                  {/* Production Settings */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Cantidad producida
                        </label>
                        <input
                          type="number"
                          value={outputQuantity}
                          onChange={(e) => setOutputQuantity(parseFloat(e.target.value) || 0)}
                          min="0.001"
                          step="0.001"
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border transition-all text-center text-lg font-bold",
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white focus:border-purple-500'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500'
                          )}
                        />
                      </div>
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Unidad
                        </label>
                        <select
                          value={outputUnit}
                          onChange={(e) => setOutputUnit(e.target.value)}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border transition-all",
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white focus:border-purple-500'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500'
                          )}
                        >
                          {UNITS.map((u) => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4" />
                          Merma esperada
                        </div>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={expectedWastePercent}
                          onChange={(e) => setExpectedWastePercent(parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          step="0.1"
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border transition-all pr-12",
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white focus:border-purple-500'
                              : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500'
                          )}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                      </div>
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Notas (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        placeholder="Instrucciones adicionales..."
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border transition-all resize-none",
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-600 text-white focus:border-purple-500'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500'
                        )}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Step 2: Materials */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "p-6 rounded-2xl border shadow-xl",
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
                )}
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500 text-white text-sm font-bold">
                      2
                    </div>
                    <div>
                      <h2 className={cn(
                        "font-semibold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        Materias Primas
                      </h2>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Agrega los ingredientes o materiales necesarios
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-sm font-medium px-3 py-1 rounded-full",
                    lines.length > 0
                      ? 'bg-blue-500/20 text-blue-500'
                      : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                  )}>
                    {lines.length} material{lines.length !== 1 ? 'es' : ''}
                  </span>
                </div>

                {/* Add Material Search */}
                <div ref={materialSearchRef} className="relative mb-4">
                  <div className="relative">
                    <Plus className={cn(
                      "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )} />
                    <input
                      type="text"
                      value={productSearchLine}
                      onChange={(e) => {
                        setProductSearchLine(e.target.value)
                        setShowLineDropdown(true)
                      }}
                      onFocus={() => setShowLineDropdown(true)}
                      placeholder="Agregar materia prima..."
                      className={cn(
                        "w-full pl-12 pr-4 py-3 rounded-xl border-2 border-dashed transition-all",
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:bg-gray-800'
                          : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'
                      )}
                    />
                    {searchingLine && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />
                    )}
                  </div>

                  <AnimatePresence>
                    {showLineDropdown && searchResultsLine.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                          "absolute z-50 w-full mt-2 max-h-64 overflow-auto rounded-xl border shadow-2xl",
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}
                      >
                        {searchResultsLine.map((product) => (
                          <div key={product.id}>
                            {product.hasVariants && product.variants ? (
                              product.variants.map((variant) => (
                                <button
                                  key={variant.id}
                                  type="button"
                                  onClick={() => addMaterialLine(product, variant)}
                                  className={cn(
                                    "w-full flex items-center gap-3 p-3 text-left transition-colors",
                                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                  )}
                                >
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      "font-medium truncate",
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {product.name} - {variant.variantName}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {formatCurrency(variant.costPrice)}
                                    </p>
                                  </div>
                                  <Plus className="w-5 h-5 text-blue-500" />
                                </button>
                              ))
                            ) : (
                              <button
                                type="button"
                                onClick={() => addMaterialLine(product)}
                                className={cn(
                                  "w-full flex items-center gap-3 p-3 text-left transition-colors",
                                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                )}
                              >
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                ) : (
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "font-medium truncate",
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatCurrency(product.costPrice)}
                                  </p>
                                </div>
                                <Plus className="w-5 h-5 text-blue-500" />
                              </button>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Materials List */}
                {lines.length === 0 ? (
                  <div className={cn(
                    "text-center py-12 border-2 border-dashed rounded-xl",
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <Boxes className={cn(
                      "w-12 h-12 mx-auto mb-3",
                      theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                    )} />
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      Busca y agrega las materias primas necesarias
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {lines.map((line, index) => (
                        <motion.div
                          key={line.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl transition-all",
                            line.isPrimary
                              ? theme === 'dark'
                                ? 'bg-purple-900/30 border border-purple-700/50'
                                : 'bg-purple-50 border border-purple-200'
                              : theme === 'dark'
                                ? 'bg-gray-800/50 border border-gray-700'
                                : 'bg-gray-50 border border-gray-200'
                          )}
                        >
                          {/* Primary indicator */}
                          <button
                            type="button"
                            onClick={() => setPrimaryLine(index)}
                            className={cn(
                              "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                              line.isPrimary
                                ? 'border-purple-500 bg-purple-500 text-white'
                                : theme === 'dark'
                                  ? 'border-gray-600 hover:border-purple-500'
                                  : 'border-gray-300 hover:border-purple-500'
                            )}
                            title={line.isPrimary ? 'Material principal' : 'Marcar como principal'}
                          >
                            {line.isPrimary && <Check className="w-3 h-3" />}
                          </button>

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "font-medium text-sm truncate",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {line.productName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(line.productCostPrice)} / {line.unit}
                            </p>
                          </div>

                          {/* Quantity input */}
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={line.quantityRequired}
                              onChange={(e) => updateLine(index, 'quantityRequired', parseFloat(e.target.value) || 0)}
                              min="0.001"
                              step="0.001"
                              className={cn(
                                "w-20 px-2 py-1.5 rounded-lg border text-sm text-center font-medium",
                                theme === 'dark'
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              )}
                            />
                            <select
                              value={line.unit}
                              onChange={(e) => updateLine(index, 'unit', e.target.value)}
                              className={cn(
                                "px-2 py-1.5 rounded-lg border text-sm",
                                theme === 'dark'
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              )}
                            >
                              {UNITS.map((u) => (
                                <option key={u.value} value={u.value}>{u.abbr}</option>
                              ))}
                            </select>
                          </div>

                          {/* Line cost */}
                          <div className="w-24 text-right">
                            <p className={cn(
                              "font-bold text-sm",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {formatCurrency(line.lineCost)}
                            </p>
                          </div>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="flex-shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>

              {/* Step 3: Cost Summary */}
              {lines.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    "p-6 rounded-2xl border shadow-xl",
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-emerald-900/30 to-gray-900 border-emerald-700/50'
                      : 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'
                  )}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500 text-white text-sm font-bold">
                      3
                    </div>
                    <div>
                      <h2 className={cn(
                        "font-semibold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        Resumen de Costos
                      </h2>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Costo calculado por unidad producida
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className={cn(
                      "p-4 rounded-xl",
                      theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/80'
                    )}>
                      <p className="text-xs text-gray-500 mb-1">Total materiales</p>
                      <p className={cn(
                        "text-xl font-bold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {formatCurrency(totalMaterialCost)}
                      </p>
                    </div>

                    {expectedWastePercent > 0 && (
                      <div className={cn(
                        "p-4 rounded-xl",
                        theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-50'
                      )}>
                        <p className="text-xs text-amber-600 mb-1">Merma ({expectedWastePercent}%)</p>
                        <p className="text-xl font-bold text-amber-600">
                          +{formatCurrency(wasteAmount)}
                        </p>
                      </div>
                    )}

                    <div className={cn(
                      "p-4 rounded-xl",
                      theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/80'
                    )}>
                      <p className="text-xs text-gray-500 mb-1">Producción</p>
                      <p className={cn(
                        "text-xl font-bold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {outputQuantity} {UNITS.find(u => u.value === outputUnit)?.abbr || outputUnit}
                      </p>
                    </div>

                    <div className={cn(
                      "p-4 rounded-xl border-2",
                      theme === 'dark'
                        ? 'bg-emerald-900/30 border-emerald-500/50'
                        : 'bg-emerald-50 border-emerald-300'
                    )}>
                      <p className="text-xs text-emerald-600 mb-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Costo por unidad
                      </p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(expectedWastePercent > 0 ? effectiveUnitCost : unitCost)}
                      </p>
                    </div>
                  </div>

                  {outputProduct && (
                    <div className={cn(
                      "mt-4 p-3 rounded-lg text-sm",
                      theme === 'dark' ? 'bg-gray-800/50 text-gray-400' : 'bg-white/50 text-gray-600'
                    )}>
                      <Calculator className="w-4 h-4 inline mr-2" />
                      {formatCurrency(totalMaterialCost + wasteAmount)} / {outputQuantity} {UNITS.find(u => u.value === outputUnit)?.abbr} = <strong className="text-emerald-500">{formatCurrency(expectedWastePercent > 0 ? effectiveUnitCost : unitCost)}</strong> por {UNITS.find(u => u.value === outputUnit)?.abbr}
                    </div>
                  )}
                </motion.div>
              )}
            </form>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
