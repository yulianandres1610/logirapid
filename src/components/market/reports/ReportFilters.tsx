'use client'

import React from 'react'
import { Calendar, RefreshCw, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

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
  // Action buttons
  onRefresh?: () => void
  isLoading?: boolean
  reportRef?: React.RefObject<HTMLDivElement | null>
  reportTitle?: string
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
  showExpiringDaysSelector = false,
  onRefresh,
  isLoading = false,
  reportRef,
  reportTitle = 'Reporte'
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
    }},
    { label: 'Todos', getValue: () => {
      return { start: '2020-01-01', end: new Date().toISOString().split('T')[0] }
    }}
  ]

  const handleExportPDF = async () => {
    if (!reportRef?.current) return

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Header
      pdf.setFontSize(16)
      pdf.text(reportTitle, 10, 15)
      pdf.setFontSize(10)
      pdf.setTextColor(128)
      pdf.text(`Generado: ${new Date().toLocaleString('es')}`, 10, 22)

      // Image content
      let yPos = 30
      let remainingHeight = imgHeight

      while (remainingHeight > 0) {
        const sliceHeight = Math.min(remainingHeight, pageHeight - 40)
        pdf.addImage(
          imgData,
          'PNG',
          10,
          yPos,
          imgWidth,
          imgHeight,
          undefined,
          'FAST'
        )

        remainingHeight -= sliceHeight
        if (remainingHeight > 0) {
          pdf.addPage()
          yPos = 10
        }
      }

      const filename = `${reportTitle.toLowerCase().replace(/\s+/g, '-')}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(filename)
    } catch (error) {
      console.error('Error exporting PDF:', error)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
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
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="day">Por Día</option>
              <option value="week">Por Semana</option>
              <option value="month">Por Mes</option>
              <option value="year">Por Año</option>
            </select>
          )}

          {/* Terminal Selector */}
          {showTerminalSelector && onTerminalChange && terminals.length > 0 && (
            <select
              value={selectedTerminalId || ''}
              onChange={(e) => onTerminalChange(e.target.value ? parseInt(e.target.value) : null)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Todas las terminales</option>
              {terminals.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          {/* Currency Selector */}
          {showCurrencySelector && onCurrencyChange && (
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="USD">USD</option>
              <option value="CUP">CUP</option>
              <option value="MLC">MLC</option>
            </select>
          )}

          {/* Expiring Days Selector */}
          {showExpiringDaysSelector && onExpiringDaysChange && (
            <select
              value={expiringDays}
              onChange={(e) => onExpiringDaysChange(parseInt(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={7}>Vence en 7 días</option>
              <option value={15}>Vence en 15 días</option>
              <option value={30}>Vence en 30 días</option>
              <option value={60}>Vence en 60 días</option>
              <option value={90}>Vence en 90 días</option>
            </select>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 no-print">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}

          {reportRef && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
              >
                <Download className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
