'use client'

import { useState, useEffect } from 'react'

interface PlatformConfig {
  square: {
    configured: boolean
    applicationId: string
    locationId: string
    environment: string
    hasAccessToken: boolean
  }
  stripe: {
    configured: boolean
    publishableKey: string
    hasSecretKey: boolean
    hasWebhookSecret: boolean
    environment: string
  }
}

export function PlatformPaymentConfig() {
  const [config, setConfig] = useState<PlatformConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testingSquare, setTestingSquare] = useState(false)
  const [testingStripe, setTestingStripe] = useState(false)
  const [testResult, setTestResult] = useState<{ provider: string; success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      setLoading(true)
      const response = await fetch('/api/platform/payment-config')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar configuración')
      }

      setConfig(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function testConnection(provider: 'square' | 'stripe') {
    const setTesting = provider === 'square' ? setTestingSquare : setTestingStripe
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/platform/payment-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      })

      const data = await response.json()

      setTestResult({
        provider,
        success: data.success,
        message: data.success ? data.message : data.error
      })
    } catch (err) {
      setTestResult({
        provider,
        success: false,
        message: err instanceof Error ? err.message : 'Error de conexión'
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Square Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Square</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Terminal de pagos físicos</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            config?.square.configured
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {config?.square.configured ? 'Configurado' : 'No configurado'}
          </span>
        </div>

        {config?.square.configured && (
          <div className="space-y-3 mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Application ID:</span>
                <p className="font-mono text-gray-900 dark:text-white">{config.square.applicationId}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Location ID:</span>
                <p className="font-mono text-gray-900 dark:text-white">{config.square.locationId}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Entorno:</span>
                <p className={`font-medium ${
                  config.square.environment === 'production'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {config.square.environment === 'production' ? 'Producción' : 'Sandbox'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Access Token:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {config.square.hasAccessToken ? '••••••••' : 'No configurado'}
                </p>
              </div>
            </div>

            <button
              onClick={() => testConnection('square')}
              disabled={testingSquare}
              className="mt-4 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testingSquare ? 'Probando...' : 'Probar Conexión'}
            </button>

            {testResult?.provider === 'square' && (
              <div className={`mt-3 p-3 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}>
                {testResult.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stripe Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Stripe</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pagos online y terminal</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            config?.stripe.configured
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {config?.stripe.configured ? 'Configurado' : 'No configurado'}
          </span>
        </div>

        {config?.stripe.configured && (
          <div className="space-y-3 mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Publishable Key:</span>
                <p className="font-mono text-gray-900 dark:text-white">{config.stripe.publishableKey}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Entorno:</span>
                <p className={`font-medium ${
                  config.stripe.environment === 'production'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {config.stripe.environment === 'production' ? 'Producción' : 'Sandbox'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Secret Key:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {config.stripe.hasSecretKey ? '••••••••' : 'No configurado'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Webhook Secret:</span>
                <p className="font-medium text-gray-900 dark:text-white">
                  {config.stripe.hasWebhookSecret ? '••••••••' : 'No configurado'}
                </p>
              </div>
            </div>

            <button
              onClick={() => testConnection('stripe')}
              disabled={testingStripe}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testingStripe ? 'Probando...' : 'Probar Conexión'}
            </button>

            {testResult?.provider === 'stripe' && (
              <div className={`mt-3 p-3 rounded-lg ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}>
                {testResult.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
