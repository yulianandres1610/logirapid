'use client'

import { motion } from 'framer-motion'
import { useEffect } from 'react'

interface LoadingScreenProps {
  onComplete?: () => void
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  useEffect(() => {
    console.log('📺 LoadingScreen - Montado, iniciando temporizador')

    // Iniciar el temporizador inmediatamente
    const timer = setTimeout(() => {
      console.log('📺 LoadingScreen - Tiempo completado, llamando a onComplete')
      if (onComplete) {
        onComplete()
      }
    }, 3500) // 3.5 segundos

    return () => {
      console.log('📺 LoadingScreen - Desmontado, limpiando temporizador')
      clearTimeout(timer)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-exa-primary/20 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-exa-secondary/20 rounded-full filter blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-exa-primary/10 rounded-full filter blur-2xl animate-pulse delay-500" />

        {/* Additional brand lights */}
        <div className="absolute top-20 right-1/4 w-64 h-64 bg-exa-secondary/15 rounded-full filter blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-32 left-1/3 w-72 h-72 bg-exa-primary/12 rounded-full filter blur-3xl animate-pulse delay-300" />
        <div className="absolute top-1/3 right-1/5 w-56 h-56 bg-exa-secondary/10 rounded-full filter blur-2xl animate-pulse delay-1200" />
        <div className="absolute bottom-1/4 left-1/6 w-48 h-48 bg-exa-primary/12 rounded-full filter blur-2xl animate-pulse delay-900" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Logo Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0.8, 1, 1, 1.2]
          }}
          transition={{
            duration: 3,
            times: [0, 0.2, 0.8, 1],
            ease: "easeInOut"
          }}
          className="relative"
        >
          {/* Logo Glow Effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-exa rounded-3xl opacity-20 blur-xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Logo Image */}
          <motion.img
            src="/images/logoheader.png"
            alt="LogiRapid"
            className="w-48 h-auto object-contain relative z-10"
            animate={{
              rotateY: [0, 360],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear"
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                parent.innerHTML = '<div class="text-white font-bold text-4xl tracking-wider">LogiRapid</div>'
              }
            }}
          />
        </motion.div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center space-y-4"
        >
          <motion.h1
            className="text-4xl font-bold text-white tracking-wider"
            animate={{
              background: [
                "linear-gradient(to right, #ffffff, #cc0a46)",
                "linear-gradient(to right, #cc0a46, #0374e5)",
                "linear-gradient(to right, #0374e5, #ffffff)",
                "linear-gradient(to right, #ffffff, #cc0a46)"
              ],
            }}
            style={{
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              backgroundSize: "200% 100%"
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            LogiRapid
          </motion.h1>

          <motion.p
            className="text-xl text-gray-300"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Preparando tu experiencia...
          </motion.p>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "300px", opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="relative"
        >
          <div className="w-72 h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-exa rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: 2.5,
                delay: 1,
                ease: "easeInOut"
              }}
            />
          </div>

          {/* Pulsing dots around progress bar */}
          <motion.div
            className="absolute -top-1 left-0 w-4 h-4 bg-exa-primary rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className="absolute -top-1 right-0 w-4 h-4 bg-exa-secondary rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.75
            }}
          />
        </motion.div>

        {/* Loading Messages */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="text-center space-y-2"
        >
          <motion.div
            className="flex items-center space-x-2 justify-center"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className="w-2 h-2 bg-exa-primary rounded-full animate-pulse" />
            <span className="text-sm text-gray-400">Verificando credenciales</span>
          </motion.div>

          <motion.div
            className="flex items-center space-x-2 justify-center"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
          >
            <div className="w-2 h-2 bg-exa-secondary rounded-full animate-pulse" />
            <span className="text-sm text-gray-400">Configurando tu espacio</span>
          </motion.div>

          <motion.div
            className="flex items-center space-x-2 justify-center"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
          >
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-400">Cargando dashboard</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}