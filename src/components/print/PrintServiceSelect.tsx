'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PrintServiceSelectProps {
  services: { id: number; name: string; online: boolean; printerName: string | null }[]
  selectedServiceId: number | null
  onSelect: (id: number | null) => void
  disabled?: boolean
  theme?: string
  className?: string
}

/**
 * Reusable printer/service selector dropdown.
 * Only renders when there are 2+ services available.
 */
export function PrintServiceSelect({
  services,
  selectedServiceId,
  onSelect,
  disabled = false,
  theme = 'light',
  className
}: PrintServiceSelectProps) {
  if (services.length <= 1) return null

  return (
    <div className={className}>
      <label className={cn(
        'block text-sm font-medium mb-1.5',
        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
      )}>
        Impresora
      </label>
      <div className="relative">
        <select
          value={selectedServiceId || ''}
          onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled}
          className={cn(
            'w-full px-3 py-2 pr-8 rounded-lg border text-sm font-medium appearance-none cursor-pointer',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-gray-50 border-gray-200 text-gray-900'
          )}
        >
          <option value="">Automatico</option>
          {services.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}{s.printerName ? ` — ${s.printerName.replace(/_/g, ' ')}` : ''}{s.online ? '' : ' (offline)'}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  )
}
