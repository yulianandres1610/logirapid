'use client'

import React, { useState, useEffect } from 'react'
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
  FileText
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
                    onClick={() => setActiveTab(tab.id)}
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
const ALL_DOCUMENT_TYPES = [
  { id: 'pos_receipt', label: 'Recibo POS', description: 'Recibos de punto de venta' },
  { id: 'purchase_invoice', label: 'Factura de Compra', description: 'Facturas de proveedores' },
  { id: 'sales_report', label: 'Reporte de Ventas', description: 'Reportes de ventas diarias' },
  { id: 'cash_register_report', label: 'Reporte de Caja', description: 'Arqueos y cierres de caja' },
  { id: 'inventory_count_report', label: 'Reporte de Conteo', description: 'Conteos de inventario' },
  { id: 'invoice', label: 'Factura', description: 'Facturas generales' },
  { id: 'product_label', label: 'Etiqueta Producto', description: 'Etiquetas de productos' },
  { id: 'shipping_label', label: 'Etiqueta Envío', description: 'Etiquetas de paquetes' },
  { id: 'warehouse_operation', label: 'Operación Almacén', description: 'Documentos de almacén' },
  { id: 'consignment_receipt', label: 'Recibo Consignación', description: 'Recibos de consignación' },
  { id: 'unified_reception', label: 'Recepción Unificada', description: 'Documentos de recepción' }
]

const PRINTER_TYPES = [
  { id: 'thermal_80mm', label: 'Térmica 80mm', description: 'Impresora de recibos' },
  { id: 'label_4x6', label: 'Etiquetas 4x6', description: 'Impresora de etiquetas de envío' },
  { id: 'label_barcode', label: 'Código de Barras', description: 'Impresora de etiquetas pequeñas' },
  { id: 'standard', label: 'Estándar', description: 'Impresora de documentos' }
]

