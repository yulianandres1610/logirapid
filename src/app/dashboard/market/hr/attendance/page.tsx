'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Users,
  Timer
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface AttendanceRecord {
  id: number
  employeeId: number
  employeeName: string
  employeeCode: string
  date: string
  checkIn: string | null
  checkOut: string | null
  checkInMethod: string | null
  checkOutMethod: string | null
  workedHours: number | null
  overtimeHours: number
  status: string
  lateMinutes: number
  earlyDepartureMinutes: number
  notes: string | null
}

interface Employee {
  id: number
  employeeCode: string
  fullName: string
}

const statusConfig: Record<string, { label: string; color: string; bgLight: string; bgDark: string; textLight: string; textDark: string }> = {
  present: { label: 'Presente', color: 'green', bgLight: 'bg-green-100', bgDark: 'bg-green-900/30', textLight: 'text-green-700', textDark: 'text-green-400' },
  late: { label: 'Tardanza', color: 'amber', bgLight: 'bg-amber-100', bgDark: 'bg-amber-900/30', textLight: 'text-amber-700', textDark: 'text-amber-400' },
  absent: { label: 'Ausente', color: 'red', bgLight: 'bg-red-100', bgDark: 'bg-red-900/30', textLight: 'text-red-700', textDark: 'text-red-400' },
  half_day: { label: 'Medio día', color: 'blue', bgLight: 'bg-blue-100', bgDark: 'bg-blue-900/30', textLight: 'text-blue-700', textDark: 'text-blue-400' },
  holiday: { label: 'Feriado', color: 'purple', bgLight: 'bg-purple-100', bgDark: 'bg-purple-900/30', textLight: 'text-purple-700', textDark: 'text-purple-400' }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'present': return CheckCircle
    case 'late': return AlertTriangle
    case 'absent': return XCircle
    case 'half_day': return Clock
    case 'holiday': return Calendar
    default: return CheckCircle
  }
}

export default function AttendancePage() {
  const { theme } = useTheme()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')

  // Date range based on view mode
  const getDateRange = () => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    if (viewMode === 'day') {
      // Just today
    } else if (viewMode === 'week') {
      // Start of week (Monday)
      const day = start.getDay()
      const diff = start.getDate() - day + (day === 0 ? -6 : 1)
      start.setDate(diff)
      end.setDate(diff + 6)
    } else {
      // Start of month
      start.setDate(1)
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    fetchAttendance()
  }, [currentDate, viewMode, selectedEmployee])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/market/hr/employees?status=active')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEmployees(result.data.employees.map((e: any) => ({
            id: e.id,
            employeeCode: e.employeeCode,
            fullName: e.fullName
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchAttendance = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const { start, end } = getDateRange()
      const params = new URLSearchParams({
        startDate: start,
        endDate: end
      })

      if (selectedEmployee) {
        params.append('employeeId', selectedEmployee)
      }

      const response = await fetch(`/api/market/hr/attendance?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setRecords(result.data.records)
        }
      }
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  }

  const formatHours = (hours: number | null) => {
    if (hours === null) return '-'
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${m}m`
  }

  const getDateLabel = () => {
    const { start, end } = getDateRange()
    if (viewMode === 'day') {
      return new Date(start).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
    } else if (viewMode === 'week') {
      return `${new Date(start).toLocaleDateString('es', { day: 'numeric', month: 'short' })} - ${new Date(end).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
    } else {
      return new Date(start).toLocaleDateString('es', { month: 'long', year: 'numeric' })
    }
  }

  // Summary stats
  const summary = {
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
    totalHours: records.reduce((sum, r) => sum + (r.workedHours || 0), 0)
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
              {/* Presentes */}
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
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Presentes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{summary.present}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Asistencias registradas</span>
                  </div>
                </div>
              </motion.div>

              {/* Tardanzas */}
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
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Tardanzas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{summary.late}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Llegadas tarde</span>
                  </div>
                </div>
              </motion.div>

              {/* Ausentes */}
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-red-900/30 border border-red-800/50'
                          : 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'
                      )}>
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Ausentes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{summary.absent}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Sin asistencia</span>
                  </div>
                </div>
              </motion.div>

              {/* Total Horas */}
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
                        <Timer className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Total Horas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatHours(summary.totalHours)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Horas trabajadas</span>
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
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Date Navigation */}
                <div className={cn(
                  'flex items-center gap-2 rounded-xl p-2',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow'
                )}>
                  <button
                    onClick={() => navigateDate('prev')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    )}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className={cn(
                    'px-4 font-medium min-w-[200px] text-center',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {getDateLabel()}
                  </span>
                  <button
                    onClick={() => navigateDate('next')}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    )}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* View Mode */}
                <div className={cn(
                  'flex items-center gap-1 rounded-xl p-1',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow'
                )}>
                  {(['day', 'week', 'month'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        viewMode === mode
                          ? 'bg-emerald-500 text-white'
                          : theme === 'dark'
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-100 text-gray-600'
                      )}
                    >
                      {mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : 'Mes'}
                    </button>
                  ))}
                </div>

                {/* Employee Filter */}
                <div className="flex-1">
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                    )}
                  >
                    <option value="">Todos los empleados</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Refresh */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchAttendance(true)}
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

                {/* Hoy */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCurrentDate(new Date())}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                >
                  <Calendar className="w-4 h-4" />
                  Hoy
                </motion.button>
              </div>
            </motion.div>

            {/* Attendance Table */}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Empleado</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Entrada</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Salida</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Horas</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : records.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className={cn(
                            'font-medium mb-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>Sin registros</p>
                          <p className="text-gray-500 dark:text-gray-400">
                            No hay registros de asistencia para este período
                          </p>
                        </td>
                      </tr>
                    ) : (
                      records.map((record, index) => {
                        const status = statusConfig[record.status] || statusConfig.present
                        const StatusIcon = getStatusIcon(record.status)

                        return (
                          <motion.tr
                            key={record.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={cn(
                              'group transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm',
                                  theme === 'dark'
                                    ? 'bg-emerald-900/30 text-emerald-400'
                                    : 'bg-emerald-100 text-emerald-600'
                                )}>
                                  {record.employeeName.charAt(0)}
                                </div>
                                <div>
                                  <p className={cn(
                                    'font-medium',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {record.employeeName}
                                  </p>
                                  <p className="text-xs text-gray-500">{record.employeeCode}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              )}>
                                {new Date(record.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div>
                                <p className={cn(
                                  'text-sm font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formatTime(record.checkIn)}
                                </p>
                                {record.checkInMethod && (
                                  <p className="text-xs text-gray-500">{record.checkInMethod}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div>
                                <p className={cn(
                                  'text-sm font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formatTime(record.checkOut)}
                                </p>
                                {record.checkOutMethod && (
                                  <p className="text-xs text-gray-500">{record.checkOutMethod}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <p className={cn(
                                'text-sm font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {formatHours(record.workedHours)}
                              </p>
                              {record.overtimeHours > 0 && (
                                <p className="text-xs text-green-600">+{formatHours(record.overtimeHours)} extra</p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? status.bgDark : status.bgLight,
                                theme === 'dark' ? status.textDark : status.textLight
                              )}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {status.label}
                                {record.lateMinutes > 0 && (
                                  <span className="ml-1">({record.lateMinutes}min)</span>
                                )}
                              </span>
                            </td>
                          </motion.tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
