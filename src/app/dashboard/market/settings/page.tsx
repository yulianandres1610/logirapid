'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  Save,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Link2,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Play,
  Package,
  Server,
  Key,
  Eye,
  EyeOff,
  Zap,
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  Palette,
  Store,
  Truck,
  Printer,
  Plus,
  Search,
  Wifi,
  WifiOff,
  Trash2,
  Copy,
  MoreVertical,
  Edit3,
  RefreshCcw,
  Info,
  AlertCircle,
  Download,
  ExternalLink,
  ChevronRight,
  Tag,
  Receipt,
  FileText,
  Terminal
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

// Types
interface OdooConfig {
  url: string
  database: string
  username: string
  apiKey: string
  enabled: boolean
  syncFrequency: 'manual' | 'hourly' | 'daily'
  syncDirection: 'import' | 'export' | 'both'
  syncVariants: boolean
  syncStock: boolean
}

interface CompanyConfig {
  marketProvince: string
  marketMunicipality: string
  marketAddress: string
  marketContactPhone: string
  marketAlternatePhone: string
  marketDeliveryHours: string
  marketIsActive: boolean
}

interface SyncLog {
  id: number
  syncType: string
  direction: string
  productsImported: number
  productsExported: number
  productsUpdated: number
  errors: any
  startedAt: string
  completedAt: string
  status: string
  triggeredBy: string
}

interface ConnectionStatus {
  connected: boolean
  version?: string
  message: string
  lastChecked: Date
}

type TabType = 'general' | 'odoo' | 'delivery' | 'print'

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Building },
  { id: 'odoo', label: 'Odoo', icon: Database },
  { id: 'delivery', label: 'Entregas', icon: Truck },
  { id: 'print', label: 'Impresión', icon: Printer }
]