// Print Services Tab Component
function PrintServicesTab({ theme }: { theme: string }) {
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [newCredentials, setNewCredentials] = useState<{ serviceCode: string; apiKey: string; apiSecret: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [serviceName, setServiceName] = useState('')
  const [editServiceName, setEditServiceName] = useState('')
  const [actionMenuOpen, setActionMenuOpen] = useState<number | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Printer configuration state
  const [showPrinterConfigModal, setShowPrinterConfigModal] = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null)
  const [printerConfig, setPrinterConfig] = useState<{
    printerType: string
    supportedDocumentTypes: string[]
  }>({ printerType: 'standard', supportedDocumentTypes: [] })
  const [savingPrinter, setSavingPrinter] = useState(false)
  const [refreshingPrinters, setRefreshingPrinters] = useState(false)

  useEffect(() => {
    fetchServices()
  }, [])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [message])

  const fetchServices = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/print/services')
      if (response.ok) {
        const data = await response.json()
        setServices(data.data?.services || [])
      }
    } catch (error) {
      console.error('Error fetching print services:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchServiceDetails = async (id: number) => {
    try {
      const response = await fetch(`/api/print/services/${id}`)
      if (response.ok) {
        const data = await response.json()
        console.log(`[Settings] Service ${id} details received:`, data.data)
        console.log(`[Settings] Printers received: ${data.data?.printers?.length || 0}`)
        if (data.data?.printers) {
          data.data.printers.forEach((p: any, i: number) =>
            console.log(`[Settings]   [${i + 1}] "${p.printerName}" (id: ${p.id}, type: ${p.printerType})`)
          )
        }
        return data.data
      }
    } catch (error) {
      console.error('Error fetching service details:', error)
    }
    return null
  }

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!serviceName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/print/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceName })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setNewCredentials({
          serviceCode: data.data.serviceCode,
          apiKey: data.data.apiKey,
          apiSecret: data.data.apiSecret
        })
        setShowCreateModal(false)
        setShowCredentialsModal(true)
        setServiceName('')
        fetchServices()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al crear servicio' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al crear servicio' })
    } finally {
      setCreating(false)
    }
  }

  const handleViewDetails = async (service: any) => {
    setActionMenuOpen(null)
    const details = await fetchServiceDetails(service.id)
    if (details) {
      setSelectedService({ ...service, ...details.service, printers: details.printers })
      setShowDetailsModal(true)
    }
  }

  const refreshPrinters = async () => {
    if (!selectedService) return
    setRefreshingPrinters(true)
    try {
      const details = await fetchServiceDetails(selectedService.id)
      if (details) {
        setSelectedService(prev => prev ? { ...prev, printers: details.printers } : null)
        setMessage({ type: 'success', text: `${details.printers?.length || 0} impresoras encontradas` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al refrescar impresoras' })
    } finally {
      setRefreshingPrinters(false)
    }
  }

  const handleEditService = (service: any) => {
    setActionMenuOpen(null)
    setSelectedService(service)
    setEditServiceName(service.serviceName)
    setShowEditModal(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editServiceName.trim() || !selectedService) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/print/services/${selectedService.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceName: editServiceName })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Servicio actualizado correctamente' })
        setShowEditModal(false)
        setSelectedService(null)
        fetchServices()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al actualizar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al actualizar servicio' })
    } finally {
      setUpdating(false)
    }
  }

  const handleRegenerateCredentials = async () => {
    if (!selectedService) return
    if (!confirm('¿Regenerar las credenciales? La app de impresión dejará de funcionar hasta que configures las nuevas credenciales.')) return

    setRegenerating(true)
    try {
      const response = await fetch(`/api/print/services/${selectedService.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateCredentials: true })
      })

      const data = await response.json()

      if (response.ok && data.success && data.data) {
        setNewCredentials({
          serviceCode: selectedService.serviceCode,
          apiKey: data.data.apiKey,
          apiSecret: data.data.apiSecret
        })
        setShowDetailsModal(false)
        setShowCredentialsModal(true)
        fetchServices()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al regenerar credenciales' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al regenerar credenciales' })
    } finally {
      setRegenerating(false)
    }
  }

  const handleDeleteService = async (id: number, name: string) => {
    setActionMenuOpen(null)
    if (!confirm(`¿Eliminar el servicio "${name}"? Esta acción no se puede deshacer.`)) return

    try {
      const response = await fetch(`/api/print/services/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: 'Servicio eliminado' })
        fetchServices()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al eliminar' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al eliminar servicio' })
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  // Printer configuration functions
  const openPrinterConfig = (printer: any) => {
    setSelectedPrinter(printer)
    setPrinterConfig({
      printerType: printer.printerType || 'standard',
      supportedDocumentTypes: printer.supportedDocumentTypes || ALL_DOCUMENT_TYPES.map(t => t.id)
    })
    setShowPrinterConfigModal(true)
  }

  const handleSavePrinterConfig = async () => {
    if (!selectedPrinter || !selectedService) return

    setSavingPrinter(true)
    try {
      const response = await fetch(`/api/print/services/${selectedService.id}/printers/${selectedPrinter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerType: printerConfig.printerType,
          supportedDocumentTypes: printerConfig.supportedDocumentTypes
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Configuración de impresora actualizada' })
        setShowPrinterConfigModal(false)
        // Refresh service details
        const details = await fetchServiceDetails(selectedService.id)
        if (details) {
          setSelectedService({ ...selectedService, ...details.service, printers: details.printers })
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar configuración' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar configuración de impresora' })
    } finally {
      setSavingPrinter(false)
    }
  }

  const toggleDocumentType = (docType: string) => {
    setPrinterConfig(prev => ({
      ...prev,
      supportedDocumentTypes: prev.supportedDocumentTypes.includes(docType)
        ? prev.supportedDocumentTypes.filter(t => t !== docType)
        : [...prev.supportedDocumentTypes, docType]
    }))
  }

  const formatLastSeen = (date: string | null) => {
    if (!date) return 'Nunca'
    const d = new Date(date)
    const diff = Date.now() - d.getTime()
    if (diff < 60000) return 'Hace menos de 1 min'
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`
    if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} horas`
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  }

  const getStatusBadge = (status: string, lastSeenAt: string | null) => {
    const isRecentlyActive = lastSeenAt && (Date.now() - new Date(lastSeenAt).getTime()) < 2 * 60 * 1000

    if (status === 'active' && isRecentlyActive) {
      return (
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
          theme === 'dark' ? 'bg-green-900/40 text-green-400 border border-green-800' : 'bg-green-100 text-green-800'
        )}>
          <Wifi className="w-3 h-3" />
          En línea
        </span>
      )
    } else if (status === 'pending') {
      return (
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
          theme === 'dark' ? 'bg-amber-900/40 text-amber-400 border border-amber-800' : 'bg-amber-100 text-amber-800'
        )}>
          <Clock className="w-3 h-3" />
          Pendiente
        </span>
      )
    } else {
      return (
        <span className={cn(
          "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full",
          theme === 'dark' ? 'bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-100 text-gray-600'
        )}>
          <WifiOff className="w-3 h-3" />
          Desconectado
        </span>
      )
    }
  }

  return (
    <motion.div
      key="print"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      {/* Message Toast */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "p-4 rounded-xl flex items-center gap-3",
              message.type === 'success'
                ? theme === 'dark' ? 'bg-green-900/40 border border-green-700 text-green-300' : 'bg-green-50 border border-green-200 text-green-800'
                : theme === 'dark' ? 'bg-red-900/40 border border-red-700 text-red-300' : 'bg-red-50 border border-red-200 text-red-800'
            )}
          >
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="text-sm">{message.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "rounded-2xl border p-6 shadow-lg",
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={cn(
            "text-lg font-bold flex items-center gap-3",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Printer className="w-5 h-5 text-white" />
            </div>
            Servicios de Impresión
          </h2>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg",
              theme === 'dark'
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/25'
                : 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/25'
            )}
          >
            <Plus className="w-4 h-4" />
            Nuevo Servicio
          </motion.button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Download App Card */}
          <div className={cn(
            "p-4 rounded-xl border",
            theme === 'dark' ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border-green-700' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                theme === 'dark' ? 'bg-green-800' : 'bg-green-100'
              )}>
                <Download className={cn("w-5 h-5", theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
              </div>
              <div className="flex-1">
                <h3 className={cn("font-semibold", theme === 'dark' ? 'text-green-200' : 'text-green-900')}>
                  Descargar LogiRapid Print Service
                </h3>
                <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-green-300' : 'text-green-700')}>
                  Aplicación para Windows que permite imprimir recibos y etiquetas automáticamente
                </p>
                <a
                  href="https://github.com/anthropics/claude-code/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    theme === 'dark'
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  )}
                >
                  <Download className="w-4 h-4" />
                  Descargar para Windows
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Admin Link Card */}
          <div className={cn(
            "p-4 rounded-xl border",
            theme === 'dark' ? 'bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border-purple-700' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                theme === 'dark' ? 'bg-purple-800' : 'bg-purple-100'
              )}>
                <Settings className={cn("w-5 h-5", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')} />
              </div>
              <div className="flex-1">
                <h3 className={cn("font-semibold", theme === 'dark' ? 'text-purple-200' : 'text-purple-900')}>
                  Administrador de Impresoras
                </h3>
                <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-purple-300' : 'text-purple-700')}>
                  Configura impresoras de tickets, etiquetas y documentos. Asigna tipos de documento a cada impresora.
                </p>
                <a
                  href="/dashboard/market/print-services"
                  className={cn(
                    "inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    theme === 'dark'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  )}
                >
                  <Settings className="w-4 h-4" />
                  Ir al Administrador
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Printer Types Info */}
        <div className={cn(
          "p-4 rounded-xl mb-6 border",
          theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
        )}>
          <h3 className={cn("font-semibold mb-3 flex items-center gap-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            <Tag className="w-4 h-4" />
            Tipos de Impresoras Soportadas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRINTER_TYPES.map((type) => (
              <div
                key={type.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg",
                  theme === 'dark' ? 'bg-gray-900/60' : 'bg-white'
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  type.id === 'thermal_80mm'
                    ? theme === 'dark' ? 'bg-orange-900/50 text-orange-400' : 'bg-orange-100 text-orange-600'
                    : type.id.startsWith('label_')
                    ? theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'
                    : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                )}>
                  {type.id === 'thermal_80mm' ? (
                    <Receipt className="w-4 h-4" />
                  ) : type.id.startsWith('label_') ? (
                    <Tag className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {type.label}
                  </p>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                    {type.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Card */}
        <div className={cn(
          "p-4 rounded-xl mb-6 border",
          theme === 'dark' ? 'bg-blue-950/40 border-blue-800' : 'bg-blue-50 border-blue-200'
        )}>
          <div className="flex items-start gap-3">
            <Server className={cn("w-5 h-5 mt-0.5 flex-shrink-0", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
            <div>
              <h3 className={cn("font-medium", theme === 'dark' ? 'text-blue-200' : 'text-blue-900')}>
                Cómo configurar la impresión silenciosa
              </h3>
              <ol className={cn("text-sm mt-2 space-y-1 list-decimal list-inside", theme === 'dark' ? 'text-blue-300' : 'text-blue-700')}>
                <li>Crea un servicio de impresión y guarda las credenciales</li>
                <li>Descarga e instala LogiRapid Print Service en tu PC</li>
                <li>Abre la aplicación y configura las credenciales</li>
                <li>Las impresoras conectadas se detectarán automáticamente</li>
                <li>Desde el Administrador, asigna el tipo de impresora (Tickets, Etiquetas, etc.)</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Services List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className={cn("w-8 h-8 animate-spin", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
          </div>
        ) : services.length === 0 ? (
          <div className={cn(
            "text-center py-12 rounded-xl border-2 border-dashed",
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <Printer className={cn("w-14 h-14 mx-auto mb-4", theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
            <p className={cn("text-base font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              No hay servicios de impresión
            </p>
            <p className={cn("text-sm mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
              Crea un servicio para imprimir recibos automáticamente
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((service) => (
              <div
                key={service.id}
                className={cn(
                  "p-4 rounded-xl border transition-all hover:shadow-md",
                  theme === 'dark'
                    ? 'bg-gray-900/60 border-gray-700 hover:border-gray-600'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      service.status === 'active'
                        ? theme === 'dark' ? "bg-green-900/40 border border-green-800" : "bg-green-100"
                        : theme === 'dark' ? "bg-gray-800 border border-gray-700" : "bg-gray-100"
                    )}>
                      <Printer className={cn(
                        "w-5 h-5",
                        service.status === 'active'
                          ? theme === 'dark' ? "text-green-400" : "text-green-600"
                          : theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )} />
                    </div>
                    <div>
                      <h3 className={cn("font-semibold text-sm", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {service.serviceName}
                      </h3>
                      <p className={cn("text-xs font-mono", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                        {service.serviceCode}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(service.status, service.lastSeenAt)}
                    <div className="relative">
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === service.id ? null : service.id)}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          theme === 'dark'
                            ? 'hover:bg-gray-700 text-gray-400'
                            : 'hover:bg-gray-100 text-gray-500'
                        )}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Action Menu */}
                      {actionMenuOpen === service.id && (
                        <div className={cn(
                          "absolute right-0 top-8 w-48 rounded-lg shadow-xl border z-10 py-1",
                          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        )}>
                          <button
                            onClick={() => handleViewDetails(service)}
                            className={cn(
                              "w-full px-4 py-2 text-sm text-left flex items-center gap-2",
                              theme === 'dark' ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'
                            )}
                          >
                            <Info className="w-4 h-4" />
                            Ver credenciales
                          </button>
                          <button
                            onClick={() => handleEditService(service)}
                            className={cn(
                              "w-full px-4 py-2 text-sm text-left flex items-center gap-2",
                              theme === 'dark' ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-50 text-gray-700'
                            )}
                          >
                            <Edit3 className="w-4 h-4" />
                            Editar nombre
                          </button>
                          <button
                            onClick={() => handleDeleteService(service.id, service.serviceName)}
                            className={cn(
                              "w-full px-4 py-2 text-sm text-left flex items-center gap-2",
                              theme === 'dark' ? 'hover:bg-red-900/30 text-red-400' : 'hover:bg-red-50 text-red-600'
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "space-y-1.5 text-xs",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  {service.hostname && (
                    <p className="flex items-center gap-2">
                      <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>Host:</span>
                      {service.hostname}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>Última conexión:</span>
                    {formatLastSeen(service.lastSeenAt)}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>Impresoras:</span>
                    {service.printerCount || 0} detectada(s)
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close menu */}
      {actionMenuOpen !== null && (
        <div className="fixed inset-0 z-0" onClick={() => setActionMenuOpen(null)} />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl",
              theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
            )}
          >
            <h2 className={cn(
              "text-lg font-bold mb-4 flex items-center gap-3",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Plus className="w-5 h-5 text-white" />
              </div>
              Nuevo Servicio de Impresión
            </h2>
            <form onSubmit={handleCreateService} className="space-y-4">
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Nombre del servicio *
                </label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="ej: Impresora POS Terminal 1"
                  className={cn(
                    "w-full px-4 py-3 text-sm rounded-xl border focus:ring-2 focus:outline-none transition-all",
                    theme === 'dark'
                      ? 'bg-gray-900 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                  )}
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setServiceName(''); }}
                  disabled={creating}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !serviceName.trim()}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-colors",
                    creating || !serviceName.trim()
                      ? 'bg-purple-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700'
                  )}
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creating ? 'Creando...' : 'Crear Servicio'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl",
              theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
            )}
          >
            <h2 className={cn(
              "text-lg font-bold mb-4 flex items-center gap-3",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Edit3 className="w-5 h-5 text-white" />
              </div>
              Editar Servicio
            </h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Nombre del servicio *
                </label>
                <input
                  type="text"
                  value={editServiceName}
                  onChange={(e) => setEditServiceName(e.target.value)}
                  placeholder="ej: Impresora POS Terminal 1"
                  className={cn(
                    "w-full px-4 py-3 text-sm rounded-xl border focus:ring-2 focus:outline-none transition-all",
                    theme === 'dark'
                      ? 'bg-gray-900 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setSelectedService(null); }}
                  disabled={updating}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating || !editServiceName.trim()}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2 transition-colors",
                    updating || !editServiceName.trim()
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  )}
                >
                  {updating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {updating ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto",
              theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
            )}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className={cn(
                "text-lg font-bold flex items-center gap-3",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <Key className="w-5 h-5 text-white" />
                </div>
                Credenciales del Servicio
              </h2>
              {getStatusBadge(selectedService.status, selectedService.lastSeenAt)}
            </div>

            <div className="space-y-4">
              {/* Service Info */}
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-gray-900/60 border border-gray-700' : 'bg-gray-50'
              )}>
                <h3 className={cn("font-semibold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {selectedService.serviceName}
                </h3>
                <div className={cn("text-sm space-y-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  {selectedService.hostname && <p>Host: {selectedService.hostname}</p>}
                  {selectedService.platform && <p>Plataforma: {selectedService.platform}</p>}
                  {selectedService.version && <p>Versión: {selectedService.version}</p>}
                  <p>Creado: {new Date(selectedService.createdAt).toLocaleDateString('es-ES')}</p>
                </div>
              </div>

              {/* Credentials */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  ID del Servicio (Service Code)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedService.serviceCode}
                    readOnly
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-mono font-bold rounded-xl border",
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-600 text-white'
                        : 'bg-gray-100 border-gray-200 text-gray-900'
                    )}
                  />
                  <button
                    onClick={() => copyToClipboard(selectedService.serviceCode, 'serviceCode')}
                    className={cn(
                      "px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1",
                      copied === 'serviceCode'
                        ? 'bg-green-500 text-white'
                        : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    )}
                  >
                    {copied === 'serviceCode' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedService.apiKey || 'No disponible'}
                    readOnly
                    className={cn(
                      "flex-1 px-4 py-2.5 text-xs font-mono rounded-xl border",
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-600 text-white'
                        : 'bg-gray-100 border-gray-200 text-gray-900'
                    )}
                  />
                  {selectedService.apiKey && (
                    <button
                      onClick={() => copyToClipboard(selectedService.apiKey, 'apiKey')}
                      className={cn(
                        "px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1",
                        copied === 'apiKey'
                          ? 'bg-green-500 text-white'
                          : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      )}
                    >
                      {copied === 'apiKey' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* API Secret Warning */}
              <div className={cn(
                "p-4 rounded-xl border",
                theme === 'dark' ? 'bg-amber-950/40 border-amber-800' : 'bg-amber-50 border-amber-200'
              )}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn("w-5 h-5 flex-shrink-0", theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
                  <div>
                    <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-amber-200' : 'text-amber-800')}>
                      API Secret no disponible
                    </p>
                    <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-amber-300/80' : 'text-amber-700')}>
                      El API Secret solo se muestra al crear el servicio. Si lo perdiste, puedes regenerar las credenciales.
                    </p>
                  </div>
                </div>
              </div>

              {/* Printers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={cn(
                    "block text-sm font-medium",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Impresoras Detectadas ({selectedService.printers?.length || 0})
                  </label>
                  <button
                    onClick={refreshPrinters}
                    disabled={refreshingPrinters}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors",
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    )}
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", refreshingPrinters && "animate-spin")} />
                    {refreshingPrinters ? 'Actualizando...' : 'Actualizar'}
                  </button>
                </div>
              {selectedService.printers && selectedService.printers.length > 0 ? (
                  <div className="space-y-2">
                    {selectedService.printers.map((printer: any) => (
                      <div
                        key={printer.id}
                        className={cn(
                          "p-3 rounded-xl border flex items-center gap-3",
                          theme === 'dark' ? 'bg-gray-900/60 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          printer.isOnline
                            ? theme === 'dark' ? 'bg-green-900/40' : 'bg-green-100'
                            : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )}>
                          <Printer className={cn(
                            "w-4 h-4",
                            printer.isOnline
                              ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                              : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {printer.printerName}
                          </p>
                          <div className="flex items-center gap-2">
                            <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                              {PRINTER_TYPES.find(t => t.id === printer.printerType)?.label || 'Sin configurar'}
                            </p>
                            {printer.supportedDocumentTypes && (
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded",
                                printer.supportedDocumentTypes.length === ALL_DOCUMENT_TYPES.length
                                  ? theme === 'dark' ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700'
                                  : theme === 'dark' ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-700'
                              )}>
                                {printer.supportedDocumentTypes.length === ALL_DOCUMENT_TYPES.length
                                  ? 'Todos los docs'
                                  : `${printer.supportedDocumentTypes.length} docs`}
                              </span>
                            )}
                          </div>
                        </div>
                        {printer.isDefault && (
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            theme === 'dark' ? 'bg-purple-900/40 text-purple-300' : 'bg-purple-100 text-purple-700'
                          )}>
                            Predeterminada
                          </span>
                        )}
                        <button
                          onClick={() => openPrinterConfig(printer)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                            theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          )}
                        >
                          Configurar
                        </button>
                      </div>
                    ))}
                  </div>
              ) : (
                <div className={cn(
                  "p-4 rounded-xl border text-center",
                  theme === 'dark' ? 'bg-gray-900/60 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}>
                  <Printer className={cn("w-8 h-8 mx-auto mb-2", theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                  <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    No hay impresoras registradas
                  </p>
                  <p className={cn("text-xs mt-1", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                    Inicia la app LogiRapid Print Service para detectar impresoras
                  </p>
                </div>
              )}
              </div>
            </div>

            <div className="flex gap-3 justify-between pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleRegenerateCredentials}
                disabled={regenerating}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors",
                  regenerating
                    ? 'bg-amber-400 text-white cursor-not-allowed'
                    : theme === 'dark'
                      ? 'bg-amber-900/40 text-amber-300 hover:bg-amber-900/60 border border-amber-800'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                )}
              >
                {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                {regenerating ? 'Regenerando...' : 'Regenerar Credenciales'}
              </button>
              <button
                onClick={() => { setShowDetailsModal(false); setSelectedService(null); }}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-medium text-white",
                  theme === 'dark' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-purple-500 hover:bg-purple-600'
                )}
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Credentials Modal (for new or regenerated credentials) */}
      {showCredentialsModal && newCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl",
              theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
            )}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Key className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Credenciales Generadas
                </h2>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Guárdalas en un lugar seguro
                </p>
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-xl mb-6 border",
              theme === 'dark' ? 'bg-red-950/40 border-red-800' : 'bg-red-50 border-red-200'
            )}>
              <div className="flex items-start gap-3">
                <AlertCircle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", theme === 'dark' ? 'text-red-400' : 'text-red-600')} />
                <p className={cn("text-sm", theme === 'dark' ? 'text-red-200' : 'text-red-800')}>
                  <strong>Importante:</strong> Guarda estas credenciales ahora. El API Secret no se mostrará de nuevo.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  ID del Servicio (Service Code)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCredentials.serviceCode}
                    readOnly
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-mono font-bold rounded-xl border",
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-600 text-white'
                        : 'bg-gray-100 border-gray-200 text-gray-900'
                    )}
                  />
                  <button
                    onClick={() => copyToClipboard(newCredentials.serviceCode, 'new-serviceCode')}
                    className={cn(
                      "px-3 py-2.5 rounded-xl transition-colors",
                      copied === 'new-serviceCode'
                        ? 'bg-green-500 text-white'
                        : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    )}
                  >
                    {copied === 'new-serviceCode' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCredentials.apiKey}
                    readOnly
                    className={cn(
                      "flex-1 px-4 py-2.5 text-xs font-mono rounded-xl border",
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-600 text-white'
                        : 'bg-gray-100 border-gray-200 text-gray-900'
                    )}
                  />
                  <button
                    onClick={() => copyToClipboard(newCredentials.apiKey, 'new-apiKey')}
                    className={cn(
                      "px-3 py-2.5 rounded-xl transition-colors",
                      copied === 'new-apiKey'
                        ? 'bg-green-500 text-white'
                        : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    )}
                  >
                    {copied === 'new-apiKey' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  API Secret
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCredentials.apiSecret}
                    readOnly
                    className={cn(
                      "flex-1 px-4 py-2.5 text-xs font-mono rounded-xl border",
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-600 text-green-400'
                        : 'bg-gray-100 border-gray-200 text-green-700'
                    )}
                  />
                  <button
                    onClick={() => copyToClipboard(newCredentials.apiSecret, 'new-apiSecret')}
                    className={cn(
                      "px-3 py-2.5 rounded-xl transition-colors",
                      copied === 'new-apiSecret'
                        ? 'bg-green-500 text-white'
                        : theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    )}
                  >
                    {copied === 'new-apiSecret' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6">
              <button
                onClick={() => {
                  setShowCredentialsModal(false)
                  setNewCredentials(null)
                }}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-medium text-white",
                  theme === 'dark' ? 'bg-green-600 hover:bg-green-500' : 'bg-green-500 hover:bg-green-600'
                )}
              >
                He guardado las credenciales
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Printer Configuration Modal */}
      {showPrinterConfigModal && selectedPrinter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto",
              theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white'
            )}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Configurar Impresora
                </h2>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  {selectedPrinter.printerName}
                </p>
              </div>
            </div>

            {/* Printer Type */}
            <div className="mb-6">
              <label className={cn(
                "block text-sm font-medium mb-3",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Tipo de Impresora
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRINTER_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setPrinterConfig(prev => ({ ...prev, printerType: type.id }))}
                    className={cn(
                      "p-3 rounded-xl border-2 text-left transition-all",
                      printerConfig.printerType === type.id
                        ? theme === 'dark'
                          ? "border-blue-500 bg-blue-900/30"
                          : "border-blue-500 bg-blue-50"
                        : theme === 'dark'
                          ? "border-gray-700 hover:border-gray-600"
                          : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <p className={cn(
                      "text-sm font-medium",
                      printerConfig.printerType === type.id
                        ? theme === 'dark' ? "text-blue-300" : "text-blue-700"
                        : theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {type.label}
                    </p>
                    <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                      {type.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Supported Document Types */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className={cn(
                  "block text-sm font-medium",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Documentos Soportados
                </label>
                <button
                  onClick={() => setPrinterConfig(prev => ({
                    ...prev,
                    supportedDocumentTypes: prev.supportedDocumentTypes.length === ALL_DOCUMENT_TYPES.length
                      ? []
                      : ALL_DOCUMENT_TYPES.map(t => t.id)
                  }))}
                  className={cn(
                    "text-xs font-medium",
                    theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                  )}
                >
                  {printerConfig.supportedDocumentTypes.length === ALL_DOCUMENT_TYPES.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
              </div>
              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {ALL_DOCUMENT_TYPES.map(docType => (
                  <label
                    key={docType.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                      printerConfig.supportedDocumentTypes.includes(docType.id)
                        ? theme === 'dark'
                          ? "border-green-600 bg-green-900/30"
                          : "border-green-500 bg-green-50"
                        : theme === 'dark'
                          ? "border-gray-700 hover:bg-gray-700/50"
                          : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={printerConfig.supportedDocumentTypes.includes(docType.id)}
                      onChange={() => toggleDocumentType(docType.id)}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <p className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {docType.label}
                      </p>
                      <p className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                        {docType.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowPrinterConfigModal(false)}
                disabled={savingPrinter}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                )}
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePrinterConfig}
                disabled={savingPrinter || printerConfig.supportedDocumentTypes.length === 0}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-sm font-medium text-white flex items-center gap-2",
                  savingPrinter || printerConfig.supportedDocumentTypes.length === 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-500 hover:bg-blue-600'
                )}
              >
                {savingPrinter ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Configuración'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
