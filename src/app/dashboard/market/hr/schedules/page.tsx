'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Plus,
  Search,
  Edit,
  Trash2,
  FileText,
  X,
  Check,
  RefreshCw,
  Users,
  Calendar,
  Timer
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

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
  const { theme } = useTheme()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')

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
  }, [statusFilter])

  const fetchSchedules = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const response = await fetch(`/api/market/hr/schedules?status=${statusFilter}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSchedules(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
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

  // Filter schedules by search
  const filteredSchedules = schedules.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  // Stats
  const stats = {
    total: schedules.length,
    active: schedules.filter(s => s.isActive).length,
    flexible: schedules.filter(s => s.isFlexible).length,
    totalContracts: schedules.reduce((sum, s) => sum + s.contractCount, 0)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Horarios */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-green-900/30 border border-green-800/50'
                          : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                      )}>
                        <Clock className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Total Horarios</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.total}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Registrados en el sistema</span>
                  </div>
                </div>
              </motion.div>

              {/* Activos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-800/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                      )}>
                        <Check className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Activos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.active}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Disponibles para asignar</span>
                  </div>
                </div>
              </motion.div>

              {/* Flexibles */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-purple-900/30 border border-purple-800/50'
                          : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                      )}>
                        <Timer className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Flexibles</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.flexible}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Con horario flexible</span>
                  </div>
                </div>
              </motion.div>

              {/* Contratos Asignados */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-amber-900/30 border border-amber-800/50'
                          : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                      )}>
                        <Users className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Contratos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.totalContracts}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Empleados asignados</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-4 rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                  )}
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>

                {/* Refresh */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchSchedules(true)}
                  disabled={loading || isRefreshing}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                    isRefreshing && 'opacity-75'
                  )}
                >
                  <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
                </motion.button>

                {/* Nuevo Horario */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setEditingSchedule(null)
                    resetForm()
                    setShowModal(true)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Horario
                </motion.button>
              </div>
            </motion.div>

            {/* Schedules Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'border-b',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Horas/Semana</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Días Laborales</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Contratos</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : filteredSchedules.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay horarios registrados</p>
                          <button
                            onClick={() => {
                              setEditingSchedule(null)
                              resetForm()
                              setShowModal(true)
                            }}
                            className="mt-3 text-sm text-green-500 hover:text-green-600"
                          >
                            Crear primer horario
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredSchedules.map((schedule, index) => (
                        <motion.tr
                          key={schedule.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            'group transition-colors',
                            !schedule.isActive && 'opacity-60',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                              )}>
                                <Clock className="w-5 h-5 text-green-600" />
                              </div>
                              <p className={cn(
                                'font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {schedule.name}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              {schedule.weeklyHours}h
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {schedule.isFlexible ? (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                              )}>
                                Flexible
                              </span>
                            ) : (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                              )}>
                                Fijo
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1">
                              {schedule.days.filter(d => d.isWorkDay).map(day => (
                                <span
                                  key={day.dayOfWeek}
                                  className={cn(
                                    'px-2 py-0.5 rounded text-xs font-medium',
                                    theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                                  )}
                                >
                                  {day.dayName.substring(0, 3)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                            )}>
                              <FileText className="w-3 h-3" />
                              {schedule.contractCount}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {schedule.isActive ? (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                              )}>
                                Activo
                              </span>
                            ) : (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                              )}>
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleEdit(schedule)}
                                className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4 text-blue-500" />
                              </motion.button>
                              {schedule.isActive && schedule.contractCount === 0 && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDelete(schedule.id)}
                                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                  title="Desactivar"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </motion.button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Modal */}
            <AnimatePresence>
              {showModal && (
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
                    <div className={cn(
                      'p-6 border-b sticky top-0 z-10',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                    )}>
                      <div className="flex items-center justify-between">
                        <h2 className={cn(
                          'text-xl font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {editingSchedule ? 'Editar Horario' : 'Nuevo Horario'}
                        </h2>
                        <button
                          onClick={() => setShowModal(false)}
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
                      {/* Basic Info */}
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
                              'w-full px-4 py-2.5 border rounded-xl focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-900 border-gray-700 text-white focus:ring-green-500'
                                : 'bg-white border-gray-200 text-gray-900 focus:ring-green-500'
                            )}
                            placeholder="Ej: Horario Normal"
                          />
                        </div>
                        <div>
                          <label className={cn(
                            'block text-sm font-medium mb-1',
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Horas Semanales *
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            max="168"
                            value={formData.weeklyHours}
                            onChange={(e) => setFormData({ ...formData, weeklyHours: e.target.value })}
                            className={cn(
                              'w-full px-4 py-2.5 border rounded-xl focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-900 border-gray-700 text-white focus:ring-green-500'
                                : 'bg-white border-gray-200 text-gray-900 focus:ring-green-500'
                            )}
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
                        <span className={cn(
                          'text-sm',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>Horario flexible</span>
                      </div>

                      {/* Days Configuration */}
                      <div>
                        <h3 className={cn(
                          'text-sm font-medium mb-3',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Configuración de Días
                        </h3>
                        <div className="space-y-3">
                          {formData.days.map(day => (
                            <div
                              key={day.dayOfWeek}
                              className={cn(
                                'p-4 rounded-xl border',
                                day.isWorkDay
                                  ? theme === 'dark'
                                    ? 'border-green-800 bg-green-900/10'
                                    : 'border-green-200 bg-green-50'
                                  : theme === 'dark'
                                    ? 'border-gray-700 bg-gray-900'
                                    : 'border-gray-200 bg-gray-50'
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <button
                                  type="button"
                                  onClick={() => updateDay(day.dayOfWeek, 'isWorkDay', !day.isWorkDay)}
                                  className={cn(
                                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                                    day.isWorkDay
                                      ? 'bg-green-500 text-white'
                                      : theme === 'dark'
                                        ? 'bg-gray-700 text-gray-500'
                                        : 'bg-gray-200 text-gray-500'
                                  )}
                                >
                                  {day.isWorkDay && <Check className="w-5 h-5" />}
                                </button>
                                <span className={cn(
                                  'w-24 font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {day.dayName}
                                </span>

                                {day.isWorkDay && (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="time"
                                        value={day.startTime}
                                        onChange={(e) => updateDay(day.dayOfWeek, 'startTime', e.target.value)}
                                        className={cn(
                                          'px-3 py-1.5 border rounded-lg text-sm',
                                          theme === 'dark'
                                            ? 'bg-gray-800 border-gray-600 text-white'
                                            : 'bg-white border-gray-200 text-gray-900'
                                        )}
                                      />
                                      <span className="text-gray-500">-</span>
                                      <input
                                        type="time"
                                        value={day.endTime}
                                        onChange={(e) => updateDay(day.dayOfWeek, 'endTime', e.target.value)}
                                        className={cn(
                                          'px-3 py-1.5 border rounded-lg text-sm',
                                          theme === 'dark'
                                            ? 'bg-gray-800 border-gray-600 text-white'
                                            : 'bg-white border-gray-200 text-gray-900'
                                        )}
                                      />
                                    </div>
                                    <div className="flex items-center gap-2 ml-auto">
                                      <span className="text-sm text-gray-500">Descanso:</span>
                                      <input
                                        type="number"
                                        value={day.breakMinutes}
                                        onChange={(e) => updateDay(day.dayOfWeek, 'breakMinutes', parseInt(e.target.value))}
                                        className={cn(
                                          'w-16 px-2 py-1.5 border rounded-lg text-sm text-center',
                                          theme === 'dark'
                                            ? 'bg-gray-800 border-gray-600 text-white'
                                            : 'bg-white border-gray-200 text-gray-900'
                                        )}
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

                      <div className={cn(
                        'flex gap-3 pt-4 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <button
                          type="button"
                          onClick={() => setShowModal(false)}
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
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-colors"
                        >
                          {editingSchedule ? 'Guardar' : 'Crear'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