export default function MarketSettingsPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  // Company config state
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>({
    marketProvince: '',
    marketMunicipality: '',
    marketAddress: '',
    marketContactPhone: '',
    marketAlternatePhone: '',
    marketDeliveryHours: '',
    marketIsActive: true
  })

  // Odoo config state
  const [odooConfig, setOdooConfig] = useState<OdooConfig>({
    url: '',
    database: '',
    username: '',
    apiKey: '',
    enabled: false,
    syncFrequency: 'manual',
    syncDirection: 'both',
    syncVariants: true,
    syncStock: true
  })

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType | null
    if (tabParam && TABS.some(t => t.id === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  // Handle tab change with URL update
  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId)
    router.push(`/dashboard/market/settings?tab=${tabId}`, { scroll: false })
  }

  // Fetch configuration
  useEffect(() => {
    fetchAllConfigs()
  }, [])

  const fetchAllConfigs = async () => {
    setLoading(true)
    try {
      // Fetch company config
      const companyRes = await fetch('/api/market/settings/company')
      if (companyRes.ok) {
        const companyData = await companyRes.json()
        if (companyData.success && companyData.data) {
          setCompanyConfig({
            marketProvince: companyData.data.marketProvince || '',
            marketMunicipality: companyData.data.marketMunicipality || '',
            marketAddress: companyData.data.marketAddress || '',
            marketContactPhone: companyData.data.marketContactPhone || '',
            marketAlternatePhone: companyData.data.marketAlternatePhone || '',
            marketDeliveryHours: companyData.data.marketDeliveryHours || '',
            marketIsActive: companyData.data.marketIsActive !== false
          })
        }
      }

      // Fetch Odoo config
      const odooRes = await fetch('/api/market/odoo/config')
      if (odooRes.ok) {
        const odooData = await odooRes.json()
        if (odooData.success && odooData.data) {
          setOdooConfig({
            url: odooData.data.odooUrl || '',
            database: odooData.data.odooDatabase || '',
            username: odooData.data.odooUsername || '',
            apiKey: odooData.data.odooApiKey || '',
            enabled: odooData.data.odooEnabled || false,
            syncFrequency: odooData.data.syncFrequency || 'manual',
            syncDirection: odooData.data.syncDirection || 'both',
            syncVariants: odooData.data.syncVariants !== false,
            syncStock: odooData.data.syncStock !== false
          })
        }
      }

      // Fetch sync logs
      const logsRes = await fetch('/api/market/odoo/logs')
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        if (logsData.success) {
          setSyncLogs(logsData.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    if (!odooConfig.url || !odooConfig.apiKey || !odooConfig.database) {
      setMessage({ type: 'error', text: 'Completa la URL, Base de datos y API Key primero' })
      return
    }

    setTesting(true)
    setConnectionStatus(null)
    setMessage(null)

    try {
      const response = await fetch('/api/market/odoo/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: odooConfig.url,
          database: odooConfig.database,
          username: odooConfig.username || undefined,
          apiKey: odooConfig.apiKey
        })
      })

      const data = await response.json()

      setConnectionStatus({
        connected: data.success,
        version: data.version,
        message: data.message || (data.success ? 'Conexión exitosa' : 'Error de conexión'),
        lastChecked: new Date()
      })

      if (data.success) {
        setMessage({ type: 'success', text: `Conectado a Odoo ${data.version || ''}` })
      } else {
        setMessage({ type: 'error', text: data.error || 'No se pudo conectar' })
      }
    } catch (error) {
      setConnectionStatus({
        connected: false,
        message: 'Error de red',
        lastChecked: new Date()
      })
      setMessage({ type: 'error', text: 'Error al probar conexión' })
    } finally {
      setTesting(false)
    }
  }

  const saveCompanyConfig = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/market/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyConfig)
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Configuración general guardada' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar configuración' })
    } finally {
      setSaving(false)
    }
  }

  const saveOdooConfig = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/market/odoo/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(odooConfig)
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Configuración de Odoo guardada' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar configuración' })
    } finally {
      setSaving(false)
    }
  }

  const startSync = async (direction: 'import' | 'export') => {
    setSyncing(true)
    setMessage(null)

    try {
      const response = await fetch('/api/market/odoo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({
          type: 'success',
          text: direction === 'import'
            ? `Importados: ${data.data?.imported || 0}, Actualizados: ${data.data?.updated || 0}`
            : `Exportados: ${data.data?.exported || 0}`
        })

        // Refresh logs
        const logsResponse = await fetch('/api/market/odoo/logs')
        const logsData = await logsResponse.json()
        if (logsData.success) {
          setSyncLogs(logsData.data || [])
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Error en sincronización' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al sincronizar' })
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className={cn(
            "min-h-screen flex items-center justify-center",
            theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
          )}>
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-4 lg:p-6",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cn(
                  "text-2xl sm:text-3xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Configuración de Mercado
                </h1>
                <p className={cn(
                  "text-sm mt-1",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Administra la configuración de tu tienda y las integraciones
                </p>
              </div>
              <Settings className={cn(
                "w-8 h-8",
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              )} />
            </div>

            {/* Message */}
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "p-4 rounded-xl flex items-center gap-3",
                    message.type === 'success'
                      ? theme === 'dark' ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                      : theme === 'dark' ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
                  )}
                >
                  {message.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <p className={cn(
                    "text-sm",
                    message.type === 'success'
                      ? theme === 'dark' ? 'text-green-300' : 'text-green-800'
                      : theme === 'dark' ? 'text-red-300' : 'text-red-800'
                  )}>
                    {message.text}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabs */}
            <div className={cn(
              "flex gap-1 p-1 rounded-xl",
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all",
                      activeTab === tab.id
                        ? theme === 'dark'
                          ? 'bg-gray-700 text-white shadow-lg'
                          : 'bg-white text-gray-900 shadow-lg'
                        : theme === 'dark'
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {/* General Tab */}
              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {/* Business Info */}
                  <div className={cn(
                    "rounded-2xl border p-6 shadow-lg",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      "text-lg font-bold flex items-center gap-3 mb-6",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Store className="w-5 h-5 text-white" />
                      </div>
                      Información del Mercado
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Province */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <MapPin className="w-4 h-4 inline mr-2" />
                          Provincia
                        </label>
                        <input
                          type="text"
                          value={companyConfig.marketProvince}
                          onChange={(e) => setCompanyConfig({ ...companyConfig, marketProvince: e.target.value })}
                          placeholder="Ej: La Habana"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      {/* Municipality */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Municipio
                        </label>
                        <input
                          type="text"
                          value={companyConfig.marketMunicipality}
                          onChange={(e) => setCompanyConfig({ ...companyConfig, marketMunicipality: e.target.value })}
                          placeholder="Ej: Plaza de la Revolución"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      {/* Address */}
                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Dirección
                        </label>
                        <input
                          type="text"
                          value={companyConfig.marketAddress}
                          onChange={(e) => setCompanyConfig({ ...companyConfig, marketAddress: e.target.value })}
                          placeholder="Calle, número, entre calles..."
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      {/* Contact Phone */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Phone className="w-4 h-4 inline mr-2" />
                          Teléfono Principal
                        </label>
                        <input
                          type="tel"
                          value={companyConfig.marketContactPhone}
                          onChange={(e) => setCompanyConfig({ ...companyConfig, marketContactPhone: e.target.value })}
                          placeholder="+53 5555 5555"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      {/* Alternate Phone */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Teléfono Alternativo
                        </label>
                        <input
                          type="tel"
                          value={companyConfig.marketAlternatePhone}
                          onChange={(e) => setCompanyConfig({ ...companyConfig, marketAlternatePhone: e.target.value })}
                          placeholder="+53 5555 5555"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      {/* Active Toggle */}
                      <div className="md:col-span-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={companyConfig.marketIsActive}
                            onChange={(e) => setCompanyConfig({ ...companyConfig, marketIsActive: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={cn(
                            "w-11 h-6 rounded-full transition-colors relative",
                            companyConfig.marketIsActive
                              ? 'bg-green-500'
                              : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                          )}>
                            <div className={cn(
                              "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow",
                              companyConfig.marketIsActive ? 'translate-x-5' : 'translate-x-0.5'
                            )} />
                          </div>
                          <span className={cn(
                            "text-sm font-medium",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Mercado activo (visible para clientes)
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end mt-6">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={saveCompanyConfig}
                        disabled={saving}
                        className={cn(
                          "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          theme === 'dark'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        )}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Guardar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Odoo Tab */}
              {activeTab === 'odoo' && (
                <motion.div
                  key="odoo"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {/* Connection Settings */}
                  <div className={cn(
                    "rounded-2xl border p-6 shadow-lg",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      "text-lg font-bold flex items-center gap-3 mb-6",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-white" />
                      </div>
                      Conexión Odoo (16+/18)
                    </h2>

                    {/* Help text for API key */}
                    <div className={cn(
                      "p-3 rounded-xl mb-4 text-sm",
                      theme === 'dark' ? 'bg-blue-900/20 border border-blue-800 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-800'
                    )}>
                      <p className="font-medium mb-1">¿Cómo obtener el API Key?</p>
                      <p className="text-xs opacity-80">
                        En Odoo: Configuración → Usuarios → Tu usuario → Pestaña "Claves de API" → Crear nueva clave
                      </p>
                    </div>

                    <div className="space-y-4">
                      {/* URL */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Server className="w-4 h-4 inline mr-2" />
                          URL del Servidor
                        </label>
                        <input
                          type="url"
                          value={odooConfig.url}
                          onChange={(e) => setOdooConfig({ ...odooConfig, url: e.target.value })}
                          placeholder="https://mi-odoo.com"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                          )}
                        />
                      </div>

                      {/* Database */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Database className="w-4 h-4 inline mr-2" />
                          Base de Datos
                        </label>
                        <input
                          type="text"
                          value={odooConfig.database}
                          onChange={(e) => setOdooConfig({ ...odooConfig, database: e.target.value })}
                          placeholder="nombre_base_datos"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                          )}
                        />
                      </div>

                      {/* Username (for Odoo 16+) */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Mail className="w-4 h-4 inline mr-2" />
                          Usuario de Odoo
                        </label>
                        <input
                          type="text"
                          value={odooConfig.username}
                          onChange={(e) => setOdooConfig({ ...odooConfig, username: e.target.value })}
                          placeholder="admin o email@ejemplo.com"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                          )}
                        />
                        <p className={cn(
                          "text-xs mt-1",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          El login del usuario que generó el API Key
                        </p>
                      </div>

                      {/* API Key */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Key className="w-4 h-4 inline mr-2" />
                          API Key
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={odooConfig.apiKey}
                            onChange={(e) => setOdooConfig({ ...odooConfig, apiKey: e.target.value })}
                            placeholder="••••••••••••••••"
                            className={cn(
                              'w-full px-4 py-2.5 pr-10 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className={cn(
                              "absolute right-3 top-1/2 -translate-y-1/2",
                              theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                            )}
                          >
                            {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Connection Status */}
                      {connectionStatus && (
                        <div className={cn(
                          "p-3 rounded-xl flex items-center gap-3",
                          connectionStatus.connected
                            ? theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                            : theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'
                        )}>
                          {connectionStatus.connected ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                          <div>
                            <p className={cn(
                              "text-sm font-medium",
                              connectionStatus.connected ? 'text-green-600' : 'text-red-600'
                            )}>
                              {connectionStatus.message}
                            </p>
                            {connectionStatus.version && (
                              <p className="text-xs text-gray-500">
                                Odoo {connectionStatus.version}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Test & Enable */}
                      <div className="flex items-center gap-4 pt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={testConnection}
                          disabled={testing || !odooConfig.url}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                          )}
                        >
                          {testing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                          Probar Conexión
                        </motion.button>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={odooConfig.enabled}
                            onChange={(e) => setOdooConfig({ ...odooConfig, enabled: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={cn(
                            "w-11 h-6 rounded-full transition-colors relative",
                            odooConfig.enabled
                              ? 'bg-purple-500'
                              : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                          )}>
                            <div className={cn(
                              "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow",
                              odooConfig.enabled ? 'translate-x-5' : 'translate-x-0.5'
                            )} />
                          </div>
                          <span className={cn(
                            "text-sm font-medium",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Habilitar Sincronización
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Sync Options */}
                  <div className={cn(
                    "rounded-2xl border p-6 shadow-lg",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      "text-lg font-bold flex items-center gap-3 mb-6",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-white" />
                      </div>
                      Opciones de Sincronización
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Frequency */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Clock className="w-4 h-4 inline mr-2" />
                          Frecuencia
                        </label>
                        <select
                          value={odooConfig.syncFrequency}
                          onChange={(e) => setOdooConfig({ ...odooConfig, syncFrequency: e.target.value as any })}
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-amber-500 focus:ring-amber-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20'
                          )}
                        >
                          <option value="manual">Manual</option>
                          <option value="hourly">Cada hora</option>
                          <option value="daily">Diaria</option>
                        </select>
                      </div>

                      {/* Direction */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Dirección por Defecto
                        </label>
                        <select
                          value={odooConfig.syncDirection}
                          onChange={(e) => setOdooConfig({ ...odooConfig, syncDirection: e.target.value as any })}
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-amber-500 focus:ring-amber-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-amber-500 focus:ring-amber-500/20'
                          )}
                        >
                          <option value="import">Solo Importar</option>
                          <option value="export">Solo Exportar</option>
                          <option value="both">Bidireccional</option>
                        </select>
                      </div>

                      {/* Checkboxes */}
                      <div className="md:col-span-2 flex flex-wrap gap-6">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={odooConfig.syncVariants}
                            onChange={(e) => setOdooConfig({ ...odooConfig, syncVariants: e.target.checked })}
                            className={cn(
                              "w-5 h-5 rounded border-2 transition-colors accent-purple-500",
                              odooConfig.syncVariants
                                ? 'bg-purple-500 border-purple-500'
                                : theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                            )}
                          />
                          <span className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Sincronizar Variantes
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={odooConfig.syncStock}
                            onChange={(e) => setOdooConfig({ ...odooConfig, syncStock: e.target.checked })}
                            className={cn(
                              "w-5 h-5 rounded border-2 transition-colors accent-purple-500",
                              odooConfig.syncStock
                                ? 'bg-purple-500 border-purple-500'
                                : theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                            )}
                          />
                          <span className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            Sincronizar Stock
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end mt-6">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={saveOdooConfig}
                        disabled={saving}
                        className={cn(
                          "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          theme === 'dark'
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-purple-500 hover:bg-purple-600 text-white'
                        )}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Guardar Configuración
                      </motion.button>
                    </div>
                  </div>

                  {/* Sync Actions */}
                  <div className={cn(
                    "rounded-2xl border p-6 shadow-lg",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      "text-lg font-bold flex items-center gap-3 mb-6",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white" />
                      </div>
                      Acciones Manuales
                    </h2>

                    <div className="flex flex-wrap gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => startSync('import')}
                        disabled={syncing || !odooConfig.enabled}
                        className={cn(
                          "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          theme === 'dark'
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg shadow-green-400/25'
                        )}
                      >
                        {syncing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <ArrowDownCircle className="w-5 h-5" />
                        )}
                        Importar de Odoo
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => startSync('export')}
                        disabled={syncing || !odooConfig.enabled}
                        className={cn(
                          "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          theme === 'dark'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25'
                            : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-400/25'
                        )}
                      >
                        {syncing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <ArrowUpCircle className="w-5 h-5" />
                        )}
                        Exportar a Odoo
                      </motion.button>
                    </div>

                    {!odooConfig.enabled && (
                      <p className={cn(
                        "text-sm mt-4 flex items-center gap-2",
                        theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                      )}>
                        <AlertTriangle className="w-4 h-4" />
                        Habilita la sincronización para usar estas acciones
                      </p>
                    )}
                  </div>

                  {/* Sync History */}
                  <div className={cn(
                    "rounded-2xl border p-6 shadow-lg",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      "text-lg font-bold flex items-center gap-3 mb-6",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                        <History className="w-5 h-5 text-white" />
                      </div>
                      Historial de Sincronización
                    </h2>

                    {syncLogs.length === 0 ? (
                      <div className="text-center py-8">
                        <Package className={cn(
                          "w-12 h-12 mx-auto mb-3",
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                        )} />
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          No hay sincronizaciones recientes
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {syncLogs.slice(0, 5).map((log) => (
                          <div
                            key={log.id}
                            className={cn(
                              "p-4 rounded-xl flex items-center justify-between",
                              theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {log.status === 'completed' ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : log.status === 'error' ? (
                                <XCircle className="w-5 h-5 text-red-500" />
                              ) : (
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                              )}
                              <div>
                                <p className={cn(
                                  "font-medium text-sm",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {log.direction === 'import' ? 'Importación' : 'Exportación'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(log.startedAt).toLocaleString('es-ES')}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "text-sm",
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {log.productsImported > 0 && `+${log.productsImported} importados`}
                                {log.productsExported > 0 && `+${log.productsExported} exportados`}
                                {log.productsUpdated > 0 && ` / ${log.productsUpdated} actualizados`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Delivery Tab */}
              {activeTab === 'delivery' && (
                <motion.div
                  key="delivery"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className={cn(
                    "rounded-2xl border p-6 shadow-lg",
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}>
                    <h2 className={cn(
                      "text-lg font-bold flex items-center gap-3 mb-6",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-white" />
                      </div>
                      Configuración de Entregas
                    </h2>

                    <div className="space-y-4">
                      {/* Delivery Hours */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Clock className="w-4 h-4 inline mr-2" />
                          Horario de Entregas
                        </label>
                        <input
                          type="text"
                          value={companyConfig.marketDeliveryHours}
                          onChange={(e) => setCompanyConfig({ ...companyConfig, marketDeliveryHours: e.target.value })}
                          placeholder="Ej: 9:00 AM - 6:00 PM"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                        <p className={cn(
                          "text-xs mt-1",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          Este horario se mostrará a los clientes al realizar pedidos
                        </p>
                      </div>

                      {/* Coming Soon */}
                      <div className={cn(
                        "p-6 rounded-xl border-2 border-dashed text-center",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <Truck className={cn(
                          "w-12 h-12 mx-auto mb-3",
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                        )} />
                        <p className={cn(
                          "text-sm font-medium",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Más opciones de entrega próximamente
                        </p>
                        <p className={cn(
                          "text-xs mt-1",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          Zonas de entrega, tarifas por distancia, horarios personalizados
                        </p>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end mt-6">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={saveCompanyConfig}
                        disabled={saving}
                        className={cn(
                          "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          theme === 'dark'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        )}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Guardar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Print Tab */}
              {activeTab === 'print' && (
                <PrintServicesTab theme={theme} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}


// Printer configuration constants
const PRINTER_TYPES = [
  { id: 'thermal_80mm', label: 'Térmica 80mm', description: 'Impresora térmica de recibos' },
  { id: 'thermal_58mm', label: 'Térmica 58mm', description: 'Impresora térmica compacta' },
  { id: 'label_zebra', label: 'Zebra (ZPL)', description: 'Impresora de etiquetas Zebra' },
  { id: 'label_tspl', label: 'TSC/TSPL', description: 'Impresora de etiquetas TSC' },
  { id: 'standard', label: 'Estándar/Láser', description: 'Impresora de documentos PDF' }
]

// Print Services Tab Component
function PrintServicesTab({ theme }: { theme: string }) {
  const [services, setServices] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [createdToken, setCreatedToken] = useState('')
  const [createdName, setCreatedName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    warehouseId: '',
    printerType: 'thermal_80mm'
  })
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isDark = theme === 'dark'

  const fetchServices = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/print-services')
      const json = await res.json()
      if (json.success) {
        setServices(json.data || [])
      }
    } catch (err) {
      console.error('Error fetching print services:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const res = await fetch('/api/market/warehouses')
      const json = await res.json()
      if (json.success) {
        setWarehouses(json.data?.warehouses || [])
      }
    } catch (err) {
      console.error('Error fetching warehouses:', err)
    }
  }

  useEffect(() => {
    fetchServices()
    fetchWarehouses()
  }, [])

  const handleCreate = async () => {
    if (!formData.name.trim()) return
    try {
      setCreating(true)
      const res = await fetch('/api/print-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const json = await res.json()
      if (json.success) {
        setCreatedToken(json.data?.pairingToken || '')
        setCreatedName(formData.name)
        setShowCreateModal(false)
        setShowSuccessModal(true)
        setFormData({ name: '', warehouseId: '', printerType: 'thermal_80mm' })
        fetchServices()
      }
    } catch (err) {
      console.error('Error creating print service:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      setDeleting(true)
      const res = await fetch(`/api/print-services?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setShowDeleteConfirm(null)
        fetchServices()
      }
    } catch (err) {
      console.error('Error deleting print service:', err)
    } finally {
      setDeleting(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const truncateToken = (token: string) => {
    if (!token) return '---'
    if (token.length <= 16) return token
    return token.substring(0, 8) + '...' + token.substring(token.length - 8)
  }

  const getOnlineStatus = (lastSeenAt: string | null) => {
    if (!lastSeenAt) return { online: false, label: 'Nunca conectado' }
    const diff = Date.now() - new Date(lastSeenAt).getTime()
    const minutes = diff / 1000 / 60
    if (minutes < 5) return { online: true, label: 'En línea' }
    if (minutes < 60) return { online: false, label: `Hace ${Math.floor(minutes)} min` }
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return { online: false, label: `Hace ${hours}h` }
    return { online: false, label: `Hace ${Math.floor(hours / 24)}d` }
  }

  const getPrinterTypeLabel = (typeId: string) => {
    return PRINTER_TYPES.find(t => t.id === typeId)?.label || typeId
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Servicios de Impresión
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Gestiona los agentes de impresión conectados a tu tienda
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Servicio
        </button>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : services.length === 0 ? (
        <div className={`rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} p-12 text-center`}>
          <Server className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            No hay servicios de impresión
          </h3>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Crea un servicio de impresión para conectar un agente a tu tienda
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear Servicio
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {services.map((service) => {
            const status = getOnlineStatus(service.lastSeenAt)
            const agentPrinters = service.agentPrinters ? (typeof service.agentPrinters === 'string' ? JSON.parse(service.agentPrinters) : service.agentPrinters) : []

            return (
              <div
                key={service.id}
                className={`rounded-xl border p-5 ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Status indicator */}
                    <div className={`mt-1 p-2.5 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                      <Printer className={`w-5 h-5 ${status.online ? 'text-green-500' : isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name and status */}
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {service.name}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${status.online ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className={`text-xs ${status.online ? 'text-green-500' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mt-3">
                        {/* Token */}
                        <div>
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Token</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <code className={`text-xs font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              {truncateToken(service.pairingToken)}
                            </code>
                            <button
                              onClick={() => copyToClipboard(service.pairingToken, `token-${service.id}`)}
                              className={`p-0.5 rounded ${isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors`}
                              title="Copiar token"
                            >
                              {copiedId === `token-${service.id}` ? (
                                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <Copy className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Printer Type */}
                        <div>
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Tipo</span>
                          <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {getPrinterTypeLabel(service.printerType)}
                          </p>
                        </div>

                        {/* Warehouse */}
                        <div>
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Almacén</span>
                          <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {service.warehouseName || '---'}
                          </p>
                        </div>

                        {/* Agent Version */}
                        <div>
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Agente</span>
                          <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {service.agentVersion || '---'}
                          </p>
                        </div>
                      </div>

                      {/* Detected printers */}
                      {Array.isArray(agentPrinters) && agentPrinters.length > 0 && (
                        <div className="mt-3">
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Impresoras detectadas
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {agentPrinters.map((p: any, i: number) => (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                  isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                <Printer className="w-3 h-3" />
                                {typeof p === 'string' ? p : p.name || p.displayName || 'Desconocida'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => setShowDeleteConfirm(service.id)}
                    className={`p-2 rounded-lg ${isDark ? 'hover:bg-red-900/30 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'} transition-colors`}
                    title="Eliminar servicio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-md rounded-xl border shadow-2xl ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
            >
              <div className="p-6">
                <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Nuevo Servicio de Impresión
                </h3>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ej: Impresora Caja 1"
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
                    />
                  </div>

                  {/* Warehouse */}
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Almacén
                    </label>
                    <select
                      value={formData.warehouseId}
                      onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
                    >
                      <option value="">Sin asignar</option>
                      {warehouses.map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Printer Type */}
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Tipo de Impresora
                    </label>
                    <select
                      value={formData.printerType}
                      onChange={(e) => setFormData({ ...formData, printerType: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
                    >
                      {PRINTER_TYPES.map((pt) => (
                        <option key={pt.id} value={pt.id}>{pt.label} - {pt.description}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } transition-colors`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!formData.name.trim() || creating}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      'Crear Servicio'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal with Token */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowSuccessModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-lg rounded-xl border shadow-2xl ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Servicio Creado
                    </h3>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {createdName}
                    </p>
                  </div>
                </div>

                {/* Token */}
                <div className={`rounded-lg border p-4 mb-4 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Token de Autenticación
                  </label>
                  <div className="flex items-center gap-2">
                    <code className={`flex-1 text-sm font-mono break-all ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                      {createdToken}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdToken, 'created-token')}
                      className={`shrink-0 p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
                      title="Copiar token"
                    >
                      {copiedId === 'created-token' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                      )}
                    </button>
                  </div>
                  <p className={`text-xs mt-2 ${isDark ? 'text-yellow-500/80' : 'text-yellow-600'}`}>
                    Guarda este token. No se mostrará de nuevo.
                  </p>
                </div>

                {/* Install Instructions */}
                <div className={`rounded-lg border p-4 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Terminal className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Instalar Agente
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Mac */}
                    <div>
                      <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Mac</span>
                      <div className={`flex items-center gap-2 mt-1 rounded-md p-2 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <code className={`flex-1 text-xs font-mono break-all ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          curl -fsSL &quot;https://fabrica.servisumic.com/api/print-agent/install?os=mac&quot; | bash
                        </code>
                        <button
                          onClick={() => copyToClipboard('curl -fsSL "https://fabrica.servisumic.com/api/print-agent/install?os=mac" | bash', 'install-mac')}
                          className={`shrink-0 p-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
                        >
                          {copiedId === 'install-mac' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Windows */}
                    <div>
                      <span className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Windows</span>
                      <div className={`flex items-center gap-2 mt-1 rounded-md p-2 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <code className={`flex-1 text-xs font-mono break-all ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          powershell -c &quot;irm https://fabrica.servisumic.com/api/print-agent/install?os=windows | iex&quot;
                        </code>
                        <button
                          onClick={() => copyToClipboard('powershell -c "irm https://fabrica.servisumic.com/api/print-agent/install?os=windows | iex"', 'install-win')}
                          className={`shrink-0 p-1 rounded ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} transition-colors`}
                        >
                          {copiedId === 'install-win' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Close button */}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowDeleteConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`relative w-full max-w-sm rounded-xl border shadow-2xl ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-full bg-red-500/10">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Eliminar Servicio
                  </h3>
                </div>
                <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Esta acción eliminará el servicio de impresión y revocará su token. El agente dejará de funcionar inmediatamente.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } transition-colors`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleDelete(showDeleteConfirm)}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Eliminando...
                      </>
                    ) : (
                      'Eliminar'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
