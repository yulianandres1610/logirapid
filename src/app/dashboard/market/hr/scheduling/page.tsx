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
  Sun,
  Moon,
  Palmtree,
  Thermometer,
  Coffee,
  Settings,
  Search,
  CalendarDays,
  Repeat,
  AlertCircle,
  Trash2
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { ShiftPatternForm } from '@/components/hr/ShiftPatternForm'

// Types
type ShiftTypeValue = 'work' | 'rest' | 'vacation' | 'sick' | 'leave' | 'none'

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

interface CalendarDay {
  date: string
  dayOfWeek: number
  dayName: string
  shiftType: ShiftTypeValue
  startTime: string | null
  endTime: string | null
  breakMinutes: number
  source: 'rotating' | 'fixed' | 'none'
  shiftId: number | null
  patternId: number | null
  patternName: string | null
  patternLabel: string | null
  scheduleId: number | null
  scheduleName: string | null
  notes: string | null
  isEditable: boolean
}

interface EmployeeCalendar {
  employeeId: number
  employeeName: string
  employeeCode: string
  department: string | null
  photoUrl: string | null
  scheduleType: 'fixed' | 'rotating' | 'none'
  scheduleName: string | null
  patternName: string | null
  patternLabel: string | null
  days: CalendarDay[]
}

