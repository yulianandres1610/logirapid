'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Clock,
  Users,
  Sparkles,
  X,
  Check,
  Calendar,
  Sun,
  Moon,
  Palmtree,
  Thermometer,
  Coffee,
  Settings,
  Search,
  Filter
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { ShiftPatternForm } from '@/components/hr/ShiftPatternForm'

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
  photoUrl?: string
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

interface FixedSchedule {
  id: number
  name: string
  weeklyHours: number
  days: {
    dayOfWeek: number
    startTime: string | null
    endTime: string | null
    isWorkDay: boolean
  }[]
}

type ShiftTypeValue = 'work' | 'rest' | 'vacation' | 'sick' | 'leave'

const SHIFT_TYPES: Array<{
  value: ShiftTypeValue
  label: string
  icon: typeof Sun
  color: string
  textColor: string
}> = [
  { value: 'work', label: 'Trabajo', icon: Sun, color: 'bg-green-500', textColor: 'text-green-500' },
  { value: 'rest', label: 'Descanso', icon: Moon, color: 'bg-gray-400', textColor: 'text-gray-400' },
  { value: 'vacation', label: 'Vacaciones', icon: Palmtree, color: 'bg-blue-500', textColor: 'text-blue-500' },
  { value: 'sick', label: 'Enfermedad', icon: Thermometer, color: 'bg-red-500', textColor: 'text-red-500' },
  { value: 'leave', label: 'Permiso', icon: Coffee, color: 'bg-amber-500', textColor: 'text-amber-500' }
]

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function SchedulingPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data
  const [patterns, setPatterns] = useState<ShiftPattern[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [shifts, setShifts] = useState<EmployeeShift[]>([])
  const [fixedSchedules, setFixedSchedules] = useState<FixedSchedule[]>([])

  // UI State
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedShift, setSelectedShift] = useState<EmployeeShift | null>(null)
  const [showPatternForm, setShowPatternForm] = useState(false)
  const [showShiftEditor, setShowShiftEditor] = useState(false)
  const [showPatternManager, setShowPatternManager] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [tablesInitialized, setTablesInitialized] = useState(false)

  // Week dates
  const weekDates = useMemo(() => {
    const dates: Date[] = []
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    startOfWeek.setDate(startOfWeek.getDate() - day)

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      dates.push(date)
    }
    return dates
  }, [currentDate])

  // Date range for API calls
  const dateRange = useMemo(() => ({
    startDate: weekDates[0].toISOString().split('T')[0],
    endDate: weekDates[6].toISOString().split('T')[0]
  }), [weekDates])

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees
    const term = searchTerm.toLowerCase()
    return employees.filter(e =>
      e.name.toLowerCase().includes(term) ||
      e.code.toLowerCase().includes(term) ||
      e.department?.toLowerCase().includes(term)
    )
  }, [employees, searchTerm])

  // Shifts map for quick lookup
  const shiftsMap = useMemo(() => {
    const map = new Map<string, EmployeeShift>()
    shifts.forEach(shift => {
      const key = `${shift.employeeId}-${shift.shiftDate}`
      map.set(key, shift)
    })
    return map
  }, [shifts])

  // API calls
  const fetchPatterns = useCallback(async () => {
    try {
      const response = await fetch('/api/market/hr/shift-patterns?status=all')
      const result = await response.json()
      if (result.success) setPatterns(result.data)
    } catch (error) {
      console.error('Error fetching patterns:', error)
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch('/api/market/hr/employees?status=active')
      const result = await response.json()
      if (result.success) {
        const list = result.data.employees || result.data || []
        setEmployees(list.map((e: any) => ({
          id: e.id,
          name: e.fullName || e.email || `Empleado ${e.id}`,
          code: e.employeeCode || `EMP-${e.id}`,
          department: e.departmentName,
          photoUrl: e.photoUrl
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
      if (result.success) setShifts(result.data)
    } catch (error) {
      console.error('Error fetching shifts:', error)
    }
  }, [dateRange])

  const fetchFixedSchedules = useCallback(async () => {
    try {
      const response = await fetch('/api/market/hr/schedules?status=active')
      const result = await response.json()
      if (result.success) setFixedSchedules(result.data)
    } catch (error) {
      console.error('Error fetching schedules:', error)
    }
  }, [])

  const initializeTables = useCallback(async () => {
    if (tablesInitialized) return
    try {
      await fetch('/api/market/hr/init-tables', { method: 'POST' })
      setTablesInitialized(true)
    } catch (error) {
      console.error('Error initializing tables:', error)
    }
  }, [tablesInitialized])

  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    await initializeTables()
    await Promise.all([fetchPatterns(), fetchEmployees(), fetchShifts(), fetchFixedSchedules()])

    if (!silent) setLoading(false)
    else setRefreshing(false)
  }, [fetchPatterns, fetchEmployees, fetchShifts, fetchFixedSchedules, initializeTables])

  useEffect(() => {
    loadAllData()
  }, []) // eslint-disable-line

  useEffect(() => {
    if (tablesInitialized) fetchShifts()
  }, [dateRange, tablesInitialized]) // eslint-disable-line

  // Navigation
  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + (direction * 7))
    setCurrentDate(newDate)
  }

  const goToToday = () => setCurrentDate(new Date())

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString()

  const formatWeekRange = () => {
    const start = weekDates[0]
    const end = weekDates[6]
    const startMonth = start.toLocaleDateString('es-ES', { month: 'short' })
    const endMonth = end.toLocaleDateString('es-ES', { month: 'short' })
    const year = end.getFullYear()

    if (startMonth === endMonth) {
      return `${start.getDate()} - ${end.getDate()} ${startMonth} ${year}`
    }
    return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} ${year}`
  }

  // Handle cell click
  const handleCellClick = (employee: Employee, date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    const existingShift = shiftsMap.get(`${employee.id}-${dateStr}`)

    setSelectedEmployee(employee)
    setSelectedDate(dateStr)
    setSelectedShift(existingShift || null)
    setShowShiftEditor(true)
  }

  // Save shift
  const saveShift = async (shiftType: string, startTime?: string, endTime?: string, notes?: string) => {
    if (!selectedEmployee || !selectedDate) return

    try {
      const body: any = {
        employeeId: selectedEmployee.id,
        shiftDate: selectedDate,
        shiftType,
        notes: notes || null
      }

      if (shiftType === 'work' && startTime && endTime) {
        body.startTime = startTime
        body.endTime = endTime
      }

      const response = await fetch('/api/market/hr/employee-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const result = await response.json()
      if (result.success) {
        fetchShifts()
        setShowShiftEditor(false)
      } else {
        alert(result.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error saving shift:', error)
      alert('Error al guardar el turno')
    }
  }

  // Delete shift
  const deleteShift = async () => {
    if (!selectedShift) return

    try {
      const response = await fetch(`/api/market/hr/employee-shifts?id=${selectedShift.id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        fetchShifts()
        setShowShiftEditor(false)
      }
    } catch (error) {
      console.error('Error deleting shift:', error)
    }
  }

  // Delete pattern
  const deletePattern = async (pattern: ShiftPattern) => {
    if (!confirm(`¿Eliminar "${pattern.name}"?`)) return

    try {
      const response = await fetch(`/api/market/hr/shift-patterns/${pattern.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) fetchPatterns()
      else alert(result.error || 'Error al eliminar')
    } catch (error) {
      alert('Error al eliminar')
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          'min-h-screen',
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          {/* Header Bar */}
          <div className={cn(
            'sticky top-0 z-20 border-b px-4 py-3',
            theme === 'dark' ? 'bg-gray-900/95 border-gray-800 backdrop-blur-sm' : 'bg-white/95 border-gray-200 backdrop-blur-sm'
          )}>
            <div className="flex items-center justify-between gap-4">
              {/* Week Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateWeek(-1)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToToday}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                    theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Hoy
                </button>
                <button
                  onClick={() => navigateWeek(1)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <span className={cn(
                  'text-lg font-semibold ml-2',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {formatWeekRange()}
                </span>
              </div>

              {/* Search & Actions */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className={cn(
                    'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )} />
                  <input
                    type="text"
                    placeholder="Buscar empleado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn(
                      'pl-9 pr-4 py-2 w-48 text-sm rounded-lg border',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
                    )}
                  />
                </div>

                <button
                  onClick={() => loadAllData(true)}
                  disabled={refreshing}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
                </button>

                <button
                  onClick={() => setShowPatternManager(true)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Patrones</span>
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-4">
            <div className={cn(
              'rounded-xl border overflow-hidden',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              {/* Calendar Header */}
              <div className={cn(
                'grid border-b',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              )} style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
                <div className={cn(
                  'p-3 border-r flex items-center gap-2',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  )}>
                    {filteredEmployees.length} empleados
                  </span>
                </div>
                {weekDates.map((date, i) => (
                  <div
                    key={i}
                    className={cn(
                      'p-3 text-center border-r last:border-r-0',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
                      isToday(date) && 'bg-green-500/10'
                    )}
                  >
                    <div className={cn(
                      'text-xs font-medium uppercase',
                      isToday(date) ? 'text-green-500' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      {DAY_NAMES[date.getDay()]}
                    </div>
                    <div className={cn(
                      'text-lg font-bold mt-0.5',
                      isToday(date) ? 'text-green-500' : theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {date.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Employee Rows */}
              <div className={cn(
                'divide-y max-h-[calc(100vh-220px)] overflow-y-auto',
                theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'
              )}>
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <div key={i} className="grid animate-pulse" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
                      <div className={cn('p-3 border-r', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                      </div>
                      {[...Array(7)].map((_, j) => (
                        <div key={j} className={cn('p-2 border-r last:border-r-0', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                      ))}
                    </div>
                  ))
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {searchTerm ? 'No se encontraron empleados' : 'No hay empleados activos'}
                    </p>
                  </div>
                ) : (
                  filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="grid"
                      style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
                    >
                      {/* Employee Info */}
                      <div className={cn(
                        'p-2 border-r flex items-center gap-2',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0',
                          theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
                        )}>
                          {employee.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className={cn(
                            'text-sm font-medium truncate',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {employee.name}
                          </p>
                          <p className={cn(
                            'text-xs truncate',
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )}>
                            {employee.department || employee.code}
                          </p>
                        </div>
                      </div>

                      {/* Shift Cells */}
                      {weekDates.map((date) => {
                        const dateStr = date.toISOString().split('T')[0]
                        const shift = shiftsMap.get(`${employee.id}-${dateStr}`)
                        const shiftConfig = shift ? SHIFT_TYPES.find(t => t.value === shift.shiftType) : null

                        return (
                          <div
                            key={dateStr}
                            onClick={() => handleCellClick(employee, date)}
                            className={cn(
                              'p-1 border-r last:border-r-0 min-h-[52px] cursor-pointer transition-colors',
                              theme === 'dark' ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50',
                              isToday(date) && 'bg-green-500/5'
                            )}
                          >
                            {shift ? (
                              <div className={cn(
                                'w-full h-full rounded-lg p-1.5 text-white text-xs',
                                shiftConfig?.color || 'bg-gray-500'
                              )}>
                                {shift.shiftType === 'work' && shift.startTime && shift.endTime ? (
                                  <div>
                                    <div className="font-medium">
                                      {shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)}
                                    </div>
                                    {shift.patternLabel && (
                                      <div className="opacity-75 text-[10px]">{shift.patternLabel}</div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    {shiftConfig && <shiftConfig.icon className="w-4 h-4" />}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className={cn(
                                'w-full h-full rounded-lg border-2 border-dashed flex items-center justify-center',
                                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                              )}>
                                <Plus className={cn(
                                  'w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity',
                                  theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                                )} />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4">
              {SHIFT_TYPES.map((type) => (
                <div key={type.value} className="flex items-center gap-1.5">
                  <div className={cn('w-3 h-3 rounded', type.color)} />
                  <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    {type.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Shift Editor Modal */}
          <AnimatePresence>
            {showShiftEditor && selectedEmployee && selectedDate && (
              <ShiftEditorModal
                theme={theme}
                employee={selectedEmployee}
                date={selectedDate}
                shift={selectedShift}
                patterns={patterns.filter(p => p.isActive)}
                onClose={() => setShowShiftEditor(false)}
                onSave={saveShift}
                onDelete={deleteShift}
              />
            )}
          </AnimatePresence>

          {/* Pattern Manager Modal */}
          <AnimatePresence>
            {showPatternManager && (
              <PatternManagerModal
                theme={theme}
                patterns={patterns}
                employees={employees}
                onClose={() => setShowPatternManager(false)}
                onCreatePattern={() => {
                  setShowPatternManager(false)
                  setShowPatternForm(true)
                }}
                onDeletePattern={deletePattern}
                onRefresh={() => {
                  fetchPatterns()
                  fetchShifts()
                }}
              />
            )}
          </AnimatePresence>

          {/* Pattern Form Modal */}
          <AnimatePresence>
            {showPatternForm && (
              <ShiftPatternForm
                pattern={null}
                onClose={() => setShowPatternForm(false)}
                onSave={() => {
                  fetchPatterns()
                  setShowPatternForm(false)
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

// Shift Editor Modal Component
function ShiftEditorModal({
  theme,
  employee,
  date,
  shift,
  patterns,
  onClose,
  onSave,
  onDelete
}: {
  theme: string
  employee: Employee
  date: string
  shift: EmployeeShift | null
  patterns: ShiftPattern[]
  onClose: () => void
  onSave: (shiftType: string, startTime?: string, endTime?: string, notes?: string) => void
  onDelete: () => void
}) {
  const [shiftType, setShiftType] = useState<ShiftTypeValue>(shift?.shiftType || 'work')
  const [startTime, setStartTime] = useState(shift?.startTime?.slice(0, 5) || '08:00')
  const [endTime, setEndTime] = useState(shift?.endTime?.slice(0, 5) || '16:00')
  const [notes, setNotes] = useState(shift?.notes || '')
  const [saving, setSaving] = useState(false)

  const dateObj = new Date(date + 'T12:00:00')
  const dayName = DAY_NAMES_FULL[dateObj.getDay()]
  const formattedDate = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const handleSave = async () => {
    setSaving(true)
    await onSave(
      shiftType,
      shiftType === 'work' ? startTime : undefined,
      shiftType === 'work' ? endTime : undefined,
      notes || undefined
    )
    setSaving(false)
  }

  const applyPattern = (pattern: ShiftPattern) => {
    setShiftType('work')
    setStartTime(pattern.startTime.slice(0, 5))
    setEndTime(pattern.endTime.slice(0, 5))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          'rounded-2xl shadow-2xl w-full max-w-md overflow-hidden',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}
      >
        {/* Header */}
        <div className={cn(
          'p-4 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          <div>
            <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              {employee.name}
            </h3>
            <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {dayName}, {formattedDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className={cn('p-2 rounded-lg', theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Shift Type */}
          <div>
            <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Tipo de turno
            </label>
            <div className="grid grid-cols-5 gap-2">
              {SHIFT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setShiftType(type.value)}
                  className={cn(
                    'p-2 rounded-lg border-2 flex flex-col items-center gap-1 transition-all',
                    shiftType === type.value
                      ? `${type.color} border-transparent text-white`
                      : theme === 'dark'
                        ? 'border-gray-700 hover:border-gray-600'
                        : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <type.icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time inputs (only for work) */}
          {shiftType === 'work' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Entrada
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white'
                        : 'bg-white border-gray-200 text-gray-900'
                    )}
                  />
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Salida
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white'
                        : 'bg-white border-gray-200 text-gray-900'
                    )}
                  />
                </div>
              </div>

              {/* Quick patterns */}
              {patterns.length > 0 && (
                <div>
                  <label className={cn('block text-xs font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    Aplicar patrón
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {patterns.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyPattern(p)}
                        className={cn(
                          'px-2 py-1 text-xs rounded-md transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        {p.patternLabel} ({p.startTime.slice(0, 5)}-{p.endTime.slice(0, 5)})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Notes */}
          <div>
            <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Notas
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional..."
              className={cn(
                'w-full px-3 py-2 rounded-lg border',
                theme === 'dark'
                  ? 'bg-gray-900 border-gray-700 text-white placeholder:text-gray-600'
                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
              )}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          'p-4 border-t flex items-center gap-2',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          {shift && (
            <button
              onClick={onDelete}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                theme === 'dark'
                  ? 'text-red-400 hover:bg-red-900/30'
                  : 'text-red-600 hover:bg-red-50'
              )}
            >
              Eliminar
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            )}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// Pattern Manager Modal
function PatternManagerModal({
  theme,
  patterns,
  employees,
  onClose,
  onCreatePattern,
  onDeletePattern,
  onRefresh
}: {
  theme: string
  patterns: ShiftPattern[]
  employees: Employee[]
  onClose: () => void
  onCreatePattern: () => void
  onDeletePattern: (pattern: ShiftPattern) => void
  onRefresh: () => void
}) {
  const [selectedPattern, setSelectedPattern] = useState<ShiftPattern | null>(null)
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([])
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [firstWorkDay, setFirstWorkDay] = useState(new Date().toISOString().split('T')[0])
  const [generating, setGenerating] = useState(false)

  const toggleEmployee = (id: number) => {
    setSelectedEmployees(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const generateShifts = async () => {
    if (!selectedPattern || selectedEmployees.length === 0) return

    setGenerating(true)
    try {
      const response = await fetch('/api/market/hr/employee-shifts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patternId: selectedPattern.id,
          employeeIds: selectedEmployees,
          startDate,
          endDate,
          firstWorkDay,
          overwrite: true
        })
      })

      const result = await response.json()
      if (result.success) {
        alert(`Turnos generados: ${result.data.shiftsCreated} creados, ${result.data.shiftsUpdated} actualizados`)
        onRefresh()
        onClose()
      } else {
        alert(result.error || 'Error al generar')
      }
    } catch (error) {
      alert('Error al generar turnos')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          'rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}
      >
        {/* Header */}
        <div className={cn(
          'p-4 border-b flex items-center justify-between flex-shrink-0',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          <h3 className={cn('font-semibold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Patrones y Generación
          </h3>
          <button
            onClick={onClose}
            className={cn('p-2 rounded-lg', theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Patterns List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Patrones de Rotación
              </h4>
              <button
                onClick={onCreatePattern}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                <Plus className="w-4 h-4" />
                Nuevo
              </button>
            </div>

            {patterns.length === 0 ? (
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                No hay patrones creados
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    onClick={() => setSelectedPattern(pattern)}
                    className={cn(
                      'p-3 rounded-lg border-2 cursor-pointer transition-all',
                      selectedPattern?.id === pattern.id
                        ? 'border-green-500 bg-green-500/10'
                        : theme === 'dark'
                          ? 'border-gray-700 hover:border-gray-600'
                          : 'border-gray-200 hover:border-gray-300',
                      !pattern.isActive && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-bold rounded',
                          theme === 'dark' ? 'bg-purple-900/50 text-purple-400' : 'bg-purple-100 text-purple-700'
                        )}>
                          {pattern.patternLabel}
                        </span>
                        <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {pattern.name}
                        </span>
                      </div>
                      {pattern.usageCount === 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeletePattern(pattern) }}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      )}
                    </div>
                    <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      {pattern.startTime?.slice(0, 5)} - {pattern.endTime?.slice(0, 5)} • {pattern.usageCount} turnos
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate Section */}
          {selectedPattern && (
            <>
              <hr className={theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} />

              <div>
                <h4 className={cn('font-medium mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Generar turnos con: <span className="text-green-500">{selectedPattern.name}</span>
                </h4>

                {/* Dates */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className={cn('block text-xs mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Inicio
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-lg border',
                        theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-xs mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Fin
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-lg border',
                        theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-xs mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      1er día trabajo
                    </label>
                    <input
                      type="date"
                      value={firstWorkDay}
                      onChange={(e) => setFirstWorkDay(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-lg border',
                        theme === 'dark' ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'
                      )}
                    />
                  </div>
                </div>

                {/* Employees */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Empleados ({selectedEmployees.length})
                    </label>
                    <button
                      onClick={() => setSelectedEmployees(
                        selectedEmployees.length === employees.length ? [] : employees.map(e => e.id)
                      )}
                      className="text-xs text-green-500 hover:text-green-600"
                    >
                      {selectedEmployees.length === employees.length ? 'Ninguno' : 'Todos'}
                    </button>
                  </div>
                  <div className={cn(
                    'max-h-32 overflow-y-auto rounded-lg border p-1 grid grid-cols-2 gap-1',
                    theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
                  )}>
                    {employees.map((emp) => (
                      <label
                        key={emp.id}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded cursor-pointer text-sm',
                          selectedEmployees.includes(emp.id)
                            ? 'bg-green-500/20'
                            : theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={() => toggleEmployee(emp.id)}
                          className="rounded border-gray-300 text-green-500"
                        />
                        <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{emp.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {selectedPattern && (
          <div className={cn(
            'p-4 border-t flex justify-end gap-2 flex-shrink-0',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <button
              onClick={onClose}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              )}
            >
              Cancelar
            </button>
            <button
              onClick={generateShifts}
              disabled={generating || selectedEmployees.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generar Turnos
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
