'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { LoginForm } from '@/components/forms/LoginForm'

export default function LoginPage() {
  const router = useRouter()

  const handleLoginSuccess = () => {
    console.log('✅ LoginPage - handleLoginSuccess llamado')
    // La redirección se manejará automáticamente por el AuthProvider
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {/* Reflejos principales de marca Exa */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-exa-primary/25 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-exa-secondary/25 rounded-full filter blur-3xl animate-pulse delay-1000" />

        {/* Más reflejos de color primario (rojo Exa) */}
        <div className="absolute top-20 right-1/4 w-72 h-72 bg-exa-primary/18 rounded-full filter blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-32 left-1/3 w-80 h-80 bg-exa-primary/15 rounded-full filter blur-3xl animate-pulse delay-300" />
        <div className="absolute top-1/3 right-1/5 w-64 h-64 bg-exa-primary/20 rounded-full filter blur-3xl animate-pulse delay-1200" />
        <div className="absolute bottom-1/4 left-1/6 w-56 h-56 bg-exa-primary/12 rounded-full filter blur-2xl animate-pulse delay-900" />
        <div className="absolute top-3/4 right-1/3 w-48 h-48 bg-exa-primary/16 rounded-full filter blur-2xl animate-pulse delay-600" />
        <div className="absolute left-1/5 top-1/6 w-68 h-68 bg-exa-primary/14 rounded-full filter blur-3xl animate-pulse delay-1500" />
        <div className="absolute right-1/6 bottom-1/5 w-60 h-60 bg-exa-primary/18 rounded-full filter blur-2xl animate-pulse delay-400" />
        <div className="absolute top-2/3 left-1/4 w-52 h-52 bg-exa-primary/10 rounded-full filter blur-3xl animate-pulse delay-1100" />

        {/* Más reflejos de color secundario (azul Exa) */}
        <div className="absolute bottom-1/3 right-1/4 w-76 h-76 bg-exa-secondary/15 rounded-full filter blur-3xl animate-pulse delay-800" />
        <div className="absolute top-1/5 left-1/2 w-64 h-64 bg-exa-secondary/12 rounded-full filter blur-2xl animate-pulse delay-1400" />
        <div className="absolute top-3/5 left-1/6 w-56 h-56 bg-exa-secondary/18 rounded-full filter blur-3xl animate-pulse delay-200" />
        <div className="absolute bottom-2/5 right-1/5 w-48 h-48 bg-exa-secondary/14 rounded-full filter blur-2xl animate-pulse delay-1700" />
        <div className="absolute left-2/5 top-1/4 w-72 h-72 bg-exa-secondary/16 rounded-full filter blur-3xl animate-pulse delay-500" />
        <div className="absolute right-2/5 bottom-1/6 w-40 h-40 bg-exa-secondary/20 rounded-full filter blur-2xl animate-pulse delay-1300" />
        <div className="absolute top-4/5 left-1/3 w-52 h-52 bg-exa-secondary/12 rounded-full filter blur-3xl animate-pulse delay-900" />
        <div className="absolute bottom-1/6 right-2/3 w-44 h-44 bg-exa-secondary/16 rounded-full filter blur-3xl animate-pulse delay-1600" />
        <div className="absolute left-1/4 top-2/3 w-60 h-60 bg-exa-secondary/14 rounded-full filter blur-3xl animate-pulse delay-400" />
        <div className="absolute right-1/3 top-1/6 w-36 h-36 bg-exa-secondary/18 rounded-full filter blur-3xl animate-pulse delay-1100" />
      </div>


      {/* Main Container - Centrado */}
      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl"
        >
          {/* Logo Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex justify-center pt-8 pb-4"
          >
            <img
              src="/logo-blanco.png"
              alt="LogiRapid"
              className="object-contain w-full max-w-xs h-auto"
              onError={(e) => {
                console.error('Error loading logo:', e);
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="text-white font-bold text-3xl tracking-wider px-4 py-2">
                      LogiRapid
                    </div>
                  `;
                }
              }}
              onLoad={() => {
                console.log('Logo loaded successfully');
              }}
            />
          </motion.div>

          {/* Form Content */}
          <div className="p-8 pt-4">
            <LoginForm onSuccess={handleLoginSuccess} />

            {/* Alternative Login */}
            <div className="mt-8 text-center">
              <p className="text-gray-400 text-sm mb-4">
                ¿Necesitas ayuda?{' '}
                <button className="text-exa-primary hover:text-exa-secondary transition-colors">
                  Contacta soporte
                </button>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <p className="text-gray-500 text-xs">
            © 2024 LogiRapid. Todos los derechos reservados.
          </p>
        </motion.div>
      </div>

      {/* Floating Elements */}
      <motion.div
        className="absolute top-20 right-20 w-4 h-4 bg-exa-primary rounded-full opacity-80"
        animate={{
          y: [0, -40, 0],
          x: [0, 25, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-32 left-16 w-3 h-3 bg-exa-secondary rounded-full opacity-70"
        animate={{
          y: [0, -25, 0],
          x: [0, -20, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
      <motion.div
        className="absolute top-1/3 left-1/4 w-3 h-3 bg-exa-primary rounded-full opacity-60"
        animate={{
          y: [0, -30, 0],
          x: [0, 15, 0],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-exa-secondary rounded-full opacity-70"
        animate={{
          y: [0, -20, 0],
          x: [0, -18, 0],
        }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5
        }}
      />
      <motion.div
        className="absolute top-2/3 right-1/5 w-3 h-3 bg-exa-primary rounded-full opacity-60"
        animate={{
          y: [0, -35, 0],
          x: [0, 20, 0],
        }}
        transition={{
          duration: 4.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.8
        }}
      />
      <motion.div
        className="absolute left-1/6 top-1/4 w-2 h-2 bg-exa-secondary rounded-full opacity-80"
        animate={{
          y: [0, -25, 0],
          x: [0, -15, 0],
        }}
        transition={{
          duration: 3.3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.2
        }}
      />
      <motion.div
        className="absolute top-1/5 right-1/3 w-3 h-3 bg-exa-primary rounded-full opacity-70"
        animate={{
          y: [0, -30, 0],
          x: [0, 20, 0],
        }}
        transition={{
          duration: 3.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.8
        }}
      />
      <motion.div
        className="absolute bottom-1/5 left-1/3 w-2 h-2 bg-exa-secondary rounded-full opacity-75"
        animate={{
          y: [0, -25, 0],
          x: [0, -18, 0],
        }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.3
        }}
      />
      <motion.div
        className="absolute top-3/5 left-1/5 w-3 h-3 bg-exa-primary rounded-full opacity-65"
        animate={{
          y: [0, -35, 0],
          x: [0, 15, 0],
        }}
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.6
        }}
      />
      <motion.div
        className="absolute bottom-3/5 right-1/4 w-2 h-2 bg-exa-secondary rounded-full opacity-70"
        animate={{
          y: [0, -20, 0],
          x: [0, 22, 0],
        }}
        transition={{
          duration: 2.9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.7
        }}
      />
    </div>
  )
}