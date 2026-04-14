'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Globe, MessageCircle, Send as SendIcon, Eye, EyeOff, Save,
  CheckCircle, AlertTriangle, Loader2, QrCode, ExternalLink, Info
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PlatformField {
  key: string
  label: string
  type: 'text' | 'password' | 'textarea'
  placeholder?: string
}

interface PlatformConfig {
  key: string
  label: string
  icon: any
  gradient: string
  description: string
  howTo: string[]
  fields: PlatformField[]
}

const PLATFORMS: PlatformConfig[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    gradient: 'from-green-500 to-green-600',
    description: 'Conecta via WhatsApp Web para que los agentes puedan leer grupos y enviar mensajes.',
    howTo: [
      'OpenClaw usa whatsapp-web.js que funciona escaneando el QR de WhatsApp Web',
      'Al iniciar el agente por primera vez, OpenClaw genera un QR en su consola',
      'Escanea el QR con la app de WhatsApp del numero que quieras usar',
      'La sesion se guarda automaticamente para reconexiones',
      'Aqui solo guardas el numero como referencia y el session_data que OpenClaw te devuelve'
    ],
    fields: [
      { key: 'phone_number', label: 'Numero de Telefono', type: 'text', placeholder: '+53 5XXXXXXX' },
      { key: 'session_data', label: 'Session Data (de OpenClaw)', type: 'textarea', placeholder: 'OpenClaw te proporcionara este dato despues de escanear el QR' }
    ]
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: Globe,
    gradient: 'from-indigo-500 to-indigo-600',
    description: 'Permite a los agentes leer grupos de Facebook, publicar contenido y monitorear precios.',
    howTo: [
      'Opcion 1 (Scraping): Exporta las cookies de tu sesion de Facebook usando la extension "EditThisCookie" o "Cookie-Editor"',
      'Opcion 2 (Graph API): Crea una app en developers.facebook.com, genera un User Token con permisos de grupos',
      'El access_token de Graph API expira cada 60 dias - necesitaras renovarlo',
      'Para scraping de grupos, las cookies son mas estables pero Facebook puede detectar actividad automatizada'
    ],
    fields: [
      { key: 'cookies', label: 'Cookies de sesion (JSON)', type: 'textarea', placeholder: 'Exporta cookies de Facebook con EditThisCookie y pegalas aqui' },
      { key: 'access_token', label: 'Access Token (Graph API, opcional)', type: 'password', placeholder: 'EAAxxxxxxx...' },
      { key: 'page_id', label: 'Page ID (opcional)', type: 'text', placeholder: 'ID de tu pagina de Facebook' }
    ]
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: Globe,
    gradient: 'from-pink-500 to-pink-600',
    description: 'Permite publicar contenido y monitorear competencia en Instagram.',
    howTo: [
      'Opcion 1 (Cookies): Inicia sesion en Instagram web, exporta cookies con "EditThisCookie"',
      'Opcion 2 (Graph API): Usa la misma app de Facebook, conecta tu cuenta de Instagram Business',
      'El sessionid de cookies se encuentra en las cookies de Instagram como "sessionid"',
      'Para publicar, necesitas Instagram Graph API con una cuenta Business conectada a Facebook'
    ],
    fields: [
      { key: 'cookies', label: 'Cookies de sesion (JSON)', type: 'textarea', placeholder: 'Exporta cookies de Instagram con EditThisCookie' },
      { key: 'session_id', label: 'Session ID (alternativa)', type: 'password', placeholder: 'Valor de la cookie "sessionid"' }
    ]
  },
  {
    key: 'telegram',
    label: 'Telegram',
    icon: SendIcon,
    gradient: 'from-blue-400 to-blue-500',
    description: 'Conecta un bot de Telegram para monitorear canales, grupos y enviar mensajes.',
    howTo: [
      'Crea un bot con @BotFather en Telegram: envia /newbot y sigue las instrucciones',
      'BotFather te dara un token como: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      'Para leer grupos/canales como usuario (no bot), necesitas api_id y api_hash',
      'Obtener api_id y api_hash: ve a my.telegram.org → API Development Tools → Create Application',
      'El bot debe ser admin del grupo/canal para poder leer mensajes'
    ],
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' },
      { key: 'api_id', label: 'API ID (para cuenta de usuario)', type: 'text', placeholder: '12345678' },
      { key: 'api_hash', label: 'API Hash (para cuenta de usuario)', type: 'password', placeholder: '0123456789abcdef0123456789abcdef' }
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showHelp, setShowHelp] = useState<Record<string, boolean>>({})
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

  // Update allowed fields in API
  const PLATFORM_FIELDS_MAP: Record<string, string[]> = {
    whatsapp: ['phone_number', 'session_data'],
    facebook: ['cookies', 'access_token', 'page_id'],
    instagram: ['cookies', 'session_id'],
    telegram: ['bot_token', 'api_id', 'api_hash']
  }

  if (loading) {
    return (
      <ProtectedRoute><DashboardLayout>
        <div className="p-6"><div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/3" />
          <div className="grid grid-cols-1 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl" />)}</div>
        </div></div>
      </DashboardLayout></ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
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
          <div className="space-y-4">
            {PLATFORMS.map((platform, i) => {
              const Icon = platform.icon
              const data = platformData.find(p => p.platform === platform.key)
              const isConfigured = data?.configured || false
              const isExpanded = expanded[platform.key] || false
              const isHelpOpen = showHelp[platform.key] || false
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
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [platform.key]: !prev[platform.key] }))}
                    className={cn('w-full bg-gradient-to-r px-4 py-4 flex items-center justify-between', platform.gradient)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        {platform.key === 'whatsapp' ? <QrCode className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-white" />}
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-white text-base">{platform.label}</span>
                        <p className="text-xs text-white/70">{platform.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isConfigured ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Configurado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-white/10 text-white/80 px-2.5 py-1 rounded-full">
                          <AlertTriangle className="w-3.5 h-3.5" /> Sin configurar
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Body */}
                  {isExpanded && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-4">
                      {/* Help Section */}
                      <button
                        onClick={() => setShowHelp(prev => ({ ...prev, [platform.key]: !prev[platform.key] }))}
                        className={cn(
                          'flex items-center gap-2 text-sm font-medium transition-colors',
                          theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                        )}
                      >
                        <Info className="w-4 h-4" />
                        {isHelpOpen ? 'Ocultar instrucciones' : 'Como configurar'}
                      </button>

                      {isHelpOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className={cn(
                            'rounded-xl p-4 text-sm space-y-2',
                            theme === 'dark' ? 'bg-blue-900/20 border border-blue-800/30' : 'bg-blue-50 border border-blue-100'
                          )}
                        >
                          <ol className="list-decimal list-inside space-y-1.5">
                            {platform.howTo.map((step, idx) => (
                              <li key={idx} className={cn('text-sm leading-relaxed', theme === 'dark' ? 'text-blue-300' : 'text-blue-800')}>
                                {step}
                              </li>
                            ))}
                          </ol>
                          {platform.key === 'telegram' && (
                            <a
                              href="https://my.telegram.org/auth"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-2"
                            >
                              <ExternalLink className="w-3 h-3" /> Abrir my.telegram.org
                            </a>
                          )}
                        </motion.div>
                      )}

                      {/* Fields */}
                      <div className="space-y-3">
                        {platform.fields.map(field => (
                          <div key={field.key}>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{field.label}</label>
                            {field.type === 'textarea' ? (
                              <textarea
                                value={editValues[platform.key]?.[field.key] || ''}
                                onChange={e => handleFieldChange(platform.key, field.key, e.target.value)}
                                placeholder={field.placeholder}
                                rows={3}
                                className={cn('w-full px-3 py-2 rounded-xl border text-sm resize-none font-mono',
                                  theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 placeholder-gray-400'
                                )}
                              />
                            ) : (
                              <input
                                type={field.type === 'password' ? 'password' : 'text'}
                                value={editValues[platform.key]?.[field.key] || ''}
                                onChange={e => handleFieldChange(platform.key, field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className={cn('w-full px-3 py-2 rounded-xl border text-sm font-mono',
                                  theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 placeholder-gray-400'
                                )}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Save Button */}
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
                </motion.div>
              )
            })}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
