'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Calendar, Users, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ShiftPattern {
  id: number
  name: string
  code: string
  workDays: number
  restDays: number
  startTime: string
  endTime: string
  patternLabel: string
}

interface Employee {
  id: number
  name: string
  code: string
  department?: string
}

interface GenerateShiftsModalProps {
  patterns: ShiftPattern[]
  employees: Employee[]
  preSelectedEmployees?: number[]
  onClose: () => void
  onGenerate: () => void
}

export function GenerateShiftsModal({ patterns, employees, preSelectedEmployees = [], onClose, onGenerate }: GenerateShiftsModalProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    patternId: patterns[0]?.id || 0,
    employeeIds: preSelectedEmployees,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    firstWorkDay: new Date().toISOString().split('T')[0],
    overwrite: false
  })

  const selectedPattern = patterns.find(p => p.id === formData.patternId)

  const toggleEmployee = (id: number) => {
    setFormData(prev => ({
      ...prev,
      employeeIds: prev.employeeIds.includes(id)
        ? prev.employeeIds.filter(e => e !== id)
        : [...prev.employeeIds, id]
    }))
  }

  const selectAll = () => {
    setFormData(prev => ({
      ...prev,
      employeeIds: prev.employeeIds.length === employees.length ? [] : employees.map(e => e.id)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    if (formData.employeeIds.length === 0) {
      setError('Selecciona al menos un empleado')
      setLoading(false)
      return
    }

    try {
      // Ensure tables exist before generating shifts
      try {
        await fetch('/api/market/hr/init-tables', { method: 'POST' })
      } catch (initError) {
        console.log('Table init check (may already exist):', initError)
      }

      const response = await fetch('/api/market/hr/employee-shifts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.data)
        onGenerate()
      } else {
        setError(data.error || 'Error al generar turnos')
      }
    } catch (err) {
      console.error('Error generating shifts:', err)
      setError('Error al generar turnos')
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
          'rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto',
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
                theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
              )}>
                <Sparkles className="w-5 h-5 text-green-500" />
              </div>
              <h2 className={cn(
                'text-xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Generar Turnos
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

        {result ? (
          /* Success Result */
          <div className="p-6">
            <div className={cn(
              'p-6 rounded-xl border text-center',
              theme === 'dark' ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200'
            )}>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className={cn(
                'text-lg font-bold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Turnos Generados
              </h3>
              <div className="space-y-2 text-sm">
                <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Empleados procesados: <strong>{result.employeesProcessed}</strong>
                </p>
                <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Turnos creados: <strong className="text-green-500">{result.shiftsCreated}</strong>
                </p>
                <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Turnos actualizados: <strong className="text-blue-500">{result.shiftsUpdated}</strong>
                </p>
                <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Patron: <strong>{result.pattern.name} ({result.pattern.label})</strong>
                </p>
                <p className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                  Rango: {result.dateRange.start} al {result.dateRange.end}
                </p>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-4 text-left">
                  <p className="text-sm font-medium text-amber-500 mb-2">Advertencias:</p>
                  <ul className="text-xs text-amber-400 list-disc list-inside">
                    {result.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full mt-4 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className={cn(
                'p-4 rounded-xl border flex items-center gap-3',
                theme === 'dark' ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200'
              )}>
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            {/* Pattern Selection */}
            <div>
              <label className={cn(
                'block text-sm font-medium mb-2',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Patron de Rotacion *
              </label>
              <select
                required
                value={formData.patternId}
                onChange={(e) => setFormData({ ...formData, patternId: parseInt(e.target.value) })}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                  theme === 'dark'
                    ? 'bg-gray-900 border-gray-700 text-white focus:ring-green-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-green-500'
                )}
              >
                {patterns.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.patternLabel}) - {p.startTime} a {p.endTime}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={cn(
                  'block text-sm font-medium mb-1',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Fecha Inicio *
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className={cn(
                    'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                    theme === 'dark'
                      ? 'bg-gray-900 border-gray-700 text-white focus:ring-green-500'
                      : 'bg-white border-gray-200 text-gray-900 focus:ring-green-500'
                  )}
                />
              </div>
              <div>
                <label className={cn(
                  'block text-sm font-medium mb-1',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Fecha Fin *
                </label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className={cn(
                    'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                    theme === 'dark'
                      ? 'bg-gray-900 border-gray-700 text-white focus:ring-green-500'
                      : 'bg-white border-gray-200 text-gray-900 focus:ring-green-500'
                  )}
                />
              </div>
              <div>
                <label className={cn(
                  'block text-sm font-medium mb-1',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Primer Dia Trabajo *
                </label>
                <input
                  type="date"
                  required
                  value={formData.firstWorkDay}
                  onChange={(e) => setFormData({ ...formData, firstWorkDay: e.target.value })}
                  className={cn(
                    'w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:outline-none',
                    theme === 'dark'
                      ? 'bg-gray-900 border-gray-700 text-white focus:ring-green-500'
                      : 'bg-white border-gray-200 text-gray-900 focus:ring-green-500'
                  )}
                />
              </div>
            </div>

            {/* Pattern Preview */}
            {selectedPattern && (
              <div className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
              )}>
                <p className={cn(
                  'text-sm font-medium mb-2',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Ciclo del Patron: {selectedPattern.patternLabel}
                </p>
                <div className="flex gap-1 flex-wrap">
                  {[...Array(selectedPattern.workDays)].map((_, i) => (
                    <div
                      key={`work-${i}`}
                      className="w-6 h-6 rounded bg-green-500 flex items-center justify-center text-white text-xs"
                    >
                      T
                    </div>
                  ))}
                  {[...Array(selectedPattern.restDays)].map((_, i) => (
                    <div
                      key={`rest-${i}`}
                      className="w-6 h-6 rounded bg-gray-400 flex items-center justify-center text-white text-xs"
                    >
                      D
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Employee Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={cn(
                  'text-sm font-medium',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Empleados ({formData.employeeIds.length} seleccionados)
                </label>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-sm text-green-500 hover:text-green-600"
                >
                  {formData.employeeIds.length === employees.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              <div className={cn(
                'max-h-48 overflow-y-auto rounded-xl border p-2 space-y-1',
                theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
              )}>
                {employees.length === 0 ? (
                  <p className={cn(
                    'text-sm text-center py-4',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    No hay empleados disponibles
                  </p>
                ) : (
                  employees.map(emp => (
                    <label
                      key={emp.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                        formData.employeeIds.includes(emp.id)
                          ? theme === 'dark'
                            ? 'bg-green-900/30'
                            : 'bg-green-50'
                          : theme === 'dark'
                            ? 'hover:bg-gray-800'
                            : 'hover:bg-gray-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={formData.employeeIds.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                        className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
                      />
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                          theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
                        )}>
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {emp.name}
                          </p>
                          <p className={cn(
                            'text-xs',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            {emp.code} {emp.department && `- ${emp.department}`}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Overwrite Option */}
            <label className={cn(
              'flex items-center gap-3 p-4 rounded-xl border cursor-pointer',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <input
                type="checkbox"
                checked={formData.overwrite}
                onChange={(e) => setFormData({ ...formData, overwrite: e.target.checked })}
                className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
              />
              <div>
                <p className={cn(
                  'text-sm font-medium',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Sobrescribir turnos existentes
                </p>
                <p className={cn(
                  'text-xs',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  Eliminar turnos existentes en el rango de fechas antes de generar nuevos
                </p>
              </div>
            </label>

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
                disabled={loading || formData.employeeIds.length === 0}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generar Turnos
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  )
}
