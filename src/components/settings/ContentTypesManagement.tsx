'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ContentType {
  id: number
  name: string
  icon: string | null
  description: string | null
  active: boolean
  displayOrder: number
  color: string
  createdAt: string
  updatedAt: string
}

export default function ContentTypesManagement() {
  const { theme } = useTheme()
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showContentTypeModal, setShowContentTypeModal] = useState(false)
  const [editingContentType, setEditingContentType] = useState<ContentType | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null)

  const [contentTypeForm, setContentTypeForm] = useState({
    name: '',
    icon: '',
    description: '',
    color: '#3B82F6',
    active: true,
    displayOrder: 0
  })

  const fetchContentTypes = async () => {
    try {
      const response = await fetch('/api/package-content-types')
      const data = await response.json()
      if (data.success) {
        setContentTypes(data.data)
      }
    } catch (error) {
      console.error('Error fetching content types:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContentTypes()
  }, [])

  const handleSaveContentType = async () => {
    setSaving(true)
    try {
      const url = '/api/package-content-types'
      const method = editingContentType ? 'PUT' : 'POST'

      const body = editingContentType
        ? { id: editingContentType.id, ...contentTypeForm }
        : contentTypeForm

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        await fetchContentTypes()
        setShowContentTypeModal(false)
        setEditingContentType(null)
        resetContentTypeForm()
      } else {
        alert(data.error || 'Error al guardar tipo de contenido')
      }
    } catch (error) {
      console.error('Error saving content type:', error)
      alert('Error al guardar tipo de contenido')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteContentType = (id: number, name: string) => {
    setDeleteConfirm({ id, name })
  }

  const confirmDeleteContentType = async () => {
    if (!deleteConfirm) return

    try {
      const response = await fetch(`/api/package-content-types?id=${deleteConfirm.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await fetchContentTypes()
      } else {
        alert(data.error || 'Error al desactivar tipo de contenido')
      }
    } catch (error) {
      console.error('Error deleting content type:', error)
      alert('Error al desactivar tipo de contenido')
    } finally {
      setDeleteConfirm(null)
    }
  }

  const resetContentTypeForm = () => {
    setContentTypeForm({
      name: '',
      icon: '',
      description: '',
      color: '#3B82F6',
      active: true,
      displayOrder: 0
    })
  }

  const openEditContentType = (contentType: ContentType) => {
    setEditingContentType(contentType)
    setContentTypeForm({
      name: contentType.name,
      icon: contentType.icon || '',
      description: contentType.description || '',
      color: contentType.color,
      active: contentType.active,
      displayOrder: contentType.displayOrder
    })
    setShowContentTypeModal(true)
  }

  const filteredContentTypes = contentTypes.filter(ct =>
    ct.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-exa-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Add */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className={cn(
            "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
          )} />
          <Input
            placeholder="Buscar tipos de contenido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "pl-10",
              theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white'
            )}
          />
        </div>
        <Button
          onClick={() => {
            resetContentTypeForm()
            setEditingContentType(null)
            setShowContentTypeModal(true)
          }}
          className={cn(
            "flex items-center gap-2",
            theme === 'dark'
              ? 'bg-exa-secondary hover:bg-exa-secondary/90'
              : 'bg-exa-primary hover:bg-exa-primary/90',
            'text-white'
          )}
        >
          <Plus className="w-4 h-4" />
          Nuevo Tipo
        </Button>
      </div>

      {/* Content Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredContentTypes.map((contentType) => (
          <motion.div
            key={contentType.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-xl border",
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: contentType.color + '20' }}
                >
                  {contentType.icon}
                </div>
                <div>
                  <h3 className={cn(
                    "font-semibold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {contentType.name}
                  </h3>
                </div>
              </div>
              {contentType.active ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
            </div>

            {contentType.description && (
              <p className={cn(
                "text-sm mb-4",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {contentType.description}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => openEditContentType(contentType)}
                size="sm"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                )}
              >
                <Edit2 className="w-4 h-4" />
                Editar
              </Button>
              <Button
                onClick={() => handleDeleteContentType(contentType.id, contentType.name)}
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Content Type Modal */}
      <AnimatePresence>
        {showContentTypeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !saving && setShowContentTypeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full max-w-md rounded-xl p-6",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {editingContentType ? 'Editar Tipo de Contenido' : 'Nuevo Tipo de Contenido'}
                </h2>
                <Button
                  onClick={() => setShowContentTypeModal(false)}
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Nombre *
                  </label>
                  <Input
                    value={contentTypeForm.name}
                    onChange={(e) => setContentTypeForm({ ...contentTypeForm, name: e.target.value })}
                    placeholder="Ej: Electrónica"
                    className={theme === 'dark' ? 'bg-gray-700 text-white' : ''}
                  />
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Emoji/Icono
                  </label>
                  <Input
                    value={contentTypeForm.icon}
                    onChange={(e) => setContentTypeForm({ ...contentTypeForm, icon: e.target.value })}
                    placeholder="📱"
                    className={theme === 'dark' ? 'bg-gray-700 text-white' : ''}
                    maxLength={2}
                  />
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Color
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={contentTypeForm.color}
                      onChange={(e) => setContentTypeForm({ ...contentTypeForm, color: e.target.value })}
                      className="w-16 h-10"
                    />
                    <Input
                      value={contentTypeForm.color}
                      onChange={(e) => setContentTypeForm({ ...contentTypeForm, color: e.target.value })}
                      placeholder="#3B82F6"
                      className={cn(
                        "flex-1",
                        theme === 'dark' ? 'bg-gray-700 text-white' : ''
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Descripción
                  </label>
                  <textarea
                    value={contentTypeForm.description}
                    onChange={(e) => setContentTypeForm({ ...contentTypeForm, description: e.target.value })}
                    placeholder="Descripción del tipo de contenido..."
                    rows={3}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border",
                      theme === 'dark'
                        ? 'bg-gray-700 text-white border-gray-600'
                        : 'bg-white border-gray-300'
                    )}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contentTypeForm.active}
                      onChange={(e) => setContentTypeForm({ ...contentTypeForm, active: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                      Activo
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setShowContentTypeModal(false)}
                    disabled={saving}
                    className={cn(
                      "flex-1",
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    )}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveContentType}
                    disabled={saving || !contentTypeForm.name}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2",
                      theme === 'dark'
                        ? 'bg-exa-secondary hover:bg-exa-secondary/90'
                        : 'bg-exa-primary hover:bg-exa-primary/90',
                      'text-white'
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
                        Guardar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDeleteContentType}
        title="Desactivar Tipo de Contenido"
        message={`¿Está seguro de desactivar el tipo de contenido "${deleteConfirm?.name}"? Esta acción marcará el tipo como inactivo.`}
        confirmText="Desactivar"
        cancelText="Cancelar"
        type="danger"
        theme={theme}
      />
    </div>
  )
}
