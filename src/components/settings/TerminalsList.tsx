'use client'

import { useState, useEffect, useCallback } from 'react'

interface Terminal {
  id: number
  companyId: number | null
  name: string
  provider: string
  deviceId: string | null
  deviceCode: string | null
  deviceCodeId: string | null
  status: string
  lastSeenAt: string | null
  pairedAt: string | null
  locationName: string | null
  createdAt: string
  companyName?: string
}

interface DeviceCodeResponse {
  terminalId: number
  deviceCodeId: string
  code: string
  status: string
  expiresAt: string
}

interface Props {
  companyId?: number | null  // null = platform terminals
  isPlatform?: boolean
}

export function TerminalsList({ companyId, isPlatform = false }: Props) {
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeviceCodeModal, setShowDeviceCodeModal] = useState(false)
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null)
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null)
  const [creatingCode, setCreatingCode] = useState(false)

  // New terminal form
  const [newTerminal, setNewTerminal] = useState({
    name: '',
    provider: 'square',
    locationName: ''
  })
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const fetchTerminals = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (isPlatform) {
        params.set('platform', 'true')
      } else if (companyId) {
        params.set('companyId', companyId.toString())
      }

      const response = await fetch(`/api/terminals?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar terminales')
      }

      setTerminals(data.data.terminals)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [companyId, isPlatform])

  useEffect(() => {
    fetchTerminals()
  }, [fetchTerminals])

  async function createTerminal() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: isPlatform ? null : companyId,
          name: newTerminal.name,
          provider: newTerminal.provider,
          locationName: newTerminal.locationName || null
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al crear terminal')
      }

      setNewTerminal({ name: '', provider: 'square', locationName: '' })
      setShowAddModal(false)
      await fetchTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear terminal')
    } finally {
      setSaving(false)
    }
  }

  async function createDeviceCode(terminal: Terminal) {
    setSelectedTerminal(terminal)
    setCreatingCode(true)
    setDeviceCode(null)
    setShowDeviceCodeModal(true)

    try {
      const response = await fetch('/api/square/create-device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminalId: terminal.id,
          usePlatformCredentials: isPlatform || terminal.companyId === null,
          companyId: terminal.companyId
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al crear device code')
      }

      setDeviceCode(data.data)
      await fetchTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear device code')
      setShowDeviceCodeModal(false)
    } finally {
      setCreatingCode(false)
    }
  }

  async function deleteTerminal(id: number) {
    if (!confirm('¿Eliminar este terminal?')) return

    try {
      const response = await fetch(`/api/terminals/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al eliminar')
      }

      await fetchTerminals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  async function syncTerminals() {
    setSyncing(true)
    setError(null)
    setSyncMessage(null)

    try {
      const response = await fetch('/api/terminals/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPlatform: isPlatform,
          companyId: companyId
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al sincronizar')
      }

      setSyncMessage(data.message)
      await fetchTerminals()

      // Clear message after 5 seconds
      setTimeout(() => setSyncMessage(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  function getStatusBadge(status: string) {
    const badges: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      paired: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    }
    const labels: { [key: string]: string } = {
      pending: 'Pendiente',
      paired: 'Emparejado',
      active: 'Activo',
      inactive: 'Inactivo'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status] || badges.inactive}`}>
        {labels[status] || status}
      </span>
    )
  }

  function getProviderIcon(provider: string) {
    if (provider === 'square') {
      return (
        <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
          <span className="text-white font-bold text-sm">S</span>
        </div>
      )
    }
    return (
      <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
        <span className="text-white font-bold text-sm">S</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {syncMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-700 dark:text-green-400">{syncMessage}</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {isPlatform ? 'Terminales de Plataforma' : 'Mis Terminales'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={syncTerminals}
            disabled={syncing}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {syncing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Sincronizando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Sincronizar
              </>
            )}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>+</span>
            Registrar Terminal
          </button>
        </div>
      </div>

      {terminals.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">No hay terminales registrados</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Haz clic en "Registrar Terminal" para agregar uno
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {terminals.map(terminal => (
            <div
              key={terminal.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getProviderIcon(terminal.provider)}
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{terminal.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {terminal.provider} {terminal.locationName && `• ${terminal.locationName}`}
                    </p>
                    {terminal.deviceId && (
                      <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-1">
                        ID: {terminal.deviceId}
                      </p>
                    )}
                    {terminal.deviceCode && terminal.status === 'pending' && (
                      <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1">
                        Código: {terminal.deviceCode}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(terminal.status)}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                {terminal.provider === 'square' && terminal.status === 'pending' && !terminal.deviceCode && (
                  <button
                    onClick={() => createDeviceCode(terminal)}
                    className="px-3 py-1.5 text-sm bg-black text-white rounded hover:bg-gray-800 transition-colors"
                  >
                    Generar Código
                  </button>
                )}
                {terminal.deviceCode && terminal.status === 'pending' && (
                  <button
                    onClick={() => {
                      setSelectedTerminal(terminal)
                      setDeviceCode({
                        terminalId: terminal.id,
                        deviceCodeId: terminal.deviceCodeId || '',
                        code: terminal.deviceCode || '',
                        status: 'UNPAIRED',
                        expiresAt: ''
                      })
                      setShowDeviceCodeModal(true)
                    }}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Ver Código
                  </button>
                )}
                <button
                  onClick={() => deleteTerminal(terminal.id)}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Terminal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Registrar Terminal
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre del Terminal
                </label>
                <input
                  type="text"
                  value={newTerminal.name}
                  onChange={(e) => setNewTerminal(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Terminal Oficina Principal"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proveedor
                </label>
                <select
                  value={newTerminal.provider}
                  onChange={(e) => setNewTerminal(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="square">Square</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ubicación (opcional)
                </label>
                <input
                  type="text"
                  value={newTerminal.locationName}
                  onChange={(e) => setNewTerminal(prev => ({ ...prev, locationName: e.target.value }))}
                  placeholder="Ej: Sucursal Miami"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createTerminal}
                disabled={!newTerminal.name || saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Code Modal */}
      {showDeviceCodeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Código de Emparejamiento
            </h3>

            {creatingCode ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-500 dark:text-gray-400">Generando código...</p>
              </div>
            ) : deviceCode ? (
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Ingrese este código en el terminal {selectedTerminal?.name}:
                </p>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 mb-4">
                  <span className="text-3xl font-mono font-bold text-gray-900 dark:text-white tracking-wider">
                    {deviceCode.code}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  El código expira en aproximadamente 5 minutos
                </p>
              </div>
            ) : null}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowDeviceCodeModal(false)
                  setDeviceCode(null)
                  setSelectedTerminal(null)
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
