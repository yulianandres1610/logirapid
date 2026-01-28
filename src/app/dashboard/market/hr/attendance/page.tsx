'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

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

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  present: { label: 'Presente', color: 'green', icon: CheckCircle },
  late: { label: 'Tardanza', color: 'amber', icon: AlertTriangle },
  absent: { label: 'Ausente', color: 'red', icon: XCircle },
  half_day: { label: 'Medio día', color: 'blue', icon: Clock },
  holiday: { label: 'Feriado', color: 'purple', icon: Calendar }
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
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
      const response = await fetch('/api/market/accounting/employees?status=active')
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

  const fetchAttendance = async () => {
    try {
      setLoading(true)
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
      setLoading(false)
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
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Calendar className="w-8 h-8 text-emerald-600" />
                Control de Asistencia
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Registro de entradas y salidas del personal
              </p>
            </div>
          </motion.div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Date Navigation */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl p-2 shadow">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-4 font-medium text-gray-900 dark:text-white min-w-[200px] text-center">
                {getDateLabel()}
              </span>
              <button
                onClick={() => navigateDate('next')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 shadow">
              {(['day', 'week', 'month'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-emerald-500 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
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
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Todos los empleados</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
            >
              Hoy
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.present}</p>
                  <p className="text-sm text-gray-500">Presentes</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.late}</p>
                  <p className="text-sm text-gray-500">Tardanzas</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.absent}</p>
                  <p className="text-sm text-gray-500">Ausentes</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatHours(summary.totalHours)}</p>
                  <p className="text-sm text-gray-500">Total horas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
              </div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Sin registros
                </h3>
                <p className="text-gray-500">
                  No hay registros de asistencia para este período
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Empleado
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Entrada
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Salida
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Horas
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {records.map((record, idx) => {
                      const status = statusConfig[record.status] || statusConfig.present
                      const StatusIcon = status.icon

                      return (
                        <motion.tr
                          key={record.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-medium text-sm">
                                {record.employeeName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {record.employeeName}
                                </p>
                                <p className="text-xs text-gray-500">{record.employeeCode}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                            {new Date(record.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatTime(record.checkIn)}
                              </p>
                              {record.checkInMethod && (
                                <p className="text-xs text-gray-500">{record.checkInMethod}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatTime(record.checkOut)}
                              </p>
                              {record.checkOutMethod && (
                                <p className="text-xs text-gray-500">{record.checkOutMethod}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatHours(record.workedHours)}
                            </p>
                            {record.overtimeHours > 0 && (
                              <p className="text-xs text-green-600">+{formatHours(record.overtimeHours)} extra</p>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-${status.color}-100 dark:bg-${status.color}-900/30 text-${status.color}-700 dark:text-${status.color}-400`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {status.label}
                              {record.lateMinutes > 0 && (
                                <span className="ml-1">({record.lateMinutes}min)</span>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
