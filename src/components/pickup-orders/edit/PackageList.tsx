'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Edit2, Trash2, Save, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Empaque {
  id: number
  codigo: string
  weightLb?: number
  weightKg?: number
  boxNumber?: number
  totalBoxes?: number
  estado: string
}

interface PackageListProps {
  orderId: number
  empaques: Empaque[]
  onPackageUpdated: () => void
}

export default function PackageList({ orderId, empaques, onPackageUpdated }: PackageListProps) {
  const { theme } = useTheme()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  const handleEditClick = (empaque: Empaque) => {
    setEditingId(empaque.id)
    setEditWeight(empaque.weightLb?.toString() || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditWeight('')
  }

  const handleSaveWeight = async (codigo: string) => {
    const peso = parseFloat(editWeight)

    if (isNaN(peso) || peso <= 0) {
      alert('El peso debe ser un número válido mayor a 0')
      return
    }

    setIsUpdating(true)

    try {
      const response = await fetch(`/api/pickup-orders/${orderId}/empaques/${codigo}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peso_lb: peso })
      })

      const data = await response.json()

      if (data.success) {
        setEditingId(null)
        setEditWeight('')
        onPackageUpdated()
      } else {
        alert(data.error || 'Error al actualizar peso')
      }
    } catch (error) {
      console.error('Error updating weight:', error)
      alert('Error de conexión al servidor')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (codigo: string, empaqueId: number) => {
    if (!confirm(`¿Seguro que deseas desasociar el empaque ${codigo}?`)) {
      return
    }

    setIsDeleting(empaqueId)

    try {
      const response = await fetch(`/api/pickup-orders/${orderId}/empaques/${codigo}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        onPackageUpdated()
      } else {
        alert(data.error || 'Error al desasociar empaque')
      }
    } catch (error) {
      console.error('Error deleting package:', error)
      alert('Error de conexión al servidor')
    } finally {
      setIsDeleting(null)
    }
  }

  const totalWeightLb = empaques.reduce((sum, e) => sum + (e.weightLb || 0), 0)
  const totalWeightKg = empaques.reduce((sum, e) => sum + (e.weightKg || 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={cn(
        'rounded-2xl border p-6 shadow-lg',
        theme === 'dark'
          ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
          : 'bg-white border-gray-200'
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-green-600 to-green-700'
          )}
        >
          <Package className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className={cn(
            'text-lg font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Empaques Asociados
          </h3>
          <p className={cn(
            'text-sm',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            {empaques.length} {empaques.length === 1 ? 'empaque' : 'empaques'} • {totalWeightLb.toFixed(2)} lb ({totalWeightKg.toFixed(2)} kg)
          </p>
        </div>
      </div>

      {empaques.length === 0 ? (
        <div className={cn(
          'p-8 rounded-xl text-center',
          theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'
        )}>
          <Package className={cn(
            'w-12 h-12 mx-auto mb-3',
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          )} />
          <p className={cn(
            'text-sm font-medium mb-1',
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            Sin empaques asociados
          </p>
          <p className={cn(
            'text-xs',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
          )}>
            Usa el escáner para asociar empaques a esta orden
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {empaques.map((empaque) => {
              const isEditing = editingId === empaque.id
              const isBeingDeleted = isDeleting === empaque.id

              return (
                <motion.div
                  key={empaque.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className={cn(
                    'rounded-xl border p-4 transition-all',
                    theme === 'dark'
                      ? 'bg-gray-700/30 border-gray-600'
                      : 'bg-gray-50 border-gray-200',
                    isEditing && (theme === 'dark' ? 'bg-blue-900/20 border-blue-600' : 'bg-blue-50 border-blue-300')
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Código */}
                    <div className="flex-1">
                      <p className={cn(
                        'font-mono font-bold text-sm mb-1',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {empaque.codigo}
                      </p>
                      {empaque.boxNumber && empaque.totalBoxes && (
                        <p className={cn(
                          'text-xs',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Caja {empaque.boxNumber} de {empaque.totalBoxes}
                        </p>
                      )}
                    </div>

                    {/* Weight Display/Edit */}
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editWeight}
                          onChange={(e) => setEditWeight(e.target.value)}
                          placeholder="Peso lb"
                          disabled={isUpdating}
                          className={cn(
                            'w-24 px-3 py-1.5 rounded-lg border text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500',
                            theme === 'dark'
                              ? 'bg-gray-600 border-gray-500 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                        <span className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          lb
                        </span>
                      </div>
                    ) : (
                      <div className={cn(
                        'text-right',
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {empaque.weightLb ? (
                          <>
                            <p className="text-sm font-semibold">
                              {empaque.weightLb} lb
                            </p>
                            <p className="text-xs text-gray-500">
                              {empaque.weightKg?.toFixed(2)} kg
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-500">Sin peso</p>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleSaveWeight(empaque.codigo)}
                            disabled={isUpdating}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              'bg-green-600 hover:bg-green-700 text-white',
                              isUpdating && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            {isUpdating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleCancelEdit}
                            disabled={isUpdating}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              theme === 'dark'
                                ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                : 'bg-gray-300 hover:bg-gray-400 text-gray-900',
                              isUpdating && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                        </>
                      ) : (
                        <>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleEditClick(empaque)}
                            disabled={isBeingDeleted}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              theme === 'dark'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-500 hover:bg-blue-600 text-white',
                              isBeingDeleted && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDelete(empaque.codigo, empaque.id)}
                            disabled={isBeingDeleted}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              'bg-red-600 hover:bg-red-700 text-white',
                              isBeingDeleted && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            {isBeingDeleted ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </motion.button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
