'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ticket,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  Plus,
  Search,
  X,
  FileText,
  MessageCircle,
  Upload,
  Camera,
  Check,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Image as ImageIcon
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import type { SupportTicket } from '@/types/support'

// Wizard Types
type WizardStep = 'info' | 'details' | 'review'

interface WizardStepConfig {
  id: WizardStep
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const WIZARD_STEPS: WizardStepConfig[] = [
  { id: 'info', title: 'Informacion', description: 'Asunto', icon: FileText },
  { id: 'details', title: 'Detalles', description: 'Descripcion', icon: MessageCircle },
  { id: 'review', title: 'Confirmar', description: 'Enviar', icon: Check }
]

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
  open: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Abierto', gradient: 'from-blue-400 to-blue-600' },
  in_progress: { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'En Progreso', gradient: 'from-amber-400 to-orange-600' },
  resolved: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', label: 'Resuelto', gradient: 'from-emerald-400 to-green-600' },
  closed: { bg: 'bg-gray-500/10', text: 'text-gray-500', label: 'Cerrado', gradient: 'from-gray-400 to-gray-600' }
}

const priorityConfig = {
  low: { label: 'Baja', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-900/30' },
  medium: { label: 'Media', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  high: { label: 'Alta', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  critical: { label: 'Critica', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' }
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
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('info')
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [ticketScreenshots, setTicketScreenshots] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createdTicket, setCreatedTicket] = useState<{ ticketId: number; ticketCode: string } | null>(null)
  const [wizardErrors, setWizardErrors] = useState<Record<string, string>>({})

  const currentStepIndex = WIZARD_STEPS.findIndex(s => s.id === wizardStep)

  const fetchTickets = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const response = await fetch('/api/support/tickets')
      const data = await response.json()

      if (data.success) {
        setTickets(data.data.tickets)
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const handleManualRefresh = () => fetchTickets(true)

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = !search ||
      ticket.ticketCode.toLowerCase().includes(search.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = !selectedStatus || ticket.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  // Wizard functions
  const validateStep = (step: WizardStep): boolean => {
    const errors: Record<string, string> = {}

    if (step === 'info') {
      if (!ticketSubject.trim()) errors.subject = 'El asunto es requerido'
      else if (ticketSubject.length < 10) errors.subject = 'El asunto debe tener al menos 10 caracteres'
    }

    if (step === 'details') {
      if (!ticketDescription.trim()) errors.description = 'La descripcion es requerida'
      else if (ticketDescription.length < 20) errors.description = 'La descripcion debe tener al menos 20 caracteres'
    }

    setWizardErrors(errors)
    return Object.keys(errors).length === 0
  }

  const goToNextStep = () => {
    if (validateStep(wizardStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < WIZARD_STEPS.length) {
        setWizardStep(WIZARD_STEPS[nextIndex].id)
      }
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setWizardStep(WIZARD_STEPS[prevIndex].id)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setWizardErrors({ ...wizardErrors, image: 'Solo se permiten imagenes' })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setWizardErrors({ ...wizardErrors, image: 'La imagen debe ser menor a 5MB' })
      return
    }

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'support-screenshots')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (data.success && data.url) {
        setTicketScreenshots([...ticketScreenshots, data.url])
        setWizardErrors({ ...wizardErrors, image: '' })
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      setWizardErrors({ ...wizardErrors, image: 'Error al subir la imagen' })
    } finally {
      setUploadingImage(false)
    }
  }

  const removeScreenshot = (index: number) => {
    setTicketScreenshots(ticketScreenshots.filter((_, i) => i !== index))
  }

  const handleSubmitTicket = async () => {
    if (!validateStep('details')) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: ticketSubject,
          description: ticketDescription,
          priority: ticketPriority,
          screenshots: ticketScreenshots
        })
      })

      const data = await response.json()
      if (data.success) {
        setCreatedTicket(data.data)
        fetchTickets(true)
      } else {
        setWizardErrors({ submit: data.error || 'Error al crear el ticket' })
      }
    } catch (error) {
      console.error('Error creating ticket:', error)
      setWizardErrors({ submit: 'Error de conexion' })
    } finally {
      setSubmitting(false)
    }
  }

  const resetWizard = () => {
    setShowWizard(false)
    setWizardStep('info')
    setTicketSubject('')
    setTicketDescription('')
    setTicketPriority('medium')
    setTicketScreenshots([])
    setCreatedTicket(null)
    setWizardErrors({})
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Quick Contact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.02 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border shadow-xl p-5',
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl',
                  isDark ? 'bg-blue-900/30' : 'bg-blue-100'
                )}>
                  <HelpCircle className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    Chat con AI
                  </h3>
                  <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Respuestas instantaneas 24/7
                  </p>
                </div>
              </div>
              <p className={cn('mt-3 text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>
                Usa el boton flotante en la esquina inferior derecha.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={{ scale: 1.02 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border shadow-xl p-5',
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl',
                  isDark ? 'bg-emerald-900/30' : 'bg-emerald-100'
                )}>
                  <Mail className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    Email de Soporte
                  </h3>
                  <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Respuesta en 24 horas
                  </p>
                </div>
              </div>
              <a
                href="mailto:soporte@logirapid.com"
                className={cn(
                  'mt-3 text-sm flex items-center gap-1',
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                )}
              >
                soporte@logirapid.com
                <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.02 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border shadow-xl p-5',
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl',
                  isDark ? 'bg-purple-900/30' : 'bg-purple-100'
                )}>
                  <Phone className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    Telefono
                  </h3>
                  <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Lun-Vie 9am-6pm EST
                  </p>
                </div>
              </div>
              <a
                href="tel:+16452432403"
                className={cn(
                  'mt-3 text-sm flex items-center gap-1',
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                )}
              >
                +1 (645) 243-2403
                <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>
          </div>

          {/* Filters and Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn(
              'p-4 rounded-2xl border shadow-xl',
              isDark
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}
          >
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Tabs */}
              <div className={cn(
                'flex gap-1 p-1 rounded-xl',
                isDark ? 'bg-gray-700/50' : 'bg-gray-100'
              )}>
                <button
                  onClick={() => setActiveTab('faq')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    activeTab === 'faq'
                      ? isDark ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 shadow-sm'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Preguntas Frecuentes
                </button>
                <button
                  onClick={() => setActiveTab('tickets')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                    activeTab === 'tickets'
                      ? isDark ? 'bg-gray-600 text-white' : 'bg-white text-gray-900 shadow-sm'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Mis Tickets
                  {stats.open > 0 && (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-500 text-white">
                      {stats.open}
                    </span>
                  )}
                </button>
              </div>

              {activeTab === 'tickets' && (
                <>
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por codigo o asunto..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={cn(
                        'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        isDark
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* Clear Filters */}
                  {(search || selectedStatus) && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSearch('')
                        setSelectedStatus(null)
                      }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                        isDark
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      <X className="w-4 h-4" />
                      Limpiar
                    </motion.button>
                  )}
                </>
              )}

              {/* Refresh */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleManualRefresh}
                disabled={loading || isRefreshing}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                  isDark
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  isRefreshing && 'opacity-75'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
              </motion.button>

              {/* Nuevo Ticket */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
              >
                <Plus className="w-5 h-5" />
                Nuevo Ticket
              </motion.button>
            </div>
          </motion.div>

          {/* FAQ Section */}
          {activeTab === 'faq' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className={cn(
                    index !== 0 ? 'border-t' : '',
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  )}
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left"
                  >
                    <span className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {faq.question}
                    </span>
                    {expandedFaq === index ? (
                      <ChevronDown className={cn('w-5 h-5', isDark ? 'text-gray-400' : 'text-gray-500')} />
                    ) : (
                      <ChevronRight className={cn('w-5 h-5', isDark ? 'text-gray-400' : 'text-gray-500')} />
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
                        <div className={cn(
                          'px-5 pb-4 text-sm whitespace-pre-line',
                          isDark ? 'text-gray-300' : 'text-gray-600'
                        )}>
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </motion.div>
          )}

          {/* Tickets Table */}
          {activeTab === 'tickets' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                isDark
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'border-b',
                      isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Codigo</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Asunto</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={5} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center">
                          <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay tickets</p>
                          <button
                            onClick={() => setShowWizard(true)}
                            className="mt-3 text-sm text-emerald-500 hover:text-emerald-600"
                          >
                            Crear primer ticket
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((ticket, index) => {
                        const statusConfig = statusColors[ticket.status as keyof typeof statusColors] || statusColors.open
                        const priorConfig = priorityConfig[ticket.priority as keyof typeof priorityConfig] || priorityConfig.medium

                        return (
                          <motion.tr
                            key={ticket.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={cn(
                              'group transition-colors',
                              isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <span className={cn(
                                'font-mono text-sm font-medium',
                                isDark ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {ticket.ticketCode}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  isDark ? 'text-white' : 'text-gray-900'
                                )}>
                                  {ticket.subject}
                                </p>
                                <p className={cn(
                                  'text-sm mt-1 line-clamp-1',
                                  isDark ? 'text-gray-400' : 'text-gray-500'
                                )}>
                                  {ticket.description}
                                </p>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                                priorConfig.bg, priorConfig.color
                              )}>
                                {priorConfig.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                                statusConfig.bg, statusConfig.text
                              )}>
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'text-sm',
                                isDark ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                {new Date(ticket.createdAt).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </td>
                          </motion.tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Ticket Creation Wizard Modal */}
        <AnimatePresence>
          {showWizard && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={resetWizard}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div
                  className={cn(
                    "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border",
                    isDark
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Wizard Header with Progress */}
                  <div className={cn(
                    "px-6 py-4 border-b",
                    isDark ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                          <Ticket className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h3 className={cn(
                          "font-semibold text-lg",
                          isDark ? 'text-white' : 'text-gray-900'
                        )}>
                          Crear Ticket de Soporte
                        </h3>
                      </div>
                      <button
                        onClick={resetWizard}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        )}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Progress Steps */}
                    {!createdTicket && (
                      <div className="flex items-center justify-between">
                        {WIZARD_STEPS.map((step, index) => (
                          <React.Fragment key={step.id}>
                            <div className="flex flex-col items-center">
                              <motion.div
                                initial={false}
                                animate={{
                                  scale: wizardStep === step.id ? 1.1 : 1,
                                  backgroundColor: wizardStep === step.id
                                    ? '#10B981'
                                    : currentStepIndex > index
                                      ? '#10B981'
                                      : isDark ? '#374151' : '#E5E7EB'
                                }}
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                              >
                                {currentStepIndex > index ? (
                                  <Check className="w-5 h-5 text-white" />
                                ) : (
                                  <step.icon className={cn(
                                    "w-5 h-5",
                                    wizardStep === step.id ? 'text-white' : isDark ? 'text-gray-500' : 'text-gray-400'
                                  )} />
                                )}
                              </motion.div>
                              <div className="mt-2 text-center">
                                <p className={cn(
                                  "text-xs font-medium",
                                  wizardStep === step.id || currentStepIndex > index
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-gray-400'
                                )}>
                                  {step.title}
                                </p>
                              </div>
                            </div>

                            {index < WIZARD_STEPS.length - 1 && (
                              <div className="flex-1 h-0.5 mx-2 mb-6">
                                <motion.div
                                  initial={false}
                                  animate={{
                                    scaleX: currentStepIndex > index ? 1 : 0
                                  }}
                                  className={cn(
                                    "h-full origin-left rounded-full",
                                    isDark ? 'bg-emerald-500' : 'bg-emerald-600'
                                  )}
                                />
                                <div className={cn(
                                  "h-full -mt-0.5 rounded-full",
                                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                                )} />
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Wizard Content */}
                  <div className="p-6">
                    <AnimatePresence mode="wait">
                      {/* Step 1: Info */}
                      {wizardStep === 'info' && !createdTicket && (
                        <motion.div
                          key="info"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-6"
                        >
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Asunto del Ticket *
                            </label>
                            <input
                              type="text"
                              value={ticketSubject}
                              onChange={(e) => setTicketSubject(e.target.value)}
                              placeholder="Describe brevemente el problema..."
                              maxLength={100}
                              className={cn(
                                'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                isDark
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                            {wizardErrors.subject && (
                              <p className="text-sm text-red-500 mt-1">{wizardErrors.subject}</p>
                            )}
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Prioridad
                            </label>
                            <div className="grid grid-cols-4 gap-3">
                              {(Object.keys(priorityConfig) as Array<keyof typeof priorityConfig>).map((priority) => (
                                <button
                                  key={priority}
                                  type="button"
                                  onClick={() => setTicketPriority(priority)}
                                  className={cn(
                                    'p-3 rounded-xl border-2 transition-all text-center',
                                    ticketPriority === priority
                                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                      : isDark
                                        ? 'border-gray-600 hover:border-gray-500'
                                        : 'border-gray-200 hover:border-gray-300'
                                  )}
                                >
                                  <span className={cn(
                                    'text-sm font-medium',
                                    priorityConfig[priority].color
                                  )}>
                                    {priorityConfig[priority].label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Step 2: Details */}
                      {wizardStep === 'details' && !createdTicket && (
                        <motion.div
                          key="details"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-6"
                        >
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Descripcion Detallada *
                            </label>
                            <textarea
                              value={ticketDescription}
                              onChange={(e) => setTicketDescription(e.target.value)}
                              rows={5}
                              placeholder="Describe el problema en detalle. Incluye pasos para reproducirlo, mensajes de error, etc..."
                              className={cn(
                                'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                                isDark
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                              )}
                            />
                            {wizardErrors.description && (
                              <p className="text-sm text-red-500 mt-1">{wizardErrors.description}</p>
                            )}
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              isDark ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Capturas de Pantalla (opcional)
                            </label>

                            {/* Screenshots Grid */}
                            {ticketScreenshots.length > 0 && (
                              <div className="grid grid-cols-3 gap-3 mb-3">
                                {ticketScreenshots.map((url, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={url}
                                      alt={`Screenshot ${index + 1}`}
                                      className="w-full h-24 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeScreenshot(index)}
                                      className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {ticketScreenshots.length < 3 && (
                              <label className={cn(
                                'flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all',
                                isDark
                                  ? 'border-gray-600 hover:border-gray-500 bg-gray-900/30'
                                  : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                              )}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleImageUpload}
                                  className="hidden"
                                  disabled={uploadingImage}
                                />
                                {uploadingImage ? (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                    <span className="text-sm text-gray-500">Subiendo...</span>
                                  </>
                                ) : (
                                  <>
                                    <Camera className="w-5 h-5 text-gray-400" />
                                    <span className="text-sm text-gray-500">Agregar captura</span>
                                  </>
                                )}
                              </label>
                            )}
                            {wizardErrors.image && (
                              <p className="text-sm text-red-500 mt-1">{wizardErrors.image}</p>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Step 3: Review */}
                      {wizardStep === 'review' && !createdTicket && (
                        <motion.div
                          key="review"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-6"
                        >
                          <div className={cn(
                            'p-4 rounded-xl',
                            isDark ? 'bg-gray-900/50' : 'bg-gray-50'
                          )}>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Asunto</p>
                                <p className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                                  {ticketSubject}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Prioridad</p>
                                <span className={cn(
                                  'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                                  priorityConfig[ticketPriority].bg,
                                  priorityConfig[ticketPriority].color
                                )}>
                                  {priorityConfig[ticketPriority].label}
                                </span>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Descripcion</p>
                                <p className={cn('text-sm whitespace-pre-line', isDark ? 'text-gray-300' : 'text-gray-600')}>
                                  {ticketDescription}
                                </p>
                              </div>
                              {ticketScreenshots.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Capturas ({ticketScreenshots.length})</p>
                                  <div className="flex gap-2">
                                    {ticketScreenshots.map((url, index) => (
                                      <img
                                        key={index}
                                        src={url}
                                        alt={`Screenshot ${index + 1}`}
                                        className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={cn(
                            'p-4 rounded-xl flex items-start gap-3',
                            isDark ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                          )}>
                            <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className={cn(
                                'font-medium text-sm',
                                isDark ? 'text-blue-400' : 'text-blue-700'
                              )}>
                                Importante
                              </p>
                              <p className={cn(
                                'text-sm mt-1',
                                isDark ? 'text-blue-400/80' : 'text-blue-600'
                              )}>
                                Tu ticket sera asignado a un agente de soporte y recibiras una respuesta por correo electronico.
                              </p>
                            </div>
                          </div>

                          {wizardErrors.submit && (
                            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                              <p className="text-red-600 text-sm">{wizardErrors.submit}</p>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* Success Confirmation */}
                      {createdTicket && (
                        <motion.div
                          key="confirmation"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center py-8"
                        >
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring' }}
                            className="w-20 h-20 mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"
                          >
                            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                          </motion.div>

                          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Ticket Creado
                          </h2>
                          <p className="text-gray-500 mb-6">
                            Tu ticket ha sido enviado al equipo de soporte
                          </p>

                          <div className={cn(
                            'inline-block p-6 rounded-2xl mb-6',
                            isDark ? 'bg-gray-900/50' : 'bg-gray-50'
                          )}>
                            <p className="text-sm text-gray-500 mb-1">Codigo de Ticket</p>
                            <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                              {createdTicket.ticketCode}
                            </p>
                          </div>

                          <div className="flex justify-center gap-4">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={resetWizard}
                              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                            >
                              Cerrar
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Wizard Navigation */}
                  {!createdTicket && (
                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t",
                      isDark ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={goToPrevStep}
                        disabled={currentStepIndex === 0}
                        className={cn(
                          "flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                        )}
                      >
                        <ArrowLeft className="w-5 h-5" />
                        Anterior
                      </motion.button>

                      {wizardStep === 'review' ? (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSubmitTicket}
                          disabled={submitting}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-all",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25"
                          )}
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Check className="w-5 h-5" />
                              Crear Ticket
                            </>
                          )}
                        </motion.button>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={goToNextStep}
                          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25"
                        >
                          Siguiente
                          <ArrowRight className="w-5 h-5" />
                        </motion.button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
