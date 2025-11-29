'use client'

import { motion } from 'framer-motion'
import { MapPin, Truck, Smartphone, DollarSign, Shield, Clock, Route, Users } from 'lucide-react'

const features = [
  {
    icon: MapPin,
    title: 'Rastreo en Tiempo Real',
    description: 'Sigue tus paquetes en tiempo real con actualizaciones GPS precisas y notificaciones instantáneas.',
    color: 'bg-[#0374e5]',
  },
  {
    icon: Truck,
    title: 'Entregas el Mismo Día',
    description: 'Servicio de entrega express para que tus paquetes lleguen cuando más los necesitas.',
    color: 'bg-[#0374e5]',
  },
  {
    icon: Smartphone,
    title: 'App para Drivers',
    description: 'Aplicación móvil intuitiva para conductores con navegación optimizada y gestión de entregas.',
    color: 'bg-[#0374e5]',
  },
  {
    icon: DollarSign,
    title: 'Precios Competitivos',
    description: 'Tarifas transparentes y competitivas sin costos ocultos. Ahorra en cada envío.',
    color: 'bg-[#0374e5]',
  },
  {
    icon: Route,
    title: 'Rutas Optimizadas',
    description: 'Algoritmos inteligentes que optimizan las rutas para entregas más rápidas y eficientes.',
    color: 'bg-[#0374e5]',
  },
  {
    icon: Shield,
    title: 'Envíos Seguros',
    description: 'Protección completa para tus paquetes con seguro incluido en todos los envíos.',
    color: 'bg-[#0374e5]',
  },
  {
    icon: Clock,
    title: 'Disponibilidad 24/7',
    description: 'Soporte al cliente las 24 horas, los 7 días de la semana para resolver cualquier consulta.',
    color: 'bg-[#0374e5]',
  },
  {
    icon: Users,
    title: 'Red de Conductores',
    description: 'Amplia red de conductores verificados y capacitados para garantizar entregas confiables.',
    color: 'bg-[#0374e5]',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
}

export function FeaturesSection() {
  return (
    <section id="servicios" className="py-20 lg:py-32 bg-gray-900">
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
            Por qué elegir{' '}
            <span className="text-[#0374e5]">
              LogiRapid
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Ofrecemos soluciones de logística completas diseñadas para impulsar tu negocio
            con tecnología de vanguardia.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group p-6 bg-gray-800/50 border border-gray-700/50 rounded-2xl hover:bg-gray-800 hover:border-gray-600 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
