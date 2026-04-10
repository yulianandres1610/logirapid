'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Settings, Loader2, Plus, Key, Copy, Check, Trash2, Shield, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ApiKey {
  id: number
  prefix: string
  name: string
  type: string
  lastUsed: string | null
  active: boolean
  createdAt: string
}

interface ApiKeysResponse {
  keys: ApiKey[]
  total: number
}

export default function SettingsPage() {
  const { theme } = useTheme()
  const [keys, setKeys] = useState<ApiKeysResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState<number | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'openclaw' })

  const fetchKeys = useCallback(() => {
    setLoading(true)
    fetch('/api/marketing-intel/api-keys')
      .then(r => r.json())
      .then(res => { if (res.success) setKeys(res.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  const handleGenerate = async () => {
    if (!form.name) return
    setGenerating(true)
    try {
      const res = await fetch('/api/marketing-intel/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        setNewKey(json.data.key)
        setForm({ name: '', type: 'openclaw' })
        fetchKeys()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const handleRevoke = async (id: number) => {
    setRevoking(id)
    try {
      const res = await fetch(`/api/marketing-intel/api-keys/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) fetchKeys()
    } catch (e) {
      console.error(e)
    } finally {
      setRevoking(null)
    }
  }

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return 'Nunca'
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const inputClass = cn('w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-orange-500/50',
    theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900')

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Settings className="w-6 h-6 inline mr-2" />Configuracion
            </h1>
            <p className="text-gray-500 text-sm mt-1">API Keys y configuracion de integraciones</p>
          </div>

          {/* Generate New Key */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
            <h3 className={cn('font-semibold mb-4 flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
              <Key className="w-4 h-4" />Generar Nueva API Key
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={cn('block text-xs font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Nombre *
                </label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: OpenClaw Production" className={inputClass} />
              </div>
              <div>
                <label className={cn('block text-xs font-medium mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Tipo
                </label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className={inputClass}>
                  <option value="openclaw">OpenClaw Agent</option>
                  <option value="webhook">Webhook</option>
                  <option value="integration">Integracion Externa</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleGenerate} disabled={generating || !form.name}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Generar Key
                </button>
              </div>
            </div>
          </motion.div>

          {/* Newly Generated Key (shown once) */}
          {newKey && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={cn('p-5 rounded-xl border-2 border-orange-500/50',
                theme === 'dark' ? 'bg-orange-900/10' : 'bg-orange-50')}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold mb-1', theme === 'dark' ? 'text-orange-300' : 'text-orange-800')}>
                    Guarda esta API Key ahora. No se mostrara de nuevo.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className={cn('flex-1 px-3 py-2 rounded-lg text-sm font-mono break-all',
                      theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-800')}>
                      {showKey ? newKey : newKey.substring(0, 12) + '...' + newKey.substring(newKey.length - 4)}
                    </code>
                    <button onClick={() => setShowKey(!showKey)}
                      className={cn('p-2 rounded-lg shrink-0',
                        theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500')}>
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={copyKey}
                      className={cn('p-2 rounded-lg shrink-0',
                        copied ? 'text-emerald-500' : theme === 'dark' ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500')}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <button onClick={() => { setNewKey(null); setShowKey(false) }}
                    className="mt-3 text-xs text-gray-500 hover:text-gray-400">
                    Cerrar este aviso
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Existing Keys Table */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
            <div className={cn('px-5 py-3 border-b', theme === 'dark' ? 'bg-gray-800/80 border-gray-700' : 'bg-gray-50 border-gray-200')}>
              <h3 className={cn('font-semibold flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                <Shield className="w-4 h-4" />API Keys Existentes
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn(theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/50')}>
                      {['Prefijo', 'Nombre', 'Tipo', 'Ultimo Uso', 'Estado', ''].map(h => (
                        <th key={h} className={cn('px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {keys?.keys && keys.keys.length > 0 ? keys.keys.map((k, i) => (
                      <motion.tr key={k.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={cn('border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-100')}>
                        <td className={cn('px-4 py-3 font-mono text-xs', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                          {k.prefix}...
                        </td>
                        <td className={cn('px-4 py-3 font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {k.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                            theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                            {k.type}
                          </span>
                        </td>
                        <td className={cn('px-4 py-3 text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {formatDate(k.lastUsed)}
                        </td>
                        <td className="px-4 py-3">
                          {k.active ? (
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold',
                              theme === 'dark' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600')}>
                              Activa
                            </span>
                          ) : (
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold',
                              theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600')}>
                              Revocada
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {k.active && (
                            <button onClick={() => handleRevoke(k.id)} disabled={revoking === k.id}
                              className={cn('p-1.5 rounded-lg transition-colors',
                                theme === 'dark' ? 'hover:bg-red-900/30 text-gray-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-500')}>
                              {revoking === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          Sin API Keys creadas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
