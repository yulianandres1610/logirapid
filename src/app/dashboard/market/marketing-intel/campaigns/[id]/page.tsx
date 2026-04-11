'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import {
  Zap, Loader2, ArrowLeft, CheckCircle, Clock, PauseCircle, XCircle,
  Plus, Copy, Check, Play, FileText, Image, Video, Music, File,
  Calendar, Percent, Tag, MessageSquare, Hash, Target, ChevronRight
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Task {
  id: number
  title: string
  description: string
  assignedTo: string
  sortOrder: number
  status: string
  completedBy: string | null
  completedAt: string | null
  createdAt: string
}

interface Asset {
  id: number
  type: string
  name: string
  fileUrl: string
  fileSize: number
  platform: string
  notes: string
  createdAt: string
}

interface SalesScripts {
  elevatorPitch?: string
  socialCards?: {
    facebook?: string
    instagram?: string
    whatsapp?: string
  }
  videoScript?: {
    hook?: string
    problem?: string
    solution?: string
    proof?: string
    offer?: string
    cta?: string
    duration?: string
  }
  objections?: Array<{ objection: string; response: string }>
  keyMessages?: string[]
  hashtags?: string[]
  targetAudience?: string
}

interface CampaignDetail {
  id: number
  name: string
  description: string
  type: string
  status: string
  startDate: string
  endDate: string
  targetProducts: any[]
  targetCategories: any[]
  discountType: string
  discountValue: number | null
  budget: number | null
  spent: number
  suggestedBy: string
  suggestionReason: string
  metrics: any
  salesScripts: SalesScripts | null
  createdBy: string
  createdAt: string
  tasks: Task[]
  assets: Asset[]
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; darkBg: string; label: string }> = {
  draft: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', darkBg: 'bg-gray-700', label: 'Borrador' },
  active: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-100', darkBg: 'bg-emerald-900/30', label: 'Activa' },
  paused: { icon: PauseCircle, color: 'text-amber-500', bg: 'bg-amber-100', darkBg: 'bg-amber-900/30', label: 'Pausada' },
  completed: { icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100', darkBg: 'bg-blue-900/30', label: 'Completada' },
  cancelled: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', darkBg: 'bg-red-900/30', label: 'Cancelada' },
}

const TYPE_LABELS: Record<string, string> = {
  discount: 'Descuento',
  bundle: 'Bundle',
  flash_sale: 'Flash Sale',
  seasonal: 'Temporal',
  loyalty: 'Fidelidad',
}

const ASSET_TYPE_ICONS: Record<string, typeof FileText> = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  other: File,
}

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'materiales', label: 'Materiales' },
]

