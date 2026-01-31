'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Search,
  Package,
  Loader2,
  DollarSign,
  AlertCircle,
  Check,
  X
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
  productCostPrice: number
  quantityRequired: number
  unit: string
  isPrimary: boolean
  lineCost: number
}

export default function CreateBOMPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [saving, setSaving] = useState(false)

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
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null)

  // Calculate totals
  const totalMaterialCost = lines.reduce((sum, line) => sum + line.lineCost, 0)
  const unitCost = outputQuantity > 0 ? totalMaterialCost / outputQuantity : 0

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

      const response = await fetch(`/api/market/products/match?term=${encodeURIComponent(term)}&limit=10`)
      const data = await response.json()

      if (data.success) {
        if (forOutput) setSearchResultsOutput(data.data.products || [])
        else setSearchResultsLine(data.data.products || [])
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

    // Recalculate line cost
    if (field === 'quantityRequired') {
      updatedLines[index].lineCost = updatedLines[index].productCostPrice * value
    }

    setLines(updatedLines)
  }

  const removeLine = (index: number) => {
    const updatedLines = lines.filter((_, i) => i !== index)
    // If removed line was primary and there are still lines, make first one primary
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
      minimumFractionDigits: 2
    }).format(amount)
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL']}>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-6",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/dashboard/market/production/bom"
              className={cn(
                "p-2 rounded-lg transition-all",
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className={cn(
                "text-2xl font-bold flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <BookOpen className="w-7 h-7 text-purple-500" />
                Nueva Receta de Producción
              </h1>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Define los materiales necesarios para fabricar un producto
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Basic Info */}
                <div className={cn(
                  "p-6 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
                )}>
                  <h2 className={cn(
                    "font-semibold mb-4",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Información básica
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Nombre de la receta *
                      </label>
                      <input
                        type="text"
                        value={bomName}
                        onChange={(e) => setBomName(e.target.value)}
                        placeholder="Ej: Empaque Frijoles 3kg"
                        className={cn(
                          "w-full px-4 py-2 rounded-lg border transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                        required
                      />
                    </div>

                    {/* Output Product Search */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Producto a fabricar *
                      </label>
                      {outputProduct ? (
                        <div className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                        )}>
                          <div className="flex items-center gap-3">
                            {outputProduct.imageUrl ? (
                              <img src={outputProduct.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            ) : (
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                              )}>
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className={cn(
                                "font-medium",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {outputVariant ? `${outputProduct.name} - ${outputVariant.variantName}` : outputProduct.name}
                              </p>
                              <p className={cn(
                                "text-sm",
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                {outputVariant?.sku || outputProduct.sku}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setOutputProduct(null)
                              setOutputVariant(null)
                            }}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="relative">
                            <Search className={cn(
                              "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
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
                              placeholder="Buscar producto por nombre, SKU o código de barras..."
                              className={cn(
                                "w-full pl-10 pr-4 py-2 rounded-lg border transition-all",
                                theme === 'dark'
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-gray-50 border-gray-200 text-gray-900'
                              )}
                            />
                            {searchingOutput && (
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                            )}
                          </div>

                          {showOutputDropdown && searchResultsOutput.length > 0 && (
                            <div className={cn(
                              "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-lg border shadow-lg",
                              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                            )}>
                              {searchResultsOutput.map((product) => (
                                <div key={product.id}>
                                  {product.hasVariants && product.variants ? (
                                    product.variants.map((variant) => (
                                      <button
                                        key={variant.id}
                                        type="button"
                                        onClick={() => selectOutputProduct(product, variant)}
                                        className={cn(
                                          "w-full flex items-center gap-3 p-3 text-left transition-colors",
                                          theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                        )}
                                      >
                                        <Package className="w-8 h-8 text-gray-400" />
                                        <div>
                                          <p className={cn(
                                            "font-medium",
                                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                                          )}>
                                            {product.name} - {variant.variantName}
                                          </p>
                                          <p className={cn(
                                            "text-sm",
                                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                          )}>
                                            {variant.sku} • {formatCurrency(variant.costPrice)}
                                          </p>
                                        </div>
                                      </button>
                                    ))
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => selectOutputProduct(product)}
                                      className={cn(
                                        "w-full flex items-center gap-3 p-3 text-left transition-colors",
                                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                      )}
                                    >
                                      {product.imageUrl ? (
                                        <img src={product.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                                      ) : (
                                        <Package className="w-8 h-8 text-gray-400" />
                                      )}
                                      <div>
                                        <p className={cn(
                                          "font-medium",
                                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        )}>
                                          {product.name}
                                        </p>
                                        <p className={cn(
                                          "text-sm",
                                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                        )}>
                                          {product.sku} • {formatCurrency(product.costPrice)}
                                        </p>
                                      </div>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-1",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Cantidad producida *
                        </label>
                        <input
                          type="number"
                          value={outputQuantity}
                          onChange={(e) => setOutputQuantity(parseFloat(e.target.value) || 0)}
                          min="0.001"
                          step="0.001"
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border transition-all",
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-900'
                          )}
                          required
                        />
                      </div>
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-1",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Unidad
                        </label>
                        <select
                          value={outputUnit}
                          onChange={(e) => setOutputUnit(e.target.value)}
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border transition-all",
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-900'
                          )}
                        >
                          <option value="unidad">Unidad</option>
                          <option value="kg">Kilogramo</option>
                          <option value="g">Gramo</option>
                          <option value="lb">Libra</option>
                          <option value="lt">Litro</option>
                          <option value="ml">Mililitro</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Merma esperada (%)
                      </label>
                      <input
                        type="number"
                        value={expectedWastePercent}
                        onChange={(e) => setExpectedWastePercent(parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        step="0.1"
                        className={cn(
                          "w-full px-4 py-2 rounded-lg border transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-1",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Notas
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Instrucciones o notas adicionales..."
                        className={cn(
                          "w-full px-4 py-2 rounded-lg border transition-all resize-none",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Materials */}
                <div className={cn(
                  "p-6 rounded-xl",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
                )}>
                  <h2 className={cn(
                    "font-semibold mb-4",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Materias primas necesarias
                  </h2>

                  {/* Add Material */}
                  <div className="mb-4 relative">
                    <div className="relative">
                      <Search className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
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
                          "w-full pl-10 pr-4 py-2 rounded-lg border transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                      />
                      {searchingLine && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                      )}
                    </div>

                    {showLineDropdown && searchResultsLine.length > 0 && (
                      <div className={cn(
                        "absolute z-10 w-full mt-1 max-h-60 overflow-auto rounded-lg border shadow-lg",
                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      )}>
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
                                  <Package className="w-8 h-8 text-gray-400" />
                                  <div>
                                    <p className={cn(
                                      "font-medium",
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {product.name} - {variant.variantName}
                                    </p>
                                    <p className={cn(
                                      "text-sm",
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                    )}>
                                      {variant.sku} • {formatCurrency(variant.costPrice)}
                                    </p>
                                  </div>
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
                                  <img src={product.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                                ) : (
                                  <Package className="w-8 h-8 text-gray-400" />
                                )}
                                <div>
                                  <p className={cn(
                                    "font-medium",
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {product.name}
                                  </p>
                                  <p className={cn(
                                    "text-sm",
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                  )}>
                                    {product.sku} • {formatCurrency(product.costPrice)}
                                  </p>
                                </div>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lines Table */}
                  {lines.length === 0 ? (
                    <div className={cn(
                      "text-center py-8 border-2 border-dashed rounded-lg",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <Package className={cn(
                        "w-12 h-12 mx-auto mb-2",
                        theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                      )} />
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                      )}>
                        Agregue las materias primas necesarias
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lines.map((line, index) => (
                        <motion.div
                          key={line.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "flex items-center gap-4 p-3 rounded-lg border",
                            line.isPrimary
                              ? theme === 'dark' ? 'bg-purple-900/20 border-purple-700' : 'bg-purple-50 border-purple-200'
                              : theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setPrimaryLine(index)}
                            className={cn(
                              "p-1 rounded transition-all",
                              line.isPrimary
                                ? 'text-purple-500'
                                : theme === 'dark' ? 'text-gray-500 hover:text-purple-400' : 'text-gray-400 hover:text-purple-500'
                            )}
                            title={line.isPrimary ? 'Principal' : 'Marcar como principal'}
                          >
                            <Check className="w-4 h-4" />
                          </button>

                          <div className="flex-1">
                            <p className={cn(
                              "font-medium text-sm",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {line.productName}
                            </p>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            )}>
                              {line.productSku} • {formatCurrency(line.productCostPrice)}/{line.unit}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={line.quantityRequired}
                              onChange={(e) => updateLine(index, 'quantityRequired', parseFloat(e.target.value) || 0)}
                              min="0.001"
                              step="0.001"
                              className={cn(
                                "w-20 px-2 py-1 rounded border text-sm text-center",
                                theme === 'dark'
                                  ? 'bg-gray-600 border-gray-500 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              )}
                            />
                            <select
                              value={line.unit}
                              onChange={(e) => updateLine(index, 'unit', e.target.value)}
                              className={cn(
                                "px-2 py-1 rounded border text-sm",
                                theme === 'dark'
                                  ? 'bg-gray-600 border-gray-500 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              )}
                            >
                              <option value="unidad">ud</option>
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="lb">lb</option>
                              <option value="lt">lt</option>
                              <option value="ml">ml</option>
                            </select>
                          </div>

                          <div className="w-24 text-right">
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {formatCurrency(line.lineCost)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Sidebar */}
              <div className="space-y-6">
                <div className={cn(
                  "p-6 rounded-xl sticky top-6",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
                )}>
                  <h2 className={cn(
                    "font-semibold mb-4",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Resumen de costos
                  </h2>

                  <div className="space-y-4">
                    <div className={cn(
                      "p-4 rounded-lg",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}>
                      <p className={cn(
                        "text-sm mb-1",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Costo total de materiales
                      </p>
                      <p className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {formatCurrency(totalMaterialCost)}
                      </p>
                    </div>

                    <div className={cn(
                      "p-4 rounded-lg",
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50'
                    )}>
                      <p className={cn(
                        "text-sm mb-1",
                        theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                      )}>
                        Costo por unidad producida
                      </p>
                      <p className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? 'text-purple-300' : 'text-purple-700'
                      )}>
                        {formatCurrency(unitCost)}
                      </p>
                      <p className={cn(
                        "text-xs mt-1",
                        theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                      )}>
                        {totalMaterialCost > 0 && outputQuantity > 0 && (
                          <>
                            {formatCurrency(totalMaterialCost)} / {outputQuantity} {outputUnit}
                          </>
                        )}
                      </p>
                    </div>

                    {lines.length > 0 && (
                      <div className={cn(
                        "p-4 rounded-lg",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                      )}>
                        <p className={cn(
                          "text-sm mb-2",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Desglose
                        </p>
                        <div className="space-y-1">
                          {lines.map((line, index) => (
                            <div key={line.id} className="flex justify-between text-sm">
                              <span className={cn(
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {line.productName.length > 20 ? line.productName.substring(0, 20) + '...' : line.productName}
                              </span>
                              <span className={cn(
                                "font-medium",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {formatCurrency(line.lineCost)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={saving || !outputProduct || lines.length === 0}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
                        saving || !outputProduct || lines.length === 0
                          ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                          : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white'
                      )}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Guardar Receta
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
