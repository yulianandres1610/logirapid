'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Loader2, Plus, X, Trash2, Users, Clock, Hash, Eye } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Channel {
  id: number
  platform: string
  name: string
  identifier: string
  description: string
  memberCount: number
  assignedAgentId: string
  assignedAgentName: string | null
  channelType: string
  status: string
  postsCount: number
  lastScrapedAt: string | null
  createdAt: string
}

interface Agent {
  agentId: string
  name: string
  channel: string
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; darkBg: string }> = {
  whatsapp_group: { label: 'WhatsApp', color: 'text-green-600', bg: 'bg-green-100', darkBg: 'bg-green-900/30' },
  telegram: { label: 'Telegram', color: 'text-blue-500', bg: 'bg-blue-100', darkBg: 'bg-blue-900/30' },
  facebook_group: { label: 'Facebook', color: 'text-indigo-500', bg: 'bg-indigo-100', darkBg: 'bg-indigo-900/30' },
  instagram: { label: 'Instagram', color: 'text-pink-500', bg: 'bg-pink-100', darkBg: 'bg-pink-900/30' },
  marketplace: { label: 'Marketplace', color: 'text-amber-600', bg: 'bg-amber-100', darkBg: 'bg-amber-900/30' },
  web: { label: 'Web', color: 'text-gray-500', bg: 'bg-gray-100', darkBg: 'bg-gray-700' },
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  research: 'Investigacion',
  sales: 'Ventas',
  both: 'Ambos',
}

