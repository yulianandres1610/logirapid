'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface BackgroundDecorationsProps {
  className?: string
}

export function BackgroundDecorations({ className }: BackgroundDecorationsProps) {
  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)}>
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />

      {/* Animated Gradient Orbs */}
      <motion.div
        className="absolute top-0 left-0 w-96 h-96 bg-exa-primary rounded-full opacity-10 blur-3xl"
        animate={{
          x: [0, 100, 0],
          y: [0, -100, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      <motion.div
        className="absolute bottom-0 right-0 w-96 h-96 bg-exa-secondary rounded-full opacity-10 blur-3xl"
        animate={{
          x: [0, -100, 0],
          y: [0, 100, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      <motion.div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600 rounded-full opacity-5 blur-2xl"
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Floating Shapes */}
      <motion.div
        className="absolute top-20 left-20 w-4 h-4 bg-exa-primary rounded-full opacity-20"
        animate={{
          y: [0, -30, 0],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <motion.div
        className="absolute top-40 right-32 w-3 h-3 bg-exa-secondary rounded-full opacity-30"
        animate={{
          y: [0, -20, 0],
          x: [0, 10, 0],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />

      <motion.div
        className="absolute bottom-32 left-16 w-5 h-5 bg-purple-500 rounded-full opacity-15"
        animate={{
          y: [0, -25, 0],
          x: [0, -15, 0],
          opacity: [0.15, 0.4, 0.15],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      />

      <motion.div
        className="absolute bottom-20 right-20 w-2 h-2 bg-exa-primary rounded-full opacity-40"
        animate={{
          y: [0, -15, 0],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
      />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Noise Texture Overlay */}
      <div
        className="absolute inset-0 opacity-5 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  )
}