export default function CampaignDetailPage() {
  const { theme } = useTheme()
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('resumen')
  const [togglingTask, setTogglingTask] = useState<number | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)
  const [creatingAsset, setCreatingAsset] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignedTo: '' })
  const [assetForm, setAssetForm] = useState({ type: 'image', name: '', fileUrl: '', platform: '', notes: '' })

  const fetchCampaign = useCallback(() => {
    setLoading(true)
    fetch(`/api/marketing-intel/campaigns/${campaignId}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setCampaign(res.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [campaignId])

  useEffect(() => { fetchCampaign() }, [fetchCampaign])

  const handleToggleTask = async (task: Task) => {
    setTogglingTask(task.id)
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    try {
      const res = await fetch(`/api/marketing-intel/campaigns/${campaignId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const json = await res.json()
      if (json.success) fetchCampaign()
    } catch (e) { console.error(e) }
    finally { setTogglingTask(null) }
  }

  const handleAddTask = async () => {
    if (!taskForm.title) return
    setCreatingTask(true)
    try {
      const res = await fetch(`/api/marketing-intel/campaigns/${campaignId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskForm),
      })
      const json = await res.json()
      if (json.success) {
        setShowAddTask(false)
        setTaskForm({ title: '', description: '', assignedTo: '' })
        fetchCampaign()
      }
    } catch (e) { console.error(e) }
    finally { setCreatingTask(false) }
  }

  const handleAddAsset = async () => {
    if (!assetForm.name || !assetForm.type) return
    setCreatingAsset(true)
    try {
      const res = await fetch(`/api/marketing-intel/campaigns/${campaignId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assetForm),
      })
      const json = await res.json()
      if (json.success) {
        setShowAddAsset(false)
        setAssetForm({ type: 'image', name: '', fileUrl: '', platform: '', notes: '' })
        fetchCampaign()
      }
    } catch (e) { console.error(e) }
    finally { setCreatingAsset(false) }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const formatDate = (d: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const inputClass = cn('w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-orange-500/50',
    theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900')

  const cardClass = cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (!campaign) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6 text-center">
            <p className="text-gray-400">Campana no encontrada</p>
            <button onClick={() => router.push('/dashboard/market/marketing-intel/campaigns')}
              className="mt-3 text-orange-500 hover:text-orange-400 text-sm font-medium">
              Volver a campanas
            </button>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const sc = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft
  const StatusIcon = sc.icon
  const completedTasks = campaign.tasks.filter(t => t.status === 'completed').length

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button onClick={() => router.push('/dashboard/market/marketing-intel/campaigns')}
              className={cn('p-2 rounded-lg', theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}>
              <ArrowLeft className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {campaign.name}
                </h1>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1',
                  theme === 'dark' ? sc.darkBg : sc.bg, sc.color)}>
                  <StatusIcon className="w-3 h-3" />{sc.label}
                </span>
              </div>
              {campaign.description && (
                <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  {campaign.description}
                </p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg border bg-opacity-50"
            style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb', backgroundColor: theme === 'dark' ? '#1f2937' : '#f9fafb' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('px-4 py-2 text-sm font-medium rounded-md transition-all',
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900')}>
                {tab.label}
                {tab.id === 'tareas' && campaign.tasks.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-75">({completedTasks}/{campaign.tasks.length})</span>
                )}
                {tab.id === 'materiales' && campaign.assets.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-75">({campaign.assets.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab: Resumen */}
          {activeTab === 'resumen' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className={cardClass}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tipo</p>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {TYPE_LABELS[campaign.type] || campaign.type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fechas</p>
                    <p className={cn('font-medium flex items-center gap-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Descuento</p>
                    <p className={cn('font-medium flex items-center gap-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {campaign.discountType === 'percentage' ? (
                        <><Percent className="w-3.5 h-3.5 text-orange-500" />{campaign.discountValue}%</>
                      ) : (
                        <><Tag className="w-3.5 h-3.5 text-orange-500" />${campaign.discountValue}</>
                      )}
                    </p>
                  </div>
                  {campaign.budget && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Presupuesto</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        ${campaign.budget.toLocaleString()} (gastado: ${campaign.spent.toLocaleString()})
                      </p>
                    </div>
                  )}
                  {campaign.suggestedBy && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Sugerida por</p>
                      <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {campaign.suggestedBy}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Creada por</p>
                    <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {campaign.createdBy || '-'}
                    </p>
                  </div>
                </div>

                {/* Target products */}
                {campaign.targetProducts && campaign.targetProducts.length > 0 && (
                  <div className="mt-6 pt-4 border-t" style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Productos objetivo</p>
                    <div className="flex flex-wrap gap-2">
                      {campaign.targetProducts.map((p: any, i: number) => (
                        <span key={i} className={cn('px-2.5 py-1 rounded-lg text-xs font-medium',
                          theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700')}>
                          {typeof p === 'string' ? p : p.name || JSON.stringify(p)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {campaign.suggestionReason && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Razon de sugerencia</p>
                    <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                      {campaign.suggestionReason}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Tab: Scripts */}
          {activeTab === 'scripts' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {!campaign.salesScripts ? (
                <div className={cn('text-center py-16 rounded-xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                  <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-400">Sin scripts de venta generados para esta campana</p>
                </div>
              ) : (
                <>
                  {/* Elevator Pitch */}
                  {campaign.salesScripts.elevatorPitch && (
                    <div className={cardClass}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Elevator Pitch
                        </h3>
                        <button onClick={() => copyToClipboard(campaign.salesScripts!.elevatorPitch!, 'pitch')}
                          className={cn('p-1.5 rounded-lg transition-colors text-sm flex items-center gap-1',
                            theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}>
                          {copiedId === 'pitch' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className={cn('text-sm leading-relaxed', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                        {campaign.salesScripts.elevatorPitch}
                      </p>
                    </div>
                  )}

                  {/* Social Cards */}
                  {campaign.salesScripts.socialCards && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Object.entries(campaign.salesScripts.socialCards).map(([platform, text]) => {
                        if (!text) return null
                        const platformColors: Record<string, string> = {
                          facebook: 'text-indigo-500',
                          instagram: 'text-pink-500',
                          whatsapp: 'text-green-500',
                        }
                        return (
                          <div key={platform} className={cardClass}>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className={cn('font-semibold capitalize', platformColors[platform] || (theme === 'dark' ? 'text-white' : 'text-gray-900'))}>
                                {platform}
                              </h3>
                              <button onClick={() => copyToClipboard(text, `social-${platform}`)}
                                className={cn('p-1.5 rounded-lg transition-colors',
                                  theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}>
                                {copiedId === `social-${platform}` ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                            <p className={cn('text-sm whitespace-pre-wrap', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                              {text}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Video Script */}
                  {campaign.salesScripts.videoScript && (
                    <div className={cardClass}>
                      <div className="flex items-center gap-2 mb-4">
                        <Video className="w-5 h-5 text-orange-500" />
                        <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Video Script
                        </h3>
                        {campaign.salesScripts.videoScript.duration && (
                          <span className={cn('ml-auto px-2 py-0.5 rounded text-xs font-medium',
                            theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                            {campaign.salesScripts.videoScript.duration}
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        {(['hook', 'problem', 'solution', 'proof', 'offer', 'cta'] as const).map(section => {
                          const value = campaign.salesScripts?.videoScript?.[section]
                          if (!value) return null
                          const labels: Record<string, string> = {
                            hook: 'Hook', problem: 'Problema', solution: 'Solucion',
                            proof: 'Prueba', offer: 'Oferta', cta: 'Call to Action'
                          }
                          return (
                            <div key={section}>
                              <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-1">{labels[section]}</p>
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>{value}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Objections */}
                  {campaign.salesScripts.objections && campaign.salesScripts.objections.length > 0 && (
                    <div className={cardClass}>
                      <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Manejo de Objeciones
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={cn(theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                              <th className={cn('px-4 py-2 text-left font-semibold text-xs uppercase', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                Objecion
                              </th>
                              <th className={cn('px-4 py-2 text-left font-semibold text-xs uppercase', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                Respuesta
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaign.salesScripts.objections.map((obj, i) => (
                              <tr key={i} className={cn('border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-100')}>
                                <td className={cn('px-4 py-3 font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                  {obj.objection}
                                </td>
                                <td className={cn('px-4 py-3', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                                  {obj.response}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Key Messages + Hashtags + Target Audience */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {campaign.salesScripts.keyMessages && campaign.salesScripts.keyMessages.length > 0 && (
                      <div className={cardClass}>
                        <h3 className={cn('font-semibold mb-3', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Mensajes Clave
                        </h3>
                        <ul className="space-y-2">
                          {campaign.salesScripts.keyMessages.map((msg, i) => (
                            <li key={i} className={cn('flex items-start gap-2 text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                              <ChevronRight className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                              {msg}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-4">
                      {campaign.salesScripts.hashtags && campaign.salesScripts.hashtags.length > 0 && (
                        <div className={cardClass}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              <Hash className="w-4 h-4 inline mr-1" />Hashtags
                            </h3>
                            <button onClick={() => copyToClipboard(campaign.salesScripts!.hashtags!.join(' '), 'hashtags')}
                              className={cn('p-1.5 rounded-lg transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500')}>
                              {copiedId === 'hashtags' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {campaign.salesScripts.hashtags.map((tag, i) => (
                              <span key={i} className={cn('px-2 py-0.5 rounded text-xs font-medium',
                                theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700')}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {campaign.salesScripts.targetAudience && (
                        <div className={cardClass}>
                          <h3 className={cn('font-semibold mb-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            <Target className="w-4 h-4 inline mr-1" />Audiencia Objetivo
                          </h3>
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                            {campaign.salesScripts.targetAudience}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Tab: Tareas */}
          {activeTab === 'tareas' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Progress bar */}
              {campaign.tasks.length > 0 && (
                <div className={cardClass}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Progreso: {completedTasks} de {campaign.tasks.length}
                    </p>
                    <p className={cn('text-sm font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {campaign.tasks.length > 0 ? Math.round((completedTasks / campaign.tasks.length) * 100) : 0}%
                    </p>
                  </div>
                  <div className={cn('w-full h-2 rounded-full', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                    <div className="h-2 rounded-full bg-orange-500 transition-all"
                      style={{ width: `${campaign.tasks.length > 0 ? (completedTasks / campaign.tasks.length) * 100 : 0}%` }} />
                  </div>
                </div>
              )}

              {/* Task List */}
              <div className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                {campaign.tasks.length === 0 ? (
                  <div className={cn('text-center py-12', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                    <CheckCircle className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-400 text-sm">Sin tareas creadas</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}>
                    {campaign.tasks.map((task, i) => (
                      <motion.div key={task.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={cn('flex items-center gap-3 px-4 py-3',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                        <button onClick={() => handleToggleTask(task)}
                          disabled={togglingTask === task.id}
                          className={cn('w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0',
                            task.status === 'completed'
                              ? 'bg-orange-500 border-orange-500'
                              : theme === 'dark' ? 'border-gray-500 hover:border-orange-400' : 'border-gray-300 hover:border-orange-500')}>
                          {togglingTask === task.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                          ) : task.status === 'completed' ? (
                            <Check className="w-3 h-3 text-white" />
                          ) : null}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm font-medium',
                            task.status === 'completed' ? 'line-through opacity-60' : '',
                            theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className={cn('text-xs mt-0.5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {task.description}
                            </p>
                          )}
                        </div>
                        {task.assignedTo && (
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium shrink-0',
                            theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                            {task.assignedTo}
                          </span>
                        )}
                        {task.completedAt && (
                          <span className="text-xs text-gray-500 shrink-0">
                            {formatDate(task.completedAt)}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Add task inline */}
                {showAddTask ? (
                  <div className={cn('p-4 border-t', theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                    <div className="space-y-3">
                      <input type="text" value={taskForm.title}
                        onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Titulo de la tarea *" className={inputClass} autoFocus />
                      <input type="text" value={taskForm.description}
                        onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Descripcion (opcional)" className={inputClass} />
                      <input type="text" value={taskForm.assignedTo}
                        onChange={e => setTaskForm(f => ({ ...f, assignedTo: e.target.value }))}
                        placeholder="Asignado a (opcional)" className={inputClass} />
                      <div className="flex items-center gap-2">
                        <button onClick={handleAddTask} disabled={creatingTask || !taskForm.title}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50">
                          {creatingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Agregar
                        </button>
                        <button onClick={() => { setShowAddTask(false); setTaskForm({ title: '', description: '', assignedTo: '' }) }}
                          className={cn('px-3 py-1.5 rounded-lg text-sm',
                            theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100')}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddTask(true)}
                    className={cn('w-full px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors',
                      theme === 'dark' ? 'bg-gray-800/30 text-gray-400 hover:text-white hover:bg-gray-800' :
                      'bg-gray-50/50 text-gray-500 hover:text-gray-900 hover:bg-gray-50')}>
                    <Plus className="w-4 h-4" />Agregar tarea
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Tab: Materiales */}
          {activeTab === 'materiales' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center justify-end">
                <button onClick={() => setShowAddAsset(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" />Agregar Material
                </button>
              </div>

              {campaign.assets.length === 0 ? (
                <div className={cn('text-center py-16 rounded-xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                  <File className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-400">Sin materiales subidos</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {campaign.assets.map((asset, i) => {
                    const AssetIcon = ASSET_TYPE_ICONS[asset.type] || File
                    return (
                      <motion.div key={asset.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn('p-4 rounded-xl border flex flex-col gap-3',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                        <div className="flex items-center justify-between">
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center',
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                            <AssetIcon className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-300' : 'text-gray-500')} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium capitalize',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                              {asset.type}
                            </span>
                            {asset.platform && (
                              <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                                theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700')}>
                                {asset.platform}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {asset.name}
                          </h4>
                          {asset.notes && (
                            <p className={cn('text-xs mt-1 line-clamp-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              {asset.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatSize(asset.fileSize)}</span>
                          {asset.fileUrl && (
                            <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer"
                              className="text-orange-500 hover:text-orange-400 font-medium">
                              Ver archivo
                            </a>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Add Asset Modal */}
        <AnimatePresence>
          {showAddAsset && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              onClick={() => setShowAddAsset(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className={cn('w-full max-w-lg rounded-2xl p-6 shadow-xl',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Agregar Material
                  </h2>
                  <button onClick={() => setShowAddAsset(false)}
                    className={cn('p-1 rounded-lg', theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}>
                    <XCircle className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Tipo *
                      </label>
                      <select value={assetForm.type} onChange={e => setAssetForm(f => ({ ...f, type: e.target.value }))}
                        className={inputClass}>
                        <option value="image">Imagen</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                        <option value="document">Documento</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Plataforma
                      </label>
                      <select value={assetForm.platform} onChange={e => setAssetForm(f => ({ ...f, platform: e.target.value }))}
                        className={inputClass}>
                        <option value="">General</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="telegram">Telegram</option>
                        <option value="web">Web</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Nombre *
                    </label>
                    <input type="text" value={assetForm.name}
                      onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Banner promo Black Friday" className={inputClass} />
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      URL del Archivo
                    </label>
                    <input type="url" value={assetForm.fileUrl}
                      onChange={e => setAssetForm(f => ({ ...f, fileUrl: e.target.value }))}
                      placeholder="https://..." className={inputClass} />
                  </div>

                  <div>
                    <label className={cn('block text-sm font-medium mb-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Notas
                    </label>
                    <textarea value={assetForm.notes}
                      onChange={e => setAssetForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2} placeholder="Notas adicionales..." className={inputClass} />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6">
                  <button onClick={() => setShowAddAsset(false)}
                    className={cn('px-4 py-2 rounded-lg text-sm font-medium border',
                      theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-100')}>
                    Cancelar
                  </button>
                  <button onClick={handleAddAsset} disabled={creatingAsset || !assetForm.name || !assetForm.type}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    {creatingAsset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Agregar
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
