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
  Truck
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

type TabType = 'general' | 'odoo' | 'delivery'

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Building },
  { id: 'odoo', label: 'Odoo', icon: Database },
  { id: 'delivery', label: 'Entregas', icon: Truck }
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
            </AnimatePresence>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
