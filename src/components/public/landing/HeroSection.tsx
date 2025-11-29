'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, ArrowRight, Package, Truck, MapPin, Clock } from 'lucide-react'

// Hook para animación de conteo
function useCountUp(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true)
    }
  }, [startOnView])

  useEffect(() => {
    if (startOnView && ref.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasStarted) {
            setHasStarted(true)
          }
        },
        { threshold: 0.1 }
      )
      observer.observe(ref.current)
      return () => observer.disconnect()
    }
  }, [startOnView, hasStarted])

  useEffect(() => {
    if (!hasStarted) return

    let startTime: number
    let animationFrame: number

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)

      // Easing function para suavizar la animación
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(easeOutQuart * end))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration, hasStarted])

  return { count, ref }
}

// Componente de estadística con conteo
function StatCounter({ value, suffix = '', label }: { value: number; suffix?: string; label: string }) {
  const { count, ref } = useCountUp(value, 2000)

  return (
    <div ref={ref}>
      <p className="text-3xl font-bold text-white">
        {count.toLocaleString()}{suffix}
      </p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}

export function HeroSection() {
  const [trackingNumber, setTrackingNumber] = useState('')
  const router = useRouter()

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault()
    if (trackingNumber.trim()) {
      router.push(`/tracking?order=${encodeURIComponent(trackingNumber.trim())}`)
    }
  }

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-gray-900">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800" />

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#cc0a46]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#0374e5]/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Entregas{' '}
              <span className="text-[#0374e5]">
                rápidas
              </span>
              , confiables y a tu alcance
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mb-8 max-w-xl">
              La plataforma de logística que conecta tu negocio con el mundo.
              Optimiza tus rutas, rastrea en tiempo real y entrega más rápido.
            </p>

            {/* Tracking Form */}
            <form onSubmit={handleTrack} className="mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="Ingresa tu número de orden..."
                    className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#0374e5] focus:ring-1 focus:ring-[#0374e5] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="px-8 py-4 bg-[#0374e5] text-white rounded-xl font-semibold hover:bg-[#0262c4] transition-colors flex items-center justify-center gap-2 shadow-lg"
                >
                  <Search className="w-5 h-5" />
                  Rastrear
                </button>
              </div>
            </form>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/login"
                className="px-8 py-4 bg-[#cc0a46] text-white rounded-xl font-semibold hover:bg-[#b00a3d] transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                Comenzar Ahora
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="#como-funciona"
                className="px-8 py-4 border border-gray-700 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center"
              >
                Saber Más
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-12 grid grid-cols-3 gap-6">
              <StatCounter value={10000} suffix="+" label="Entregas Diarias" />
              <StatCounter value={99} suffix=".5%" label="Entregas Exitosas" />
              <div>
                <p className="text-3xl font-bold text-white">24/7</p>
                <p className="text-sm text-gray-400">Soporte</p>
              </div>
            </div>
          </motion.div>

          {/* Right Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative w-full aspect-square max-w-lg mx-auto">
              {/* Main Visual Container */}
              <div className="absolute inset-0 bg-[#0374e5]/10 rounded-3xl backdrop-blur-sm border border-gray-700/50" />

              {/* Floating Cards */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-8 left-8 bg-gray-800/90 backdrop-blur-sm p-4 rounded-xl border border-gray-700 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#0374e5] flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Paquete Recibido</p>
                    <p className="text-gray-400 text-xs">Hace 2 min</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute top-1/3 right-4 bg-gray-800/90 backdrop-blur-sm p-4 rounded-xl border border-gray-700 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Truck className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">En Camino</p>
                    <p className="text-gray-400 text-xs">ETA: 15 min</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-16 left-12 bg-gray-800/90 backdrop-blur-sm p-4 rounded-xl border border-gray-700 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Ubicación en Vivo</p>
                    <p className="text-gray-400 text-xs">Rastreo GPS</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                className="absolute bottom-8 right-8 bg-gray-800/90 backdrop-blur-sm p-4 rounded-xl border border-gray-700 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">Entrega Rápida</p>
                    <p className="text-gray-400 text-xs">Mismo día</p>
                  </div>
                </div>
              </motion.div>

              {/* Center Icon */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-24 h-24 rounded-2xl bg-[#0374e5] flex items-center justify-center shadow-2xl">
                  <Truck className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
