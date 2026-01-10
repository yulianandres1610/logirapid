'use client'

import React from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReportFiltersProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  period?: 'day' | 'week' | 'month' | 'year'
  onPeriodChange?: (period: 'day' | 'week' | 'month' | 'year') => void
  showPeriodSelector?: boolean
  terminals?: Array<{ id: number; name: string }>
  selectedTerminalId?: number | null
  onTerminalChange?: (id: number | null) => void
  showTerminalSelector?: boolean
  currency?: 'USD' | 'CUP' | 'MLC'
  onCurrencyChange?: (currency: 'USD' | 'CUP' | 'MLC') => void
  showCurrencySelector?: boolean
  expiringDays?: number
  onExpiringDaysChange?: (days: number) => void
  showExpiringDaysSelector?: boolean
}

export function ReportFilters({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  period = 'day',
  onPeriodChange,
  showPeriodSelector = false,
  terminals = [],
  selectedTerminalId = null,
  onTerminalChange,
  showTerminalSelector = false,
  currency = 'USD',
  onCurrencyChange,
  showCurrencySelector = false,
  expiringDays = 30,
  onExpiringDaysChange,
  showExpiringDaysSelector = false
}: ReportFiltersProps) {
  const presets = [
    { label: 'Hoy', getValue: () => {
      const today = new Date().toISOString().split('T')[0]
      return { start: today, end: today }
    }},
    { label: 'Ayer', getValue: () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      return { start: yesterday, end: yesterday }
    }},
    { label: '7 días', getValue: () => {
      const end = new Date().toISOString().split('T')[0]
      const start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      return { start, end }
    }},
    { label: 'Este mes', getValue: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const end = now.toISOString().split('T')[0]
      return { start, end }
    }},
    { label: 'Mes pasado', getValue: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
      return { start, end }
    }}
  ]

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span className="text-gray-500">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Presets */}
        <div className="flex gap-1">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => {
                const { start, end } = preset.getValue()
                onStartDateChange(start)
                onEndDateChange(end)
              }}
              className="text-xs"
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Period Selector */}
        {showPeriodSelector && onPeriodChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Agrupar por:</span>
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="year">Año</option>
            </select>
          </div>
        )}

        {/* Terminal Selector */}
        {showTerminalSelector && onTerminalChange && terminals.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Terminal:</span>
            <select
              value={selectedTerminalId || ''}
              onChange={(e) => onTerminalChange(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Todas</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Currency Selector */}
        {showCurrencySelector && onCurrencyChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Moneda:</span>
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="USD">USD</option>
              <option value="CUP">CUP</option>
              <option value="MLC">MLC</option>
            </select>
          </div>
        )}

        {/* Expiring Days Selector */}
        {showExpiringDaysSelector && onExpiringDaysChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Días para vencer:</span>
            <select
              value={expiringDays}
              onChange={(e) => onExpiringDaysChange(parseInt(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={7}>7 días</option>
              <option value={15}>15 días</option>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
