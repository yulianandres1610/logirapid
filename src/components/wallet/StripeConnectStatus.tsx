'use client'

import { useState, useEffect } from 'react'
import { Building2, ExternalLink, CheckCircle2, AlertCircle, Clock, Loader2, RefreshCw } from 'lucide-react'

interface ConnectStatus {
  entityType: string
  entityId: number
  entityName: string
  connected: boolean
  status: 'not_connected' | 'pending' | 'active' | 'restricted'
  payoutsEnabled: boolean
  chargesEnabled: boolean
  detailsSubmitted: boolean
  canCashout: boolean
  stripeAccountId: string | null
  walletBalance: number
  walletNumber: string | null
  connectedAt: string | null
  requirements: {
    currentlyDue: string[]
    eventuallyDue: string[]
    pastDue: string[]
    disabledReason: string | null
  } | null
  externalAccounts?: Array<{
    id: string
    type: string
    last4: string
    bankName: string
    currency: string
    default: boolean
  }>
}

interface StripeConnectStatusProps {
  entityType: 'company' | 'user'
  entityId: number
  onStatusChange?: (status: ConnectStatus) => void
  compact?: boolean
}

export default function StripeConnectStatus({
  entityType,
  entityId,
  onStatusChange,
  compact = false
}: StripeConnectStatusProps) {
  const [status, setStatus] = useState<ConnectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/stripe/connect/status?entityType=${entityType}&entityId=${entityId}`)
      const data = await res.json()

      if (data.success) {
        setStatus(data.data)
        onStatusChange?.(data.data)
      } else {
        setError(data.error || 'Error al obtener estado')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [entityType, entityId])

  const handleConnect = async () => {
    try {
      setConnecting(true)
      setError(null)

      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId })
      })

      const data = await res.json()

      if (data.success) {
        window.location.href = data.data.onboardingUrl
      } else {
        setError(data.error || 'Error al iniciar conexion')
        setConnecting(false)
      }
    } catch (err) {
      setError('Error de conexion')
      setConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${compact ? 'py-2' : 'py-8'}`}>
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        {!compact && <span className="ml-2 text-sm text-gray-500">Verificando cuenta bancaria...</span>}
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg ${compact ? 'p-2' : 'p-4'}`}>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={fetchStatus}
            className="ml-auto text-red-600 hover:text-red-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  if (!status) return null

  const statusColors = {
    not_connected: 'bg-gray-100 text-gray-700',
    pending: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    restricted: 'bg-red-100 text-red-700'
  }

  const statusLabels = {
    not_connected: 'No conectada',
    pending: 'Pendiente',
    active: 'Activa',
    restricted: 'Restringida'
  }

  const statusIcons = {
    not_connected: <Building2 className="w-4 h-4" />,
    pending: <Clock className="w-4 h-4" />,
    active: <CheckCircle2 className="w-4 h-4" />,
    restricted: <AlertCircle className="w-4 h-4" />
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[status.status]}`}>
          {statusIcons[status.status]}
          {statusLabels[status.status]}
        </span>
        {status.status === 'not_connected' && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {connecting ? 'Conectando...' : 'Conectar'}
          </button>
        )}
        {status.status === 'pending' && (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Completar
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Cuenta Bancaria</h3>
            <p className="text-sm text-gray-500">Stripe Connect</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[status.status]}`}>
          {statusIcons[status.status]}
          {statusLabels[status.status]}
        </span>
      </div>

      {status.status === 'not_connected' && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-3">
            Conecta tu cuenta bancaria para poder retirar fondos de tu billetera digital.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Conectar Cuenta Bancaria
              </>
            )}
          </button>
        </div>
      )}

      {status.status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800 mb-3">
            Tu cuenta esta pendiente de verificacion. Por favor completa los datos requeridos.
          </p>
          {status.requirements?.currentlyDue && status.requirements.currentlyDue.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-yellow-700 font-medium mb-1">Datos pendientes:</p>
              <ul className="text-xs text-yellow-600 list-disc list-inside">
                {status.requirements.currentlyDue.slice(0, 3).map((item, i) => (
                  <li key={i}>{item.replace(/_/g, ' ')}</li>
                ))}
                {status.requirements.currentlyDue.length > 3 && (
                  <li>y {status.requirements.currentlyDue.length - 3} mas...</li>
                )}
              </ul>
            </div>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-all disabled:opacity-50"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Abriendo...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Completar Verificacion
              </>
            )}
          </button>
        </div>
      )}

      {status.status === 'active' && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Cuenta verificada y lista para retiros</span>
            </div>
          </div>

          {status.externalAccounts && status.externalAccounts.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2">Cuenta bancaria vinculada:</p>
              {status.externalAccounts.map((account) => (
                <div key={account.id} className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {account.bankName || 'Banco'} ****{account.last4}
                  </span>
                  {account.default && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Principal</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {status.connectedAt && (
            <p className="text-xs text-gray-500">
              Conectada el {new Date(status.connectedAt).toLocaleDateString('es-ES')}
            </p>
          )}
        </div>
      )}

      {status.status === 'restricted' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 mb-2">
            Tu cuenta tiene restricciones. Por favor contacta a soporte o actualiza tu informacion.
          </p>
          {status.requirements?.disabledReason && (
            <p className="text-xs text-red-600 mb-3">
              Razon: {status.requirements.disabledReason.replace(/_/g, ' ')}
            </p>
          )}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all disabled:opacity-50"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Abriendo...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Actualizar Informacion
              </>
            )}
          </button>
        </div>
      )}

      <button
        onClick={fetchStatus}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        <RefreshCw className="w-3 h-3" />
        Actualizar estado
      </button>
    </div>
  )
}
