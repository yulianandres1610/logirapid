'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Plus,
  Search,
  Wifi,
  WifiOff,
  Pause,
  Play,
  Trash2,
  Copy,
  Check,
  X,
  AlertTriangle,
  Bot,
  Eye,
  Target,
  Megaphone,
  ShoppingBag,
  Shield,
  Wrench,
  RefreshCw,
  Clock,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Agent {
  id: number
  agentId: string
  name: string
  type: string
  description: string
  status: string
  channels: string[]
  lastHeartbeat: string | null
  createdAt: string
}

const AGENT_TYPES = [
  { value: 'investigator', label: 'Investigador', icon: Eye, color: 'from-blue-500 to-blue-600' },
  { value: 'strategist', label: 'Estratega', icon: Target, color: 'from-purple-500 to-purple-600' },
  { value: 'seller', label: 'Vendedor', icon: ShoppingBag, color: 'from-emerald-500 to-emerald-600' },
  { value: 'publisher', label: 'Publicador', icon: Megaphone, color: 'from-amber-500 to-amber-600' },
  { value: 'auditor', label: 'Auditor', icon: Shield, color: 'from-red-500 to-red-600' },
  { value: 'custom', label: 'Personalizado', icon: Wrench, color: 'from-gray-500 to-gray-600' }
]

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'web', label: 'Web' },
  { value: 'email', label: 'Email' }
]

function getAgentTypeConfig(type: string) {
  return AGENT_TYPES.find(t => t.value === type) || AGENT_TYPES[5]
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function AgentsPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showToken, setShowToken] = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)

  // Create form
  const [formAgentId, setFormAgentId] = useState('')
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('investigator')
  const [formDescription, setFormDescription] = useState('')
  const [formChannels, setFormChannels] = useState<string[]>([])

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/mkt/agents')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAgents(result.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formAgentId.trim() || !formName.trim()) return
    setCreating(true)

    try {
      const response = await fetch('/api/mkt/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: formAgentId.trim(),
          name: formName.trim(),
          type: formType,
          description: formDescription.trim(),
          channels: formChannels
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setShowCreate(false)
          setShowToken(result.data?.token || null)
          setFormAgentId('')
          setFormName('')
          setFormType('investigator')
          setFormDescription('')
          setFormChannels([])
          fetchAgents()
        }
      }
    } catch (error) {
      console.error('Error creating agent:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleAction = async (agentId: string, action: 'pause' | 'resume' | 'delete') => {
    try {
      const response = await fetch(`/api/mkt/agents/${agentId}/${action}`, {
        method: 'POST'
      })
      if (response.ok) {
        fetchAgents()
      }
    } catch (error) {
      console.error(`Error ${action} agent:`, error)
    }
  }

  const copyToken = () => {
    if (showToken) {
      navigator.clipboard.writeText(showToken)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  const toggleChannel = (ch: string) => {
    setFormChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.agentId.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/3" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Link href="/dashboard/market/marketing">
                <button className={cn(
                  'p-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                )}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Agentes IA</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{agents.length} agentes registrados</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Crear Agente</span>
            </button>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar agentes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-purple-500'
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500'
              )}
            />
          </motion.div>

          {/* Agent Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent, i) => {
              const typeConfig = getAgentTypeConfig(agent.type)
              const TypeIcon = typeConfig.icon
              const isOnline = agent.status === 'online'

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className={cn(
                    'rounded-2xl border overflow-hidden shadow-sm',
                    theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                  )}
                >
                  {/* Gradient Header */}
                  <div className={`bg-gradient-to-r ${typeConfig.color} p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                          <TypeIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-white">{agent.name}</p>
                          <p className="text-xs text-white/70">{agent.agentId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                        <span className="text-xs text-white/80">{isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                      )}>
                        {typeConfig.label}
                      </span>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        agent.status === 'online' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        agent.status === 'paused' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      )}>
                        {agent.status === 'online' ? 'Activo' : agent.status === 'paused' ? 'Pausado' : 'Inactivo'}
                      </span>
                    </div>

                    {agent.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{agent.description}</p>
                    )}

                    {/* Channels */}
                    {agent.channels && agent.channels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {agent.channels.map(ch => (
                          <span key={ch} className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full',
                            ch === 'whatsapp' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            ch === 'telegram' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            ch === 'facebook' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                            ch === 'instagram' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                            'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          )}>
                            {ch}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Last heartbeat */}
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>Ultimo latido: {timeAgo(agent.lastHeartbeat)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      {agent.status === 'paused' ? (
                        <button
                          onClick={() => handleAction(agent.agentId, 'resume')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                        >
                          <Play className="w-3 h-3" /> Reanudar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(agent.agentId, 'pause')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                        >
                          <Pause className="w-3 h-3" /> Pausar
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(agent.agentId, 'delete')}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Eliminar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {filteredAgents.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center text-gray-400"
            >
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Sin agentes</p>
              <p className="text-sm">Crea tu primer agente IA para comenzar</p>
            </motion.div>
          )}

          {/* Create Agent Modal */}
          <AnimatePresence>
            {showCreate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowCreate(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  className={cn(
                    'w-full max-w-lg rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                  )}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Crear Agente</h2>
                    <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Agent ID */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID del Agente</label>
                      <input
                        type="text"
                        value={formAgentId}
                        onChange={e => setFormAgentId(e.target.value)}
                        placeholder="ej: price-hunter-01"
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      />
                    </div>

                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="ej: Price Hunter"
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                      <select
                        value={formType}
                        onChange={e => setFormType(e.target.value)}
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      >
                        {AGENT_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripcion</label>
                      <textarea
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        placeholder="Descripcion del agente..."
                        rows={3}
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm resize-none',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      />
                    </div>

                    {/* Channels */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Canales</label>
                      <div className="flex flex-wrap gap-2">
                        {CHANNEL_OPTIONS.map(ch => (
                          <button
                            key={ch.value}
                            type="button"
                            onClick={() => toggleChannel(ch.value)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                              formChannels.includes(ch.value)
                                ? 'bg-purple-500 text-white border-purple-500'
                                : theme === 'dark'
                                  ? 'bg-gray-800 text-gray-300 border-gray-700 hover:border-purple-500'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-purple-500'
                            )}
                          >
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={() => setShowCreate(false)}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl text-sm font-medium border',
                        theme === 'dark' ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={creating || !formAgentId.trim() || !formName.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 transition-all"
                    >
                      {creating ? 'Creando...' : 'Crear Agente'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Token Display Modal */}
          <AnimatePresence>
            {showToken && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className={cn(
                    'w-full max-w-md rounded-2xl shadow-2xl p-6',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                  )}
                >
                  <div className="text-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="w-7 h-7 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Token del Agente</h2>
                    <p className="text-sm text-red-500 dark:text-red-400 mt-1 font-medium">
                      Este token solo se mostrara UNA VEZ. Copialo ahora.
                    </p>
                  </div>

                  <div className={cn(
                    'p-3 rounded-xl border font-mono text-sm break-all',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700 text-green-400' : 'bg-gray-50 border-gray-200 text-gray-800'
                  )}>
                    {showToken}
                  </div>

                  <button
                    onClick={copyToken}
                    className={cn(
                      'w-full mt-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all',
                      tokenCopied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
                    )}
                  >
                    {tokenCopied ? <><Check className="w-4 h-4" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar Token</>}
                  </button>

                  <button
                    onClick={() => setShowToken(null)}
                    className={cn(
                      'w-full mt-2 py-2.5 rounded-xl text-sm font-medium border',
                      theme === 'dark' ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    Entendido, lo copie
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
