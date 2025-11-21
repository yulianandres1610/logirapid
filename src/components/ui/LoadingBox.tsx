'use client'

import { motion } from 'framer-motion'
import { Package } from 'lucide-react'

interface LoadingBoxProps {
  text?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function LoadingBox({
  text = 'Cargando...',
  size = 'md',
  className
}: LoadingBoxProps) {
  const sizeClasses = {
    sm: { container: 'w-16 h-16', icon: 'w-6 h-6', border: 'border-2' },
    md: { container: 'w-20 h-20', icon: 'w-8 h-8', border: 'border-3' },
    lg: { container: 'w-24 h-24', icon: 'w-10 h-10', border: 'border-4' }
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  const currentSize = sizeClasses[size]

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className || ''}`}>
      {/* Spinner circular con cajita en el centro */}
      <div className="relative">
        {/* Círculo/borde girando */}
        <motion.div
          className={`${currentSize.container} rounded-full ${currentSize.border} border-[#0374e5] border-t-transparent`}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear"
          }}
        />

        {/* Cajita en el centro */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Package className={`${currentSize.icon} text-[#0374e5]`} />
        </div>
      </div>

      {/* Texto de carga */}
      {text && (
        <motion.p
          className={`font-medium text-gray-700 dark:text-gray-300 ${textSizeClasses[size]}`}
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {text}
        </motion.p>
      )}
    </div>
  )
}
