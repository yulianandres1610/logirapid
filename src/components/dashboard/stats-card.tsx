'use client'

import { motion } from 'framer-motion'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    trend: 'up' | 'down' | 'stable'
  }
  icon: LucideIcon
  description?: string
  className?: string
}

export function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  className
}: StatsCardProps) {
  const getTrendIcon = () => {
    switch (change?.trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />
      default:
        return <Minus className="w-4 h-4 text-gray-400" />
    }
  }

  const getTrendColor = () => {
    switch (change?.trend) {
      case 'up':
        return 'text-green-500 bg-green-500/10 border-green-500/20'
      case 'down':
        return 'text-red-500 bg-red-500/10 border-red-500/20'
      default:
        return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  return (
    <motion.div
      className={cn(
        "relative bg-gray-800/50 border border-gray-700 rounded-2xl p-6 overflow-hidden backdrop-blur-sm",
        "hover:border-gray-600 transition-all duration-300",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800/20 via-transparent to-exa-primary/5 rounded-2xl" />

      {/* Animated light effect */}
      <motion.div
        className="absolute top-0 right-0 w-32 h-32 bg-exa-primary/5 rounded-full filter blur-2xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-exa-primary/10 rounded-xl border border-exa-primary/20">
              <Icon className="w-6 h-6 text-exa-primary" />
            </div>
            <div>
              <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
              {description && (
                <p className="text-gray-500 text-xs mt-1">{description}</p>
              )}
            </div>
          </div>

          {change && (
            <motion.div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium",
                getTrendColor()
              )}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              {getTrendIcon()}
              <span>{change.value}%</span>
            </motion.div>
          )}
        </div>

        {/* Value */}
        <motion.div
          className="text-3xl font-bold text-white mb-2"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          {value}
        </motion.div>

        {/* Additional info */}
        {change && (
          <motion.div
            className="text-sm text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            vs. mes anterior
          </motion.div>
        )}
      </div>

      {/* Hover effect overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-exa opacity-0 rounded-2xl pointer-events-none"
        whileHover={{ opacity: 0.05 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  )
}