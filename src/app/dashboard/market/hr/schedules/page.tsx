'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  FileText,
  X,
  Check
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface ScheduleDay {
  dayOfWeek: number
  dayName: string
  startTime: string | null
  endTime: string | null
  breakMinutes: number
  isWorkDay: boolean
}

interface Schedule {
  id: number
  name: string
  weeklyHours: number
  isFlexible: boolean
  isActive: boolean
  contractCount: number
  days: ScheduleDay[]
  createdAt: string
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    weeklyHours: '40',
    isFlexible: false,
    days: DAY_NAMES.map((name, idx) => ({
      dayOfWeek: idx,
      dayName: name,
      startTime: idx >= 1 && idx <= 5 ? '09:00' : '',
      endTime: idx >= 1 && idx <= 5 ? '18:00' : '',
      breakMinutes: 60,
      isWorkDay: idx >= 1 && idx <= 5
    }))
  })

  useEffect(() => {
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/market/hr/schedules?status=all')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSchedules(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingSchedule
        ? `/api/market/hr/schedules/${editingSchedule.id}`
        : '/api/market/hr/schedules'

      const response = await fetch(url, {
        method: editingSchedule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          weeklyHours: parseFloat(formData.weeklyHours),
          isFlexible: formData.isFlexible,
          days: formData.days.map(d => ({
            dayOfWeek: d.dayOfWeek,
            startTime: d.isWorkDay ? d.startTime : null,
            endTime: d.isWorkDay ? d.endTime : null,
            breakMinutes: d.breakMinutes,
            isWorkDay: d.isWorkDay
          }))
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setShowModal(false)
          setEditingSchedule(null)
          resetForm()
          fetchSchedules()
        }
      }
    } catch (error) {
      console.error('Error saving schedule:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      weeklyHours: '40',
      isFlexible: false,
      days: DAY_NAMES.map((name, idx) => ({
        dayOfWeek: idx,
        dayName: name,
        startTime: idx >= 1 && idx <= 5 ? '09:00' : '',
        endTime: idx >= 1 && idx <= 5 ? '18:00' : '',
        breakMinutes: 60,
        isWorkDay: idx >= 1 && idx <= 5
      }))
    })
  }

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setFormData({
      name: schedule.name,
      weeklyHours: schedule.weeklyHours.toString(),
      isFlexible: schedule.isFlexible,
      days: schedule.days.length > 0 ? schedule.days.map(d => ({
        ...d,
        startTime: d.startTime || '',
        endTime: d.endTime || ''
      })) : DAY_NAMES.map((name, idx) => ({
        dayOfWeek: idx,
        dayName: name,
        startTime: idx >= 1 && idx <= 5 ? '09:00' : '',
        endTime: idx >= 1 && idx <= 5 ? '18:00' : '',
        breakMinutes: 60,
        isWorkDay: idx >= 1 && idx <= 5
      }))
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de desactivar este horario?')) return

    try {
      const response = await fetch(`/api/market/hr/schedules/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchSchedules()
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
    }
  }

  const updateDay = (dayOfWeek: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.map(d =>
        d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d
      )
    }))
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Clock className="w-8 h-8 text-green-600" />
                Horarios de Trabajo
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {schedules.length} horarios registrados
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSchedule(null)
                resetForm()
                setShowModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Nuevo Horario
            </button>
          </motion.div>

          {/* Schedules List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
            >
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No hay horarios
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Crea el primer horario de trabajo
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule, idx) => (
                <motion.div
                  key={schedule.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg ${!schedule.isActive ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Clock className="w-7 h-7 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {schedule.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-500">{schedule.weeklyHours}h semanales</span>
                          {schedule.isFlexible && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs">
                              Flexible
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-sm text-gray-500">
                            <FileText className="w-4 h-4" />
                            {schedule.contractCount} contratos
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      {schedule.isActive && schedule.contractCount === 0 && (
                        <button
                          onClick={() => handleDelete(schedule.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Days Preview */}
                  <div className="flex flex-wrap gap-2">
                    {schedule.days.map(day => (
                      <div
                        key={day.dayOfWeek}
                        className={`px-3 py-1.5 rounded-lg text-sm ${
                          day.isWorkDay
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                        }`}
                      >
                        <span className="font-medium">{day.dayName.substring(0, 3)}</span>
                        {day.isWorkDay && day.startTime && (
                          <span className="ml-1 text-xs">
                            {day.startTime}-{day.endTime}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
                    </h2>
                    <button
                      onClick={() => setShowModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-green-500"
                        placeholder="Ej: Horario Normal"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Horas Semanales *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="168"
                        value={formData.weeklyHours}
                        onChange={(e) => setFormData({ ...formData, weeklyHours: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isFlexible}
                        onChange={(e) => setFormData({ ...formData, isFlexible: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                    </label>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Horario flexible</span>
                  </div>

                  {/* Days Configuration */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Configuración de Días
                    </h3>
                    <div className="space-y-3">
                      {formData.days.map(day => (
                        <div
                          key={day.dayOfWeek}
                          className={`p-4 rounded-xl border ${
                            day.isWorkDay
                              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => updateDay(day.dayOfWeek, 'isWorkDay', !day.isWorkDay)}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                day.isWorkDay
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                              }`}
                            >
                              {day.isWorkDay && <Check className="w-5 h-5" />}
                            </button>
                            <span className="w-24 font-medium text-gray-900 dark:text-white">
                              {day.dayName}
                            </span>

                            {day.isWorkDay && (
                              <>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={day.startTime}
                                    onChange={(e) => updateDay(day.dayOfWeek, 'startTime', e.target.value)}
                                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                                  />
                                  <span className="text-gray-500">-</span>
                                  <input
                                    type="time"
                                    value={day.endTime}
                                    onChange={(e) => updateDay(day.dayOfWeek, 'endTime', e.target.value)}
                                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                                  />
                                </div>
                                <div className="flex items-center gap-2 ml-auto">
                                  <span className="text-sm text-gray-500">Descanso:</span>
                                  <input
                                    type="number"
                                    value={day.breakMinutes}
                                    onChange={(e) => updateDay(day.dayOfWeek, 'breakMinutes', parseInt(e.target.value))}
                                    className="w-16 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-center"
                                    min="0"
                                  />
                                  <span className="text-sm text-gray-500">min</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                    >
                      {editingSchedule ? 'Guardar' : 'Crear'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
