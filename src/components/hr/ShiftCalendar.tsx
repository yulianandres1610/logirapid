'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Calendar, Users } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface EmployeeShift {
  id: number
  employeeId: number
  employeeName: string
  employeeCode: string
  shiftDate: string
  shiftType: 'work' | 'rest' | 'vacation' | 'sick' | 'leave'
  startTime: string | null
  endTime: string | null
  patternName: string | null
  patternLabel: string | null
}

interface ShiftCalendarProps {
  shifts: EmployeeShift[]
  employees: { id: number; name: string; code: string }[]
  onShiftClick?: (shift: EmployeeShift) => void
  onEmptyClick?: (employeeId: number, date: string) => void
  loading?: boolean
}

const SHIFT_TYPE_COLORS = {
  work: {
    bg: 'bg-green-500',
    text: 'text-white',
    border: 'border-green-600',
    label: 'Trabajo'
  },
  rest: {
    bg: 'bg-gray-400',
    text: 'text-white',
    border: 'border-gray-500',
    label: 'Descanso'
  },
  vacation: {
    bg: 'bg-blue-500',
    text: 'text-white',
    border: 'border-blue-600',
    label: 'Vacaciones'
  },
  sick: {
    bg: 'bg-red-500',
    text: 'text-white',
    border: 'border-red-600',
    label: 'Enfermedad'
  },
  leave: {
    bg: 'bg-amber-500',
    text: 'text-white',
    border: 'border-amber-600',
    label: 'Permiso'
  }
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']

export function ShiftCalendar({
  shifts,
  employees,
  onShiftClick,
  onEmptyClick,
  loading = false
}: ShiftCalendarProps) {
  const { theme } = useTheme()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')

  // Calculate week dates
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

  // Get shifts map for quick lookup
  const shiftsMap = useMemo(() => {
    const map = new Map<string, EmployeeShift>()
    shifts.forEach(shift => {
      const key = `${shift.employeeId}-${shift.shiftDate}`
      map.set(key, shift)
    })
    return map
  }, [shifts])

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + (direction * 7))
    setCurrentDate(newDate)
  }

  const formatDateHeader = (date: Date) => {
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const formatWeekRange = () => {
    const start = weekDates[0]
    const end = weekDates[6]
    const startMonth = start.toLocaleDateString('es-ES', { month: 'long' })
    const endMonth = end.toLocaleDateString('es-ES', { month: 'long' })
    const year = end.getFullYear()

    if (startMonth === endMonth) {
      return `${start.getDate()} - ${end.getDate()} de ${startMonth} ${year}`
    }
    return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth} ${year}`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigateWeek(1)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <h3 className={cn(
            'text-lg font-semibold capitalize',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {formatWeekRange()}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date())}
            className={cn(
              'px-3 py-1 text-sm rounded-lg transition-colors',
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            )}
          >
            Hoy
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          {Object.entries(SHIFT_TYPE_COLORS).map(([type, config]) => (
            <div key={type} className="flex items-center gap-1">
              <div className={cn('w-3 h-3 rounded', config.bg)} />
              <span className={cn(
                'text-xs',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {config.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={cn(
        'rounded-xl border overflow-hidden',
        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
      )}>
        {/* Header Row */}
        <div className={cn(
          'grid',
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
        )} style={{ gridTemplateColumns: '200px repeat(7, 1fr)' }}>
          <div className={cn(
            'p-3 border-r font-medium text-sm',
            theme === 'dark' ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'
          )}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Empleado
            </div>
          </div>
          {weekDates.map((date, i) => (
            <div
              key={i}
              className={cn(
                'p-3 text-center border-r last:border-r-0',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
                isToday(date) && (theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50')
              )}
            >
              <div className={cn(
                'text-xs font-medium',
                isToday(date) ? 'text-green-500' : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                {DAY_NAMES[date.getDay()]}
              </div>
              <div className={cn(
                'text-sm font-semibold mt-1',
                isToday(date)
                  ? 'text-green-500'
                  : theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Employee Rows */}
        <div className={cn(
          'divide-y',
          theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'
        )}>
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div
                key={i}
                className="grid animate-pulse"
                style={{ gridTemplateColumns: '200px repeat(7, 1fr)' }}
              >
                <div className={cn(
                  'p-3 border-r',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                {[...Array(7)].map((_, j) => (
                  <div
                    key={j}
                    className={cn(
                      'p-2 border-r last:border-r-0',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}
                  >
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            ))
          ) : employees.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                No hay empleados para mostrar
              </p>
            </div>
          ) : (
            employees.map((employee) => (
              <div
                key={employee.id}
                className="grid"
                style={{ gridTemplateColumns: '200px repeat(7, 1fr)' }}
              >
                {/* Employee Name */}
                <div className={cn(
                  'p-3 border-r flex items-center gap-2',
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
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      {employee.code}
                    </p>
                  </div>
                </div>

                {/* Shift Cells */}
                {weekDates.map((date) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const shift = shiftsMap.get(`${employee.id}-${dateStr}`)
                  const colors = shift ? SHIFT_TYPE_COLORS[shift.shiftType] : null

                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        'p-1.5 border-r last:border-r-0 min-h-[60px]',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
                        isToday(date) && (theme === 'dark' ? 'bg-green-900/10' : 'bg-green-50/50')
                      )}
                    >
                      {shift ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onShiftClick?.(shift)}
                          className={cn(
                            'w-full h-full rounded-lg p-1.5 text-left transition-all',
                            colors?.bg,
                            colors?.text,
                            'hover:shadow-lg'
                          )}
                        >
                          {shift.shiftType === 'work' && shift.startTime && shift.endTime ? (
                            <div className="text-xs">
                              <div className="font-medium">
                                {shift.startTime.slice(0, 5)}-{shift.endTime.slice(0, 5)}
                              </div>
                              {shift.patternLabel && (
                                <div className="opacity-75 text-[10px]">
                                  {shift.patternLabel}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs font-medium text-center">
                              {shift.shiftType === 'rest' ? 'D' : shift.shiftType.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </motion.button>
                      ) : (
                        <button
                          onClick={() => onEmptyClick?.(employee.id, dateStr)}
                          className={cn(
                            'w-full h-full rounded-lg border-2 border-dashed transition-colors',
                            theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          )}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className={cn(
        'grid grid-cols-4 gap-4 p-4 rounded-xl border',
        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
      )}>
        {Object.entries(SHIFT_TYPE_COLORS).slice(0, 4).map(([type, config]) => {
          const count = shifts.filter(s =>
            weekDates.some(d => d.toISOString().split('T')[0] === s.shiftDate) &&
            s.shiftType === type
          ).length
          return (
            <div key={type} className="text-center">
              <div className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                {count}
              </div>
              <div className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                {config.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