const SHIFT_TYPES: Array<{
  value: ShiftTypeValue
  label: string
  shortLabel: string
  icon: typeof Sun
  color: string
  bgColor: string
  textColor: string
}> = [
  { value: 'work', label: 'Trabajo', shortLabel: 'T', icon: Sun, color: 'bg-emerald-500', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-500' },
  { value: 'rest', label: 'Descanso', shortLabel: 'D', icon: Moon, color: 'bg-slate-400', bgColor: 'bg-slate-400/20', textColor: 'text-slate-400' },
  { value: 'vacation', label: 'Vacaciones', shortLabel: 'V', icon: Palmtree, color: 'bg-sky-500', bgColor: 'bg-sky-500/20', textColor: 'text-sky-500' },
  { value: 'sick', label: 'Enfermedad', shortLabel: 'E', icon: Thermometer, color: 'bg-rose-500', bgColor: 'bg-rose-500/20', textColor: 'text-rose-500' },
  { value: 'leave', label: 'Permiso', shortLabel: 'P', icon: Coffee, color: 'bg-amber-500', bgColor: 'bg-amber-500/20', textColor: 'text-amber-500' }
]

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function SchedulingPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Data
  const [patterns, setPatterns] = useState<ShiftPattern[]>([])
  const [calendars, setCalendars] = useState<EmployeeCalendar[]>([])

  // UI State
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedCell, setSelectedCell] = useState<{ employee: EmployeeCalendar, day: CalendarDay } | null>(null)
  const [showPatternForm, setShowPatternForm] = useState(false)
  const [showPatternManager, setShowPatternManager] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Week dates calculation
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

  const dateRange = useMemo(() => ({
    startDate: weekDates[0].toISOString().split('T')[0],
    endDate: weekDates[6].toISOString().split('T')[0]
  }), [weekDates])

  // Filtered employees
  const filteredCalendars = useMemo(() => {
    if (!searchTerm) return calendars
    const term = searchTerm.toLowerCase()
    return calendars.filter(c =>
      c.employeeName.toLowerCase().includes(term) ||
      c.employeeCode.toLowerCase().includes(term) ||
      c.department?.toLowerCase().includes(term)
    )
  }, [calendars, searchTerm])

  // API calls
  const fetchCalendar = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })
      const response = await fetch(`/api/market/hr/calendar?${params}`)
      const result = await response.json()
      if (result.success) {
        setCalendars(result.data.employees)
      }
    } catch (error) {
      console.error('Error fetching calendar:', error)
    }
  }, [dateRange])

  const fetchPatterns = useCallback(async () => {
    try {
      const response = await fetch('/api/market/hr/shift-patterns?status=all')
      const result = await response.json()
      if (result.success) setPatterns(result.data)
    } catch (error) {
      console.error('Error fetching patterns:', error)
    }
  }, [])

  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    await Promise.all([fetchCalendar(), fetchPatterns()])

    if (!silent) setLoading(false)
    else setRefreshing(false)
  }, [fetchCalendar, fetchPatterns])

  useEffect(() => {
    loadAllData()
  }, []) // eslint-disable-line

  useEffect(() => {
    fetchCalendar()
  }, [dateRange]) // eslint-disable-line

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
  const handleCellClick = (employee: EmployeeCalendar, day: CalendarDay) => {
    setSelectedCell({ employee, day })
  }

  // Save shift
  const saveShift = async (shiftType: ShiftTypeValue, startTime?: string, endTime?: string, notes?: string) => {
    if (!selectedCell) return

    try {
      const body: any = {
        employeeId: selectedCell.employee.employeeId,
        shiftDate: selectedCell.day.date,
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
        fetchCalendar()
        setSelectedCell(null)
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
    if (!selectedCell?.day.shiftId) return

    try {
      const response = await fetch(`/api/market/hr/employee-shifts?id=${selectedCell.day.shiftId}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (result.success) {
        fetchCalendar()
        setSelectedCell(null)
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

  // Get shift display info
  const getShiftDisplay = (day: CalendarDay) => {
    if (day.shiftType === 'none') return null
    const config = SHIFT_TYPES.find(t => t.value === day.shiftType)
    return config
  }

  // Stats calculation
  const stats = useMemo(() => {
    let workDays = 0
    let restDays = 0
    let vacationDays = 0
    let sickDays = 0
    let leaveDays = 0
    let unscheduled = 0

    calendars.forEach(cal => {
      cal.days.forEach(day => {
        switch (day.shiftType) {
          case 'work': workDays++; break
          case 'rest': restDays++; break
          case 'vacation': vacationDays++; break
          case 'sick': sickDays++; break
          case 'leave': leaveDays++; break
          case 'none': unscheduled++; break
        }
      })
    })

    return { workDays, restDays, vacationDays, sickDays, leaveDays, unscheduled }
  }, [calendars])

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          'min-h-screen',
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          {/* Header */}
          <div className={cn(
            'sticky top-0 z-30 border-b backdrop-blur-xl',
            theme === 'dark' ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200'
          )}>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Title & Week Navigation */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className={cn(
                      'w-6 h-6',
                      theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    )} />
                    <h1 className={cn(
                      'text-xl font-bold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Horarios
                    </h1>
                  </div>

                  <div className={cn(
                    'hidden sm:flex items-center gap-1 p-1 rounded-xl',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
                  )}>
                    <button
                      onClick={() => navigateWeek(-1)}
                      className={cn(
                        'p-2 rounded-lg transition-all',
                        theme === 'dark' ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-white text-gray-600 hover:text-gray-900'
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goToToday}
                      className={cn(
                        'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                        theme === 'dark' ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-white text-gray-700'
                      )}
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() => navigateWeek(1)}
                      className={cn(
                        'p-2 rounded-lg transition-all',
                        theme === 'dark' ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-white text-gray-600 hover:text-gray-900'
                      )}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <span className={cn(
                    'text-sm font-medium hidden sm:block',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    {formatWeekRange()}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className={cn(
                      'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )} />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={cn(
                        'pl-9 pr-4 py-2 w-40 text-sm rounded-xl border-0 ring-1 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900 ring-gray-800 text-white placeholder:text-gray-600 focus:ring-emerald-500'
                          : 'bg-white ring-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-emerald-500'
                      )}
                    />
                  </div>

                  <button
                    onClick={() => loadAllData(true)}
                    disabled={refreshing}
                    className={cn(
                      'p-2.5 rounded-xl transition-all',
                      theme === 'dark' ? 'hover:bg-gray-900 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                    )}
                  >
                    <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
                  </button>

                  <button
                    onClick={() => setShowPatternManager(true)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all',
                      'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
                    )}
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Patrones</span>
                  </button>
                </div>
              </div>

              {/* Mobile Week Nav */}
              <div className={cn(
                'flex sm:hidden items-center justify-between mt-3 p-1 rounded-xl',
                theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
              )}>
                <button
                  onClick={() => navigateWeek(-1)}
                  className={cn(
                    'p-2 rounded-lg',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-white'
                  )}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToToday}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-lg',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}
                >
                  {formatWeekRange()}
                </button>
                <button
                  onClick={() => navigateWeek(1)}
                  className={cn(
                    'p-2 rounded-lg',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-white'
                  )}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className={cn(
              'flex items-center gap-4 px-4 py-2 border-t overflow-x-auto',
              theme === 'dark' ? 'border-gray-800/50 bg-gray-900/50' : 'border-gray-100 bg-gray-50/50'
            )}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  {stats.workDays} trabajo
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-400" />
                <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  {stats.restDays} descanso
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-sky-500" />
                <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  {stats.vacationDays} vacaciones
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  {stats.sickDays} enfermedad
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  {stats.leaveDays} permiso
                </span>
              </div>
              {stats.unscheduled > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-500 font-medium">
                    {stats.unscheduled} sin horario
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-4">
            <div className={cn(
              'rounded-2xl border overflow-hidden shadow-sm',
              theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
            )}>
              {/* Calendar Header */}
              <div className={cn(
                'grid border-b',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-800' : 'bg-gray-50 border-gray-200'
              )} style={{ gridTemplateColumns: '220px repeat(7, 1fr)' }}>
                <div className={cn(
                  'p-4 border-r flex items-center gap-2',
                  theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
                )}>
                  <Users className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                  <span className={cn(
                    'text-sm font-semibold',
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    {filteredCalendars.length} Empleados
                  </span>
                </div>
                {weekDates.map((date, i) => (
                  <div
                    key={i}
                    className={cn(
                      'p-3 text-center border-r last:border-r-0 transition-colors',
                      theme === 'dark' ? 'border-gray-800' : 'border-gray-200',
                      isToday(date) && (theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50')
                    )}
                  >
                    <div className={cn(
                      'text-xs font-semibold uppercase tracking-wider',
                      isToday(date) ? 'text-emerald-500' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      {DAY_NAMES[date.getDay()]}
                    </div>
                    <div className={cn(
                      'text-xl font-bold mt-0.5',
                      isToday(date) ? 'text-emerald-500' : theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {date.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Employee Rows */}
              <div className={cn(
                'divide-y max-h-[calc(100vh-320px)] overflow-y-auto',
                theme === 'dark' ? 'divide-gray-800' : 'divide-gray-100'
              )}>
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="grid animate-pulse" style={{ gridTemplateColumns: '220px repeat(7, 1fr)' }}>
                      <div className={cn('p-4 border-r', theme === 'dark' ? 'border-gray-800' : 'border-gray-200')}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-300 dark:bg-gray-700" />
                          <div className="flex-1">
                            <div className="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded mb-2" />
                            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
                          </div>
                        </div>
                      </div>
                      {[...Array(7)].map((_, j) => (
                        <div key={j} className={cn('p-2 border-r last:border-r-0', theme === 'dark' ? 'border-gray-800' : 'border-gray-200')}>
                          <div className="h-14 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                        </div>
                      ))}
                    </div>
                  ))
                ) : filteredCalendars.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className={cn('w-16 h-16 mx-auto mb-4', theme === 'dark' ? 'text-gray-700' : 'text-gray-300')} />
                    <p className={cn('text-lg font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {searchTerm ? 'No se encontraron empleados' : 'No hay empleados activos'}
                    </p>
                    <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')}>
                      {searchTerm ? 'Intenta con otro término de búsqueda' : 'Agrega empleados desde la sección de personal'}
                    </p>
                  </div>
                ) : (
                  filteredCalendars.map((calendar) => (
                    <div
                      key={calendar.employeeId}
                      className={cn(
                        'grid transition-colors',
                        theme === 'dark' ? 'hover:bg-gray-800/30' : 'hover:bg-gray-50/50'
                      )}
                      style={{ gridTemplateColumns: '220px repeat(7, 1fr)' }}
                    >
                      {/* Employee Info */}
                      <div className={cn(
                        'p-3 border-r flex items-center gap-3',
                        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
                      )}>
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0',
                          calendar.scheduleType === 'rotating'
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                            : calendar.scheduleType === 'fixed'
                              ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'
                              : theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-500'
                        )}>
                          {calendar.employeeName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            'text-sm font-semibold truncate',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {calendar.employeeName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {calendar.scheduleType === 'rotating' ? (
                              <>
                                <Repeat className="w-3 h-3 text-purple-400" />
                                <span className="text-xs text-purple-400 font-medium">
                                  {calendar.patternLabel || 'Rotativo'}
                                </span>
                              </>
                            ) : calendar.scheduleType === 'fixed' ? (
                              <>
                                <Clock className="w-3 h-3 text-blue-400" />
                                <span className="text-xs text-blue-400 font-medium truncate">
                                  {calendar.scheduleName || 'Fijo'}
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 text-orange-400" />
                                <span className="text-xs text-orange-400">Sin horario</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Day Cells */}
                      {calendar.days.map((day) => {
                        const display = getShiftDisplay(day)
                        const dateObj = new Date(day.date + 'T12:00:00')

                        return (
                          <div
                            key={day.date}
                            onClick={() => handleCellClick(calendar, day)}
                            className={cn(
                              'p-1.5 border-r last:border-r-0 cursor-pointer transition-all group',
                              theme === 'dark' ? 'border-gray-800' : 'border-gray-200',
                              isToday(dateObj) && (theme === 'dark' ? 'bg-emerald-500/5' : 'bg-emerald-50/50')
                            )}
                          >
                            {display ? (
                              <div className={cn(
                                'w-full h-14 rounded-xl p-2 transition-all relative overflow-hidden',
                                display.color,
                                'group-hover:ring-2 group-hover:ring-offset-2',
                                theme === 'dark' ? 'group-hover:ring-offset-gray-900' : 'group-hover:ring-offset-white',
                                display.value === 'work' ? 'group-hover:ring-emerald-400' :
                                display.value === 'rest' ? 'group-hover:ring-slate-400' :
                                display.value === 'vacation' ? 'group-hover:ring-sky-400' :
                                display.value === 'sick' ? 'group-hover:ring-rose-400' :
                                'group-hover:ring-amber-400'
                              )}>
                                {day.shiftType === 'work' && day.startTime && day.endTime ? (
                                  <div className="text-white">
                                    <div className="text-xs font-bold">
                                      {day.startTime.slice(0, 5)}
                                    </div>
                                    <div className="text-[10px] opacity-80">
                                      {day.endTime.slice(0, 5)}
                                    </div>
                                    {day.source === 'rotating' && day.patternLabel && (
                                      <div className="absolute bottom-1 right-1.5 text-[9px] font-medium opacity-60">
                                        {day.patternLabel}
                                      </div>
                                    )}
                                    {day.source === 'fixed' && (
                                      <div className="absolute bottom-1 right-1.5">
                                        <Clock className="w-2.5 h-2.5 opacity-60" />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <display.icon className="w-5 h-5 text-white" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className={cn(
                                'w-full h-14 rounded-xl border-2 border-dashed flex items-center justify-center transition-all',
                                theme === 'dark'
                                  ? 'border-gray-800 group-hover:border-gray-700 group-hover:bg-gray-800/50'
                                  : 'border-gray-200 group-hover:border-gray-300 group-hover:bg-gray-50'
                              )}>
                                <Plus className={cn(
                                  'w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity',
                                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
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
          </div>

          {/* Shift Editor Modal */}
          <AnimatePresence>
            {selectedCell && (
              <ShiftEditorModal
                theme={theme}
                employee={selectedCell.employee}
                day={selectedCell.day}
                patterns={patterns.filter(p => p.isActive)}
                onClose={() => setSelectedCell(null)}
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
                calendars={calendars}
                onClose={() => setShowPatternManager(false)}
                onCreatePattern={() => {
                  setShowPatternManager(false)
                  setShowPatternForm(true)
                }}
                onDeletePattern={deletePattern}
                onRefresh={() => {
                  fetchPatterns()
                  fetchCalendar()
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
  day,
  patterns,
  onClose,
  onSave,
  onDelete
}: {
  theme: string
  employee: EmployeeCalendar
  day: CalendarDay
  patterns: ShiftPattern[]
  onClose: () => void
  onSave: (shiftType: ShiftTypeValue, startTime?: string, endTime?: string, notes?: string) => void
  onDelete: () => void
}) {
  const [shiftType, setShiftType] = useState<ShiftTypeValue>(day.shiftType === 'none' ? 'work' : day.shiftType)
  const [startTime, setStartTime] = useState(day.startTime?.slice(0, 5) || '08:00')
  const [endTime, setEndTime] = useState(day.endTime?.slice(0, 5) || '17:00')
  const [notes, setNotes] = useState(day.notes || '')
  const [saving, setSaving] = useState(false)

  const dateObj = new Date(day.date + 'T12:00:00')
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(
          'rounded-2xl shadow-2xl w-full max-w-md overflow-hidden',
          theme === 'dark' ? 'bg-gray-900' : 'bg-white'
        )}
      >
        {/* Header */}
        <div className={cn(
          'p-5 border-b',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
        )}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold',
                employee.scheduleType === 'rotating'
                  ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                  : employee.scheduleType === 'fixed'
                    ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'
                    : theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
              )}>
                {employee.employeeName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className={cn('font-bold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {employee.employeeName}
                </h3>
                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  {dayName}, {formattedDate}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={cn(
                'p-2 rounded-xl transition-colors',
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current schedule info */}
          {day.source !== 'none' && (
            <div className={cn(
              'mt-3 p-2 rounded-lg flex items-center gap-2 text-xs',
              day.source === 'rotating'
                ? theme === 'dark' ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'
                : theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
            )}>
              {day.source === 'rotating' ? (
                <>
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Horario rotativo {day.patternLabel && `(${day.patternLabel})`}</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Horario fijo: {day.scheduleName}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Shift Type Selector */}
          <div>
            <label className={cn('block text-sm font-medium mb-3', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Tipo de turno
            </label>
            <div className="grid grid-cols-5 gap-2">
              {SHIFT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setShiftType(type.value)}
                  className={cn(
                    'p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all',
                    shiftType === type.value
                      ? `${type.color} text-white shadow-lg`
                      : theme === 'dark'
                        ? 'bg-gray-800 hover:bg-gray-750 text-gray-400'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  )}
                >
                  <type.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time inputs (only for work) */}
          {shiftType === 'work' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Entrada
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border-0 ring-1 text-center font-mono text-lg',
                      theme === 'dark'
                        ? 'bg-gray-800 ring-gray-700 text-white focus:ring-emerald-500'
                        : 'bg-gray-50 ring-gray-200 text-gray-900 focus:ring-emerald-500'
                    )}
                  />
                </div>
                <div>
                  <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Salida
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border-0 ring-1 text-center font-mono text-lg',
                      theme === 'dark'
                        ? 'bg-gray-800 ring-gray-700 text-white focus:ring-emerald-500'
                        : 'bg-gray-50 ring-gray-200 text-gray-900 focus:ring-emerald-500'
                    )}
                  />
                </div>
              </div>

              {/* Quick patterns */}
              {patterns.length > 0 && (
                <div>
                  <label className={cn('block text-xs font-medium mb-2', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                    Aplicar horario de patrón
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {patterns.slice(0, 4).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyPattern(p)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                          theme === 'dark'
                            ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        {p.startTime.slice(0, 5)}-{p.endTime.slice(0, 5)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Notes */}
          <div>
            <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
              Notas <span className={cn('font-normal', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')}>(opcional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agregar una nota..."
              className={cn(
                'w-full px-4 py-3 rounded-xl border-0 ring-1',
                theme === 'dark'
                  ? 'bg-gray-800 ring-gray-700 text-white placeholder:text-gray-600 focus:ring-emerald-500'
                  : 'bg-gray-50 ring-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-emerald-500'
              )}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          'p-5 border-t flex items-center gap-3',
          theme === 'dark' ? 'border-gray-800 bg-gray-800/50' : 'border-gray-100 bg-gray-50'
        )}>
          {day.shiftId && (
            <button
              onClick={onDelete}
              className={cn(
                'p-2.5 rounded-xl transition-colors',
                theme === 'dark'
                  ? 'text-rose-400 hover:bg-rose-500/10'
                  : 'text-rose-600 hover:bg-rose-50'
              )}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className={cn(
              'px-5 py-2.5 text-sm font-medium rounded-xl transition-colors',
              theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
            )}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Guardar
              </>
            )}
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
  calendars,
  onClose,
  onCreatePattern,
  onDeletePattern,
  onRefresh
}: {
  theme: string
  patterns: ShiftPattern[]
  calendars: EmployeeCalendar[]
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

  const employees = calendars.map(c => ({
    id: c.employeeId,
    name: c.employeeName,
    scheduleType: c.scheduleType
  }))

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(
          'rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col',
          theme === 'dark' ? 'bg-gray-900' : 'bg-white'
        )}
      >
        {/* Header */}
        <div className={cn(
          'p-5 border-b flex items-center justify-between flex-shrink-0',
          theme === 'dark' ? 'border-gray-800' : 'border-gray-100'
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className={cn('font-bold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Patrones de Rotación
              </h3>
              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                Crea y aplica patrones de turnos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn('p-2 rounded-xl', theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Patterns Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                Patrones disponibles
              </h4>
              <button
                onClick={onCreatePattern}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
              >
                <Plus className="w-4 h-4" />
                Nuevo patrón
              </button>
            </div>

            {patterns.length === 0 ? (
              <div className={cn(
                'p-8 rounded-xl border-2 border-dashed text-center',
                theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
              )}>
                <Repeat className={cn('w-12 h-12 mx-auto mb-3', theme === 'dark' ? 'text-gray-700' : 'text-gray-300')} />
                <p className={cn('font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  No hay patrones creados
                </p>
                <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')}>
                  Crea tu primer patrón de rotación
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {patterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    onClick={() => setSelectedPattern(pattern)}
                    className={cn(
                      'p-4 rounded-xl border-2 cursor-pointer transition-all',
                      selectedPattern?.id === pattern.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : theme === 'dark'
                          ? 'border-gray-800 hover:border-gray-700'
                          : 'border-gray-200 hover:border-gray-300',
                      !pattern.isActive && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'px-2.5 py-1 text-xs font-bold rounded-lg',
                            theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                          )}>
                            {pattern.patternLabel}
                          </span>
                        </div>
                        <h5 className={cn('font-medium mt-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {pattern.name}
                        </h5>
                        <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          {pattern.startTime?.slice(0, 5)} - {pattern.endTime?.slice(0, 5)}
                        </p>
                      </div>
                      {pattern.usageCount === 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeletePattern(pattern) }}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors',
                            theme === 'dark' ? 'hover:bg-rose-500/20 text-gray-600 hover:text-rose-400' : 'hover:bg-rose-50 text-gray-400 hover:text-rose-500'
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate Section */}
          {selectedPattern && (
            <>
              <div className={cn('border-t pt-6', theme === 'dark' ? 'border-gray-800' : 'border-gray-200')} />

              <div>
                <h4 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Generar turnos con <span className="text-purple-500">{selectedPattern.name}</span>
                </h4>

                {/* Dates */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className={cn('block text-xs font-medium mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Fecha inicio
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2.5 text-sm rounded-xl border-0 ring-1',
                        theme === 'dark' ? 'bg-gray-800 ring-gray-700 text-white' : 'bg-gray-50 ring-gray-200'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-xs font-medium mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Fecha fin
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2.5 text-sm rounded-xl border-0 ring-1',
                        theme === 'dark' ? 'bg-gray-800 ring-gray-700 text-white' : 'bg-gray-50 ring-gray-200'
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn('block text-xs font-medium mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      1er día trabajo
                    </label>
                    <input
                      type="date"
                      value={firstWorkDay}
                      onChange={(e) => setFirstWorkDay(e.target.value)}
                      className={cn(
                        'w-full px-3 py-2.5 text-sm rounded-xl border-0 ring-1',
                        theme === 'dark' ? 'bg-gray-800 ring-gray-700 text-white' : 'bg-gray-50 ring-gray-200'
                      )}
                    />
                  </div>
                </div>

                {/* Employees */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={cn('text-xs font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Empleados ({selectedEmployees.length} seleccionados)
                    </label>
                    <button
                      onClick={() => setSelectedEmployees(
                        selectedEmployees.length === employees.length ? [] : employees.map(e => e.id)
                      )}
                      className="text-xs text-purple-500 hover:text-purple-400 font-medium"
                    >
                      {selectedEmployees.length === employees.length ? 'Ninguno' : 'Seleccionar todos'}
                    </button>
                  </div>
                  <div className={cn(
                    'max-h-40 overflow-y-auto rounded-xl ring-1 p-2',
                    theme === 'dark' ? 'bg-gray-800/50 ring-gray-800' : 'bg-gray-50 ring-gray-200'
                  )}>
                    <div className="grid grid-cols-2 gap-1">
                      {employees.map((emp) => (
                        <label
                          key={emp.id}
                          className={cn(
                            'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors',
                            selectedEmployees.includes(emp.id)
                              ? 'bg-purple-500/20'
                              : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(emp.id)}
                            onChange={() => toggleEmployee(emp.id)}
                            className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                          />
                          <span className={cn('text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {emp.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {selectedPattern && (
          <div className={cn(
            'p-5 border-t flex justify-end gap-3 flex-shrink-0',
            theme === 'dark' ? 'border-gray-800 bg-gray-800/50' : 'border-gray-100 bg-gray-50'
          )}>
            <button
              onClick={onClose}
              className={cn(
                'px-5 py-2.5 text-sm font-medium rounded-xl',
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-200 text-gray-600'
              )}
            >
              Cancelar
            </button>
            <button
              onClick={generateShifts}
              disabled={generating || selectedEmployees.length === 0}
              className="px-5 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:opacity-50 transition-all flex items-center gap-2"
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
