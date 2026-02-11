'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Tag,
  Loader2,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Save,
  X,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface Category {
  id: number
  companyId: number
  name: string
  code: string
  parentId: number | null
  parentName: string
  depreciationYears: number | null
  isActive: boolean
  assetCount: number
  children?: Category[]
}

export default function FixedAssetCategoriesPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [flatCategories, setFlatCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '',
    code: '',
    parentId: '',
    depreciationYears: ''
  })

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch both tree and flat
      const [treeRes, flatRes] = await Promise.all([
        fetch('/api/market/fixed-assets/categories?includeInactive=true'),
        fetch('/api/market/fixed-assets/categories?flat=true&includeInactive=true')
      ])

      const [treeData, flatData] = await Promise.all([
        treeRes.json(),
        flatRes.json()
      ])

      if (treeData.success) {
        setCategories(treeData.data)
      }
      if (flatData.success) {
        setFlatCategories(flatData.data)
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const openModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setForm({
        name: category.name,
        code: category.code || '',
        parentId: category.parentId?.toString() || '',
        depreciationYears: category.depreciationYears?.toString() || ''
      })
    } else {
      setEditingCategory(null)
      setForm({
        name: '',
        code: '',
        parentId: '',
        depreciationYears: ''
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      showNotification('error', 'Error', 'El nombre es requerido')
      return
    }

    setFormLoading(true)

    try {
      const method = editingCategory ? 'PUT' : 'POST'
      const body = {
        ...(editingCategory && { id: editingCategory.id }),
        name: form.name,
        code: form.code || null,
        parentId: form.parentId ? parseInt(form.parentId) : null,
        depreciationYears: form.depreciationYears ? parseInt(form.depreciationYears) : null
      }

      const res = await fetch('/api/market/fixed-assets/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', editingCategory ? 'Categoría actualizada' : 'Categoría creada', '')
        setShowModal(false)
        fetchCategories()
      } else {
        showNotification('error', 'Error', data.error || 'Error al guardar')
      }
    } catch {
      showNotification('error', 'Error de conexión', '')
    } finally {
      setFormLoading(false)
    }
  }

  const deleteCategory = async (id: number) => {
    if (!confirm('¿Eliminar esta categoría?')) return

    try {
      const res = await fetch(`/api/market/fixed-assets/categories?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Categoría eliminada', data.message)
        fetchCategories()
      } else {
        showNotification('error', 'Error', data.error || 'Error al eliminar')
      }
    } catch {
      showNotification('error', 'Error de conexión', '')
    }
  }

  const renderCategory = (category: Category, level = 0) => {
    const hasChildren = category.children && category.children.length > 0

    return (
      <div key={category.id}>
        <div
          className={cn(
            "flex items-center justify-between p-4 border-b transition-colors",
            theme === 'dark'
              ? 'border-gray-700 hover:bg-gray-700/50'
              : 'border-gray-200 hover:bg-gray-50',
            !category.isActive && 'opacity-50'
          )}
          style={{ paddingLeft: `${level * 24 + 16}px` }}
        >
          <div className="flex items-center gap-3">
            {hasChildren && (
              <ChevronRight className={cn(
                "w-4 h-4",
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )} />
            )}
            {!hasChildren && <div className="w-4" />}
            <Tag className={cn(
              "w-5 h-5",
              theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
            )} />
            <div>
              <p className={cn(
                "font-medium",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {category.code && (
                  <span className={cn(
                    "font-mono text-sm mr-2",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}>
                    [{category.code}]
                  </span>
                )}
                {category.name}
              </p>
              <p className={cn(
                "text-xs",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                {category.assetCount} activos
                {category.depreciationYears && ` • ${category.depreciationYears} años depreciación`}
                {!category.isActive && ' • Inactiva'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openModal(category)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
              )}
            >
              <Edit className={cn(
                "w-4 h-4",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )} />
            </button>
            <button
              onClick={() => deleteCategory(category.id)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                theme === 'dark' ? 'hover:bg-red-900/50' : 'hover:bg-red-50'
              )}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
        {hasChildren && category.children!.map(child => renderCategory(child, level + 1))}
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {/* Header */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard/market/fixed-assets"
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className={cn(
                    "w-5 h-5",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )} />
                </Link>
                <div>
                  <h1 className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Categorías de Activos
                  </h1>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Gestionar clasificación de activos fijos
                  </p>
                </div>
              </div>
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Nueva Categoría
              </button>
            </div>

            {/* Categories List */}
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : error ? (
              <div className={cn(
                "p-8 rounded-xl text-center",
                theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
              )}>
                <p>{error}</p>
              </div>
            ) : categories.length === 0 ? (
              <div className={cn(
                "p-12 rounded-xl text-center",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <Tag className={cn(
                  "w-16 h-16 mx-auto mb-4",
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                )} />
                <h3 className={cn(
                  "text-lg font-semibold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  No hay categorías
                </h3>
                <p className={cn("mb-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Crea tu primera categoría para organizar los activos
                </p>
                <button
                  onClick={() => openModal()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Plus className="w-5 h-5" />
                  Crear Categoría
                </button>
              </div>
            ) : (
              <div className={cn(
                "rounded-xl overflow-hidden border",
                theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-white'
              )}>
                {categories.map(cat => renderCategory(cat))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "w-full max-w-md p-6 rounded-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className={cn("text-lg font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </h3>
                <button onClick={() => setShowModal(false)}>
                  <X className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={cn("block text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                    required
                  />
                </div>

                <div>
                  <label className={cn("block text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Código
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="Ej: COMP, MOB"
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  />
                </div>

                <div>
                  <label className={cn("block text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Categoría Padre
                  </label>
                  <select
                    value={form.parentId}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  >
                    <option value="">Sin categoría padre</option>
                    {flatCategories
                      .filter(c => c.id !== editingCategory?.id)
                      .map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.code ? `[${cat.code}] ` : ''}{cat.name}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className={cn("block text-sm font-medium mb-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Años de Depreciación
                  </label>
                  <input
                    type="number"
                    value={form.depreciationYears}
                    onChange={(e) => setForm({ ...form, depreciationYears: e.target.value })}
                    placeholder="Opcional"
                    min="1"
                    className={cn(
                      "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className={cn(
                      "px-4 py-2 rounded-lg",
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {formLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Guardar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
