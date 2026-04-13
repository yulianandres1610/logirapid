'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone,
  ArrowLeft,
  Calendar,
  Package,
  Hash,
  Users,
  Target,
  CheckCircle,
  Clock,
  PlayCircle,
  XCircle,
  Copy,
  Check,
  Plus,
  Upload,
  Trash2,
  FileText,
  Image,
  Video,
  Music,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Send,
  Eye,
  MessageSquare,
  Tag
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface CampaignDetail {
  id: number
  name: string
  description: string
  type: string
  status: string
  startDate: string | null
  endDate: string | null
  products: Array<{ id: number; name: string; price: number }>
  channels: string[]
  discount: string | null
  scripts: {
    elevatorPitch: string | null
    socialCards: {
      facebook: string | null
      instagram: string | null
      whatsapp: string | null
    }
    videoScript: {
      hook: string | null
      problem: string | null
      solution: string | null
      proof: string | null
      offer: string | null
      cta: string | null
    }
    objections: Array<{ objection: string; response: string }>
    keyMessages: string[]
    hashtags: string[]
    targetAudience: string | null
  }
  tasks: Array<{
    id: number
    title: string
    completed: boolean
    hasFile: boolean
    filePath: string | null
  }>
  materials: Array<{
    id: number
    name: string
    type: string
    platform: string
    url: string
    createdAt: string
  }>
  publications: Array<{
    id: number
    channel: string
    scheduledAt: string | null
    publishedAt: string | null
    status: string
    result: string | null
  }>
  createdAt: string
}

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'material', label: 'Material' },
  { id: 'publicacion', label: 'Publicacion' }
]

