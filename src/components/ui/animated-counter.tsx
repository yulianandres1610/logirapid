'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface AnimatedCounterProps {
  value: number
  previousValue?: number | null
  changeDirection?: 'up' | 'down' | null
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
  className?: string
  showChangeIndicator?: boolean
}

/**
 * AnimatedCounter - Displays a number with smooth counting animation
 *
 * Features:
 * - Smooth spring animation when value changes
 * - Optional change indicator (arrow up/down with color)
 * - Configurable decimal places and duration
 * - Flash effect on value change
 */
export function AnimatedCounter({
  value,
  previousValue,
  changeDirection,
  prefix = '$',
  suffix = '',
  decimals = 2,
  duration = 0.8,
  className,
  showChangeIndicator = true
}: AnimatedCounterProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const prevValueRef = useRef(value)

  // Spring animation for smooth counting
  const spring = useSpring(value, {
    stiffness: 100,
    damping: 20,
    duration: duration * 1000
  })

  // Transform spring value to formatted string
  const display = useTransform(spring, (current) =>
    current.toFixed(decimals)
  )

  // Track value changes for flash effect
  useEffect(() => {
    if (prevValueRef.current !== value) {
      setIsAnimating(true)
      spring.set(value)
      prevValueRef.current = value

      const timer = setTimeout(() => {
        setIsAnimating(false)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [value, spring])

  // Determine colors based on change direction
  const getChangeColor = () => {
    if (!changeDirection) return ''
    return changeDirection === 'up'
      ? 'text-green-500'
      : 'text-red-500'
  }

  const getBackgroundPulse = () => {
    if (!isAnimating || !changeDirection) return ''
    return changeDirection === 'up'
      ? 'bg-green-500/10'
      : 'bg-red-500/10'
  }

  return (
    <motion.div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-1 transition-colors duration-300",
        getBackgroundPulse(),
        className
      )}
    >
      {/* Change indicator arrow */}
      {showChangeIndicator && changeDirection && (
        <motion.span
          initial={{ opacity: 0, scale: 0, y: changeDirection === 'up' ? 10 : -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={cn("flex-shrink-0", getChangeColor())}
        >
          {changeDirection === 'up' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )}
        </motion.span>
      )}

      {/* Prefix */}
      {prefix && (
        <span className={cn(
          "transition-colors duration-300",
          isAnimating && changeDirection ? getChangeColor() : ''
        )}>
          {prefix}
        </span>
      )}

      {/* Animated number */}
      <motion.span
        className={cn(
          "tabular-nums transition-colors duration-300",
          isAnimating && changeDirection ? getChangeColor() : ''
        )}
      >
        {display}
      </motion.span>

      {/* Suffix */}
      {suffix && (
        <span className={cn(
          "transition-colors duration-300",
          isAnimating && changeDirection ? getChangeColor() : ''
        )}>
          {suffix}
        </span>
      )}

      {/* Flash overlay effect */}
      {isAnimating && changeDirection && (
        <motion.div
          className={cn(
            "absolute inset-0 rounded-lg pointer-events-none",
            changeDirection === 'up' ? 'bg-green-400' : 'bg-red-400'
          )}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1 }}
        />
      )}
    </motion.div>
  )
}

/**
 * Simple animated number without extra features
 * Used for quick inline animations
 */
export function AnimatedNumber({
  value,
  decimals = 2,
  className
}: {
  value: number
  decimals?: number
  className?: string
}) {
  const spring = useSpring(value, {
    stiffness: 100,
    damping: 20
  })

  const display = useTransform(spring, (current) =>
    current.toFixed(decimals)
  )

  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  return (
    <motion.span className={cn("tabular-nums", className)}>
      {display}
    </motion.span>
  )
}
