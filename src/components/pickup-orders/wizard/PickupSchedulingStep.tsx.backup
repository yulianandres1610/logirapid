'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, Info, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext?: () => void
}

interface TimeSlot {
  id: string
  label: string
  start: string
  end: string
  startHour: number
}

const TIME_SLOTS: TimeSlot[] = [
  { id: '8-12', label: '8:00 AM - 12:00 PM', start: '08:00', end: '12:00', startHour: 8 },
  { id: '12-4', label: '12:00 PM - 4:00 PM', start: '12:00', end: '16:00', startHour: 12 },
  { id: '4-8', label: '4:00 PM - 8:00 PM', start: '16:00', end: '20:00', startHour: 16 }
]

export default function PickupSchedulingStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [selectedDate, setSelectedDate] = useState<string>(wizardData.scheduledDate || '')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('')
  const [customTime, setCustomTime] = useState<string>('')
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [manualDateSelection, setManualDateSelection] = useState(false)
  const [instructions, setInstructions] = useState<string>(wizardData.pickupInstructions || '')
  const [suggestedDate, setSuggestedDate] = useState<string>('')

  // Obtener fecha mínima (hoy)
  const getMinDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  // Obtener fecha de mañana
  const getTomorrowDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  // Verificar si es hoy
  const isToday = (date: string) => {
    if (!date) return false
    const today = new Date().toISOString().split('T')[0]
    return date === today
  }

  // Obtener hora actual
  const getCurrentHour = () => {
    return new Date().getHours()
  }

  // Determinar la fecha más próxima disponible para un horario
  const getEarliestDateForSlot = (slot: TimeSlot): string => {
    const currentHour = getCurrentHour()
    const today = getMinDate()

    // Si la hora de inicio del slot es mayor que la hora actual, puede ser hoy
    if (currentHour < slot.startHour) {
      return today
    }

    // Si no, debe ser mañana o después
    return getTomorrowDate()
  }

  // Validar y actualizar canProceed
  useEffect(() => {
    const hasDate = selectedDate !== ''
    const hasTimeSlot = useCustomTime ? customTime !== '' : selectedTimeSlot !== ''

    // Validar horario personalizado si está en modo custom
    let isValidCustomTime = true
    if (useCustomTime && customTime && selectedDate) {
      const [hours] = customTime.split(':').map(Number)

      if (isToday(selectedDate)) {
        const currentHour = getCurrentHour()
        isValidCustomTime = hours > currentHour
      }
    }

    const canProceed = hasDate && hasTimeSlot && isValidCustomTime
    setCanProceed(canProceed)
  }, [selectedDate, selectedTimeSlot, customTime, useCustomTime, setCanProceed])

  // Manejar cambio de fecha manual
  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    updateWizardData('scheduledDate', date)
    setManualDateSelection(true)
  }

  // Manejar selección de slot predefinido (INTELIGENTE)
  const handleSlotSelect = (slotId: string) => {
    const slot = TIME_SLOTS.find(s => s.id === slotId)
    if (!slot) return

    setSelectedTimeSlot(slotId)
    setUseCustomTime(false)
    setCustomTime('')
    updateWizardData('timeSlot', slot.label)

    // LÓGICA INTELIGENTE: Calcular fecha disponible automáticamente
    if (!manualDateSelection) {
      const earliestDate = getEarliestDateForSlot(slot)
      setSelectedDate(earliestDate)
      setSuggestedDate(earliestDate)
      updateWizardData('scheduledDate', earliestDate)
    }
  }

  // Manejar horario personalizado
  const handleCustomTimeChange = (time: string) => {
    setCustomTime(time)
    setSelectedTimeSlot('')
    updateWizardData('timeSlot', time)
  }

  // Manejar instrucciones
  const handleInstructionsChange = (value: string) => {
    setInstructions(value)
    updateWizardData('pickupInstructions', value)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center",
            theme === 'dark'
              ? 'bg-gradient-to-br from-blue-500/20 to-orange-500/20'
              : 'bg-gradient-to-br from-blue-100 to-orange-100'
          )}
        >
          <Clock className={cn(
            "w-10 h-10",
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          )} />
        </motion.div>

        <div>
          <h2 className={cn(
            "text-2xl sm:text-3xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Programar Recogida
          </h2>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Selecciona la fecha y horario para la recogida
          </p>
        </div>
      </div>

      {/* PASO 1: Horarios Predefinidos */}
      {!useCustomTime && (
        <div className="space-y-4">
          <label className={cn(
            "flex items-center gap-2 text-sm font-semibold",
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            <Clock className="w-5 h-5" />
            Horario de Recogida *
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TIME_SLOTS.map((slot) => (
              <motion.button
                key={slot.id}
                type="button"
                onClick={() => handleSlotSelect(slot.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-200",
                  "flex flex-col items-center justify-center gap-2",
                  selectedTimeSlot === slot.id
                    ? theme === 'dark'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-blue-50 border-blue-500 text-blue-700'
                    : theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                )}
              >
                <Clock className="w-6 h-6" />
                <span className="font-semibold text-sm">{slot.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* PASO 2: Fecha Sugerida o Personalizada */}
      {selectedTimeSlot && !useCustomTime && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <label className={cn(
            "flex items-center gap-2 text-sm font-semibold",
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            <Calendar className="w-5 h-5" />
            Fecha de Recogida *
          </label>

          {/* Fecha Sugerida Inteligente */}
          {!manualDateSelection && suggestedDate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-4 rounded-xl border-2",
                theme === 'dark'
                  ? 'bg-green-900/20 border-green-500/50 text-green-300'
                  : 'bg-green-50 border-green-200 text-green-700'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">📅 Fecha Sugerida:</p>
                  <p className="text-lg font-bold">
                    {new Date(suggestedDate + 'T00:00:00').toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-xs mt-1 opacity-75">
                    {isToday(suggestedDate) ? 'Disponible HOY' : 'Próximo día disponible'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setManualDateSelection(true)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      : 'bg-white hover:bg-gray-100 text-gray-700'
                  )}
                >
                  Cambiar
                </button>
              </div>
            </motion.div>
          )}

          {/* Selector de Fecha Manual */}
          {manualDateSelection && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={getMinDate()}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                )}
              />
              <button
                type="button"
                onClick={() => {
                  setManualDateSelection(false)
                  const slot = TIME_SLOTS.find(s => s.id === selectedTimeSlot)
                  if (slot) {
                    const earliestDate = getEarliestDateForSlot(slot)
                    setSelectedDate(earliestDate)
                    setSuggestedDate(earliestDate)
                    updateWizardData('scheduledDate', earliestDate)
                  }
                }}
                className={cn(
                  "mt-2 text-xs underline",
                  theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700'
                )}
              >
                Volver a fecha sugerida
              </button>
            </motion.div>
          )}

          {isToday(selectedDate) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-start gap-2 p-3 rounded-lg",
                theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'
              )}
            >
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                Recogida programada para HOY. Nuestro repartidor llegará en el horario seleccionado.
              </p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Opción de Horario Personalizado */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="customTime"
            checked={useCustomTime}
            onChange={(e) => {
              setUseCustomTime(e.target.checked)
              if (e.target.checked) {
                setSelectedTimeSlot('')
              } else {
                setCustomTime('')
              }
            }}
            className="w-4 h-4 rounded accent-blue-500"
          />
          <label
            htmlFor="customTime"
            className={cn(
              "text-sm font-medium cursor-pointer",
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}
          >
            Especificar horario personalizado
          </label>
        </div>

        {useCustomTime && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <div>
              <label className={cn(
                "block text-sm font-semibold mb-2",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Fecha de Recogida *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={getMinDate()}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                )}
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-semibold mb-2",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Horario Personalizado *
              </label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => handleCustomTimeChange(e.target.value)}
                min="08:00"
                max="20:00"
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                )}
              />
              <p className={cn(
                "text-xs mt-2",
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              )}>
                Horario de servicio: 8:00 AM - 8:00 PM
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Instrucciones Especiales */}
      <div className="space-y-4">
        <label className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        )}>
          <Info className="w-5 h-5" />
          Instrucciones Especiales (Opcional)
        </label>

        <textarea
          value={instructions}
          onChange={(e) => handleInstructionsChange(e.target.value)}
          placeholder="Ej: Tocar el timbre dos veces, paquete en la puerta trasera, etc."
          rows={3}
          className={cn(
            "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "resize-none",
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
          )}
        />
      </div>

      {/* Resumen */}
      {selectedDate && (selectedTimeSlot || customTime) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl border-2",
            theme === 'dark'
              ? 'bg-blue-900/20 border-blue-500/50'
              : 'bg-blue-50 border-blue-200'
          )}
        >
          <h3 className={cn(
            "font-semibold mb-2",
            theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
          )}>
            Resumen de Programación
          </h3>
          <div className={cn(
            "text-sm space-y-1",
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          )}>
            <p>📅 <strong>Fecha:</strong> {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</p>
            <p>🕐 <strong>Horario:</strong> {selectedTimeSlot ? TIME_SLOTS.find(s => s.id === selectedTimeSlot)?.label : customTime}</p>
            {instructions && (
              <p>📝 <strong>Instrucciones:</strong> {instructions}</p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
