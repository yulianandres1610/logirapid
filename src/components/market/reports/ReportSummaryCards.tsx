'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  change?: number
  changeLabel?: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray'
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
  changeLabel,
  color = 'blue'
}: MetricCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600',
    gray: 'from-gray-500 to-gray-600'
  }

  const bgColorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20',
    green: 'bg-green-50 dark:bg-green-900/20',
    red: 'bg-red-50 dark:bg-red-900/20',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20',
    purple: 'bg-purple-50 dark:bg-purple-900/20',
    gray: 'bg-gray-50 dark:bg-gray-900/20'
  }

  const iconColorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    purple: 'text-purple-600 dark:text-purple-400',
    gray: 'text-gray-600 dark:text-gray-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div className={`h-1 bg-gradient-to-r ${colorClasses[color]}`} />
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {typeof value === 'number' ? value.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : value}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={`p-2 rounded-lg ${bgColorClasses[color]}`}>
              <Icon className={`w-5 h-5 ${iconColorClasses[color]}`} />
            </div>
          )}
        </div>

        {change !== undefined && (
          <div className="flex items-center gap-1 mt-3">
            {change > 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : change < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <Minus className="w-4 h-4 text-gray-400" />
            )}
            <span className={`text-sm font-medium ${
              change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
            {changeLabel && (
              <span className="text-xs text-gray-500 ml-1">{changeLabel}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

interface ReportSummaryCardsProps {
  cards: MetricCardProps[]
  columns?: 2 | 3 | 4 | 5
}

export function ReportSummaryCards({ cards, columns = 4 }: ReportSummaryCardsProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-4 mb-6`}>
      {cards.map((card, index) => (
        <MetricCard key={index} {...card} />
      ))}
    </div>
  )
}
