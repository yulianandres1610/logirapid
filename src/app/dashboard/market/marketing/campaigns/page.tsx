'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone,
  Plus,
  Search,
  Calendar,
  Package,
  ArrowLeft,
  ArrowRight,
  X,
  RefreshCw,
  Clock,
  CheckCircle,
  PlayCircle,
  AlertCircle,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Campaign {
  id: number
  name: string
  type: string
  status: string
  startDate: string | null
  endDate: string | null
  productsCount: number
  channels: string[]
  createdAt: string
}

const STATUS_TABS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending_approval', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'completed', label: 'Completadas' }
]

const STATUS_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string }> = {
  pending_approval: { label: 'Pendiente', icon: Clock, bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  approved: { label: 'Aprobada', icon: CheckCircle, bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  in_progress: { label: 'En Progreso', icon: PlayCircle, bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  completed: { label: 'Completada', icon: CheckCircle, bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  cancelled: { label: 'Cancelada', icon: XCircle, bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' }
}

const TYPE_CONFIG: Record<string, { label: string; gradient: string }> = {
  product_launch: { label: 'Lanzamiento', gradient: 'from-purple-500 to-purple-600' },
  seasonal: { label: 'Temporada', gradient: 'from-blue-500 to-blue-600' },
  promotion: { label: 'Promocion', gradient: 'from-emerald-500 to-emerald-600' },
  awareness: { label: 'Awareness', gradient: 'from-amber-500 to-amber-600' },
  custom: { label: 'Personalizada', gradient: 'from-gray-500 to-gray-600' }
}

const CHANNEL_BADGE: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  telegram: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  facebook: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  instagram: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  web: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  email: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
}

export default function CampaignsPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Create form
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('promotion')
  const [formDescription, setFormDescription] = useState('')

  useEffect(() => {
    fetchCampaigns()
  }, [statusFilter])

  const fetchCampaigns = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const response = await fetch(`/api/mkt/campaigns?${params}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setCampaigns(result.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formName.trim()) return
    setCreating(true)

    try {
      const response = await fetch('/api/mkt/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
          description: formDescription.trim()
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setShowCreate(false)
          setFormName('')
          setFormType('promotion')
          setFormDescription('')
          fetchCampaigns()
        }
      }
    } catch (error) {
      console.error('Error creating campaign:', error)
    } finally {
      setCreating(false)
    }
  }

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading && campaigns.length === 0) {
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
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Campanas</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{campaigns.length} campanas</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Nueva Campana</span>
            </button>
          </motion.div>

          {/* Search + Status Filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar campana..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-emerald-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-500'
                )}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                    statusFilter === tab.value
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg'
                      : theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Campaign Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaigns.map((campaign, i) => {
              const statusConf = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.pending_approval
              const typeConf = TYPE_CONFIG[campaign.type] || TYPE_CONFIG.custom
              const StatusIcon = statusConf.icon

              return (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onClick={() => router.push(`/dashboard/market/marketing/campaigns/${campaign.id}`)}
                  className={cn(
                    'rounded-2xl border overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-all group',
                    theme === 'dark' ? 'bg-gray-900 border-gray-700/50 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300'
                  )}
                >
                  {/* Type gradient header */}
                  <div className={`bg-gradient-to-r ${typeConf.gradient} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-white" />
                      <span className="text-xs font-medium text-white/80">{typeConf.label}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/60 group-hover:translate-x-1 transition-transform" />
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">{campaign.name}</h3>
                    </div>

                    {/* Status + Products */}
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                        statusConf.bg, statusConf.text
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConf.label}
                      </span>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                      )}>
                        <Package className="w-3 h-3 inline mr-0.5" />
                        {campaign.productsCount} productos
                      </span>
                    </div>

                    {/* Dates */}
                    {(campaign.startDate || campaign.endDate) && (
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '?'}
                          {' - '}
                          {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '?'}
                        </span>
                      </div>
                    )}

                    {/* Channels */}
                    {campaign.channels && campaign.channels.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {campaign.channels.map(ch => (
                          <span key={ch} className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            CHANNEL_BADGE[ch] || CHANNEL_BADGE.web
                          )}>
                            {ch}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {filteredCampaigns.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center text-gray-400"
            >
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Sin campanas</p>
              <p className="text-sm">Crea tu primera campana para comenzar</p>
            </motion.div>
          )}

          {/* Create Campaign Modal */}
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
                    'w-full max-w-lg rounded-2xl shadow-2xl p-6',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                  )}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Campana</h2>
                    <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        placeholder="Nombre de la campana"
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      />
                    </div>

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
                        {Object.entries(TYPE_CONFIG).map(([key, conf]) => (
                          <option key={key} value={key}>{conf.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripcion</label>
                      <textarea
                        value={formDescription}
                        onChange={e => setFormDescription(e.target.value)}
                        placeholder="Describe la campana..."
                        rows={3}
                        className={cn(
                          'w-full px-3 py-2 rounded-xl border text-sm resize-none',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'
                        )}
                      />
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
                      disabled={creating || !formName.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
                    >
                      {creating ? 'Creando...' : 'Crear Campana'}
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
