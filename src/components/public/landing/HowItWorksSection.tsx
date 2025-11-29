'use client'

import { motion } from 'framer-motion'
import { UserPlus, Calendar, MapPin, CheckCircle } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: UserPlus,
    title: 'Registra tu Negocio',
    description: 'Crea tu cuenta empresarial en minutos y configura tu perfil de envíos.',
  },
  {
    number: '02',
    icon: Calendar,
    title: 'Programa Recogidas',
    description: 'Agenda tus recogidas de paquetes cuando te sea más conveniente.',
  },
  {
    number: '03',
    icon: MapPin,
    title: 'Rastrea en Tiempo Real',
    description: 'Sigue cada paquete con GPS en vivo y recibe notificaciones automáticas.',
  },
  {
    number: '04',
    icon: CheckCircle,
    title: 'Entrega Confirmada',
    description: 'Recibe confirmación de entrega con foto y firma digital del destinatario.',
  },
]

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-20 lg:py-32 bg-gray-800">
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
            Cómo{' '}
            <span className="text-[#0374e5]">
              Funciona
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Empieza a enviar en 4 simples pasos. Sin complicaciones, sin demoras.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line - Desktop */}
          <div className="hidden lg:block absolute top-24 left-[calc(12.5%+2rem)] right-[calc(12.5%+2rem)] h-0.5 bg-[#0374e5]" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                {/* Step Card */}
                <div className="flex flex-col items-center text-center">
                  {/* Step Number with Icon */}
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-[#0374e5] flex items-center justify-center shadow-lg shadow-[#0374e5]/20">
                      <step.icon className="w-10 h-10 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gray-900 border-2 border-[#0374e5] flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{step.number}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>

                {/* Mobile Connection Line */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center my-6">
                    <div className="w-0.5 h-8 bg-[#0374e5]" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
