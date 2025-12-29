'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ticket,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useTheme } from '@/contexts/theme-context'
import type { SupportTicket } from '@/types/support'

// FAQ Data
const faqs = [
  {
    question: "Como crear una orden de paquete?",
    answer: `Para crear una orden de paquete:
1. Ve a "Ordenes de Paquetes" en el menu lateral
2. Click en "Nueva Orden"
3. Selecciona o crea el cliente remitente
4. Agrega los datos del destinatario en Cuba
5. Agrega los productos/paquetes con peso y dimensiones
6. Selecciona la ruta y servicio de envio
7. Revisa los costos y confirma la orden
8. Procesa el pago (efectivo, tarjeta o wallet)`
  },
  {
    question: "Como recargar mi wallet?",
    answer: `Para recargar tu wallet:
1. Click en el balance que aparece en el header superior
2. O ve a "Wallet" en el menu lateral
3. Selecciona "Recargar"
4. Elige el metodo de pago (Stripe, Square, transferencia)
5. Ingresa el monto a recargar
6. Completa el proceso de pago`
  },
  {
    question: "Porque no puedo acceder a un modulo?",
    answer: `Si no puedes acceder a un modulo puede ser por:
1. El servicio no esta habilitado para tu empresa
2. Tu rol no tiene permisos para ese modulo
3. Tu cuenta tiene restricciones especificas

Contacta al administrador de tu empresa o al soporte de LogiRapid para revisar tus permisos.`
  },
  {
    question: "Como publicar un producto en el marketplace?",
    answer: `Para publicar en el marketplace (solo empresas tipo Mercado):
1. Ve a "Marketplace" en el menu lateral
2. Click en "Nueva Publicacion"
3. Selecciona el producto de tu inventario
4. Elige el almacen que tiene stock disponible
5. Define la cantidad a publicar y el precio
6. Revisa las alertas de precio (margen, competencia)
7. Envia a aprobacion

El equipo de LogiRapid revisara y aprobara tu publicacion.`
  },
  {
    question: "Como gestionar mi inventario?",
    answer: `Para gestionar tu inventario:
1. Ve a "Inventario" en el menu lateral
2. Puedes crear productos nuevos con "Nuevo Producto"
3. Gestiona categorias y precios
4. Asigna stock por almacen
5. Realiza transferencias entre almacenes
6. Revisa el historial de movimientos

Tips:
- Usa el boton de AI para generar descripciones automaticas
- Configura alertas de stock bajo
- Exporta reportes para analisis`
  },
  {
    question: "Que hago si mi pago no se refleja?",
    answer: `Si tu pago no se refleja:
1. Espera unos minutos - los pagos con tarjeta pueden demorar
2. Actualiza la pagina (F5)
3. Revisa tu correo para confirmacion del pago
4. Ve a Wallet > Movimientos para ver transacciones pendientes

Si despues de 15 minutos no aparece:
- Toma captura del comprobante de pago
- Contacta a soporte con el numero de transaccion
- Crearemos un ticket de investigacion`
  }
]

const statusColors = {
  open: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Abierto' },
  in_progress: { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'En Progreso' },
  resolved: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', label: 'Resuelto' },
  closed: { bg: 'bg-gray-500/10', text: 'text-gray-500', label: 'Cerrado' }
}

const priorityColors = {
  low: 'text-gray-500',
  medium: 'text-blue-500',
  high: 'text-amber-500',
  critical: 'text-red-500'
}

export default function SupportPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0
  })
  const [loading, setLoading] = useState(true)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'faq' | 'tickets'>('faq')

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/support/tickets')
      const data = await response.json()

      if (data.success) {
        setTickets(data.data.tickets)
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Centro de Soporte
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Encuentra respuestas a tus preguntas o contacta con nuestro equipo
          </p>
        </div>

        {/* Quick Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`p-5 rounded-xl border ${
              isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Chat con AI
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Respuestas instantaneas 24/7
                </p>
              </div>
            </div>
            <p className={`mt-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Usa el boton flotante en la esquina inferior derecha para chatear con nuestro asistente AI.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`p-5 rounded-xl border ${
              isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Email de Soporte
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Respuesta en 24 horas
                </p>
              </div>
            </div>
            <a
              href="mailto:soporte@logirapid.com"
              className={`mt-3 text-sm flex items-center gap-1 ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              soporte@logirapid.com
              <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`p-5 rounded-xl border ${
              isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Telefono
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Lun-Vie 9am-6pm EST
                </p>
              </div>
            </div>
            <a
              href="tel:+13059997777"
              className={`mt-3 text-sm flex items-center gap-1 ${
                isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              +1 (305) 999-7777
              <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className={`flex gap-1 p-1 rounded-lg mb-6 w-fit ${
          isDark ? 'bg-gray-800' : 'bg-gray-100'
        }`}>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'faq'
                ? isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Preguntas Frecuentes
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'tickets'
                ? isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Mis Tickets
            {stats.open > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-500 text-white">
                {stats.open}
              </span>
            )}
          </button>
        </div>

        {/* FAQ Section */}
        {activeTab === 'faq' && (
          <div className={`rounded-xl border ${
            isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`${index !== 0 ? 'border-t' : ''} ${
                  isDark ? 'border-gray-700' : 'border-gray-200'
                }`}
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                >
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {faq.question}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronDown className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  ) : (
                    <ChevronRight className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  )}
                </button>
                <AnimatePresence>
                  {expandedFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={`px-5 pb-4 text-sm whitespace-pre-line ${
                        isDark ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* Tickets Section */}
        {activeTab === 'tickets' && (
          <div className={`rounded-xl border ${
            isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            {/* Stats */}
            <div className={`px-5 py-4 border-b flex items-center justify-between ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total:</span>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Abiertos: {stats.open}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>En progreso: {stats.inProgress}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Resueltos: {stats.resolved}</span>
                </div>
              </div>
              <button
                onClick={fetchTickets}
                className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''} ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`} />
              </button>
            </div>

            {/* Tickets List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                <h3 className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  No tienes tickets
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Cuando escalas una conversacion del chat, aparecera aqui
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`px-5 py-4 hover:${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {ticket.ticketCode}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            statusColors[ticket.status].bg
                          } ${statusColors[ticket.status].text}`}>
                            {statusColors[ticket.status].label}
                          </span>
                          <span className={`text-xs ${priorityColors[ticket.priority]}`}>
                            {ticket.priority === 'critical' ? 'Critico' :
                             ticket.priority === 'high' ? 'Alta' :
                             ticket.priority === 'medium' ? 'Media' : 'Baja'}
                          </span>
                        </div>
                        <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {ticket.subject}
                        </h4>
                        <p className={`text-sm mt-1 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {ticket.description}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <div className={`flex items-center gap-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          <Clock className="w-3 h-3" />
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                        {ticket.status === 'resolved' && (
                          <div className={`flex items-center gap-1 text-xs mt-1 text-emerald-500`}>
                            <CheckCircle2 className="w-3 h-3" />
                            Resuelto
                          </div>
                        )}
                      </div>
                    </div>
                    {ticket.resolution && (
                      <div className={`mt-3 p-3 rounded-lg text-sm ${
                        isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        <strong>Resolucion:</strong> {ticket.resolution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
