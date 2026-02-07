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
  Trash2,
  Edit,
  Check,
  X,
  AlertCircle,
  UserCheck,
  UserX,
  ChevronRight,
  CalendarDays,
  LayoutGrid
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
  hasRotatingShifts?: boolean
  hasFixedSchedule?: boolean
  currentPattern?: string
  shiftsCount?: number
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

type TabType = 'employees' | 'calendar' | 'patterns'

export default function SchedulingPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data
  const [patterns, setPatterns] = useState<ShiftPattern[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<EmployeeShift[]>([])

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('employees')
  const [showPatternForm, setShowPatternForm] = useState(false)
  const [editingPattern, setEditingPattern] = useState<ShiftPattern | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState<EmployeeShift | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([])

  // Date range for shifts
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - start.getDay())
    const end = new Date(start)
    end.setDate(end.getDate() + 30)

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
      const response = await fetch('/api/market/hr/employees?status=active')
      const result = await response.json()
      if (result.success) {
        const employeesList = result.data.employees || result.data || []
        setEmployees(employeesList.map((e: any) => ({
          id: e.id,
          name: e.fullName || e.email || `Employee ${e.id}`,
          code: e.employeeCode || `EMP-${e.id}`,
          department: e.departmentName,
          hasRotatingShifts: false,
          hasFixedSchedule: !!e.scheduleId,
          currentPattern: null,
          shiftsCount: 0
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

        // Update employees with shift info
        const shiftsByEmployee = new Map<number, { pattern: string | null, count: number }>()
        result.data.forEach((s: EmployeeShift) => {
          const existing = shiftsByEmployee.get(s.employeeId) || { pattern: null, count: 0 }
          shiftsByEmployee.set(s.employeeId, {
            pattern: s.patternName || existing.pattern,
            count: existing.count + 1
          })
        })

        setEmployees(prev => prev.map(emp => {
          const shiftInfo = shiftsByEmployee.get(emp.id)
          return {
            ...emp,
            hasRotatingShifts: !!shiftInfo && shiftInfo.count > 0,
            currentPattern: shiftInfo?.pattern || null,
            shiftsCount: shiftInfo?.count || 0
          }
        }))
      }
    } catch (error) {
      console.error('Error fetching shifts:', error)
    }
  }, [dateRange])

  const [tablesInitialized, setTablesInitialized] = useState(false)

  const initializeTables = useCallback(async () => {
    if (tablesInitialized) return

    try {
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
    if (!confirm(`¿Eliminar el patrón "${pattern.name}"?`)) return

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
      alert('Error al eliminar el patrón')
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

  const handleQuickAssign = (employeeIds: number[]) => {
    setSelectedEmployees(employeeIds)
    setShowGenerateModal(true)
  }

  // Stats
  const employeesWithShifts = employees.filter(e => e.hasRotatingShifts).length
  const employeesWithFixedOnly = employees.filter(e => !e.hasRotatingShifts && e.hasFixedSchedule).length
  const employeesWithoutSchedule = employees.filter(e => !e.hasRotatingShifts && !e.hasFixedSchedule).length

  const stats = {
    totalPatterns: patterns.length,
    activePatterns: patterns.filter(p => p.isActive).length,
    totalEmployees: employees.length,
    employeesWithShifts,
    employeesWithFixedOnly,
    employeesWithoutSchedule,
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

  const tabs = [
    { id: 'employees' as TabType, label: 'Empleados', icon: Users, count: employees.length },
    { id: 'calendar' as TabType, label: 'Calendario', icon: CalendarDays, count: null },
    { id: 'patterns' as TabType, label: 'Patrones', icon: LayoutGrid, count: stats.activePatterns }
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Planificación de Horarios
                </h1>
                <p className={cn(
                  'text-sm mt-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Gestiona los turnos rotativos y horarios de tus empleados
                </p>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => loadAllData(true)}
                  disabled={loading || refreshing}
                  className={cn(
                    'p-2.5 rounded-xl transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setEditingPattern(null)
                    setShowPatternForm(true)
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nuevo Patrón</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedEmployees([])
                    setShowGenerateModal(true)
                  }}
                  disabled={patterns.filter(p => p.isActive).length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                  <span className="hidden sm:inline">Generar Turnos</span>
                </motion.button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard
                theme={theme}
                icon={<UserCheck className="w-5 h-5 text-green-500" />}
                label="Con Turnos Rotativos"
                value={employeesWithShifts}
                color="green"
                subtitle={`${shifts.length} turnos asignados`}
              />
              <StatsCard
                theme={theme}
                icon={<Clock className="w-5 h-5 text-blue-500" />}
                label="Horario Fijo"
                value={employeesWithFixedOnly}
                color="blue"
                subtitle="Solo horario semanal"
              />
              <StatsCard
                theme={theme}
                icon={<UserX className="w-5 h-5 text-amber-500" />}
                label="Sin Horario"
                value={employeesWithoutSchedule}
                color="amber"
                subtitle={employeesWithoutSchedule > 0 ? "Necesitan asignación" : "Todos asignados"}
              />
              <StatsCard
                theme={theme}
                icon={<LayoutGrid className="w-5 h-5 text-purple-500" />}
                label="Patrones Activos"
                value={stats.activePatterns}
                color="purple"
                subtitle={`${stats.totalPatterns} total`}
              />
            </div>

            {/* Alert for employees without schedule */}
            {employeesWithoutSchedule > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border',
                  theme === 'dark'
                    ? 'bg-amber-900/20 border-amber-800/50'
                    : 'bg-amber-50 border-amber-200'
                )}
              >
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-amber-300' : 'text-amber-800'
                  )}>
                    {employeesWithoutSchedule} empleado{employeesWithoutSchedule > 1 ? 's' : ''} sin horario asignado
                  </p>
                  <p className={cn(
                    'text-xs mt-0.5',
                    theme === 'dark' ? 'text-amber-400/70' : 'text-amber-600'
                  )}>
                    El kiosco no podrá calcular tardanzas para estos empleados
                  </p>
                </div>
                <button
                  onClick={() => {
                    const empIds = employees.filter(e => !e.hasRotatingShifts && !e.hasFixedSchedule).map(e => e.id)
                    handleQuickAssign(empIds)
                  }}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    theme === 'dark'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  )}
                >
                  Asignar Turnos
                </button>
              </motion.div>
            )}

            {/* Tabs */}
            <div className={cn(
              'flex gap-1 p-1 rounded-xl w-fit',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
                    activeTab === tab.id
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white'
                        : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== null && (
                    <span className={cn(
                      'px-1.5 py-0.5 text-xs rounded-md',
                      activeTab === tab.id
                        ? 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'employees' && (
                <EmployeesTab
                  key="employees"
                  theme={theme}
                  employees={employees}
                  patterns={patterns}
                  loading={loading}
                  onAssignShifts={handleQuickAssign}
                />
              )}

              {activeTab === 'calendar' && (
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
              )}

              {activeTab === 'patterns' && (
                <PatternsTab
                  key="patterns"
                  theme={theme}
                  patterns={patterns}
                  loading={loading}
                  onEdit={(pattern) => {
                    setEditingPattern(pattern)
                    setShowPatternForm(true)
                  }}
                  onDelete={handleDeletePattern}
                  onCreateNew={() => {
                    setEditingPattern(null)
                    setShowPatternForm(true)
                  }}
                />
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
                  preSelectedEmployees={selectedEmployees}
                  onClose={() => {
                    setShowGenerateModal(false)
                    setSelectedEmployees([])
                  }}
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

// Stats Card Component
function StatsCard({
  theme,
  icon,
  label,
  value,
  color,
  subtitle
}: {
  theme: string
  icon: React.ReactNode
  label: string
  value: number
  color: 'green' | 'blue' | 'amber' | 'purple'
  subtitle?: string
}) {
  const colors = {
    green: 'from-green-400 to-green-600',
    blue: 'from-blue-400 to-blue-600',
    amber: 'from-amber-400 to-orange-500',
    purple: 'from-purple-400 to-purple-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-xl border p-4',
        theme === 'dark'
          ? 'bg-gray-800/50 border-gray-700'
          : 'bg-white border-gray-200'
      )}
    >
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${colors[color]}`} />
      <div className="flex items-center gap-3">
        <div className={cn(
          'p-2 rounded-lg',
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
        )}>
          {icon}
        </div>
        <div>
          <p className={cn(
            'text-2xl font-bold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {value}
          </p>
          <p className={cn(
            'text-xs',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            {label}
          </p>
        </div>
      </div>
      {subtitle && (
        <p className={cn(
          'text-xs mt-2',
          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
        )}>
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}

// Employees Tab Component
function EmployeesTab({
  theme,
  employees,
  patterns,
  loading,
  onAssignShifts
}: {
  theme: string
  employees: Employee[]
  patterns: ShiftPattern[]
  loading: boolean
  onAssignShifts: (ids: number[]) => void
}) {
  const [filter, setFilter] = useState<'all' | 'with-shifts' | 'fixed' | 'none'>('all')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const filteredEmployees = employees.filter(e => {
    switch (filter) {
      case 'with-shifts': return e.hasRotatingShifts
      case 'fixed': return !e.hasRotatingShifts && e.hasFixedSchedule
      case 'none': return !e.hasRotatingShifts && !e.hasFixedSchedule
      default: return true
    }
  })

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredEmployees.map(e => e.id))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        'rounded-2xl border shadow-xl overflow-hidden',
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
          : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between p-4 border-b',
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      )}>
        <div className="flex items-center gap-3">
          <h3 className={cn(
            'font-semibold',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Estado de Horarios por Empleado
          </h3>

          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className={cn(
              'text-sm px-3 py-1.5 rounded-lg border',
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300 text-gray-700'
            )}
          >
            <option value="all">Todos</option>
            <option value="with-shifts">Con turnos rotativos</option>
            <option value="fixed">Solo horario fijo</option>
            <option value="none">Sin horario</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <button
            onClick={() => onAssignShifts(selectedIds)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Asignar Turnos ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={cn(
              'border-b',
              theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
            )}>
              <th className="text-left py-3 px-4 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Empleado</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Departamento</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Patrón Actual</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Turnos</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className={cn(
            'divide-y',
            theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'
          )}>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="py-4 px-4">
                    <div className="animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                  </td>
                </tr>
              ))
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className={cn(
                    'text-sm',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}>
                    No hay empleados con este filtro
                  </p>
                </td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr
                  key={employee.id}
                  className={cn(
                    'transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                  )}
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(employee.id)}
                      onChange={() => toggleSelect(employee.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium',
                        theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
                      )}>
                        {employee.name.charAt(0)}
                      </div>
                      <div>
                        <p className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {employee.name}
                        </p>
                        <p className={cn(
                          'text-xs',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          {employee.code}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      {employee.department || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {employee.hasRotatingShifts ? (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                        theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                      )}>
                        <Check className="w-3 h-3" />
                        Rotativo
                      </span>
                    ) : employee.hasFixedSchedule ? (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                        theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                      )}>
                        <Clock className="w-3 h-3" />
                        Fijo
                      </span>
                    ) : (
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                        theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'
                      )}>
                        <AlertCircle className="w-3 h-3" />
                        Sin Horario
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      {employee.currentPattern || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      {employee.shiftsCount || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onAssignShifts([employee.id])}
                      className={cn(
                        'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                        theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      )}
                    >
                      <Sparkles className="w-3 h-3" />
                      Asignar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

// Patterns Tab Component
function PatternsTab({
  theme,
  patterns,
  loading,
  onEdit,
  onDelete,
  onCreateNew
}: {
  theme: string
  patterns: ShiftPattern[]
  loading: boolean
  onEdit: (pattern: ShiftPattern) => void
  onDelete: (pattern: ShiftPattern) => void
  onCreateNew: () => void
}) {
  return (
    <motion.div
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
      {/* Header */}
      <div className={cn(
        'p-4 border-b',
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      )}>
        <h3 className={cn(
          'font-semibold',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          Patrones de Rotación
        </h3>
        <p className={cn(
          'text-xs mt-1',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        )}>
          Define los ciclos de trabajo y descanso (ej: 2x2, 4x2, 5x2)
        </p>
      </div>

      {/* Grid */}
      <div className="p-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        ) : patterns.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className={cn(
              'text-sm mb-4',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              No hay patrones de rotación creados
            </p>
            <button
              onClick={onCreateNew}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all"
            >
              Crear Primer Patrón
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patterns.map((pattern) => (
              <motion.div
                key={pattern.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'relative rounded-xl border p-4 transition-all',
                  !pattern.isActive && 'opacity-60',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                )}
              >
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  {pattern.isActive ? (
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                    )}>
                      <Check className="w-3 h-3" />
                      Activo
                    </span>
                  ) : (
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                    )}>
                      <X className="w-3 h-3" />
                      Inactivo
                    </span>
                  )}
                </div>

                {/* Pattern Info */}
                <div className="flex items-start gap-3 mb-4">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <span className="text-lg font-bold text-purple-600">
                      {pattern.patternLabel}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={cn(
                      'font-semibold truncate',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {pattern.name}
                    </h4>
                    {pattern.code && (
                      <p className={cn(
                        'text-xs font-mono',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        {pattern.code}
                      </p>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                      Horario:
                    </span>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {pattern.startTime?.slice(0, 5)} - {pattern.endTime?.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                      Ciclo:
                    </span>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {pattern.workDays} trabajo / {pattern.restDays} descanso
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                      En uso:
                    </span>
                    <span className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {pattern.usageCount} turnos
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(pattern)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 py-2 text-sm font-medium rounded-lg transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  {pattern.usageCount === 0 && (
                    <button
                      onClick={() => onDelete(pattern)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        theme === 'dark'
                          ? 'bg-red-900/30 hover:bg-red-900/50 text-red-400'
                          : 'bg-red-100 hover:bg-red-200 text-red-600'
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
