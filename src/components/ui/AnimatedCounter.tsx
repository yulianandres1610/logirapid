'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  duration?: number
  delay?: number
  format?: 'number' | 'currency' | 'percentage'
  decimals?: number
  className?: string
  prefix?: string
  suffix?: string
}

export default function AnimatedCounter({
  value,
  duration = 2000,
  delay = 0,
  format = 'number',
  decimals = 0,
  className = '',
  prefix = '',
  suffix = ''
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasStarted(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (!hasStarted) return

    const startTime = Date.now()
    const startValue = 0
    const endValue = value

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)

      const currentValue = startValue + (endValue - startValue) * easeOutQuart
      setDisplayValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(endValue)
      }
    }

    requestAnimationFrame(animate)
  }, [hasStarted, value, duration])

  const formatValue = (num: number): string => {
    const rounded = decimals > 0 ? num.toFixed(decimals) : Math.round(num).toString()

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('es-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }).format(num)

      case 'percentage':
        return `${rounded}%`

      case 'number':
      default:
        return new Intl.NumberFormat('es-US').format(num)
    }
  }

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: delay / 1000,
        duration: 0.5,
        ease: "easeOut"
      }}
    >
      {prefix}{formatValue(displayValue)}{suffix}
    </motion.span>
  )
}