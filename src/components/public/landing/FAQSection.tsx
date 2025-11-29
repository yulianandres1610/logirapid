'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: '¿Cómo puedo rastrear mi paquete?',
    answer: 'Puedes rastrear tu paquete ingresando el número de orden en la sección de rastreo de nuestra página principal o en la app. Recibirás actualizaciones en tiempo real sobre la ubicación y estado de tu envío.',
  },
  {
    question: '¿Cuáles son los tiempos de entrega?',
    answer: 'Los tiempos de entrega varían según el servicio seleccionado. Ofrecemos entregas el mismo día para pedidos urgentes, entregas express en 24-48 horas, y envíos estándar en 3-5 días hábiles.',
  },
  {
    question: '¿Ofrecen entregas el mismo día?',
    answer: 'Sí, ofrecemos servicio de entrega el mismo día para pedidos realizados antes de las 2:00 PM en zonas metropolitanas. Este servicio está disponible en la mayoría de las ciudades principales.',
  },
  {
    question: '¿Cómo me registro como empresa?',
    answer: 'El registro es simple y gratuito. Haz clic en "Comenzar Ahora", completa el formulario con los datos de tu empresa, verifica tu email y estarás listo para comenzar a enviar. El proceso toma menos de 5 minutos.',
  },
  {
    question: '¿Qué pasa si mi paquete se pierde o daña?',
    answer: 'Todos nuestros envíos incluyen seguro básico. En caso de pérdida o daño, contáctanos dentro de las 48 horas siguientes a la entrega programada. Procesaremos tu reclamo y te compensaremos según los términos de nuestro seguro.',
  },
  {
    question: '¿Puedo programar recogidas recurrentes?',
    answer: 'Sí, con nuestros planes Profesional y Enterprise puedes configurar recogidas programadas diarias, semanales o personalizadas según las necesidades de tu negocio.',
  },
  {
    question: '¿Tienen API para integración?',
    answer: 'Sí, ofrecemos una API REST completa para integrar nuestros servicios de envío directamente en tu plataforma o tienda online. La documentación está disponible para usuarios de planes Profesional y Enterprise.',
  },
  {
    question: '¿En qué zonas operan?',
    answer: 'Actualmente operamos en las principales ciudades de Estados Unidos, con cobertura especial en Florida, Texas, California y Nueva York. Contáctanos para verificar la cobertura en tu área específica.',
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-20 lg:py-32 bg-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Preguntas{' '}
            <span className="text-[#0374e5]">
              Frecuentes
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Encuentra respuestas a las preguntas más comunes sobre nuestros servicios.
          </p>
        </motion.div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className={`w-full text-left p-5 rounded-xl border transition-all duration-200 ${
                  openIndex === index
                    ? 'bg-gray-900 border-[#0374e5]/50'
                    : 'bg-gray-900/50 border-gray-700/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-white">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                  />
                </div>
                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-4 text-gray-400 text-sm leading-relaxed">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
