'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Plus,
  RefreshCw,
  Clock,
  Users,
  Sparkles,
  Settings,
  Trash2,
  Edit,
  Check,
  X
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { ShiftCalendar } from '@/components/hr/ShiftCalendar'
import { ShiftPatternForm } from '@/components/hr/ShiftPatternForm'
import { GenerateShiftsModal } from '@/components/hr/GenerateShiftsModal'
import { EmployeeShiftCard } from '@/components/hr/EmployeeShiftCard'

interface ShiftPattern {
  id: number
  name: string
  code: string
  description: string
  workDays: number
  restDays: number
  startTime: string
  endTime: string
  breakMinutes: number
  isActive: boolean
  usageCount: number
  patternLabel: string
}

interface Employee {
  id: number
  name: string
  code: string
  department?: string
}

interface EmployeeShift {
  id: number
  employeeId: number
  employeeName: string
  employeeCode: string
  shiftDate: string
  shiftType: 'work' | 'rest' | 'vacation' | 'sick' | 'leave'
  startTime: string | null
  endTime: string | null
  breakMinutes?: number
  patternId?: number | null
  patternName: string | null
  patternLabel: string | null
  notes?: string
}

export default function SchedulingPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data
  const [patterns, setPatterns] = useState<ShiftPattern[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<EmployeeShift[]>([])

  // UI State
  const [activeTab, setActiveTab] = useState<'calendar' | 'patterns'>('calendar')
  const [showPatternForm, setShowPatternForm] = useState(false)
  const [editingPattern, setEditingPattern] = useState<ShiftPattern | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<EmployeeShift | null>(null)

  // Date range for shifts
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - start.getDay()) // Start of week
    const end = new Date(start)
    end.setDate(end.getDate() + 30) // 30 days ahead

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    }
  })

  const fetchPatterns = useCallback(async () => {
    try {
      const response = await fetch('/api/market/hr/shift-patterns?status=all')
      const result = await response.json()
      if (result.success) {
        setPatterns(result.data)
      }
    } catch (error) {
      console.error('Error fetching patterns:', error)
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      // Fetch employees with active contracts
      const response = await fetch('/api/market/hr/employees?status=active')
      const result = await response.json()
      if (result.success) {
        // API returns { data: { employees: [...] } }
        const employeesList = result.data.employees || result.data || []
        setEmployees(employeesList.map((e: any) => ({
          id: e.id,
          name: e.fullName || e.email || `Employee ${e.id}`,
          code: e.employeeCode || `EMP-${e.id}`,
          department: e.departmentName
        })))
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }, [])

  const fetchShifts = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })
      const response = await fetch(`/api/market/hr/employee-shifts?${params}`)
      const result = await response.json()
      if (result.success) {
        setShifts(result.data)
      }
    } catch (error) {
      console.error('Error fetching shifts:', error)
    }
  }, [dateRange])

  // Track if tables have been initialized this session
  const [tablesInitialized, setTablesInitialized] = useState(false)

  // Initialize HR tables (ensures they exist before fetching)
  const initializeTables = useCallback(async () => {
    if (tablesInitialized) return // Already initialized this session

    try {
      // Always call POST to ensure tables exist (CREATE IF NOT EXISTS is idempotent)
      console.log('Ensuring HR shift tables exist...')
      const response = await fetch('/api/market/hr/init-tables', { method: 'POST' })
      const result = await response.json()
      if (result.success) {
        console.log('HR tables ready')
        setTablesInitialized(true)
      } else {
        console.error('Failed to initialize tables:', result.error)
      }
    } catch (error) {
      console.error('Error initializing HR tables:', error)
    }
  }, [tablesInitialized])

  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    // Ensure tables are initialized first
    await initializeTables()

    await Promise.all([
      fetchPatterns(),
      fetchEmployees(),
      fetchShifts()
    ])

    if (!silent) setLoading(false)
    else setRefreshing(false)
  }, [fetchPatterns, fetchEmployees, fetchShifts, initializeTables])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  const handleDeletePattern = async (pattern: ShiftPattern) => {
    if (!confirm(`¿Eliminar el patron "${pattern.name}"?`)) return

    try {
      const response = await fetch(`/api/market/hr/shift-patterns/${pattern.id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        fetchPatterns()
      } else {
        alert(result.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Error deleting pattern:', error)
      alert('Error al eliminar el patron')
    }
  }

  const handleDeleteShift = async (shift: EmployeeShift) => {
    if (!confirm(`¿Eliminar este turno de ${shift.employeeName}?`)) return

    try {
      const response = await fetch(`/api/market/hr/employee-shifts?id=${shift.id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        setSelectedShift(null)
        fetchShifts()
      } else {
        alert(result.error || 'Error al eliminar')
      }
    } catch (error) {
      console.error('Error deleting shift:', error)
      alert('Error al eliminar el turno')
    }
  }

  // Stats
  const stats = {
    totalPatterns: patterns.length,
    activePatterns: patterns.filter(p => p.isActive).length,
    totalEmployees: employees.length,
    shiftsThisWeek: shifts.filter(s => {
      const shiftDate = new Date(s.shiftDate)
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)
      return shiftDate >= weekStart && shiftDate < weekEnd
    }).length
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
              {/* Patterns */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-purple-900/30 border border-purple-800/50'
                        : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                    )}>
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>Patrones</p>
                      <p className={cn(
                        'text-3xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.activePatterns}</p>
                    </div>
                  </div>
                  <p className={cn(
                    'text-xs mt-3',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  )}>
                    {stats.totalPatterns} total, {stats.activePatterns} activos
                  </p>
                </div>
              </motion.div>

              {/* Employees */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-blue-900/30 border border-blue-800/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                    )}>
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>Empleados</p>
                      <p className={cn(
                        'text-3xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.totalEmployees}</p>
                    </div>
                  </div>
                  <p className={cn(
                    'text-xs mt-3',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  )}>
                    Con contrato activo
                  </p>
                </div>
              </motion.div>

              {/* Shifts this week */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-green-900/30 border border-green-800/50'
                        : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                    )}>
                      <Calendar className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>Esta Semana</p>
                      <p className={cn(
                        'text-3xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.shiftsThisWeek}</p>
                    </div>
                  </div>
                  <p className={cn(
                    'text-xs mt-3',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  )}>
                    Turnos programados
                  </p>
                </div>
              </motion.div>

              {/* Total Shifts */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-amber-900/30 border border-amber-800/50'
                        : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                    )}>
                      <Sparkles className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>Total Turnos</p>
                      <p className={cn(
                        'text-3xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{shifts.length}</p>
                    </div>
                  </div>
                  <p className={cn(
                    'text-xs mt-3',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  )}>
                    En el periodo seleccionado
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => loadAllData(true)}
                disabled={loading || refreshing}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setEditingPattern(null)
                  setShowPatternForm(true)
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25"
              >
                <Plus className="w-5 h-5" />
                Nuevo Patron
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowGenerateModal(true)}
                disabled={patterns.filter(p => p.isActive).length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5" />
                Generar Turnos
              </motion.button>
            </div>

            {/* Tabs */}
            <div className={cn(
              'flex gap-2 p-1.5 rounded-xl w-fit',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <button
                onClick={() => setActiveTab('calendar')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                  activeTab === 'calendar'
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Calendar className="w-4 h-4" />
                Calendario
              </button>
              <button
                onClick={() => setActiveTab('patterns')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                  activeTab === 'patterns'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Clock className="w-4 h-4" />
                Patrones
              </button>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'calendar' ? (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={cn(
                    'rounded-2xl border shadow-xl p-6',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                  )}
                >
                  <ShiftCalendar
                    shifts={shifts}
                    employees={employees}
                    onShiftClick={(shift) => setSelectedShift(shift)}
                    loading={loading}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="patterns"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    'rounded-2xl border shadow-xl overflow-hidden',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                  )}
                >
                  {/* Patterns Header */}
                  <div className={cn(
                    'p-4 border-b',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <h3 className={cn(
                      'font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Patrones de Rotacion
                    </h3>
                  </div>

                  {/* Patterns Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn(
                          'border-b',
                          theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                        )}>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Patron</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Codigo</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Ciclo</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Horario</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Uso</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Estado</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className={cn(
                        'divide-y',
                        theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'
                      )}>
                        {loading ? (
                          [...Array(3)].map((_, i) => (
                            <tr key={i}>
                              <td colSpan={7} className="py-4 px-4">
                                <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                              </td>
                            </tr>
                          ))
                        ) : patterns.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center">
                              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                              <p className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                No hay patrones de rotacion
                              </p>
                              <button
                                onClick={() => {
                                  setEditingPattern(null)
                                  setShowPatternForm(true)
                                }}
                                className="mt-3 text-sm text-purple-500 hover:text-purple-600"
                              >
                                Crear primer patron
                              </button>
                            </td>
                          </tr>
                        ) : (
                          patterns.map((pattern) => (
                            <tr
                              key={pattern.id}
                              className={cn(
                                'transition-colors',
                                !pattern.isActive && 'opacity-60',
                                theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                              )}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    'w-10 h-10 rounded-lg flex items-center justify-center',
                                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                                  )}>
                                    <Clock className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className={cn(
                                      'font-medium',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>
                                      {pattern.name}
                                    </p>
                                    {pattern.description && (
                                      <p className={cn(
                                        'text-xs truncate max-w-[200px]',
                                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                      )}>
                                        {pattern.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={cn(
                                  'text-sm font-mono',
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  {pattern.code || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium',
                                  theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                                )}>
                                  {pattern.patternLabel}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  'text-sm',
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  {pattern.startTime?.slice(0, 5)} - {pattern.endTime?.slice(0, 5)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={cn(
                                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                  theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                                )}>
                                  {pattern.usageCount} turnos
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {pattern.isActive ? (
                                  <span className={cn(
                                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                    theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                                  )}>
                                    <Check className="w-3 h-3" />
                                    Activo
                                  </span>
                                ) : (
                                  <span className={cn(
                                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                    theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                                  )}>
                                    <X className="w-3 h-3" />
                                    Inactivo
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                      setEditingPattern(pattern)
                                      setShowPatternForm(true)
                                    }}
                                    className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Editar"
                                  >
                                    <Edit className="w-4 h-4 text-blue-500" />
                                  </motion.button>
                                  {pattern.usageCount === 0 && (
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleDeletePattern(pattern)}
                                      className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </motion.button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Modals */}
            <AnimatePresence>
              {showPatternForm && (
                <ShiftPatternForm
                  pattern={editingPattern}
                  onClose={() => {
                    setShowPatternForm(false)
                    setEditingPattern(null)
                  }}
                  onSave={() => {
                    fetchPatterns()
                    setShowPatternForm(false)
                    setEditingPattern(null)
                  }}
                />
              )}

              {showGenerateModal && (
                <GenerateShiftsModal
                  patterns={patterns.filter(p => p.isActive)}
                  employees={employees}
                  onClose={() => setShowGenerateModal(false)}
                  onGenerate={() => {
                    fetchShifts()
                  }}
                />
              )}

              {selectedShift && (
                <EmployeeShiftCard
                  shift={selectedShift}
                  onClose={() => setSelectedShift(null)}
                  onDelete={handleDeleteShift}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