export default function ChannelsPage() {
  const { theme } = useTheme()
  const [channels, setChannels] = useState<Channel[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [form, setForm] = useState({
    platform: 'whatsapp_group',
    name: '',
    identifier: '',
    description: '',
    channelType: 'research',
    assignedAgentId: '',
  })

  const fetchChannels = useCallback(() => {
    setLoading(true)
    fetch('/api/marketing-intel/channels')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setChannels(Array.isArray(res.data) ? res.data : [])
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const fetchAgents = useCallback(() => {
    fetch('/api/marketing-intel/agent-rankings?period=all')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const arr = Array.isArray(res.data) ? res.data : res.data?.agents || []
          setAgents(arr.map((a: any) => ({
            agentId: a.agentId,
            name: a.name,
            channel: a.channel || ''
          })))
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    fetchChannels()
    fetchAgents()
  }, [fetchChannels, fetchAgents])

  const handleCreate = async () => {
    if (!form.name || !form.platform) return
    setCreating(true)
    try {
      const res = await fetch('/api/marketing-intel/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        setShowModal(false)
        setForm({ platform: 'whatsapp_group', name: '', identifier: '', description: '', channelType: 'research', assignedAgentId: '' })
        fetchChannels()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Eliminar este canal?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/marketing-intel/channels/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        fetchChannels()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(null)
    }
  }

  const truncate = (s: string, max: number) => s && s.length > max ? s.substring(0, max) + '...' : s

  const formatDate = (d: string | null) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  // Group channels by platform
  const grouped = channels.reduce<Record<string, Channel[]>>((acc, ch) => {
    const key = ch.platform
    if (!acc[key]) acc[key] = []
    acc[key].push(ch)
    return acc
  }, {})

  const inputClass = cn('w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-orange-500/50',
    theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900')

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Radio className="w-6 h-6 inline mr-2" />Canales y Grupos
              </h1>
              <p className="text-gray-500 text-sm mt-1">Canales de redes sociales para investigacion y ventas</p>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" />Agregar Canal
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Canales', value: String(channels.length), icon: Radio, color: 'blue' },
              { label: 'Plataformas', value: String(Object.keys(grouped).length), icon: Hash, color: 'purple' },
              { label: 'Miembros Total', value: channels.reduce((s, c) => s + c.memberCount, 0).toLocaleString(), icon: Users, color: 'emerald' },
              { label: 'Posts Encontrados', value: channels.reduce((s, c) => s + c.postsCount, 0).toLocaleString(), icon: Eye, color: 'orange' },
            ].map((kpi, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center',
                    `bg-${kpi.color}-100 dark:bg-${kpi.color}-900/30`)}>
                    <kpi.icon className={`w-5 h-5 text-${kpi.color}-500`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{kpi.label}</p>
                    <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{kpi.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Channel Table */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : channels.length === 0 ? (
            <div className={cn('text-center py-16 rounded-xl border',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
              <Radio className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-400">Sin canales registrados</p>
              <button onClick={() => setShowModal(true)}
                className="mt-3 text-orange-500 hover:text-orange-400 text-sm font-medium">
                Agregar primer canal
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([platform, platformChannels]) => {
                const pc = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.web
                return (
                  <motion.div key={platform} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    {/* Platform Header */}
                    <div className={cn('px-4 py-3 flex items-center gap-2',
                      theme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-50')}>
                      <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold',
                        theme === 'dark' ? pc.darkBg : pc.bg, pc.color)}>
                        {pc.label}
                      </span>
                      <span className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        {platformChannels.length} canal{platformChannels.length !== 1 ? 'es' : ''}
                      </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={cn(theme === 'dark' ? 'bg-gray-800/50' : 'bg-white')}>
                            {['Nombre', 'Identificador', 'Tipo', 'Agente Asignado', 'Miembros', 'Ultimo Scrape', 'Posts', ''].map(h => (
                              <th key={h} className={cn('px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wider',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {platformChannels.map((ch, i) => (
                            <motion.tr key={ch.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.03 }}
                              className={cn('border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-100')}>
                              <td className={cn('px-4 py-3 font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                {ch.name}
                              </td>
                              <td className={cn('px-4 py-3 font-mono text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {truncate(ch.identifier || '', 30)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                                  ch.channelType === 'sales' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                  ch.channelType === 'both' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                  theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                                  {CHANNEL_TYPE_LABELS[ch.channelType] || ch.channelType}
                                </span>
                              </td>
                              <td className={cn('px-4 py-3 text-xs', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                {ch.assignedAgentName || ch.assignedAgentId || '-'}
                              </td>
                              <td className={cn('px-4 py-3 font-mono', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                {ch.memberCount > 0 ? ch.memberCount.toLocaleString() : '-'}
                              </td>
                              <td className={cn('px-4 py-3 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                {ch.lastScrapedAt ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(ch.lastScrapedAt)}
                                  </span>
                                ) : '-'}
                              </td>
                              <td className={cn('px-4 py-3 font-mono', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                                {ch.postsCount > 0 ? ch.postsCount : '-'}
                              </td>
                              <td className="px-4 py-3">
                                <button onClick={() => handleDelete(ch.id)}
                                  disabled={deleting === ch.id}
                                  className={cn('p-1.5 rounded-lg transition-colors',
                                    theme === 'dark' ? 'hover:bg-red-900/30 text-gray-400 hover:text-red-400' :
                                    'hover:bg-red-50 text-gray-400 hover:text-red-500')}>
                                  {deleting === ch.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Add Channel Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              onClick={() => setShowModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className={cn('w-full max-w-lg rounded-2xl p-6 shadow-xl',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Agregar Canal
                  </h2>
                  <button onClick={() => setShowModal(false)}
                    className={cn('p-1 rounded-lg', theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}>
                    <X className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Plataforma *
                    </label>
                    <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                      className={inputClass}>
                      <option value="whatsapp_group">WhatsApp Group</option>
                      <option value="telegram">Telegram</option>
                      <option value="facebook_group">Facebook Group</option>
                      <option value="instagram">Instagram</option>
                      <option value="marketplace">Marketplace</option>
                      <option value="web">Web</option>
                    </select>
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Nombre *
                    </label>
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Ventas Miami Cubanos" className={inputClass} />
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Identificador / Link
                    </label>
                    <input type="text" value={form.identifier} onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                      placeholder="Ej: https://t.me/grupo o ID del grupo" className={inputClass} />
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Descripcion
                    </label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={2} placeholder="Descripcion del canal..." className={inputClass} />
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Tipo de Canal *
                    </label>
                    <div className="flex gap-3">
                      {[
                        { value: 'research', label: 'Investigacion' },
                        { value: 'sales', label: 'Ventas' },
                        { value: 'both', label: 'Ambos' },
                      ].map(opt => (
                        <button key={opt.value}
                          onClick={() => setForm(f => ({ ...f, channelType: opt.value }))}
                          className={cn('px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                            form.channelType === opt.value
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100')}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Agente Asignado
                    </label>
                    <select value={form.assignedAgentId} onChange={e => setForm(f => ({ ...f, assignedAgentId: e.target.value }))}
                      className={inputClass}>
                      <option value="">Sin asignar</option>
                      {agents.map(a => (
                        <option key={a.agentId} value={a.agentId}>{a.name} ({a.channel})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6">
                  <button onClick={() => setShowModal(false)}
                    className={cn('px-4 py-2 rounded-lg text-sm font-medium border',
                      theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100')}>
                    Cancelar
                  </button>
                  <button onClick={handleCreate} disabled={creating || !form.name || !form.platform}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Agregar Canal
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
