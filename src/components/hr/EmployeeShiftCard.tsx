'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Clock, X, Edit, Calendar, User } from 'lucide-react'
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
  breakMinutes?: number
  patternName: string | null
  patternLabel: string | null
  notes?: string
}

interface EmployeeShiftCardProps {
  shift: EmployeeShift
  onClose: () => void
  onEdit?: (shift: EmployeeShift) => void
  onDelete?: (shift: EmployeeShift) => void
}

const SHIFT_TYPE_CONFIG = {
  work: {
    bg: 'bg-green-500',
    bgLight: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-500',
    label: 'Trabajo'
  },
  rest: {
    bg: 'bg-gray-400',
    bgLight: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-400',
    label: 'Descanso'
  },
  vacation: {
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500',
    label: 'Vacaciones'
  },
  sick: {
    bg: 'bg-red-500',
    bgLight: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500',
    label: 'Enfermedad'
  },
  leave: {
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500',
    label: 'Permiso'
  }
}

export function EmployeeShiftCard({ shift, onClose, onEdit, onDelete }: EmployeeShiftCardProps) {
  const { theme } = useTheme()
  const config = SHIFT_TYPE_CONFIG[shift.shiftType]

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (time: string | null) => {
    if (!time) return '--:--'
    return time.slice(0, 5)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(
          'rounded-2xl shadow-2xl max-w-md w-full overflow-hidden',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}
      >
        {/* Header with type color */}
        <div className={cn('p-4', config.bg)}>
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6" />
              <div>
                <h3 className="font-bold text-lg">{config.label}</h3>
                <p className="text-sm opacity-80 capitalize">{formatDate(shift.shiftDate)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Employee Info */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-xl',
            config.bgLight
          )}>
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
              theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
            )}>
              {shift.employeeName.charAt(0)}
            </div>
            <div>
              <p className={cn(
                'font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {shift.employeeName}
              </p>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                {shift.employeeCode}
              </p>
            </div>
          </div>

          {/* Shift Details */}
          {shift.shiftType === 'work' && (
            <div className="grid grid-cols-2 gap-4">
              <div className={cn(
                'p-4 rounded-xl text-center',
                theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
              )}>
                <p className={cn(
                  'text-xs font-medium mb-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  Entrada
                </p>
                <p className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {formatTime(shift.startTime)}
                </p>
              </div>
              <div className={cn(
                'p-4 rounded-xl text-center',
                theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
              )}>
                <p className={cn(
                  'text-xs font-medium mb-1',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  Salida
                </p>
                <p className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {formatTime(shift.endTime)}
                </p>
              </div>
            </div>
          )}

          {/* Pattern Info */}
          {shift.patternName && (
            <div className={cn(
              'flex items-center gap-3 p-3 rounded-xl border',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <Calendar className={cn('w-5 h-5', config.text)} />
              <div>
                <p className={cn(
                  'text-sm font-medium',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {shift.patternName}
                </p>
                {shift.patternLabel && (
                  <p className={cn(
                    'text-xs',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  )}>
                    Patron {shift.patternLabel}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Break Minutes */}
          {shift.shiftType === 'work' && shift.breakMinutes && shift.breakMinutes > 0 && (
            <div className={cn(
              'flex items-center justify-between px-3 py-2 rounded-lg',
              theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
            )}>
              <span className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Tiempo de descanso
              </span>
              <span className={cn(
                'font-medium',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {shift.breakMinutes} min
              </span>
            </div>
          )}

          {/* Notes */}
          {shift.notes && (
            <div className={cn(
              'p-3 rounded-xl border',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <p className={cn(
                'text-xs font-medium mb-1',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Notas
              </p>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                {shift.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className={cn(
            'flex gap-3 pt-4 border-t',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            {onEdit && (
              <button
                onClick={() => onEdit(shift)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                )}
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(shift)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                <X className="w-4 h-4" />
                Eliminar
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
