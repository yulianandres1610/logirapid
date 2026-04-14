'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radio,
  Plus,
  Search,
  ArrowLeft,
  X,
  Users,
  Clock,
  Bot,
  MessageCircle,
  Send as SendIcon,
  Globe,
  Mail,
  Pencil,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Channel {
  id: number
  name: string
  platform: string
  identifier: string
  purpose: string
  assignedAgentId: string | null
  assignedAgentName: string | null
  memberCount: number
  lastActivity: string | null
  createdAt: string
}

interface AgentOption {
  id: number
  agentId: string
  name: string
  type: string
}

const PLATFORM_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string; gradient: string }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', gradient: 'from-green-500 to-green-600' },
  telegram: { label: 'Telegram', icon: SendIcon, bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', gradient: 'from-blue-500 to-blue-600' },
  facebook: { label: 'Facebook', icon: Globe, bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', gradient: 'from-indigo-500 to-indigo-600' },
  instagram: { label: 'Instagram', icon: Globe, bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400', gradient: 'from-pink-500 to-pink-600' },
  web: { label: 'Web', icon: Globe, bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400', gradient: 'from-gray-500 to-gray-600' },
  email: { label: 'Email', icon: Mail, bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', gradient: 'from-cyan-500 to-cyan-600' }
}

const PLATFORM_OPTIONS = ['whatsapp', 'telegram', 'facebook', 'instagram', 'web', 'email']
const PURPOSE_OPTIONS = [
  { value: 'research', label: 'Investigacion' },
  { value: 'sales', label: 'Ventas' },
  { value: 'publishing', label: 'Publicacion' },
  { value: 'support', label: 'Soporte' },
  { value: 'all', label: 'General' }
]

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

export default function ChannelsPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [channels, setChannels] = useState<Channel[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  // Form
  const [formName, setFormName] = useState('')
  const [formPlatform, setFormPlatform] = useState('whatsapp')
  const [formIdentifier, setFormIdentifier] = useState('')
  const [formPurpose, setFormPurpose] = useState('research')
  const [formAgentId, setFormAgentId] = useState('')

  useEffect(() => {
    fetchChannels()
    fetchAgents()
  }, [])

  const fetchChannels = async () => {
    try {
      const response = await fetch('/api/mkt/channels')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const mapped = (result.data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            platform: c.platform,
            identifier: c.identifier || '',
            purpose: c.purpose || 'research',
            assignedAgentId: c.assigned_agent_id || null,
            assignedAgentName: c.agent_name || null,
            memberCount: c.member_count || 0,
            lastActivity: c.last_activity_at || null,
            createdAt: c.created_at || ''
          }))
          setChannels(mapped)
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/mkt/agents')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setAgents((result.data || []).map((a: any) => ({
            id: a.id,
            agentId: a.agent_id,
            name: a.name,
            type: a.type
          })))
        }
      }
    } catch {}
  }

  const openCreate = () => {
    setEditingId(null)
    setFormName('')
    setFormPlatform('whatsapp')
    setFormIdentifier('')
    setFormPurpose('research')
    setFormAgentId('')
    setError('')
    setShowModal(true)
  }

  const openEdit = (ch: Channel) => {
    setEditingId(ch.id)
    setFormName(ch.name)
    setFormPlatform(ch.platform)
    setFormIdentifier(ch.identifier)
    setFormPurpose(ch.purpose)
    setFormAgentId(ch.assignedAgentId || '')
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formIdentifier.trim()) return
    setSaving(true)
    setError('')

    try {
      if (editingId) {
        // PATCH
        const response = await fetch('/api/mkt/channels', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            name: formName.trim(),
            platform: formPlatform,
            identifier: formIdentifier.trim(),
            purpose: formPurpose,
            assignedAgentId: formAgentId || null
          })
        })
        const result = await response.json()
        if (!result.success) {
          setError(result.error || 'Error al actualizar')
          return
        }
      } else {
        // POST
        const response = await fetch('/api/mkt/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            platform: formPlatform,
            identifier: formIdentifier.trim(),
            purpose: formPurpose,
            assignedAgentId: formAgentId || null
          })
        })
        const result = await response.json()
        if (!result.success) {
          setError(result.error || 'Error al crear')
          return
        }
      }

      setShowModal(false)
      fetchChannels()
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Eliminar este canal?')) return
    try {
      const response = await fetch('/api/mkt/channels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (response.ok) fetchChannels()
    } catch {}
  }

  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.platform.toLowerCase().includes(search.toLowerCase()) ||
    c.identifier.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/3" />
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
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
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Canales</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{channels.length} canales configurados</p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Agregar Canal</span>
            </button>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar canales..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                )}
              />
            </div>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              'rounded-2xl border shadow-sm overflow-hidden',
              theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
            )}
          >
            {filteredChannels.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Radio className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium">Sin canales</p>
                <p className="text-sm">Agrega un canal para que los agentes puedan operar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'text-xs font-medium uppercase',
                      theme === 'dark' ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-50 text-gray-500'
                    )}>
                      <th className="text-left py-3 px-4">Plataforma</th>
                      <th className="text-left py-3 px-4">Nombre</th>
                      <th className="text-left py-3 px-4">Identificador</th>
                      <th className="text-left py-3 px-4">Proposito</th>
                      <th className="text-left py-3 px-4">Agente</th>
                      <th className="text-right py-3 px-4">Miembros</th>
                      <th className="text-right py-3 px-4">Actividad</th>
                      <th className="text-center py-3 px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredChannels.map((channel, i) => {
                      const platConf = PLATFORM_CONFIG[channel.platform] || PLATFORM_CONFIG.web
                      const PlatIcon = platConf.icon

                      return (
                        <motion.tr
                          key={channel.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className={cn(
                            'transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-3 px-4">
                            <span className={cn(
                              'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium',
                              platConf.bg, platConf.text
                            )}>
                              <PlatIcon className="w-3.5 h-3.5" />
                              {platConf.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{channel.name}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{channel.identifier}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full capitalize',
                              theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                            )}>
                              {PURPOSE_OPTIONS.find(p => p.value === channel.purpose)?.label || channel.purpose}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {channel.assignedAgentName ? (
                              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                                <Bot className="w-3.5 h-3.5 text-purple-500" />
                                {channel.assignedAgentName}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Sin asignar</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center justify-end gap-1">
                              <Users className="w-3.5 h-3.5 text-gray-400" />
                              {(channel.memberCount || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-xs text-gray-400 flex items-center justify-end gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(channel.lastActivity)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEdit(channel)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(channel.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Create/Edit Channel Modal */}
          <AnimatePresence>
            {showModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  className={cn(
                    'w-full max-w-lg rounded-2xl shadow-2xl p-6',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                  )}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {editingId ? 'Editar Canal' : 'Agregar Canal'}
                    </h2>
                    <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="ej: Grupo Ventas Cuba"
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plataforma</label>
                      <select
                        value={formPlatform}
                        onChange={e => setFormPlatform(e.target.value)}
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      >
                        {PLATFORM_OPTIONS.map(p => (
                          <option key={p} value={p}>{PLATFORM_CONFIG[p]?.label || p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Identificador</label>
                      <input
                        type="text"
                        value={formIdentifier}
                        onChange={e => setFormIdentifier(e.target.value)}
                        placeholder="ej: https://chat.whatsapp.com/xxx o @grupo"
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proposito</label>
                      <select
                        value={formPurpose}
                        onChange={e => setFormPurpose(e.target.value)}
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      >
                        {PURPOSE_OPTIONS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agente Asignado</label>
                      <select
                        value={formAgentId}
                        onChange={e => setFormAgentId(e.target.value)}
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      >
                        <option value="">Sin asignar</option>
                        {agents.map(a => (
                          <option key={a.agentId} value={a.agentId}>{a.name} ({a.type})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={() => setShowModal(false)}
                      className={cn(
                        'flex-1 py-2.5 rounded-xl text-sm font-medium border',
                        theme === 'dark' ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !formName.trim() || !formIdentifier.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all"
                    >
                      {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Agregar Canal'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
