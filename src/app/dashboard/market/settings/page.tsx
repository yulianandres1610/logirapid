'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
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
  Zap
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface OdooConfig {
  url: string
  database: string
  apiKey: string
  enabled: boolean
  syncFrequency: 'manual' | 'hourly' | 'daily'
  syncDirection: 'import' | 'export' | 'both'
  syncVariants: boolean
  syncStock: boolean
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

export default function MarketSettingsPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const [config, setConfig] = useState<OdooConfig>({
    url: '',
    database: '',
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
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/market/odoo/config')
        const data = await response.json()
        if (data.success && data.data) {
          setConfig({
            url: data.data.odooUrl || '',
            database: data.data.odooDatabase || '',
            apiKey: data.data.odooApiKey || '',
            enabled: data.data.odooEnabled || false,
            syncFrequency: data.data.syncFrequency || 'manual',
            syncDirection: data.data.syncDirection || 'both',
            syncVariants: data.data.syncVariants !== false,
            syncStock: data.data.syncStock !== false
          })
        }
      } catch (error) {
        console.error('Error fetching config:', error)
      } finally {
        setLoading(false)
      }
    }

    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/market/odoo/logs')
        const data = await response.json()
        if (data.success) {
          setSyncLogs(data.data || [])
        }
      } catch (error) {
        console.error('Error fetching logs:', error)
      }
    }

    fetchConfig()
    fetchLogs()
  }, [])

  const testConnection = async () => {
    if (!config.url || !config.apiKey) {
      setMessage({ type: 'error', text: 'Completa la URL y API Key primero' })
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
          url: config.url,
          database: config.database,
          apiKey: config.apiKey
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
        setMessage({ type: 'success', text: `Conectado a Odoo ${data.version}` })
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

  const saveConfig = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/market/odoo/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Configuración guardada' })
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
            ? `Importados: ${data.data.imported}, Actualizados: ${data.data.updated}`
            : `Exportados: ${data.data.exported}`
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
          <div className="max-w-4xl mx-auto space-y-6">

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
                  Integración con Odoo 16 y sincronización de productos
                </p>
              </div>
              <Settings className={cn(
                "w-8 h-8",
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              )} />
            </div>

            {/* Message */}
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
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

            {/* Connection Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-2xl border p-6 shadow-lg",
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <h2 className={cn(
                "text-lg font-bold flex items-center gap-3 mb-6",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-white" />
                </div>
                Conexión Odoo
              </h2>

              <div className="space-y-4">
                {/* URL */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    <Server className="w-4 h-4 inline mr-2" />
                    URL del Servidor *
                  </label>
                  <input
                    type="url"
                    value={config.url}
                    onChange={(e) => setConfig({ ...config, url: e.target.value })}
                    placeholder="https://mi-odoo.com"
                    className={cn(
                      'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
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
                    Nombre de Base de Datos *
                  </label>
                  <input
                    type="text"
                    value={config.database}
                    onChange={(e) => setConfig({ ...config, database: e.target.value })}
                    placeholder="nombre_base_datos"
                    className={cn(
                      'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    <Key className="w-4 h-4 inline mr-2" />
                    API Key *
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={config.apiKey}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      placeholder="••••••••••••••••"
                      className={cn(
                        'w-full px-4 py-2.5 pr-10 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
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
                    disabled={testing || !config.url}
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
                      checked={config.enabled}
                      onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={cn(
                      "w-11 h-6 rounded-full transition-colors relative",
                      config.enabled
                        ? 'bg-blue-500'
                        : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                    )}>
                      <div className={cn(
                        "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow",
                        config.enabled ? 'translate-x-5' : 'translate-x-0.5'
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
            </motion.div>

            {/* Sync Options */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                "rounded-2xl border p-6 shadow-lg",
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <h2 className={cn(
                "text-lg font-bold flex items-center gap-3 mb-6",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
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
                    value={config.syncFrequency}
                    onChange={(e) => setConfig({ ...config, syncFrequency: e.target.value as any })}
                    className={cn(
                      'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-900/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
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
                    value={config.syncDirection}
                    onChange={(e) => setConfig({ ...config, syncDirection: e.target.value as any })}
                    className={cn(
                      'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-900/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                    )}
                  >
                    <option value="import">Solo Importar</option>
                    <option value="export">Solo Exportar</option>
                    <option value="both">Bidireccional</option>
                  </select>
                </div>

                {/* Options */}
                <div className="md:col-span-2 flex flex-wrap gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.syncVariants}
                      onChange={(e) => setConfig({ ...config, syncVariants: e.target.checked })}
                      className={cn(
                        "w-5 h-5 rounded border-2 transition-colors",
                        config.syncVariants
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
                      checked={config.syncStock}
                      onChange={(e) => setConfig({ ...config, syncStock: e.target.checked })}
                      className={cn(
                        "w-5 h-5 rounded border-2 transition-colors",
                        config.syncStock
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
            </motion.div>

            {/* Sync Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                "rounded-2xl border p-6 shadow-lg",
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <h2 className={cn(
                "text-lg font-bold flex items-center gap-3 mb-6",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Play className="w-5 h-5 text-white" />
                </div>
                Acciones
              </h2>

              <div className="flex flex-wrap gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => startSync('import')}
                  disabled={syncing || !config.enabled}
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
                  disabled={syncing || !config.enabled}
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

              {!config.enabled && (
                <p className={cn(
                  "text-sm mt-4 flex items-center gap-2",
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                )}>
                  <AlertTriangle className="w-4 h-4" />
                  Habilita la sincronización para usar estas acciones
                </p>
              )}
            </motion.div>

            {/* Sync History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                "rounded-2xl border p-6 shadow-lg",
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
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
            </motion.div>

            {/* Save Button */}
            <div className="flex justify-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={saveConfig}
                disabled={saving}
                className={cn(
                  "flex items-center gap-2 px-8 py-3 rounded-xl font-medium transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-400/25'
                )}
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Guardar Configuración
              </motion.button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
