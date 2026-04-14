'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Globe, MessageCircle, Send as SendIcon, Eye, EyeOff, Save, CheckCircle, AlertTriangle, Loader2
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

const PLATFORMS = [
  {
    key: 'facebook',
    label: 'Facebook',
    icon: Globe,
    gradient: 'from-indigo-500 to-indigo-600',
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password' },
      { key: 'page_id', label: 'Page ID', type: 'text' },
      { key: 'cookies', label: 'Cookies (para scraping)', type: 'textarea' }
    ]
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: Globe,
    gradient: 'from-pink-500 to-pink-600',
    fields: [
      { key: 'session_id', label: 'Session ID', type: 'password' },
      { key: 'cookies', label: 'Cookies', type: 'textarea' }
    ]
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    gradient: 'from-green-500 to-green-600',
    fields: [
      { key: 'phone_number', label: 'Numero de Telefono', type: 'text' },
      { key: 'api_key', label: 'API Key', type: 'password' }
    ]
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: SendIcon,
    gradient: 'from-blue-400 to-blue-500',
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password' },
      { key: 'api_id', label: 'API ID', type: 'text' },
      { key: 'api_hash', label: 'API Hash', type: 'password' }
    ]
  }
]

interface PlatformData {
  platform: string
  configured: boolean
  status: string | null
  fields: Record<string, string>
}

export default function MarketingSettingsPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [platformData, setPlatformData] = useState<PlatformData[]>([])
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({})
  const [showFields, setShowFields] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/mkt/settings/integrations')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setPlatformData(data.data?.platforms || [])
          // Init edit values with masked data
          const vals: Record<string, Record<string, string>> = {}
          for (const p of data.data?.platforms || []) {
            vals[p.platform] = { ...p.fields }
          }
          setEditValues(vals)
        }
      }
    } catch {} finally { setLoading(false) }
  }

  const handleFieldChange = (platform: string, field: string, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [platform]: { ...(prev[platform] || {}), [field]: value }
    }))
  }

  const handleSave = async (platform: string) => {
    setSaving(prev => ({ ...prev, [platform]: true }))
    try {
      const creds = editValues[platform] || {}
      // Only send non-masked values (those that don't start with ****)
      const cleanCreds: Record<string, string> = {}
      for (const [k, v] of Object.entries(creds)) {
        if (v && !v.startsWith('****')) {
          cleanCreds[k] = v
        }
      }

      const res = await fetch('/api/mkt/settings/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, credentials: cleanCreds })
      })

      if (res.ok) {
        setSaved(prev => ({ ...prev, [platform]: true }))
        setTimeout(() => setSaved(prev => ({ ...prev, [platform]: false })), 2000)
        fetchData()
      }
    } catch {} finally {
      setSaving(prev => ({ ...prev, [platform]: false }))
    }
  }

  const toggleShow = (platform: string) => {
    setShowFields(prev => ({ ...prev, [platform]: !prev[platform] }))
  }

  if (loading) {
    return (
      <ProtectedRoute><DashboardLayout>
        <div className="p-6"><div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl" />)}</div>
        </div></div>
      </DashboardLayout></ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
            <Link href="/dashboard/market/marketing">
              <button className={cn('p-2 rounded-xl transition-colors', theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600')}>
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integraciones</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configura las credenciales de cada plataforma para que los agentes puedan operar</p>
            </div>
          </motion.div>

          {/* Platform Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLATFORMS.map((platform, i) => {
              const Icon = platform.icon
              const data = platformData.find(p => p.platform === platform.key)
              const isConfigured = data?.configured || false
              const isExpanded = showFields[platform.key] || false
              const isSaving = saving[platform.key] || false
              const isSaved = saved[platform.key] || false

              return (
                <motion.div
                  key={platform.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn('rounded-2xl border overflow-hidden shadow-sm', theme === 'dark' ? 'bg-gray-900 border-gray-700/50' : 'bg-white border-gray-200')}
                >
                  {/* Header */}
                  <div className={cn('bg-gradient-to-r px-4 py-3 flex items-center justify-between', platform.gradient)}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-white" />
                      <span className="font-semibold text-white">{platform.label}</span>
                    </div>
                    {isConfigured ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Configurado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs bg-white/10 text-white/80 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Sin configurar
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <button
                      onClick={() => toggleShow(platform.key)}
                      className={cn('flex items-center gap-2 text-sm font-medium mb-3 transition-colors',
                        theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {isExpanded ? 'Ocultar campos' : 'Mostrar campos'}
                    </button>

                    {isExpanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                        {platform.fields.map(field => (
                          <div key={field.key}>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{field.label}</label>
                            {field.type === 'textarea' ? (
                              <textarea
                                value={editValues[platform.key]?.[field.key] || ''}
                                onChange={e => handleFieldChange(platform.key, field.key, e.target.value)}
                                placeholder={`Ingresa ${field.label.toLowerCase()}`}
                                rows={3}
                                className={cn('w-full px-3 py-2 rounded-xl border text-sm resize-none font-mono',
                                  theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                                )}
                              />
                            ) : (
                              <input
                                type={field.type === 'password' ? 'password' : 'text'}
                                value={editValues[platform.key]?.[field.key] || ''}
                                onChange={e => handleFieldChange(platform.key, field.key, e.target.value)}
                                placeholder={`Ingresa ${field.label.toLowerCase()}`}
                                className={cn('w-full px-3 py-2 rounded-xl border text-sm font-mono',
                                  theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'
                                )}
                              />
                            )}
                          </div>
                        ))}

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSave(platform.key)}
                          disabled={isSaving}
                          className={cn(
                            'w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all',
                            isSaved
                              ? 'bg-emerald-500 text-white'
                              : cn('bg-gradient-to-r text-white shadow-lg', platform.gradient)
                          )}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> :
                           isSaved ? <><CheckCircle className="w-4 h-4" /> Guardado</> :
                           <><Save className="w-4 h-4" /> Guardar {platform.label}</>}
                        </motion.button>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
