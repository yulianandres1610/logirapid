'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Clock, Save, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ShiftPattern {
  id?: number
  name: string
  code: string
  description: string
  workDays: number
  restDays: number
  startTime: string
  endTime: string
  breakMinutes: number
  isActive?: boolean
}

interface ShiftPatternFormProps {
  pattern?: ShiftPattern | null
  onClose: () => void
  onSave: (pattern: ShiftPattern) => void
}

const PATTERN_PRESETS = [
  { label: '2x2', workDays: 2, restDays: 2 },
  { label: '4x2', workDays: 4, restDays: 2 },
  { label: '5x2', workDays: 5, restDays: 2 },
  { label: '6x1', workDays: 6, restDays: 1 },
  { label: '3x1', workDays: 3, restDays: 1 },
]

export function ShiftPatternForm({ pattern, onClose, onSave }: ShiftPatternFormProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ShiftPattern>({
    name: '',
    code: '',
    description: '',
    workDays: 2,
    restDays: 2,
    startTime: '08:00',
    endTime: '16:00',
    breakMinutes: 0
  })

  useEffect(() => {
    if (pattern) {
      setFormData({
        ...pattern,
        startTime: pattern.startTime || '08:00',
        endTime: pattern.endTime || '16:00'
      })
    }
  }, [pattern])

  const handlePresetSelect = (preset: typeof PATTERN_PRESETS[0]) => {
    setFormData(prev => ({
      ...prev,
      workDays: preset.workDays,
      restDays: preset.restDays,
      code: prev.code || `${preset.workDays}X${preset.restDays}`
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Ensure tables exist before saving (fallback initialization)
      if (!pattern?.id) {
        try {
          await fetch('/api/market/hr/init-tables', { method: 'POST' })
        } catch (initError) {
          console.log('Table init check (may already exist):', initError)
        }
      }

      const url = pattern?.id
        ? `/api/market/hr/shift-patterns/${pattern.id}`
        : '/api/market/hr/shift-patterns'

      const response = await fetch(url, {
        method: pattern?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()
      if (result.success) {
        onSave(result.data)
        onClose()
      } else {
        alert(result.error || 'Error saving pattern')
      }
    } catch (error) {
      console.error('Error saving pattern:', error)
      alert('Error saving pattern')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          'rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}
      >
        {/* Header */}
        <div className={cn(
          'p-6 border-b sticky top-0 z-10',
          theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
              )}>
                <Clock className="w-5 h-5 text-purple-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {pattern ? 'Editar Patron' : 'Nuevo Patron de Rotacion'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Pattern Presets */}
          <div>
            <label className={cn(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Patrones Predefinidos
            </label>
            <div className="flex flex-wrap gap-2">
              {PATTERN_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={cn(
                    'px-4 py-2 rounded-lg border transition-colors',
                    formData.workDays === preset.workDays && formData.restDays === preset.restDays
                      ? 'bg-purple-500 text-white border-purple-500'
                      : theme === 'dark'
                        ? 'border-gray-600 hover:border-purple-500 text-gray-300'
                        : 'border-gray-300 hover:border-purple-500 text-gray-700'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name and Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn(
                'block text-sm font-medium mb-1',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Nombre *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white focus:ring-purple-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-purple-500'
                )}
                placeholder="Ej: Turno 2x2 Mañana"
              />
            </div>
            <div>
              <label className={cn(
                'block text-sm font-medium mb-1',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Codigo
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white focus:ring-purple-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-purple-500'
                )}
                placeholder="Ej: 2X2-AM"
              />
            </div>
          </div>

          {/* Work/Rest Days */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn(
                'block text-sm font-medium mb-1',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Dias de Trabajo *
              </label>
              <input
                type="number"
                required
                min="1"
                max="30"
                value={formData.workDays}
                onChange={(e) => setFormData({ ...formData, workDays: parseInt(e.target.value) })}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white focus:ring-purple-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-purple-500'
                )}
              />
            </div>
            <div>
              <label className={cn(
                'block text-sm font-medium mb-1',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Dias de Descanso *
              </label>
              <input
                type="number"
                required
                min="1"
                max="30"
                value={formData.restDays}
                onChange={(e) => setFormData({ ...formData, restDays: parseInt(e.target.value) })}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white focus:ring-purple-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-purple-500'
                )}
              />
            </div>
          </div>

          {/* Pattern Preview */}
          <div className={cn(
            'p-4 rounded-xl border',
            theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
          )}>
            <p className={cn(
              'text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Vista Previa del Ciclo ({formData.workDays + formData.restDays} dias)
            </p>
            <div className="flex gap-1 flex-wrap">
              {[...Array(formData.workDays)].map((_, i) => (
                <div
                  key={`work-${i}`}
                  className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                >
                  T
                </div>
              ))}
              {[...Array(formData.restDays)].map((_, i) => (
                <div
                  key={`rest-${i}`}
                  className="w-8 h-8 rounded-lg bg-gray-400 flex items-center justify-center text-white text-xs font-medium"
                >
                  D
                </div>
              ))}
            </div>
            <p className={cn(
              'text-xs mt-2',
              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
            )}>
              T = Trabajo, D = Descanso
            </p>
          </div>

          {/* Start/End Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={cn(
                'block text-sm font-medium mb-1',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Hora Inicio *
              </label>
              <input
                type="time"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white focus:ring-purple-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-purple-500'
                )}
              />
            </div>
            <div>
              <label className={cn(
                'block text-sm font-medium mb-1',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Hora Fin *
              </label>
              <input
                type="time"
                required
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white focus:ring-purple-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-purple-500'
                )}
              />
            </div>
          </div>

          {/* Break Minutes */}
          <div>
            <label className={cn(
              'block text-sm font-medium mb-1',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Minutos de Descanso
            </label>
            <input
              type="number"
              min="0"
              max="120"
              value={formData.breakMinutes}
              onChange={(e) => setFormData({ ...formData, breakMinutes: parseInt(e.target.value) || 0 })}
              className={cn(
                'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                theme === 'dark'
                  ? 'bg-gray-900 border-gray-700 text-white focus:ring-purple-500'
                  : 'bg-white border-gray-200 text-gray-900 focus:ring-purple-500'
              )}
            />
          </div>

          {/* Description */}
          <div>
            <label className={cn(
              'block text-sm font-medium mb-1',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Descripcion
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className={cn(
                'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none resize-none',
                theme === 'dark'
                  ? 'bg-gray-900 border-gray-700 text-white focus:ring-purple-500'
                  : 'bg-white border-gray-200 text-gray-900 focus:ring-purple-500'
              )}
              placeholder="Descripcion opcional del patron..."
            />
          </div>

          {/* Actions */}
          <div className={cn(
            'flex gap-3 pt-4 border-t',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'flex-1 px-4 py-2.5 border rounded-xl font-medium transition-colors',
                theme === 'dark'
                  ? 'border-gray-700 hover:bg-gray-700'
                  : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {pattern ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
