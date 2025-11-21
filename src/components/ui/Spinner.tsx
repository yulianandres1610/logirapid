'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  centered?: boolean
  className?: string
}

export default function Spinner({
  size = 'md',
  text = 'Cargando...',
  centered = true,
  className
}: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className={cn(
      centered && 'flex flex-col items-center justify-center',
      !centered && 'inline-flex items-center gap-2',
      className
    )}>
      {/* Spinner con colores de marca */}
      <div className="relative">
        {/* Círculo exterior - azul */}
        <motion.div
          className={cn(
            sizeClasses[size],
            'rounded-full border-4 border-transparent border-t-[#0374e5] border-r-[#0374e5]'
          )}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }}
        />

        {/* Círculo interior - rojo */}
        <motion.div
          className={cn(
            sizeClasses[size],
            'absolute inset-0 rounded-full border-4 border-transparent border-b-[#cc0a46] border-l-[#cc0a46]'
          )}
          animate={{ rotate: -360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear'
          }}
        />

        {/* Punto central pulsante */}
        <motion.div
          className="absolute inset-0 m-auto w-1 h-1 rounded-full bg-gradient-to-r from-[#cc0a46] to-[#0374e5]"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>

      {/* Texto con animación de dots */}
      {text && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            centered ? 'mt-4' : 'ml-2',
            'flex items-center gap-1'
          )}
        >
          <span className={cn(
            textSizeClasses[size],
            'font-medium text-gray-700 dark:text-gray-300'
          )}>
            {text}
          </span>
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1 h-1 rounded-full bg-[#0374e5]"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeInOut'
                }}
              />
            ))}
          </span>
        </motion.div>
      )}
    </div>
  )
}