const STATUS_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string }> = {
  pending_approval: { label: 'Pendiente', icon: Clock, bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  approved: { label: 'Aprobada', icon: CheckCircle, bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  in_progress: { label: 'En Progreso', icon: PlayCircle, bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  completed: { label: 'Completada', icon: CheckCircle, bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  cancelled: { label: 'Cancelada', icon: XCircle, bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  rejected: { label: 'Rechazada', icon: XCircle, bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' }
}

const CHANNEL_BADGE: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  telegram: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  facebook: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  instagram: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  web: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  email: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
}

const MATERIAL_ICON: Record<string, any> = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { theme } = useTheme()
  const campaignId = params.id as string
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('resumen')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingTaskId, setUploadingTaskId] = useState<number | null>(null)

  useEffect(() => {
    fetchCampaign()
  }, [campaignId])

  const fetchCampaign = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/mkt/campaigns/${campaignId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setCampaign(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/mkt/campaigns/${campaignId}/approve`, { method: 'POST' })
      if (response.ok) fetchCampaign()
    } catch (error) {
      console.error('Error approving campaign:', error)
    }
  }

  const handleReject = async () => {
    try {
      const response = await fetch(`/api/mkt/campaigns/${campaignId}/reject`, { method: 'POST' })
      if (response.ok) fetchCampaign()
    } catch (error) {
      console.error('Error rejecting campaign:', error)
    }
  }

  const toggleTask = async (taskId: number, completed: boolean) => {
    try {
      const response = await fetch(`/api/mkt/campaigns/${campaignId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed })
      })
      if (response.ok) fetchCampaign()
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const addTask = async () => {
    if (!newTaskTitle.trim()) return
    setAddingTask(true)
    try {
      const response = await fetch(`/api/mkt/campaigns/${campaignId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle.trim() })
      })
      if (response.ok) {
        setNewTaskTitle('')
        fetchCampaign()
      }
    } catch (error) {
      console.error('Error adding task:', error)
    } finally {
      setAddingTask(false)
    }
  }

  const handleFileUpload = async (taskId: number, file: File) => {
    setUploadingTaskId(taskId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('taskId', taskId.toString())

      const response = await fetch(`/api/mkt/campaigns/${campaignId}/upload`, {
        method: 'POST',
        body: formData
      })
      if (response.ok) fetchCampaign()
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setUploadingTaskId(null)
    }
  }

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

  if (!campaign) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6 text-center py-20 text-gray-400">
            <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">Campana no encontrada</p>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  const statusConf = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.pending_approval
  const StatusIcon = statusConf.icon
  const completedTasks = campaign.tasks?.filter(t => t.completed).length || 0
  const totalTasks = campaign.tasks?.length || 0
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

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
              <Link href="/dashboard/market/marketing/campaigns">
                <button className={cn(
                  'p-2 rounded-xl transition-colors',
                  theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                )}>
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{campaign.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn(
                    'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                    statusConf.bg, statusConf.text
                  )}>
                    <StatusIcon className="w-3 h-3" />
                    {statusConf.label}
                  </span>
                </div>
              </div>
            </div>
            {campaign.status === 'pending_approval' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span className="text-sm font-medium">Rechazar</span>
                </button>
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg"
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Aprobar</span>
                </button>
              </div>
            )}
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-1 overflow-x-auto pb-1"
          >
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                    : theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {tab.label}
                {tab.id === 'tareas' && totalTasks > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-80">{completedTasks}/{totalTasks}</span>
                )}
              </button>
            ))}
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {/* RESUMEN TAB */}
            {activeTab === 'resumen' && (
              <motion.div
                key="resumen"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className={cn(
                  'rounded-2xl border p-5 shadow-sm',
                  theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                )}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Descripcion</p>
                        <p className="text-sm text-gray-800 dark:text-gray-200">{campaign.description || 'Sin descripcion'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Tipo</p>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{campaign.type?.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Descuento</p>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{campaign.discount || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Fecha Inicio</p>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString('es-ES') : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Fecha Fin</p>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString('es-ES') : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Channels */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Canales</p>
                        <div className="flex flex-wrap gap-1">
                          {campaign.channels?.map(ch => (
                            <span key={ch} className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium',
                              CHANNEL_BADGE[ch] || CHANNEL_BADGE.web
                            )}>
                              {ch}
                            </span>
                          ))}
                          {(!campaign.channels || campaign.channels.length === 0) && (
                            <span className="text-xs text-gray-400">Sin canales</span>
                          )}
                        </div>
                      </div>

                      {/* Products */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Productos ({campaign.products?.length || 0})</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {campaign.products?.map(p => (
                            <div key={p.id} className={cn(
                              'flex items-center justify-between px-3 py-1.5 rounded-lg text-sm',
                              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                            )}>
                              <span className="text-gray-800 dark:text-gray-200">{p.name}</span>
                              <span className="text-gray-500 font-medium">${p.price.toFixed(2)}</span>
                            </div>
                          ))}
                          {(!campaign.products || campaign.products.length === 0) && (
                            <span className="text-xs text-gray-400">Sin productos</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCRIPTS TAB */}
            {activeTab === 'scripts' && (
              <motion.div
                key="scripts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Elevator Pitch */}
                {campaign.scripts?.elevatorPitch && (
                  <div className={cn(
                    'rounded-2xl border p-5 shadow-sm',
                    theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-purple-500" />
                        Elevator Pitch
                      </h3>
                      <button
                        onClick={() => copyText(campaign.scripts.elevatorPitch!, 'pitch')}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                        )}
                      >
                        {copiedField === 'pitch' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{campaign.scripts.elevatorPitch}</p>
                  </div>
                )}

                {/* Social Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(campaign.scripts?.socialCards || {}).map(([platform, text]) => {
                    if (!text) return null
                    return (
                      <div key={platform} className={cn(
                        'rounded-2xl border p-4 shadow-sm',
                        theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                            CHANNEL_BADGE[platform] || CHANNEL_BADGE.web
                          )}>
                            {platform}
                          </span>
                          <button
                            onClick={() => copyText(text, `social-${platform}`)}
                            className={cn(
                              'p-1 rounded-lg transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                            )}
                          >
                            {copiedField === `social-${platform}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{text}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Video Script */}
                {campaign.scripts?.videoScript && Object.values(campaign.scripts.videoScript).some(v => v) && (
                  <div className={cn(
                    'rounded-2xl border p-5 shadow-sm',
                    theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                  )}>
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                      <Video className="w-4 h-4 text-red-500" />
                      Script de Video
                    </h3>
                    <div className="space-y-3">
                      {[
                        { key: 'hook', label: 'Hook', color: 'border-red-500' },
                        { key: 'problem', label: 'Problema', color: 'border-amber-500' },
                        { key: 'solution', label: 'Solucion', color: 'border-emerald-500' },
                        { key: 'proof', label: 'Prueba', color: 'border-blue-500' },
                        { key: 'offer', label: 'Oferta', color: 'border-purple-500' },
                        { key: 'cta', label: 'CTA', color: 'border-pink-500' }
                      ].map(section => {
                        const text = (campaign.scripts.videoScript as any)[section.key]
                        if (!text) return null
                        return (
                          <div key={section.key} className={cn('border-l-2 pl-3', section.color)}>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-0.5">{section.label}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Objections Table */}
                {campaign.scripts?.objections && campaign.scripts.objections.length > 0 && (
                  <div className={cn(
                    'rounded-2xl border p-5 shadow-sm',
                    theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                  )}>
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">Objeciones y Respuestas</h3>
                    <div className="space-y-2">
                      {campaign.scripts.objections.map((obj, i) => (
                        <div key={i} className={cn(
                          'p-3 rounded-xl',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                        )}>
                          <p className="text-xs font-semibold text-red-500 mb-1">Objecion:</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{obj.objection}</p>
                          <p className="text-xs font-semibold text-emerald-500 mb-1">Respuesta:</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{obj.response}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Messages + Hashtags + Target */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {campaign.scripts?.keyMessages && campaign.scripts.keyMessages.length > 0 && (
                    <div className={cn(
                      'rounded-2xl border p-4 shadow-sm',
                      theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                    )}>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Mensajes Clave</h4>
                      <ul className="space-y-1">
                        {campaign.scripts.keyMessages.map((msg, i) => (
                          <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                            <span className="text-purple-500 mt-0.5">-</span> {msg}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {campaign.scripts?.hashtags && campaign.scripts.hashtags.length > 0 && (
                    <div className={cn(
                      'rounded-2xl border p-4 shadow-sm',
                      theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                    )}>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" /> Hashtags
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {campaign.scripts.hashtags.map((tag, i) => (
                          <span key={i} className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                          )}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {campaign.scripts?.targetAudience && (
                    <div className={cn(
                      'rounded-2xl border p-4 shadow-sm',
                      theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                    )}>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1">
                        <Target className="w-3.5 h-3.5" /> Audiencia Objetivo
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{campaign.scripts.targetAudience}</p>
                    </div>
                  )}
                </div>

                {/* Empty Scripts */}
                {!campaign.scripts?.elevatorPitch &&
                  !Object.values(campaign.scripts?.socialCards || {}).some(v => v) &&
                  (!campaign.scripts?.objections || campaign.scripts.objections.length === 0) && (
                  <div className="py-12 text-center text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-medium">Sin scripts generados</p>
                    <p className="text-sm">Los scripts se generaran automaticamente cuando un agente procese la campana</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAREAS TAB */}
            {activeTab === 'tareas' && (
              <motion.div
                key="tareas"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Progress Bar */}
                <div className={cn(
                  'rounded-2xl border p-4 shadow-sm',
                  theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progreso</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{taskProgress}%</span>
                  </div>
                  <div className={cn('h-3 rounded-full overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100')}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${taskProgress}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 rounded-full"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{completedTasks} de {totalTasks} tareas completadas</p>
                </div>

                {/* Task List */}
                <div className={cn(
                  'rounded-2xl border shadow-sm',
                  theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                )}>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {campaign.tasks?.map((task, i) => (
                      <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                        <button
                          onClick={() => toggleTask(task.id, task.completed)}
                          className={cn(
                            'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                            task.completed
                              ? 'bg-emerald-500 border-emerald-500'
                              : theme === 'dark' ? 'border-gray-600 hover:border-purple-500' : 'border-gray-300 hover:border-purple-500'
                          )}
                        >
                          {task.completed && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <span className={cn(
                          'flex-1 text-sm',
                          task.completed
                            ? 'text-gray-400 line-through'
                            : 'text-gray-800 dark:text-gray-200'
                        )}>
                          {task.title}
                        </span>
                        {task.hasFile && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            Archivo
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setUploadingTaskId(task.id)
                            fileInputRef.current?.click()
                          }}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'
                          )}
                        >
                          {uploadingTaskId === task.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Task */}
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTask()}
                        placeholder="Agregar tarea..."
                        className={cn(
                          'flex-1 px-3 py-2 rounded-lg border text-sm',
                          theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                        )}
                      />
                      <button
                        onClick={addTask}
                        disabled={addingTask || !newTaskTitle.trim()}
                        className="px-3 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {(!campaign.tasks || campaign.tasks.length === 0) && (
                  <div className="py-8 text-center text-gray-400">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin tareas aun. Agrega una arriba.</p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file && uploadingTaskId) {
                      handleFileUpload(uploadingTaskId, file)
                    }
                    e.target.value = ''
                  }}
                />
              </motion.div>
            )}

            {/* MATERIAL TAB */}
            {activeTab === 'material' && (
              <motion.div
                key="material"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {campaign.materials?.map((mat, i) => {
                    const MatIcon = MATERIAL_ICON[mat.type] || FileText
                    return (
                      <motion.div
                        key={mat.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          'rounded-2xl border p-4 shadow-sm',
                          theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                        )}
                      >
                        <div className={cn(
                          'w-full aspect-square rounded-xl flex items-center justify-center mb-3',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                        )}>
                          <MatIcon className="w-10 h-10 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{mat.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full',
                            theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'
                          )}>
                            {mat.type}
                          </span>
                          {mat.platform && (
                            <span className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full',
                              CHANNEL_BADGE[mat.platform] || CHANNEL_BADGE.web
                            )}>
                              {mat.platform}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(mat.createdAt).toLocaleDateString('es-ES')}
                        </p>
                      </motion.div>
                    )
                  })}
                </div>

                {(!campaign.materials || campaign.materials.length === 0) && (
                  <div className="py-12 text-center text-gray-400">
                    <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-medium">Sin material</p>
                    <p className="text-sm">El material se agregara a medida que se complete la campana</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* PUBLICACION TAB */}
            {activeTab === 'publicacion' && (
              <motion.div
                key="publicacion"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className={cn(
                  'rounded-2xl border shadow-sm overflow-hidden',
                  theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200'
                )}>
                  {campaign.publications && campaign.publications.length > 0 ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {campaign.publications.map((pub, i) => (
                        <div key={pub.id} className="flex items-center gap-4 px-4 py-3">
                          <div className="flex-shrink-0">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium',
                              CHANNEL_BADGE[pub.channel] || CHANNEL_BADGE.web
                            )}>
                              {pub.channel}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            {pub.scheduledAt && (
                              <p className="text-xs text-gray-500">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                Programado: {new Date(pub.scheduledAt).toLocaleString('es-ES')}
                              </p>
                            )}
                            {pub.publishedAt && (
                              <p className="text-xs text-emerald-500">
                                <Send className="w-3 h-3 inline mr-1" />
                                Publicado: {new Date(pub.publishedAt).toLocaleString('es-ES')}
                              </p>
                            )}
                          </div>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            pub.status === 'published'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : pub.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : pub.status === 'failed'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          )}>
                            {pub.status === 'published' ? 'Publicado' :
                             pub.status === 'scheduled' ? 'Programado' :
                             pub.status === 'failed' ? 'Fallido' : pub.status}
                          </span>
                          {pub.result && (
                            <div className="flex items-center gap-1">
                              <Eye className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{pub.result}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400">
                      <Send className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-lg font-medium">Sin publicaciones</p>
                      <p className="text-sm">Las publicaciones se programaran cuando la campana sea aprobada</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
