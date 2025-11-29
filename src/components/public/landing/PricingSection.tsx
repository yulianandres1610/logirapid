'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Check, Star, Zap, Building2 } from 'lucide-react'
import Link from 'next/link'

// Hook para animación de conteo
function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (ref.current) {
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
  }, [hasStarted])

  useEffect(() => {
    if (!hasStarted) return

    let startTime: number
    let animationFrame: number

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
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

// Componente de precio con animación
function AnimatedPrice({ price, period }: { price: number | null; period: string }) {
  const { count, ref } = useCountUp(price || 0, 1500)

  if (price === null) {
    return (
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-4xl font-bold text-white">Contactar</span>
      </div>
    )
  }

  return (
    <div className="flex items-baseline justify-center gap-1">
      <span ref={ref} className="text-4xl font-bold text-white">
        ${count}
      </span>
      {period && <span className="text-gray-400">{period}</span>}
    </div>
  )
}

const plans = [
  {
    name: 'Básico',
    price: 99,
    period: '/mes',
    description: 'Ideal para pequeños negocios que inician con envíos.',
    icon: Zap,
    features: [
      'Hasta 100 envíos mensuales',
      'Rastreo en tiempo real',
      'Soporte por email',
      'Dashboard básico',
      'Reportes mensuales',
    ],
    cta: 'Comenzar Gratis',
    popular: false,
  },
  {
    name: 'Profesional',
    price: 299,
    period: '/mes',
    description: 'Para negocios en crecimiento con necesidades avanzadas.',
    icon: Star,
    features: [
      'Hasta 500 envíos mensuales',
      'Rastreo en tiempo real',
      'Soporte prioritario 24/7',
      'API completa',
      'Rutas optimizadas',
      'Reportes avanzados',
      'Integraciones e-commerce',
    ],
    cta: 'Elegir Plan',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: null,
    period: '',
    description: 'Soluciones personalizadas para grandes empresas.',
    icon: Building2,
    features: [
      'Envíos ilimitados',
      'Soporte dedicado',
      'API personalizada',
      'SLA garantizado',
      'Integración white-label',
      'Conductor dedicado',
      'Consultoría logística',
      'Facturación personalizada',
    ],
    cta: 'Contactar Ventas',
    popular: false,
  },
]

export function PricingSection() {
  return (
    <section id="precios" className="py-20 lg:py-32 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Planes y{' '}
            <span className="text-[#0374e5]">
              Precios
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Elige el plan que mejor se adapte a las necesidades de tu negocio.
            Sin compromisos, cancela cuando quieras.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative p-8 rounded-2xl border ${
                plan.popular
                  ? 'bg-gray-800 border-[#0374e5]/50 shadow-xl shadow-[#0374e5]/10'
                  : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
              } transition-all duration-300`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="px-4 py-1 bg-[#0374e5] rounded-full text-white text-sm font-semibold">
                    Más Popular
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <div className={`w-14 h-14 mx-auto mb-4 rounded-xl ${
                  plan.popular
                    ? 'bg-[#0374e5]'
                    : 'bg-gray-700'
                } flex items-center justify-center`}>
                  <plan.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <AnimatedPrice price={plan.price} period={plan.period} />
                <p className="text-gray-400 text-sm mt-2">{plan.description}</p>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3">
                    <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                      plan.popular ? 'text-[#0374e5]' : 'text-green-500'
                    }`} />
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.name === 'Enterprise' ? '#contacto' : '/login'}
                className={`block w-full py-3 px-6 rounded-xl font-semibold text-center transition-all ${
                  plan.popular
                    ? 'bg-[#0374e5] text-white hover:bg-[#0262c4]'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
