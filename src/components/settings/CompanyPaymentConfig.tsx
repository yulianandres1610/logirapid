'use client'

import { useState, useEffect } from 'react'

interface CompanyPaymentSettings {
  companyId: number
  activeProvider: string
  square: {
    configured: boolean
    applicationId: string | null
    locationId: string | null
    environment: string
  }
  stripe: {
    configured: boolean
    publishableKey: string | null
  }
}

interface Props {
  companyId: number
}

export function CompanyPaymentConfig({ companyId }: Props) {
  const [settings, setSettings] = useState<CompanyPaymentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testingSquare, setTestingSquare] = useState(false)
  const [testingStripe, setTestingStripe] = useState(false)
  const [testResult, setTestResult] = useState<{ provider: string; success: boolean; message: string } | null>(null)
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({})

  // Form state
  const [activeProvider, setActiveProvider] = useState('none')
  const [squareForm, setSquareForm] = useState({
    accessToken: '',
    applicationId: '',
    locationId: '',
    environment: 'sandbox'
  })
  const [stripeForm, setStripeForm] = useState({
    secretKey: '',
    publishableKey: '',
    webhookSecret: ''
  })

  useEffect(() => {
    fetchSettings()
  }, [companyId])

  async function fetchSettings() {
    try {
      setLoading(true)
      const response = await fetch(`/api/companies/${companyId}/payment-settings`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al cargar configuración')
      }

      setSettings(data.data)
      setActiveProvider(data.data.activeProvider || 'none')

      if (data.data.square) {
        setSquareForm(prev => ({
          ...prev,
          applicationId: data.data.square.applicationId || '',
          locationId: data.data.square.locationId || '',
          environment: data.data.square.environment || 'sandbox'
        }))
      }

      if (data.data.stripe) {
        setStripeForm(prev => ({
          ...prev,
          publishableKey: data.data.stripe.publishableKey || ''
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function saveSquareSettings() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/companies/${companyId}/payment-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeProvider,
          square: {
            accessToken: squareForm.accessToken || undefined,
            applicationId: squareForm.applicationId || undefined,
            locationId: squareForm.locationId || undefined,
            environment: squareForm.environment
          }
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar')
      }

      setSquareForm(prev => ({ ...prev, accessToken: '' }))
      await fetchSettings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function saveStripeSettings() {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/companies/${companyId}/payment-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeProvider,
          stripe: {
            secretKey: stripeForm.secretKey || undefined,
            publishableKey: stripeForm.publishableKey || undefined,
            webhookSecret: stripeForm.webhookSecret || undefined
          }
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al guardar')
      }

      setStripeForm(prev => ({ ...prev, secretKey: '', webhookSecret: '' }))
      await fetchSettings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function testConnection(provider: 'square' | 'stripe') {
    const setTesting = provider === 'square' ? setTestingSquare : setTestingStripe
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch(`/api/companies/${companyId}/payment-settings`, {
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

  function togglePassword(key: string) {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Provider Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Proveedor Activo</h3>
        <select
          value={activeProvider}
          onChange={(e) => setActiveProvider(e.target.value)}
          className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="none">Ninguno</option>
          <option value="square">Square</option>
          <option value="stripe">Stripe</option>
          <option value="both">Ambos</option>
        </select>
      </div>

      {/* Square Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
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
            settings?.square.configured
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {settings?.square.configured ? 'Configurado' : 'No configurado'}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Access Token
            </label>
            <div className="relative">
              <input
                type={showPasswords.squareToken ? 'text' : 'password'}
                value={squareForm.accessToken}
                onChange={(e) => setSquareForm(prev => ({ ...prev, accessToken: e.target.value }))}
                placeholder={settings?.square.configured ? '••••••••' : 'Ingrese su access token'}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => togglePassword('squareToken')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.squareToken ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Application ID
              </label>
              <input
                type="text"
                value={squareForm.applicationId}
                onChange={(e) => setSquareForm(prev => ({ ...prev, applicationId: e.target.value }))}
                placeholder="sq0idp-xxxxx"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location ID
              </label>
              <input
                type="text"
                value={squareForm.locationId}
                onChange={(e) => setSquareForm(prev => ({ ...prev, locationId: e.target.value }))}
                placeholder="LXXXXXXXXXX"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Entorno
            </label>
            <select
              value={squareForm.environment}
              onChange={(e) => setSquareForm(prev => ({ ...prev, environment: e.target.value }))}
              className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Producción</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={saveSquareSettings}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar Square'}
            </button>

            {settings?.square.configured && (
              <button
                onClick={() => testConnection('square')}
                disabled={testingSquare}
                className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testingSquare ? 'Probando...' : 'Probar Conexión'}
              </button>
            )}
          </div>

          {testResult?.provider === 'square' && (
            <div className={`p-3 rounded-lg ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Stripe Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
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
            settings?.stripe.configured
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {settings?.stripe.configured ? 'Configurado' : 'No configurado'}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Secret Key
            </label>
            <div className="relative">
              <input
                type={showPasswords.stripeSecret ? 'text' : 'password'}
                value={stripeForm.secretKey}
                onChange={(e) => setStripeForm(prev => ({ ...prev, secretKey: e.target.value }))}
                placeholder={settings?.stripe.configured ? '••••••••' : 'sk_test_xxxxx o sk_live_xxxxx'}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => togglePassword('stripeSecret')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.stripeSecret ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Publishable Key
            </label>
            <input
              type="text"
              value={stripeForm.publishableKey}
              onChange={(e) => setStripeForm(prev => ({ ...prev, publishableKey: e.target.value }))}
              placeholder="pk_test_xxxxx o pk_live_xxxxx"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Webhook Secret (opcional)
            </label>
            <div className="relative">
              <input
                type={showPasswords.stripeWebhook ? 'text' : 'password'}
                value={stripeForm.webhookSecret}
                onChange={(e) => setStripeForm(prev => ({ ...prev, webhookSecret: e.target.value }))}
                placeholder="whsec_xxxxx"
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => togglePassword('stripeWebhook')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.stripeWebhook ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={saveStripeSettings}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar Stripe'}
            </button>

            {settings?.stripe.configured && (
              <button
                onClick={() => testConnection('stripe')}
                disabled={testingStripe}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testingStripe ? 'Probando...' : 'Probar Conexión'}
              </button>
            )}
          </div>

          {testResult?.provider === 'stripe' && (
            <div className={`p-3 rounded-lg ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {testResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
