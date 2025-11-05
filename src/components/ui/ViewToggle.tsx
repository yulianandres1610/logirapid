'use client'

import React from 'react'
import { List, Map, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ViewToggleProps {
  activeView: 'table' | 'map' | 'statistics'
  onViewChange: (view: 'table' | 'map' | 'statistics') => void
  counts?: {
    table: number
    map: number
    statistics: number
  }
  theme?: 'light' | 'dark'
  compact?: boolean
}

export default function ViewToggle({
  activeView,
  onViewChange,
  counts = { table: 0, map: 0, statistics: 0 },
  theme = 'light',
  compact = false
}: ViewToggleProps) {
  const views = [
    {
      id: 'table' as const,
      icon: List,
      count: counts.table
    },
    {
      id: 'map' as const,
      icon: Map,
      count: counts.map
    },
    {
      id: 'statistics' as const,
      icon: BarChart3,
      count: counts.statistics
    }
  ]

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {views.map((view) => {
          const Icon = view.icon
          const isActive = activeView === view.id

          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={cn(
                'relative p-2.5 h-10 rounded-lg border-2 transition-all duration-200',
                isActive
                  ? 'border-blue-500 bg-blue-500 text-white shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
              )}
              title={view.id === 'table' ? 'Tabla' : view.id === 'map' ? 'Mapa' : 'Estadísticas'}
            >
              <Icon className="w-3.5 h-3.5" />
              {view.count > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-xs rounded-full bg-red-500 text-white flex items-center justify-center">
                  {view.count > 99 ? '99+' : view.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex items-center">
      {/* Botones de cambio de vista */}
      <div className="flex items-center gap-2">
        {views.map((view) => {
          const Icon = view.icon
          const isActive = activeView === view.id

          return (
            <button
              key={view.id}
              onClick={() => onViewChange(view.id)}
              className={`
                relative px-3 py-2.5 h-10 rounded-lg border-2 transition-all duration-200
                ${isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                }
              `}
            >
              {/* Contenido principal */}
              <div className="flex items-center justify-center gap-2">
                <div className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg transition-colors border-2",
                  isActive
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {view.count > 0 && (
                  <span className={cn(
                    "text-xs font-medium",
                    isActive
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-gray-600 dark:text-gray-400"
                  )}>
                    {view.count}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}